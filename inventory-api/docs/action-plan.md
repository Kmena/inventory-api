# Architectural Action Plan

## 1. Objective
Keep architecture-facing documentation synchronized with the real repository state after `inventory-admin-views` `TASK-007` (modern products/inventory view) and `TASK-008` (frontend administration surface for categories), together with the previously documented `inventory-admin-views` `TASK-006` movements implementation, `TASK-005` warehouses implementation, `hotspot-seams-doc-ownership` tasks 1-8 closure, `zones-view`, `coding-standard-doc-path-alignment`, `sidebar-rebrand-permissions` `TASK-004`, `quality-baseline-recovery` `TASK-007`, `repository-baseline-score-recovery` `TASK-008`, `p38-root-shell-modularity-hardening`, `p37-root-spa-companies-roles-admin`, `root-shell-commercial-views`, `root-shell-commercial-views-hardening`, `root-admin-recipes-production`, `session-docs-tenant-hardening` `TASK-004` through `TASK-008`, the later `recipes-production-qa-execution-hardening` Fase 2 / `TASK-006` functional implementation, `recipes-production-qa-execution-hardening` Fase 2 / `TASK-007`, and the related governance slices built on `p34-bounded-governance-coverage-expansion`, `p35-governance-baseline-sync-guardrails`, and `p36-bounded-doc-validator-ownership-alignment`. This refresh now also captures that `#products` graduated from a route-specific placeholder to a functional company-admin screen over the existing product and tenant-category backend contracts, that `#recetas` and `#produccion_ordenes` are now mounted as dedicated root-shell routes instead of generic placeholders, that successful company-role permission updates now invalidate affected browser sessions even though their shipped UI depth and failure semantics remain intentionally limited in the current implementation, and that the later `rfq-hardening-alignment` slice closed the public RFQ throttling/runtime-alignment gap while leaving broader repository lint/test debt outside the RFQ scope. This refresh also captures the later browser-only `supplier-management` / `rfq-tracking-admin` layout cycle: `#seguimiento_cotizaciones` now uses the same commercial sidebar+detail pattern as the other commercial admin views, the old renderer export `renderTrackingTable` is no longer part of the active browser contract, and the active RFQ tracking CSS baseline now includes `.rfq-tracking-sidebar-list`, `#rfq-tracking-detail-panel`, and the mobile max-height override.

This refresh also records the completed `bcrypt-supply-chain-closeout` feature: the repository dependency baseline now uses `bcrypt@^6.0.0`, the prior approved bcrypt residual chain has been removed from the lockfile and audit baseline, and dependency hygiene now enforces a zero-residual posture.

This refresh also captures the completed `supply-inventory-entry` `TASK-001`, `TASK-002`, `TASK-003`, `TASK-004`, `TASK-005`, `TASK-006`, `TASK-007`, `TASK-008`, `TASK-009`, `TASK-010`, `TASK-011`, `TASK-012`, `TASK-013`, `TASK-014`, and `TASK-015` implementations, together with the completed `purchase-orders-workspace` implementation cycle, as current repository truth: the product module now contains the first additive sourcing/inventory-classification foundation, the security module contains the first additive permission/policy governance foundation required for later production, procurement, receipt, and warehouse/QA work, the backend contains the additive recipe/versioning foundation mounted at `/api/recipes`, the backend also contains production-order lifecycle plus stage-execution/consumption/waste/return, quality-inspection, and QA-gated completion foundations mounted at `/api/production`, with `ProductionConsumption.lotId`, `ProductionWaste.lotId`, and `ProductionReturn.lotId` now mandatory and FK-backed to `Lot`, `QualityInspection` now FK-backed to `ProductionOrder`, `ProductionStageExecution`, and optional `Lot`, `ProductionItem.consumedQuantity` now explicitly synchronized as an auxiliary aggregate from `SUM(ProductionConsumption.quantity)` at order scope, and finished-goods completion now posting `PRODUCTION_RECEIPT` into destination inventory; the backend also contains the first procurement foundation mounted at `/api/procurement` for purchase requests, supplier quotations, quotation comparison, supplier selection, optional approval, purchase-order creation, quotable-product listing, supplier-pricing lookup, and grouped assisted quotation-request creation without inventory mutation; and the root shell now includes an implemented company-admin `#cotizaciones` route with approved runtime assets `root/quotations-api.js`, `root/views/quotations-admin.helpers.js`, `root/views/quotations-admin.renderers.js`, and `root/views/quotations-admin.js` over that procurement quotation-workspace contract; the final cross-layer convergence suite `tests/procurement-quotation-workspace-convergence.test.js` now freezes the integrated migration + backend + root-shell seam for `procurement-quotation-workspace` `TASK-008`. The backend now also contains the implemented receipt foundation mounted at `/api/receipts` for actual-arrival receipt documents, per-item inspections, transactional confirmation/reversal stock workflows with `confirmedLotId` traceability, and receipt-scoped fiscal-reference persistence as pending handoff metadata only. This refresh additionally captures the remediation migration `20260819000000_backfill_production_permission_catalog`, which ensures already-provisioned databases contain the approved `recipes.*` and `production.*` permission rows required by `GET /api/roles/permissions` and the root `#roles_permissions` UI. Later supply tasks remain future changes, with `TASK-016` now the next downstream step. The `purchase-orders-workspace` cycle is now complete: `#solicitudes_compra` and `#ordenes_compra` are implemented root-shell views, `GET /api/procurement/orders` is an active tenant-scoped backend contract, `quotations-api.js` now exposes comparison/selection/approval/purchase-order helpers, and the quotations workspace now includes the comparison extension point plus approval-to-OC handoff. The latest user-supplied final-cycle validation for the implemented supplier-management, RFQ, and purchase-orders repository state is repository-wide rather than targeted only: `npm run typecheck` passed, `npm run lint` passed, and broad `npm test -- --silent` passed with `1015/1017` tests passing, `0` failing, `2` skipped, and governance tests reported green after the baseline audit file correction.

## 2. Scope
In scope for the current plan:
- preserve the supported root shell under `src/public/root/` and its `/root/` entrypoint
- preserve the reduced public runtime and the legacy HTML `410 Gone` gate
- preserve relocation of the retired functional legacy browser runtime to `legacy-public-runtime/` as transitional backup/reference inventory only
- preserve the browser-session cookie model and reuse of `/api/auth/login`, `/api/auth/me`, and `/api/auth/logout`
- preserve the reviewed compatibility baseline that `tests/browser-session-auth-boundary.test.js` now provides for supported auth-route cookie behavior (`login` issuing the cookie pair, `/me` refreshing browser-session cookies, and `logout` invalidating/clearing them)
- preserve explicit documentation that the remaining browser-session residual risk belongs to the HTTPS follow-up dependency in `specs/p11-https-browser-session-migration/` and is not an in-slice blocker for these bounded governance/documentation slices
- preserve wave-one root-shell eligibility for `root` and `admin` with `companyId`
- preserve actor-aware `/root/` shell navigation with root-global top navigation and the rebranded company-admin sidebar, keeping `#companies` for global root and `#warehouses`, `#products`, `#lots`, `#movements`, `#proveedores`, `#solicitudes_compra`, `#cotizaciones`, `#seguimiento_cotizaciones`, `#ordenes_compra`, `#recetas`, `#produccion_ordenes`, `#billing`, `#approvals`, `#roles_permissions`, `#zones`, `#agents`, `#clients`, and `#routes` as the current implemented company-admin destinations for users with `companyId`
- preserve the current `#seguimiento_cotizaciones` browser layout contract: `commercial-layout commercial-layout--rfq-tracking`, a `commercial-list-card` sidebar backed by `.rfq-tracking-sidebar-list`, a `commercial-detail-card` detail panel backed by `#rfq-tracking-detail-panel`, first-item auto-selection, previous-selection restoration on refresh when possible, and manual-response actions rendered in the detail region rather than the list region
- preserve the current RFQ tracking renderer split in `src/public/root/views/rfq-tracking-admin.renderers.js`, where `renderTrackingTable` is removed and the active export contract is `renderEmptyState`, `renderDetailPlaceholder`, `renderRequestListItem`, `renderRequestDetail`, and `renderManualResponseDialog`
- preserve the reviewed actor-scoped root-shell fallback behavior frozen by `tests/root-shell-router-characterization.test.js` and `tests/root-shell-route-governance.test.js`, including fallback to `home` for root-only denials and `admin_home` for company-admin denials or unknown hashes
- preserve the now-implemented inventory shell adapter seams in `src/public/root/products-api.js`, `categories-api.js`, `inventory-api.js`, and `warehouses-api.js`, plus their loader-contract governance in `root/runtime-contract.js`, `root/index.html`, and `scripts/validate-public-runtime.js`
- preserve the implemented warehouses view seams in `src/public/root/views/warehouses-admin.js`, `warehouses-admin.helpers.js`, and `warehouses-admin.renderers.js`, including permission-aware read-only versus create behavior, in-memory filtering, and the existing `/api/warehouses/company` contract
- preserve the implemented products view seams in `src/public/root/views/products-admin.js`, `products-admin.helpers.js`, `products-admin.renderers.js`, and `products-admin.state.js`, including permission-aware product/category actions, paginated product listing, local current-page search/category filtering, detail loading, and the existing `/api/products/**` plus `GET/POST /api/products/categories/company` contracts
- preserve the implemented movements view seams in `src/public/root/views/movements-admin.js`, `movements-admin.helpers.js`, and `movements-admin.renderers.js`, including permission-aware read-only access, server-side filters, pagination, drawer detail behavior, and the existing `GET /api/inventory/movements` contract
- preserve the implemented tenant-scoped product category backend contract at `GET/POST /api/products/categories/company`
- preserve the current company-admin sidebar IA grouped into `Inicio`, `Operacion`, `Control`, and `Administracion`, including the implemented `Produccion` group (`#recetas`, `#produccion_ordenes`) and the partially implemented `Compras` group where `#proveedores`, `#solicitudes_compra`, `#cotizaciones`, `#seguimiento_cotizaciones`, and `#ordenes_compra` are functional while `#recepciones` and `#referencias_fiscales` still render the shared neutral `in_process` view
- preserve the implemented visual hardening of the company-admin sidebar: fixed header/footer, central-only scrolling, defensive overflow rules, collapsed-only tooltip reveal, and thin styled scrollbar treatment on `.root-sidebar__scroll`
- preserve the implemented Companies Admin shell flow over the existing root-company list/create/status endpoints
- preserve the implemented Roles/Permissions Admin shell flow over the existing permission catalog and company-role list/create/update endpoints, including metadata-backed permission presentation, server-side exclusion of platform-scoped permission entries from `GET /api/roles/permissions` for company-admin callers, global-role read-only treatment, self-lockout protection on own-role edits, and the current production-category grouping used by the root catalog path (`recipes.*` + `production.*`, excluding `quality.*`)
- preserve the implemented Zones shell flow over the existing company regions list/create and subregion-create endpoints
- preserve the implemented Agents shell flow over the existing company users, company roles, and sales-routes overview/assignment endpoints
- preserve the implemented Clients shell flow over the existing clients, classifications, document-types, regions, taxpayer, and economic-activities endpoints, including the aligned `/api/taxpayers/lookup?identification=...` browser adapter contract
- preserve the implemented Routes shell flow over the existing sales-routes and regions endpoints
- preserve the extracted commercial renderer/state seams now in effect: `src/public/root/views/agents-admin.renderers.js`, `src/public/root/views/clients-admin.renderers.js`, `src/public/root/views/clients-admin.state.js`, `src/public/root/views/routes-admin.renderers.js`, and `src/public/root/views/routes-admin.state.js`
- preserve the narrow behavior-preserving cleanup inside `src/services/payment.service.js` validated by the existing payment regression lanes
- preserve `/migration.html?mode=post-login-transition` for non-wave-one browser profiles
- preserve the extracted hotspot seams now in effect: `src/security/access-policy-registry.js`, `src/security/access-policy-actor-scope.js`, `src/security/access-policy-audit.js`, `src/services/inventory-alerts.service.js`, `src/services/agent-workspace-store-state.service.js`, `src/services/product-permission-shaping.service.js`, and `src/services/product-pricing.service.js`
- preserve the implemented `supply-inventory-entry` `TASK-001` product foundation: additive product enums/fields, `product_allowed_warehouses`, additive `product_suppliers` authorization metadata, tenant-scoped warehouse/supplier validation before persistence, and update-path stripping of client-supplied `companyId`
- preserve the implemented `supply-inventory-entry` `TASK-002` security/governance foundation: named supply/intake access policies in `src/security/access-policy-registry.js`, centralized permission metadata plus `requiresJustification` markers in `src/security/permission-governance.config.js`, helper discovery in `src/security/permission-governance.service.js`, and proposed operational bundles in `src/security/role-bundles.config.js`; in current code that bundle inventory also includes `company_admin`, whose approved production grouping for this scope is `recipes.*` plus `production.*`, explicitly excluding `quality.*`
- preserve the implemented `supply-inventory-entry` `TASK-003` recipe/versioning foundation: additive Prisma version tables, mounted `/api/recipes` route group, tenant-scoped nested product-reference validation, draft-only mutation semantics, and approval transition behavior
- preserve the current `root-admin-recipes-production` browser baseline truthfully: `#recetas` now has dedicated manifest/router/runtime wiring plus `recipesApi`, `productsApi`, and recipe helper/state/renderer seams, and ships a usable administrative workflow for list/detail/filter/create/version/approve/assignment behavior; `#produccion_ordenes` now has dedicated manifest/router/runtime wiring plus the read-only `productionAdminApi` and production-order helper/state/renderer seams, and ships a usable read-only supervision workflow for list/detail/filter behavior; neither route should be misdocumented as generic `in_process` placeholder behavior, the explicit limitation remains that only pagination is server-side while the remaining production-order filters are client-side over the loaded page, and within the broader root-shell supply slice the remaining placeholders are now only `#recepciones` and `#referencias_fiscales`
- preserve the implemented `supply-inventory-entry` `TASK-004`, `TASK-005`, `TASK-006`, `TASK-007`, `TASK-008`, `TASK-009`, `TASK-010`, and `TASK-011` production/quality foundation: additive `ProductionOrderStatus`, mounted `/api/production` route group, tenant-scoped production order create/list/detail/submit/approve/start/execute/return/complete/cancel flows, frozen `recipeVersionSnapshot`, persisted `ProductionStageExecution` / `ProductionConsumption` / `ProductionWaste` / `ProductionReturn` / `QualityInspection`, DB-enforced `ProductionConsumption -> Lot`, `ProductionWaste -> Lot`, `ProductionReturn -> Lot`, and `QualityInspection -> ProductionOrder/ProductionStageExecution/(optional) Lot` integrity, service-layer guardrail enforcement with justified `production.override`, route-level `quality.inspect` / `quality.view` enforcement for inspection endpoints, QA status transitions to and from `QA_HOLD`, reusable `checkMandatoryQaGatesForOrder`, active `PRODUCTION_RECEIPT` finished-goods intake on completion, and explicit synchronization/reconciliation of `ProductionItem.consumedQuantity` as an auxiliary aggregate derived from order-scoped `ProductionConsumption` detail
- preserve the implemented `supply-inventory-entry` `TASK-012` procurement foundation: mounted `/api/procurement` route group, additive Prisma procurement enums/tables, tenant-scoped purchase request list/create/detail flows, supplier quotation creation, quotation comparison, supplier selection, optional threshold-based approval, purchase-order creation from approved selection, active purchase-order listing through `GET /api/procurement/orders`, additive quotation-workspace backend support (`GET /api/procurement/quotable-products`, `GET /api/procurement/products/:id/suppliers-pricing`, `POST /api/procurement/products/:id/request-quotations`), grouped assisted quotation payload validation, convergence migrations `20260822000000_backfill_suppliers_permission_catalog` and `20260822001000_backfill_supplier_product_pricing_convergence`, the implemented company-admin `#cotizaciones` runtime workflow over `root/quotations-api.js`, `root/views/quotations-admin*.js`, and the comparison extension point in `root/views/quotations-comparison*.js`, the implemented dedicated `#seguimiento_cotizaciones` runtime workflow over `root/rfq-tracking-api.js` and `root/views/rfq-tracking-admin*.js`, the implemented `#solicitudes_compra` runtime workflow over `root/views/purchase-requests-admin*.js`, the implemented `#ordenes_compra` runtime workflow over `root/purchase-orders-api.js` and `root/views/purchase-orders-admin*.js`, the cross-layer convergence suites `tests/procurement-quotation-workspace-convergence.test.js` and `tests/purchase-orders-workspace-views-characterization.test.js`, and explicit non-stock-mutating behavior until a later receipt-confirmation slice is approved
- preserve the implemented supplier RFQ invitation lifecycle: additive Prisma model `SupplierQuotationInvitation` plus enum `SupplierQuotationInvitationStatus`, migration `20260823000000_add_supplier_quotation_invitations`, internal tenant-scoped RFQ endpoints under `/api/procurement/requests/:id/rfq-invitations`, `/api/procurement/rfq-invitations/:id/*`, and `/api/procurement/rfq-tracking`, public unauthenticated supplier token flow under `/api/public/supplier-quotations/:token`, SHA-256 token-hash-only persistence, route-specific public throttling (`GET` `30/min`, `POST` `10/min`), lazy persistence of stale invitations to `EXPIRED`, the public `/supplier-quote/` page, the dedicated `#seguimiento_cotizaciones` root route plus RFQ tracking browser modules, request-item-aware tracking serialization for manual capture, terminal expired-invitation rendering in the tracking UI, and RFQ audit instrumentation in `src/services/procurement-rfq.service.js`, while preserving that the procurement slice still does not mutate inventory directly
- preserve the implemented `supply-inventory-entry` `TASK-013`, `TASK-014`, and `TASK-015` receipt/fiscal foundation: mounted `/api/receipts` route group, additive Prisma receipt enums/tables plus `confirmedLotId` and `FiscalDocumentReference`, tenant-scoped purchase-receipt list/create/detail/inspection/confirm/reverse flows, transactional stock effects on confirmation/reversal, and receipt-scoped fiscal-reference persistence in `PENDING` state without external billing integration
- preserve truthful documentation that `TASK-005` introduced backend runtime and database changes for stage execution, consumption, and waste, `TASK-010` introduced the first QA inspection backend module under the existing production mount, `TASK-011` introduced completion posting with mandatory QA gate enforcement plus `PRODUCTION_RECEIPT`, `TASK-014` introduced live transactional purchase-receipt confirmation/reversal inventory effects, `TASK-015` introduced fiscal-reference boundary persistence only, and the repository now includes a supported warehouse/QA SPA under `/warehouse/` while still not including root-admin receipt/fiscal pages or an event bus
- keep docs, validators, tests, and runtime contracts aligned to the implemented public runtime
- keep workflow-ownership wording aligned with the implemented validator/test baseline that reads hosted workflow truth from `../.github/workflows/` relative to `inventory-api/`
- preserve `docs/coding_standard.md` as the canonical coding-standards document while allowing the legacy hyphenated alias to remain only as a compatibility bridge
- keep the partial OpenAPI/typecheck coverage posture bounded to the selected governance-admin surfaces clarified by `p33`
- keep `tests/governance-baseline-sync-guardrails.test.js` as the focused documentation-sync guardrail for the selected post-`p34` statements only, not as repository-wide documentation automation; the guarded statements currently include canonical `docs/**` ownership wording, parent-root workflow truth, and the existence of the runtime company-role update flow
- keep that governance/doc-sync guardrail intentionally bounded to the selected seam: canonical docs ownership, runtime-contract ownership wording, and the role-update seam current truth, rather than overstating it as full repository-wide semantic parity
- keep `tests/openapi-contract-consistency.test.js` as the bounded OpenAPI/route-alignment guardrail for the covered operations, now explicitly including `PUT /api/roles/company/{roleId}`
- reflect `docs/permission-governance-decisions.md` and the implemented `src/security/permission-governance*.js` foundation without overstating broader runtime enforcement
- record only the bounded follow-up work still visible after the implemented root-shell slice
- record the implemented bcrypt dependency closeout without overstating it as an auth redesign
- preserve stored-hash and hash-generation compatibility under `bcrypt@^6.0.0`
- preserve truthful documentation that Docker validation for the bcrypt native path is already recorded as completed evidence, not pending architecture work

## 3. Out of scope
- reactivating legacy HTML pages as supported runtime
- migrating additional legacy browser areas beyond the already supported root, warehouse, and agent SPA surfaces
- redesigning backend auth APIs beyond the current cookie-session model
- changing database schema or migrations for this documentation refresh beyond recording the already-implemented `20260811000000_add_product_sourcing_foundation`, `20260818030000_add_receipt_confirmation_lot_link`, and `20260818040000_add_fiscal_document_reference` migrations
- introducing a frontend framework, bundler, or separate SPA deployment
- broadening root-shell eligibility or navigation beyond what is implemented today without a later approved slice

## 4. Requirements addressed
This plan reflects the implemented `zones-view`, `sidebar-rebrand-permissions` `TASK-001`, `TASK-002`, `TASK-003`, `TASK-004`, `quality-baseline-recovery` `TASK-007`, `repository-baseline-score-recovery` `TASK-008`, `p27`, `p28`, `p29`, `p30`, `p31`, `p32`, `p33`, `p34`, `p35`, `p36`, `p37`, `p38`, `root-shell-commercial-views`, `root-shell-commercial-views-hardening`, and `supply-inventory-entry` `TASK-001` through `TASK-015` behavior now observable in code and tests:
- a new supported root SPA shell exists at `/root/`
- browser login routes wave-one root-eligible users to `/root/` instead of `/migration.html?mode=post-login-transition`
- the root shell reuses the existing browser-session model and `GET /api/auth/me` for bootstrap
- the root shell remains vanilla JS under `src/public/root/`
- the root shell includes authenticated layout, actor-aware client routing, basic guards, manifest-driven navigation, logout, and an `in_process` fallback
- global root sessions now keep top navigation, see `Empresas`, and can use bounded Companies Admin list/create/status flows from the shell
- company-admin sessions with `companyId` now receive the rebranded sidebar, see grouped tenant-admin navigation, land on `#admin_home` when no hash is present, and can use bounded permission catalog + company-role list/create/update flows from the shell through `Roles y permisos`; that catalog is now server-filtered so platform-scoped permissions such as `companies.manage` are excluded from the company-admin response path
- company-admin sessions can also use the implemented `#zones` view to list zones, locally search zones/subzones, create zones, and create subzones through the existing company-regions endpoints
- company-admin sessions can use the implemented `#agents` view to compose a commercial-user dataset from users, roles, and route overview data, create company users, and persist route assignments from an agent-centric shell flow
- company-admin sessions can use the implemented `#clients` view to list clients, open in-shell detail, create/update/deactivate clients, add stores, upload documents, create references, run taxpayer lookup through the aligned `/api/taxpayers/lookup?identification=...` contract, and download documents through existing backend contracts
- company-admin sessions can use the implemented `#routes` view to create routes, edit definition, save subzones, save assignments, manage per-agent goals, inspect covered stores, and render a simplified in-shell map using existing backend contracts
- the root shell now has approved browser adapter seams for products, categories, inventory, warehouses, recipes, and root production-order oversight; `#warehouses`, `#products`, `#lots`, and `#movements` use inventory-facing adapters in production code, `#recetas` now uses dedicated recipe adapter plus helper/state/renderer seams for live admin behavior, and `#produccion_ordenes` now uses a dedicated production-orders adapter plus helper/state/renderer seams for a usable read-only supervision workflow, with server-side pagination only and the remaining administrative filters applied client-side over the loaded page
- tenant-scoped product category list/create is now implemented on the backend under the existing product route namespace without database changes
- the commercial shell controllers now delegate bounded rendering/state responsibilities to adjacent renderer/state seams instead of keeping all list/detail/map/summary markup inside the main controller files
- browser/runtime governance now also covers the extracted commercial seams through modularity, public-surface, smoke, typecheck-governance, and browser E2E assertions
- the narrow `payment.service.js` maintainability cleanup completed without changing payment lifecycle, tenant-scope, audit, pagination, or receipt/security contracts
- the approved company-admin sidebar entries now have explicit route keys in `root/manifest.js`; `Bodegas`, `Productos`, `Lotes`, `Movimientos`, `Proveedores`, `Solicitudes de compra`, `Cotizaciones`, `Seguimiento de cotizaciones`, `Ordenes de compra`, `Recetas`, `Ordenes de produccion`, `Facturación`, `Aprobaciones`, `Roles y permisos`, `Zonas`, `Agentes`, `Clientes`, and `Rutas` are functionally implemented route destinations, while the remaining current company-admin sidebar routes render the shared neutral `in_process` view or other intentionally shallow starter content
- layout ownership is normalized so the shell owns actor-specific offsets and outer content placement while views own only their internal module layout
- the company-admin sidebar now hardens latent overflow behavior by hiding tooltip boxes until collapsed hover/focus, applying defensive `box-sizing` and `min-width: 0` rules to nested wrappers, truncating long labels/footer text, and limiting the styled thin scrollbar to the central scroll region while header and footer remain fixed
- the runtime role-management UI is now bounded to list/create/update only; role delete and user-role reassignment UI were not added
- backend auth remains the source of truth; client guards are only UX gates
- a local minimal navigation manifest exists under `src/public/root/manifest.js`
- the first wave remains incremental and does not reactivate `/root/*.html` as supported runtime
- `/root/*.html`, `/warehouse/*.html`, and `/agent/*.html` still return the same-URL `410 Gone` migration response
- non-wave-one browser profiles still use the supported transition landing at `/migration.html?mode=post-login-transition`
- validators and tests now explicitly recognize `/root/` as supported and keep legacy HTML routes retired
- a centralized permission-governance policy foundation now exists under `src/security/`
- only a global `root` actor can create companies under the current governance evaluation rule
- company-role create/update now reject platform-scoped permissions such as `companies.manage` before persistence, while preserving warning-based audit metadata for non-approved deny candidates; additionally, the company-admin permission-catalog read path now omits platform-scoped entries altogether as a presentation and least-exposure hardening step
- denied company-role governance attempts now emit dedicated service-level audit attempts through actions `roles.company.create.governance_denied` and `roles.company.update.governance_denied` with structured denial metadata while preserving the same `403` response contract
- company/company-role admin flows now expose a clearer route-policy/service-governance contract through explicit `global-root` and `company-admin` actor-scope checks in `src/security/access-policies.js`
- `POST /api/companies/` now uses the dedicated route policy `company.create-global` while preserving the same endpoint and `403` semantics
- bounded route-level actor-scope denials now emit safe audit attempts through action `security.authorization.access_policy`, remaining distinct from service-level governance denials
- bounded governance evidence now also includes `src/security/access-policies.js` in typecheck plus partial OpenAPI / critical-contract coverage for company listing/creation, root-company listing/creation, assignable-role-permission listing, and company-role listing/creation/update
- the in-scope legacy governance validator now reads canonical runtime-contract artifacts from `docs/**` rather than auxiliary `internal-docs/**` copies
- a focused ownership regression test now guards that validator/documentation alignment without expanding into repository-wide `internal-docs/**` cleanup
- the coding standards document path is now converged on `docs/coding_standard.md`, with the legacy hyphenated alias retained only as a compatibility bridge and protected by dedicated drift tests
- the coding standards path is now aligned so `docs/coding_standard.md` is authoritative, the legacy hyphenated alias is compatibility-only, and a dedicated repository test guards against stale hyphenated references in repo-owned docs/tests/scripts
- the access-policy hotspot is now split so declarative policy data, actor-scope checks, and route-level denial-audit behavior are separated while `authorizeAccessPolicy(...)` remains the stable facade contract
- inventory-alert behavior is now isolated in `src/services/inventory-alerts.service.js` while inventory stock and lot orchestration remain in `inventory.service.js`
- agent store-state, debt visibility, purchase-history shaping, and sorting are now isolated in `src/services/agent-workspace-store-state.service.js` while actor scoping and order delegation remain in `agent-workspace.service.js`
- `recipes-production-qa-execution-hardening` Fase 1 is now implemented: recipe version create/update rejects product-linked stage inputs with empty or mismatched units, `qaMandatory` recipe stages now require at least one formal numeric expected QA parameter, `RecipeStageInput.quantity` is now explicitly documented as the per-unit quantity field on the existing column, and additive production-stage execution QA fields (`qaOutOfTolerance`, `overrideJustification`) now exist at the schema level as groundwork for later phases
- `recipes-production-qa-execution-hardening` Fase 2 is now implemented across `TASK-004`, `TASK-005`, `TASK-006`, `TASK-007`, and the backend portion of `TASK-008`: planning helpers were extracted to `src/services/production-planning.service.js`, FEFO sorting was isolated as pure `sortLotsByFefo(...)`, migration `20260915001000_production_order_material_requirements` plus Prisma model `ProductionOrderMaterialRequirement` now persist per-order requirements, `production.service.js` now wraps create/approve planning in inventory transactions with advisory lock, computes and persists `materialRequirements`, enriches `recipeVersionSnapshot.materialRequirements`, revalidates stock on approval, and records stock-override audit events when request context is available; `buildRecipeVersionSnapshot(...)` now also explicitly normalizes stage `expectedParameters` to the formal QA contract `{ name, unit, expectedValue, minTolerance, maxTolerance }`, omits empty legacy `parameterTolerances`, and preserves non-empty legacy `parameterTolerances` arrays for backward compatibility across the reused create/approve snapshot builders; `src/services/production-material-availability.service.js` now implements the tenant-scoped read models behind `GET /api/production/orders/:id/material-requirements` and `GET /api/production/orders/:id/stages/:stageId/available-lots`, combining persisted per-order material requirements with current origin-warehouse stock for `required/available/missing`, and using the frozen stage snapshot plus current tenant product `requiresLot` / `requiresExpiration` flags to return sellable-lot suggestions ordered FEFO or FIFO as applicable without exposing `internalLotNumber`; additionally, the user-authorized structural split for `TASK-005` is now followed by the approved execution-hardening backend slice in `src/services/production-execution.service.js` and `src/services/production-stage-validation.service.js`, which adds stage-prerequisite enforcement, consumption-vs-requirement validation with the approved temporary `0.05` tolerance fallback, execution-time QA tolerance handling, override-justification persistence, and request-aware override audit events while preserving the stable route/API surface and keeping `production.service.js` as a 591-line façade under the approved file-size ceiling.
- permission-aware product shaping and general-price synchronization are now isolated in `src/services/product-permission-shaping.service.js` and `src/services/product-pricing.service.js` while `product.service.js` keeps higher-level CRUD/import orchestration
- `docs/documentation-ownership-map.md` now classifies `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`, canonical workflow ownership, and the extracted auth/service/repository seam examples
- the current product module now accepts additive sourcing foundation metadata on the existing `/api/products/**` contract, persists company-scoped allowed-warehouse and authorized-supplier relations, and keeps the final product update mutation auth-scoped even when a client submits a foreign `companyId`
- the current security module now exposes centralized supply/intake permission metadata, proposed operational role bundles, and named future access policies before those business modules are exposed through mounted APIs
- the current production area now also exposes an active QA inspection and completion foundation through `QualityInspection`, `quality.schema.js`, `quality.repository.js`, `quality.service.js`, and `productionCompletionSchema`, with inspection routes plus `POST /api/production/orders/:id/complete` classified under the existing `/api/production` mount and reusable mandatory-QA-gate evaluation now consumed by completion logic

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

Problems still open after `quality-baseline-recovery` `TASK-007`, `repository-baseline-score-recovery` `TASK-008`, and `supply-inventory-entry` `TASK-001` through `TASK-015`:
- non-wave-one browser roles still land on the transition page rather than a functional supported destination
- root-shell navigation remains local-manifest based and not yet integrated with any broader approved navigation model
- the company-admin sidebar still exposes several approved-but-not-yet-functional modules through the shared neutral `in_process` view; this is current supported behavior, but additional module implementation remains pending after `Bodegas`, `Productos`, `Lotes`, `Movimientos`, `Proveedores`, `Solicitudes de compra`, `Cotizaciones`, `Seguimiento de cotizaciones`, `Ordenes de compra`, `Recetas`, `Ordenes de produccion`, `Facturación`, `Aprobaciones`, `Roles y permisos`, `Zonas`, `Agentes`, `Clientes`, and `Rutas`; within the root-shell supply slice specifically, the remaining procurement-facing placeholders are now only `#recepciones` and `#referencias_fiscales`, while `#cotizaciones`, `#seguimiento_cotizaciones`, `#solicitudes_compra`, and `#ordenes_compra` are reachable from the root shell as implemented procurement workspaces; the remaining browser gap inside the implemented production routes is contract depth, because `#recetas` remains the richer admin workflow while production orders intentionally keep only server-side pagination and run the remaining filters client-side over the loaded page
- browser-runtime `typecheck` still uses an explicit allowlist rather than full `src/public/**` coverage; keep that boundary intentional and synchronized with the currently approved root, warehouse, shared, and agent runtime files
- browser-runtime `typecheck` uses an explicit allowlist and remains intentionally bounded; it now includes the supported warehouse runtime but still does not include the full approved `src/public/root/**` inventory or the supported `src/public/agent/**` runtime
- docs/tests/validators must continue staying synchronized so the root shell and legacy-route policies do not drift
- the modularity guardrail remains intentionally narrow, but its containment baseline now also freezes delegation from the commercial controllers to the extracted renderer/state seams in addition to `router.js` and `zones-admin.js`; broader root-shell decomposition is still pending if future slices grow `app.js` or introduce new sensitive modules
- the temporary coding-standards compatibility bridge should not be expanded back into a second independently maintained standards body
- permission governance remains only partially implemented: the central policy foundation, the stable `company.create` deny, enforced company-role create/update platform-scope denies, denial-path audit visibility for those denies, metadata-backed root-shell consumption, and the bounded company/company-role admin actor-scope convergence seam now exist, but broader backend role-governance hardening and repository-wide access-policy convergence remain pending
- the feature validation matrix is closed for the intended memory-session aggregate lane, the representative commercial browser E2E lane now also passes, and local Windows Prisma generate instability remains a separate documented platform issue during `npm run build`
- `src/services/agent-workspace.service.js` and `src/services/product.service.js` remain large service hotspots; the production hotspot is reduced but not eliminated because `src/services/production.service.js` is now a 591-line façade, `src/services/production-execution.service.js` is now a 582-line execution/return/completion seam, and `src/services/production-stage-validation.service.js` now isolates the sequence/consumption/QA override rules added for the backend portion of `recipes-production-qa-execution-hardening` `TASK-008`.
- the new product sourcing foundation is not yet backed by dedicated route/integration regression coverage for `POST /api/products` and `PUT /api/products/:id`; current confidence is stronger at schema/service level than at endpoint-wiring level
- the committed migration `20260811000000_add_product_sourcing_foundation` is validated through `prisma validate`, build, and aggregate tests, but clean-database migration execution evidence is still missing from the reviewed repository artifacts
- downstream fiscal-handoff still does not fully consume the new sourcing/recipe/production/procurement/receipt foundation in production code; the implemented supply slice now reaches production-order lifecycle, stage execution/return handling, QA inspection capture/listing, completion receipt posting through active `PRODUCTION_RECEIPT`, procurement quotable-product listing, supplier-pricing reads, assisted quotation-request creation, request/quotation/selection/purchase-order intent, receipt document/inspection/confirmation/reversal, receipt fiscal-reference persistence, and the supported warehouse/QA browser runtime under `/warehouse/`, but external billing submission remains pending
- the remaining downstream follow-up is now concentrated in six non-warehouse areas: missing DB-enforced `warehouse_id` / `product_id` integrity on production detail tables, cross-workflow justification persistence/audit gaps beyond the now-implemented production override paths, absence of standalone downstream `/api/quality` route groups, lack of external fiscal-document handoff for purchase orders/receipts, missing root-admin pages for the new receipt/fiscal flows, and DB-level hardening still missing for several lifecycle invariants that are currently enforced only in service/validation code
- `production_consumptions`, `production_wastes`, and `production_returns` now all enforce `lot_id` as mandatory plus FK-backed integrity to `lots`, but all three execution-detail tables still rely on application-controlled writes for `warehouse_id` / `product_id` integrity
- the repository still carries a dual production read-model decision because granular execution detail rows are persisted while `ProductionItem.consumedQuantity` remains as a synchronized auxiliary aggregate; downstream code must continue treating `ProductionConsumption` detail as authoritative and must not reintroduce aggregate-first assumptions
- `TASK-014` and `TASK-015` are now complete as the approved receipt confirmation/reversal and fiscal-reference slices, so the next downstream supply follow-up is `TASK-016`
- the supply/intake permission codes used by the current governance-backed catalog are now synchronized in two active persistence paths: `prisma/seed.js` materializes the catalog for fresh/bootstrap environments, and additive migration `20260819000000_backfill_production_permission_catalog` upserts/reactivates the approved `recipes.*` and `production.*` rows for already-provisioned databases required by `GET /api/roles/permissions` and the root `#roles_permissions` UI; the remaining bundle risk is different: proposed bundles are still metadata-only, not runtime-enforced, and coverage remains selective across personas/modules
- override permissions are now explicitly marked as justification-required in centralized governance metadata, `production.override` is enforced in `production.service.js`, and `quality.inspect` / `quality.view` are enforced by inspection routes under `/api/production`, but the repository still lacks a persisted/audited justification workflow contract and the remaining future override permissions still have no runtime consumer
- named policies for production, procurement, quality, receipts, warehouse workspace, and billing handoff are already declared in the access-policy registry; supplier policies are now also proven for `/api/suppliers` company-scoped CRUD/assignment endpoints; route-level enforcement is now proven for `/api/production` including inspection endpoints, for `/api/procurement` including request/quotation/selection/approval/purchase-order endpoints, and for `/api/receipts` including document/inspection/confirm/reverse/fiscal-reference endpoints, while standalone `/api/quality` groups remain absent from `src/app.js`
- production invariants remain partially permissive at the database layer because same-warehouse prevention, expiration ordering, lifecycle transitions, sourcing/recipe guardrails, and mandatory completion QA gates still rely on Zod/service enforcement or downstream task wiring rather than DB `CHECK` constraints or tighter relational constraints
- metadata reconciliation for permission-governance sequencing is complete, and the former `p30-company-role-governance-hardening` plus `p32-governance-denial-audit-visibility` follow-up dependencies are now implemented for the current create-flow boundary
- the runtime company-role update flow now exists and now invalidates browser sessions for active users assigned to the changed role after successful permission persistence; the repository boundary is also stronger now because role updates use `findCompanyOwnedRoleById(...)` first and company-user creation uses `findAssignableRoleByIdForCompany(...)` first, while broad role lookup remains only as a narrow fallback for differentiated semantics/classification. The current seam is now also explicitly frozen by canonical docs, runtime-contract artifacts, and focused tests at route/service/browser-session levels. Remaining follow-up limitations are different: the current design forces re-authentication rather than in-place permission refresh, a browser-session store failure can still return `503 service_unavailable` after the role update already committed, and the Redis reverse session index can retain stale user-membership entries after natural session expiry until a later hygiene pass is implemented
- the reviewed `session-docs-tenant-hardening` seam now has closed focused compatibility, governance, tenant-scope, session-invalidation, and aggregate validation evidence; remaining audit concerns are operational/maintainability follow-up only, not confirmed regressions in the reviewed seam
- runtime-contract governance now converges on canonical `docs/**` artifacts for validator ownership, while `internal-docs/**` remains auxiliary support material only and other non-runtime-contract auxiliary consumers stay explicitly out of scope for this bounded slice
- workflow governance wording must continue to reflect the actual repository boundary where hosted workflow truth lives in the parent-root `../.github/workflows/` tree relative to `inventory-api/`, not in an app-root-local workflow directory

## 6. Domains affected
- Embedded browser runtime
- Identity and access
- Inventory
- Sales routing / agent workspace
- Product catalog
- Supply/inventory-entry foundation within the product module
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
- `#warehouses` keeps using `GET/POST /api/warehouses/company` with same-origin cookie-authenticated fetches through `warehouses-api.js`
- `#products` keeps using paginated `GET /api/products/`, `GET /api/products/:id`, `POST /api/products/`, `PUT /api/products/:id`, `DELETE /api/products/:id`, and tenant category list/create at `GET/POST /api/products/categories/company` through same-origin cookie-authenticated fetches via `products-api.js` and `categories-api.js`
- `#movements` keeps using paginated `GET /api/inventory/movements` with same-origin cookie-authenticated fetches through `inventory-api.js`, plus warehouse-label enrichment through `warehouses-api.js`
- product create/update/import must continue accepting the additive sourcing foundation fields without breaking existing product CRUD clients that still rely on legacy product/category semantics
- product relation writes must continue validating warehouse and supplier ownership inside the authenticated company scope before persistence
- product update must continue stripping client-supplied `companyId` and enforcing the final write through `product.repository.updateProduct(id, companyId, data, tx)`
- the sidebar keeps header/footer fixed while only the middle navigation lane scrolls
- hidden tooltip boxes stay display-gated until collapsed hover/focus instead of contributing to layout width
- `root` and `admin` with `companyId` continue landing on `/root/`
- company-admin continues defaulting to `#admin_home` when no hash is present
- explicit company-admin sidebar route items remain declared in `src/public/root/manifest.js`
- non-functional company-admin sidebar routes continue rendering the shared neutral `in_process` view
- the implemented `#zones` flow continues using the existing company-regions endpoints and local in-memory search rather than introducing new backend search contracts
- the implemented `#agents` flow continues composing data in the browser from existing users/roles/routes contracts rather than introducing a dedicated admin-agents backend endpoint
- the implemented `#clients` flow continues keeping detail and related append-only actions inside the shell, preserving the aligned `/api/taxpayers/lookup?identification=...` adapter contract and using existing client/store/document/reference contracts rather than reviving legacy client-detail pages
- the implemented `#routes` flow continues using existing sales-route contracts and a lightweight SVG map rather than introducing an external map dependency
- the implemented commercial controllers continue delegating renderer/state work to their extracted adjacent seams rather than collapsing those responsibilities back into single large files
- shell-owned global offsets remain separate from per-view internal layout
- deprecated legacy HTML routes keep returning `410 Gone` and the migration screen from the same URL without redirect
- `/migration.html?mode=post-login-transition` remains a supported 200 response for non-wave-one browser profiles
- `legacy-public-runtime/` remains outside the served runtime and outside implicit rollback behavior
- `npm run validate:public-runtime` and the affected browser/runtime tests remain aligned to the implemented public surface
- the implemented billing view (`#billing`) continues providing three tabs (receivables, pending payments, client ledger) through the `billing-admin.js` RootShell module
- billing browser scripts (`billing-api.js`, `billing-admin.js`, `billing-admin.helpers.js`, `billing-admin.renderers.js`, `clients-admin-store-dialog.js`) remain registered in the root shell manifest and public runtime validator
- `paymentCondition` enum (`CASH`, `TRANSFER`, `CREDIT`) remains active on orders and validated at both agent-workspace and admin boundaries
- `creditBalance` mutation contract: increment on order approval, decrement on payment approval, increment on payment reversal, decrement on order cancellation — all four points use the shared `calculateInvoiceAmount` formula
- `billing-trigger.service.js` continues executing outside the dispatch Prisma transaction (best-effort, never throws)
- `findClientLedger` defaults to 100 invoices ordered by `issuedAt desc` with optional pagination (`take`, `skip`, `since`)

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
4. extend the richer company-admin sidebar IA beyond the current shared neutral `in_process` placeholders through explicit module implementations, building on the already-functional `#warehouses`, `#products`, `#lots`, `#movements`, `#roles_permissions`, `#zones`, `#agents`, `#clients`, `#routes`, `#billing`, `#approvals`, `#proveedores`, `#solicitudes_compra`, `#cotizaciones`, `#seguimiento_cotizaciones`, `#ordenes_compra`, `#recetas`, and the now-usable read-only `#produccion_ordenes` route, while deciding whether the next production follow-up is to deepen production-order backend filtering or to implement a different pending sidebar module;
5. decide whether additional browser roles should later move from `/migration.html?mode=post-login-transition` into supported shell destinations;
6. decide whether the bounded browser-runtime `typecheck` allowlist should widen to cover the remaining approved root-shell and agent-shell runtime inventory beyond the current shared/login/warehouse plus selected-root file set;
7. keep unsupported company edit/delete/detail and role delete/reassignment flows out of the shell until backed by approved slices and real runtime contracts;
8. preserve the implemented bounded company/company-role admin convergence seam as the current baseline rather than reinterpreting it as pending work;
9. preserve `legacy-public-runtime/` only as transitional backup/reference inventory until equivalent SPA sections are implemented and validated, then remove it in a later approved slice;
10. retire the legacy hyphenated coding-standards compatibility bridge only after repository and external consumers no longer depend on that alias path;
11. preserve and extend the newly implemented `quality-baseline-recovery` growth guardrails for sensitive root-shell modules as future slices touch `router.js`, `zones-admin.js`, `app.js`, or new high-risk shell files;
12. keep the new hotspot seam split as the implemented baseline and, if future hardening is approved, continue reducing central services only through additive extractions behind the current facades rather than through a broad folder redesign;
13. preserve the completed `hotspot-seams-doc-ownership` `TASK-008` validation baseline, including the passing memory-session aggregate lane and the separate tracking of the Windows Prisma generate rename-lock issue;
14. keep centralized supply/intake permission codes synchronized across `src/security/permission-governance.config.js`, `prisma/seed.js`, and additive backfill migrations for already-provisioned databases, and add a guardrail that detects config/seed/backfill drift before future permission-bearing supply slices ship;
15. extend the now-implemented production override baseline (`production.service.js` plus `production-stage-validation.service.js`) into a broader cross-workflow persistence/audit contract so the same durable justification and audit semantics also exist when later workflow services implement `procurement.override`, `quality.override`, or `inventory.intake.override`;
16. if the business later requires a product-specific applicable recipe version, introduce that as an explicit model/API change rather than silently inferring it from `product.recipeId` or from order-level `recipeVersionSnapshot` data.

## 10. Database changes
No new database change is planned for this post-implementation refresh.

Already implemented and now part of the documented baseline:
- Prisma enums `ProductSourcingMethod` and `ProductInventoryType`
- additive product columns for sourcing/classification, SKU/barcode, lot/expiration requirements, and cost metadata
- additive authorization metadata on `product_suppliers`
- the join table `product_allowed_warehouses`
- recipe versioning tables introduced by `prisma/migrations/20260812000000_add_recipe_versioning_foundation/migration.sql`
- production-order lifecycle and snapshot fields introduced by `prisma/migrations/20260813000000_add_production_order_lifecycle_foundation/migration.sql`, including `ProductionOrderStatus`, additive production-order references/timestamps, and `recipe_version_snapshot` JSON
- production execution detail tables introduced by `prisma/migrations/20260814000000_add_production_stage_execution_foundation/migration.sql`, including `production_stage_executions`, `production_consumptions`, and `production_wastes`
- migration `prisma/migrations/20260815000000_harden_production_consumption_lot_fk/migration.sql`, which makes `production_consumptions.lot_id` non-null, FK-backed to `lots`, and indexed for `(production_order_id, stage_execution_id, product_id, lot_id)` plus `(lot_id)`
- migration `prisma/migrations/20260816000000_harden_production_waste_lot_fk/migration.sql`, which makes `production_wastes.lot_id` non-null, FK-backed to `lots`, and indexed for `(production_order_id, stage_execution_id, product_id, lot_id)` plus `(lot_id)`
- migration `prisma/migrations/20260811000000_add_product_sourcing_foundation/migration.sql`
- migration `prisma/migrations/20260819000000_backfill_production_permission_catalog/migration.sql`, which upserts/reactivates the approved `recipes.*` and `production.*` permission rows required by `GET /api/roles/permissions` and the root `#roles_permissions` UI in already-provisioned databases

## 11. API and integration changes
No immediate API contract change is planned beyond preserving the implemented warehouses, products, and movements screens, the current lots behavior, the additive product sourcing metadata, the active procurement browser workspaces, and the new security/governance foundation.

Before additional future permission-bearing supply changes are exposed, the plan now explicitly requires:
- maintaining synchronized permission-catalog definitions across `src/security/permission-governance.config.js`, `prisma/seed.js`, and additive backfill migrations for already-provisioned databases
- adding an automated guardrail that detects config/seed/backfill drift for approved permission codes
- wiring new route groups to the named policies already present in `src/security/access-policy-registry.js`
- expanding override-justification handling from the current `production.service.js` baseline into fuller durable persistence/audit behavior beyond the now-implemented stock-shortage audit events, instead of treating later override paths as metadata-only

Current integration posture to preserve:
- auth/session APIs remain stable;
- the supported root-shell clients adapter remains aligned with the backend taxpayer lookup contract at `/api/taxpayers/lookup?identification=...`;
- `POST /api/auth/logout` remains part of the governed runtime contract baseline;
- `GET /health` remains a stable liveness response;
- `GET /health/ready` remains the operational readiness boundary for database + browser-session-store dependencies;
- `GET/POST /api/products/categories/company` remains the current tenant-scoped category contract for the inventory-admin follow-up work;
- the registered root inventory adapters remain aligned to `/api/products/**`, `/api/inventory/**`, and `/api/warehouses/company` without adding new frontend transport patterns;
- the supported warehouses browser flow remains bounded to list/create only; no edit, delete, movement, stock, or detail API was added in that slice;
- the supported products browser flow remains bounded to paginated list/detail/create/update/deactivate behavior plus tenant category list/create; for the supply slice, the same existing endpoints now also accept additive sourcing metadata rather than exposing a separate product-supply namespace; 
- `/api/production` now exists as a backend-only runtime contract for production-order lifecycle plus stage-execution/return/inspection/completion foundations, including `POST /api/production/orders/:id/stages/:stageId/execute`, `POST /api/production/orders/:id/stages/:stageId/returns`, `POST /api/production/orders/:id/stages/:stageId/inspections`, and `POST /api/production/orders/:id/complete`, but all remain intentionally excluded from the current partial OpenAPI baseline through `docs/runtime-contract-manifest.json`;
- the internal/public RFQ split must remain stable: authenticated tenant-scoped procurement orchestration stays under `/api/procurement/**`, including the active `GET /api/procurement/orders` listing contract and the quotations comparison/approval/purchase-order flows, while unauthenticated supplier response stays isolated under `/api/public/supplier-quotations/:token`;
- no new inventory lots flow, bulk import redesign, receipt API, or frontend production runtime surface was added in this slice;
- the supported movements browser flow remains bounded to read-only list/filter/pagination/detail behavior over `GET /api/inventory/movements`; no edit, delete, reverse, or write API was added in this slice;
- the deprecated legacy HTML contract remains an HTTP `410` response contract, not a redirect contract;
- `/root/` remains a supported browser entrypoint backed by static assets in the same Express runtime.

## 12. Container and deployment changes
No versioned container-file change is required for this closeout refresh.

Recorded operational follow-up now closed:
- Docker build/runtime validation for the upgraded native bcrypt path was rerun successfully and remains historical evidence rather than pending architecture work.

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
- strict CSP on supported public documents and deprecated legacy HTML responses, including the dedicated `/supplier-quote/` public path
- SHA-256 token-hash-only persistence for public supplier RFQ access tokens
- backend auth as the final authority while root-shell guards remain UX-only
- root-relative browser API calls must keep resolving through the shared auth helper as absolute same-origin URLs so `/root/` and `/warehouse/` do not regress into path-relative fetch behavior

Future security follow-up may include:
- expanding supported shell destinations for additional browser roles only through approved slices
- expanding static analysis coverage over root-shell files
- extending governance-denial observability only if later approved operations add new enforced deny paths
- continuing broader HTTPS/cookie hardening tracked in the existing browser-session follow-up work
- validating whether the existing public RFQ throttling configuration is sufficiently distributed/operationally safe for the actual deployment topology and whether stronger abuse monitoring or store backing is required
- deciding whether the now-implemented lazy persisted `EXPIRED` transition should remain request-driven or later gain proactive/background materialization for reporting and operational simplicity
- adding a lightweight local-development guardrail or startup check that warns when host port `2500` is already occupied by a non-Docker `node src/server.js` process, because that conflict can mask the published container runtime and mislead shell/API debugging

## 14. Test strategy
- preserve `tests/bcrypt-supply-chain-closeout.test.js` as characterization coverage for stored-hash compatibility and current hash-generation call sites
- preserve `tests/dependency-hygiene-governance.test.js` as the zero-residual governance guardrail
- preserve `tests/product-sourcing-schema.test.js` as characterization coverage for accepted enum values, duplicate authorization rejection, and additive payload coercion in the supply foundation
- preserve `tests/secure-token.test.js`, `tests/procurement-rfq-routes-contract.test.js`, `tests/procurement-rfq-service.test.js`, `tests/procurement-rfq-audit.test.js`, `tests/rfq-tracking-view-characterization.test.js`, `tests/root-shell-rfq-tracking-api-characterization.test.js`, `tests/rfq-runtime-governance-alignment.test.js`, `tests/quotations-view-characterization.test.js`, and `tests/quotations-view.e2e.js` as the RFQ lifecycle, grouped-quotation continuation, dedicated follow-up-page, and runtime-governance baseline
- preserve `tests/product-service-hotspot-characterization.test.js` as hotspot coverage for transaction ownership, tenant-scoped relation validation, and update-path company-scope hardening in the product module
- preserve clean-workspace validation evidence for `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test -- --silent`, `npm run verify`, `npm audit --json`, and `npm run validate:dependency-hygiene`; the latest user-supplied final-cycle evidence for this repository state reports `npm run typecheck` passed, `npm run lint` passed, and broad `npm test -- --silent` passed
- preserve the recorded Docker-specific validation evidence for the native bcrypt path and rerun it only if a later slice changes container/runtime assumptions

Continue validating the implemented repository baseline through:
1. `npm run validate:public-runtime`
2. `node --test tests/public-surface-characterization.test.js`
3. `node --test tests/public-runtime-http-smoke.test.js`
4. `node --test tests/browser-session-auth-boundary.test.js`
5. `node --test tests/root-shell-route-governance.test.js`
6. `node --test tests/root-shell-router-characterization.test.js`
7. `node --test tests/root-shell-modularity-governance.test.js`
8. `node --test tests/agents-view-characterization.test.js`
9. `node --test tests/clients-view-characterization.test.js`
10. `node --test tests/routes-view-characterization.test.js`
11. `node --test tests/warehouses-view-characterization.test.js`
12. `node --test tests/warehouses-view.e2e.js`
13. `node --test tests/products-view-characterization.test.js`
14. `node --test tests/products-view.e2e.js`
15. `node --test tests/zones-view-selection-filters-characterization.test.js`
16. `node --test tests/zones-view-dialog-feedback-characterization.test.js`
17. `node --test tests/zones-view.e2e.js`
18. `node --test tests/browser-e2e.e2e.js`
19. preserve the green `session-docs-tenant-hardening` aggregate validation baseline now recorded for `npm run test -- --silent`, `npm run lint`, `npm run typecheck`, and `npm run build`, and keep any future reruns isolated from invalid parallel `test` + `build` execution
20. `node --test tests/inventory-service-hotspot-characterization.test.js tests/inventory-alerts-tenant-scope.test.js tests/approval-baseline-compatibility.test.js`
21. `node --test tests/agent-workspace-hotspot-characterization.test.js tests/product-service-hotspot-characterization.test.js`
22. `npm run lint:public-runtime`
23. `npm run lint`
24. `npm run typecheck`
25. `npm run build`
26. `set NODE_ENV=test&& set BROWSER_SESSION_STORE_MODE=memory&& node --test tests/access-policies.test.js tests/administrative-authorization-characterization.test.js tests/authorization-convergence-characterization.test.js`
27. `node --test tests/documentation-ownership-governance.test.js tests/p36-doc-validator-ownership.test.js tests/workflow-baseline-characterization.test.js`
28. `node --test tests/agent-workspace-hotspot-characterization.test.js tests/agent-workspace-tenant-scope.test.js tests/agent-workspace-contract-characterization.test.js`
29. `node --test tests/product-service-hotspot-characterization.test.js tests/product-delete-semantics.test.js tests/pagination.test.js`
30. `node --test tests/product-sourcing-schema.test.js`
31. `npx prisma validate --schema prisma/schema.prisma`

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

Recorded post-implementation evidence supplied by the user for `inventory-admin-views` `TASK-005`:
- `node --test tests/warehouses-view-characterization.test.js` passed
- `node --test tests/warehouses-view.e2e.js` passed
- `npm run lint` passed
- `npm run lint:public-runtime` passed
- `npm run typecheck` passed
- `npm run validate:public-runtime` passed
- `npm run build` passed

Recorded post-implementation evidence supplied by the user for `inventory-admin-views` `TASK-006`:
- `node --test tests/movements-view-characterization.test.js tests/movements-view.e2e.js` passed
- `npm run lint` passed
- `npm run lint:public-runtime` passed
- `npm run typecheck` passed
- `npm run validate:public-runtime` passed
- `npm run build` passed

Recorded post-implementation evidence supplied by the user for `inventory-admin-views` `TASK-007` and `TASK-008`:
- `node --test tests/products-view-characterization.test.js tests/products-view.e2e.js` passed
- `node --test tests/public-surface-characterization.test.js tests/root-shell-router-characterization.test.js` passed
- `npm run lint` passed
- `npm run lint:public-runtime` passed
- `npm run typecheck` passed
- `npm run validate:public-runtime` passed
- `npm run build` passed

Recorded post-implementation evidence supplied by the user for `repository-baseline-score-recovery` `TASK-007`:
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

Recorded post-implementation evidence supplied by the user for `session-docs-tenant-hardening` `TASK-007`:
- `node --test tests/browser-session-auth-boundary.test.js` passed
- `node --test tests/root-shell-router-characterization.test.js` passed
- `node --test tests/root-shell-route-governance.test.js` passed
- `npm run lint` passed
- `npm run typecheck` passed
- baseline audit verdict supplied by the user: `9.2/10`, `Acceptable`; focused compatibility confidence is high for supported auth routes, browser-session login/me/logout, and root-shell actor-scoped fallback

Recorded post-implementation evidence supplied by the user for `session-docs-tenant-hardening` `TASK-008`:
- focused suites passed for auth/runtime compatibility, router/governance, tenant-scoped role reads, access-policy coverage, critical-contract governance, backend governance consumption, audit instrumentation, bcrypt closeout, and browser-session targeted invalidation
- `npm run test -- --silent` passed with `812` tests executed (`810` passed, `0` failed, `2` skipped)
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed
- final aggregate evidence excludes an earlier discarded invalid parallel `test` + `build` attempt and relies only on the clean isolated rerun
- baseline audit verdict supplied by the user: `9.4/10`, `Acceptable`; remaining concerns are tracked here as operational/maintainability follow-up rather than confirmed regressions: post-commit `503 service_unavailable` ambiguity for role update/session invalidation, safe audit persistence warnings when DB-backed audit storage is unavailable, bounded rather than exhaustive governance coverage, and the drift cost of large canonical documents

Recorded post-implementation evidence supplied by the user for `supply-inventory-entry` `TASK-009`:
- `inventory-api/src/repositories/production.repository.js` now provides `syncProductionItemConsumedQuantity` and `getProductionItemAggregateState`
- `inventory-api/src/services/production.service.js` now synchronizes `ProductionItem.consumedQuantity` after consumption writes and exposes `reconcileProductionOrderAggregates`
- `inventory-api/tests/production-service-foundation.test.js` now includes five new tests plus one updated test for aggregate synchronization and reconciliation
- aggregation rule confirmed: `ProductionItem.consumedQuantity = SUM(ProductionConsumption.quantity)` at production-order scope, excluding waste and returns
- 31 tests passed
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed
- closed residual risks: `RISK-007` and `RISK-009`
- `TASK-010` is the next downstream supply task as of the post-`TASK-009` baseline

Recorded post-implementation evidence supplied by the user for `supply-inventory-entry` `TASK-010`:
- Prisma now includes enum `QualityInspectionResult` and model `QualityInspection` with FKs to `production_orders`, `production_stage_executions`, and optional `lots`
- new backend files `inventory-api/src/schemas/quality.schema.js`, `inventory-api/src/repositories/quality.repository.js`, and `inventory-api/src/services/quality.service.js` are implemented
- `inventory-api/src/routes/production.routes.js` now exposes `POST /api/production/orders/:id/stages/:stageId/inspections` guarded by `quality.inspect` and `GET /api/production/orders/:id/inspections` guarded by `quality.view`
- QA status transitions now include `REJECTED -> QA_HOLD` and `APPROVED` on `QA_HOLD -> IN_PROGRESS`
- `checkMandatoryQaGatesForOrder` is now available as a reusable downstream gate helper consumed by completion flow
- 53 tests passed
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed

Recorded post-implementation evidence supplied by the user for `supply-inventory-entry` `TASK-011`:
- `inventory-api/src/services/production.service.js` now implements transactional `completeProductionOrder(...)`
- `inventory-api/src/schemas/production.schema.js` now includes `productionCompletionSchema`
- `inventory-api/src/routes/production.routes.js` now exposes `POST /api/production/orders/:id/complete` guarded by `production.complete`
- completion now enforces mandatory QA gates, creates the finished-goods lot, posts a `PRODUCTION_RECEIPT` intake movement, and transitions the order to `COMPLETED`
- 12 new tests were added and 59 tests passed
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed
- `TASK-012` is the next downstream supply task

Recorded post-implementation evidence supplied by the user for `supply-inventory-entry` `TASK-012`:
- `inventory-api/src/app.js` now mounts `/api/procurement`
- Prisma now includes `PurchaseRequest`, `PurchaseRequestItem`, `SupplierQuotation`, `SupplierQuotationItem`, `SupplierSelection`, `PurchaseOrder`, and `PurchaseOrderItem` plus the procurement status enums and migration `20260818010000_add_procurement_foundation`
- new backend files `inventory-api/src/repositories/procurement.repository.js`, `inventory-api/src/services/procurement.service.js`, `inventory-api/src/routes/procurement.routes.js`, and `inventory-api/src/schemas/procurement.schema.js` are implemented
- runtime workflow now reaches `request -> quotation -> comparison -> selection -> optional approval -> purchase order`
- this slice has no inventory effects yet: it does not create receipts, lots, warehouse balances, or stock movements
- 79 tests passed
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed
- `TASK-013` is the next downstream supply task

Recorded post-implementation evidence supplied by the user for `supply-inventory-entry` `TASK-013`:
- `inventory-api/src/app.js` now mounts `/api/receipts`
- Prisma now includes `PurchaseReceipt`, `PurchaseReceiptItem`, and `ReceiptInspection` plus enums `PurchaseReceiptStatus` and `ReceiptInspectionResult` and migration `20260818020000_add_purchase_receipt_foundation`
- new backend files `inventory-api/src/repositories/receipt.repository.js`, `inventory-api/src/services/receipt.service.js`, `inventory-api/src/routes/receipt.routes.js`, and `inventory-api/src/schemas/receipt.schema.js` are implemented
- runtime workflow now reaches `actual-arrival receipt document -> item inspection -> pre-confirmation state transitions`
- this slice still has no inventory confirmation effects: it does not create lots, mutate warehouse balances, post stock movements, confirm receipts, or reverse them
- 87 tests passed
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed
- `TASK-014` is the next downstream supply task

Recorded post-implementation evidence supplied by the user for `supply-inventory-entry` `TASK-014` and `TASK-015`:
- `inventory-api/src/routes/receipt.routes.js` now exposes `POST /:id/confirm`, `POST /:id/reverse`, `GET /:id/fiscal-references`, and `POST /:id/fiscal-references` under `/api/receipts`
- `inventory-api/src/services/receipt.service.js` now implements transactional confirmation and reversal over the existing inventory transaction-support helpers with movement reasons `PURCHASE_RECEIPT` and `RECEIPT_REVERSAL`
- `PurchaseReceiptItem.confirmedLotId` now links each confirmed receipt line to its created `Lot` for traceability through migration `20260818030000_add_receipt_confirmation_lot_link`
- Prisma now includes `FiscalDocumentReference` through migration `20260818040000_add_fiscal_document_reference`
- new backend files `inventory-api/src/repositories/fiscal-reference.repository.js`, `inventory-api/src/services/fiscal-reference.service.js`, and `inventory-api/src/schemas/fiscal-reference.schema.js` are implemented
- fiscal references are persisted as `PENDING` handoff metadata only and do not call any external Billing or Hacienda API
- 102 tests passed
- all validations green
- `TASK-016` is the next downstream supply task

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
- The next production hardening steps now move past planning adoption, QA-snapshot normalization, the mounted Fase 3 read endpoints for material requirements / available lots, and the completed backend execution-hardening slice: continue with the remaining approved later-phase work only, including the frontend portion of `TASK-009`, `TASK-011`, `TASK-012`, and the Phase 7 closure tasks, without reopening the completed backend validation rules.
- Documentation-governance drift is reduced but not eliminated for this slice: user-supplied evidence for `recipes-production-qa-execution-hardening` Fase 2 / `TASK-005` reports targeted tests ✅, focused eslint ✅, `npm run typecheck` ✅, `npm run build` ✅, and `npm test -- --silent` ✅ after the explicit user-authorized structural split that reduced `src/services/production.service.js` below the approved ceiling while keeping the public API stable; additional user-supplied evidence for `TASK-006` reports targeted tests ✅, focused eslint ✅, `npm run typecheck` ✅, and `npm test -- --silent` ✅ for the planning-layer QA snapshot normalization with no route or schema change; user-supplied evidence for `TASK-007` reports targeted service + route tests ✅, focused eslint ✅, `npm run typecheck` ✅, full test suite ✅, and `npm run build` ✅ after mounting the tenant-scoped material-requirements and available-lots reads; final backend evidence for `TASK-008` now reports targeted stage-execution/QA/schema tests ✅, `npm run typecheck` ✅, `npm run lint` ✅, `npm run build` ✅, and full `npm test -- --silent` ✅ with `1232` passing, `0` failing, and `2` skipped after the final helper split that kept `src/services/production.service.js` at 591 lines and `src/services/production-execution.service.js` at 582 lines.
### Stage 31 — Completed
- Close the approved bcrypt supply-chain remediation by upgrading to `bcrypt@^6.0.0`, removing the `@mapbox/node-pre-gyp` / `tar` residual chain from the checked-in dependency tree, adding stored-hash compatibility coverage, and moving dependency hygiene to a zero-approved-residual baseline

### Stage 32 — Completed
- Rerun Docker build/runtime validation for the native bcrypt path and attach evidence without changing the approved zero-residual dependency posture

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

### Stage 10A — Completed
- Add targeted browser-session invalidation primitives in the current service/store seam, including memory reverse indexing and Redis user-scoped session-ID sets for user and batch invalidation

### Stage 10B — Completed
- Integrate company-role updates with the existing targeted browser-session invalidation primitives so successful permission changes now resolve active users assigned to the changed role, invalidate their browser sessions with reason `role_permission_change`, and force subsequent affected `/api/auth/me` requests to re-authenticate

### Stage 10C — Proposed
- Decide whether the post-commit `503` ambiguity from role-update-triggered session invalidation needs compensating retry/outbox behavior, response-contract clarification, or another approved mitigation, and separately decide whether Redis user-session set hygiene needs synchronous pruning or a cleanup mechanism

### Stage 10D — Completed
- Harden sensitive tenant role-admin reads at the repository boundary by adding company-owned and assignable-for-company role lookups, switching `updateCompanyRole(...)` and `registerCompanyUser(...)` to use those scoped reads first, and preserving only a narrow fallback broad read for differentiated `404` / `403` / `400` semantics

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

### Stage 17 — Completed
- Add the supported company-admin commercial root-shell modules at `#agents`, `#clients`, and `#routes` over the existing backend contracts, validators, and characterization suites

### Stage 17A — Completed
- Harden the supported commercial root-shell modules by extracting adjacent renderer/state seams, aligning the clients taxpayer lookup adapter to `/api/taxpayers/lookup?identification=...`, expanding browser/governance coverage, and preserving payment-service behavior through the existing payment regression lane

### Stage 18 — Proposed
- Add the next supported root-shell modules beyond the current bounded Companies, Warehouses, Products, Roles/Permissions, Zones, Agents, Clients, Routes, and Movements views through approved incremental slices

### Stage 18A — Completed
- Promote `#warehouses` from a dedicated placeholder route to a functional company-admin inventory-admin screen with bounded list/create behavior, helper/renderer seams, runtime-contract registration, and direct browser regression coverage over the existing `/api/warehouses/company` contract

### Stage 18B — Completed
- Promote `#products` from a dedicated placeholder route to a functional company-admin inventory-admin screen with helper/state/renderer seams, tenant category administration UI, runtime-contract registration, and direct browser regression coverage over `/api/products/**` plus `GET/POST /api/products/categories/company`

### Stage 19 — Proposed
- Replace transition-only landings for additional browser roles when approved supported destinations exist

### Stage 20 — Proposed
- Expand browser-runtime typecheck coverage only if a later approved slice widens the current bounded root-shell allowlist

### Stage 21 — Completed
- Introduce centralized permission-governance foundation, first stable `company.create` deny, and warning-based backend consumption for company-role creation

### Stage 22 — Completed
- Harden company-role creation so platform-scoped permissions such as `companies.manage` are denied before persistence while non-approved sensitive combinations remain warning-only

### Stage 23 — Completed
- Add dedicated denial-path audit visibility for the approved company-role create deny using the existing safe audit seam while preserving the same `403` response contract

### Stage 24 — Completed
- Introduce bounded actor-scope convergence in route policies for company/company-role admin flows while preserving service-level governance enforcement, dedicated `company.create-global`, and distinct route-level versus service-level denial auditing

### Stage 25 — Completed
- Align the in-scope legacy runtime-contract governance validator to canonical `docs/**` ownership and add bounded regression coverage so `internal-docs/**` remains auxiliary only for this seam

### Stage 26 — Completed
- Align coding-standards documentation ownership so `docs/coding_standard.md` is canonical, the legacy hyphenated alias is compatibility-only, and `tests/coding-standard-path-alignment.test.js` protects against stale repo-owned hyphenated references

### Stage 27 — Completed
- Add isolated characterization for `#zones` dialogs and feedback flows, preserving the current DOM/API contract while extracting only small helper seams for reset, inline error rendering, and submit-button state

### Stage 28 — Completed
- Freeze the current root-shell containment baseline with verifiable modularity guardrails over the bounded `window.RootShell` registry contract, isolated router characterization, the extracted zones helper seams, and the follow-up explicit `src/public/root/runtime-contract.js` loader/module contract enforced by `scripts/validate-public-runtime.js`

### Stage 29 — Proposed
- Consume the governance foundation in additional backend role-governance operations and approved UI slices, including any future update-flow hardening once an update surface exists

### Stage 30 — Completed
- Reduce the `hotspot-seams-doc-ownership` hotspots incrementally by preserving the access-policy facade, extracting registry / actor-scope / denial-audit seams, extracting focused inventory / agent-workspace / product service seams, consolidating the canonical documentation ownership map, and closing the intended memory-session validation matrix

### Stage 33 — Completed
- Add the first `supply-inventory-entry` product foundation through additive Prisma schema changes, product schema/service/repository support for sourcing and inventory classification metadata, company-scoped warehouse/supplier authorization validation, and hotspot characterization coverage without introducing new production or procurement route groups

### Stage 34 — Proposed
- Continue the approved `supply-inventory-entry` roadmap after the already-implemented access-policy, supplier-management, recipe/versioning, production, procurement, receipt confirmation/reversal, fiscal-reference foundations, and supported warehouse/QA SPA, focusing next on non-warehouse follow-up only: `TASK-016` root-admin receipt/fiscal pages, external billing handoff, production-detail integrity hardening, and override-auditability improvements only after each step is explicitly approved and imple

## 16. Risks and mitigations
| Risk | Level | Mitigation |
|---|---|---|
| Legacy HTML runtime is accidentally reintroduced into `src/public/` or treated as supported again | High | Keep `validate-public-runtime`, browser/runtime characterization tests, and docs aligned to the supported inventory |
| Future work changes `/root/` behavior without updating validators and browser tests | High | Keep root-shell contract checks in validator, smoke tests, characterization tests, and browser E2E |
| The richer company-admin sidebar IA is misread as fully implemented module coverage instead of a mixed state of active modules plus `in_process` placeholders or uneven production-slice depth | Medium | Keep docs explicit that `Bodegas`, `Productos`, `Lotes`, `Movimientos`, `Proveedores`, `Solicitudes de compra`, `Cotizaciones`, `Seguimiento de cotizaciones`, `Ordenes de compra`, `Recetas`, `Ordenes de produccion`, `Facturación`, `Aprobaciones`, `Roles y permisos`, `Zonas`, `Agentes`, `Clientes`, and `Rutas` are the current functional tenant-admin destinations, while also stating that `#recetas` is the richer admin workflow and `#produccion_ordenes` is now a usable read-only supervision view with the explicit limitation that only pagination is server-side and the remaining filters are client-side over the loaded page |
| Non-wave-one roles remain on an informational transition landing longer than expected | Medium | Keep the behavior explicit in docs and move those roles only through approved supported-destination slices |
| Root shell now uses a bounded `window.RootShell` registry seam, but still depends on plain ordered static scripts and not on a broader module system | Low | Preserve current validator/test coverage, keep the allowlist explicit, and defer any framework/ES-module redesign to a later approved slice |
| The new product sourcing foundation migration has not yet been executed on a clean or staging-like database in reviewed evidence | Medium | Execute the committed migration in clean-db and staging-like environments before release and keep rollback instructions at the migration/deployment layer |
| Route/integration coverage for new product sourcing metadata is thinner than schema/service coverage | Medium | Add endpoint-level regression tests for `POST /api/products` and `PUT /api/products/:id` with the new metadata before expanding downstream supply workflows |
| Later supply work may further concentrate behavior in `src/services/product.service.js` before stronger module boundaries exist | Medium | Treat `product.service.js` as a high-sensitivity hotspot, preserve characterization coverage, and continue additive seam extraction instead of broad rewrites |
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
- confirm the recorded Docker build/runtime validation evidence remains applicable unless a later container/runtime slice changes bcrypt or native-module assumptions

For future follow-up work, manually confirm:
- `src/public/` still contains the supported root shell, agent SPA, and warehouse/QA SPA without re-exposing retired legacy HTML runtime directories
- `node scripts/validate-public-runtime.js` still recognizes `/warehouse/` as supported runtime inventory and continues rejecting retired `/warehouse/*.html` legacy pages from the active surface
- `/root/` still loads successfully
- `/warehouse/` still loads successfully for actors with `warehouse.access`
- `#warehouses` still loads for company-admin users, preserves read-only versus create behavior by effective permission, supports local search/filters, and keeps the create dialog aligned to the existing `/api/warehouses/company` contract
- `#products` still loads for company-admin users, preserves paginated listing plus detail behavior, preserves permission-aware create/edit/deactivate and category create flows, and stays aligned to the existing `/api/products/**` plus `GET/POST /api/products/categories/company` contracts
- product create/update/import still accept the additive sourcing foundation fields and preserve tenant validation for `allowedWarehouseIds` and `authorizedSuppliers`
- the committed product sourcing migration can be applied successfully in target environments before relying on later supply slices
- `#movements` still loads for company-admin users, preserves read-only history behavior, uses server-side `warehouseId` / `productId` / `lotId` filters plus pagination over `GET /api/inventory/movements`, and keeps the drawer limited to audit detail without historical mutation actions
- `#zones` still loads for company-admin users, performs search locally, and creates zones/subzones through the existing company-regions endpoints
- `#agents`, `#clients`, and `#routes` still load for company-admin users and continue using the current helper/API/view seams, including the extracted renderer/state files and aligned taxpayer lookup adapter, without reviving legacy HTML pages
- docs and specs distinguish clearly between `p10` analysis outputs and the implemented `p28` and `p30` runtime slices
- permission-governance dependency metadata no longer treats `p30-company-role-governance-hardening` or `p32-governance-denial-audit-visibility` as pending for the current company-role create-flow boundary
- `docs/coding_standard.md` remains the full coding-standards body and the legacy hyphenated alias remains only a compatibility notice
- root/admin browser sessions still land on `/root/`
- invalid root-shell sessions still return to login
- direct legacy HTML routes under `root`, `warehouse`, and `agent` still return the migration response with HTTP `410 Gone` and no redirect, while the supported warehouse browser runtime remains `/warehouse/`
- `/migration.html?mode=post-login-transition` still behaves as the supported transition landing for `sales_supervisor` and other still-transitioning non-wave-one profiles
- `npm run validate:public-runtime` and the affected browser/runtime tests still pass when touching browser-runtime seams

## 19. Approval status
The `bcrypt-supply-chain-closeout` implementation itself is complete from a repository-code and governance perspective. The previously recorded environment-specific Docker evidence follow-up has now been executed successfully; remaining follow-up is limited to general native-module/toolchain operational awareness rather than unfinished bcrypt remediation.

**Status:** Documentation refresh now reflects the implemented state after `inventory-admin-views` `TASK-007`, `TASK-008`, `TASK-006`, `TASK-005`, `root-shell-runtime-modularity-hardening`, `root-shell-commercial-views-hardening`, `root-shell-commercial-views`, `hotspot-seams-doc-ownership` tasks 1-8, `root-admin-recipes-production` `TASK-006`, `recipes-production-qa-execution-hardening` Fase 2 / `TASK-007`, the completed `procurement-quotation-workspace` `TASK-001` through `TASK-008` slice including cross-layer convergence coverage, the completed `purchase-orders-workspace` implementation cycle, `session-docs-tenant-hardening` `TASK-008`, `supply-inventory-entry` `TASK-001` through `TASK-015`, and the later `rfq-hardening-alignment` slice, together with the existing-database permission-catalog remediation through migration `20260819000000_backfill_production_permission_catalog` and the previously completed browser/runtime and governance slices. The repository now documents `#warehouses`, `#products`, `#movements`, `#cotizaciones`, `#seguimiento_cotizaciones`, `#solicitudes_compra`, and `#ordenes_compra` as active company-admin modules within the supported root shell, preserves the explicit `src/public/root/runtime-contract.js` loader/module contract with the RFQ tracking and purchase-orders inventory aligned, records the strengthened warehouse-, product-, category-, movement-, supplier-, quotations-, RFQ-tracking-, purchase-request-, purchase-order-, recipe-, production-order-, product-sourcing-, quality-inspection-, production-completion-, procurement-, receipt-, fiscal-reference-, auth/runtime-compatibility-, and governance-specific regression coverage, and records the additive product, recipe, production-order, production stage-execution/return, quality-inspection, QA-gated completion, procurement foundation, procurement quotation workspace, quotations comparison/approval-to-OC handoff, dedicated RFQ follow-up page, purchase-requests workspace, purchase-orders listing workspace, public RFQ throttling, lazy persisted RFQ expiration, receipt confirmation/reversal plus fiscal-reference foundation, the recipes/production permission backfill for already-provisioned databases, and the current repository-wide validation evidence (`npm run typecheck`, `npm run lint`, and `npm test -- --silent` passed with `1015/1017` green, `0` failed, `2` skipped) as current production truth. Remaining follow-up is limited to future additive seam work, current shell/UI expansion choices, the bounded typecheck coverage gap outside the now-included warehouse runtime, the production-orders filtering-depth limitation (server-side pagination only, remaining filters client-side over the loaded page), clean-database migration execution evidence for the new supply migrations, thinner route/integration coverage for the new product metadata, remaining execution-detail warehouse/product FK hardening, disciplined downstream use of granular production detail as the authoritative model, `TASK-016` as the next downstream supply task, root-admin receipt/fiscal pages, the remaining compras placeholders (`#recepciones`, `#referencias_fiscales`), non-warehouse downstream integrations, automated config/seed/backfill permission-catalog drift detection, deployment-level throttle-store/abuse-monitoring follow-up for the public RFQ surface, and the separately documented operational/maintainability warnings outside this slice (`503` post-commit ambiguity, safe audit persistence warning posture, bounded governance coverage, and large-doc drift cost).