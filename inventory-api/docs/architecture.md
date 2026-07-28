# Architecture

## 1. Purpose and scope
This document describes only the architecture currently implemented and the active decisions currently governing the repository.

This refresh reflects the repository state after the browser-runtime reduction work, the repository-governance follow-up already present in the repository, the completed Redis operational safeguards, the `p24-legacy-runtime-governance-closure` documentation-only closeout that finalized the `legacy-public-runtime/` lifecycle policy and reduced-runtime no-reentry rule, the later `p25-post-login-transition-and-test-noise-closure` slice that finalized the supported interim post-login wording and closed governance for `TASK-023` and `TASK-024`, and the `p26-browser-runtime-db-free-suite-separation` slice that implemented the approved DB-free vs DB-backed suite boundary for the affected browser/runtime tests without changing production audit semantics.

## 2. Current active architecture summary
The repository remains a single-deployable Node.js 24 Express + Prisma modular monolith.

Current architecture has two important roots:
- **application root:** `inventory-api/` contains runtime code, package scripts, Prisma assets, tests, specs, and docs;
- **repository root:** `/.github/workflows/` contains the official hosted GitHub Actions automation entry point.

Within the browser runtime, the active public HTML surface is now deliberately minimal. `src/public/` contains only the supported login, no-access, and migration documents plus the minimal shared assets required to sustain those flows. Legacy role-specific HTML routes are no longer active pages: `src/app.js` intercepts `/root/*.html`, `/warehouse/*.html`, and `/agent/*.html` before `express.static(...)` and serves the shared migration document with HTTP `410 Gone` from the same requested URL. The previously functional legacy runtime was preserved outside the active runtime in `legacy-public-runtime/` as transitional backup/reference inventory only while equivalent SPA coverage is implemented and validated.

The backend-owned browser-session model remains active for supported browser flows through `inventory_browser_session` + `inventory_browser_state`, with `src/public/shared/session.js` and `src/public/shared/auth.js` as the active helper seam. After the Redis operational-safeguards slice, the same session subsystem also exposes explicit operational readiness: memory mode reports a local `memory` state, while the supported Redis path reports `up` or `down` through the health boundary without silently downgrading.

At the repository-governance boundary:
- `scripts/run-tests.js` is the official aggregate suite entrypoint and boots a stable default test environment by supplying `NODE_ENV=test` and `BROWSER_SESSION_STORE_MODE=memory` unless explicitly overridden;
- canonical reviewed runtime-contract artifacts now live under `docs/**`;
- `internal-docs/**` remains auxiliary support material only;
- the supported Redis-backed browser-session path is kept explicit through `npm run test:redis-path` and the root workflow `.github/workflows/redis-browser-session-tests.yml`.

## 3. Active architectural style and module boundaries
Current implemented style is layered, not hexagonal:
- HTTP/API boundary: routes, schemas, middleware
- application/service layer: services
- persistence layer: repositories + Prisma
- browser delivery layer: reduced static assets under `src/public/`
- preserved legacy browser inventory: `legacy-public-runtime/` outside the active runtime boundary
- browser runtime helper layer: `src/public/shared/session.js` and `src/public/shared/auth.js`
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
- Sales routing and agent workspace APIs
- Orders, invoices, and payments
- Embedded browser runtime (reduced support baseline)
- Repository/platform governance
- CI/workflow governance

## 5. Current runtime components and responsibilities
- **Express app (`src/app.js`)**: middleware chain, route mounting, static file serving, route-segmented security headers, and the deprecated-HTML gate that returns `410 Gone` for legacy browser URLs
- **Middlewares**: authentication, authorization, throttling, payload validation, metrics, request context
- **Services**: orchestration and business-flow logic
- **Repositories**: main Prisma persistence access pattern
- **Prisma**: schema and migration history
- **Active public runtime (`src/public/`)**: login, no-access, migration, shared auth/session helpers, and minimal static assets
- **Legacy runtime archive (`legacy-public-runtime/`)**: preserved transition backup/reference inventory, not part of the served runtime and not a rollback runtime path
- **Browser-session service**: owns opaque browser-session lifecycle, store-readiness checks, explicit 503 mapping for store unavailability, and related audit instrumentation
- **Browser-session store factory / Redis store / memory store**: select and implement the current session persistence strategy
- **Health router**: exposes liveness and readiness, combining Prisma readiness with browser-session-store readiness
- **Root workflows**: official hosted CI/CD jobs and authoritative hosted workflow source
- **Aggregate test runner**: `scripts/run-tests.js` discovers `.test.js` files, applies preferred ordering, forwards Node test arguments, and injects the default test-safe environment
- **Public-runtime validator**: `scripts/validate-public-runtime.js` governs the reduced supported inventory, validates legacy relocation, and asserts the remaining login/migration contracts
- **Runtime-contract artifacts**: canonical reviewed artifacts under `docs/**`; any `internal-docs/**` material is auxiliary only and not part of canonical runtime-contract enforcement
- **Workflow-baseline validator**: `scripts/validate-workflow-baseline.js` verifies the root hosted workflow contracts, including the dedicated Redis browser-session lane
- **Redis browser-session workflow lane**: repository-root `.github/workflows/redis-browser-session-tests.yml` keeps the supported non-default session store path under explicit CI governance

## 6. Current dependency rules
Observed dependency direction remains mostly:
- routes -> services -> repositories -> Prisma
- public browser runtime pages -> shared browser helpers -> HTTP API
- local scripts/tests -> workflow definitions, docs, runtime files, and contracts
- hosted GitHub Actions -> repository-root workflow definitions -> `inventory-api/` working directory

Current public-runtime dependency constraints now in effect:
- `src/app.js` owns legacy HTML deprecation at the HTTP boundary instead of leaving role-specific HTML behavior to `express.static(...)`.
- `src/public/` is the only directory served as active browser runtime.
- `legacy-public-runtime/` must not be treated as active runtime or typecheck-governed browser surface.
- the current public-runtime typecheck baseline remains intentionally bounded to `src/public/shared/session.js`, `src/public/shared/auth.js`, and `src/public/login.js`.
- retired legacy pages and `legacy-public-runtime/` may not re-enter supported runtime, validator scope, or typecheck scope without a new approved specification.

## 7. Current database ownership and transaction boundaries
Current persistence architecture remains:
- Prisma schema as the system-of-record model definition
- versioned migrations under `prisma/migrations/`
- repositories as the main application-level persistence access pattern
- service orchestration above repositories

The inspected `p26` refresh introduced no database ownership or transaction-boundary changes.

## 8. Current API and integration contracts
Current active contracts relevant to architecture:
- REST-style API under `/api/*`
- health endpoints under `/health/*`
- `GET /health` keeps the backward-compatible liveness payload `{ ok: true, service: 'inventory-api' }`
- `GET /health/ready` returns combined dependency state for Prisma and the browser-session store
- browser runtime served from the same process
- root-only GitHub Actions workflow definitions under `/.github/workflows/`
- package scripts, GitHub Actions workflows, validator scripts, and runtime-contract artifacts as repository contracts
- canonical runtime-contract contract ownership under `docs/**`, with `internal-docs/**` explicitly non-canonical
- `/api/auth/login` supports browser-session issuance when `X-Inventory-Browser-Session: cookie` is requested
- `/api/auth/me` returns the current authenticated user and refreshes browser-session cookies
- `/api/auth/logout` invalidates the backend-owned browser session and clears browser cookies
- `POST /api/auth/logout` is now explicitly classified in the runtime-contract governance baseline rather than being left unclassified

Current public HTML contract:
- supported public HTML: `/`, `/index.html`, `/no-access.html`, `/migration.html`
- deprecated public HTML: `/root/*.html`, `/warehouse/*.html`, `/agent/*.html` -> same URL, no redirect, shared migration screen, HTTP `410 Gone`
- preserved legacy files under `legacy-public-runtime/` are not an integration contract and remain only as transitional backup/reference material until equivalent SPA sections are validated

## 9. Current security boundaries
Current observable security boundaries include:
- authentication middleware for protected routes
- authorization middleware and access-policy logic
- login throttling on the login route
- security headers in the Express app, including CSP selection by route
- strict same-origin CSP on `/`, `/index.html`, `/no-access.html`, `/migration.html`, and deprecated legacy HTML routes that receive the migration response
- browser-session cookies with `HttpOnly` on the opaque session cookie, `SameSite=Lax`, and conditional `Secure` enforcement for production or HTTPS-capable requests
- same-origin `Origin` validation on mutating cookie-authenticated requests in `authenticate.js`
- explicit no-fallback failure behavior when Redis-backed browser-session persistence is configured but unreachable
- the remaining browser-session HTTPS hardening is tracked as a documented residual risk and follow-up dependency in `specs/p11-https-browser-session-migration/`; it is not an in-slice blocker for the current reduced public-runtime contract

Supported interim post-login contract now active:
- `src/public/login.js` routes retired-runtime-dependent authenticated users to `/migration.html?mode=post-login-transition` instead of deprecated legacy HTML aliases.
- in that supported transition mode, `src/public/migration.html` + `src/public/migration.js` confirm successful authentication, explicitly state that the destination module is not implemented yet, and preserve safe return-to-login/logout actions rather than implying a functional dashboard.
- direct requests to deprecated legacy HTML routes still terminate in the controlled `410` migration response rather than functional legacy pages.

## 10. Current container and deployment architecture
Current observed deployment architecture:
- application Dockerfile with multi-stage build
- non-root runtime user
- Docker healthcheck bound to `GET /health/ready`
- compose files aligned to the Redis-backed browser-session baseline
- repository-root GitHub Actions workflows as the official hosted automation layer

Current platform baseline is Node 24 in:
- `package.json` engines
- `Dockerfile` base image
- repository-root workflow Node setup steps

## 11. Current testing strategy
Current implemented testing posture includes:
- `scripts/run-tests.js` as the official aggregate repository test runner
- inventory validation through `scripts/validate-public-runtime.js`
- characterization tests for supported public surface and browser auth/session convergence
- HTTP smoke validation for reduced public-runtime responses
- governance tests for runtime-contract completeness and OpenAPI consistency
- workflow-governance validation through `scripts/validate-workflow-baseline.js` and `tests/workflow-baseline-characterization.test.js`
- a dedicated Redis-path browser-session validation command at `npm run test:redis-path` plus the hosted root workflow lane `redis-browser-session-tests`
- browser E2E coverage
- bounded typecheck coverage over the approved browser seam (`src/public/shared/session.js`, `src/public/shared/auth.js`, `src/public/login.js`)
- `docs/test-suite-catalog.md` as the maintained reference for the affected DB-free vs DB-backed suite boundary

Current active test-runner baseline:
- `npm run test` executes `node scripts/run-tests.js`
- the runner discovers all `tests/**/*.test.js` files
- `NODE_ENV=test` is supplied by default unless already defined
- `BROWSER_SESSION_STORE_MODE=memory` is supplied by default unless already defined
- this makes the default aggregate suite independent from Redis while still allowing explicit override for non-default paths

Recorded post-implementation evidence supplied by the user for the latest implemented refresh:
- `node --test tests/browser-session-redis-store.test.js` passed
- `node --test tests/browser-session-service-characterization.test.js` passed
- `node --test tests/health-routes.test.js` passed
- `node --test tests/production-baseline-characterization.test.js` passed
- `node --test tests/browser-session-auth-boundary.test.js` passed
- `npm run test:redis-path` passed
- `npm run validate:operational-readiness` passed
- `npm run lint -- --quiet` passed
- `npm run typecheck` passed
- `npm run build` passed after one transient Windows Prisma rename-lock retry
- `npm run test -- --silent` passed
- Additional requester-supplied validation evidence for `p26`:
  - `node --test tests/browser-e2e.e2e.js` passed
  - `node --test tests/audit-instrumentation.test.js tests/audit-repository.test.js` passed, with `tests/audit-repository.test.js` skipped when the dedicated audit DB URL is absent
  - `npm run typecheck` passed
  - `npm run validate:public-runtime` passed
  - `npm run lint -- --quiet` passed
- baseline governance audit score: `8.8/10` (acceptable, no meaningful regression found; warning remains below `9.5`)

## 12. Active architectural decisions
Currently implemented or actively governing decisions:
- keep the application as a single deployable modular monolith
- keep the embedded browser runtime inside the same Express process
- keep Prisma generation as part of the build contract
- keep Node 24 as the active runtime baseline across package, Docker, and hosted workflows
- treat repository-root `/.github/workflows/` as the official hosted workflow source
- keep the backend-owned cookie-session browser model for supported browser flows
- keep `src/public/` limited to the reduced supported runtime baseline
- intercept deprecated legacy HTML routes at the HTTP boundary and return `410 Gone` with the shared migration screen from the same URL
- preserve the removed functional legacy runtime outside the active runtime in `legacy-public-runtime/` rather than serving it from `src/public/`
- treat `legacy-public-runtime/` as transitional backup/reference inventory only and remove it in a later approved slice once equivalent SPA sections are implemented and validated
- keep `/api/auth/login`, `/api/auth/me`, and `/api/auth/logout` outside the HTML deprecation scope
- keep `/api/auth/logout` explicitly covered by runtime-contract governance artifacts
- keep reviewed canonical runtime-contract ownership under `docs/**` and treat `internal-docs/**` as auxiliary only
- keep the public-runtime typecheck baseline bounded to `src/public/shared/session.js`, `src/public/shared/auth.js`, and `src/public/login.js`
- keep retired legacy pages and `legacy-public-runtime/` out of supported runtime, validator scope, and typecheck scope unless a new approved specification explicitly redefines the contract
- keep the official aggregate test runner defaulted to `NODE_ENV=test` and `BROWSER_SESSION_STORE_MODE=memory` unless explicitly overridden
- keep a separate explicit Redis-path validation lane instead of folding Redis dependence back into the default aggregate suite
- keep browser-session readiness visible at `/health/ready` and preserve explicit store-unavailable behavior rather than silently degrading to memory mode in Redis-backed environments
- route retired-runtime-dependent authenticated browser users to `/migration.html?mode=post-login-transition` instead of deprecated `/root/*.html`, `/warehouse/*.html`, or `/agent/*.html` aliases
- keep that transition landing explicitly temporary and not-yet-implemented until approved role-specific SPA destinations exist
- keep `src/public/migration.html` + `src/public/migration.js` dual-purposed for both same-URL `410 Gone` deprecated-route rendering and the supported post-login transition rendering

## 13. Known architectural limitations
- layered architecture without strict hexagonal separation
- broad service responsibilities
- operational/readiness/browser governance still depends on synchronized docs, scripts, tests, manifest metadata, and workflows
- runtime-contract governance now converges on canonical `docs/**` artifacts; `internal-docs/**` is no longer part of the authoritative enforcement path
- the supported post-login landing is still informational only for retired-runtime-dependent roles; it does not restore operational screens while no approved replacement shell exists
- the preserved `legacy-public-runtime/` tree is transition inventory, not active runtime, so drift there can exist without direct runtime impact while it remains only as backup/reference material pending validated SPA replacement
- the default aggregate test baseline prioritizes deterministic memory-backed browser sessions, so Redis-backed session persistence is not exercised on every plain `npm run test` run
- the dedicated Redis-path lane reduces that gap but does not by itself prove hosted branch-protection enforcement or broader end-to-end operational readiness
- the Redis store is implemented with a bespoke low-level TCP client, which keeps dependencies small but concentrates protocol correctness and retry/timeout behavior in application-owned code
- the latest requester-supplied governance audit is acceptable at `8.8/10`, but the remaining warning below `9.5` shows that repository-governance quality is improved rather than fully closed
- requester-supplied repository-wide validation evidence is current, but this refresh did not independently re-execute commands
- some passing tests may still emit expected operational logs during negative-path assertions, but the previously known incidental audit-log noise in the affected browser E2E boundary has been removed by explicit DB-free seam control
- the approved remediation direction for the affected boundary is now implemented through DB-free browser/runtime suites plus explicit DB-backed audit/persistence suites, documented in `docs/test-suite-catalog.md`

## 14. Open decisions requiring clarification
Open future decisions visible after this refresh:
- what final functional post-login destinations should eventually replace the interim supported transition landing in `src/public/login.js`
- whether auxiliary `internal-docs/**` material should be further reduced, generated automatically, or archived now that canonical runtime-contract governance lives in `docs/**`
- whether the current dedicated Redis-path lane is sufficient long-term or should later evolve into broader always-on coverage beyond the existing focused CI path
- how far additional focused browser/runtime suites beyond the currently addressed boundary should be reclassified into explicit DB-free vs DB-backed lanes
- whether future negative-path request logging should be further tuned once the repository decides that the remaining non-audit log signal is too noisy, provided real failures remain visible
