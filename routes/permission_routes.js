const express = require("express");
const router = express.Router();
const permission_controller = require("../controllers/permission_controllers");
const userController = require("../controllers/user_controllers");
const authorize = require("../middleware/authorize");
const { cache } = require("../utils/cache_middleware");

router.use(
  userController.protect,
  authorize("permissions", "manage"),
);
router.post("/add-permission", permission_controller.createPermission);
router.get("/", cache(300), permission_controller.getAllPermissions);
router.get("/:id", cache(300), permission_controller.getPermission);
router.put("/:id", permission_controller.updatePermission);
router.delete("/:id", permission_controller.deletePermission);

module.exports = router;
