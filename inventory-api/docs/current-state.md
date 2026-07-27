# Current State

## 1. System overview
`inventory-api/` is a single-deployable Node.js 24 Express + Prisma modular monolith inside a repository whose official GitHub Actions workflows now execute from the **repository root**.

Current observable implementation:
- application code, package manifest, scripts, Prisma schema, tests, and architecture-facing docs remain under `inventory-api/`;
- official hosted CI/CD workflows live under `/.github/workflows/` at repository root;
- the application still serves REST-style JSON APIs and static browser assets from the same Express runtime;
- Prisma remains the persistence layer over PostgreSQL with committed migrations.

The `p11-node24-runtime-migration` baseline is now implemented and evidenced on local/mainline, Docker, and hosted GitHub Actions surfaces.

## 2. Repository structure
High-signal paths verified in this refresh:
- repository root: `.github/workflows/`, `README.md`, `docker/`, `sql/`
- application root: `inventory-api/package.json`, `inventory-api/Dockerfile`, `inventory-api/src/`, `inventory-api/prisma/`, `inventory-api/scripts/`, `inventory-api/tests/`, `inventory-api/docs/`, `inventory-api/specs/`

Verified root official workflows:
- `.github/workflows/static-checks.yml`
- `.github/workflows/repository-tests.yml`
- `.github/workflows/db-constraints-tests.yml`
- `.github/workflows/contract-validations.yml`
- `.github/workflows/browser-e2e.yml`
- `.github/workflows/operational-smoke.yml`
- `.github/workflows/windows-prisma-build.yml`
- `.github/workflows/build-and-publish.yml`
- `.github/workflows/p0-quality-gates.yml`

Verified root official workflow tree contents:
- `static-checks.yml`
- `repository-tests.yml`
- `db-constraints-tests.yml`
- `contract-validations.yml`
- `browser-e2e.yml`
- `operational-smoke.yml`
- `windows-prisma-build.yml`
- `build-and-publish.yml`
- `p0-quality-gates.yml`

## 3. Current architecture
Current implemented architecture remains layered:
- Express app and middleware at the HTTP boundary;
- route modules delegate to service modules;
- services coordinate business flows and repository calls;
- repositories encapsulate most Prisma access;
- static browser assets are served by the same runtime process.

A second operational layer exists for repository governance:
- root GitHub Actions workflows are the official hosted automation entry point and operational source of truth;
- the previously duplicated `inventory-api/.github/workflows/` YAML tree has been removed;
- local validators and characterization tests read the same root official workflow tree directly;
- restore-readiness is now exposed as a package script and validated against public versioned docs under `inventory-api/docs/`;
- operational-readiness remains a separate validator that still accepts optional `internal-docs/` overlays when those private artifacts are present.

Strict hexagonal boundaries are still not implemented.

## 4. Existing domains and modules
Observable runtime and governance areas:
- Authentication and authorization
- Company, role, and user administration
- Client management and client documents
- Product catalog and inventory
- Warehouses and geography
- Sales routes and agent workspace
- Orders, invoices, and payments
- Embedded browser runtime
- Repository/platform governance
- CI/workflow governance

## 5. Main use cases
Examples still implemented:
- login via `/api/auth/login`
- retrieve authenticated context via `/api/auth/me`
- manage companies, roles, users, clients, products, warehouses, routes, orders, invoices, and payments
- use embedded root, warehouse, and agent browser screens
- run repository validation through `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`, `npm run validate:workflow-baseline`, `npm run validate:restore-readiness`, `npm run validate:public-runtime`, `npm run validate:operational-readiness`, `npm run validate:production-baseline`, and `npm run verify`
- execute hosted quality gates from repository-root workflows with `working-directory: inventory-api`

## 6. Current data flows
### Runtime flow
1. Express receives requests.
2. Security, auth, throttling, metrics, logging, and validation middleware execute.
3. Routes call services.
4. Services call repositories and Prisma-backed persistence.
5. Responses return JSON or static assets.

### Repository-governance flow
1. Local scripts and tests run from `inventory-api/`.
2. `scripts/validate-workflow-baseline.js`, `tests/workflow-baseline-characterization.test.js`, and `tests/prisma-windows-build-stabilization.test.js` read `/.github/workflows/` directly.
3. `scripts/validate-restore-readiness.js` validates `docs/production-operations-runbook.md`, `docs/production-baseline.md`, and `docs/restore-readiness-baseline.md` as the public restore-readiness contract.
4. `scripts/validate-operational-readiness.js` reads the root `operational-smoke.yml` path but still skips cleanly unless optional `internal-docs/production-operations-runbook.md` and `internal-docs/production-baseline.md` are present.
5. Hosted GitHub Actions run from repository root `/.github/workflows/` and use `working-directory: inventory-api` plus `cache-dependency-path: inventory-api/package-lock.json`.
6. Evidence is recorded in workflow logs, artifacts, docs, and spec packages.

## 7. Database and persistence
- Prisma schema remains in `inventory-api/prisma/schema.prisma`.
- Versioned migrations remain in `inventory-api/prisma/migrations/`.
- Persistence remains repository + Prisma based.
- No database schema or migration changes were introduced by the Node 24 runtime migration.
- Root bootstrap persistence remains repository-owned in `src/repositories/company.repository.js`.
- Tenant-safe repository write hardening from earlier P11 slices remains implemented.

## 8. APIs and integrations
Current observable interfaces:
- REST-style endpoints under `/api/*`
- health endpoints under `/health/*`
- static runtime served from `/`
- GitHub Actions as repository-governance integration

The Node 24 alignment did not change public API contracts.

## 9. Authentication and authorization
Current observable behavior:
- login remains public;
- authenticated APIs use middleware-based authentication;
- authorization remains middleware/policy based;
- login throttling is implemented;
- browser session data is currently persisted client-side in `localStorage`.

## 10. Events and background processing
No application event bus or separate background worker was verified.

GitHub Actions workflows are repository automation, not application background processing.

## 11. Containers and deployment
Observed deployment/runtime assets:
- `inventory-api/Dockerfile`
- `inventory-api/docker-compose.yml`
- `inventory-api/docker-compose.dev.yml`
- `inventory-api/docker-compose.prod.yml`
- repository-root GitHub Actions workflows

Current platform baseline:
- `inventory-api/package.json` declares `engines.node: ">=24 <25"`
- `inventory-api/Dockerfile` uses `node:24-bullseye-slim`
- root official workflows use Node 24 and execute in `inventory-api/`
- root official workflows cache `inventory-api/package-lock.json`

## 12. Current testing strategy
Current observable validation baseline recorded for the implemented Node 24 and workflow-governance cycles:
- reported local validation executed from `inventory-api/` for this governance refresh:
  - `npm run build`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run validate:workflow-baseline`
  - `npm run validate:restore-readiness`
  - `npm run validate:operational-readiness`
  - `node --test tests/workflow-baseline-characterization.test.js tests/prisma-windows-build-stabilization.test.js`
  - `node --test tests/production-baseline-characterization.test.js tests/restore-readiness-characterization.test.js`
- previously recorded mainline Node 24 evidence in the feature implementation report includes successful `npm ci`, `node --test tests/taxpayer-characterization.test.js`, `npm test -- --silent`, `npm run test:e2e:browser`, `npm run validate:public-runtime`, `npm run validate:operational-readiness`, `npm run validate:production-baseline` with required env, and `docker build -t inventory-api:node24-smoke .`
- hosted GitHub Actions evidence now exists for the official root workflows:
  - `windows-prisma-build` run `30281935398` success, job `90030223669`, including `Set up Node.js 24`
  - `static-checks` run `30281932831` success
  - `db-constraints-tests` run `30281933453` success
  - `contract-validations` run `30281933525` success
  - `repository-tests` run `30281935485` success
  - `browser-e2e` run `30281937000` success
- Windows Prisma build evidence remains separately classified through the dedicated workflow and artifact publication.

## 13. Behavior to preserve
- Express continues to serve the embedded browser runtime from `src/public/`.
- Current endpoint paths and browser-runtime contracts remain unchanged.
- Current Docker/runtime contract remains a single Dockerfile-based deployment with multi-stage build, non-root runtime, and readiness healthcheck.
- Node 24 is the active runtime baseline across package, Docker, and root hosted workflows.
- Root workflows continue to execute from repository root with `working-directory: inventory-api`.
- Restore readiness remains a public docs-backed package contract via `npm run validate:restore-readiness`.
- The guarded Prisma generation wrapper remains part of the build contract.
- The dedicated Windows Prisma workflow remains separate from broader repository validation.

## 14. Known defects
- Local Windows Prisma generation can still encounter the pre-existing `EPERM` rename-lock path before retry succeeds.

## 15. Architectural debt
- service-layer orchestration remains broad;
- strict hexagonal boundaries are not implemented;
- workflow governance still depends on scripts, tests, docs, and workflow artifacts that must remain synchronized around the root official workflow tree;
- the repository now has a deliberate split between a public restore-readiness contract in `docs/` and a broader operational-readiness validator that still uses optional `internal-docs/` overlays for some non-public checks;
- typecheck expansion remains incremental rather than exhaustive;
- governance assurance still depends on documentation/tests and operational artifacts rather than stronger central enforcement beyond the root workflow tree.

## 16. Security risks
Current architecture-facing security concerns still visible:
- browser session persistence in `localStorage`;
- some critical controls still rely on governance and characterization patterns rather than stronger architectural boundaries;
- broader P11 hardening work outside this runtime baseline slice remains open.

## 17. Unknowns and assumptions
- This refresh did not execute commands directly; validation status is taken from the recorded implementation evidence and the user-provided command results.
- No evidence in this refresh contradicts the implemented Node 24 baseline, root-only workflow governance, or the public restore-readiness contract.
- A future documentation/governance review may still converge `validate:operational-readiness` away from optional `internal-docs/` overlays if the repository later requires a fully public operational-readiness contract.