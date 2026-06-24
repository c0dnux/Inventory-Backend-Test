exports.purchaseProduct = catchAsync(async (req, res, next) => {
  const { productId, quantityRequested } = req.body;

  const product = await Product.findOneAndUpdate(
    {
      _id: productId,
      currentStock: { $gte: quantityRequested },
    },
    {
      $inc: { currentStock: -quantityRequested },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!product) {
    const existingProduct = await Product.findById(productId);

    if (!existingProduct) {
      return next(new AppError("Product not found", 404));
    }

    if (existingProduct.currentStock < quantityRequested) {
      return next(
        new AppError(
          `Insufficient stock. You requested ${quantityRequested}, but only ${existingProduct.currentStock} are available.`,
          400,
        ),
      );
    }
  }

  if (product.isOutOfStock) {
    await notificationService.sendCriticalAlert(product);
  } else if (product.isLowStock) {
    await notificationService.sendWarningAlert(product);
  }

  res.status(200).json({
    status: "success",
    message: "Purchase successful",
    data: { product },
  });
});
