# Architecture

## 1. Purpose and scope
This document describes only the architecture currently implemented and the active decisions currently governing the repository.

This refresh reflects the repository state after the official root workflow alignment for the Node 24 baseline.

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
- application-local workflow copies retained as a duplicated mirror tree;
- local validators and characterization tests that now resolve the root official workflow tree first and only fall back to the mirror when the root hosted layout is unavailable.

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
- **Application-local workflow copies**: duplicated mirror files retained under `inventory-api/.github/workflows/` for local fallback/governance compatibility

## 6. Current dependency rules
Observed dependency direction remains mostly:
- routes -> services -> repositories -> Prisma
- browser runtime -> HTTP API
- local scripts/tests -> root workflow definitions first -> fallback mirror files, contracts, and docs
- hosted GitHub Actions -> repository-root workflow definitions -> `inventory-api/` working directory

Current architectural limitation:
- workflow governance still depends on duplicated workflow trees, so maintainability drift remains possible even though local validators now anchor to the same root workflow tree that hosted GitHub Actions executes when that tree is present.

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
- package scripts, GitHub Actions workflows, and validator scripts as operational repository contracts

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
- workflow-governance validators/tests that read the root official workflow tree first and fall back to the application-local mirror when needed

## 11. Current testing strategy
Current implemented testing posture:
- repository-level scripts for lint, typecheck, build, test, and verify
- broad `tests/` suite mixing characterization, governance, service, integration, browser E2E, and optional/environment-gated checks
- workflow-governance characterization based on the root official workflow tree first, with fallback to `inventory-api/.github/workflows/` when the root hosted layout is absent
- hosted GitHub Actions evidence now confirms the root official workflow path on Node 24

Current Node 24 evidence in effect:
- local validation executed for workflow baseline and Windows workflow characterization
- previously recorded local/mainline Node 24 suite includes build, lint, typecheck, focused Prisma regression, aggregate tests, browser E2E, runtime validators, and Docker build
- hosted runs succeeded for `static-checks`, `db-constraints-tests`, `contract-validations`, `repository-tests`, `browser-e2e`, and `windows-prisma-build`

## 12. Active architectural decisions
Currently implemented or actively governing decisions:
- keep the application as a single deployable modular monolith
- keep the embedded browser runtime inside the same Express process
- keep Prisma generation as part of the build contract
- keep a dedicated Windows Prisma workflow and artifact trail
- keep Node 24 as the active runtime baseline across package, Docker, and hosted workflows
- treat repository-root `/.github/workflows/` as the official hosted workflow source
- keep `inventory-api/.github/workflows/` as a duplicated fallback/mirror tree for now
- preserve `working-directory: inventory-api` and `cache-dependency-path: inventory-api/package-lock.json` in root hosted workflows while the application remains nested

## 13. Known architectural limitations
- layered architecture without strict hexagonal separation
- broad service responsibilities
- duplicated workflow trees increase governance drift risk
- local workflow validators reduce path drift by reading the root official tree first, but they do not yet prove parity or synchronization for every duplicated workflow file that remains under `inventory-api/.github/workflows/`
- incomplete typecheck coverage over the whole repository
- Windows Prisma rename-lock remains mitigated operational debt rather than eliminated platform debt

## 14. Open decisions requiring clarification
Open future decisions now visible:
- whether root and application-local workflow definitions should converge to one authoritative source with generated copies, direct reuse, or a parity validator
- how far typecheck coverage should be expanded beyond the approved slices
- whether the application-local mirror tree should remain versioned at all once a stronger parity or single-source workflow pattern is approved
