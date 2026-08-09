# Middleware Pipeline, Utilities & Email

## 1. Request Pipeline (order in `app.js`)
1. **CORS**: `cors({ origin: "http://localhost:3000", credentials: true })` — hardcoded to localhost frontend.
2. **helmet()**: sets secure HTTP headers.
3. **helmet.contentSecurityPolicy()**: custom directives (scripts: self + CDNs + Paystack; styles: self + Google Fonts; img: data/blob/https; connect: map tile APIs; frame: Paystack).
4. **morgan('dev')**: only when `NODE_ENV === "development"`.
5. **Rate limit**: global Redis-backed limiter 300 req / 15 min per IP via `utils/rate_limit_store.js` (graceful in-memory fallback if Redis is down) → custom 429 `AppError`. `trust proxy` enabled.
6. **express.static('public')**: static files.
7. **Body parsers**: `express.json()`, `express.urlencoded({ extended: true })`, `cookieParser()`.
8. **req.query writability patch**: makes `req.query` writable.
9. **express-mongo-sanitize()**: strips `$` operators & `.` from queries (NoSQL injection defense).
10. **hpp()**: parameter pollution whitelist `duration, ratingsQuantity, ratingsAverage, maxGroupSize, difficulty, price` (copy-paste from a course — mostly irrelevant to this API).
11. **XSS sanitization**: walks `req.body` strings through `sanitize-html(value, { allowedTags: [], allowedAttributes: {} })` → strips all HTML tags.
12. **Views**: `app.set("views", path.join(__dirname, "views"))` for email templates.
13. **Routes** mounted at `/api/v1/*` (see API docs).
14. **404 catch-all**: `AppError("Can't find ...", 404)`.
15. **Global error handler**: `error_controller`.

## 2. Utilities (`utils/`)

### `app_error.js` — AppError class
```js
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "Fail" : "Error";
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}
```

### `catch_async.js`
Wraps async handlers; forwards rejections to `next(err)`.
```js
module.exports = (fn) => (req, res, next) => fn(req, res, next).catch(next);
```

### `query_options.js` — APIFeatures class
Chainable: `.filter()` (strips page/sort/limit/fields, maps gte/gt/lte/lt → `$`), `.sort()` (comma→space), `.limiting()` (fields select), `.paginate()` (page default 1, limit default 50).

### `custom_funcs.js`
- `signTokenHandler(statusCode, message, res, user)`: issues a short-lived access token (`JWT_ACCESS_EXPIRES_IN`, default 15m) + a long-lived refresh token (`JWT_REFRESH_EXPIRES_IN`, default 7d), stores the refresh token SHA-256 hash on the user, sets `jwt` + `jwt_refresh` httpOnly cookies, blanks password, returns `{ status: "Success", token, message, data: { user } }`.
- `verifyRefreshToken(token)` / `hashToken(token)` / `clearAuthCookies(res)` / `setAuthCookies(res, access, refresh)` — refresh-token verification (secret read lazily: `JWT_REFRESH_SECRET || JWT_SECRET`), hashing, and cookie helpers.
- `generatePurchaseRef(Purchase)`: counts purchases created this month → returns `PO-YYYYMM-NNN` (padded 3).

### `rate_limit_store.js` / `rate_limiters.js`
- `GracefulRedisStore` (`rate_limit_store.js`): an express-rate-limit `Store` that uses `RedisStore` (rate-limit-redis) when Redis is reachable and transparently falls back to `MemoryStore` otherwise. `localKeys: true`, per-limiter instance.
- `rate_limiters.js`: `createLimiter()` factory; exports `authLimiter` (10 req / 15 min, applied to signup/activate/login/forget-password/reset-password) and `refreshLimiter` (60 req / 15 min, applied to `/refresh`).

### `email_brevo.js` — Email class
- Constructor: `{ to: user.email, firstName, url, from: { name: "Inventory System", email: EMAIL_FROM } }`.
- `newTransport()`: production → `null`; otherwise Mailtrap SMTP (`sandbox.smtp.mailtrap.io:2525`).
- `send(template, subject)`: reads HTML file from `views/email/<template>.html`, replaces `{{firstName}}`, `{{url}}`, `{{subject}}`.
  - **Production**: Brevo REST API `POST https://api.brevo.com/v3/smtp/email` w/ `api-key: BREVO_API_KEY`.
  - **Development**: nodemailer Mailtrap, includes `text` via `htmlToText`, `category: "Integration Test"`, `sandbox: true`.
  - Errors are caught & logged (won't crash request).
- Convenience methods: `sendWelcome`, `sendPasswordReset`, `notifyStockStatus`, `purchaseUpdate`.

### `swagger.js`
Swagger JSDoc config → `openapi: 3.0.0`, title "Inventory API", server `http://localhost:3000/api`, bearerAuth security scheme. Parses `./routes/*.js` for JSDoc comments. Exports `{ swaggerUi, swaggerSpec }`. **NOTE**: swaggerUi is never mounted in `app.js` — `/api-docs` route does not exist.

### `redis.js` — Redis client
- `getClient()`: lazily creates + connects a single `redis` client (node-redis). `REDIS_URL` env or default `redis://127.0.0.1:6379`. Fails open: no auto-reconnect storm, logs a single warning, throws to callers.
- `getJSON(key)` / `setJSON(key, value, ttlSeconds)` / `deleteKeys(pattern)` (SCAN + DEL).

### `cache_middleware.js` — response caching
- `cache(ttlSeconds)`: GET middleware. Key = `cache:{resource}:{req.originalUrl}` (resource from `req.baseUrl`). On hit replays `{statusCode, body}`; on miss wraps `res.json` to store 2xx/3xx responses. Runs after `protect`/`authorize` so unauthorized requests are never served from cache. **Never cache user-scoped (`my-*`) endpoints**.
- `clearCache(...resources)`: fire-and-forget SCAN-DEL of `cache:{resource}:*`. Called at the end of write handlers — see invalidation map below.
- Cache TTLs: products/purchases/adjustments/movements 60s, suppliers/audits 120s, categories/units/roles/permissions 300s, notifications 30s.
- **Invalidation map**: products create/update/delete → `products`; categories → `categories`; units → `units`; suppliers → `suppliers`; purchase make → `purchases`, receive → `purchases,products,movements,notifications`, cancel → `purchases,notifications`; stock adjust → `adjustments,products,movements,notifications`; role CRUD → `roles`; permission CRUD → `permissions`; notification mark read/all-read → `notifications`.
- If Redis is down, all cache calls reject internally and requests proceed directly to MongoDB (graceful degradation).

## 3. Email Templates (`views/email/`)
- `welcome.html` — account activation (expects `{{firstName}}`, `{{url}}`).
- `stockStatus.html` — low/out of stock alerts.
- `purchaseUpdate.html` — purchase received/cancelled.

## 4. Audit Helper (`controllers/audit_controllers.js`)
- `make_audit(params)`: requires `user`, `action`, `resource`; optional `resourceId`, `changes {before, after}`, `ipAddress`, `userAgent`, `note`. Creates immutable AuditLog.
- `getAllAudits`, `getAudit`, `myAudits` (query-scoped to `req.user._id`).

## 5. Stock Movement Helper (`controllers/stock_movement_controllers.js`)
- `make_stock_movement(params)`: requires `product`, `type`, `quantity`, `createdBy`; optional `referenceId`, `referenceType`, `note`. Validates & creates StockMovement ledger entry.
- `getAllMovements`, `getMovement`, `myMovements`.
