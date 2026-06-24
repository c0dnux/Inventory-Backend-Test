const express = require("express");
const router = express.Router();
const supplierController = require("../controllers/supplier_controllers");
const userController = require("../controllers/user_controllers");

router.use(userController.protect);
router.post("/create", supplierController.createSupplier);
router.post("/", supplierController.getAllSuppliers);
router.get("/:id", supplierController.getSupplierById);
router.put("/:id", supplierController.updateSupplier);
router.delete("/:id", supplierController.deleteSupplier);

module.exports = router;
