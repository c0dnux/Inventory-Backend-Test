# Business Logic & Workflows

## 1. Product Lifecycle

- **Create** → `createProduct` uses `Product.create(pickEditable(req.body))`; auto-generates SKU + barcode via `pre('save')` hook. `PRODUCT_EDITABLE_FIELDS` whitelist: `productName, description, category, unit, costPrice, sellingPrice, reorderLevel, status` — `currentStock`, `sku`, `barcode`, `deletedAt` are system-managed (stock only changes through purchase/adjustment flows).
- **SKU format**: `PRD-{first3ofCategoryName}-{unitAbbreviation}-{initialsOfProductName→3}-{last6ofObjectId}`. Throws if category/unit not populated at save time.
- **Barcode**: md5(sku) → substring 12 → uppercase.
- **Update** → `updateProduct` snapshots `beforeState`, applies `product.set(pickEditable(req.body))`, saves, snapshots `afterState`, writes audit with before/after changes.
- **Delete** → `deleteProduct` soft-deletes, returns 204 (no body).
- **Low stock**: virtual `isLowStock` when `0 < currentStock <= reorderLevel`; `isOutOfStock` when `currentStock === 0`.

## 2. Purchase Order Workflow

1. **Create** (`makePurchaseOrder`): auto-generates `referenceNo` (`PO-YYYYMM-NNN`) from an atomic per-month `Counter` (no count-based race); still keeps the `E11000` retry as a belt-and-braces; requires `supplier` + non-empty `items[]`; `totalAmount` computed in `pre('validate')`; status starts `pending`; audit `purchase_create`. Optional `Idempotency-Key` header: claimed per user via `Idempotency` doc (unique `{user, key}`), so retries/double-clicks return the existing PO (200) instead of duplicating; concurrent same-key requests converge on the winner's PO.
2. **Receive** (`receivePurchaseOrder`): body `{ purchaseId }`. Guards: 404 if missing; **400 if already `received` OR `cancelled`**. Line items are processed **in parallel** (`Promise.all`):
   - Load product, `newStock = oldStock + quantity`.
   - Update `product.currentStock` (no post-save hook on Product anymore).
   - If `product.costPrice !== item.unitCost` → update cost price (recent price wins). The historical cost is preserved separately on the movement's `unitCost` field.
   - Record `purchase_in` stock movement (with `unitCost` = item's unit cost) referencing the Purchase.
   - Then `purchase.status = "received"`, audit `stock_in`, `checkAndNotify(purchase)` + `checkProductsAndNotify(affectedProducts)` (single manager lookup).
3. **Cancel** (`cancelPurchase`): body `{ purchaseId, cancelReason }`. Guards: not found → 404; already `cancelledAt` or `status === "received"` → 400. Sets `cancelledAt`, `cancelledBy`, `cancelReason`, `status = "cancelled"`; audit `purchase_cancel`; `checkAndNotify`. **NOTE**: cancel only applies to PENDING orders (received orders are rejected), so it never affects stock and no stock movement is recorded. The `purchase_cancel` movement type was removed from the schema.

## 3. Stock Adjustment (`adjustStock`)

Body: `{ productId, type, quantity, reason, note }`.

- `stock_in`: `adjustedQuantity = currentStock + quantity`, `variance = +quantity`.
- `stock_out`: rejects if `quantity > currentStock` (400 "Insufficient stock"); `adjustedQuantity = currentStock - quantity`, `variance = -quantity`.
- `adjustment`: `quantity` IS the counted stock → `adjustedQuantity = quantity`, `variance = quantity - currentStock` (can be negative).
- Updates product, saves, `checkAndNotify(product)`, creates StockAdjustment record with `quantity: |variance|` and the signed `variance`, creates StockMovement (`adjustment_in` / `adjustment_out` / `adjustment`) with **`quantity: variance`** (signed), writes audit (`stock_in` / `stock_out` / `stock_adjustment`).

## 4. Notification Triggers (`checkAndNotify` / `checkProductsAndNotify` in `notification_controllers.js`)

Targets: all Users whose role name is `Admin` or `Manager` and `active: true` (single `fetchManagers()` lookup; `checkProductsAndNotify` reuses it for a batch of products).

- Product `isOutOfStock` → type `out_of_stock`, email `notifyStockStatus`.
- Product `isLowStock` → type `low_stock`, email `notifyStockStatus` (message includes `productName`, `sku`, `currentStock`, `reorderLevel`).
- Purchase `status === "received"` → type `purchase_received`, email `purchaseUpdate`.
- Purchase `status === "cancelled"` → type `purchase_cancelled`, email `purchaseUpdate`.
- Emails fired-and-forgotten (`.catch` logs failures). Notifications inserted via `Notification.insertMany(...)`.

## 5. Inventory Dashboard (`getInventoryDashboard` — wired at `GET /api/v1/products/dashboard`, Task 2)

Single aggregation returning: `totalProducts`, `totalStockValue` (Σ currentStock×costPrice), `lowStockItems` (0<stock≤reorderLevel), `outOfStockItems` (stock===0). Filters `deletedAt: null` (the aggregate bypasses the `pre(/^find/)` middleware, so the filter is explicit in the `$match`).

## 6. Accounting/ledger invariants

- StockMovement is append-only, records `quantityBefore`/`quantityAfter` so every change is auditable.
- Every stock change flows: Product.save() → StockAdjustment/Purchase → StockMovement → Notification → AuditLog.
- StockMovement is append-only, records `quantityBefore`/`quantityAfter` so every change is auditable.
- Every stock change flows: Product.save() → StockAdjustment/Purchase → StockMovement → Notification → AuditLog.
