const Notification = require("../models/notification_model");
const User = require("../models/user_model");
const Role = require("../models/role_model");
const catchAsync = require("../utils/catch_async");
const AppError = require("../utils/app_error");
const Email = require("../utils/email_brevo");
const QueryOptions = require("../utils/query_options");
const { clearCache } = require("../utils/cache_middleware");

const fetchManagers = async () => {
  const managerRoles = await Role.find({ name: { $in: ["Admin", "Manager"] } });
  return User.find({
    role: { $in: managerRoles.map((r) => r._id) },
    active: true,
  });
};

const buildNotifications = (managers, productOrPurchase) => {
  const notifications = [];

  if (productOrPurchase.isOutOfStock) {
    // Out of stock — more urgent
    for (const user of managers) {
      new Email(
        user,
        `${productOrPurchase.productName} ${productOrPurchase.sku} is out of stock.`,
      )
        .notifyStockStatus()
        .catch((err) => {
          console.error(`Failed to send email to ${user.email}:`, err);
        });
      notifications.push({
        user: user._id,
        type: "out_of_stock",
        title: "Out of stock",
        message: `${productOrPurchase.productName} (${productOrPurchase.sku}) is completely out of stock.`,
        referenceId: productOrPurchase._id,
        referenceType: "Product",
      });
    }
  } else if (productOrPurchase.isLowStock) {
    // Low stock
    for (const user of managers) {
      new Email(
        user,
        `${productOrPurchase.productName} ${productOrPurchase.sku} is low of stock.`,
      )
        .notifyStockStatus()
        .catch((err) => {
          console.error(`Failed to send email to ${user.email}:`, err);
        });
      notifications.push({
        user: user._id,
        type: "low_stock",
        title: "Low stock alert",
        message: `${productOrPurchase.productName} has ${productOrPurchase.currentStock} units remaining (reorder level: ${productOrPurchase.reorderLevel}).`,
        referenceId: productOrPurchase._id,
        referenceType: "Product",
      });
    }
  } else if (productOrPurchase.status === "received") {
    for (const user of managers) {
      new Email(user, `${productOrPurchase.referenceNo} has been received`)
        .purchaseUpdate()
        .catch((err) => {
          console.error(`Failed to send email to ${user.email}:`, err);
        });
      notifications.push({
        user: user._id,
        type: "purchase_received",
        title: "Purchase received.",
        message: `Purchase ${productOrPurchase.referenceNo} has been received.`,
        referenceId: productOrPurchase._id,
        referenceType: "Purchase",
      });
    }
  } else if (productOrPurchase.status === "cancelled") {
    for (const user of managers) {
      new Email(user, `${productOrPurchase.referenceNo} has been cancelled.`)
        .purchaseUpdate()
        .catch((err) => {
          console.error(`Failed to send email to ${user.email}:`, err);
        });
      notifications.push({
        user: user._id,
        type: "purchase_cancelled",
        title: "Purchase cancelled.",
        message: `${productOrPurchase.referenceNo} has been cancelled.`,
        referenceId: productOrPurchase._id,
        referenceType: "Purchase",
      });
    }
  }

  return notifications;
};

exports.checkAndNotify = async (productOrPurchase) => {
  const managers = await fetchManagers();
  if (!managers.length) return;

  const notifications = buildNotifications(managers, productOrPurchase);
  if (notifications.length) {
    await Notification.insertMany(notifications);
  }
};

// Notify for many products with a single manager lookup (used after a PO receive).
exports.checkProductsAndNotify = async (products) => {
  const managers = await fetchManagers();
  if (!managers.length) return;

  const notifications = [];
  for (const product of products) {
    notifications.push(...buildNotifications(managers, product));
  }
  if (notifications.length) {
    await Notification.insertMany(notifications);
  }
};

exports.markAsRead = catchAsync(async (req, res, next) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id }, // user check prevents reading others' notifications
    { isRead: true, readAt: new Date() },
    { new: true },
  );

  if (!notification) return next(new AppError("Not found", 404));
  clearCache("notifications");
  res.status(200).json({ status: "success", data: notification });
});

exports.markAllAsRead = catchAsync(async (req, res, next) => {
  await Notification.updateMany(
    { user: req.user._id, isRead: false },
    { isRead: true, readAt: new Date() },
  );

  clearCache("notifications");

  res
    .status(200)
    .json({ status: "success", message: "All notifications marked as read" });
});

exports.getAllNotifications = catchAsync(async (req, res, next) => {
  const features = new QueryOptions(
    Notification.find({ user: req.user._id }),
    req.query,
  )
    .filter()
    .sort()
    .limiting()
    .paginate();
  const notifications = await features.query;
  res.status(200).json({
    status: "success",
    data: { notifications, length: notifications.length },
  });
});

exports.getNotification = catchAsync(async (req, res, next) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    user: req.user._id,
  });
  if (!notification) {
    return next(new AppError("Notification not found", 404));
  }
  res.status(200).json({ status: "success", data: { notification } });
});

exports.myNotifications = catchAsync(async (req, res, next) => {
  const notifications = await Notification.find({ user: req.user._id });

  res.status(200).json({ status: "success", data: { notifications } });
});
