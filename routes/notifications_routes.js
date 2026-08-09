const express = require("express");
const router = express.Router();
const notiControllers = require("../controllers/notification_controllers");
const userControllers = require("../controllers/user_controllers");
const { cache } = require("../utils/cache_middleware");

router.use(userControllers.protect);
router.get("/", cache(30), notiControllers.getAllNotifications);
router.post("/read", notiControllers.markAsRead);
router.post("/all-read", notiControllers.markAllAsRead);
router.post("/my-noti", notiControllers.myNotifications);
router.get("/:id", cache(30), notiControllers.getNotification);

module.exports = router;
