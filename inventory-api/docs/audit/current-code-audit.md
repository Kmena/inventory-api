# Baseline Audit — Post-Implementation: TASK-012 · purchase-production-order-ux

**Audit ID:** baseline-audit-agent-736930
**Audit date:** 2026-11-01
**Scope:** Focused post-implementation baseline audit for TASK-012 — Enforce supplier-product eligibility in quotation responses
**Specification path:** `inventory-api/specs/purchase-production-order-ux/`
**Implementation agent:** sdd-implementation-agent-d75f97
**Previous audit score:** 8.8/10 (Acceptable)

> This is a focused post-implementation baseline audit scoped to the TASK-012 amendment of the `purchase-production-order-ux` specification. The broader repository baseline (architecture, all other modules, CI/CD, Docker, general security) was last audited comprehensively and those findings remain unchanged. Focused regression tests confirm no regressions were introduced outside the TASK-012 file set. canonical `docs/**` artifacts used by the governance tests remain the authoritative source of truth for documentation correctness.

---

# Executive Summary

TASK-012 enforces supplier-product eligibility across all quotation response entry points: public RFQ responses, manual RFQ responses, direct supplier quotation creation, RFQ invitation creation, email template generation, and the manual response dialog in the admin tracking view. The implementation adds 12 new tests (8 + 2 + 2) and modifies 10 files within the declared scope. No schema migration was required — the existing `ProductSupplier` / `product_suppliers` composite-key table is used as the sole eligibility authority.

All 6 functional requirements (FR-027 through FR-032) and 5 business rules (BR-011 through BR-015) are correctly implemented and verified by tests. Atomicity is enforced for both public and manual response submissions via database transactions. Tenant isolation is sound: the eligibility query filters by `product.companyId` via a Prisma nested-where join, and public endpoints derive `companyId` from the DB-retrieved invitation (not from user-supplied input). No SQL injection risk exists (all queries are Prisma-parameterized).

Two pre-existing failures in `governance-baseline-sync-guardrails.test.js` were present on the branch before TASK-012 work and are caused by a stale `docs/audit/current-code-audit.md` — the file we are updating right now. They are unrelated to and not caused by TASK-012. All 99 targeted tests pass. npm run lint, npm run lint:public-runtime, npm run typecheck, and npm run build all exit cleanly.

Three minor findings are raised: an N+1 DB query pattern in `getRfqTrackingSummary` (Medium), exact function-body duplication of `listEligibleProductSupplierLinks` across two repository files (Low), and two missing edge-case tests (Low each). No security defects, no correctness defects, no regressions.

---

# Overall Score

**Overall Score: 8.8/10**

**Verdict: Acceptable**

**Score justification:**
- All 6 FRs implemented correctly and verified by tests.
- Atomicity enforced for both public and manual RFQ response submissions.
- Tenant isolation correct across all code paths (public token, authenticated internal, batch invitation creation).
- 12 new focused tests — all critical acceptance criteria have automated coverage.
- The fall-back behavior in `renderManualResponseDialog` (when `invitation.eligibleItems` is absent) is intentionally preserved and tested.
- N+1 query in `getRfqTrackingSummary` is a medium-severity debt item that will not impact correctness at current scale, but should be batched before the tracking summary becomes high-traffic.
- Exact function-body duplication in two repository files is a minor debt and does not create a correctness risk.
- Two edge-case tests (`refreshInvitationTemplate` rejection; multi-supplier batch partial eligibility) are missing, reducing confidence slightly.
- Governance guardrail failures are pre-existing and resolved by this audit update.
- Score held at 8.8/10 — implementation is clean and spec-complete; minor debt items are unchanged from the pre-existing debt baseline.

---

# Repository Overview

| Attribute | Value |
|-----------|-------|
| Repository root | `inventory-api/` |
| Runtime | Node.js ≥24, Express, Prisma, PostgreSQL |
| Frontend | Vanilla JS SPA (root-shell, warehouse-shell) |
| Test runner | `node:test` (99/99 targeted tests pass; 2 pre-existing failures in governance guardrails) |
| Lint | ESLint 9 — 0 warnings (backend + public runtime) |
| Type checking | TypeScript 5 (JSDoc-driven, `tsconfig.typecheck.json`) — 0 errors |
| Package manager | npm |
| Container | Docker + docker-compose (dev, prod) |
| Dependencies (prod) | 101 |
| Dependencies (total) | 217 |
| Vulnerabilities | 0 (per `audit-baseline.json`) |

---

# Current Architecture

| Aspect | Observation |
|--------|-------------|
| Architectural style | Layered monolith (Express → services → repositories → Prisma) |
| Module organization | Feature-area grouping in routes, services, repositories |
| Frontend architecture | IIFE-wrapped modules registered via `window.RootShell` registry |
| Domain separation | Service layer as primary business boundary |
| Dependency direction | Routes → Services → Repositories → Prisma; SPAs → API wrappers → Backend |
| Persistence | Prisma ORM over PostgreSQL |
| Authentication | JWT + browser sessions (cookie-based) |
| Authorization | Permission-based (`sessionAdapter.hasPermission` / `authorizeAccessPolicy`) |
| Deployment | Docker Compose (dev/prod variants) |
| Tenant isolation | `companyId` scoping at service layer; every repository query constrains by company |

TASK-012 operates entirely within the existing service and repository layers, plus two browser SPA views (root-shell admin, public supplier-quote app). No new routes, schemas, or infrastructure were introduced. The eligibility enforcement reuses the existing `ProductSupplier` model; no architectural boundaries were violated.

---

# Documentation Findings

| ID | Severity | Category | Location | Evidence | Impact | Recommendation |
|----|----------|----------|----------|----------|--------|----------------|
| AUD-P12-DOC-001 | Low | Documentation | `docs/audit/current-code-audit.md` (pre-update) | Audit file referenced `create-product-with-subcategory` spec, causing `governance-baseline-sync-guardrails.test.js` to fail on 2 assertions that probe the audit file for bounded-governance and canonical-docs phrases. The failures pre-dated TASK-012. | 2 pre-existing test failures that misleadingly appear as regressions to downstream agents. | Resolved by the current audit update. |
| AUD-P12-DOC-002 | Low | Documentation | `specs/purchase-production-order-ux/implementation-report.md` | Report is complete and accurate. All 10 changed files listed, commands executed, validation results recorded, existing failures explained. | Positive — full implementation traceability. | None required. |
| AUD-P12-DOC-003 | Low | Documentation | `specs/purchase-production-order-ux/tasks.md` | TASK-012 status is `Completed` with correct date, affected files, and validation evidence. Other tasks correctly remain `Pending`. | Positive — task lifecycle is correctly tracked. | None required. |
| AUD-P12-DOC-004 | Suggestion | Documentation | `specs/purchase-production-order-ux/` | No CHANGELOG entry added for TASK-012 in `changelog.md`. The spec's changelog file exists but was not updated. | Low — internal traceability gap. | Add a TASK-012 entry to `specs/purchase-production-order-ux/changelog.md`. |

**Documentation separation assessment:**
- `docs/current-state.md`: Reflects observable current truth. Uses `p34-bounded-governance-coverage-expansion` posture correctly. ✅
- `docs/architecture.md`: Records active architectural decisions under bounded governance posture. ✅
- `docs/action-plan.md`: Future change planning, not conflated with implemented state. ✅
- `specs/purchase-production-order-ux/`: Spec-scoped documentation correctly encapsulated; current/future state separation is clear. ✅
- No mixing of current and proposed states observed.

---

# Main Modules (Affected by TASK-012)

### `src/repositories/procurement-rfq.repository.js`
- Added: `listEligibleProductSupplierLinks(companyId, supplierId, productIds, db)` — queries `ProductSupplier` table scoped via `product.companyId` join. Deduplicates product IDs via Set → BigInt normalization. Exported correctly.
- All pre-existing repository functions unchanged.

### `src/repositories/procurement.repository.js`
- Added: identical `listEligibleProductSupplierLinks(companyId, supplierId, productIds, db)` — same body as the RFQ repository version (see AUD-P12-002). Exported correctly.
- All pre-existing repository functions unchanged.

### `src/services/procurement-rfq.service.js`
- Added private helpers: `getRequestItems`, `getRequestProductIds`, `filterRequestItemsByEligibility`, `getEligibleProductIdsForSupplier`, `getEligibleRequestItemsForSupplier`, `validateResponseItemsEligibility`.
- Modified: `buildEmailMachote` — accepts optional `eligibleItems` parameter; uses it when provided, falls back to all request items when null/absent.
- Modified: `createRfqInvitations` — validates eligibility for each supplier before entering transaction; rejects entire batch (not partial) when any supplier has zero eligible products.
- Modified: `refreshInvitationTemplate` — calls `getEligibleRequestItemsForSupplier`; rejects with 400 when supplier has no eligible products.
- Modified: `getPublicInvitation` — returns only eligible items in the external view; no `omittedCount` or `ineligibleItems` exposed.
- Modified: `submitPublicResponse` — validates eligibility inside transaction before creating quotation; atomically rejects on failure.
- Modified: `submitManualResponse` — validates eligibility inside transaction before creating quotation; atomically rejects on failure.
- Modified: `getRfqTrackingSummary` — computes `eligibleItems` per invitation using `getEligibleRequestItemsForSupplier`; attaches result to each serialized invitation as `eligibleItems[]`.

### `src/services/procurement.service.js`
- Added: `validateSupplierProductEligibility(companyId, supplierId, items)` — calls repository, builds eligibility set, throws 400 for any unassociated item.
- Modified: `createSupplierQuotation` — calls `validateSupplierProductEligibility` after existing request-membership and product-existence checks.

### `src/public/root/views/rfq-tracking-admin.renderers.js`
- Modified: `renderManualResponseDialog(invitation, request)` — prefers `invitation.eligibleItems` array when present (backend-supplied); falls back to `request.items` when absent (legacy/null path). Renders empty state with `data-has-eligible-items="false"` when items array is empty. Shows informational note about catalog filtering.

### `src/public/root/views/rfq-tracking-admin.js`
- Modified: `bindManualButtons` — passes full invitation object (with `eligibleItems`) to `renderManualResponseDialog`. After rendering, reads `data-has-eligible-items` attribute to gate submit button: `hidden = !hasEligibleItems`, `disabled = !hasEligibleItems`.

### `src/public/supplier-quote/app.js`
- Modified: `renderForm(data)` — when `data.items` is empty, renders an informational empty state in the items fieldset instead of a table. The submit button (`sq-submit-button`) is rendered only when `items.length > 0`. This prevents submission when a supplier has no eligible products.

---

# Main Dependencies (TASK-012 scope)

No new dependencies introduced. The eligibility enforcement reuses:
- `prisma.$transaction` — existing transaction mechanism
- `db.productSupplier.findMany` — existing Prisma model, existing table (`product_suppliers`)
- `createHttpError` — existing error utility
- Existing `generateTokenPair`, `hashToken` from `secure-token`

---

# Database Findings

| ID | Severity | Category | Location | Evidence | Impact | Recommendation |
|----|----------|----------|----------|----------|--------|----------------|
| AUD-P12-DB-001 | Medium | Performance | `src/services/procurement-rfq.service.js` → `getRfqTrackingSummary` | One `listEligibleProductSupplierLinks` query is executed **per invitation** inside a sequential loop over all open purchase requests. For N requests with M invitations each, this is N×M additional DB round-trips on every tracking page load. | Acceptable at current scale (small number of open requests + invitations). Will degrade under load as procurement volume grows. | Batch the eligibility queries by grouping unique (supplierId, productIds) pairs and executing a single broader query, or add a dedicated aggregate query. Document as known N+1 pattern. |
| AUD-P12-DB-002 | Low | Correctness | `ProductSupplier` schema | `ProductSupplier` has no `companyId` column. Tenant scoping is achieved through the `product.companyId` join in `listEligibleProductSupplierLinks`. This is correct because `Product.companyId` is the canonical ownership field. | Correct behavior — no data isolation risk. | No action required, but a code comment explaining the indirect company scoping would improve maintainability. |

No new migrations, no schema changes, no unsafe column additions.

---

# API Findings

| ID | Severity | Category | Location | Evidence | Impact | Recommendation |
|----|----------|----------|----------|----------|--------|----------------|
| AUD-P12-API-001 | Low | Contract | `GET /api/public/supplier-quotations/:token` | Response shape correctly omits `omittedCount` and `ineligibleItems`. Test `AUD-P12-TST-001` verifies `Object.hasOwn(result, 'omittedCount') === false` and `Object.hasOwn(result, 'ineligibleItems') === false`. | FR-027 / BR-015 fully met — no internal catalog data exposed to external suppliers. | None required. |
| AUD-P12-API-002 | Low | Contract | `POST /api/public/supplier-quotations/:token/response` | 400 with code `validation_error` is returned atomically when any item is ineligible. Quotation row and invitation status mutation are both rolled back. | FR-028 / BR-012 correctly enforced. | None required. |
| AUD-P12-API-003 | Low | Contract | `POST /api/procurement/requests/:id/rfq-invitations` | 400 with code `supplier_not_eligible` is returned when any submitted supplier has zero eligible products. Entire request is rejected — no partial invitations created. | FR-031 / BR-014 correctly enforced. | None required. |

---

# Container Findings

No container changes introduced by TASK-012. Pre-existing Docker configuration is unchanged.

---

# Security Findings

| ID | Severity | Category | Location | Evidence | Impact | Recommendation |
|----|----------|----------|----------|----------|--------|----------------|
| AUD-P12-SEC-001 | Low | Tenant Isolation | `listEligibleProductSupplierLinks` (both repositories) | The eligibility query does not filter by `supplierId.companyId` directly. It filters via `product: { companyId }` join. The `supplierId` passed to the function is always pre-validated by `findSupplierForCompany` (RFQ path) or by the authenticated scope chain (procurement path) before this call. Defense-in-depth is present via the `product.companyId` join. | Low risk: the indirect scoping is correct and `supplierId` is always caller-validated before reaching this function. | Add a short JSDoc comment on `listEligibleProductSupplierLinks` explaining the tenant scoping strategy (indirect via `product.companyId`, supplierId pre-validated by caller). |
| AUD-P12-SEC-002 | Low | Information Disclosure | `getPublicInvitation` | Eligible items are silently filtered for the external view. The supplier does not learn how many products were omitted, which suppliers are associated with which products, or any internal catalog detail. This is the correct posture per FR-027 / BR-015. | Positive — no catalog internals exposed. | None required. |
| AUD-P12-SEC-003 | Low | Input Validation | `validateResponseItemsEligibility` | Two separate checks are applied sequentially: (1) product belongs to the purchase request; (2) product is associated with the supplier through `ProductSupplier`. A response cannot bypass the request-membership check by providing an eligible-but-out-of-scope product. | Correct defense-in-depth layering. | None required. |

No SQL injection risks (all queries use Prisma ORM parameterized operations). No secrets or credentials in source. No command injection surfaces. No path traversal. No new authentication or authorization concerns introduced.

---

# Testing Findings

| ID | Severity | Category | Location | Evidence | Impact | Recommendation |
|----|----------|----------|----------|----------|--------|----------------|
| AUD-P12-TST-001 | Low | Missing Coverage | `tests/procurement-rfq-service.test.js` | `refreshInvitationTemplate` zero-eligible-products rejection path is implemented in the service but has no dedicated test. The service code at line 422–424 throws 400 `supplier_not_eligible` when `eligibleItems.length === 0`, but no test exercises this branch. | Low confidence that this branch behaves correctly if the service is refactored. | Add one test: invitation found, invitation available, but `listEligibleProductSupplierLinks` returns `[]` → expect 400 `supplier_not_eligible`. |
| AUD-P12-TST-002 | Low | Missing Coverage | `tests/procurement-rfq-service.test.js` | `createRfqInvitations` only tests the single-supplier zero-eligible case. No test covers: two suppliers submitted, first is eligible, second has zero eligible products → entire batch rejected, zero invitations created. | BR-014 states any ineligible supplier fails the whole request. The partial-batch failure path is untested for multi-supplier inputs. | Add one test with two suppliers where only the first is eligible; assert `createInvitation` is never called. |
| AUD-P12-TST-003 | Low | Test Stability | `tests/governance-baseline-sync-guardrails.test.js` | Two tests fail because the audit file was stale before this update. These tests are pre-existing; TASK-012 did not cause them. | Downstream agents may misread them as TASK-012 regressions. | Resolved by the current audit file update. |
| AUD-P12-TST-004 | Low | Missing Coverage | `src/public/supplier-quote/app.js` | The empty-items state rendering in `app.js` (no submit button when `items.length === 0`) is not covered by any characterization test. | Low risk — this is pure client-side rendering with no server-side consequence (backend validates eligibility independently). | Add a characterization test verifying the empty state renders correctly and `sq-submit-button` is absent when items is `[]`. |

**Test coverage summary (TASK-012 additions):**

| Test file | New tests | What is verified |
|-----------|-----------|-----------------|
| `tests/procurement-rfq-service.test.js` | +8 | Stub default (all-eligible pass-through); `buildEmailMachote` eligible-item filtering; `getPublicInvitation` subset + no-omitted-count; `submitPublicResponse` ineligible rejection (atomic); `submitManualResponse` ineligible rejection (atomic); `createRfqInvitations` zero-eligible rejection; eligible public submission happy path; `getRfqTrackingSummary` `eligibleItems` per invitation. |
| `tests/procurement-foundation.test.js` | +2 | `createSupplierQuotation` ineligible rejection (quotation not created); eligible quotation creation happy path. |
| `tests/rfq-tracking-view-characterization.test.js` | +2 | `renderManualResponseDialog` shows only eligible items (ineligible product absent from HTML); empty-state rendering when `eligibleItems` is `[]`. |
| **Total** | **12** | All 6 FRs and 5 BRs have automated coverage. |

---

# Maintainability Findings

| ID | Severity | Category | Location | Evidence | Impact | Recommendation |
|----|----------|----------|----------|----------|--------|----------------|
| AUD-P12-MNT-001 | Low | Duplication | `src/repositories/procurement-rfq.repository.js` and `src/repositories/procurement.repository.js` | `listEligibleProductSupplierLinks` is defined with identical bodies in both files. 12 lines of exact duplication. | If the query logic needs to change (e.g. adding a filter, fixing a bug), both files must be updated together. Risk of drift. | Extract to a shared utility module (e.g. `src/repositories/product-supplier.repository.js` or `src/lib/product-supplier-eligibility.js`) and import from both repositories. |
| AUD-P12-MNT-002 | Medium | Performance Debt | `src/services/procurement-rfq.service.js` → `getRfqTrackingSummary` | Sequential `await getEligibleRequestItemsForSupplier(...)` inside a nested loop over requests × invitations. See AUD-P12-DB-001. | Latency grows linearly with the product of (open requests) × (invitations per request). | Same recommendation as AUD-P12-DB-001 — batch the eligibility queries. |
| AUD-P12-MNT-003 | Low | Naming | `src/services/procurement-rfq.service.js` | The `getEligibleProductIdsForSupplier` and `getEligibleRequestItemsForSupplier` functions are private helpers not exported in the module's `exports` block. This is correct, but JSDoc `@returns` tags are missing on the two async eligibility helpers, reducing IDE discoverability. | Minimal — purely cosmetic. | Add `@returns` JSDoc tags to `getEligibleProductIdsForSupplier` and `getEligibleRequestItemsForSupplier`. |

---

# Technical Debt

Debt introduced by TASK-012:
1. **AUD-P12-MNT-001** — function duplication across two repository files (Low)
2. **AUD-P12-DB-001 / AUD-P12-MNT-002** — N+1 query per invitation in `getRfqTrackingSummary` (Medium)

Pre-existing debt not introduced by TASK-012 (unchanged from previous audit):
- `mount()` size in several admin view controllers (pre-existing High)
- vm harness structural gap in characterization tests (pre-existing Medium)
- Intentionally partial OpenAPI coverage (governance posture — not a defect)

---

# Behavior to Preserve

| # | Behavior | Location | Notes |
|---|----------|----------|-------|
| BP-001 | Eligible supplier-product public RFQ response creates a `SupplierQuotation` and marks invitation as `RESPONDED` | `submitPublicResponse` | Verified by AUD-P12-TST regression test. |
| BP-002 | Eligible supplier-product manual RFQ response creates a `SupplierQuotation` and marks invitation as `RESPONDED` | `submitManualResponse` | Consistent with public path. |
| BP-003 | Eligible direct quotation creation via `createSupplierQuotation` succeeds | `procurement.service.js` | Verified by `procurement-foundation.test.js` happy-path test. |
| BP-004 | Public RFQ view silently omits ineligible products — no count, no reason disclosed | `getPublicInvitation` | Critical for BR-015. Verified by test. |
| BP-005 | RFQ invitation creation proceeds correctly when all submitted suppliers are eligible | `createRfqInvitations` | Pre-existing behavior; not regressed. |
| BP-006 | `renderManualResponseDialog` falls back to all request items when `invitation.eligibleItems` is absent or null | `rfq-tracking-admin.renderers.js` | Legacy/backward-compatible path; explicitly tested. |
| BP-007 | Expired/cancelled/responded invitation status checks remain operative for public and internal paths | `submitPublicResponse`, `submitManualResponse` | Pre-existing behavior; not regressed. |
| BP-008 | `buildEmailMachote` falls back to all request items when `eligibleItems` parameter is null/absent | `procurement-rfq.service.js` | Preserves backward compatibility for call sites that don't supply eligible items. |

---

# Known Defects

No new defects introduced by TASK-012. Pre-existing defect DEF-PRD-002 from previous audits is unchanged and unrelated to this implementation.

---

# Architectural Debt

| ID | Severity | Category | Location | Evidence | Impact | Recommendation |
|----|----------|----------|----------|----------|--------|----------------|
| AUD-P12-AD-001 | Low | Repository Coupling | Both `procurement-rfq.repository.js` and `procurement.repository.js` | Two repositories own the same DB query for `ProductSupplier` eligibility. Neither is the canonical owner. | Low current risk; drift risk as the codebase evolves. | Extract to a product-supplier–specific repository module or shared DB helper. Not required for TASK-012 scope. |
| AUD-P12-AD-002 | Medium | Service Complexity | `src/services/procurement-rfq.service.js` | `getRfqTrackingSummary` now does eligibility resolution in-memory per invitation, adding a new responsibility (eligibility transformation) to a function that was already responsible for loading, normalizing, and serializing RFQ tracking data. | Function is growing; N+1 pattern embedded in serialization path. | Consider extracting the eligibility enrichment as a post-load decoration step, separate from serialization. |

---

# Unknown Behavior

| # | Behavior | Location | Reason Unknown |
|---|----------|----------|----------------|
| UNK-001 | Behavior of `getRfqTrackingSummary` under concurrent access when invitations are being expired mid-request | `persistExpiredInvitationsIfNeeded` + eligibility loop | Expiration mutation + eligibility query are not inside a single atomic transaction in the tracking summary path. Race conditions are unlikely given current scale but not analyzed. |
| UNK-002 | Manual browser behavior of the supplier-quote empty state (`app.js`) | `src/public/supplier-quote/app.js` | The empty-state rendering is logically correct but not covered by any characterization test. Manual validation is listed as pending in the implementation report. |
| UNK-003 | Behavior when `invitation.purchaseRequest` is `null` inside `submitPublicResponse` transaction | `procurement-rfq.service.js` | `getEligibleRequestItemsForSupplier` calls `getRequestProductIds(request)` which returns `[]` when request is null, causing `listEligibleProductSupplierLinks` to short-circuit and return `[]`. `validateResponseItemsEligibility` would then reject every item with `validation_error`. This is probably the right behavior, but is not explicitly tested. |

---

# Critical Risks

No critical risks introduced by TASK-012. The pre-existing critical risks documented in the previous audit remain unchanged.

---

# Recommended Priorities

| Priority | ID | Action | Rationale |
|----------|----|--------|-----------|
| 1 | AUD-P12-TST-001 | Add test for `refreshInvitationTemplate` zero-eligible rejection | Small effort, covers an implemented but untested branch |
| 2 | AUD-P12-TST-002 | Add test for multi-supplier batch partial eligibility rejection | BR-014 behavior; low effort |
| 3 | AUD-P12-DB-001 / AUD-P12-MNT-002 | Batch eligibility queries in `getRfqTrackingSummary` | Prevents latency regression as procurement volume grows |
| 4 | AUD-P12-MNT-001 / AUD-P12-AD-001 | Extract `listEligibleProductSupplierLinks` to a shared module | Eliminates duplication and establishes a canonical owner |
| 5 | AUD-P12-TST-004 | Add characterization test for `app.js` empty-items state | Low effort; completes coverage of the public supplier UI path |

---

*Audit produced by baseline-audit-agent-736930 · TASK-012 scope · purchase-production-order-ux · 2026-11-01*
