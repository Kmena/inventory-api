# Current State

## 1. System overview
`inventory-api/` is a single-deployable Node.js 24 Express + Prisma application with REST APIs and a small embedded browser surface served from the same runtime.

Post-implementation state verified from repository contents:
- the active public browser runtime under `src/public/` is now intentionally reduced to the minimum supported baseline;
- supported HTML documents are `/` and `/index.html` (login), `/no-access.html`, and `/migration.html`;
- supported shared browser assets are `styles.css`, `login.js`, `no-access.js`, `migration.js`, `shared/session.js`, and `shared/auth.js`;
- requests to legacy HTML routes under `/root/*.html`, `/warehouse/*.html`, and `/agent/*.html` are intercepted before `express.static(...)` and respond with the common migration screen from the same URL and HTTP `410 Gone`;
- the former functional legacy browser runtime was preserved outside the active runtime in `legacy-public-runtime/` and is no longer served from `src/public/`;
- `legacy-public-runtime/` now has an explicit governance role as transitional backup/reference inventory only while equivalent root, warehouse, and agent capabilities are integrated and validated in the SPA.

The backend JSON API, Prisma persistence, browser-session cookie model, health/readiness endpoints, and repository/workflow governance remain implemented in the same deployable.

Repository-governance state verified in this refresh:
- the latest `p26-browser-runtime-db-free-suite-separation` cycle implements the previously approved DB-free vs DB-backed test separation for the affected browser/runtime boundary, removes the known incidental audit-DB noise from `tests/browser-e2e.e2e.js`, stabilizes `tests/audit-instrumentation.test.js` as a DB-free suite, and adds a maintained suite catalog without changing production audit semantics or database schema;
- runtime-contract governance treats reviewed artifacts under `docs/**` as the canonical source of truth;
- `internal-docs/**` remains in-repository only as auxiliary support material and is no longer the authoritative enforcement target;
- `scripts/run-tests.js` is the official aggregate test runner behind `npm run test`;
- it defaults to `NODE_ENV=test` and `BROWSER_SESSION_STORE_MODE=memory` unless explicitly overridden;
- the repository keeps an explicit Redis-path validation lane through `npm run test:redis-path` and the root workflow `.github/workflows/redis-browser-session-tests.yml` so the supported non-test browser-session store path remains separately governed;
- the earlier Redis operational-safeguards slice also hardened browser-session persistence visibility by making `/health/ready` depend on both database readiness and browser-session-store readiness.

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

The legacy browser HTML pages are no longer an active runtime module even though their files are still preserved in the repository under `legacy-public-runtime/`. That preserved tree is backup/reference material only; it is not an implicit rollback path and should be removed in a later approved slice once equivalent SPA sections are implemented and validated.

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
- answer `GET /health` with a backward-compatible liveness payload;
- answer `GET /health/ready` with database and browser-session-store dependency state, returning `503` when Prisma readiness fails or when the configured Redis session store is down;
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

### Readiness flow
1. `GET /health/ready` invokes Prisma database readiness.
2. The same request invokes `browserSessionService.checkBrowserSessionStoreReadiness()`.
3. The memory session store reports `{ mode: 'memory', status: 'memory' }` after local cleanup.
4. The Redis session store reports `{ mode: 'redis', status: 'up' }` when `PING` succeeds and `{ mode: 'redis', status: 'down' }` when the connection fails.
5. The route returns `200` only when the database is up and the browser-session dependency is acceptable for the active mode; in Redis mode, a down store makes readiness fail with `503`.

### Legacy-runtime preservation flow
1. Legacy HTML/JS files remain versioned under `legacy-public-runtime/`.
2. They are no longer inside `src/public/`.
3. They are therefore not part of the supported HTTP runtime served by Express.
4. Validators now treat them as preserved inventory, not active browser surface.
5. The preserved tree remains transitional only until equivalent SPA coverage exists and has been validated.

## 7. Database and persistence
- Prisma schema remains in `inventory-api/prisma/schema.prisma`.
- Versioned migrations remain in `inventory-api/prisma/migrations/`.
- Persistence remains repository + Prisma based.
- Browser-session persistence remains externalized through the store abstraction.
- `browser-session-store.factory.js` resolves `memory` for test mode by default and `redis` for non-test mode unless `BROWSER_SESSION_STORE_MODE` explicitly overrides it.
- `BrowserSessionMemoryStore` keeps sessions in-process, eagerly drops expired entries, supports explicit invalidation, and exposes readiness as `memory`.
- `BrowserSessionRedisStore` persists opaque sessions under the configured key prefix in Redis, uses a raw TCP Redis protocol client, and exposes readiness via `PING` without silently falling back to memory mode.
- No database schema or migration changed in the inspected `p26` implementation refresh.

## 8. APIs and integrations
Current observable interfaces:
- REST-style endpoints under `/api/*`
- health endpoints under `/health/*`
- static runtime served from `/`
- GitHub Actions as repository-governance integration
- canonical runtime-contract artifacts under `docs/**`, with `internal-docs/**` retained only as auxiliary repository material

Relevant health and operational contracts now in effect:
- `GET /health` returns `{ ok: true, service: 'inventory-api' }`;
- `GET /health/ready` returns `{ ok, service, checks }` where `checks.database` and `checks.browserSessionStore` reflect current dependency status;
- in Redis mode, `checks.browserSessionStore = down` forces readiness `503`;
- in memory mode, `checks.browserSessionStore = memory` keeps readiness compatible without requiring Redis.

Relevant public-surface behavior now in effect:
- `/api/auth/login`, `/api/auth/me`, and `/api/auth/logout` remain supported and are explicitly outside the HTML deprecation scope;
- `POST /api/auth/logout` is part of the governed runtime-contract inventory after the `p23` contract-alignment refresh;
- legacy HTML paths are not redirected to new routes; they return `410 Gone` from the same URL;
- `legacy-public-runtime/` is a repository artifact, not a served integration surface.
- `legacy-public-runtime/` is transitional backup/reference inventory only and must not be reactivated as a compatibility shortcut.

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
- in that supported transition mode, the page explicitly confirms successful authentication, states that the destination module is not implemented yet, and preserves safe return-to-login/logout actions instead of pretending to be a functional dashboard.
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
- the Docker image healthcheck probes `GET /health/ready`
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
- `docs/test-suite-catalog.md`
- canonical runtime-contract artifacts under `docs/**`
- optional auxiliary/internal artifacts under `internal-docs/**` when needed for non-canonical support material

Additional post-implementation evidence supplied by the requester for the latest implemented refresh:
- `node --test tests/browser-session-redis-store.test.js` ✅
- `node --test tests/browser-session-service-characterization.test.js` ✅
- `node --test tests/health-routes.test.js` ✅
- `node --test tests/production-baseline-characterization.test.js` ✅
- `node --test tests/browser-session-auth-boundary.test.js` ✅
- `npm run test:redis-path` ✅
- `npm run validate:operational-readiness` ✅
- `npm run lint -- --quiet` ✅
- `npm run typecheck` ✅
- `npm run build` ✅ (after one transient Windows Prisma rename-lock retry)
- `npm run test -- --silent` ✅
- Additional requester-supplied validation evidence for `p26`:
  - `node --test tests/browser-e2e.e2e.js` ✅
  - `node --test tests/audit-instrumentation.test.js tests/audit-repository.test.js` ✅, with `tests/audit-repository.test.js` skipped when `P2_AUDIT_DATABASE_URL` is absent
  - `npm run typecheck` ✅
  - `npm run validate:public-runtime` ✅
  - `npm run lint -- --quiet` ✅
- baseline audit score: `8.8/10` acceptable, with no meaningful regression reported and the warning remaining only because the score is below `9.5`

This evidence establishes a passing repository-wide baseline for the official aggregate suite, the explicit Redis-path lane, and the operational-readiness checks relevant to browser-session persistence.

## 13. Behavior to preserve
- Express must continue serving the reduced active browser runtime from `src/public/`.
- `/`, `/index.html`, `/no-access.html`, and `/migration.html` must remain the only supported HTML documents in the embedded public runtime.
- Requests to deprecated legacy HTML routes under `/root/*.html`, `/warehouse/*.html`, and `/agent/*.html` must continue responding from the same URL with the common migration screen and HTTP `410 Gone`, without redirect.
- `/migration.html?mode=post-login-transition` must remain a supported 200 post-login landing distinct from the deprecated-route `410 Gone` contract.
- the supported post-login landing must remain explicitly transitional, not-yet-implemented, and safe-exit oriented until future SPA destinations per role are approved and implemented.
- `legacy-public-runtime/` must remain outside the active runtime and outside implicit rollback behavior unless a later approved change explicitly redefines the supported surface.
- `/api/auth/login`, `/api/auth/me`, and `/api/auth/logout` must remain supported.
- `GET /health` must remain a backward-compatible liveness endpoint.
- `GET /health/ready` must continue reflecting both database readiness and browser-session-store readiness, including `503` when Redis mode is configured but unavailable.
- `shared/session.js`, `shared/auth.js`, and `login.js` must remain the bounded browser-runtime typecheck baseline.
- Retired legacy pages and `legacy-public-runtime/` must not re-enter supported runtime, validator scope, or typecheck scope unless a later approved spec explicitly changes that contract.
- Supported browser flows must not reintroduce persisted bearer tokens in `localStorage`.

## 14. Known defects
- The supported post-login landing for retired-runtime-dependent roles remains transitional and informational (`/migration.html?mode=post-login-transition`), not a final functional destination.
- The current supported wording intentionally tells the user that the destination module is not implemented yet and offers safe return-to-login/logout behavior rather than legacy fallback navigation.
- The Redis session store implementation uses a small raw-socket protocol client rather than a mature Redis library, which keeps dependencies low but leaves protocol handling responsibility inside application code.
- Some passing tests can still emit expected operational logs, but the previously known incidental audit-log noise for `tests/browser-e2e.e2e.js` no longer reaches Prisma because that suite now runs through an explicit DB-free audit seam.
- The approved remediation strategy has now been implemented for the affected browser/runtime boundary through explicit DB-free vs DB-backed suite separation and a maintained suite catalog, rather than broad log suppression.

## 15. Architectural debt
- The application remains layered without strict hexagonal separation.
- Service-layer responsibilities remain broad in several modules.
- API runtime, static public delivery, and governance concerns still coexist in the same deployable.
- Operational assurance still depends on synchronization across docs, validators, tests, README, env examples, compose files, and workflows.
- Runtime-contract governance now treats `docs/**` as the sole authoritative reviewed artifact location; `internal-docs/**` is auxiliary only and must not shadow canonical runtime-contract truth.
- The repository-wide governance baseline remains acceptable but not fully closed by the latest audit score (`8.8/10`), so documentation and workflow/test contracts still require disciplined upkeep to avoid regressions below the desired threshold.
- The preserved `legacy-public-runtime/` inventory is intentionally outside active support and remains in-repo only as transitional backup/reference debt until equivalent SPA functionality is implemented, validated, and a later approved slice removes it.
- The interim supported post-login landing remains informational rather than operational for retired-runtime-dependent roles.
- The reduced public-runtime contract depends on synchronized updates across `login.js`, `migration.html`, `migration.js`, validators, tests, and manifest/docs when transition behavior changes.
- The aggregate test runner now defaults to memory-backed browser sessions for stability, which reduces default-suite coverage of the supported Redis-backed non-test path.
- Focused browser/runtime suites should avoid real DB-backed audit dependencies when persistence is not part of the asserted behavior, while dedicated DB-backed tests must continue preserving audit/persistence coverage and unexpected-failure visibility.
- `docs/test-suite-catalog.md` is now the maintained reference for the affected suite boundary, including DB-free, DB-backed, and Redis-backed classifications.

## 16. Security risks
Current architecture-facing security concerns still visible:
- supported non-test browser-session persistence depends on Redis availability and correct environment configuration;
- browser-session issuance and validation now fail explicitly with `503 service_unavailable` semantics when Redis mode is configured but the store is unreachable, which is safer than silent downgrade but increases operational dependence on Redis uptime;
- universal `Secure` cookie enforcement still depends on HTTPS-capable deployment or trusted proxy signaling;
- this HTTPS/cookie posture remains a documented residual risk and follow-up dependency tracked in `specs/p11-https-browser-session-migration/`, not an in-slice blocker for the current reduced public-runtime contract;
- mutating cookie-authenticated requests rely on same-origin `Origin` validation rather than a separate CSRF token;
- broader architectural boundaries are still layered rather than strongly isolated.

The reduced public-runtime posture continues to limit public browser exposure by removing the functional legacy HTML runtime from the served surface.

## 17. Unknowns and assumptions
- This refresh did not execute commands directly; validation status and audit scoring are taken from the user-provided command results.
- No evidence in this refresh contradicts the implemented reduced public-runtime contract.
- The preserved `legacy-public-runtime/` tree was verified as present in the repository, but it was not treated as supported runtime behavior because it is outside `src/public/`.
- The approved interim replacement destination in `login.js` is `/migration.html?mode=post-login-transition` until a later approved slice defines final functional SPA destinations by role.
- The requester-supplied passing suite evidence is treated as the current repository-wide baseline for `npm run test -- --silent` after the `p23` runner-bootstrap change.
