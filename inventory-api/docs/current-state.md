# Current State

## 1. System overview
`inventory-api/` is a single-deployable Node.js 24 Express + Prisma application with REST APIs and a small embedded browser surface served from the same runtime.

Post-implementation state verified from repository contents:
- the active public browser runtime under `src/public/` is now intentionally reduced to the minimum supported baseline;
- supported HTML documents are `/` and `/index.html` (login), `/no-access.html`, and `/migration.html`;
- supported shared browser assets are `styles.css`, `login.js`, `no-access.js`, `migration.js`, `shared/session.js`, and `shared/auth.js`;
- requests to legacy HTML routes under `/root/*.html`, `/warehouse/*.html`, and `/agent/*.html` are intercepted before `express.static(...)` and respond with the common migration screen from the same URL and HTTP `410 Gone`;
- the former functional legacy browser runtime was preserved outside the active runtime in `legacy-public-runtime/` and is no longer served from `src/public/`.

The backend JSON API, Prisma persistence, browser-session cookie model, and repository/workflow governance remain implemented as in prior slices.

Repository-governance state verified in this refresh:
- runtime-contract governance now treats reviewed artifacts under `docs/**` as the canonical source of truth;
- `internal-docs/**` remains in-repository only as auxiliary support material and is no longer the authoritative enforcement target;
- `scripts/run-tests.js` is the official aggregate test runner behind `npm run test`;
- it defaults to `NODE_ENV=test` and `BROWSER_SESSION_STORE_MODE=memory` unless explicitly overridden;
- the repository also keeps an explicit Redis-path validation lane through `npm run test:redis-path` and the root workflow `.github/workflows/redis-browser-session-tests.yml` so the supported non-test browser-session store path remains separately governed.

## 2. Repository structure
High-signal paths verified in this refresh:
- repository root: `.github/workflows/`, `inventory-api/`
- application root: `inventory-api/package.json`, `inventory-api/Dockerfile`, `inventory-api/src/`, `inventory-api/prisma/`, `inventory-api/scripts/`, `inventory-api/tests/`, `inventory-api/docs/`, `inventory-api/internal-docs/`, `inventory-api/README.md`
- active public runtime: `inventory-api/src/public/`
- preserved but inactive legacy browser inventory: `inventory-api/legacy-public-runtime/`

Observed active `src/public/` inventory:
- `index.html`
- `migration.html`
- `no-access.html`
- `styles.css`
- `login.js`
- `migration.js`
- `no-access.js`
- `shared/session.js`
- `shared/auth.js`

Observed preserved legacy inventory outside runtime:
- `legacy-public-runtime/root/**`
- `legacy-public-runtime/warehouse/**`
- `legacy-public-runtime/agent/**`
- `legacy-public-runtime/shared/lot-dates.js`

## 3. Current architecture
Current implemented architecture remains layered rather than hexagonal:
- Express app and middleware at the HTTP boundary;
- route modules delegating to service modules;
- services coordinating business logic and repositories;
- repositories encapsulating most Prisma access;
- static browser assets served by the same Express process.

For the public browser surface, `src/app.js` now applies three relevant runtime behaviors:
1. route-segmented security headers including CSP;
2. a pre-static gate for deprecated legacy HTML routes;
3. `express.static(...)` for the reduced supported `src/public/` baseline only.

The legacy browser HTML pages are no longer an active runtime module even though their files are still preserved in the repository under `legacy-public-runtime/`.

## 4. Existing domains and modules
Observable current runtime and governance areas:
- Authentication and authorization
- Company, role, and user administration
- Client management and client documents
- Product catalog and inventory
- Warehouses and geography
- Sales routes and agent workspace APIs
- Orders, invoices, and payments
- Embedded browser runtime (reduced baseline only)
- Repository/platform governance
- CI/workflow governance

## 5. Main use cases
Examples currently implemented:
- login via `/api/auth/login`, including browser-session issuance when `X-Inventory-Browser-Session: cookie` is requested;
- retrieve authenticated context via `/api/auth/me`;
- close an authenticated browser session via `/api/auth/logout`;
- serve the supported login document at `/` and `/index.html`;
- serve the supported fallback documents `/no-access.html` and `/migration.html`;
- respond to direct legacy HTML requests such as `/root/dashboard.html`, `/warehouse/products.html`, or `/agent/workspace.html` with the shared migration screen and HTTP `410 Gone` without redirect;
- serve JSON APIs for companies, roles, users, clients, products, orders, invoices, payments, inventory, warehouses, regions, sales routes, agent workflows, taxpayers, geocoding, and economic activities;
- execute repository validation through lint, typecheck, build, public-runtime validation, the aggregate `npm run test` runner, browser/runtime characterization tests, and hosted GitHub Actions workflows.

## 6. Current data flows
### Public browser flow
1. A browser requests a public document or asset.
2. `src/app.js` applies security headers.
3. If the path matches `/root/*.html`, `/warehouse/*.html`, or `/agent/*.html`, the request is intercepted by `serveDeprecatedLegacyHtml`.
4. The response returns `migration.html` from the same requested URL with HTTP `410 Gone`.
5. Non-deprecated public requests fall through to `express.static(src/public)`.
6. Login and other supported public pages bootstrap session/auth behavior through `shared/session.js` and `shared/auth.js`.

### API flow
1. Express receives `/api/*` requests.
2. Middleware performs logging, request context, throttling, validation, authentication, and authorization as applicable.
3. Routes call services.
4. Services call repositories and Prisma-backed persistence.
5. Responses return JSON errors or data.

### Legacy-runtime preservation flow
1. Legacy HTML/JS files remain versioned under `legacy-public-runtime/`.
2. They are no longer inside `src/public/`.
3. They are therefore not part of the supported HTTP runtime served by Express.
4. Validators now treat them as preserved inventory, not active browser surface.

## 7. Database and persistence
- Prisma schema remains in `inventory-api/prisma/schema.prisma`.
- Versioned migrations remain in `inventory-api/prisma/migrations/`.
- Persistence remains repository + Prisma based.
- Browser-session persistence remains externalized through the store abstraction, with Redis as the supported non-test path.
- The reduced public-runtime contract and its `p22` follow-through introduced no database or migration changes.

## 8. APIs and integrations
Current observable interfaces:
- REST-style endpoints under `/api/*`
- health endpoints under `/health/*`
- static runtime served from `/`
- GitHub Actions as repository-governance integration
- canonical runtime-contract artifacts under `docs/**`, with `internal-docs/**` retained only as auxiliary repository material

Relevant public-surface behavior now in effect:
- `/api/auth/login`, `/api/auth/me`, and `/api/auth/logout` remain supported and are explicitly outside the HTML deprecation scope;
- `POST /api/auth/logout` is part of the governed runtime-contract inventory after the `p23` contract-alignment refresh;
- legacy HTML paths are not redirected to new routes; they return `410 Gone` from the same URL;
- `legacy-public-runtime/` is a repository artifact, not a served integration surface.

## 9. Authentication and authorization
Current observable behavior:
- login remains public;
- authenticated APIs use middleware-based authentication;
- authorization remains middleware/policy based;
- browser login can request a backend-owned browser session by sending `X-Inventory-Browser-Session: cookie` to `/api/auth/login`;
- supported embedded browser flows use the cookie pair `inventory_browser_session` + `inventory_browser_state` instead of persisted bearer tokens in `localStorage`;
- `shared/session.js` and `shared/auth.js` remain the active browser helper seam for the reduced supported public runtime;
- `/api/auth/me` returns the browser-session user projection and refreshes cookies for cookie-authenticated browser requests;
- `/api/auth/logout` invalidates the backend-owned browser session and clears both browser cookies;
- mutating cookie-authenticated requests enforce same-origin `Origin` validation in `authenticate.js`.

Current post-login behavior in code:
- `src/public/login.js` now resolves retired-runtime-dependent authenticated users to `/migration.html?mode=post-login-transition`.
- direct requests to `/root/*.html`, `/warehouse/*.html`, and `/agent/*.html` still do not open functional legacy screens; they continue to land on the deprecated-route migration response (`410 Gone`).

## 10. Events and background processing
No application event bus or separate background worker was verified.

GitHub Actions workflows remain repository automation, not application background processing.

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
- compose files declare the Redis dependency and browser-session store environment expected by the current session baseline
- root official workflows use Node 24 and execute in `inventory-api/`

## 12. Current testing strategy
This refresh did not execute commands directly. Validation status is taken from the user-provided post-implementation evidence for the current repository-governance refresh.

Current repository-wide testing posture now includes:
- `scripts/run-tests.js` as the official aggregate test runner behind `npm run test`;
- deterministic default test bootstrap via `NODE_ENV=test` and `BROWSER_SESSION_STORE_MODE=memory` unless explicitly overridden;
- a dedicated non-default Redis-path validation command at `npm run test:redis-path`;
- targeted governance and characterization suites for browser/runtime, contract coverage, authorization, audit instrumentation, integrations, and repository policies;
- focused browser/runtime validation through `scripts/validate-public-runtime.js` and related tests;
- workflow-governance validation through `scripts/validate-workflow-baseline.js` and `tests/workflow-baseline-characterization.test.js` against the root workflow tree;
- optional environment-gated suites such as `tests/p2-hardening-constraints.test.js` when dedicated database configuration is supplied.

The active browser/runtime governance still relies on:
- `scripts/validate-public-runtime.js`
- `tests/public-surface-characterization.test.js`
- `tests/public-runtime-http-smoke.test.js`
- `tests/browser-runtime-auth-convergence-inventory.test.js`
- `tests/browser-auth-compatibility-inventory.test.js`
- `tests/browser-e2e.e2e.js`
- canonical runtime-contract artifacts under `docs/**`
- optional auxiliary/internal artifacts under `internal-docs/**` when needed for non-canonical support material

Additional post-implementation evidence supplied by the requester for the TASK-026 / TASK-027 follow-up refresh:
- `node --test tests/runtime-contract-governance.test.js tests/openapi-contract-consistency.test.js tests/critical-contract-governance.test.js` ✅
- `npm run lint -- --quiet` ✅
- `npm run test:redis-path` ✅
- `npm run validate:workflow-baseline` ✅
- `node --test tests/workflow-baseline-characterization.test.js` ✅
- `npm run test -- --silent` ✅
- baseline governance audit score: `8.8/10` (acceptable, no meaningful regression found; warning remains because the score is below `9.5`)

This evidence establishes a passing repository-wide baseline for the official aggregate suite, the explicit Redis-path lane, and the root-workflow governance checks.

## 13. Behavior to preserve
- Express must continue serving the reduced active browser runtime from `src/public/`.
- `/`, `/index.html`, `/no-access.html`, and `/migration.html` must remain the only supported HTML documents in the embedded public runtime.
- Requests to deprecated legacy HTML routes under `/root/*.html`, `/warehouse/*.html`, and `/agent/*.html` must continue responding from the same URL with the common migration screen and HTTP `410 Gone`, without redirect.
- `/migration.html?mode=post-login-transition` must remain a supported 200 post-login landing distinct from the deprecated-route `410 Gone` contract.
- `legacy-public-runtime/` must remain outside the active runtime unless a later approved change explicitly redefines the supported surface.
- `/api/auth/login`, `/api/auth/me`, and `/api/auth/logout` must remain supported.
- `shared/session.js`, `shared/auth.js`, and `login.js` must remain the bounded browser-runtime typecheck baseline.
- Supported browser flows must not reintroduce persisted bearer tokens in `localStorage`.

## 14. Known defects
- The supported post-login landing for retired-runtime-dependent roles remains transitional and informational (`/migration.html?mode=post-login-transition`), not a final functional destination.
- Focused and aggregate tests can still emit expected audit-log noise for database unavailability (`db:5432`) while passing.

## 15. Architectural debt
- The application remains layered without strict hexagonal separation.
- Service-layer responsibilities remain broad in several modules.
- API runtime, static public delivery, and governance concerns still coexist in the same deployable.
- Operational assurance still depends on synchronization across docs, validators, tests, README, env examples, compose files, and workflows.
- Runtime-contract governance now treats `docs/**` as the sole authoritative reviewed artifact location; `internal-docs/**` is auxiliary only and must not shadow canonical runtime-contract truth.
- The repository-wide governance baseline remains acceptable but not fully closed by the latest audit score (`8.8/10`), so documentation and workflow/test contracts still require disciplined upkeep to avoid regressions below the desired threshold.
- The preserved `legacy-public-runtime/` inventory is intentionally outside active support, but it remains in-repo transition debt until replaced by the future SPA or formally archived.
- The interim supported post-login landing remains informational rather than operational for retired-runtime-dependent roles.
- The reduced public-runtime contract depends on synchronized updates across `login.js`, `migration.html`, `migration.js`, validators, tests, and manifest/docs when transition behavior changes.
- The aggregate test runner now defaults to memory-backed browser sessions for stability, which reduces default-suite coverage of the supported Redis-backed non-test path.

## 16. Security risks
Current architecture-facing security concerns still visible:
- supported non-test browser-session persistence depends on Redis availability and correct environment configuration;
- universal `Secure` cookie enforcement still depends on HTTPS-capable deployment or trusted proxy signaling;
- this HTTPS/cookie posture remains a documented residual risk and follow-up dependency tracked in `specs/p11-https-browser-session-migration/`, not an in-slice blocker for the current reduced public-runtime contract;
- mutating cookie-authenticated requests rely on same-origin `Origin` validation rather than a separate CSRF token;
- broader architectural boundaries are still layered rather than strongly isolated.

The reduced public-runtime posture continues to limit public browser exposure by removing the functional legacy HTML runtime from the served surface.

## 17. Unknowns and assumptions
- This refresh did not execute commands directly; validation status and audit scoring are taken from the user-provided command results.
- No evidence in this refresh contradicts the implemented reduced public-runtime contract.
- The preserved `legacy-public-runtime/` tree was verified as present in the repository, but it was not treated as supported runtime behavior because it is outside `src/public/`.
- The approved interim replacement destination in `login.js` is `/migration.html?mode=post-login-transition` until a later approved slice defines final functional destinations.
- The requester-supplied passing suite evidence is treated as the current repository-wide baseline for `npm run test -- --silent` after the `p23` runner-bootstrap change.
