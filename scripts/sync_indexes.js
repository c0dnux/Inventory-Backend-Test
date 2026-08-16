/**
 * One-time migration: rebuild unique indexes as partial unique indexes.
 *
 * Before this migration, unique fields (user.email, product.sku,
 * purchase.referenceNo, category.name, unit.name, role.name,
 * permission.name) used schema-level `unique: true`, which creates a
 * non-partial unique index. Soft-deleted rows keep their value, so recreating
 * the record throws E11000. The models now declare partial unique indexes
 * (`partialFilterExpression: { deletedAt: null }`); this script drops the old
 * indexes and creates the new ones.
 *
 * Run: npm run migrate:indexes
 */
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "..", "config.env") });

const mongoose = require("mongoose");

require("../models/user_model");
require("../models/product_model");
require("../models/purchase_model");
require("../models/category_model");
require("../models/unit_model");
require("../models/role_model");
require("../models/permission_model");

const DB_LOCAL = process.env.DB_LOCAL;
const DB_ONLINE = process.env.DB_ONLINE_COMPASS.replace(
  "<db_password>",
  process.env.DB_PASSWORD,
);
const DB =
  process.env.NODE_ENV === "development" ? DB_LOCAL : DB_ONLINE;

const MODELS = [
  "User",
  "Product",
  "Purchase",
  "Category",
  "Unit",
  "Role",
  "Permission",
];

(async () => {
  try {
    await mongoose.connect(DB, { serverSelectionTimeoutMS: 10000 });
    console.log("Connected. Syncing indexes...");

    for (const name of MODELS) {
      const model = mongoose.model(name);
      await model.syncIndexes();
      console.log(`✓ ${name}: indexes synced (old non-partial unique dropped)`);
    }

    console.log("Done. Verify with: db.<collection>.getIndexes()");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
