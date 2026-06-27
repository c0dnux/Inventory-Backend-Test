const express = require("express");
const router = express.Router();
const notiControllers = require("../controllers/notification_controllers");
const userControllers = require("../controllers/user_controllers");

router.use(userControllers.protect);
router.post("/", notiControllers.getAllNotifications);
router.get("/:id", notiControllers.markAsRead);
router.post("/all-read", notiControllers.markAllAsRead);
router.post("/my-notifications", notiControllers.myNotifications);
router.get("/:id", notiControllers.getNotification);

module.exports = router;
