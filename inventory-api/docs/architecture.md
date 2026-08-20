# Architecture

## 1. Purpose and scope
This document describes only the architecture currently implemented and the active decisions currently governing the repository.

This refresh reflects the repository state after `inventory-admin-views` `TASK-007` and `TASK-008`, together with `zones-view`, `coding-standard-doc-path-alignment`, `sidebar-rebrand-permissions` `TASK-004`, `quality-baseline-recovery` `TASK-007`, `repository-baseline-score-recovery` `TASK-009`, `hotspot-seams-doc-ownership` `TASK-001` through `TASK-008`, `p38-root-shell-modularity-hardening`, `p37-root-spa-companies-roles-admin`, the implemented `root-shell-follow-up-alignment` slice, `root-shell-commercial-views`, `root-shell-commercial-views-hardening`, the post-implementation `root-admin-recipes-production` shell update, `procurement-quotation-workspace` backend documentation alignment, the implemented root-shell/runtime alignment after `procurement-quotation-workspace` `TASK-007`, `session-docs-tenant-hardening` `TASK-004` through `TASK-008`, the later `rfq-hardening-alignment` closeout, the browser-only `supplier-management` / `rfq-tracking-admin` sidebar+detail layout refresh, the later `recipes-production-qa-execution-hardening` Fase 2 / `TASK-006` functional implementation, and `recipes-production-qa-execution-hardening` Fase 2 / `TASK-007`, building on `p36-bounded-doc-validator-ownership-alignment`, `p35-governance-baseline-sync-guardrails`, and `p34-bounded-governance-coverage-expansion`, in addition to the already-implemented browser-runtime reduction, runtime-contract governance convergence, Redis browser-session operational safeguards, DB-free versus DB-backed suite separation for the affected browser/runtime boundary, the currently implemented permission-governance runtime slices, the additive `supply-inventory-entry` `TASK-001` through `TASK-015` foundations, and the later additive existing-database permission-catalog remediation through migration `20260819000000_backfill_production_permission_catalog`.

## 2. Current active architecture summary
The repository remains a single-deployable Node.js 24 Express + Prisma modular monolith.

Current architecture has two important roots:
- **application root:** `inventory-api/` contains runtime code, package scripts, Prisma assets, tests, specs, and docs;
- **repository root:** the parent-root `../.github/workflows/` directory relative to `inventory-api/` contains the official hosted GitHub Actions automation entry point.

For governance tooling, `inventory-api/.github/workflows/` is not the current authoritative workflow source. The workflow-baseline validators and characterization tests intentionally read hosted workflow truth from that parent-root workflow tree.

Within the browser runtime, the active public surface is intentionally constrained but now includes a supported actor-aware root SPA shell under `src/public/root/` served at `/root/`.

This refresh also includes the completed `bcrypt-supply-chain-closeout` governance slice. The application still uses native `bcrypt` in the existing auth/service flows, but the active dependency baseline is now `bcrypt@^6.0.0`, with the checked-in lockfile resolving through `node-gyp-build` instead of the previous `@mapbox/node-pre-gyp` / `tar` chain. No auth API, browser-session, or persistence architecture was redesigned in this slice.

For the supply area, the active architecture change currently in effect is still incremental and additive: the existing product module now owns a first product-sourcing and inventory-classification foundation inside the current CRUD/import contract, the existing security module owns the first centralized permission/policy foundation for later supply workflows, the recipe module now exposes versioned recipe foundations under `/api/recipes` and now enforces stage-input unit integrity at three layers (Zod payload validation, tenant-scoped service validation against `products.unit`, and DB `CHECK` enforcement when `product_id` is present) while formally constraining numeric expected QA parameter definitions for `qaMandatory` stages, and the production module now includes production-order lifecycle, planning, stage-execution, stage-return, quality-inspection, completion, and auxiliary aggregate-synchronization foundations under `/api/production`, with `ProductionConsumption.lotId`, `ProductionWaste.lotId`, and `ProductionReturn.lotId` now DB-hardened as mandatory and FK-backed to `Lot`, `QualityInspection` now FK-backed to `ProductionOrder`, `ProductionStageExecution`, and optional `Lot`, `ProductionItem.consumedQuantity` explicitly synchronized from `SUM(ProductionConsumption.quantity)` at order scope and excluding waste/returns, finished-goods completion now posting `PRODUCTION_RECEIPT` into destination inventory, and additive migration `20260915001000_production_order_material_requirements` plus Prisma model `ProductionOrderMaterialRequirement` now persisting per-order material-requirement rows for planning/audit; migration `20260915000000_recipe_qa_and_stage_input_unit` now also documents `RecipeStageInput.quantity` as the per-unit quantity field on the existing column and adds additive `ProductionStageExecution.qaOutOfTolerance` / `overrideJustification` persistence fields that are now actively populated by execution-time validation. The internal production architecture now includes an extracted planning seam at `src/services/production-planning.service.js`, an extracted execution seam at `src/services/production-execution.service.js`, a focused validation/audit helper seam at `src/services/production-stage-validation.service.js`, and a separate read-model seam at `src/services/production-material-availability.service.js`: planning remains active in create/approve runtime orchestration for centralized snapshot construction, formal QA-contract snapshot normalization, material-requirement calculation, approval-time stock revalidation, and snapshot enrichment inside inventory transactions guarded by the company advisory lock; the read-model seam now serves the mounted tenant-scoped `material-requirements` and `available-lots` reads using persisted `production_order_material_requirements`, current origin-warehouse stock, the frozen stage snapshot, and current tenant product `requiresLot` / `requiresExpiration` flags; and the execution seam now owns the current execution/return/completion aggregate logic after an explicit user-authorized advancement of the originally later split so `TASK-005` could satisfy the approved `production.service.js <= 600` acceptance without changing the public API. `src/services/production.service.js` remains the stable façade/export surface and `__private__` compatibility bridge, while the implemented `recipes-production-qa-execution-hardening` Phase 4 / `TASK-008` backend additions now enforce stage prerequisites, validate consumption against persisted requirements with the approved temporary `0.05` fallback tolerance, evaluate QA expected-vs-actual tolerances during execution, require `production.override` plus explicit justification for approved deviations, persist enriched QA measurements plus `qaOutOfTolerance` / `overrideJustification`, and emit request-aware override audit events when request context is available. The permission catalog consumed by the role-management surface is now also protected for already-provisioned databases by additive migration `20260819000000_backfill_production_permission_catalog`, which upserts and reactivates the approved `recipes.*` and `production.*` rows required by `GET /api/roles/permissions` and the root `#roles_permissions` UI; the procurement module now includes purchase-request, quotation, supplier-comparison, supplier-selection, optional approval, purchase-order foundation, and the RFQ invitation lifecycle under `/api/procurement`, backed by additive migration `20260823000000_add_supplier_quotation_invitations`, Prisma model `SupplierQuotationInvitation`, the `procurement-rfq` route/service/repository/schema set, route-specific public throttling on `/api/public/supplier-quotations/:token` and `/api/public/supplier-quotations/:token/response`, and lazy persistence of stale invitations to `EXPIRED` during relevant public/internal RFQ flows; the receipt/fiscal area now includes actual-arrival document, item-inspection, transactional confirmation/reversal stock posting, receipt-scoped fiscal-reference persistence under `/api/receipts`, and a dedicated company-scoped fiscal-reference list route under `/api/fiscal-references`; the root quotations workspace now includes RFQ invitation orchestration, machote copy/refresh, manual response capture, and tracking views; the root supply navigation now also includes implemented receipts and fiscal-reference workspaces over the same backend slice; the dedicated RFQ tracking page now treats expired invitations as terminal with no manual action; and the warehouse/QA browser runtime is now actively implemented under `/warehouse/` with bounded governance coverage. The procurement slice remains intention/approval only, fiscal references remain internal pending metadata only with no external Billing/Hacienda adapter, the public supplier-quotation page is intentionally unauthenticated but token-based, the new fiscal-reference list route is intentionally excluded from the current OpenAPI baseline through `docs/runtime-contract-manifest.json`, and standalone `/api/quality` is still not implemented in production code.

The implemented `/root/` shell now has a split actor presentation inside the same static runtime:
- global `root` keeps the top-navigation shell variant; and
- `company-admin` receives a rebranded fixed sidebar variant with grouped navigation, desktop collapse, and mobile drawer behavior.
- the sidebar contract now includes overflow hardening: fixed header/footer, a dedicated middle scroll region, defensive truncation/min-width rules, collapsed-only tooltip reveal, and a thin styled scrollbar limited to the scroll region.

`src/public/` now contains:
- the supported login and fallback documents;
- shared browser auth/session helpers;
- a supported root SPA shell under `src/public/root/` served at `/root/`;
- a supported agent SPA under `src/public/agent/` served at `/agent/`; and
- a supported warehouse/QA SPA under `src/public/warehouse/` served at `/warehouse/`; and
- a supported public supplier quotation page under `src/public/supplier-quote/` served at `/supplier-quote/`.

The implemented root shell is no longer limited to `Inicio` and a generic pending route. It now includes:
- root-global routes at `#home` and `#companies`;
- company-admin explicit sidebar routes at `#admin_home`, `#products`, `#lots`, `#movements`, legacy `#production`, grouped `#recetas` and `#produccion_ordenes`, `#agents`, `#routes`, `#zones`, `#clients`, legacy `#purchases`, grouped procurement entries (`#proveedores`, `#solicitudes_compra`, `#cotizaciones`, `#seguimiento_cotizaciones`, `#ordenes_compra`, `#recepciones`, `#referencias_fiscales`) in procurement-flow order, `#warehouses`, `#billing`, `#approvals`, `#reports`, `#users`, `#roles_permissions`, and `#settings`;
- implemented company-admin route destinations at `#warehouses`, `#products`, `#lots`, `#movements`, `#roles_permissions`, `#zones`, `#agents`, `#clients`, `#routes`, `#billing`, `#approvals`, `#proveedores`, `#solicitudes_compra`, `#cotizaciones`, `#seguimiento_cotizaciones`, `#ordenes_compra`, `#recepciones`, `#referencias_fiscales`, `#recetas`, and `#produccion_ordenes`, with materially deeper workflow support already present in `#recetas` than in `#produccion_ordenes`;
- the active root-shell router is still an explicit local dependency map, not a dynamic plugin loader: `src/public/root/router.js` requires `views.home`, `views.inProcess`, `views.companiesAdmin`, `views.rolesAdmin`, `views.zonesAdmin`, `views.agentsAdmin`, `views.clientsAdmin`, `views.routesAdmin`, `views.warehousesAdmin`, `views.productsAdmin`, `views.lotsAdmin`, `views.movementsAdmin`, `views.recipesAdmin`, `views.productionOrdersAdmin`, `views.billingAdmin`, `views.approvalsAdmin`, `views.suppliersAdmin`, `views.quotationsAdmin`, `views.rfqTrackingAdmin`, `views.purchaseRequestsAdmin`, `views.purchaseOrdersAdmin`, `views.receiptsAdmin`, and `views.fiscalRefsAdmin`; in that current map, `#recetas` resolves through `views.recipesAdmin`, `#produccion_ordenes` resolves through `views.productionOrdersAdmin`, `#proveedores` resolves through `views.suppliersAdmin`, `#solicitudes_compra` resolves through `views.purchaseRequestsAdmin`, `#cotizaciones` resolves through `views.quotationsAdmin`, `#seguimiento_cotizaciones` resolves through `views.rfqTrackingAdmin`, `#ordenes_compra` resolves through `views.purchaseOrdersAdmin`, `#recepciones` resolves through `views.receiptsAdmin`, and `#referencias_fiscales` resolves through `views.fiscalRefsAdmin`;
- dedicated inventory route modules at `#warehouses`, `#products`, `#lots`, and `#movements`, plus approved same-origin adapter seams for products, categories, inventory, and warehouses;
- a dedicated recipes adapter plus helper/state/renderer seams through `root/recipes-api.js`, `root/views/recipes-admin.helpers.js`, `root/views/recipes-admin.state.js`, and `root/views/recipes-admin.renderers.js`, with `#recetas` currently implemented as a usable administrative workflow for list/detail/filter/create/version/approve/assignment behavior over the existing recipe and product contracts; the active model remains explicit that products are assigned to recipes through `product.recipeId`, while order execution freezes a concrete recipe version through `productionOrder.recipeVersionId` and `recipeVersionSnapshot`; there is still no separately proven persisted product-specific applicable recipe-version binding;
- a dedicated `#produccion_ordenes` route module plus a read-only production-orders browser adapter and helper/state/renderer seams through `root/production-admin-api.js`, `root/views/production-orders-admin.helpers.js`, `root/views/production-orders-admin.state.js`, and `root/views/production-orders-admin.renderers.js`, all registered in the loader/runtime contract; the route now provides a usable live read-only supervision workflow with list/detail/KPI behavior, while explicitly limiting server-side filtering to pagination and keeping the remaining administrative filters client-side over the loaded page;
- within the root-shell supply navigation, `#proveedores`, `#cotizaciones`, `#seguimiento_cotizaciones`, `#recetas`, `#produccion_ordenes`, `#solicitudes_compra`, `#ordenes_compra`, `#recepciones`, and `#referencias_fiscales` are implemented module destinations today (`#solicitudes_compra` and `#ordenes_compra` delivered by the `purchase-orders-workspace` spec, and `#recepciones` / `#referencias_fiscales` by `recepciones-fiscales-workspace`); and
- a shared neutral `in_process` view used by the remaining current company-admin routes.

This refresh also accounts for the now-completed `p10-permission-governance` analysis package plus its implemented follow-up slices in `p28`, `p30`, and `p32`: a practical explainer of the governance recommendations lives in `docs/permission-governance-decisions.md`, while the active runtime foundation lives under `src/security/permission-governance*.js` and is now consumed by selected backend services for company creation plus company-role create/update hardening, including dedicated denial-path audit visibility for the enforced deny paths.

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
  - completed `p10-permission-governance` analysis package as governance input, now partially consumed by runtime services through the company-create deny, company-role create/update hardening, and company-role denial-audit visibility slices
  - the same security foundation now also carries implemented supply/intake permission metadata, named access policies, justification-required override markers, and proposed operational role bundles; supplier, recipe, production, procurement, and receipt policies are now consumed by mounted routes, `quality.view` / `quality.inspect` are now consumed by inspection endpoints mounted inside the production route group, and standalone quality modules are still not mounted yet
- Company administration
- Client management
- Product and inventory operations
  - the current product boundary now also owns additive sourcing metadata (`sourcingMethod`, `inventoryType`, `sku`, `barcode`, lot/expiration flags, standard/real cost) plus tenant-scoped allowed-warehouse and authorized-supplier links inside the existing product CRUD/import architecture
  - the current production boundary now owns an active production-order lifecycle plus stage execution/return/completion foundation over `ProductionOrder`, `ProductionStageExecution`, `ProductionConsumption`, `ProductionWaste`, and `ProductionReturn`, with the implemented status path `DRAFT -> PENDING_APPROVAL -> APPROVED -> IN_PROGRESS -> QA_HOLD (if rejected) -> COMPLETED (via /complete) or CANCELLED`, frozen recipe snapshots, tenant-scoped create/submit/approve/start/execute/return/complete/cancel flows, finished-goods stock receipt through `PRODUCTION_RECEIPT`, and an explicitly synchronized auxiliary aggregate `ProductionItem.consumedQuantity`
  - the same production/quality area now also owns an active QA inspection foundation over `QualityInspection`, including result enum `QualityInspectionResult`, stage-level inspection capture/listing under `/api/production`, order status transitions to and from `QA_HOLD`, and the reusable `checkMandatoryQaGatesForOrder` helper now consumed by completion flow gating
  - a first procurement bounded runtime now exists for purchase requests, quotations, comparisons, supplier selections, optional approval, and purchase orders under `/api/procurement`
  - a first receipt/fiscal bounded runtime now exists for actual-arrival document capture, company-scoped receipt detail, item inspection, transactional confirmation/reversal stock posting, receipt-scoped fiscal-reference persistence under `/api/receipts`, and company-scoped fiscal-reference listing under `/api/fiscal-references`; a first supplier-management bounded runtime now also exists under `/api/suppliers` for company-scoped supplier CRUD plus product assignment/removal; a first warehouse/QA browser runtime now also exists under `/warehouse/` for permission-gated receipts, production navigation, frozen recipe consultation, and same-origin capture helpers; standalone quality-route groups, external billing handoff, and deeper receipt/fiscal mutations in the root shell remain future work beyond the implemented product, supplier, recipe, production, additive quality, procurement foundation, receipt/fiscal backend foundation, root receipt/fiscal list/detail workspaces, and first warehouse/QA SPA slice
- Warehouses and geography
- Sales routing and agent workspace APIs
- Orders, invoices, and payments
- Billing and collections
  - billing trigger architecture: `billing-trigger.service.js` is called outside the dispatch Prisma transaction (best-effort, never throws)
  - creditBalance mutation contract with four explicit points: order approval (increment), payment approval (decrement), payment reversal (increment), order cancellation (decrement)
  - all creditBalance mutations use the shared `calculateInvoiceAmount` formula with `Math.max(0, total)` clamp
  - ledger endpoint (`GET /api/clients/:clientId/ledger`) with offset-based pagination (default 100, max 500) and optional `since` date filter
  - billing browser module: `billing-admin.js` (three tabs: receivables, pending payments, client ledger), `billing-admin.helpers.js`, `billing-admin.renderers.js`, `billing-api.js`, `clients-admin-store-dialog.js`
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
- **Procurement foundation (`src/routes/procurement.routes.js`, `src/services/procurement.service.js`, `src/repositories/procurement.repository.js`, `src/schemas/procurement.schema.js`)**: owns the current purchase-intent workflow over purchase requests, supplier quotations, quotation comparison, supplier selection, optional threshold-based approval, and purchase-order creation; it also now owns additive quotation-workspace support for quotable-product listing, tenant-scoped product supplier-pricing reads, and grouped assisted quotation request creation that fans out one purchase request plus one quotation per supplier inside a service-owned transaction; convergence migrations `20260822000000_backfill_suppliers_permission_catalog` and `20260822001000_backfill_supplier_product_pricing_convergence` are part of the active procurement-support baseline; it validates company-scoped product and supplier references and reuses the existing layered route/service/repository style without invoking inventory mutations
- **Procurement RFQ foundation (`src/routes/procurement-rfq.routes.js`, `src/routes/public-supplier-quotation.routes.js`, `src/services/procurement-rfq.service.js`, `src/repositories/procurement-rfq.repository.js`, `src/schemas/procurement-rfq.schema.js`, `src/lib/secure-token.js`, `src/middlewares/request-throttle.js`)**: owns the invitation-driven supplier RFQ lifecycle over `SupplierQuotationInvitation`, including secure token generation, SHA-256 token-hash persistence, invitation template/machote generation, authenticated tenant-scoped RFQ CRUD-like operations, unauthenticated supplier read/response by token, route-specific public throttling (`30/min` read, `10/min` submit), manual office-captured responses, RFQ tracking summaries, and lazy persistence of stale invitations to `EXPIRED`; it remains layered rather than hexagonal and still materializes expiration as request-path side effects rather than via a background state-transition process
- **Receipt and fiscal-reference foundation (`src/routes/receipt.routes.js`, `src/routes/fiscal-reference.routes.js`, `src/services/receipt.service.js`, `src/services/fiscal-reference.service.js`, `src/repositories/receipt.repository.js`, `src/repositories/fiscal-reference.repository.js`, `src/schemas/receipt.schema.js`, `src/schemas/fiscal-reference.schema.js`)**: owns the current receiving workflow over `PurchaseReceipt`, `PurchaseReceiptItem`, `ReceiptInspection`, and `FiscalDocumentReference`; it validates company-scoped purchase-order/supplier/warehouse/product references, persists actual-arrival document lines, records per-item inspections, confirms accepted quantities through transactional lot/stock/movement posting, reverses confirmed receipts through compensating transactional stock writes, stores `confirmedLotId` traceability on receipt items, persists receipt-scoped fiscal references strictly as `PENDING` internal handoff metadata without calling any external Billing or Hacienda API, and now also exposes a company-scoped fiscal-reference list route protected by `authenticate` plus `authorizeAccessPolicy('receipt.view')` with service-layer `assertCompanyScope` enforcement and repository ordering by `createdAt desc, id desc` including linked receipt/supplier context
- **Dependency-hygiene validator (`scripts/validate-dependency-hygiene.js`)**: executes `npm audit --json` and now enforces a zero-approved-residual baseline
- **Dependency-hygiene governance artifacts (`audit-baseline.json`, `docs/audit/dependency-hygiene-baseline.md`)**: record the current zero-vulnerability repository posture
- **Bcrypt compatibility suite (`tests/bcrypt-supply-chain-closeout.test.js`)**: freezes stored-hash compatibility and current hash-generation behavior without changing auth architecture
- **Repositories**: main Prisma persistence access pattern
- **Prisma**: schema and migration history
- **Shared browser helpers (`src/public/shared/session.js`, `src/public/shared/auth.js`)**: cookie-session bootstrap/read/cleanup and authenticated browser fetch/logout helpers
- **Login runtime (`src/public/index.html`, `src/public/login.js`)**: public auth entrypoint and post-login destination resolution
- **Root shell (`src/public/root/**`)**: supported authenticated root entrypoint, session bootstrap, bounded `window.RootShell` registry seam (`register`, `require`, `has`), explicit `runtime-contract.js` loader/module contract for the approved shared helpers and root-shell scripts, contract-driven app bootstrap/manifest validation, actor-aware guards, manifest-driven navigation, hash router, shared shell UI helpers, split actor furniture (root top-nav vs. company-admin sidebar), shell-owned global offsets,
- **Warehouse/QA shell (`src/public/warehouse/**`)**: supported authenticated warehouse entrypoint, session bootstrap through shared same-origin helpers, bounded `window.WarehouseShell` registry seam (`register`, `require`, `has`), permission-gated hash router with `TAB_DEFINITIONS`-based permission check (hidden entries gate sub-views without exposing them as tabs), bottom-tab/rail navigation, receipts workflow UI (4-step: arrival → inspection → evidence → confirm), production-order inline execute-stage form (with `quantityProcessed`, `wasteQuantity`, `materialConsumptions`, evidence) and complete-order section guarded by `canCompleteProduction`, a dedicated `receive-from-po.js` sub-view implementing a two-phase receive-from-purchase-order workflow (phase 1: select ISSUED PO from `GET /api/receipts/purchase-orders`; phase 2: fill actual quantities per item and select destination warehouse; submit to `POST /api/receipts`), read-only frozen recipe consultation, progressive-enhancement capture helpers for barcode/camera/manual flows, warehouse identity/logout controls, explicit local-only photo-evidence messaging for the current cycle, and bounded runtime-governance coverage enforced by `tests/warehouse-spa-runtime.test.js`, `tests/warehouse-receive-production-task001.test.js`, `tests/warehouse-receive-production-task002-007.test.js`, `tests/public-runtime-http-smoke.test.js`, and `scripts/validate-public-runtime.js`; `state.js` derives `canReceive` from `receipts.inspect`, `canExecuteProduction` from `production.execute`, `canCompleteProduction` from `production.complete`, and `canViewProduction` from `production.view`; warehouse-api.js now exposes `listPurchaseOrdersForReceipt`, `createReceipt`, `listWarehouses`, `startProductionOrder`, and `completeProductionOrder`
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
- **Root Products API adapter (`src/public/root/products-api.js`)**: same-origin browser adapter for paginated product listing, product detail, create, update, deactivate, and recipe assignment through `assignRecipeToProduct(...)` over `/api/products/**`
- **Root Recipes API adapter (`src/public/root/recipes-api.js`)**: same-origin browser adapter for recipe list/detail/create/update, version list/create/update, and version approval under `/api/recipes/**`
- **Root Categories API adapter (`src/public/root/categories-api.js`)**: same-origin browser adapter for tenant inventory category list/create under `GET/POST /api/products/categories/company`
- **Root Inventory API adapter (`src/public/root/inventory-api.js`)**: same-origin browser adapter for stock list, inventory alerts, paginated movement list, and lot QA updates under `/api/inventory/**`
- **Root Warehouses API adapter (`src/public/root/warehouses-api.js`)**: same-origin browser adapter for tenant warehouse list/create under `GET/POST /api/warehouses/company`
- **Root Suppliers API adapter (`src/public/root/suppliers-api.js`)**: same-origin browser adapter for tenant supplier list/detail/create/update plus product assignment/removal flows under `/api/suppliers/**`; it also reads the current product catalog through `GET /api/products` so the supplier workspace can populate and filter available product options client-side before assignment
- **Root Quotations API adapter (`src/public/root/quotations-api.js`)**: same-origin browser adapter for procurement quotation-workspace and RFQ operations under `/api/procurement/**`, currently covering quotable-product listing, product supplier-pricing detail, grouped assisted quotation-request submission, request comparison reads, quotation selection, selection approval, purchase-order creation, RFQ invitation list/create, invitation template refresh, cancellation, manual response submission, and RFQ tracking summary reads
- **Root Receipts API adapter (`src/public/root/receipts-api.js`)**: same-origin browser adapter for `GET /api/receipts`, `GET /api/receipts/:id`, `GET /api/fiscal-references`, and `GET /api/receipts/:receiptId/fiscal-references`, implemented over `InventoryAuth.fetchJson` with no direct `fetch` usage or hardcoded credentials
- **Receipt workspace seams (`src/public/root/views/receipts-admin.js`, `receipts-admin.renderers.js`)**: the supported `#recepciones` screen owns the company-scoped receipt list/detail workspace over `receiptsApi`, renders the same two-column `commercial-layout commercial-layout--rfq-tracking` pattern already used by the RFQ follow-up view, delegates HTML generation to XSS-safe renderer helpers, and currently offers refresh plus local selection/detail behavior over the existing read endpoints
- **Fiscal-reference workspace seams (`src/public/root/views/fiscal-refs-admin.js`, `fiscal-refs-admin.renderers.js`)**: the supported `#referencias_fiscales` screen owns the company-scoped fiscal-reference list/detail workspace over `receiptsApi`, reuses the same two-column commercial layout pattern, delegates markup to XSS-safe renderer helpers, and currently maps persisted enum states `PENDING`, `SUBMITTED`, `ACCEPTED`, and `REJECTED` to the active badge styles used in the root shell
- **Warehouses view seams (`src/public/root/views/warehouses-admin.js`, `warehouses-admin.helpers.js`, `warehouses-admin.renderers.js`)**: the supported `#warehouses` screen owns permission-aware warehouse listing/creation over `warehousesApi`, local in-memory filtering, KPI fallback derivation when backend summary data is absent, sellable-source/type helper behavior for the create dialog, and table/state rendering delegated to adjacent helper/renderer seams
- **Movements view seams (`src/public/root/views/movements-admin.js`, `movements-admin.helpers.js`, `movements-admin.renderers.js`)**: the supported `#movements` screen owns permission-aware read access over `inventoryApi.listMovements(...)`, warehouse-filter enrichment over `warehousesApi.listCompanyWarehouses(...)`, response normalization, audit formatting helpers, contextual metrics, paginated table rendering, explicit empty/error/forbidden states, and a read-only detail drawer delegated through adjacent helper/renderer seams
- **Products view seams (`src/public/root/views/products-admin.js`, `products-admin.helpers.js`, `products-admin.renderers.js`, `products-admin.state.js`)**: the supported `#products` screen owns permission-aware paginated product listing, detail loading, local search/category filtering over the current page dataset, mutation orchestration for create/update/deactivate flows, tenant category list/create flows, UI-state derivation, and renderer delegation through adjacent helper/state/renderer seams over `productsApi` and `categoriesApi`
- **Suppliers workspace seams (`src/public/root/views/suppliers-admin.js`, `suppliers-admin.helpers.js`, `suppliers-admin.renderers.js`)**: the supported `#proveedores` screen owns the company-scoped supplier workspace over `suppliersApi`, including supplier list/detail/create/update/delete orchestration, local supplier-name filtering, KPI/status summary rendering, assigned-product detail rendering, product-assignment/removal flows, client-side available-product filtering by name and SKU inside the add-product dialog, contextual option empty states, submit-button/search-summary state management, and the current edit-dialog handoff behavior that snapshots supplier detail before the detail dialog closes
- **Quotations workspace seams (`src/public/root/views/quotations-admin.js`, `quotations-admin.helpers.js`, `quotations-admin.renderers.js`)**: the supported `#cotizaciones` screen owns the procurement grouped quotation workspace plus RFQ invitation operations over `quotationsApi`, including shortage-first quotable-product ordering, local product search, supplier-pricing detail rendering, grouped supplier selection, grouped payload shaping, confirmation flow, grouped quotation-request submission, RFQ invitation list rendering, machote dialog behavior, invitation refresh/cancel actions, manual supplier-response capture, and RFQ tracking summary rendering through the active procurement quotation-workspace backend contract; after grouped quotation creation it now derives the RFQ continuation context from either nested `response.purchaseRequest.id` / `response.purchaseRequest.items` or the older top-level response fallback fields, preserves the selected supplier ids from the grouped quotation payload so the immediate RFQ invitation step no longer depends on still-populated product-selection state, and is now browser-E2E-proven for the same-screen grouped-quotation -> RFQ-invitation continuation path
- **Root RFQ tracking API adapter (`src/public/root/rfq-tracking-api.js`)**: same-origin browser adapter for the dedicated follow-up page, currently covering `GET /api/procurement/rfq-tracking` and `POST /api/procurement/rfq-invitations/:id/manual-response`
- **Root purchase orders API adapter (`src/public/root/purchase-orders-api.js`)**: same-origin browser adapter for the `#ordenes_compra` view, covering `GET /api/procurement/orders`
- **Root quotations comparison modules (`src/public/root/views/quotations-comparison.js`, `quotations-comparison.renderers.js`)**: comparison section extension point mounted into the quotations admin view; delivers comparison table, supplier selection dialog (with optional approval flow), and OC creation dialog
- **Root purchase requests admin view (`src/public/root/views/purchase-requests-admin.js`, `purchase-requests-admin.renderers.js`)**: `#solicitudes_compra` list+detail workspace over `GET /api/procurement/requests`
- **Root purchase orders admin view (`src/public/root/views/purchase-orders-admin.js`, `purchase-orders-admin.renderers.js`)**: `#ordenes_compra` list+detail workspace over `GET /api/procurement/orders`
- **RFQ tracking workspace seams (`src/public/root/views/rfq-tracking-admin.js`, `rfq-tracking-admin.renderers.js`)**: the supported `#seguimiento_cotizaciones` screen owns the standalone RFQ follow-up workflow over `rfqTrackingApi`, now using the same `commercial-layout` sidebar+detail pattern already established by `agents-admin`, `clients-admin`, and `routes-admin`; the view renders a `commercial-list-card` sidebar and `commercial-detail-card` detail region, auto-selects the first loaded request, preserves the previous selection on refresh when possible, keeps manual-response actions inside the detail panel, and the renderer contract now consists of `renderRequestListItem(...)`, `renderDetailPlaceholder()`, `renderRequestDetail(...)`, and `renderManualResponseDialog(...)` rather than the removed `renderTrackingTable`; `src/public/styles.css` provides the active `.rfq-tracking-sidebar-list` and `#rfq-tracking-detail-panel` layout rules plus the mobile max-height override
- **Lots admin view modules (`src/public/root/views/lots-admin.helpers.js`, `lots-admin.state.js`, `lots-admin.renderers.js`, `lots-admin.js`)**: functional RootShell company-admin inventory screen implementing the `#lots` route; `lots-admin.helpers.js` owns gate assessment (`assessLotDataGate`), normalizer (`normalizeLotStocks` → `LotStockUnit`), KPI builder, client-side filters/sort, date utilities, and permission helpers; `lots-admin.state.js` owns initial state; `lots-admin.renderers.js` owns HTML renderers for KPI cards, lot table rows, detail drawer body, QA form, and degraded state; `lots-admin.js` orchestrates parallel fetch of `GET /api/inventory/stocks`, `GET /api/inventory/alerts`, and `GET /api/warehouses/company`, applies the data-sufficiency gate, renders full or degraded mode, manages client-side filtering, and handles the QA action flow conditioned on `inventory.qa.manage` permission and a verified `lotId`
- **Root Companies API adapter (`src/public/root/companies-api.js`)**: same-origin browser adapter for root-company list/create/status operations against `/api/companies/root/companies` and `/api/companies/root/companies/:companyId/status`
- **Root Roles API adapter (`src/public/root/roles-api.js`)**: same-origin browser adapter for permission catalog plus company-role list/create/update operations against `/api/roles/permissions`, `/api/roles/company`, and `/api/roles/company/:roleId`
- **Roles admin view seam (`src/public/root/views/roles-admin.js`, `src/public/root/ui.js`)**: the supported `#roles_permissions` screen owns permission-catalog search by label/description/code/module, category grouping, selected-permission counters, edit-mode banners, sensitive-permission confirmation, read-only rendering for global roles, and anti self-lockout checkbox disabling when the actor edits their own active role
- **Shared auth helper (`src/public/shared/auth.js`)**: browser-runtime same-origin adapter that centralizes cookie-authenticated `fetch`/download/logout/bootstrap behavior, resolves root-relative API URLs against `window.location.origin` for nested supported shells, and keeps unauthorized handling/session clearing consistent across `/`, `/root/`, and `/warehouse/`
- **Public supplier quotation page (`src/public/supplier-quote/index.html`, `src/public/supplier-quote/app.js`)**: unauthenticated browser surface that reads a token from the URL, fetches invitation details from `/api/public/supplier-quotations/:token`, renders requested products, captures currency/notes/line pricing, and submits the supplier response back to the same public contract
- **Migration / no-access surfaces**: supported fallback pages for deprecated-route rendering and non-wave-one transition behavior
- **Legacy runtime archive (`legacy-public-runtime/`)**: preserved transition backup/reference inventory, not part of the served runtime
- **Access-policy facade (`src/security/access-policies.js`)**: preserves the observable middleware contract through `authorizeAccessPolicy(...)`, `getAccessPolicy(...)`, and `listAccessPolicies(...)`, composing the extracted registry, actor-scope, and denial-audit seams
- **Access-policy registry seam (`src/security/access-policy-registry.js`)**: owns the declarative route-policy catalog, including current mode, role/permission sets, boundaries, transitions, and selected actor-scope metadata; invoice routes now consume this facade consistently through explicit invoice policy IDs
- **Access-policy actor-scope seam (`src/security/access-policy-actor-scope.js`)**: owns `global-root`, `company-admin`, and `agent-workspace-user` actor-scope evaluation plus actor-scope denial error construction
- **Access-policy denial-audit seam (`src/security/access-policy-audit.js`)**: owns route-level actor-scope denial auditing through action `security.authorization.access_policy`
- **Permission-governance foundation (`src/security/permission-governance*.js`)**: owns centralized role-bundle definitions, permission metadata, governed-operation inventory, approved combination rules, global-root detection, reusable warning contract, operation evaluation (`allow` / `warn` / `deny`), and helper discovery of permissions that require override justification; the current metadata-enriched root roles-permissions catalog path consumes this foundation, and for this implemented scope the production grouping exposed there is the set of `recipes.*` plus `production.*` permission codes, with `quality.*` intentionally remaining outside that grouping; fresh environments materialize those rows through `prisma/seed.js`, while already-provisioned databases converge through additive migration `20260819000000_backfill_production_permission_catalog`
- **Company service**: still owns company orchestration and now rechecks `company.create` through the governance foundation before persistence
- **Role service**: owns company-role list shaping plus company-role create/update flows, enriches permission catalog responses with governance-backed display metadata, now filters `GET /api/roles/permissions` results to exclude governance entries whose resolved scope is `platform` for company-admin callers, rejects platform-scoped permission assignment such as `companies.manage` before persistence on both create and update, records governance warnings in audit metadata for successful allow/warn flows, emits dedicated fail-open denial audit attempts with actions `roles.company.create.governance_denied` and `roles.company.update.governance_denied`, resolves edited roles through `findCompanyOwnedRoleById(...)` first, enforces company ownership for edited roles, blocks self-lockout when an actor edits their own active role without retaining `settings.manage` and `users.manage`, resolves active users assigned to a successfully changed role, and triggers targeted browser-session invalidation with reason code `role_permission_change`
- **Inventory alerts seam (`src/services/inventory-alerts.service.js`)**: owns inventory-alert permission checks, serialization, valid status transitions, metadata merge behavior, and alert-focused audit coordination while `inventory.service.js` keeps broader stock and lot orchestration
- **Inventory product-total helper (`src/repositories/inventory.repository.js`)**: supported stock-entry and lot QA flows now update product totals through `updateProductById(id, companyId, data, db)`, which scopes by both `id` and `companyId` via `updateMany(...)` plus scoped re-read
- **Agent workspace store-state seam (`src/services/agent-workspace-store-state.service.js`)**: owns visit-state derivation, route normalization, invoice visibility rules, debt serialization, store-card shaping, sorting, and purchase-history shaping while `agent-workspace.service.js` keeps actor scoping and higher-level orchestration
- **Product permission/pricing seams (`src/services/product-permission-shaping.service.js`, `src/services/product-pricing.service.js`)**: own permission-aware product serialization, derived lot-usability decoration, and general-price synchronization while `product.service.js` keeps product CRUD/import orchestration, tenant-scoped category list/create orchestration, and inventory-linked stock registration; the final supported product update mutation now delegates to `product.repository.updateProduct(id, companyId, data, tx)` inside the existing transaction
- **Product sourcing foundation (`src/schemas/product.schema.js`, `src/services/product.service.js`, `src/repositories/product.repository.js`, `prisma/schema.prisma`)**: the current product module now validates and persists additive sourcing/inventory-classification fields plus `allowedWarehouseIds` and `authorizedSuppliers` within the existing route/service/repository layering; the service derives backward-compatible defaults, validates cross-tenant ownership of referenced warehouses and suppliers before persistence, and strips client-supplied `companyId` from update payloads so final writes remain auth-scoped
- **Supply security foundation (`src/security/access-policy-registry.js`, `src/security/permission-governance.config.js`, `src/security/permission-governance.service.js`, `src/security/role-bundles.config.js`)**: the current security module now contains named permission-governed policies for sourcing, suppliers, recipes, production, quality, procurement, receipts, warehouse access, intake overrides, and billing handoff operations; declarative permission metadata for those operations; `requiresJustification` markers for override permissions; and active bundle definitions for warehouse, production, QA, procurement, `company_admin`, and cross-role bundles. In the implemented code, `company_admin` includes the approved production families by default (`recipes.*` plus `production.*`), explicitly excluding `quality.*`. The `production_operator` bundle now includes `warehouse.access`, `receipts.view`, and `receipts.inspect` in `basePermissionCodes`, and `receipts.confirm` in `sensitiveAdditions`. The `warehouse_operator` bundle now includes `production.view` and `production.execute` in `allowedAdditions`, and `production.complete` in `sensitiveAdditions`. These cross-role permissions are backfilled to existing databases through `prisma/migrations/20260902000000_backfill_cross_role_permissions/migration.sql` (idempotent `ON CONFLICT DO UPDATE`). Recipe and production policies are consumed by mounted route groups
- **Production foundation (`src/routes/production.routes.js`, `src/services/production.service.js`, `src/services/production-planning.service.js`, `src/services/production-material-availability.service.js`, `src/services/production-execution.service.js`, `src/repositories/production.repository.js`, `src/repositories/inventory.repository.js`, `src/repositories/product.repository.js`, `src/schemas/production.schema.js`, `prisma/schema.prisma`)**: the current production module now validates and persists an active company-scoped production-order lifecycle with dedicated statuses, required warehouse/responsible references, frozen `recipeVersionSnapshot` JSON, persisted `materialRequirements`, and transitions for create/list/detail/submit/approve/start/execute/return/complete/cancel. Create and approve planning now run inside inventory-backed Prisma transactions guarded by `acquireCompanyInventoryAdvisoryLock(...)`, use the extracted planning seam to calculate per-product required quantities, persist `ProductionOrderMaterialRequirement` rows, enrich `recipeVersionSnapshot.materialRequirements`, and revalidate stock availability on approval before the state changes to `APPROVED`; `production.routes.js` now passes `req` into create/approve calls so stock-override audit events can be correlated when request context is available. The same planning seam now also normalizes `recipeVersionSnapshot.recipeVersion.stages[*].expectedParameters` to the formal QA contract `{ name, unit, expectedValue, minTolerance, maxTolerance }`, drops empty legacy `parameterTolerances`, and preserves non-empty legacy `parameterTolerances` arrays for backward compatibility through shared reuse of `buildRecipeVersionSnapshot(...)`, `buildEnrichedSnapshot(...)`, and `buildOrderSnapshotWithMaterialRequirements(...)`; this is an internal serialization hardening only and does not change mounted routes or Prisma schema. `src/services/production.service.js` now stays as the stable façade and compatibility layer, while `src/services/production-execution.service.js` owns the active execution/return/completion aggregate logic after an explicit user-authorized early split that satisfied the TASK-005 size acceptance without changing the public route/service contract. Stage execution now resolves the target stage from the frozen snapshot, enforces prior-stage completion order with `subCode=stage_out_of_sequence`, validates over-consumption against persisted or snapshotted order material requirements using the currently approved temporary fallback tolerance constant `0.05`, requires `production.override` plus explicit justification for approved consumption or QA deviations, validates QA numeric actuals against the frozen expected-parameter tolerances, persists enriched `actualParameters` entries `{ name, expectedValue, actualValue, unit, minTolerance, maxTolerance, withinTolerance }`, persists `qaOutOfTolerance` and `overrideJustification`, and reuses the existing inventory transaction helpers to post `movementType: OUT` deductions with `reasonCode` values `PRODUCTION_CONSUMPTION` and `PRODUCTION_WASTE`. The module now also has internal planning, read-model, and execution seams in `src/services/production-planning.service.js`, `src/services/production-material-availability.service.js`, and `src/services/production-execution.service.js`; at the current stage the planning seam owns centralized snapshot-safe recipe-version serialization plus reusable material-requirement and stock-availability helper logic, the read-model seam owns tenant-scoped `GET /api/production/orders/:id/material-requirements` and `GET /api/production/orders/:id/stages/:stageId/available-lots` responses, and the execution seam owns the runtime orchestration for stage execution, returns, aggregate reconciliation, and completion. The mounted material-requirements read returns `required/available/missing` using persisted `production_order_material_requirements` plus current origin-warehouse stock. The mounted available-lots read resolves stage quantities from the frozen snapshot, looks up `requiresLot` / `requiresExpiration` from the current tenant product catalog because those flags are not frozen in the current snapshot shape, filters to sellable lots, orders FEFO when expiration applies and FIFO by `entryDate` otherwise, and omits `internalLotNumber` from the response. The mounted `POST /api/production/orders/:id/stages/:stageId/execute` route now also forwards `req` into the execution service so override audit events can capture request context when available. The mounted `POST /api/production/orders/:id/stages/:stageId/returns` flow requires a prior execution for the same stage, creates explicit `ProductionReturn` rows, and posts stock-restoring `movementType: IN` entries with caller-supplied `reasonCode`, `sourceType: 'production_return'`, and `sourceId` linked to the created return record. The mounted `POST /api/production/orders/:id/complete` flow is transaction-scoped, validates `productionCompletionSchema`, requires current status `IN_PROGRESS`, enforces `checkMandatoryQaGatesForOrder(...)`, and now treats mandatory stages with `qaOutOfTolerance=false` as already passed while requiring an approved inspection only when `qaOutOfTolerance=true`; it then creates the finished-goods lot, posts an intake movement with `reasonCode: PRODUCTION_RECEIPT`, and transitions the order to `COMPLETED`. `ProductionConsumption.lotId`, `ProductionWaste.lotId`, and `ProductionReturn.lotId` are mandatory in Prisma and enforced through migrations `20260815000000_harden_production_consumption_lot_fk`, `20260816000000_harden_production_waste_lot_fk`, and `20260817000000_add_production_return_foundation`. Guardrail overrides currently reuse centralized `production.override` metadata plus explicit justification checks in the service layer; stock-shortage and stage-execution overrides now emit audit events when request context is present
- **Browser-session service**: owns opaque browser-session lifecycle, targeted invalidation primitives by session, user, and deduplicated user batches, store-readiness checks, explicit 503 mapping for store unavailability, and related audit instrumentation
- **Order list contract seam (`src/routes/order.routes.js`, `src/services/order.service.js`, `src/repositories/order.repository.js`)**: parses optional pagination query params and preserves the dual `GET /api/orders` contract of legacy array responses without pagination params versus `{ items, pagination }` envelopes when pagination is requested
- **Browser-session memory store**: in-process adapter that keeps a reverse `userId -> sessionIds` index so the current service can invalidate sessions for one user or a deduplicated batch without scanning the full store
- **Browser-session Redis store**: Redis adapter that keeps user-scoped session-ID sets, parses Redis array responses for `SMEMBERS`, and supports the current targeted invalidation primitives without introducing a framework Redis client
- **Health router**: exposes liveness and readiness, combining Prisma readiness with browser-session-store readiness
- **Aggregate test runner**: `scripts/run-tests.js` discovers `.test.js` files, applies preferred ordering, forwards Node test arguments, and injects the default test-safe environment
- **Public-runtime validator**: `scripts/validate-public-runtime.js` governs the supported public inventory, validates legacy relocation, and asserts login, migration, root-shell, and warehouse-runtime inventory/contracts, including `/warehouse/` as a supported production surface
- **Runtime-contract artifacts**: canonical reviewed artifacts under `docs/**`, including the partial OpenAPI baseline and critical-contract matrix that now cover the selected governance-admin surfaces from `p34` (company listing/creation, root-company listing/creation, assignable-role-permission listing, and company-role list/create/update) clarified by `p33`; after `p36`, the in-scope legacy governance validator also consumes those canonical `docs/**` artifacts directly, while `internal-docs/**` remains auxiliary/non-authoritative support material only
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
- the current browser-runtime `typecheck` baseline remains intentionally bounded and explicit, covering `src/public/shared/session.js`, `src/public/shared/auth.js`, `src/public/login.js`, all supported `src/public/warehouse/**` runtime files, and a selected allowlisted subset of `src/public/root/**` shell files rather than the full approved root-shell or agent-shell runtime inventory.
- bounded governance evidence now also includes `src/security/access-policies.js`, while still avoiding repository-wide `src/security/**` typecheck expansion.
- the root shell is governed by that explicit bounded `typecheck` allowlist plus lint, `validate-public-runtime`, smoke tests, characterization tests, route-governance tests, root-shell modularity tests, and browser E2E.
- the warehouse shell is governed by `validate-public-runtime`, the same bounded `typecheck` baseline, `tests/warehouse-spa-runtime.test.js`, `tests/public-surface-characterization.test.js`, `tests/public-runtime-http-smoke.test.js`, `tests/post-audit-baseline-hardening.test.js`, and the broader browser E2E source baseline that now expects `/warehouse/` as the supported landing path.
- `root/index.html` and `scripts/validate-public-runtime.js` now actively govern the approved inventory, supplier, quotations, and dedicated RFQ tracking browser modules plus the warehouses/products/movements/quotations view helper-renderer-state-controller scripts and the lots view modules as part of the supported shell loader contract; adding, removing, or reordering those scripts is a contract change. `src/public/root/runtime-contract.js` now includes the RFQ tracking script inventory, so loader-governance truth is synchronized across `index.html`, tests, validator expectations, and the runtime-contract source.
- the intended local validation entrypoints for browser/runtime governance are the repository-owned wrappers `scripts/run-eslint.js` and `scripts/run-tsc.js`, which keep `npm run lint:public-runtime` and `npm run typecheck` portable without depending on shell-exposed CLI shims.
- for sensitive root-shell modules, active governance now requires verifiable isolated characterization and/or continued use of the currently extracted seams: `router.js` is protected by `tests/root-shell-router-characterization.test.js`, `zones-admin.js` is protected by helper-seam assertions and isolated characterization coverage in `tests/root-shell-modularity-governance.test.js`, `tests/zones-view-selection-filters-characterization.test.js`, and `tests/zones-view-dialog-feedback-characterization.test.js`, the supported commercial views are protected by direct seam/governance coverage in `tests/agents-view-characterization.test.js`, `tests/clients-view-characterization.test.js`, `tests/routes-view-characterization.test.js`, `tests/root-shell-modularity-governance.test.js`, `tests/public-surface-characterization.test.js`, `tests/public-runtime-http-smoke.test.js`, `tests/typecheck-ci-hardening-governance.test.js`, and `tests/root-shell-commercial-views.e2e.js`, and the warehouses screen is additionally protected by `tests/warehouses-view-characterization.test.js` plus `tests/warehouses-view.e2e.js`.
- actor-aware route visibility is enforced in the shell manifest/guards for UX purposes, but backend company and role endpoints remain the authoritative security boundary.
- retired legacy pages and `legacy-public-runtime/` may not re-enter supported runtime, validator scope, or typecheck scope without a new approved specification.

## 7. Current database ownership and transaction boundaries
Current persistence architecture remains:
- Prisma schema as the system-of-record model definition
- versioned migrations under `prisma/migrations/`
- repositories as the main application-level persistence access pattern
- service orchestration above repositories

Current product and inventory stock-related mutation paths still keep transaction orchestration in services, but the final product mutations now enforce company scope at repository level. The same product service now also exposes tenant-scoped category list/create behavior by resolving the authenticated actor's company inventory before reading or writing categories.

The active supply foundation now extends database ownership across the current product, recipe, production, and procurement modules:
- Prisma enums `ProductSourcingMethod` and `ProductInventoryType` belong to the product schema, not to a separate procurement module;
- additive nullable product columns (`sku`, `barcode`, `sourcing_method`, `inventory_type`, `requires_lot`, `requires_expiration`, `standard_cost`, `real_cost`) remain owned by the `products` table;
- additive supplier authorization metadata remains owned by `product_suppliers`;
- warehouse authorization remains owned by the join table `product_allowed_warehouses`;
- recipe versioning remains owned by `recipe_versions`, `recipe_version_ingredients`, `recipe_stages`, and `recipe_stage_inputs`; and
- production lifecycle data now remains owned by `production_orders` and `production_items`, including `ProductionOrderStatus`, `product_id`, `recipe_version_id`, origin/destination warehouse references, responsible user reference, additive lifecycle timestamps, `override_justification`, `recipe_version_snapshot` JSON, and the auxiliary aggregate field `consumed_quantity`; and
- production planning detail data now also remains owned by `production_order_material_requirements`, including production-order linkage, planned source product linkage, planned quantity/unit snapshot, and the additive per-order requirement rows introduced for create/approve planning hardening; and
- production execution detail data now remains owned by `production_stage_executions`, `production_consumptions`, `production_wastes`, and `production_returns`, including stage identity/order/name, responsible user, actual parameter/evidence JSON, correlated `movement_group_id`, detailed stock-deduction rows, and stock-restoring return rows; and
- production-quality inspection data now remains owned by `quality_inspections`, including stage-execution linkage, inspector reference, optional inspected `lot_id`, result enum, expected/actual snapshot JSON, evidence JSON, corrective action text, and inspection timestamps; and
- procurement intention/approval data now remains owned by `purchase_requests`, `purchase_request_items`, `supplier_quotations`, `supplier_quotation_items`, `supplier_selections`, `purchase_orders`, and `purchase_order_items`, including company/request/supplier/product references, selection approval metadata, quotation evidence JSON, and purchase-order line pricing; additive supplier-pricing read support now also depends on `product_suppliers.unit_price`, `currency`, `lead_time_days`, `minimum_order_quantity`, `supplier_sku`, and `is_preferred`; the RFQ invitation lifecycle is now additionally owned by `supplier_quotation_invitations`, including tenant-scoped request/supplier links, optional linked quotation, token hash, invitation status, expiration timestamps, machote content, response source, and optional manual-response audit references; but this slice still owns no receipt confirmation, lot, stock-movement, or fiscal-document persistence; and
- receipt runtime data now remains owned by `purchase_receipts`, `purchase_receipt_items`, and `receipt_inspections`, including company/purchase-order/supplier/warehouse references, line-level requested/received/rejected quantities, optional lot/expiration capture, inspection evidence, confirmation/reversal status tracking, and `confirmed_lot_id` traceability for posted stock; and
- receipt fiscal-handoff metadata now remains owned by `fiscal_document_references`, including company ownership, confirmed purchase-receipt linkage, document type, `PENDING` lifecycle start, external reference text, simplified-regime flag, JSON metadata, and notes, but without any implemented external billing submission adapter in this architecture.

The inspected `p27`, `p28`, `p30`, and `p32` refreshes introduced no database ownership or transaction-boundary changes beyond those already documented, `supply-inventory-entry` `TASK-001` keeps the same service-owned transaction orchestration style rather than introducing a new persistence boundary, `TASK-002` likewise introduces no schema or transaction-boundary change because it is limited to centralized security metadata and access-policy definitions, `TASK-004` plus `TASK-005` continue the same layered service/repository transaction style rather than introducing a separate domain/application boundary, `TASK-006` hardens `production_consumptions.lot_id` without changing that overall layering, `TASK-009` preserves the same layering while adding repository/service-owned synchronization plus reconciliation of the auxiliary `ProductionItem.consumedQuantity` aggregate, `TASK-010` preserves the same layering while adding the additive `quality_inspections` persistence boundary plus service-owned QA gate/status orchestration, `TASK-012` preserves the same layered style while adding the additive procurement tables plus service/repository-owned request-selection-order orchestration, and `TASK-013` through `TASK-015` preserve the same layered style while extending the receipt slice with additive confirmation traceability and fiscal-reference persistence. Inventory transaction boundaries are now crossed by the receipt-confirmation workflow itself: confirmation and reversal execute through service-owned Prisma transactions plus the existing inventory transaction-support helpers rather than through a new domain/application layer.

## 8. Current API and integration contracts
Current active contracts relevant to architecture:
- REST-style API under `/api/*`
- health endpoints under `/health/*`
- browser runtime served from the same process
- package scripts, GitHub Actions workflows, validator scripts, and runtime-contract artifacts as repository contracts
- canonical runtime-contract ownership under `docs/**`
- the supported auth endpoints remain mounted under `/api/auth/login`, `/api/auth/me`, and `/api/auth/logout` in `src/app.js`, and the reviewed bounded baseline continues treating them as active runtime contracts
- `/api/auth/login` supports browser-session issuance when `X-Inventory-Browser-Session: cookie` is requested
- `/api/auth/me` returns the current authenticated user and refreshes browser-session cookies
- `/api/auth/logout` invalidates the backend-owned browser session and clears browser cookies
- no reviewed HTTP route currently exposes user- or batch-scoped browser-session invalidation directly; those primitives are internal service capabilities at this time
- `POST /api/companies/` now uses the dedicated route policy `company.create-global` while preserving the same endpoint and `403` semantics
- `GET /api/orders` is intentionally backward compatible: it returns the legacy array contract without pagination params and returns `{ items, pagination }` when `page` or `pageSize` is supplied
- existing product CRUD/import endpoints remain the active integration contract for the product-sourcing slice; they carry additive sourcing/classification metadata on the same `/api/products/**` routes instead of exposing a separate product-supply namespace
- `/api/production` is now an active backend integration contract with `GET /orders`, `POST /orders`, `GET /orders/:id`, `GET /orders/:id/material-requirements`, `GET /orders/:id/stages/:stageId/available-lots`, `POST /orders/:id/submit`, `POST /orders/:id/approve`, `POST /orders/:id/start`, `POST /orders/:id/stages/:stageId/execute`, `POST /orders/:id/stages/:stageId/returns`, `POST /orders/:id/stages/:stageId/inspections`, `GET /orders/:id/inspections`, `POST /orders/:id/complete`, and `POST /orders/:id/cancel`; `GET /orders/:id/material-requirements` is authenticated and policy-guarded through `production.view`, `GET /orders/:id/stages/:stageId/available-lots` is authenticated and policy-guarded through `production.execute`, the execute and returns routes are authenticated and policy-guarded through `production.execute`, the completion route is authenticated and policy-guarded through `production.complete`, the inspection routes are authenticated and policy-guarded through `quality.inspect` and `quality.view`, and all of them are intentionally classified through `docs/runtime-contract-manifest.json` rather than added to the current partial OpenAPI baseline
- `/api/procurement` is now an active backend integration contract with `GET /quotable-products`, `GET /products/:id/suppliers-pricing`, `POST /products/:id/request-quotations`, `GET /requests`, `POST /requests`, `GET /requests/:id`, `POST /requests/:id/quotations`, `GET /requests/:id/comparison`, `POST /requests/:id/select-quotation`, `POST /selections/:id/approve`, `POST /requests/:id/purchase-orders`, `POST /requests/:id/rfq-invitations`, `GET /requests/:id/rfq-invitations`, `POST /rfq-invitations/:id/refresh-template`, `POST /rfq-invitations/:id/cancel`, `POST /rfq-invitations/:id/manual-response`, `POST /requests/:id/cancel`, `GET /rfq-tracking`, and the new `GET /orders` (lists all purchase orders for the authenticated company, guarded by `procurement.view`, ordered by `createdAt` DESC, includes `supplier` and `items[].product`); these routes are authenticated and policy-guarded through `procurement.view`, `procurement.manage`, and `procurement.approve`, the assisted quotation route additionally consumes grouped payload validation from `createAssistedQuotationRequestSchema`, the RFQ routes consume dedicated RFQ schemas plus company-scope enforcement, the tracking contract now serializes purchase-request items for dedicated manual-capture prefilling, RFQ lifecycle/manual/public flows now emit audit events through `procurement-rfq.service.js`, and the active contract still ends at purchase intent/approval plus purchase-order creation without inventory receipt posting or fiscal-document generation
- `/api/receipts` is now an active backend integration contract with `GET /`, `POST /`, `GET /:id`, `GET /purchase-orders` (returns ISSUED purchase orders for the authenticated company, mounted **before** `/:id` to avoid Express route shadowing, consumed by the warehouse SPA `receive-from-po.js` view), `POST /:id/items/:itemId/inspections`, `POST /:id/confirm`, `POST /:id/reverse`, `GET /:id/fiscal-references`, and `POST /:id/fiscal-references`; these routes are authenticated and policy-guarded through `receipt.view`, `receipt.inspect`, `receipt.confirm`, and `receipt.reverse`; confirmation/reversal now trigger transactional inventory posting under the same service boundary; and fiscal-reference endpoints persist pending handoff metadata only, without any implemented external billing call
- `/api/public/supplier-quotations/:token` and `/api/public/supplier-quotations/:token/response` are now active unauthenticated backend contracts for supplier RFQ access by token; they validate the RFQ response payload, rely on token-hash lookup plus invitation-expiration enforcement, apply route-specific throttling (`30/min` read, `10/min` submit) through the shared request-throttle foundation, lazily persist stale invitations to `EXPIRED`, and intentionally bypass the normal authenticated tenant middleware path
- the access-policy registry now names current and future policy contracts for `product.sourcing.*`, `supplier.*`, `recipe.*`, `production.*`, `quality.*`, `procurement.*`, `receipt.*`, `warehouse.workspace.access`, `inventory.intake.override`, and `billing.handoff.*`; the recipe, production, procurement, and receipt policies are now actively consumed by mounted `/api/recipes`, `/api/production`, `/api/procurement`, `/api/receipts`, and `/api/fiscal-references` routes in `src/app.js`, including `production.complete` on `POST /api/production/orders/:id/complete`, `quality.view` and `quality.inspect` on inspection endpoints under `/api/production`, `receipt.confirm` and `receipt.reverse` on receipt stock workflows, `receipt.view` on the company-scoped fiscal-reference list route, and the remaining later supply route groups are still absent

Current public HTML/browser contract:
- supported public HTML: `/`, `/index.html`, `/no-access.html`, `/migration.html`, `/root/`, `/agent/`, `/warehouse/`, and `/supplier-quote/`
- supported authenticated root shell: `/root/` backed by `src/public/root/index.html`
- the `/root/` shell currently exposes two actor-specific navigation models in the same document: root-global top navigation and company-admin sidebar navigation
- current root-global shell hash routes are `#home` and `#companies`
- current company-admin sidebar hash routes are `#admin_home`, `#products`, `#lots`, `#movements`, `#production`, `#recetas`, `#produccion_ordenes`, `#agents`, `#routes`, `#zones`, `#clients`, `#purchases`, `#proveedores`, `#solicitudes_compra`, `#cotizaciones`, `#seguimiento_cotizaciones`, `#ordenes_compra`, `#recepciones`, `#referencias_fiscales`, `#warehouses`, `#billing`, `#approvals`, `#reports`, `#users`, `#roles_permissions`, and `#settings`
- `#warehouses`, `#products`, `#lots`, `#movements`, `#proveedores`, `#solicitudes_compra`, `#cotizaciones`, `#seguimiento_cotizaciones`, `#ordenes_compra`, `#recepciones`, `#referencias_fiscales`, `#recetas`, and `#produccion_ordenes` are supported shell routes in the active browser surface; `#warehouses` consumes the approved warehouses API adapter for list/create behavior, `#products` now consumes approved products and categories adapters for paginated list/detail/create/update/deactivate behavior plus tenant category administration, `#movements` consumes approved inventory and warehouses adapters for paginated read-only history behavior, `#lots` consumes approved inventory, alerts, and warehouses adapters in parallel with a data-sufficiency gate that degrades gracefully when lot fields are missing from the stock response, `#proveedores` consumes the approved suppliers adapter for supplier CRUD plus product assignment/removal behavior, `#solicitudes_compra` consumes the active procurement requests contract through the dedicated purchase-requests view seams, `#cotizaciones` consumes the approved quotations adapter plus quotations workspace seams for procurement grouped quotation behavior, approval flow, purchase-order creation handoff, and RFQ invitation lifecycle actions, `#seguimiento_cotizaciones` consumes the dedicated RFQ tracking adapter/view seams for standalone follow-up and manual capture, `#ordenes_compra` consumes the purchase-orders API adapter plus purchase-orders view seams over `GET /api/procurement/orders`, `#recepciones` and `#referencias_fiscales` consume the shared receipts API adapter plus dedicated renderer/view seams for receipt and fiscal-reference list/detail behavior, `#recetas` consumes the recipes adapter plus helper/state/renderer seams, and `#produccion_ordenes` consumes the production-orders adapter plus helper/state/renderer seams; previously referred to as a placeholder, `#lots` is now a functional company-admin inventory screen with graceful degraded mode
- the company-admin inventory sidebar order is `#warehouses`, `#products`, `#lots`, `#movements`
- `#companies` is a root-only shell surface backed by `/api/companies/root/companies` list/create/status contracts
- `#roles_permissions` is a company-admin shell surface backed by `/api/roles/permissions`, `/api/roles/company`, and `PUT /api/roles/company/:roleId`; the permission catalog is metadata-enriched for browser presentation and is now filtered server-side so company-admin callers do not receive platform-scoped entries such as `companies.manage`, company roles remain editable only when tenant-owned, and global roles stay read-only in the shell
- `#zones` is a company-admin shell surface backed by `/api/regions/company` and `/api/regions/company/:regionId/subregions`, with local in-memory search and server round-trips limited to load, refresh, and successful create actions
- `#agents` is a company-admin shell surface backed by `/api/users/company`, `/api/roles/company`, and `/api/sales-routes/company`, with frontend dataset composition, local filtering, company-user creation, and route-assignment saves through existing sales-route assignment contracts; on the backend, company-user creation now resolves requested roles through `findAssignableRoleByIdForCompany(...)` first so tenant-owned roles and active global non-root roles remain assignable while foreign-company, root, inactive, and nonexistent roles keep differentiated rejection semantics
- `#clients` is a company-admin shell surface backed by `/api/clients/company`, `/api/clients/:id`, `/api/clients/classifications/company`, `/api/clients/document-types`, `/api/clients/company/:clientId/stores`, `/api/clients/:clientId/documents`, `/api/clients/:clientId/references`, `/api/clients/:clientId/documents/:documentId/download`, `/api/taxpayers/lookup?identification=...`, `/api/economic-activities`, and `/api/regions/company`
- `#routes` is a company-admin shell surface backed by `/api/sales-routes/company`, `/api/sales-routes/company/:routeId`, `/api/sales-routes/company/:routeId/subzones`, `/api/sales-routes/company/:routeId/assignments`, `/api/sales-routes/company/agents/:userId/goals`, and `/api/regions/company`
- the approved inventory adapter layer now covers `/api/products/**`, tenant category list/create at `/api/products/categories/company`, `/api/inventory/stocks`, `/api/inventory/alerts`, `/api/inventory/movements`, `/api/inventory/lots/:lotId/qa`, and `/api/warehouses/company`; all four current inventory shell routes — `#warehouses`, `#products`, `#movements`, and `#lots` — actively consume that layer
- the remaining current company-admin sidebar routes render the shared neutral `in_process` view, with `#admin_home` as the default landing when no hash is present
- no supported root-shell contract exists today for company edit/delete/detail, role delete, direct permission mutation outside role assignment, or user-role reassignment
- a supported runtime company-role update flow now exists through `PUT /api/roles/company/:roleId`, with access-policy authorization (`role.company.update`), a company-owned repository lookup first, service-layer tenant ownership checks, platform-scope governance denial, transactional permission replacement, audit visibility, self-lockout prevention for the actor's own active role, active-user resolution for the changed role, and targeted browser-session invalidation after successful persistence; this current truth is also frozen by the focused governance-baseline sync guardrail documentation test
- deprecated public HTML: `/root/*.html`, `/warehouse/*.html`, `/agent/*.html` -> same URL, no redirect, shared migration screen, HTTP `410 Gone` (the supported warehouse browser runtime now lives at `/warehouse/`, not under legacy `/warehouse/*.html`)
- preserved legacy files under `legacy-public-runtime/` are not an integration contract
- login currently routes wave-one root-eligible users to `/root/`, routes warehouse-capable users with `warehouse.access` to the supported `/warehouse/` SPA, routes operational-agent users to `/agent/`, and keeps `sales_supervisor` on `/migration.html?mode=post-login-transition`

## 9. Current security boundaries
Current observable security boundaries include:
- authentication middleware for protected routes
- authorization middleware and access-policy logic
- current role-governance enforcement remains hybrid: route-level authorization still relies mainly on legacy role/policy middleware, but the repository now also has a bounded actor-scope convergence seam in `src/security/access-policies.js` for the company/company-role admin flows and the agent workspace routes while selected service-layer operations continue consulting the centralized governance foundation
- the current inventory-admin runtime foundation now also depends on permission-governed access-policy registry entries for product, category, warehouse, stock, movement, and lot-QA operations; the new tenant category contract is guarded through `product.category.list` and `product.category.create`
- the same security boundary now includes implemented supply/intake policies and permission codes for sourcing, suppliers, recipes, production, quality, procurement, receipts, warehouse workspace access, inventory-intake overrides, and billing handoff visibility/create; supplier, recipe, production, procurement, and receipt policies are actively consumed by mounted route groups, including supplier CRUD/assignment policies under `/api/suppliers`, completion under `/api/production/orders/:id/complete`, quality inspection policies under `/api/production`, procurement request/quotation/selection/approval/purchase-order policies under `/api/procurement`, and receipt inspection/confirmation/reversal policies under `/api/receipts`, while the remaining future-facing supply policies are declared ahead of later route groups
- `production.override` is now enforced through centralized metadata plus explicit justification checks across `src/services/production.service.js` and `src/services/production-stage-validation.service.js`; production order stock overrides and production stage execution overrides now both persist justification fields on the relevant production records and can emit request-aware audit events when request context is available, but the repository still lacks a broader cross-workflow override artifact model outside the production area. The newly mounted procurement routes currently consume `procurement.view`, `procurement.manage`, and `procurement.approve` without yet using `procurement.override`; the remaining future override permissions are still guarded only at the metadata/helper level through `requiresJustification: true` markers.
- company-role list/create/update now uses an intentionally clearer split contract: access policies declare explicit `company-admin` actor scope for the affected admin routes, while `role.service.js` denies platform-scoped permissions such as `companies.manage` before repository persistence on create/update, emits structured governance warnings for non-approved deny candidates, records service-level governance denials safely as dedicated audit attempts under actions `roles.company.create.governance_denied` and `roles.company.update.governance_denied`, and enforces self-lockout prevention when an actor edits their own active role
- company list/create now uses an intentionally clearer split contract: access policies declare explicit `global-root` actor scope for the affected admin routes, including the dedicated `company.create-global` route policy for `POST /api/companies/`, while `company.service.js` preserves the governance-service-backed global-root business check
- login throttling on the login route
- security headers in the Express app, including CSP selection by route
- strict same-origin CSP on `/`, `/index.html`, `/no-access.html`, `/migration.html`, `/root/`, `/supplier-quote/`, and deprecated legacy HTML routes that receive the migration response, without the previously retired CDN allowances; `/supplier-quote/` uses its own minimal same-origin policy in `src/app.js`
- same-origin browser API helpers resolve root-relative paths to absolute same-origin URLs before network dispatch so nested supported shells do not accidentally degrade into path-relative calls such as `/root/api/...`
- JWT verification is pinned to the application's explicit signing algorithm allowlist in `src/lib/auth.js`
- browser-session cookies with `HttpOnly` on the opaque session cookie, `SameSite=Lax`, and conditional `Secure` enforcement for production or HTTPS-capable requests
- same-origin `Origin` validation on mutating cookie-authenticated requests in `authenticate.js`
- the public RFQ supplier contract intentionally bypasses authentication and tenant middleware, relying instead on opaque token delivery, SHA-256 token-hash lookup, dedicated throttling, and expiration/cancelled/responded checks; lazy `EXPIRED` persistence now happens when stale invitations are touched by public or relevant internal RFQ flows
- explicit no-fallback failure behavior when Redis-backed browser-session persistence is configured but unreachable
- client-side root guards acting only as UX gates; backend APIs remain the authority
- the current shell actor split is global `root` without `companyId` for the top-nav shell and routes `#home` / `#companies`, and `admin` with `companyId` for the sidebar shell where `#admin_home` is the default landing, `#warehouses`, `#products`, `#movements`, `#lots`, `#roles_permissions`, `#zones`, `#agents`, `#clients`, and `#routes` are the current functional tenant-admin routes; within the inventory group all four routes (`#warehouses`, `#products`, `#lots`, `#movements`) are now functional; the remaining approved sidebar routes fall back to the shared `in_process` view

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
Current implemented testing posture includes:
- dependency-governance coverage now also includes `tests/dependency-hygiene-governance.test.js` for the zero-residual baseline and `tests/bcrypt-supply-chain-closeout.test.js` for stored-hash compatibility, login continuity, and current hash-generation behavior
- the latest user-supplied repository-wide validation baseline reports `npm run typecheck` passed, `npm run lint` passed, and `npm run test -- --silent` passed with `1015/1017` tests green, `0` failed, and `2` skipped; the previously noisy governance baseline suite is also reported green after the audit file correction
- `scripts/run-tests.js` as the official aggregate repository test runner
- inventory validation through `scripts/validate-public-runtime.js`
- characterization tests for supported public surface and browser auth/session convergence
- HTTP smoke validation for supported public-runtime responses
- governance tests for runtime-contract completeness and OpenAPI consistency
- browser E2E coverage
- bounded browser-runtime typecheck coverage over `src/public/shared/session.js`, `src/public/shared/auth.js`, `src/public/login.js`, and a selected allowlisted subset of `src/public/root/**` shell files rather than the full approved root-shell runtime inventory
- focused route/modularity/browser coverage through `tests/root-shell-route-governance.test.js`, `tests/root-shell-router-characterization.test.js`, `tests/root-shell-modularity-governance.test.js`, `tests/root-shell-supply-manifest.test.js`, `tests/root-shell-rfq-tracking-api-characterization.test.js`, `tests/rfq-tracking-view-characterization.test.js`, `tests/rfq-runtime-governance-alignment.test.js`, `tests/root-shell-recipes-api-characterization.test.js`, `tests/root-shell-recipes-admin-view-characterization.test.js`, `tests/root-shell-production-admin-api-characterization.test.js`, `tests/root-shell-production-orders-admin-view-characterization.test.js`, `tests/root-shell-quotations-api-characterization.test.js`, `tests/quotations-view-characterization.test.js`, `tests/purchase-orders-workspace-views-characterization.test.js`, `tests/procurement-quotation-workspace-convergence.test.js`, `tests/root-inventory-adapters-characterization.test.js`, `tests/product-category-contract-characterization.test.js`, `tests/public-surface-characterization.test.js`, `tests/agents-view-characterization.test.js`, `tests/clients-view-characterization.test.js`, `tests/routes-view-characterization.test.js`, `tests/warehouses-view-characterization.test.js`, `tests/warehouses-view.e2e.js`, `tests/products-view-characterization.test.js`, `tests/products-view.e2e.js`, `tests/movements-view-characterization.test.js`, `tests/movements-view.e2e.js`, `tests/suppliers-view-characterization.test.js`, `tests/suppliers-view.e2e.js`, `tests/zones-view-selection-filters-characterization.test.js`, `tests/zones-view-dialog-feedback-characterization.test.js`, `tests/zones-view.e2e.js`, `tests/secure-token.test.js`, `tests/procurement-rfq-routes-contract.test.js`, `tests/procurement-rfq-service.test.js`, and `tests/procurement-rfq-audit.test.js`; the route-governance, supply-manifest, and router-characterization suites now also freeze the production/compras manifest grouping plus route resolution for `#recetas`, `#produccion_ordenes`, `#proveedores`, `#solicitudes_compra`, `#cotizaciones`, `#seguimiento_cotizaciones`, and `#ordenes_compra`, the RFQ tracking API/view suites freeze the dedicated follow-up page contracts and modal manual-capture behavior, and `tests/rfq-tracking-view-characterization.test.js` now also freezes the sidebar+detail markup contract, the `renderRequestListItem(...)` / `renderDetailPlaceholder()` / `renderRequestDetail(...)` renderer split, and the manual-response dialog field ids/names used by the view controller; the suppliers characterization suite freezes the dedicated supplier workspace render contract, helper/filter behavior, renderer output, add-product dialog product-search/filter UI, and the current edit-dialog sequencing fix, the suppliers E2E suite freezes the browser flows for supplier list, create, edit, filtered product assignment, and read-only action hiding, the recipes API characterization suite freezes the browser contract for `/api/recipes/**` plus product recipe-assignment helper behavior, the production-orders API characterization suite freezes that `/api/production/orders/**` remains read-only and that unsupported oversight filters stay explicitly client-side, the production-orders view characterization suite freezes that `#produccion_ordenes` renders a real supervision workspace with metrics/list/detail regions while excluding warehouse/QA actions, the quotations API characterization suite now also freezes comparison/selection/approval/purchase-order helper exports plus RFQ invitation endpoints and tracking reads, the quotations view characterization suite freezes that `#cotizaciones` renders a dedicated grouped quotation workspace rather than placeholder copy, the purchase-orders workspace characterization suite freezes the implemented `#solicitudes_compra` and `#ordenes_compra` module render contract, the RFQ/token/audit suites freeze token generation/hash semantics plus the internal/public RFQ service audit contract, and the recipes view characterization suite freezes that `#recetas` renders an administrative workspace rather than the prior intro copy and keeps the shared-recipe/version-ambiguity warnings visible, while the warehouse-specific suites freeze helper/rendering/list-create behavior for the supported `#warehouses` screen, the products-specific suites freeze product list/detail/filter/mutation/category flows for the supported `#products` screen, the movements-specific suites freeze helper/rendering/filter/pagination/detail behavior for the supported `#movements` screen, and the adapter/category suites freeze the registered inventory browser contracts and tenant-scoped category backend behavior
- inventory hotspot characterization coverage through `tests/inventory-service-hotspot-characterization.test.js`, freezing paginated inventory movement/alert seams, alert disappearance conflict handling, and transaction propagation around `updateLotQa` and `registerStockEntry`
- agent-workspace hotspot characterization coverage through `tests/agent-workspace-hotspot-characterization.test.js`, freezing tenant-scoped store filtering/sorting, store summary serialization, and current order-payload coercion/delegation behavior
- product hotspot characterization coverage through `tests/product-service-hotspot-characterization.test.js`, freezing repository-transaction ownership for `createProduct`, derived lot-usability decoration, category-cache reuse during import, import-time inventory registration coupling, tenant-scoped allowed-warehouse and authorized-supplier validation, and update-path company-scope hardening
- product sourcing schema coverage through `tests/product-sourcing-schema.test.js`, freezing accepted enum values, duplicate authorization rejection, and additive payload coercion for the current sourcing foundation
- access-policy hotspot characterization coverage through `tests/access-policies.test.js` and `tests/authorization-convergence-characterization.test.js`, freezing strict registry lookup behavior, actor-scope inventories, denial-audit metadata, and selected route-policy mappings without changing runtime semantics
- permission-governance foundation coverage through `tests/permission-governance-foundation.test.js`, freezing centralized policy versioning, warning-contract fields, governed operations, root detection, platform-scope detection, and justification-required permission helpers
- targeted permission-catalog remediation coverage through `tests/production-permission-catalog-backfill-migration.test.js`, `tests/role-permissions-enrichment.test.js`, and `tests/role-permissions-route.test.js`, freezing the additive backfill migration plus the service/route exposure of the approved `recipes.*` and `production.*` permission families used by the root roles-permissions surface; `tests/role-permissions-enrichment.test.js` now also freezes the current server-side exclusion of platform-scoped catalog entries for company-admin callers
- targeted due-diligence remediation coverage now also includes `tests/product-service-hotspot-characterization.test.js`, `tests/inventory-service-hotspot-characterization.test.js`, `tests/pagination.test.js`, `tests/order-lifecycle-contract-characterization.test.js`, `tests/auth-hardening-characterization.test.js`, `tests/lot-datetime-characterization.test.js`, `tests/production-baseline-characterization.test.js`, `tests/production-material-availability.service.test.js`, `tests/production-routes-contract.test.js`, and `tests/runtime-contract-governance.test.js`
- `docs/test-suite-catalog.md` as the maintained reference for the affected DB-free vs DB-backed suite boundary
- `tests/coding-standard-path-alignment.test.js` as the focused governance check for canonical versus compatibility coding-standards paths
- `tests/documentation-ownership-governance.test.js` as the focused governance check for the ownership map and the canonical workflow/documentation references
- `tests/governance-baseline-sync-guardrails.test.js` as the intentionally narrow documentation-sync guardrail for selected canonical `docs/**` and role-update-seam statements only
- `tests/openapi-contract-consistency.test.js` as the bounded OpenAPI/route-alignment guardrail for the reviewed partial baseline, explicitly including `PUT /api/roles/company/{roleId}`
- focused compatibility evidence for `session-docs-tenant-hardening` and the later RFQ alignment work is now part of the active test baseline: `tests/browser-session-auth-boundary.test.js` freezes cookie-mode `/api/auth/login` + `/api/auth/me` + `/api/auth/logout` behavior for the reviewed seam, `tests/root-shell-router-characterization.test.js` and `tests/root-shell-route-governance.test.js` freeze actor-scoped root-shell fallback and the supported route registrations, `tests/governance-baseline-sync-guardrails.test.js`, `tests/access-policies.test.js`, `tests/critical-contract-governance.test.js`, `tests/permission-governance-backend-consumption.test.js`, and `tests/rfq-runtime-governance-alignment.test.js` close the focused governance/contract lane for the reviewed surfaces; `tests/quotations-view-characterization.test.js` freezes the nested `response.purchaseRequest.id` / `response.purchaseRequest.items` RFQ continuation handoff plus selected-supplier preservation inside the quotations workspace; and `tests/quotations-view.e2e.js` now verifies the browser-level continuation from grouped quotation confirmation into RFQ invitation creation within the same `#cotizaciones` workspace. The latest user-supplied maintenance-cycle evidence for this seam reports `node --test tests/quotations-view.e2e.js` passed, `node scripts/run-eslint.js tests/quotations-view.e2e.js --max-warnings 0` passed, and `npm run typecheck` passed
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

Recorded post-implementation evidence supplied by the user for `supply-inventory-entry` `TASK-001`:
- targeted product/regression tests passed (`tests/product-sourcing-schema.test.js`, `tests/product-service-hotspot-characterization.test.js`, `tests/product-category-contract-characterization.test.js`, `tests/product-delete-semantics.test.js`, `tests/pagination.test.js`)
- `npm run lint` passed
- `npm run typecheck` passed
- `npx prisma validate --schema prisma/schema.prisma` passed
- `npm run build` passed
- `npm run test -- --silent` passed
- baseline audit rerun now scores the repository `9.2/10` and treats `TASK-001` as baseline-safe, with remaining non-blocking concerns limited to clean-database migration execution evidence, thinner route/integration coverage for the new product metadata, and continued hotspot sensitivity in `src/services/product.service.js`

Recorded post-implementation evidence supplied by the user for `supply-inventory-entry` `TASK-002`:
- targeted security/governance tests passed (`tests/access-policies.test.js`, `tests/permission-governance-foundation.test.js`)
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed
- `npm run test -- --silent` passed
- follow-up audit context for the earlier warehouse/runtime alignment no longer matches the current role-governance baseline exactly: the repository now includes the implemented company-role update surface plus additive seed and existing-database backfill coverage for the active recipes/production governance-backed catalog, while override-justification behavior has advanced from metadata-only to an implemented production baseline and still awaits equivalent adoption in later workflow services

Recorded post-implementation evidence supplied by the user for `supply-inventory-entry` `TASK-003`:
- targeted recipe/versioning tests passed (`tests/recipe-routes-contract.test.js`, `tests/recipe-schema.test.js`, `tests/recipe-service-foundation.test.js`)
- `npm run lint` passed
- `npm run typecheck` passed
- `npx prisma validate --schema prisma/schema.prisma` passed
- `npm run test -- --silent` passed
- local Windows `npm run build` remains environment-sensitive because Prisma generate can still hit rename-lock `EPERM`
- follow-up audit context scores the repository `8.3/10` and treats `TASK-003` as conditionally baseline-safe, with remaining warnings limited to documentation freshness, transitional recipe-model coexistence, partial OpenAPI exclusion, and later concurrency/approval follow-ups

Recorded post-implementation evidence supplied by the user for `supply-inventory-entry` `TASK-005`:
- `node --test tests/production-service-foundation.test.js tests/production-schema.test.js tests/production-routes-contract.test.js tests/runtime-contract-governance.test.js` passed
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed
- `npx prisma validate` passed
- local Windows build may still emit handled Prisma retry noise while preserving the final success status
- remaining architecture warnings after that earlier slice were focused on permission seed/runtime drift, partially app-enforced production invariants, missing DB-level FK hardening for the new execution-detail rows, and the then-unsynchronized `ProductionItem.consumedQuantity` aggregate field; the aggregate warning was later closed by `TASK-009`, and the recipes/production permission-catalog drift for already-provisioned databases was later closed by migration `20260819000000_backfill_production_permission_catalog` plus targeted route/service/migration tests

Recorded post-implementation evidence supplied by the user for `supply-inventory-entry` `TASK-006`:
- `node --test tests/production-service-foundation.test.js tests/production-schema.test.js tests/production-consumption-hardening-migration.test.js` passed
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed
- `npx prisma validate --schema prisma/schema.prisma` passed
- remaining architecture warnings after this slice were focused on `ProductionWaste` lot hardening still pending, missing `warehouse_id` / `product_id` FKs on execution-detail rows, and the then-unsynchronized `ProductionItem.consumedQuantity` aggregate field; that aggregate warning was later closed by `TASK-009`

Recorded post-implementation evidence supplied by the user for `supply-inventory-entry` `TASK-007`:
- `node --test tests/production-service-foundation.test.js tests/production-schema.test.js tests/production-waste-hardening-migration.test.js` passed
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed
- `npx prisma validate --schema prisma/schema.prisma` passed
- remaining architecture warnings after this slice are now focused on missing `warehouse_id` / `product_id` FKs on execution-detail rows, the approved temporary over-consumption fallback tolerance constant `0.05` that still needs eventual company-scoped persistence, a possible cumulative-consumption edge case that deserves future approved verification, and the unresolved `DEC-016` contradiction where future idempotency planning assumes an active `endedAt IS NULL` execution model while the current Prisma model and runtime validation still require `endedAt`; the former `ProductionItem.consumedQuantity` drift warning is closed because that field is now synchronized as an auxiliary aggregate from authoritative consumption detail

Recorded post-implementation evidence supplied by the user for `supply-inventory-entry` `TASK-008`:
- `node --test tests/production-service-foundation.test.js tests/production-schema.test.js tests/production-routes-contract.test.js tests/runtime-contract-governance.test.js tests/production-return-foundation-migration.test.js` passed
- `npm run lint` passed

Additional post-implementation evidence supplied by the user for `recipes-production-qa-execution-hardening` Phase 4 / `TASK-008`:
- `node --test tests/production-execution.service.test.js tests/quality-inspection-foundation.test.js tests/production-schema.test.js` passed
- `npm run typecheck && npm run lint && npm run build && npm test -- --silent` passed
- full suite reported `1232` passing, `0` failing, `2` skipped
- `src/services/production.service.js` reported at `591` lines and `src/services/production-execution.service.js` reported at `582` lines after the final helper extraction
- `npm run typecheck` passed
- `npm run build` passed
- `npx prisma validate --schema prisma/schema.prisma` passed
- remaining architecture warnings after this slice are now focused on missing `warehouse_id` / `product_id` FKs on execution-detail rows; the former `ProductionItem.consumedQuantity` drift warning is closed because that field is now synchronized as an auxiliary aggregate from authoritative consumption detail

Recorded post-implementation evidence supplied by the user for `supply-inventory-entry` `TASK-009`:
- `tests/production-service-foundation.test.js` now includes five new tests plus one updated test covering aggregate synchronization and reconciliation behavior
- 31 tests passed
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed
- amendment sequence `TASK-006` through `TASK-009` is now complete for production lot hardening, returns, and auxiliary aggregate alignment
- closed residual risks: `RISK-007` aggregate drift and `RISK-009` downstream aggregate-first assumptions
- next downstream supply follow-up is `TASK-010` as of the post-`TASK-009` baseline

Recorded post-implementation evidence supplied by the user for `supply-inventory-entry` `TASK-010`:
- Prisma now includes enum `QualityInspectionResult` and model `QualityInspection` with FKs to `production_orders`, `production_stage_executions`, and optional `lots`
- new backend files `src/schemas/quality.schema.js`, `src/repositories/quality.repository.js`, and `src/services/quality.service.js` are implemented
- `/api/production` now includes `POST /orders/:id/stages/:stageId/inspections` guarded by `quality.inspect` and `GET /orders/:id/inspections` guarded by `quality.view`
- QA status transitions now include `REJECTED -> QA_HOLD` and `APPROVED` on `QA_HOLD -> IN_PROGRESS`
- `checkMandatoryQaGatesForOrder` is now available as a reusable downstream gate helper consumed by completion flow
- 53 tests passed
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed

Recorded post-implementation evidence supplied by the user for `supply-inventory-entry` `TASK-011`:
- `src/services/production.service.js` now implements transactional `completeProductionOrder(...)`
- `src/schemas/production.schema.js` now includes `productionCompletionSchema`
- `src/routes/production.routes.js` now exposes `POST /orders/:id/complete` guarded by `production.complete`
- production completion now enforces mandatory QA gates, creates the finished-goods lot, posts a `PRODUCTION_RECEIPT` intake movement, and transitions the order to `COMPLETED`
- 12 new tests were added and 59 tests passed in the reported suite baseline
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed
- next downstream supply follow-up is `TASK-012`

Recorded post-implementation evidence supplied by the user for `supply-inventory-entry` `TASK-012`:
- `src/app.js` now mounts `/api/procurement`
- Prisma now includes `PurchaseRequest`, `PurchaseRequestItem`, `SupplierQuotation`, `SupplierQuotationItem`, `SupplierSelection`, `PurchaseOrder`, and `PurchaseOrderItem` plus the procurement status enums and migration `20260818010000_add_procurement_foundation`
- new backend files `src/routes/procurement.routes.js`, `src/services/procurement.service.js`, `src/repositories/procurement.repository.js`, and `src/schemas/procurement.schema.js` are implemented
- runtime workflow now reaches `request -> quotation -> comparison -> selection -> optional approval -> purchase order`
- the procurement slice currently has no inventory effects and does not create receipts, lots, warehouse balances, or stock movements
- 79 tests passed
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed
- next downstream supply follow-up is `TASK-013`

Recorded post-implementation evidence supplied by the user for `supply-inventory-entry` `TASK-013`:
- `src/app.js` now mounts `/api/receipts`
- Prisma now includes `PurchaseReceipt`, `PurchaseReceiptItem`, and `ReceiptInspection` plus enums `PurchaseReceiptStatus` and `ReceiptInspectionResult`, additive `PurchaseReceiptItem.confirmedLotId` traceability from migration `20260818030000_add_receipt_confirmation_lot_link`, and `FiscalDocumentReference` from migration `20260818040000_add_fiscal_document_reference`
- new backend files `src/routes/receipt.routes.js`, `src/services/receipt.service.js`, `src/services/fiscal-reference.service.js`, `src/repositories/receipt.repository.js`, `src/repositories/fiscal-reference.repository.js`, `src/schemas/receipt.schema.js`, and `src/schemas/fiscal-reference.schema.js` are implemented
- runtime workflow now reaches `actual arrival receipt document -> item inspection -> confirmation -> reversal`, with company-scoped transactional stock posting and lot traceability on confirmation/reversal
- receipt-scoped fiscal-reference persistence is active, but only as pending handoff metadata; no external Billing or Hacienda API adapter exists in the implemented architecture
- 102 tests passed
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed
- next downstream supply follow-up is `TASK-016`

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
- keep Roles/Permissions Admin bounded to the existing permission catalog and company-role list/create/update endpoints only
- keep Zones bounded to the existing company-regions list/create/subregion-create endpoints only
- keep `#agents`, `#clients`, and `#routes` as active company-admin root-shell modules over the existing backend contracts, preserving the extracted renderer/state seams and governance coverage added during `root-shell-commercial-views-hardening`
- keep `#recetas` and `#produccion_ordenes` mounted as implemented root-shell routes instead of sending users to the shared generic `in_process` view
- keep the current `root-admin-recipes-production` depth truthful: `#recetas` is now the richer administrative workspace over the approved `recipesApi`, `productsApi`, and adjacent helper/state/renderer seams, while `#produccion_ordenes` is now a usable read-only supervision workflow over the approved `productionAdminApi` plus helper/state/renderer seams, but with a deliberately narrower filtering model because only pagination is server-side and the remaining filters stay client-side over the loaded page
- keep the model gap explicit in active docs and UI behavior: current persistence proves recipe assignment at `product.recipeId` plus order-level frozen version selection at `productionOrder.recipeVersionId` / `recipeVersionSnapshot`, but not a standalone persisted product-specific applicable recipe-version binding
- keep the remaining approved company-admin sidebar entries mapped to the shared neutral `in_process` view until later approved slices implement real modules; among the inventory entries this no longer applies to `#lots`, `#warehouses`, `#products`, or `#movements`, and within the production/compras groups it now mainly applies to the legacy standalone `#production` / `#purchases` routes, so within the root-shell supply slice `#proveedores`, `#solicitudes_compra`, `#cotizaciones`, `#seguimiento_cotizaciones`, `#ordenes_compra`, `#recepciones`, `#referencias_fiscales`, `#recetas`, and `#produccion_ordenes` remain the implemented destinations
- keep company-admin sidebar tooltips display-gated until collapsed hover/focus so hidden tooltip boxes do not affect layout width
- keep header/footer fixed and constrain scrolling plus styled scrollbar behavior to the middle sidebar region only
- keep shell-owned global offsets separate from individual view layout concerns
- keep unsupported role/company edit flows out of the root shell until a later approved slice introduces them
- keep `/migration.html?mode=post-login-transition` as the supported temporary landing for non-wave-one browser profiles
- intercept deprecated legacy HTML routes at the HTTP boundary and return `410 Gone` with the shared migration screen from the same URL
- preserve the removed functional legacy runtime outside the active runtime in `legacy-public-runtime/`
- keep reviewed canonical runtime-contract ownership under `docs/**` and treat `internal-docs/**` as auxiliary only
- keep the focused governance/doc-sync guardrail intentionally bounded to selected canonical docs/runtime-contract truths rather than treating it as repository-wide semantic documentation convergence; in the current seam this includes freezing the supported role-update wording and the OpenAPI-covered `PUT /api/roles/company/{roleId}` operation
- keep `docs/coding_standard.md` as the single authoritative coding-standards body and keep the legacy hyphenated alias as a compatibility notice only
- keep the first stable permission-governance enforcement slice for `company.create` limited to global-root actors only
- keep company-role governance incremental: deny platform-scoped permission assignment in company-role create/update flows now, record those enforced denies through dedicated service-level audit actions, and leave broader sensitive combinations in `warn` posture until later approval
- keep the bounded actor-scope convergence seam limited to selected admin flows plus the agent workspace routes rather than broadening it into a repository-wide authorization redesign
- keep update-flow governance additive after the now-implemented company-role update surface; future changes should preserve the current tenant ownership, denial-audit, and self-lockout guarantees while any broader sensitive-combination enforcement remains separately approved
- keep the browser-runtime `typecheck` baseline bounded to the explicit shared-auth/login seam plus the approved `src/public/root/**` shell allowlist, without broadening to all `src/public/**`
- keep HSTS deferred until deployment, TLS-termination, and trusted-proxy assumptions are standardized in-repo; current app-layer hardening stops at CSP and explicit JWT algorithm pinning
- if HSTS is ever revisited, allow only conditional enablement behind explicit deployment assumptions, require `TRUST_PROXY` to be explicit before proxied enablement, and keep `preload` out of scope
- keep the official aggregate test runner defaulted to `NODE_ENV=test` and `BROWSER_SESSION_STORE_MODE=memory` unless explicitly overridden
- keep a separate explicit Redis-path validation lane instead of folding Redis dependence back into the default aggregate suite
- keep browser-session readiness visible at `/health/ready`
- keep hotspot seam reductions additive and behavior-preserving behind the existing access-policy and service facades instead of redesigning the layered monolith
- keep the current supply-inventory-entry implementation incremental: `TASK-001` remains an additive product-foundation slice inside the existing product module, `TASK-002` remains an additive security/governance-foundation slice inside the existing security module, `TASK-003` adds an additive recipe/versioning backend foundation under `/api/recipes`, `TASK-004` adds an additive production-order lifecycle foundation under `/api/production`, `TASK-005` adds the first production stage-execution/consumption/waste foundation under that same route group, `TASK-010` adds the first QA inspection foundation under that same production mount using the existing schema/repository/service layering, `TASK-011` adds QA-gated production completion plus finished-goods receipt under that same mount, `TASK-012` adds the first procurement request/quotation/selection/purchase-order foundation under `/api/procurement` without inventory mutation, `TASK-013` adds the first receipt document/inspection foundation under `/api/receipts`, `TASK-014` extends that receipt foundation with transactional confirmation/reversal inventory posting plus `confirmedLotId` traceability, `TASK-015` adds receipt-scoped fiscal-reference persistence as pending metadata only, and the later `recepciones-fiscales-workspace` slice adds company-admin root workspaces plus the dedicated `/api/fiscal-references` list route without changing the existing layering; later external billing handoff, standalone quality routing, and deeper root-admin receipt/fiscal mutations must still be introduced only through later approved slices rather than inferred as already active architecture
- keep the default aggregate validation lane memory-backed for browser sessions and treat Windows Prisma generate rename-lock failures as a separate documented platform concern, not as evidence of hotspot-seam regressions

## 13. Known architectural limitations
- the repository still depends on a native password-hashing module path (`bcrypt` via `node-gyp-build`), so some environments may require prebuilt-binary compatibility or fallback compilation support;
- full DB-backed container readiness and end-to-end auth behavior were not expanded in the bounded Docker follow-up, even though build and startup smoke evidence now exists;
- layered architecture without strict hexagonal separation
- broad service responsibilities
- operational/readiness/browser governance still depends on synchronized docs, scripts, tests, manifest metadata, and workflows
- the repository still carries a temporary compatibility bridge at the legacy hyphenated coding-standards path; governance relies on maintainers not restoring a second full standards body there, with `tests/coding-standard-path-alignment.test.js` acting as the preventive guardrail
- the root shell is still a bounded first wave implemented through ordered global scripts rather than a stronger module-loading boundary, but the approved script inventory and minimal provider-before-consumer expectations are now centralized in `src/public/root/runtime-contract.js` and guarded by dedicated validator/test coverage around loader drift
- the browser-runtime typecheck baseline remains intentionally narrower than the full approved browser-runtime inventory; current approved-but-untyped runtime files still include `src/public/root/runtime-contract.js`, the inventory adapters (`categories-api.js`, `inventory-api.js`, `products-api.js`, `warehouses-api.js`), the dedicated RFQ tracking browser files (`rfq-tracking-api.js`, `views/rfq-tracking-admin.renderers.js`, `views/rfq-tracking-admin.js`), the warehouses/products/movements/lots route view files added outside the current root allowlist, and the supported `src/public/agent/**` runtime
- the current supply foundation now reaches the product, supplier, recipe, production, procurement, receipt, fiscal-reference, public supplier-quotation, and warehouse/QA browser-runtime modules; production completion with `PRODUCTION_RECEIPT` is active under `/api/production`, procurement request/quotation/comparison/selection/optional-approval/purchase-order plus RFQ invitation lifecycle foundation is active under `/api/procurement`, supplier-management CRUD/assignment foundation is active under `/api/suppliers`, public token-based supplier quotation response is active under `/api/public/supplier-quotations/:token`, receipt document/inspection plus confirmation/reversal inventory posting is active under `/api/receipts`, company-scoped fiscal-reference listing is active under `/api/fiscal-references`, dedicated root-shell receipt/fiscal list-detail workspaces are active under `/root/#recepciones` and `/root/#referencias_fiscales`, and supported browser runtimes are active under `/warehouse/` and `/supplier-quote/`; however, there is still no active architecture for external billing handoff submission or standalone `/api/quality`
- the security foundation for role and supply operations remains broader than the currently mounted workflow set, but the most visible recipes/production permission-catalog gap is now closed because both `prisma/seed.js` and additive migration `20260819000000_backfill_production_permission_catalog` materialize the governance-backed permission definitions required by the active role-management surfaces, including existing databases; proposed role bundles and some future-facing permission metadata still extend beyond current mounted UI and route consumption, bundle membership itself is still not runtime-enforced, and the current bundle coverage remains selective rather than repository-wide
- justification-required override permissions are an active metadata decision, and `production.override` is now consumed by the production create/approve and stage-execution flows with persisted justification fields plus request-aware audit support; later services still must implement equivalent payload validation, persistence, and audit handling for their own concrete override paths
- after `supply-inventory-entry` `TASK-011`, the remaining production gaps are concentrated in integrity and downstream expansion rather than missing completion behavior: completion is active, but lifecycle invariants remain only partially constrained at the database level; same-warehouse prevention, expiration ordering, guardrail validation, mandatory QA gating for completion, stage-execution timing/order assumptions, and status-transition rules still live primarily in Zod/service code rather than in DB `CHECK` constraints
- `production_consumptions`, `production_wastes`, and `production_returns` now enforce `lot_id` as `NOT NULL` plus FK to `lots`, but those detail tables still do not enforce `warehouse_id` / `product_id` foreign keys, so detail-traceability integrity still depends partly on application-controlled writes
- the architecture still carries two production-consumption representations: granular detail rows remain authoritative, while `ProductionItem.consumedQuantity` is maintained as an auxiliary aggregate synchronized from order-scoped consumption detail; this closes the earlier drift risk but preserves dual-model maintenance overhead
- the committed migration for `supply-inventory-entry` `TASK-001` is validated through schema/build evidence, but architecture documentation still cannot claim clean-database execution because that evidence is not present in the reviewed repository artifacts for this cycle
- route/integration coverage for the new product sourcing metadata remains thinner than schema/service characterization coverage, so endpoint-wiring certainty is still bounded for that slice
- the company-admin sidebar IA is richer than the currently implemented module set, because many visible entries still converge on the shared neutral `in_process` view or on shell-owned starter screens without live data orchestration
- the production group now has asymmetric implementation depth: `#recetas` is a live administrative shell workflow over `/api/recipes/**` plus product assignment through `/api/products/:id`, while `#produccion_ordenes` is a live read-only supervision workflow over `/api/production/orders/**` with list/detail/filter behavior but still remains shallower because backend query support is limited to pagination and the remaining filters execute client-side over the loaded page
- the root-shell supply navigation remains incremental but is no longer placeholder-only in the receipt/fiscal area: the current browser-implemented supply scope now includes `#proveedores`, `#solicitudes_compra`, `#cotizaciones`, `#seguimiento_cotizaciones`, `#ordenes_compra`, `#recepciones`, `#referencias_fiscales`, `#recetas`, and `#produccion_ordenes`, while deeper receipt/fiscal write actions still remain outside the current root-shell slice
- the commercial root-shell modules are still UI-layer compositions over existing REST contracts rather than dedicated application-layer frontend modules; `#agents` composes data from users, roles, and routes in the browser, and `#clients` / `#routes` still keep large DOM-oriented controllers even after adjacent renderer/state seam extraction
- the `#zones` screen is still implemented as a sizable plain-script DOM workflow; selection/filter behavior and small dialog/form seams now have extracted helper support plus isolated characterization coverage, but the main async UI orchestration remains centralized in `src/public/root/views/zones-admin.js`
- shell visibility is stricter than some backend authorization contracts: the current manifest exposes `#agents`, `#clients`, and `#routes` only to `company-admin`, even though some backing APIs also admit broader backend roles such as `sales` or `sales_supervisor`
- requester-supplied hardening evidence for this slice now shows the public-runtime smoke lane, commercial browser E2E lane, local Windows-friendly lint/typecheck entrypoints, and the targeted RFQ validation lane passing; the remaining Windows-specific Prisma concern stays limited to the separately documented `npm run build` generate rename-lock behavior rather than the targeted smoke or tooling commands
- sidebar state logic currently hardcodes some group identifiers and route-specific UI assumptions inside `src/public/root/app.js`
- role/permission governance remains hybrid, and the completed `p10` package has only been partially translated into runtime behavior: centralized policy data, governed-operation evaluation, the stable company-creation deny, the first company-role platform-scope deny for create/update, denial-path audit visibility for those denies, metadata-backed permission presentation, and a bounded admin-route actor-scope convergence seam now exist, but broader backend role-governance hardening and full repository-wide access-policy convergence are still incomplete
- runtime company-role update flow now exists and is part of the active documented behavior, including update-specific governance denial, tenant ownership checks, and self-lockout prevention
- the current role-update seam is intentionally frozen only at a focused boundary: route authorization (`tests/role-update-authorization.test.js`), service/update behavior (`tests/role-update-service.test.js`), browser-session convergence after role change (`tests/browser-session-auth-boundary.test.js`), and bounded OpenAPI/route metadata alignment (`tests/openapi-contract-consistency.test.js`)
- role updates now trigger targeted browser-session invalidation for active users assigned to the changed role, so affected cookie-authenticated requests such as `GET /api/auth/me` stop authenticating with the old session until the user logs in again; however, the current architecture still chooses forced re-authentication rather than an in-place session refresh
- role-update/session convergence still has a post-commit failure ambiguity: `role.service.js` persists the role change before it calls browser-session invalidation, so a browser-session store outage can still surface `503 service_unavailable` even though the role-permission update already committed
- the Redis browser-session adapter now maintains reverse user-session membership to support targeted invalidation, but those user-scoped Redis sets can still retain stale session IDs after natural key expiry because no cleanup worker or expiry-coupled pruning is implemented in the reviewed architecture
- the reviewed auth/runtime governance seam now has focused closure evidence recorded for the implemented RFQ/browser/runtime surfaces, while the remaining `9.4/10` audit warnings are operational/maintainability follow-up items rather than confirmed regressions: post-commit `503 service_unavailable` ambiguity when role updates commit before session invalidation fails, safe audit persistence warnings when DB-backed audit storage is unavailable, bounded rather than exhaustive governance coverage, and the drift cost of large canonical documentation artifacts
- `src/repositories/role.repository.js` now exposes scoped read helpers `findCompanyOwnedRoleById(...)` and `findAssignableRoleByIdForCompany(...)`, and the reviewed tenant role-admin flows use those scoped queries first; however, `findRoleById(...)` still remains as a narrow fallback lookup for differentiated classification semantics (`404` / `403` / `400`) rather than being fully retired
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
- whether the remaining approved company-admin sidebar entries should keep mapping to the shared neutral `in_process` view or graduate to distinct route contracts in the next slice after the now-functional `#warehouses`, `#products`, `#lots`, `#movements`, `#billing`, `#approvals`, `#recetas`, and `#produccion_ordenes` routes
- whether the current `#recetas` workflow should remain inside a single plain-script controller or receive a deeper modular split if future approved slices add more forms, pagination, or richer product-version traceability behavior
- whether the existing request-throttle backing mode used for the public RFQ surface is sufficient for the real deployment topology or should later be strengthened with a more explicitly distributed store and abuse-observability policy
- whether RFQ invitation expiration should remain lazily persisted on request-path access/write or later gain a proactive/background materialization process for reporting and operational consistency
- whether `#produccion_ordenes` should next deepen its current usable read-only supervision workflow by moving some administrative filters from client-side-over-page behavior to backend-supported query parameters on `/api/production/orders/**`, or remain on the current pagination-server-side / remaining-filters-client-side model until a later approved slice
- which company-admin sidebar module should be the next functional destination after the current implemented set (`Bodegas`, `Productos`, `Lotes`, `Movimientos`, `Recetas`, `Ordenes de produccion`, `Facturación`, `Aprobaciones`, `Roles y permisos`, `Zonas`, `Agentes`, `Clientes`, and `Rutas`)
- whether root-shell navigation should remain local to `src/public/root/manifest.js` or later converge on a broader approved manifest model
- whether additional browser roles beyond the current wave-one rule should later use `/root/` as a supported destination
- whether the bounded browser-runtime `typecheck` allowlist should later expand beyond the current explicit shared/login/warehouse plus selected-root file set to include the remaining supported `src/public/root/**` and `src/public/agent/**` inventory
- when equivalent SPA coverage will justify removal of the preserved `legacy-public-runtime/` inventory
- when to implement the next approved slice from permission governance after the completed metadata reconciliation, company-role create hardening, denial-path audit visibility, and company-role update hardening slices, specifically any later session-permission refresh strategy after role updates and any later guided role-governance UI refinements in the root shell
- whether `sku` and `barcode` should remain additive non-unique product metadata or later become stronger uniqueness/search contracts before warehouse-scanning workflows depend on them
- whether `ProductSupplier.isPreferred` allows zero, one, or multiple preferred suppliers per product before downstream procurement behavior depends on it
- how the new supply/intake permission codes should first be materialized in tenant-facing runtime behavior: as seeded permission rows only, seeded role presets, UI assignment bundles, or some combination of those
- after the now-implemented procurement, receipt confirmation/reversal, fiscal-reference foundations, warehouse runtime alignment, and root-shell receipt/fiscal workspaces, which downstream supply slice should be next: adjacent follow-up is still open for production-detail DB hardening, override-auditability, standalone quality route groups, richer supplier/receipt/fiscal mutations from the root shell, and external billing handoff
- what concrete justification payload shape, storage location, and audit contract later workflow services must use when they begin enforcing `production.override`, `procurement.override`, `quality.override`, and `inventory.intake.override`