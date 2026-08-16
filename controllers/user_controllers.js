const catchAsync = require("./../utils/catch_async");
const User = require("./../models/user_model");
const Role = require("./../models/role_model");
const jwt = require("jsonwebtoken");
const { promisify } = require("util");
const crypto = require("crypto");
const {
  signTokenHandler,
  hashToken,
  verifyRefreshToken,
  clearAuthCookies,
} = require("./../utils/custom_funcs");
const Email = require("./../utils/email_brevo");
const AppError = require("./../utils/app_error");
const audit_controllers = require("./audit_controllers");
const { OAuth2Client } = require("google-auth-library");

exports.signup = catchAsync(async (req, res, next) => {
  const allowed = ["name", "email", "password", "confirmPassword"];
  let gotten = {};
  allowed.forEach((elem) => {
    if (req.body[elem]) gotten[elem] = req.body[elem];
  });

  if (!gotten.email || !gotten.password) {
    return next(
      new AppError("Provide name, email, password and confirmPassword", 400),
    );
  }

  // Always assign the lowest-privilege role. Users must never self-assign a
  // role from the request body (previously allowed arbitrary Admin escalation).
  const staffRole = await Role.findOne({ name: "Staff" });
  if (staffRole) {
    gotten.role = staffRole._id;
  } else {
    const createdRole = await Role.create({
      name: "Staff",
      description: "Read-only access to product information.",
      permissions: [],
    });
    gotten.role = createdRole._id;
  }

  const existingUser = await User.findOne({ email: gotten.email }).select(
    "+active +authProviders",
  );

  if (existingUser) {
    if (existingUser.active) {
      // Do not reveal whether the account is local, Google-linked, or anything
      // else — just a generic conflict.
      return next(new AppError("Account already exist.", 409)); // 409 Conflict
    }

    // Inactive account re-signup: only re-issue the activation token.
    // Never overwrite the password/role of the pending account.
    const confirmToken = existingUser.confirmTokenGen();
    await existingUser.save({ validateBeforeSave: false });
    await new Email(existingUser, confirmToken).sendWelcome();

    return res.status(201).json({
      status: "success",
      message:
        "Account created. Please check your email to activate your account.",
    });
  }

  const newUser = new User(gotten);
  newUser.addProvider("local");
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

  await new Email(newUser, confirmToken).sendWelcome();

  res.status(201).json({
    status: "success",
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

  await signTokenHandler(200, "Account activated", res, user);
});
exports.signin = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError("Provide email and password", 400));
  }

  const user = await User.findOne({ email }).select(
    "+password +active +authProviders",
  );
  if (!user) {
    return next(new AppError("Incorrect email or password.", 401));
  }

  // A Google-linked account without a local password can't sign in with
  // email+password — don't report a generic "wrong password", point the user
  // at the correct login method instead. Once a password has been set (e.g.
  // via reset-password), let them sign in normally.
  if (user.hasProvider("google") && !user.password) {
    return next(
      new AppError(
        "This account was created with Google. Please log in with Google, or reset/set a password first.",
        401,
      ),
    );
  }

  if (!user.active) {
    return next(new AppError("This account not activated.", 401));
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
  await signTokenHandler(200, "Logged in", res, user);
});

exports.googleSignin = catchAsync(async (req, res, next) => {
  const idToken = req.body.credential || req.body.idToken;
  if (!idToken) {
    return next(new AppError("Provide a Google credential token", 400));
  }
  if (!process.env.GOOGLE_CLIENT_ID) {
    return next(
      new AppError("Google login is not configured on the server.", 500),
    );
  }

  // Verify the ID token server-side (signature + audience). Never trust the
  // frontend's claims.
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (err) {
    return next(new AppError("Invalid Google credential token", 401));
  }

  // Only verified emails may be used to find/create/link an account.
  if (!payload || !payload.email_verified) {
    return next(
      new AppError("Your Google email is not verified. Please verify it first.", 401),
    );
  }

  const { email, sub: googleId, name, picture } = payload;

  let user = await User.findOne({ email }).select("+active +authProviders");

  if (!user) {
    // New account — Google has already verified the email, so auto-activate.
    const staffRole = await Role.findOne({ name: "Staff" });
    if (!staffRole) {
      return next(
        new AppError(
          "Roles are not seeded yet. Run `npm run seed` before allowing signups.",
          500,
        ),
      );
    }
    user = await User.create({
      name: name || email.split("@")[0],
      email,
      avatar: picture || null,
      role: staffRole._id,
      active: true,
      authProviders: [{ provider: "google", providerId: googleId }],
    });
  } else {
    // Existing account: link Google only if it isn't already claimed by a
    // different Google identity.
    const existingGoogle = (user.authProviders || []).find(
      (p) => p.provider === "google",
    );
    if (existingGoogle && existingGoogle.providerId !== googleId) {
      return next(
        new AppError(
          "This email is linked to a different Google account.",
          401,
        ),
      );
    }
    if (!existingGoogle) {
      user.addProvider("google", googleId);
    }
    if (!user.active) user.active = true;
    await user.save({ validateBeforeSave: false });
  }

  const audit = await audit_controllers.make_audit({
    user: user._id,
    action: "login",
    resource: "User",
    resourceId: user._id,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
    note: "User account logged in with Google",
  });

  await signTokenHandler(200, "Logged in with Google", res, user);
});

exports.refreshAccessToken = catchAsync(async (req, res, next) => {
  let refreshToken = req.cookies.jwt_refresh;
  if (!refreshToken && req.body && req.body.refreshToken) {
    refreshToken = req.body.refreshToken;
  }
  if (!refreshToken) {
    return next(
      new AppError("No refresh token provided. Please log in again.", 401),
    );
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    return next(
      new AppError(
        "Your refresh token is invalid or expired. Please log in again.",
        401,
      ),
    );
  }

  const tokenHash = hashToken(refreshToken);
  const user = await User.findById(decoded.id)
    .select("+active +refreshTokens")
    .populate({
      path: "role",
      populate: { path: "permissions" },
    });

  if (!user || !user.active) {
    return next(
      new AppError("The user belonging to this refresh token no longer exists.", 401),
    );
  }
  if (user.passwordChangedAfter(decoded.iat)) {
    return next(
      new AppError("Password changed recently. Please log in again.", 401),
    );
  }
  if (!user.hasRefreshToken(tokenHash)) {
    return next(
      new AppError("Refresh token has been revoked. Please log in again.", 401),
    );
  }

  // Token rotation: revoke the used token, then issue a fresh pair
  await user.removeRefreshToken(tokenHash);
  await signTokenHandler(200, "Session refreshed", res, user);
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
    return next(new AppError("Please Login to get Access", 401));
  }
  ///Check if token is valid
  const jwtPromisified = promisify(jwt.verify);
  const decoded = await jwtPromisified(token, process.env.JWT_SECRET);
  ///Check if user exists
  const userExist = await User.findById(decoded.id)
    .select("+active")
    .populate({
      path: "role",
      populate: { path: "permissions" },
    });
  if (!userExist) {
    return next(
      new AppError("The user belonging to this token no longer exists", 401),
    );
  }
  if (!userExist.active) {
    return next(new AppError("This account is deactivated. Contact support.", 401));
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

//Dont put catchAsync here
exports.logout = catchAsync(async (req, res) => {
  const refreshToken =
    req.cookies.jwt_refresh || (req.body && req.body.refreshToken);

  if (refreshToken) {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      const tokenHash = hashToken(refreshToken);
      const user = await User.findById(decoded.id).select("+refreshTokens");
      if (user && user.hasRefreshToken(tokenHash)) {
        await user.removeRefreshToken(tokenHash);
        await audit_controllers.make_audit({
          user: user._id,
          action: "logout",
          resource: "User",
          resourceId: user._id,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
          note: "User logged out",
        });
      }
    } catch (err) {
      // Refresh token already invalid — nothing to revoke
    }
  }

  clearAuthCookies(res);
  res.status(200).json({ status: "success", message: "Logged out" });
});

exports.forgetPassword = catchAsync(async (req, res, next) => {
  if (!req.body.email) {
    return next(new AppError("Provide an email address", 400));
  }
  const user = await User.findOne({ email: req.body.email });

  // Do not reveal whether an account exists (anti-enumeration).
  if (!user) {
    return res.status(200).json({
      status: "success",
      message: "Token sent to email",
    });
  }
  const resetToken = user.confirmTokenGen();

  await user.save({ validateBeforeSave: false });
  try {
    await new Email(user, resetToken).sendPasswordReset();
    res.status(200).json({ status: "success", message: "Token sent to email" });
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
  }).select("+refreshTokens");
  if (!user) {
    return next(new AppError("Reset token is invalid or expired", 400));
  }
  user.password = req.body.password;
  user.confirmToken = undefined;
  user.confirmTokenExpires = undefined;
  user.refreshTokens = [];
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

  await signTokenHandler(200, "Reset Successful", res, user);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select(
    "+password +refreshTokens",
  );
  if (
    !(await user.isCorrectPassword(req.body.currentPassword, user.password))
  ) {
    return next(new AppError("Your current password is wrong", 401));
  }
  user.password = req.body.newPassword;
  user.confirmPassword = req.body.confirmNewPassword;
  user.refreshTokens = [];
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

  await signTokenHandler(200, "Password updated", res, user);
});

exports.profile = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id)
    .select("+active")
    .populate({
      path: "role",
      populate: { path: "permissions" },
    });
  if (!user) {
    return next(new AppError("User not found.", 400));
  }
  res.status(200).json({
    status: "success",
    data: user,
  });
});
