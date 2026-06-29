const StockMovement = require("../models/stock_movement_model");
const AppError = require("../utils/app_error");
const catchAsync = require("../utils/catch_async");
const QueryOptions = require("../utils/query_options");

exports.make_stock_movement = async (params) => {
  const {
    product,
    type,
    quantity,
    quantityBefore,
    quantityAfter,
    createdBy,
    referenceId = null,
    referenceType = null,
    note,
  } = params;

  // 1. Validation Safeguard
  if (!product || !type || quantity === undefined || !createdBy) {
    throw new AppError(
      "Missing required fields: product, type, quantity, and createdBy are mandatory.",
      400,
    );
  }
  const stockMovement = await StockMovement.create({
    product,
    type,
    quantity,
    quantityBefore,
    quantityAfter,
    referenceId,
    referenceType,
    note,
    createdBy,
  });
  return stockMovement;
};
exports.getAllMovements = catchAsync(async (req, res, next) => {
  const features = new QueryOptions(StockMovement.find(), req.query)
    .filter()
    .sort()
    .limiting()
    .paginate();
  const movements = await features.query;
  res.status(200).json({
    status: "success",
    data: { movements, length: movements.length },
  });
});

exports.getMovement = catchAsync(async (req, res, next) => {
  const movement = await StockMovement.findById(req.params.id);
  if (!movement) {
    return next(new AppError("Movement not found", 404));
  }
  res.status(200).json({ status: "success", data: { movement } });
});

exports.myMovements = catchAsync(async (req, res, next) => {
  const movement = await StockMovement.find({ createdBy: req.user._id });

  res.status(200).json({ status: "success", data: { movement } });
});
