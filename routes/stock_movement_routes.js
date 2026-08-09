const express = require("express");
const router = express.Router();
const stockMovementControler = require("../controllers/stock_movement_controllers");
const userControllers = require("../controllers/user_controllers.js");
const { cache } = require("../utils/cache_middleware");

router.use(userControllers.protect);
router.get("/", cache(60), stockMovementControler.getAllMovements);
router.post("/my_movements", stockMovementControler.myMovements);
router.get("/:id", cache(60), stockMovementControler.getMovement);

module.exports = router;
