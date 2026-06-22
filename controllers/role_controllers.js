const AppError = require("../utils/app_Error");
const catchAsync = require("../utils/catch_async");
const Role = require("../models/role_model");
const Permission = require("../models/permission_model");

exports.createRole = catchAsync(async (req, res, next) => {
  const { name, permissions, description } = req.body;

  const role = await Role.create({ name, permissions, description });

  res.status(201).json({
    status: "success",
    data: {
      role,
    },
  });
});
exports.getAllRoles = catchAsync(async (req, res, next) => {
  const roles = await Role.find().populate("permissions");

  res.status(200).json({
    status: "success",
    data: {
      roles,
    },
    length: roles.length,
  });
});
exports.getRoleById = catchAsync(async (req, res, next) => {
  const role = await Role.findById(req.params.id).populate("permissions");

  if (!role) {
    return next(new AppError("No role found with that ID", 404));
  }
  res.status(200).json({
    status: "success",
    data: {
      role,
    },
  });
});
exports.updateRole = catchAsync(async (req, res, next) => {
  const { name, permissions, description } = req.body;
  const role = await Role.findByIdAndUpdate(
    req.params.id,
    { name, permissions, description },
    { new: true },
  ).populate("permissions");

  if (!role) {
    return next(new AppError("No role found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      role,
    },
  });
});
exports.deleteRole = catchAsync(async (req, res, next) => {
  const role = await Role.findById(req.params.id);

  if (!role) {
    return next(new AppError("No role found with that ID", 404));
  }

  await role.softDelete();

  res.status(204).json({
    status: "success",
  });
});
