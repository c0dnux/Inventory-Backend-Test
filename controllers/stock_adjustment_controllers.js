const StockAdjustment = require("../models/stock_adjustment_model");
const Product = require("../models/product_model");
const catchAsync = require("../utils/catch_async");
const AppError = require("../utils/app_error");
const stockMoment = require("../controllers/stock_movement_controllers");
const notiController = require("../controllers/notification_controllers");
const audit_controllers = require("../controllers/audit_controllers");
const QueryOptions = require("../utils/query_options");

exports.adjustStock = catchAsync(async (req, res, next) => {
  const { productId, type, quantity, reason, note } = req.body;

  const product = await Product.findById(productId);

  if (!product) {
    return next(new AppError("Product not found", 404));
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
        return next(new AppError("Insufficient stock", 400));
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
      return next(new AppError("Invalid stock movement type", 400));
  }

  // Update product stock
  product.currentStock = adjustedQuantity;
  await product.save();
  await notiController.checkAndNotify(product);

  const adjustment = await StockAdjustment.create({
    product: product._id,
    type,
    quantity: Math.abs(variance),
    adjustedQuantity,
    variance,
    reason,
    createdBy: req.user._id,
    note,
  });

  const movementType =
    variance > 0
      ? "adjustment_in"
      : variance < 0
        ? "adjustment_out"
        : "adjustment";

  await stockMoment.make_stock_movement({
    product: product._id,
    type: movementType,
    quantity: quantity,
    quantityBefore: before,
    quantityAfter: adjustedQuantity,
    referenceId: adjustment._id,
    referenceType: "StockAdjustment",
    createdBy: req.user._id,
    note: `Manual stock adjustment (${type})`,
  });
  const auditActionMap = {
    stock_in: "stock_in",
    stock_out: "stock_out",
    adjustment: "stock_adjustment",
  };
  await audit_controllers.make_audit({
    user: req.user._id,
    action: auditActionMap[type],
    resource: "Product",
    resourceId: product._id,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
    note: "Stock updated via manual adjustment.",
  });
  res.status(201).json({
    status: "success",
    message: "Stock updated successfully.",
    data: {
      adjustment,
    },
  });
});
exports.getAllAdjustments = catchAsync(async (req, res, next) => {
  const features = new QueryOptions(StockAdjustment.find(), req.query)
    .filter()
    .sort()
    .limiting()
    .paginate();
  const adjustments = await features.query;
  res.status(200).json({
    status: "success",
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
