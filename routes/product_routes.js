const express = require("express");
const router = express.Router();
const productController = require("../controllers/product_controllers");
const userController = require("../controllers/user_controllers");
const { cache } = require("../utils/cache_middleware");

router.use(userController.protect);
router.post(
  "/create",
  userController.authorize("products", "create"),
  productController.createProduct,
);
router.get(
  "/",
  userController.authorize("products", "read"),
  cache(60),
  productController.getAllProducts,
);
router.get(
  "/:id",
  userController.authorize("products", "read"),
  cache(60),
  productController.getProductById,
);
router.put(
  "/:id",
  userController.authorize("products", "update"),
  productController.updateProduct,
);
router.delete(
  "/:id",
  userController.authorize("products", "delete"),
  productController.deleteProduct,
);
module.exports = router;
