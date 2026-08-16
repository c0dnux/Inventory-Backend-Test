# Middleware Pipeline, Utilities & Email

## 1. Request Pipeline (order in `app.js`)

1. **`trust proxy`**: fixed hop count from `TRUST_PROXY` env (default `0` dev, `1` prod) — prevents X-Forwarded-For spoofing of rate-limit keys.
2. **Request-ID**: `req.id` = `X-Request-Id` header or `crypto.randomUUID()`; echoed back as `X-Request-Id` response header and included in error bodies.
3. **CORS**: `cors({ origin: process.env.CORS_ORIGIN || "http://localhost:3000", credentials: true })`.
4. **helmet()**: sets secure HTTP headers.
5. **helmet.contentSecurityPolicy()**: custom directives (scripts: self + CDNs + Paystack; styles: self + Google Fonts; img: data/blob/https; connect: map tile APIs; frame: Paystack).
6. **morgan**: development → `:method :url :status :response-time ms [:req-id]`; production → JSON line with `requestId`.
7. **Rate limit**: global Redis-backed limiter 300 req / 15 min per IP via `utils/rate_limit_store.js` (graceful in-memory fallback if Redis is down) → custom 429 `AppError`.
8. **express.static('public')**: static files.
9. **Body parsers**: `express.json()`, `express.urlencoded({ extended: true })`, `cookieParser()`.
10. **req.query writability patch**: makes `req.query` writable.
11. **express-mongo-sanitize()**: strips `$` operators & `.` from queries (NoSQL injection defense).
12. **hpp()**: parameter pollution — whitelist is the API's real query params (`page, limit, sort, fields, search, status, category, unit, supplier, dateFrom, dateTo`); everything else with duplicates → 400.
13. **XSS sanitization**: walks `req.body` strings through `sanitize-html(value, { allowedTags: [], allowedAttributes: {} })` → strips all HTML tags.
14. **Views**: `app.set("views", path.join(__dirname, "views"))` + Pug engine.
15. **Routes** mounted at `/api/v1/*` (see API docs).
16. **404 catch-all**: `AppError("Can't find ...", 404)`.
17. **Global error handler**: `error_controller`.

## 1b. `middleware/authorize.js` (Task 13)

`authorize(resource, action)` factory — checks `req.user.role.permissions.some(p => p.resource === resource && p.action === action)`; 401 if no user, 403 if permission missing. Replaced the old `userController.authorize`; all route files import it from `../middleware/authorize`.

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

Chainable: `.filter()` (strips page/sort/limit/fields, maps gte/gt/lte/lt → `$`, converts `?search=` into a Mongo `$text` query), `.sort()` (comma→space), `.limiting()` (fields select), `.paginate()` (page default 1, limit default 50, max 100), and `.count()` — returns the full matching count (mirrors the soft-delete `deletedAt: null` scope; does not trigger `pre(/^find/)` hooks, so it injects the condition explicitly).

### `custom_funcs.js`

- `signTokenHandler(statusCode, message, res, user)`: issues a short-lived access token (`JWT_ACCESS_EXPIRES_IN`, default 15m) + a long-lived refresh token (`JWT_REFRESH_EXPIRES_IN`, default 7d), stores the refresh token SHA-256 hash on the user, **populates `role.permissions`**, sets `jwt` + `jwt_refresh` httpOnly cookies, blanks password, returns `{ status: "success", token, message, data: { user } }`.
- `issueTokens(res, user)` / `verifyRefreshToken(token)` / `hashToken(token)` / `clearAuthCookies(res)` / `setAuthCookies(res, access, refresh)` — refresh-token issuance & verification (secret read lazily: `JWT_REFRESH_SECRET || JWT_SECRET`), hashing, and cookie helpers.
- `isRequestSecure(res)` — cookie `secure` flag = production AND actual TLS (see auth docs).
- `generatePurchaseRef(Purchase)`: atomic per-month counter (`Counter` collection, key `purchaseRef-YYYYMM`, `$inc` on `findOneAndUpdate` upsert) → returns `PO-YYYYMM-NNN` (padded 3). Concurrency-safe (no count-based race). `seedPurchaseRefCounter(Purchase)`: backfills the current month's counter from existing `PO-*` refs (runs at boot).

### `rate_limit_store.js` / `rate_limiters.js`

- `GracefulRedisStore` (`rate_limit_store.js`): an express-rate-limit `Store` that uses `RedisStore` (rate-limit-redis) when Redis is reachable and transparently falls back to `MemoryStore` otherwise. `localKeys: true`, per-limiter instance.
- `rate_limiters.js`: `createLimiter()` factory with **development relaxation** (in non-production the limit is raised to a minimum of 500 so local testing / SPA refresh-on-boot doesn't get blocked); exports `authLimiter` (10 req / 15 min prod, applied to signup/activate/login/google/forget-password/reset-password) and `refreshLimiter` (60 req / 15 min, applied to `/refresh`).

### `email_brevo.js` — Email class

- Constructor: `{ to: user.email, firstName, url, from: { name: "Inventory System", email: EMAIL_FROM } }`.
- **`NODE_ENV === "development"` → Mailtrap SMTP** (`sandbox.smtp.mailtrap.io:2525`); anything else (production/unset) → **Brevo REST API** `POST https://api.brevo.com/v3/smtp/email` w/ `api-key: BREVO_API_KEY`.
- `send(template, subject)`: reads HTML file from `views/email/<template>.html`, replaces `{{firstName}}`, `{{url}}`, `{{subject}}`.
  - **Brevo**: errors are logged AND **re-thrown** so callers don't silently "succeed" (activation/reset flows surface a 500); fire-and-forget notification emails use `.catch()` and are unaffected.
  - **Mailtrap**: errors logged; success also logs the activation/reset code to the console (dev convenience since Mailtrap sandbox never delivers).
- Convenience methods: `sendWelcome`, `sendPasswordReset` (template `PasswordReset.html`), `notifyStockStatus`, `purchaseUpdate`.

### `swagger.js`

Swagger JSDoc config → `openapi: 3.0.0`, title "Inventory API", server `http://localhost:3000/api`, bearerAuth security scheme. Parses `./routes/*.js` for JSDoc comments. Exports `{ swaggerUi, swaggerSpec }`. **NOTE**: swaggerUi is never mounted in `app.js` — `/api-docs` route does not exist.

### `redis.js` — Redis client

- `getClient()`: lazily creates + connects a single `redis` client (node-redis). `REDIS_URL` env or default `redis://127.0.0.1:6379`. Fails open: `reconnectStrategy` throws immediately so it never reconnect-storms, logs a single warning, throws to callers (which fall back to MongoDB / MemoryStore).
- `getJSON(key)` / `setJSON(key, value, ttlSeconds)` / `deleteKeys(pattern)` (SCAN + DEL).

### `cache_middleware.js` — response caching

- `cache(ttlSeconds)`: GET middleware. Key = `cache:{resource}:{req.originalUrl}` (resource from `req.baseUrl`). On hit replays `{statusCode, body}`; on miss wraps `res.json` to store 2xx/3xx responses. Runs after `protect`/`authorize` so unauthorized requests are never served from cache. **Never cache user-scoped (`my-*`) endpoints**.
- `clearCache(...resources)`: fire-and-forget SCAN-DEL of `cache:{resource}:*`.
- `cacheBust(req, ...extraResources)`: primary resource inferred from `req.baseUrl` (same logic as the read key, so the two can't drift) + any extra affected resources. Called at the end of write handlers — see invalidation map below.
- Cache TTLs: products/purchases/adjustments/movements 60s, suppliers/audits 120s, categories/units/roles/permissions 300s, notifications 30s.
- **Invalidation map**: products create/update/delete → `cacheBust(req)`; categories → `cacheBust(req)`; units → `cacheBust(req)`; suppliers → `cacheBust(req)`; purchase make → `cacheBust(req)`, receive → `cacheBust(req,"products","movements","notifications")`, cancel → `cacheBust(req,"notifications")`; stock adjust → `cacheBust(req,"products","movements","notifications")`; role CRUD → `cacheBust(req)`; permission CRUD → `cacheBust(req)`; notification mark read/all-read → `cacheBust(req)`.
- If Redis is down, all cache calls reject internally and requests proceed directly to MongoDB (graceful degradation).

## 3. Email Templates (`views/email/`)

- `welcome.html` — account activation (expects `{{firstName}}`, `{{url}}`).
- `PasswordReset.html` — password reset token.
- `stockStatus.html` — low/out of stock alerts.
- `purchaseUpdate.html` — purchase received/cancelled.

Also `views/error.pug` — rendered by the error controller for non-API requests.

## 4. Audit Helper (`controllers/audit_controllers.js`)

- `make_audit(params)`: requires `user`, `action`, `resource`; optional `resourceId`, `changes {before, after}`, `ipAddress`, `userAgent`, `note`. Creates immutable AuditLog.
- `getAllAudits`, `getAudit`, `myAudits` (query-scoped to `req.user._id`).

## 5. Stock Movement Helper (`controllers/stock_movement_controllers.js`)

- `make_stock_movement(params)`: requires `product`, `type`, `quantity`, `createdBy`; optional `referenceId`, `referenceType`, `note`. Validates & creates StockMovement ledger entry.
- `getAllMovements`, `getMovement`, `myMovements`.
