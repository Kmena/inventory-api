# Tasks — Inventori Fiscal Invoice History & Detail

Feature: `inventori-fiscal-invoice-history-and-detail`  
Spec directory: `specs/inventori-fiscal-invoice-history-and-detail/`

> Wave numbering starts at Wave 1. This is a NEW feature independent of
> inventori-fiscal-settings-and-ux (COMPLETE/CLOSED).

---

## Wave 1 — Backend: Browser-Safe Fiscal DTO ✅ COMPLETE

**Completed:** 2025-07-04  
**Test evidence:** `tests/invoice-fiscal-dto.test.js` — 45 tests, 0 failures  
**Full regression:** 2614 tests, 2611 pass, 0 fail, 3 skipped (unchanged from baseline)  
**Lint:** PASS | **Typecheck:** PASS

**Goal:** Provide an explicit serialization layer for invoice responses that includes the `invoiceNumber` fix and a minimal fiscal projection. No browser receives raw `InvoiceFiscalIntent` fields.

**Scope:**
1. Add `invoiceFiscalIntent: true` to `include` in `findCompanyInvoices` and `findCompanyInvoiceById` in `invoice.repository.js`
2. Create `buildFiscalDto(intent)` in `invoice.service.js` — minimal list projection (status only)
3. Create `buildFiscalDtoDetail(intent)` — detail projection (status, clave, consecutive, acceptedAt)
4. Create `serializeInvoiceForList(invoice)` — includes `invoiceNumber: invoice.number`
5. Create `serializeInvoiceForDetail(invoice)`
6. Update `listInvoices` to apply `serializeInvoiceForList` to each invoice
7. Update `getInvoice` to apply `serializeInvoiceForDetail`
8. Verify `failureMessage`, `failureCode`, `idempotencyKey`, `billingFiscalDocumentId`, `billingStatus`, `retryCount`, `nextRetryAt`, `processingNodeId`, `metadata`, `billingPayload` are NOT in any response

**Excluded from Wave 1:** no frontend changes, no new routes  
**Prisma schema changes:** 0 | **Migrations:** 0 | **Billing calls:** 0 | **Frontend files:** 0

**Test file:** `invoice-fiscal-dto.test.js`
- DTO for intent with status PENDING: only `status`, `clave=null`, `consecutive=null`
- DTO for intent with status ACCEPTED: includes `clave`, `consecutive`, `acceptedAt`
- DTO for intent with status ACCEPTED but `clave` null: `clave` is null
- DTO when intent is null: fiscal is null
- `invoiceNumber` in list response matches `invoice.number`, not `invoice.id`
- `failureMessage` absent from list response
- `failureMessage` absent from detail response
- `billingFiscalDocumentId` absent from detail response
- `idempotencyKey` absent from detail response
- `acceptedAt` is null for REJECTED status even if internal timestamp exists
- `acceptedAt` is null for ERROR_FINAL status
- Cross-company: company B cannot access company A invoice

---

## Wave 2 — Invoice List: Fiscal Status + Invoice.number Fix ✅ COMPLETE

**Completed:** 2025-07-05  
**Test evidence:** `tests/invoice-list-fiscal-status.test.js` — 29 tests, 0 failures  
**Full regression:** 3142 tests, 3139 pass, 0 fail, 3 skipped (unchanged from Wave 1 baseline)  
**Lint:** PASS | **Typecheck:** PASS | **Prisma schema changed:** NO | **Migrations:** 0 | **Billing files changed:** 0

**Goal:** Display `invoiceNumber` (not ID) and a fiscal status badge per invoice row in the receivables table.

**Scope:**
1. `billing-admin.renderers.js`: update `renderReceivablesTable` to add a "Estado Fiscal" column
2. Render `inv.fiscal?.status` using compact badge (list-style: `fiscalStatusListLabel`)
3. When `inv.fiscal` is null, show `—` in the fiscal column
4. Confirm `inv.invoiceNumber` now correctly shows formatted number (automatic from Wave 1 fix)
5. Add `fiscalStatusListLabel` and `fiscalStatusListBadgeClass` to `billing-admin.helpers.js`
6. Add `fetchInvoiceDetail(session, invoiceId)` to `billing-api.js` calling `GET /api/invoices/:id`

**No backend changes** — Wave 1 already delivers the serialized response.

**Files modified:**
- `src/public/root/views/billing-admin.helpers.js`
- `src/public/root/views/billing-admin.renderers.js`
- `src/public/root/billing-api.js`

**Files created:**
- `tests/invoice-list-fiscal-status.test.js`

**Test file:** `invoice-list-fiscal-status.test.js` — 29 tests:
- Helpers unit: all 6 status labels, graceful unknown, badge classes (5 tests)
- AC-001 invoiceNumber shows INV-963 not raw ID
- AC-014 fiscal=null shows `—`, no badge
- AC-012 ACCEPTED → ✓ Aceptada + badge-success
- AC-013 PENDING → ⏳ En cola
- PROCESSING, REJECTED, ERROR_RETRYABLE, ERROR_FINAL badges (4 tests)
- AC-015 all six fiscal states in one table
- Unknown fiscal status graceful fallback
- FH-LIST-003 fiscal badge independent of commercial badge
- ACCEPTED fiscal + PENDING commercial → both badges simultaneously
- FH-SEC-001 no raw InvoiceFiscalIntent internals in rendered HTML
- No Billing IDs/secrets in HTML
- Backward compat: all existing columns preserved
- Valid structural markup (thead/tbody)
- Empty array no crash
- fetchInvoiceDetail: correct endpoint, passthrough, error handling, export (4 tests)
- Source-level contract guards (3 tests)

---

## Wave 3 — Invoice Detail Panel: Commercial + Payment Information ✅ COMPLETE

**Completed:** 2025-07-06<br>
**Test evidence:** `tests/invoice-detail-panel.test.js` — 46 tests, 0 failures<br>
**Full regression:** 3191 tests, 3188 pass, 0 fail, 3 skipped<br>
**Lint:** PASS | **Typecheck:** PASS | **Prisma schema changed:** NO | **Migrations:** 0 | **Billing files changed:** 0

**Goal:** Add a clickable detail panel to invoice rows in the billing admin view.

**Scope:**
1. `billing-admin.renderers.js`: `renderInvoiceDetailContent(invoice)` — commercial info + payments
2. Display: invoiceNumber, clientName, orderId/clientStoreName, amount, issuedAt, dueAt, paidAt, commercial status badge
3. Display: registered payments list (method, amount, status, date) — handles 0/1/N payments
4. `billing-admin.renderers.js`: `renderInvoiceDetailLoading()`, `renderInvoiceDetailNotFound()`, `renderInvoiceDetailError()` — safe loading/error/not-found states
5. `billing-admin.js`: `openInvoiceDetail()` + `bindDetailButtons()` — click handler on invoice number button, focus management, focus restoration on close
6. Shell: `<dialog id="billing-detail-dialog">` with `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, close button with `aria-label`, Escape key handled natively by `<dialog>`, scrollable body (`max-height:70vh;overflow-y:auto`)
7. Wave 4 extension point: `<section id="billing-detail-fiscal-section" hidden>` in detail content
8. `billing-api.js`: `fetchInvoiceDetail(session, invoiceId)` already present from Wave 2 — no changes needed
9. Security: fiscal DTO internals (failureMessage, billingStatus, etc.) not rendered — Wave 3 only passes `invoice.fiscal` through state without rendering the detail section

**Files modified:**
- `src/public/root/views/billing-admin.helpers.js` (no changes needed — Wave 2 already covers helpers)
- `src/public/root/views/billing-admin.renderers.js` (added `renderInvoiceDetailContent`, `renderInvoiceDetailLoading`, `renderInvoiceDetailNotFound`, `renderInvoiceDetailError`)
- `src/public/root/views/billing-admin.js` (added `openInvoiceDetail`, `bindDetailButtons`, `billing-detail-dialog` shell)

**Files created:**
- `tests/invoice-detail-panel.test.js` (46 tests)

---

## Wave 4 — Fiscal Detail: All Six Fiscal States ✅ COMPLETE

**Completed:** 2025-07-06<br>
**Test evidence:** `tests/invoice-fiscal-detail.test.js` — 56 tests, 0 failures<br>
**Full regression:** 3247 tests, 3244 pass, 0 fail, 3 skipped<br>
**Lint:** PASS | **Typecheck:** PASS | **Prisma schema changed:** NO | **Migrations:** 0 | **Billing files changed:** 0

**Goal:** Add the "Comprobante electrónico" section to the detail panel, handling all six states.

**Scope:**
1. `billing-admin.helpers.js`: added `fiscalStatusLabel`, `fiscalStatusBadgeClass`, `fiscalStatusDescription` + `FISCAL_STATUS_LABELS`, `FISCAL_STATUS_BADGE_CLASSES`, `FISCAL_STATUS_DESCRIPTIONS` constants
2. `billing-admin.renderers.js`: added `renderFiscalStatusSection(fiscal)` function (module-level, exported)
3. Activated in `renderInvoiceDetailContent` — replaced hidden extension-point section with `renderFiscalStatusSection(invoice.fiscal)` call
4. Also extracted `sectionHead(id, label)` to module level (DRY — shared by both renderers)
5. ACCEPTED: shows clave, consecutive, acceptedAt — all as opaque strings with `word-break:break-all`
6. PENDING/PROCESSING: shows status badge + description only (no clave/consecutive)
7. REJECTED/ERROR_RETRYABLE/ERROR_FINAL: shows status badge + description (NO failureMessage)
8. `fiscal === null`: shows "Este comprobante no tiene factura electrónica asociada." (neutral, no error)
9. Unknown future status: degrades safely — never classified as ACCEPTED, safe fallback description
10. Wave 3 `[W3-DETAIL-18]` and `[W3-DETAIL-19]` and `[W3-EXT-02]` updated to reflect Wave 4 activation

**Files modified:**
- `src/public/root/views/billing-admin.helpers.js` (added Wave 4 helpers + updated register call)
- `src/public/root/views/billing-admin.renderers.js` (added `sectionHead` module-level, `renderFiscalStatusSection`, updated `renderInvoiceDetailContent` and register call)
- `tests/invoice-detail-panel.test.js` (updated [W3-DETAIL-18], [W3-DETAIL-19], [W3-EXT-02] for Wave 4 reality)

**Files created:**
- `tests/invoice-fiscal-detail.test.js` (56 tests)

---

## Wave 5 — Artifact Availability + Downloads ✅ COMPLETE

**Completed:** 2025-07-09
**Test evidence:** `tests/invoice-fiscal-artifacts.test.js` — 59 tests, 0 failures
**Full regression:** 3303 tests, 3300 pass, 0 fail, 3 skipped (same 3 skipped as Wave 4 baseline)
**Lint:** PASS | **Typecheck:** N/A (browser JS) | **Prisma schema changed:** NO | **Migrations:** 0 | **Backend files changed:** 0

**Goal:** Show fiscal artifact download buttons in the detail panel for ACCEPTED invoices.

**Scope:**
1. `billing-api.js`: add `listFiscalArtifacts(session, invoiceId)` calling `GET /api/invoices/:id/fiscal-artifacts`
2. `billing-admin.renderers.js`: add `renderArtifactActions(invoiceId, artifacts, bh)` function
3. Load artifact list when detail panel opens for an ACCEPTED invoice
4. Render: [Descargar PDF] [Descargar XML firmado] [Respuesta Hacienda] buttons
5. Each button is `<a href="/api/invoices/:id/fiscal-artifacts/:type" download>` (Inventori proxy URL only)
6. When artifacts list is empty or status is not ACCEPTED: show informative message
7. Download button loading state: disable during navigation
8. Artifact load error: show inline error with retry

**Test file:** `invoice-fiscal-artifacts.test.js`
- ACCEPTED invoice: artifact section renders PDF/XML/Hacienda buttons
- PDF download link points to `/api/invoices/:id/fiscal-artifacts/pdf` (not a Billing URL)
- signed-xml link points to correct proxy path
- hacienda-response link points to correct proxy path
- Empty artifact list: informative message shown, no buttons
- PENDING invoice: informative message shown instead of buttons
- Artifact load failure: error message shown, retry available
- Buttons hidden if user lacks `invoice.fiscal-artifact` permission

---

## Wave 6 — Security + Tenant Isolation + Error Handling ✅ COMPLETE

**Completed:** 2026-10-02
**Test evidence:** `tests/invoice-fiscal-security.test.js` — 76 tests, 0 failures
**DB-backed evidence:** `tests/inventori-billing-artifact-proxy-postgres.test.js` — 15 tests, 0 failures (INVENTORI_BILLING_POSTGRES_TEST=1)
**Full regression:** TOTAL 3410, PASS 3407, FAIL 0, SKIP 3
**Lint:** PASS | **Typecheck:** PASS | **Prisma schema changed:** NO | **Migrations:** 0 | **Billing files changed:** 0
**validate:public-runtime:** PASS (pre-existing receiver-fiscal-readiness drift resolved)
**runtime-contract governance:** PASS (3/3)

**Goal:** Confirm no internal fields leak; confirm cross-company isolation; harden error paths.

**Security invariants proven:**

| Invariant | Strongest Test Level | Evidence |
|-----------|---------------------|----------|
| Company A → own invoice → allowed | DB-BACKED | `inventori-billing-artifact-proxy-postgres.test.js` |
| Company A → Company B invoice → 404 | DB-BACKED | `inventori-billing-artifact-proxy-postgres.test.js` |
| Company A → list Company B artifacts → 404 | PROXY-MOCK | `invoice-fiscal-security.test.js` W6-TENANT-006 |
| Company A → download Company B artifact → 404 | DB-BACKED | `inventori-billing-artifact-proxy-postgres.test.js` |
| Non-enumeration: foreign=nonexistent=404 | SVC-MOCK + PROXY-MOCK | W6-TENANT-002, W6-TENANT-003 |
| Caller cannot substitute billingFiscalDocumentId | DB-BACKED | postgres test: "even with known billingFiscalDocumentId" |
| Invalid artifact type → 400 before DB call | PROXY-MOCK | W6-INPUT (13 hostile inputs, dbCalled=false) |
| Content-Disposition CRLF/traversal safe | UNIT | W6-CDISP-001..006 |
| Billing secrets never in responses | PROXY-MOCK | W6-BILLING-004, W6-INTERNAL-004 |
| TASK-013b reconciliation intact | UNIT | W6-013B-001..004 |
| Frontend XSS escaped | RENDER | W6-XSS-001..005 |
| Browser storage clean | SRC | W6-STORE-001..003 |
| Byte-exact proxy | PROXY-MOCK | W6-INT-001..003 |

**Test file:** `invoice-fiscal-security.test.js` — 76 tests across 13 security domains
- W6-AUTH (3): router.use(authenticate) contract, service-level 403 on missing companyId
- W6-TENANT (9): DB-backed + SVC-MOCK cross-company isolation
- W6-INTERNAL (5): JSON output proof — no failureMessage/billingFiscalDocumentId/idempotencyKey etc.
- W6-INPUT (14): 13 hostile artifact type inputs → 400 before DB call; 3 valid types → DB called
- W6-CDISP (6): Content-Disposition CRLF/traversal/null-byte hardening
- W6-CTYPE (7): Type mapping integrity, no pdf/xml confusion
- W6-ERR (8): Billing error sanitization, timeout→504, 401→502, unavailable→503
- W6-BILLING (4): billingCompanyId/billingFiscalDocumentId/secretRef all come from DB
- W6-INT (3): Byte-exact proxy, no XML re-serialization
- W6-XSS (5): clientName/invoiceNumber/clave/status escaped in rendered HTML
- W6-STORE (3): No localStorage/sessionStorage/IndexedDB usage
- W6-REG (5): Waves 1–5 regression guards
- W6-013B (4): QUEUED→PROCESSING, all PROCESSING statuses, ACCEPTED, unknown→fail-closed

**Ownership chain (production code path):**
```
authenticate middleware (router.use)
  → authorizeAccessPolicy('invoice.fiscal-artifact')
    → validateInventoriArtifactType(artifactType) [400 if unknown — BEFORE DB]
      → resolveArtifactOwnershipChain(invoiceId, companyId, db)
          db.invoice.findFirst({ where: { id, client: { companyId } } }) [→404 if not owned]
          db.invoiceFiscalIntent.findUnique({ where: { invoiceId } })   [→422 if missing]
          intent.billingFiscalDocumentId check                          [→422 if not ready]
          intent.companyId === companyId check (defense in depth)       [→403 if mismatch]
        → billingCompanyId from config (DB, never from caller)
        → billingFiscalDocumentId from intent (DB, never from caller)
        → secretReference from config (DB, never from caller)
          → Billing artifact call
            → buildContentDisposition (server-generated, clave sanitized)
              → bytes returned byte-exact (no parsing)
```

**Mass-assignment protection:**
- `updateInvoiceSchema` only allows: clientId, orderId, number, amount, dueAt
- `normalizeInvoicePayload` explicitly discards `status`, `paidAt`
- No fiscal projection fields (fiscal.status, clave, billingFiscalDocumentId, billingStatus) accepted

**Public-runtime drift disposition:**
- CAUSE: pre-existing from `receiver-fiscal-readiness` Waves 5+6 adding JS files without registry update
- FILES: `root/views/client-fiscal-verification.js`, `root/views/fiscal-approval-modal.js`
- FIX: registered in `runtime-contract.js` and `validate-public-runtime.js` expectedJavaScriptFiles
- STATUS: RESOLVED — `validate:public-runtime` now passes

---

## Wave 7 — Responsive + Accessibility + UX Hardening ✅ COMPLETE

**Completed:** 2026-10-02
**Test evidence:** `tests/invoice-fiscal-ux.test.js` — 87 tests, 0 failures
**Full regression:** TOTAL 3497, PASS 3494, FAIL 0, SKIP 3
**Lint:** PASS | **Typecheck:** PASS | **Prisma schema changed:** NO | **Migrations:** 0 | **Billing files changed:** 0
**validate:public-runtime:** PASS | **runtime-contract governance:** PASS (3/3)

**Goal:** Ensure layout, accessibility, and UX states are complete.

**Implemented:**
1. `billing-detail-dialog-title` h3 → added `tabindex="-1"` for programmatic focusability
2. `openInvoiceDetail()` → explicit `titleEl.focus()` after `dialog.showModal()` for consistent initial focus
3. Focus restoration on close: pre-existing; verified and tested (Wave 3 baseline + Wave 7 regression)
4. Fiscal status badges: full textual labels already present (Wave 4); no icon-only variants in use
5. Clave/consecutive: `word-break:break-all;overflow-wrap:break-word` already present (Wave 4); verified
6. Artifact download links → added `aria-label="Descargar PDF del comprobante electrónico INV-963"` etc. (AC-038)
7. Responsive: `.modal-card { width: min(100%, 860px) }` + artifact `flex-wrap:wrap` + `.table-wrapper { overflow:auto }`; verified by CSS source tests
8. Loading state: added `role="status" aria-label="Cargando detalle de factura…"` to skeleton wrapper
9. Error state: pre-existing `renderInvoiceDetailError()` + `renderArtifactLoadError()` with retry; verified
10. Download in-progress: `<a download>` links trigger native browser download (no JS handler needed)

**New CSS added (Wave 7 scoped):**
- `.billing-artifact-link` — `min-height:36px; display:inline-flex; align-items:center` (touch targets)
- `.billing-artifact-retry-btn` — `min-height:36px` (touch target for retry)
- `#billing-detail-dialog .table-wrapper` — `overflow-x:auto; -webkit-overflow-scrolling:touch` (responsive tables)

**Files modified:**
- `src/public/root/views/billing-admin.renderers.js` (role=status on loading, aria-labels on artifact links, billing-artifact-link class)
- `src/public/root/views/billing-admin.js` (tabindex=-1 on dialog title h3, titleEl.focus() after showModal)
- `src/public/styles.css` (Wave 7 scoped CSS for touch targets + responsive dialog table)

**Files created:**
- `tests/invoice-fiscal-ux.test.js` (87 tests, 0 failures)

**Browser automation status:** BROWSER_AUTOMATION_UNAVAILABLE
Actual focus movement, Escape key behavior, and viewport-dependent CSS layout cannot be verified
without a browser. These properties are STATICALLY VERIFIED at source/DOM level:
- Native `<dialog>.showModal()` moves focus into dialog (Web Platform guarantee)
- Native `<dialog>` handles Escape key natively (no conflicting JS handler present)
- `titleEl.focus()` called after `showModal()` for explicit title focus (source-verified)
- Focus restoration: `dialog.addEventListener('close', () => triggerEl.focus())` (source-verified)

**PROVEN BY TEST:** 87 Wave 7 UX/security/regression assertions
**STATICALLY VERIFIED:** responsive CSS constraints, keyboard element semantics, focus management patterns
**NOT RUNTIME-VERIFIED:** actual viewport rendering, real keyboard navigation flow, real focus events

---

## Wave 8 — Integration + Full Regression ✅ COMPLETE

**Completed:** 2026-10-02
**Test evidence:** `tests/invoice-fiscal-history-integration.test.js` — 82 tests, 0 failures (DB-BACKED, INVENTORI_BILLING_POSTGRES_TEST=1)
**DB-backed artifact proxy:** `tests/inventori-billing-artifact-proxy-postgres.test.js` — 15 tests, 0 failures (re-run with live PostgreSQL)
**DB-backed reconciliation:** `tests/inventori-billing-reconciliation-postgres.test.js` — 65 tests, 0 failures (re-run with live PostgreSQL)
**Redis/session:** `tests/browser-session-redis-store.test.js` — 8 tests, 0 failures (live Redis)
**Full regression:** TOTAL 3497, PASS 3494, FAIL 0, SKIP 3 (baseline preserved)
**Lint:** PASS | **Typecheck:** PASS | **Prisma schema changed:** NO | **Migrations:** 0 | **Billing files changed:** 0
**validate:public-runtime:** PASS (149 JS files, 7 HTML files) | **runtime-contract governance:** PASS (3/3)

**Goal:** Full integration testing of all P0 scope against the complete feature.

**Scope implemented:**
1. Full E2E-style test covering: list → fiscal status → detail → clave/consecutive/acceptedAt → artifact download (W8-E2E suite, 8 tests)
2. All six fiscal states integration test — ACCEPTED/PENDING/PROCESSING/REJECTED/ERROR_RETRYABLE/ERROR_FINAL (W8-LIST suite, 13 tests)
3. Invoice with no fiscal intent integration test — fiscal=null, neutral message (W8-LIST-008, W8-DETAIL-004, W8-E2E-006)
4. Artifact download proxy integration test with mocked Billing responses (W8-ARTIFACT suite, 12 tests)
5. Tenant isolation — DB-backed (W8-TENANT suite, 5 tests): Company A → Company B 404, non-enumeration
6. Commercial/fiscal independence — DB-backed (W8-INDEP suite, 6 tests): PAID+ACCEPTED, PAID+REJECTED, PENDING+ACCEPTED
7. Authentication scope gates — service-level 403 on null/undefined companyId (W8-AUTH suite, 5 tests)
8. Wave 1–7 regression guards embedded in integration suite (W8-REG suite, 19 tests)
9. TASK-013b regression: QUEUED → PROCESSING confirmed DB-backed
10. Regression: existing commercial behavior preserved — fetchReceivables/fetchPendingPayments/fetchClientLedger not regressed

**Runtime stack verified:**
- PostgreSQL: ONLINE (health/ready: database=up)
- Redis: ONLINE (health/ready: browserSessionStore=up)
- Inventori API: ONLINE (health/ready: ok=true, fiscalScheduler=running)
- Billing runtime: NOT REQUIRED (mocked Billing responses used throughout)

**Runtime HTTP checks performed:**
- GET /health/ready → {ok:true} ✅
- GET /api/invoices (no auth) → 401 "Token no enviado" ✅
- GET /api/invoices (bad token) → 401 "Token invalido o expirado" ✅
- GET /api/invoices/1/fiscal-artifacts/%2E%2E%2Fetc (bad token) → 401 (auth before artifact validation) ✅
- Authenticated invoice list: E2E token expired; DB-backed service-level proof used (CROSS_COMPANY_RUNTIME_HTTP_NOT_PERFORMED)

**Evidence classification:**
- DB-BACKED: 82 Wave 8 integration + 15 artifact proxy + 65 reconciliation = 162 DB-backed tests pass
- MOCKED BILLING: all artifact proxy tests use FakeW8BillingClient (no real Billing HTTP)
- STATICALLY VERIFIED: auth middleware source, route structure, responsive CSS
- NOT RUNTIME-VERIFIED (HTTP): authenticated list/detail (E2E token expired)

**Side-effect accounting:**
- Hacienda submission requests: 0
- Billing fiscal mutation requests: 0
- Billing artifact READ requests: 0 (mocked)
- FiscalDocuments created: 0
- FiscalSubmissions created: 0
- Consecutives consumed: 0
- Invoice business mutations: 0
- DB fixture insert/delete operations: ~60 companies with clients, configs, invoices, intents (all cleaned up)

**Prisma schema changed:** NO | **Migration created:** NO
**Production source files changed:** 0 (Wave 8 is test-only)

**Files created:**
- `tests/invoice-fiscal-history-integration.test.js` (82 tests, 553 lines)

---

## Wave 9 — Documentation + Implementation Report + Closure ✅ COMPLETE

**Completed:** 2026-10-02
**Documentation evidence:** `implementation-report.md` created; `metadata.yaml`, `tasks.md`, `traceability.md`, and `current-state.md` reconciled
**Final full regression:** TOTAL 3497, PASS 3494, FAIL 0, SKIP 3
**Lint:** PASS | **Typecheck:** PASS | **Prisma validate:** PASS
**validate:public-runtime:** PASS (via public runtime smoke + manifest governance) | **runtime-contract governance:** PASS
**Production source files changed in Wave 9:** 0
**Billing files changed in Wave 9:** 0

**Goal:** Final documentation, traceability update, implementation report.

**Implemented:**
1. Updated `traceability.md` with final implementation evidence and closure status
2. Created `implementation-report.md` with:
   - Wave history
   - Final test counts
   - DTO contract documentation
   - Security invariant evidence
   - Known limitations
3. Updated `metadata.yaml`: `status: complete`, `implementation_status: complete`, Wave 9 complete
4. Updated `tasks.md`: all waves marked COMPLETE
5. Reconciled stale documentation dates for Waves 6–9 to 2026-10-02
6. Reconciled `current-state.md` with final implemented state while preserving original audit context

---

## Feature Status

Wave 1: **COMPLETE**
Wave 2: **COMPLETE**
Wave 3: **COMPLETE**
Wave 4: **COMPLETE**
Wave 5: **COMPLETE**
Wave 6: **COMPLETE**
Wave 7: **COMPLETE**
Wave 8: **COMPLETE**
Wave 9: **COMPLETE**
Overall: **COMPLETE**
Next: Wave 8–9 remaining work = none for this feature; future work remains out of scope
