# Current Code Audit — post-audit-hardening cycle
**Agent ID:** baseline-audit-agent-748380
**Audit scope:** Full repository re-audit following seven fixes applied since the prior baseline (score 8.1/10):
- AUD-025 (Medium): `GET /api/roles/company/:roleId` added to `docs/runtime-endpoint-catalog.md`
- AUD-002 (Low): `docs/current-state.md` §7 updated with `Client.creditLimit`, `Client.creditBalance`, `ClientStore.creditLimit`, `ClientStore.creditBalance`; §8 updated with `GET /api/clients/:id/ledger` and TASK-015 credit lifecycle description
- AUD-005 (Low): Comment added to `computeRecollectedBalances` in `recipes-admin.version-editor.js` documenting floating-point precision limitation and Decimal.js upgrade path
- AUD-013 (Low): New test added — `approveRecipeVersion` rejects when one product is fully allocated but another is partially allocated (multi-product under-allocation)
- AUD-014 (Low): Comment added to `root-shell-recipes-admin-view-characterization.test.js` documenting the DOM execution gap and E2E future path
- AUD-016 (Low): Comment added clarifying that legacy fixtures without `stageType` are intentional backward-compat cases
- AUD-019 (Low): `assertRecipeStageLineageAndAllocation` exported via `__private__` in `recipe.service.js`

**Prior audit agent:** baseline-audit-agent-20ddf6
**Prior audit score:** 8.1 / 10 — Acceptable
**Audit date:** 2026
**Test suite at audit time:** 1 542 pass · 0 fail · 3 skipped (DB-gated) · 1 545 total
**ESLint:** 0 warnings. **TypeScript typecheck:** clean.
**Canonical docs:** `docs/current-state.md` describes implemented reality; `docs/architecture.md` describes active runtime architecture.
**Coverage posture:** focused post-implementation baseline audit under the bounded runtime governance model; test suite exercises the observable runtime surface, not exhaustive OpenAPI contract coverage.

---

## Executive Summary

All seven declared fixes have been verified against the live source code and all are correctly implemented. Additionally, three findings open from the prior audit (AUD-027, AUD-028, AUD-029) were resolved between audit cycles and are confirmed closed in this pass. One new Low-severity finding is identified (AUD-030).

**AUD-025 (Medium — CLOSED):** `GET /api/roles/company/:roleId` is present at line 89 of `docs/runtime-endpoint-catalog.md` with the entry `| GET | /api/roles/company/:roleId | Sí | authorizeAccessPolicy('role.company.list') | Obtener rol de compañía por ID | Tenant isolation; devuelve 404 si el rol no pertenece a la compañía |`. The only remaining Medium-severity finding in the prior audit is now closed.

**AUD-002 (Low — CLOSED):** `docs/current-state.md` §7 now lists `Client.creditLimit`, `Client.creditBalance` (migration `20260924020000_add_credit_fields_to_client`), `ClientStore.creditLimit`, and `ClientStore.creditBalance`. Section §8 now includes `GET /api/clients/:id/ledger` and the full TASK-015 credit lifecycle description covering `approvePayment`/`reversePayment` logic at both client and store levels.

**AUD-005 (Low — ACKNOWLEDGED):** Comment block added above `computeRecollectedBalances` in `recipes-admin.version-editor.js` documenting the JavaScript floating-point limitation and the `Decimal.js` upgrade path. Technical debt is now documented in-line; the underlying arithmetic has not changed.

**AUD-013 (Low — CLOSED):** New test `approveRecipeVersion rejects when one product is fully allocated but another is partially allocated (AUD-013, multi-product under-allocation)` confirmed at line 673 of `tests/recipe-service-foundation.test.js`. The test uses productId 20 (Agua: 10 recollected, 10 used → OK) and productId 21 (Sal: 5 recollected, 3 used → fails) and asserts `statusCode 400`, `code 'validation_error'`, and that the error message matches `/Sal/i` (the under-allocated product, not the OK one). The test is precise and meaningful.

**AUD-014 (Low — ACKNOWLEDGED):** Two-line comment added at the top of `root-shell-recipes-admin-view-characterization.test.js` (`AUD-014: These tests exercise source-level structural contracts (regex over source text) and Node vm-sandboxed execution where possible. Full DOM execution would require a headless browser environment (e.g. Playwright) and is tracked as a future E2E concern.`). Gap is now documented; underlying limitation remains.

**AUD-016 (Low — ACKNOWLEDGED):** Comment added at lines 4–6 of `root-shell-recipes-admin-view-characterization.test.js` (`AUD-016: All PROCESSING stage fixtures in this file intentionally omit stageType where they test the legacy backward-compat path (stageType defaults to PROCESSING). All explicitly typed PROCESSING stages include processCode, verified by linting the fixtures.`). The legacy-fixture pattern is now explicitly documented as intentional backward-compat behavior, not an oversight.

**AUD-019 (Low — CLOSED):** `assertRecipeStageLineageAndAllocation` is exported via the `__private__` block at line 629 of `src/services/recipe.service.js`. The export block reads `__private__: { assertAllStageInputsHaveProductId, assertRecipeStageLineageAndAllocation }`. The function is now directly accessible to unit tests without reaching through the full service API.

**Between-cycle resolutions (confirmed in this audit, not in the seven stated fixes):**
- **AUD-027 (Low — CLOSED):** `docs/current-state.md` §14 no longer lists `DEF-PRD-001`. Only `DEF-PRD-002` (manual E2E evidence gap) remains as a known defect. `docs/action-plan.md` §16 Risks marks the process-code catalog item `~~Medium~~ | RESOLVED`. Both stale entries from the prior audit are gone.
- **AUD-028 (Low — CLOSED):** Two AUD-028-labeled tests confirmed in `tests/credit-balance-update-characterization.test.js` at lines 440 and 460: one asserts `tx.clientStore.update` is called once with `{ creditBalance: { decrement: 200 } }` when `clientStoreId` is populated; the other asserts `tx.clientStore.update` is NOT called when the order has no `clientStoreId`. Both branches are now covered.
- **AUD-029 (Low — CLOSED):** `CHANGELOG.md` entry `2026-09-01 — credit-and-catalog-alignment` covers DEF-002, AUD-026, TASK-015, the credit-fields migration, `creditLimit` in `allowedFields`, ledger exposure, and the AUD-028 tests. The prior cycle's operational history is documented.

**Test count:** 1 542 pass vs 1 539 in the prior audit (+3 new passing tests: 1 from AUD-013 multi-product under-allocation + 2 from AUD-028 store-level credit path). Zero failures. Zero ESLint warnings. Clean TypeScript typecheck.

**New finding — AUD-030 (Low):** The seven fixes applied in this cycle (AUD-025, AUD-002, AUD-005, AUD-013, AUD-014, AUD-016, AUD-019) have no corresponding CHANGELOG.md entry. The CHANGELOG's most recent dated entry (`2026-09-01`) covers the prior cycle. This is a Low-severity documentation gap consistent with prior AUD-029.

**Score update: 8.1 → 8.4 / 10 — Acceptable**

---

## Overall Score

**Overall Score: 8.4 / 10**

| Dimension | Prior (8.1) | Current (8.4) | Δ | Notes |
|---|---|---|---|---|
| Backend correctness | 9.2 | 9.2 | — | No backend logic changes in this cycle |
| Tenant isolation | 9.5 | 9.5 | — | Unchanged |
| Frontend correctness | 8.0 | 8.0 | — | AUD-005 comment only; arithmetic unchanged |
| Test coverage | 8.2 | 8.5 | +0.3 | AUD-013 (multi-product under-alloc) + AUD-028 (store-level credit) both resolved |
| Pattern adherence | 8.5 | 8.5 | — | No regressions; structural debt unchanged |
| Security posture | 9.0 | 9.0 | — | No changes |
| Documentation accuracy | 6.9 | 7.8 | +0.9 | AUD-025, AUD-002, AUD-027, AUD-029 all closed; minus AUD-030 (new CHANGELOG gap −0.1) |

**Score derivation:**
- AUD-025 (Medium, closed): +0.10 — the only remaining Medium finding eliminated; endpoint catalog now complete
- AUD-013 (Low, closed via test): +0.05 — multi-product under-allocation edge case now verified
- AUD-028 (Low, closed between cycles): +0.04 — store-level credit path now tested with two targeted assertions
- AUD-019 (Low, closed via export): +0.03 — `assertRecipeStageLineageAndAllocation` now independently testable
- AUD-002 (Low, closed via doc update): +0.03 — credit fields and TASK-015 now in current-state.md
- AUD-027 (Low, closed between cycles): +0.03 — stale DEF-PRD-001 removed from current-state and action-plan
- AUD-029 (Low, closed between cycles): +0.02 — prior cycle operational history now in CHANGELOG
- AUD-005 (Low, acknowledged): +0.01 — floating-point debt now documented in-line
- AUD-014 (Low, acknowledged): +0.01 — DOM execution gap now documented in test file
- AUD-016 (Low, acknowledged): +0.01 — legacy fixture intent now documented in test file
- AUD-030 (Low, new CHANGELOG gap): −0.02 — current cycle's fixes not in CHANGELOG

**Net Δ = +0.29 → rounded to +0.3 → 8.4**

**Verdict: Acceptable.** The codebase continues in good health. All seven declared fixes are correctly implemented. The sole remaining Medium item from the prior audit (AUD-025) is closed. Zero Medium or higher open findings remain. All open items are Low severity: one new finding (AUD-030), two acknowledged technical debts (AUD-005, AUD-014), and two pre-existing structural constraints (DB-001, DB-003). The structural architectural debt of the layered monolith is well-understood and fully documented.

---

## Repository Overview

| Property | Value |
|---|---|
| Language / Runtime | Node.js 24 (CommonJS), TypeScript typecheck only |
| Framework | Express 4.22 |
| ORM | Prisma 5.22 + PostgreSQL |
| Session | Redis (production) / in-memory (dev/test) |
| Test runner | `node:test` (built-in) |
| Total migrations | 68 committed |
| Total test files | 198 |
| Total passing tests | 1 542 (0 fail, 3 DB-gated skipped) |
| ESLint warnings | 0 |
| TypeScript errors | 0 |
| Docker | Multi-stage, non-root user `inventory`, healthcheck on `/health/ready` |

---

## Current Architecture

The system is a **layered Express + Prisma monolith** that simultaneously serves JSON APIs and browser SPAs from one process.

```
HTTP Routes (src/routes/)
  └── Zod validation (src/schemas/)
       └── Service layer (src/services/)         ← business orchestration
            └── Repository layer (src/repositories/)
                 └── Prisma client (src/lib/prisma.js)
                      └── PostgreSQL

Browser SPAs (src/public/root/, src/public/warehouse/, src/public/agent/)
  └── in-repo API wrapper modules
       └── same backend routes via HTTP
```

Active module groupings: Identity & Access · Customer / Company / Roles / Users · Products / Recipes · Inventory / Warehouses / Lots · Production / QA · Procurement / Receipts · Sales / Orders / Billing / Payments · Supplier Quotations.

No event bus, no message queue, no async workers. All writes are synchronous request/response.

---

## Documentation Findings

### DOC-001 — Current cycle fixes absent from CHANGELOG.md
**ID:** AUD-030
**Severity:** Low
**Category:** Missing documentation
**Location:** `CHANGELOG.md`
**Evidence:** The most recent CHANGELOG entry is `2026-09-01 — credit-and-catalog-alignment`, which covers the prior audit cycle. The seven fixes applied in this cycle (AUD-025 endpoint catalog, AUD-002 current-state doc, AUD-005 FP comment, AUD-013 new test, AUD-014 DOM comment, AUD-016 legacy-fixture comment, AUD-019 `__private__` export) have no corresponding CHANGELOG entry. Test count grew from 1 539 to 1 542 (net +3 new passing tests).
**Concern type:** Missing documentation.
**Impact:** Operational history is incomplete for this cycle. Engineers performing triage will not find the AUD-013 test addition or the AUD-019 export in the changelog.
**Recommendation:** Add a dated CHANGELOG entry covering AUD-025 catalog addition, AUD-002 doc refresh, AUD-005/AUD-014/AUD-016 comments, AUD-013 test, and AUD-019 export. Include test-suite delta (1 539 → 1 542).

---

### DOC-002 — Documentation separation assessment (positive)
**Severity:** Informational
**Location:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`
**Assessment:** Documentation separation is in very good shape in this cycle.
- `docs/current-state.md` correctly describes observable current truth. §14 now contains only `DEF-PRD-002` (manual E2E evidence gap); the stale `DEF-PRD-001` entry has been removed. §7 and §8 now accurately reflect the credit lifecycle.
- `docs/architecture.md` correctly describes the active runtime architecture, including known limitations (no domain layer, no formal ports, service-layer coupling). Future proposals are absent from this document.
- `docs/action-plan.md` is the forward-looking tracker. §16 Risks correctly marks the process-code catalog item as `RESOLVED`. §5 Problems-still-open correctly lists only unresolved items (manual E2E evidence gap and service-heavy coupling). No current/future conflation detected.
- `docs/future-architecture.md` is not present, which is correct — no target-state vision has been approved.
- `docs/documentation-ownership-map.md` defines clear canonical vs auxiliary ownership with auto-validated artifacts called out.
**Conclusion:** No penalty. The concern separation is clean and internally consistent. The only documentation gap is AUD-030 (CHANGELOG omission for this cycle).

---

## Main Modules

| Module area | Files | Primary responsibility |
|---|---|---|
| Routes | `src/routes/*.routes.js` (27 files) | HTTP adapter; Zod validation middleware; no business logic |
| Services | `src/services/*.service.js` (40+ files) | Business orchestration, permission checks, serialization |
| Repositories | `src/repositories/*.repository.js` (22 files) | Prisma queries; no business logic |
| Schemas | `src/schemas/*.schema.js` (24 files) | Zod request validation |
| Security | `src/security/` | Permission governance, access policies, role bundles |
| Middleware | `src/middlewares/` | authenticate, authorize, throttle, payload governance |
| Lib | `src/lib/` | money, pagination, audit, Prisma singleton, logging |
| Root SPA | `src/public/root/` | Admin SPA (vanilla JS, no bundler) |
| Warehouse SPA | `src/public/warehouse/` | Operator SPA |
| Agent SPA | `src/public/agent/` | Field-agent mobile SPA |

---

## Main Dependencies

| Package | Version | Role | Notes |
|---|---|---|---|
| `express` | ^4.22.2 | HTTP framework | Stable; no security flags |
| `@prisma/client` | ^5.22.0 | ORM | Current; `prisma` in devDeps |
| `bcrypt` | ^6.0.0 | Password hashing | Updated; supply chain closed |
| `jsonwebtoken` | ^9.0.2 | JWT auth | Current |
| `zod` | ^3.23.8 | Schema validation | Current |
| `dotenv` | ^16.6.1 | Env config | Standard |
| `cors` | ^2.8.5 | CORS | Standard |
| `morgan` | ^1.11.0 | HTTP logging | Standard |
| `body-parser` override | 1.20.6 | CVE mitigation | Pinned via overrides |
| `brace-expansion` override | 1.1.18 | CVE mitigation | Pinned via overrides |

**Dependency hygiene:** `npm audit` baseline is governed. No known unfixed critical CVEs at time of audit; `body-parser` and `brace-expansion` are overridden for known issues. `validate:dependency-hygiene` script is wired into the `verify` pipeline.

---

## Database Findings

### DB-001 — Dual credit balance at client and store levels (pre-existing, unchanged)
**ID:** AUD-DB-001
**Severity:** Low
**Category:** Schema design / consistency risk
**Location:** `prisma/schema.prisma` — `Client` model; `ClientStore` model; `src/services/payment.service.js`
**Evidence:**
- `Client.creditBalance` and `ClientStore.creditBalance` are updated independently in `approvePayment` and `reversePayment`.
- The `ClientStore.creditBalance` path is conditional on `invoice.orderId → order.clientStoreId` being navigable.
- An invoice without `orderId` (nullable in the schema) updates only `Client.creditBalance`, creating a structural asymmetry between client-level and store-level balances.
- No `CHECK (credit_balance >= 0)` constraint exists on either `clients` or `client_stores` tables.
- No enforced relationship ensures `sum(store.creditBalance) == client.creditBalance`.
**Impact:** Silent divergence possible if the invoice-without-orderId path is exercised in production. `creditBalance` can go negative in the database if payment approval precedes order approval.
**Recommendation:** Consider adding a `CHECK (credit_balance >= 0)` DB constraint in a future migration. Document the intended credit-flow sequencing assumption in `docs/current-state.md`. Consider an application-level guard before the decrement.

---

### DB-002 — Additive migrations are consistently safe (positive observation)
**Severity:** —
**Category:** Migration quality
**Location:** `prisma/migrations/`
**Evidence:** All 68 committed migrations use `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN` with safe defaults, or data backfills. No destructive rewrite or column removal detected in the migration history. Decimal precision `(14,2)` is consistent across all monetary columns.
**Impact:** No risk. Migration hygiene is excellent.

---

### DB-003 — No index on `Client.creditBalance` / `Client.creditLimit` (pre-existing, unchanged)
**ID:** AUD-DB-003
**Severity:** Low
**Category:** Missing index
**Location:** `prisma/schema.prisma` — `Client` model
**Evidence:** `creditBalance` and `creditLimit` have no explicit Prisma `@@index`. Current ledger query fetches by `clientId` (PK). No billing dashboard filter/sort by credit exposure is active.
**Impact:** Negligible for current query patterns. Relevant if credit-based dashboards are added later.
**Recommendation:** Defer until a query pattern requiring it is identified.

---

## API Findings

### API-001 — `GET /api/roles/company/:roleId` now present in endpoint catalog (CLOSED)
**Prior ID:** AUD-025 / DOC-004
**Status:** CLOSED this cycle.
**Evidence:** Line 89 of `docs/runtime-endpoint-catalog.md` now reads `| GET | /api/roles/company/:roleId | Sí | authorizeAccessPolicy('role.company.list') | Obtener rol de compañía por ID | Tenant isolation; devuelve 404 si el rol no pertenece a la compañía |`. Route was already implemented and in OpenAPI; catalog omission is now corrected.

---

### API-002 — `ClientStore.update` inside payment approval does not re-scope by `companyId` (pre-existing, Low)
**ID:** AUD-API-002
**Severity:** Low
**Category:** Pattern deviation
**Location:** `src/services/payment.service.js` — `approvePayment`
**Evidence:** `tx.clientStore.update({ where: { id: invoiceOrder.clientStoreId }, data: ... })` uses only `id` as the WHERE clause. Company scope is inherited transitively from the invoice→client scope validated earlier in the transaction rather than from an explicit `companyId` predicate.
**Impact:** Not a practical security issue in the current flow. Becomes a risk if the service is extended to accept external `orderId` inputs.
**Recommendation:** Low priority. Consider adding `companyId` to the WHERE clause for pattern consistency, or document the scope-provenance assumption in a comment.

---

## Container Findings

No changes to Docker configuration detected in this cycle. All prior findings remain valid:
- Multi-stage `Dockerfile`; non-root user `inventory`; healthcheck targets `/health/ready` via `node -e "..."` inline HTTP probe.
- `docker-compose.dev.yml` is explicitly marked dev-only with Postgres and Redis health checks.
- `docker-compose.prod.yml` available for production deployment.
- No secrets or credentials hard-coded in any Dockerfile or compose file.
- `.dockerignore` present.

No new container findings.

---

## Security Findings

No security-relevant changes introduced in this cycle. All seven fixes are documentation, comment, test, or export changes with no impact on authentication, authorization, tenant isolation, or data validation.

The security posture from the prior audit remains:
- Bearer-authenticated actor context enforced at route layer.
- Permission-based route protection via `authorizeAccessPolicy` / `authorizePermission`.
- Company scoping derived from `auth.companyId` (not from client payload) in all service entrypoints.
- `creditBalance` is absent from `buildClientPayload` `allowedFields` — direct client-form manipulation is prevented by design.
- AUD-028 (store-level credit path coverage) is now closed; both branches of the `clientStoreId` conditional are tested.
- Residual HTTPS enforcement for browser sessions is tracked separately under `specs/p11-https-browser-session-migration/` and remains outside this cycle's scope.

---

## Testing Findings

### TEST-001 — Multi-product under-allocation test confirmed (CLOSED — AUD-013)
**Severity:** —
**Status:** CLOSED.
**Location:** `tests/recipe-service-foundation.test.js` line 673
**Evidence:** Test `approveRecipeVersion rejects when one product is fully allocated but another is partially allocated (AUD-013, multi-product under-allocation)` is correctly structured with two products, one fully allocated and one under-allocated, and asserts `statusCode 400`, `code 'validation_error'`, error message containing the under-allocated product name (Sal), and that the message matches `/sin asignar|asign|aloc/i`. The assertion against the under-allocated product by name (not just any product) is precise and meaningful.

---

### TEST-002 — Store-level creditBalance path now tested (CLOSED — AUD-028)
**Severity:** —
**Status:** CLOSED.
**Location:** `tests/credit-balance-update-characterization.test.js` lines 440–475
**Evidence:** Two tests labeled `AUD-028`:
1. `approvePayment decrements ClientStore.creditBalance when invoice has orderId → clientStoreId` — asserts `storeUpdateCalls.length === 1`, correct `where.id`, and `data: { creditBalance: { decrement: 200 } }`.
2. `approvePayment skips ClientStore.creditBalance when order has no clientStoreId` — asserts `storeUpdateCalls.length === 0`.
Both branches of the `invoiceOrder?.clientStoreId` conditional are now exercised.

---

### TEST-003 — Pre-existing acknowledged items (unchanged)
**Severity:** Low
**Location:** Various
**Items:**
- **AUD-005:** `computeRecollectedBalances` uses JavaScript `Number` arithmetic. Comment now documents the limitation and the Decimal.js upgrade path. Technical debt remains; no functional regression.
- **AUD-014:** Frontend characterization tests in `root-shell-recipes-admin-view-characterization.test.js` exercise source-level patterns via Node `vm` sandbox, not a live DOM. Comment now documents this as a known gap with Playwright as the future E2E path. Debt acknowledged; no change.
- **AUD-016:** Older PROCESSING-stage fixtures in lineage tests omit `stageType`. Comment now documents these as intentional backward-compat cases. Pattern is clarified; no change.

---

### TEST-004 — Test suite health summary
**Severity:** —
**Observation:** 1 542 pass, 0 fail, 3 skipped (DB-gated). Net +3 passing tests since the prior audit: 1 from AUD-013 (multi-product under-allocation) and 2 from AUD-028 (store-level credit path). Zero failures. Zero ESLint warnings. Clean TypeScript typecheck. The `verify` script chains lint → typecheck → public-runtime lint → validators → build → test. Suite is in excellent shape.

---

## Maintainability Findings

### MAINT-001 — Service layer mixes orchestration, business rules, and serialization (pre-existing, structural)
**Severity:** Low (architectural debt, not a defect)
**Location:** `src/services/payment.service.js`, `src/services/production.service.js`, others
**Evidence:** `approvePayment` performs permission assertion → lifecycle assertion → overpayment check → payment approval → credit balance update → invoice financial state synchronization → audit recording — all in one function. `production-execution.service.js` similarly combines inventory lookup, same-lot validation, stock mutation, movement recording, and stage fact persistence.
**Impact:** High cognitive load per function; difficult to test pure business rules in isolation without stubbing the full transaction machinery.
**Recommendation:** Tracked as architectural debt. No actionable change in this cycle.

---

### MAINT-002 — `docs/current-state.md` now requires multi-cycle structure
**Severity:** Low
**Location:** `docs/current-state.md`
**Evidence:** The document has grown across multiple cycles and now covers QA/production amendments, credit lifecycle, and general system overview. There is no per-section "last updated" marker. Readers cannot easily determine which cycle introduced which content.
**Impact:** The document remains accurate but becomes harder to maintain as a living reference as the system grows.
**Recommendation:** Consider adding a `> Last updated:` block per major section or a header table summarizing which cycle last touched each section.

---

## Technical Debt

| ID | Severity | Area | Description | Status |
|---|---|---|---|---|
| AUD-005 | Low | Frontend | Floating-point precision in `computeRecollectedBalances`; comment added | Acknowledged |
| AUD-014 | Low | Testing | Frontend characterization tests are source-level, not DOM execution; comment added | Acknowledged |
| AUD-016 | Low | Testing | Legacy PROCESSING fixtures omit `stageType` for backward-compat; comment added | Acknowledged (intentional) |
| AUD-030 | Low | Documentation | CHANGELOG.md not updated for the current cycle's seven fixes | Open |
| AUD-DB-001 | Low | Schema | Dual credit balance at client and store levels; no `CHECK (credit_balance >= 0)` constraint | Open |
| AUD-DB-003 | Low | Schema | No index on `Client.creditBalance` / `Client.creditLimit` | Open |
| AUD-API-002 | Low | Pattern | `tx.clientStore.update` inside payment approval uses only `id` in WHERE; company scope inherited transitively | Open |
| MAINT-001 | Low | Architecture | Service layer mixes orchestration, rules, and serialization | Open (structural) |
| MAINT-002 | Low | Documentation | `docs/current-state.md` lacks per-section update markers as it grows across cycles | Open |
| DEF-PRD-002 | Medium | Testing / Ops | Manual end-to-end evidence for replacement recovery → same-lot execution → reconciliation flow is incomplete in repository docs | Open |

**Closed since prior audit:**

| ID | Severity | Area | Resolution |
|---|---|---|---|
| AUD-025 | Medium | Documentation | `GET /api/roles/company/:roleId` added to endpoint catalog |
| AUD-002 | Low | Documentation | `current-state.md` §7 and §8 updated with credit fields and TASK-015 |
| AUD-013 | Low | Testing | Multi-product under-allocation test added |
| AUD-019 | Low | Testability | `assertRecipeStageLineageAndAllocation` exported via `__private__` |
| AUD-027 | Low | Documentation | `DEF-PRD-001` removed from current-state.md and action-plan.md |
| AUD-028 | Low | Testing | Two AUD-028 tests covering both branches of store-level credit path |
| AUD-029 | Low | Documentation | CHANGELOG updated for the credit-and-catalog-alignment cycle |

---

## Behavior to Preserve

1. **Company-scoped data access.** Every service function derives `companyId` from `auth.companyId` (not from client payload). Tenant cross-contamination is systematically prevented.
2. **Payment lifecycle state machine.** `PENDING_APPROVAL → UNDER_REVIEW → APPROVED → REVERSED` with `REJECTED` as a terminal from PENDING/UNDER_REVIEW. `payment-lifecycle-support.service.js` lifecycle assertions must gate all transitions.
3. **Credit balance increments on order APPROVED.** `inventory.service.js` `reserveStockForOrder` increments `Client.creditBalance` when `clientId && orderAmount > 0`. This is the source-of-truth for the balance growing.
4. **Credit balance decrements on payment APPROVED.** `payment.service.js` `approvePayment` decrements `Client.creditBalance` inside the Prisma transaction.
5. **Credit balance restores on payment REVERSED.** `reversePayment` increments `Client.creditBalance` by the original payment amount inside the Prisma transaction.
6. **Dual-level credit update when orderId is present.** When a payment's invoice has an `orderId` and that order has a `clientStoreId`, both `Client.creditBalance` and `ClientStore.creditBalance` are updated symmetrically.
7. **`creditBalance` is NOT settable via client form.** `buildClientPayload` deliberately excludes `creditBalance` from `allowedFields`. Only programmatic modification is permitted.
8. **`creditLimit` is settable via client form.** `buildClientPayload` includes `creditLimit` in `allowedFields` and `numericFields`.
9. **`getClientLedger` exposes both `creditLimit` and `creditBalance` as `Number`.** Prisma `Decimal` values are converted with `Number()` and guarded with `!= null`.
10. **PROCESS_CODE_OPTIONS frontend catalog is a safe subset of backend `RECIPE_STAGE_PROCESS_CODES`.** All 8 frontend options (`MIXING`, `HEATING`, `COOLING`, `CAPPING`, `SEALING`, `LABELING_PREP`, `PACKING_PREP`, `OTHER`) are accepted by the backend Zod enum.
11. **Availability hints in the recipe editor recompute live.** Both `productSelect change` events and `input` events on prior RECOLLECTION `.si-quantity` elements call `updateAvailHint()`. The `data-hint-wired` flag prevents duplicate listener registration.
12. **Production execution lineage validation on both create and update paths.** `recipe.service.js` calls `assertRecipeStageLineageAndAllocation` when `payload.stages` is present in `updateRecipeVersion`, not only on `createRecipeVersion`.
13. **Multi-product under-allocation blocks recipe version approval.** `approveRecipeVersion` rejects with `statusCode 400` if any recollected product has unallocated quantities, even when other products are fully allocated.
14. **Payment approval transaction atomicity.** `executePaymentFinancialSyncTransaction` wraps payment status update, credit balance update, and invoice financial state synchronization in a single `prisma.$transaction`.
15. **Legacy `VIRTUAL_RECOLECTION` compatibility.** Existing production recolection stages without `recoveryType` default to `VIRTUAL_RECOLECTION` and continue to function without modification.
16. **Soft delete on clients.** `clientRepository.softDeleteCompanyClient` sets `deletedAt` rather than hard-deleting. All client lookups apply `buildDefaultClientWhere({ deletedAt: null })`.
17. **Legacy recipe stages without `stageType` are treated as `PROCESSING`.** Serialization and service logic default `stageType` to `PROCESSING` when the field is absent, preserving backward compatibility with older data.

---

## Known Defects

### DEF-PRD-002 — Manual end-to-end evidence gap for amended warehouse flow (pre-existing, Medium)
**Severity:** Medium
**Location:** `docs/current-state.md` §14; warehouse SPA production controllers
**Evidence:** `docs/current-state.md` §14 explicitly records that manual validation evidence for the full replacement recovery → same-lot execution → reconciliation workflow is incomplete. Automated service and migration tests exist and pass, but the repository does not include completed manual operator walk-through evidence for this flow.
**Impact:** Implementation is test-backed at the service level. Operational completeness for warehouse operators cannot be confirmed from repository evidence alone.
**Recommendation:** Conduct and document a structured manual test session covering the five validation steps listed in `docs/action-plan.md` §18 (steps 1–5). Record results in a `specs/` evidence document or `docs/production-operations-runbook.md` update.

---

No functional defects were identified in the seven changes applied this cycle. DEF-PRD-002 is the only open non-Low finding and it is unchanged from prior audits.

---

## Architectural Debt

1. **Service layer as God-layer.** Services in `src/services/` mix permission enforcement, business rules, persistence coordination, response serialization, and audit recording. `payment.service.js` `approvePayment` and `production-execution.service.js` `executeStage` exemplify this with six or more distinct responsibilities per function. Structural constraint of the current layered monolith; not a defect but imposes long-term maintenance cost.

2. **Direct Prisma transaction access in service layer.** `approvePayment` and `reversePayment` use `tx.invoice.findUnique`, `tx.client.update`, `tx.order.findUnique`, and `tx.clientStore.update` directly rather than via repository functions. This bypasses the repository abstraction for cross-entity transactional reads. The repository pattern is not consistently enforced within transaction boundaries.

3. **No application-level credit balance floor constraint.** There is no `CHECK (credit_balance >= 0)` at the DB level and no application-level guard preventing `creditBalance` from going negative if payment approval precedes order approval. The intended flow sequencing (order → credit increment; payment → credit decrement) is not enforced by schema constraints.

4. **Frontend SPA delivered from same process.** The root-shell admin SPA, warehouse SPA, and agent SPA are all served as static files from the same Express process as the API. Functional but limits independent scaling and deployment of SPA vs API.

5. **No integration constraint between `ClientStore.creditBalance` and `Client.creditBalance`.** The system does not enforce that the sum of store-level balances equals the client-level balance. Invoice paths without `orderId` update only the client-level balance, creating silent divergence potential.

6. **No explicit domain layer.** Business rules for Production, Quality, Inventory, and Billing live inside service modules rather than in a dedicated domain layer with explicit policies or value objects. The service files are well-organized but remain coupled to Prisma models and HTTP context.

7. **QA relevant-input scope computed dynamically.** The relevant-input scope for a rejected stage is recomputed on demand rather than persisted as an immutable audit snapshot. This is a documented open decision in `docs/architecture.md` §14 and `docs/action-plan.md` §14.

---

## Unknown Behavior

1. **Manual end-to-end evidence for replacement recovery → same-lot execution → reconciliation.** The automated test suite covers the service layer for this flow. Manual operator walk-through evidence in the repository docs is explicitly noted as incomplete in `docs/current-state.md` §14.

2. **Behavior when `ClientStore.creditBalance` and `Client.creditBalance` diverge silently.** The UI surfaces `client.creditBalance` in the billing view and `store.creditBalance` in the store context. What the UI displays or validates when these diverge cannot be confirmed from code inspection alone.

3. **Behavior of `getClientLedger` when `creditLimit` or `creditBalance` is `null` on a legacy client.** The `!= null` guard returns `null` in those cases. Whether the billing UI handles `null` gracefully is inferred from spec docs but not confirmed by a live DOM test.

---

## Critical Risks

| Risk | Level | Status | Notes |
|---|---|---|---|
| Process-code catalog drift (DEF-002 / AUD-020) | ~~Medium~~ | **CLOSED** (prior cycle) | Frontend now uses only valid backend codes |
| Availability hint stale snapshot (AUD-018) | ~~Medium~~ | **CLOSED** (prior cycle) | Fixed; `input` listeners wired |
| `updateRecipeVersion` lineage path untested (AUD-012) | ~~Medium~~ | **CLOSED** (prior cycle) | Fixed |
| `GET /api/roles/company/:roleId` absent from catalog (AUD-025) | ~~Medium~~ | **CLOSED this cycle** | Endpoint catalog now complete |
| Multi-product under-allocation untested (AUD-013) | ~~Low~~ | **CLOSED this cycle** | Test added and confirmed |
| `assertRecipeStageLineageAndAllocation` not exported (AUD-019) | ~~Low~~ | **CLOSED this cycle** | Exported via `__private__` |
| `current-state.md` stale credit fields (AUD-002) | ~~Low~~ | **CLOSED this cycle** | §7 and §8 updated |
| Store-level credit path untested (AUD-028) | ~~Low~~ | **CLOSED between cycles** | Two tests confirmed |
| `current-state.md` / `action-plan.md` stale DEF-PRD-001 (AUD-027) | ~~Low~~ | **CLOSED between cycles** | Stale entries removed |
| CHANGELOG not updated for prior cycle (AUD-029) | ~~Low~~ | **CLOSED between cycles** | CHANGELOG entry added |
| Manual E2E evidence gap (DEF-PRD-002) | Medium | **Open** | Service tests exist; manual validation incomplete |
| `creditBalance` can go negative with no DB constraint (AUD-DB-001) | Low | **Open** | No functional regression yet |
| CHANGELOG not updated for current cycle (AUD-030) | Low | **Open** | New finding |

---

## Recommended Priorities

1. **(Low — Documentation)** Add a CHANGELOG.md entry for this cycle (AUD-025 catalog, AUD-002 doc refresh, AUD-005/AUD-014/AUD-016 comments, AUD-013 test, AUD-019 export, test suite delta 1539→1542). See AUD-030.

2. **(Medium — Testing / Ops)** Conduct and record a structured manual validation session for the replacement recovery → same-lot execution → reconciliation warehouse operator flow. The five validation steps in `docs/action-plan.md` §18 provide the test script. See DEF-PRD-002.

3. **(Low — Schema)** Consider adding a `CHECK (credit_balance >= 0)` constraint to `clients` and `client_stores` in a future additive migration, or add an application-level guard before the `decrement` operation. See AUD-DB-001.

4. **(Low — Pattern)** Add `companyId` to the `tx.clientStore.update` WHERE clause in `payment.service.js` `approvePayment` for pattern consistency with the repository convention. See AUD-API-002.

5. **(Low — Documentation)** Add per-section update markers or a last-updated header table to `docs/current-state.md` to support multi-cycle maintenance. See MAINT-002.

6. **(Low — Frontend)** Evaluate `Decimal.js` for recipe quantity accumulation in `computeRecollectedBalances` if recipes with highly fractional quantities become common. See AUD-005.

7. **(Low — Testing)** Consider adding a Playwright-based E2E test for the recipe editor's RECOLLECTION → PROCESSING availability hint flow to supplement the current source-level characterization tests. See AUD-014.
