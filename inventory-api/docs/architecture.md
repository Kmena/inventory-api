# Architecture

## 1. Purpose and scope
This document describes only the architecture currently implemented and the active decisions currently governing the repository.

This refresh reflects the repository state after the official root workflow alignment for the Node 24 baseline and the implemented public operational-readiness convergence.

## 2. Current active architecture summary
The repository remains a single-deployable Node.js 24 Express + Prisma modular monolith.

Current architecture has two important roots:
- **application root:** `inventory-api/` contains runtime code, package scripts, Prisma assets, tests, specs, and docs;
- **repository root:** `/.github/workflows/` contains the official hosted GitHub Actions automation entry point.

## 3. Active architectural style and module boundaries
Current implemented style is layered, not hexagonal:
- HTTP/API boundary: routes, schemas, middleware
- application/service layer: services
- persistence layer: repositories + Prisma
- browser delivery layer: static assets under `src/public/`
- governance layer: scripts, tests, docs, specs, and GitHub Actions workflows

A current governance boundary also exists between:
- root official workflows used by hosted GitHub Actions as the operational source of truth;
- local validators and characterization tests that read the same root workflow tree directly.

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
- CI/workflow governance

## 5. Current runtime components and responsibilities
- **Express app**: middleware chain, route mounting, static file serving, error handling, security headers
- **Middlewares**: authentication, authorization, throttling, payload validation, metrics, request context
- **Services**: orchestration and business-flow logic
- **Repositories**: main Prisma persistence access pattern
- **Prisma**: schema and migration history
- **Embedded browser runtime**: login, root admin, warehouse, and agent flows
- **Root workflows**: official hosted CI/CD jobs, all configured for Node 24 with `working-directory: inventory-api`, and the authoritative hosted workflow source
- **Restore-readiness contract**: public operational baseline artifacts under `inventory-api/docs/`, validated through `package.json` and `scripts/validate-restore-readiness.js`
- **Operational-readiness contract**: public operational baseline artifacts under `inventory-api/docs/`, validated through `package.json`, `scripts/validate-operational-readiness.js`, and the root `operational-smoke` workflow path
- **Production-baseline evidence contract**: `.env.production.example` is treated as required versioned baseline evidence by `scripts/validate-production-baseline.js`, `tests/production-baseline-characterization.test.js`, and the public production docs

## 6. Current dependency rules
Observed dependency direction remains mostly:
- routes -> services -> repositories -> Prisma
- browser runtime -> HTTP API
- local scripts/tests -> root workflow definitions, contracts, and docs
- hosted GitHub Actions -> repository-root workflow definitions -> `inventory-api/` working directory

Current architectural limitation:
- workflow governance still depends on scripts, tests, docs, and workflow artifacts remaining synchronized around the root official workflow tree.
- operational readiness and restore-readiness now share a public `docs/`-backed validation model, but they still require synchronized maintenance across validators, tests, README, `.env.production.example`, docs, and workflows.
- the active public operational-readiness contract is intentionally limited to `docs/production-baseline.md` plus `docs/production-operations-runbook.md`; no third public operational-readiness document exists in the implemented architecture.

## 7. Current database ownership and transaction boundaries
Current persistence architecture remains:
- Prisma schema as the system-of-record model definition
- versioned migrations under `prisma/migrations/`
- repositories as the main application-level persistence access pattern
- repository-owned transactions for company creation and root bootstrap flows

The Node 24 runtime migration introduced no database or migration changes.

## 8. Current API and integration contracts
Current active contracts relevant to architecture:
- REST-style API under `/api/*`
- health endpoints under `/health/*`
- browser runtime served from the same process
- root-only GitHub Actions workflow definitions under `/.github/workflows/`
- package scripts, GitHub Actions workflows, and validator scripts as operational repository contracts
- `validate:restore-readiness` as a public docs-backed contract exposed via `package.json`
- `validate:operational-readiness` as a public docs-backed contract exposed via `package.json`
- `.env.production.example` as an explicit versioned production-baseline artifact required by the production validator and documented public contract

The Node 24 baseline change preserved public runtime and API contracts.

## 9. Current security boundaries
Current observable security boundaries include:
- authentication middleware for protected routes
- authorization middleware and access-policy logic
- login throttling on the login route
- security headers in the Express app
- dedicated hosted CI workflows for static checks, tests, contracts, browser E2E, DB constraints, operational smoke, and Windows Prisma build evidence

Security limitations still active:
- browser session persistence remains `localStorage` based
- not every governance control is enforced from a single source of truth

## 10. Current container and deployment architecture
Current observed deployment architecture:
- application Dockerfile with multi-stage build
- non-root runtime user
- readiness healthcheck
- compose files for local/runtime setups
- repository-root GitHub Actions workflows as the official hosted automation layer

Current platform baseline is Node 24 in:
- `package.json` engines
- `Dockerfile` base image
- repository-root workflow Node setup steps
- workflow-governance validators/tests that read the root official workflow tree directly

## 11. Current testing strategy
Current implemented testing posture:
- repository-level scripts for lint, typecheck, build, test, and verify
- broad `tests/` suite mixing characterization, governance, service, integration, browser E2E, and optional/environment-gated checks
- workflow-governance characterization based on the root official workflow tree
- restore-readiness characterization now anchored to public docs artifacts under `inventory-api/docs/`
- production-baseline characterization now also guards the versioned/documented presence of `.env.production.example`
- hosted GitHub Actions evidence now confirms the root official workflow path on Node 24

Current Node 24 and workflow-governance evidence in effect:
- reported local validation executed for `build`, `lint`, `typecheck`, `validate:workflow-baseline`, `validate:restore-readiness`, `validate:operational-readiness`, and the focused workflow/restore characterization suites
- previously recorded local/mainline Node 24 suite includes focused Prisma regression, aggregate tests, browser E2E, runtime validators, and Docker build
- hosted runs succeeded for `static-checks`, `db-constraints-tests`, `contract-validations`, `repository-tests`, `browser-e2e`, and `windows-prisma-build`

## 12. Active architectural decisions
Currently implemented or actively governing decisions:
- keep the application as a single deployable modular monolith
- keep the embedded browser runtime inside the same Express process
- keep Prisma generation as part of the build contract
- keep a dedicated Windows Prisma workflow and artifact trail
- keep Node 24 as the active runtime baseline across package, Docker, and hosted workflows
- treat repository-root `/.github/workflows/` as the official hosted workflow source
- keep the duplicated application-local workflow YAML removed rather than mirrored under `inventory-api/.github/workflows/`
- expose `validate:restore-readiness` in `package.json` and treat it as a public docs-backed repository contract
- expose `validate:operational-readiness` as a public docs-backed repository contract that validates `docs/production-baseline.md` and `docs/production-operations-runbook.md` directly instead of optional private overlays
- treat `.env.production.example` as explicit versioned production-baseline evidence that must remain present, documented, and validator-covered
- preserve `working-directory: inventory-api` and `cache-dependency-path: inventory-api/package-lock.json` in root hosted workflows while the application remains nested

## 13. Known architectural limitations
- layered architecture without strict hexagonal separation
- broad service responsibilities
- operational-readiness and restore-readiness still rely on distributed governance artifacts rather than stronger central enforcement
- the public operational-readiness contract still depends on cross-file synchronization rather than a single manifest-based source of truth
- incomplete typecheck coverage over the whole repository
- Windows Prisma rename-lock remains mitigated operational debt rather than eliminated platform debt

## 14. Open decisions requiring clarification
Open future decisions now visible:
- whether future work should introduce stronger centralized enforcement for operational-documentation contracts beyond the current script/test/workflow model
- whether future governance should eventually consolidate public operational evidence into a manifest without expanding the current two-document public contract unnecessarily
- how far typecheck coverage should be expanded beyond the approved slices
