const express = require("express");
const router = express.Router();
const productController = require("../controllers/product_controllers");
const userController = require("../controllers/user_controllers");
const authorize = require("../middleware/authorize");
const { cache } = require("../utils/cache_middleware");

router.use(userController.protect);
router.post(
  "/create",
  authorize("products", "create"),
  productController.createProduct,
);
router.get(
  "/",
  authorize("products", "read"),
  cache(60),
  productController.getAllProducts,
);
router.get(
  "/dashboard",
  authorize("products", "read"),
  cache(60),
  productController.getInventoryDashboard,
);
router.get(
  "/:id",
  authorize("products", "read"),
  cache(60),
  productController.getProductById,
);
router.put(
  "/:id",
  authorize("products", "update"),
  productController.updateProduct,
);
router.delete(
  "/:id",
  authorize("products", "delete"),
  productController.deleteProduct,
);
module.exports = router;
