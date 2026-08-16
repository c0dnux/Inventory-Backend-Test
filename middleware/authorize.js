"use strict";

const AppError = require("./../utils/app_error");

/**
 * Authorization middleware factory.
 * Usage: `authorize("products", "create")` returns a middleware that checks
 * `req.user.role.permissions` for a `{resource, action}` match.
 */
const authorize = (resource, action) => (req, res, next) => {
  const user = req.user;

  if (!user) {
    return next(new AppError("Please login to get access", 401));
  }

  const permissions = user.role && user.role.permissions ? user.role.permissions : [];

  const hasPermission = permissions.some(
    (p) => p.resource === resource && p.action === action,
  );

  if (!hasPermission) {
    return next(
      new AppError(
        "You do not have permission to perform this action",
        403,
      ),
    );
  }
  next();
};

module.exports = authorize;
