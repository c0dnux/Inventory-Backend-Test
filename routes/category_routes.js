const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/category_controllers");

router.post("/create", categoryController.createCategory);
router.post("/", categoryController.getAllCategories);
router.get("/:id", categoryController.getCategoryById);
router.put("/:id", categoryController.updateCategory);
router.delete("/:id", categoryController.deleteCategory);
module.exports = router;
