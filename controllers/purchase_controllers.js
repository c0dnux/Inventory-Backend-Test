const mongoose = require("mongoose");
const Purchase = require("../models/purchase_model");
const Product = require("../models/product_model");
const stockMoment = require("../controllers/stock_movement_controllers");
const audit_controllers = require("../controllers/audit_controllers");
const catchAsync = require("../utils/catch_async");
const funcs = require("../utils/custom_funcs");
const notiController = require("../controllers/notification_controllers");
const Notification = require("../models/notification_model");
const AppError = require("../utils/app_error");
const QueryOptions = require("../utils/query_options");
const Idempotency = require("../models/idempotency_model");
const { cacheBust } = require("../utils/cache_middleware");

// How long a concurrent loser waits (in ms) for the winner to back-fill its PO.
const IDEMPOTENCY_WAIT_MS = 100;
const IDEMPOTENCY_MAX_WAIT_MS = 3000;

// Claim the idempotency key for this user. Returns null if this request is the
// owner; otherwise returns the already-created purchase once the owner sets it.
const claimIdempotency = async (user, key) => {
  try {
    await Idempotency.create({ user, key });
    return null; // we won the claim — proceed to create
  } catch (err) {
    if (err?.code !== 11000) throw err; // unexpected error → fail loudly

    // Another request owns the key. Poll briefly for its purchase.
    const deadline = Date.now() + IDEMPOTENCY_MAX_WAIT_MS;
    let existing;
    while (Date.now() < deadline) {
      existing = await Idempotency.findOne({ user, key });
      if (existing?.purchase) {
        return Purchase.findById(existing.purchase);
      }
      await new Promise((resolve) => setTimeout(resolve, IDEMPOTENCY_WAIT_MS));
    }
    return existing?.purchase ? Purchase.findById(existing.purchase) : null;
  }
};

exports.makePurchaseOrder = catchAsync(async (req, res, next) => {
  const { supplier, items, note } = req.body;
  const idempotencyKey = req.get("Idempotency-Key");

  // If a key was supplied and a previous request already completed, return the
  // existing PO instead of creating a duplicate.
  if (idempotencyKey) {
    const existing = await Idempotency.findOne({
      user: req.user._id,
      key: idempotencyKey,
    });
    if (existing?.purchase) {
      const purchase = await Purchase.findById(existing.purchase);
      if (purchase) {
        return res.status(200).json({
          status: "success",
          message: "Purchase order already created",
          data: { purchase },
        });
      }
    }
  }

  const claimError = idempotencyKey
    ? await claimIdempotency(req.user._id, idempotencyKey)
    : null;
  if (claimError) {
    return res.status(200).json({
      status: "success",
      message: "Purchase order already created",
      data: { purchase: claimError },
    });
  }

  // Retry on unique-index collision from generatePurchaseRef race (PO-YYYYMM-NNN).
  let purchase;
  for (let attempt = 0; attempt < 5; attempt++) {
    const genRefNo = await funcs.generatePurchaseRef(Purchase);
    try {
      purchase = await Purchase.create({
        referenceNo: genRefNo,
        supplier,
        items,
        note: note || "purchase order made.",
        createdBy: req.user._id,
      });
      break;
    } catch (err) {
      if (err && err.code === 11000) continue; // ref collision → retry
      throw err;
    }
  }

  if (!purchase) {
    return next(new AppError("Failed to create purchase order", 400));
  }

  // Back-fill the claimed key so retries get this PO.
  if (idempotencyKey) {
    await Idempotency.updateOne(
      { user: req.user._id, key: idempotencyKey },
      { $set: { purchase: purchase._id } },
    );
  }

  await audit_controllers.make_audit({
    user: req.user._id,
    action: "purchase_create",
    resource: "Purchase",
    resourceId: purchase._id,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
    note: "Purchase order made.",
  });
  cacheBust(req);
  res.status(201).json({
    status: "success",
    message: "Purchase order created successfully",
    data: { purchase },
  });
});

exports.getAllPurchases = catchAsync(async (req, res, next) => {
  const features = new QueryOptions(Purchase.find(), req.query)
    .filter()
    .sort()
    .limiting()
    .paginate();
  const purchases = await features.query;
  const totalCount = await features.count();

  res.status(200).json({
    status: "success",
    totalCount,
    data: {
      purchases,
    },
  });
});

exports.getPurchaseById = catchAsync(async (req, res, next) => {
  const purchase = await Purchase.findById(req.params.id);
  if (!purchase) {
    return next(new AppError("Purchase not found", 404));
  }
  res.status(200).json({
    status: "success",
    data: {
      purchase,
    },
  });
});
exports.myPurchases = catchAsync(async (req, res, next) => {
  const features = new QueryOptions(
    Purchase.find({ createdBy: req.user._id }),
    req.query,
  )
    .filter()
    .sort()
    .limiting()
    .paginate();
  const purchases = await features.query;
  const totalCount = await features.count();

  res.status(200).json({
    status: "success",
    totalCount,
    data: {
      purchases,
    },
  });
});
exports.receivePurchaseOrder = catchAsync(async (req, res, next) => {
  const { purchaseId } = req.body;

  const session = await mongoose.startSession();
  try {
    let resultPurchase;
    await session.withTransaction(async () => {
      const purchase = await Purchase.findById(purchaseId).session(session);

      if (!purchase) {
        throw new AppError("Purchase order not found", 404);
      }
      if (purchase.status === "received") {
        throw new AppError("Purchase order has already been received.", 400);
      }
      if (purchase.status === "cancelled") {
        throw new AppError(
          "A cancelled purchase order cannot be received.",
          400,
        );
      }

      // Process line items sequentially. All writes share the transaction
      // session, so a failure on any item rolls back the entire operation
      // (stock, movements, purchase status). Sequential (not Promise.all)
      // avoids write conflicts when the same product appears twice.
      for (const item of purchase.items) {
        const product = await Product.findById(item.product).session(session);
        if (!product) {
          throw new AppError(`Product ${item.product} not found`, 404);
        }
        const oldStock = product.currentStock;
        const newStock = oldStock + item.quantity;
        product.currentStock = newStock;
        //update cost price if it has changed
        if (product.costPrice !== item.unitCost) {
          product.costPrice = item.unitCost;
        }
        await product.save({ session });
        await stockMoment.make_stock_movement(
          {
            product: product._id,
            type: "purchase_in",
            quantity: item.quantity,
            quantityBefore: oldStock,
            quantityAfter: newStock,
            referenceId: purchase._id,
            referenceType: "Purchase",
            createdBy: purchase.createdBy,
            unitCost: item.unitCost,
            note: `Stock verified and checked into warehouse baseline for ${purchase.referenceNo}`,
          },
          session,
        );
      }

      purchase.status = "received";
      await purchase.save({ session });

      // Fire low/out-of-stock alerts (single manager lookup) + purchase-received alert.
      const affectedProducts = await Product.find({
        _id: { $in: purchase.items.map((i) => i.product) },
      }).session(session);
      await Promise.all([
        notiController.checkProductsAndNotify(affectedProducts, session),
        notiController.checkAndNotify(purchase, session),
      ]);

      await audit_controllers.make_audit(
        {
          user: req.user._id,
          action: "stock_in",
          resource: "Purchase",
          resourceId: purchase._id,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
          note: `Purchase order ${purchase.referenceNo} transitioned to RECEIVED. Stock balanced.`,
        },
        session,
      );

      resultPurchase = purchase;
    });

    cacheBust(req, "products", "movements", "notifications");

    res.status(200).json({
      status: "success",
      message: "Purchase order received successfully",
      data: { purchase: resultPurchase },
    });
  } finally {
    await session.endSession();
  }
});
exports.cancelPurchase = catchAsync(async (req, res, next) => {
  const { purchaseId, cancelReason } = req.body;

  const purchase = await Purchase.findById(purchaseId);

  if (!purchase) {
    return next(new AppError("Purchase not found", 404));
  }

  if (purchase.cancelledAt || purchase.status === "received") {
    return next(
      new AppError("Purchase has already been cancelled or received", 400),
    );
  }

  purchase.cancelledAt = new Date();
  purchase.cancelledBy = req.user._id;
  purchase.cancelReason = cancelReason;
  purchase.status = "cancelled";

  await purchase.save();

  await notiController.checkAndNotify(purchase);
  await audit_controllers.make_audit({
    user: req.user._id,
    action: "purchase_cancel",
    resource: "Purchase",
    resourceId: purchase._id,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
    note: `Purchase order ${purchase.referenceNo} has been cancelled.`,
  });

  cacheBust(req, "notifications");

  res.status(200).json({
    status: "success",
    message: "Purchase order cancelled successfully.",
    data: { purchase },
  });
});

