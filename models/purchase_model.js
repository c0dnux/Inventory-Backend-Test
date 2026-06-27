"use strict";

const mongoose = require("mongoose");

const purchaseItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitCost: {
      type: Number,
      required: true,
      min: 0,
    },
    totalCost: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true },
);

const purchaseSchema = new mongoose.Schema(
  {
    referenceNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },
    items: {
      type: [purchaseItemSchema],
      validate: {
        validator: (v) => v.length > 0,
        message: "A purchase must have at least one item.",
      },
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["pending", "received", "cancelled"],
      default: "pending",
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
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
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    cancelReason: {
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

purchaseSchema.index({ supplier: 1 });
purchaseSchema.index({ status: 1 });
purchaseSchema.index({ purchaseDate: -1 });

purchaseSchema.pre(/^find/, function () {
  this.where({ deletedAt: null });
});

purchaseSchema.methods.softDelete = function () {
  this.deletedAt = new Date();
  return this.save();
};
purchaseSchema.pre("validate", function () {
  let grandTotal = 0;
  this.items.forEach((item) => {
    item.totalCost = item.quantity * item.unitCost;
    grandTotal += item.totalCost;
  });
  this.totalAmount = grandTotal;
});
module.exports = mongoose.model("Purchase", purchaseSchema);
