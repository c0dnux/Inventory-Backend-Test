const Product = require("../models/product_model");
const catchAsync = require("../utils/catch_async");
const AppError = require("../utils/app_error");
const audit_controller = require("../controllers/audit_controllers");
const QueryOptions = require("../utils/query_options");
const { clearCache } = require("../utils/cache_middleware");

// Fields clients may set. currentStock must go through purchase/adjustment
// flows so the StockMovement ledger and notifications stay consistent;
// sku/barcode/deletedAt are system-managed.
const PRODUCT_EDITABLE_FIELDS = [
  "productName",
  "description",
  "category",
  "unit",
  "costPrice",
  "sellingPrice",
  "reorderLevel",
  "status",
];

const pickEditable = (body) => {
  const picked = {};
  for (const field of PRODUCT_EDITABLE_FIELDS) {
    if (body[field] !== undefined) picked[field] = body[field];
  }
  return picked;
};

exports.createProduct = catchAsync(async (req, res, next) => {
  const product = await Product.create(pickEditable(req.body));
  await audit_controller.make_audit({
    user: req.user._id,
    action: "create",
    resource: "Product",
    resourceId: product._id,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
    note: "Product created",
  });
  clearCache("products");
  res.status(201).json({
    status: "success",
    data: {
      product,
    },
  });
});
exports.getAllProducts = catchAsync(async (req, res, next) => {
  const features = new QueryOptions(Product.find(), req.query)
    .filter()
    .sort()
    .limiting()
    .paginate();
  const products = await features.query;
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

  product.set(pickEditable(req.body));

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

  clearCache("products");

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
  clearCache("products");
  res.status(204).end();
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
