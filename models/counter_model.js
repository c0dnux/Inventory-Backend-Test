"use strict";

const mongoose = require("mongoose");

/**
 * Counter holds atomic sequence numbers keyed by name. Used to generate
 * collision-free references (e.g. purchase order numbers) under concurrency —
 * `findOneAndUpdate({ $inc })` on a single document is atomic, unlike a
 * count-based "next number" which can hand out duplicates.
 */
const counterSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    seq: {
      type: Number,
      default: 0,
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Counter", counterSchema);
