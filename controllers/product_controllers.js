const Product = require("../models/product_model");
const catchAsync = require("../utils/catch_async");
const AppError = require("../utils/app_error");
const audit_controller = require("../controllers/audit_controllers");

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

exports.getInventoryDashboard = catchAsync(async (req, res, next) => {
  const [dashboard] = await Product.aggregate([
    {
      $group: {
        _id: null,

        // Number of products
        totalProducts: {
          $sum: 1,
        },

        // Total inventory value
        totalStockValue: {
          $sum: {
            $multiply: ["$currentStock", "$costPrice"],
          },
        },

        // Products below reorder level but still in stock
        lowStockItems: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gt: ["$currentStock", 0] },
                  { $lte: ["$currentStock", "$reorderLevel"] },
                ],
              },
              1,
              0,
            ],
          },
        },

        // Products with zero stock
        outOfStockItems: {
          $sum: {
            $cond: [{ $eq: ["$currentStock", 0] }, 1, 0],
          },
        },
      },
    },
  ]);

  res.status(200).json({
    status: "success",
    data: dashboard || {
      totalProducts: 0,
      totalStockValue: 0,
      lowStockItems: 0,
      outOfStockItems: 0,
    },
  });
});
