const express = require("express");
const router = express.Router();
const productController = require("../controllers/product_controllers");
const userController = require("../controllers/user_controllers");

router.post("/create", userController.protect, productController.createProduct);
router.post("/", userController.protect, productController.getAllProducts);
router.get("/:id", userController.protect, productController.getProductById);
router.put("/:id", userController.protect, productController.updateProduct);
router.delete("/:id", userController.protect, productController.deleteProduct);
module.exports = router;
