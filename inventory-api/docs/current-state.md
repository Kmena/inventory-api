# Current State

## 1. System overview
This repository is a Node.js 20 modular monolith implemented with Express, Prisma and PostgreSQL. It serves both JSON APIs and an embedded browser runtime from `src/public/`.

The current implementation includes:
- authentication and authorization
- company, client, product, warehouse and inventory management
- sales routes and agent workspace
- orders, invoices, payments and payment receipt evidence
- repository-level quality gates and runtime governance scripts

The implementation cycle refreshed in this document closed minimum evidence for the Windows Prisma CI baseline and repaired the Prisma client import-chain regression baseline with characterization coverage.

## 2. Repository structure
Key paths inspected:
- `src/app.js`, `src/server.js` — application bootstrap
- `src/routes/` — HTTP input adapters
- `src/services/` — application/business orchestration
- `src/repositories/` — Prisma-backed persistence adapters
- `src/lib/` — shared runtime utilities, including Prisma bootstrap and build helpers
- `src/public/` — embedded browser runtime
- `prisma/schema.prisma`, `prisma/migrations/` — persistence model and migrations
- `.github/workflows/` — repository quality gates and build workflows
- `tests/` — automated characterization, contract and regression tests
- `scripts/` — verification, validation and operational support scripts

## 3. Current architecture
Current architectural style is a layered modular monolith:
- routes call services
- services coordinate validation, authorization and repositories
- repositories use Prisma directly
- static browser assets are served by the same runtime

For repository governance, the build/runtime baseline now also includes:
- `scripts/prisma-generate-safe.js`
- `scripts/prisma-generate-safe-lib.js`
- `.github/workflows/windows-prisma-build.yml`
- `scripts/validate-workflow-baseline.js`
- `npm run verify`

There is still no explicit hexagonal module split by domain, but the repository now has stronger architectural seams around runtime verification and build governance.

## 4. Existing domains and modules
Observed functional modules:
- Identity and Access — `auth.service`, auth/authorization middlewares, roles/permissions
- Company Administration — company routes/services/repositories
- Customer Management — clients, stores, documents and related references
- Product Catalog — products, prices and imports
- Inventory — warehouses, lots, stock movements and lot policies
- Sales Routing / Agent Workspace — routes, goals, assignments, visits and agent views
- Orders — draft/approval/dispatch lifecycle
- Billing and Collections — invoices, payments and payment receipt evidence
- Platform Runtime Governance — CI workflows, validation scripts, browser runtime and Prisma generation wrapper

## 5. Main use cases
Representative implemented use cases confirmed from repository structure and tests:
- authenticate and resolve current actor context
- manage company-scoped master data
- create and adjust inventory entries and lots
- create and manage orders, invoices and payments
- upload and retrieve payment receipt evidence through protected API paths
- run repository validation through `lint`, `typecheck`, `build`, `test` and `verify`
- validate workflow baseline and public-runtime contracts
- exercise a dedicated Windows Prisma build workflow in CI

## 6. Current data flows
Relevant flows for this refresh:

### Prisma build flow
1. `npm run build` executes `node scripts/prisma-generate-safe.js`
2. the wrapper delegates to `scripts/prisma-generate-safe-lib.js`
3. the library removes stale Windows Prisma engine temp files when present
4. failures are classified as retryable Windows rename-locks or non-retryable failures
5. bounded retry delays are applied for retryable Windows failures
6. final failure output includes actionable Windows guidance

### Payment receipt evidence import chain
1. `src/services/payment-receipt-evidence.service.js` depends on payment repository behavior
2. repository dependencies resolve through `src/lib/prisma.js`
3. `tests/prisma-client-baseline-characterization.test.js` now characterizes that this import chain does not fail with the historical missing `.prisma/client/default` symptom in the current repository state

### Repository verification flow
1. workflow jobs and local scripts use `npm ci`
2. `npm run build` generates Prisma client through the guarded wrapper
3. `npm run verify` runs lint, typecheck, public-runtime checks, workflow baseline validation, operational readiness validation, build and test

## 7. Database and persistence
Persistence remains Prisma + PostgreSQL.

Scope-relevant observations:
- Prisma client bootstrap is centralized in `src/lib/prisma.js`
- the current repository state no longer reproduces the historical `.prisma/client/default` import-chain failure according to the new characterization test and the implementation evidence provided for this cycle
- schema and migrations were not changed as part of this documentation refresh

## 8. APIs and integrations
Relevant current APIs and contracts:
- `POST /api/auth/login` remains the authentication entry point
- payment receipt evidence serialization exposes protected download URLs under `/api/payments/:paymentId/receipts/:receiptId/download`
- the embedded runtime remains served from `src/public/`
- repository governance depends on GitHub Actions workflows and local validation scripts, not on external deployment services

## 9. Authentication and authorization
Current access model remains JWT + middleware reload/authorization enforcement.

Scope-relevant note:
- payment receipt evidence continues to use protected API download paths rather than public static exposure in the tested serialization contract

## 10. Events and background processing
No asynchronous event bus or background worker was identified in this refresh. Build governance and verification remain synchronous script/workflow execution concerns.

## 11. Containers and deployment
Observed deployment/governance files:
- `Dockerfile`
- `docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.prod.yml`
- `.github/workflows/build-and-publish.yml`
- `.github/workflows/operational-smoke.yml`

Scope-relevant note:
- the current cycle did not change container runtime code, but the repository-level workflow baseline still depends on successful Prisma generation before other gates.

## 12. Current testing strategy
The repository now has an active automated test baseline using `node --test` via `npm test`.

Relevant tests for this refresh include:
- `tests/prisma-client-baseline-characterization.test.js`
- `tests/payment-receipt-evidence.service.test.js`
- `tests/prisma-windows-build-stabilization.test.js`
- broader repository regression suite under `tests/`

Implementation-cycle evidence supplied by the user indicates:
- `node --test tests/prisma-client-baseline-characterization.test.js` passed
- `node --test tests/payment-receipt-evidence.service.test.js` passed
- `npm run test -- --silent` passed with `274 pass, 0 fail, 2 skip`
- `npm run verify` passed

This document records that evidence as reported cycle output; it was not re-executed during this documentation refresh.

## 13. Behavior to preserve
- Prisma generation must continue going through the guarded wrapper scripts
- workflow baseline validation must continue requiring `windows-prisma-build.yml`
- payment receipt evidence serialization must keep protected download URLs
- payment receipt evidence import chain must continue resolving through `src/lib/prisma.js`
- the repository test runner must continue auto-discovering tests under `tests/`
- `npm run verify` must continue acting as the aggregated repository quality gate

## 14. Known defects
- Local standalone Windows `npm run build` can still fail intermittently with Prisma engine file rename-lock `EPERM`
- minimum CI evidence exists for the Windows Prisma path, but full local stabilization certainty is not yet established across all Windows environments
- the historical `.prisma/client/default` import-chain failure is no longer reproducible in the current repository state, but the repository still depends on characterization coverage to detect regression early

## 15. Architectural debt
- build stability still depends partly on environmental behavior outside the repository
- Prisma generation is a critical shared runtime dependency across build, tests and workflows
- architectural documentation previously pointed to non-present spec packages; this refresh aligns docs with the repository as inspected now
- domain/application/infrastructure boundaries remain broader than a strict hexagonal architecture target

## 16. Security risks
- No new security defect was identified in this refresh scope
- residual operational risk remains if Windows-specific Prisma generation failures block local verification or encourage ad hoc developer workarounds
- the repository should continue treating build-wrapper guidance and protected payment receipt paths as controlled interfaces

## 17. Unknowns and assumptions
- The successful CI run for `windows-prisma-build.yml` was supplied by the user as external implementation evidence: run `30036439578`, job `89305462913`, branch `login-guidelines-alignment`, commit `6c35570a7e1b8371fd74e36527d9fb17e22c212b`
- This refresh assumes that evidence is authoritative for minimum CI closure because the run metadata is not stored in the repository itself
- The exact root cause of the remaining local Windows Prisma rename-lock behavior cannot be confirmed from source inspection alone
