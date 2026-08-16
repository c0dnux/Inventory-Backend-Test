"use strict";

const mongoose = require("mongoose");

/**
 * IdempotencyRecord claims a client-supplied idempotency key per user so a
 * retried/duplicated request (double-click, network retry) returns the already
 * created resource instead of creating a duplicate.
 *
 * Flow (in the controller): claim the key with an upsert-style insert — the
 * unique index on `{user, key}` ensures only one requester wins; the winner
 * creates the resource and back-fills `purchase`; concurrent losers get
 * E11000 and poll briefly for `purchase` to appear.
 */
const idempotencySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      maxlength: 128,
    },
    purchase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Purchase",
      default: null,
    },
  },
  { timestamps: true },
);

idempotencySchema.index({ user: 1, key: 1 }, { unique: true });

module.exports = mongoose.model("Idempotency", idempotencySchema);
