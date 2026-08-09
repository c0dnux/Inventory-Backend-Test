const express = require("express");
const router = express.Router();
const supplierController = require("../controllers/supplier_controllers");
const userController = require("../controllers/user_controllers");
const { cache } = require("../utils/cache_middleware");

router.use(userController.protect);
router.post(
  "/create",
  userController.authorize("suppliers", "manage"),
  supplierController.createSupplier,
);
router.get(
  "/",
  userController.authorize("suppliers", "manage"),
  cache(120),
  supplierController.getAllSuppliers,
);
router.get(
  "/:id",
  userController.authorize("suppliers", "manage"),
  cache(120),
  supplierController.getSupplierById,
);
router.put(
  "/:id",
  userController.authorize("suppliers", "manage"),
  supplierController.updateSupplier,
);
router.delete(
  "/:id",
  userController.authorize("suppliers", "manage"),
  supplierController.deleteSupplier,
);

module.exports = router;
