# Error Handling & Global Error Controller

## 1. Design Pattern
- All operational errors are created via `AppError(message, statusCode)` — sets `isOperational = true`, `status = "Fail"|"Error"` based on 4xx.
- Async handlers wrapped with `catchAsync` → rejections forwarded to `next(err)` → global error middleware.
- Non-operational errors (bugs, Mongo casts, dup keys, validation) are mapped by the error controller.

## 2. Error Controller (`controllers/error_controller.js`)

### Environment branches (`process.env.NODE_ENV`)
- **development** → `sendErrDev`: full JSON `{ status, error, message, stack }` (or renders `error` view for non-API). Includes full stack trace for debugging.
- **production** → builds sanitized `error` object (never exposes raw internals), then classifies:
  - `name === "CastError"` → `handleCastErrDB`: `Invalid <path>: <value>` → 404.
  - `code === 11000` (duplicate key) → `handleDuplErrDB`: `"<key>:<value> already exists."` → 403.
  - `name === "ValidationError"` → `handleValErrDB`: joins all `err.errors[].message` → 400.
  - `name === "JsonWebTokenError"` → `handleAuthErr`: 401 "Action not Allowed, login to get access".
  - `name === "TokenExpiredError"` → `handleAuthEXpireErr`: 401 "Login Timeout, please login again.".
  - Operational errors → returned as-is.
  - Unknown → 500 "Something went very wrong!" (logged).

### Response shapes
- API: `{ status, message }` (production) or `{ status, error, message, stack }` (dev).
- Non-API: renders `views/error` template — **NOTE: no `views/error.pug` exists** (only `views/email/*.html`), so non-API error rendering will fail.

## 3. Process-level handlers (`server.js`)
- `uncaughtException` → log name/message, `process.exit(1)`.
- `unhandledRejection` → log, `server.close(() => process.exit(1))`.
- `SIGTERM` → graceful shutdown via `server.close`.

## 4. Known Response Code Quirks
- `protect` uses **503** for "Please Login to get Access" (unusual; 401 is conventional).
- `signin` returns 404 for unknown email ("Incorrect email or password.") and 401 for wrong password — inconsistent semantics.
- `signup` existing active account → 409.
- `deleteProduct` returns 204 with a JSON body (Express ignores body on 204).

## 5. Where errors commonly originate (top runtime failures)
1. `product_model.js` `post('save')` → `notificationService` is undefined → ReferenceError on every stock-changing save.
2. `notification_controllers.js` → undefined vars `proproductOrPurchaseduct` (typo) and `product` → ReferenceError inside low/out-of-stock branches.
3. `notification_controllers.js markAsRead` uses `next` without it being in scope of the wrapped function's params (`(req, res)` only) → `next is not defined` when notification not found.
4. `user_controllers.js logout` reads `req.user` without `protect` → TypeError on the public route.
5. `restrictTo` compares ObjectId vs string → always denies.
