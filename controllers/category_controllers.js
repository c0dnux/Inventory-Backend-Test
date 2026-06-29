const Category = require("../models/category_model");
const catchAsync = require("../utils/catch_async");
const AppError = require("../utils/app_error");
const QueryOptions = require("../utils/query_options");

exports.createCategory = catchAsync(async (req, res) => {
  const { name, description } = req.body;

  const category = await Category.create({
    name,
    description,
  });

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
  const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
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
exports.deleteCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    return next(new AppError("Category not found", 404));
  }
  await category.softDelete();
  res.status(204).json({
    status: "success",
    data: null,
  });
});
