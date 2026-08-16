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

- API: `{ status, message, requestId }` (production) or `{ status, error, message, stack, requestId }` (dev). Every error body carries `requestId` for support correlation.
- Non-API: renders `views/error.pug` (exists).

## 3. Request-ID & Logging (Task 13)

- `app.js` assigns `req.id` to every request (`X-Request-Id` header, or generated via `crypto.randomUUID()`), echoes it back as the `X-Request-Id` response header, and includes it in error bodies and morgan logs.
- Morgan runs in **all** environments: `:method :url :status :response-time ms [:req-id]` in development; a JSON line (with `requestId`) in production.
- Use the `X-Request-Id` from a client error report to find the exact request in the logs.

## 4. Process-level handlers (`server.js`)

- `uncaughtException` → log name/message, `process.exit(1)`.
- `unhandledRejection` → log, graceful `server.close` if a server exists, then exit.
- `SIGTERM` / `SIGINT` → shared `shutdown(signal)`: `server.close`, force-exit after a 10s grace timer.
- **DB connect**: `connectWithRetry()` (3 attempts, 5s delay, `serverSelectionTimeoutMS: 10000`) → on final failure logs troubleshooting hints and `process.exit(1)`. Server only listens after the DB is connected.

## 5. Known Response Code Quirks

- `protect` returns **401** for a missing/invalid token.
- `signin` returns **401** for both unknown email and wrong password ("Incorrect email or password.").
- `signup` existing active account → 409 (generic "Account already exist.").
- Deletes return **`204` with no body** everywhere (`.end()`): products, categories, units, roles, suppliers.
- `getAll*` list endpoints include a `totalCount` field (products, purchases, suppliers, adjustments, movements, audits).

## 6. Where errors commonly originate (top runtime failures)

1. `receivePurchaseOrder` / `adjustStock` depend on the DB being up — with the fail-fast `server.js` the API no longer runs half-dead without MongoDB.
2. `makePurchaseOrder` unique-ref race — mitigated by atomic Counter + 5 retry attempts; a 403 duplicate-key error can still surface under heavy concurrency.
3. Brevo email failures now **re-throw** — `signup`/`activate`/`forgetPassword`/`resetPassword` return 500 when the email transport fails (previously silent).
4. Non-API error responses render `views/error.pug` (exists).
