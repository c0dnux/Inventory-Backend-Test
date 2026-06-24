const Product = require("../models/product_model");
const catchAsync = require("../utils/catch_async");
const AppError = require("../utils/app_error");
const audit_controller = require("./audit_controllers");

exports.createProduct = catchAsync(async (req, res, next) => {
  const product = await Product.create(req.body);
  await audit_controller.make_audit({
    user: req.user._id,
    action: "create",
    resource: "Product",
    resourceId: product._id,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
    note: "Product created",
  });
  res.status(201).json({
    status: "success",
    data: {
      product,
    },
  });
});
exports.getAllProducts = catchAsync(async (req, res, next) => {
  const products = await Product.find();
  res.status(200).json({
    status: "success",
    results: products.length,
    data: {
      products,
    },
  });
});
exports.getProductById = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return next(new AppError("Product not found", 404));
  }
  res.status(200).json({
    status: "success",
    data: {
      product,
    },
  });
});

exports.updateProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  const beforeState = product.toObject();

  product.set(req.body);

  await product.save();

  const afterState = product.toObject();

  await audit_controller.make_audit({
    user: req.user._id,
    action: "update",
    resource: "Product",
    resourceId: product._id,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
    note: "Product updated",
    changes: {
      before: beforeState,
      after: afterState,
    },
  });

  res.status(200).json({
    status: "success",
    data: {
      product,
    },
  });
});

exports.deleteProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return next(new AppError("Product not found", 404));
  }
  await audit_controller.make_audit({
    user: req.user._id,
    action: "delete",
    resource: "Product",
    resourceId: product._id,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
    note: "Product deleted",
  });
  await product.softDelete();
  res.status(204).json({
    status: "success",
    data: null,
  });
});
