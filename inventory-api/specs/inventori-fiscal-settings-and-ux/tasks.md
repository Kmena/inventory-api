# Tasks — Inventori Fiscal Settings UX

Feature: `inventori-fiscal-settings-and-ux`  
Spec directory: `specs/inventori-fiscal-settings-and-ux/`

> Canonical specification consolidated during final implementation waves from
> the implementation and test evidence of Waves 1–8, and finalised in Wave 10.

## Wave History

| Wave | Scope | Test File(s) | Status |
|------|-------|-------------|--------|
| 1 | `BillingApiClient` fiscal-settings methods, DTO validation | `billing-api-client-fiscal-onboarding.test.js`, `billing-api-client-wave6b.test.js` | ✅ COMPLETE |
| 2 | Inventori backend routes + service (`fiscal-settings.routes.js`, `fiscal-settings.service.js`) | `fiscal-settings.routes.test.js`, `fiscal-settings.service.test.js` | ✅ COMPLETE |
| 3 | Permissions, company scoping, audit events | `fiscal-settings.wave3.test.js` | ✅ COMPLETE |
| 4 | Frontend shell + taxpayer status display (`fiscal-settings-admin.js`) | `fiscal-settings-root-shell-wave4.test.js` | ✅ COMPLETE |
| 5 | Economic activity checklist (enable/disable) | `fiscal-settings-root-shell-wave5.test.js` | ✅ COMPLETE |
| 6A | Default economic activity selection | `fiscal-settings-root-shell-wave6a.test.js` | ✅ COMPLETE |
| 6B | Authoritative fiscal readiness endpoint (Billing-delegated) | `fiscal-settings-root-shell-wave6b.test.js`, `fiscal-settings-wave6b.backend.test.js` | ✅ COMPLETE |
| 7 | Economic activity refresh (explicit user action) | `fiscal-settings-root-shell-wave7.test.js` | ✅ COMPLETE |
| 8 | UX / responsive / accessibility / concurrency hardening | `fiscal-settings-root-shell-wave8.test.js` | ✅ COMPLETE |
| 9 | Integration contract, regression, release readiness | `fiscal-settings-wave9-integration.test.js` | ✅ COMPLETE |
| 10 | Final documentation / traceability / feature closure | (doc-only) | ✅ COMPLETE |

## Feature Status

**COMPLETE. No further waves approved.**
