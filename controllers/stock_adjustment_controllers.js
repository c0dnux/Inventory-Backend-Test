const mongoose = require("mongoose");
const StockAdjustment = require("../models/stock_adjustment_model");
const Product = require("../models/product_model");
const catchAsync = require("../utils/catch_async");
const AppError = require("../utils/app_error");
const stockMoment = require("../controllers/stock_movement_controllers");
const notiController = require("../controllers/notification_controllers");
const audit_controllers = require("../controllers/audit_controllers");
const QueryOptions = require("../utils/query_options");
const { cacheBust } = require("../utils/cache_middleware");

exports.adjustStock = catchAsync(async (req, res, next) => {
  const { productId, type, quantity, reason, note } = req.body;

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const product = await Product.findById(productId).session(session);

      if (!product) {
        throw new AppError("Product not found", 404);
      }

      let adjustedQuantity;
      let variance;
      const before = product.currentStock;
      switch (type) {
        case "stock_in":
          adjustedQuantity = product.currentStock + quantity;
          variance = quantity;
          break;

        case "stock_out":
          if (quantity > product.currentStock) {
            throw new AppError("Insufficient stock", 400);
          }

          adjustedQuantity = product.currentStock - quantity;
          variance = -quantity;
          break;

        case "adjustment":
          // quantity is the actual counted stock
          adjustedQuantity = quantity;
          variance = quantity - product.currentStock;
          break;

        default:
          throw new AppError("Invalid stock movement type", 400);
      }

      // Update product stock
      product.currentStock = adjustedQuantity;
      await product.save({ session });
      await notiController.checkAndNotify(product, session);

      const [adjustment] = await StockAdjustment.create(
        [
          {
            product: product._id,
            type,
            quantity: Math.abs(variance),
            adjustedQuantity,
            variance,
            reason,
            createdBy: req.user._id,
            note,
          },
        ],
        { session },
      );

      const movementType =
        variance > 0
          ? "adjustment_in"
          : variance < 0
            ? "adjustment_out"
            : "adjustment";

      await stockMoment.make_stock_movement(
        {
          product: product._id,
          type: movementType,
          quantity: variance,
          quantityBefore: before,
          quantityAfter: adjustedQuantity,
          referenceId: adjustment._id,
          referenceType: "StockAdjustment",
          createdBy: req.user._id,
          note: `Manual stock adjustment (${type})`,
        },
        session,
      );
      const auditActionMap = {
        stock_in: "stock_in",
        stock_out: "stock_out",
        adjustment: "stock_adjustment",
      };
      await audit_controllers.make_audit(
        {
          user: req.user._id,
          action: auditActionMap[type],
          resource: "Product",
          resourceId: product._id,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
          note: "Stock updated via manual adjustment.",
        },
        session,
      );

      result = { adjustment };
    });

    cacheBust(req, "products", "movements", "notifications");

    res.status(201).json({
      status: "success",
      message: "Stock updated successfully.",
      data: result,
    });
  } finally {
    await session.endSession();
  }
});
exports.getAllAdjustments = catchAsync(async (req, res, next) => {
  const features = new QueryOptions(StockAdjustment.find(), req.query)
    .filter()
    .sort()
    .limiting()
    .paginate();
  const adjustments = await features.query;
  const totalCount = await features.count();
  res.status(200).json({
    status: "success",
    totalCount,
    data: { adjustments, length: adjustments.length },
  });
});

exports.getAdjustment = catchAsync(async (req, res, next) => {
  const adjustment = await StockAdjustment.findById(req.params.id);
  if (!adjustment) {
    return next(new AppError("Adjustment not found", 404));
  }
  res.status(200).json({ status: "success", data: { adjustment } });
});
exports.myAdjustments = catchAsync(async (req, res, next) => {
  const adjustment = await StockAdjustment.find({
    createdBy: req.user._id,
  });

  res.status(200).json({ status: "success", data: { adjustment } });
});
