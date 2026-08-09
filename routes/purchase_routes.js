const express = require("express");
const router = express.Router();
const purchaseControlers = require("../controllers/purchase_controllers");
const userController = require("../controllers/user_controllers");
const { cache } = require("../utils/cache_middleware");

router.use(userController.protect);
router.post(
  "/make",
  userController.authorize("purchases", "create"),
  purchaseControlers.makePurchaseOrder,
);
router.get("/", cache(60), purchaseControlers.getAllPurchases);
router.get("/:id", cache(60), purchaseControlers.getPurchaseById);
router.post("/my-purchases", purchaseControlers.myPurchases);
router.post(
  "/receive",
  userController.authorize("purchases", "create"),
  purchaseControlers.receivePurchaseOrder,
);
router.post(
  "/cancel",
  userController.authorize("purchases", "cancel"),
  purchaseControlers.cancelPurchase,
);

module.exports = router;
