const catchAsync = require("./../utils/catch_async");
const User = require("./../models/user_model");
const jwt = require("jsonwebtoken");
const { promisify } = require("util");
const crypto = require("crypto");
const { signTokenHandler } = require("./../utils/custom_funcs");
const Email = require("./../utils/email_brevo");
const AppError = require("./../utils/app_error");
const audit_controllers = require("./audit_controllers");

exports.signup = catchAsync(async (req, res, next) => {
  console.log(req.body);
  const allowed = ["name", "email", "password", "confirmPassword", "role"];
  let gotten = {};
  allowed.forEach((elem) => {
    if (req.body[elem]) gotten[elem] = req.body[elem];
  });
  const existingUser = await User.findOne({ email: gotten.email }).select(
    "+active",
  );
  ///------- IF SIGNUP REQUEST IS FROM AN EXISTING BUT INACTIVE USER ----///
  if (existingUser) {
    if (existingUser.active) {
      return next(new AppError("Account already exist.", 409)); // 409 Conflict
    }

    const confirmToken = existingUser.confirmTokenGen();
    existingUser.name = gotten.name;
    existingUser.password = gotten.password;
    existingUser.confirmPassword = gotten.confirmPassword;
    existingUser.role = gotten.role;
    await existingUser.save();
    await new Email(existingUser, confirmToken).sendWelcome();

    res.status(201).json({
      status: "Success",
      message:
        "Account created. Please check your email to activate your account.",
    });
  }

  const newUser = new User(gotten);
  const confirmToken = newUser.confirmTokenGen();
  await newUser.save();
  const audit = await audit_controllers.make_audit({
    user: newUser._id,
    action: "create",
    resource: "User",
    resourceId: newUser._id,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
    note: "User account created",
  });
  console.log(confirmToken);

  await new Email(newUser, confirmToken).sendWelcome();

  res.status(201).json({
    status: "Success",
    message:
      "Account created. Please check your email to activate your account.",
  });
});
exports.activateAccount = catchAsync(async (req, res, next) => {
  const token = req.body.token;
  const hashToken = crypto
    .createHash("sha256")
    .update(String(token))
    .digest("hex");
  console.log(hashToken);

  const user = await User.findOne({
    confirmToken: hashToken,
    confirmTokenExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(new AppError("Token is invalid or expired", 400));
  }
  user.confirmToken = undefined;
  user.confirmTokenExpires = undefined;
  user.active = true;

  await user.save({ validateBeforeSave: false });

  const audit = await audit_controllers.make_audit({
    user: user._id,
    action: "update",
    resource: "User",
    resourceId: user._id,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
    note: "User account activated",
  });

  signTokenHandler(200, "Account activated", res, user);
});
exports.signin = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError("Provide email and password", 400));
  }

  const user = await User.findOne({ email }).select("+password +active");
  if (!user) {
    return next(new AppError("Incorrect email or password.", 404));
  }

  if (!user.active) {
    return next(new AppError("This acount not activated.", 401));
  }
  const isCorrect = await user.isCorrectPassword(password, user.password);

  if (!user || !isCorrect) {
    return next(new AppError("Incorrect username or password", 401));
  }
  const audit = await audit_controllers.make_audit({
    user: user._id,
    action: "login",
    resource: "User",
    resourceId: user._id,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
    note: "User account logged in",
  });
  signTokenHandler(200, "Logged in", res, user);
});

exports.protect = catchAsync(async (req, res, next) => {
  let token;
  //Check if token exist
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(new AppError("Please Login to get Access", 503));
  }
  ///Check if token is valid
  const jwtPomisified = promisify(jwt.verify);
  const decoded = await jwtPomisified(token, process.env.JWT_SECRET);
  ///Check if user exists
  const userExist = await User.findById(decoded.id).populate({
    path: "role",
    populate: { path: "permissions" },
  });
  if (!userExist) {
    return next(
      new AppError("The user belonging to this token no longer exists", 401),
    );
  }

  //Check if user has changed password after Token was issued
  const passWordChanged = userExist.passwordChangedAfter(decoded.iat);

  if (passWordChanged) {
    return next(
      new AppError("User recently changed password, Login again", 401),
    );
  }
  //Give access
  req.user = userExist;
  res.locals.user = userExist;
  next();
});
//Only for rendered pages
//Dont put catchAsync here
exports.isLoggedIn = async (req, res, next) => {
  //Check if token exist
  if (req.cookies.jwt) {
    try {
      token = req.cookies.jwt;

      ///Check if token is valid
      const jwtPomisified = promisify(jwt.verify);
      const decoded = await jwtPomisified(
        req.cookies.jwt,
        process.env.JWT_SECRET,
      );
      ///Check if user exists
      const userExist = await User.findById(decoded.id);
      if (!userExist) {
        return next();
      }
      //Check if user has changed password after Token was issued
      const passWordChanged = userExist.passwordChangedAfter(decoded.iat);

      if (passWordChanged) {
        return next();
      }
      //Give access
      res.locals.user = userExist;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};
// middleware/authorize.js
exports.authorize = (resource, action) => async (req, res, next) => {
  const user = req.user;

  // 3. Check if any permission matches resource + action
  const hasPermission = user.role.permissions.some(
    (p) => p.resource === resource && p.action === action,
  );

  if (!hasPermission) {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
};

//Dont put catchAsync here
exports.logout = async (req, res) => {
  const audit = await audit_controllers.make_audit({
    user: req.user._id,
    action: "logout",
    resource: "User",
    resourceId: req.user._id,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
    note: "User logged out",
  });
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({ status: "success" });
};
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You are not allowed to perform this action", 403),
      );
    }
    next();
  };
};

exports.forgetPassword = catchAsync(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new AppError("No user with the given email", 404));
  }
  const resetToken = user.confirmTokenGen();
  console.log(resetToken);

  await user.save({ validateBeforeSave: false });
  // const resetURL = `${req.protocol}://${req.get(
  //   "host",
  // )}/reset-password/${resetToken}`;
  try {
    // await new Email(user, resetURL).sendPasswordReset();
    res.status(200).json({ status: "Success", message: "Token sent to email" });
  } catch (error) {
    user.confirmToken = undefined;
    user.confirmTokenExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new AppError("There was an error resetting password", 500));
  }
});
exports.resetPassword = catchAsync(async (req, res, next) => {
  const resetToken = req.body.token || req.params.token;
  if (req.body.password !== req.body.confirmPassword) {
    return next(new AppError("Passwords do not match", 400));
  }
  const hashToken = crypto
    .createHash("sha256")
    .update(String(resetToken))
    .digest("hex");

  const user = await User.findOne({
    confirmToken: hashToken,
    confirmTokenExpires: { $gt: Date.now() },
  });
  if (!user) {
    return next(new AppError("Reset token is invalid or expired", 400));
  }
  user.password = req.body.password;
  user.confirmToken = undefined;
  user.confirmTokenExpires = undefined;
  await user.save({ validateBeforeSave: false });
  const audit = await audit_controllers.make_audit({
    user: user._id,
    action: "update",
    resource: "User",
    resourceId: user._id,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
    note: "User account updated password",
  });

  signTokenHandler(200, "Reset Successful", res, user);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("+password");
  if (
    !(await user.isCorrectPassword(req.body.currentPassword, user.password))
  ) {
    return next(new AppError("Your current password is wrong", 401));
  }
  user.password = req.body.newPassword;
  user.confirmPassword = req.body.confirmNewPassword;
  await user.save();
  const audit = await audit_controllers.make_audit({
    user: user._id,
    action: "update",
    resource: "User",
    resourceId: user._id,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
    note: "User updated password",
  });

  signTokenHandler(200, "Password updated", res, user);
});

exports.createUser = catchAsync(async (req, res, next) => {
  const { newUser } = req.body;
  newUser.password = "00000000";
  newUser.confirmPassword = "00000000";
  newUser.active = true;
  const user = new User(newUser);
  await user.save();
  user.password = undefined;
  user.passwordChangedAt = undefined;
  await audit_controllers.make_audit({
    user: user._id,
    action: "update",
    resource: "User",
    resourceId: user._id,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
    note: "User updated password",
  });
  res
    .status(201)
    .json({ status: "success", data: { user }, message: "User Created" });
});
exports.profile = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    return next(new AppError("User not found.", 400));
  }
  res.status(201).json({
    status: "success",
    data: user,
  });
});
