const Category = require("../models/category_model");
const catchAsync = require("../utils/catch_async");
const AppError = require("../utils/app_error");
const QueryOptions = require("../utils/query_options");
const { cacheBust } = require("../utils/cache_middleware");

exports.createCategory = catchAsync(async (req, res) => {
  const { name, description } = req.body;

  const category = await Category.create({
    name,
    description,
  });

  cacheBust(req);
  res.status(201).json({
    status: "success",
    data: {
      category,
    },
  });
});

exports.getAllCategories = catchAsync(async (req, res) => {
  const features = new QueryOptions(Category.find(), req.query)
    .filter()
    .sort()
    .limiting()
    .paginate();
  const categories = await features.query;
  res.status(200).json({
    status: "success",
    data: {
      categories,
    },
  });
});
exports.getCategoryById = catchAsync(async (req, res, next) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    return next(new AppError("Category not found", 404));
  }
  res.status(200).json({
    status: "success",
    data: {
      category,
    },
  });
});
exports.updateCategory = catchAsync(async (req, res, next) => {
  const allowed = ["name", "description", "isActive"];
  const updates = {};
  allowed.forEach((k) => {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  });

  const category = await Category.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  if (!category) {
    return next(new AppError("Category not found", 404));
  }
  cacheBust(req);
  res.status(200).json({
    status: "success",
    data: {
      category,
    },
  });
});
exports.deleteCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    return next(new AppError("Category not found", 404));
  }
  await category.softDelete();
  cacheBust(req);
  res.status(204).end();
});
