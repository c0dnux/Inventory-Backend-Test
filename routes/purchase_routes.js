const express = require("express");
const router = express.Router();
const purchaseControlers = require("../controllers/purchase_controllers");
const userController = require("../controllers/user_controllers");

router.use(userController.protect);
router.post("/make", purchaseControlers.makePurchaseOrder);
router.post("/", purchaseControlers.getAllPurchases);
router.get("/:id", purchaseControlers.getPurchaseById);
router.post("/my-purchases", purchaseControlers.myPurchases);
router.post("/receive", purchaseControlers.receivePurchaseOrder);
router.post("/cancel", purchaseControlers.cancelPurchase);

module.exports = router;
