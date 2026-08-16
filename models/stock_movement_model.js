"use strict";

const mongoose = require("mongoose");

/**
 * StockMovement tracks every change to a product's stock level.
 * Created automatically on:
 *   - Purchase received  → type: 'purchase_in'
 *   - Stock adjustment   → type: 'adjustment_in' | 'adjustment_out'
 *   - Manual stock-in    → type: 'stock_in'
 *   - Manual stock-out   → type: 'stock_out'
 *
 * Note: cancelling a purchase only applies to PENDING orders (received orders
 * cannot be cancelled), so a cancelled purchase never affects stock and no
 * movement is recorded for it.
 */

const stockMovementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "purchase_in",
        "stock_in",
        "stock_out",
        "adjustment_in",
        "adjustment_out",
        "adjustment",
      ],
    },
    quantity: {
      type: Number,
      required: true,
      // Positive = stock added, Negative = stock removed
    },
    quantityBefore: {
      type: Number,
      required: true,
    },
    quantityAfter: {
      type: Number,
      required: true,
    },
    // Polymorphic reference: purchase _id, adjustment _id, etc.
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    referenceType: {
      type: String,
      enum: ["Purchase", "StockAdjustment", null],
      default: null,
    },
    note: {
      type: String,
      trim: true,
    },
    // Unit cost at the time of the movement. Set on purchase_in receipts so
    // the ledger keeps the historical cost even when the product's live
    // `costPrice` is later updated by a subsequent (higher/lower) receipt.
    unitCost: {
      type: Number,
      default: null,
      min: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

stockMovementSchema.index({ product: 1, createdAt: -1 });
stockMovementSchema.index({ type: 1 });
stockMovementSchema.index({ referenceId: 1, referenceType: 1 });

module.exports = mongoose.model("StockMovement", stockMovementSchema);
