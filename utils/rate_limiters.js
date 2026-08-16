const { rateLimit } = require("express-rate-limit");
const GracefulRedisStore = require("./rate_limit_store");
const AppError = require("./app_error");

const isDev = process.env.NODE_ENV !== "production";

const createLimiter = ({ windowMs, limit, message }) =>
  rateLimit({
    windowMs,
    // Development relaxation: strict brute-force limits only in production.
    // Local testing + the SPA's refresh-on-boot quickly exhausts 10/15min.
    limit: isDev ? Math.max(limit, 500) : limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    store: new GracefulRedisStore(),
    handler: (req, res, next) =>
      next(
        new AppError(message || "Too many requests. Please try again later.", 429),
      ),
  });

// Stricter limits for credential-based / account endpoints (brute force).
exports.authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: "Too many auth attempts. Try again in 15 minutes.",
});

// Refresh is called frequently by SPAs, so allow more headroom while still
// blocking abuse.
exports.refreshLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  message: "Too many refresh attempts. Try again in 15 minutes.",
});
