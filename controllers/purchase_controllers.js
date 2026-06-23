const receivePurchaseOrder = async (purchaseId) => {
  const purchase = await Purchase.findById(purchaseId);
  if (purchase.status === "received") {
    throw new AppError("Purchase order has already been received.", 400);
  }
  for (const item of purchase.items) {
    const product = await Product.findById(item.product);
    const oldStock = product.currentStock;
    const newStock = oldStock + item.quantity;
    product.currentStock = newStock;
    //update cost price if it has changed
    if (product.costPrice !== item.unitCost) {
      product.costPrice = item.unitCost;
    }
    await product.save();
    await stockMoment.create({
      product: product._id,
      changeType: "purchase_in",
      quantity: item.quantity,
      quantityBefore: oldStock,
      quantityAfter: newStock,
      referenceId: purchase._id,
      referenceType: "Purchase",
      createdBy: purchase.createdBy,
    });
  }
  purchase.status = "received";
  await purchase.save();
  await AuditLog.create({
    action: "receive_purchase_order",
    referenceId: purchase._id,
    referenceType: "Purchase",
    createdBy: purchase.createdBy,
  });
};
