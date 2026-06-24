const Supplier = require("../models/supplier_model");
const catchAsync = require("../utils/catch_async");
const AppError = require("../utils/app_error");
const audit_log = require("../controllers/audit_controllers");
exports.createSupplier = catchAsync(async (req, res, next) => {
  const { name, contactPerson, email, phone, address } = req.body;
  const supplier = await Supplier.create({
    name,
    contactPerson,
    email,
    phone,
    address,
  });
  await audit_log.make_audit({
    user: req.user._id,
    action: "create",
    resource: "Supplier",
    resourceId: supplier._id,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
    note: "Supplier created",
  });
  res.status(201).json({
    status: "success",
    data: {
      supplier,
    },
  });
});

exports.getAllSuppliers = catchAsync(async (req, res, next) => {
  const suppliers = await Supplier.find();
  res.status(200).json({
    status: "success",
    data: {
      suppliers,
    },
  });
});

exports.getSupplierById = catchAsync(async (req, res, next) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) {
    return next(new AppError("Supplier not found", 404));
  }
  res.status(200).json({
    status: "success",
    data: {
      supplier,
    },
  });
});

exports.updateSupplier = catchAsync(async (req, res, next) => {
  const supplier = await Supplier.findById(req.params.id);

  if (!supplier) {
    return next(new AppError("Supplier not found", 404));
  }

  const beforeState = supplier.toObject();
  
  if (req.body.address && typeof req.body.address === "object") {
    for (const [key, value] of Object.entries(req.body.address)) {
      req.body[`address.${key}`] = value;
    }
    delete req.body.address;
  }

  supplier.set(req.body);

  await supplier.save();

  const afterState = supplier.toObject();

  await audit_log.make_audit({
    user: req.user._id,
    action: "update",
    resource: "Supplier",
    resourceId: supplier._id,
    changes: {
      before: beforeState,
      after: afterState,
    },
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
    note: `Supplier "${supplier.name}" updated`,
  });

  res.status(200).json({
    status: "success",
    data: {
      supplier,
    },
  });
});
exports.deleteSupplier = catchAsync(async (req, res, next) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) {
    return next(new AppError("Supplier not found", 404));
  }
  await supplier.softDelete();
  res.status(204).json({
    status: "success",
  });
});
