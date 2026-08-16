const Unit = require("../models/unit_model");
const catchAsync = require("../utils/catch_async");
const AppError = require("../utils/app_error");
const QueryOptions = require("../utils/query_options");
const { cacheBust } = require("../utils/cache_middleware");

exports.createUnit = catchAsync(async (req, res) => {
  const { name, abbreviation, description } = req.body;
  const unit = await Unit.create({
    name,
    abbreviation,
    description,
  });
  cacheBust(req);
  res.status(201).json({
    status: "success",
    data: {
      unit,
    },
  });
});
exports.getAllUnits = catchAsync(async (req, res) => {
  const features = new QueryOptions(Unit.find(), req.query)
    .filter()
    .sort()
    .limiting()
    .paginate();
  const units = await features.query;
  res.status(200).json({
    status: "success",
    data: {
      units,
    },
  });
});
exports.getUnitById = catchAsync(async (req, res, next) => {
  const unit = await Unit.findById(req.params.id);
  if (!unit) {
    return next(new AppError("Unit not found", 404));
  }
  res.status(200).json({
    status: "success",
    data: {
      unit,
    },
  });
});

exports.updateUnit = catchAsync(async (req, res, next) => {
  const allowed = ["name", "abbreviation", "description", "isActive"];
  const updates = {};
  allowed.forEach((k) => {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  });

  const unit = await Unit.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  if (!unit) {
    return next(new AppError("Unit not found", 404));
  }
  cacheBust(req);
  res.status(200).json({
    status: "success",
    data: {
      unit,
    },
  });
});
exports.deleteUnit = catchAsync(async (req, res, next) => {
  const unit = await Unit.findById(req.params.id);
  if (!unit) {
    return next(new AppError("Unit not found", 404));
  }
  await unit.softDelete();
  cacheBust(req);
  res.status(204).end();
});
