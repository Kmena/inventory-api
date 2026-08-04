# Current State

## 1. System overview
`inventory-api/` is a single-deployable Node.js 24 Express + Prisma application with REST APIs and an embedded browser runtime served by the same Express process.

Current browser/runtime and access-governance state verified from repository contents after `zones-view`, `sidebar-rebrand-permissions` `TASK-004`, `quality-baseline-recovery` `TASK-007`, `repository-baseline-score-recovery` `TASK-009`, together with `hotspot-seams-doc-ownership` `TASK-001` through `TASK-008`, `p38-root-shell-modularity-hardening`, `p37-root-spa-companies-roles-admin`, `root-shell-follow-up-alignment`, `root-shell-commercial-views`, and `root-shell-commercial-views-hardening`, building on `p36-bounded-doc-validator-ownership-alignment`, `p35-governance-baseline-sync-guardrails`, and `p34-bounded-governance-coverage-expansion`, and `p33-admin-authorization-governance-convergence`:
- the active public browser runtime under `src/public/` is intentionally small and now includes a supported root SPA shell entrypoint;
- supported public HTML documents are `/`, `/index.html`, `/no-access.html`, `/migration.html`, and the root shell entrypoint at `/root/` backed by `src/public/root/index.html`;
- the supported `/root/` shell now has two observable actor variants: global `root` users keep the existing top navigation, while `admin` users with `companyId` receive a rebranded administrative sidebar shell with explicit hash routes for visible menu items;
- supported shared browser assets include `styles.css`, `login.js`, `migration.js`, `no-access.js`, `shared/session.js`, `shared/auth.js`, and the root-shell assets under `src/public/root/**`;
- requests to legacy HTML routes under `/root/*.html`, `/warehouse/*.html`, and `/agent/*.html` are still intercepted before `express.static(...)` and respond with the shared migration screen and HTTP `410 Gone` from the same URL;
- the former functional legacy browser runtime remains preserved outside the active runtime in `legacy-public-runtime/` and is not served from `src/public/`;
- `legacy-public-runtime/` remains transitional backup/reference inventory while equivalent supported SPA capabilities are implemented and validated.

The backend JSON API, Prisma persistence, browser-session cookie model, health/readiness endpoints, and repository/workflow governance remain part of the same deployable. The remaining browser-session residual risk is still tracked explicitly as a follow-up dependency in `specs/p11-https-browser-session-migration/` and is not an in-slice blocker for the current bounded governance/documentation refreshes.

Repository-governance state verified in this refresh:
- the application still uses native `bcrypt` for password verification and password-hash generation, but the direct dependency baseline is now `bcrypt@^6.0.0`;
- the previously documented residual chain `bcrypt@5.1.1 -> @mapbox/node-pre-gyp@1.0.11 -> tar@6.2.1` is no longer present in the checked-in lockfile; the active bcrypt install path is `bcrypt@6.0.0 -> node-gyp-build@4.8.4`;
- dependency hygiene governance now enforces a zero-residual posture through `audit-baseline.json`, `docs/audit/dependency-hygiene-baseline.md`, `scripts/validate-dependency-hygiene.js`, and `tests/dependency-hygiene-governance.test.js`;
- `tests/bcrypt-supply-chain-closeout.test.js` now freezes stored-hash compatibility plus current user/company/seed hash-generation behavior under the upgraded bcrypt runtime;
- Docker-specific validation for the bcrypt native-module refresh has now been rerun successfully: `inventory-api/Dockerfile` builds, in-container bcrypt fixture/new-hash smoke passes, and container startup reaches `GET /health` successfully under documented runtime configuration; this is not documented as a remaining repository vulnerability;
- `scripts/run-tests.js` is the official aggregate test runner behind `npm run test`;
- `scripts/run-eslint.js` and `scripts/run-tsc.js` are the supported local wrapper entrypoints behind `npm run lint:public-runtime` and `npm run typecheck`, so the intended local Windows workflow no longer depends on shell-exposed `eslint` or `tsc` shims;
- canonical runtime-contract governance lives under `docs/**`;
- `docs/coding_standard.md` is now the canonical coding-standards body, while the legacy hyphenated alias remains only as a compatibility bridge for older references;
- bounded evidence for the `p33` admin-governance seam now also covers `src/security/access-policies.js` in typecheck and keeps the reviewed partial OpenAPI/matrix focused on the selected governance-admin endpoints only;
- `tests/governance-baseline-sync-guardrails.test.js` now acts as the focused documentation-sync guardrail for the selected post-`p34` governance statements only; it does not imply repository-wide documentation convergence;
- `docs/permission-governance-decisions.md` now exists as an explainer for the completed `p10-permission-governance` analysis outputs, while the active runtime foundation lives in `src/security/permission-governance.config.js`, `src/security/role-bundles.config.js`, and `src/security/permission-governance.service.js`; `p30-company-role-governance-hardening` extended that foundation so company-role creation now rejects platform-scoped permissions such as `companies.manage` before persistence, and `p32-governance-denial-audit-visibility` added a dedicated service-level denial audit action for that denied path;
- `internal-docs/**` remains auxiliary repository material only, while the in-scope runtime-contract governance validators now consume canonical `docs/**` artifacts and do not rely on auxiliary `internal-docs/**` runtime-contract copies for authority;
- `docs/documentation-ownership-map.md` is the compact classification reference for canonical, auxiliary, historical/compatibility, and auto-validated repository artifacts, including the current workflow source-of-truth and seam ownership examples;
- `hotspot-seams-doc-ownership` tasks 1-8 are now reflected in the implemented structure: `src/security/access-policies.js` remains the stable facade while policy registry, actor-scope checks, and denial-audit behavior now live in `src/security/access-policy-registry.js`, `src/security/access-policy-actor-scope.js`, and `src/security/access-policy-audit.js`;
- agent workspace routes now also use the centralized access-policy facade explicitly at the route boundary through the `agent.workspace.access` policy, preserving the existing commercial-agent token contract while making the protection convergent with other guarded modules; `/api/agent/**` now enforces a `permission-plus-actor-scope` boundary that allows `sales_agent` or equivalent commercial-agent tokens with `companyId`, `sub`, `sales.orders.create`, `sales.routes.view.own`, and `customer.activities.manage`, while still denying supervisor/global variants such as `sales_supervisor`, `sales.routes.view.all`, and `sales.routes.assign`;
- `docs/prisma-windows-stability-evidence.md` now distinguishes the hosted Windows closeout verdict (`estabilizado con evidencia CI`) from the developer-local Windows operating baseline (`residual gobernado` when `windows_rename_lock` still reproduces locally), so CI closure is no longer treated as equivalent to universal local stability;
- the same hardening slice also introduced focused service seams at `src/services/inventory-alerts.service.js`, `src/services/agent-workspace-store-state.service.js`, `src/services/product-permission-shaping.service.js`, and `src/services/product-pricing.service.js` without changing the public API surface;
- the validation/documentation closure for that slice is also now reflected: the governance baseline sync guardrail passed, coding-standard path alignment passed, lint passed, typecheck passed, and the aggregate suite passed in the intended memory browser-session mode (`BROWSER_SESSION_STORE_MODE=memory`);
- `tests/root-shell-commercial-views.e2e.js` now provides browser-level regression coverage for the supported `#agents`, `#clients`, and `#routes` shell flows, including visible headings/content, dialog open-close behavior, active-selection/detail assertions, representative create/update/assignment saves, local in-memory filtering, taxpayer lookup contract assertions, and lightweight route-map rendering assertions;
- the repository keeps an explicit Redis-path validation lane through `npm run test:redis-path` and the parent-root hosted workflow `../.github/workflows/redis-browser-session-tests.yml` relative to `inventory-api/`;
- `/health/ready` depends on both database readiness and browser-session-store readiness.

## 2. Repository structure
High-signal paths verified in this refresh:
- repository root: parent-root `.github/workflows/` plus the `inventory-api/` application directory
- authoritative hosted workflow location for local validators/tests: `../.github/workflows/` relative to `inventory-api/`; `inventory-api/.github/workflows/` is not the current authoritative workflow source
- application root: `inventory-api/package.json`, `inventory-api/Dockerfile`, `inventory-api/src/`, `inventory-api/prisma/`, `inventory-api/scripts/`, `inventory-api/tests/`, `inventory-api/docs/`, `inventory-api/internal-docs/`, `inventory-api/README.md`
- canonical coding-standards document: `inventory-api/docs/coding_standard.md`
- canonical documentation ownership map: `inventory-api/docs/documentation-ownership-map.md`
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
- `root/runtime-contract.js`
- `root/manifest.js`
- `root/session-adapter.js`
- `root/ui.js`
- `root/companies-api.js`
- `root/roles-api.js`
- `root/zones-api.js`
- `root/agents-api.js`
- `root/clients-api.js`
- `root/routes-api.js`
- `root/views/home.js`
- `root/views/in-process.js`
- `root/views/companies-admin.js`
- `root/views/roles-admin.js`
- `root/views/zones-admin.helpers.js`
- `root/views/zones-admin.js`
- `root/views/agents-admin.helpers.js`
- `root/views/agents-admin.js`
- `root/views/agents-admin.renderers.js`
- `root/views/clients-admin.helpers.js`
- `root/views/clients-admin.js`
- `root/views/clients-admin.renderers.js`
- `root/views/clients-admin.state.js`
- `root/views/routes-admin.helpers.js`
- `root/views/routes-admin.js`
- `root/views/routes-admin.renderers.js`
- `root/views/routes-admin.state.js`
- `root/registry.js`

Observed preserved legacy inventory outside runtime:
- `legacy-public-runtime/root/**`
- `legacy-public-runtime/warehouse/**`
- `legacy-public-runtime/agent/**`
- `legacy-public-runtime/shared/lot-dates.js`

## 3. Current architecture
Current implemented architecture remains layered rather than hexagonal:
- auth/password flows remain service-layer consumers of native `bcrypt`; no auth API, browser-session, or persistence architecture was redesigned during the bcrypt closeout;
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
- an explicit `src/public/root/runtime-contract.js` loader contract that enumerates the approved shared helpers, root-shell scripts, RootShell registrations, and the minimal provider-before-consumer script expectations enforced by the validator and governance tests;
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
- a company-admin Agents view at `#agents` that composes users, company roles, and sales-route overview data to show commercial users, assigned routes, visible goals, and route-assignment updates from an agent-centric screen;
- a company-admin Clients view at `#clients` backed by the existing client, classification, document-type, regions, taxpayer, and economic-activity endpoints, with list/detail behavior in the same shell plus create, update, deactivate, store, document, reference, lookup, and download actions;
- a company-admin Routes view at `#routes` backed by the existing sales-route and regions contracts, with overview metrics, route definition editing, subzone assignment, agent assignment, per-agent goal editing, covered-store lists, and a simplified SVG map derived from store coordinates;
- an expanded company-admin information architecture rendered from `root/manifest.js`, grouped into `Inicio`, `Operacion`, `Control`, and `Administracion`, where `#admin_home`, `#products`, `#lots`, `#movements`, `#production`, `#purchases`, `#warehouses`, `#approvals`, `#reports`, `#users`, and `#settings` still resolve to the shared neutral `in_process` view, while `#agents`, `#routes`, `#zones`, `#clients`, and `#roles_permissions` are functional tenant-admin routes;
- the `#zones` view currently implements local in-memory search for zones and subzones, manual refresh, create-zone and create-subzone dialogs, toast feedback, temporary subzone highlight after creation, and a mobile consecutive list/detail flow. `src/public/root/views/zones-admin.helpers.js` now owns small seams for selection/filter logic plus dialog/form support such as reset, inline field-error rendering, and submit-button state, while the main async UI orchestration remains concentrated in `src/public/root/views/zones-admin.js`;
- the `#agents` view keeps helper-owned commercial-role filtering and dataset composition in `src/public/root/views/agents-admin.helpers.js`, now delegates list/detail/assignment rendering to `src/public/root/views/agents-admin.renderers.js`, and keeps DOM orchestration, metrics, modal create flow, and route-assignment interactions in `agents-admin.js` over `agents-api.js`;
- the `#clients` view keeps helper-owned local filters and payload shaping in `src/public/root/views/clients-admin.helpers.js`, delegates detail/list rendering to `src/public/root/views/clients-admin.renderers.js`, delegates zone-option and selected-client summary state to `src/public/root/views/clients-admin.state.js`, and keeps DOM orchestration plus create/update/deactivate, append-only store/document/reference actions, taxpayer lookup, and document download behavior in `clients-admin.js` over `clients-api.js`;
- the `#routes` view keeps helper-owned local search, route-payload shaping, goal replace-all payload shaping, and simplified map projection in `src/public/root/views/routes-admin.helpers.js`, delegates detail/map rendering to `src/public/root/views/routes-admin.renderers.js`, delegates selected-route and goal-row state helpers to `src/public/root/views/routes-admin.state.js`, and keeps DOM orchestration and save flows in `routes-admin.js` over `routes-api.js`;
- `src/public/root/app.js` now resolves its bootstrap module set and manifest validation through `runtime-contract.js` instead of duplicating that inventory inline, keeping the entrypoint narrower while preserving the current hash-route behavior;
- `tests/root-shell-modularity-governance.test.js` now verifies both the bounded `window.RootShell` registry contract and the explicit loader contract baseline, while `scripts/validate-public-runtime.js` fails on missing, extra, or misordered approved shell scripts.

The legacy browser HTML pages are not an active runtime module even though their files remain preserved under `legacy-public-runtime/`.

## 4. Existing domains and modules
Observable current runtime and governance areas:
- Authentication and authorization
  - stable access-policy facade in `src/security/access-policies.js`
  - extracted access-policy registry, actor-scope, and denial-audit seams in `src/security/access-policy-*.js`
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
  - company-admin roles/permissions, zones, agents, clients, and routes views
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
- render actor-aware shell navigation so global root users keep top navigation with `Empresas`, while company admins get a rebranded sidebar with grouped tenant-admin navigation, `#admin_home` as the default landing when no hash is present, and `Roles y permisos`, `Zonas`, `Agentes`, `Clientes`, and `Rutas` as the functional sidebar destinations today;
- let a global root user load companies from `GET /api/companies/root/companies`;
- let a global root user create companies from the shell through `POST /api/companies/root/companies`;
- let a global root user toggle company active status from the shell through `PATCH /api/companies/root/companies/:companyId/status`;
- let a company-admin user load assignable permissions from `GET /api/roles/permissions`;
- let a company-admin user load company roles from `GET /api/roles/company`;
- let a company-admin user create company roles from the shell through `POST /api/roles/company`;
- let a company-admin user load zones from `GET /api/regions/company`, create zones through `POST /api/regions/company`, and create subzones through `POST /api/regions/company/:regionId/subregions` from `#zones`;
- let a company-admin user use `#agents` to load company users, company roles, and the sales-route overview, compose a commercial-user dataset client-side, create company users through `POST /api/users/company`, and persist route assignments through `PUT /api/sales-routes/company/:routeId/assignments` from an agent-centric workflow;
- let a company-admin user use `#clients` to list clients, open in-shell detail, create and update clients, deactivate clients, add stores, upload private documents, create references, run taxpayer lookup, list economic activities, and download documents through the existing `/api/clients/**`, `/api/regions/company`, `/api/taxpayers/lookup?identification=...`, and `/api/economic-activities` endpoints;
- let a company-admin user use `#routes` to list routes, open route detail, create routes, update definition, save subzones, save agent assignments, and save per-agent goals through the existing `/api/sales-routes/company**` contracts while rendering covered stores and a simplified coordinate-based map in the shell;
- keep role/permission administration bounded to list/create only; no runtime role edit/delete/reassignment UI is implemented;
- serve the supported fallback documents `/no-access.html` and `/migration.html`;
- send non-wave-one authenticated browser users such as warehouse and operational agent profiles to `/migration.html?mode=post-login-transition`;
- respond to direct legacy HTML requests such as `/root/dashboard.html`, `/warehouse/products.html`, or `/agent/workspace.html` with the shared migration screen and HTTP `410 Gone` without redirect;
- answer `GET /health` with a backward-compatible liveness payload;
- answer `GET /health/ready` with database and browser-session-store dependency state, returning `503` when Prisma readiness fails or when the configured Redis session store is down;
- serve JSON APIs for companies, roles, users, clients, products, orders, invoices, payments, inventory, warehouses, regions, sales routes, agent workflows, taxpayers, geocoding, and economic activities;
- enforce that only a global `root` actor (`role === 'root'` and no `companyId`) can create companies through a bounded converged contract: the company admin routes now declare explicit global-root actor scope in `src/security/access-policies.js`, while the current governance service + company service boundary still preserves the sensitive business check;
- create company-scoped custom roles while rejecting platform-scoped permissions such as `companies.manage`, preserving current warning-only posture for non-approved sensitive combinations, recording governance warnings in audit metadata for successful allow/warn flows, and emitting dedicated service-level denial audit attempts with action `roles.company.create.governance_denied` when the enforced deny path is hit and request audit context exists;
- update products through a company-scoped repository mutation helper inside the existing transaction flow instead of relying on a raw bare-id final write;
- update inventory-linked product stock totals through a company-scoped repository helper that receives both `id` and `companyId`;
- list orders with a compatibility-preserving dual contract: legacy array responses when `page` / `pageSize` are absent and `{ items, pagination }` responses when pagination params are supplied;
- protect invoice routes through canonical `authorizeAccessPolicy(...)` mappings rather than the older coarse route middleware;
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
8. `root/router.js` resolves the hash route against explicit manifest items. Global root routes remain `home` and `companies`. Company-admin routes include `admin_home`, `products`, `lots`, `movements`, `production`, `agents`, `routes`, `zones`, `clients`, `purchases`, `warehouses`, `approvals`, `reports`, `users`, `roles_permissions`, and `settings`, with missing or unauthorized hashes falling back to the first accessible route; the current functional company-admin routes are `roles_permissions`, `zones`, `agents`, `clients`, and `routes`, while the remaining company-admin routes render the shared neutral `in_process` view.
8.1. For company-admin sessions with no hash present, the first accessible route is `#admin_home`.
8.2. Root-shell modules publish and consume internal dependencies through `window.RootShell` instead of many unrelated top-level `window.RootShell*` globals.
9. `companies-admin.js` mounts root-company list/create/status behavior through `companies-api.js` for global root sessions.
10. `roles-admin.js` mounts permission/role list/create behavior through `roles-api.js` for company-admin sessions with `companyId`.
10.1. `zones-admin.js` mounts the zones/subzones master-detail workflow through `zones-api.js`, using local filtering in memory and reloading from the server only for initial load, explicit refresh, and successful create actions; selection/filter behavior and small dialog/form seams now flow through `zones-admin.helpers.js`, including reset, inline error rendering, and submit-button state helpers.
10.2. `agents-admin.js` mounts a two-panel commercial-user workflow through `agents-api.js`, using helper-owned dataset composition/filtering plus `agents-admin.renderers.js` for list/detail/assignment rendering, and it tolerates partial degradation when roles or route overview requests fail.
10.3. `clients-admin.js` mounts a list/detail client workspace through `clients-api.js`, using helper-owned local filters and payload shaping, `clients-admin.renderers.js` for list/detail rendering, and `clients-admin.state.js` for selected-client and summary resolution while keeping client creation, update, and append-only related actions inside the supported shell workspace.
10.4. `routes-admin.js` mounts route overview/detail workflows through `routes-api.js`, using helper-owned local search, payload shaping, and map projection helpers plus `routes-admin.renderers.js` and `routes-admin.state.js` for detail/map/goal-row rendering state while treating per-agent goals as replace-all saves.
11. Logout uses the shared auth helper and returns the browser to login.

### API flow
1. Express receives `/api/*` requests.
2. Middleware performs logging, request context, throttling, validation, authentication, and authorization as applicable.
3. Routes call services.
4. Services call repositories and Prisma-backed persistence.
5. Product update reads tenant-scoped state first and now performs the final write through `product.repository.updateProduct(id, companyId, data, tx)`.
6. Inventory stock-entry orchestration updates product stock totals through `inventory.repository.updateProductById(id, companyId, data, tx)` so the final mutation remains tenant-scoped.
7. `GET /api/orders` preserves the legacy array response unless pagination params are present, in which case the service returns `{ items, pagination }`.
8. Responses return JSON errors or data.

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
- company-scoped product mutation helpers now use scoped `updateMany(...)` plus follow-up `findFirst(...)` reads on supported product/inventory write paths so tenant scope is preserved at the final mutation boundary.
- `p27-root-initial-spa-shell`, `p28-flexible-permission-governance-foundation`, `p30-company-role-governance-hardening`, and `p32-governance-denial-audit-visibility` introduced no database schema or migration changes.

## 8. APIs and integrations
Current observable interfaces:
- REST-style endpoints under `/api/*`
- health endpoints under `/health/*`
- static runtime served from `/`
- GitHub Actions as repository-governance integration
- canonical runtime-contract artifacts under `docs/**`, including the runtime-contract manifest and reviewed OpenAPI baseline consumed by the bounded legacy governance validator
- canonical workflow authority under `../.github/workflows/**` relative to `inventory-api/`, with ownership expectations summarized in `docs/documentation-ownership-map.md`

Relevant public-surface behavior now in effect:
- `/api/auth/login`, `/api/auth/me`, and `/api/auth/logout` remain supported and are outside the HTML deprecation scope;
- `/root/` is a supported authenticated browser entrypoint for the actor-aware root shell;
- the current shell contract includes a split UI model in the same document: root-global top navigation and company-admin sidebar navigation with explicit sidebar hash routes;
- root-shell API consumption now includes `GET /api/companies/root/companies`, `POST /api/companies/root/companies`, `PATCH /api/companies/root/companies/:companyId/status`, `GET /api/roles/permissions`, `GET /api/roles/company`, `POST /api/roles/company`, `GET /api/regions/company`, `POST /api/regions/company`, `POST /api/regions/company/:regionId/subregions`, `GET /api/users/company`, `POST /api/users/company`, `GET /api/sales-routes/company`, `GET /api/sales-routes/company/:routeId`, `POST /api/sales-routes/company`, `PUT /api/sales-routes/company/:routeId`, `PUT /api/sales-routes/company/:routeId/subzones`, `PUT /api/sales-routes/company/:routeId/assignments`, `PUT /api/sales-routes/company/agents/:userId/goals`, `GET /api/clients/company`, `POST /api/clients/company`, `PUT /api/clients/:id`, `DELETE /api/clients/:id`, `POST /api/clients/company/:clientId/stores`, `POST /api/clients/:clientId/documents`, `POST /api/clients/:clientId/references`, `GET /api/clients/:clientId/documents/:documentId/download`, `GET /api/clients/classifications/company`, `GET /api/clients/document-types`, `GET /api/taxpayers/lookup?identification=...`, and `GET /api/economic-activities`;
- `POST /api/auth/logout` remains part of the governed runtime-contract inventory;
- `GET /api/orders` preserves the legacy array contract when pagination params are absent and returns `{ items, pagination }` only when `page` or `pageSize` is supplied;
- legacy HTML paths are not redirected to new routes; they return `410 Gone` from the same URL;
- `legacy-public-runtime/` is a repository artifact, not a served integration surface.

## 9. Authentication and authorization
Current observable behavior:
- login remains public;
- authenticated APIs use middleware-based authentication;
- authorization remains middleware/policy based;
- role/permission governance remains hybrid in runtime code: `src/security/access-policies.js` is still the stable authorization facade and central policy entrypoint, but declarative policy data, actor-scope checks, and route-level denial-audit behavior are now split into focused helper modules under `src/security/access-policy-*.js`; the repository also contains a centralized permission-governance foundation used by services for governed-operation evaluation;
- a bounded route-policy convergence seam now exists for the highest-signal company/company-role admin flows and the agent workspace routes: company list/create and root-company list/create policies declare explicit `global-root` actor scope, company-role list/create policies declare explicit `company-admin` actor scope, and agent workspace routes now declare explicit `agent-workspace-user` actor scope before the downstream service-layer checks run;
- the planning/governance analysis package for this area is documented in `specs/p10-permission-governance/`, `docs/permission-governance-decisions.md` summarizes the recommended governance model, `p28` implemented the first runtime slice with a central policy model, reusable warning contract, and stable `company.create` deny rule for non-global-root actors, `p30` added enforced company-role creation denial for platform-scoped permissions, and `p32` added dedicated service-level denial audit visibility for that approved deny path;
- `tests/access-policies.test.js` and `tests/authorization-convergence-characterization.test.js` now freeze current access-policy behavior for strict policy lookup, actor-scope inventories, actor-scope denial audit metadata, and selected route-policy mappings without changing runtime authorization semantics;
- browser login can request a backend-owned browser session by sending `X-Inventory-Browser-Session: cookie` to `/api/auth/login`;
- supported embedded browser flows use the cookie pair `inventory_browser_session` + `inventory_browser_state` instead of persisted bearer tokens in `localStorage`;
- `shared/session.js` and `shared/auth.js` remain the active browser helper seam for supported public pages;
- `/api/auth/me` returns the browser-session user projection and refreshes cookies for cookie-authenticated browser requests;
- `/api/auth/logout` invalidates the backend-owned browser session and clears both browser cookies;
- mutating cookie-authenticated requests enforce same-origin `Origin` validation in `authenticate.js`.
- invoice routes now use canonical `authorizeAccessPolicy(...)` mappings for list/detail/create/update/delete and inconsistency access.
- JWT verification now accepts only the app's explicit signing algorithm allowlist from `src/lib/auth.js`.
- supported public and root documents now use same-origin CSP without the previously unused CDN allowances.
- HSTS is not emitted by the app today and remains intentionally deferred because deployment, TLS-termination, and trusted-proxy assumptions are not yet standardized in-repo.
- Any future HSTS work is limited to conditional enablement only, requires `TRUST_PROXY` to be treated as an explicit deployment input before proxied enablement, and keeps `preload` out of scope.

Current post-login behavior in code:
- `src/public/login.js` routes `root` users and `admin` users with `companyId` to `/root/`;
- inside `/root/`, `src/public/root/guards.js` restricts shell eligibility to those same two actor types;
- inside `/root/`, `src/public/root/registry.js` centralizes shell dependency registration and lookup while preserving the existing plain-script delivery model;
- inside the shell, navigation visibility is actor-aware: global `root` users keep the top-nav experience and can access `#home` and `#companies`, while company `admin` users with `companyId` receive the rebranded grouped sidebar with `#admin_home` as the default landing, explicit placeholder routes for the approved sidebar IA, and functional access to `#roles_permissions`, `#zones`, `#agents`, `#clients`, and `#routes`;
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
- `docker-compose.prod.yml` no longer publishes the Postgres port to the host; DB access in the versioned production baseline is internal to the Docker stack and `docker compose exec` workflows
- root official workflows use Node 24 and execute in `inventory-api/`

## 12. Current testing strategy
This refresh did not execute commands directly. Validation status is taken from the user-provided post-implementation evidence.

Current repository-wide testing posture includes:
- `scripts/run-tests.js` as the official aggregate test runner behind `npm run test`;
- deterministic default test bootstrap via `NODE_ENV=test` and `BROWSER_SESSION_STORE_MODE=memory` unless explicitly overridden;
- a dedicated non-default Redis-path validation command at `npm run test:redis-path`;
- targeted governance and characterization suites for browser/runtime, contract coverage, authorization, audit instrumentation, integrations, repository policies, and the current inventory, agent-workspace, and product hotspot seams;
- focused browser/runtime validation through `scripts/validate-public-runtime.js` and related tests.
- targeted due-diligence validation now also includes product/inventory hotspot, order pagination/lifecycle, access-policy, authorization convergence, auth hardening, lot datetime, and production-baseline characterization coverage for the implemented remediation slice.

The active browser/runtime governance now relies on:
- `scripts/validate-public-runtime.js`
- `tests/public-surface-characterization.test.js`
- `tests/public-runtime-http-smoke.test.js`
- `tests/browser-runtime-auth-convergence-inventory.test.js`
- `tests/browser-auth-compatibility-inventory.test.js`
- `tests/root-shell-route-governance.test.js`
- `tests/root-shell-router-characterization.test.js`
- `tests/root-shell-modularity-governance.test.js`
- `tests/agents-view-characterization.test.js`
- `tests/clients-view-characterization.test.js`
- `tests/routes-view-characterization.test.js`
- `tests/browser-e2e.e2e.js`
- `tests/zones-view-selection-filters-characterization.test.js`
- `tests/zones-view-dialog-feedback-characterization.test.js`
- `tests/zones-view.e2e.js`
- `docs/test-suite-catalog.md`
- `tests/coding-standard-path-alignment.test.js`

The active permission-governance foundation now also relies on:
- `tests/permission-governance-foundation.test.js`
- `tests/permission-governance-backend-consumption.test.js`
- `tests/documentation-ownership-governance.test.js` for the documentation ownership map and canonical workflow/documentation references introduced by `hotspot-seams-doc-ownership`

The current inventory hotspot characterization baseline now also relies on:
- `tests/inventory-service-hotspot-characterization.test.js`
- characterization of paginated movement/list response seams
- characterization of inventory-alert conflict handling when an alert disappears before update
- characterization of `updateLotQa` side effects inside the repository transaction boundary
- characterization of `registerStockEntry` transaction propagation across context load, advisory lock, and persistence operations

The current agent-workspace hotspot characterization baseline now also relies on:
- `tests/agent-workspace-hotspot-characterization.test.js`
- characterization of tenant-scoped store filtering and status-first sorting for route-covered stores
- characterization of store summary/status serialization for agent-visible store lists
- characterization of order-payload coercion and delegation after covered-store and sellable-inventory checks

The current product hotspot characterization baseline now also relies on:
- `tests/product-service-hotspot-characterization.test.js`
- characterization of transaction-scoped `createProduct` ownership through the repository transaction callback
- characterization of derived lot-usability decoration on created product responses
- characterization of import-time category-cache reuse and tenant inventory lookup
- characterization of import-time inventory registration coupling for newly created imported products

The current access-policy hotspot characterization baseline now also relies on:
- `tests/access-policies.test.js`
- `tests/authorization-convergence-characterization.test.js`
- characterization of unknown-policy failure behavior
- characterization of `global-root`, `company-admin`, and `agent-workspace-user` actor-scope inventories
- characterization of route-level actor-scope denial audit metadata
- characterization of current route-policy mappings across selected administrative, product, inventory, warehouse, and sales-route guards

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

Additional requester-supplied validation evidence for `repository-baseline-score-recovery` `TASK-007`:
- `node --test tests/inventory-service-hotspot-characterization.test.js tests/inventory-alerts-tenant-scope.test.js tests/approval-baseline-compatibility.test.js` ✅
- `npm run test -- --silent` ✅ (`2 skipped` expected environment-gated suites)
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run lint:public-runtime` ✅

Additional requester-supplied validation evidence for `repository-baseline-score-recovery` `TASK-008`:
- `node --test tests/agent-workspace-hotspot-characterization.test.js tests/product-service-hotspot-characterization.test.js` ✅
- `npm run test -- --silent` ✅
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run build` ✅

Additional requester-supplied validation evidence for `repository-baseline-score-recovery` `TASK-009`:
- `set NODE_ENV=test&& set BROWSER_SESSION_STORE_MODE=memory&& node --test tests/access-policies.test.js tests/administrative-authorization-characterization.test.js tests/authorization-convergence-characterization.test.js` ✅
- `npm run test -- --silent` ✅ (`2 skipped` expected environment-gated suites)
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run build` ✅

Additional requester-supplied validation evidence for `hotspot-seams-doc-ownership` tasks 1-8:
- `node --test tests/governance-baseline-sync-guardrails.test.js` ✅
- `node --test tests/coding-standard-path-alignment.test.js` ✅
- `npm run lint` ✅
- `npm run typecheck` ✅
- targeted access-policy / inventory / agent-workspace / product / documentation suites passed ✅
- `npm run validate:workflow-baseline` ✅
- `set BROWSER_SESSION_STORE_MODE=memory && npm run test -- --silent` ✅
- baseline audit rerun: `7.4/10`, verdict `Acceptable`, no regressions observed ✅
- `npm run build` remains intermittently unstable on Windows because Prisma generate can hit a rename-lock `EPERM` ⚠️

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

Additional requester-supplied validation evidence for `root-shell-commercial-views`:
- `npm run validate:public-runtime` ✅
- `node --test tests/root-shell-route-governance.test.js` ✅
- `node --test tests/root-shell-router-characterization.test.js` ✅
- `node --test tests/public-surface-characterization.test.js` ✅
- `node --test tests/agents-view-characterization.test.js` ✅
- `node --test tests/clients-view-characterization.test.js` ✅
- `node --test tests/routes-view-characterization.test.js` ✅
- `node --test tests/public-runtime-http-smoke.test.js tests/prisma-client-baseline-characterization.test.js tests/public-surface-characterization.test.js tests/typecheck-ci-hardening-governance.test.js` ✅
- `npm run lint:public-runtime` ✅
- `npm run typecheck` ✅
- `node --test tests/root-shell-commercial-views.e2e.js` ✅

Additional requester-supplied validation evidence for `root-shell-commercial-views-hardening`:
- `node --test tests/agents-view-characterization.test.js tests/clients-view-characterization.test.js tests/routes-view-characterization.test.js tests/root-shell-modularity-governance.test.js` ✅
- `node --test tests/public-surface-characterization.test.js tests/public-runtime-http-smoke.test.js tests/typecheck-ci-hardening-governance.test.js` ✅
- `node --test tests/root-shell-commercial-views.e2e.js` ✅
- `node --test tests/payment-tenant-scope.test.js tests/invoice-payment-sync-characterization.test.js tests/pagination.test.js tests/payment-receipt-security.test.js tests/audit-instrumentation.test.js` ✅
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run build` ✅
- `npm run validate:public-runtime` ✅

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
- company-admin users with `companyId` must continue seeing explicit sidebar route items, with `Roles y permisos`, `Zonas`, `Agentes`, `Clientes`, and `Rutas` as the functional tenant-admin destinations and the remaining approved sidebar entries resolving to the shared neutral `in_process` view.
- the `#zones` view must continue using the existing company regions endpoints, keep searches local in memory, preserve the create-zone/create-subzone modal flows, and preserve the mobile consecutive list/detail interaction.
- the `#agents` view must continue composing its dataset from `GET /api/users/company`, `GET /api/roles/company`, and `GET /api/sales-routes/company`, preserve local search/group filtering, preserve company-user creation through `POST /api/users/company`, and preserve route-assignment persistence through the existing sales-route assignment endpoint.
- the `#clients` view must continue keeping client detail inside the supported shell, preserve local search/classification/status filtering, preserve create/update/deactivate behavior, and preserve append-only store/document/reference actions over the existing backend contracts.
- the `#routes` view must continue preserving overview metrics, route definition editing, subzone/agent save flows, replace-all per-agent goals saves, covered-store rendering, and simplified map rendering without introducing a new mapping dependency.
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
- `npm run build` can still fail locally on Windows with the pre-existing Prisma rename-lock `EPERM` issue during Prisma generate; however, `docs/prisma-windows-stability-evidence.md` now records the hosted repository closeout verdict as `estabilizado con evidencia CI` while explicitly classifying the developer-local Windows operating baseline as `residual gobernado` when `windows_rename_lock` still reproduces.
- The current Windows wrapper/workflow baseline still has open diagnostic gaps: it classifies retryable rename-lock failures, preserves the real exit code, and now writes a minimal latest-run diagnostics report under `logs/prisma-generate-last-run.json`, but it does not yet identify the locking local process or capture richer process-attribution evidence.
- The full `hotspot-seams-doc-ownership` validation matrix closes only for the documented memory-session aggregate lane; the Windows Prisma rename-lock remains an external environment/platform defect rather than a feature regression.
- Permission-governance hardening identified in `specs/p10-permission-governance/` remains only partially implemented, but the enforced scope has advanced: the centralized policy foundation, the stable `company.create` deny rule, and a first company-role deny rule now exist; company-role creation rejects platform-scoped permissions such as `companies.manage` before persistence, denied attempts can now emit dedicated service-level audit events through action `roles.company.create.governance_denied`, and other sensitive combinations still remain warning-only in success-path audit metadata.
- Denied company-role governance attempts are now recorded through the existing safe audit seam from the service-level denial path when request audit context is available; the dedicated action is `roles.company.create.governance_denied`, the recorded outcome is `REJECTED`, and metadata includes `governanceDecision`, `denialCode`, `ruleId`, `affectedPermissions`, `requestedPermissionCodes`, and `companyId`. This remains distinct from route-level authorization denial auditing and preserves the same `403` response contract.
- `src/services/agent-workspace.service.js` and `src/services/product.service.js` remain large orchestration hotspots with mixed coordination, filtering/serialization, and cross-service transaction responsibilities, although focused seams now exist in `agent-workspace-store-state.service.js`, `product-permission-shaping.service.js`, and `product-pricing.service.js`.
- `src/security/access-policies.js` remains a centralized authorization facade and policy entrypoint, but the registry, actor-scope, and denial-audit responsibilities are now split into dedicated modules; agent workspace routes now consume that same facade explicitly, while order routes still intentionally preserve a mixed baseline of permission-governed draft mutations and role-governed legacy operations.
- The supported post-login landing for non-wave-one roles remains transitional and informational (`/migration.html?mode=post-login-transition`), not a final functional destination.
- The Redis session store implementation uses a small raw-socket protocol client rather than a mature Redis library.
- Some passing tests can still emit expected operational logs, though the previously known incidental browser E2E audit-DB noise for the addressed suites has already been isolated through DB-free seams.
- Authorization characterization tests can still pass while emitting expected `audit_record_failed` console noise when denied-path audit persistence cannot reach `db:5432`; this is currently diagnostic noise, not by itself a guard regression.
- `tests/public-surface-characterization.test.js` uses regex-based stylesheet characterization rather than screenshot diffs, so subtle per-browser pixel drift can still escape despite the stronger contract coverage.

## 15. Architectural debt
- The application remains layered without strict hexagonal separation.
- Service-layer responsibilities remain broad in several modules.
- `src/services/inventory.service.js`, `src/services/agent-workspace.service.js`, and `src/services/product.service.js` remain characterization-protected hotspots, but they now delegate some cohesive behavior to `inventory-alerts.service.js`, `agent-workspace-store-state.service.js`, `product-permission-shaping.service.js`, and `product-pricing.service.js`.
- API runtime, static public delivery, and governance concerns still coexist in the same deployable.
- Operational assurance still depends on synchronization across docs, validators, tests, README, env examples, compose files, and workflows.
- The root shell still uses global browser objects and ordered file-level script composition rather than module bundling or stronger client-side encapsulation, although the current `window.RootShell` registry, explicit `runtime-contract.js` loader contract, and modularity governance tests now provide a bounded containment seam.
- Company-admin sidebar behavior in `src/public/root/app.js` currently includes hardcoded group identifiers and UI-state assumptions (`inventory-group`, `sales-group`, route-specific checks), which is workable but brittle for future menu expansion even after layout ownership was normalized.
- The zones screen is still implemented as plain-script DOM orchestration in `src/public/root/views/zones-admin.js` and `zones-admin.helpers.js`; behavior is now covered by E2E plus isolated selection/filter and dialog/feedback characterization tests, but the view remains large and UI-stateful rather than decomposed into smaller modules.
- The commercial root-shell screens are still plain-script DOM controllers with large mount functions in `agents-admin.js`, `clients-admin.js`, and `routes-admin.js`; maintainability improved because renderer/state seams now own list/detail/map/summary rendering and selection state concerns, but the main orchestration remains controller-centric rather than decomposed into fuller application/use-case boundaries.
- The browser-runtime `typecheck` baseline now includes the approved root-shell files through an explicit allowlist rather than a broad `src/public/**` expansion.
- A temporary compatibility bridge still exists at the legacy hyphenated coding-standards path; the authoritative coding-standards content now lives only at `docs/coding_standard.md` and drift is guarded by `tests/coding-standard-path-alignment.test.js`.
- `legacy-public-runtime/` remains in-repo as transitional backup/reference debt until equivalent SPA functionality is implemented and validated.

## 16. Security risks
- the previously approved bcrypt supply-chain residual is now closed: the checked-in dependency tree no longer includes the `@mapbox/node-pre-gyp` / `tar` auth install chain and the current audit baseline records `0` vulnerabilities;
- native-module operational risk still exists because `bcrypt@6.0.0` resolves through `node-gyp-build` and may still depend on prebuilt-binary availability or fallback compilation in some environments;
Current architecture-facing security concerns still visible:
- supported non-test browser-session persistence depends on Redis availability and correct environment configuration;
- permission-governance warnings currently affect audit metadata and service decisions only; route-level authorization still primarily depends on existing role/policy middleware;
- HSTS is not emitted by the application layer today and remains deferred until deployment, TLS-termination, and trusted-proxy assumptions are standardized in-repo; any future enablement is conditional-only, requires explicit `TRUST_PROXY`, and keeps `preload` out of scope;
- browser-session issuance and validation fail explicitly with `503 service_unavailable` when Redis mode is configured but the store is unreachable, which is safer than silent downgrade but increases operational dependence on Redis uptime;
- universal `Secure` cookie enforcement still depends on HTTPS-capable deployment or trusted proxy signaling;
- mutating cookie-authenticated requests rely on same-origin `Origin` validation rather than a separate CSRF token;
- client-side root guards are UX guards only; backend APIs remain the authority for authorization.

## 17. Unknowns and assumptions
- the bcrypt closeout validation evidence relies on clean mirrored workspaces because the local working tree carried pre-existing Windows Prisma build/install noise;
- Docker-specific validation for the upgraded bcrypt native dependency now includes successful Docker build, in-container bcrypt smoke, and container `/health` startup evidence; full readiness remains database-dependent when no database is configured.
- This refresh does not expand the bounded Docker follow-up into a DB-backed end-to-end container scenario.
- No evidence in this refresh contradicts the implemented root shell, legacy-route `410` gate, or transition landing behavior.
- The current commercial root-shell views are intentionally company-admin-only at the shell-navigation level even where some backing APIs have broader backend authorization; this is observable UI behavior, not proof that broader shell access is approved.
- The preserved `legacy-public-runtime/` tree was verified as present in the repository, but it is outside supported runtime behavior because it is not served from `src/public/`.
- The current wave-one root shell eligibility is implemented in `src/public/root/guards.js` for `root` and `admin` with `companyId`; broader role eligibility remains future work.
- `p10-permission-governance` is complete as an analysis/planning package; after `p28`, its first runtime consumption slice exists, `p29` reconciled the stale planning metadata identified in repository docs/specs, `p30` implemented the approved company-role creation hardening slice, and `p32` added denial-path audit visibility for that same create-flow boundary. Future runtime hardening remains separate from that now-completed create-flow enforcement + denial-observability slice.
- no runtime company-role update flow currently exists, so update hardening remains deferred and is not documented as active behavior.