"use strict";

const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    resource: {
      type: String,
      required: true,
      trim: true,
      // e.g. 'products', 'purchases', 'users'
    },
    action: {
      type: String,
      required: true,
      enum: ["create", "read", "update", "delete", "manage"],
    },
    description: {
      type: String,
      trim: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

permissionSchema.pre(/^find/, function () {
  this.where({ deletedAt: null });
});

permissionSchema.methods.softDelete = function () {
  this.deletedAt = new Date();
  return this.save();
};

module.exports = mongoose.model("Permission", permissionSchema);
