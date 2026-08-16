# Project Overview: Inventory Backend

## 1. Core Metadata

- **Project Name**: Inventory Backend
- **Type**: RESTful API / Backend Service
- **Runtime**: Node.js (CommonJS modules)
- **Framework**: Express.js (`v5.2.1`)
- **Database**: MongoDB with Mongoose ORM (`v9.7.1`)
- **Main Entry Points**: `server.js` (Server setup & MongoDB connection), `app.js` (Express configuration, middleware pipeline & routing setup)
- **Author**: Abdulrahman Mustapha

## 2. Directory Structure

```text
Inventory Backend/
├── server.js                     # Entry point: DB connection, server listener, process error handlers
├── app.js                        # Express app setup, middleware, security, route mount points
├── package.json                  # Dependencies and scripts
├── config.env                    # Environment configuration (secrets & ports)
├── controllers/                  # Route handlers and business logic
│   ├── audit_controllers.js      # Audit logging handlers & maker
│   ├── category_controllers.js   # Product category CRUD operations
│   ├── error_controller.js       # Global error handling middleware
│   ├── notification_controllers.js # Notification triggers & handlers
│   ├── permission_controllers.js # Permission CRUD operations
│   ├── product_controllers.js    # Product CRUD & inventory dashboard aggregation
│   ├── purchase_controllers.js   # Purchase order workflows (make, receive, cancel)
│   ├── role_controllers.js       # Role management (Admin, Manager, Staff)
│   ├── stock_adjustment_controllers.js # Manual stock adjustments
│   ├── stock_movement_controllers.js # Historical movement logging
│   ├── supplier_controllers.js   # Supplier profile CRUD
│   ├── unit_controllers.js       # Measurement units CRUD (kg, pcs, etc.)
│   └── user_controllers.js       # Auth, user management, activation, password reset
├── models/                       # Mongoose Schemas and Models
│   ├── audit_log_model.js        # Audit log entries
│   ├── category_model.js         # Product category schema
│   ├── notification_model.js     # User notification schema
│   ├── permission_model.js       # Granular permissions schema
│   ├── product_model.js          # Product schema with stock virtuals & hooks
│   ├── purchase_model.js         # Purchase orders & item details
│   ├── role_model.js             # RBAC role schema
│   ├── stock_adjustment_model.js # Stock adjustment records
│   ├── stock_movement_model.js   # Polymorphic stock movement log
│   ├── supplier_model.js         # Supplier contact info schema
│   ├── unit_model.js             # Unit of measurement schema
│   └── user_model.js             # User account & auth schema
├── routes/                       # Express Router modules
│   ├── audit_routes.js           # /api/v1/audits
│   ├── category_routes.js        # /api/v1/categories
│   ├── notifications_routes.js   # /api/v1/notifications
│   ├── permission_routes.js     # /api/v1/permissions
│   ├── product_routes.js         # /api/v1/products
│   ├── purchase_routes.js        # /api/v1/purchases
│   ├── role_routes.js            # /api/v1/roles
│   ├── stock_adjustment_routes.js# /api/v1/adjustments
│   ├── stock_movement_routes.js  # /api/v1/movements
│   ├── supplier_routes.js        # /api/v1/suppliers
│   ├── unit_routes.js            # /api/v1/units
│   └── user_routes.js            # /api/v1/auth
├── utils/                        # Utility functions and helper classes
│   ├── app_error.js              # Operational error class (AppError)
│   ├── cache_middleware.js       # Redis caching middleware (cache + clearCache)
│   ├── catch_async.js            # Async function error wrapper
│   ├── custom_funcs.js           # JWT issue/refresh, cookie helpers, PO ref generator
│   ├── email_brevo.js            # Email transport (Brevo in prod / Mailtrap in dev)
│   ├── query_options.js          # APIFeatures (filter incl. search, sort, limit, paginate, count)
│   ├── rate_limit_store.js       # GracefulRedisStore (Redis w/ in-memory fallback)
│   ├── rate_limiters.js          # authLimiter & refreshLimiter factories
│   ├── redis.js                  # Redis client singleton & getJSON/setJSON/deleteKeys helpers
│   └── swagger.js                # Swagger JSDoc API documentation config
└── views/                        # Email templates + error view
    ├── error.pug
    └── email/
        ├── welcome.html
        ├── PasswordReset.html
        ├── stockStatus.html
        └── purchaseUpdate.html
```

## 3. Key Dependencies

- **Core Web/API**: `express`, `cors`, `cookie-parser`, `morgan`
- **Caching**: `redis` (node-redis, lazy client, fails-open when unavailable)
- **Database**: `mongoose`
- **Authentication & Security**: `bcrypt`, `jsonwebtoken`, `helmet`, `express-rate-limit`, `express-mongo-sanitize`, `sanitize-html`, `hpp`, `validator`, `google-auth-library` (Google OAuth ID-token verification)
- **Email & Communications**: `nodemailer`, `axios` (Brevo API), `html-to-text`
- **Documentation**: `swagger-jsdoc`, `swagger-ui-express`
- **Environment Handling**: `dotenv`, `cross-env`

## 4. Environment Variables Required (`config.env`)

- `NODE_ENV`: Environment mode (`development` | `production`) — anything other than `development` is treated as production
- `PORT`: Server port (default: 3000)
- `REDIS_URL`: Redis connection string (optional, default `redis://127.0.0.1:6379`)
- `DB_LOCAL`: Local MongoDB connection string (used in development)
- `DB_ONLINE_COMPASS`: Remote MongoDB connection string with `<db_password>` placeholder (used in production)
- `DB_PASSWORD`: Password for remote MongoDB connection string
- `JWT_SECRET`: Secret key for signing access tokens
- `JWT_ACCESS_EXPIRES_IN`: Access-token TTL (default `15m`)
- `JWT_REFRESH_SECRET`: Refresh-token secret (falls back to `JWT_SECRET`)
- `JWT_REFRESH_EXPIRES_IN`: Refresh-token TTL (default `7d`)
- `JWT_ACCESS_COOKIE_EXPIRES_IN`: `jwt` cookie TTL in minutes (default 15)
- `JWT_REFRESH_COOKIE_EXPIRES_IN`: `jwt_refresh` cookie TTL in days (default 7)
- `GOOGLE_CLIENT_ID`: Google OAuth client ID (ID-token flow, no client secret needed)
- `CORS_ORIGIN`: Allowed frontend origin (default `http://localhost:3000`)
- `TRUST_PROXY`: Number of trusted reverse proxies for `req.ip`/rate-limit accuracy (default 0 dev, 1 prod)
- `EMAIL_FROM`: Sender email address
- `MAILTRAP_USER`: Mailtrap SMTP username (development)
- `MAILTRAP_PASSWORD`: Mailtrap SMTP password (development)
- `BREVO_API_KEY`: Brevo HTTP API Key (production)

> Legacy/unused in config.env: `JWT_EXPIRES_IN` and `JWT_COOKIE_EXPIRES_IN` are no longer read by the code (replaced by the `JWT_ACCESS_*`/`JWT_REFRESH_*` vars above).

## 5. npm Scripts

- `npm start`: Runs `cross-env NODE_ENV=production node server.js`
- `npm run dev` / `npm run start:dev`: Runs server with `cross-env NODE_ENV=development nodemon server.js`
- `npm run start:prod`: Runs server with `cross-env NODE_ENV=production nodemon server.js`
- `npm run debug`: Debugs with `ndb server.js`
- `npm run seed`: Runs `node seeds/seed_permissions.js` (one-time bootstrap of default roles/permissions)
- `npm run migrate:indexes`: Runs `scripts/sync_indexes.js` (Task 1 — re-sync partial unique indexes after schema index changes)
- `npm test`: Runs the `node:test` suite under `tests/` (Task 13 — authorize, query_options, cache_middleware)
