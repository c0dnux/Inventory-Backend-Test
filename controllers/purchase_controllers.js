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

exports.makePurchaseOrder = catchAsync(async (req, res, next) => {
  const genRefNo = await funcs.generatePurchaseRef(Purchase);
  console.log(genRefNo);
  const { supplier, items } = req.body;
  const purchase = await Purchase.create({
    referenceNo: genRefNo,
    supplier,
    items,
    note: "purchase order made.",
    createdBy: req.user._id,
  });
  if (!purchase) {
    return next(new AppError("Failed to create purchase order", 400));
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

  res.status(200).json({
    status: "success",
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
  const purchase = await Purchase.find({ createdBy: req.user._id });
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
exports.receivePurchaseOrder = catchAsync(async (req, res, next) => {
  const { purchaseId } = req.body;
  const purchase = await Purchase.findById(purchaseId);
  if (purchase.status === "received") {
    throw new AppError("Purchase order has already been received.", 400);
  }
  for (const item of purchase.items) {
    const product = await Product.findById(item.product);
    const oldStock = product.currentStock;
    const newStock = oldStock + item.quantity;
    product.currentStock = newStock;
    //update cost price if it has changed
    if (product.costPrice !== item.unitCost) {
      product.costPrice = item.unitCost;
    }
    await product.save();
    await stockMoment.make_stock_movement({
      product: product._id,
      type: "purchase_in",
      quantity: item.quantity,
      quantityBefore: oldStock,
      quantityAfter: newStock,
      referenceId: purchase._id,
      referenceType: "Purchase",
      createdBy: purchase.createdBy,
      note: `Stock verified and checked into warehouse baseline for ${purchase.referenceNo}`,
    });
  }
  purchase.status = "received";
  await purchase.save();
  await notiController.checkAndNotify(purchase);

  await audit_controllers.make_audit({
    user: req.user._id,
    action: "stock_in",
    resource: "Purchase",
    resourceId: purchase._id,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
    note: `Purchase order ${purchase.referenceNo} transitioned to RECEIVED. Stock balanced.`,
  });

  res.status(200).json({
    status: "success",
    message: "Purchase order received successfully",
    data: { purchase },
  });
});
exports.cancelPurchase = catchAsync(async (req, res, next) => {
  const { purchaseId, cancelReason } = req.body;

  const purchase = await Purchase.findById(purchaseId);

  if (!purchase) {
    return next(new AppError("Purchase not found", 404));
  }

  if (purchase.cancelledAt || purchase.status === "received") {
    return next(
      new AppError("Purchase has already been cancelled or recived", 400),
    );
  }

  purchase.cancelledAt = new Date();
  purchase.cancelledBy = req.user._id;
  purchase.cancelReason = cancelReason;
  purchase.status = "cancelled";

  await purchase.save();
  console.log(purchase.status);

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

  res.status(200).json({
    status: "success",
    message: "Purchase order cancelled successfully.",
    data: { purchase },
  });
});

// for (const item of items) {
//     const product = await Product.findById(item.product);
//     await stockMoment.make_stock_movement({
//       product: item.product,
//       type: "purchase_order",
//       quantity: item.quantity,
//       quantityBefore: product.currentStock,
//       quantityAfter: product.currentStock,
//       createdBy: req.user._id,
//       referenceId: purchase._id,
//       referenceType: "Purchase",
//     });
//   }
