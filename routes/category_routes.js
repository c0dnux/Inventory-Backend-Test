const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/category_controllers");
const userController = require("../controllers/user_controllers");
const { cache } = require("../utils/cache_middleware");

router.use(userController.protect);
router.post("/create", categoryController.createCategory);
router.get("/", cache(300), categoryController.getAllCategories);
router.get("/:id", cache(300), categoryController.getCategoryById);
router.put("/:id", categoryController.updateCategory);
router.delete("/:id", categoryController.deleteCategory);
module.exports = router;
