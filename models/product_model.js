
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    barcode: {
      type: String,
      trim: true,
      default: null,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
      required: true,
    },
    costPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    currentStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    reorderLevel: {
      type: Number,
      required: true,
      default: 10,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "discontinued"],
      default: "active",
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual: is stock low?
productSchema.virtual("isLowStock").get(function () {
  return this.currentStock > 0 && this.currentStock <= this.reorderLevel;
});

// Virtual: is out of stock?
productSchema.virtual("isOutOfStock").get(function () {
  return this.currentStock === 0;
});

// Virtual: total stock value at cost
productSchema.virtual("stockValue").get(function () {
  return this.currentStock * this.costPrice;
});

// Indexes for search & filtering
productSchema.index({ productName: "text", sku: "text", barcode: "text" });
productSchema.index({ category: 1 });
productSchema.index({ status: 1 });
productSchema.index({ currentStock: 1 });

productSchema.pre(/^find/, function (next) {
  this.where({ deletedAt: null });
  next();
});

productSchema.methods.softDelete = function () {
  this.deletedAt = new Date();
  return this.save();
};

module.exports = mongoose.model("Product", productSchema);
