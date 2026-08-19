const express = require("express");
const app = express();
const cors = require("cors");
const error_controller = require("./controllers/error_controller");
require("dotenv").config();
const AppError = require("./utils/app_error");
const userRouter = require("./routes/user_routes");
const permissionRouter = require("./routes/permission_routes");
const roleRouter = require("./routes/role_routes");
const categoryRouter = require("./routes/category_routes");
const unitRouter = require("./routes/unit_routes");
const productRouter = require("./routes/product_routes");
const supplierRouter = require("./routes/supplier_routes");
const purchaseRouter = require("./routes/purchase_routes");
const stockAdjustmentRouter = require("./routes/stock_adjustment_routes");
const stockMovementRouter = require("./routes/stock_movement_routes");
const notiRouter = require("./routes/notifications_routes");
const auditRouter = require("./routes/audit_routes");
const rateLimit = require("express-rate-limit");
const GracefulRedisStore = require("./utils/rate_limit_store");
const helmet = require("helmet");
const ems = require("express-mongo-sanitize");
const sanitizeHtml = require("sanitize-html");
const path = require("path");
const cookieParser = require("cookie-parser");
const hpp = require("hpp");
const morgan = require("morgan");
const crypto = require("crypto");

//            Global MiddleWares
// Use a fixed hop count (not `true`) so X-Forwarded-For cannot be spoofed to
// bypass rate limiting. Set TRUST_PROXY to the number of trusted proxies (0 if none).
app.set(
  "trust proxy",
  Number(process.env.TRUST_PROXY) || (process.env.NODE_ENV === "production" ? 1 : 0),
);

// Assign a request ID to every request (used for log correlation and sent back
// as X-Request-Id so clients can report a specific request to support).
app.use((req, res, next) => {
  req.id = req.get("X-Request-Id") || crypto.randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
});
//////CORS
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",")
  : ["http://localhost:3001"];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);


//Set security HTTP headers
app.use(
  helmet({
    crossOriginOpenerPolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "https://cdnjs.cloudflare.com",
          "https://cdn.jsdelivr.net",
          "https://unpkg.com",
          "https://js.paystack.co",
          "https://cdn.tailwindcss.com",
          "https://api.mapbox.com",
          "https://maps.googleapis.com",
          "https://*.hereapi.com",
          "https://accounts.google.com",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdnjs.cloudflare.com",
          "https://cdn.jsdelivr.net",
          "https://maxcdn.bootstrapcdn.com",
          "https://fonts.googleapis.com",
          "https://unpkg.com",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
          "https://cdn.jsdelivr.net",
          "https://maxcdn.bootstrapcdn.com",
        ],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https:",
          "https://*.tile.openstreetmap.org",
          "https://*.googleusercontent.com",
        ],
        connectSrc: [
          "'self'",
          "https://*.openstreetmap.org",
          "https://*.googleapis.com",
          "https://*.hereapi.com",
          "https://api.mapbox.com",
          "https://events.mapbox.com",
          "https://cdnjs.cloudflare.com",
          "https://accounts.google.com",
        ],
        frameSrc: [
          "'self'",
          "https://js.paystack.co",
          "https://accounts.google.com",
        ],
      },
    },
  })
);
// Logging (structured with request-ID for correlation; every environment logs)
morgan.token("req-id", (req) => req.id || "-");
if (process.env.NODE_ENV === "development") {
  app.use(morgan(":method :url :status :response-time ms [:req-id]"));
} else {
  app.use(
    morgan(
      '{"time":":date[iso]","requestId":":req-id","method":":method","url":":url","status":":status","durationMs":":response-time ms"}',
    ),
  );
}

// Limitter (Redis-backed; falls back to in-memory if Redis is unavailable)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300, // Limit each IP to 300 requests per `window` (here, per 15 minutes).
  standardHeaders: "draft-8", // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  store: new GracefulRedisStore(),
  handler: (req, res, next) => {
    // Custom response when the limit is exceeded
    return next(
      new AppError("Too many requests. Please try again in 15 minutes.", 429),
    );
  },
});

app.use(express.static(path.join(__dirname, "public")));

app.use(limiter);
//Body Parser (req.body)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

//data sanitization against NoSQL query injection
/* The below code is to fix an issue with req.query being non-writable in some environments. */
app.use((req, _res, next) => {
  Object.defineProperty(req, "query", {
    ...Object.getOwnPropertyDescriptor(req, "query"),
    value: req.query,
    writable: true,
  });

  next();
});
app.use(ems());

//Prevent parameter pollution
app.use(
  hpp({
    whitelist: [
      "page",
      "limit",
      "sort",
      "fields",
      "search",
      "status",
      "category",
      "unit",
      "supplier",
      "dateFrom",
      "dateTo",
    ],
  }),
);

//Data sanitization against XSS
const sanitizeValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value)) {
      out[key] = sanitizeValue(value[key]);
    }
    return out;
  }
  if (typeof value === "string") {
    return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });
  }
  return value;
};
app.use((req, res, next) => {
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  next();
});
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

//Routes
app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Inventory API is running",
  });
});
app.use("/api/v1/auth", userRouter);
app.use("/api/v1/permissions", permissionRouter);
app.use("/api/v1/roles", roleRouter);
app.use("/api/v1/categories", categoryRouter);
app.use("/api/v1/units", unitRouter);
app.use("/api/v1/products", productRouter);
app.use("/api/v1/suppliers", supplierRouter);
app.use("/api/v1/purchases", purchaseRouter);
app.use("/api/v1/adjustments", stockAdjustmentRouter);
app.use("/api/v1/movements", stockMovementRouter);
app.use("/api/v1/notifications", notiRouter);
app.use("/api/v1/audits", auditRouter);

//Catch undefinded path
app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server.`, 404));
});

app.use(error_controller);
module.exports = app;
