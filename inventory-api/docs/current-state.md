# Current State

<!-- MAINT: per-section update log — append a row when a section is materially changed -->
| Section | Last updated | Change summary |
|---|---|---|
| All sections | Post MASTER-032 refresh | Full rewrite after Product + Inventory Master Plan (6 waves, MASTER-001 through MASTER-031) completed. 1944 pass / 3 skipped / 0 failing. Audit baseline 9.6/10. |
| §1, §4–§9, §12 | 2026-10-29 inventory-requests spec | Added InventoryRequest lifecycle (ADJUSTMENT/TRANSFER), partial-transfer child-lot creation, 6 new API endpoints, 4 new access policies, 1 new permission, new repository + service, Root admin Solicitudes tab, Warehouse SPA operator view. 2039 pass / 3 skipped / 0 failing. |

## 1. System overview
The implemented system is a **Node.js 24 + Express + Prisma modular monolith** that serves both JSON APIs and browser-delivered SPAs from a single runtime process. The primary database is PostgreSQL 16 accessed through Prisma ORM. An optional Redis instance provides browser session storage.

### Deployed capabilities
After the completed Product + Inventory Master Plan (specs `non-physical-products-mvp` and `inventory-ux-mvp`) and the subsequent `inventory-requests` spec, the system supports:

**Inventory movement requests (inventory-requests spec — 2026-10-29):**
- `InventoryRequest` model with a two-type async movement lifecycle: `ADJUSTMENT` (admin creates → operator executes) and `TRANSFER` (admin creates → operator confirms pickup → operator executes).
- Request statuses: `PENDING → IN_PROGRESS → COMPLETED` (or `PENDING → CANCELLED`).
- **Partial-transfer / child-lot creation (R-001):** When the requested quantity is less than the lot’s current total, a new child lot is automatically created with a sequential `-TNNN` suffix (e.g., `LOT-9-T001`) and the transfer executes between source lot and child lot.
- **Complete transfer:** When quantity ≥ lot total, the existing lot is used as destination at the new warehouse.
- **ADJUSTMENT execution** delegates to the existing `adjustStock` service (own transaction), then marks the request `COMPLETED` and links the result `InventoryOperation`.
- **TRANSFER execution** runs in a single Prisma `$transaction` using the internal `_executePartialTransfer` helper that calls `inventory-transaction-support.service.js` primitives directly, preserving the advisory-lock pattern.
- Admin/Root shell: new `Solicitudes` tab in Inventory workspace (visible only to `inventory.manage` holders), with `renderRequestAdjustmentModal` and `renderRequestTransferModal` modals on Lots table rows.
- Warehouse SPA: new `Solicitudes de movimiento` tab gated by `inventory.requests.execute`, with full operator workflow (list, pickup, execute dialogs).
- Duplicate-request guard: only one `PENDING` or `IN_PROGRESS` request per lot at a time.

**Product taxonomy & commercial lifecycle:**
- Product capability fields: `productNature` (GOOD/SERVICE), `controlsInventory` (boolean), `commercialBehavior` (STANDARD/ENTITLEMENT), `entitlementKind` (SUBSCRIPTION/MEMBERSHIP/AFFILIATION/COURSE/SERVICE_PERIOD/null).
- Business presets derive inventory, lot strategy, warehouse, and catalog behavior from capabilities.
- Non-inventory products (services, entitlements) skip stock/lot/warehouse/dispatch enforcement.
- InvoiceItem immutable line-item snapshots per invoice with `lineKind` (PHYSICAL_GOOD/SERVICE/ENTITLEMENT).
- CustomerEntitlement commercial lifecycle: activation (automatic on FULFILLED or manual), cancellation, renewal, history.
- Entitlement activation orchestrator triggered by order FULFILLED transition.
- Per-line order behavior: approval reserves stock only for physical lines, dispatch releases/deducts only for physical lines, service/entitlement lines pass through.

**Inventory management:**
- Product inventory strategy (lotStrategy: TRACKED/SYSTEM/NONE).
- System lots: transparent persisted lots for `lotStrategy=SYSTEM` products, hidden from business UX.
- InventoryOperation model: groups stock movements with idempotency keys and operation metadata.
- Stock/Existencias, Lots/Lotes, and History/Historial query APIs with pagination, filtering, product aggregation.
- Initial inventory creation for new products at specific locations.
- Stock adjustments with audit trail.
- Atomic balanced transfers between locations with lot traceability.
- Location lifecycle: Warehouse has `locationType` (BODEGA/ALMACEN/CEDI/OTHER), `locationNature` (PHYSICAL/VIRTUAL), deactivation rules.
- `allowedWarehouseIds` enforcement: products can be restricted to specific warehouse locations.
- Inventory permissions: granular access policies for stocks, lots, movements, entries, adjustments, transfers, alerts.

**Frontend workspaces:**
- Root shell Inventory workspace with Existencias/Lotes/Historial tabs.
- Consolidated Product UX with business capability presets and inventory config.
- Ubicaciones (Locations) UX integrated into warehouses admin.
- Customer entitlement section in client detail.
- Expanded order approval, billing/invoice, and dispatch surfaces for per-line behavior.
- Warehouse SPA inventory tab with product stock aggregation.
- Agent catalog respects `controlsInventory` for availability display.

**Existing pre-master-plan capabilities (preserved):**
- Identity & Access: JWT authentication, role+permission authorization, access policies with actor scope.
- Customer/Client management: clients, stores, legal entities, classifications, documents, credit, fiscal overrides.
- Recipe management: versioned recipes with stage typing, quantity basis, process codes, approval workflow.
- Production: orders, planning, material requirements, stage execution, losses, returns, QA inspections, recolection/recovery, reconciliation.
- Procurement: purchase requests, supplier quotations, RFQ invitations, supplier selection, purchase orders, receipts.
- Sales: orders, invoices, payments, billing triggers, agent workspace, routes, visits, goals.
- Warehousing: stock tracking, lot management, QA status, expiration alerts.

### Quality baseline
- Full test suite: **2039 pass / 3 skipped / 0 failing** (95 new tests from inventory-requests spec).
- `npm run verify`: PASS (lint + typecheck + public-runtime + workflow + restore-readiness + operational-readiness + build + test).
- npm audit: 0 vulnerabilities.
- Audit baseline score: 9.6/10.
- The 3 skipped tests require optional `P2_CONSTRAINTS_DATABASE_URL` and are unrelated to active features.

## 2. Repository structure
```
inventory-api/
├── prisma/
│   ├── schema.prisma          # 88 migrations, ~1700+ lines (InventoryRequest model added)
│   ├── migrations/            # 88 applied migration directories
│   ├── seed.js                # Seed data for development
│   └── migration-instructions.md
├── src/
│   ├── app.js                 # Express application setup, route mounting, CSP, error handling
│   ├── config.js              # Environment configuration
│   ├── server.js              # HTTP server entry point
│   ├── routes/                # 30 route files (HTTP input adapters); inventory.routes.js +6 request endpoints
│   ├── services/              # 55 service files; inventory-requests.service.js added
│   ├── repositories/          # 25 repository files; inventory-requests.repository.js added
│   ├── schemas/               # 26 Zod schema files; inventory.schema.js +5 request schemas
│   ├── middlewares/            # 8 middleware files (auth, validation, throttle, metrics)
│   ├── security/              # Access policy registry (+4 policies), permission-governance (+1 permission)
│   ├── lib/                   # 19 shared utility modules
│   └── public/                # Browser SPA assets
│       ├── root/              # Root admin shell; inventory-api.js +4 calls, inventory-admin.js +handlers
│       ├── warehouse/         # Warehouse operator SPA; views/inventory-requests.js added
│       ├── agent/             # Agent field SPA
│       ├── supplier-quote/    # Public supplier quotation page
│       ├── shared/            # Shared browser utilities
│       └── vendor/            # Third-party browser libraries (Leaflet)
├── tests/                     # 229 test files (~2MB); 4 new inventory-requests test files
├── scripts/                   # Build, lint, validation scripts
├── docs/                      # Architecture, specs, audit, UI docs
├── Dockerfile                 # Multi-stage Node 24 production build
├── docker-compose.yml         # Dev compose (app + PostgreSQL + Redis)
├── docker-compose.dev.yml     # Full dev compose with volumes
├── docker-compose.prod.yml    # Production compose
└── package.json               # Dependencies, scripts, engine constraint
```

## 3. Current architecture
The system follows a **layered modular monolith** pattern within a single deployable:

```
Browser SPAs ─→ Express routes ─→ Services ─→ Repositories ─→ Prisma ─→ PostgreSQL
                                     ↓
                                Domain logic
                             (inline in services)
```

**Layer responsibilities:**
- **Routes** (input adapters): HTTP endpoint binding, authentication middleware, Zod validation, access policy enforcement, delegation to services.
- **Services** (application + domain logic): Business orchestration, transaction management, business rule enforcement, serialization. Domain logic is currently inline within services rather than in separate domain model classes.
- **Repositories** (output adapters): Prisma queries, company-scoped data access, eager loading, raw SQL for advisory locks and complex aggregations.
- **Schemas** (validation): Zod schemas for request payload validation, applied via middleware.
- **Security** (cross-cutting): Access policy registry with ~200+ policies, role-based and permission-based authorization, actor scope enforcement, audit logging.

**No formal hexagonal architecture** is implemented. The code does not have explicit port interfaces, and business rules live in service files alongside orchestration logic.

## 4. Existing domains and modules

### Identity & Access
- **Authentication:** JWT-based with `authenticate` middleware. Browser sessions via cookie + optional Redis store.
- **Authorization:** Role-based + permission-based via `access-policy-registry.js` (~200+ policies).
- **Files:** `auth.routes.js`, `auth.service.js`, `me.routes.js`, `me.service.js`, middlewares, security directory.

### Products
- **Model:** Product with capability taxonomy (`productNature`, `controlsInventory`, `commercialBehavior`, `entitlementKind`), pricing, inventory config (`lotStrategy`, `minStock`, `maxStock`), size conversion, sourcing method, presentation type, categories/subcategories.
- **Business presets:** SERVICE/SUBSCRIPTION/MEMBERSHIP/AFFILIATION/COURSE presets auto-derive inventory, lot, catalog, and commercial behavior.
- **Inventory applicability:** `controlsInventory=false` products are excluded from stock/lot/warehouse/dispatch enforcement throughout the system.
- **allowedWarehouseIds:** Products can be restricted to specific warehouse locations via `ProductAllowedWarehouse` join table.
- **Files:** `product.routes.js`, `product.service.js`, `product.repository.js`, `product.schema.js`, `product-permission-shaping.service.js`, `product-pricing.service.js`, `product-size-conversion.helper.js`.

### Inventory
- **Warehouse/Location model:** `Warehouse` with `locationType` (BODEGA/ALMACEN/CEDI/OTHER), `locationNature` (PHYSICAL/VIRTUAL), `warehouseType`, `isVirtual`, `isSellableSource`, `isActive`.
- **Stock tracking:** `WarehouseStock` (product×warehouse quantities), `WarehouseLotStock` (lot×warehouse quantities).
- **Lot management:** `Lot` with `isSystemGenerated`, `systemLotKey` for transparent system-lot strategy. Lot status (AVAILABLE/QUARANTINED/EXPIRED/BLOCKED/CONSUMED), QA status (PENDING/APPROVED/REJECTED/FAILED).
- **Stock movements:** `StockMovement` with types IN/OUT/ADJUSTMENT/RESERVE/RELEASE/TRANSFER_OUT/TRANSFER_IN. Movement group IDs for atomic operations.
- **InventoryOperation:** Groups business operations with `operationType`, `idempotencyKey`, source/destination warehouse references, metadata.
- **Inventory alerts:** Product/lot/warehouse-scoped alerts with severity and status tracking.
- **System lots:** For `lotStrategy=SYSTEM` products, lots are auto-created with `isSystemGenerated=true` and hidden from business UX. Existing lots default to `isSystemGenerated=false`.
- **Lot policy service:** FEFO/FIFO lot selection, expiration checks, lot usability derivation.
- **Transaction support service:** Advisory locks, stock/lot changes, movement creation, reservation logic, system-lot resolution, allowed-warehouse enforcement.
- **InventoryRequest lifecycle:** Async admin→warehouse movement request flow. Admin creates requests of type `ADJUSTMENT` or `TRANSFER` targeting a specific lot+warehouse. Warehouse operators pick up TRANSFER requests (marking `IN_PROGRESS`) then execute any request type. Execution: ADJUSTMENT delegates to `adjustStock`; TRANSFER uses an internal `_executePartialTransfer` helper inside a single Prisma transaction. Partial-transfer R-001: when quantity < lot total, a child lot with `-TNNN` suffix is created at the destination.
- **Files:** `inventory.routes.js`, `inventory.service.js`, `inventory.repository.js`, `inventory.schema.js`, `inventory-alerts.service.js`, `inventory-lot-policy.service.js`, `inventory-transaction-support.service.js`, `inventory-requests.service.js`, `inventory-requests.repository.js`.

### Orders & Commercial Lifecycle
- **Order model:** Multi-status lifecycle (DRAFT→APPROVED→IN_PRODUCTION→DELIVERED→FULFILLED→CANCELLED/REJECTED). Per-line approval/reservation for physical products.
- **Dispatch:** Per-line stock deduction for physical lines only. Service and entitlement lines pass through.
- **InvoiceItem model:** Immutable line-item snapshots per invoice with `lineKind` (PHYSICAL_GOOD/SERVICE/ENTITLEMENT), price/tax/discount snapshots. Generated during invoice creation from order items.
- **FULFILLED status:** Triggers entitlement activation orchestrator for entitlement order lines.
- **Files:** `order.routes.js`, `order.service.js`, `order.repository.js`, `order.schema.js`, `order-access-policy.service.js`.

### Customer Entitlements
- **CustomerEntitlement model:** Commercial lifecycle records with `entitlementKind`, `status` (ACTIVE/CANCELLED), start/end dates, activation source (AUTOMATIC/MANUAL), price/currency/validity/billing snapshots, renewal chain via `previousEntitlementId`.
- **Activation orchestrator:** On order FULFILLED, auto-creates entitlements for ENTITLEMENT product lines.
- **Manual activation:** `POST /api/entitlements/manual-activate` with dedicated permission.
- **Cancel/Renew:** Cancellation with reason, renewal creates new entitlement linked to previous.
- **Derived status:** Runtime derivation of EXPIRED from `endDate` comparison, not stored in DB.
- **Files:** `entitlement.routes.js`, `entitlement.service.js`, `entitlement.repository.js`, `entitlement.schema.js`.

### Billing & Payments
- **Invoice model:** Per-client invoices with status lifecycle (PENDING/PARTIAL/PAID/CANCELLED).
- **InvoiceItem:** Immutable snapshots created during billing trigger.
- **Payments:** Payment lifecycle with approval workflow (DRAFT→PENDING_APPROVAL→APPROVED/REJECTED/REVERSED).
- **Billing trigger service:** Calculates invoice amounts, creates invoice items from order items.
- **Files:** `invoice.routes.js`, `invoice.service.js`, `invoice.repository.js`, `payment.routes.js`, `payment.service.js`, `payment.repository.js`, `billing-trigger.service.js`, `invoice-financial-state.js`, `payment-lifecycle-support.service.js`, `payment-receipt-evidence.service.js`.

### Recipes
- **Recipe model:** Versioned recipes with stage typing (`stageType`: PROCESSING/RECOLECTION), process codes, per-stage-input quantity basis override, approval workflow (DRAFT/APPROVED).
- **Files:** `recipe.routes.js`, `recipe.service.js`, `recipe.repository.js`, `recipe.schema.js`.

### Production
- **Production orders:** Lifecycle from DRAFT through COMPLETED/CANCELLED. Recipe snapshot freezing, material requirements, stage execution, consumption/waste/loss tracking.
- **QA inspections:** Rejection handling with relevant-input scope, replacement recovery stages, lot-level recolection entries, reconciliation outcomes.
- **Files:** `production.routes.js`, `production.service.js`, `production.repository.js`, `production.schema.js`, `production-execution.service.js`, `production-planning.service.js`, `production-recolection.service.js`, `production-cancel.service.js`, `production-material-availability.service.js`, `production-stage-loss.service.js`, `production-stage-validation.service.js`, `quality.service.js`, `quality-rejection-disposition.service.js`, `quality-relevant-input-scope.service.js`.

### Procurement
- **Full procurement lifecycle:** Purchase requests → supplier quotations → RFQ invitations → supplier selection → purchase orders → purchase receipts → receipt inspection.
- **Files:** `procurement.routes.js`, `procurement.service.js`, `procurement.repository.js`, `procurement-rfq.routes.js`, `procurement-rfq.service.js`, `procurement-rfq.repository.js`, `receipt.routes.js`, `receipt.service.js`, `receipt.repository.js`, `supplier.routes.js`, `supplier.service.js`, `supplier.repository.js`.

### Sales & Field Operations
- **Agent workspace:** Territory-based sales operations, store visits, order creation, route assignments.
- **Sales routes:** Route → subzone → subregion mapping, visit frequency, goals.
- **Catalog:** Agent catalog respects `controlsInventory` for availability display, hides out-of-stock inventory products.
- **Files:** `agent.routes.js`, `agent-workspace.service.js`, `agent-workspace.repository.js`, `agent-workspace-store-state.service.js`, `sales-route.routes.js`, `sales-route.service.js`, `sales-route.repository.js`.

### Client/Customer Management
- **Models:** Client, ClientStore, ClientLegalEntity, ClientClassification, ClientContact, ClientReference, ClientDocument, ClientStoreRepresentative.
- **Store features:** Credit limits, fiscal overrides (7-field inherit-vs-override), currency, documents.
- **Files:** `client.routes.js`, `client.service.js`, `client.repository.js`, `client.schema.js`.

### Company & Configuration
- **Models:** Company, CompanyConfig, CompanyFiscalConfig, FiscalSequence.
- **Files:** `company.routes.js`, `company.service.js`, `company.repository.js`.

### External Integrations
- **Hacienda taxpayer lookup:** Costa Rica tax authority API for identification validation.
- **Geocoding:** OpenStreetMap Nominatim for address search.
- **Files:** `taxpayer.routes.js`, `taxpayer.service.js`, `geocoding.routes.js`, `geocoding.service.js`.

## 5. Main use cases

### Product lifecycle
- Create/update product with capability presets (GOOD, SERVICE, SUBSCRIPTION, MEMBERSHIP, etc.)
- Toggle `controlsInventory` with system-wide enforcement
- Configure inventory strategy (`lotStrategy`, `minStock`, `maxStock`, `allowedWarehouseIds`)
- Manage product pricing, categories, subcategories

### Inventory operations
- Register stock entries at warehouse locations
- Create initial inventory for new products
- Adjust stock with audit-trailed movements
- Transfer stock between locations (atomic balanced transfers)
- List stock (Existencias) with location/product aggregation
- List lots (Lotes) with filtering by status, QA, expiration, system-lot visibility
- List movement history (Historial) with filtering

### Inventory movement requests (inventory-requests spec)
- Admin/root user creates movement request (ADJUSTMENT or TRANSFER) targeting a lot at a warehouse
- Duplicate-request guard: only one active (PENDING/IN_PROGRESS) request per lot at a time
- Cancel PENDING requests with optional cancellation reason
- TRANSFER: warehouse operator confirms pickup (PENDING → IN_PROGRESS), records operator identity (`assignedToUserId`)
- Execute ADJUSTMENT: delegates to `adjustStock`, links resulting `InventoryOperation`
- Execute TRANSFER (complete): lot moved as-is to destination warehouse
- Execute TRANSFER (partial, R-001): child lot created with sequential `-TNNN` suffix; transfer executes between source lot and child lot; all within one Prisma transaction with advisory lock
- Admin Solicitudes tab lists all requests for the company; operator view shows pending/in-progress requests

### Order & commercial flow
- Create orders with mixed physical/service/entitlement lines
- Approve orders: reserve stock for physical lines, pass through for non-physical
- Dispatch orders: deduct stock for physical lines only
- Fulfill orders: trigger entitlement activation for entitlement lines
- Generate invoice with InvoiceItem snapshots per line

### Entitlement lifecycle
- Auto-activate entitlements on order FULFILLED
- Manually activate entitlements with reason and audit
- Cancel entitlements with reason
- Renew entitlements (creates new record linked to previous)
- List/detail entitlements with derived EXPIRED status

### Production workflow
- Plan production orders from approved recipes
- Execute stages with consumption tracking
- QA inspection with rejection and replacement recovery
- Recolection/recovery with lot-level entries and reconciliation
- Complete production orders

### Procurement workflow
- Create purchase requests → invite suppliers → evaluate quotations → create POs → receive goods → inspect quality

## 6. Current data flows

### Order approval (mixed product types)
```
Order.approve() →
  for each OrderItem:
    if product.controlsInventory:
      reserveLots() → StockMovement(RESERVE)
    else:
      skip stock operations
  → Order.status = APPROVED
```

### Dispatch (per-line)
```
Order.dispatch() →
  for each OrderItem:
    if product.controlsInventory:
      releaseLots() → StockMovement(RELEASE)
      deductStock() → StockMovement(OUT)
    else:
      skip stock operations
  → Order.status = DELIVERED
```

### Invoice creation with InvoiceItem snapshots
```
Invoice.create() →
  for each OrderItem:
    create InvoiceItem {
      lineKind: derive from product capabilities,
      descriptionSnapshot, productCodeSnapshot,
      quantity, unitPrice, discountPercent, tax snapshots
    }
```

### Entitlement activation (on FULFILLED)
```
Order.markFulfilled() →
  EntitlementActivationOrchestrator:
    for each OrderItem where product.commercialBehavior = ENTITLEMENT:
      if existing active entitlement for same product+client:
        skip (idempotent)
      else:
        create CustomerEntitlement {
          status: ACTIVE,
          activationSource: AUTOMATIC,
          startDate: now,
          endDate: derived from validity,
          price/currency/validity/billing snapshots from product
        }
```

### Stock transfer
```
POST /api/inventory/transfers →
  validate source/destination warehouses and product
  within transaction:
    create InventoryOperation (idempotency key)
    deduct source warehouse stock → StockMovement(TRANSFER_OUT)
    add destination warehouse stock → StockMovement(TRANSFER_IN)
    handle lot transfer if lot-tracked
```

### Inventory request — ADJUSTMENT execution
```
POST /api/inventory/requests/:id/execute (ADJUSTMENT) →
  load request (PENDING guard)
  delegate to inventoryService.adjustStock() → own transaction
  mark request COMPLETED, link resultOperationId
  emit audit event
```

### Inventory request — TRANSFER execution (with R-001 partial-transfer)
```
POST /api/inventory/requests/:id/pickup →
  load request (PENDING + TRANSFER guard)
  set status IN_PROGRESS, pickedUpAt, assignedToUserId

POST /api/inventory/requests/:id/execute (TRANSFER) →
  load request (IN_PROGRESS + pickedUpAt guard)
  prisma.$transaction(async tx =>>
    re-read request inside tx
    load lot
    if requestQty >= lotQty:
      destinationLotId = lot.id   // complete transfer, reuse lot
    else:
      findMaxTransferSuffixForLot() → maxSuffix
      create child lot newLotNumber = `${lot.internalLotNumber}-T${maxSuffix+1:03}`
      destinationLotId = newLot.id
    _executePartialTransfer(tx, {sourceLotId, destinationLotId, ...}):
      acquireCompanyInventoryAdvisoryLock
      create InventoryOperation (TRANSFER)
      load source/destination lot records
      changeWarehouseStock(source, -qty) / changeWarehouseStock(dest, +qty)
      changeLotStock(source, -qty) / changeLotStock(dest, +qty)
      updateLotById(source, {decrement: qty}) / updateLotById(dest, {increment: qty})
      createMovement(TRANSFER_OUT) / createMovement(TRANSFER_IN)
    mark request COMPLETED / deliveredAt / resultOperationId
  )
  emit audit event
  return serialized completed request
```

### System lot auto-creation
```
When stock entry for lotStrategy=SYSTEM product:
  getOrCreateSystemLot():
    compute systemLotKey from product+warehouse
    find existing system lot or create new one
    lot.isSystemGenerated = true
    lot hidden from business UX
```

## 7. Database and persistence

### Key models (88 migrations applied)
| Model | Table | Key fields added by Master Plan |
|---|---|---|
| Product | `products` | `productNature`, `controlsInventory`, `commercialBehavior`, `entitlementKind`, `defaultValidityCount`, `defaultValidityUnit`, `billingInterval`, `sellableKind`, `lotStrategy` |
| InvoiceItem | `invoice_items` | Full new model: `lineKind`, `descriptionSnapshot`, `productCodeSnapshot`, quantity/price/tax snapshots |
| CustomerEntitlement | `customer_entitlements` | Full new model: lifecycle, activation, renewal chain, price/validity/billing snapshots |
| InventoryOperation | `inventory_operations` | Full new model: `operationType`, `idempotencyKey`, source/destination warehouses, metadata |
| Lot | `lots` | `isSystemGenerated`, `systemLotKey` |
| Warehouse | `warehouses` | `locationType`, `locationNature` |
| StockMovement | `stock_movements` | New types: `TRANSFER_OUT`, `TRANSFER_IN` |
| Order | `orders` | `FULFILLED` status added to `OrderStatus` enum |
| ProductAllowedWarehouse | `product_allowed_warehouses` | Full new join table |
| InventoryRequest | `inventory_requests` | Full new model: `type` (ADJUSTMENT/TRANSFER), `status` (PENDING/IN_PROGRESS/COMPLETED/CANCELLED), lot/product/warehouse FKs, lifecycle timestamps, `resultOperationId`, `assignedToUserId` |

### Master Plan migrations (in chronological order)
1. `20261020000000_add_product_capability_foundation` — Product capability fields with conservative defaults
2. `20261021000000_add_order_status_fulfilled` — FULFILLED status for orders
3. `20261022000000_add_invoice_items_foundation` — InvoiceItem table and backfill from existing invoices
4. `20261023000000_add_system_lot_fields` — Lot `isSystemGenerated`, `systemLotKey` columns
5. `20261024000000_add_location_fields` — Warehouse `locationType`, `locationNature` with backfill
6. `20261025000000_add_inventory_operations` — InventoryOperation table
7. `20261026000000_add_customer_entitlements` — CustomerEntitlement table
8. `20261027000000_add_entitlement_permissions` — Entitlement permission catalog
9. `20261027000000_add_transfer_stock_movement_types` — TRANSFER_OUT/TRANSFER_IN movement types
10. `20261028000000_add_inventory_location_permissions` — Inventory and location permission catalog
11. `20261029000000_add_inventory_requests` — `inventory_requests` table, 7 idempotent FK constraints, 3 indexes, `inventory.requests.execute` permission backfill to `bodega_prueba` and `admin` roles

### Key indexes
- `products`: `[companyId, controlsInventory]`, `[companyId, commercialBehavior, entitlementKind]`
- `lots`: `[companyId, productId, isSystemGenerated]`, unique `[companyId, systemLotKey]`
- `inventory_operations`: `[companyId, operationType, createdAt]`, unique `[companyId, operationType, idempotencyKey]`
- `customer_entitlements`: `[companyId, clientId, status]`, `[companyId, productId]`, `[companyId, endDate]`
- `invoice_items`: unique `[invoiceId, orderItemId]`, `[companyId, invoiceId]`, `[productId]`
- `inventory_requests`: `[companyId, status, createdAt]`, `[companyId, type, status]`, `[lotId]`

### Database constraints and integrity
- All tables are company-scoped with cascading deletes from Company.
- InvoiceItem has unique constraint on `[invoiceId, orderItemId]` preventing duplicate snapshots.
- InventoryOperation has unique constraint on `[companyId, operationType, idempotencyKey]` for idempotency.
- CustomerEntitlement has unique constraints on source order item and source invoice item per company.
- Advisory locks used for company-scoped inventory mutations.
- Transactions enforced for all stock-changing operations.
- InventoryRequest enforces at-most-one active request per lot (checked at service layer: only one PENDING/IN_PROGRESS per lotId per company).
- InventoryRequest `destination_warehouse_id` is nullable (required for TRANSFER, omitted for ADJUSTMENT).
- InventoryRequest `quantity` is nullable DECIMAL(14,3) (required for TRANSFER, optional for ADJUSTMENT).
- Child lots created during partial transfers inherit `expirationDate`, `qaStatus`, `status`, `productionDate`, `manufacturerLotNumber`, `supplierId`, `casNumber` from parent lot; `quantity` starts at 0.

## 8. APIs and integrations

### New API endpoints (Master Plan)
| Method | Path | Purpose | Access Policy |
|---|---|---|---|
| GET | `/api/entitlements` | List company entitlements | `entitlements.view` |
| GET | `/api/entitlements/:id` | Entitlement detail | `entitlements.view` |
| POST | `/api/entitlements/manual-activate` | Manual activation | `entitlements.activate.manual` |
| POST | `/api/entitlements/:id/cancel` | Cancel entitlement | `entitlements.manage` |
| POST | `/api/entitlements/:id/renew` | Renew entitlement | `entitlements.manage` |
| GET | `/api/inventory/stocks` | Existencias (stock list) | `inventory.stocks.list` |
| GET | `/api/inventory/lots` | Lotes (lot list) | `inventory.lots.list` |
| GET | `/api/inventory/lots/:id` | Lot detail | `inventory.lots.list` |
| GET | `/api/inventory/movements` | Historial (movement list) | `inventory.movements.list` |
| POST | `/api/inventory/initial-inventory` | Create initial inventory | `inventory.initial-inventory.create` |
| POST | `/api/inventory/entries` | Register stock entry | `inventory.entries.create` |
| PATCH | `/api/inventory/lots/:id/qa` | Update lot QA status | `inventory.lot-qa.update` |
| POST | `/api/inventory/adjustments` | Adjust stock | `inventory.adjustments.create` |
| POST | `/api/inventory/transfers` | Transfer inventory | `inventory.transfers.create` |
| GET | `/api/inventory/alerts` | List inventory alerts | `inventory.alerts.list` |
| GET | `/api/inventory/alerts/:id` | Alert detail | `inventory.alerts.detail` |
| PATCH | `/api/inventory/alerts/:id/status` | Update alert status | `inventory.alerts.update-status` |
| POST | `/api/inventory/requests` | Create movement request (ADJUSTMENT/TRANSFER) | `inventory.requests.create` |
| GET | `/api/inventory/requests` | List movement requests (filterable by status/type/lot/product) | `inventory.requests.list` |
| GET | `/api/inventory/requests/:id` | Get movement request detail | `inventory.requests.list` |
| POST | `/api/inventory/requests/:id/cancel` | Cancel PENDING request | `inventory.requests.cancel` |
| POST | `/api/inventory/requests/:id/pickup` | Operator pickup for TRANSFER (PENDING → IN_PROGRESS) | `inventory.requests.execute` |
| POST | `/api/inventory/requests/:id/execute` | Execute request (ADJUSTMENT or TRANSFER → COMPLETED) | `inventory.requests.execute` |

### Existing API surfaces (30 route files total)
Auth, Company, User, Role, Client, Product, Recipe, Production, Procurement, Procurement-RFQ, Supplier, Receipt, Fiscal-Reference, Order, Invoice, Payment, Inventory, Warehouse, Region, Sales-Route, Agent, Taxpayer, Geocoding, Economic-Activity, Feedback, Me, Health, Warehouse-Orders, Public-Supplier-Quotation.

### External integrations
- **Hacienda Taxpayer Lookup:** `GET /api/taxpayer/:identification` → proxies to Costa Rica tax authority.
- **Geocoding (Nominatim):** `GET /api/geocoding/search` → OpenStreetMap address search.
- **No message queues or event buses** — all operations are synchronous request-response.

## 9. Authentication and authorization

### Authentication
- JWT tokens issued by `/api/auth/login`.
- Browser sessions via cookie with optional Redis-backed session store.
- `authenticate` middleware extracts and validates JWT from `Authorization` header or session.
- Token payload contains `sub` (userId), `companyId`, `roleId`, `role` (code).

### Authorization
- **Access Policy Registry:** `src/security/access-policy-registry.js` contains ~200+ named policies.
- **Two modes:** `role` (whitelist of role codes) and `permission` (whitelist of permission codes).
- **Actor scope:** Additional scope restrictions beyond role/permission (e.g., company-only access).
- **Denial audit:** Access policy denials are recorded as audit events.
- **Tenant isolation:** All service operations derive `companyId` from authenticated context, never from client-provided values for ownership decisions.

### Permission catalog
The permission catalog includes modules: `products`, `inventory`, `warehouses`, `orders`, `invoices`, `payments`, `clients`, `recipes`, `production`, `procurement`, `suppliers`, `receipts`, `quality`, `settings`, `roles`, `users`, `agents`, `routes`, `entitlements`, `feedback`, `billing`, and landing-gate permissions.

**New permission added by inventory-requests spec:**
- `inventory.requests.execute` — category: `inventory`, sensitivity: `operational`, scope: `tenant`. Allows warehouse operators to execute ADJUSTMENT and TRANSFER requests. Backfilled to `bodega_prueba` and `admin` roles.

**New access policies added by inventory-requests spec:**
| Policy ID | Mode | Permissions / Roles | Purpose |
|---|---|---|---|
| `inventory.requests.create` | permission | `inventory.manage` | Admin creates new movement requests |
| `inventory.requests.list` | permission | `inventory.manage` OR `inventory.view` OR `inventory.requests.execute` | Admin and operators list/view requests |
| `inventory.requests.cancel` | permission | `inventory.manage` | Admin cancels PENDING requests |
| `inventory.requests.execute` | permission | `inventory.requests.execute` | Operator picks up and executes requests |

## 10. Events and background processing
- **No event bus or message queue.** All operations are synchronous within HTTP request lifecycles.
- **Audit events:** `AuditEvent` model records security/configuration events via `recordAuditEventSafelyIfAvailable()`. Fire-and-forget pattern (does not block request).
- **Entitlement activation orchestrator:** Synchronous inline activation during order FULFILLED transition, not event-driven.
- **Billing trigger:** Synchronous invoice generation during order lifecycle transitions.

## 11. Containers and deployment

### Dockerfile
- Multi-stage build from `node:24-bookworm-slim`.
- Install OpenSSL + CA certificates.
- `npm ci` → `prisma generate` → `npm prune --omit=dev`.
- Non-root user (`inventory:inventory`).
- Health check via `GET /health/ready` on port 2500.
- CMD: `node src/server.js`.

### Docker Compose
- **Dev:** app + PostgreSQL 16 Alpine + Redis 7 Alpine. Source volumes mounted for hot reload.
- **Prod:** Same services with production env vars, no source volumes.
- Port 2500 exposed.

### CI/CD
- No CI pipeline configuration present in the repository.
- Validation is manual via `npm run verify` which runs lint + typecheck + all validations + build + test.

## 12. Current testing strategy

### Test suite composition (229 test files, 2039 tests)
- **Migration tests:** Validate schema migrations apply cleanly and constraints are correct.
- **Service unit tests:** Validate business logic in service functions with mocked Prisma.
- **Route contract tests:** Validate API endpoint contracts (status codes, response shapes, auth enforcement).
- **Characterization tests:** Capture existing behavior of complex views and workflows.
- **Governance tests:** Ensure coding standards, runtime contracts, dependency hygiene, permissions.
- **E2E tests:** Browser-level tests using Playwright for root shell, warehouse, and agent SPAs.
- **Schema tests:** Validate Zod schema behavior and Prisma schema structure.

### Key test areas for Master Plan features
- `product-capability-foundation-migration.test.js` — Product capability migration
- `product-capability-schema.test.js` — Capability validation rules
- `product-capability-serialization.test.js` — API serialization
- `invoice-items-foundation-migration.test.js` — InvoiceItem backfill
- `customer-entitlements-foundation-migration.test.js` — CustomerEntitlement schema
- `entitlement-lifecycle.service.test.js` — Entitlement CRUD
- `entitlement-activation-orchestrator.service.test.js` — Auto-activation
- `entitlement-skeleton-tenant-isolation.test.js` — Tenant isolation
- `inventory-ux-db-foundation-migration.test.js` — System lots, location fields, InventoryOperation
- `inventory-lot-policy.service.test.js` — Lot policy logic
- `inventory-transaction-support.service.test.js` — Transaction support
- `inventory-location-permissions-migration.test.js` — Inventory permissions
- `wave2-product-inventory-integration.test.js` — Product+inventory integration
- `wave3-inventory-operations.test.js` — Inventory operations
- `wave5-inventory-operations.test.js` — Adjustment and transfer operations
- `products-view.e2e.js`, `lots-view.e2e.js`, `movements-view.e2e.js` — Frontend E2E

## 13. Behavior to preserve

### Product capability boundary
- `controlsInventory=true` products enforce stock, lot, warehouse, reservation, dispatch operations.
- `controlsInventory=false` products skip all inventory enforcement, shown as "No aplica" in inventory UX.
- `commercialBehavior=ENTITLEMENT` products trigger entitlement lifecycle on FULFILLED.
- Product capability defaults preserve all existing physical products as `GOOD/true/STANDARD/null`.

### InvoiceItem immutability
- InvoiceItem snapshots are created once during invoice generation and never mutated.
- Unique constraint `[invoiceId, orderItemId]` prevents duplicate snapshots.

### System lot transparency
- System-generated lots have `isSystemGenerated=true` and are hidden from business UX.
- Existing lots backfilled as `isSystemGenerated=false`.
- System lot key computed from product+warehouse, ensuring one system lot per product per warehouse.

### Backward compatibility
- All existing products, orders, invoices, payments, stock records preserved through conservative migration defaults.
- Existing PO receipt, production, reservation, dispatch flows unchanged for physical products.
- Legacy `productType` preserved alongside new capability taxonomy.
- Agent catalog continues to filter by stock availability for inventory-controlled products.

### Transaction integrity
- All stock-changing operations are transactional with advisory locks.
- Transfer operations are atomic: source deduction and destination addition in single transaction.
- InventoryOperation idempotency key prevents duplicate operations.

## 14. Known defects
- **DEF-PRD-002:** `recolection` spelling inconsistency remains across the codebase (should be `recolección` in Spanish or `recollection` in English). This is cosmetic and does not affect functionality.
- **No active functional defects** in the implemented features based on the test suite results.

## 15. Architectural debt

### Service layer density
- Business rules and domain logic are inline within service files rather than in separate domain model classes.
- `inventory.service.js` (43.9 KB) and `product.service.js` (31.8 KB) are large files with mixed concerns.
- No formal domain entity classes, value objects, or aggregate roots.

### Missing hexagonal architecture
- No explicit port interfaces; services directly depend on Prisma repositories.
- No dependency inversion: domain logic imports infrastructure directly.
- Controllers (routes) occasionally contain minor business logic.
- ORM models are used as both persistence and domain representations.

### Frontend architecture
- Root shell views are large monolithic files (e.g., `clients-admin.js` at 51 KB, `quotations-admin.js` at 58 KB).
- Browser SPAs use a custom module registry (`RootShell.register/require`) rather than standard module bundling.
- Duplicated patterns across SPA views (file upload, dialog management, state management).

### Missing formal event system
- All operations are synchronous within HTTP request lifecycle.
- Entitlement activation orchestrator is inline rather than event-driven.
- No ability to decouple side effects from primary operations.

### Test isolation
- Some tests use shared Prisma client mocking patterns that could benefit from formal test infrastructure.
- E2E tests require specific browser setup (Playwright with Chromium).

## 16. Security risks

### Low severity
- **Sensitive file governance:** `sensitive-file-governance.js` validates storage paths but relies on filesystem permissions for enforcement.
- **Legacy nullable currency:** `ClientStore.currency` is nullable for legacy rows; browser creation now requires currency but API permits null for backward compatibility.

### Mitigations in place
- Non-root container user.
- CSP headers per SPA (root, warehouse, agent, supplier-quote).
- Tenant isolation enforced at service layer via authenticated `companyId`.
- Access policy denials are audit-logged.
- Advisory locks prevent race conditions in inventory mutations.
- Zod schema validation on all mutating endpoints.
- Bcrypt password hashing.
- Request throttling on authentication endpoints.
- 0 npm audit vulnerabilities.

## 17. Governance and operational context

### Documentation and contract governance
The canonical runtime-contract governance lives under `docs/**` — specifically `docs/openapi/runtime-baseline.openapi.json` and `docs/runtime-contract-manifest.json`. These are the authoritative source of API contract truth for the repository. The current OpenAPI baseline maintains intentionally bounded partial coverage aligned with the p34-bounded-governance-coverage-expansion posture.

The authoritative hosted workflow location for local validators/tests: `../.github/workflows/` relative to the `inventory-api/` directory. The hosted workflow tree at `../.github/workflows/**` is the source of truth; the in-tree `inventory-api/.github/workflows/**` copies are historical compatibility references only. Documentation artifact ownership and classification (canonical, auxiliary, historical, auto-validated) is governed by `docs/documentation-ownership-map.md`.

### Runtime role management
The runtime company-role update flow now exists via `PUT /api/roles/company/:roleId`, enabling company-scoped role lifecycle management alongside list and create.

### Browser session follow-up
The browser session residual risk of cookie-based sessions over non-HTTPS is a follow-up dependency tracked in `specs/p11-https-browser-session-migration/`. This is a residual risk that is not an in-slice blocker for the completed master plan; it requires a dedicated HTTPS migration effort.

## 18. Unknowns and assumptions

### Unknowns
- Full manual browser E2E validation with a representative seeded database has not been fabricated; automated characterization and regression tests are green.
- CI/CD pipeline configuration is not present in the repository; deployment process is undocumented.
- Production Redis configuration and session management behavior under load is not characterized.
- Legacy virtual warehouse rows remain in the database; cleanup impact is unassessed.

### Assumptions
- The 3 skipped tests requiring `P2_CONSTRAINTS_DATABASE_URL` are acceptable and do not represent a risk.
- User-reported test results (1944 pass / 3 skipped / 0 failing) are accurate.
- The audit baseline score of 9.6/10 reflects the current state after all 6 waves.
- All 87 migrations have been applied in sequence and no migration was modified after application.

