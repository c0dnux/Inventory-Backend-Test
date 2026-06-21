"use strict";

const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "create",
        "update",
        "delete",
        "login",
        "logout",
        "purchase_create",
        "purchase_cancel",
        "stock_in",
        "stock_out",
        "stock_adjustment",
      ],
    },
    resource: {
      type: String,
      required: true,
      // e.g. 'Product', 'Purchase', 'User', 'Category'
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    // Snapshot of changes: { before: {}, after: {} }
    changes: {
      before: { type: mongoose.Schema.Types.Mixed, default: null },
      after: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    note: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    // Audit logs are immutable — never soft-deleted
  },
);

auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
