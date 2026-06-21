const express = require("express");
const router = express.Router();
const user_controller = require("../controllers/user_controllers");

router.post("/signup", user_controller.signup);

module.exports = router;
