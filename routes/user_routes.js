const express = require("express");
const router = express.Router();
const user_controller = require("../controllers/user_controllers");
const { authLimiter, refreshLimiter } = require("../utils/rate_limiters");

router.post("/signup", authLimiter, user_controller.signup);
router.post("/activate", authLimiter, user_controller.activateAccount);
router.post("/login", authLimiter, user_controller.signin);
router.post("/google", authLimiter, user_controller.googleSignin);
router.post("/refresh", refreshLimiter, user_controller.refreshAccessToken);
router.post("/forget-password", authLimiter, user_controller.forgetPassword);
router.post("/reset-password", authLimiter, user_controller.resetPassword);
router.post("/logout", user_controller.logout);
router.post("/profile", user_controller.protect, user_controller.profile);
module.exports = router;
