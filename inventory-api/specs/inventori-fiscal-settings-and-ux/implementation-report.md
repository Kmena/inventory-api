# Implementation Report — Inventori Fiscal Settings UX

Feature: `inventori-fiscal-settings-and-ux`  
Final wave: 10  
Status: **COMPLETE**

> Canonical specification consolidated during final implementation waves from the
> implementation and test evidence of Waves 1–8, completed in Wave 9 (integration /
> regression), and finalised in Wave 10 (documentation closure).

---

## 1. Problem Solved

Inventori needed a UX surface allowing authorised company administrators to:

1. View their company's fiscal status (taxpayer verification, economic activities).
2. Enable or disable economic activities for future fiscal document issuance.
3. Change the default economic activity.
4. Refresh economic activities from the authoritative Billing/Hacienda source.
5. View the authoritative fiscal readiness verdict for their configured environment.

All fiscal truth is owned by Billing. Inventori acts as a permission-scoped,
company-isolated UX proxy. No fiscal logic is duplicated.

---

## 2. Architecture

```
Inventori Browser (fiscal-settings-admin.js)
  │  uses InventoryAuth.fetchJson only — no direct Billing calls
  │
  ▼
Inventori Backend (/api/company/fiscal-settings/*)
  │  JWT-authenticated, company-scoped, permission-gated
  │  fiscal-settings.routes.js → fiscal-settings.service.js
  │
  ▼
BillingApiClient (billing-api-client.service.js)
  │  X-API-Key M2M authentication — server-side only
  │  secretReference from CompanyBillingIntegrationConfig — server-side only
  │
  ▼
Billing M2M API (/api/v1/companies/{billingCompanyId}/fiscal-onboarding/*)
  │
  ▼
Billing fiscal domain
  │  owns: taxpayer verification, activities, credentials, certificates,
  │        fiscal readiness, fiscal documents, Hacienda communication
  │
  ▼
Hacienda  ← only contacted when Billing operations require it
           (e.g., verifyFiscalOnboarding may trigger Hacienda lookup)
```

**Inventori does NOT calculate fiscal readiness.**  
`readyToIssue` comes from Billing; Inventori proxies it verbatim.

---

## 3. Data Ownership

### Billing owns

- Hacienda integration and OAuth
- Fiscal company configuration and credentials
- Certificate / PIN secret references (never sent to browser)
- Taxpayer identity verification via Hacienda
- Verified economic activities (`code`, `description`, `haciendaStatus`,
  `haciendaKind`, `billingEnabled`, `verifiedAt`, `lastSeenAt`, `verificationSource`)
- Default fiscal activity identifier
- Fiscal readiness verdict (`readyToIssue`, `reasonCodes`, `warnings`)
- Fiscal documents (XML, XAdES, XSD, clave, consecutive)
- Fiscal submissions to Hacienda

### Inventori owns

- User/role/permission model and enforcement
- Company isolation
- UX proxy to Billing fiscal-settings surface
- `CompanyBillingIntegrationConfig` (mapping record)
- Audit trail for Inventori-side mutations
- Browser-safe DTO projection (strips `billingCompanyId`, `billingTenantId`,
  `secretRef`, Billing internal activity `id`)
- Commercial application (sales, inventory, orders)

---

## 4. Inventori API Surface

All routes:
- Require JWT Bearer authentication (`authenticate` middleware)
- Derive `companyId` from the JWT claim only — browser cannot override it
- Ignore any `billingCompanyId`, `billingTenantId`, `billingEnvironment`, or
  `secretReference` values from query string or request body (security invariant,
  proven by Wave 9 #A3 and #L3 tests)
- Mount path prefix: `/api/company`

| Method | Path | Permission | Body | Returns |
|--------|------|-----------|------|---------|
| `GET` | `/fiscal-settings` | `fiscal.settings.view` | — | Canonical fiscal settings |
| `POST` | `/fiscal-settings/activities/refresh` | `fiscal.activities.refresh` | — | Canonical fiscal settings |
| `PATCH` | `/fiscal-settings/activities/:code` | `fiscal.activities.manage` | `{ billingEnabled: boolean }` | Canonical fiscal settings |
| `PUT` | `/fiscal-settings/activities/default` | `fiscal.activities.default.update` | `{ code: string }` | Canonical fiscal settings |
| `GET` | `/fiscal-settings/readiness` | `fiscal.readiness.view` | — | Fiscal readiness |

### Canonical fiscal settings response shape

```json
{
  "taxpayer": {
    "verificationStatus": "VERIFIED | UNVERIFIED | ...",
    "verifiedAt": "ISO8601 | null",
    "taxSituation": "AL_DIA | ...",
    "moroso": false,
    "omiso": false
  },
  "activities": [
    {
      "code": "620100",
      "description": "Actividades de desarrollo de software",
      "haciendaStatus": "A",
      "haciendaKind": "PRINCIPAL | null",
      "billingEnabled": true,
      "isDefault": true,
      "verifiedAt": "ISO8601 | null",
      "lastSeenAt": "ISO8601 | null",
      "verificationSource": "HACIENDA | null"
    }
  ],
  "defaultActivityCode": "620100 | null",
  "configuration": {
    "hasBillingIntegration": true
  }
}
```

Note: Activities are included in every fiscal settings response. There is no
separate `GET /activities` endpoint.

### Fiscal readiness response shape

```json
{
  "environment": "SANDBOX | PRODUCTION",
  "readyToIssue": true,
  "reasonCodes": [],
  "warnings": [],
  "checkedAt": "ISO8601"
}
```

Note: `billingCompanyId` from the Billing response is stripped before returning
to the browser.

### Request body schemas

`PATCH /activities/:code` — validated by `updateFiscalActivitySchema`:
```json
{ "billingEnabled": true }
```

`PUT /activities/default` — validated by `setDefaultFiscalActivitySchema`:
```json
{ "code": "620100" }
```

### Error behaviour

`fiscal-settings.service.js` applies `sanitizeBillingFailure` to all Billing
errors before they propagate to the route:

| Billing/client error | Inventori HTTP status |
|---------------------|----------------------|
| `BillingClientError` with `statusCode` 400–599 | Same `statusCode` |
| `BillingClientError` with `retryable=true`, no `statusCode` | 503 |
| `BillingClientError` without `statusCode` | 502 |
| Timeout (`AbortError` → `BILLING_TIMEOUT`) | 503 |
| Non-`BillingClientError` from billingClient | 502 `BILLING_UNAVAILABLE` |
| No billing config | 409 `BILLING_INTEGRATION_MISSING` |
| Billing disabled | 409 `BILLING_INTEGRATION_DISABLED` |
| Missing billingCompanyId | 409 `BILLING_COMPANY_ID_MISSING` |
| Missing credential ref | 409 `BILLING_CREDENTIAL_REFERENCE_MISSING` |
| Unsupported environment | 409 `BILLING_ENVIRONMENT_UNSUPPORTED` |

`secretReference` values are redacted from error messages before HTTP responses.

---

## 5. Billing M2M API Contract

BillingApiClient methods used by fiscal-settings:

| Method | HTTP | Billing path |
|--------|------|-------------|
| `getFiscalOnboardingStatus` | `GET` | `/api/v1/companies/{co}/fiscal-onboarding/status` |
| `verifyFiscalOnboarding` | `POST` | `/api/v1/companies/{co}/fiscal-onboarding/verify` |
| `updateFiscalOnboardingActivity` | `PATCH` | `/api/v1/companies/{co}/fiscal-onboarding/activities/{code}` |
| `setDefaultFiscalOnboardingActivity` | `PUT` | `/api/v1/companies/{co}/fiscal-onboarding/default-activity` |
| `getFiscalReadiness` | `GET` | `/api/v1/companies/{co}/fiscal-onboarding/{env}/readiness` |
| `getFiscalOnboardingActivities`* | `GET` | `/api/v1/companies/{co}/fiscal-onboarding/activities` |

\* `getFiscalOnboardingActivities` is implemented in `BillingApiClient` and validated
(test coverage in Wave 1 / fiscal-onboarding test file) but not called by the current
Inventori fiscal-settings service — `getFiscalOnboardingStatus` returns activities
embedded in the status response.

**M2M security invariants:**
- `X-API-Key` is resolved server-side via `BillingCredentialResolver`
  (`env:` or `ssm:` secret references)
- `billingCompanyId` and `billingTenantId` come from `CompanyBillingIntegrationConfig` only
- `secretReference` never leaves the server
- Browser never communicates directly with Billing

---

## 6. Permission Matrix

| Permission | Policy name | Endpoint | Role bundle |
|-----------|------------|---------|-------------|
| `fiscal.settings.view` | `fiscal-settings.view` | `GET /fiscal-settings` | `admin` |
| `fiscal.activities.refresh` | `fiscal-settings.activities.refresh` | `POST /activities/refresh` | `admin` |
| `fiscal.activities.manage` | `fiscal-settings.activities.manage` | `PATCH /activities/:code` | `admin` |
| `fiscal.activities.default.update` | `fiscal-settings.activities.default.update` | `PUT /activities/default` | `admin` |
| `fiscal.readiness.view` | `fiscal-settings.readiness` | `GET /fiscal-settings/readiness` | `admin` |

All 5 permissions are in the `admin` role bundle
(`src/security/role-bundles.config.js`, lines 164–168).

Frontend permission names match backend names exactly. Frontend visibility/disabled
state is UX-only — backend enforcement is authoritative.

---

## 7. Company Isolation

- `companyId` is extracted from the authenticated JWT via `getAuthenticatedCompanyId`
- `CompanyBillingIntegrationConfig` is looked up by Inventori `companyId`
- `billingCompanyId`, `billingEnvironment`, `billingCredentialSecretRef`, and
  `billingTenantId` are sourced exclusively from the config record
- Browser cannot supply or override any of these values
- Requests from company A cannot affect company B data (proven by Wave 3 and Wave 9)

---

## 8. Economic Activity Semantics

Authoritative flow:

```
Hacienda → Billing verification → CompanyEconomicActivity → Inventori Fiscal Settings
```

- Activities originate from Billing-verified Hacienda data.
- No free-text activity creation in Inventori (no `POST /activities` route exists).
- Changing `billingEnabled` or default affects future fiscal document issuance only.
- Historical fiscal documents in Billing remain immutable.
- `isDefault` is derived by matching `activity.id === status.defaultEconomicActivityId`.
- Billing internal `activity.id` is stripped from browser responses.
- `defaultActivityCode` is the human-visible code of the default activity (`null` if none).

---

## 9. Refresh Semantics

Refresh is an **explicit user action** only:

```
User click
  ↓ POST /fiscal-settings/activities/refresh
    ↓ verifyFiscalOnboarding (Billing may contact Hacienda)
      ↓ Billing persists authoritative state
        ↓ getFiscalOnboardingStatus (reload)
          ↓ canonical settings returned to browser
```

- **No automatic refresh on page load.**
- **No Inventori → Hacienda direct call.** Inventori calls Billing; Billing calls Hacienda if needed.
- Audit event `fiscal.activities.refresh.requested` is emitted on success.

---

## 10. Readiness Semantics

- `readyToIssue: true` means Billing considers the company currently ready for
  fiscal document issuance in the given environment.
- **Inventori does not reconstruct or synthesise this value.**
- `reasonCodes` — blocking reasons (array of strings); empty when ready.
- `warnings` — advisory/non-blocking conditions; `readyToIssue=true` with non-empty
  `warnings` is still READY.
- Unknown `reasonCodes` or `warnings` values must degrade gracefully in the UI.
- Infrastructure/API failure must not be silently converted to false fiscal readiness.

### UI states

| Billing response | UI class | Badge | Text |
|-----------------|----------|-------|------|
| `readyToIssue: true` | `fiscal-readiness-card--ready` | `badge-success` | ✓ Listo para facturar electrónicamente |
| `readyToIssue: false` | `fiscal-readiness-card--not-ready` | `badge-warning` | Configuración fiscal incompleta |

Known blocker message mappings (from `fiscal-settings-admin.js`):
`FISCAL_PROFILE_MISSING`, `HACIENDA_CONNECTION_MISSING`, `HACIENDA_CREDENTIALS_MISSING`,
`ACTIVE_CERTIFICATE_MISSING`, `CERTIFICATE_EXPIRED`, `CERTIFICATE_NOT_YET_VALID`,
`CERTIFICATE_IDENTITY_UNVERIFIED`, `CERTIFICATE_IDENTITY_MISMATCH`,
`FISCAL_SIGNING_CERTIFICATE_SECRET_UNAVAILABLE`, `ISSUANCE_POINT_MISSING`,
`TAXPAYER_VALIDATION_MISSING`, `TAXPAYER_NOT_ACTIVE`, `ECONOMIC_ACTIVITY_MISSING`,
`DEFAULT_ECONOMIC_ACTIVITY_MISSING`, `DEFAULT_ECONOMIC_ACTIVITY_INVALID`.

Unknown codes fall back to a generic message.

---

## 11. Audit Events

Mutation events only. GET operations produce no audit events.

| Action | Trigger | `resourceType` | `resourceId` | `metadata` |
|--------|---------|---------------|-------------|-----------|
| `fiscal.activities.refresh.requested` | POST /activities/refresh | `fiscal-settings` | `null` | `null` |
| `fiscal.activity.enabled` | PATCH with `billingEnabled: true` | `fiscal-settings` | `activityCode` | `{ activityCode }` |
| `fiscal.activity.disabled` | PATCH with `billingEnabled: false` | `fiscal-settings` | `activityCode` | `{ activityCode }` |
| `fiscal.activity.default_changed` | PUT /activities/default | `fiscal-settings` | `activityCode` | `{ activityCode }` |

- `actor` = `req.auth.sub` (authenticated user id)
- `companyId` = `req.auth.companyId`
- No API keys, credential references, certificates, or secrets in audit metadata.

---

## 12. Security

Browser responses **must not** expose:
- `billingTenantId`
- `billingCompanyId`
- Billing API key / `X-API-Key`
- `billingCredentialSecretRef` or any `secretReference`
- Certificate secret reference
- PIN reference, P12, private key
- Hacienda credentials or OAuth tokens

Communication path: Browser → Inventori only. Inventori → Billing. Billing → Hacienda.

`sanitizeBillingFailure` redacts `secretReference` values from error messages before
re-throwing, ensuring they cannot appear in HTTP error responses.

---

## 13. Runtime Contract Manifest

All 5 fiscal-settings routes are registered in `docs/runtime-contract-manifest.json`
as `intentionally-excluded` from the current partial OpenAPI baseline. Each entry
references `specs/inventori-fiscal-settings-and-ux` as the governing specification.

Mount path for all: `/api/company`

---

## 14. Frontend Architecture

| File | Role |
|------|------|
| `src/public/root/fiscal-settings-api.js` | RootShell module `fiscalSettingsApi` — 5 functions |
| `src/public/root/views/fiscal-settings-admin.js` | RootShell view `views.fiscalSettingsAdmin` |

`fiscalSettingsApi` exposes exactly:
- `getFiscalSettings(session)` — GET /fiscal-settings
- `refreshActivities(session)` — POST /activities/refresh
- `updateActivityBillingEnabled(session, code, enabled)` — PATCH /activities/:code
- `setDefaultActivity(session, code)` — PUT /activities/default
- `getFiscalReadiness(session)` — GET /fiscal-settings/readiness

All calls go through `InventoryAuth.fetchJson`. No Billing URLs, no API keys,
no hardcoded hosts in frontend code.

---

## 15. Wave History Summary

| Wave | Purpose |
|------|---------|
| 1 | `BillingApiClient` fiscal-settings methods + DTO validation for all Billing responses |
| 2 | Inventori backend: `fiscal-settings.routes.js`, `fiscal-settings.service.js`, `fiscal-settings.schema.js` |
| 3 | Permission definitions, access policies, role bundle assignment, company isolation, audit |
| 4 | Frontend shell: taxpayer status display, `fiscal-settings-api.js`, `fiscal-settings-admin.js` scaffold |
| 5 | Activity checklist: `billingEnabled` toggle with PATCH |
| 6A | Default activity: `setDefaultActivity` with PUT |
| 6B | Authoritative fiscal readiness: `getFiscalReadiness`, GET /readiness route, BLOCKER_MESSAGES |
| 7 | Explicit user-initiated refresh: POST /activities/refresh, audit event |
| 8 | UX hardening: responsive CSS, accessibility (ARIA), concurrency (disable-during-submit) |
| 9 | Integration contract matrix, Billing error mapping, malformed payload, timeout, secretRef stripping, env normalisation, manifest, synthesis regression |
| 10 | Final documentation, traceability, feature closure |

---

## 16. Test Evidence

### Per-wave test files

| File | Wave | Tests |
|------|------|-------|
| `billing-api-client-fiscal-onboarding.test.js` | 1 | 23 |
| `billing-api-client-wave6b.test.js` | 1 / 6B | 8 |
| `fiscal-settings.service.test.js` | 2 | 10 |
| `fiscal-settings.routes.test.js` | 2 | 6 |
| `fiscal-settings.wave3.test.js` | 3 | 5 |
| `fiscal-settings-root-shell-wave4.test.js` | 4 | 8 |
| `fiscal-settings-root-shell-wave5.test.js` | 5 | 14 |
| `fiscal-settings-root-shell-wave6a.test.js` | 6A | 11 |
| `fiscal-settings-root-shell-wave6b.test.js` | 6B | 47 |
| `fiscal-settings-wave6b.backend.test.js` | 6B | 9 |
| `fiscal-settings-root-shell-wave7.test.js` | 7 | 19 |
| `fiscal-settings-root-shell-wave8.test.js` | 8 | 40 |
| `fiscal-settings-wave9-integration.test.js` | 9 | 31 |

### Wave 9 integration coverage (31 tests)

Part A — Integration contract matrix (3 tests)  
Part B — Billing HTTP error-code mapping through sanitizeBillingFailure (7 tests)  
Part C — BillingApiClient malformed-payload rejection (5 tests)  
Part D — BillingApiClient timeout/AbortError (1 test)  
Part E — SecretRef non-exposure (2 tests)  
Part F — Environment normalisation (2 tests)  
Part G — GET-only endpoints produce no audit events (1 test)  
Part H — No automatic refresh (3 tests)  
Part I — No free-text activity injection (1 test)  
Part J — Frontend API module contracts (2 tests)  
Part K — Runtime contract manifest completeness (1 test)  
Part L — No readiness synthesis regression (3 tests)

### Final regression (Wave 9 baseline)

```
tests      2569
pass       2566
fail          0
skipped       3  (pre-existing P2 skips, unchanged)
```

Wave 10 is documentation-only. No product source changes. Test count unchanged.

---

## 17. Runtime Validation

Read-only smoke performed against local stack (LocalStack SSM + Billing sandbox + Inventori):

| Check | Result |
|-------|--------|
| `GET /api/company/fiscal-settings/readiness` | HTTP 200 |
| `readyToIssue` | `true` |
| `environment` | `SANDBOX` |
| `reasonCodes` | `[]` |
| `warnings` | `[]` |
| `GET /api/company/fiscal-settings` | HTTP 200 |
| Taxpayer `verificationStatus` | `VERIFIED` |
| Activities count | 1 |
| Default activity code | 9609.0 |
| `billingCompanyId` in response | NO |
| `secretRef` in response | NO |
| Hacienda requests | 0 |
| FiscalDocuments created | 0 |
| FiscalSubmissions created | 0 |

---

## 18. Human Visual Validation

| Check | Status |
|-------|--------|
| Wave 8 layout and distribution | HUMAN APPROVED |
| READY state: "✓ Listo para facturar electrónicamente" | HUMAN APPROVED |
| URL: `http://localhost:2500/root/#configuracion_fiscal` | CONFIRMED |
| Browser automation availability | NOT AVAILABLE (tooling limitation only) |

Browser automation unavailability is a **non-blocking tooling limitation**.
Human visual verification satisfies the release-readiness requirement.

---

## 19. Technical Debt

### P2 — Non-blocking

| Item | Detail |
|------|--------|
| OpenAPI coverage | Fiscal-settings routes are intentionally excluded from the current partial OpenAPI baseline. All 5 routes are registered in `docs/runtime-contract-manifest.json`. OpenAPI update is a future contractual task. |

### External development-environment limitation

| Item | Detail |
|------|--------|
| LocalStack Community SSM state | LocalStack Community may lose SSM parameter state on restart. Recovery uses existing Billing scripts: `npm run dev:seed-ssm` and `npm run dev:restore-cert`. This is not an Inventori defect, not a production issue, and not a release blocker. |

### Resolved items (not carried forward)

- ~~LocalFileSecretProvider~~ — Removed. Billing's approved local dev architecture is
  `AwsParameterStoreSecretProvider → LocalStack SSM`. `LocalFileSecretProvider` is
  not part of the approved architecture.
- ~~Human READY visual confirmation~~ — Resolved. Human visual validation complete.
- ~~Browser automation unavailable as release blocker~~ — Reclassified as tooling
  limitation only.

---

## 20. Risk Register

| Risk | Mitigation |
|------|-----------|
| Billing unavailable | `sanitizeBillingFailure` → 502/503; UI shows recoverable error, not false readiness |
| Stale taxpayer / activity verification | Explicit refresh action; user-initiated only |
| Unknown `reasonCodes` or `warnings` | Frontend falls back to generic message; no crash |
| Credential resolution failure | `BillingCredentialResolver` throws; `sanitizeBillingFailure` strips secret from error message |
| Company mapping failure | `assertBillingIntegrationReady` throws 409 before any Billing call |
| Cross-company access | `companyId` from JWT only; `CompanyBillingIntegrationConfig` lookup isolates data |
| Accidental direct Hacienda coupling | Billing is the only external system called; verified by Wave 9 runtime smoke (0 Hacienda requests) |
| Secret exposure | `sanitizeBillingFailure` redacts; `getFiscalReadiness` strips `billingCompanyId`; no secrets in frontend |
| Frontend/backend contract drift | Wave 9 Part J tests verify exact function count and InventoryAuth usage; Part K verifies manifest |
| `readyToIssue` synthesis | Wave 9 Part L tests verify no local assignment in service or frontend |

---

## 21. Final Release Verdict

- All 5 Inventori fiscal-settings API routes implemented and tested: ✅
- All 5 permissions defined, assigned, and enforced: ✅
- Company isolation enforced at JWT level: ✅
- No Billing secrets exposed to browser: ✅
- No `readyToIssue` synthesis: ✅
- No automatic refresh: ✅
- No free-text activity creation: ✅
- Human visual validation: ✅ APPROVED
- Full regression: 2566/2569 pass, 0 fail: ✅
- P0 technical debt: **NONE**
- Remaining P2 debt: OpenAPI coverage (non-blocking)

**FEATURE STATUS: COMPLETE**  
**RELEASE READINESS: READY**
