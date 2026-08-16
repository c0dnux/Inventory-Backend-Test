# Authentication, Authorization & RBAC

## 1. JWT Flow

- **Signup** (`signup`): only accepts `name, email, password, confirmPassword` (mass-assignment safe). **Always assigns the `Staff` role** (creates a bare `Staff` role if none exists) — a user can never self-assign a privileged role. Creates User with `active: false`, generates 6-digit confirmation token (sha256-hashed, stored as `confirmToken`, 10-min expiry), sends welcome email containing the token, returns 201 "check your email to activate". Re-signup of an inactive account only re-issues the activation token (never overwrites password/role).
- **Activate** (`activateAccount`): hashes submitted token, matches `confirmToken` + unexpired `confirmTokenExpires`, sets `active: true`, returns JWT via `signTokenHandler`.
- **Signin** (`signin`): requires `email` + `password`; checks active flag, verifies bcrypt password; **both unknown email and wrong password return 401** (`"Incorrect email or password."` — anti-enumeration). Logs audit `login`; returns JWT. If the account is Google-linked with no local password → friendly error pointing to Google login (or reset-password).
- **Google Signin** (`googleSignin`, `POST /api/v1/auth/google`): frontend sends a Google ID token (`body.credential` or `body.idToken`); backend verifies signature + `aud` with `google-auth-library` using `GOOGLE_CLIENT_ID` (no secret needed). Requires `payload.email_verified`. **Find-or-create by verified email**: no user → creates one (Staff role, `active: true`, `authProviders: [{provider:'google', providerId: sub}]`; fails with 500 if roles aren't seeded); existing local user → links Google (`addProvider`) and activates; existing user with a _different_ `providerId` → 401. Logs audit `login`, returns JWT. Email/password `signup` rejects existing active accounts (409, generic message).
- **Access token payload**: `{ id: user._id }` signed with `JWT_SECRET`, expires per `JWT_ACCESS_EXPIRES_IN` (default `15m`).
- **Refresh token payload**: `{ id, tokenId }` signed with `JWT_REFRESH_SECRET` (falls back to `JWT_SECRET`), expires per `JWT_REFRESH_EXPIRES_IN` (default `7d`).
- **Token delivery**: access token in JSON body `{ token }` AND httpOnly cookie `jwt`; refresh token in httpOnly cookie `jwt_refresh` (scoped to `path=/api/v1/auth`, `sameSite: "Strict"`). **`secure` is only set in production AND when the request actually arrived over TLS** (`isRequestSecure`: `req.secure` or `x-forwarded-proto: https`) — otherwise the browser silently drops the cookie and refresh breaks on plain-HTTP prod/staging. Both also returned in the JSON body.
- **Refresh-token storage**: SHA-256 hash of each refresh token stored on the user document (`refreshTokens: [{ tokenHash, expiresAt }]`, `select: false`, max 5 active sessions, expired hashes pruned on add). Enables revocation + rotation.
- **`POST /api/v1/auth/refresh`** (`refreshAccessToken`): reads `jwt_refresh` cookie (or `body.refreshToken`), verifies signature, checks the hash exists on the user, then **rotates** — revokes the old token and issues a fresh pair. Protected by a dedicated `refreshLimiter` (60/15min).
- **Logout** (`logout`): verifies + revokes the presented refresh token (removes its hash), clears both cookies, returns 200 — safe to call without `protect`; invalid/expired refresh tokens are swallowed.

## 2. `protect` Middleware (`user_controllers.js`)

Order of checks:

1. Extract token: `Authorization: Bearer <token>` header, else `req.cookies.jwt`.
2. If missing → `AppError("Please Login to get Access", 401)`.
3. Verify JWT with `promisify(jwt.verify)` against `JWT_SECRET`.
4. `User.findById(decoded.id)` (select `+active`) populated with `role` → nested `permissions`.
5. If user doesn't exist → 401.
6. If user is not `active` → 401 (deactivated accounts are rejected).
7. If `passwordChangedAfter(decoded.iat)` → 401 ("login again").
8. Attach `req.user` and `res.locals.user`.

## 3. `authorize(resource, action)` middleware (`middleware/authorize.js`)

Checks `user.role.permissions.some(p => p.resource === resource && p.action === action)`.

- Denies with `next(new AppError("You do not have permission to perform this action", 403))`.
- **Enforced on all resource routes** via per-handler `authorize("resource", "action")` (see route files). Roles (`roles:manage`) and Permissions (`permissions:manage`) routes are Admin-only; categories/units and all read/`my-*` endpoints are protect-only.
- To seed the 12 matrix permissions + assign them to Admin/Manager/Staff: `npm run seed` (uses local DB unless `NODE_ENV=production`).

## 4. RBAC Data Model

- **Permission**: `{ resource, action }` where action ∈ `create|read|update|delete|manage|cancel|adjust`.
- **Role**: `{ name: Admin|Manager|Staff, permissions: [PermissionIds] }`.
- **User**: `{ role: ObjectId → Role }`.
- Permission check flow: `protect` populates user.role → role.permissions → match resource+action.
- Permission matrix enforced (Admin/Manager/Staff):
  - products:create A/M, products:read A/M/S, products:update A/M, products:delete A
  - purchases:create A/M, purchases:cancel A, stock:adjust A/M
  - suppliers:manage A/M, users:manage A, permissions:manage A, roles:manage A, audits:read A/M
  - Read-only routes w/o a permission (purchases reads, movements, notifications, categories, units, my-* endpoints): protect-only.

## 5. Roles Enum & Defaults

Only `Admin`, `Manager`, `Staff` allowed by schema enum. `npm run seed` (seeds/seed_permissions.js) idempotently creates all 12 matrix permissions and assigns them to the three roles; run it once to bootstrap before creating users.

## 6. Password Management

- **forgetPassword**: anti-enumeration — always returns 200 "Token sent to email" (even for unknown emails, but only emails are actually sent to existing accounts). Generates confirm token via `confirmTokenGen`, saves, sends `PasswordReset` email with the 6-digit token. If the email send throws, the token is cleared and a 500 is returned.
- **resetPassword**: token from `req.body.token || req.params.token`, requires `password === confirmPassword`, hashes token, sets new password, clears token fields **and revokes all refresh tokens**, audit `update`, issues JWT.
- **updatePassword** (logged-in, `POST /auth/update-password`): requires `currentPassword` correct, sets `newPassword` + `confirmNewPassword`, re-hashes via pre-save hook, **revokes all refresh tokens** (all sessions invalidated), issues JWT.

## 7. Logout

Verifies and revokes the presented refresh token (`jwt_refresh` cookie or `body.refreshToken`), then clears both `jwt` and `jwt_refresh` cookies. Does not require `protect` — the route is public and uses the refresh token itself to revoke the session.
