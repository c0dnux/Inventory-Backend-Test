const catch_async = require("./../utils/catch_async");
const Permission = require("./../models/permission_model");

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
// [
//   {
//     name: 'products:create',
//     resource: 'products',
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
