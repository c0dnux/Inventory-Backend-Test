"use strict";

const mongoose = require("mongoose");

const stockAdjustmentSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["stock_in", "stock_out", "adjustment"],
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    // For 'adjustment' type — actual counted quantity
    adjustedQuantity: {
      type: Number,
      default: null,
    },
    // Variance = adjustedQuantity - currentStock (can be negative)
    variance: {
      type: Number,
      default: null,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    note: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

stockAdjustmentSchema.index({ product: 1, createdAt: -1 });
stockAdjustmentSchema.index({ type: 1 });

stockAdjustmentSchema.pre(/^find/, function () {
  this.where({ deletedAt: null });
});

stockAdjustmentSchema.methods.softDelete = function () {
  this.deletedAt = new Date();
  return this.save();
};

module.exports = mongoose.model("StockAdjustment", stockAdjustmentSchema);
