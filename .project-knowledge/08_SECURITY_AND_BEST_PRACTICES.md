# Security Practices & Config

## 1. Implemented Defenses

- **helmet()** HTTP security headers + custom CSP.
- **express-mongo-sanitize** — blocks NoSQL `$` operator injection.
- **sanitize-html** (tags stripped, no attrs) on every string in `req.body` — XSS mitigation for API input.
- **hpp** — parameter pollution protection.
- **express-rate-limit** — global Redis-backed limiter (300 req/15 min/IP) via `utils/rate_limit_store.js` (graceful in-memory fallback when Redis is down); stricter `authLimiter` (10/15 min prod) on signup/activate/login/google/forget/reset and `refreshLimiter` (60/15 min) on `/refresh`. **Dev relaxation**: non-production limits are raised to ≥500 so local testing/SPA boot doesn't get blocked. `trust proxy` uses a fixed hop count from `TRUST_PROXY` (default 0 dev / 1 prod) to prevent `X-Forwarded-For` spoofing.
- **bcrypt (12 rounds)** password hashing via pre-save hook.
- **JWT** with httpOnly, `sameSite: "Strict"` cookies. **`secure` is only set in production AND when the request is actually over TLS** (`isRequestSecure`) so cookies aren't silently dropped on plain HTTP. `user.password = undefined` before responding.
- **Short-lived access token + long-lived refresh token** (`jwt_refresh` cookie, path-scoped to `/api/v1/auth`). Refresh tokens stored SHA-256-hashed on the user doc, **rotated on every use** (old hash revoked), capped at 5 concurrent sessions, and **revoked on logout and password change**.
- **Password change detection**: `passwordChangedAfter(decoded.iat)` invalidates old access tokens; `resetPassword`/`updatePassword` also wipe all stored refresh tokens.
- **RBAC enforced** — `authorize(resource, action)` gates every mutating resource route (products create/update/delete, purchases create/cancel, stock adjust, suppliers manage, roles/permissions manage, audits read).
- **Email activation gating**: users inactive until token verified; `protect` rejects inactive accounts.
- **Anti-enumeration**: `signup` (409 generic), `signin` (401 generic for bad email/password), `forgetPassword` (always 200 "Token sent to email").
- **Signup role is fixed to `Staff`** — a user can never self-assign a privileged role.
- **Mass-assignment whitelists**: `signup` takes only name/email/password/confirmPassword; product updates use `PRODUCT_EDITABLE_FIELDS`.
- **Soft delete** hides removed records from all `find*` queries.
- **CORS**: credentials-enabled, origin from `CORS_ORIGIN` (default `http://localhost:3000`).
- **Error handling**: production error responses never leak stack traces.
- **Fail-fast startup**: server exits if MongoDB can't be reached (3 retries) instead of running half-dead.

## 2. Security Gaps / Weaknesses (ranked)

1. **Purchase cancel doesn't reverse stock** — received stock stays after cancellation (business-logic gap, not a security hole per se).
2. **JWT secret/env exposure** — `config.env` contains production secrets (`BREVO_API_KEY`, `DB_PASSWORD`, `JWT_*`); it is git-ignored. Ensure real deployments inject env vars from a secret manager instead.
3. **Refresh-token reuse not audited** — rotation + hashed storage are implemented; an audit trail for suspicious token reuse is not (nice-to-have hardening).
4. **CORS origin defaults to localhost:3000** — must be set to the production frontend origin via `CORS_ORIGIN` before deployment.
5. **No input length/format limits on most text fields** beyond Mongoose types.
6. **Redis keys are not namespaced per environment** — a shared Redis across dev/prod could mix cache/rate-limit keys.

## 3. Secrets Management

- All secrets in `config.env` (dotenv-loaded): `DB_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `MAILTRAP_*`, `BREVO_API_KEY`, `EMAIL_FROM`, `GOOGLE_CLIENT_ID`.
- Production DB string is built by string-replacing `<db_password>` with `DB_PASSWORD`.
- `server.js` loads env with `dotenv.config({ path: path.join(__dirname, "config.env") })` BEFORE requiring `app.js` (so module-level env reads, e.g. cookie TTLs, are correct).
- Recommended: switch to env-provided vars / secret manager; never commit real secrets.
- `.gitignore` contains `config.env`, `package-lock.json`, `node_modules`.

## 4. Production Deployment Notes

- `trust proxy` is configured from `TRUST_PROXY` (number of trusted proxies). Set it correctly when behind a reverse proxy (Heroku/Railway/Nginx) so rate limiting & `req.ip` are accurate.
- Start command: `npm start` now runs `NODE_ENV=production node server.js` (no nodemon). For real prod prefer a process manager (systemd/PM2/Docker).
- `NODE_ENV=development` → Mailtrap SMTP; anything else → Brevo REST API. Ensure `BREVO_API_KEY` is set or activation/reset flows return 500 (Brevo errors are re-thrown).
- Cookies: `secure` requires actual TLS. If you terminate TLS at a proxy, `trust proxy` must include that proxy so `x-forwarded-proto` is honored.
- Run `npm run seed` once (in the target DB's NODE_ENV) to bootstrap the 12 permissions + Admin/Manager/Staff roles before allowing signups.
