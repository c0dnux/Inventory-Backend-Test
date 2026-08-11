# Known Issues, Bugs & Code Smells

> Use this list as a reference when fixing bugs or refactoring. Items marked **[BUG]** cause runtime failures; **[SEC]** are security concerns; **[SMELL]** are style/design issues.

## Resolved
- **[FIXED] `error_controller.js` only responded when `NODE_ENV` was exactly `development` or `production`** — with `NODE_ENV` unset (plain `node server.js`), error handlers did nothing and every error path hung forever. Now any non-`development` value (incl. unset) uses the safe production-style responder.
- **[FIXED] `server.js` SIGTERM handler never called `process.exit()`** — `kill` left zombie processes holding the port. Now both SIGTERM/SIGINT share a `shutdown()` helper that force-exits after a 10s grace timer if close hangs.

## Critical Runtime Bugs

1. **[BUG] `product_model.js` `post('save')` → `notificationService` undefined** (line ~133)
   ```js
   await notificationService.sendCriticalAlert(doc);
   await notificationService.sendWarningAlert(doc);
   ```
   `notificationService` is never required/defined. Every `product.save()` that modifies `currentStock` (receive purchase, adjust stock) throws `ReferenceError: notificationService is not defined`. This breaks `receivePurchaseOrder` and `adjustStock` end-to-end.

2. **[BUG] `notification_controllers.js` — undefined variables in low/out-of-stock branches**
   - Line ~31: `` message: `${proproductOrPurchaseduct.productName} ...` `` → typo, variable undefined → ReferenceError.
   - Line ~52: `` message: `${productOrPurchase.productName} ... reorder level: ${product.reorderLevel}` `` → `product` undefined → ReferenceError.
   Any time `checkAndNotify` hits the `isOutOfStock` or `isLowStock` path it throws (only the `received`/`cancelled` purchase paths are safe).

3. **[BUG] `notification_controllers.js` `markAsRead`** — signature `(req, res)` but calls `next(new AppError("Not found", 404))` when notification is missing → `ReferenceError: next is not defined`.

4. **[BUG] `user_controllers.js` `logout` is public but reads `req.user`** — `routes/user_routes.js` registers `logout` WITHOUT `protect`, so `req.user` is undefined → `Cannot read properties of undefined (reading '_id')`.

5. **[BUG] `notification_controllers.js` `insertMany` hook** — `pre('insertMany')` uses async callback; the "Send Email" placeholder sends nothing (email code commented out).

## Broken / Dead Authorization Code

6. **[BUG] `restrictTo(...roles)`** compares `req.user.role` (ObjectId) against strings → always fails. Unused in routes.
7. **[SMELL] `authorize(resource, action)`** is implemented but never wired into any route — RBAC is effectively unimplemented. (Also returns raw 403 JSON instead of AppError.)

## Unused / Dead Code

8. `getInventoryDashboard` (product_controllers.js) — no route.
9. `createUser` (user_controllers.js) — no route.
10. `isLoggedIn` (user_controllers.js) — no route/usage.
11. `notifyStockStatus` / `sendPasswordReset` partially wired; `sendPasswordReset` email call is commented out in `forgetPassword`.
12. Swagger (`utils/swagger.js`) never mounted — no `/api-docs` endpoint.
13. `views/email` templates exist; no Pug `error.pug` view despite `res.render("error", ...)` in error controller.

## Logic / Consistency Issues

14. **[SMELL] Signup allows arbitrary `role` from body** — user can self-assign any role id. Should restrict to `Staff` or verify permission.
15. **[SMELL] `protect` doesn't check `user.active`** — inactive accounts can still call protected routes if they hold a valid token.
16. **[SMELL] Purchase cancel doesn't reverse stock** — items received (already `purchase_in`) stay in stock after a `received` purchase is cancelled; no `purchase_cancel` movement created. (Cancel of `pending` orders is fine.)
17. **[SMELL] `signin` returns 404 vs 401** for missing vs wrong password — inconsistent; consider uniform 401.
18. **[SMELL] `protect` returns 503 for missing token** — 401 is more conventional.
19. **[SMELL] `deleteProduct` returns a body on 204** — Express strips it; harmless but confusing.
20. **[SMELL] `receivePurchaseOrder` allows receiving a `cancelled` purchase** — only guards `status === "received"`, so a cancelled PO can still be received and add stock.
21. **[SMELL] `generatePurchaseRef` count race** — two simultaneous orders in same month can collide on the same `referenceNo` (unique index → one 403 error).
22. **[SMELL] Product `pre('save')` populates category/unit then builds SKU; if category/unit missing at save-time (e.g., received via update with `currentStock` only) the populated values could be null → SKU build crashes or produces `undefined` codes.**

## Code Style / Duplication

23. Many controllers repeat the audit-call boilerplate — a small helper or middleware could reduce duplication.
24. `user_controllers.js` has `authorize` middleware placed in the middle of the file — belongs in a dedicated middleware file.
25. Typo-heavy code: `purchaseControlers`, `stockMovementControler`, `proproductOrPurchaseduct`, "recived", "This acount not activated", "Limit 30 requests" comment mismatched with limit 100.
26. Mixed formatting — trailing commas + semicolons inconsistent; some files use `"use strict"`, others don't.
27. `package.json` lists `path` as a dependency (`^0.12.7`) — `path` is a Node built-in; remove from deps.
28. `"test"` script just echoes an error — no tests exist.
29. `unit_model.js` imports `updatePermission` from permission controllers (unused import).
30. `notification_model.js` requires `User` for the `insertMany` hook that's effectively a no-op.

## Missing Features (likely next tasks)
- RBAC enforcement (`authorize`) on protected routes.
- Email sending in `pre('insertMany')` hook.
- Swagger UI mount (`/api-docs`).
- Tests (none exist).
- Seed script for default roles/permissions.
- Error view template (`error.pug`).
