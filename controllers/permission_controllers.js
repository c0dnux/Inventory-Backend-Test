const catch_async = require("../utils/catch_async");
const Permission = require("../models/permission_model");
const AppError = require("../utils/app_error");
const QueryOptions = require("../utils/query_options");


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
  const features = new QueryOptions(Permission.find(), req.query)
    .filter()
    .sort()
    .limiting()
    .paginate();
  const permissions = await features.query;
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
