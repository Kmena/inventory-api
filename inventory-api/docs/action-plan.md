# Architectural Action Plan

## 1. Objective
Keep architecture-facing documentation synchronized with the real repository state after `hotspot-seams-doc-ownership` tasks 1-8 closure, in addition to the previously documented `zones-view`, `coding-standard-doc-path-alignment`, `sidebar-rebrand-permissions` `TASK-004`, `quality-baseline-recovery` `TASK-007`, `repository-baseline-score-recovery` `TASK-008`, `p38-root-shell-modularity-hardening`, `p37-root-spa-companies-roles-admin`, and the related governance slices built on `p34-bounded-governance-coverage-expansion`, `p35-governance-baseline-sync-guardrails`, and `p36-bounded-doc-validator-ownership-alignment`. This refresh now also captures the implemented hotspot seam reductions that preserve the layered monolith while splitting `src/security/access-policies.js` into facade + registry + actor-scope + denial-audit ownership, extracting focused service seams in inventory, agent workspace, and product flows, and recording that the minimum and expanded validation matrix passed for the intended memory-session aggregate lane.

This refresh also records the completed `bcrypt-supply-chain-closeout` feature: the repository dependency baseline now uses `bcrypt@^6.0.0`, the prior approved bcrypt residual chain has been removed from the lockfile and audit baseline, and dependency hygiene now enforces a zero-residual posture.

## 2. Scope
In scope for the current plan:
- preserve the supported root shell under `src/public/root/` and its `/root/` entrypoint
- preserve the reduced public runtime and the legacy HTML `410 Gone` gate
- preserve relocation of the retired functional legacy browser runtime to `legacy-public-runtime/` as transitional backup/reference inventory only
- preserve the browser-session cookie model and reuse of `/api/auth/login`, `/api/auth/me`, and `/api/auth/logout`
- preserve explicit documentation that the remaining browser-session residual risk belongs to the HTTPS follow-up dependency in `specs/p11-https-browser-session-migration/` and is not an in-slice blocker for these bounded governance/documentation slices
- preserve wave-one root-shell eligibility for `root` and `admin` with `companyId`
- preserve actor-aware `/root/` shell navigation with root-global top navigation and the rebranded company-admin sidebar, keeping `#companies` for global root and `#roles_permissions` plus `#zones` for company-admin users with `companyId`
- preserve the current company-admin sidebar IA grouped into `Inicio`, `Operacion`, `Control`, and `Administracion`, while recognizing that many visible items still render the shared neutral `in_process` view
- preserve the implemented visual hardening of the company-admin sidebar: fixed header/footer, central-only scrolling, defensive overflow rules, collapsed-only tooltip reveal, and thin styled scrollbar treatment on `.root-sidebar__scroll`
- preserve the implemented Companies Admin shell flow over the existing root-company list/create/status endpoints
- preserve the implemented Roles/Permissions Admin shell flow over the existing permission catalog and company-role list/create endpoints
- preserve the implemented Zones shell flow over the existing company regions list/create and subregion-create endpoints
- preserve `/migration.html?mode=post-login-transition` for non-wave-one browser profiles
- preserve the extracted hotspot seams now in effect: `src/security/access-policy-registry.js`, `src/security/access-policy-actor-scope.js`, `src/security/access-policy-audit.js`, `src/services/inventory-alerts.service.js`, `src/services/agent-workspace-store-state.service.js`, `src/services/product-permission-shaping.service.js`, and `src/services/product-pricing.service.js`
- keep docs, validators, tests, and runtime contracts aligned to the implemented public runtime
- keep workflow-ownership wording aligned with the implemented validator/test baseline that reads hosted workflow truth from `../.github/workflows/` relative to `inventory-api/`
- preserve `docs/coding_standard.md` as the canonical coding-standards document while allowing the legacy hyphenated alias to remain only as a compatibility bridge
- keep the partial OpenAPI/typecheck coverage posture bounded to the selected governance-admin surfaces clarified by `p33`
- keep `tests/governance-baseline-sync-guardrails.test.js` as the focused documentation-sync guardrail for the selected post-`p34` statements only, not as repository-wide documentation automation
- reflect `docs/permission-governance-decisions.md` and the implemented `src/security/permission-governance*.js` foundation without overstating broader runtime enforcement
- record only the bounded follow-up work still visible after the implemented root-shell slice
- record the implemented bcrypt dependency closeout without overstating it as an auth redesign
- preserve stored-hash and hash-generation compatibility under `bcrypt@^6.0.0`
- preserve truthful documentation that Docker validation remains an environment evidence gap only

## 3. Out of scope
- reactivating legacy HTML pages as supported runtime
- migrating warehouse or agent browser areas into supported SPA surfaces
- redesigning backend auth APIs beyond the current cookie-session model
- changing database schema or migrations for this refresh
- introducing a frontend framework, bundler, or separate SPA deployment
- broadening root-shell eligibility or navigation beyond what is implemented today without a later approved slice

## 4. Requirements addressed
This plan reflects the implemented `zones-view`, `sidebar-rebrand-permissions` `TASK-001`, `TASK-002`, `TASK-003`, `TASK-004`, `quality-baseline-recovery` `TASK-007`, `repository-baseline-score-recovery` `TASK-008`, `p27`, `p28`, `p29`, `p30`, `p31`, `p32`, `p33`, `p34`, `p35`, `p36`, `p37`, and `p38` behavior now observable in code and tests:
- a new supported root SPA shell exists at `/root/`
- browser login routes wave-one root-eligible users to `/root/` instead of `/migration.html?mode=post-login-transition`
- the root shell reuses the existing browser-session model and `GET /api/auth/me` for bootstrap
- the root shell remains vanilla JS under `src/public/root/`
- the root shell includes authenticated layout, actor-aware client routing, basic guards, manifest-driven navigation, logout, and an `in_process` fallback
- global root sessions now keep top navigation, see `Empresas`, and can use bounded Companies Admin list/create/status flows from the shell
- company-admin sessions with `companyId` now receive the rebranded sidebar, see grouped tenant-admin navigation, land on `#admin_home` when no hash is present, and can use bounded permission catalog + company-role list/create flows from the shell through `Roles y permisos`
- company-admin sessions can also use the implemented `#zones` view to list zones, locally search zones/subzones, create zones, and create subzones through the existing company-regions endpoints
- the approved company-admin sidebar entries now have explicit route keys in `root/manifest.js`; `Roles y permisos` and `Zonas` are functionally implemented and the remaining current company-admin sidebar routes render the shared neutral `in_process` view
- layout ownership is normalized so the shell owns actor-specific offsets and outer content placement while views own only their internal module layout
- the company-admin sidebar now hardens latent overflow behavior by hiding tooltip boxes until collapsed hover/focus, applying defensive `box-sizing` and `min-width: 0` rules to nested wrappers, truncating long labels/footer text, and limiting the styled thin scrollbar to the central scroll region while header and footer remain fixed
- no runtime role update/delete/reassignment UI was added
- backend auth remains the source of truth; client guards are only UX gates
- a local minimal navigation manifest exists under `src/public/root/manifest.js`
- the first wave remains incremental and does not reactivate `/root/*.html` as supported runtime
- `/root/*.html`, `/warehouse/*.html`, and `/agent/*.html` still return the same-URL `410 Gone` migration response
- non-wave-one browser profiles still use the supported transition landing at `/migration.html?mode=post-login-transition`
- validators and tests now explicitly recognize `/root/` as supported and keep legacy HTML routes retired
- a centralized permission-governance policy foundation now exists under `src/security/`
- only a global `root` actor can create companies under the current governance evaluation rule
- company-role creation now rejects platform-scoped permissions such as `companies.manage` before persistence, while preserving warning-based audit metadata for non-approved deny candidates
- denied company-role governance attempts now emit dedicated service-level audit attempts through action `roles.company.create.governance_denied` with structured denial metadata while preserving the same `403` response contract
- company/company-role admin flows now expose a clearer route-policy/service-governance contract through explicit `global-root` and `company-admin` actor-scope checks in `src/security/access-policies.js`
- `POST /api/companies/` now uses the dedicated route policy `company.create-global` while preserving the same endpoint and `403` semantics
- bounded route-level actor-scope denials now emit safe audit attempts through action `security.authorization.access_policy`, remaining distinct from service-level governance denials
- bounded governance evidence now also includes `src/security/access-policies.js` in typecheck plus partial OpenAPI / critical-contract coverage for company listing/creation, root-company listing/creation, assignable-role-permission listing, and company-role listing/creation
- the in-scope legacy governance validator now reads canonical runtime-contract artifacts from `docs/**` rather than auxiliary `internal-docs/**` copies
- a focused ownership regression test now guards that validator/documentation alignment without expanding into repository-wide `internal-docs/**` cleanup
- the coding standards document path is now converged on `docs/coding_standard.md`, with the legacy hyphenated alias retained only as a compatibility bridge and protected by dedicated drift tests
- the coding standards path is now aligned so `docs/coding_standard.md` is authoritative, the legacy hyphenated alias is compatibility-only, and a dedicated repository test guards against stale hyphenated references in repo-owned docs/tests/scripts
- the access-policy hotspot is now split so declarative policy data, actor-scope checks, and route-level denial-audit behavior are separated while `authorizeAccessPolicy(...)` remains the stable facade contract
- inventory-alert behavior is now isolated in `src/services/inventory-alerts.service.js` while inventory stock and lot orchestration remain in `inventory.service.js`
- agent store-state, debt visibility, purchase-history shaping, and sorting are now isolated in `src/services/agent-workspace-store-state.service.js` while actor scoping and order delegation remain in `agent-workspace.service.js`
- permission-aware product shaping and general-price synchronization are now isolated in `src/services/product-permission-shaping.service.js` and `src/services/product-pricing.service.js` while `product.service.js` keeps higher-level CRUD/import orchestration
- `docs/documentation-ownership-map.md` now classifies `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`, canonical workflow ownership, and the extracted auth/service/repository seam examples

## 5. Current problems addressed
- the previous approved bcrypt residual chain `bcrypt@5.1.1 -> @mapbox/node-pre-gyp@1.0.11 -> tar@6.2.1` is now removed from the checked-in dependency tree
- dependency hygiene no longer carries approved residual vulnerabilities for this repository baseline
- stored bcrypt 5.x hashes remain compatible under the upgraded dependency path
Problems already corrected by earlier browser-runtime slices plus `p27`:
- the runtime no longer lacks a supported authenticated root destination for wave-one root users
- `root` and company `admin` users no longer depend on the temporary transition landing as their primary supported post-login destination
- the public-runtime validator and browser/runtime tests now distinguish the supported root shell from deprecated legacy HTML routes
- the embedded browser runtime still avoids reactivating functional legacy HTML pages
- the root shell reuses existing auth/session contracts instead of introducing a parallel browser auth model
- the residual browser-session hardening risk remains an explicit follow-up dependency in `specs/p11-https-browser-session-migration/` and is not an in-slice blocker for the current bounded governance/documentation slices
- `#zones` selection/filter behavior and dialog/feedback flows now have isolated characterization coverage and are no longer protected only by integrated shell/E2E coverage

Problems still open after `quality-baseline-recovery` `TASK-007`, `repository-baseline-score-recovery` `TASK-008`, and `p38`:
- non-wave-one browser roles still land on the transition page rather than a functional supported destination
- root-shell navigation remains local-manifest based and not yet integrated with any broader approved navigation model
- the company-admin sidebar still exposes many approved-but-not-yet-functional modules through the shared neutral `in_process` view; this is current supported behavior, but additional module implementation remains pending after `Roles y permisos` and `Zonas`
- browser-runtime `typecheck` now includes the approved `src/public/root/**` shell files through an explicit allowlist, while remaining intentionally bounded
- docs/tests/validators must continue staying synchronized so the root shell and legacy-route policies do not drift
- the new modularity guardrail is intentionally narrow and only freezes the currently approved containment baseline for `router.js` and `zones-admin.js`; broader root-shell decomposition is still pending if future slices grow `app.js` or introduce new sensitive modules
- the temporary coding-standards compatibility bridge should not be expanded back into a second independently maintained standards body
- permission governance remains only partially implemented: the central policy foundation, the stable `company.create` deny, the first enforced company-role create deny, denial-path audit visibility for that deny, and the bounded company/company-role admin actor-scope convergence seam now exist, but broader backend role-governance hardening, root-shell UI consumption, and repository-wide access-policy convergence remain pending
- the feature validation matrix is closed for the intended memory-session aggregate lane, but local Windows Prisma generate instability remains a separate documented platform issue during `npm run build`
- `src/services/agent-workspace.service.js` and `src/services/product.service.js` remain large service hotspots; the extracted seams reduce mixed responsibilities, but the production orchestration boundaries are still concentrated in those facade services
- metadata reconciliation for permission-governance sequencing is complete, and the former `p30-company-role-governance-hardening` plus `p32-governance-denial-audit-visibility` follow-up dependencies are now implemented for the current create-flow boundary
- no runtime company-role update flow exists yet, so update hardening remains deferred until an actual update surface is approved
- runtime-contract governance now converges on canonical `docs/**` artifacts for validator ownership, while `internal-docs/**` remains auxiliary support material only and other non-runtime-contract auxiliary consumers stay explicitly out of scope for this bounded slice
- workflow governance wording must continue to reflect the actual repository boundary where hosted workflow truth lives in the parent-root `../.github/workflows/` tree relative to `inventory-api/`, not in an app-root-local workflow directory

## 6. Domains affected
- Embedded browser runtime
- Identity and access
- Inventory
- Sales routing / agent workspace
- Product catalog
- Repository/platform governance
- CI/workflow governance
- Cross-cutting architecture documentation

## 7. Behavior to preserve
- `src/public/` remains the only active public runtime directory
- `/root/` remains the supported root-shell entrypoint
- root-shell bootstrap continues through the existing cookie-session model and `/api/auth/me`
- root-shell logout continues through `/api/auth/logout`
- global `root` keeps the current top-navigation shell variant
- company-admin keeps the rebranded sidebar shell variant
- the sidebar keeps header/footer fixed while only the middle navigation lane scrolls
- hidden tooltip boxes stay display-gated until collapsed hover/focus instead of contributing to layout width
- `root` and `admin` with `companyId` continue landing on `/root/`
- company-admin continues defaulting to `#admin_home` when no hash is present
- explicit company-admin sidebar route items remain declared in `src/public/root/manifest.js`
- non-functional company-admin sidebar routes continue rendering the shared neutral `in_process` view
- the implemented `#zones` flow continues using the existing company-regions endpoints and local in-memory search rather than introducing new backend search contracts
- shell-owned global offsets remain separate from per-view internal layout
- deprecated legacy HTML routes keep returning `410 Gone` and the migration screen from the same URL without redirect
- `/migration.html?mode=post-login-transition` remains a supported 200 response for non-wave-one browser profiles
- `legacy-public-runtime/` remains outside the served runtime and outside implicit rollback behavior
- `npm run validate:public-runtime` and the affected browser/runtime tests remain aligned to the implemented public surface

## 8. Defects to correct
### Medium
- non-wave-one browser roles still depend on the transition landing

### Low
- the root shell still relies on plain ordered static scripts even though internal registration/lookup is now centralized through `window.RootShell`

### Low
- preserved `legacy-public-runtime/` inventory may drift over time because it is no longer governed as active runtime

## 9. Future architectural changes
Incremental future changes now visible:
1. preserve the implemented actor-aware `/root/` shell as the supported admin browser baseline, including root top-nav and company-admin sidebar variants;
2. keep legacy HTML deprecation enforced at the HTTP boundary;
3. extend the root shell only through later approved bounded slices, rather than expanding it through legacy-page restoration;
4. extend the richer company-admin sidebar IA beyond the current shared neutral `in_process` placeholders through explicit module implementations, building on the already-functional `#roles_permissions` and `#zones` routes;
5. decide whether additional browser roles should later move from `/migration.html?mode=post-login-transition` into supported shell destinations;
6. decide whether the bounded root-shell `typecheck` allowlist should later widen beyond the current approved file set;
7. keep unsupported company edit/delete/detail and role update/delete/reassignment flows out of the shell until backed by approved slices and real runtime contracts;
8. preserve the implemented bounded company/company-role admin convergence seam as the current baseline rather than reinterpreting it as pending work;
9. preserve `legacy-public-runtime/` only as transitional backup/reference inventory until equivalent SPA sections are implemented and validated, then remove it in a later approved slice;
10. retire the legacy hyphenated coding-standards compatibility bridge only after repository and external consumers no longer depend on that alias path;
11. preserve and extend the newly implemented `quality-baseline-recovery` growth guardrails for sensitive root-shell modules as future slices touch `router.js`, `zones-admin.js`, `app.js`, or new high-risk shell files;
12. keep the new hotspot seam split as the implemented baseline and, if future hardening is approved, continue reducing central services only through additive extractions behind the current facades rather than through a broad folder redesign;
13. preserve the completed `hotspot-seams-doc-ownership` `TASK-008` validation baseline, including the passing memory-session aggregate lane and the separate tracking of the Windows Prisma generate rename-lock issue.

## 10. Database changes
No database change is planned for this post-implementation refresh.

## 11. API and integration changes
No immediate API contract change is planned.

Current integration posture to preserve:
- auth/session APIs remain stable;
- `POST /api/auth/logout` remains part of the governed runtime contract baseline;
- `GET /health` remains a stable liveness response;
- `GET /health/ready` remains the operational readiness boundary for database + browser-session-store dependencies;
- the deprecated legacy HTML contract remains an HTTP `410` response contract, not a redirect contract;
- `/root/` remains a supported browser entrypoint backed by static assets in the same Express runtime.

## 12. Container and deployment changes
No versioned container-file change is required for this closeout refresh.

Operational follow-up still visible:
- rerun Docker build/runtime validation for the upgraded native bcrypt path when Docker daemon access is available;
- keep this as an environment-evidence follow-up only, not as a residual vulnerability or code-level defect.

No new container or deployment change is currently required.

Container baseline to preserve:
- `node:24-bullseye-slim`
- multi-stage build
- non-root runtime
- readiness healthcheck
- Redis-backed supported non-test browser-session baseline

## 13. Security changes
Security/governance posture now reflected by the repository:
- the previously documented bcrypt supply-chain residual is closed;
- `audit-baseline.json` and `docs/audit/dependency-hygiene-baseline.md` now record a zero-vulnerability npm audit posture;
- `scripts/validate-dependency-hygiene.js` rejects any future residual drift by default.

Security posture to preserve:
- same-origin cookie-session auth model for supported browser flows
- no persisted bearer tokens in `localStorage`
- same-origin `Origin` validation for mutating cookie-authenticated requests
- strict CSP on supported public documents and deprecated legacy HTML responses
- backend auth as the final authority while root-shell guards remain UX-only

Future security follow-up may include:
- expanding supported shell destinations for additional browser roles only through approved slices
- expanding static analysis coverage over root-shell files
- extending governance-denial observability only if later approved operations add new enforced deny paths
- continuing broader HTTPS/cookie hardening tracked in the existing browser-session follow-up work

## 14. Test strategy
- preserve `tests/bcrypt-supply-chain-closeout.test.js` as characterization coverage for stored-hash compatibility and current hash-generation call sites
- preserve `tests/dependency-hygiene-governance.test.js` as the zero-residual governance guardrail
- preserve clean-workspace validation evidence for `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test -- --silent`, `npm run verify`, `npm audit --json`, and `npm run validate:dependency-hygiene`
- rerun Docker-specific validation only when an environment with Docker daemon access is available

Continue validating the implemented repository baseline through:
1. `npm run validate:public-runtime`
2. `node --test tests/public-surface-characterization.test.js`
3. `node --test tests/public-runtime-http-smoke.test.js`
4. `node --test tests/root-shell-route-governance.test.js`
5. `node --test tests/root-shell-modularity-governance.test.js`
6. `node --test tests/zones-view-selection-filters-characterization.test.js`
7. `node --test tests/zones-view-dialog-feedback-characterization.test.js`
8. `node --test tests/zones-view.e2e.js`
9. `node --test tests/browser-e2e.e2e.js`
10. `node --test tests/inventory-service-hotspot-characterization.test.js tests/inventory-alerts-tenant-scope.test.js tests/approval-baseline-compatibility.test.js`
11. `node --test tests/agent-workspace-hotspot-characterization.test.js tests/product-service-hotspot-characterization.test.js`
12. `npm run lint:public-runtime`
13. `npm run lint`
14. `npm run typecheck`
15. `npm run build`
16. `set NODE_ENV=test&& set BROWSER_SESSION_STORE_MODE=memory&& node --test tests/access-policies.test.js tests/administrative-authorization-characterization.test.js tests/authorization-convergence-characterization.test.js`
17. `node --test tests/documentation-ownership-governance.test.js tests/p36-doc-validator-ownership.test.js tests/workflow-baseline-characterization.test.js`
18. `node --test tests/agent-workspace-hotspot-characterization.test.js tests/agent-workspace-tenant-scope.test.js tests/agent-workspace-contract-characterization.test.js`
19. `node --test tests/product-service-hotspot-characterization.test.js tests/product-delete-semantics.test.js tests/pagination.test.js`

Hotspot characterization notes to preserve:
- characterization coverage now exists for the current `inventory.service` seam and should remain in place before any future refactor of pagination logic, alert transitions, transaction propagation, or the boundary with `inventory-transaction-support.service.js`
- characterization coverage now exists for selected `agent-workspace.service` seams and should remain in place before any future refactor of tenant-scoped store filtering/serialization or order delegation behavior
- characterization coverage now exists for selected `product.service` seams and should remain in place before any future refactor of repository transaction ownership, derived lot decoration, or import-time inventory coupling
- characterization coverage now exists for the current access-policy split and should remain in place before any future cleanup of strict policy lookup, actor-scope enforcement, denial-audit behavior, or route-policy mappings
- documentation ownership governance coverage now exists for canonical vs auxiliary/historical artifact boundaries and should remain in place before any future workflow/doc authority cleanup

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

- focused permission-governance tests such as `tests/permission-governance-foundation.test.js` and `tests/permission-governance-backend-consumption.test.js`
- focused audit instrumentation coverage such as `tests/audit-instrumentation.test.js`

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

Recorded post-implementation evidence supplied by the user:
- `npm run validate:public-runtime` passed
- `npm run lint:public-runtime` passed
- `npm run typecheck` passed
- `npm run lint -- --quiet` passed
- `npm run build` passed
- `node --test tests/browser-e2e.e2e.js` passed
- `node --test tests/public-runtime-http-smoke.test.js tests/public-surface-characterization.test.js tests/browser-runtime-auth-convergence-inventory.test.js` passed

Test-baseline notes to preserve:
- `npm run test` still routes through `scripts/run-tests.js`
- the runner still defaults to `NODE_ENV=test` and `BROWSER_SESSION_STORE_MODE=memory` unless explicitly overridden
- the new root shell is currently governed by an explicit bounded browser-runtime `typecheck` allowlist plus lint, validator, smoke, characterization, and browser E2E coverage

## 15. Migration stages
### Stage 30 — Completed
- Close the approved bcrypt supply-chain remediation by upgrading to `bcrypt@^6.0.0`, removing the `@mapbox/node-pre-gyp` / `tar` residual chain from the checked-in dependency tree, adding stored-hash compatibility coverage, and moving dependency hygiene to a zero-approved-residual baseline

### Stage 31 — Proposed
- Rerun Docker build/runtime validation for the native bcrypt path in an environment with Docker daemon access and attach evidence without changing the approved zero-residual dependency posture

### Stage 1 — Completed
- Reduce the active public runtime to the supported minimal baseline in `src/public/`

### Stage 2 — Completed
- Introduce the common migration response for deprecated legacy HTML routes with `410 Gone` and no redirect

### Stage 3 — Completed
- Relocate the preserved functional legacy runtime to `legacy-public-runtime/`

### Stage 4 — Completed
- Rewrite public-runtime validators and tests to govern the reduced supported contract

### Stage 5 — Completed
- Refresh repository documentation to match the reduced runtime state

### Stage 6 — Completed
- Replace historical post-login HTML aliases with the supported interim transition landing at `/migration.html?mode=post-login-transition`

### Stage 7 — Completed
- Realign repository test and runtime-contract governance to the reduced supported runtime and stable aggregate test runner

### Stage 8 — Completed
- Converge canonical runtime-contract governance onto reviewed `docs/**` artifacts and keep `internal-docs/**` auxiliary only

### Stage 9 — Completed
- Add the explicit Redis-path validation command and hosted workflow lane while preserving the stable memory-mode aggregate suite

### Stage 10 — Completed
- Strengthen Redis operational safeguards by wiring browser-session-store readiness into `/health/ready`

### Stage 11 — Completed
- Introduce the supported wave-one root shell at `/root/`, including bootstrap, guards, minimal navigation, home view, `in_process` fallback, and logout

### Stage 12 — Completed
- Expand the supported `/root/` shell with actor-aware bounded admin routes:
  - `#companies` for global root
  - `#roles_permissions` for company admin with `companyId`

### Stage 13 — Completed
- Add bounded root-shell adapters and views for:
  - root-company list/create/status flows
  - company-role permission catalog, role list, and role creation flows

### Stage 14 — Completed
- Add the approved bounded browser-runtime typecheck allowlist for the supported `src/public/root/**` shell files without broadening to all `src/public/**`

### Stage 15 — Completed
- Apply the first rebranded company-admin sidebar shell over the supported `/root/` runtime while preserving root-global top navigation, the existing backend/API contracts, and the current actor split

### Stage 16 — Completed
- Reconcile sidebar manifest, router semantics, and `in_process` content so visible company-admin entries have explicit documented destination behavior
- Normalize shell/view layout ownership so shell-level offsets are not duplicated inside admin views
- Harden the implemented company-admin sidebar against latent horizontal overflow and lock the CSS contract in `tests/public-surface-characterization.test.js`

### Stage 17 — Proposed
- Add the next supported root-shell modules beyond the current bounded Companies and Roles/Permissions views through approved incremental slices

### Stage 18 — Proposed
- Replace transition-only landings for additional browser roles when approved supported destinations exist

### Stage 19 — Proposed
- Expand browser-runtime typecheck coverage only if a later approved slice widens the current bounded root-shell allowlist

### Stage 20 — Completed
- Introduce centralized permission-governance foundation, first stable `company.create` deny, and warning-based backend consumption for company-role creation

### Stage 21 — Completed
- Harden company-role creation so platform-scoped permissions such as `companies.manage` are denied before persistence while non-approved sensitive combinations remain warning-only

### Stage 22 — Completed
- Add dedicated denial-path audit visibility for the approved company-role create deny using the existing safe audit seam while preserving the same `403` response contract

### Stage 23 — Completed
- Introduce bounded actor-scope convergence in route policies for company/company-role admin flows while preserving service-level governance enforcement, dedicated `company.create-global`, and distinct route-level versus service-level denial auditing

### Stage 24 — Completed
- Align the in-scope legacy runtime-contract governance validator to canonical `docs/**` ownership and add bounded regression coverage so `internal-docs/**` remains auxiliary only for this seam

### Stage 25 — Completed
- Align coding-standards documentation ownership so `docs/coding_standard.md` is canonical, the legacy hyphenated alias is compatibility-only, and `tests/coding-standard-path-alignment.test.js` protects against stale repo-owned hyphenated references

### Stage 26 — Completed
- Add isolated characterization for `#zones` dialogs and feedback flows, preserving the current DOM/API contract while extracting only small helper seams for reset, inline error rendering, and submit-button state

### Stage 27 — Completed
- Freeze the current root-shell containment baseline with verifiable modularity guardrails over the bounded `window.RootShell` registry contract, isolated router characterization, and the extracted zones helper seams

### Stage 28 — Proposed
- Consume the governance foundation in additional backend role-governance operations and approved UI slices, including any future update-flow hardening once an update surface exists

### Stage 29 — Completed
- Reduce the `hotspot-seams-doc-ownership` hotspots incrementally by preserving the access-policy facade, extracting registry / actor-scope / denial-audit seams, extracting focused inventory / agent-workspace / product service seams, consolidating the canonical documentation ownership map, and closing the intended memory-session validation matrix

## 16. Risks and mitigations
| Native bcrypt path was upgraded successfully, but Docker-specific validation was not rerun in the implementation environment | Low | Keep documentation explicit that this is only an environment evidence gap; rerun Docker validation when daemon access is available |

| Risk | Level | Mitigation |
|---|---|---|
| Legacy HTML runtime is accidentally reintroduced into `src/public/` or treated as supported again | High | Keep `validate-public-runtime`, browser/runtime characterization tests, and docs aligned to the supported inventory |
| Future work changes `/root/` behavior without updating validators and browser tests | High | Keep root-shell contract checks in validator, smoke tests, characterization tests, and browser E2E |
| The richer company-admin sidebar IA is misread as fully implemented module coverage instead of mostly shared `in_process` placeholders | Medium | Keep docs explicit that `Roles y permisos` and `Zonas` are the current functional tenant-admin destinations and add new functional modules only through approved slices |
| Non-wave-one roles remain on an informational transition landing longer than expected | Medium | Keep the behavior explicit in docs and move those roles only through approved supported-destination slices |
| Root shell now uses a bounded `window.RootShell` registry seam, but still depends on plain ordered static scripts and not on a broader module system | Low | Preserve current validator/test coverage, keep the allowlist explicit, and defer any framework/ES-module redesign to a later approved slice |
| Permission-governance follow-up sequencing is misread because `p10` is analysis, `p28` is only a partial runtime implementation, and future contributors may reintroduce stale dependency metadata | Medium | Record the partial implementation explicitly, preserve the completed `p29` reconciliation plus the closed `p30` and `p32` follow-up slices in docs/spec metadata, and do not overstate current enforcement scope |
| Preserved `legacy-public-runtime/` inventory drifts or is misread as active support | Low | Keep docs explicit that it is transitional backup/reference inventory outside the active runtime |
| A maintainer restores the legacy hyphenated coding-standards alias as a second full standards body or reintroduces stale repo-owned hyphenated references | Low | Keep `docs/coding_standard.md` authoritative, preserve the compatibility notice only, and keep `tests/coding-standard-path-alignment.test.js` green |

## 17. Rollback or recovery strategy
- Do not reactivate legacy HTML runtime from `legacy-public-runtime/` as an implicit rollback.
- If future follow-up work regresses the root shell, revert only the affected bounded browser-runtime slice.
- Preserve the `410 Gone` gate, reduced `src/public/` inventory, and the supported `/root/` entrypoint unless a new approved spec explicitly changes the supported browser contract.

## 18. Manual validation
- confirm `package.json` still declares `bcrypt@^6.0.0`
- confirm the lockfile no longer resolves the bcrypt path through `@mapbox/node-pre-gyp` or `tar`
- confirm `npm audit --json` remains at `0` vulnerabilities in a clean workspace
- confirm `npm run validate:dependency-hygiene` still reports `Approved residual set: none`
- rerun Docker build/runtime validation only in an environment with Docker daemon access

For future follow-up work, manually confirm:
- `src/public/` still contains the supported root shell and does not re-expose warehouse or agent runtime directories
- `/root/` still loads successfully
- `#zones` still loads for company-admin users, performs search locally, and creates zones/subzones through the existing company-regions endpoints
- docs and specs distinguish clearly between `p10` analysis outputs and the implemented `p28` and `p30` runtime slices
- permission-governance dependency metadata no longer treats `p30-company-role-governance-hardening` or `p32-governance-denial-audit-visibility` as pending for the current company-role create-flow boundary
- `docs/coding_standard.md` remains the full coding-standards body and the legacy hyphenated alias remains only a compatibility notice
- root/admin browser sessions still land on `/root/`
- invalid root-shell sessions still return to login
- direct legacy HTML routes under `root`, `warehouse`, and `agent` still return the migration response with HTTP `410 Gone` and no redirect
- `/migration.html?mode=post-login-transition` still behaves as the supported transition landing for non-wave-one profiles
- `npm run validate:public-runtime` and the affected browser/runtime tests still pass when touching browser-runtime seams

## 19. Approval status
The `bcrypt-supply-chain-closeout` implementation itself is complete from a repository-code and governance perspective. The previously recorded environment-specific Docker evidence follow-up has now been executed successfully; remaining follow-up is limited to general native-module/toolchain operational awareness rather than unfinished bcrypt remediation.

**Status:** Documentation refresh now reflects the implemented state after `hotspot-seams-doc-ownership` tasks 1-8 in addition to the previously completed browser/runtime and governance slices. The repository now documents the active access-policy split (`access-policies.js` facade plus registry / actor-scope / denial-audit helpers), the extracted inventory/agent-workspace/product service seams, the canonical documentation ownership map including `docs/tasks.md`, and the focused documentation-governance test coverage. No additional production API or database redesign is documented here. Remaining follow-up is limited to future additive seam work and the separately documented local Windows Prisma rename-lock instability during build generation.