# Architecture

## 1. Purpose and scope
This document describes only the architecture currently implemented and the active decisions currently governing the repository.

This refresh reflects the repository state after the completed P11 planning/documentation package in `specs/p11-audit-emergency-hardening` (`TASK-001` through `TASK-004`), the tenant-isolation slice in `specs/p11-tenant-isolation-fixes`, the root-bootstrap boundary slice in `specs/p11-repository-boundary-root-bootstrap`, and the CI/typecheck governance slice in `specs/p11-typecheck-ci-hardening`.

## 2. Current active architecture summary
The repository remains a single deployable Node.js 24 Express + Prisma modular monolith.

Implemented structure still is:
- Express composition root in `src/app.js`
- route modules in `src/routes/`
- service/orchestration modules in `src/services/`
- Prisma-backed repositories in `src/repositories/`
- static browser runtime in `src/public/`
- governance scripts, tests, and workflows around the runtime

P11 planning did not alter runtime architecture. It reconciled audit findings, documented confirmed boundary and tenant-isolation gaps, defined a hardening sequence, and established a feature-freeze governance rule until P11 P0 findings are implemented or disproven with evidence.

`p11-tenant-isolation-fixes` then changed runtime behavior in a narrow slice by moving selected multi-tenant write guarantees into the repository mutation boundary and by propagating `companyId` through the affected service-to-repository calls, without changing public API contracts.

`p11-repository-boundary-root-bootstrap` then removed the last confirmed direct-Prisma exception in the root company bootstrap flow: `company.service.js` now delegates duplicate-username lookup and transaction-owned bootstrap persistence to `company.repository.js`, while preserving current authorization, hashing, and audit behavior.

## 3. Active architectural style and module boundaries
Current implemented style is layered, not hexagonal:
- HTTP/API boundary: routes, schemas, middleware
- application/service layer: services
- persistence layer: repositories + Prisma
- browser delivery layer: static assets under `src/public/`
- repository governance layer: scripts, tests, GitHub Actions, evidence docs, and spec packages

Current module boundaries are organizational rather than strict domain isolation boundaries.

## 4. Current domain map
Observable current runtime/governance areas:
- Identity and access
- Company administration
- Client management
- Product and inventory operations
- Warehouses and geography
- Sales routing and agent workspace
- Orders, invoices, and payments
- Embedded browser runtime
- Repository/platform governance

P11 added no new implemented bounded context. It did add an active governance dependency: functional specs such as `p10-permission-governance` and `sidebar-rebrand-permissions` are now documented as blocked pending real P11 hardening closure.

## 5. Current runtime components and responsibilities
- **Express app**: middleware chain, route mounting, static file serving, error handling, CSP and related headers
- **Middlewares**: authentication, authorization, throttling, payload/validation helpers, request context, metrics
- **Services**: current orchestration and business-flow logic
- **Repositories**: main Prisma persistence access pattern
- **Prisma**: schema and migration history
- **Embedded browser runtime**: login, root admin, warehouse, and agent flows
- **Governance scripts/tests/workflows**: validation, characterization, CI, and evidence support
- **Spec packages**: approved feature/hardening documentation and traceability, including P11

## 6. Current dependency rules
Observed dependency direction remains mostly:
- routes -> services -> repositories -> Prisma
- browser runtime -> HTTP API
- scripts/tests -> repository files, workflows, contracts, and docs

Current active limitations after the first four P11 implementation slices:
- some business and orchestration logic remains concentrated in services;
- the root bootstrap repository-boundary exception is now closed in the current implementation, and the first approved typecheck-governance slice is implemented, but broader repository governance and full type coverage still remain open;
- several high-risk tenant-owned writes were hardened at the repository boundary, but repository-wide tenant invariants are not yet fully systematic across every future write path;
- architecture is not yet expressed as explicit input/output ports.

## 7. Current database ownership and transaction boundaries
Current persistence architecture remains:
- Prisma schema as the system-of-record model definition
- versioned migrations under `prisma/migrations/`
- repositories as the main application-level persistence access pattern
- repository-owned transactions for company creation and root bootstrap flows
- repository-owned duplicate-username lookup and bootstrap artifact creation in `company.repository.js#registerRootCompanyBootstrap(...)`

P11 planning and the first four implementation slices introduced no application schema or migration changes; the CI hardening slice only added a workflow that applies existing committed migrations to an ephemeral test database.

## 8. Current API and integration contracts
Current active contracts relevant to architecture:
- REST-style API under `/api/*`
- health endpoints
- browser runtime served from the same process
- package scripts, GitHub Actions workflows, and `docs/ci-critical-controls.md` as operational repository contracts

P11 confirmed that no public API contract changed in the planning cycle, in `p11-tenant-isolation-fixes`, or in `p11-repository-boundary-root-bootstrap`.

## 9. Current security boundaries
Current observable security boundaries include:
- authentication middleware for protected routes
- authorization middleware and access-policy logic
- login throttling on the login route
- CSP and related security headers in the Express app
- CI/governance checks that help preserve repository behavior

P11 reconciliation and the implemented hardening slices now leave these security limitations active:
- tenant-isolation assurance improved for client documents, orders, sales-route update, payment-receipt replacement, legal-entity update, and the dormant product update helper, but not yet for every future slice
- the root bootstrap flow now respects the repository boundary by moving duplicate lookup and transactional persistence into `company.repository.js`
- browser session persistence remains localStorage-based
- the first explicit critical-controls matrix and mandatory DB-constraints workflow now exist, but not every future control has equal evidence strength yet

## 10. Current container and deployment architecture
Current observed deployment architecture:
- Dockerfile with multi-stage build
- non-root runtime user
- healthcheck
- compose files for local/runtime setups
- GitHub Actions workflows for static checks, repository tests, contracts, browser E2E, operational smoke, Windows Prisma build evidence, and build/publish automation

Current platform baseline is Node 24 in package engines, Docker image selection, and the inspected workflow Node setup steps. Local `docker build -t inventory-api:node24-smoke .` evidence now exists for this cycle.

## 11. Current testing strategy
Current implemented testing posture:
- repository-level scripts for lint, typecheck, build, test, and verify
- broad `tests/` suite mixing characterization, governance, service, integration, browser E2E, and optional/environment-gated checks
- GitHub Actions workflows for static checks, repository tests, dedicated DB-constraints tests, contracts, browser E2E, operational smoke, and Windows Prisma build evidence

P11 reconciliation and the implemented hardening slices established these active facts:
- the suite can be green while still mixing different evidence strengths;
- some characterization tests validate middleware/guard wiring more than full handler execution;
- some tests are optional or skipped without environment support;
- tenant-isolation write regressions for the first slice run inside the mandatory `repository-tests` gate;
- root-bootstrap boundary regressions now exist in `tests/company-root-bootstrap-boundary.test.js` and `tests/company-repository-bootstrap.test.js`;
- CI/typecheck governance regressions now exist in `tests/typecheck-ci-hardening-governance.test.js` and the updated `tests/workflow-baseline-characterization.test.js`;
- the dedicated workflow `.github/workflows/db-constraints-tests.yml` now makes `tests/p2-hardening-constraints.test.js` mandatory in CI with a real PostgreSQL-backed environment;
- the Node 24 baseline has local/mainline validation evidence for `npm ci`, `npm run build`, `npm run lint`, `npm run typecheck`, `node --test tests/taxpayer-characterization.test.js`, `npm run test:e2e:browser`, `docker build -t inventory-api:node24-smoke .`, `npm run validate:workflow-baseline`, `npm run validate:public-runtime`, `npm run validate:operational-readiness`, `npm run validate:production-baseline`, and `npm test -- --silent`;
- public GitHub Actions API review shows the latest available hosted `windows-prisma-build` runs succeed, but they still execute the historical Node 20 setup step and therefore cannot close the updated Node 24 workflow baseline;
- `gh` CLI is not available in the current environment, so this cycle had no authenticated hosted trigger path;
- the remaining closure surface pending in this cycle is hosted `windows-prisma-build` workflow evidence for the updated Node 24 workflow.

## 12. Active architectural decisions
Currently implemented or actively governing decisions:
- keep the application as a single deployable modular monolith
- keep the embedded browser runtime inside the same Express process
- keep Prisma generation as part of the build contract
- keep repository governance enforced through scripts, tests, and GitHub Actions workflows
- keep repository-owned persistence boundaries for root company bootstrap and for the already-hardened tenant-safe write slices
- treat the P11 spec package as the current internal record for audit reconciliation and hardening sequencing
- treat unresolved P11 follow-up work as blocking for unrelated functional implementation until resolved in code or disproven with sufficient evidence
- treat the current Windows Prisma build rename-lock failure mode as an existing platform issue, not a result of the Node 24 migration itself
- keep Node 24 as the current implemented runtime baseline across package, Docker, and inspected workflow configuration
- do not claim the Node 24 migration fully closed until hosted Windows workflow evidence is recorded for the updated Node 24 workflow

## 13. Known architectural limitations
- layered architecture without strict hexagonal separation
- broad service responsibilities
- repository boundary purity improved, but not yet generalized into an explicit architectural rule enforced across every module
- incomplete typecheck coverage over the repository despite the approved incremental expansion slice
- uneven automated evidence strength across the test suite despite the new explicit critical-controls matrix
- remaining tenant-isolation uncertainty outside the hardened first slice and outside future P11 follow-up specs
- the runtime baseline is declaratively migrated to Node 24, browser E2E and Docker build are locally validated, no new regression is visible in the validated surfaces, but closure evidence is still incomplete for hosted Windows workflow execution on the updated workflow revision

## 14. Open decisions requiring clarification
Open future decisions now visible after the completed P11 implementation slices to date:
- how far typecheck coverage should be expanded beyond the approved first slice and with what exclusions, if any
- whether any follow-up changes are required after hosted Windows Node 24 evidence is executed

These are not implemented decisions yet; they remain future work.
