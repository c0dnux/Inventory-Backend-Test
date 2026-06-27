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
const helmet = require("helmet");
const ems = require("express-mongo-sanitize");
const sanitizeHtml = require("sanitize-html");
const path = require("path");
const cookieParser = require("cookie-parser");
const hpp = require("hpp");
const morgan = require("morgan");
const { swaggerUi, swaggerSpec } = require("./utils/swagger");

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
//            Global MiddleWares
process.env.NODE_ENV === "production"
  ? app.set("trust proxy", true)
  : app.set("trust proxy", false);
//////CORS
app.use(
  cors({
    origin: "http://localhost:3000", // or your frontend domain
    credentials: true,
  }),
);
//Swagger
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

//Set security HTTP headers
app.use(helmet());

app.use(
  helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],

      // ✅ Allow inline & CDN scripts (Leaflet, Tailwind, Paystack, etc.)
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'", // Some libraries (like Leaflet clustering) need this
        "https://cdnjs.cloudflare.com",
        "https://cdn.jsdelivr.net",
        "https://unpkg.com",
        "https://js.paystack.co",
        "https://cdn.tailwindcss.com",
        "https://api.mapbox.com", // If you later use Mapbox
        "https://maps.googleapis.com", // For Google Maps JS API
        "https://*.hereapi.com", // For HERE maps/geocoding
      ],

      // ✅ Allow inline styles & Google Fonts
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://cdnjs.cloudflare.com",
        "https://cdn.jsdelivr.net",
        "https://maxcdn.bootstrapcdn.com",
        "https://fonts.googleapis.com",
        "https://unpkg.com", // For Leaflet CSS
      ],

      // ✅ Allow loading fonts from Google Fonts & CDNs
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com",
        "https://cdn.jsdelivr.net",
        "https://maxcdn.bootstrapcdn.com",
      ],

      // ✅ Allow images from CDN, inline, blob, and HTTPS (useful for map tiles)
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https:",
        "https://*.tile.openstreetmap.org",
        "https://*.googleusercontent.com",
      ],

      // ✅ Allow Leaflet map tile connections, HERE API, etc.
      connectSrc: [
        "'self'",
        "https://*.openstreetmap.org",
        "https://*.googleapis.com",
        "https://*.hereapi.com",
        "https://api.mapbox.com",
        "https://events.mapbox.com",
        "https://cdnjs.cloudflare.com", // <-- FIX: Add this line
      ],

      // ✅ Allow frames if you’re embedding Paystack or map widgets
      frameSrc: ["'self'", "https://js.paystack.co"],
    },
  }),
);

// Development Log

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Limitter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 60 minutes
  limit: 100, // Limit each IP to 30 requests per `window` (here, per 60 minutes).
  standardHeaders: "draft-8", // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  // store: ... , // Redis, Memcached, etc. See below.
  handler: (req, res, next) => {
    // Custom response when the limit is exceeded
    return next(
      new AppError("Trial limit exceeded. Wait after 60 minutes.", 429),
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
      "duration",
      "ratingsQuantity",
      "ratingsAverage",
      "maxGroupSize",
      "difficulty",
      "price",
    ],
  }),
);

//Data sanitization against XSS
app.use((req, res, next) => {
  if (req.body) {
    req.body = JSON.parse(
      JSON.stringify(req.body, (key, value) =>
        typeof value === "string"
          ? sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })
          : value,
      ),
    );
  }
  next();
});
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

//Routes

app.use("/api/v1/users", userRouter);
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
