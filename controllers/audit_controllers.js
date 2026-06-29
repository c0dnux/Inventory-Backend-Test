"use strict";

const AuditLog = require("../models/audit_log_model");
const AppError = require("../utils/app_error");
const catchAsync = require("../utils/catch_async");
const QueryOptions = require("../utils/query_options");

exports.make_audit = async (params) => {
  const {
    user,
    action,
    resource,
    resourceId = null,
    changes = { before: null, after: null },
    ipAddress,
    userAgent,
    note,
  } = params;

  if (!user || !action || !resource) {
    throw new AppError(
      "Missing required audit fields: user, action, and resource are mandatory.",
      400,
    );
  }

  // FIXED: Clean Mongoose creation syntax
  const savedLog = await AuditLog.create({
    user,
    action,
    resource,
    resourceId,
    changes: {
      before: changes?.before || null,
      after: changes?.after || null,
    },
    ipAddress,
    userAgent,
    note,
  });

  return savedLog;
};

exports.getAllAudits = catchAsync(async (req, res, next) => {
  const features = new QueryOptions(AuditLog.find(), req.query)
    .filter()
    .sort()
    .limiting()
    .paginate();
  const audits = await features.query;
  res.status(200).json({
    status: "success",
    data: { audits, length: audits.length },
  });
});

exports.getAudit = catchAsync(async (req, res, next) => {
  const audit = await AuditLog.findById(req.params.id);
  if (!audit) {
    return next(new AppError("Movement not found", 404));
  }
  res.status(200).json({ status: "success", data: { audit } });
});

exports.myAudits = catchAsync(async (req, res, next) => {
  const audits = await AuditLog.find({ user: req.user._id });

  res.status(200).json({ status: "success", data: { audits } });
});
