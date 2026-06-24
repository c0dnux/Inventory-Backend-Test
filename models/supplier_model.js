"use strict";

const mongoose = require("mongoose");
const validator = require("validator");
const supplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    contactPerson: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      validate: {
        validator: validator.isEmail,
        message: "Please enter a valid email",
      },
    },
    phone: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          return /^\+?[1-9]\d{1,14}$/.test(v);
        },
        message: "Please enter a valid phone number",
      },
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      country: { type: String, trim: true },
      zipCode: { type: String, trim: true },
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

supplierSchema.pre(/^find/, function () {
  this.where({ deletedAt: null });
});

supplierSchema.methods.softDelete = function () {
  this.deletedAt = new Date();
  return this.save();
};

module.exports = mongoose.model("Supplier", supplierSchema);
