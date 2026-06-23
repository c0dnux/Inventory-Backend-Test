"use strict";

const AuditLog = require("../models/audit_log_model");
const AppError = require("../utils/app_error");

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
