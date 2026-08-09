# Security Practices & Config

## 1. Implemented Defenses
- **helmet()** HTTP security headers + custom CSP.
- **express-mongo-sanitize** — blocks NoSQL `$` operator injection.
- **sanitize-html** (tags stripped, no attrs) on every string in `req.body` — XSS mitigation for API input.
- **hpp** — parameter pollution protection.
- **express-rate-limit** — global Redis-backed limiter (300 req/15 min/IP) via `utils/rate_limit_store.js` (graceful in-memory fallback when Redis is down); stricter `authLimiter` (10/15 min) on signup/activate/login/forget/reset and `refreshLimiter` (60/15 min) on `/refresh`. `trust proxy` enabled for accurate `req.ip`.
- **bcrypt (12 rounds)** password hashing via pre-save hook.
- **JWT** with httpOnly, `secure` (prod), `sameSite: "Strict"` cookies; `user.password = undefined` before responding.
- **Short-lived access token + long-lived refresh token** (`jwt_refresh` cookie, path-scoped to `/api/v1/auth`). Refresh tokens are stored SHA-256-hashed on the user doc, **rotated on every use**, and **revoked on logout and password change**.
- **Password change detection**: `passwordChangedAfter(decoded.iat)` invalidates old access tokens; `resetPassword`/`updatePassword` also wipe all stored refresh tokens.
- **Email activation gating**: users inactive until token verified.
- **Soft delete** hides removed records from all `find*` queries.
- **CORS**: credentials-enabled, origin-limited to `http://localhost:3000`.
- **Error handling**: production error responses never leak stack traces.

## 2. Security Gaps / Weaknesses (ranked)
1. **RBAC not enforced on routes** — `authorize()` middleware defined but never used; categories, units, roles, permissions routes are fully unauthenticated; all other routes only require `protect` (any logged-in user can create/delete anything).
2. **`roles` & `permissions` routes are public** — anyone can create Admin roles or grant permissions.
3. **User enum/whitelisting is weak** — `signup` allows arbitrary `role` from request body (any user can self-assign a privileged role; a fresh DB has no roles to reference, causing foreign-key style validation to fail, but once Admin role exists this is exploitable).
4. **`protect` does not verify `user.active`** — deactivated users keep access until next password change; also soft-deleted users are filtered by the query scope, but an account flagged inactive still passes.
5. **`restrictTo` broken** — compares ObjectId against role name strings.
6. **JWT secret/env exposure** — `config.env` contains production secrets; `email_brevo.js`, `custom_funcs.js`, `server.js` all read env at runtime. Ensure `.gitignore` excludes `config.env` (it is currently ignored — verify).
7. **Refresh-token reuse not audited** — rotation + hashed storage are implemented; an audit trail for suspicious token reuse is not (nice-to-have hardening).
8. **CORS origin hardcoded** to localhost:3000 — production frontend origin must be updated.
9. **Email send errors are swallowed** (logged only) — account activation emails could silently fail.
10. **`signup` mass-assignment**: fields are whitelisted (`name, email, password, confirmPassword, role`) — OK — but `role` being user-supplied is the real risk.
11. **`hpp` whitelist** contains course-era fields irrelevant to this API (harmless, but noise).
12. **`isLoggedIn` non-blocking** by design (render-only), safe.
13. **No input length/format limits on most text fields** beyond Mongoose types.

## 3. Secrets Management
- All secrets in `config.env` (dotenv-loaded): `DB_PASSWORD`, `JWT_SECRET`, `MAILTRAP_*`, `BREVO_API_KEY`, `EMAIL_FROM`.
- Production DB string is built by string-replacing `<db_password>` with `DB_PASSWORD`.
- Recommended: switch to env-provided vars / secret manager; never commit real secrets.
- `.gitignore` should contain `config.env`, `node_modules/`, `securityaudit/` artifacts.

## 4. Production Deployment Notes
- `trust proxy` lines are commented out in `app.js` — if deployed behind a reverse proxy (Heroku/Railway/Vercel), uncomment to make rate-limiting & `req.ip` accurate.
- Start command: `npm run start:prod` (`NODE_ENV=production`, nodemon) — for real prod prefer `node server.js` with a process manager.
- `email_brevo.js newTransport()` returns `null` in production and Brevo path uses axios — ensure `BREVO_API_KEY` is set or emails silently log errors.
