const express = require("express");
const router = express.Router();
const unitController = require("../controllers/unit_controllers");

router.post("/create", unitController.createUnit);
router.post("/", unitController.getAllUnits);
router.get("/:id", unitController.getUnitById);
router.put("/:id", unitController.updateUnit);
router.delete("/:id", unitController.deleteUnit);

module.exports = router;
