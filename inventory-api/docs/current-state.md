# Current State

## 1. System overview
`inventory-api/` is a single-deployable Node.js 24 modular monolith built with Express and Prisma over PostgreSQL.

The currently implemented system:
- serves REST-style JSON APIs under `/api/*`;
- serves static browser assets from `src/public/` from the same Express process;
- uses Prisma with versioned SQL migrations;
- enforces authentication, authorization, throttling, request logging, and selected security headers in the HTTP layer;
- uses repository validation through scripts, tests, GitHub Actions workflows, and an explicit CI critical-controls matrix in `docs/ci-critical-controls.md`.

P11 (`specs/p11-audit-emergency-hardening`) finished its planning/documentation package (`TASK-001` through `TASK-004`).

After that planning package, `specs/p11-tenant-isolation-fixes` completed the first runtime hardening slice:
- tenant-owned repository writes for client documents, orders, and sales routes are now scoped at the repository mutation boundary;
- review-required tenant-safety cases for legal entities, payment receipt replacement, and the dormant product update helper were hardened;
- internal service-to-repository signatures changed where required to propagate `companyId`, but no public API contract, schema, or container contract changed in the slice.

## 2. Repository structure
High-signal paths verified in this refresh:
- `src/app.js`, `src/server.js`
- `src/routes/`, `src/services/`, `src/repositories/`, `src/middlewares/`, `src/public/`
- `src/lib/`, `src/security/`, `src/schemas/`
- `prisma/schema.prisma`, `prisma/migrations/`
- `.github/workflows/`
- `tests/`
- `scripts/`
- `docs/`
- `specs/p11-audit-emergency-hardening/`

Verified repository-governance workflows:
- `.github/workflows/static-checks.yml`
- `.github/workflows/repository-tests.yml`
- `.github/workflows/db-constraints-tests.yml`
- `.github/workflows/contract-validations.yml`
- `.github/workflows/browser-e2e.yml`
- `.github/workflows/operational-smoke.yml`
- `.github/workflows/windows-prisma-build.yml`
- `.github/workflows/build-and-publish.yml`

## 3. Current architecture
Current implemented architecture remains layered:
- Express app and HTTP middleware at the boundary;
- route modules delegate to service modules;
- services coordinate business logic, authorization-aware flows, and repository calls;
- repositories encapsulate most Prisma access;
- static browser assets are served by the same runtime process.

Strict hexagonal boundaries are not yet implemented. P11 completed planning and governance documentation only; no new runtime modules, ports, or adapters were introduced.

## 4. Existing domains and modules
Current functional areas observable in code and tests:
- Authentication and authorization
- Company, role, and user administration
- Client management and client documents
- Product catalog and inventory
- Warehouses and geography
- Sales routes and agent workspace
- Orders, invoices, and payments
- Embedded browser runtime
- Repository/platform governance

## 5. Main use cases
Examples still implemented after the P11 planning package and the first tenant-isolation implementation slice:
- login via `/api/auth/login`
- retrieve authenticated context via `/api/auth/me`
- manage companies, roles, users, clients, products, warehouses, routes, orders, invoices, and payments
- use embedded root, warehouse, and agent browser screens
- run repository validation via `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run validate:workflow-baseline`, `npm run validate:public-runtime`, `npm run validate:operational-readiness`, `npm run validate:production-baseline`, and `npm run verify`

## 6. Current data flows
### Runtime flow
1. Express receives requests.
2. Security, auth, throttling, metrics, logging, and validation middleware execute.
3. Routes call services.
4. Services call repositories and Prisma-backed persistence.
5. Responses return JSON or static assets.

### Repository governance flow
1. Scripts in `scripts/` implement build and validation checks.
2. Tests in `tests/` characterize runtime, governance, and selected business behavior.
3. GitHub Actions workflows under `.github/workflows/` execute static checks, repository tests, dedicated DB-constraints tests, contract validation, browser E2E, operational smoke, Windows Prisma evidence, and build/publish automation.
4. Spec packages under `specs/` document approved feature and hardening work.

## 7. Database and persistence
- Prisma schema remains in `prisma/schema.prisma`.
- Versioned migrations remain in `prisma/migrations/`.
- No migration was added or modified by the P11 planning package, by `p11-tenant-isolation-fixes`, or by `p11-repository-boundary-root-bootstrap`.
- Persistence remains repository + Prisma based.
- The former direct-Prisma service-layer exception in `src/services/company.service.js#registerRootCompany` is now removed from the current implementation: duplicate username lookup and the bootstrap transaction now live in `src/repositories/company.repository.js`.
- `company.repository.js#registerRootCompanyBootstrap(...)` now owns persistence for admin-role upsert, company creation, default client classifications, fiscal config creation, root-user creation, and fiscal-sequence bootstrap.
- `company.service.js#registerRootCompany(...)` now keeps authorization, password hashing, duplicate-conflict mapping, and audit orchestration only; audit logging is preserved through a repository `onSuccess(result, tx)` hook executed inside the transaction.
- Tenant-owned write safety remains improved from the earlier P11 implementation slice: client-document writes, order writes, sales-route update, payment-receipt replacement, legal-entity upsert update, and the dormant product update helper enforce tenant scope at the repository mutation boundary.
- The remaining P11 follow-up work after this refresh is not the Node baseline declaration itself; it is the final closure evidence for `p11-node24-runtime-migration` on a hosted Windows run of the updated workflow.

## 8. APIs and integrations
Current observable interfaces:
- REST-style endpoints under `/api/*`
- health endpoints under `/health/*`
- static runtime served from `/`
- GitHub Actions as repository-governance integration

No public API contract changed during the P11 planning package, the `p11-tenant-isolation-fixes` implementation slice, or the `p11-repository-boundary-root-bootstrap` slice.

## 9. Authentication and authorization
Current observable behavior:
- login remains public;
- authenticated APIs use middleware-based authentication;
- authorization remains middleware/policy based;
- login throttling is implemented;
- browser session data is currently persisted client-side in localStorage.

## 10. Events and background processing
No application event bus or separate background worker was verified in this refresh.

GitHub Actions workflows are repository automation, not application background processing.

## 11. Containers and deployment
Observed deployment/runtime assets:
- `Dockerfile`
- `docker-compose.yml`
- `docker-compose.dev.yml`
- `docker-compose.prod.yml`
- GitHub Actions workflows under `.github/workflows/`

Current Dockerfile uses:
- multi-stage build
- non-root runtime user
- healthcheck against `/health/ready`
- `node:24-bullseye-slim` as the declared build/runtime base image

Current platform baseline is now Node 24:
- `package.json` declares `engines.node: ">=24 <25"`
- `Dockerfile` uses `node:24-bullseye-slim`
- inspected repository-governance workflows pin `node-version: '24'`

Local container-build evidence is now present for the implemented baseline: `docker build -t inventory-api:node24-smoke .` passed against the Node 24 Dockerfile.

## 12. Current testing strategy
Current observable testing/governance baseline:
- `npm run lint` passed in the Node 24 migration cycle
- `npm run typecheck` passed in the Node 24 migration cycle and still covers the approved incremental P11 slice: `src/schemas/**`, `src/repositories/sales-route.repository.js`, `src/repositories/order.repository.js`, `src/repositories/payment.repository.js`, and `src/repositories/company.repository.js`
- `npm run build` passed on Node `v24.16.0`
- `node --test tests/taxpayer-characterization.test.js` passed on Node `v24.16.0`; the previously documented `PrismaClient is not a constructor` failure did not reproduce after clean `npm ci` + build
- `npm run validate:workflow-baseline` passed after the Node 24 workflow updates
- `node --test tests/workflow-baseline-characterization.test.js tests/prisma-windows-build-stabilization.test.js` passed
- `npm run validate:public-runtime` passed
- `npm run validate:operational-readiness` passed
- `npm run validate:production-baseline` passed when executed with the required environment variables
- `npm test -- --silent` currently passed with `293 pass, 2 skipped` on the Node 24 baseline
- the CI/typecheck governance slice expanded coverage with `tests/typecheck-ci-hardening-governance.test.js` and the updated workflow baseline characterization for the dedicated DB-constraints workflow
- the root-bootstrap slice added focused regression coverage in `tests/company-root-bootstrap-boundary.test.js` and `tests/company-repository-bootstrap.test.js`
- `npm run build` can still hit the pre-existing Windows Prisma `EPERM` rename-lock path locally, but the guarded wrapper retried and succeeded in the validated Node 24 cycle
- `npm run verify` exists as an aggregate validation command
- repository tests include characterization, governance, service, integration, browser E2E, and optional/environment-gated evidence
- browser E2E and Docker build validation now also passed on the Node 24 baseline in the follow-up cycle
- public GitHub Actions API review shows the latest available hosted `windows-prisma-build` runs succeed, but those runs still reflect the historical `Set up Node.js 20` step and therefore do not validate the updated Node 24 workflow revision
- `gh` CLI is not installed in the local environment, so no authenticated hosted trigger was available from this cycle
- the only remaining validation surface pending in this cycle is hosted `windows-prisma-build` workflow evidence review for the updated Node 24 workflow

P11 confirmed that the suite is broad but not uniform in evidence strength, and `p11-typecheck-ci-hardening` converted that into explicit policy in `docs/ci-critical-controls.md`:
- strong evidence can close a critical control only when it is exercised by a required workflow;
- some `*characterization*` tests validate guards/contracts only and remain supportive rather than sufficient;
- some tests remain optional or environment-gated;
- `tests/p2-hardening-constraints.test.js` is no longer an implicit gap because `.github/workflows/db-constraints-tests.yml` now provisions the required DB-backed gate.

`p11-tenant-isolation-fixes` added and updated repository/service regressions for tenant-safe mutation enforcement while keeping the evidence inside the mandatory `repository-tests` workflow gate.

## 13. Behavior to preserve
- Express continues to serve the embedded browser runtime from `src/public/`.
- Current endpoint paths and browser-runtime contracts remain unchanged.
- Current Docker/runtime contract remains a single Dockerfile-based deployment with multi-stage build, non-root runtime, and readiness healthcheck.
- The active runtime baseline is Node 24 across `package.json`, `Dockerfile`, and inspected workflows.
- `npm run build` continues to use the guarded Prisma generation wrapper.
- Existing GitHub Actions workflows remain the current CI baseline.
- Current lint/typecheck/test scripts remain part of the repository contract.

## 14. Known defects
Confirmed or reaffirmed after the completed P11 implementation slices to date:
- the first confirmed/review-required tenant write backlog slice was hardened in code, but broader repository governance work remains open across the remaining P11 follow-up specs;
- `tsconfig.typecheck.json` still does not cover the full repository/test surface, but the approved P11 incremental slice now covers `src/schemas/**` and the high-value repositories explicitly selected by the spec;
- the root bootstrap repository-boundary finding is no longer a current defect; it is now closed by `p11-repository-boundary-root-bootstrap` and should be preserved as current behavior;
- local Windows Prisma generation still has a pre-existing `EPERM` rename-lock failure mode on some runs, although the guarded wrapper succeeded on retry in the validated Node 24 cycle;
- full feature-closure evidence for the Node 24 migration is still incomplete because the available public hosted `windows-prisma-build` artifact review still reflects the historical Node 20 workflow, not the updated local Node 24 workflow, even though the latest publicly reviewable hosted runs succeed.

## 15. Architectural debt
- service-layer orchestration remains broad;
- strict hexagonal boundaries are not implemented;
- workflow and governance evidence are distributed across scripts, tests, workflows, docs, and spec packages;
- duplicated governance artifacts still require drift management;
- typecheck expansion is still incremental rather than exhaustive;
- test evidence classification is now documented in `docs/ci-critical-controls.md` and reflected in the dedicated DB-constraints workflow, but broader enforcement remains governance-heavy rather than architecture-enforced in code.

## 16. Security risks
Current architecture-facing security concerns still visible after the completed P11 implementation slices to date:
- tenant isolation is stronger in the hardened repository methods, but broader repository/platform hardening work remains open;
- browser session persistence in localStorage;
- some critical controls are still validated only by characterization or optional/environment-gated tests outside the newly explicit matrix;
- not every important security, business-logic, or data-quality control identified by P11 has yet been hardened by its own implementation slice.

## 17. Unknowns and assumptions
- This refresh did not execute commands directly; validation status comes from the completed P11 implementation report provided by the implementation cycle.
- The Windows Prisma build issue is treated as pre-existing because the implementation report records it as baseline behavior before and after the documentation-only work.
- Exhaustive remediation of tenant-isolation issues still requires future implementation work.
- The Node 24 baseline migration is implemented in package, Docker, and workflow declarations; browser E2E and Docker build now pass locally, and the only remaining closure item is hosted Windows workflow evidence for the updated Node 24 workflow.
