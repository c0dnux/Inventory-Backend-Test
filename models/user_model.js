const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false, // never returned in queries by default
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.pre(/^find/, function (next) {
  this.where({ deletedAt: null });
  next();
});

userSchema.methods.softDelete = function () {
  this.deletedAt = new Date();
  return this.save();
};

module.exports = mongoose.model("User", userSchema);
const mongoose = require("mongoose");
const { Schema } = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const userSchema = new Schema({
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
  active: {
    type: Boolean,
    default: false,
    select: false,
  },
});
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  // Hash password
  this.password = await bcrypt.hash(this.password, 12);
  // Remove confirmPassword field
  this.confirmPassword = undefined;

  // Set passwordChangedAt field
  this.passwordChangedAt = Date.now() - 1000;

  next();
});

userSchema.methods.isCorrectPassword = async function (
  userPassword,
  hashedPassword,
) {
  return await bcrypt.compare(userPassword, hashedPassword);
};
// userSchema.pre(/^find/, function (next) {
//   this.find({ active: { $ne: false } });

//   next();
// });
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
  const token = crypto.randomBytes(32).toString("hex");
  this.confirmToken = crypto
    .createHash("sha256")
    .update(String(token))
    .digest("hex");
  this.confirmTokenExpires = Date.now() + 5 * 60 * 1000; // Token expires in 5 minutes

  return token;
};
const User = mongoose.model("User", userSchema);

module.exports = User;
