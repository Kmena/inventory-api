# Architecture

## 1. Purpose and scope
This document describes only the architecture currently implemented and the active decisions currently governing the repository.

This refresh reflects the repository state after `zones-view`, `coding-standard-doc-path-alignment`, `sidebar-rebrand-permissions` `TASK-004`, `quality-baseline-recovery` `TASK-007`, `repository-baseline-score-recovery` `TASK-009`, together with `hotspot-seams-doc-ownership` `TASK-001` through `TASK-008`, `p38-root-shell-modularity-hardening`, `p37-root-spa-companies-roles-admin`, the implemented `root-shell-follow-up-alignment` slice, `root-shell-commercial-views`, and `root-shell-commercial-views-hardening`, building on `p36-bounded-doc-validator-ownership-alignment`, `p35-governance-baseline-sync-guardrails`, and `p34-bounded-governance-coverage-expansion`, and `p33-admin-authorization-governance-convergence`, in addition to the already-implemented browser-runtime reduction, runtime-contract governance convergence, Redis browser-session operational safeguards, DB-free versus DB-backed suite separation for the affected browser/runtime boundary, and the currently implemented permission-governance runtime slices.

## 2. Current active architecture summary
The repository remains a single-deployable Node.js 24 Express + Prisma modular monolith.

Current architecture has two important roots:
- **application root:** `inventory-api/` contains runtime code, package scripts, Prisma assets, tests, specs, and docs;
- **repository root:** the parent-root `../.github/workflows/` directory relative to `inventory-api/` contains the official hosted GitHub Actions automation entry point.

For governance tooling, `inventory-api/.github/workflows/` is not the current authoritative workflow source. The workflow-baseline validators and characterization tests intentionally read hosted workflow truth from that parent-root workflow tree.

Within the browser runtime, the active public surface is intentionally constrained but now includes a supported actor-aware root SPA shell under `src/public/root/` served at `/root/`.

This refresh also includes the completed `bcrypt-supply-chain-closeout` governance slice. The application still uses native `bcrypt` in the existing auth/service flows, but the active dependency baseline is now `bcrypt@^6.0.0`, with the checked-in lockfile resolving through `node-gyp-build` instead of the previous `@mapbox/node-pre-gyp` / `tar` chain. No auth API, browser-session, or persistence architecture was redesigned in this slice.

The implemented `/root/` shell now has a split actor presentation inside the same static runtime:
- global `root` keeps the top-navigation shell variant; and
- `company-admin` receives a rebranded fixed sidebar variant with grouped navigation, desktop collapse, and mobile drawer behavior.
- the sidebar contract now includes overflow hardening: fixed header/footer, a dedicated middle scroll region, defensive truncation/min-width rules, collapsed-only tooltip reveal, and a thin styled scrollbar limited to the scroll region.

`src/public/` now contains:
- the supported login and fallback documents;
- shared browser auth/session helpers;
- a supported root SPA shell under `src/public/root/` served at `/root/`.

The implemented root shell is no longer limited to `Inicio` and a generic pending route. It now includes:
- root-global routes at `#home` and `#companies`;
- company-admin explicit sidebar routes at `#admin_home`, `#products`, `#lots`, `#movements`, `#production`, `#agents`, `#routes`, `#zones`, `#clients`, `#purchases`, `#warehouses`, `#approvals`, `#reports`, `#users`, `#roles_permissions`, and `#settings`;
- functional company-admin views at `#roles_permissions`, `#zones`, `#agents`, `#clients`, and `#routes`; and
- a shared neutral `in_process` view used by the remaining current company-admin routes.

This refresh also accounts for the now-completed `p10-permission-governance` analysis package plus its implemented follow-up slices in `p28`, `p30`, and `p32`: a practical explainer of the governance recommendations lives in `docs/permission-governance-decisions.md`, while the active runtime foundation lives under `src/security/permission-governance*.js` and is now consumed by selected backend services for both company creation and company-role creation hardening, including dedicated denial-path audit visibility for the approved company-role create deny.

Legacy role-specific HTML pages are still not active runtime pages. `src/app.js` intercepts `/root/*.html`, `/warehouse/*.html`, and `/agent/*.html` before `express.static(...)` and serves the shared migration document with HTTP `410 Gone` from the same requested URL. The previously functional legacy runtime remains preserved outside the active runtime in `legacy-public-runtime/` as transitional backup/reference inventory only.

The backend-owned browser-session model remains active through `inventory_browser_session` + `inventory_browser_state`, with `src/public/shared/session.js` and `src/public/shared/auth.js` as the common helper seam reused by both login and the root shell. The residual browser-session hardening risk remains explicitly linked to `specs/p11-https-browser-session-migration/` as a follow-up dependency and is not an in-slice blocker for the current bounded governance/documentation slices.

## 3. Active architectural style and module boundaries
Current implemented style is layered, not hexagonal:
- HTTP/API boundary: routes, schemas, middleware
- application/service layer: services
- persistence layer: repositories + Prisma
- browser delivery layer: static assets under `src/public/`
- embedded browser-shell layer: root SPA shell under `src/public/root/` with actor-aware route visibility, hash routing, and bounded admin views
- preserved legacy browser inventory: `legacy-public-runtime/` outside the active runtime boundary
- governance layer: scripts, tests, docs, specs, and GitHub Actions workflows

A governance boundary also exists between:
- parent-root official workflows used by hosted GitHub Actions as the operational source of truth;
- local validators and characterization tests that read the same parent-root workflow tree directly from `../.github/workflows/` relative to `inventory-api/`.
- the authoritative coding-standards body at `docs/coding_standard.md` and a legacy hyphenated compatibility notice kept only for lagging references.
- the explicit ownership map at `docs/documentation-ownership-map.md`, which classifies canonical, auxiliary, historical/compatibility, and auto-validated repository artifacts.

## 4. Current domain map
Observable current runtime/governance areas:
- Identity and access
  - active hybrid role/permission enforcement
  - centralized permission-governance policy foundation under `src/security/permission-governance.config.js`, `src/security/role-bundles.config.js`, and `src/security/permission-governance.service.js`
  - completed `p10-permission-governance` analysis package as governance input, now partially consumed by runtime services through the company-create deny, company-role create hardening, and company-role denial-audit visibility slices
- Company administration
- Client management
- Product and inventory operations
- Warehouses and geography
- Sales routing and agent workspace APIs
- Orders, invoices, and payments
- Embedded browser runtime
  - login and session bootstrap
  - root shell
  - fallback transition/no-access surfaces
- Repository/platform governance
- CI/workflow governance

## 5. Current runtime components and responsibilities
- **Express app (`src/app.js`)**: middleware chain, route mounting, static file serving, route-segmented security headers, and the deprecated-HTML gate that returns `410 Gone` for legacy browser URLs
- **Middlewares**: authentication, authorization, throttling, payload validation, metrics, request context
- **Services**: orchestration and business-flow logic
- **Dependency-hygiene validator (`scripts/validate-dependency-hygiene.js`)**: executes `npm audit --json` and now enforces a zero-approved-residual baseline
- **Dependency-hygiene governance artifacts (`audit-baseline.json`, `docs/audit/dependency-hygiene-baseline.md`)**: record the current zero-vulnerability repository posture
- **Bcrypt compatibility suite (`tests/bcrypt-supply-chain-closeout.test.js`)**: freezes stored-hash compatibility and current hash-generation behavior without changing auth architecture
- **Repositories**: main Prisma persistence access pattern
- **Prisma**: schema and migration history
- **Shared browser helpers (`src/public/shared/session.js`, `src/public/shared/auth.js`)**: cookie-session bootstrap/read/cleanup and authenticated browser fetch/logout helpers
- **Login runtime (`src/public/index.html`, `src/public/login.js`)**: public auth entrypoint and post-login destination resolution
- **Root shell (`src/public/root/**`)**: supported authenticated root entrypoint, session bootstrap, bounded `window.RootShell` registry seam (`register`, `require`, `has`), explicit `runtime-contract.js` loader/module contract for the approved shared helpers and root-shell scripts, contract-driven app bootstrap/manifest validation, actor-aware guards, manifest-driven navigation, hash router, shared shell UI helpers, split actor furniture (root top-nav vs. company-admin sidebar), shell-owned global offsets, view-owned internal content layout, home view, neutral in-process fallback, root-only Companies Admin view, company-admin Roles/Permissions Admin view, company-admin Zones master-detail view, company-admin Agents two-panel commercial-user view, company-admin Clients list/detail workspace, company-admin Routes overview/detail workspace, grouped tenant-admin sidebar IA with explicit placeholder routes, overflow-hardened sidebar styling (fixed header/footer, central scroll lane, truncated labels/footer copy, collapsed-only tooltip reveal, thin scrollbars), logout trigger, and bounded modularity guardrails enforced by `tests/root-shell-modularity-governance.test.js` plus `scripts/validate-public-runtime.js` for the registry contract, loader script inventory, and the current router/zones/commercial seam expectations
- **Zones helper seam (`src/public/root/views/zones-admin.helpers.js`)**: owns local text normalization, zone/subzone filtering, selected-zone fallback, field-error helpers, dialog utility behavior, form reset/render helpers, and submit-button state helpers reused by `zones-admin.js`
- **Zones view controller (`src/public/root/views/zones-admin.js`)**: owns DOM event wiring, async load/create flows, toast lifecycle, mobile list/detail transitions, and integration with `zones-api.js`, while delegating small selection/filter and dialog/form seams to `zones-admin.helpers.js`
- **Agents helper seam (`src/public/root/views/agents-admin.helpers.js`)**: owns commercial-role detection, company-user plus routes-overview dataset composition, local search/group filtering, and metrics summarization for the supported `#agents` screen
- **Agents renderer seam (`src/public/root/views/agents-admin.renderers.js`)**: owns list, detail, assigned-route, assignment-editor, and goals rendering for the supported `#agents` screen
- **Agents view controller (`src/public/root/views/agents-admin.js`)**: owns DOM event wiring, partial-degradation handling, company-user creation flow, route-assignment UX, and orchestration over `agents-api.js`, delegating HTML rendering to `agents-admin.renderers.js`
- **Clients helper seam (`src/public/root/views/clients-admin.helpers.js`)**: owns local client filtering plus client, store, reference, and document payload shaping for the supported `#clients` screen
- **Clients renderer seam (`src/public/root/views/clients-admin.renderers.js`)**: owns client list/detail and related markup rendering for the supported `#clients` screen
- **Clients state seam (`src/public/root/views/clients-admin.state.js`)**: owns zone-option flattening, selected-client resolution, and list-summary text derivation for the supported `#clients` screen
- **Clients view controller (`src/public/root/views/clients-admin.js`)**: owns list/detail DOM orchestration, client create/update/deactivate flows, append-only store/document/reference behavior, taxpayer lookup, and document download integration over `clients-api.js`, delegating rendering/state helpers to the extracted seams
- **Routes helper seam (`src/public/root/views/routes-admin.helpers.js`)**: owns local route filtering, overview summarization, route/goals payload shaping, and simplified coordinate projection for the supported `#routes` screen
- **Routes renderer seam (`src/public/root/views/routes-admin.renderers.js`)**: owns route detail, covered-store, goals, and simplified SVG map rendering for the supported `#routes` screen
- **Routes state seam (`src/public/root/views/routes-admin.state.js`)**: owns selected-route resolution, route-summary text derivation, and goal-row selection helpers for the supported `#routes` screen
- **Routes view controller (`src/public/root/views/routes-admin.js`)**: owns route overview/detail DOM orchestration, route create/update flows, subzone and agent assignment saves, per-agent goal replace-all saves, and covered-store/map workflow over `routes-api.js`, delegating rendering/state helpers to the extracted seams
- **Root Zones API adapter (`src/public/root/zones-api.js`)**: same-origin browser adapter for `GET /api/regions/company`, `POST /api/regions/company`, and `POST /api/regions/company/:regionId/subregions`
- **Root Agents API adapter (`src/public/root/agents-api.js`)**: same-origin browser adapter for company-user list/create, company-role list, sales-route overview loading, and route-assignment saves across `/api/users/company`, `/api/roles/company`, and `/api/sales-routes/company/**`
- **Root Clients API adapter (`src/public/root/clients-api.js`)**: same-origin browser adapter for supported client, client-classification, client-document-type, store, reference, document, taxpayer, economic-activity, and regions calls under `/api/clients/**`, `/api/taxpayers/lookup?identification=...`, `/api/economic-activities`, and `/api/regions/company`
- **Root Routes API adapter (`src/public/root/routes-api.js`)**: same-origin browser adapter for route overview/detail/create/update, subzone assignment, agent assignment, and agent-goal saves under `/api/sales-routes/company/**`
- **Root Companies API adapter (`src/public/root/companies-api.js`)**: same-origin browser adapter for root-company list/create/status operations against `/api/companies/root/companies` and `/api/companies/root/companies/:companyId/status`
- **Root Roles API adapter (`src/public/root/roles-api.js`)**: same-origin browser adapter for permission catalog and company-role list/create operations against `/api/roles/permissions` and `/api/roles/company`
- **Migration / no-access surfaces**: supported fallback pages for deprecated-route rendering and non-wave-one transition behavior
- **Legacy runtime archive (`legacy-public-runtime/`)**: preserved transition backup/reference inventory, not part of the served runtime
- **Access-policy facade (`src/security/access-policies.js`)**: preserves the observable middleware contract through `authorizeAccessPolicy(...)`, `getAccessPolicy(...)`, and `listAccessPolicies(...)`, composing the extracted registry, actor-scope, and denial-audit seams
- **Access-policy registry seam (`src/security/access-policy-registry.js`)**: owns the declarative route-policy catalog, including current mode, role/permission sets, boundaries, transitions, and selected actor-scope metadata; invoice routes now consume this facade consistently through explicit invoice policy IDs
- **Access-policy actor-scope seam (`src/security/access-policy-actor-scope.js`)**: owns `global-root`, `company-admin`, and `agent-workspace-user` actor-scope evaluation plus actor-scope denial error construction
- **Access-policy denial-audit seam (`src/security/access-policy-audit.js`)**: owns route-level actor-scope denial auditing through action `security.authorization.access_policy`
- **Permission-governance foundation (`src/security/permission-governance*.js`)**: owns centralized role-bundle definitions, permission metadata, governed-operation inventory, approved combination rules, global-root detection, reusable warning contract, and operation evaluation (`allow` / `warn` / `deny`)
- **Company service**: still owns company orchestration and now rechecks `company.create` through the governance foundation before persistence
- **Role service**: owns company-role creation flow, rejects platform-scoped permission assignment such as `companies.manage` before persistence, records governance warnings in audit metadata for successful allow/warn flows, and emits dedicated fail-open denial audit attempts with action `roles.company.create.governance_denied` for the enforced deny path
- **Inventory alerts seam (`src/services/inventory-alerts.service.js`)**: owns inventory-alert permission checks, serialization, valid status transitions, metadata merge behavior, and alert-focused audit coordination while `inventory.service.js` keeps broader stock and lot orchestration
- **Inventory product-total helper (`src/repositories/inventory.repository.js`)**: supported stock-entry and lot QA flows now update product totals through `updateProductById(id, companyId, data, db)`, which scopes by both `id` and `companyId` via `updateMany(...)` plus scoped re-read
- **Agent workspace store-state seam (`src/services/agent-workspace-store-state.service.js`)**: owns visit-state derivation, route normalization, invoice visibility rules, debt serialization, store-card shaping, sorting, and purchase-history shaping while `agent-workspace.service.js` keeps actor scoping and higher-level orchestration
- **Product permission/pricing seams (`src/services/product-permission-shaping.service.js`, `src/services/product-pricing.service.js`)**: own permission-aware product serialization, derived lot-usability decoration, and general-price synchronization while `product.service.js` keeps product CRUD/import orchestration and inventory-linked stock registration; the final supported product update mutation now delegates to `product.repository.updateProduct(id, companyId, data, tx)` inside the existing transaction
- **Browser-session service**: owns opaque browser-session lifecycle, store-readiness checks, explicit 503 mapping for store unavailability, and related audit instrumentation
- **Order list contract seam (`src/routes/order.routes.js`, `src/services/order.service.js`, `src/repositories/order.repository.js`)**: parses optional pagination query params and preserves the dual `GET /api/orders` contract of legacy array responses without pagination params versus `{ items, pagination }` envelopes when pagination is requested
- **Health router**: exposes liveness and readiness, combining Prisma readiness with browser-session-store readiness
- **Aggregate test runner**: `scripts/run-tests.js` discovers `.test.js` files, applies preferred ordering, forwards Node test arguments, and injects the default test-safe environment
- **Public-runtime validator**: `scripts/validate-public-runtime.js` governs the supported public inventory, validates legacy relocation, and asserts login, migration, and root-shell contracts
- **Runtime-contract artifacts**: canonical reviewed artifacts under `docs/**`, including the partial OpenAPI baseline and critical-contract matrix that now cover the selected governance-admin surfaces from `p34` (company listing/creation, root-company listing/creation, assignable-role-permission listing, and company-role listing/creation) clarified by `p33`; after `p36`, the in-scope legacy governance validator also consumes those canonical `docs/**` artifacts directly, while `internal-docs/**` remains auxiliary support material only
- **Documentation ownership map (`docs/documentation-ownership-map.md`)**: classifies canonical docs, auxiliary `internal-docs/**`, historical/compatibility bridges, and auto-validated governance artifacts, and now records the current auth/service/repository seam ownership examples introduced by `hotspot-seams-doc-ownership`
- **Coding-standards documentation seam**: `docs/coding_standard.md` is the authoritative standards document, the legacy hyphenated alias is compatibility-only, and `tests/coding-standard-path-alignment.test.js` guards that no second authoritative copy reappears in repo-owned docs/tests/scripts
- **Workflow-baseline validator**: `scripts/validate-workflow-baseline.js` verifies the root hosted workflow contracts, including the dedicated Redis browser-session lane

## 6. Current dependency rules
- dependency-hygiene governance now assumes zero approved residual vulnerabilities; any future `npm audit` finding is expected to fail validation unless the baseline and approval posture are explicitly updated;
- auth/password flows remain service-layer consumers of native `bcrypt`; dependency upgrades must preserve stored-hash compatibility and current hash-generation semantics;
Observed dependency direction remains mostly:
- routes -> services -> repositories -> Prisma
- supported product and inventory write paths now preserve tenant scope at the repository mutation boundary instead of relying only on prior scoped reads
- routes with policy enforcement -> `src/security/access-policies.js` facade -> access-policy registry / actor-scope / denial-audit seams -> middleware outcome
- services with governance-sensitive operations -> `src/security/permission-governance.service.js` -> repositories / audit
- public browser runtime pages -> shared browser helpers -> HTTP API
- root shell app -> `window.RootShell` registry -> root session adapter / guards / manifest / router / UI helpers / sidebar-state logic / view modules / API adapters -> shared browser helpers -> HTTP API
- local scripts/tests -> workflow definitions, docs, runtime files, and contracts
- hosted GitHub Actions -> repository-root workflow definitions under `../.github/workflows/**` -> `inventory-api/` working directory
- documentation/governance consumers -> canonical docs listed in `docs/documentation-ownership-map.md` -> auxiliary/internal artifacts only when explicitly called out as non-authoritative support material

Current public-runtime dependency constraints now in effect:
- `src/app.js` owns legacy HTML deprecation at the HTTP boundary instead of leaving role-specific HTML behavior to `express.static(...)`.
- `src/public/` is the only directory served as active browser runtime.
- `legacy-public-runtime/` must not be treated as active runtime or supported browser surface.
- the current browser-runtime `typecheck` baseline remains intentionally bounded and explicit, covering `src/public/shared/session.js`, `src/public/shared/auth.js`, `src/public/login.js`, and the approved `src/public/root/**` shell files only.
- bounded governance evidence now also includes `src/security/access-policies.js`, while still avoiding repository-wide `src/security/**` typecheck expansion.
- the root shell is governed by an explicit bounded `typecheck` allowlist plus lint, `validate-public-runtime`, smoke tests, characterization tests, route-governance tests, root-shell modularity tests, and browser E2E.
- the intended local validation entrypoints for browser/runtime governance are the repository-owned wrappers `scripts/run-eslint.js` and `scripts/run-tsc.js`, which keep `npm run lint:public-runtime` and `npm run typecheck` portable without depending on shell-exposed CLI shims.
- for sensitive root-shell modules, active governance now requires verifiable isolated characterization and/or continued use of the currently extracted seams: `router.js` is protected by `tests/root-shell-router-characterization.test.js`, `zones-admin.js` is protected by helper-seam assertions and isolated characterization coverage in `tests/root-shell-modularity-governance.test.js`, `tests/zones-view-selection-filters-characterization.test.js`, and `tests/zones-view-dialog-feedback-characterization.test.js`, and the supported commercial views are now protected by direct seam/governance coverage in `tests/agents-view-characterization.test.js`, `tests/clients-view-characterization.test.js`, `tests/routes-view-characterization.test.js`, `tests/root-shell-modularity-governance.test.js`, `tests/public-surface-characterization.test.js`, `tests/public-runtime-http-smoke.test.js`, `tests/typecheck-ci-hardening-governance.test.js`, and the browser-level regression lane in `tests/root-shell-commercial-views.e2e.js`.
- actor-aware route visibility is enforced in the shell manifest/guards for UX purposes, but backend company and role endpoints remain the authoritative security boundary.
- retired legacy pages and `legacy-public-runtime/` may not re-enter supported runtime, validator scope, or typecheck scope without a new approved specification.

## 7. Current database ownership and transaction boundaries
Current persistence architecture remains:
- Prisma schema as the system-of-record model definition
- versioned migrations under `prisma/migrations/`
- repositories as the main application-level persistence access pattern
- service orchestration above repositories

Current product and inventory stock-related mutation paths still keep transaction orchestration in services, but the final product mutations now enforce company scope at repository level.

The inspected `p27`, `p28`, `p30`, and `p32` refreshes introduced no database ownership or transaction-boundary changes.

## 8. Current API and integration contracts
Current active contracts relevant to architecture:
- REST-style API under `/api/*`
- health endpoints under `/health/*`
- browser runtime served from the same process
- package scripts, GitHub Actions workflows, validator scripts, and runtime-contract artifacts as repository contracts
- canonical runtime-contract ownership under `docs/**`
- `/api/auth/login` supports browser-session issuance when `X-Inventory-Browser-Session: cookie` is requested
- `/api/auth/me` returns the current authenticated user and refreshes browser-session cookies
- `/api/auth/logout` invalidates the backend-owned browser session and clears browser cookies
- `POST /api/companies/` now uses the dedicated route policy `company.create-global` while preserving the same endpoint and `403` semantics
- `GET /api/orders` is intentionally backward compatible: it returns the legacy array contract without pagination params and returns `{ items, pagination }` when `page` or `pageSize` is supplied

Current public HTML/browser contract:
- supported public HTML: `/`, `/index.html`, `/no-access.html`, `/migration.html`, `/root/`
- supported authenticated root shell: `/root/` backed by `src/public/root/index.html`
- the `/root/` shell currently exposes two actor-specific navigation models in the same document: root-global top navigation and company-admin sidebar navigation
- current root-global shell hash routes are `#home` and `#companies`
- current company-admin sidebar hash routes are `#admin_home`, `#products`, `#lots`, `#movements`, `#production`, `#agents`, `#routes`, `#zones`, `#clients`, `#purchases`, `#warehouses`, `#approvals`, `#reports`, `#users`, `#roles_permissions`, and `#settings`
- `#companies` is a root-only shell surface backed by `/api/companies/root/companies` list/create/status contracts
- `#roles_permissions` is a company-admin shell surface backed by `/api/roles/permissions` and `/api/roles/company` list/create contracts
- `#zones` is a company-admin shell surface backed by `/api/regions/company` and `/api/regions/company/:regionId/subregions`, with local in-memory search and server round-trips limited to load, refresh, and successful create actions
- `#agents` is a company-admin shell surface backed by `/api/users/company`, `/api/roles/company`, and `/api/sales-routes/company`, with frontend dataset composition, local filtering, company-user creation, and route-assignment saves through existing sales-route assignment contracts
- `#clients` is a company-admin shell surface backed by `/api/clients/company`, `/api/clients/:id`, `/api/clients/classifications/company`, `/api/clients/document-types`, `/api/clients/company/:clientId/stores`, `/api/clients/:clientId/documents`, `/api/clients/:clientId/references`, `/api/clients/:clientId/documents/:documentId/download`, `/api/taxpayers/lookup?identification=...`, `/api/economic-activities`, and `/api/regions/company`
- `#routes` is a company-admin shell surface backed by `/api/sales-routes/company`, `/api/sales-routes/company/:routeId`, `/api/sales-routes/company/:routeId/subzones`, `/api/sales-routes/company/:routeId/assignments`, `/api/sales-routes/company/agents/:userId/goals`, and `/api/regions/company`
- the remaining current company-admin sidebar routes render the shared neutral `in_process` view, with `#admin_home` as the default landing when no hash is present
- no supported root-shell contract exists today for company edit/delete/detail, role update/delete, permission mutation, or user-role reassignment
- no runtime company-role update flow currently exists, so update hardening remains deferred until an approved update surface is implemented
- deprecated public HTML: `/root/*.html`, `/warehouse/*.html`, `/agent/*.html` -> same URL, no redirect, shared migration screen, HTTP `410 Gone`
- preserved legacy files under `legacy-public-runtime/` are not an integration contract
- login currently routes wave-one root-eligible users to `/root/` and keeps other retired-runtime-dependent profiles on `/migration.html?mode=post-login-transition`

## 9. Current security boundaries
Current observable security boundaries include:
- authentication middleware for protected routes
- authorization middleware and access-policy logic
- current role-governance enforcement remains hybrid: route-level authorization still relies mainly on legacy role/policy middleware, but the repository now also has a bounded actor-scope convergence seam in `src/security/access-policies.js` for the company/company-role admin flows and the agent workspace routes while selected service-layer operations continue consulting the centralized governance foundation
- company-role list/create now uses an intentionally clearer split contract: access policies declare explicit `company-admin` actor scope for the affected admin routes, while `role.service.js` still denies platform-scoped permissions such as `companies.manage` before repository persistence, emits structured governance warnings for non-approved deny candidates, and records service-level governance denials safely as dedicated audit attempts under action `roles.company.create.governance_denied` without changing the `403` contract
- company list/create now uses an intentionally clearer split contract: access policies declare explicit `global-root` actor scope for the affected admin routes, including the dedicated `company.create-global` route policy for `POST /api/companies/`, while `company.service.js` preserves the governance-service-backed global-root business check
- login throttling on the login route
- security headers in the Express app, including CSP selection by route
- strict same-origin CSP on `/`, `/index.html`, `/no-access.html`, `/migration.html`, `/root/`, and deprecated legacy HTML routes that receive the migration response, without the previously retired CDN allowances
- JWT verification is pinned to the application's explicit signing algorithm allowlist in `src/lib/auth.js`
- browser-session cookies with `HttpOnly` on the opaque session cookie, `SameSite=Lax`, and conditional `Secure` enforcement for production or HTTPS-capable requests
- same-origin `Origin` validation on mutating cookie-authenticated requests in `authenticate.js`
- explicit no-fallback failure behavior when Redis-backed browser-session persistence is configured but unreachable
- client-side root guards acting only as UX gates; backend APIs remain the authority
- the current shell actor split is global `root` without `companyId` for the top-nav shell and routes `#home` / `#companies`, and `admin` with `companyId` for the sidebar shell where `#admin_home` is the default landing, `#roles_permissions`, `#zones`, `#agents`, `#clients`, and `#routes` are the functional tenant-admin routes, and the remaining approved sidebar routes currently render the shared neutral `in_process` view

## 10. Current container and deployment architecture
Follow-up validation now confirms the upgraded bcrypt native dependency path works with the versioned Docker assets: `inventory-api/Dockerfile` builds successfully, in-container bcrypt smoke passes, and the application starts successfully far enough to serve `GET /health` when documented runtime prerequisites are supplied. This does not change the versioned Docker assets themselves and is not documented as an active dependency vulnerability.
Current observed deployment architecture:
- application Dockerfile with multi-stage build
- non-root runtime user
- Docker healthcheck bound to `GET /health/ready`
- compose files aligned to the Redis-backed browser-session baseline
- repository-root GitHub Actions workflows as the official hosted automation layer
- the versioned production Compose baseline keeps Postgres internal to the Docker network and does not expose the DB port on the host

Current platform baseline is Node 24 in:
- `package.json` engines
- `Dockerfile` base image
- repository-root workflow Node setup steps

## 11. Current testing strategy
- dependency-governance coverage now also includes `tests/dependency-hygiene-governance.test.js` for the zero-residual baseline and `tests/bcrypt-supply-chain-closeout.test.js` for stored-hash compatibility, login continuity, and current hash-generation behavior
Current implemented testing posture includes:
- `scripts/run-tests.js` as the official aggregate repository test runner
- inventory validation through `scripts/validate-public-runtime.js`
- characterization tests for supported public surface and browser auth/session convergence
- HTTP smoke validation for supported public-runtime responses
- governance tests for runtime-contract completeness and OpenAPI consistency
- browser E2E coverage
- bounded browser-runtime typecheck coverage over `src/public/shared/session.js`, `src/public/shared/auth.js`, `src/public/login.js`, and the approved `src/public/root/**` shell files
- focused route/modularity/browser coverage through `tests/root-shell-route-governance.test.js`, `tests/root-shell-router-characterization.test.js`, `tests/root-shell-modularity-governance.test.js`, `tests/public-surface-characterization.test.js`, `tests/agents-view-characterization.test.js`, `tests/clients-view-characterization.test.js`, `tests/routes-view-characterization.test.js`, `tests/zones-view-selection-filters-characterization.test.js`, `tests/zones-view-dialog-feedback-characterization.test.js`, and `tests/zones-view.e2e.js`
- inventory hotspot characterization coverage through `tests/inventory-service-hotspot-characterization.test.js`, freezing paginated inventory movement/alert seams, alert disappearance conflict handling, and transaction propagation around `updateLotQa` and `registerStockEntry`
- agent-workspace hotspot characterization coverage through `tests/agent-workspace-hotspot-characterization.test.js`, freezing tenant-scoped store filtering/sorting, store summary serialization, and current order-payload coercion/delegation behavior
- product hotspot characterization coverage through `tests/product-service-hotspot-characterization.test.js`, freezing repository-transaction ownership for `createProduct`, derived lot-usability decoration, category-cache reuse during import, and import-time inventory registration coupling
- access-policy hotspot characterization coverage through `tests/access-policies.test.js` and `tests/authorization-convergence-characterization.test.js`, freezing strict registry lookup behavior, actor-scope inventories, denial-audit metadata, and selected route-policy mappings without changing runtime semantics
- targeted due-diligence remediation coverage now also includes `tests/product-service-hotspot-characterization.test.js`, `tests/inventory-service-hotspot-characterization.test.js`, `tests/pagination.test.js`, `tests/order-lifecycle-contract-characterization.test.js`, `tests/auth-hardening-characterization.test.js`, `tests/lot-datetime-characterization.test.js`, and `tests/production-baseline-characterization.test.js`
- `docs/test-suite-catalog.md` as the maintained reference for the affected DB-free vs DB-backed suite boundary
- `tests/coding-standard-path-alignment.test.js` as the focused governance check for canonical versus compatibility coding-standards paths
- `tests/documentation-ownership-governance.test.js` as the focused governance check for the ownership map and the canonical workflow/documentation references
- targeted hotspot seam validation now also includes the extracted inventory-alert, agent-workspace store-state, product permission/pricing, and documentation-ownership slices introduced by `hotspot-seams-doc-ownership`

Recorded post-implementation evidence supplied by the user for `hotspot-seams-doc-ownership` tasks 1-8:
- `node --test tests/governance-baseline-sync-guardrails.test.js` passed
- `node --test tests/coding-standard-path-alignment.test.js` passed
- `npm run lint` passed
- `npm run typecheck` passed
- targeted access-policy / inventory / agent-workspace / product / documentation suites passed
- `npm run validate:workflow-baseline` passed
- `set BROWSER_SESSION_STORE_MODE=memory && npm run test -- --silent` passed
- baseline audit rerun scored `7.4/10` with verdict `Acceptable` and no regressions observed
- `npm run build` remains intermittently unstable on Windows because Prisma generate can hit a rename-lock `EPERM`

Recorded post-implementation evidence supplied by the user for `zones-view`:
- `npm run lint:public-runtime` passed
- `npm run typecheck` passed
- `npm run validate:public-runtime` passed
- `npm run lint` passed
- `node --test tests/root-shell-route-governance.test.js tests/public-surface-characterization.test.js tests/zones-view.e2e.js` passed
- `npm run build` reported the same pre-existing Windows Prisma rename-lock issue during Prisma generate

Recorded post-implementation evidence supplied by the user for `sidebar-rebrand-permissions` `TASK-004`:
- `npm run typecheck` passed
- `npm run lint:public-runtime` passed
- `npm run validate:public-runtime` passed
- `node --test tests/public-surface-characterization.test.js` passed
- `node --test tests/root-shell-route-governance.test.js` passed
- `node --test tests/browser-e2e.e2e.js` passed
- `npm run build` reported the same pre-existing Windows Prisma rename-lock issue during Prisma generate

Recorded post-implementation evidence supplied by the user for `quality-baseline-recovery` `TASK-004`:
- `node --test tests/zones-view-selection-filters-characterization.test.js` passed
- `node --test tests/zones-view.e2e.js` passed
- `npm run typecheck` passed
- `npm run lint:public-runtime` passed

Recorded post-implementation evidence supplied by the user for `quality-baseline-recovery` `TASK-005`:
- `node --test tests/zones-view-dialog-feedback-characterization.test.js` passed
- `node --test tests/zones-view.e2e.js` passed
- `node --test tests/zones-view-selection-filters-characterization.test.js` passed
- `node --test tests/root-shell-route-governance.test.js` passed
- `npm run validate:public-runtime` passed
- `npm run typecheck` passed
- `npm run lint:public-runtime` passed

Recorded post-implementation evidence supplied by the user for `quality-baseline-recovery` `TASK-006`:
- `node --test tests/root-shell-modularity-governance.test.js` passed
- `node --test tests/root-shell-route-governance.test.js` passed
- `node --test tests/root-shell-router-characterization.test.js` passed
- `node --test tests/zones-view-selection-filters-characterization.test.js tests/zones-view-dialog-feedback-characterization.test.js` passed
- `npm run validate:public-runtime` passed
- `npm run typecheck` passed
- `npm run lint:public-runtime` passed

Recorded post-implementation evidence supplied by the user for `quality-baseline-recovery` `TASK-007`:
- `npm run validate:public-runtime` passed
- `node --test tests/public-surface-characterization.test.js` passed
- `node --test tests/root-shell-route-governance.test.js` passed
- `npm run typecheck` passed
- `npm run lint:public-runtime` passed

Recorded post-implementation evidence supplied by the user for `root-shell-commercial-views`:
- `npm run validate:public-runtime` passed
- `node --test tests/root-shell-route-governance.test.js` passed
- `node --test tests/root-shell-router-characterization.test.js` passed
- `node --test tests/public-surface-characterization.test.js` passed
- `node --test tests/agents-view-characterization.test.js` passed
- `node --test tests/clients-view-characterization.test.js` passed
- `node --test tests/routes-view-characterization.test.js` passed
- `node --test tests/public-runtime-http-smoke.test.js tests/prisma-client-baseline-characterization.test.js tests/public-surface-characterization.test.js tests/typecheck-ci-hardening-governance.test.js` now passes in the intended local Windows-oriented validation lane, keeping the Prisma-adjacent smoke assertions DB-idle until a Prisma operation is explicitly requested
- `npm run lint:public-runtime` now passes through the repository-owned `scripts/run-eslint.js` wrapper instead of depending on a shell-exposed `eslint` shim
- `npm run typecheck` now passes through the repository-owned `scripts/run-tsc.js` wrapper instead of depending on a shell-exposed `tsc` shim
- `node --test tests/root-shell-commercial-views.e2e.js` now passes as the representative browser E2E lane for the supported `#agents`, `#clients`, and `#routes` views

Recorded post-implementation evidence supplied by the user for `root-shell-commercial-views-hardening`:
- `node --test tests/agents-view-characterization.test.js tests/clients-view-characterization.test.js tests/routes-view-characterization.test.js tests/root-shell-modularity-governance.test.js` passed
- `node --test tests/public-surface-characterization.test.js tests/public-runtime-http-smoke.test.js tests/typecheck-ci-hardening-governance.test.js` passed
- `node --test tests/root-shell-commercial-views.e2e.js` passed
- `node --test tests/payment-tenant-scope.test.js tests/invoice-payment-sync-characterization.test.js tests/pagination.test.js tests/payment-receipt-security.test.js tests/audit-instrumentation.test.js` passed
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed
- `npm run validate:public-runtime` passed

Recorded post-implementation evidence supplied by the user for `repository-baseline-score-recovery` `TASK-007`:
- `node --test tests/inventory-service-hotspot-characterization.test.js tests/inventory-alerts-tenant-scope.test.js tests/approval-baseline-compatibility.test.js` passed
- `npm run test -- --silent` passed with only the expected environment-gated skips remaining
- `npm run lint` passed
- `npm run typecheck` passed

Recorded post-implementation evidence supplied by the user for `repository-baseline-score-recovery` `TASK-008`:
- `node --test tests/agent-workspace-hotspot-characterization.test.js tests/product-service-hotspot-characterization.test.js` passed
- `npm run test -- --silent` passed
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed

Recorded post-implementation evidence supplied by the user for `repository-baseline-score-recovery` `TASK-009`:
- `set NODE_ENV=test&& set BROWSER_SESSION_STORE_MODE=memory&& node --test tests/access-policies.test.js tests/administrative-authorization-characterization.test.js tests/authorization-convergence-characterization.test.js` passed
- `npm run test -- --silent` passed with only the expected environment-gated skips remaining
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed

Recorded post-implementation evidence supplied by the user for `p37`:
- `npm run validate:public-runtime` passed
- `node --test tests/public-surface-characterization.test.js` passed
- `node --test tests/public-runtime-http-smoke.test.js` passed
- `node --test tests/root-shell-route-governance.test.js` passed
- `node --test tests/browser-e2e.e2e.js` passed
- `npm run lint:public-runtime` passed
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed
- `npm run test -- --silent` reported pre-existing unrelated failures

Recorded post-implementation evidence supplied by the user for `p28`:
- focused tests passed
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed

Recorded documentation-only validation evidence supplied by the user for `p29`:
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed
- `git diff --check` passed

Recorded post-implementation evidence supplied by the user for `p30`:
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed
- `node --test tests/permission-governance-foundation.test.js` passed
- `node --test tests/permission-governance-backend-consumption.test.js tests/permission-governance-foundation.test.js` passed
- `git diff --check` passed

Recorded post-implementation evidence supplied by the user for `p36`:
- `node --test tests/p36-doc-validator-ownership.test.js` passed
- `node --test tests/runtime-contract-governance.test.js tests/critical-contract-governance.test.js tests/openapi-contract-consistency.test.js tests/governance-baseline-sync-guardrails.test.js` passed
- `npm run typecheck` passed
- `npm run lint -- --quiet` passed
- `npm run build` passed

Recorded post-implementation evidence supplied by the user for `p35`:
- `node --test tests/governance-baseline-sync-guardrails.test.js` passed
- `node --test tests/governance-baseline-sync-guardrails.test.js tests/typecheck-ci-hardening-governance.test.js tests/openapi-contract-consistency.test.js tests/critical-contract-governance.test.js` passed
- `npm run lint` passed
- `npm run build` passed

Recorded post-implementation evidence supplied by the user for `p34`:
- `npm run typecheck` passed
- `node --test tests/typecheck-ci-hardening-governance.test.js` passed
- `node --test tests/openapi-contract-consistency.test.js` passed
- `node --test tests/critical-contract-governance.test.js` passed
- `npm run build` passed

Recorded post-implementation evidence supplied by the user for `p33`:
- `set BROWSER_SESSION_STORE_MODE=memory&& node --test tests/access-policies.test.js` passed
- `set BROWSER_SESSION_STORE_MODE=memory&& node --test tests/company-authorization-characterization.test.js` passed
- `set BROWSER_SESSION_STORE_MODE=memory&& node --test tests/authorization-convergence-characterization.test.js` passed
- `set BROWSER_SESSION_STORE_MODE=memory&& node --test tests/audit-instrumentation.test.js` passed
- `node --test tests/permission-governance-backend-consumption.test.js` passed
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed
- `git diff --check` passed

Recorded post-implementation evidence supplied by the user for `p32`:
- `node --test tests/permission-governance-backend-consumption.test.js` passed
- `node --test tests/audit-instrumentation.test.js` passed
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed
- `git diff --check` passed

Recorded post-implementation evidence supplied by the user for `p27`:
- `npm run validate:public-runtime` passed
- `npm run lint:public-runtime` passed
- `npm run typecheck` passed
- `npm run lint -- --quiet` passed
- `npm run build` passed
- `node --test tests/browser-e2e.e2e.js` passed
- `node --test tests/public-runtime-http-smoke.test.js tests/public-surface-characterization.test.js tests/browser-runtime-auth-convergence-inventory.test.js` passed

## 12. Active architectural decisions
- keep native `bcrypt` as the active password-hashing library rather than redesigning auth hashing in this slice
- keep the approved dependency baseline on `bcrypt@^6.0.0`
- keep dependency-hygiene governance at zero approved residual vulnerabilities
- keep the recorded Docker-daemon validation evidence for the native bcrypt path as completed operational support, not as pending architecture work
Currently implemented or actively governing decisions:
- keep the application as a single deployable modular monolith
- keep the embedded browser runtime inside the same Express process
- keep permission-governance policy data centralized under `src/security/` instead of scattering new role-governance rules across services
- keep Node 24 as the active runtime baseline across package, Docker, and hosted workflows
- keep the backend-owned cookie-session browser model for supported browser flows
- keep `src/public/` as the only active browser runtime directory
- keep `/root/` as the supported wave-one root SPA shell entrypoint
- keep the root shell implemented in vanilla JS and static assets under `src/public/root/`
- keep the bounded `window.RootShell` registry contract (`register`, `require`, `has`) as the active internal shell dependency seam
- bootstrap the root shell through the existing `GET /api/auth/me` contract and shared browser helpers rather than introducing a new frontend auth stack
- allow wave-one root-shell access for `root` users and `admin` users with `companyId`
- keep the supported `/root/` shell actor-aware within the existing vanilla-JS runtime instead of splitting root and company-admin browser entrypoints
- keep the rebranded sidebar experience limited to `company-admin` for now, while preserving the existing root-global top-navigation shell
- keep root-shell route resolution hash-based under `/root/`
- keep `#admin_home` as the default company-admin landing when no hash is present
- keep Companies Admin bounded to the existing root-company list/create/status endpoints only
- keep Roles/Permissions Admin bounded to the existing permission catalog and company-role list/create endpoints only
- keep Zones bounded to the existing company-regions list/create/subregion-create endpoints only
- keep `#agents`, `#clients`, and `#routes` as active company-admin root-shell modules over the existing backend contracts, preserving the extracted renderer/state seams and governance coverage added during `root-shell-commercial-views-hardening`
- keep the remaining approved company-admin sidebar entries mapped to the shared neutral `in_process` view until later approved slices implement real modules
- keep company-admin sidebar tooltips display-gated until collapsed hover/focus so hidden tooltip boxes do not affect layout width
- keep header/footer fixed and constrain scrolling plus styled scrollbar behavior to the middle sidebar region only
- keep shell-owned global offsets separate from individual view layout concerns
- keep unsupported role/company edit flows out of the root shell until a later approved slice introduces them
- keep `/migration.html?mode=post-login-transition` as the supported temporary landing for non-wave-one browser profiles
- intercept deprecated legacy HTML routes at the HTTP boundary and return `410 Gone` with the shared migration screen from the same URL
- preserve the removed functional legacy runtime outside the active runtime in `legacy-public-runtime/`
- keep reviewed canonical runtime-contract ownership under `docs/**` and treat `internal-docs/**` as auxiliary only
- keep `docs/coding_standard.md` as the single authoritative coding-standards body and keep the legacy hyphenated alias as a compatibility notice only
- keep the first stable permission-governance enforcement slice for `company.create` limited to global-root actors only
- keep company-role governance incremental: deny platform-scoped permission assignment in company-role creation now, record that enforced deny through the dedicated service-level audit action, and leave broader sensitive combinations in `warn` posture until later approval
- keep the bounded actor-scope convergence seam limited to selected admin flows plus the agent workspace routes rather than broadening it into a repository-wide authorization redesign
- keep update-flow governance deferred until an actual company-role update surface exists in runtime
- keep the browser-runtime `typecheck` baseline bounded to the explicit shared-auth/login seam plus the approved `src/public/root/**` shell allowlist, without broadening to all `src/public/**`
- keep HSTS deferred until deployment, TLS-termination, and trusted-proxy assumptions are standardized in-repo; current app-layer hardening stops at CSP and explicit JWT algorithm pinning
- if HSTS is ever revisited, allow only conditional enablement behind explicit deployment assumptions, require `TRUST_PROXY` to be explicit before proxied enablement, and keep `preload` out of scope
- keep the official aggregate test runner defaulted to `NODE_ENV=test` and `BROWSER_SESSION_STORE_MODE=memory` unless explicitly overridden
- keep a separate explicit Redis-path validation lane instead of folding Redis dependence back into the default aggregate suite
- keep browser-session readiness visible at `/health/ready`
- keep hotspot seam reductions additive and behavior-preserving behind the existing access-policy and service facades instead of redesigning the layered monolith
- keep the default aggregate validation lane memory-backed for browser sessions and treat Windows Prisma generate rename-lock failures as a separate documented platform concern, not as evidence of hotspot-seam regressions

## 13. Known architectural limitations
- the repository still depends on a native password-hashing module path (`bcrypt` via `node-gyp-build`), so some environments may require prebuilt-binary compatibility or fallback compilation support;
- full DB-backed container readiness and end-to-end auth behavior were not expanded in the bounded Docker follow-up, even though build and startup smoke evidence now exists;
- layered architecture without strict hexagonal separation
- broad service responsibilities
- operational/readiness/browser governance still depends on synchronized docs, scripts, tests, manifest metadata, and workflows
- the repository still carries a temporary compatibility bridge at the legacy hyphenated coding-standards path; governance relies on maintainers not restoring a second full standards body there, with `tests/coding-standard-path-alignment.test.js` acting as the preventive guardrail
- the root shell is still a bounded first wave implemented through ordered global scripts rather than a stronger module-loading boundary, but the approved script inventory and minimal provider-before-consumer expectations are now centralized in `src/public/root/runtime-contract.js` and guarded by dedicated validator/test coverage around loader drift
- root-shell navigation is local-manifest based and not yet centralized with any broader cross-role navigation model
- the company-admin sidebar IA is richer than the currently implemented module set, because many visible entries still converge on the shared neutral `in_process` view
- the commercial root-shell modules are still UI-layer compositions over existing REST contracts rather than dedicated application-layer frontend modules; `#agents` composes data from users, roles, and routes in the browser, and `#clients` / `#routes` still keep large DOM-oriented controllers even after adjacent renderer/state seam extraction
- the `#zones` screen is still implemented as a sizable plain-script DOM workflow; selection/filter behavior and small dialog/form seams now have extracted helper support plus isolated characterization coverage, but the main async UI orchestration remains centralized in `src/public/root/views/zones-admin.js`
- shell visibility is stricter than some backend authorization contracts: the current manifest exposes `#agents`, `#clients`, and `#routes` only to `company-admin`, even though some backing APIs also admit broader backend roles such as `sales` or `sales_supervisor`
- requester-supplied hardening evidence for this slice now shows the public-runtime smoke lane, commercial browser E2E lane, and local Windows-friendly lint/typecheck entrypoints passing; the remaining Windows-specific Prisma concern stays limited to the separately documented `npm run build` generate rename-lock behavior rather than the targeted smoke or tooling commands
- sidebar state logic currently hardcodes some group identifiers and route-specific UI assumptions inside `src/public/root/app.js`
- role/permission governance remains hybrid, and the completed `p10` package has only been partially translated into runtime behavior: centralized policy data, governed-operation evaluation, the stable company-creation deny, the first company-role platform-scope deny, denial-path audit visibility for that deny, and a bounded admin-route actor-scope convergence seam now exist, but broader backend role-governance hardening and full repository-wide access-policy convergence are still incomplete
- no runtime company-role update flow currently exists, so update hardening remains intentionally undocumented as active behavior
- spec metadata cleanup identified around permission-governance sequencing was reconciled through `p29`, `p30` closed the next practical follow-up for company-role creation hardening, and `p32` closed the immediate denial-audit visibility follow-up for that same create-flow boundary; later dependencies should no longer describe either slice as pending for the implemented create-flow behavior
- the browser-runtime `typecheck` baseline now covers the approved root-shell files through an explicit allowlist, while avoiding a broad `src/public/**` expansion
- the preserved `legacy-public-runtime/` tree is transition inventory, not active runtime
- the default aggregate test baseline prioritizes deterministic memory-backed browser sessions, so Redis-backed session persistence is not exercised on every plain `npm run test` run
- inventory transaction ownership and orchestration responsibilities remain distributed between `src/services/inventory.service.js`, `src/services/inventory-transaction-support.service.js`, `src/services/inventory-alerts.service.js`, and repository-owned transaction callbacks; the current seam is smaller but still not fully decomposed into dedicated application/domain modules
- `src/services/agent-workspace.service.js` remains a large coordination hotspot that mixes tenant scoping, route/store filtering, serialization, and delegation to `order.service.js`, even though store-state, debt, purchase-history, and sorting logic now live in `agent-workspace-store-state.service.js`
- `src/services/product.service.js` remains a large coordination hotspot that mixes product CRUD/import orchestration with inventory-side effects through repository transaction callbacks and `inventory.service.js`, even though permission shaping and general-price synchronization now live in dedicated seams
- `src/security/access-policies.js` remains a shared authorization facade and policy entrypoint; the internal split removed mixed registry/actor-scope/audit code from that file, agent workspace routes now consume the facade explicitly through `agent.workspace.access`, but the registry itself is still a broad central catalog and the facade remains a high-impact integration point
- the Redis store is implemented with a bespoke low-level TCP client
- requester-supplied validation evidence is current, but this refresh did not independently re-execute commands
- authorization characterization tests can still emit expected `audit_record_failed` console noise when denied-path audit persistence cannot reach `db:5432`; that noise does not by itself indicate guard regression when the assertions still pass
- Prisma/Windows closeout is now governed by `docs/prisma-windows-stability-evidence.md`, which records the hosted repository verdict as `estabilizado con evidencia CI`; the same document now also treats the developer-local Windows operating baseline as `residual gobernado` whenever `windows_rename_lock` still reproduces locally, so hosted CI closure is not interpreted as universal local stability
- the current wrapper/workflow baseline still has bounded diagnostic gaps: it can classify `windows_rename_lock`, preserve the real build exit, and write a minimal latest-run diagnostics report under `logs/prisma-generate-last-run.json`, but it does not yet identify the local locking process or capture richer process-attribution evidence
- current sidebar regression protection is contract-based through stylesheet assertions and runtime/E2E coverage, not screenshot-diff based visual testing

## 14. Open decisions requiring clarification
Open future decisions visible after this refresh:
- whether the approved company-admin sidebar entries should keep mapping to the shared neutral `in_process` view or graduate to distinct route contracts in the next slice
- which company-admin sidebar module should be the next functional destination after the current implemented set (`Roles y permisos`, `Zonas`, `Agentes`, `Clientes`, and `Rutas`)
- whether root-shell navigation should remain local to `src/public/root/manifest.js` or later converge on a broader approved manifest model
- whether additional browser roles beyond the current wave-one rule should later use `/root/` as a supported destination
- whether the approved root-shell `typecheck` allowlist should later expand beyond the current explicit `src/public/root/**` file set
- when equivalent SPA coverage will justify removal of the preserved `legacy-public-runtime/` inventory
- when to implement the next approved slice from permission governance after the completed metadata reconciliation, company-role create hardening, and denial-path audit visibility slices, specifically any later company-role update-flow governance once such a runtime surface exists and any later guided role-governance UI consumption in the root shell