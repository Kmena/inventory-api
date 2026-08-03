# Current State

## 1. System overview
`inventory-api/` is a single-deployable Node.js 24 Express + Prisma application with REST APIs and an embedded browser runtime served by the same Express process.

Current browser/runtime and access-governance state verified from repository contents after `zones-view`, `sidebar-rebrand-permissions` `TASK-004`, `quality-baseline-recovery` `TASK-007`, together with `TASK-001`, `TASK-002`, `TASK-003`, `TASK-004`, `TASK-005`, `TASK-006`, `p38-root-shell-modularity-hardening`, `p37-root-spa-companies-roles-admin`, and `root-shell-follow-up-alignment`, building on `p36-bounded-doc-validator-ownership-alignment`, `p35-governance-baseline-sync-guardrails`, `p34-bounded-governance-coverage-expansion`, and `p33-admin-authorization-governance-convergence`:
- the active public browser runtime under `src/public/` is intentionally small and now includes a supported root SPA shell entrypoint;
- supported public HTML documents are `/`, `/index.html`, `/no-access.html`, `/migration.html`, and the root shell entrypoint at `/root/` backed by `src/public/root/index.html`;
- the supported `/root/` shell now has two observable actor variants: global `root` users keep the existing top navigation, while `admin` users with `companyId` receive a rebranded administrative sidebar shell with explicit hash routes for visible menu items;
- supported shared browser assets include `styles.css`, `login.js`, `migration.js`, `no-access.js`, `shared/session.js`, `shared/auth.js`, and the root-shell assets under `src/public/root/**`;
- requests to legacy HTML routes under `/root/*.html`, `/warehouse/*.html`, and `/agent/*.html` are still intercepted before `express.static(...)` and respond with the shared migration screen and HTTP `410 Gone` from the same URL;
- the former functional legacy browser runtime remains preserved outside the active runtime in `legacy-public-runtime/` and is not served from `src/public/`;
- `legacy-public-runtime/` remains transitional backup/reference inventory while equivalent supported SPA capabilities are implemented and validated.

The backend JSON API, Prisma persistence, browser-session cookie model, health/readiness endpoints, and repository/workflow governance remain part of the same deployable. The remaining browser-session residual risk is still tracked explicitly as a follow-up dependency in `specs/p11-https-browser-session-migration/` and is not an in-slice blocker for the current bounded governance/documentation refreshes.

Repository-governance state verified in this refresh:
- `scripts/run-tests.js` is the official aggregate test runner behind `npm run test`;
- canonical runtime-contract governance lives under `docs/**`;
- `docs/coding_standard.md` is now the canonical coding-standards body, while the legacy hyphenated alias remains only as a compatibility bridge for older references;
- bounded evidence for the `p33` admin-governance seam now also covers `src/security/access-policies.js` in typecheck and keeps the reviewed partial OpenAPI/matrix focused on the selected governance-admin endpoints only;
- `tests/governance-baseline-sync-guardrails.test.js` now acts as the focused documentation-sync guardrail for the selected post-`p34` governance statements only; it does not imply repository-wide documentation convergence;
- `docs/permission-governance-decisions.md` now exists as an explainer for the completed `p10-permission-governance` analysis outputs, while the active runtime foundation lives in `src/security/permission-governance.config.js`, `src/security/role-bundles.config.js`, and `src/security/permission-governance.service.js`; `p30-company-role-governance-hardening` extended that foundation so company-role creation now rejects platform-scoped permissions such as `companies.manage` before persistence, and `p32-governance-denial-audit-visibility` added a dedicated service-level denial audit action for that denied path;
- `internal-docs/**` remains auxiliary repository material only, while the in-scope runtime-contract governance validators now consume canonical `docs/**` artifacts and do not rely on auxiliary `internal-docs/**` runtime-contract copies for authority;
- the repository keeps an explicit Redis-path validation lane through `npm run test:redis-path` and the parent-root hosted workflow `../.github/workflows/redis-browser-session-tests.yml` relative to `inventory-api/`;
- `/health/ready` depends on both database readiness and browser-session-store readiness.

## 2. Repository structure
High-signal paths verified in this refresh:
- repository root: parent-root `.github/workflows/` plus the `inventory-api/` application directory
- authoritative hosted workflow location for local validators/tests: `../.github/workflows/` relative to `inventory-api/`; `inventory-api/.github/workflows/` is not the current authoritative workflow source
- application root: `inventory-api/package.json`, `inventory-api/Dockerfile`, `inventory-api/src/`, `inventory-api/prisma/`, `inventory-api/scripts/`, `inventory-api/tests/`, `inventory-api/docs/`, `inventory-api/internal-docs/`, `inventory-api/README.md`
- canonical coding-standards document: `inventory-api/docs/coding_standard.md`
- compatibility bridge for older coding-standards references: legacy hyphenated coding-standards alias
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
- `root/index.html`
- `root/app.js`
- `root/router.js`
- `root/guards.js`
- `root/manifest.js`
- `root/session-adapter.js`
- `root/ui.js`
- `root/companies-api.js`
- `root/roles-api.js`
- `root/zones-api.js`
- `root/views/home.js`
- `root/views/in-process.js`
- `root/views/companies-admin.js`
- `root/views/roles-admin.js`
- `root/views/zones-admin.helpers.js`
- `root/views/zones-admin.js`
- `root/registry.js`

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

For the public browser surface, `src/app.js` currently applies three relevant runtime behaviors:
1. route-segmented security headers including CSP;
2. a pre-static gate for deprecated legacy HTML routes;
3. `express.static(...)` for the supported `src/public/` surface, which now includes the minimal root shell.

The active root browser surface is a vanilla-JS SPA shell under `src/public/root/` with:
- a bounded `window.RootShell` dependency registry seam (`register`, `require`, `has`) loaded before the shell modules;
- authenticated layout and identity header;
- actor-aware shell furniture: global `root` keeps top navigation while `company-admin` gets a fixed sidebar with desktop collapse and mobile drawer behavior; the sidebar keeps header and footer fixed while only the middle navigation region scrolls;
- manifest-driven navigation with actor-aware route visibility and explicit route items for company-admin sidebar entries;
- client-side hash routing;
- bootstrap through the existing browser-session model and `GET /api/auth/me`;
- logout through the existing `POST /api/auth/logout` contract;
- shared shell utilities in `root/ui.js`;
- sidebar visual hardening in `styles.css`: defensive `box-sizing`, `min-width: 0` on nested sidebar wrappers, ellipsis for labels and footer identity text, display-gated tooltips that appear only for collapsed hover/focus interactions, and a discreet thin vertical scrollbar applied only to `.root-sidebar__scroll`;
- shell-owned global layout offsets, while views own only their internal content layout;
- an implemented `home` view and a shared neutral `in_process` fallback view;
- a root-only Companies Admin view at `#companies`;
- a company-admin Roles/Permissions Admin view at `#roles_permissions`;
- a company-admin Zones view at `#zones` backed by the existing regions company endpoints;
- an expanded company-admin information architecture rendered from `root/manifest.js`, grouped into `Inicio`, `Operacion`, `Control`, and `Administracion`, where `#admin_home`, `#products`, `#lots`, `#movements`, `#production`, `#agents`, `#routes`, `#clients`, `#purchases`, `#warehouses`, `#approvals`, `#reports`, `#users`, and `#settings` are explicit sidebar routes that currently resolve to the shared neutral `in_process` view, while `#roles_permissions` and `#zones` are functional tenant-admin routes;
- the `#zones` view currently implements local in-memory search for zones and subzones, manual refresh, create-zone and create-subzone dialogs, toast feedback, temporary subzone highlight after creation, and a mobile consecutive list/detail flow. `src/public/root/views/zones-admin.helpers.js` now owns small seams for selection/filter logic plus dialog/form support such as reset, inline field-error rendering, and submit-button state, while the main async UI orchestration remains concentrated in `src/public/root/views/zones-admin.js`.
- `tests/root-shell-modularity-governance.test.js` now verifies the bounded `window.RootShell` registry contract and enforces the current containment baseline for sensitive root-shell modules: `router.js` must keep isolated characterization coverage and `zones-admin.js` must continue consuming the extracted helper seams from `zones-admin.helpers.js`.

The legacy browser HTML pages are not an active runtime module even though their files remain preserved under `legacy-public-runtime/`.

## 4. Existing domains and modules
Observable current runtime and governance areas:
- Authentication and authorization
  - legacy hybrid access-policy runtime in `src/security/access-policies.js`
  - centralized permission-governance foundation in `src/security/permission-governance*.js`
- Company, role, and user administration
- Client management and client documents
- Product catalog and inventory
- Warehouses and geography
- Sales routes and agent workspace APIs
- Orders, invoices, and payments
- Embedded browser runtime
  - login and session bootstrap
  - root shell wave-one SPA entrypoint
  - company-admin roles/permissions and zones views
  - migration and no-access fallbacks
- Repository/platform governance
- CI/workflow governance

## 5. Main use cases
Examples currently implemented:
- login via `/api/auth/login`, including browser-session issuance when `X-Inventory-Browser-Session: cookie` is requested;
- retrieve authenticated context via `/api/auth/me`;
- close an authenticated browser session via `/api/auth/logout`;
- serve the supported login document at `/` and `/index.html`;
- serve the supported root shell at `/root/`;
- bootstrap the root shell from the current browser session and redirect invalid sessions back to login;
- allow wave-one root-shell access for `root` users and `admin` users with `companyId`;
- render actor-aware shell navigation so global root users keep top navigation with `Empresas`, while company admins get a rebranded sidebar with grouped tenant-admin navigation, `#admin_home` as the default landing when no hash is present, and `Roles y permisos` plus `Zonas` as the functional sidebar destinations today;
- let a global root user load companies from `GET /api/companies/root/companies`;
- let a global root user create companies from the shell through `POST /api/companies/root/companies`;
- let a global root user toggle company active status from the shell through `PATCH /api/companies/root/companies/:companyId/status`;
- let a company-admin user load assignable permissions from `GET /api/roles/permissions`;
- let a company-admin user load company roles from `GET /api/roles/company`;
- let a company-admin user create company roles from the shell through `POST /api/roles/company`;
- let a company-admin user load zones from `GET /api/regions/company`, create zones through `POST /api/regions/company`, and create subzones through `POST /api/regions/company/:regionId/subregions` from `#zones`;
- keep role/permission administration bounded to list/create only; no runtime role edit/delete/reassignment UI is implemented;
- serve the supported fallback documents `/no-access.html` and `/migration.html`;
- send non-wave-one authenticated browser users such as warehouse and operational agent profiles to `/migration.html?mode=post-login-transition`;
- respond to direct legacy HTML requests such as `/root/dashboard.html`, `/warehouse/products.html`, or `/agent/workspace.html` with the shared migration screen and HTTP `410 Gone` without redirect;
- answer `GET /health` with a backward-compatible liveness payload;
- answer `GET /health/ready` with database and browser-session-store dependency state, returning `503` when Prisma readiness fails or when the configured Redis session store is down;
- serve JSON APIs for companies, roles, users, clients, products, orders, invoices, payments, inventory, warehouses, regions, sales routes, agent workflows, taxpayers, geocoding, and economic activities;
- enforce that only a global `root` actor (`role === 'root'` and no `companyId`) can create companies through a bounded converged contract: the company admin routes now declare explicit global-root actor scope in `src/security/access-policies.js`, while the current governance service + company service boundary still preserves the sensitive business check;
- create company-scoped custom roles while rejecting platform-scoped permissions such as `companies.manage`, preserving current warning-only posture for non-approved sensitive combinations, recording governance warnings in audit metadata for successful allow/warn flows, and emitting dedicated service-level denial audit attempts with action `roles.company.create.governance_denied` when the enforced deny path is hit and request audit context exists;
- record bounded admin route actor-scope denials through the existing safe audit seam with action `security.authorization.access_policy`, reason code `actor_scope_denied`, and metadata including `policyId`, `boundary`, `actorScope`, `role`, and `companyId`.

## 6. Current data flows
### Public browser flow
1. A browser requests a public document or asset.
2. `src/app.js` applies security headers.
3. If the path matches `/root/*.html`, `/warehouse/*.html`, or `/agent/*.html`, the request is intercepted by `serveDeprecatedLegacyHtml`.
4. The response returns `migration.html` from the same requested URL with HTTP `410 Gone`.
5. Non-deprecated public requests fall through to `express.static(src/public)`.
6. Login and other supported public pages bootstrap session/auth behavior through `shared/session.js` and `shared/auth.js`.

### Root shell flow
1. A browser reaches `/root/` directly or is redirected there from `src/public/login.js` after successful authentication.
2. `root/app.js` reads the snapshot from `InventorySession.read()` through `root/session-adapter.js`.
3. The shell refreshes or validates the browser session through `InventoryAuth.bootstrapSession()`, which depends on `GET /api/auth/me`.
4. `root/guards.js` checks shell eligibility.
5. If there is no valid session, the browser returns to `/` with `reason=session-expired`.
6. If the session is authenticated but not eligible for the root shell, the browser is sent to `/no-access.html`.
7. If the session is eligible, `root/app.js` configures actor-specific shell furniture from `root/manifest.js`: global `root` sees top navigation, while `company-admin` sees the rebranded grouped sidebar.
8. `root/router.js` resolves the hash route against explicit manifest items. Global root routes remain `home` and `companies`. Company-admin routes include `admin_home`, `products`, `lots`, `movements`, `production`, `agents`, `routes`, `zones`, `clients`, `purchases`, `warehouses`, `approvals`, `reports`, `users`, `roles_permissions`, and `settings`, with missing or unauthorized hashes falling back to the first accessible route; the current functional company-admin routes are `roles_permissions` and `zones`, while the remaining company-admin routes render the shared neutral `in_process` view.
8.1. For company-admin sessions with no hash present, the first accessible route is `#admin_home`.
8.2. Root-shell modules publish and consume internal dependencies through `window.RootShell` instead of many unrelated top-level `window.RootShell*` globals.
9. `companies-admin.js` mounts root-company list/create/status behavior through `companies-api.js` for global root sessions.
10. `roles-admin.js` mounts permission/role list/create behavior through `roles-api.js` for company-admin sessions with `companyId`.
10.1. `zones-admin.js` mounts the zones/subzones master-detail workflow through `zones-api.js`, using local filtering in memory and reloading from the server only for initial load, explicit refresh, and successful create actions; selection/filter behavior and small dialog/form seams now flow through `zones-admin.helpers.js`, including reset, inline error rendering, and submit-button state helpers.
11. Logout uses the shared auth helper and returns the browser to login.

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

## 7. Database and persistence
- Prisma schema remains in `inventory-api/prisma/schema.prisma`.
- Versioned migrations remain in `inventory-api/prisma/migrations/`.
- Persistence remains repository + Prisma based.
- Browser-session persistence remains externalized through the store abstraction.
- `browser-session-store.factory.js` resolves `memory` for test mode by default and `redis` for non-test mode unless `BROWSER_SESSION_STORE_MODE` explicitly overrides it.
- `BrowserSessionMemoryStore` keeps sessions in-process, eagerly drops expired entries, supports explicit invalidation, and exposes readiness as `memory`.
- `BrowserSessionRedisStore` persists opaque sessions under the configured key prefix in Redis, uses a raw TCP Redis protocol client, and exposes readiness via `PING` without silently falling back to memory mode.
- `p27-root-initial-spa-shell`, `p28-flexible-permission-governance-foundation`, `p30-company-role-governance-hardening`, and `p32-governance-denial-audit-visibility` introduced no database schema or migration changes.

## 8. APIs and integrations
Current observable interfaces:
- REST-style endpoints under `/api/*`
- health endpoints under `/health/*`
- static runtime served from `/`
- GitHub Actions as repository-governance integration
- canonical runtime-contract artifacts under `docs/**`, including the runtime-contract manifest and reviewed OpenAPI baseline consumed by the bounded legacy governance validator

Relevant public-surface behavior now in effect:
- `/api/auth/login`, `/api/auth/me`, and `/api/auth/logout` remain supported and are outside the HTML deprecation scope;
- `/root/` is a supported authenticated browser entrypoint for the actor-aware root shell;
- the current shell contract includes a split UI model in the same document: root-global top navigation and company-admin sidebar navigation with explicit sidebar hash routes;
- root-shell API consumption now includes `GET /api/companies/root/companies`, `POST /api/companies/root/companies`, `PATCH /api/companies/root/companies/:companyId/status`, `GET /api/roles/permissions`, `GET /api/roles/company`, `POST /api/roles/company`, `GET /api/regions/company`, `POST /api/regions/company`, and `POST /api/regions/company/:regionId/subregions`;
- `POST /api/auth/logout` remains part of the governed runtime-contract inventory;
- legacy HTML paths are not redirected to new routes; they return `410 Gone` from the same URL;
- `legacy-public-runtime/` is a repository artifact, not a served integration surface.

## 9. Authentication and authorization
Current observable behavior:
- login remains public;
- authenticated APIs use middleware-based authentication;
- authorization remains middleware/policy based;
- role/permission governance remains hybrid in runtime code: `src/security/access-policies.js` still mixes role-based and permission-based policies, but the repository now also contains a centralized permission-governance foundation used by services for governed-operation evaluation;
- a bounded route-policy convergence seam now exists for the highest-signal company/company-role admin flows only: company list/create and root-company list/create policies declare explicit `global-root` actor scope, while company-role list/create policies declare explicit `company-admin` actor scope before the sensitive service-level governance rules run;
- the planning/governance analysis package for this area is documented in `specs/p10-permission-governance/`, `docs/permission-governance-decisions.md` summarizes the recommended governance model, `p28` implemented the first runtime slice with a central policy model, reusable warning contract, and stable `company.create` deny rule for non-global-root actors, `p30` added enforced company-role creation denial for platform-scoped permissions, and `p32` added dedicated service-level denial audit visibility for that approved deny path;
- browser login can request a backend-owned browser session by sending `X-Inventory-Browser-Session: cookie` to `/api/auth/login`;
- supported embedded browser flows use the cookie pair `inventory_browser_session` + `inventory_browser_state` instead of persisted bearer tokens in `localStorage`;
- `shared/session.js` and `shared/auth.js` remain the active browser helper seam for supported public pages;
- `/api/auth/me` returns the browser-session user projection and refreshes cookies for cookie-authenticated browser requests;
- `/api/auth/logout` invalidates the backend-owned browser session and clears both browser cookies;
- mutating cookie-authenticated requests enforce same-origin `Origin` validation in `authenticate.js`.

Current post-login behavior in code:
- `src/public/login.js` routes `root` users and `admin` users with `companyId` to `/root/`;
- inside `/root/`, `src/public/root/guards.js` restricts shell eligibility to those same two actor types;
- inside `/root/`, `src/public/root/registry.js` centralizes shell dependency registration and lookup while preserving the existing plain-script delivery model;
- inside the shell, navigation visibility is actor-aware: global `root` users keep the top-nav experience and can access `#home` and `#companies`, while company `admin` users with `companyId` receive the rebranded grouped sidebar with `#admin_home` as the default landing, explicit placeholder routes for the approved sidebar IA, and functional access to `#roles_permissions` and `#zones`;
- `root/router.js` falls back to the first accessible route when a hash route is missing or not allowed;
- backend APIs remain authoritative; shell guards are UX-level gates only;
- `sales_supervisor`, warehouse-capable sessions, and operational-agent sessions still route to `/migration.html?mode=post-login-transition`;
- sessions outside those supported destinations route to `/no-access.html`;
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
This refresh did not execute commands directly. Validation status is taken from the user-provided post-implementation evidence.

Current repository-wide testing posture includes:
- `scripts/run-tests.js` as the official aggregate test runner behind `npm run test`;
- deterministic default test bootstrap via `NODE_ENV=test` and `BROWSER_SESSION_STORE_MODE=memory` unless explicitly overridden;
- a dedicated non-default Redis-path validation command at `npm run test:redis-path`;
- targeted governance and characterization suites for browser/runtime, contract coverage, authorization, audit instrumentation, integrations, and repository policies;
- focused browser/runtime validation through `scripts/validate-public-runtime.js` and related tests.

The active browser/runtime governance now relies on:
- `scripts/validate-public-runtime.js`
- `tests/public-surface-characterization.test.js`
- `tests/public-runtime-http-smoke.test.js`
- `tests/browser-runtime-auth-convergence-inventory.test.js`
- `tests/browser-auth-compatibility-inventory.test.js`
- `tests/root-shell-route-governance.test.js`
- `tests/root-shell-modularity-governance.test.js`
- `tests/browser-e2e.e2e.js`
- `tests/zones-view-selection-filters-characterization.test.js`
- `tests/zones-view-dialog-feedback-characterization.test.js`
- `tests/zones-view.e2e.js`
- `docs/test-suite-catalog.md`
- `tests/coding-standard-path-alignment.test.js`

The active permission-governance foundation now also relies on:
- `tests/permission-governance-foundation.test.js`
- `tests/permission-governance-backend-consumption.test.js`

The current documentation-path governance for coding standards now also relies on:
- `docs/coding_standard.md` as the authoritative standards body
- the legacy hyphenated coding-standards alias as a compatibility notice only
- `tests/coding-standard-path-alignment.test.js`

Additional requester-supplied validation evidence for `coding-standard-doc-path-alignment`:
- `node --test tests/coding-standard-path-alignment.test.js` ✅
- `node --test tests/workflow-baseline-characterization.test.js` ✅
- `npm run typecheck` ✅
- `npm run build` ⚠️ pre-existing Windows Prisma rename-lock `EPERM` during Prisma generate

Additional requester-supplied validation evidence for `zones-view`:
- `npm run lint:public-runtime` ✅
- `npm run typecheck` ✅
- `npm run validate:public-runtime` ✅
- `npm run lint` ✅
- `node --test tests/root-shell-route-governance.test.js tests/public-surface-characterization.test.js tests/zones-view.e2e.js` ✅
- `npm run build` ⚠️ pre-existing Windows Prisma rename-lock `EPERM` during Prisma generate

Additional requester-supplied validation evidence for `sidebar-rebrand-permissions` `TASK-004`:
- `npm run typecheck` ✅
- `npm run lint:public-runtime` ✅
- `npm run validate:public-runtime` ✅
- `node --test tests/public-surface-characterization.test.js` ✅
- `node --test tests/root-shell-route-governance.test.js` ✅
- `node --test tests/browser-e2e.e2e.js` ✅
- `npm run build` ⚠️ pre-existing Windows Prisma rename-lock `EPERM` during Prisma generate

Additional requester-supplied validation evidence for `quality-baseline-recovery` `TASK-004`:
- `node --test tests/zones-view-selection-filters-characterization.test.js` ✅
- `node --test tests/zones-view.e2e.js` ✅
- `npm run typecheck` ✅
- `npm run lint:public-runtime` ✅

Additional requester-supplied validation evidence for `quality-baseline-recovery` `TASK-005`:
- `node --test tests/zones-view-dialog-feedback-characterization.test.js` ✅
- `node --test tests/zones-view.e2e.js` ✅
- `node --test tests/zones-view-selection-filters-characterization.test.js` ✅
- `node --test tests/root-shell-route-governance.test.js` ✅
- `npm run validate:public-runtime` ✅
- `npm run typecheck` ✅
- `npm run lint:public-runtime` ✅

Additional requester-supplied validation evidence for `quality-baseline-recovery` `TASK-006`:
- `node --test tests/root-shell-modularity-governance.test.js` ✅
- `node --test tests/root-shell-route-governance.test.js` ✅
- `node --test tests/root-shell-router-characterization.test.js` ✅
- `node --test tests/zones-view-selection-filters-characterization.test.js tests/zones-view-dialog-feedback-characterization.test.js` ✅
- `npm run validate:public-runtime` ✅
- `npm run typecheck` ✅
- `npm run lint:public-runtime` ✅

Additional requester-supplied validation evidence for `quality-baseline-recovery` `TASK-007`:
- `npm run validate:public-runtime` ✅
- `node --test tests/public-surface-characterization.test.js` ✅
- `node --test tests/root-shell-route-governance.test.js` ✅
- `npm run typecheck` ✅
- `npm run lint:public-runtime` ✅

Additional permission-governance evidence supplied by the user for the completed `p10` analysis slice:
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run build` ✅
- `node --test tests/access-policies.test.js tests/authorization-convergence-characterization.test.js` ⚠️ baseline env-sensitive failure was documented as pre-existing when that focused command is run outside the default memory-mode test bootstrap

Additional requester-supplied validation evidence for `p28`:
- focused tests passed ✅
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run build` ✅

Additional requester-supplied documentation-only validation evidence for `p29`:
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run build` ✅
- `git diff --check` ✅

Additional requester-supplied validation evidence for `p36`:
- `node --test tests/p36-doc-validator-ownership.test.js` ✅
- `node --test tests/runtime-contract-governance.test.js tests/critical-contract-governance.test.js tests/openapi-contract-consistency.test.js tests/governance-baseline-sync-guardrails.test.js` ✅
- `npm run typecheck` ✅
- `npm run lint -- --quiet` ✅
- `npm run build` ✅

Additional requester-supplied validation evidence for `p37`:
- `npm run validate:public-runtime` ✅
- `node --test tests/public-surface-characterization.test.js` ✅
- `node --test tests/public-runtime-http-smoke.test.js` ✅
- `node --test tests/root-shell-route-governance.test.js` ✅
- `node --test tests/browser-e2e.e2e.js` ✅
- `npm run lint:public-runtime` ✅
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run build` ✅
- `npm run test -- --silent` ⚠️ pre-existing unrelated failures remain

Additional requester-supplied validation evidence for `p34`:
- `npm run typecheck` ✅
- `node --test tests/typecheck-ci-hardening-governance.test.js` ✅
- `node --test tests/openapi-contract-consistency.test.js` ✅
- `node --test tests/critical-contract-governance.test.js` ✅
- `npm run build` ✅

Additional requester-supplied validation evidence for `p33`:
- `set BROWSER_SESSION_STORE_MODE=memory&& node --test tests/access-policies.test.js` ✅
- `set BROWSER_SESSION_STORE_MODE=memory&& node --test tests/company-authorization-characterization.test.js` ✅
- `set BROWSER_SESSION_STORE_MODE=memory&& node --test tests/authorization-convergence-characterization.test.js` ✅
- `set BROWSER_SESSION_STORE_MODE=memory&& node --test tests/audit-instrumentation.test.js` ✅
- `node --test tests/permission-governance-backend-consumption.test.js` ✅
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run build` ✅

Additional requester-supplied validation evidence for `p30`:
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run build` ✅
- `node --test tests/permission-governance-foundation.test.js` ✅
- `node --test tests/permission-governance-backend-consumption.test.js tests/permission-governance-foundation.test.js` ✅
- `git diff --check` ✅

Additional requester-supplied validation evidence for `p32`:
- `node --test tests/permission-governance-backend-consumption.test.js` ✅
- `node --test tests/audit-instrumentation.test.js` ✅
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run build` ✅
- `git diff --check` ✅

Additional requester-supplied validation evidence for `p27`:
- `npm run validate:public-runtime` ✅
- `npm run lint:public-runtime` ✅
- `npm run typecheck` ✅
- `npm run lint -- --quiet` ✅
- `npm run build` ✅
- `node --test tests/browser-e2e.e2e.js` ✅
- `node --test tests/public-runtime-http-smoke.test.js tests/public-surface-characterization.test.js tests/browser-runtime-auth-convergence-inventory.test.js` ✅

Note on current static analysis scope:
- `tsconfig.typecheck.json` keeps an explicit browser-runtime allowlist that includes `src/public/shared/session.js`, `src/public/shared/auth.js`, `src/public/login.js`, and the approved `src/public/root/**` shell files.
- The supported root shell remains additionally governed by lint, runtime validator, smoke tests, characterization tests, and browser E2E.

## 13. Behavior to preserve
- Express must continue serving the supported browser runtime from `src/public/`.
- `/root/` must remain the supported wave-one root shell entrypoint.
- global `root` users must continue keeping the current top-navigation shell variant.
- company-admin users with `companyId` must continue receiving the rebranded sidebar shell variant.
- The root shell must continue bootstrapping through the existing browser-session model and `/api/auth/me`.
- `root` users and `admin` users with `companyId` must continue landing on `/root/` after browser login.
- company-admin sessions with no hash must continue landing on `#admin_home`.
- The root shell must continue offering safe logout through `/api/auth/logout`.
- global root users must continue seeing `Empresas` and not the tenant roles route.
- company-admin users with `companyId` must continue seeing explicit sidebar route items, with `Roles y permisos` and `Zonas` as the functional tenant-admin destinations and the remaining approved sidebar entries resolving to the shared neutral `in_process` view.
- the `#zones` view must continue using the existing company regions endpoints, keep searches local in memory, preserve the create-zone/create-subzone modal flows, and preserve the mobile consecutive list/detail interaction.
- the company-admin sidebar must keep hidden tooltips out of layout until collapsed hover/focus reveals them.
- the company-admin sidebar must keep overflow hardening in place: defensive box sizing, `min-width: 0` on nested wrappers, ellipsis for long labels/footer text, and a thin vertical scrollbar limited to the central scroll region.
- shell-owned global offsets and actor-specific furniture must remain outside individual views, while views keep ownership of their internal content layout only.
- Companies Admin must continue using only the existing root-company list/create/status endpoints.
- Roles/Permissions Admin must continue using only the existing permission list and company-role list/create endpoints.
- Zones must continue using only the existing company regions list/create and subregion-create endpoints.
- no role update, delete, reassignment, or legacy-page reactivation behavior is part of the supported runtime.
- Requests to deprecated legacy HTML routes under `/root/*.html`, `/warehouse/*.html`, and `/agent/*.html` must continue responding from the same URL with the common migration screen and HTTP `410 Gone`, without redirect.
- `/migration.html?mode=post-login-transition` must remain a supported 200 post-login landing for non-wave-one browser profiles.
- `legacy-public-runtime/` must remain outside the active runtime unless a later approved change explicitly redefines the supported surface.
- `/api/auth/login`, `/api/auth/me`, and `/api/auth/logout` must remain supported.
- `GET /health` must remain a backward-compatible liveness endpoint.
- `GET /health/ready` must continue reflecting both database readiness and browser-session-store readiness.
- Supported browser flows must not reintroduce persisted bearer tokens in `localStorage`.

## 14. Known defects
- `npm run build` can still fail locally on Windows with the pre-existing Prisma rename-lock `EPERM` issue during Prisma generate; however, `docs/prisma-windows-stability-evidence.md` now records the repository closeout verdict as `estabilizado con evidencia CI`, so the local failure remains documented as complementary diagnostic evidence rather than the active CI closeout verdict.
- Permission-governance hardening identified in `specs/p10-permission-governance/` remains only partially implemented, but the enforced scope has advanced: the centralized policy foundation, the stable `company.create` deny rule, and a first company-role deny rule now exist; company-role creation rejects platform-scoped permissions such as `companies.manage` before persistence, denied attempts can now emit dedicated service-level audit events through action `roles.company.create.governance_denied`, and other sensitive combinations still remain warning-only in success-path audit metadata.
- Denied company-role governance attempts are now recorded through the existing safe audit seam from the service-level denial path when request audit context is available; the dedicated action is `roles.company.create.governance_denied`, the recorded outcome is `REJECTED`, and metadata includes `governanceDecision`, `denialCode`, `ruleId`, `affectedPermissions`, `requestedPermissionCodes`, and `companyId`. This remains distinct from route-level authorization denial auditing and preserves the same `403` response contract.
- The supported post-login landing for non-wave-one roles remains transitional and informational (`/migration.html?mode=post-login-transition`), not a final functional destination.
- The Redis session store implementation uses a small raw-socket protocol client rather than a mature Redis library.
- Some passing tests can still emit expected operational logs, though the previously known incidental browser E2E audit-DB noise for the addressed suites has already been isolated through DB-free seams.
- `tests/public-surface-characterization.test.js` uses regex-based stylesheet characterization rather than screenshot diffs, so subtle per-browser pixel drift can still escape despite the stronger contract coverage.

## 15. Architectural debt
- The application remains layered without strict hexagonal separation.
- Service-layer responsibilities remain broad in several modules.
- API runtime, static public delivery, and governance concerns still coexist in the same deployable.
- Operational assurance still depends on synchronization across docs, validators, tests, README, env examples, compose files, and workflows.
- The root shell uses global browser objects and file-level script composition rather than module bundling or stronger client-side encapsulation, although the current `window.RootShell` registry plus modularity governance tests now provide a bounded containment seam.
- Company-admin sidebar behavior in `src/public/root/app.js` currently includes hardcoded group identifiers and UI-state assumptions (`inventory-group`, `sales-group`, route-specific checks), which is workable but brittle for future menu expansion even after layout ownership was normalized.
- The zones screen is still implemented as plain-script DOM orchestration in `src/public/root/views/zones-admin.js` and `zones-admin.helpers.js`; behavior is now covered by E2E plus isolated selection/filter and dialog/feedback characterization tests, but the view remains large and UI-stateful rather than decomposed into smaller modules.
- The browser-runtime `typecheck` baseline now includes the approved root-shell files through an explicit allowlist rather than a broad `src/public/**` expansion.
- A temporary compatibility bridge still exists at the legacy hyphenated coding-standards path; the authoritative coding-standards content now lives only at `docs/coding_standard.md` and drift is guarded by `tests/coding-standard-path-alignment.test.js`.
- `legacy-public-runtime/` remains in-repo as transitional backup/reference debt until equivalent SPA functionality is implemented and validated.

## 16. Security risks
Current architecture-facing security concerns still visible:
- supported non-test browser-session persistence depends on Redis availability and correct environment configuration;
- permission-governance warnings currently affect audit metadata and service decisions only; route-level authorization still primarily depends on existing role/policy middleware;
- browser-session issuance and validation fail explicitly with `503 service_unavailable` when Redis mode is configured but the store is unreachable, which is safer than silent downgrade but increases operational dependence on Redis uptime;
- universal `Secure` cookie enforcement still depends on HTTPS-capable deployment or trusted proxy signaling;
- mutating cookie-authenticated requests rely on same-origin `Origin` validation rather than a separate CSRF token;
- client-side root guards are UX guards only; backend APIs remain the authority for authorization.

## 17. Unknowns and assumptions
- This refresh did not execute commands directly; validation status is taken from the user-provided command results.
- No evidence in this refresh contradicts the implemented root shell, legacy-route `410` gate, or transition landing behavior.
- The preserved `legacy-public-runtime/` tree was verified as present in the repository, but it is outside supported runtime behavior because it is not served from `src/public/`.
- The current wave-one root shell eligibility is implemented in `src/public/root/guards.js` for `root` and `admin` with `companyId`; broader role eligibility remains future work.
- `p10-permission-governance` is complete as an analysis/planning package; after `p28`, its first runtime consumption slice exists, `p29` reconciled the stale planning metadata identified in repository docs/specs, `p30` implemented the approved company-role creation hardening slice, and `p32` added denial-path audit visibility for that same create-flow boundary. Future runtime hardening remains separate from that now-completed create-flow enforcement + denial-observability slice.
- no runtime company-role update flow currently exists, so update hardening remains deferred and is not documented as active behavior.