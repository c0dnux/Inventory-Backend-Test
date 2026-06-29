const express = require("express");
const router = express.Router();
const user_controller = require("../controllers/user_controllers");

router.post("/signup", user_controller.signup);
router.post("/activate", user_controller.activateAccount);
router.post("/login", user_controller.signin);
router.post("/forget-password", user_controller.forgetPassword);
router.post("/reset-password", user_controller.resetPassword);
router.post("/logout", user_controller.logout);
router.post("/profile", user_controller.protect, user_controller.profile);
module.exports = router;
