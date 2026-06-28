const Notification = require("../models/notification_model");
const User = require("../models/user_model");
const Role = require("../models/role_model");
const catchAsync = require("../utils/catch_async");
const AppError = require("../utils/app_error");
const Email = require("../utils/email_brevo");
exports.checkAndNotify = async (productOrPurchase) => {
  const managerRoles = await Role.find({ name: { $in: ["Admin", "Manager"] } });
  const managers = await User.find({
    role: { $in: managerRoles.map((r) => r._id) },
    active: true,
  });
  console.log(managers, managerRoles);

  if (productOrPurchase.isOutOfStock) {
    // Out of stock — more urgent
    const notifications = managers.map((user) => {
      new Email(
        user,
        `${productOrPurchase.productName} ${productOrPurchase.sku} is out of stock.`,
      )
        .notifyStockStatus()
        .catch((err) => {
          console.error(`Failed to send email to ${user.email}:`, err);
        });
      return {
        user: user._id,
        type: "out_of_stock",
        title: "Out of stock",
        message: `${proproductOrPurchaseduct.productName} (${productOrPurchase.sku}) is completely out of stock.`,
        referenceId: productOrPurchase._id,
        referenceType: "Product",
      };
    });
    await Notification.insertMany(notifications);
  } else if (productOrPurchase.isLowStock) {
    // Low stock
    const notifications = managers.map((user) => {
      new Email(
        user,
        `${productOrPurchase.productName} ${productOrPurchase.sku} is low of stock.`,
      )
        .notifyStockStatus()
        .catch((err) => {
          console.error(`Failed to send email to ${user.email}:`, err);
        });
      return {
        user: user._id,
        type: "low_stock",
        title: "Low stock alert",
        message: `${productOrPurchase.productName} has ${productOrPurchase.currentStock} units remaining (reorder level: ${product.reorderLevel}).`,
        referenceId: productOrPurchase._id,
        referenceType: "Product",
      };
    });
    await Notification.insertMany(notifications);
  } else if (productOrPurchase.status === "received") {
    const notifications = managers.map((user) => {
      new Email(user, `${productOrPurchase.referenceNo} has been received`)
        .purchaseUpdate()
        .catch((err) => {
          console.error(`Failed to send email to ${user.email}:`, err);
        });
      return {
        user: user._id,
        type: "purchase_received",
        title: "Purchase received.",
        message: `Purchase ${productOrPurchase.referenceNo} has been received.`,
        referenceId: productOrPurchase._id,
        referenceType: "Purchase",
      };
    });
    await Notification.insertMany(notifications);
  } else if (productOrPurchase.status === "cancelled") {
    const notifications = managers.map((user) => {
      new Email(user, `${productOrPurchase.referenceNo} has been cancelled.`)
        .purchaseUpdate()
        .catch((err) => {
          console.error(`Failed to send email to ${user.email}:`, err);
        });
      return {
        user: user._id,
        type: "purchase_cancelled",
        title: "Purchase cancelled.",
        message: `${productOrPurchase.referenceNo} has been cancelled.`,
        referenceId: productOrPurchase._id,
        referenceType: "Purchase",
      };
    });
    await Notification.insertMany(notifications);
  }
};

exports.markAsRead = catchAsync(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id }, // user check prevents reading others' notifications
    { isRead: true, readAt: new Date() },
    { new: true },
  );

  if (!notification) return next(new AppError("Not found", 404));
  res.status(200).json({ status: "success", data: notification });
});
exports.markAllAsRead = catchAsync(async (req, res) => {
  await Notification.updateMany(
    { user: req.user._id, isRead: false },
    { isRead: true, readAt: new Date() },
  );

  res
    .status(200)
    .json({ status: "success", message: "All notifications marked as read" });
});

exports.getAllNotifications = catchAsync(async (req, res, next) => {
  const notifications = await Notification.find();
  res.status(200).json({
    status: "success",
    data: { notifications, length: notifications.length },
  });
});

exports.getNotification = catchAsync(async (req, res, next) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) {
    return next(new AppError("Movement not found", 404));
  }
  res.status(200).json({ status: "success", data: { notification } });
});

exports.myNotifications = catchAsync(async (req, res, next) => {
  const notifications = await Notification.find({ user: req.user._id });

  res.status(200).json({ status: "success", data: { notifications } });
});
