
const mongoose = require("mongoose");
const { Schema } = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const userSchema = new Schema(
  {
    name: { type: String, required: [true, "Name is required"] },
    email: {
      type: String,
      unique: true,
      required: [true, "Please Provide email"],
      lowercase: true,
      validate: [validator.isEmail, "Please provide a valid email"],
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    password: {
      type: String,
      required: [true, "Provide a password"],
      minLength: [8, "Password must be more than 8 characters"],
      select: false,
    },
    confirmPassword: {
      type: String,
      required: [true, "Confirm your password"],
      validate: {
        validator: function (el) {
          return el === this.password;
        },
        message: "Passwords do not match",
      },
    },
    passwordChangedAt: Date,
    confirmToken: String,
    confirmTokenExpires: String,
    refreshTokens: {
      type: [
        {
          tokenHash: { type: String },
          expiresAt: { type: Date },
        },
      ],
      select: false,
      default: [],
    },
    active: {
      type: Boolean,
      default: false,
      select: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  // Hash password
  this.password = await bcrypt.hash(this.password, 12);
  // Remove confirmPassword field
  this.confirmPassword = undefined;

  // Set passwordChangedAt field
  this.passwordChangedAt = Date.now() - 1000;
});

userSchema.methods.isCorrectPassword = async function (
  userPassword,
  hashedPassword,
) {
  return await bcrypt.compare(userPassword, hashedPassword);
};

userSchema.methods.passwordChangedAfter = function (userTimeStamp) {
  if (this.passwordChangedAt) {
    const changedTimeStamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10,
    );

    return changedTimeStamp > userTimeStamp;
  }
  return false;
};
userSchema.methods.confirmTokenGen = function () {
  const token = crypto.randomInt(100000, 1000000).toString();

  this.confirmToken = crypto
    .createHash("sha256")
    .update(String(token))
    .digest("hex");
  this.confirmTokenExpires = Date.now() + 10 * 60 * 1000; // Token expires in 10 minutes

  return token;
};

userSchema.methods.hasRefreshToken = function (tokenHash) {
  return (this.refreshTokens || []).some((t) => t.tokenHash === tokenHash);
};

userSchema.methods.addRefreshToken = function (tokenHash, ttlMs) {
  this.refreshTokens = (this.refreshTokens || []).filter(
    (t) => new Date(t.expiresAt) > new Date(),
  );
  this.refreshTokens.push({ tokenHash, expiresAt: new Date(Date.now() + ttlMs) });

  if (this.refreshTokens.length > 5) this.refreshTokens.shift();
  return this.save({ validateBeforeSave: false });
};

userSchema.methods.removeRefreshToken = function (tokenHash) {
  this.refreshTokens = (this.refreshTokens || []).filter(
    (t) => t.tokenHash !== tokenHash,
  );
  return this.save({ validateBeforeSave: false });
};

userSchema.methods.revokeAllRefreshTokens = function () {
  this.refreshTokens = [];
  return this.save({ validateBeforeSave: false });
};

////Soft delete
userSchema.pre(/^find/, function () {
  this.where({ deletedAt: null });
});

userSchema.methods.softDelete = function () {
  this.deletedAt = new Date();
  return this.save();
};
const User = mongoose.model("User", userSchema);

module.exports = User;
