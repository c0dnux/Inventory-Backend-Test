const express = require("express");
const router = express.Router();
const stockMovementControler = require("../controllers/stock_movement_controllers");
const userControllers = require("../controllers/user_controllers.js");

router.use(userControllers.protect);
router.post("/", stockMovementControler.getAllMovements);
router.post("/my_movements", stockMovementControler.myMovements);
router.get("/:id", stockMovementControler.getMovement);

module.exports = router;
