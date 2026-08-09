const express = require("express");
const router = express.Router();
const unitController = require("../controllers/unit_controllers");
const userController = require("../controllers/user_controllers");
const { cache } = require("../utils/cache_middleware");

router.use(userController.protect);
router.post("/create", unitController.createUnit);
router.get("/", cache(300), unitController.getAllUnits);
router.get("/:id", cache(300), unitController.getUnitById);
router.put("/:id", unitController.updateUnit);
router.delete("/:id", unitController.deleteUnit);

module.exports = router;
