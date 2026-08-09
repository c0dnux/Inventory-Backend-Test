# Business Logic & Workflows

## 1. Product Lifecycle
- **Create** → `createProduct` uses `Product.create(req.body)`; auto-generates SKU + barcode via `pre('save')` hook.
- **SKU format**: `PRD-{first3ofCategoryName}-{unitAbbreviation}-{initialsOfProductName→3}-{last6ofObjectId}`.
- **Barcode**: md5(sku) → substring 12 → uppercase.
- **Update** → `updateProduct` snapshots `beforeState`, applies `product.set(req.body)`, saves, snapshots `afterState`, writes audit with before/after changes.
- **Delete** → `deleteProduct` soft-deletes, returns 204.
- **Low stock**: virtual `isLowStock` when `0 < currentStock <= reorderLevel`; `isOutOfStock` when `currentStock === 0`.
- **WARNING**: `post('save')` hook calls `notificationService.sendCriticalAlert/sendWarningAlert`, but `notificationService` is never imported → any product save that modifies `currentStock` throws a `ReferenceError`.

## 2. Purchase Order Workflow
1. **Create** (`makePurchaseOrder`): auto-generates `referenceNo` (`PO-YYYYMM-NNN`), requires `supplier` + non-empty `items[]`; `totalAmount` computed in `pre('validate')`; status starts `pending`; audit `purchase_create`.
2. **Receive** (`receivePurchaseOrder`): body `{ purchaseId }`. For each item:
   - Load product, `newStock = oldStock + quantity`.
   - Update `product.currentStock` (triggers broken `post('save')` hook).
   - If `product.costPrice !== item.unitCost` → update cost price (recent price wins).
   - Record `purchase_in` stock movement referencing the Purchase.
   - Then `purchase.status = "received"`, audit `stock_in`, `checkAndNotify(purchase)`.
   - Guard: `if (purchase.status === "received") throw AppError(...400)`.
3. **Cancel** (`cancelPurchase`): body `{ purchaseId, cancelReason }`. Guards: not found → 404; already `cancelledAt` or `status === "received"` → 400. Sets `cancelledAt`, `cancelledBy`, `cancelReason`, `status = "cancelled"`; audit `purchase_cancel`; `checkAndNotify`. **NOTE**: stock is NOT reversed on cancel (only movements for received stock are `purchase_in`; there's no `purchase_cancel` movement handler).

## 3. Stock Adjustment (`adjustStock`)
Body: `{ productId, type, quantity, reason, note }`.
- `stock_in`: `adjustedQuantity = currentStock + quantity`, `variance = +quantity`.
- `stock_out`: rejects if `quantity > currentStock` (400 "Insufficient stock"); `adjustedQuantity = currentStock - quantity`, `variance = -quantity`.
- `adjustment`: `quantity` IS the counted stock → `adjustedQuantity = quantity`, `variance = quantity - currentStock` (can be negative).
- Updates product, saves (triggers broken post-save hook), `checkAndNotify(product)`, creates StockAdjustment record with `quantity: |variance|`, creates StockMovement (`adjustment_in` / `adjustment_out` / `adjustment`), writes audit (`stock_in` / `stock_out` / `stock_adjustment`).

## 4. Notification Triggers (`checkAndNotify` in `notification_controllers.js`)
Targets: all Users whose role name is `Admin` or `Manager` and `active: true`.
- Product `isOutOfStock` → type `out_of_stock`, email `notifyStockStatus`. **Bug**: message template references undefined `proproductOrPurchaseduct` / `product` variables → ReferenceError at runtime.
- Product `isLowStock` → type `low_stock`. **Bug**: references undefined `product.reorderLevel` → ReferenceError.
- Purchase `status === "received"` → type `purchase_received`, email `purchaseUpdate`.
- Purchase `status === "cancelled"` → type `purchase_cancelled`, email `purchaseUpdate`.
- Emails fired-and-forgotten (`.catch` logs failures). Notifications inserted via `Notification.insertMany(...)` (triggers the placeholder `pre('insertMany')` that logs "Send Email" but sends nothing).

## 5. Inventory Dashboard (`getInventoryDashboard` — UNUSED, no route)
Single aggregation returning: `totalProducts`, `totalStockValue` (Σ currentStock×costPrice), `lowStockItems` (0<stock≤reorderLevel), `outOfStockItems` (stock===0).

## 6. User Admin Flow (`createUser` — UNUSED, no route)
Creates a user directly with password `"00000000"`, sets `active: true`. No email sent. Audit action uses `"update"` (mislabeled).

## 7. Accounting/ledger invariants
- StockMovement is append-only, records `quantityBefore`/`quantityAfter` so every change is auditable.
- Every stock change flows: Product.save() → StockAdjustment/Purchase → StockMovement → Notification → AuditLog.
