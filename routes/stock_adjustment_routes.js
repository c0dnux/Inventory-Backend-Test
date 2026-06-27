const express = require("express");
const router = express.Router();
const adjustmentController = require("../controllers/stock_adjustment_controllers");
const userController = require("../controllers/user_controllers");

router.use(userController.protect);
router.post("/adjust", adjustmentController.adjustStock);
router.post("/", adjustmentController.getAllAdjustments);
router.post("/my-adjustments", adjustmentController.myAdjustments);
router.get("/:id", adjustmentController.getAdjustment);

module.exports = router;
