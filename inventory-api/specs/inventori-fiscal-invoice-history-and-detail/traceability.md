# Traceability — Inventori Fiscal Invoice History & Detail

Feature: `inventori-fiscal-invoice-history-and-detail`

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

---

## Requirements → Waves → Tests

### FH-NUMBER

| Req | Description | Wave | Test | Status |
|-----|-------------|------|------|--------|
| FH-NUMBER-001 | `invoiceNumber` in API response | Wave 1 | `invoice-fiscal-dto.test.js` — `serializeInvoiceForList includes invoiceNumber from invoice.number` | ✅ COMPLETE |
| FH-NUMBER-002 | List/detail render invoiceNumber | Wave 2 | `invoice-list-fiscal-status.test.js` — W2-R-01 | ✅ COMPLETE |

### FH-DTO

| Req | Description | Wave | Test | Status |
|-----|-------------|------|------|--------|
| FH-DTO-001 | `serializeInvoiceForList` shape | Wave 1 | `invoice-fiscal-dto.test.js` — 10 list serializer tests | ✅ COMPLETE |
| FH-DTO-002 | `serializeInvoiceForDetail` shape | Wave 1 | `invoice-fiscal-dto.test.js` — 9 detail serializer tests | ✅ COMPLETE |
| FH-DTO-003 | Excluded fields by construction | Wave 1 | `invoice-fiscal-dto.test.js` — `buildFiscalDto/Detail excludes all internal fields` + `no internal FiscalIntent fields` | ✅ COMPLETE |
| FH-DTO-004 | `acceptedAt` null for non-ACCEPTED | Wave 1 | `invoice-fiscal-dto.test.js` — REJECTED/ERROR_FINAL/ERROR_RETRYABLE/PROCESSING tests | ✅ COMPLETE |
| FH-DTO-005 | `clave`/`consecutive` null when absent | Wave 1 | `invoice-fiscal-dto.test.js` — `PENDING intent: clave/consecutive null` | ✅ COMPLETE |

### FH-LIST

| Req | Description | Wave | Test |
|-----|-------------|------|------|
| FH-LIST-001 | Fiscal status column in list | Wave 2 | `invoice-list-fiscal-status.test.js` (AC-012 to AC-015) — W2-R-03 to W2-R-09 | ✅ COMPLETE |
| FH-LIST-002 | `fiscal=null` → dash | Wave 2 | `invoice-list-fiscal-status.test.js` (AC-014) — W2-R-02 | ✅ COMPLETE |
| FH-LIST-003 | Fiscal badge distinct from commercial | Wave 2 | `invoice-list-fiscal-status.test.js` — W2-R-11, W2-R-12 | ✅ COMPLETE |
| FH-LIST-004 | invoiceNumber shown | Wave 2 | `invoice-list-fiscal-status.test.js` (AC-001) — W2-R-01 | ✅ COMPLETE |

### FH-DETAIL

| Req | Description | Wave | Test |
|-----|-------------|------|------|
| FH-DETAIL-001 | Detail panel opens | Wave 3 | `invoice-detail-panel.test.js` (AC-016) |
| FH-DETAIL-002 | General info displayed | Wave 3 | `invoice-detail-panel.test.js` (AC-017) |
| FH-DETAIL-003 | Payments displayed | Wave 3 | `invoice-detail-panel.test.js` (AC-018) |
| FH-DETAIL-004 | Commercial/fiscal sections separate | Wave 4 | `invoice-fiscal-detail.test.js` (AC-027) |

### FH-FISCAL

| Req | Description | Wave | Test |
|-----|-------------|------|------|
| FH-FISCAL-001 | `fiscal=null` neutral message | Wave 4 | `invoice-fiscal-detail.test.js` (AC-026) |
| FH-FISCAL-002 | All 6 states with labels/descriptions | Wave 4 | `invoice-fiscal-detail.test.js` (AC-021 to AC-025) |
| FH-FISCAL-003 | ACCEPTED: clave/consecutive/acceptedAt | Wave 4 | `invoice-fiscal-detail.test.js` (AC-021) |
| FH-FISCAL-004 | PENDING/PROCESSING: no clave | Wave 4 | `invoice-fiscal-detail.test.js` (AC-022) |
| FH-FISCAL-005 | REJECTED etc.: no failureMessage in DOM | Wave 4 | `invoice-fiscal-detail.test.js` (AC-023) |
| FH-FISCAL-006 | Fiscal section header labelled | Wave 4 | `invoice-fiscal-detail.test.js` |

### FH-ARTIFACT

| Req | Description | Wave | Test |
|-----|-------------|------|------|
| FH-ARTIFACT-001 | Buttons for ACCEPTED with artifacts | Wave 5 | `invoice-fiscal-artifacts.test.js` (AC-029) |
| FH-ARTIFACT-002 | Three download types | Wave 5 | `invoice-fiscal-artifacts.test.js` |
| FH-ARTIFACT-003 | Inventori proxy URL only | Wave 5 | `invoice-fiscal-artifacts.test.js` (AC-030) |
| FH-ARTIFACT-004 | Requires invoice.fiscal-artifact | Wave 5 | `invoice-fiscal-artifacts.test.js` (AC-032) |
| FH-ARTIFACT-005 | Informative message when unavailable | Wave 5 | `invoice-fiscal-artifacts.test.js` (AC-031) |
| FH-ARTIFACT-006 | Download error → inline message | Wave 5 | `invoice-fiscal-artifacts.test.js` (AC-033) |
| FH-ARTIFACT-007 | Lazy artifact load (ACCEPTED only) | Wave 5 | `invoice-fiscal-artifacts.test.js` |

### FH-SEC

| Req | Description | Wave | Test |
|-----|-------------|------|------|
| FH-SEC-001 | Internal fields never in response | Wave 6 | `invoice-fiscal-security.test.js` (AC-010, AC-011) |
| FH-SEC-002 | Company isolation | Wave 6 | `invoice-fiscal-security.test.js` (AC-034, AC-035) |
| FH-SEC-003 | Artifact proxy isolation | Wave 6 | `invoice-fiscal-security.test.js` (AC-035) |
| FH-SEC-004 | Cross-company blocked | Wave 6 | `invoice-fiscal-security.test.js` (AC-034) |

### FH-PERM

| Req | Description | Wave | Test |
|-----|-------------|------|------|
| FH-PERM-001 | invoice.list reused | Wave 6/8 | `invoice-fiscal-history-integration.test.js` |
| FH-PERM-002 | invoice.detail reused | Wave 6/8 | |
| FH-PERM-003 | invoice.fiscal-artifact reused | Wave 5/6 | `invoice-fiscal-artifacts.test.js` |

### FH-UX

| Req | Description | Wave | Test |
|-----|-------------|------|------|
| FH-UX-001 | Clave no layout break | Wave 7 | `invoice-fiscal-ux.test.js` (AC-028, AC-040) |
| FH-UX-002 | Close action visible | Wave 7 | `invoice-fiscal-ux.test.js` (AC-020) |
| FH-UX-003 | Download loading state | Wave 7 | `invoice-fiscal-ux.test.js` |
| FH-UX-004 | Detail loading/error states | Wave 7 | `invoice-fiscal-ux.test.js` |
| FH-UX-005 | Compact fiscal badge in list | Wave 2 | `invoice-list-fiscal-status.test.js` — W2-H-01 to W2-H-05 | ✅ COMPLETE |
| FH-UX-006 | Responsive panel | Wave 7 | `invoice-fiscal-ux.test.js` (AC-039) |
| FH-UX-007 | Dialog ARIA | Wave 7 | `invoice-fiscal-ux.test.js` (AC-037) |

---

## Acceptance Criteria → Waves

| AC | Requirement | Wave |
|----|-------------|------|
| AC-001 to AC-003 | FH-NUMBER | Wave 1/2 |
| AC-004 to AC-011 | FH-DTO | Wave 1/6 |
| AC-012 to AC-015 | FH-LIST | Wave 2 |
| AC-016 to AC-020 | FH-DETAIL | Wave 3/7 |
| AC-021 to AC-028 | FH-FISCAL | Wave 4/7 |
| AC-029 to AC-033 | FH-ARTIFACT | Wave 5 |
| AC-034 to AC-036 | FH-SEC | Wave 6 |
| AC-037 to AC-038 | FH-UX (accessibility) | Wave 7 |
| AC-039 to AC-040 | FH-UX (responsive) | Wave 7 |

---

## Planned Test Files

| Test File | Wave | Coverage |
|-----------|------|---------|
| `invoice-fiscal-dto.test.js` | 1 | DTO construction, exclusions, null intent, acceptedAt rules |
| `invoice-list-fiscal-status.test.js` | 2 | List render, fiscal badge, invoiceNumber fix |
| `invoice-detail-panel.test.js` | 3 | Panel open/close, general info, payments |
| `invoice-fiscal-detail.test.js` | 4 | All 6 fiscal states, clave display, separation |
| `invoice-fiscal-artifacts.test.js` | 5 | Artifact buttons, proxy URLs, permission gate |
| `invoice-fiscal-security.test.js` | 6 | Cross-company, field exclusion, isolation |
| `invoice-fiscal-ux.test.js` | 7 | ARIA, responsive, loading/error states |
| `invoice-fiscal-history-integration.test.js` | 8 | Full E2E-style integration, regression |
