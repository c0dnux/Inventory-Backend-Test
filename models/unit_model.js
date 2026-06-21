'use strict';

const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      // e.g. 'Pieces', 'Kilograms', 'Litres', 'Cartons'
    },
    abbreviation: {
      type: String,
      required: true,
      trim: true,
      // e.g. 'pcs', 'kg', 'L', 'ctn'
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
  { timestamps: true }
);

unitSchema.pre(/^find/, function (next) {
  this.where({ deletedAt: null });
  next();
});

unitSchema.methods.softDelete = function () {
  this.deletedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Unit', unitSchema);