const express = require("express");
const router = express.Router();
const adjustmentController = require("../controllers/stock_adjustment_controllers");
const userController = require("../controllers/user_controllers");
const { cache } = require("../utils/cache_middleware");

router.use(userController.protect);
router.post(
  "/adjust",
  userController.authorize("stock", "adjust"),
  adjustmentController.adjustStock,
);
router.get("/", cache(60), adjustmentController.getAllAdjustments);
router.post("/my-adjustments", adjustmentController.myAdjustments);
router.get("/:id", cache(60), adjustmentController.getAdjustment);

module.exports = router;
