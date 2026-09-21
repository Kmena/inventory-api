# Tasks

> Last refreshed: Post MASTER-032 architecture documentation refresh.
> All previously completed tasks (TASK-201 through TASK-212 and MASTER-001 through MASTER-031) are archived below in §Completed.
> New proposed tasks start from TASK-301.

---

## Completed tasks (archived)

### Master Plan (MASTER-001 through MASTER-031)
All 31 implementation tasks from `specs/inventori-product-inventory-master-plan/tasks.md` are **Completed** and validated.
- Wave 0: MASTER-001 (product capability foundation), MASTER-002 (capability schema enforcement)
- Wave 1: MASTER-003 (InvoiceItem schema), MASTER-004 (FULFILLED status), MASTER-005 (system lots + location fields + InventoryOperation), MASTER-006 (inventory permissions), MASTER-007 (entitlement permissions)
- Wave 2: MASTER-008 (InvoiceItem generation), MASTER-009 (per-line approval), MASTER-010 (per-line dispatch), MASTER-011 (agent catalog), MASTER-012 (product inventory strategy), MASTER-013 (stock API), MASTER-014 (lots/history API)
- Wave 3: MASTER-015 (entitlement lifecycle), MASTER-016 (activation orchestrator), MASTER-017 (initial inventory), MASTER-018 (product inventory config), MASTER-019 (location lifecycle), MASTER-020 (allowedWarehouseIds)
- Wave 4: MASTER-021 (inventory workspace frontend), MASTER-022 (product UX), MASTER-023 (ubicaciones UX), MASTER-024 (client entitlement section), MASTER-025 (billing/dispatch frontend)
- Wave 5: MASTER-026 (adjustments), MASTER-027 (transfers)
- Wave 6: MASTER-028 (regression hardening), MASTER-029 (runtime contract), MASTER-030 (documentation), MASTER-031 (test baseline)

Final validation: 1944 pass / 3 skipped / 0 failing. `npm run verify`: PASS. Audit baseline: 9.6/10.

### Pre-master-plan tasks (TASK-201 through TASK-212)
All completed. See previous `tasks.md` versions for detail.

---

## Proposed tasks

## TASK-301: Decompose inventory.service.js into focused operation modules
**Status:** Proposed
**Priority:** Medium
**Domain:** Inventory
**Requirement:** Architectural debt reduction (L-004)
**Reason:** `inventory.service.js` at 43.9 KB is the largest service file, mixing stock queries, entry operations, adjustments, transfers, lot management, and alert handling.
**Current problem:** High cognitive load, difficult to test individual operations in isolation, merge conflicts likely when multiple developers work on different inventory operations.
**Proposed change:** Extract into `inventory-stock-query.service.js` (list stocks/lots/movements), `inventory-entry.service.js` (entries, initial inventory), `inventory-adjustment.service.js` (adjustments), `inventory-transfer.service.js` (transfers). Keep `inventory.service.js` as a thin facade or remove it and route directly to specific modules.
**Affected files:** `src/services/inventory.service.js`, `src/routes/inventory.routes.js`, related tests
**Dependencies:** None
**Database impact:** None
**API impact:** None — same endpoints, same contracts
**Container impact:** None
**Security impact:** None
**Acceptance criteria:** All 1944 tests pass. No API contract change. Each new module is ≤15 KB. OpenAPI and runtime contract governance tests pass.
**Required tests:** Characterization tests for each operation before extraction; all existing inventory tests must pass unchanged.
**Migration considerations:** None
**Rollback or mitigation:** Git revert
**Risk:** Low

## TASK-302: Extract product capability rules into pure domain module
**Status:** Proposed
**Priority:** Medium
**Domain:** Products
**Requirement:** Architectural debt reduction (L-001, L-004)
**Reason:** Product capability validation, preset derivation, and inventory applicability checks are scattered across `product.service.js` (31.8 KB), `product.schema.js` (21.5 KB), and `inventory-transaction-support.service.js`.
**Current problem:** Same capability logic duplicated or distributed; no single source of truth for capability business rules.
**Proposed change:** Create `src/domain/product/capability-rules.js` with pure functions: `isInventoryControlled(product)`, `deriveBusinessPreset(capabilities)`, `validateCapabilityCombination(capabilities)`, `deriveLineKind(product)`. Update consumers to import from the domain module.
**Affected files:** `src/services/product.service.js`, `src/services/inventory-transaction-support.service.js`, `src/services/billing-trigger.service.js`, `src/schemas/product.schema.js`
**Dependencies:** None
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** None
**Acceptance criteria:** Pure function module with no framework/infrastructure imports. All 1944 tests pass. Capability validation behavior unchanged.
**Required tests:** Unit tests for each pure function; existing product/inventory tests must pass unchanged.
**Migration considerations:** None
**Rollback or mitigation:** Git revert
**Risk:** Low

## TASK-303: Extract entitlement lifecycle rules into pure domain module
**Status:** Proposed
**Priority:** Medium
**Domain:** Entitlements
**Requirement:** Architectural debt reduction (L-001)
**Reason:** Entitlement status derivation, validity calculation, and transition rules are embedded in `entitlement.service.js` alongside Prisma orchestration.
**Current problem:** Business rules cannot be tested without mocking Prisma.
**Proposed change:** Create `src/domain/entitlement/lifecycle-rules.js` with pure functions: `deriveEntitlementStatus(entitlement, now)`, `calculateEndDate(startDate, validityCount, validityUnit)`, `canCancel(entitlement)`, `canRenew(entitlement)`.
**Affected files:** `src/services/entitlement.service.js`
**Dependencies:** None
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** None
**Acceptance criteria:** Pure function module. All entitlement tests pass unchanged.
**Required tests:** Domain unit tests for each pure function.
**Migration considerations:** None
**Rollback or mitigation:** Git revert
**Risk:** Low

## TASK-304: Establish CI/CD pipeline configuration
**Status:** Proposed
**Priority:** Medium
**Domain:** Infrastructure
**Requirement:** Architectural limitation (L-006)
**Reason:** No CI pipeline exists. Quality gates are manual-only.
**Current problem:** Quality regression can occur between manual verification runs. No automated build/test on pull request.
**Proposed change:** Add `.github/workflows/ci.yml` (or equivalent) that runs `npm run verify` on push/PR. Include Prisma migration drift check.
**Affected files:** New `.github/workflows/ci.yml`, possibly `package.json` for CI-specific scripts
**Dependencies:** None
**Database impact:** CI needs test database provisioning strategy
**API impact:** None
**Container impact:** CI may build and push Docker images
**Security impact:** Positive — automated quality enforcement
**Acceptance criteria:** CI pipeline runs on PR/push and gates on `npm run verify` success.
**Required tests:** Existing test suite runs in CI.
**Migration considerations:** Test database strategy for CI (ephemeral PostgreSQL)
**Rollback or mitigation:** Remove workflow file
**Risk:** Low

## TASK-305: Complete client/store onboarding features (FR-012 through FR-036)
**Status:** Proposed
**Priority:** Low
**Domain:** Customers / Clients
**Requirement:** `client-store-documents-credit-ux` remaining tasks
**Reason:** Client onboarding features FR-012 through FR-036 remain pending: trade type catalog, store-scoped documents, Hacienda wiring, economic-activity completion, and later persistence extensions.
**Current problem:** Client/store onboarding is partially implemented through TASK-008; remaining items are functional follow-ups.
**Proposed change:** Implement remaining client onboarding features per the `client-store-documents-credit-ux` specification.
**Affected files:** Client service, repository, routes, schemas; root shell client admin views
**Dependencies:** None (existing foundation is complete)
**Database impact:** Possible additive columns for `tradeTypeCode`, `tradeTypeLabel`
**API impact:** Possible new fields on existing client/store endpoints
**Container impact:** None
**Security impact:** Low
**Acceptance criteria:** Per `client-store-documents-credit-ux` FR-012 through FR-036 acceptance criteria.
**Required tests:** Per specification test requirements.
**Migration considerations:** Additive migrations only
**Rollback or mitigation:** Git revert; additive migrations are forward-only
**Risk:** Low

## TASK-306: Add characterization tests for large service file decomposition
**Status:** Proposed
**Priority:** Medium
**Domain:** Testing
**Requirement:** Pre-requisite for TASK-301 (service decomposition)
**Reason:** Before decomposing `inventory.service.js`, targeted characterization tests should capture the exact current behavior of each operation path.
**Current problem:** Existing tests cover the operations but may not capture all edge cases needed to verify behavioral equivalence after refactoring.
**Proposed change:** Add characterization tests that exercise each inventory operation through its full service path with representative inputs and verify exact output shapes.
**Affected files:** New test files in `tests/`
**Dependencies:** None
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** None
**Acceptance criteria:** Characterization tests pass against current code.
**Required tests:** Self-contained — these ARE the tests.
**Migration considerations:** None
**Rollback or mitigation:** Remove test files
**Risk:** Low
