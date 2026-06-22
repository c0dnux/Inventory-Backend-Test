const express = require("express");
const router = express.Router();
const role_controller = require("../controllers/role_controllers");

router.post("/create", role_controller.createRole);
router.post("/", role_controller.getAllRoles);
router.get("/:id", role_controller.getRoleById);
router.put("/:id", role_controller.updateRole);
router.delete("/:id", role_controller.deleteRole);

module.exports = router;
