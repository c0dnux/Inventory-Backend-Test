# API Routes & Endpoints

Base URL: `/api/v1`
All protected routes use `userController.protect` (JWT Bearer token OR `jwt` cookie).

**Note**: All resource routes require a valid JWT (`protect`). The `authorize(resource, action)` middleware is applied per-handler per the role/permission matrix; routes without a matrix permission (purchases reads, movements, notifications, categories, units, `my-*` endpoints) are protect-only. Roles & Permissions routes require `roles:manage` / `permissions:manage` (Admin).

## Authentication — `/api/v1/auth` (`user_routes.js`)
| Method | Path | Handler | Auth |
|---|---|---|---|
| POST | /signup | signup | public |
| POST | /activate | activateAccount | public |
| POST | /login | signin | public |
| POST | /forget-password | forgetPassword | public |
| POST | /reset-password | resetPassword | public |
| POST | /logout | logout | public (uses `req.user` — **will fail without protect**) |
| POST | /profile | protect, profile | **protected** |

## Products — `/api/v1/products` (`product_routes.js`)
| Method | Path | Handler | Auth |
|---|---|---|---|
| POST | /create | createProduct | protect + products:create |
| GET | / | getAllProducts | protect + products:read |
| GET | /:id | getProductById | protect + products:read |
| PUT | /:id | updateProduct | protect + products:update |
| DELETE | /:id | deleteProduct | protect + products:delete |

**Unused**: `getInventoryDashboard` (controller exists, no route).

## Purchases — `/api/v1/purchases` (`purchase_routes.js`)
| Method | Path | Handler | Auth |
|---|---|---|---|
| POST | /make | makePurchaseOrder | protect + purchases:create |
| GET | / | getAllPurchases | protect |
| GET | /:id | getPurchaseById | protect |
| POST | /my-purchases | myPurchases | protect |
| POST | /receive | receivePurchaseOrder | protect + purchases:create |
| POST | /cancel | cancelPurchase | protect + purchases:cancel |

## Suppliers — `/api/v1/suppliers` (`supplier_routes.js`)
| Method | Path | Handler | Auth |
|---|---|---|---|
| POST | /create | createSupplier | protect + suppliers:manage |
| GET | / | getAllSuppliers | protect + suppliers:manage |
| GET | /:id | getSupplierById | protect + suppliers:manage |
| PUT | /:id | updateSupplier | protect + suppliers:manage |
| DELETE | /:id | deleteSupplier | protect + suppliers:manage |

## Adjustments — `/api/v1/adjustments` (`stock_adjustment_routes.js`)
| Method | Path | Handler | Auth |
|---|---|---|---|
| POST | /adjust | adjustStock | protect + stock:adjust |
| GET | / | getAllAdjustments | protect |
| POST | /my-adjustments | myAdjustments | protect |
| GET | /:id | getAdjustment | protect |

## Movements — `/api/v1/movements` (`stock_movement_routes.js`)
| Method | Path | Handler | Auth |
|---|---|---|---|
| GET | / | getAllMovements | protect |
| POST | /my_movements | myMovements | protect |
| GET | /:id | getMovement | protect |

## Notifications — `/api/v1/notifications` (`notifications_routes.js`)
| Method | Path | Handler | Auth |
|---|---|---|---|
| GET | / | getAllNotifications | protect |
| POST | /read | markAsRead | protect |
| POST | /all-read | markAllAsRead | protect |
| POST | /my-noti | myNotifications | protect |
| GET | /:id | getNotification | protect |

## Audits — `/api/v1/audits` (`audit_routes.js`)
| Method | Path | Handler | Auth |
|---|---|---|---|
| GET | / | getAllAudits | protect + audits:read |
| GET | /:id | getAudit | protect + audits:read |
| POST | /my-audits | myAudits | protect |

## Categories — `/api/v1/categories` (`category_routes.js`)
| Method | Path | Handler | Auth |
|---|---|---|---|
| POST | /create | createCategory | **protect** |
| GET | / | getAllCategories | **protect** |
| GET | /:id | getCategoryById | **protect** |
| PUT | /:id | updateCategory | **protect** |
| DELETE | /:id | deleteCategory | **protect** |

## Units — `/api/v1/units` (`unit_routes.js`)
| Method | Path | Handler | Auth |
|---|---|---|---|
| POST | /create | createUnit | **protect** |
| GET | / | getAllUnits | **protect** |
| GET | /:id | getUnitById | **protect** |
| PUT | /:id | updateUnit | **protect** |
| DELETE | /:id | deleteUnit | **protect** |

## Permissions — `/api/v1/permissions` (`permission_routes.js`)
| Method | Path | Handler | Auth |
|---|---|---|---|
| POST | /add-permission | createPermission | **protect + permissions:manage** |
| GET | / | getAllPermissions | **protect + permissions:manage** |
| GET | /:id | getPermission | **protect + permissions:manage** |
| PUT | /:id | updatePermission | **protect + permissions:manage** |
| DELETE | /:id | deletePermission | **protect + permissions:manage** |

## Roles — `/api/v1/roles` (`role_routes.js`)
| Method | Path | Handler | Auth |
|---|---|---|---|
| POST | /create | createRole | **protect + roles:manage** |
| GET | / | getAllRoles | **protect + roles:manage** |
| GET | /:id | getRoleById | **protect + roles:manage** |
| PUT | /:id | updateRole | **protect + roles:manage** |
| DELETE | /:id | deleteRole | **protect + roles:manage** |

## Root
- `GET /` → `{ status: "success", message: "Inventory API is running" }` (health check)

## Query String API (APIFeatures)
Applies to all list endpoints: `?page=`, `?limit=` (default 50), `?sort=field,-field`, `?fields=a,b,c`, and Mongo operators `gte|gt|lte|lt`.
Example: `GET /api/v1/products?category=xyz&sort=-createdAt&page=2&limit=20`
