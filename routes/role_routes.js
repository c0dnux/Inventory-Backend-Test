const express = require("express");
const router = express.Router();
const role_controller = require("../controllers/role_controllers");
const userController = require("../controllers/user_controllers");
const authorize = require("../middleware/authorize");
const { cache } = require("../utils/cache_middleware");

router.use(
  userController.protect,
  authorize("roles", "manage"),
);
router.post("/create", role_controller.createRole);
router.get("/", cache(300), role_controller.getAllRoles);
router.get("/:id", cache(300), role_controller.getRoleById);
router.put("/:id", role_controller.updateRole);
router.delete("/:id", role_controller.deleteRole);

module.exports = router;
