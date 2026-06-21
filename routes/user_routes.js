const express = require("express");
const router = express.Router();
const user_controller = require("../controllers/user_Controller");



router.post("/create_user", user_controller.createUser);

module.exports = router;