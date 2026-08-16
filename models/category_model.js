const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Soft delete scope
categorySchema.index(
  { name: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

categorySchema.pre(/^find/, function () {
  this.where({ deletedAt: null });
});

categorySchema.methods.softDelete = function () {
  this.deletedAt = new Date();
  return this.save();
};

module.exports = mongoose.model("Category", categorySchema);
