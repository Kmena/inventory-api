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

## Wave 3 — Invoice Detail Panel: Commercial + Payment Information

**Goal:** Add a clickable detail panel to invoice rows in the billing admin view.

**Scope:**
1. `billing-admin.renderers.js`: add `renderInvoiceDetailModal(invoice)` function
2. Display: invoiceNumber, clientName, orderId/clientStoreName, amount, issuedAt, dueAt, commercial status badge
3. Display: registered payments list (method, amount, status, date)
4. `billing-admin.js`: bind click/open handler on invoice row or a new detail button
5. Modal: `role="dialog"`, `aria-labelledby`, focus management, close button, Escape key
6. `billing-api.js`: ensure `fetchInvoiceDetail(session, invoiceId)` is available (added in Wave 2)

**Test file:** `invoice-detail-panel.test.js`
- Opening detail panel calls `fetchInvoiceDetail` with correct invoiceId
- Panel renders invoice number, client name, amount, status
- Panel renders payments list
- Panel has close button and responds to Escape key
- Panel does not render fiscal section yet (added Wave 4)

---

## Wave 4 — Fiscal Detail: All Six Fiscal States

**Goal:** Add the "Comprobante electrónico" section to the detail panel, handling all six states.

**Scope:**
1. `billing-admin.helpers.js`: add `fiscalStatusLabel`, `fiscalStatusBadgeClass`, `fiscalStatusDescription` constants and functions
2. `billing-admin.renderers.js`: add `renderFiscalStatusSection(fiscal)` function
3. Include section in `renderInvoiceDetailModal`
4. ACCEPTED: show clave, consecutive, acceptedAt
5. PENDING/PROCESSING: show status badge + description only
6. REJECTED/ERROR_RETRYABLE/ERROR_FINAL: show status badge + description (no failureMessage)
7. `fiscal === null`: show neutral "Sin factura electrónica asociada" message
8. Clave display: word-wrap or monospace with overflow-wrap: break-all

**Test file:** `invoice-fiscal-detail.test.js`
- ACCEPTED: renders clave, consecutive, acceptedAt
- PENDING: renders label/description, no clave/consecutive
- PROCESSING: renders label/description
- REJECTED: renders label/description, NO failureMessage in DOM
- ERROR_RETRYABLE: renders label/description
- ERROR_FINAL: renders label/description
- fiscal=null: renders neutral message
- Fiscal section is visually separate from commercial status section
- Long clave does not overflow container

---

## Wave 5 — Artifact Availability + Downloads

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

## Wave 6 — Security + Tenant Isolation + Error Handling

**Goal:** Confirm no internal fields leak; confirm cross-company isolation; harden error paths.

**Scope:**
1. Integration test: verify `GET /api/invoices` response contains NO internal fields (failureMessage, failureCode, idempotencyKey, billingFiscalDocumentId, billingStatus, metadata, billingPayload, processingNodeId)
2. Integration test: verify `GET /api/invoices/:id` response contains same exclusions
3. Cross-company test: Company A admin cannot fetch invoice detail for Company B invoice
4. Cross-company test: Company A admin cannot download Company B artifacts
5. Malformed invoiceId in route: 400/404 (not 500)
6. Invoice with no fiscal intent: `fiscal: null` (not error)
7. Invoice with intent but missing clave (PENDING/PROCESSING): `clave: null` (not error)
8. Error mapping: Billing unavailable during artifact fetch → 502 (not 500)

**Test file:** `invoice-fiscal-security.test.js`
- All exclusion checks (FH-SEC-001)
- Cross-company detail access blocked
- Cross-company artifact access blocked
- Null intent → `fiscal: null`
- Missing clave → `clave: null`
- Billing 503 during artifact → safe 502 response

---

## Wave 7 — Responsive + Accessibility + UX Hardening

**Goal:** Ensure layout, accessibility, and UX states are complete.

**Scope:**
1. Invoice detail modal: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus trap
2. Open: focus moves to dialog heading or close button
3. Close (Escape, close button): focus returns to triggering element
4. Fiscal status badges: `aria-label` with full description for icon-only variants
5. Clave cell: `word-break: break-all` CSS to prevent layout overflow on narrow screens
6. Download buttons: `aria-label="Descargar PDF del comprobante electrónico"` etc.
7. Responsive: on narrow viewports, detail panel scrolls; sections stack; download buttons wrap
8. Loading state: skeleton or spinner in detail panel while fetching
9. Error state: error message + retry button in detail panel
10. Download in-progress: disable button + loading indicator

**Test file:** `invoice-fiscal-ux.test.js`
- Dialog has role=dialog and aria-labelledby
- Escape key closes dialog
- Focus returns to trigger on close
- Clave cell has overflow CSS applied
- Download buttons have aria-labels
- Loading state renders skeleton
- Error state renders retry button

---

## Wave 8 — Integration + Full Regression

**Goal:** Full integration testing of all P0 scope against the complete feature.

**Scope:**
1. Full E2E-style test covering: list → open detail → read fiscal status → download artifact
2. All six fiscal states integration test (each state represented in list + detail)
3. Invoice with no fiscal intent integration test
4. Artifact download proxy integration test (mocked Billing response)
5. Permission matrix test: invoice.list, invoice.detail, invoice.fiscal-artifact gates
6. Regression: existing `fetchReceivables` / `fetchPendingPayments` / `fetchClientLedger` still work
7. Regression: invoice.number bug confirmed fixed

**Test file:** `invoice-fiscal-history-integration.test.js`

---

## Wave 9 — Documentation + Implementation Report + Closure

**Goal:** Final documentation, traceability update, implementation report.

**Scope:**
1. Update `traceability.md` with final implementation evidence
2. Create `implementation-report.md` with:
   - Wave history
   - Final test counts
   - DTO contract documentation
   - Security invariant evidence
   - Known limitations
3. Update `metadata.yaml`: `implementation_status: complete`
4. Update `tasks.md`: all waves marked COMPLETE

---

## Feature Status

Wave 1: **COMPLETE**  
Wave 2: **COMPLETE**  
Wave 3–9: **NOT YET STARTED**  
Overall: **IN PROGRESS**  
Next: Wave 3 — Invoice Detail Panel: Commercial + Payment Information
