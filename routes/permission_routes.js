const express = require("express");
const router = express.Router();
const permission_controller = require("../controllers/permission_controllers");

router.post("/add-permission", permission_controller.createPermission);

module.exports = router;
