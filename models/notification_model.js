"use strict";

const mongoose = require("mongoose");
const User = require("../models/user_model");

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "low_stock",
        "out_of_stock",
        "purchase_received",
        "purchase_cancelled",
        "system",
      ],
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    // Optional: link back to the resource that triggered the notification
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    referenceType: {
      type: String,
      enum: ["Product", "Purchase", null],
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);
notificationSchema.pre("insertMany", async function (docs) {
  console.log("Send Email");
  const userIds = [...new Set(docs.map((doc) => doc.user))];
  const users = await User.find({ _id: { $in: userIds } });
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));
  for (const doc of docs) {
    const user = userMap.get(doc.user?.toString());
    if (user) {
      // sendEmail(user.email, doc.message);
      console.log("Send Email");
    }
  }
});
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
