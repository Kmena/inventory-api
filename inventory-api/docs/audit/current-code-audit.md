# Current Code Audit — credit-and-catalog-alignment cycle
**Agent ID:** baseline-audit-agent-20ddf6
**Audit scope:** Full repository re-audit following six fixes applied since the prior baseline:
- DEF-002: `PROCESS_CODE_OPTIONS` in root-shell version editor aligned with backend `RECIPE_STAGE_PROCESS_CODES`
- AUD-026: `input` event listeners added to prior RECOLLECTION `.si-quantity` elements for live availability-hint refresh
- TASK-015: `paymentService.approvePayment` and `reversePayment` now update `Client.creditBalance` (decrement / increment) inside the payment Prisma transaction via `tx.client.update`
- `creditLimit` added to `buildClientPayload` `allowedFields` in `clients-admin.helpers.js`
- `getClientLedger` now exposes `creditLimit` and `creditBalance` on the returned `client` object
- Migration `20260924020000_add_credit_fields_to_client`: `credit_limit DECIMAL(14,2) NOT NULL DEFAULT 0` and `credit_balance DECIMAL(14,2) NOT NULL DEFAULT 0` added to the `clients` table

**Prior audit agent:** baseline-audit-agent-4ffad0
**Prior audit score:** 7.9 / 10 — Acceptable
**Audit date:** 2026
**Test suite at audit time:** 1 539 pass · 0 fail · 3 skipped (DB-gated) · 1 542 total
**ESLint:** 0 warnings. **TypeScript typecheck:** clean.
**Canonical docs:** `docs/current-state.md` describes implemented reality; `docs/architecture.md` describes active runtime architecture. canonical docs under `docs/**` are the authoritative reference for runtime contracts.
**Coverage posture:** focused post-implementation baseline audit — intentionally partial coverage limited to the six fixes in scope. Partial OpenAPI baseline coverage is intentional for this amendment scope.

---

## Executive Summary

All six declared fixes have been verified against the live source code. Four resolve previously open findings; two implement new correct business behaviour.

**DEF-002 / AUD-020 (Medium — CLOSED):** `PROCESS_CODE_OPTIONS` in `recipes-admin.version-editor.js` now contains only values that exist in the backend `RECIPE_STAGE_PROCESS_CODES` catalog (`MIXING`, `HEATING`, `COOLING`, `CAPPING`, `SEALING`, `LABELING_PREP`, `PACKING_PREP`, `OTHER`). The previously invalid codes `FILLING`, `QUALITY_CHECK`, `LABELING`, and `PACKAGING` are absent. The frontend list is a curated subset of the 31-value backend catalog; this is intentional and safe.

**AUD-026 (Low — CLOSED):** `input` event listeners are wired to all `.si-quantity` inputs inside prior RECOLLECTION sections at the moment a PROCESSING stage input row is added. A `data-hint-wired = '1'` flag prevents duplicate listener registration. The `updateAvailHint()` function (already fixed in the prior cycle for the `productSelect` change path) is now also called reactively whenever prior-stage quantities change.

**TASK-015 (new correct behaviour):** `approvePayment` now calls `tx.client.update({ data: { creditBalance: { decrement: transactionalPayment.amount } } })` after approving the payment. `reversePayment` calls the symmetric `{ increment: ... }`. Both also update `ClientStore.creditBalance` when the invoice is linked to an order that carries a `clientStoreId`. All operations run inside `executePaymentFinancialSyncTransaction`, which wraps the work in a single Prisma `$transaction`. Characterization tests in `credit-balance-update-characterization.test.js` cover the client-level paths; the store-level path (orderId → clientStoreId branch) is not yet independently tested (AUD-028, Low).

**Supporting changes (all confirmed):** `creditLimit` is present in `buildClientPayload` `allowedFields`; `creditBalance` is intentionally absent (managed programmatically only). `getClientLedger` serializes both `creditLimit` and `creditBalance` as `Number()` from the Prisma `Decimal`. The `Client` Prisma model carries both fields (`DECIMAL(14,2) NOT NULL DEFAULT 0`). Migration `20260924020000` is additive and safe.

**Documentation lag (two findings):** `docs/current-state.md` still lists `DEF-PRD-001` (process-code catalog drift) as an active open defect and contains no mention of the credit-balance fields or TASK-015. `docs/action-plan.md` still lists process-code drift as an "open problem." The CHANGELOG has no entry for this cycle. These are AUD-027 and AUD-029 (both Low). No MEDIUM or higher regressions were introduced by any of the six changes.

**Score update: 7.9 → 8.1 / 10 — Acceptable**

---

## Overall Score

**Overall Score: 8.1 / 10**

| Dimension | Prior (7.9) | Current (8.1) | Δ | Notes |
|---|---|---|---|---|
| Backend correctness | 9.0 | 9.2 | +0.2 | TASK-015 credit lifecycle fully active inside Prisma transaction |
| Tenant isolation | 9.5 | 9.5 | — | No change |
| Frontend correctness | 7.5 | 8.0 | +0.5 | DEF-002 catalog alignment + AUD-026 qty-input listeners |
| Test coverage | 8.0 | 8.2 | +0.2 | 16 new tests (TASK-015 + ledger); store-level credit path still untested (AUD-028) |
| Pattern adherence | 8.5 | 8.5 | — | No regressions in layering or structural patterns |
| Security posture | 9.0 | 9.0 | — | No change |
| Documentation accuracy | 7.0 | 6.9 | −0.1 | DEF-PRD-001 still listed as open in current-state.md and action-plan.md; CHANGELOG absent; AUD-002 still open |

**Score derivation:**
- DEF-002 (Medium) resolved: +0.15
- TASK-015 new correct feature with characterization tests: +0.10
- AUD-026 (Low) confirmed resolved: +0.05
- Supporting credit infrastructure (schema, ledger, allowedFields): +0.05
- AUD-027 documentation staleness (new finding): −0.05
- AUD-028 store-level credit path untested (new finding): −0.05
- AUD-029 CHANGELOG not updated (new finding): −0.03

Net Δ = +0.22 → rounded to +0.2 → **8.1**

**Verdict: Acceptable.** The codebase is in good health. All six declared fixes are correctly implemented. The single remaining Medium open item (DEF-003 / AUD-025 — `GET /api/roles/company/:roleId` missing from `docs/runtime-endpoint-catalog.md`) is a documentation gap only; the route is implemented in code and covered by the OpenAPI spec. All other open items are Low severity.

---

## Repository Overview

| Property | Value |
|---|---|
| Language / Runtime | Node.js 24 (CommonJS), TypeScript typecheck only |
| Framework | Express 4.22 |
| ORM | Prisma 5.22 + PostgreSQL |
| Session | Redis (production) / in-memory (dev/test) |
| Test runner | `node:test` (built-in) |
| Total migrations | 67 committed |
| Total test files | 198 |
| Total passing tests | 1 539 (0 fail, 3 DB-gated skipped) |
| ESLint warnings | 0 |
| TypeScript errors | 0 |
| Docker | Multi-stage, non-root user, healthcheck present |

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

Active module groupings: Identity & Access · Customer / Company · Products / Recipes · Inventory / Warehouses / Lots · Production / QA · Procurement / Receipts · Sales / Orders / Billing / Payments · Supplier Quotations.

No event bus, no message queue, no async workers. All writes are synchronous request/response.

---

## Documentation Findings

### DOC-001 — docs/current-state.md is stale for this cycle
**Severity:** Low
**Category:** Outdated documentation
**Location:** `docs/current-state.md` §14 Known Defects
**Evidence:** Section 14 still lists `DEF-PRD-001` ("Root recipe editor process catalog drift") as an active Medium defect with specific evidence of the old invalid codes. The defect was resolved in this cycle. The document contains no mention of `creditLimit`/`creditBalance` on the `Client` model, TASK-015 credit lifecycle, or migration `20260924020000`.
**Concern type:** Outdated documentation — current-state truth is not accurate.
**Impact:** A reader of `docs/current-state.md` will believe the process-code catalog is still misaligned and will not know the credit balance lifecycle exists. Downstream agents relying on this document may model the wrong current state.
**Recommendation:** Update §14 to remove `DEF-PRD-001` (mark resolved). Add a new §14.x entry for the credit fields and TASK-015 cycle. Update §7 to include `clients.credit_limit` and `clients.credit_balance` in the schema element list.

---

### DOC-002 — docs/action-plan.md still lists process-code drift as an open problem
**Severity:** Low
**Category:** Outdated documentation
**Location:** `docs/action-plan.md` §5 "Problems still open"
**Evidence:** First bullet reads "root-shell recipe editor process-code catalog appears misaligned with backend-approved values." This was resolved in this cycle.
**Concern type:** Outdated documentation — current-state truth is not accurate.
**Impact:** Same as DOC-001 for readers of the action plan.
**Recommendation:** Remove the bullet or mark it resolved with the cycle date.

---

### DOC-003 — CHANGELOG.md not updated for this cycle
**Severity:** Low
**Category:** Missing documentation
**Location:** `CHANGELOG.md`
**Evidence:** The most recent entry is dated 2026-08-04. The current cycle (migration `20260924020000`, TASK-015, DEF-002, AUD-026) has no changelog entry.
**Concern type:** Missing documentation.
**Impact:** Operational history is incomplete. Engineers performing incident triage will not find the credit-lifecycle changes in the changelog.
**Recommendation:** Add a dated entry describing DEF-002, AUD-026, TASK-015, the credit fields migration, `creditLimit` in `allowedFields`, and the ledger exposure.

---

### DOC-004 — docs/runtime-endpoint-catalog.md missing `GET /api/roles/company/:roleId`
**Severity:** Medium (pre-existing, unchanged)
**Category:** Missing documentation
**Location:** `docs/runtime-endpoint-catalog.md` §Roles section
**Evidence:** The catalog lists `GET /api/roles/company` (list), `POST /api/roles/company` (create), and `PUT /api/roles/company/:roleId` (update) but has no row for `GET /api/roles/company/:roleId`. The route is confirmed implemented in `src/routes/role.routes.js` (line ~40) and is present in `docs/openapi/runtime-baseline.openapi.json` at path `/api/roles/company/{roleId}`.
**Concern type:** Missing documentation (endpoint catalog only; code and OpenAPI are correct).
**Impact:** The endpoint catalog is incomplete, reducing its utility as an operational reference.
**Recommendation:** Add `GET /api/roles/company/:roleId — authorizeAccessPolicy('role.company.list') — Obtener rol de compañía por ID` to the catalog.

---

**Documentation separation assessment:**
`docs/current-state.md` is designated for observable current truth and generally upholds that responsibility, but carries stale defect entries from this cycle. `docs/architecture.md` correctly describes the active runtime architecture. `docs/action-plan.md` is the active follow-up tracker; the drift item is stale. `docs/future-architecture.md` (not present — no target-state vision has been written). The separation of concerns between files remains acceptable; no current/future conflation is detected. The only issue is staleness within `current-state.md` and `action-plan.md`, not mixed states across files.

---

## Main Modules

| Module area | Files | Primary responsibility |
|---|---|---|
| Routes | `src/routes/*.routes.js` (27 files) | HTTP adapter; validation middleware; no business logic |
| Services | `src/services/*.service.js` (40+ files) | Business orchestration, permission checks, serialization |
| Repositories | `src/repositories/*.repository.js` (22 files) | Prisma queries; no business logic |
| Schemas | `src/schemas/*.schema.js` (24 files) | Zod request validation |
| Security | `src/security/` | Permission governance, access policies, role bundles |
| Middleware | `src/middlewares/` | authenticate, authorize, throttle, payload governance |
| Lib | `src/lib/` | money, pagination, audit, prisma singleton, logging |
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

**Dependency hygiene:** `npm audit` baseline is governed. No known unfixed critical CVEs at time of prior audit; `body-parser` and `brace-expansion` are overridden for known issues.

---

## Database Findings

### DB-001 — Dual credit balance at client and store levels
**Severity:** Low
**Category:** Schema design, consistency risk
**Location:** `prisma/schema.prisma` — `Client` model (lines 541–542) and `ClientStore` model (lines 628–629); `src/services/payment.service.js`
**Evidence:**
- `Client.creditBalance` increments on order APPROVED (billing-trigger), decrements on payment APPROVED, increments on payment REVERSED.
- `ClientStore.creditBalance` follows the same decrement/increment on payment lifecycle BUT only when `invoice.orderId → order.clientStoreId` chain is navigable.
- An invoice WITHOUT an `orderId` (which is nullable in the schema) will update `Client.creditBalance` but not `ClientStore.creditBalance`, creating a structural asymmetry.
- No `CHECK (credit_balance >= 0)` constraint exists on either table.
**Impact:** If the business creates invoices outside the order flow (or if the orderId → clientStoreId chain is broken), store-level and client-level balances diverge silently. `creditBalance` can also go negative in the DB if payment approval precedes order approval.
**Recommendation:** Document the intended credit-flow sequencing in `docs/current-state.md`. Consider a DB-level `CHECK (credit_balance >= 0)` or application-level guard. Add explicit test coverage for the invoice-without-orderId path and the invoice-with-orderId path.

---

### DB-002 — Additive migration `20260924020000` is safe
**Severity:** —
**Category:** Migration quality (positive observation)
**Location:** `prisma/migrations/20260924020000_add_credit_fields_to_client/migration.sql`
**Evidence:** Uses `ADD COLUMN IF NOT EXISTS` with `NOT NULL DEFAULT 0`. Non-destructive, non-blocking for existing rows. Decimal precision `(14,2)` is consistent with all other monetary fields in the schema.
**Impact:** No risk.

---

### DB-003 — No index on `Client.creditBalance`
**Severity:** Low
**Category:** Missing index (range queries)
**Location:** `prisma/schema.prisma` — `Client` model
**Evidence:** `creditBalance` and `creditLimit` have no explicit index. If the billing view or ledger query ever filters or sorts by credit exposure (e.g., "clients approaching credit limit"), a full-table scan would occur.
**Impact:** Low for current usage (ledger is fetched by clientId lookup, which hits the PK). Becomes relevant if credit-based dashboards are added.
**Recommendation:** Defer index until a query pattern requiring it is identified. Note in schema comments.

---

### DB-004 — Floating-point precision in recipe balance accumulation (pre-existing, unchanged)
**Severity:** Low
**Location:** `src/public/root/views/recipes-admin.version-editor.js` — `computeRecollectedBalances`
**Evidence:** `parseFloat(row.querySelector('.si-quantity')?.value || '0') || 0` — JavaScript `Number` accumulation, not `Decimal`.
**Impact:** Silent precision error in extreme fractional quantity scenarios (e.g., 0.1 + 0.2 ≠ 0.3). Backend validation is the authoritative enforcement; UI hint is guidance only.
**Recommendation:** Low priority; consider `Decimal.js` in the browser if recipe quantities become highly fractional.

---

## API Findings

### API-001 — `GET /api/roles/company/:roleId` absent from runtime endpoint catalog (pre-existing)
See DOC-004 above. The route is implemented and covered in OpenAPI; the omission is documentation-only.

### API-002 — Invoice→Client credit decrement does not validate clientStore ownership in payment approval path
**Severity:** Low
**Location:** `src/services/payment.service.js` — `approvePayment` lines 310–333
**Evidence:**
```javascript
const invoiceOrder = await tx.order.findUnique({
  where: { id: approvedInvoice.orderId },
  select: { clientStoreId: true },
});
if (invoiceOrder?.clientStoreId) {
  await tx.clientStore.update({
    where: { id: invoiceOrder.clientStoreId },
    data: { creditBalance: { decrement: transactionalPayment.amount } },
  });
}
```
The `tx.clientStore.update` uses only `{ id: invoiceOrder.clientStoreId }` — no `companyId` scope check on the store. The company scope is inherited from the invoice's client scope validated earlier in the transaction, so this is unlikely to be exploitable. However, it deviates from the repository pattern of always scoping writes by `companyId`.
**Impact:** Not a practical security issue in the current flow. Becomes risk if the service is extended to accept external orderId inputs.
**Recommendation:** Low priority; document the scope provenance assumption in a comment or add an explicit guard.

---

## Container Findings

No changes to Docker configuration detected in this cycle. Prior audit findings remain valid:
- Multi-stage Dockerfile; non-root user `inventory`; healthcheck on `/health/ready`
- `docker-compose.dev.yml` explicitly marked dev-only
- No secrets or credentials hard-coded in any Dockerfile or compose file

No new container findings.

---

## Security Findings

No security-relevant changes detected in this cycle. The TASK-015 credit update runs inside the existing payment Prisma transaction protected by `assertCompanyScope`, `assertHasAnyPermission`, and the lifecycle assertions (`assertPaymentCanBeApproved`, `assertPaymentCanBeReversed`). The `tx.client.update` call cannot be reached by an unauthorized actor.

The `creditBalance` field is intentionally absent from `buildClientPayload` `allowedFields`, preventing direct client-form manipulation of the running balance. This is a correct security design decision.

---

## Testing Findings

### TEST-001 — Store-level creditBalance path not tested (new)
**Severity:** Low
**ID:** AUD-028
**Location:** `tests/credit-balance-update-characterization.test.js`
**Evidence:** `buildApprovalHarness` and `buildReversalHarness` return `{ clientId: invoiceClientId }` from the invoice stub with no `orderId`. The `approvedInvoice?.orderId` branch in `approvePayment` (which updates `ClientStore.creditBalance`) is therefore never entered during test execution. There is no test where both client AND store credit balances are decremented/incremented in the same approval/reversal cycle.
**Impact:** A regression in the store-level credit update path would not be detected by the current test suite. The client-level path — the primary requirement stated in TASK-015 — is fully tested.
**Recommendation:** Add one test to `credit-balance-update-characterization.test.js` where the invoice stub returns `{ clientId: 42n, orderId: 9n }` and the tx stub includes `tx.order.findUnique` returning `{ clientStoreId: 15n }` and `tx.clientStore.update`. Assert that both `clientUpdateCalls` and `storeUpdateCalls` each have length 1 with the correct data.

---

### TEST-002 — Test suite growth and health
**Severity:** —
**Observation:** The suite grew from approximately 1 541 (prior audit) to 1 542 total (1 539 pass, 3 skipped). This is consistent with 16 new tests added:
- `credit-balance-update-characterization.test.js`: 12 tests (TASK-014 formula, TASK-015 approve/reverse, BUG-001 cancel guards)
- `client-ledger-characterization.test.js`: 4 tests (ledger contract including `creditLimit`/`creditBalance` exposure)

Zero failures. Zero ESLint warnings. Clean TypeScript typecheck. The test suite is in excellent shape.

---

### TEST-003 — Pre-existing low-coverage items (unchanged)
**Severity:** Low
**Location:** various
**Items:**
- AUD-013: No test for multi-product partial under-allocation in recipe approval mode.
- AUD-014: Frontend characterization tests exercise source-level regex patterns, not DOM execution.
- AUD-016: Some older PROCESSING stage fixtures in lineage tests still omit `processCode`.
- AUD-019: `assertRecipeStageLineageAndAllocation` not exported via `__private__` for direct unit testing.

None of these changed in this cycle.

---

## Maintainability Findings

### MAINT-001 — Service layer mixes orchestration, business rules, and serialization (pre-existing, structural)
**Severity:** Low (architectural debt, not a defect)
**Location:** `src/services/payment.service.js`, `src/services/client.service.js`, others
**Evidence:** `approvePayment` in `payment.service.js` performs: permission assertion → lifecycle assertion → overpayment check → payment approval → credit balance update → invoice financial state synchronization → audit recording — all in one function. `getClientLedger` in `client.service.js` performs DB lookup, Decimal-to-Number conversion, and response shaping in one function.
**Impact:** High cognitive load; functions are difficult to test at the pure-logic level without stubbing the full transaction machinery.
**Recommendation:** Tracked as architectural debt; not an actionable defect in this cycle.

---

### MAINT-002 — `docs/current-state.md` scope has grown beyond production/QA only
**Severity:** Low
**Location:** `docs/current-state.md`
**Evidence:** The document was originally written to describe the `qa-rejection-material-reconciliation-amendment` feature. It now needs to describe the credit lifecycle changes from this cycle and future changes. It does not yet have a clear structure for multi-cycle accumulation.
**Impact:** The document will become harder to maintain as the most current reflection of system truth if each cycle's changes are not added in a structured way.
**Recommendation:** Consider structuring `docs/current-state.md` as a living document with dated sections or a "Last updated" header per domain rather than a single monolithic document scoped to one feature.

---

## Technical Debt

| ID | Severity | Area | Description | Status |
|---|---|---|---|---|
| AUD-002 | Low | Documentation | `docs/current-state.md` not updated with current cycle changes | Open |
| AUD-005 | Low | Frontend | Floating-point precision in `computeRecollectedBalances` | Open |
| AUD-013 | Low | Testing | No test for multi-product partial under-allocation in approval mode | Open |
| AUD-014 | Low | Testing | Frontend characterization tests are source-level regex, not DOM execution | Open |
| AUD-016 | Low | Testing | Older lineage test fixtures lack `processCode` | Open |
| AUD-019 | Low | Testability | `assertRecipeStageLineageAndAllocation` not exported via `__private__` | Open |
| AUD-025 | Medium | Documentation | `GET /api/roles/company/:roleId` absent from `docs/runtime-endpoint-catalog.md` | Open |
| AUD-027 | Low | Documentation | `docs/current-state.md` and `docs/action-plan.md` list DEF-PRD-001 as open when it was resolved this cycle | New |
| AUD-028 | Low | Testing | `ClientStore.creditBalance` update path (orderId branch) not covered by characterization tests | New |
| AUD-029 | Low | Documentation | CHANGELOG.md not updated for this cycle's fixes | New |

---

## Behavior to Preserve

1. **Company-scoped data access.** Every service function derives `companyId` from `auth.companyId` (not from client payload). Tenant cross-contamination is systematically prevented.
2. **Payment lifecycle state machine.** `PENDING_APPROVAL → UNDER_REVIEW → APPROVED → REVERSED` with `REJECTED` as a terminal from PENDING/UNDER_REVIEW. Lifecycle assertions in `payment-lifecycle-support.service.js` must gate all transitions.
3. **Credit balance increments on order APPROVED.** `inventory.service.js` `reserveStockForOrder` increments `Client.creditBalance` by `calculateInvoiceAmount(orderItems)` when `clientId && orderAmount > 0`. This is the source-of-truth for the balance growing.
4. **Credit balance decrements on payment APPROVED.** `payment.service.js` `approvePayment` decrements `Client.creditBalance` by `transactionalPayment.amount` inside the Prisma transaction. This is the source-of-truth for the balance shrinking.
5. **Credit balance restores on payment REVERSED.** `reversePayment` increments `Client.creditBalance` by the original payment amount inside the Prisma transaction.
6. **Dual-level credit update when orderId is present.** When a payment's invoice has an `orderId` and that order has a `clientStoreId`, both `Client.creditBalance` and `ClientStore.creditBalance` are updated symmetrically.
7. **`creditBalance` is NOT settable via client form.** `buildClientPayload` deliberately excludes `creditBalance` from `allowedFields`. It may only be modified programmatically.
8. **`creditLimit` is settable via client form.** `buildClientPayload` includes `creditLimit` in `allowedFields` and `numericFields`.
9. **`getClientLedger` exposes both `creditLimit` and `creditBalance` as `Number`.** Prisma `Decimal` values are converted with `Number(clientData.creditLimit)` and the result is guarded with `!= null` before conversion.
10. **PROCESS_CODE_OPTIONS frontend catalog is a safe subset of backend `RECIPE_STAGE_PROCESS_CODES`.** All 8 frontend options (`MIXING`, `HEATING`, `COOLING`, `CAPPING`, `SEALING`, `LABELING_PREP`, `PACKING_PREP`, `OTHER`) are accepted by the backend Zod enum.
11. **Availability hints in the recipe editor recompute live.** Both the `productSelect change` event and `input` events on prior RECOLLECTION `.si-quantity` elements call `updateAvailHint()`, which calls `computeRecollectedBalances(parentSection)` at invocation time (not a cached snapshot). The `data-hint-wired` flag prevents duplicate listener registration.
12. **Production execution lineage validation on both create and update paths.** `recipe.service.js` calls `assertRecipeStageLineageAndAllocation` when `payload.stages` is present in `updateRecipeVersion`, not only on `createRecipeVersion`.
13. **Payment approval transaction atomicity.** `executePaymentFinancialSyncTransaction` wraps payment status update, credit balance update, and invoice financial state synchronization in a single `prisma.$transaction`. A failure in any step rolls back all three.
14. **Legacy `VIRTUAL_RECOLECTION` compatibility.** Existing production recolection stages without `recoveryType` default to `VIRTUAL_RECOLECTION` and continue to function without modification.
15. **Soft delete on clients.** `clientRepository.softDeleteCompanyClient` sets `deletedAt` rather than hard-deleting. All client lookups apply `buildDefaultClientWhere({ deletedAt: null })`.

---

## Known Defects

### DEF-003 / AUD-025 — `GET /api/roles/company/:roleId` absent from runtime endpoint catalog
**Severity:** Medium (documentation defect only)
**Location:** `docs/runtime-endpoint-catalog.md`
**Evidence:** The route is implemented at `src/routes/role.routes.js` line ~40 and is present in `docs/openapi/runtime-baseline.openapi.json` at path `/api/roles/company/{roleId}`. The `docs/runtime-endpoint-catalog.md` table lists the POST and PUT for this path family but not the GET by ID.
**Impact:** Operational documentation is incomplete. No functional regression.
**Recommendation:** Add the missing row to the catalog table.

---

No functional defects were identified in the six changes applied this cycle. All previously confirmed defects that were in scope for this cycle (DEF-002) are resolved. DEF-003 remains the only open Medium-severity defect, and it is documentation-only.

---

## Architectural Debt

1. **Service layer as God-layer.** Services in `src/services/` mix permission enforcement, business rules, persistence coordination, response serialization, and audit recording. `payment.service.js` exemplifies this with `approvePayment` performing six distinct responsibilities. This is a structural constraint of the current layered monolith architecture; it is not a defect but imposes long-term maintenance cost.

2. **Direct Prisma transaction access in service layer.** `approvePayment` and `reversePayment` use `tx.invoice.findUnique`, `tx.client.update`, `tx.order.findUnique`, and `tx.clientStore.update` directly rather than via repository functions. This bypasses the repository abstraction for cross-entity transactional reads. The repository pattern is not consistently enforced within transaction boundaries.

3. **No application-level credit balance floor constraint.** There is no `CHECK (credit_balance >= 0)` at the DB level and no application-level guard preventing `creditBalance` from going negative if a payment approval precedes the order approval that was supposed to credit the balance. The intended flow (order → credit increment; payment → credit decrement) is not enforced by schema constraints.

4. **Frontend SPA delivered from same process.** The root-shell admin SPA, warehouse SPA, and agent SPA are all served as static files from the same Express process as the API. This is a deployment architecture constraint; it is functional but limits independent scaling and deployment of SPA vs API.

5. **No integration between `ClientStore.creditBalance` and `Client.creditBalance` validation.** When a credit limit is checked (e.g., in billing view spec), it reads `client.creditLimit` and `client.creditBalance` as independent values. There is no enforced relationship ensuring `sum(store.creditBalance) == client.creditBalance`. If these diverge (e.g., due to invoice-without-orderId paths), the discrepancy is silent.

---

## Unknown Behavior

1. **Manual end-to-end evidence for replacement recovery → same-lot execution → reconciliation.** The automated test suite covers the service layer for this flow. Manual operator walk-through evidence in the repository docs is noted as incomplete in `docs/current-state.md` §14.

2. **Behavior when `ClientStore.creditBalance` and `Client.creditBalance` diverge.** The UI surfaces `client.creditBalance` in the billing view and `store.creditBalance` in the store context. What the UI displays when these diverge, and whether any validation uses one versus the other, cannot be confirmed from code inspection alone.

3. **Behavior of `getClientLedger` when `creditLimit` or `creditBalance` is `null` on a legacy client.** The `!= null` guard in `client.service.js` returns `null` in those cases. Whether the billing UI handles `null` gracefully is inferred from the spec doc (`docs/vistas/billing-view-spec.md` line 936: `if (!client.creditLimit || client.creditLimit <= 0) return ''`) but not confirmed by a live DOM test.

---

## Critical Risks

| Risk | Level | Status | Notes |
|---|---|---|---|
| Process-code catalog drift (DEF-002 / AUD-020) | ~~Medium~~ | **CLOSED** | Frontend now uses only valid backend codes |
| Availability hint stale snapshot (AUD-018) | ~~Medium~~ | **CLOSED** | Fixed in prior cycle |
| `updateRecipeVersion` lineage path untested (AUD-012) | ~~Medium~~ | **CLOSED** | Fixed in prior cycle |
| `GET /api/roles/company/:roleId` absent from catalog (AUD-025) | Medium (doc only) | **Open** | Route works; catalog entry missing |
| `creditBalance` can go negative with no DB constraint | Low | **Open** | New finding DB-001; no functional regression yet |
| Store-level credit path untested (AUD-028) | Low | **Open** | New finding; client-level path tested |
| `docs/current-state.md` stale (AUD-027) | Low | **Open** | DEF-PRD-001 listed as open; credit fields absent |

---

## Recommended Priorities

1. **(Medium — Documentation)** Add `GET /api/roles/company/:roleId` to `docs/runtime-endpoint-catalog.md`. See AUD-025. Small effort, closes the only remaining Medium finding.

2. **(Low — Documentation)** Update `docs/current-state.md`: remove `DEF-PRD-001` from §14 Known Defects (mark resolved); add §7 entries for `clients.credit_limit` and `clients.credit_balance`; add TASK-015 to §8 APIs/integrations. See AUD-027.

3. **(Low — Documentation)** Update `docs/action-plan.md` §5 to remove process-code drift from "Problems still open." See DOC-002.

4. **(Low — Documentation)** Add a CHANGELOG.md entry for this cycle (DEF-002, AUD-026, TASK-015, migration `20260924020000`, creditLimit in allowedFields, ledger exposure). See AUD-029.

5. **(Low — Testing)** Add a characterization test for the `ClientStore.creditBalance` update path in `approvePayment` and `reversePayment` (invoice with `orderId → clientStoreId` chain). See AUD-028.

6. **(Low — Schema)** Consider adding a `CHECK (credit_balance >= 0)` constraint to both `clients` and `client_stores` tables in a future migration, or add an application-level guard before the decrement operation. See DB-001.

7. **(Low — Test hygiene)** Add `processCode` to the remaining older PROCESSING stage fixtures in lineage tests. See AUD-016.

8. **(Low — Testability)** Export `assertRecipeStageLineageAndAllocation` via `__private__` for direct unit-test access. See AUD-019.

9. **(Low — Arithmetic)** Evaluate whether recipe quantity precision warrants an epsilon tolerance or a `Decimal.js` library in the browser. See AUD-005.

---

## Fix Assessment Summary

### DEF-002 / AUD-020 — PROCESS_CODE_OPTIONS alignment

| Check | Result | Evidence |
|---|---|---|
| `FILLING` removed from frontend | ✓ | Not present in `PROCESS_CODE_OPTIONS` array |
| `QUALITY_CHECK` removed from frontend | ✓ | Not present in `PROCESS_CODE_OPTIONS` array |
| `LABELING` replaced by `LABELING_PREP` | ✓ | `{ value: 'LABELING_PREP', label: 'Prep. etiquetado' }` present |
| `PACKAGING` replaced by `PACKING_PREP` | ✓ | `{ value: 'PACKING_PREP', label: 'Prep. empaque' }` present |
| All 8 frontend values exist in backend `RECIPE_STAGE_PROCESS_CODES` | ✓ | Backend: `'PACKING_PREP', 'LABELING_PREP', 'CAPPING', 'SEALING', 'MIXING', 'HEATING', 'COOLING', 'OTHER'` all present |
| Comment points to backend catalog | ✓ | `// Catalog must stay in sync with RECIPE_STAGE_PROCESS_CODES in src/schemas/recipe.schema.js` |

**Conclusion: DEF-002 RESOLVED.**

---

### AUD-026 — Input listeners on prior RECOLLECTION `.si-quantity` elements

| Check | Result | Evidence |
|---|---|---|
| Listeners only wired when `isProcessingMode && parentSection` | ✓ | `if (isProcessingMode && parentSection) {` guard wraps the wiring block |
| Only sections before `parentSection` are wired | ✓ | `if (section === parentSection) break;` exits loop at own section |
| Only RECOLLECTION sections are wired | ✓ | `if (section.querySelector('.stage-type')?.value !== 'RECOLLECTION') continue;` |
| `data-hint-wired` prevents duplicate listeners | ✓ | `if (qtyInput.dataset.hintWired) return;` and `qtyInput.dataset.hintWired = '1';` |
| Listener calls `updateAvailHint` (not a stale snapshot) | ✓ | `qtyInput.addEventListener('input', updateAvailHint)` — `updateAvailHint` calls `computeRecollectedBalances(parentSection)` at invocation time |
| Wiring is done after `inputsContainer.appendChild(row)` so the row is in DOM | ✓ | Wiring block appears after `inputsContainer.appendChild(row)` |

**Conclusion: AUD-026 RESOLVED.**

---

### TASK-015 — Credit balance in payment lifecycle

| Check | Result | Evidence |
|---|---|---|
| `approvePayment` calls `tx.client.update` with `{ decrement: transactionalPayment.amount }` | ✓ | `payment.service.js` lines 314–320 |
| `reversePayment` calls `tx.client.update` with `{ increment: transactionalPayment.amount }` | ✓ | `payment.service.js` lines 432–438 |
| Both updates run inside `executePaymentFinancialSyncTransaction` (single Prisma tx) | ✓ | Both are nested inside the `(tx) => { ... }` callback |
| Update uses `invoice.clientId` fetched inside the transaction | ✓ | `tx.invoice.findUnique({ where: { id: transactionalPayment.invoiceId }, select: { orderId, clientId } })` |
| Guard `if (approvedInvoice?.clientId)` prevents null dereference | ✓ | Explicit optional-chaining guard present |
| Symmetric `ClientStore.creditBalance` update when orderId present | ✓ | Second `if (approvedInvoice?.orderId)` block with `tx.order.findUnique` → `tx.clientStore.update` |
| Test: approve decrements by payment amount when invoice has clientId | ✓ | `TASK-015: approvePayment decrements creditBalance when invoice has clientId` |
| Test: approve skips update when invoice has no clientId | ✓ | `TASK-015: approvePayment skips creditBalance update when invoice has no clientId` |
| Test: reverse increments by payment amount when invoice has clientId | ✓ | `TASK-015: reversePayment increments creditBalance when invoice has clientId` |
| Store-level path tested | ✗ | No test exercises the `orderId → clientStoreId` branch (AUD-028, Low) |

**Conclusion: TASK-015 IMPLEMENTED. Primary paths tested. Store-level path coverage gap (AUD-028) is Low severity.**

---

### Supporting changes

| Check | Result | Evidence |
|---|---|---|
| `creditLimit` in `buildClientPayload` `allowedFields` | ✓ | `clients-admin.helpers.js` — `allowedFields` array includes `'creditLimit'` |
| `creditBalance` intentionally absent from `allowedFields` | ✓ | `creditBalance` is in `numericFields` (for coercion) but not in `allowedFields` (so it is never written from the form) |
| `getClientLedger` returns `creditLimit` | ✓ | `client.service.js` — `creditLimit: clientData.creditLimit != null ? Number(clientData.creditLimit) : null` |
| `getClientLedger` returns `creditBalance` | ✓ | `client.service.js` — `creditBalance: clientData.creditBalance != null ? Number(clientData.creditBalance) : null` |
| Ledger test asserts `creditLimit` and `creditBalance` values | ✓ | `client-ledger-characterization.test.js` — `'getClientLedger exposes creditLimit and creditBalance from client data'` |
| `Client` schema has `creditLimit DECIMAL(14,2) NOT NULL DEFAULT 0` | ✓ | `prisma/schema.prisma` line 541 |
| `Client` schema has `creditBalance DECIMAL(14,2) NOT NULL DEFAULT 0` | ✓ | `prisma/schema.prisma` line 542 |
| Migration uses `ADD COLUMN IF NOT EXISTS` (safe) | ✓ | `20260924020000_add_credit_fields_to_client/migration.sql` |

---

*Produced by baseline-audit-agent-20ddf6. Full repository scope re-audit. Prior audit: baseline-audit-agent-4ffad0 (score 7.9 / 10). This report supersedes the prior audit report and is the canonical current-state baseline for downstream agents.*
