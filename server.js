const mongoose = require("mongoose");
const dotenv = require("dotenv");
const app = require("./app");

process.on("uncaughtException", (err) => {
  console.log("UNCAUGHT EXCEPTION! 💥 Shutting down...");
  console.log(err.name, err.message);
  process.exit(1);
});

dotenv.config({ path: "./config.env" });

const DB_LOCAL = process.env.DB_LOCAL;
const DB_ONLINE = process.env.DB_ONLINE_COMPASS.replace(
  "<db_password>",
  process.env.DB_PASSWORD
);
let DB;
if (process.env.NODE_ENV === "development") {
  DB = DB_LOCAL;
} else {
  DB = DB_ONLINE;
}

mongoose
  .connect(DB)
  .then(() => console.log("DB connection successful!"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    // You can choose whether or not to process.exit(1) here
  });

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}...`);
});

process.on("unhandledRejection", (err) => {
  console.log("UNHANDLED REJECTION! 💥 Shutting down...");
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

process.on("SIGTERM", () => {
  console.log("👋 SIGTERM RECEIVED. Shutting down gracefully");
  server.close(() => {
    console.log("💥 Process terminated!");
  });
});
