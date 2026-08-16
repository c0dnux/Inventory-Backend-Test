const dotenv = require("dotenv");
const path = require("path");

// Load env BEFORE requiring the app so every module sees the values at
// require-time (e.g. JWT cookie TTLs are read when custom_funcs.js loads).
dotenv.config({ path: path.join(__dirname, "config.env") });

const mongoose = require("mongoose");
const app = require("./app");
const funcs = require("./utils/custom_funcs");
const Purchase = require("./models/purchase_model");

process.on("uncaughtException", (err) => {
  console.log("UNCAUGHT EXCEPTION! 💥 Shutting down...");
  console.log(err.name, err.message);
  process.exit(1);
});

const DB_LOCAL = process.env.DB_LOCAL;
const DB_ONLINE = process.env.DB_ONLINE_COMPASS.replace(
  "<db_password>",
  process.env.DB_PASSWORD,
);
let DB;
if (process.env.NODE_ENV === "development") {
  DB = DB_LOCAL;
} else {
  DB = DB_ONLINE;
}

// Fail fast (with retries) instead of silently running without a database.
// A missing DB is exactly why signups silently fail and every request 401s.
const connectWithRetry = async (retries = 3, delayMs = 5000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(DB, { serverSelectionTimeoutMS: 10000 });
      console.log("DB connection successful!");
      return;
    } catch (err) {
      console.error(
        `❌ MongoDB connection error (attempt ${attempt}/${retries}):`,
        err.message,
      );
      if (attempt < retries) {
        console.log(`Retrying in ${delayMs / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  console.error(
    "❌ Could not connect to MongoDB. Check that:\n" +
      "   - MongoDB is running locally (mongod) for DB_LOCAL, or\n" +
      "   - your current IP is added to the Atlas whitelist for DB_ONLINE_COMPASS, and\n" +
      "   - the connection string / password are correct.",
  );
  process.exit(1);
};

const port = process.env.PORT || 3000;
let server;

const startServer = async () => {
  await connectWithRetry();
  await funcs.seedPurchaseRefCounter(Purchase);
  server = app.listen(port, () => {
    console.log(`Server running on port ${port}...`);
  });
};

process.on("unhandledRejection", (err) => {
  console.log("UNHANDLED REJECTION! 💥 Shutting down...");
  console.log(err.name, err.message);
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

const shutdown = (signal) => {
  console.log(`👋 ${signal} RECEIVED. Shutting down gracefully`);
  // Force-exit if open connections prevent graceful close (prevents zombie
  // processes that hold the port).
  const forceTimer = setTimeout(() => process.exit(1), 10000);
  forceTimer.unref();

  server.close(() => {
    console.log("💥 Process terminated!");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("SIGINT", () => shutdown("SIGINT"));

startServer();
