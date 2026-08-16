# Known Issues, Bugs & Code Smells

> Use this list as a reference when fixing bugs or refactoring. Items marked **[BUG]** cause runtime failures; **[SEC]** are security concerns; **[SMELL]** are style/design issues.

## Resolved (do not reintroduce)

- **[FIXED] `product_model.js` `post('save')` hook crashed every stock-changing save** (`notificationService` was never defined) — the hook has been **removed** entirely. Stock-level notifications are now triggered explicitly from `receivePurchaseOrder` / `adjustStock` via `checkAndNotify`/`checkProductsAndNotify`.
- **[FIXED] `notification_controllers.js` undefined variables** in low/out-of-stock branches (typo `proproductOrPurchaseduct`, missing `product`) — rewritten as `buildNotifications(managers, productOrPurchase)` using `productOrPurchase.*` throughout.
- **[FIXED] `notification_controllers.js markAsRead` `next` out of scope** — `next` is now a parameter and the id resolves from `req.body.id || req.params.id`.
- **[FIXED] `logout` was public but read `req.user`** — now revokes the refresh token itself (or silently no-ops) and always clears cookies.
- **[FIXED] `restrictTo` compared ObjectId vs role strings** — now compares populated `req.user.role.name`. (Still unused.)
- **[FIXED] `restrictTo` / `isLoggedIn` / `createUser` dead code** — all removed (Task 13).
- **[FIXED] `authorize` lived in `user_controllers.js`** — moved to `middleware/authorize.js`; all routes updated (Task 13).
- **[FIXED] `authorize` never wired into routes** — now enforced on all resource routes via per-handler `authorize(resource, action)`; denies with a proper 403 `AppError`.
- **[FIXED] `protect` used 503 + didn't check `active`** — now 401, and inactive accounts are rejected.
- **[FIXED] `signin` returned 404 vs 401 inconsistently** — now uniformly 401 (anti-enumeration).
- **[FIXED] Signup allowed arbitrary `role` self-assignment** — now whitelists fields and always assigns `Staff`.
- **[FIXED] `server.js` ran silently without a DB** — now `connectWithRetry()` fails fast (3 tries) and exits with guidance.
- **[FIXED] `server.js` SIGTERM never exited / error handler hung with `NODE_ENV` unset** — `shutdown()` helper + production-style error responder for any non-`development` env.
- **[FIXED] No `views/error.pug`** — the template now exists.
- **[FIXED] `package.json` listed Node built-in `path` as a dep** — removed.
- **[FIXED] `unit_model.js` unused `updatePermission` import / `notification_model.js` no-op `insertMany` hook + `User` import** — both gone.
- **[FIXED] `?search=` on non-Product endpoints errored ("text index required")** — `APIFeatures.hasTextIndex(model)` drops `search` silently where no text index exists (Task 5).
- **[FIXED] `purchase_cancel` implied stock reversal** — removed from the `StockMovement.type` enum; cancel is pending-only (Task 4).
- **[FIXED] `generatePurchaseRef` count race** — replaced with an atomic per-month `Counter` doc (`findOneAndUpdate` + upsert) with the E11000 retry kept as belt-and-braces (Task 7).
- **[FIXED] No idempotency on `POST /purchases/make`** — optional `Idempotency-Key` header + `Idempotency` collection (`{user, key}` unique) returns the existing PO on retries (Task 12).
- **[FIXED] Cache invalidation string drift** — `cacheBust(req)` infers the resource from `req.baseUrl` (same source as the read key) + explicit extras (Task 11).
- **[FIXED] 204 delete responses inconsistent** — role/supplier deletes now return an empty 204 like product/category/unit; `profile` returns 200 not 201 (Task 13).
- **[FIXED] Course-era `hpp` whitelist** — replaced with the API's real query params (`page, limit, sort, fields, search, status, category, unit, supplier, dateFrom, dateTo`) (Task 13).
- **[FIXED] No request-ID / structured logging** — every request gets `req.id` (echoed as `X-Request-Id` and included in error bodies); morgan logs it in dev and JSON in prod (Task 13).
- **[FIXED] No tests** — `npm test` runs a `node:test` suite (authorize, query_options, cache_middleware) (Task 13).
- **[FIXED] `receivePurchaseOrder` / `adjustStock` had no transaction** — both now run in `mongoose.startSession().withTransaction()`; PO line items are processed **sequentially** (not `Promise.all`) to avoid write conflicts, and every write (stock, movements, notifications, audits) shares the session. Commit + rollback paths verified (Task 3).
- **[FIXED] `generatePurchaseRef` count race** — atomic per-month `Counter` doc (`findOneAndUpdate` + upsert) with E11000 belt-and-braces (Task 7).
- **[FIXED] `myPurchases`/`myMovements`/`myAdjustments`/`myAudits` didn't paginate/filter** — all four now route through `APIFeatures` scoped to `createdBy: req.user._id`, returning the same `{totalCount, <items>}` shape as `getAll*` (Tasks 6 + 13).
- **[MITIGATED] Retroactive `costPrice` overwrite skews historical value** — `StockMovement` now records `unitCost` per `purchase_in` receipt (Task 8), so the ledger keeps each lot's cost; the product's live `costPrice` still reflects latest-receipt-wins (used for current valuation).

## Open Bugs / Risky Behavior

1. **[SMELL] Brevo failures now re-throw** — `signup`/`activate`/`forgetPassword`/`resetPassword` return 500 when the email transport fails (intentional — no more silent "check your email"). Ensure `BREVO_API_KEY` is valid in production or account creation breaks end-to-end.
2. **[SMELL] Cookie `secure` is conditional on `isRequestSecure`** — behind a proxy without a correct `TRUST_PROXY`/`x-forwarded-proto`, production cookies are never marked secure (or vice-versa). Deploy-time config footgun.

## Dead / Unused Code

3. **[SMELL] Swagger (`utils/swagger.js`)** — configured but never mounted in `app.js`; no `/api-docs` endpoint. (Skipped by user decision, Task 9.)
4. `notifyStockStatus` / `sendPasswordReset` — wired to Email methods, all four email methods are used.

## Logic / Consistency Issues

5. **[SMELL] `getAllRoles` returns `length` at the top level of the response while other list endpoints nest it** — inconsistent response shape.
6. **[SMELL] `getNotification`/`markAsRead` scoping** — properly scoped to `req.user._id` (good); `markAllAsRead` also scoped (good).

## Code Style / Duplication

11. Many controllers repeat the audit-call boilerplate — a small helper or middleware could reduce duplication.
12. Mixed formatting — trailing commas + semicolons inconsistent; some files use `"use strict"`, others don't.
13. Comments/whitespace drift: some files still have course-era comments.
