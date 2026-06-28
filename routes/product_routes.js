const express = require("express");
const router = express.Router();
const productController = require("../controllers/product_controllers");
const userController = require("../controllers/user_controllers");

router.use(userController.protect);
router.post("/create", productController.createProduct);
router.post("/", productController.getAllProducts);
router.get("/:id", productController.getProductById);
router.put("/:id", productController.updateProduct);
router.delete("/:id", productController.deleteProduct);
module.exports = router;
