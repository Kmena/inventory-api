# Architecture

## 1. Purpose and scope
This document describes the architecture **currently implemented** in the repository after the completed Product + Inventory Master Plan (MASTER-001 through MASTER-031, 6 waves). It documents current reality: active runtime components, module boundaries, dependency rules in effect, and architectural limitations.

This document does not describe aspirational or future-state architecture.

Last refreshed: Post MASTER-032 final architecture documentation refresh.
Validation state: 1944 pass / 3 skipped / 0 failing. `npm run verify`: PASS. Audit baseline: 9.6/10.

## 2. Current active architecture summary
The application is an **Express + Prisma modular monolith** with browser SPAs served from the same runtime.

Architecture is layered:
- **HTTP input adapters** in `src/routes/*.routes.js` (30 route files)
- **Request validation** with Zod in `src/schemas/*.schema.js` (26 schema files)
- **Application/service orchestration** in `src/services/*.service.js` (54 service files)
- **Persistence adapters** in `src/repositories/*.repository.js` (24 repository files)
- **Browser input adapters** in `src/public/root/`, `src/public/warehouse/`, `src/public/agent/`
- **Cross-cutting concerns** in `src/middlewares/`, `src/security/`, `src/lib/`

No formal hexagonal module split is implemented. The system uses pragmatic layering with clear service/repository seams and a centralized access-policy registry.

## 3. Active architectural style and module boundaries

### Runtime style
- Single deployable Node.js 24 monolith
- Express routes per feature area
- Service layer as primary business orchestration boundary
- Prisma repositories as data-access layer
- Static/browser SPA assets delivered from the same process
- PostgreSQL 16 as primary data store
- Optional Redis 7 for browser session storage

### Active module boundaries in practice
Logical module groupings currently in effect:

| Module cluster | Route files | Service files | Repository files |
|---|---|---|---|
| Identity & Access | `auth`, `me` | `auth`, `me`, `browser-session*` | — |
| Company & Config | `company` | `company` | `company` |
| Users & Roles | `user`, `role` | `user`, `role` | `user`, `role` |
| Customers / Clients | `client` | `client` | `client` |
| Products | `product` | `product`, `product-permission-shaping`, `product-pricing`, `product-size-conversion` | `product` |
| Recipes | `recipe` | `recipe` | `recipe` |
| Inventory / Warehouses / Lots | `inventory`, `warehouse` | `inventory`, `inventory-alerts`, `inventory-lot-policy`, `inventory-transaction-support`, `warehouse` | `inventory`, `warehouse` |
| Production / QA | `production` | `production`, `production-execution`, `production-planning`, `production-recolection`, `production-cancel`, `production-material-availability`, `production-stage-loss`, `production-stage-validation`, `quality`, `quality-rejection-disposition`, `quality-relevant-input-scope` | `production`, `quality` |
| Procurement / Receipts | `procurement`, `procurement-rfq`, `receipt`, `supplier`, `fiscal-reference` | `procurement`, `procurement-rfq`, `receipt`, `supplier`, `fiscal-reference` | `procurement`, `procurement-rfq`, `receipt`, `supplier` |
| Sales / Orders / Billing | `order`, `invoice`, `payment`, `agent`, `sales-route` | `order`, `order-access-policy`, `invoice`, `invoice-financial-state`, `payment`, `payment-lifecycle-support`, `payment-receipt-evidence`, `billing-trigger`, `agent-workspace`, `agent-workspace-store-state`, `sales-route` | `order`, `invoice`, `payment`, `agent-workspace`, `sales-route` |
| Entitlements | `entitlement` | `entitlement` | `entitlement` |
| Regions / Zones | `region` | `region` | `region` |
| External Integrations | `taxpayer`, `geocoding`, `economic-activity` | `taxpayer`, `geocoding`, `economic-activity` | — |
| Feedback | `feedback` | `feedback` | `feedback` |
| Browser SPAs | (static files) | — | — |

These are separate files and services, but still part of one tightly-coupled application layer rather than isolated bounded-context packages. Cross-module dependencies are managed by direct service/repository imports.

### Key cross-module dependencies
- **Inventory ↔ Product:** Inventory operations read `product.controlsInventory` and `product.lotStrategy` to determine behavior.
- **Order → Inventory:** Order approval/dispatch delegates stock operations to inventory-transaction-support.
- **Order → Entitlement:** Order FULFILLED triggers entitlement activation orchestrator via entitlement service.
- **Billing → Order:** Invoice creation reads order items to generate InvoiceItem snapshots.
- **Production → Inventory:** Production execution consumes stock through inventory transaction support.
- **Production → Recipe:** Production planning freezes recipe snapshots.

## 4. Current domain map

| Domain | Subdomain type | Current responsibility | Data ownership |
|---|---|---|---|
| Identity & Access | Generic | Authentication, authorization, session management | `users`, `roles`, `permissions`, `role_permissions` |
| Company | Generic | Multi-tenant company configuration | `companies`, `company_configs`, `company_fiscal_configs`, `fiscal_sequences` |
| Products | Core | Product taxonomy, capability classification, pricing, categories | `products`, `categories`, `product_subcategories`, `product_prices`, `product_competitors`, `product_allowed_warehouses` |
| Inventory | Core | Stock tracking, lot management, movements, operations, alerts | `warehouse_stocks`, `warehouse_lot_stocks`, `stock_movements`, `inventory_operations`, `lots`, `lot_status_history`, `inventory_alerts`, `inventories`, `warehouses` |
| Orders & Commercial | Core | Order lifecycle, per-line dispatch, fulfillment | `orders`, `order_items` |
| Entitlements | Core | Commercial lifecycle for non-physical products | `customer_entitlements` |
| Billing | Core | Invoice generation, InvoiceItem snapshots, payments | `invoices`, `invoice_items`, `payments` |
| Recipes | Supporting | Recipe definitions and versioning | `recipes`, `recipe_versions`, `recipe_stages`, `recipe_stage_inputs` |
| Production | Core | Production order execution, QA, material management | `production_orders`, `production_*` tables |
| Procurement | Supporting | Purchasing lifecycle | `purchase_requests`, `supplier_quotations`, `purchase_orders`, `purchase_receipts`, `receipt_inspections` |
| Suppliers | Supporting | Supplier and product-supplier management | `suppliers`, `product_suppliers` |
| Customers | Core | Client/store/legal entity management | `clients`, `client_stores`, `client_legal_entities`, `client_classifications`, `client_documents`, `client_contacts`, `client_references` |
| Sales & Field Ops | Core | Agent workspace, routes, visits, goals | `sales_routes`, `sales_route_*`, `route_visit_logs`, `sales_goals` |
| Regions | Generic | Geographic territory organization | `regions`, `subregions` |
| Audit | Generic | Security and configuration event recording | `audit_events` |

## 5. Current runtime components and responsibilities

### API routes (input adapters)
Each route file is an Express router that:
1. Applies `authenticate` middleware
2. Applies `authorizeAccessPolicy(policyId)` for endpoint-level authorization
3. Applies `validate(zodSchema)` for request payload validation
4. Delegates to the corresponding service function
5. Returns JSON response or forwards errors to the global error handler

### Services (application orchestration + domain logic)
Services contain both orchestration and business rules:
- **Transaction management:** Services initiate Prisma transactions for multi-step operations.
- **Business rule enforcement:** Inventory applicability checks, capability validation, lot strategy logic.
- **Serialization:** Services serialize Prisma results to API response shapes.
- **Cross-service coordination:** Services import other services for cross-domain operations (e.g., order service imports inventory-transaction-support).

### Repositories (persistence adapters)
Repositories provide:
- Company-scoped queries with Prisma `findMany`/`findFirst`/`create`/`update`/`delete`.
- Eager loading of related entities via Prisma `include`.
- Raw SQL via `$queryRawUnsafe` for advisory locks and complex aggregations (governance-tested).
- Pagination support.

### Browser SPAs
Four distinct browser applications served as static files:
1. **Root shell** (`/root/`): Admin workspace with hash-based routing, module registry, permission-gated navigation. Includes Product, Inventory, Recipes, Production, Procurement, Billing, Clients, Agents, Routes, Warehouses, Settings views.
2. **Warehouse SPA** (`/warehouse/`): Operator-facing workspace for dispatching, production execution, QA, receipts, inventory viewing.
3. **Agent SPA** (`/agent/`): Field sales agent workspace with territory, orders, visits, stores.
4. **Supplier quote** (`/supplier-quote/`): Public page for supplier quotation responses.

### Key service-level component responsibilities

#### `inventory-transaction-support.service.js`
Central inventory mutation primitives:
- `authScope()` — company/user extraction from auth context
- `isInventoryControlledProduct()` — canonical `controlsInventory` check
- `usesSystemLotStrategy()` — system-lot eligibility check
- `getOrCreateSystemLot()` — transparent system lot management
- `getInventoryContext()` — loads and validates inventory/warehouse/product context
- `assertProductAllowedAtWarehouse()` — allowedWarehouseIds enforcement
- `changeWarehouseStock()` / `changeLotStock()` / `createMovement()` — atomic stock mutation primitives
- `reserveLots()` / `getActiveAllocations()` — reservation management
- `acquireCompanyInventoryAdvisoryLock()` — PostgreSQL advisory lock for company-scoped concurrency

#### `entitlement.service.js`
CustomerEntitlement lifecycle:
- `activateEntitlementsForOrder()` — orchestrator called on FULFILLED transition
- `manuallyActivateEntitlement()` — manual activation with audit
- `cancelEntitlement()` / `renewEntitlement()` — lifecycle transitions
- `serializeEntitlement()` — derives runtime EXPIRED status from endDate
- `deriveEntitlementStatus()` — pure status derivation function

#### `billing-trigger.service.js`
Invoice generation:
- Creates InvoiceItem snapshots from OrderItems during invoice creation
- Derives `lineKind` from product capabilities
- Captures immutable price/tax/description snapshots

#### `inventory.service.js`
Inventory operations:
- `listStocks()` / `listLots()` / `listMovements()` — query surfaces with pagination
- `createInitialInventory()` — first stock entry for a product at a location
- `adjustStock()` — stock adjustment with InventoryOperation and audit
- `transferInventory()` — atomic balanced transfer with InventoryOperation
- `registerStockEntry()` — stock entry with lot management

## 6. Current dependency rules

### Observed dependency direction
```
Browser SPAs
    ↓ (HTTP calls)
Express Routes (input adapters)
    ↓ (function calls)
Services (application + domain logic)
    ↓ (function calls)
Repositories (Prisma queries)
    ↓ (ORM)
PostgreSQL
```

### Dependency rule enforcement
- Routes depend on services, schemas, and security middleware.
- Services depend on repositories and other services.
- Repositories depend on Prisma client (`src/lib/prisma.js`).
- No formal dependency inversion: services directly import repositories by file path.
- Cross-service imports are common (e.g., `inventory.service.js` imports `billing-trigger.service.js`).

### Known dependency violations
| ID | Severity | Description |
|---|---|---|
| DEP-001 | Medium | Domain logic is mixed with orchestration in service files rather than isolated in domain models. |
| DEP-002 | Low | Services directly import Prisma repositories without port interfaces. |
| DEP-003 | Low | Some business rules exist in serialization functions within services. |
| DEP-004 | Low | Cross-service imports create implicit coupling between module clusters. |

## 7. Current database ownership and transaction boundaries

### Schema overview
- **87 migrations** applied to PostgreSQL 16.
- **50+ models** in Prisma schema (~1700 lines).
- All models are company-scoped via `companyId` foreign key with cascading deletes.

### Transaction boundaries
- **Inventory mutations:** Wrapped in Prisma `$transaction()` with PostgreSQL advisory locks per company.
- **Order approval/dispatch:** Wrapped in transactions that include stock reservation/release.
- **Transfer operations:** Atomic source-deduction + destination-addition in single transaction with InventoryOperation.
- **Invoice creation:** InvoiceItem snapshots created in same transaction as invoice.
- **Entitlement activation:** Inline within order fulfillment transaction (not separately transacted).

### Data integrity enforcements
- Unique constraints on product codes, lot numbers, system lot keys per company.
- Idempotency key uniqueness on InventoryOperation prevents duplicate operations.
- InvoiceItem unique constraint prevents duplicate snapshots per order item per invoice.
- CustomerEntitlement unique constraints prevent duplicate activations per order/invoice item.

## 8. Current API and integration contracts

### API contract governance
- **OpenAPI baseline:** `docs/openapi/runtime-baseline.openapi.json` (109 KB) — machine-readable contract.
- **Runtime contract manifest:** `docs/runtime-contract-manifest.json` (35 KB) — endpoint registry.
- **Contract governance tests:** `runtime-contract-governance.test.js` and `openapi-contract-consistency.test.js` enforce contract stability.
- **Critical contract matrix:** `docs/critical-contract-matrix.json` — identifies high-risk endpoints.

### Request/response patterns
- All API responses use JSON.
- BigInt values serialized as strings.
- Decimal values serialized as strings or numbers depending on field.
- Pagination via query params `page` and `pageSize`.
- Consistent error format: `{ statusCode, code, message }`.
- Zod validation errors return 400 with validation details.

### Authentication contract
- Login: `POST /api/auth/login` → JWT token.
- All API endpoints (except public supplier quotation) require JWT in `Authorization: Bearer <token>` header.
- Browser sessions managed via cookies.

## 9. Current security boundaries

### Tenant isolation
- **Service-level enforcement:** All service functions extract `companyId` from authenticated JWT context.
- **Repository-level enforcement:** All queries are scoped by `companyId`.
- **Client-provided tenant IDs are not trusted** for ownership decisions.

### Access control layers
1. **Authentication:** JWT verification via `authenticate` middleware.
2. **Authorization:** Access policy evaluation via `authorizeAccessPolicy()`.
3. **Actor scope:** Additional scope restrictions beyond basic role/permission.
4. **Business rules:** Service-level validation of operation eligibility.

### Content Security Policy
- Per-SPA CSP headers (root, warehouse, agent, supplier-quote).
- Root shell allows OpenStreetMap tiles and `unsafe-inline` styles (Leaflet requirement).
- Warehouse SPA allows blob: for receipt photo thumbnails.

### Security headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (in production)
- CSP headers per SPA context

## 10. Current container and deployment architecture

### Container design
- **Base image:** `node:24-bookworm-slim` (multi-stage build).
- **Non-root execution:** Dedicated `inventory:inventory` user.
- **Health check:** `GET /health/ready` every 10s.
- **Port:** 2500.
- **Dependencies:** OpenSSL + CA certificates for HTTPS connections.

### Service composition
```
┌─────────────────────────┐
│  inventory-api (Node.js)│ ← Port 2500
│  ├── API routes          │
│  ├── Browser SPAs        │
│  └── Static assets       │
├──────────────────────────┤
│  PostgreSQL 16           │ ← Port 5432
├──────────────────────────┤
│  Redis 7 (optional)     │ ← Port 6379
└─────────────────────────┘
```

### Environment configuration
- `DATABASE_URL` — PostgreSQL connection string.
- `JWT_SECRET` / `JWT_EXPIRES_IN` — Authentication configuration.
- `CORS_ORIGIN` — Allowed CORS origin.
- `BROWSER_SESSION_STORE_MODE` — `redis` or `memory`.
- `REDIS_URL` — Redis connection string.
- `BCRYPT_ROUNDS` — Password hashing rounds.
- External API URLs: `HACIENDA_TAXPAYER_LOOKUP_URL`, `GEOCODING_SEARCH_URL`.

## 11. Current testing strategy

### Test infrastructure
- **Test runner:** Node.js native test runner (`node --test`).
- **Assertion:** Node.js native `assert` module.
- **Browser testing:** Playwright with Chromium.
- **Mocking:** Custom Prisma client mocking via `tests/helpers/`.
- **No external test framework** (no Jest, Mocha, etc.).

### Test categories and counts
| Category | Approximate count | Purpose |
|---|---|---|
| Migration tests | ~30 | Schema migration validation |
| Service unit tests | ~60 | Business logic verification |
| Route contract tests | ~25 | API contract validation |
| Characterization tests | ~50 | Existing behavior capture |
| Governance tests | ~30 | Standards and contract enforcement |
| E2E browser tests | ~15 | Full-stack browser validation |
| Schema/validation tests | ~15 | Zod and Prisma schema validation |
| **Total** | **~225 files / 1944 tests** | |

### Quality gates
```bash
npm run verify  # Runs all gates:
  npm run lint                      # ESLint max-warnings 0
  npm run typecheck                 # TypeScript project check
  npm run lint:public-runtime       # Public asset linting
  npm run validate:public-runtime   # Public runtime validation
  npm run validate:workflow-baseline # Workflow baseline checks
  npm run validate:restore-readiness # Restore readiness checks
  npm run validate:operational-readiness # Operational readiness
  npm run build                     # Prisma client generation
  npm run test                      # Full test suite
```

## 12. Active architectural decisions

### ADR-001: Product.controlsInventory as canonical inventory boundary
- **Decision:** `controlsInventory` (boolean) determines whether a product participates in stock, lot, warehouse, reservation, and dispatch operations.
- **Rationale:** Clean separation between physical goods (inventory-controlled) and services/entitlements (non-inventory).
- **Status:** Active and enforced across all relevant services.

### ADR-002: InvoiceItem snapshots are immutable
- **Decision:** InvoiceItem records are created once during invoice generation and never mutated.
- **Rationale:** Audit trail integrity and historical accuracy for billing records.
- **Status:** Active with unique constraint enforcement.

### ADR-003: System lots are transparent to business UX
- **Decision:** Products with `lotStrategy=SYSTEM` automatically get system-generated lots that are hidden from business users.
- **Rationale:** Simplifies UX for products that don't need manual lot tracking while maintaining lot-level traceability.
- **Status:** Active with `isSystemGenerated` flag and serialization filtering.

### ADR-004: InventoryOperation as idempotent operation grouping
- **Decision:** All business-level inventory operations (adjustments, transfers, initial inventory) create an `InventoryOperation` record with an optional idempotency key.
- **Rationale:** Audit trail, operation grouping, and duplicate prevention.
- **Status:** Active.

### ADR-005: CustomerEntitlement with derived EXPIRED status
- **Decision:** `CustomerEntitlement.status` stores only ACTIVE/CANCELLED. EXPIRED status is derived at runtime by comparing `endDate` to current time.
- **Rationale:** Avoids background jobs or scheduled status transitions; status is always consistent at read time.
- **Status:** Active.

### ADR-006: Warehouse model retained as location model
- **Decision:** The `Warehouse` table serves as the location model with additional `locationType` and `locationNature` fields. No separate `Location` table.
- **Rationale:** Backward compatibility with existing warehouse-based operations. "Ubicaciones" is user-facing terminology mapped to the same model.
- **Status:** Active.

### ADR-007: Entitlement activation is synchronous, not event-driven
- **Decision:** Entitlement activation on order FULFILLED is inline within the order service, not via an event bus.
- **Rationale:** Simplicity for MVP. Event-driven activation is a future consideration.
- **Status:** Active.

### ADR-008: Conservative migration defaults
- **Decision:** All new columns use conservative defaults that preserve existing data behavior (e.g., `controlsInventory=true`, `productNature=GOOD`, `commercialBehavior=STANDARD`).
- **Rationale:** Existing physical products continue working without modification after migration.
- **Status:** Active.

## 13. Known architectural limitations

### L-001: No formal domain layer
Business rules are embedded within service files. No separate domain entity classes, value objects, or aggregates exist. This limits testability of pure business logic and increases service file size.

### L-002: No dependency inversion
Services directly import repositories by file path. No port/adapter interfaces exist. Swapping persistence implementations would require modifying service files.

### L-003: Synchronous-only processing
All operations are synchronous within HTTP request lifecycles. Long-running operations (e.g., bulk entitlement activation) could impact response times. No background job infrastructure exists.

### L-004: Large service files
Several service files exceed maintainability thresholds: `inventory.service.js` (43.9 KB), `product.service.js` (31.8 KB), `production.service.js` (24.2 KB). These would benefit from decomposition.

### L-005: Frontend monolithic views
Root shell view files are very large: `quotations-admin.js` (58 KB), `clients-admin.js` (51 KB), `products-admin.js` (48.7 KB). Custom module registry instead of standard build tools.

### L-006: No CI/CD pipeline
No CI configuration is present in the repository. Validation relies on manual `npm run verify` execution.

### L-007: Coupled cross-service dependencies
Services import other services directly, creating implicit coupling. For example, `order.service.js` imports both `inventory-transaction-support.service.js` and `entitlement.service.js`, creating a transitive dependency chain.

## 14. Governance and operational context

### Documentation ownership
The canonical reviewed artifacts under `docs/**` are the authoritative source for architecture, current-state, action-plan and API contract documentation. The partial OpenAPI baseline and bounded governance evidence are maintained under `docs/openapi/` and `docs/runtime-contract-manifest.json`, aligned with the p34-bounded-governance-coverage-expansion posture. The workflow-baseline validators and characterization tests intentionally read hosted workflow truth from that parent-root workflow tree. The hosted workflows live at `../.github/workflows/**` relative to the inventory-api directory. Documentation artifact ownership and classification is governed by `docs/documentation-ownership-map.md`.

### Runtime role management
The supported runtime company-role update flow now exists via `PUT /api/roles/company/:roleId`, completing company-role list/create/update lifecycle management.

### Browser session follow-up
The browser session residual risk of cookie-based sessions over non-HTTPS is tracked in `specs/p11-https-browser-session-migration/`. This is a follow-up dependency that is not an in-slice blocker for the completed master plan.

## 15. Open decisions requiring clarification

### OD-001: Event-driven entitlement activation
Should the synchronous entitlement activation orchestrator be replaced with an event-driven pattern? This would decouple order fulfillment from entitlement creation but adds infrastructure complexity.

### OD-002: Domain model extraction
Should business rules be extracted from service files into formal domain model classes? This is the standard HDD approach but requires significant refactoring of 54 service files.

### OD-003: CI/CD pipeline
What deployment pipeline should be established? The repository has comprehensive quality gates but no automated CI/CD.

### OD-004: Legacy virtual warehouse cleanup
Legacy virtual warehouse rows exist in the database. Should they be cleaned up or preserved as historical data?

### OD-005: Frontend build tooling
Should the custom `RootShell.register/require` module system be replaced with standard build tools (Vite, esbuild, etc.)?
