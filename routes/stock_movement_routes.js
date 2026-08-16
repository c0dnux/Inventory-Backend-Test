const express = require("express");
const router = express.Router();
const stockMovementController = require("../controllers/stock_movement_controllers");
const userControllers = require("../controllers/user_controllers.js");
const { cache } = require("../utils/cache_middleware");

router.use(userControllers.protect);
router.get("/", cache(60), stockMovementController.getAllMovements);
router.post("/my_movements", stockMovementController.myMovements);
router.get("/:id", cache(60), stockMovementController.getMovement);

module.exports = router;
