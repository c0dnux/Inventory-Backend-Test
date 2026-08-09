# Authentication, Authorization & RBAC

## 1. JWT Flow
- **Signup** (`signup`): creates User with `active: false`, generates 6-digit confirmation token (sha256-hashed, stored as `confirmToken`, 10-min expiry), sends welcome email containing token, returns message "check your email to activate".
- **Activate** (`activateAccount`): hashes submitted token, matches `confirmToken` + unexpired `confirmTokenExpires`, sets `active: true`, returns JWT via `signTokenHandler`.
- **Signin** (`signin`): requires `email` + `password`; checks active flag, verifies bcrypt password; logs audit `login`; returns JWT.
- **Access token payload**: `{ id: user._id }` signed with `JWT_SECRET`, expires per `JWT_ACCESS_EXPIRES_IN` (default `15m`).
- **Refresh token payload**: `{ id, tokenId }` signed with `JWT_REFRESH_SECRET` (falls back to `JWT_SECRET`), expires per `JWT_REFRESH_EXPIRES_IN` (default `7d`).
- **Token delivery**: access token in JSON body `{ token }` AND httpOnly cookie `jwt`; refresh token in httpOnly cookie `jwt_refresh` (scoped to `path=/api/v1/auth`, `secure` in prod, `sameSite: "Strict"`). Both also returned in the JSON body.
- **Refresh-token storage**: SHA-256 hash of each refresh token stored on the user document (`refreshTokens: [{ tokenHash, expiresAt }]`, `select: false`, max 5 active sessions). Enables revocation + rotation.
- **`POST /api/v1/auth/refresh`** (`refreshAccessToken`): reads `jwt_refresh` cookie (or `body.refreshToken`), verifies signature, checks the hash exists on the user, then **rotates** — revokes the old token and issues a fresh pair. Protected by a dedicated `refreshLimiter`.
- **Logout** (`logout`): verifies + revokes the presented refresh token (removes its hash), clears both cookies.

## 2. `protect` Middleware (`user_controllers.js`)
Order of checks:
1. Extract token: `Authorization: Bearer <token>` header, else `req.cookies.jwt`.
2. If missing → `AppError("Please Login to get Access", 401)`.
3. Verify JWT with `promisify(jwt.verify)` against `JWT_SECRET`.
4. `User.findById(decoded.id)` populated with `role` → nested `permissions`.
5. If user doesn't exist → 401.
6. If user is not `active` → 401 (deactivated accounts are rejected).
7. If `passwordChangedAfter(decoded.iat)` → 401 ("login again").
8. Attach `req.user` and `res.locals.user`.

## 3. `authorize(resource, action)` middleware
Checks `user.role.permissions.some(p => p.resource === resource && p.action === action)`.
- Denies with `next(new AppError(..., 403))` (consistent with global error handler).
- **Now enforced on all resource routes** — see each route file. Pattern: `router.use(userController.protect)` then per-handler `userController.authorize("products", "create")`.
- Roles (`roles:manage`) and Permissions (`permissions:manage`) routes are Admin-only; categories/units are protect-only.
- To seed the 12 matrix permissions + assign them to Admin/Manager/Staff: `npm run seed` (uses local DB unless `NODE_ENV=production`).

## 4. `restrictTo(...roles)`
Compares `req.user.role` (an ObjectId) against string roles — **broken**: role is an ObjectId reference, not a string, so `roles.includes(req.user.role)` will always be false. Unused in routes.

## 5. `isLoggedIn` (render-only)
Reads `req.cookies.jwt`, verifies, attaches `res.locals.user`. Catches all errors and just calls `next()` (non-blocking). Not used anywhere currently.

## 6. RBAC Data Model
- **Permission**: `{ resource, action }` where action ∈ `create|read|update|delete|manage|cancel|adjust`.
- **Role**: `{ name: Admin|Manager|Staff, permissions: [PermissionIds] }`.
- **User**: `{ role: ObjectId → Role }`.
- Permission check flow: `protect` populates user.role → role.permissions → match resource+action.
- Permission matrix enforced (Admin/Manager/Staff):
  - products:create A/M, products:read A/M/S, products:update A/M, products:delete A
  - purchases:create A/M, purchases:cancel A, stock:adjust A/M
  - suppliers:manage A/M, users:manage A, permissions:manage A, roles:manage A, audits:read A/M
  - Read-only routes w/o a permission (purchases reads, movements, notifications, categories, units, my-* endpoints): protect-only.

## 7. Roles Enum & Defaults
Only `Admin`, `Manager`, `Staff` allowed by schema enum. `npm run seed` (seeds/seed_permissions.js) idempotently creates all 12 matrix permissions and assigns them to the three roles; run it once to bootstrap before creating users.

## 8. Password Management
- **forgetPassword**: finds user, generates confirm token (reuses `confirmTokenGen`), saves, returns token in response (email send commented out). Returns 200 "Token sent to email".
- **resetPassword**: token from `req.body.token || req.params.token`, requires `password === confirmPassword`, hashes token, sets new password, clears token fields **and revokes all refresh tokens**, audit `update`, issues JWT.
- **updatePassword** (logged-in): requires `currentPassword` correct, sets `newPassword` + `confirmNewPassword`, re-hashes via pre-save hook, **revokes all refresh tokens** (all sessions invalidated), issues JWT.

## 9. Logout
Verifies and revokes the presented refresh token (`jwt_refresh` cookie or `body.refreshToken`), then clears both `jwt` and `jwt_refresh` cookies. Does not require `protect` — the route is public and uses the refresh token itself to revoke the session.
