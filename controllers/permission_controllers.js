const catch_async = require("./../utils/catch_async");
const Permission = require("./../models/permission_model");
const AppError = require("./../utils/app_error");

exports.createPermission = catch_async(async (req, res, next) => {
  const { name, resource, action, description } = req.body;

  const newPermission = await Permission.create({
    name,
    resource,
    action,
    description,
  });
  res.status(201).json({
    status: "success",
    data: {
      permission: newPermission,
    },
    message: "Permission created successfully",
  });
});

exports.getAllPermissions = catch_async(async (req, res, next) => {
  const permissions = await Permission.find();
  res.status(200).json({
    status: "success",
    data: { permissions, length: permissions.length },
  });
});

exports.getPermission = catch_async(async (req, res, next) => {
  const permission = await Permission.findById(req.params.id);
  if (!permission) {
    return next(new AppError("Permission not found", 404));
  }
  res.status(200).json({ status: "success", data: { permission } });
});

exports.updatePermission = catch_async(async (req, res, next) => {
  const permission = await Permission.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true },
  );
  if (!permission) {
    return next(new AppError("Permission not found", 404));
  }
  res.status(200).json({ status: "success", data: { permission } });
});
exports.deletePermission = catch_async(async (req, res, next) => {
  const permission = await Permission.findById(req.params.id);
  if (!permission) {
    return next(new AppError("Permission not found", 404));
  }
  await permission.softDelete();
  res
    .status(200)
    .json({ status: "success", message: "Permission deleted successfully" });
});
//     action: 'create',
//     description: 'Allows users to add new products to the inventory catalog.'
//   },
//   {
//     name: 'products:read',
//     resource: 'products',
//     action: 'read',
//     description: 'Allows users to view product information, pricing, and availability.'
//   },
//   {
//     name: 'products:update',
//     resource: 'products',
//     action: 'update',
//     description: 'Allows users to modify existing product details such as name, price, and description.'
//   },
//   {
//     name: 'products:delete',
//     resource: 'products',
//     action: 'delete',
//     description: 'Allows users to permanently remove products from the inventory system.'
//   },
//   {
//     name: 'purchases:create',
//     resource: 'purchases',
//     action: 'create',
//     description: 'Allows users to record and process new purchase transactions.'
//   },
//   {
//     name: 'purchases:delete',
//     resource: 'purchases',
//     action: 'delete',
//     description: 'Allows users to cancel or remove purchase records when necessary.'
//   },
//   {
//     name: 'users:manage',
//     resource: 'users',
//     action: 'manage',
//     description: 'Allows users to create, update, deactivate, and manage user accounts and roles.'
//   },
//   {
//     name: 'reports:read',
//     resource: 'reports',
//     action: 'read',
//     description: 'Allows users to view and generate sales, inventory, and performance reports.'
//   },
//   {
//     name: 'stock:manage',
//     resource: 'stock',
//     action: 'manage',
//     description: 'Allows users to monitor stock levels, adjust quantities, and manage inventory movements.'
//   }
// ]
