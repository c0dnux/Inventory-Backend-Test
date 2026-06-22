const express = require("express");
const router = express.Router();
const permission_controller = require("../controllers/permission_controllers");

router.post("/add-permission", permission_controller.createPermission);
router.post("/", permission_controller.getAllPermissions);
router.get("/:id", permission_controller.getPermission);
router.put("/:id", permission_controller.updatePermission);
router.delete("/:id", permission_controller.deletePermission);

module.exports = router;
