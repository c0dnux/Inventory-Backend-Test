# Database & Mongoose Schemas

All models use MongoDB via Mongoose. Every mutable entity (except AuditLog & StockMovement) implements **soft delete** via a `deletedAt` field + a query middleware that excludes `deletedAt: null` records.

## 1. Soft-Delete Convention (shared pattern)

```js
deletedAt: { type: Date, default: null }
schema.pre(/^find/, function () { this.where({ deletedAt: null }); });
schema.methods.softDelete = function () { this.deletedAt = new Date(); return this.save(); };
```

Applied to: User, Permission, Role, Category, Unit, Product, Supplier, Purchase, StockAdjustment.
NOT applied to: AuditLog (immutable), StockMovement (append-only ledger).

## 2. Models

### User (`user_model.js`)
| Field | Type | Notes |
|---|---|---|
| name | String | required |
| email | String | unique, lowercase, `validator.isEmail` |
| role | ObjectId → Role | required |
| password | String | required, min 8, `select: false` |
| confirmPassword | String | required (schema only, stripped on save) |
| passwordChangedAt | Date | set on password change |
| confirmToken | String | sha256-hashed 6-digit code |
| confirmTokenExpires | String | 10 min validity |
| active | Boolean | default `false`, `select: false` — must be activated |
| refreshTokens | Array<{ tokenHash, expiresAt }> | SHA-256 hashes of active refresh tokens, `select: false`, max 5 |
| deletedAt | Date | null default |

**Hooks/methods**: `pre('save')` hashes password w/ bcrypt(12), sets `passwordChangedAt`. Methods: `isCorrectPassword`, `passwordChangedAfter`, `confirmTokenGen` (6-digit random), `hasRefreshToken`, `addRefreshToken`, `removeRefreshToken`, `revokeAllRefreshTokens`, `softDelete`.

### Permission (`permission_model.js`)
| Field | Type | Notes |
|---|---|---|
| name | String | unique, required |
| resource | String | e.g. 'products', 'purchases', 'users' |
| action | String | enum: `create`, `read`, `update`, `delete`, `manage` |
| description | String | optional |
| deletedAt | Date | — |

### Role (`role_model.js`)
| Field | Type | Notes |
|---|---|---|
| name | String | unique, enum: `Admin`, `Manager`, `Staff` |
| description | String | — |
| permissions | [ObjectId → Permission] | — |
| isActive | Boolean | default true |
| deletedAt | Date | — |

### Category (`category_model.js`)
`name` (unique, required), `description`, `isActive` (default true), `deletedAt`.

### Unit (`unit_model.js`)
`name` (unique, e.g. 'Pieces', 'Kilograms'), `abbreviation` (required, uppercase, e.g. 'pcs', 'kg'), `description`, `isActive`, `deletedAt`.

### Product (`product_model.js`)
| Field | Type | Notes |
|---|---|---|
| productName | String | required |
| sku | String | unique, uppercase — AUTO-GENERATED |
| barcode | String | AUTO-GENERATED (md5 of sku) |
| category | ObjectId → Category | required |
| unit | ObjectId → Unit | required |
| costPrice | Number | min 0, required |
| sellingPrice | Number | min 0, required |
| currentStock | Number | default 0, min 0 |
| reorderLevel | Number | default 10 |
| status | String | enum: `active`, `inactive`, `discontinued` |
| deletedAt | Date | — |

**Virtuals**: `isLowStock` (`0 < currentStock <= reorderLevel`), `isOutOfStock` (`currentStock === 0`), `stockValue` (`currentStock * costPrice`).

**Indexes**: text index on `productName/sku/barcode`; single-field indexes on `category`, `status`, `currentStock`.

**`pre('save')`**: if new & no sku — populates category+unit, builds SKU:
`PRD-{categoryCode}-{unitCode}-{productCode}-{uniqueCode}` (first 3 letters of category name, unit abbreviation, initials of productName up to 3, last 6 of ObjectId).

**`post('save')`**: if `currentStock` modified → references `notificationService.sendCriticalAlert/sendWarningAlert` — **NOTE: `notificationService` is NOT defined/imported → throws ReferenceError** (see Known Issues).

### Supplier (`supplier_model.js`)
`name` (required), `contactPerson`, `email` (validated), `phone` (regex `^\+?[1-9]\d{1,14}$`), nested `address {street, city, state, country, zipCode}`, `isActive`, `deletedAt`.

### Purchase (`purchase_model.js`)
| Field | Type | Notes |
|---|---|---|
| referenceNo | String | unique, uppercase — AUTO-GENERATED `PO-YYYYMM-NNN` |
| supplier | ObjectId → Supplier | required |
| items | [purchaseItem] | validated non-empty |
| totalAmount | Number | AUTO-COMPUTED |
| status | String | enum: `pending`, `received`, `cancelled` |
| purchaseDate | Date | default now |
| note | String | — |
| createdBy | ObjectId → User | required |
| cancelledAt / cancelledBy / cancelReason | — | set on cancel |

**purchaseItem sub-schema**: `product` (ref Product, required), `quantity` (min 1), `unitCost` (min 0), `totalCost` (min 0).

**`pre('validate')`**: computes `item.totalCost = quantity * unitCost` and `totalAmount = Σ totalCost`.

### StockAdjustment (`stock_adjustment_model.js`)
`product` (ref, required), `type` (enum: `stock_in`, `stock_out`, `adjustment`), `quantity` (min 1), `adjustedQuantity`, `variance` (can be negative), `reason` (required), `note`, `createdBy` (ref User, required), `deletedAt`. Indexes: `{product, createdAt:-1}`, `{type:1}`.

### StockMovement (`stock_movement_model.js`)
Immutable ledger. `product` (ref, required), `type` (enum: `purchase_in`, `purchase_cancel`, `stock_in`, `stock_out`, `adjustment_in`, `adjustment_out`, `adjustment`), `quantity` (signed), `quantityBefore`, `quantityAfter`, `referenceId`, `referenceType` (enum: `Purchase`, `StockAdjustment`, null), `note`, `createdBy` (ref User, required). Indexes: `{product, createdAt:-1}`, `{type:1}`, `{referenceId, referenceType}`.

### Notification (`notification_model.js`)
`user` (ref, required), `type` (enum: `low_stock`, `out_of_stock`, `purchase_received`, `purchase_cancelled`, `system`), `title`, `message`, `referenceId`, `referenceType` (enum: `Product`, `Purchase`, null), `isRead` (default false), `readAt`. **`pre('insertMany')`** logs "Send Email" — email sending is currently commented out (placeholder). Index: `{user, isRead, createdAt:-1}`.

### AuditLog (`audit_log_model.js`)
Immutable. `user` (ref, required), `action` (enum: `create`, `update`, `delete`, `login`, `logout`, `purchase_create`, `purchase_cancel`, `stock_in`, `stock_out`, `stock_adjustment`), `resource` (string), `resourceId`, `changes {before, after}` (Mixed), `ipAddress`, `userAgent`, `note`. Indexes: `{user, createdAt:-1}`, `{resource, resourceId}`, `{action}`, `{createdAt:-1}`.

## 3. Database Selection Logic (`server.js`)
```js
const DB = process.env.NODE_ENV === "development" ? DB_LOCAL : DB_ONLINE;
```
`DB_ONLINE_COMPASS` is derived by replacing `<db_password>` with `DB_PASSWORD`.
