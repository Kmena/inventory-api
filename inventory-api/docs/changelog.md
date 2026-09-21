# Changelog

## [Unreleased]

### Added — inventory-requests specification (2026-10-29)

#### Backend
- `prisma/migrations/20261029000000_add_inventory_requests/migration.sql`: Creates
  `inventory_requests` table with 22 columns, 7 FK constraints (idempotent DO-blocks),
  3 indexes, and permission backfill for `inventory.requests.execute`.
- `prisma/schema.prisma`: Added `InventoryRequest` model with inverse relations on
  `Company`, `Lot`, `Product`, `Warehouse` (×2), and `User` (×2). Prisma client regenerated.
- `src/schemas/inventory.schema.js`: Added 5 Zod schemas:
  `createInventoryRequestSchema` (with superRefine for TRANSFER cross-field validation),
  `executeAdjustmentRequestSchema`, `executeTransferRequestSchema`,
  `pickupTransferRequestSchema`, `cancelInventoryRequestSchema`.
- `src/repositories/inventory-requests.repository.js`: New repository with
  `createRequest`, `findRequestById`, `findAllRequests`, `updateRequestStatus`,
  `findMaxTransferSuffixForLot`.
- `src/services/inventory-requests.service.js`: New service implementing full request
  lifecycle. ADJUSTMENT execute calls `adjustStock`. TRANSFER execute supports partial
  transfers with child-lot creation (suffix `-T001`, `-T002`, …). BigInt serialization
  via `serializeRequest`.
- `src/routes/inventory.routes.js`: 6 new routes under `/api/inventory/requests`:
  `POST /`, `GET /`, `GET /:id`, `POST /:id/cancel`, `POST /:id/pickup`, `POST /:id/execute`.
- `src/security/access-policy-registry.js`: 4 new policies:
  `inventory.requests.create`, `inventory.requests.list`, `inventory.requests.cancel`,
  `inventory.requests.execute`.
- `src/security/permission-governance.config.js`: `inventory.requests.execute` added to
  `PERMISSION_METADATA` (scope: tenant, sensitivity: operational).

#### Root SPA (admin)
- `src/public/root/views/products-admin.renderers.js`: Button "Registrar inventario inicial"
  is now hidden when `quantity > 0 || reservedQuantity > 0` (FR-001, AC-001, AC-002).
- `src/public/root/inventory-api.js`: Added `createInventoryRequest`, `listInventoryRequests`,
  `cancelInventoryRequest`, `listWarehouses`.
- `src/public/root/views/inventory-admin.helpers.js`: `normalizeTab` now accepts `'requests'`
  as a valid tab.
- `src/public/root/views/inventory-admin.renderers.js`: 
  - `renderTabs(activeTab, options)` now accepts `options.canManage` to conditionally
    render the 4th "Solicitudes" tab.
  - `renderStockTable`: removed direct adjust/transfer buttons; added "→ Ver lotes" link.
  - `renderLotsTable`: added "Acciones" column with `data-request-adjust` and
    `data-request-transfer` buttons.
  - Added: `renderRequestAdjustmentModal`, `renderRequestTransferModal`, `renderRequestsTable`.
- `src/public/root/views/inventory-admin.js`: New click/submit handlers for
  `[data-request-adjust]`, `[data-request-transfer]`, `inventory-request-adjustment-form`,
  `inventory-request-transfer-form`. "Solicitudes" tab loads `listInventoryRequests`.
  `sessionAdapter` used to derive `canManage` for tab visibility.

#### Warehouse SPA (operator)
- `src/public/warehouse/api/warehouse-api.js`: Added `listInventoryRequests`,
  `getInventoryRequest`, `pickupInventoryRequest`, `executeInventoryRequest`.
- `src/public/warehouse/views/inventory-requests.js`: New view for operators. Renders
  list of PENDING/IN_PROGRESS requests; detail view with type-specific forms for pickup
  and execute. XSS-safe via `esc()` helper.
- `src/public/warehouse/app.js`: Added `'inventory-requests': 'views.inventoryRequests'`
  to `VIEW_MODULE_KEYS`; TAB entry guarded by `inventory.requests.execute`; `VIEW_LABELS`
  entry `'Solicitudes de inventario'`.
- `src/public/warehouse/index.html`: Added `<script src="views/inventory-requests.js">`.

#### Tests
- `tests/inventory-requests-migration.test.js`: 14 tests verifying SQL structure.
- `tests/inventory-requests-schema.test.js`: 16 tests covering all 5 Zod schemas.
- `tests/inventory-requests-service.test.js`: 16 tests covering service business logic
  and tenant isolation.
- `tests/inventory-requests-ui.test.js`: 34 tests covering all frontend artifacts.
- `tests/products-view-characterization.test.js`: Updated existing test + 1 new test.
