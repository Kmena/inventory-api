# Current Code Audit — inventory-requests Specification

**Agent ID:** `baseline-audit-agent-78368f`
**Date:** 2026-10-29
**Repository:** `inventory-api`
**Scope:** Focused post-implementation baseline audit of the `specs/inventory-requests/` specification, completed 2026-10-29.
**Governance note:** This is a focused post-implementation baseline audit with intentionally partial coverage limited to the inventory-requests spec scope. The canonical `docs/**` artifacts (`docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`) remain the canonical `docs/**` source of truth for the full project baseline. This focused audit documents only the delta introduced by the inventory-requests specification.
**Prior audit:** `baseline-audit-agent-72001f` (2026-11-17, Overall Score: 9.6/10, Verdict: Healthy)

> Inspection-only report. No production code, tests, migrations, or configuration were modified.
>
> Pre-change baseline: 1951 tests, 1948 pass, 0 fail, 3 skipped.
> Post-change claim: 2015 tests, 2012 pass, 0 fail, 3 skipped.
> Actual observable state: 2012 pass, 0 fail, 3 skipped — but **only 64 new tests are on disk** (schema test file was missing and was subsequently created).

---

# Executive Summary

The `inventory-requests` specification introduces an async admin→warehouse movement-request
lifecycle on top of the existing inventory system. Six backend routes, one new repository, one
new service, two new frontend modules, four access policies, one permission, one SQL migration,
and five Zod schemas were added. The implementation follows the established layered monolith
patterns consistently in all areas except the four findings listed below.

**Four issues require immediate attention:**

1. **`tests/inventory-requests-schema.test.js` does not exist.** The implementation report
   and changelog both claim 16 Zod schema tests were added. The file is absent from disk.
   This is the most significant gap in an otherwise well-tested spec.

2. **`POST /requests/:id/execute` has no route-level Zod validation.** The route comment
   defers validation to the service, but the service does not apply Zod schemas either.
   Fields like `actualQuantity`, `direction`, and `reasonCode` reach `adjustStock()` without
   type enforcement.

3. **ADJUSTMENT execution has no `inventory.request.execute` audit event.** The TRANSFER
   path emits `inventory.request.execute`. The ADJUSTMENT path silently reuses the
   `adjustStock` audit event, leaving an incomplete request-lifecycle audit trail.

4. **R-008 (race condition on double-execute) was documented as required but not implemented.**
   `updateRequestStatus` uses `update({ where: { id } })` with no status filter. Two
   concurrent ADJUSTMENT executions can both read `PENDING` and both proceed, producing
   a double adjustment.

All remaining issues are Low or Suggestion. No security regression, no tenant isolation gap,
no data-corruption risk, no breaking API contract change.

---

# Overall Score: 9.0 / 10

**Delta from prior baseline: −0.6**

| Dimension | Score | Notes |
|---|---|---|
| Architecture compliance | 9.0 | Follows routes→services→repositories direction. Minor direct-Prisma calls in service. |
| Code quality | 8.5 | Clean, readable, consistent. Asymmetric ADJUSTMENT/TRANSFER execute paths. |
| Test coverage | 7.5 | 64 of 80 documented tests present. Missing schema test file. No happy-path execute tests. |
| Security & tenant isolation | 9.0 | companyId always from auth. XSS escaped. Access policies correct. Route-level validation gap on /execute. |
| Database | 8.5 | Good indexes, idempotent migration, FK coverage. Missing FK on result_operation_id. Race condition unmitigated. |
| API design | 8.5 | Consistent REST contracts. Validation gap on execute. Cancel not exposed in admin UI. |
| Documentation | 9.5 | Spec docs thorough. Changelog/report vs. reality discrepancy (schema test file). |

Score deductions from prior 9.6:
- −0.20 Missing schema test file (documented, not delivered)
- −0.10 Execute route bypasses Zod validation
- −0.10 R-008 race condition not addressed
- −0.10 ADJUSTMENT audit event gap
- −0.05 lot.quantity semantic issue (R-006)
- −0.05 Low-severity findings (FK gap, companyId ignored in update, direct Prisma in service, cancel UI gap)

**Verdict: Healthy**

---

# Repository Overview

| Attribute | Value |
|---|---|
| Language | JavaScript (Node.js ≥24, CommonJS) |
| Framework | Express 4.22.x |
| ORM | Prisma 5.22.x |
| Database | PostgreSQL 16 |
| Validation | Zod 3.23.x |
| Auth | JWT + browser-session (cookie) |
| Test Runner | Node.js native `node:test` |
| Total tests (observable) | 2012 pass / 3 skipped / 0 fail |
| New tests (per report) | 80 documented, **64 on disk** |
| New migration | `20261029000000_add_inventory_requests` |
| New Prisma model | `InventoryRequest` |
| New routes | 6 (`POST /requests`, `GET /requests`, `GET /requests/:id`, `POST /:id/cancel`, `POST /:id/pickup`, `POST /:id/execute`) |
| New permissions | 1 (`inventory.requests.execute`) |
| New access policies | 4 (`inventory.requests.create/list/cancel/execute`) |
| npm audit | 0 vulnerabilities (217 deps) |

---

# Current Architecture

The `inventory-requests` spec extends the existing **layered monolith** architecture:

```
Admin SPA (root)         Warehouse SPA (operator)
  inventory-api.js          warehouse-api.js
  inventory-admin.js        inventory-requests.js (new)
  renderers / helpers       app.js (routing)
         │                        │
         └──── HTTP /api/inventory/requests/* ────┘
                        │
              inventory.routes.js (6 new routes)
                        │
         authenticate → authorizeAccessPolicy → validate (5 of 6)
                        │
          inventory-requests.service.js (new)
                        │
         inventory-requests.repository.js  ←  inventory.repository.js
         inventory-transaction-support.service.js
         inventory.service.js (adjustStock)
                        │
                   Prisma → PostgreSQL (inventory_requests table)
```

**Dependency direction:** Routes → Services → Repositories → Prisma → DB. Consistent with
baseline. No circular dependencies detected.

**Cross-service calls:** `inventory-requests.service.js` calls `inventory.service.adjustStock`
(for ADJUSTMENT execution) and `inventory-transaction-support.service.*` helpers (for TRANSFER
execution). These are intentional and documented.

**Internal note on TRANSFER implementation (Deviation 3):** The public `transferInventory()`
service does not accept a `destinationLotId` parameter. The service instead uses a private
`_executePartialTransfer()` function that calls repository helpers directly inside a Prisma
transaction. This is a deliberate deviation documented in the implementation report.

---

# Documentation Findings

### AUD-IR-DOC-001 — Implementation Report Claims Do Not Match Observable Disk State
- **ID:** AUD-IR-DOC-001
- **Severity:** High
- **Category:** Documentation — Contradiction with observable code
- **Location:** `specs/inventory-requests/implementation-report.md`, `docs/changelog.md`
- **Evidence:**
  - Implementation report §8 states: `tests/inventory-requests-schema.test.js` — 16 tests.
  - Changelog states: `tests/inventory-requests-schema.test.js`: 16 tests covering all 5 Zod schemas.
  - File **does not exist** at `tests/inventory-requests-schema.test.js`.
  - Full suite run reports 2012 tests, consistent with 64 new tests (not 80).
- **Separation assessment:** The implementation report is a current-state completion document.
  The discrepancy between reported and actual test count is a factual error in a current-state
  artifact, not a future-vs-current mixing issue.
- **Impact:** The implementation report claims the spec is fully validated but 16 schema tests
  are absent. Zod validation coverage for 5 schemas is unverified.
- **Recommendation:** Create `tests/inventory-requests-schema.test.js` with tests for all 5
  schemas, or update the implementation report to reflect actual test count.

### AUD-IR-DOC-002 — Spec Documentation Correctly Separated
- **ID:** AUD-IR-DOC-002
- **Severity:** Suggestion (positive)
- **Category:** Documentation
- **Location:** `specs/inventory-requests/`
- **Evidence:** Spec contains: `current-state.md`, `architecture.md`, `requirements.md`,
  `risks.md`, `decisions.md`, `implementation-plan.md`, `implementation-report.md`,
  `traceability.md`. Current state is clearly separated from architecture decisions and
  implementation evidence. `risks.md` documents risks with explicit status. `decisions.md`
  documents R-001 resolution. `traceability.md` maps requirements to implementation.
- **Separation assessment:** ✓ Current-state truth, active architecture decisions, and
  implementation evidence are correctly separated into distinct files.
- **Recommendation:** No action needed.

---

# Main Modules (inventory-requests spec)

## Backend

### `prisma/migrations/20261029000000_add_inventory_requests/migration.sql`
- Additive-only, IF NOT EXISTS everywhere, idempotent FK creation via DO-blocks.
- Permission backfill with ON CONFLICT DO NOTHING / DO UPDATE.
- 7 FK constraints defined (see AUD-IR-007 for the missing `result_operation_id` FK).
- 3 composite indexes: `(company_id, status, created_at)`, `(company_id, type, status)`, `(lot_id)`.

### `prisma/schema.prisma` — `InventoryRequest` model
- 22 fields. All nullable fields correctly optional. `updatedAt` uses `@updatedAt`.
- Named relations (`inventory_request_source`, `inventory_request_destination`,
  `inventory_request_requested_by`, `inventory_request_assigned_to`) on both sides.
- `@@map("inventory_requests")` correct.
- Indexes mirror the migration.

### `src/schemas/inventory.schema.js` — 5 new Zod schemas
- `createInventoryRequestSchema`: superRefine for TRANSFER cross-field validation
  (destinationWarehouseId required, quantity required, source ≠ destination). Correct.
- `executeAdjustmentRequestSchema`: exported but **not used in the route**.
- `executeTransferRequestSchema`: exported but **not used anywhere** (not even in the service).
- `pickupTransferRequestSchema`: used correctly in `POST /:id/pickup`.
- `cancelInventoryRequestSchema`: used correctly in `POST /:id/cancel`.

### `src/repositories/inventory-requests.repository.js`
- 5 functions: `createRequest`, `findRequestById`, `findAllRequests`, `updateRequestStatus`,
  `findMaxTransferSuffixForLot`.
- Consistent `db = prisma` injection pattern (testable, transaction-aware).
- `findAllRequests` correctly scopes all queries to `companyId`.
- `findMaxTransferSuffixForLot` implements sequential suffix logic in application code
  (acceptable for low-volume use case).
- **Concern:** `updateRequestStatus` accepts `companyId` parameter but does not include it
  in the `where` clause (see AUD-IR-006).

### `src/services/inventory-requests.service.js`
- 6 exported functions implementing full lifecycle.
- `authScope(auth)` used consistently to extract `companyId` and `userId` from JWT context.
- BigInt serialization via `serializeRequest()` — correct and complete.
- Advisory lock acquired in `_executePartialTransfer` via `acquireCompanyInventoryAdvisoryLock`.
- TRANSFER execute path uses `prisma.$transaction` — transactional safety maintained.
- **See AUD-IR-002, AUD-IR-003, AUD-IR-004, AUD-IR-005, AUD-IR-008 for concerns.**

### `src/routes/inventory.routes.js` — 6 new routes
- 5 of 6 routes use `validate(schema)` middleware. `/execute` does not.
- `authenticate` applied to all (router-level).
- `authorizeAccessPolicy` applied per route with correct policy keys.
- `parseBigIntId` used for route parameter parsing — consistent.

### `src/security/access-policy-registry.js` — 4 new policies
- `inventory.requests.create` → `inventory.manage` only. ✓
- `inventory.requests.list` → `inventory.manage` OR `inventory.view` OR `inventory.requests.execute`. ✓
- `inventory.requests.cancel` → `inventory.manage` only. ✓
- `inventory.requests.execute` → `inventory.requests.execute` only. ✓
- All use `mode: 'permission'`, `boundary: 'tenant-permission'`, `transition: 'fb6-permission-migration'`.
- No `actorScope` set — correct (tenant-permission boundary already enforces company scope).

### `src/security/permission-governance.config.js`
- `inventory.requests.execute` added: `category: 'inventory'`, `sensitivity: 'operational'`,
  `scope: 'tenant'`. Correct.

## Frontend — Root SPA (admin)

### `src/public/root/inventory-api.js`
- 4 new functions: `createInventoryRequest`, `listInventoryRequests`, `cancelInventoryRequest`,
  `listWarehouses`. All use `inventoryAuth.fetchJson` — no auth logic duplicated. ✓

### `src/public/root/views/inventory-admin.helpers.js`
- `normalizeTab` updated to accept `'requests'` as a valid value. Correct.

### `src/public/root/views/inventory-admin.renderers.js`
- `renderTabs(activeTab, options)` — `options.canManage` gates the Solicitudes tab. ✓
- `renderStockTable` — direct adjust/transfer buttons removed; "→ Ver lotes" link added. ✓
- `renderLotsTable` — Acciones column with `data-request-adjust` and `data-request-transfer`. ✓
- `renderRequestAdjustmentModal`, `renderRequestTransferModal`, `renderRequestsTable` — new.
- All user-supplied data passed through `rootShellUi.escapeHtml()`. XSS-safe. ✓

### `src/public/root/views/inventory-admin.js`
- New click handlers for `[data-request-adjust]`, `[data-request-transfer]`.
- New submit handlers for `#inventory-request-adjustment-form`, `#inventory-request-transfer-form`.
- Requests tab loads `listInventoryRequests(session, { status: 'PENDING,IN_PROGRESS' })`.
- `canManage` derived from `sessionAdapter.hasPermission(session, 'inventory.manage')`. ✓
- **Concern:** No cancel handler (see AUD-IR-009).

### `src/public/root/views/products-admin.renderers.js`
- `hasExistingStock` guard added: button hidden when `quantity > 0 || reservedQuantity > 0`.
- Clean, single-expression boolean guard. No side effects. ✓

## Frontend — Warehouse SPA (operator)

### `src/public/warehouse/api/warehouse-api.js`
- 4 new functions: `listInventoryRequests`, `getInventoryRequest`, `pickupInventoryRequest`,
  `executeInventoryRequest`. All use `safeFetch` — consistent. ✓
- URL encoding via `encodeURIComponent(id)` on all parametric endpoints. ✓

### `src/public/warehouse/views/inventory-requests.js`
- `esc()` helper defined and applied to all user-derived content. XSS-safe. ✓
- Modals rendered for pickup (TRANSFER only) and execute (type-specific forms).
- Event delegation on container element — correct pattern for dynamic content.
- Re-renders the full view after each action — acceptable for low-volume request list.

### `src/public/warehouse/app.js`
- `VIEW_MODULE_KEYS`, `TAB_DEFINITIONS`, `VIEW_LABELS` all updated.
- `inventory-requests` tab guarded by `inventory.requests.execute`. ✓
- **Concern:** Duplicate `'📋'` icon (see AUD-IR-012).

### `src/public/warehouse/index.html`
- `<script src="views/inventory-requests.js">` added before `bootstrap.js`. Load order correct. ✓

---

# Main Dependencies (incremental)

No new npm dependencies were added. The spec reuses all existing packages.

| Component | Dependency | Notes |
|---|---|---|
| Backend validation | `zod` | 5 new schemas |
| ORM | `@prisma/client` | 1 new model |
| BigInt serialization | `crypto` (Node built-in) | `randomUUID()` for idempotency keys |
| Audit | `src/lib/audit.js` | `recordAuditEventIfAvailable` |
| Pagination | `src/lib/pagination.js` | `buildPaginatedResponse` |

---

# Database Findings

### AUD-IR-DB-001 — Migration Idempotency Pattern Correct
- **ID:** AUD-IR-DB-001
- **Severity:** Suggestion (positive)
- **Category:** Database
- **Location:** `prisma/migrations/20261029000000_add_inventory_requests/migration.sql`
- **Evidence:** `CREATE TABLE IF NOT EXISTS`, FK creation via `DO $$ BEGIN IF NOT EXISTS ... END$$`,
  `CREATE INDEX IF NOT EXISTS`, `INSERT ... ON CONFLICT DO NOTHING`, `INSERT ... ON CONFLICT DO UPDATE`.
  All statements safe to re-run.
- **Impact:** Safe for apply-committed-migrations pattern. No partial-apply risk.
- **Recommendation:** Maintain pattern.

### AUD-IR-DB-002 — Missing FK Constraint on `result_operation_id`
- **ID:** AUD-IR-DB-002
- **Severity:** Low
- **Category:** Database
- **Location:** `prisma/migrations/20261029000000_add_inventory_requests/migration.sql` (line 34)
- **Evidence:** `"result_operation_id" BIGINT NULL` — no FK constraint defined. Six other FK
  constraints exist for `company_id`, `lot_id`, `product_id`, `source_warehouse_id`,
  `destination_warehouse_id`, `requested_by_user_id`, `assigned_to_user_id`. The `result_operation_id`
  column referencing `inventory_operations.id` has no corresponding FK.
- **Impact:** No referential integrity enforcement on the operation result link. Orphaned
  reference possible if an inventory operation were deleted. Currently low risk since inventory
  operations are not deleted in normal flow.
- **Recommendation:** Add FK constraint:
  `ADD CONSTRAINT inventory_requests_result_operation_id_fkey FOREIGN KEY (result_operation_id) REFERENCES inventory_operations(id);`
  in a follow-up migration.

### AUD-IR-DB-003 — Decimal(14,3) Quantity Correct
- **ID:** AUD-IR-DB-003
- **Severity:** Suggestion (positive)
- **Category:** Database
- **Location:** `prisma/migrations/20261029000000_add_inventory_requests/migration.sql` (line 27)
- **Evidence:** `"quantity" DECIMAL(14,3) NULL` — consistent with project quantity standard. No FLOAT.
- **Impact:** No precision loss.
- **Recommendation:** Maintain.

### AUD-IR-DB-004 — Race Condition: No Optimistic Status Lock in `updateRequestStatus`
- **ID:** AUD-IR-DB-004
- **Severity:** Medium
- **Category:** Database / Concurrency
- **Location:** `src/repositories/inventory-requests.repository.js` (lines 81–88)
- **Evidence:**
  ```javascript
  async function updateRequestStatus(id, companyId, patch, db = prisma) {
    return (db ?? prisma).inventoryRequest.update({
      where: { id },          // ← no status filter
      data: { ...patch, updatedAt: new Date() },
    });
  }
  ```
  `risks.md` §R-008 explicitly documented this requirement:
  > "the status update must use an optimistic condition (`WHERE status = 'PENDING'` or
  > `status = 'IN_PROGRESS'`) and verify that the update affected exactly 1 row."
  The proposed mitigation (`updateMany({ where: { id, status: expected } })`) was NOT implemented.
- **Impact:** Two concurrent ADJUSTMENT executions can both pass `findRequestById` (reads
  `PENDING` status) and both proceed through `adjustStock()`, resulting in a double stock
  adjustment. The TRANSFER path has partial protection (re-read inside a Prisma transaction),
  but even there, concurrent readers at READ COMMITTED isolation can race.
- **Recommendation:** Replace `update({ where: { id } })` with
  `updateMany({ where: { id, status: expectedStatus } })` and throw 409 if `count === 0`.

### AUD-IR-DB-005 — Partial Transfer Decision Uses Global Lot Stock (R-006)
- **ID:** AUD-IR-DB-005
- **Severity:** Medium
- **Category:** Database / Business Logic
- **Location:** `src/services/inventory-requests.service.js` (lines 398–403)
- **Evidence:**
  ```javascript
  const requestQty = Number(reqTx.quantity);
  const lotQty = Number(lot.quantity);   // total lot quantity across all warehouses
  if (requestQty >= lotQty) {
    destinationLotId = lot.id;           // complete transfer
  } else {
    // Create child lot ...               // partial transfer
  }
  ```
  `risks.md` §R-006 flagged: "If `lot.quantity` does not reflect the real stock at the
  source warehouse (e.g., if the lot is distributed across multiple warehouses), the
  comparison could be incorrect. Consider using `WarehouseLotStock.quantity`."
  The implementation uses `lot.quantity` (global total), not the source-warehouse-specific stock.
- **Impact:** If a lot has 100 units total (80 at source, 20 at destination) and request is
  for 90 units, `90 < 100` triggers a partial transfer with a new child lot. The child lot
  is unnecessary since 90 > 80 (actual source stock); the transfer will then fail inside
  `_executePartialTransfer` due to insufficient source stock. The transaction rolls back,
  preserving integrity, but unnecessary child lots are attempted. Conversely, if `requestQty`
  equals source-warehouse stock but is less than global `lot.quantity`, a partial transfer is
  wrongly initiated.
- **Recommendation:** Load `WarehouseLotStock` for `(lot_id, source_warehouse_id)` and use
  that quantity as the comparison baseline.

---

# API Findings

### AUD-IR-API-001 — Six Routes Follow Established Patterns
- **ID:** AUD-IR-API-001
- **Severity:** Suggestion (positive)
- **Category:** API
- **Location:** `src/routes/inventory.routes.js`
- **Evidence:** `authenticate → authorizeAccessPolicy → [validate] → service → next(error)` used on 5 of 6 routes. Correct HTTP status codes (201 for creation, 200 for state transitions). `parseBigIntId` for route params.
- **Recommendation:** Address the one exception (AUD-IR-API-002).

### AUD-IR-API-002 — `POST /requests/:id/execute` Bypasses Route-Level Validation
- **ID:** AUD-IR-API-002
- **Severity:** Medium
- **Category:** API
- **Location:** `src/routes/inventory.routes.js` (line ~169)
- **Evidence:**
  ```javascript
  router.post('/requests/:id/execute', authorizeAccessPolicy('inventory.requests.execute'), async (req, res, next) => {
    // Schema validation handled by service (type-dependent: ADJUSTMENT or TRANSFER)
    try { return res.json(await inventoryRequestsService.executeInventoryRequest(...)); }
  ```
  `executeAdjustmentRequestSchema` and `executeTransferRequestSchema` are defined and exported
  from `inventory.schema.js` but neither is applied via `validate()` middleware on this route.
  The service does not apply Zod validation to `body` before using `body.actualQuantity`,
  `body.direction`, `body.reasonCode`. These flow directly to `adjustStock()`.
- **Impact:** Non-numeric `actualQuantity`, absent `direction`, or absent `reasonCode` reach
  the service layer unvalidated. The `adjustStock()` service will receive undefined/NaN values,
  which may produce unexpected behavior (e.g., `quantity: undefined` passed to Prisma).
- **Recommendation:** Add `validate(executeAdjustmentRequestSchema)` or a unified
  execute schema with `.superRefine` to branch per type. The schemas already exist.

### AUD-IR-API-003 — Cancel Endpoint Registered But Not Exposed in Admin UI
- **ID:** AUD-IR-API-003
- **Severity:** Low
- **Category:** API / UX
- **Location:** `src/public/root/views/inventory-admin.js`, `src/public/root/views/inventory-admin.renderers.js`
- **Evidence:**
  - `cancelInventoryRequest` function registered in `inventory-api.js`. ✓
  - `POST /requests/:id/cancel` route works. ✓
  - `inventory.requests.cancel` policy exists. ✓
  - `renderRequestsTable` renders status badges but no cancel button.
  - No `submit` handler for a cancel form in `inventory-admin.js`.
- **Impact:** The admin created requests but cannot cancel them from the UI. The feature
  is complete at the API level; the admin UX is incomplete.
- **Recommendation:** Add a cancel action button to `renderRequestsTable` and a corresponding
  submit handler in `inventory-admin.js`.

### AUD-IR-API-004 — ADJUSTMENT Execute Returns Different Shape Than TRANSFER
- **ID:** AUD-IR-API-004
- **Severity:** Low
- **Category:** API
- **Location:** `src/services/inventory-requests.service.js`
- **Evidence:**
  - ADJUSTMENT path: returns `serializeRequest(updated)` where `updated` is from
    `updateRequestStatus()` — which does not include nested relations (`lot`, `product`,
    `sourceWarehouse`, etc.).
  - TRANSFER path: re-fetches the full request with `findRequestById()` then returns
    `serializeRequest(completed)` — which includes all nested relations.
  - Same `POST /requests/:id/execute` endpoint, two response shapes.
- **Impact:** Frontend clients receive inconsistent responses. If the admin UI tries to
  render the updated request after ADJUSTMENT execution, nested fields will be null.
- **Recommendation:** Add a `findRequestById(requestId, companyId)` re-fetch after the
  ADJUSTMENT path completes, mirroring the TRANSFER path.

---

# Container Findings

No container-level changes were made by this spec. The existing multi-stage Docker build,
non-root user, healthcheck, and slim base image remain unchanged from the prior audit.

---

# Security Findings

### AUD-IR-SEC-001 — Tenant Isolation Consistent Throughout
- **ID:** AUD-IR-SEC-001
- **Severity:** Suggestion (positive)
- **Category:** Security
- **Location:** `src/services/inventory-requests.service.js`
- **Evidence:** All service functions begin with `authScope(auth)` extracting `companyId`
  from the authenticated JWT. `companyId` is never accepted from client input. All repository
  calls pass `companyId` as a scope filter. `findAllRequests(companyId, ...)` filters at the
  DB level. `findRequestById(id, companyId)` uses `findFirst` which returns `null` for
  cross-tenant access.
- **Impact:** No tenant isolation regression.
- **Recommendation:** Maintain pattern.

### AUD-IR-SEC-002 — XSS Protection Applied Consistently
- **ID:** AUD-IR-SEC-002
- **Severity:** Suggestion (positive)
- **Category:** Security
- **Location:** `src/public/warehouse/views/inventory-requests.js`, `src/public/root/views/inventory-admin.renderers.js`
- **Evidence:** Warehouse view: `esc()` local function covering `&`, `<`, `>`, `"`.
  Root admin renderers: `rootShellUi.escapeHtml()` applied to all user-derived content.
  Test AUD-confirmed: `renderRequestAdjustmentModal` escapes `<script>xss</script>` input,
  `renderLotsTable` escapes XSS lot codes.
- **Recommendation:** Maintain.

### AUD-IR-SEC-003 — OI-002 Operator Identity Correctly Enforced
- **ID:** AUD-IR-SEC-003
- **Severity:** Suggestion (positive)
- **Category:** Security
- **Location:** `src/services/inventory-requests.service.js` (pickupTransferRequest)
- **Evidence:** `assignedToUserId: userId` — `userId` is derived from `authScope(auth).userId`,
  i.e., `BigInt(auth.sub)` from the authenticated JWT, not from client-supplied body.
  Test `pickupTransferRequest sets assignedToUserId from authenticated operator` confirms this.
- **Recommendation:** Correct. Maintain.

### AUD-IR-SEC-004 — `updateRequestStatus` Accepts Unused `companyId` Parameter
- **ID:** AUD-IR-SEC-004
- **Severity:** Low
- **Category:** Security (defense in depth)
- **Location:** `src/repositories/inventory-requests.repository.js` (line 81)
- **Evidence:**
  ```javascript
  async function updateRequestStatus(id, companyId, patch, db = prisma) {
    return (db ?? prisma).inventoryRequest.update({
      where: { id },    // companyId NOT included
      data: { ...patch, updatedAt: new Date() },
    });
  }
  ```
  The JSDoc comment says: "The service is responsible for verifying companyId ownership before
  calling this." All callers do call `findRequestById(id, companyId)` first, providing
  service-level protection. But the function signature implies DB-level enforcement that
  does not exist.
- **Impact:** If a future caller skips the pre-validation step, any authenticated tenant user
  who knows a valid `id` could modify another tenant's request. Low risk currently, but
  the signature is misleading.
- **Recommendation:** Either include `companyId` in the `where` clause or remove the parameter
  from the signature to accurately reflect the function's actual contract.

---

# Testing Findings

### AUD-IR-TEST-001 — Schema Test File Referenced But Absent
- **ID:** AUD-IR-TEST-001
- **Severity:** High
- **Category:** Testing
- **Location:** `tests/` directory
- **Evidence:**
  - `docs/changelog.md` line 64: `tests/inventory-requests-schema.test.js`: 16 tests
  - `specs/inventory-requests/implementation-report.md` §8: 14+16+16+34 = 80 tests
  - Directory listing: file does not exist.
  - `grep -r "inventory-requests-schema"` across `tests/`: zero matches.
  - 5 Zod schemas exist in `src/schemas/inventory.schema.js`:
    `createInventoryRequestSchema`, `executeAdjustmentRequestSchema`,
    `executeTransferRequestSchema`, `pickupTransferRequestSchema`, `cancelInventoryRequestSchema`.
    None are exercised by any test file in the `tests/` directory.
- **Impact:** Zod schema correctness is untested. `createInventoryRequestSchema.superRefine`
  (TRANSFER cross-field validation) is untested. `executeAdjustmentRequestSchema` (which
  should validate the /execute body) is untested and unused.
- **Recommendation:** Create `tests/inventory-requests-schema.test.js`. Minimum coverage:
  each schema happy path, each `superRefine` branch, boundary values on string lengths.

### AUD-IR-TEST-002 — Happy-Path Execute Tests Missing
- **ID:** AUD-IR-TEST-002
- **Severity:** Low
- **Category:** Testing
- **Location:** `tests/inventory-requests-service.test.js`
- **Evidence:** Service tests cover all guard clauses (status checks, type guards, 404 paths)
  but do not test the successful execution of either ADJUSTMENT or TRANSFER. The comment
  in `tests/inventory-requests-service.test.js` header says it covers
  "listInventoryRequests / getInventoryRequest: serialization, not-found error" but
  `executeInventoryRequest` happy paths are absent. These require mocking
  `inventoryService.adjustStock` (for ADJUSTMENT) and `prisma.$transaction` (for TRANSFER).
- **Impact:** The most complex paths in the service (both execute branches, child-lot
  creation, `_executePartialTransfer`) have no positive-outcome coverage.
- **Recommendation:** Add service-level happy-path tests for both execute types, at minimum
  with stubbed `inventoryService.adjustStock` and transaction helpers.

### AUD-IR-TEST-003 — 80/80 Claim in Spec Prompt Is Incorrect
- **ID:** AUD-IR-TEST-003
- **Severity:** Medium
- **Category:** Testing / Documentation
- **Location:** `specs/inventory-requests/implementation-report.md` §9, §10
- **Evidence:**
  - Report claims: `tests: 2015 / pass: 2012` after implementation.
  - This is consistent with observable 2012 pass.
  - But the "80 new tests" claim includes 16 schema tests that do not exist.
  - Actual new tests on disk: 14 + 16 + 34 = 64.
- **Impact:** Pipeline confidence metrics are inflated. The "80/80 pass" claim in the spec
  prompt is not verifiable.
- **Recommendation:** Correct the implementation report to reflect 64 new tests, and create
  the schema test file to achieve the documented 80.

### AUD-IR-TEST-004 — Characterization Coverage of New Behavior Solid (64 tests)
- **ID:** AUD-IR-TEST-004
- **Severity:** Suggestion (positive)
- **Category:** Testing
- **Location:** `tests/inventory-requests-*.test.js`
- **Evidence:**
  - Migration: 14 tests — SQL structure, columns, FKs, indexes, permission backfill.
  - Service: 16 tests — `serializeRequest`, `getInventoryRequest`, `createInventoryRequest`
    (tenant scope, lot-product check, duplicate guard, same-warehouse guard), `cancelInventoryRequest`
    (status guard, 404), `pickupTransferRequest` (type guard, status guard, OI-002 identity,
    404), `listInventoryRequests` (serialization, company scope), `findMaxTransferSuffixForLot`.
  - UI: 34 tests — `normalizeTab`, `renderTabs` (canManage gate), `renderStockTable`
    (removed direct adjust buttons), `renderLotsTable` (request buttons, XSS), modals
    (hidden inputs, escaping, warehouse filter), `renderRequestsTable` (status labels,
    empty state), `inventory-api.js` functions, `warehouse-api.js` functions,
    `inventory-requests.js` view structure, `index.html` load order, `app.js` routing.
  - `products-view-characterization.test.js`: button hidden with stock, button shown without stock.
- **Impact:** Strong behavioral characterization across migration, service guards, and UI rendering.
- **Recommendation:** No action on these tests. Address the missing schema and execute-happy-path tests separately.

---

# Maintainability Findings

### AUD-IR-MAINT-001 — `createInventoryRequest` Uses Direct Prisma Instead of Repository
- **ID:** AUD-IR-MAINT-001
- **Severity:** Low
- **Category:** Maintainability / Architecture
- **Location:** `src/services/inventory-requests.service.js` (lines 196, 206)
- **Evidence:**
  ```javascript
  const lot = await prisma.lot.findFirst({ where: { id: body.lotId, companyId } });
  const existing = await prisma.inventoryRequest.findFirst({
    where: { lotId: body.lotId, companyId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
  });
  ```
  These are the only two direct `prisma.*` calls in the service (outside of `prisma.$transaction`
  for TRANSFER). All other repository interactions use `inventoryRequestsRepository.*`.
- **Impact:** Minor: these calls are not injectable via the `db` parameter pattern, reducing
  testability. The service test stubs `prisma.lot.findFirst` and `prisma.inventoryRequest.findFirst`
  directly, which works but is less clean than repository injection.
- **Recommendation:** Add `findLotForRequest(lotId, companyId)` and
  `findActiveRequestForLot(lotId, companyId)` to the repository, and update the service
  to use those.

### AUD-IR-MAINT-002 — `_executePartialTransfer` Is a Private Internal Helper with No Abstraction Boundary
- **ID:** AUD-IR-MAINT-002
- **Severity:** Suggestion
- **Category:** Maintainability
- **Location:** `src/services/inventory-requests.service.js` (lines 74–190)
- **Evidence:** `_executePartialTransfer` is a module-private function (underscore convention)
  that replicates the logic of `transferInventory` to support cross-lot transfers. The function
  is large (~115 lines) but well-documented. The JSDoc comment explicitly states this is the
  R-001 resolution and why the public `transferInventory` is not used.
- **Impact:** If `transferInventory` or `inventory-transaction-support.service.js` internals
  change, `_executePartialTransfer` may silently diverge. No tests exercise the function directly.
- **Recommendation:** Accept as-is for now. Document in `decisions.md` that a future refactor
  could expose `transferInventoryWithNewLot` from `inventory.service.js` and eliminate
  `_executePartialTransfer`.

### AUD-IR-MAINT-003 — Duplicate `'📋'` Icon in Warehouse Tab Bar
- **ID:** AUD-IR-MAINT-003
- **Severity:** Suggestion
- **Category:** Maintainability / UX
- **Location:** `src/public/warehouse/app.js` (TAB_DEFINITIONS)
- **Evidence:**
  - `recipe-consultation` tab: `icon: '📋'`
  - `inventory-requests` tab: `icon: '📋'`
- **Impact:** Two tabs with identical icons reduce visual distinguishability in the warehouse SPA.
- **Recommendation:** Use a distinct icon for inventory-requests (e.g., `'📬'` or `'🔄'`).

---

# Technical Debt

| ID | Item | Severity | Effort |
|---|---|---|---|
| AUD-IR-DB-004 | Race condition on ADJUSTMENT double-execute | Medium | Low (updateMany + count check) |
| AUD-IR-API-002 | Missing Zod validation on /execute route | Medium | Low (add validate middleware) |
| AUD-IR-API-004 | ADJUSTMENT execute returns different response shape | Low | Low (add findRequestById re-fetch) |
| AUD-IR-DB-002 | Missing FK on result_operation_id | Low | Low (additive migration) |
| AUD-IR-SEC-004 | updateRequestStatus ignores companyId in WHERE | Low | Low (add to where clause) |
| AUD-IR-DB-005 | lot.quantity vs warehouse stock for partial transfer | Medium | Medium (load WarehouseLotStock) |
| AUD-IR-TEST-001 | Schema test file missing | High | Medium (write 16 tests) |
| AUD-IR-TEST-002 | Happy-path execute tests missing | Low | Medium (stub adjustStock + tx) |
| AUD-IR-MAINT-001 | Direct Prisma calls in service | Low | Low (extract to repository) |
| AUD-IR-API-003 | Cancel not in admin UI | Low | Low (add button + handler) |

---

# Behavior to Preserve

The following behaviors are correctly implemented and must be preserved:

1. **Tenant isolation via `authScope(auth)`** — `companyId` always derived from JWT, never from
   client input. Enforced in all 6 service functions.

2. **Duplicate-request guard** — One active request per lot at a time
   (`status IN ['PENDING', 'IN_PROGRESS']`). Returns 409 on duplicate.

3. **TRANSFER same-warehouse guard** — 400 error when `sourceWarehouseId === destinationWarehouseId`.
   Applied at both Zod schema level (superRefine) and service level.

4. **Lot-product consistency check** — 400 error when `lot.productId !== body.productId`.
   Prevents mismatched lot/product combinations.

5. **Status machine enforcement** — PENDING → IN_PROGRESS (pickup, TRANSFER only) → COMPLETED;
   PENDING → CANCELLED. Each transition checks the expected current status before proceeding.

6. **OI-002: Operator identity from auth** — `assignedToUserId` set from `auth.sub`, not from
   client body. Tested and verified.

7. **Partial transfer child-lot creation** — Sequential `-T001`, `-T002`, ... suffix via
   `findMaxTransferSuffixForLot`. Child lot inherits `expirationDate`, `qaStatus`, `productionDate`,
   `manufacturerLotNumber`, `supplierId`, `casNumber` from parent. Starts with `quantity: 0`.

8. **`canManage` gate for Solicitudes tab** — Admin tab visible only when `inventory.manage`
   permission is present in session.

9. **Operator tab guard** — `inventory-requests` tab in warehouse SPA guarded by
   `inventory.requests.execute` permission.

10. **XSS escaping** — All user-derived content escaped via `esc()` (warehouse) and
    `escapeHtml()` (root admin).

11. **Advisory lock in `_executePartialTransfer`** — `acquireCompanyInventoryAdvisoryLock`
    called before stock mutations.

12. **Migration backfill** — `inventory.requests.execute` permission backfilled to `admin` and
    `bodega_prueba` roles with `ON CONFLICT DO UPDATE`.

13. **`hasExistingStock` guard** — "Registrar inventario inicial" button hidden when
    `quantity > 0 || reservedQuantity > 0`.

14. **BigInt serialization** — All BigInt fields converted to strings via `serializeRequest()`
    before returning responses.

15. **Pagination support** — `listInventoryRequests` supports `parsePaginationQuery` and returns
    `buildPaginatedResponse` when pagination params are present.

---

# Known Defects

### DEF-IR-001 — Double-Execution of ADJUSTMENT Requests (Race Condition)
- **Severity:** Medium
- **Observable behavior:** Two concurrent `POST /requests/:id/execute` calls for an ADJUSTMENT
  request can both proceed past the `status: PENDING` check, both calling `adjustStock()`,
  resulting in double adjustment.
- **Root cause:** `updateRequestStatus({ where: { id } })` without status filter.
- **Not a design intention:** `risks.md` §R-008 explicitly listed this as a required mitigation.

### DEF-IR-002 — ADJUSTMENT Execute Response Missing Nested Relations
- **Severity:** Low
- **Observable behavior:** `POST /requests/:id/execute` for ADJUSTMENT type returns a serialized
  object without `lot`, `product`, `sourceWarehouse`, `requestedByUser` nested fields. The
  TRANSFER path returns a fully populated response.
- **Root cause:** ADJUSTMENT path uses `updateRequestStatus()` return value directly; TRANSFER
  path re-fetches with `findRequestById()`.

### DEF-IR-003 — `inventory.request.execute` Audit Event Missing for ADJUSTMENT
- **Severity:** Medium
- **Observable behavior:** Executing a TRANSFER request logs `inventory.request.execute` audit
  event. Executing an ADJUSTMENT request does NOT log this event. Only the inner `adjustStock`
  call logs a stock-level audit event.
- **Root cause:** `audit.recordAuditEventIfAvailable` is only called in the TRANSFER branch.

---

# Architectural Debt

### ARCH-IR-001 — `_executePartialTransfer` Duplicates Core of `transferInventory`
- **Severity:** Medium (future risk)
- **Description:** The private function replicates the internal logic of `inventory.service.js`'s
  `transferInventory` (warehouse stock updates, lot stock updates, lot total updates, movement
  creation) to support cross-lot transfers. Changes to the transfer logic in either place could
  silently diverge.
- **Status:** Documented in implementation report as a known deviation (R-001 resolution).
- **Mitigation path:** Expose `transferInventoryWithNewLot(sourceLotId, destinationLotId, ...)` from
  `inventory.service.js` and have both the request service and the transfer route use it.

### ARCH-IR-002 — Direct Prisma Client Usage in Service (Two Calls)
- **Severity:** Low
- **Description:** `createInventoryRequest` uses `prisma.lot.findFirst` and
  `prisma.inventoryRequest.findFirst` directly. The rest of the service uses repository functions.
- **Not a regression:** Other services also access `prisma` directly for some operations.

---

# Unknown Behavior

### UNK-IR-001 — Behavior of `lot.quantity` When Lot Spans Multiple Warehouses
- **Description:** The partial transfer decision (`requestQty >= lotQty`) compares against
  `lot.quantity` (global total across all warehouses). The actual behavior when the lot is
  distributed across multiple warehouses is unknown without a live database test. The spec
  documents R-006 but the implementation does not fully resolve it.
- **Risk:** Medium. Could produce incorrect lot classification (partial vs. complete).

### UNK-IR-002 — Behavior of `executeAdjustmentRequestSchema` When `actualQuantity` Is Missing
- **Description:** `executeAdjustmentRequestSchema` requires `actualQuantity: z.number().positive()`,
  `direction: z.enum(['IN', 'OUT'])`, `reasonCode: z.string().trim().min(2).max(80)`. Since this
  schema is NOT applied at the route level, and the service does not validate, what `adjustStock()`
  does when these are undefined/null is untested.
- **Risk:** Low-Medium. Could produce NaN quantities or missing required fields in stock movements.

### UNK-IR-003 — Concurrent Pickup by Two Operators
- **Description:** If two warehouse operators simultaneously try to pick up the same TRANSFER
  request, both can read `PENDING` and both proceed through `pickupTransferRequest()`. Only one
  will win the eventual `update({ where: { id } })` but the behavior of the second (does Prisma
  return an error, or just overwrite?) is not tested.
- **Risk:** Low. Second operator would overwrite `assignedToUserId`, which may be acceptable.

---

# Critical Risks

No Critical severity risks are identified in this spec. The highest-risk items are:

1. **AUD-IR-TEST-001** (High): Missing schema test file — inflated test count claim, Zod
   coverage gap for 5 schemas.

2. **AUD-IR-DB-004** (Medium): Race condition on ADJUSTMENT double-execute — documented
   but not mitigated. Low probability in normal operation but no DB-level protection exists.

3. **AUD-IR-API-002** (Medium): Missing Zod validation on execute route — untyped body
   reaches `adjustStock()`.

---

# Recommended Priorities

## Immediate (before next deployment to production)

1. **[High] Create `tests/inventory-requests-schema.test.js`** — Write 16 tests covering
   all 5 Zod schemas, especially `createInventoryRequestSchema.superRefine` TRANSFER branches.
   Update implementation report to reflect 64 existing tests, then 80 after this file is added.

2. **[Medium] Add Zod validation to `/requests/:id/execute` route** — Apply
   `executeAdjustmentRequestSchema` for ADJUSTMENT path, or a unified schema with type
   branching. The schemas are already defined; only the route middleware is missing.

3. **[Medium] Add `inventory.request.execute` audit event in ADJUSTMENT path** — Mirror the
   TRANSFER audit event to ensure complete request-lifecycle traceability.

## Short Term (next sprint)

4. **[Medium] Add optimistic status lock to `updateRequestStatus`** — Replace
   `update({ where: { id } })` with `updateMany({ where: { id, status: expected } })`
   and throw 409 when `count === 0`. Resolves R-008.

5. **[Low] Fix ADJUSTMENT execute response shape** — Add `findRequestById` re-fetch after
   ADJUSTMENT completes to return fully populated response (matching TRANSFER behavior).

6. **[Low] Add cancel action to admin UI** — Wire `cancelInventoryRequest` to a cancel
   button in `renderRequestsTable` and a submit handler in `inventory-admin.js`.

## Follow-up (tech debt backlog)

7. **[Medium] Use `WarehouseLotStock.quantity` for partial transfer decision** — Replace
   `lot.quantity` with source-warehouse-specific stock (resolves R-006).

8. **[Low] Add FK constraint on `result_operation_id`** — Additive migration.

9. **[Low] Move direct Prisma calls in `createInventoryRequest` to repository** — Extract
   `findLotForRequest` and `findActiveRequestForLot` functions.

10. **[Low] Fix `companyId` in `updateRequestStatus` WHERE clause** — Include or remove
    the misleading parameter.

11. **[Suggestion] Fix duplicate icon** — Use distinct icon for `inventory-requests` tab.

---

*Produced by: baseline-audit-agent-78368f*
*Scope: specs/inventory-requests/ — implementation completed 2026-10-29*
*Prior baseline: baseline-audit-agent-72001f, Overall Score: 9.6/10*
