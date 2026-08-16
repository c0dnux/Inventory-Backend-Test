const express = require("express");
const router = express.Router();
const purchaseControllers = require("../controllers/purchase_controllers");
const userController = require("../controllers/user_controllers");
const authorize = require("../middleware/authorize");
const { cache } = require("../utils/cache_middleware");

router.use(userController.protect);
router.post(
  "/make",
  authorize("purchases", "create"),
  purchaseControllers.makePurchaseOrder,
);
router.get("/", cache(60), purchaseControllers.getAllPurchases);
router.get("/:id", cache(60), purchaseControllers.getPurchaseById);
router.post("/my-purchases", purchaseControllers.myPurchases);
router.post(
  "/receive",
  authorize("purchases", "create"),
  purchaseControllers.receivePurchaseOrder,
);
router.post(
  "/cancel",
  authorize("purchases", "cancel"),
  purchaseControllers.cancelPurchase,
);

module.exports = router;
