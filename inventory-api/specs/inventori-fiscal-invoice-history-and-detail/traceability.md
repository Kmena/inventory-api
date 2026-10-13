# Traceability — Inventori Fiscal Invoice History & Detail

Feature: `inventori-fiscal-invoice-history-and-detail`<br>
Final closure date: 2026-10-02

---

## Requirement Families

| Prefix | Scope |
|--------|-------|
| FH-NUMBER | Invoice number display fix |
| FH-DTO | Browser-safe fiscal DTO |
| FH-LIST | Invoice list with fiscal status |
| FH-DETAIL | Invoice detail panel |
| FH-FISCAL | Fiscal status display |
| FH-ARTIFACT | Artifact downloads |
| FH-SEC | Security / isolation |
| FH-PERM | Permissions |
| FH-UX | UX quality / responsive / a11y |
| FH-CLOSE | Documentation and closure |

---

## Requirements → Waves → Tests

| Requirement family | Waves | Primary evidence | Status |
|--------------------|-------|------------------|--------|
| FH-NUMBER | 1–2 | `invoice-fiscal-dto.test.js`, `invoice-list-fiscal-status.test.js` | ✅ COMPLETE |
| FH-DTO | 1, 6 | `invoice-fiscal-dto.test.js`, `invoice-fiscal-security.test.js` | ✅ COMPLETE |
| FH-LIST | 2, 8 | `invoice-list-fiscal-status.test.js`, `invoice-fiscal-history-integration.test.js` | ✅ COMPLETE |
| FH-DETAIL | 3, 7 | `invoice-detail-panel.test.js`, `invoice-fiscal-ux.test.js` | ✅ COMPLETE |
| FH-FISCAL | 4, 7 | `invoice-fiscal-detail.test.js`, `invoice-fiscal-ux.test.js` | ✅ COMPLETE |
| FH-ARTIFACT | 5–6, 8 | `invoice-fiscal-artifacts.test.js`, `invoice-fiscal-security.test.js` | ✅ COMPLETE |
| FH-SEC | 6, 8 | `invoice-fiscal-security.test.js`, `inventori-billing-artifact-proxy-postgres.test.js` | ✅ COMPLETE |
| FH-PERM | 5–8 | Artifact/list/detail route and service tests | ✅ COMPLETE |
| FH-UX | 7 | `invoice-fiscal-ux.test.js` | ✅ COMPLETE |
| FH-CLOSE | 9 | `implementation-report.md`, reconciled metadata/tasks/current-state | ✅ COMPLETE |

---

## Acceptance Criteria → Implemented Evidence

| AC | Requirement | Wave(s) | Evidence | Status |
|----|-------------|---------|----------|--------|
| AC-001 to AC-003 | FH-NUMBER | 1–2 | DTO/list renderer tests | ✅ COMPLETE |
| AC-004 to AC-011 | FH-DTO | 1, 6 | explicit serializers + no-internal-field tests | ✅ COMPLETE |
| AC-012 to AC-015 | FH-LIST | 2 | fiscal badge list tests | ✅ COMPLETE |
| AC-016 to AC-020 | FH-DETAIL | 3, 7 | dialog/render/focus source tests | ✅ COMPLETE |
| AC-021 to AC-028 | FH-FISCAL | 4, 7 | all fiscal state render tests | ✅ COMPLETE |
| AC-029 to AC-033 | FH-ARTIFACT | 5–7 | artifact action/proxy/error/retry tests | ✅ COMPLETE |
| AC-034 to AC-036 | FH-SEC | 6, 8 | tenant isolation/security regression tests | ✅ COMPLETE |
| AC-037 to AC-038 | FH-UX accessibility | 7 | aria/dialog/download-label tests | ✅ COMPLETE |
| AC-039 to AC-040 | FH-UX responsive | 7 | responsive CSS/static DOM tests | ✅ COMPLETE |

---

## Final Test Evidence Snapshot

| Test file / command | Result |
|---------------------|--------|
| `tests/invoice-fiscal-dto.test.js` | PASS in focused and full regression |
| `tests/invoice-list-fiscal-status.test.js` | PASS in focused and full regression |
| `tests/invoice-detail-panel.test.js` | PASS in focused and full regression |
| `tests/invoice-fiscal-detail.test.js` | PASS in focused and full regression |
| `tests/invoice-fiscal-artifacts.test.js` | PASS in focused and full regression |
| `tests/invoice-fiscal-security.test.js` | PASS in focused and full regression |
| `tests/invoice-fiscal-ux.test.js` | 87 PASS, 0 FAIL, 0 SKIP in focused Wave 7 run |
| `tests/invoice-fiscal-history-integration.test.js` | Present; default closure environment reports suite SKIP without DB-backed E2E fixture gate |
| `tests/inventori-billing-e2e-unit.test.js` + `tests/inventori-billing-reconciliation-postgres.test.js` | 155 PASS, 0 FAIL, 1 SKIP |
| `npm test -- --test-reporter=spec` | TOTAL 3497, PASS 3494, FAIL 0, SKIP 3 |
| `npm run -s lint` | PASS |
| `npm run -s typecheck` | PASS |
| `npx prisma validate` | PASS |
| public runtime smoke + runtime contract governance | 7 PASS, 0 FAIL |

---

## Runtime/Static Evidence Boundaries

PROVEN BY TEST:

- DTO construction and field exclusion.
- List fiscal status display and invoice number fix.
- Detail dialog rendered structure and content.
- All fiscal status render states.
- Artifact action URL construction, allowlist behavior, error/retry UI.
- XSS escaping and no browser storage persistence.
- TASK-013b status vocabulary regression.
- Full Inventori regression pass.

STATICALLY VERIFIED:

- Native `<dialog>` semantics for focus containment and Escape behavior.
- `aria-modal`, `aria-labelledby`, heading hierarchy, and initial focus source pattern.
- Responsive CSS constraints, scroll containers, wrapping behavior.
- No direct browser-to-Billing URL construction in fiscal invoice UI files.

NOT RUNTIME-VERIFIED:

- Actual browser viewport rendering.
- Real keyboard focus traversal and Escape event handling in a browser automation session.
- Authenticated HTTP list/detail with fresh E2E token during closure; service-level/DB-backed isolation tests cover the same ownership rules.

---

## Closure Accounting

Wave 9 made documentation-only changes. No Billing files, no backend fiscal mutation paths, no Prisma schema changes, and no migrations were introduced by closure.

Operational debt `TECH-DEBT-RECONCILE-MANUAL-REVIEW` remains unchanged and out of scope.
