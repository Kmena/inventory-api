# Current State

## 1. System overview
`inventory-api/` is a single-deployable Node.js 24 Express + Prisma application with REST APIs and an embedded browser runtime served by the same Express process.

Current browser/runtime and access-governance state verified from repository contents after `inventory-admin-views` `TASK-007` and `TASK-008`, together with `zones-view`, `sidebar-rebrand-permissions` `TASK-004`, `quality-baseline-recovery` `TASK-007`, `repository-baseline-score-recovery` `TASK-009`, `hotspot-seams-doc-ownership` `TASK-001` through `TASK-008`, `p38-root-shell-modularity-hardening`, `p37-root-spa-companies-roles-admin`, `root-shell-follow-up-alignment`, `root-shell-commercial-views`, `root-shell-commercial-views-hardening`, `root-admin-recipes-production`, `session-docs-tenant-hardening` `TASK-004` through `TASK-008`, and `supply-inventory-entry` `TASK-001` through `TASK-015`, plus the post-implementation permission-catalog remediation for existing databases through migration `20260819000000_backfill_production_permission_catalog`, the backend `procurement-quotation-workspace` foundation refresh already captured in `TASK-090`, the implemented root-shell/runtime alignment after `procurement-quotation-workspace` `TASK-007`, and the later `rfq-hardening-alignment` closeout over the public RFQ surface, tracking runtime governance, and lazy expiration materialization, plus the browser-only `supplier-management` / `rfq-tracking-admin` sidebar+detail layout refresh, building on `p36-bounded-doc-validator-ownership-alignment`, `p35-governance-baseline-sync-guardrails`, and `p34-bounded-governance-coverage-expansion`, `p33-admin-authorization-governance-convergence`, and now also the implemented procurement, receipt confirmation/reversal, fiscal-reference foundations, and role-update-triggered browser-session invalidation:
- the active public browser runtime under `src/public/` is intentionally small and now includes a supported root SPA shell entrypoint;
- supported public HTML documents are `/`, `/index.html`, `/no-access.html`, `/migration.html`, `/root/`, `/agent/`, `/warehouse/`, and `/supplier-quote/`, backed respectively by `src/public/index.html`, `src/public/no-access.html`, `src/public/migration.html`, `src/public/root/index.html`, `src/public/agent/index.html`, `src/public/warehouse/index.html`, and `src/public/supplier-quote/index.html`;
- the supported `/root/` shell now has two observable actor variants: global `root` users keep the existing top navigation, while `admin` users with `companyId` receive a rebranded administrative sidebar shell with explicit hash routes for visible menu items;
- the supported `/warehouse/` shell is now an active warehouse/QA SPA with its own bounded `window.WarehouseShell` registry, permission-gated hash routing, receipt confirmation workflow, production-order navigation, frozen recipe consultation, and same-origin capture helpers;
- the supported `/agent/` shell remains an active browser runtime under `src/public/agent/**`;
- supported shared browser assets include `styles.css`, `login.js`, `migration.js`, `no-access.js`, `shared/session.js`, `shared/auth.js`, the root-shell assets under `src/public/root/**`, the warehouse shell assets under `src/public/warehouse/**`, the agent shell assets under `src/public/agent/**`, and the public supplier quotation page assets under `src/public/supplier-quote/**`;
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
- `tests/governance-baseline-sync-guardrails.test.js` now acts as the focused documentation-sync guardrail for the selected post-`p34` governance statements only; it does not imply repository-wide documentation convergence; the guarded current-truth statements now explicitly include canonical `docs/**` ownership wording, parent-root workflow ownership wording, and the fact that the runtime company-role update flow exists through `PUT /api/roles/company/:roleId`;
- that same focused governance/doc-sync seam is intentionally bounded: it freezes only the selected canonical docs/runtime-contract truths for the role-update surface rather than full repository-wide documentation or semantic contract parity;
- `docs/permission-governance-decisions.md` now exists as an explainer for the completed `p10-permission-governance` analysis outputs, while the active runtime foundation lives in `src/security/permission-governance.config.js`, `src/security/role-bundles.config.js`, and `src/security/permission-governance.service.js`; `p30-company-role-governance-hardening` plus the later remediation slice extended that foundation so company-role create/update now reject platform-scoped permissions such as `companies.manage` before persistence, and `p32-governance-denial-audit-visibility` now covers the dedicated service-level denial audit path for both create and update governance rejects;
- `internal-docs/**` remains auxiliary repository material only, while the in-scope runtime-contract governance validators now consume canonical `docs/**` artifacts and do not rely on auxiliary `internal-docs/**` runtime-contract copies for authority;
- `docs/documentation-ownership-map.md` is the compact classification reference for canonical, auxiliary, historical/compatibility, and auto-validated repository artifacts, including the current workflow source-of-truth and seam ownership examples;
- `hotspot-seams-doc-ownership` tasks 1-8 are now reflected in the implemented structure: `src/security/access-policies.js` remains the stable facade while policy registry, actor-scope checks, and denial-audit behavior now live in `src/security/access-policy-registry.js`, `src/security/access-policy-actor-scope.js`, and `src/security/access-policy-audit.js`;
- agent workspace routes now also use the centralized access-policy facade explicitly at the route boundary through the `agent.workspace.access` policy, preserving the existing commercial-agent token contract while making the protection convergent with other guarded modules; `/api/agent/**` now enforces a `permission-plus-actor-scope` boundary that allows `sales_agent` or equivalent commercial-agent tokens with `companyId`, `sub`, `sales.orders.create`, `sales.routes.view.own`, and `customer.activities.manage`, while still denying supervisor/global variants such as `sales_supervisor`, `sales.routes.view.all`, and `sales.routes.assign`;
- `docs/prisma-windows-stability-evidence.md` now distinguishes the hosted Windows closeout verdict (`estabilizado con evidencia CI`) from the developer-local Windows operating baseline (`residual gobernado` when `windows_rename_lock` still reproduces locally), so CI closure is no longer treated as equivalent to universal local stability;
- the same hardening slice also introduced focused service seams at `src/services/inventory-alerts.service.js`, `src/services/agent-workspace-store-state.service.js`, `src/services/product-permission-shaping.service.js`, and `src/services/product-pricing.service.js` without changing the public API surface;
- the approved `supply-inventory-entry` `TASK-001` slice is now implemented as an additive backend foundation inside the existing product/catalog flow: Prisma adds `ProductSourcingMethod` and `ProductInventoryType`, product payloads now accept `sku`, `barcode`, `sourcingMethod`, `inventoryType`, `requiresLot`, `requiresExpiration`, `standardCost`, `realCost`, `allowedWarehouseIds`, and `authorizedSuppliers`, and persistence now includes `product_allowed_warehouses` plus additive metadata on `product_suppliers`;
- `product.service.js` currently derives backward-compatible defaults for those new fields during create/update/import flows, validates that referenced warehouses and suppliers belong to the authenticated company before persistence, and strips client-supplied `companyId` from update payloads so the final product mutation stays tenant-scoped;
- the approved `supply-inventory-entry` `TASK-002` slice is now also implemented as a security/governance foundation only: `src/security/access-policy-registry.js` now declares named permission-based policies for future product sourcing, supplier, recipe, production, quality, procurement, receipt, warehouse workspace, inventory-intake override, and billing-handoff operations; `src/security/permission-governance.config.js` now includes those permission codes plus `requiresJustification` metadata for override permissions; `src/security/role-bundles.config.js` now carries proposed operational bundles such as `warehouse_operator`, `production_operator`, `qa_inspector`, and `procurement_operator`; and `src/security/permission-governance.service.js` exposes helper lookups for justification-required permissions;
- the approved `supply-inventory-entry` `TASK-003` slice is now implemented as an additive backend recipe/versioning foundation inside the existing layered monolith: Prisma adds `RecipeVersionStatus`, `RecipeVersion`, `RecipeVersionIngredient`, `RecipeStage`, and `RecipeStageInput`; Express now mounts `/api/recipes`; and the first tenant-scoped recipe service flow supports recipe master list/create/detail/update plus version list/create/update/approve operations;
- `recipe.service.js` currently enforces company-scoped recipe access by `req.auth.companyId`, validates nested ingredient/stage-input `productId` references against the authenticated company before persistence, allocates sequential `versionNumber` values per recipe, and treats approved versions as immutable;
- the approved `supply-inventory-entry` `TASK-004`, `TASK-005`, `TASK-006`, `TASK-007`, `TASK-008`, `TASK-009`, `TASK-010`, and `TASK-011` slices are now implemented as additive backend production/quality foundations inside the same layered monolith: Prisma now uses a dedicated `ProductionOrderStatus` enum plus additive `production_orders` lifecycle/snapshot fields together with `ProductionStageExecution`, `ProductionConsumption`, `ProductionWaste`, `ProductionReturn`, `QualityInspectionResult`, and `QualityInspection`; Express mounts `/api/production`; the current tenant-scoped production service flow supports the full order lifecycle `DRAFT -> PENDING_APPROVAL -> APPROVED -> IN_PROGRESS -> QA_HOLD` (when a mandatory inspection is rejected) `-> COMPLETED` through `/complete` or `-> CANCELLED`, together with order list/detail/create plus `submit`, `approve`, `start`, stage `execute`, stage `return`, stage-level QA inspection creation, order-level QA inspection listing, transactional `complete`, and `cancel` transitions; `ProductionConsumption.lotId`, `ProductionWaste.lotId`, and `ProductionReturn.lotId` are now mandatory and FK-backed to `Lot` through migrations `20260815000000_harden_production_consumption_lot_fk`, `20260816000000_harden_production_waste_lot_fk`, and `20260817000000_add_production_return_foundation`; `QualityInspection` is FK-backed to `production_orders`, `production_stage_executions`, and optional `lots` through migration `20260818000000_add_quality_inspection_foundation`; and `ProductionItem.consumedQuantity` is now explicitly maintained as an auxiliary aggregate synchronized from `SUM(ProductionConsumption.quantity)` at the production-order scope, excluding waste and returns;
- the approved `supply-inventory-entry` `TASK-012` slice is now implemented as an additive backend procurement foundation inside the same layered monolith: Prisma adds `PurchaseRequestStatus`, `SupplierQuotationStatus`, `ProcurementApprovalStatus`, and `PurchaseOrderStatus` plus models `PurchaseRequest`, `PurchaseRequestItem`, `SupplierQuotation`, `SupplierQuotationItem`, `SupplierSelection`, and `PurchaseOrder`, and `PurchaseOrderItem`; Express now mounts `/api/procurement`; the current tenant-scoped procurement service flow still supports `request -> quotation -> comparison -> supplier selection -> optional approval -> purchase order` using `src/routes/procurement.routes.js`, `src/services/procurement.service.js`, `src/repositories/procurement.repository.js`, and `src/schemas/procurement.schema.js`; the repository now also includes additive procurement-quotation-workspace backend support through `GET /api/procurement/quotable-products`, `GET /api/procurement/products/:id/suppliers-pricing`, and `POST /api/procurement/products/:id/request-quotations`, together with grouped assisted quotation request payload validation and supplier-pricing reads backed by `product_suppliers.unit_price` / `currency`; convergence migrations `20260822000000_backfill_suppliers_permission_catalog` and `20260822001000_backfill_supplier_product_pricing_convergence` are present and tested; the supported root shell now exposes the grouped quotations workspace at `#cotizaciones` and the dedicated RFQ follow-up page at `#seguimiento_cotizaciones`; the final cross-layer convergence suite `tests/procurement-quotation-workspace-convergence.test.js` exists to freeze that migration + backend + root-shell integration seam; and the same procurement area now also includes the implemented supplier RFQ invitation lifecycle from migration `20260823000000_add_supplier_quotation_invitations`, Prisma model `SupplierQuotationInvitation` with enum `SupplierQuotationInvitationStatus`, internal authenticated RFQ endpoints under `/api/procurement/requests/:id/rfq-invitations`, `/api/procurement/rfq-invitations/:id/*`, and `/api/procurement/rfq-tracking`, the unauthenticated public supplier-response contract under `/api/public/supplier-quotations/:token`, SHA-256 token-hash storage via `src/lib/secure-token.js`, public RFQ throttling through `src/middlewares/request-throttle.js` (`GET /api/public/supplier-quotations/:token` => `30/min`, `POST /api/public/supplier-quotations/:token/response` => `10/min`), lazy persistence of stale invitations to `EXPIRED` when public or relevant internal RFQ flows read or mutate them, the public `/supplier-quote/` page, the dedicated root RFQ tracking browser assets `src/public/root/rfq-tracking-api.js`, `src/public/root/views/rfq-tracking-admin.js`, and `src/public/root/views/rfq-tracking-admin.renderers.js`, runtime/OpenAPI/catalog alignment for the RFQ route surface, terminal rendering for expired invitations in the RFQ tracking UI, and RFQ audit instrumentation in `src/services/procurement-rfq.service.js` through `recordAuditEventSafelyIfAvailable` for invitation lifecycle events plus public/manual response events; user-supplied validation evidence for the later `rfq-hardening-alignment` refresh reports `npm run typecheck` and targeted eslint green plus a targeted RFQ suite green with `103/103` passing, including `tests/rfq-runtime-governance-alignment.test.js`; broader full lint/test lanes still have unrelated preexisting debt outside the RFQ slice; this slice remains procurement intention/order foundation only and does not mutate inventory, lots, warehouse balances, or stock movements directly;
- the approved `supply-inventory-entry` `TASK-013`, `TASK-014`, and `TASK-015` slices are now implemented as the active receipt/fiscal backend foundation inside the same layered monolith: Prisma adds `PurchaseReceiptStatus`, `ReceiptInspectionResult`, `PurchaseReceipt`, `PurchaseReceiptItem`, `ReceiptInspection`, additive `PurchaseReceiptItem.confirmedLotId`, and `FiscalDocumentReference`; migrations `20260818020000_add_purchase_receipt_foundation`, `20260818030000_add_receipt_confirmation_lot_link`, and `20260818040000_add_fiscal_document_reference` are present; Express now mounts `/api/receipts` and `/api/fiscal-references`; and the current tenant-scoped receipt/fiscal service flow supports `actual arrival receipt document -> item inspection -> confirmation -> reversal`, receipt fiscal-reference listing/creation, and company-scoped fiscal-reference listing through `GET /api/fiscal-references`, using `src/routes/receipt.routes.js`, `src/routes/fiscal-reference.routes.js`, `src/services/receipt.service.js`, `src/services/fiscal-reference.service.js`, `src/repositories/receipt.repository.js`, `src/repositories/fiscal-reference.repository.js`, `src/schemas/receipt.schema.js`, and `src/schemas/fiscal-reference.schema.js`; the global fiscal-reference list route is protected by `authenticate` plus `authorizeAccessPolicy('receipt.view')`, enforces company scope through `assertCompanyScope`, and currently returns fiscal references ordered by `createdAt desc, id desc` with linked `purchaseReceipt` and `supplier`; confirmation and reversal now execute transactional inventory posting with lot traceability and movement reasons `PURCHASE_RECEIPT` / `RECEIPT_REVERSAL`, while fiscal references persist pending handoff metadata only and do not call any external Billing or Hacienda API;
- `production.service.js` currently validates product, recipe-version, warehouse, and responsible-user references against `req.auth.companyId`, enforces sourcing/approved-recipe guardrails with `production.override` justification when needed, stores a JSON-safe frozen `recipeVersionSnapshot` so later recipe master-data changes do not rewrite existing production orders, resolves stage execution targets from that frozen snapshot, reduces stock transactionally through the existing inventory helper flow using `movementType: OUT` with `reasonCode: PRODUCTION_CONSUMPTION` and `PRODUCTION_WASTE`, records explicit lot-bound raw-material devoluciones as `movementType: IN` linked to `ProductionReturn` records, blocks order completion unless all mandatory QA gates pass, creates the finished-goods lot during completion, posts a destination-warehouse `movementType: IN` receipt with active `reasonCode: PRODUCTION_RECEIPT`, transitions the order to `COMPLETED`, synchronizes `ProductionItem.consumedQuantity` after consumption writes through `syncProductionItemConsumedQuantity`, and exposes `reconcileProductionOrderAggregates` as the current service-level repair path for downstream aggregate drift;
- the current stage-execution payload validation requires `startedAt`, `endedAt`, optional actual parameters, evidence, consumption rows, waste rows, and rejects `endedAt < startedAt`; persisted execution records now capture stage order/name, responsible user, actual parameters, evidence, notes, and a `movementGroupId` used to correlate related stock deductions;
- the current stage-return payload validation requires `productId`, `lotId`, `quantity`, and `reasonCode`, with optional `returnedAt` and `note`; the service additionally requires that a prior execution already exists for the same order stage before persisting a `ProductionReturn` record;
- `quality.service.js` now also exposes `checkMandatoryQaGatesForOrder(orderId, companyId)`, which reads mandatory stage metadata from the frozen `recipeVersionSnapshot`, checks the latest stage execution plus related inspections, and returns `{ allMandatoryGatesPassed, pendingStages, rejectedStages }`; `production.service.completeProductionOrder` now consumes that helper as an enforced completion gate before finished-goods receipt posting;
- the validation/documentation closure for the current supply slices is also now reflected: `node --test tests/production-service-foundation.test.js tests/production-schema.test.js tests/production-routes-contract.test.js tests/runtime-contract-governance.test.js`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npx prisma validate` passed for `TASK-005`; `node --test tests/production-service-foundation.test.js tests/production-schema.test.js tests/production-consumption-hardening-migration.test.js`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npx prisma validate --schema prisma/schema.prisma` passed for `TASK-006`; `node --test tests/production-service-foundation.test.js tests/production-schema.test.js tests/production-waste-hardening-migration.test.js`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npx prisma validate --schema prisma/schema.prisma` passed for `TASK-007`; `node --test tests/production-service-foundation.test.js tests/production-schema.test.js tests/production-routes-contract.test.js tests/runtime-contract-governance.test.js tests/production-return-foundation-migration.test.js`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npx prisma validate --schema prisma/schema.prisma` passed for `TASK-008`; user-supplied validation evidence for `TASK-009` reports 31 tests passed together with `npm run lint`, `npm run typecheck`, and `npm run build`; user-supplied validation evidence for `TASK-010` reports 53 tests passed together with `npm run lint`, `npm run typecheck`, and `npm run build`; user-supplied validation evidence for `TASK-011` reports 59 tests passed after adding 12 completion-focused tests, together with `npm run lint`, `npm run typecheck`, and `npm run build`; user-supplied validation evidence for `TASK-012` reports 79 tests passed together with `npm run lint`, `npm run typecheck`, and `npm run build`; user-supplied validation evidence for `TASK-013` reports 87 tests passed together with `npm run lint`, `npm run typecheck`, and `npm run build`; user-supplied validation evidence for `TASK-014` plus `TASK-015` reports 102 tests passed with all validations green, together with `npm run lint`, `npm run typecheck`, and `npm run build`; the later bounded post-audit alignment evidence reports `npm run lint`, `npm run typecheck`, `npm run build`, `node scripts/validate-public-runtime.js`, and `npm run test -- --silent` all green (`763` pass, `0` fail, `2` skipped pre-existing DB-dependent); and the latest user-supplied remediation evidence for the existing-database permission catalog fix reports targeted permission-remediation suites green (`16/16`) across `tests/production-permission-catalog-backfill-migration.test.js`, `tests/role-permissions-enrichment.test.js`, and `tests/role-permissions-route.test.js`, together with `npm run lint`, `npm run typecheck`, `npx prisma validate --schema prisma/schema.prisma`, and `npm run build`. In the documented warning posture, the previously noted recipes/production permission-catalog gap for already-provisioned databases is now closed by additive migration; remaining non-warehouse risks stay concentrated in partially app-enforced production invariants, missing DB-enforced `warehouseId` / `productId` integrity on production detail rows, incomplete override-justification persistence/auditability, no standalone `/api/quality` route group, external billing handoff still pending, pre-existing unrelated Windows Prisma file-lock/full-suite characterization issues, and broader Playwright-lane instability outside the bounded runtime-governance lane.
- `tests/root-shell-commercial-views.e2e.js` now provides browser-level regression coverage for the supported `#agents`, `#clients`, and `#routes` shell flows, including visible headings/content, dialog open-close behavior, active-selection/detail assertions, representative create/update/assignment saves, local in-memory filtering, taxpayer lookup contract assertions, and lightweight route-map rendering assertions;
- user-supplied validation evidence for the current inventory-admin follow-up reports `PASS` for `tests/product-category-contract-characterization.test.js`, `tests/root-inventory-adapters-characterization.test.js`, `tests/root-shell-route-governance.test.js`, `tests/root-shell-router-characterization.test.js`, and `tests/public-surface-characterization.test.js` in memory browser-session mode, together with `npm run lint`, `npm run typecheck`, `npm run validate:public-runtime`, and `npm run build`;
- user-supplied validation evidence for the completed `inventory-admin-views` cycle covering the modern `#products` screen and category admin surface reports `PASS` for `node --test tests/products-view-characterization.test.js tests/products-view.e2e.js`, `node --test tests/public-surface-characterization.test.js tests/root-shell-router-characterization.test.js`, `npm run lint`, `npm run lint:public-runtime`, `npm run typecheck`, `npm run validate:public-runtime`, and `npm run build`;
- user-supplied validation evidence for `root-admin-recipes-production` now reports `PASS` for `npm run lint`, `npm run typecheck`, `npm run build`, `npm run validate:public-runtime`, `node --test tests/root-shell-supply-manifest.test.js tests/root-shell-route-governance.test.js tests/root-shell-modularity-governance.test.js`, `node --test tests/root-shell-recipes-api-characterization.test.js`, `node --test tests/root-shell-recipes-admin-view-characterization.test.js`, `node --test tests/root-shell-production-admin-api-characterization.test.js`, and `node --test tests/root-shell-production-orders-admin-view-characterization.test.js`;
- user-supplied validation evidence for `recepciones-fiscales-workspace` reports a full-suite result of `1047/1049` passing, `0` failing, and `2` skipped pre-existing, with targeted coverage added in `tests/fiscal-reference-boundary.test.js`, `tests/root-shell-supply-manifest.test.js`, `tests/root-shell-router-characterization.test.js`, `tests/runtime-contract-governance.test.js`, and `tests/recepciones-fiscales-workspace-views-characterization.test.js`;
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
- `root/products-api.js`
- `root/recipes-api.js`
- `root/categories-api.js`
- `root/inventory-api.js`
- `root/warehouses-api.js`
- `root/receipts-api.js`
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
- `root/views/warehouses-admin.helpers.js`
- `root/views/warehouses-admin.renderers.js`
- `root/views/warehouses-admin.js`
- `root/views/products-admin.js`
- `root/production-admin-api.js`
- `root/views/recipes-admin.helpers.js`
- `root/views/recipes-admin.js`
- `root/views/production-orders-admin.helpers.js`
- `root/views/production-orders-admin.js`
- `root/views/receipts-admin.renderers.js`
- `root/views/receipts-admin.js`
- `root/views/fiscal-refs-admin.renderers.js`
- `root/views/fiscal-refs-admin.js`
- `root/views/lots-admin.js`
- `root/views/movements-admin.helpers.js`
- `root/views/movements-admin.renderers.js`
- `root/views/movements-admin.js`
- `root/registry.js`
- `agent/index.html`
- `agent/app.js`
- `agent/bootstrap.js`
- `agent/helpers.js`
- `agent/state.js`
- `agent/api/agent-api.js`
- `agent/views/dashboard.js`
- `agent/views/goals.js`
- `agent/views/map.js`
- `agent/views/order-entry.js`
- `agent/views/orders.js`
- `agent/views/store-detail.js`
- `agent/views/visit.js`
- `warehouse/index.html`
- `warehouse/app.js`
- `warehouse/bootstrap.js`
- `warehouse/captures.js`
- `warehouse/state.js`
- `warehouse/api/warehouse-api.js`
- `warehouse/views/inspections.js`
- `warehouse/views/production.js`
- `warehouse/views/receipts.js`
- `warehouse/views/recipe-consultation.js`
- `supplier-quote/index.html`
- `supplier-quote/app.js`

Observed preserved legacy inventory outside runtime:
- `legacy-public-runtime/root/**`
- `src/public/warehouse/**`
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
- company-admin inventory route modules at `#warehouses`, `#products`, `#lots`, and `#movements`; `#warehouses` is a functional RootShell inventory-admin screen backed by `GET/POST /api/warehouses/company`, `#products` is a functional RootShell inventory-admin screen backed by paginated `GET /api/products/`, `GET /api/products/:id`, `POST /api/products/`, `PUT /api/products/:id`, `DELETE /api/products/:id`, and tenant category list/create via `GET/POST /api/products/categories/company`, `#lots` is a functional RootShell inventory-admin screen backed by `GET /api/inventory/stocks` (for the `lots` array), `GET /api/inventory/alerts`, and `GET /api/warehouses/company` with a data-sufficiency gate that degrades gracefully when lot fields are insufficient, and `#movements` is a functional RootShell inventory-admin screen backed by paginated `GET /api/inventory/movements`; the shell also registers same-origin inventory adapter modules (`productsApi`, `categoriesApi`, `inventoryApi`, `warehousesApi`) for those routes;
- a company-admin Recipes route at `#recetas` with dedicated RootShell registration, manifest wiring, runtime-contract registration, `recipesApi` browser adapter coverage for `/api/recipes/**`, helper/state/renderer seams, and a usable administrative workflow that loads recipe lists plus detail/version data, applies local search/status/type/shared filters, allows root-side recipe creation, draft version create/edit, version approval, and recipe-to-product assignment through the existing product update contract while keeping explicit UI language when a product-specific applied recipe version is not visible in the current model; current code proves `product.recipeId` assignment plus order-level `productionOrder.recipeVersionId` / `recipeVersionSnapshot`, but does not prove a persisted product-specific `product -> recipe -> applicable recipeVersion` binding independent from each order;
- a company-admin Production Orders route at `#produccion_ordenes` with dedicated RootShell registration, manifest wiring, runtime-contract registration, a read-only `productionAdminApi` browser adapter over `/api/production/orders/**`, and helper/state/renderer seams in `production-orders-admin.helpers.js`, `production-orders-admin.state.js`, and `production-orders-admin.renderers.js`; the shipped view is now a usable read-only supervision workspace with KPI cards, refresh, list/detail behavior, and administrative filters, while explicitly keeping pagination as the only server-side filter and applying search/status/product/recipe/version/responsible/date filters client-side over the currently loaded page;
- within the company-admin supply navigation specifically, `#proveedores`, `#cotizaciones`, `#seguimiento_cotizaciones`, `#recetas`, `#produccion_ordenes`, `#solicitudes_compra`, `#ordenes_compra`, `#recepciones`, and `#referencias_fiscales` are implemented route destinations today; `#recepciones` and `#referencias_fiscales` now use dedicated RootShell modules over the existing receipt/fiscal APIs instead of the shared `in_process` view;
- a company-admin Zones view at `#zones` backed by the existing regions company endpoints;
- a company-admin Agents view at `#agents` that composes users, company roles, and sales-route overview data to show commercial users, assigned routes, visible goals, and route-assignment updates from an agent-centric screen;
- a company-admin Clients view at `#clients` backed by the existing client, classification, document-type, regions, taxpayer, and economic-activity endpoints, with list/detail behavior in the same shell plus create, update, deactivate, store, document, reference, lookup, and download actions;
- a company-admin Routes view at `#routes` backed by the existing sales-route and regions contracts, with overview metrics, route definition editing, subzone assignment, agent assignment, per-agent goal editing, covered-store lists, and a simplified SVG map derived from store coordinates;
- an expanded company-admin information architecture rendered from `root/manifest.js`, grouped into `Inicio`, `Operacion`, `Control`, and `Administracion`; inside the `Inventario` group, the sidebar order is `Bodegas`, `Productos`, `Lotes`, `Movimientos`; the `Produccion` group now exposes `Recetas` and `Ordenes de produccion` as implemented route items while preserving legacy standalone `#production` for backward-compat; the `Compras` group now exposes `Proveedores`, `Solicitudes de compra`, `Cotizaciones`, `Seguimiento de cotizaciones`, `Ordenes de compra`, `Recepciones`, and `Ref. Fiscales` as implemented route items in procurement-flow order, with `dependencyTag: 'recepciones-fiscales-workspace'` applied to the last two items, and legacy standalone `#purchases` is still preserved for backward-compat; `#warehouses`, `#products`, `#lots`, `#movements`, `#agents`, `#routes`, `#zones`, `#clients`, `#roles_permissions`, `#billing`, `#approvals`, `#proveedores`, `#solicitudes_compra`, `#cotizaciones`, `#seguimiento_cotizaciones`, `#ordenes_compra`, `#recepciones`, `#referencias_fiscales`, `#recetas`, and `#produccion_ordenes` are currently functional route destinations, while `#admin_home`, legacy `#production`, legacy `#purchases`, `#reports`, `#users`, and `#settings` still resolve to the shared neutral `in_process` view;
- the `#zones` view currently implements local in-memory search for zones and subzones, manual refresh, create-zone and create-subzone dialogs, toast feedback, temporary subzone highlight after creation, and a mobile consecutive list/detail flow. `src/public/root/views/zones-admin.helpers.js` now owns small seams for selection/filter logic plus dialog/form support such as reset, inline field-error rendering, and submit-button state, while the main async UI orchestration remains concentrated in `src/public/root/views/zones-admin.js`;
- the `#agents` view keeps helper-owned commercial-role filtering and dataset composition in `src/public/root/views/agents-admin.helpers.js`, now delegates list/detail/assignment rendering to `src/public/root/views/agents-admin.renderers.js`, and keeps DOM orchestration, metrics, modal create flow, and route-assignment interactions in `agents-admin.js` over `agents-api.js`;
- the `#clients` view keeps helper-owned local filters and payload shaping in `src/public/root/views/clients-admin.helpers.js`, delegates detail/list rendering to `src/public/root/views/clients-admin.renderers.js`, delegates zone-option and selected-client summary state to `src/public/root/views/clients-admin.state.js`, and keeps DOM orchestration plus create/update/deactivate, append-only store/document/reference actions, taxpayer lookup, and document download behavior in `clients-admin.js` over `clients-api.js`;
- the `#routes` view keeps helper-owned local search, route-payload shaping, goal replace-all payload shaping, and simplified map projection in `src/public/root/views/routes-admin.helpers.js`, delegates detail/map rendering to `src/public/root/views/routes-admin.renderers.js`, delegates selected-route and goal-row state helpers to `src/public/root/views/routes-admin.state.js`, and keeps DOM orchestration and save flows in `routes-admin.js` over `routes-api.js`;
- `#seguimiento_cotizaciones` now follows the same `commercial-layout` sidebar+detail pattern used by `#agents`, `#clients`, and `#routes`: `src/public/root/views/rfq-tracking-admin.js` renders a `commercial-list-card` sidebar plus `commercial-detail-card` detail panel, keeps manual-response actions inside `#rfq-tracking-detail-region`, auto-selects the first loaded request, and attempts to preserve the previously selected request across refreshes; `src/public/styles.css` now includes `.rfq-tracking-sidebar-list { display: grid; gap: 8px; max-height: 65vh; overflow-y: auto; padding-right: 4px; }`, `#rfq-tracking-detail-panel { min-height: 280px; }`, and a mobile override that removes the sidebar max-height below `767px`;
- `src/public/root/app.js` now resolves its bootstrap module set and manifest validation through `runtime-contract.js` instead of duplicating that inventory inline, keeping the entrypoint narrower while preserving the current hash-route behavior;
- `src/public/root/router.js` currently resolves route views through explicit RootShell dependencies on `views.home`, `views.inProcess`, `views.companiesAdmin`, `views.rolesAdmin`, `views.zonesAdmin`, `views.agentsAdmin`, `views.clientsAdmin`, `views.routesAdmin`, `views.warehousesAdmin`, `views.productsAdmin`, `views.lotsAdmin`, `views.movementsAdmin`, `views.recipesAdmin`, `views.productionOrdersAdmin`, `views.billingAdmin`, `views.approvalsAdmin`, `views.suppliersAdmin`, `views.quotationsAdmin`, `views.rfqTrackingAdmin`, `views.purchaseRequestsAdmin`, `views.purchaseOrdersAdmin`, `views.receiptsAdmin`, and `views.fiscalRefsAdmin`; for the supply group specifically, `#cotizaciones` resolves through `views.quotationsAdmin`, `#seguimiento_cotizaciones` resolves through `views.rfqTrackingAdmin`, `#recepciones` resolves through `views.receiptsAdmin`, `#referencias_fiscales` resolves through `views.fiscalRefsAdmin`, `#recetas` resolves through `views.recipesAdmin`, and `#produccion_ordenes` resolves through `views.productionOrdersAdmin` rather than the generic fallback view;
- `src/public/root/index.html` now loads the newer supply browser modules `rfq-tracking-api.js`, `views/rfq-tracking-admin.renderers.js`, `views/rfq-tracking-admin.js`, `receipts-api.js`, `views/receipts-admin.renderers.js`, `views/receipts-admin.js`, `views/fiscal-refs-admin.renderers.js`, and `views/fiscal-refs-admin.js` together with the existing supplier and quotations scripts; the dedicated `#seguimiento_cotizaciones`, `#recepciones`, and `#referencias_fiscales` routes depend on them for standalone follow-up, receipt, and fiscal-reference behavior; `src/public/root/runtime-contract.js` now explicitly declares those RFQ/receipt/fiscal modules as approved loader-contract inventory, so the dedicated supply follow-up pages are covered by the same loader-governance baseline as the rest of the supported root shell;
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
  - tenant-scoped product, category, warehouse, stock, lot, and movement contracts remain backend-served from the same Express runtime
  - the product area now includes a minimal company-scoped category contract at `GET/POST /api/products/categories/company`
  - product CRUD/import now also carries an additive sourcing/classification foundation for future supply workflows: `sourcingMethod`, `inventoryType`, `sku`, `barcode`, lot/expiration flags, standard/real cost, allowed warehouse links, and authorized supplier metadata
  - the security boundary for current and future supply workflows now includes named permission-governed policies and centralized permission metadata for sourcing, suppliers, recipes, production, quality, procurement, receipts, warehouse access, intake overrides, and billing handoff visibility/create
  - a dedicated production route group is now implemented at `/api/production`, and it now also carries stage inspections plus order completion under the same mount; a dedicated procurement route group is now also implemented at `/api/procurement` for purchase requests, supplier quotations, comparison, supplier selection, optional approval, and purchase-order creation; dedicated receipt and fiscal-reference route groups are now implemented at `/api/receipts` and `/api/fiscal-references` for purchase-receipt document registration, receipt detail retrieval, item inspection, receipt-scoped fiscal-reference listing/creation, and company-scoped fiscal-reference listing; a dedicated supplier-management route group is now also implemented at `/api/suppliers` for company-scoped supplier CRUD plus product assignment/removal; standalone `/api/quality` route groups are still not implemented; the current supply slice now reaches product foundation fields, centralized security/governance metadata, supplier management, recipe versioning, production-order lifecycle, production stage execution/consumption/waste/return, stage-level quality inspection, finished-goods completion receipt, procurement intention/approval foundation, receipt document/inspection foundation, and fiscal-reference workspace reads
- Warehouses and geography
- Sales routes and agent workspace APIs
- Orders, invoices, and payments
- Billing and collections
  - `billing-trigger.service.js` auto-generates Invoice + Payment on order **approval** and on dispatch (best-effort, outside transaction, idempotent)
- Billing trigger on approval: creates invoice and PENDING_APPROVAL payment so the office can verify agent cash/transfer payments immediately
- **Pending API**: invoice number and payment reference should come from an external billing/receipt API (see `docs/pending-billing-receipt-api.md`)
  - `creditBalance` on Client is mutated at four points: increment on order approval, decrement on payment approval, increment on payment reversal, decrement on order cancellation
  - `findClientLedger` in `client.repository.js` supports pagination (default 100 invoices, max 500, optional `since` date filter)
  - `transferMetadata` validated with shared Zod schema at both agent-workspace and admin order-creation boundaries
  - browser module: `billing-api.js`, `billing-admin.js`, `billing-admin.helpers.js`, `billing-admin.renderers.js`, `clients-admin-store-dialog.js`
- Embedded browser runtime
  - login and session bootstrap
  - root shell wave-one SPA entrypoint
  - company-admin roles/permissions, zones, agents, clients, and routes views
  - company-admin inventory administration modules, including functional warehouses, products, lots, and movements screens
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
- render actor-aware shell navigation so global root users keep top navigation with `Empresas`, while company admins get a rebranded sidebar with grouped tenant-admin navigation, `#admin_home` as the default landing when no hash is present, the inventory group ordered as `Bodegas`, `Productos`, `Lotes`, `Movimientos`, all four functional RootShell inventory admin destinations (`#warehouses`, `#products`, `#lots`, `#movements`), and registered same-origin adapter seams for those inventory screens;
- let a tenant-scoped actor with `inventory.view` or `inventory.manage` use `#warehouses` to load company warehouses, view local KPI/filter summaries, and search/filter the in-memory warehouse dataset through `GET /api/warehouses/company`, with `inventory.manage` additionally allowed to create warehouses through `POST /api/warehouses/company`;
- let a tenant-scoped actor with `inventory.view` or `inventory.manage` use `#movements` to load paginated movement history through `GET /api/inventory/movements`, apply server-side `warehouseId`, `productId`, and `lotId` filters, move between result pages, and inspect a read-only detail drawer without any historical mutation action;
- let a tenant-scoped actor with the required product or inventory permissions list company inventory categories through `GET /api/products/categories/company` and create categories through `POST /api/products/categories/company`;
- let a tenant-scoped actor create, update, and import products with additive sourcing/inventory metadata, while the service derives compatibility defaults for legacy rows and validates `allowedWarehouseIds` and `authorizedSuppliers` against the authenticated company before persistence;
- let a global root user load companies from `GET /api/companies/root/companies`;
- let a global root user create companies from the shell through `POST /api/companies/root/companies`;
- let a global root user toggle company active status from the shell through `PATCH /api/companies/root/companies/:companyId/status`;
- let a company-admin user load assignable permissions from `GET /api/roles/permissions`, now enriched with `displayLabel`, `businessDescription`, `moduleCategory`, `scope`, `sensitivity`, and `metadataStatus` from the centralized permission-governance catalog; this service path now excludes any permission whose governance metadata resolves to `scope: 'platform'` before returning the catalog to company-admin callers, so platform permissions such as `companies.manage` no longer appear in the tenant role-management surface; for the approved production grouping this runtime currently depends on persisted `recipes.*` plus `production.*` permission rows, and additive migration `20260819000000_backfill_production_permission_catalog` now keeps already-provisioned databases aligned with that expectation;
- let a company-admin user load company roles from `GET /api/roles/company`, with serialized role permissions now also carrying `displayLabel` metadata;
- let a company-admin user create company roles from the shell through `POST /api/roles/company`;
- let a company-admin user update editable company roles from the shell through `PUT /api/roles/company/:roleId`, including role rename, permission replacement, an active company-owned repository lookup first, governance denial for platform-scoped permissions, denial of global-role edits, tenant ownership validation, targeted browser-session invalidation for affected active users after successful persistence, and anti self-lockout checks for the actor's own active role;
- let a company-admin user load zones from `GET /api/regions/company`, create zones through `POST /api/regions/company`, and create subzones through `POST /api/regions/company/:regionId/subregions` from `#zones`;
- let a company-admin user use `#agents` to load company users, company roles, and the sales-route overview, compose a commercial-user dataset client-side, create company users through `POST /api/users/company`, and persist route assignments through `PUT /api/sales-routes/company/:routeId/assignments` from an agent-centric workflow; company-user creation now resolves the requested role through an assignable-for-company repository lookup first so tenant-owned roles and active global non-root roles remain valid while foreign-company, root, inactive, and nonexistent role cases keep differentiated rejection semantics;
- let a company-admin user use `#clients` to list clients, open in-shell detail, create and update clients, deactivate clients, add stores, upload private documents, create references, run taxpayer lookup, list economic activities, and download documents through the existing `/api/clients/**`, `/api/regions/company`, `/api/taxpayers/lookup?identification=...`, and `/api/economic-activities` endpoints;
- let a company-admin user use `#routes` to list routes, open route detail, create routes, update definition, save subzones, save agent assignments, and save per-agent goals through the existing `/api/sales-routes/company**` contracts while rendering covered stores and a simplified coordinate-based map in the shell;
- let a tenant-scoped actor with `quality.inspect` register a production-stage QA inspection through `POST /api/production/orders/:id/stages/:stageId/inspections`, linked to the latest stage execution for that order stage, and let a tenant-scoped actor with `quality.view` list order inspections through `GET /api/production/orders/:id/inspections`;
- let a tenant-scoped actor with `production.complete` complete an `IN_PROGRESS` production order through `POST /api/production/orders/:id/complete`, enforcing mandatory QA gates, creating the finished-goods lot, posting a destination-warehouse `PRODUCTION_RECEIPT` stock movement, and transitioning the order to `COMPLETED`;
- let a tenant-scoped warehouse/QA actor with `warehouse.access` use the supported `/warehouse/` SPA, where navigation is permission-gated, receipts use a four-step operational workflow (arrival, inspection, evidence, confirm), production orders expose stage actions and frozen recipe consultation, and camera/barcode/manual fallback capture helpers remain same-origin browser-only behavior;
- keep role/permission administration bounded to permission-catalog list plus company-role list/create/update; role delete and user-role reassignment UI are still not implemented, and global roles remain read-only in the company-admin shell;
- serve the supported fallback documents `/no-access.html` and `/migration.html`;
- send `sales_supervisor` sessions to `/migration.html?mode=post-login-transition`, route warehouse-capable sessions with `warehouse.access` directly to the supported `/warehouse/` SPA, and route operational-agent profiles to `/agent/`;
- respond to direct legacy HTML requests such as `/root/dashboard.html`, `/warehouse/products.html`, or `/agent/workspace.html` with the shared migration screen and HTTP `410 Gone` without redirect;
- answer `GET /health` with a backward-compatible liveness payload;
- answer `GET /health/ready` with database and browser-session-store dependency state, returning `503` when Prisma readiness fails or when the configured Redis session store is down;
- serve JSON APIs for companies, roles, users, clients, products, product categories, procurement, receipts, orders, invoices, payments, inventory, warehouses, regions, sales routes, agent workflows, taxpayers, geocoding, and economic activities;
- let a tenant-scoped actor with procurement permissions list quotable products with shortage ordering, inspect tenant-scoped supplier pricing for a product, create grouped assisted quotation requests that fan out supplier quotations by selected supplier, create purchase requests, attach supplier quotations, compare quotations, select a supplier, approve selections when required, and create a draft purchase order through `/api/procurement`, while leaving inventory, lots, and stock balances unchanged in this slice;
- let a tenant-scoped actor with receipt permissions create a purchase receipt document from actual arrival data, retrieve company-scoped receipt detail, register per-item inspections, confirm accepted receipts into transactional stock movements/lots, reverse confirmed receipts through compensating transactional stock movements, and store/list pending fiscal-document references through `/api/receipts`, while keeping fiscal handoff metadata persistence inside Inventory and outside any external Billing or Hacienda API integration;
- let a tenant-scoped actor with `receipt.view` list all fiscal references for the authenticated company through `GET /api/fiscal-references`, protected by `authenticate` plus `authorizeAccessPolicy('receipt.view')`, with service-layer `assertCompanyScope` enforcement and repository reads ordered by `createdAt desc, id desc` including linked purchase-receipt and supplier context;
- let a company-admin user use `#recepciones` and `#referencias_fiscales` as RootShell list/detail workspaces over the existing receipt and fiscal-reference APIs, using the same two-column `commercial-layout--rfq-tracking` pattern already established by `#seguimiento_cotizaciones`;
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
8. `root/router.js` resolves the hash route against explicit manifest items. Global root routes remain `home` and `companies`. Company-admin routes include `admin_home`, `products`, `lots`, `movements`, legacy `production`, `recetas`, `produccion_ordenes`, `agents`, `routes`, `zones`, `clients`, legacy `purchases`, grouped procurement entries (`proveedores`, `solicitudes_compra`, `cotizaciones`, `seguimiento_cotizaciones`, `ordenes_compra`, `recepciones`, `referencias_fiscales`), `warehouses`, `billing`, `approvals`, `reports`, `users`, `roles_permissions`, and `settings`, with missing or unauthorized hashes falling back to the first accessible route; the current functional company-admin routes are `warehouses`, `products`, `lots`, `movements`, `roles_permissions`, `zones`, `agents`, `clients`, `routes`, `billing`, `approvals`, `proveedores`, `solicitudes_compra`, `cotizaciones`, `seguimiento_cotizaciones`, `ordenes_compra`, `recetas`, and `produccion_ordenes`, while the remaining company-admin routes render the shared neutral `in_process` view.
8.1. For company-admin sessions with no hash present, the first accessible route is `#admin_home`.
8.2. Root-shell modules publish and consume internal dependencies through `window.RootShell` instead of many unrelated top-level `window.RootShell*` globals.
9. `companies-admin.js` mounts root-company list/create/status behavior through `companies-api.js` for global root sessions.
10. `roles-admin.js` mounts permission-catalog list plus company-role list/create/update behavior through `roles-api.js` for company-admin sessions with `companyId`, including category grouping, search by label/description/code/module, sensitive-permission confirmation, read-only treatment of global roles, anti self-lockout disabling when the actor edits their own role, backend-driven session invalidation for active users assigned to a successfully changed role, and a company-owned scoped repository read first for the edited role with fallback broad lookup reserved only for `404` versus `403` classification semantics. The backing `GET /api/roles/permissions` service response is now pre-filtered to omit platform-scoped permissions for company-admin callers, so the shell no longer receives `companies.manage` or other future `scope: 'platform'` entries through that catalog path.
10.1. `zones-admin.js` mounts the zones/subzones master-detail workflow through `zones-api.js`, using local filtering in memory and reloading from the server only for initial load, explicit refresh, and successful create actions; selection/filter behavior and small dialog/form seams now flow through `zones-admin.helpers.js`, including reset, inline error rendering, and submit-button state helpers.
10.2. `agents-admin.js` mounts a two-panel commercial-user workflow through `agents-api.js`, using helper-owned dataset composition/filtering plus `agents-admin.renderers.js` for list/detail/assignment rendering, and it tolerates partial degradation when roles or route overview requests fail. On the backend, `POST /api/users/company` now uses an assignable-for-company role lookup first and falls back to a broad role read only for differentiated validation/forbidden classification semantics.
10.3. `clients-admin.js` mounts a list/detail client workspace through `clients-api.js`, using helper-owned local filters and payload shaping, `clients-admin.renderers.js` for list/detail rendering, and `clients-admin.state.js` for selected-client and summary resolution while keeping client creation, update, and append-only related actions inside the supported shell workspace.
10.4. `routes-admin.js` mounts route overview/detail workflows through `routes-api.js`, using helper-owned local search, payload shaping, and map projection helpers plus `routes-admin.renderers.js` and `routes-admin.state.js` for detail/map/goal-row rendering state while treating per-agent goals as replace-all saves.
10.5. The root shell now also loads `products-api.js`, `recipes-api.js`, `production-admin-api.js`, `categories-api.js`, `inventory-api.js`, `warehouses-api.js`, `suppliers-api.js`, `quotations-api.js`, `rfq-tracking-api.js`, `purchase-orders-api.js`, and `receipts-api.js` as same-origin browser adapters; `purchase-orders-api.js` exposes `listOrders()` over `GET /api/procurement/orders`, while `receipts-api.js` exposes `listReceipts()`, `getReceipt()`, `listFiscalReferences()`, and `listFiscalReferencesForReceipt()` over `/api/receipts` and `/api/fiscal-references` through `InventoryAuth.fetchJson`; additionally, `quotations-comparison.js` and `quotations-comparison.renderers.js` provide the comparison section extension point (comparison table, selection dialog, OC creation dialog, approval flow) mounted by `quotations-admin.js`; `purchase-requests-admin.js` provides the `#solicitudes_compra` view with list+detail two-column layout over `GET /api/procurement/requests`; `purchase-orders-admin.js` provides the `#ordenes_compra` view with list+detail two-column layout over `GET /api/procurement/orders`; `#recepciones` now consumes `receiptsApi` plus `receipts-admin.renderers.js` and `receipts-admin.js` for a read-only list/detail workspace over receipt documents, `#referencias_fiscales` consumes `receiptsApi` plus `fiscal-refs-admin.renderers.js` and `fiscal-refs-admin.js` for a read-only list/detail workspace over company-scoped fiscal references, both using the same `commercial-layout--rfq-tracking` two-column pattern; `#warehouses` consumes `warehousesApi` directly for list/create flows, `#products` consumes `productsApi` and `categoriesApi` for paginated list/detail/create/update/deactivate flows plus tenant category listing/creation, `#movements` consumes `inventoryApi` plus `warehousesApi` for paginated read-only movement history and filter enrichment, `#recetas` now consumes `recipesApi`, `productsApi`, and the adjacent recipe helper/state/renderer seams for list/detail/filter/create/version/approve/assignment behavior, `#produccion_ordenes` now consumes `productionAdminApi` plus helper/state/renderer seams for a usable read-only supervision workflow with server-side pagination and client-side administrative filters over the loaded page, `#proveedores` consumes `suppliersApi` plus `suppliers-admin.helpers.js`, `suppliers-admin.renderers.js`, and `suppliers-admin.js` for company-scoped supplier CRUD and product assignment/removal behavior, including local supplier-name filtering, metric summary rendering, client-side available-product filtering by product name or SKU inside the add-product dialog, contextual empty-state options for fully assigned or non-matching product sets, and the current edit flow that snapshots `currentSupplierDetail` before closing the detail dialog so the edit dialog still receives the selected supplier, `#cotizaciones` now consumes `quotationsApi` plus `quotations-admin.helpers.js`, `quotations-admin.renderers.js`, and `quotations-admin.js` for quotable-product listing, supplier-pricing detail, grouped assisted quotation selection, grouped quotation submission, RFQ invitation generation, machote refresh/cancel, manual response capture, and embedded tracking summary behavior; after grouped quotation creation, that workspace now continues the RFQ handoff by reading the created purchase request identity and serialized request items from either nested `response.purchaseRequest.id` / `response.purchaseRequest.items` or the older top-level fallback fields, and it preserves the selected supplier ids from the grouped quotation payload so `Generar solicitud a proveedores` can immediately create invitations without requiring the product-selection state to remain populated. `#seguimiento_cotizaciones` consumes `rfqTrackingApi` plus `rfq-tracking-admin.renderers.js` and `rfq-tracking-admin.js` for the dedicated RFQ follow-up page; the current renderer contract no longer exposes `renderTrackingTable` and instead splits the page into `renderRequestListItem(...)`, `renderDetailPlaceholder()`, and `renderRequestDetail(...)`; and `#lots` remains a functional lots screen rather than placeholder content.
11. Logout uses the shared auth helper and returns the browser to login.
12. `src/public/shared/auth.js` now resolves root-relative API calls such as `/api/auth/me`, `/api/auth/logout`, and `/api/suppliers/company` against `window.location.origin` before calling `fetch`, preserving same-origin cookie-authenticated behavior even when supported shells are served from nested paths such as `/root/` or `/warehouse/`.
13. Local development still requires a clean port `2500` on the host: if an older host-side `node src/server.js` process remains bound to `localhost:2500`, browser traffic can bypass the Docker-published app port and produce misleading 404s that do not represent the container runtime.

### API flow
1. Express receives `/api/*` requests.
2. Middleware performs logging, request context, throttling, validation, authentication, and authorization as applicable.
3. Routes call services.
4. Services call repositories and Prisma-backed persistence.
5. Product update reads tenant-scoped state first and now performs the final write through `product.repository.updateProduct(id, companyId, data, tx)`.
6. Inventory stock-entry orchestration updates product stock totals through `inventory.repository.updateProductById(id, companyId, data, tx)` so the final mutation remains tenant-scoped.
7. `GET /api/orders` preserves the legacy array response unless pagination params are present, in which case the service returns `{ items, pagination }`.
8. Responses return JSON errors or data.

### Procurement foundation flow
1. An authenticated tenant user can call `GET /api/procurement/quotable-products` to retrieve active company products that already have supplier links; the service computes `shortage = max(minStock - quantity, 0)` and orders the response by shortage descending, then by quantity ascending, then by product name.
2. The same actor can call `GET /api/procurement/products/:id/suppliers-pricing` to retrieve tenant-scoped supplier pricing for one active product with supplier links, including preferred ordering, supplier contact fields, `unitPrice`, `currency`, `leadTimeDays`, and `minimumOrderQuantity` when present on `product_suppliers`.
3. An authenticated tenant user can call `POST /api/procurement/products/:id/request-quotations` with the grouped assisted-quotation payload; the procurement service validates `req.auth.companyId`, checks that each referenced product belongs to the authenticated company and has supplier links, verifies that each selected supplier is actually associated to the selected product, groups rows by supplier, creates one `purchase_request`, and then creates one `supplier_quotation` per grouped supplier inside the same Prisma transaction.
4. An authenticated tenant actor with procurement permissions can create RFQ invitations for selected suppliers on a purchase request, list existing invitations, regenerate the machote/template and token, cancel an invitation, register a manual office-captured response, and retrieve tenant-scoped RFQ tracking summaries through the dedicated `/api/procurement/**` RFQ endpoints. In the implemented root-shell browser flow, the `#cotizaciones` workspace can continue directly from grouped quotation confirmation into RFQ invitation generation without leaving the screen: it derives the RFQ context from the grouped quotation response and preserves the selected supplier ids for the immediate invitation step. The service now lazily persists stale invitations to `EXPIRED` during relevant internal reads and writes, and the tracking payload serializes purchase-request items so the dedicated root follow-up page can prefill manual capture rows against the correct products.
5. `GET /api/procurement/orders` lists purchase orders for the authenticated company, ordered by `createdAt` descending and including the related `supplier` plus `items[].product`; the `#ordenes_compra` root-shell workspace consumes this contract through `purchase-orders-api.js`.
6. An unauthenticated supplier can open `/supplier-quote/?token=...`, retrieve invitation details through throttled `GET /api/public/supplier-quotations/:token` (`30/min`), and submit quotation line items through throttled `POST /api/public/supplier-quotations/:token/response` (`10/min`); the service hashes the raw token before lookup, lazily persists stale invitations to `EXPIRED`, rejects cancelled/responded/expired invitations, validates that quoted products belong to the referenced purchase request, creates a `supplier_quotation`, links the invitation as `RESPONDED` with response source `PUBLIC_TOKEN`, and emits `Retry-After` on throttle rejection.
7. The repository still supports the original direct flow where an authenticated tenant user calls `/api/procurement/requests` to create a purchase request with company-scoped products, after which additional calls attach supplier quotations to the request, compare quotations by computed total amount, select one quotation for the request, optionally approve the selection, and create a purchase order.
8. When `CompanyConfig.settingsJson.procurementApprovalThreshold` is configured and the selected quotation total exceeds it, the selection stays in `PENDING` until `/api/procurement/selections/:id/approve` is called; otherwise it is auto-approved.
9. `POST /api/procurement/requests/:id/purchase-orders` creates a draft purchase order from the approved selection and closes the purchase request.
10. The flow ends at intention/approval plus purchase-order creation; no receipt, lot, warehouse, stock, or movement write occurs in this slice.

### Receipt confirmation and reversal flow
1. An authenticated tenant user calls `POST /api/receipts` with supplier, warehouse, optional purchase-order reference, and actual-arrival line data.
2. The receipt service validates `req.auth.companyId`, checks supplier, warehouse, optional purchase order, and product ownership inside the authenticated company, and enforces lot/expiration capture for products that require it.
3. Prisma stores `purchase_receipts` plus `purchase_receipt_items` with initial status `PENDING_INSPECTION`.
4. Inspectors later call `POST /api/receipts/:id/items/:itemId/inspections` to persist a `receipt_inspections` record for one receipt line.
5. The receipt service updates the document status to `ACCEPTED`, `PARTIALLY_ACCEPTED`, or `REJECTED` based on the inspection result.
6. A confirmer calls `POST /api/receipts/:id/confirm`; inside a Prisma transaction the service acquires the company inventory advisory lock, creates accepted lots, increments warehouse lot stock, increments warehouse stock, increments product quantity, writes `StockMovement` rows with `reasonCode: PURCHASE_RECEIPT`, and stores each created lot back into `PurchaseReceiptItem.confirmedLotId` for traceability before transitioning the receipt to `CONFIRMED`.
7. A reverser calls `POST /api/receipts/:id/reverse`; inside a Prisma transaction the service acquires the same company inventory advisory lock, decrements the confirmed lot and warehouse balances, decrements product quantity, writes compensating `StockMovement` rows with `reasonCode: RECEIPT_REVERSAL`, and transitions the receipt to `REVERSED`.
8. Fiscal metadata can be appended only after confirmation through `POST /api/receipts/:id/fiscal-references`; the service persists `FiscalDocumentReference` rows in `PENDING` status and does not call any external Billing or Hacienda API.

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
- `BrowserSessionMemoryStore` keeps sessions in-process, eagerly drops expired entries, maintains a reverse `userId -> sessionIds` index for targeted invalidation, supports explicit invalidation by session, user, and deduplicated user batches, and exposes readiness as `memory`.
- `BrowserSessionRedisStore` persists opaque sessions under the configured key prefix in Redis, maintains user-scoped Redis sets of session IDs for targeted invalidation, parses Redis array responses for `SMEMBERS`, uses a raw TCP Redis protocol client, and exposes readiness via `PING` without silently falling back to memory mode.
- company-scoped product mutation helpers now use scoped `updateMany(...)` plus follow-up `findFirst(...)` reads on supported product/inventory write paths so tenant scope is preserved at the final mutation boundary.
- `supply-inventory-entry` `TASK-001` added two product enums in Prisma (`ProductSourcingMethod`, `ProductInventoryType`), additive nullable product columns (`sku`, `barcode`, `sourcing_method`, `inventory_type`, `requires_lot`, `requires_expiration`, `standard_cost`, `real_cost`), additive supplier metadata columns on `product_suppliers`, and the join table `product_allowed_warehouses` with FK-backed ownership to products and warehouses.
- `supply-inventory-entry` `TASK-010` added Prisma enum `QualityInspectionResult`, model `QualityInspection`, and migration `20260818000000_add_quality_inspection_foundation`; `quality_inspections` is indexed by `(production_order_id, stage_execution_id, created_at)` and optional `lot_id`, and keeps FK-backed links to `production_orders`, `production_stage_executions`, and optional `lots`.
- `supply-inventory-entry` `TASK-012` added Prisma enums `PurchaseRequestStatus`, `SupplierQuotationStatus`, `ProcurementApprovalStatus`, and `PurchaseOrderStatus`, the models `PurchaseRequest`, `PurchaseRequestItem`, `SupplierQuotation`, `SupplierQuotationItem`, `SupplierSelection`, `PurchaseOrder`, and `PurchaseOrderItem`, and migration `20260818010000_add_procurement_foundation`; the new procurement tables are indexed for company/request/order lookup but do not yet carry receipt confirmation, stock, lot, or fiscal-document linkage.
- `supply-inventory-entry` `TASK-013` added Prisma enums `PurchaseReceiptStatus` and `ReceiptInspectionResult`, the models `PurchaseReceipt`, `PurchaseReceiptItem`, and `ReceiptInspection`, and migration `20260818020000_add_purchase_receipt_foundation`.
- `supply-inventory-entry` `TASK-014` added migration `20260818030000_add_receipt_confirmation_lot_link`; `PurchaseReceiptItem` now stores `confirmedLotId`, and the active receipt workflow now posts transactional inventory effects for confirmation and reversal with lot-level traceability.
- `supply-inventory-entry` `TASK-015` added Prisma enum/model support for `FiscalReferenceStatus` and `FiscalDocumentReference` plus migration `20260818040000_add_fiscal_document_reference`; fiscal references are company-scoped pending handoff metadata linked to confirmed purchase receipts and are not evidence of any implemented external billing integration.
- `supply-inventory-entry` `TASK-002` introduced no schema or migration change, but the later remediation slice added additive migration `20260819000000_backfill_production_permission_catalog`; that migration upserts and reactivates the approved `recipes.*` and `production.*` permission rows required by `GET /api/roles/permissions` and the root `#roles_permissions` UI so already-provisioned databases converge with the current governance-backed catalog.
- the current category implementation reuses the existing `Category` and `Inventory` persistence model; `product.service.listCategories` first resolves the authenticated actor's `inventory` by `companyId`, returns `[]` when none exists, and `createCategory` writes only inside that resolved tenant inventory.
- the earlier minimal product-category backend contract introduced no schema or migration change, but the newer product sourcing foundation did add the committed migration `20260811000000_add_product_sourcing_foundation`.
- `p27-root-initial-spa-shell`, `p28-flexible-permission-governance-foundation`, `p30-company-role-governance-hardening`, and `p32-governance-denial-audit-visibility` introduced no database schema or migration changes.

## 8. APIs and integrations
Current observable interfaces:
- REST-style endpoints under `/api/*`
- health endpoints under `/health/*`
- static runtime served from `/`
- GitHub Actions as repository-governance integration
- canonical runtime-contract artifacts under `docs/**`, including the runtime-contract manifest and reviewed OpenAPI baseline consumed by the bounded legacy governance validator; for the current company-role update seam these artifacts now explicitly freeze `PUT /api/roles/company/{roleId}` inside `docs/openapi/runtime-baseline.openapi.json` together with the corresponding manifest/catalog ownership model
- canonical workflow authority under `../.github/workflows/**` relative to `inventory-api/`, with ownership expectations summarized in `docs/documentation-ownership-map.md`

Relevant public-surface behavior now in effect:
- `/api/auth/login`, `/api/auth/me`, and `/api/auth/logout` remain supported and are outside the HTML deprecation scope;
- `/root/` is a supported authenticated browser entrypoint for the actor-aware root shell;
- the current shell contract includes a split UI model in the same document: root-global top navigation and company-admin sidebar navigation with explicit sidebar hash routes;
- root-shell API consumption now includes `GET /api/companies/root/companies`, `POST /api/companies/root/companies`, `PATCH /api/companies/root/companies/:companyId/status`, `GET /api/roles/permissions`, `GET /api/roles/company`, `POST /api/roles/company`, `PUT /api/roles/company/:roleId`, `GET /api/regions/company`, `POST /api/regions/company`, `POST /api/regions/company/:regionId/subregions`, `GET /api/users/company`, `POST /api/users/company`, `GET /api/sales-routes/company`, `GET /api/sales-routes/company/:routeId`, `POST /api/sales-routes/company`, `PUT /api/sales-routes/company/:routeId`, `PUT /api/sales-routes/company/:routeId/subzones`, `PUT /api/sales-routes/company/:routeId/assignments`, `PUT /api/sales-routes/company/agents/:userId/goals`, `GET /api/clients/company`, `POST /api/clients/company`, `PUT /api/clients/:id`, `DELETE /api/clients/:id`, `POST /api/clients/company/:clientId/stores`, `POST /api/clients/:clientId/documents`, `POST /api/clients/:clientId/references`, `GET /api/clients/:clientId/documents/:documentId/download`, `GET /api/clients/classifications/company`, `GET /api/clients/document-types`, `GET /api/taxpayers/lookup?identification=...`, `GET /api/economic-activities`, and now also the registered inventory/recipe-shell adapter contracts `GET /api/products/`, `GET /api/products/:id`, `POST /api/products/`, `PUT /api/products/:id`, `DELETE /api/products/:id`, `GET /api/products/categories/company`, `POST /api/products/categories/company`, `GET /api/recipes/`, `GET /api/recipes/:id`, `POST /api/recipes/`, `PUT /api/recipes/:id`, `GET /api/recipes/:id/versions`, `POST /api/recipes/:id/versions`, `PUT /api/recipes/versions/:id`, `POST /api/recipes/versions/:id/approve`, `GET /api/inventory/stocks`, `GET /api/inventory/alerts`, `GET /api/inventory/movements`, `PATCH /api/inventory/lots/:lotId/qa`, `GET /api/warehouses/company`, and `POST /api/warehouses/company`;
- the product CRUD contract now accepts and returns additive sourcing-foundation fields on the existing endpoints rather than through a new supply-specific route group;
- `/api/production` is now mounted and currently exposes `GET /orders`, `POST /orders`, `GET /orders/:id`, `POST /orders/:id/submit`, `POST /orders/:id/approve`, `POST /orders/:id/start`, `POST /orders/:id/stages/:stageId/execute`, `POST /orders/:id/stages/:stageId/returns`, `POST /orders/:id/stages/:stageId/inspections`, `GET /orders/:id/inspections`, `POST /orders/:id/complete`, and `POST /orders/:id/cancel`; the stage-execution route is authenticated, uses `authorizeAccessPolicy('production.execute')`, validates timestamps/material/evidence payloads, resolves stages from the frozen `recipeVersionSnapshot`, and records transactional stock deductions through the existing inventory helper flow; the returns route records explicit lot-bound devoluciones as stock `IN` movements linked to a dedicated `ProductionReturn` detail row; the inspection routes use `authorizeAccessPolicy('quality.inspect')` / `authorizeAccessPolicy('quality.view')`, validate `qualityInspectionSchema`, persist `QualityInspection` snapshots through `quality.service.js`, transition `REJECTED` inspections to order status `QA_HOLD`, and restore `QA_HOLD` orders to `IN_PROGRESS` when a later inspection is `APPROVED` or `CONDITIONALLY_ACCEPTED`; and the completion route uses `authorizeAccessPolicy('production.complete')`, validates `productionCompletionSchema`, enforces `checkMandatoryQaGatesForOrder(...)`, creates the finished-goods lot, posts the destination-warehouse intake movement with `reasonCode: PRODUCTION_RECEIPT`, and transitions the order to `COMPLETED`; these runtime operations are governed through `docs/runtime-contract-manifest.json` as intentional exclusions from the current partial OpenAPI baseline rather than undocumented endpoints;
- `/api/procurement` is now mounted and currently exposes `GET /quotable-products`, `GET /products/:id/suppliers-pricing`, `POST /products/:id/request-quotations`, `GET /requests`, `POST /requests`, `GET /requests/:id`, `POST /requests/:id/quotations`, `GET /requests/:id/comparison`, `POST /requests/:id/select-quotation`, `POST /selections/:id/approve`, `POST /requests/:id/purchase-orders`, `POST /requests/:id/rfq-invitations`, `GET /requests/:id/rfq-invitations`, `POST /rfq-invitations/:id/refresh-template`, `POST /rfq-invitations/:id/cancel`, `POST /rfq-invitations/:id/manual-response`, `POST /requests/:id/cancel`, and `GET /rfq-tracking`, plus the new `GET /orders` endpoint that lists all purchase orders for the authenticated company, guarded by `procurement.view`, ordered by `createdAt` DESC and including `supplier` and `items[].product`; these routes are authenticated, policy-guarded through `procurement.view`, `procurement.manage`, and `procurement.approve`, enforce tenant scoping on internal RFQ operations, and currently implement quotable-product listing, supplier-pricing lookup, assisted grouped quotation-request creation, RFQ invitation lifecycle management, request-item-aware tracking serialization for the dedicated follow-up page, purchase intent, quotation comparison, supplier selection, optional approval, and purchase-order foundation only, without any inventory receipt, stock movement, or lot mutation;
- `/api/receipts` is now mounted and currently exposes `GET /`, `POST /`, `GET /:id`, `POST /:id/items/:itemId/inspections`, `POST /:id/confirm`, `POST /:id/reverse`, `GET /:id/fiscal-references`, and `POST /:id/fiscal-references`; these routes are authenticated, policy-guarded through `receipt.view`, `receipt.inspect`, `receipt.confirm`, and `receipt.reverse`, and now implement actual-arrival document capture, inspection-driven state transitions, transactional confirmation/reversal stock workflows, and pending fiscal-reference persistence without any external billing call;
- `/api/public/supplier-quotations` is now mounted for unauthenticated supplier RFQ access and exposes throttled `GET /:token` (`30/min`) plus throttled `POST /:token/response` (`10/min`); this contract is intentionally public, uses SHA-256 token-hash lookup instead of storing raw invitation tokens, lazily persists stale invitations to `EXPIRED` when accessed, returns `Retry-After` on throttle rejection, and is paired with the static `/supplier-quote/` page.
- standalone `/api/quality` runtime route groups are still not mounted; `/api/suppliers` is now mounted as the company-scoped supplier-management route group.
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
- a bounded route-policy convergence seam now exists for the highest-signal company/company-role admin flows and the agent workspace routes: company list/create and root-company list/create policies declare explicit `global-root` actor scope, company-role list/create policies declare explicit `company-admin` actor scope, `role.company.update` is now an active permission-based policy requiring `settings.manage` plus `company-admin` actor scope, and agent workspace routes now declare explicit `agent-workspace-user` actor scope before the downstream service-layer checks run;
- the inventory-admin follow-up now also relies on permission-governed product/inventory policies in `src/security/access-policy-registry.js`, including `product.list`, `product.detail`, `product.create`, `product.update`, `product.delete`, `product.category.list`, `product.category.create`, `inventory.stocks.list`, `inventory.alerts.list`, `inventory.movements.list`, `inventory.lot-qa.update`, `warehouse.company.list`, and `warehouse.company.create`;
- the same registry now also contains named permission policies for `product.sourcing.view/manage`, `supplier.view/manage`, `recipe.view/manage/approve/operations.view`, `production.view/create/approve/execute/complete/cancel/override`, `quality.view/inspect/override`, `procurement.view/manage/approve/override`, `receipt.view/inspect/confirm/reverse`, `warehouse.workspace.access`, `inventory.intake.override`, and `billing.handoff.view/create`; the recipe policies are actively consumed by mounted `/api/recipes` routes, the supplier policies are now actively consumed by mounted `/api/suppliers` routes, the production policies are actively consumed by mounted `/api/production` routes including `POST /orders/:id/complete`, the procurement policies are now actively consumed by mounted `/api/procurement` routes, the receipt policies `receipt.view` and `receipt.inspect` are now actively consumed by mounted `/api/receipts` routes, and the quality inspection policies are now also actively consumed by the inspection endpoints mounted under that same `/api/production` route group, while the remaining future supply policies still exist ahead of their later route groups
- `production.override` is now consumed by `src/services/production.service.js`, which requires explicit justification when production guardrails are bypassed, but the repository still does not persist or audit a richer justification workflow contract; `procurement.override`, `quality.override`, and `inventory.intake.override` remain metadata-governed only through `requiresJustification: true` declarations and helper functions; receipt confirmation/reversal routes are now active, but they still do not persist a richer override-justification workflow artifact.
- the planning/governance analysis package for this area is documented in `specs/p10-permission-governance/`, `docs/permission-governance-decisions.md` summarizes the recommended governance model, `p28` implemented the first runtime slice with a central policy model, reusable warning contract, and stable `company.create` deny rule for non-global-root actors, `p30` added enforced company-role creation denial for platform-scoped permissions, and `p32` added dedicated service-level denial audit visibility for that approved deny path;
- the same metadata-backed permission catalog consumed by `GET /api/roles/permissions` currently treats the production grouping used by the root roles-permissions UI as the set of `recipes.*` plus `production.*` codes; `quality.*` remains a separate quality grouping and is not part of the approved production grouping for this scope;
- `tests/access-policies.test.js` and `tests/authorization-convergence-characterization.test.js` now freeze current access-policy behavior for strict policy lookup, actor-scope inventories, actor-scope denial audit metadata, and selected route-policy mappings without changing runtime authorization semantics;
- browser login can request a backend-owned browser session by sending `X-Inventory-Browser-Session: cookie` to `/api/auth/login`;
- supported embedded browser flows use the cookie pair `inventory_browser_session` + `inventory_browser_state` instead of persisted bearer tokens in `localStorage`;
- `shared/session.js` and `shared/auth.js` remain the active browser helper seam for supported public pages;
- `/api/auth/me` returns the browser-session user projection and refreshes cookies for cookie-authenticated browser requests;
- `/api/auth/logout` invalidates the backend-owned browser session and clears both browser cookies;
- `src/services/browser-session.service.js` now also exposes internal targeted invalidation primitives for one user or a deduplicated batch of users; the reviewed company-role update flow now invokes the batch path after successful permission persistence, using reason code `role_permission_change` for the active users assigned to the changed role;
- after that targeted invalidation, subsequent affected cookie-authenticated requests such as `GET /api/auth/me` no longer authenticate successfully until the user completes a new login;
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
- inside the shell, navigation visibility is actor-aware: global `root` users keep the top-nav experience and can access `#home` and `#companies`, while company `admin` users with `companyId` receive the rebranded grouped sidebar with `#admin_home` as the default landing, dedicated inventory route modules for `#warehouses`, `#products`, `#lots`, and `#movements`, registered inventory adapter seams for those routes, and functional access to `#warehouses`, `#movements`, `#roles_permissions`, `#zones`, `#agents`, `#clients`, and `#routes`; the remaining approved sidebar entries still resolve to the shared neutral `in_process` view;
- `root/router.js` falls back to the first accessible route when a hash route is missing or not allowed;
- backend APIs remain authoritative; shell guards are UX-level gates only;
- `sales_supervisor` sessions still route to `/migration.html?mode=post-login-transition`, warehouse-capable sessions with `warehouse.access` now route directly to `/warehouse/`, and operational-agent sessions route to `/agent/`;
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
- the latest user-supplied repository-wide validation baseline reports `npm run typecheck` passed, `npm run lint` passed, and `npm run test -- --silent` passed with `1015/1017` tests green, `0` failed, and `2` skipped; governance tests are also reported green after the baseline audit file was corrected
- `scripts/run-tests.js` as the official aggregate test runner behind `npm run test`;
- deterministic default test bootstrap via `NODE_ENV=test` and `BROWSER_SESSION_STORE_MODE=memory` unless explicitly overridden;
- a dedicated non-default Redis-path validation command at `npm run test:redis-path`;
- targeted governance and characterization suites for browser/runtime, contract coverage, authorization, audit instrumentation, integrations, repository policies, and the current inventory, agent-workspace, and product hotspot seams;
- focused browser/runtime validation through `scripts/validate-public-runtime.js` and related tests.
- the procurement quotation workspace now also has a dedicated cross-layer convergence guard in `tests/procurement-quotation-workspace-convergence.test.js`, freezing the implemented migrations, procurement backend contract, root-shell quotations adapter/route wiring, and final `#cotizaciones` runtime integration seam.
- browser-session coverage now also includes targeted invalidation and Redis-store characterization through `tests/browser-session-targeted-invalidation.test.js`, `tests/browser-session-redis-store.test.js`, and `tests/browser-session-auth-boundary.test.js`.
- the current company-role update seam is now explicitly frozen by focused tests at three levels: route authorization in `tests/role-update-authorization.test.js`, service/repository behavior in `tests/role-update-service.test.js`, and affected-session convergence in `tests/browser-session-auth-boundary.test.js`.
- focused compatibility evidence now exists for the reviewed `session-docs-tenant-hardening` seam and later procurement follow-up work: `tests/browser-session-auth-boundary.test.js` preserves supported `/api/auth/login`, `/api/auth/me`, and `/api/auth/logout` cookie-mode behavior, `tests/root-shell-router-characterization.test.js`, `tests/root-shell-route-governance.test.js`, `tests/root-shell-rfq-tracking-api-characterization.test.js`, `tests/root-shell-supply-manifest.test.js`, `tests/rfq-tracking-view-characterization.test.js`, and `tests/rfq-runtime-governance-alignment.test.js` preserve actor-scoped root-shell fallback plus the current RFQ/supply route inventory, runtime/OpenAPI/catalog alignment, and RFQ tracking browser-module registration; `tests/rfq-tracking-view-characterization.test.js` now follows the `registry.js` harness pattern used by the comparable quotations view suite, freezes the sidebar+detail markup contract, the `renderRequestListItem(...)` / `renderDetailPlaceholder()` / `renderRequestDetail(...)` renderer split, and the manual-response dialog field ids and names consumed by `submitManualResponse()`; `tests/quotations-view-characterization.test.js` freezes the nested `response.purchaseRequest.id` / `response.purchaseRequest.items` handoff plus selected-supplier preservation used by `#cotizaciones` to continue the RFQ flow after grouped quotation creation; `tests/quotations-view.e2e.js` proves that the grouped quotation workspace can complete that continuation from the browser by confirming grouped quotation generation and then creating RFQ invitations from the same UI flow; and the latest purchase-orders workspace evidence extends that seam with `tests/root-shell-quotations-api-characterization.test.js`, `tests/procurement-foundation.test.js`, and `tests/purchase-orders-workspace-views-characterization.test.js`, freezing the expanded quotations adapter exports, procurement orders listing contract, and the implemented `#solicitudes_compra` / `#ordenes_compra` browser-module behavior. The latest user-supplied repository-wide maintenance-cycle validation reports `npm run typecheck` passed, `npm run lint` passed, and `npm run test -- --silent` passed with `1015/1017` tests green, `0` failed, and `2` skipped; governance tests also passed after the baseline audit file was corrected.
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
- `tests/root-shell-recipes-api-characterization.test.js`
- `tests/root-shell-recipes-admin-view-characterization.test.js`
- `tests/root-shell-production-admin-api-characterization.test.js`
- `tests/root-inventory-adapters-characterization.test.js`
- `tests/product-category-contract-characterization.test.js`
- `tests/agents-view-characterization.test.js`
- `tests/clients-view-characterization.test.js`
- `tests/routes-view-characterization.test.js`
- `tests/warehouses-view-characterization.test.js`
- `tests/warehouses-view.e2e.js`
- `tests/browser-e2e.e2e.js`
- `tests/zones-view-selection-filters-characterization.test.js`
- `tests/zones-view-dialog-feedback-characterization.test.js`
- `tests/zones-view.e2e.js`
- `docs/test-suite-catalog.md`
- `tests/coding-standard-path-alignment.test.js`

The active permission-governance foundation now also relies on:
- `tests/permission-governance-foundation.test.js`
- `tests/permission-governance-backend-consumption.test.js`
- `tests/production-permission-catalog-backfill-migration.test.js`
- `tests/role-permissions-enrichment.test.js` (now also freezes exclusion of platform-scoped permission catalog entries for company-admin callers)
- `tests/role-permissions-route.test.js`
- `tests/documentation-ownership-governance.test.js` for the documentation ownership map and canonical workflow/documentation references introduced by `hotspot-seams-doc-ownership`
- `tests/governance-baseline-sync-guardrails.test.js` as the intentionally narrow docs/contracts sync guardrail for the selected governance statements, including canonical `docs/**` ownership, parent-root workflow truth, and the current role-update seam wording
- `tests/openapi-contract-consistency.test.js` as the bounded machine-readable OpenAPI/route-alignment guardrail for the covered surfaces, now explicitly including `PUT /api/roles/company/{roleId}`

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
- `tests/product-sourcing-schema.test.js`
- `tests/suppliers-view-characterization.test.js`
- `tests/suppliers-view.e2e.js`
- characterization of transaction-scoped `createProduct` ownership through the repository transaction callback
- characterization of tenant-scoped allowed-warehouse and authorized-supplier validation during product create flows
- characterization of update-path hardening that strips client-supplied `companyId` and preserves the auth-scoped company on the final repository mutation
- characterization of derived lot-usability decoration on created product responses
- characterization of import-time category-cache reuse and tenant inventory lookup
- characterization of import-time inventory registration coupling for newly created imported products

Recorded post-implementation evidence supplied by the user for `supply-inventory-entry` `TASK-001`:
- `cmd /c "set NODE_ENV=test && set BROWSER_SESSION_STORE_MODE=memory && node --test tests/product-sourcing-schema.test.js tests/product-service-hotspot-characterization.test.js tests/product-category-contract-characterization.test.js tests/product-delete-semantics.test.js tests/pagination.test.js"` passed
- `npm run lint` passed
- `npm run typecheck` passed
- `npx prisma validate --schema prisma/schema.prisma` passed
- `npm run build` passed
- `npm run test -- --silent` passed
- baseline audit rerun now considers `TASK-001` baseline-safe with score `9.2/10`; remaining non-blocking concerns are clean-database migration execution evidence, thinner route/integration coverage for the new metadata, and continued hotspot sensitivity in `src/services/product.service.js`
- user-supplied validation evidence for `supply-inventory-entry` `TASK-002` reports targeted security/governance tests passed (`tests/access-policies.test.js`, `tests/permission-governance-foundation.test.js`) and remains valid as prior-slice evidence.
- user-supplied validation evidence for `supply-inventory-entry` `TASK-003` reports `PASS` for `tests/recipe-routes-contract.test.js`, `tests/recipe-schema.test.js`, and `tests/recipe-service-foundation.test.js`, together with `npm run lint`, `npm run typecheck`, `npx prisma validate --schema prisma/schema.prisma`, and `npm run test -- --silent`; local Windows `npm run build` remains a repository/platform caveat because Prisma generate can still hit a rename-lock condition unrelated to recipe correctness.
- user-supplied validation evidence for `supply-inventory-entry` `TASK-005` reports `PASS` for `node --test tests/production-service-foundation.test.js tests/production-schema.test.js tests/production-routes-contract.test.js tests/runtime-contract-governance.test.js`, together with `npm run lint`, `npm run typecheck`, `npm run build`, and `npx prisma validate`; user-supplied validation evidence for `TASK-006` reports `PASS` for `node --test tests/production-service-foundation.test.js tests/production-schema.test.js tests/production-consumption-hardening-migration.test.js`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npx prisma validate --schema prisma/schema.prisma`; user-supplied validation evidence for `TASK-009` reports 31 tests passed after adding aggregate-synchronization and reconciliation coverage in `tests/production-service-foundation.test.js`, together with `npm run lint`, `npm run typecheck`, and `npm run build`; user-supplied validation evidence for `TASK-010` reports 53 tests passed after adding quality-inspection coverage; user-supplied validation evidence for `TASK-011` reports 59 tests passed after adding 12 completion-focused tests in `tests/production-completion.test.js`; local Windows build logs may still include handled Prisma retry noise even when the final build succeeds.

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
- `set NODE_ENV=test&& set BROWSER_SESSION_STORE_MODE=memory&& node --test tests/access-policies.test.js tests/administrative-authorization-characterization.test.js tests/authorization-convergence-characterization.test.js` passed
- `npm run test -- --silent` passed with only the expected environment-gated skips remaining
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed

Additional requester-supplied validation evidence for `session-docs-tenant-hardening` `TASK-007`:
- `node --test tests/browser-session-auth-boundary.test.js` ✅
- `node --test tests/root-shell-router-characterization.test.js` ✅
- `node --test tests/root-shell-route-governance.test.js` ✅
- `npm run lint` ✅
- `npm run typecheck` ✅
- focused compatibility confidence is high for supported auth routes, browser-session login/me/logout, and root-shell actor-scoped fallback in the reviewed seam

Additional requester-supplied validation evidence for `session-docs-tenant-hardening` `TASK-008`:
- `node --test tests/root-shell-router-characterization.test.js` ✅
- `node --test tests/root-shell-route-governance.test.js` ✅
- `node --test tests/governance-baseline-sync-guardrails.test.js` ✅
- `node --test tests/documentation-ownership-governance.test.js` ✅
- `node --test tests/openapi-contract-consistency.test.js` ✅
- `node --test tests/browser-session-targeted-invalidation.test.js` ✅
- `node --test tests/browser-session-redis-store.test.js` ✅
- `node --test tests/browser-session-auth-boundary.test.js` ✅
- `node --test tests/role-update-service.test.js` ✅
- `node --test tests/user-company-role-scope.test.js` ✅
- `node --test tests/audit-instrumentation.test.js` ✅
- `node --test tests/bcrypt-supply-chain-closeout.test.js` ✅
- `node --test tests/access-policies.test.js` ✅
- `node --test tests/critical-contract-governance.test.js` ✅
- `node --test tests/permission-governance-backend-consumption.test.js` ✅
- `npm run test -- --silent` ✅ (`812` tests, `810` pass, `0` fail, `2` skipped)
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run build` ✅
- baseline audit verdict supplied by the user: `9.4/10`, `Acceptable`; remaining concerns are tracked here as operational/maintainability follow-up, not as confirmed regressions in the reviewed seam: post-commit `503 service_unavailable` ambiguity for role updates when session invalidation fails after persistence, safe audit persistence warnings when DB-backed audit storage is unavailable, bounded rather than exhaustive governance coverage, and the drift cost of large canonical documents

Additional requester-supplied validation evidence for `inventory-admin-views` follow-up tasks 003 and 004:
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run validate:public-runtime` ✅
- `npm run build` ✅
- `set BROWSER_SESSION_STORE_MODE=memory && node --test tests/product-category-contract-characterization.test.js tests/root-inventory-adapters-characterization.test.js tests/root-shell-route-governance.test.js tests/root-shell-router-characterization.test.js tests/public-surface-characterization.test.js` ✅

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

Additional requester-supplied validation evidence for `inventory-admin-views` `TASK-005`:
- `node --test tests/warehouses-view-characterization.test.js` ✅
- `node --test tests/warehouses-view.e2e.js` ✅
- `npm run lint` ✅
- `npm run lint:public-runtime` ✅
- `npm run typecheck` ✅
- `npm run validate:public-runtime` ✅
- `npm run build` ✅

Additional requester-supplied validation evidence for `inventory-admin-views` `TASK-006`:
- `node --test tests/movements-view-characterization.test.js tests/movements-view.e2e.js` ✅
- `npm run lint` ✅
- `npm run lint:public-runtime` ✅
- `npm run typecheck` ✅
- `npm run validate:public-runtime` ✅
- `npm run build` ✅

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
- `tsconfig.typecheck.json` keeps an explicit browser-runtime allowlist that includes `src/public/shared/session.js`, `src/public/shared/auth.js`, `src/public/login.js`, and a selected subset of `src/public/root/**` shell files, but not the entire approved root-shell runtime inventory.
- The supported root shell therefore relies on a mix of bounded typecheck coverage plus lint, runtime validator, smoke tests, characterization tests, and browser E2E.

## 13. Behavior to preserve
- Express must continue serving the supported browser runtime from `src/public/`.
- `/root/` must remain the supported wave-one root shell entrypoint.
- global `root` users must continue keeping the current top-navigation shell variant.
- company-admin users with `companyId` must continue receiving the rebranded sidebar shell variant.
- The root shell must continue bootstrapping through the existing browser-session model and `/api/auth/me`.
- `root` users and `admin` users with `companyId` must continue landing on `/root/` after browser login.
- company-admin sessions with no hash must continue landing on `#admin_home`.
- The root shell must continue offering safe logout through `/api/auth/logout`.
- Production stage execution must continue resolving stages from the frozen `recipeVersionSnapshot` instead of mutable recipe master data.
- Production stage stock deductions must continue flowing through the existing transactional inventory helper path rather than ad hoc direct stock writes.
- Production execution movements must continue using `movementType: OUT` with `reasonCode: PRODUCTION_CONSUMPTION` and `PRODUCTION_WASTE`.
- Production stage returns must continue requiring a prior stage execution, creating explicit `ProductionReturn` rows, and restoring stock through `movementType: IN` movements linked by `sourceType: production_return`.
- Production completion must continue using `POST /api/production/orders/:id/complete` from `IN_PROGRESS`, enforcing mandatory QA gates before lot creation, creating the finished-goods lot, and posting a destination-warehouse `movementType: IN` receipt with active `reasonCode: PRODUCTION_RECEIPT` before transitioning the order to `COMPLETED`.
- global root users must continue seeing `Empresas` and not the tenant roles route.
- company-admin users with `companyId` must continue seeing explicit sidebar route items, with `Bodegas`, `Productos`, `Lotes`, and `Movimientos` grouped under `Inventario`; `Recetas` and `Ordenes de produccion` grouped under `Produccion`; and procurement entries grouped under `Compras`, where `#proveedores`, `#cotizaciones`, `#seguimiento_cotizaciones`, `#solicitudes_compra`, `#ordenes_compra`, `#recepciones`, and `#referencias_fiscales` are all implemented. `#warehouses` must continue loading and creating warehouses through the existing `/api/warehouses/company` backend contract, `#products` must continue loading paginated products, opening detail, and conditionally allowing product/category mutations through `/api/products/**` and `/api/products/categories/company`, `#movements` must continue loading paginated movement history through `GET /api/inventory/movements`, `#lots` must continue rendering the current functional lots screen, `#recetas` must continue resolving to its dedicated RootShell route rather than the generic `in_process` screen, `#produccion_ordenes` must continue resolving to its dedicated RootShell route rather than the generic `in_process` screen, `#cotizaciones` must continue exposing the current RFQ workspace additions (supplier invitation generation, machote copy/refresh, manual response capture, tracking summary, nested `purchaseRequest` continuation reading, and selected-supplier preservation across grouped quotation creation) over the existing procurement adapters without introducing direct inventory mutation, `#seguimiento_cotizaciones` must continue exposing the dedicated RFQ follow-up page with request-level tracking plus manual response capture over `rfqTrackingApi`, while treating `EXPIRED`, `RESPONDED`, and `CANCELLED` invitations as terminal states with no manual-action button, and `#recepciones` / `#referencias_fiscales` must continue exposing their dedicated list/detail workspaces over `receiptsApi` using the current two-column commercial layout. `Roles y permisos`, `Zonas`, `Agentes`, `Clientes`, `Rutas`, `Facturación`, and `Aprobaciones` remain the other functional tenant-admin destinations, and the remaining approved sidebar entries still resolve to the shared neutral `in_process` view.
- product create/update/import flows must continue preserving backward-compatible defaults for legacy classification semantics while accepting the additive sourcing foundation fields (`sourcingMethod`, `inventoryType`, `sku`, `barcode`, `requiresLot`, `requiresExpiration`, `standardCost`, `realCost`, `allowedWarehouseIds`, `authorizedSuppliers`).
- product relation writes must continue validating that referenced warehouses and suppliers belong to the authenticated company, and the final update mutation must continue ignoring client-supplied `companyId` in favor of auth scope.
- the `#warehouses` view must continue enforcing read-only versus create behavior through effective permissions (`inventory.view` / `inventory.manage`), preserve local search and filter behavior over the in-memory warehouse dataset, preserve KPI fallback derivation when `summary` is absent, and preserve the create-dialog behavior that re-applies `defaultSellableSource` and disables sellable-source selection for virtual warehouse types.
- the `#products` view must continue using paginated product listing as its primary browser contract, preserve local search plus category filtering over the current page dataset, preserve contextual detail loading, preserve permission-aware create/edit/deactivate actions through `products.manage`, preserve permission-aware category list/create actions through the current product/inventory permissions, keep deactivation messaging aligned with the active-product list semantics, and preserve the additive `assignRecipeToProduct(...)` helper contract introduced in `products-api.js`.
- the `#recetas` route must continue mounting through `views.recipesAdmin`, keep its current dedicated shell identity distinct from the generic `in_process` view, preserve the existing `recipesApi` adapter contract for `/api/recipes/**` plus helper/state/renderer seams, and preserve the current root-admin workflow shape: list/detail loading, local administrative filters, recipe creation, draft version create/edit, version approval, and recipe-to-product assignment over the product update contract.
- the `#produccion_ordenes` route must continue mounting through `views.productionOrdersAdmin` as a usable read-only root supervision destination without warehouse-operational CTAs; pagination must remain server-side, while search/status/product/recipe/version/responsible/date filters remain explicitly client-side over the currently loaded page unless a later approved slice expands backend query support.
- the `#zones` view must continue using the existing company regions endpoints, keep searches local in memory, preserve the create-zone/create-subzone modal flows, and preserve the mobile consecutive list/detail interaction.
- the `#agents` view must continue composing its dataset from `GET /api/users/company`, `GET /api/roles/company`, and `GET /api/sales-routes/company`, preserve local search/group filtering, preserve company-user creation through `POST /api/users/company`, and preserve route-assignment persistence through the existing sales-route assignment endpoint.
- the `#clients` view must continue keeping client detail inside the supported shell, preserve local search/classification/status filtering, preserve create/update/deactivate behavior, and preserve append-only store/document/reference actions over the existing backend contracts.
- the `#routes` view must continue preserving overview metrics, route definition editing, subzone/agent save flows, replace-all per-agent goals saves, covered-store rendering, and simplified map rendering without introducing a new mapping dependency.
- the company-admin sidebar must keep hidden tooltips out of layout until collapsed hover/focus reveals them.
- the company-admin sidebar must keep overflow hardening in place: defensive box sizing, `min-width: 0` on nested wrappers, ellipsis for long labels/footer text, and a thin vertical scrollbar limited to the central scroll region.
- shell-owned global offsets and actor-specific furniture must remain outside individual views, while views keep ownership of their internal content layout only.
- Companies Admin must continue using only the existing root-company list/create/status endpoints.
- Roles/Permissions Admin must continue using the existing permission list and company-role list/create/update endpoints, preserve metadata-backed permission presentation, keep global roles read-only, keep self-lockout protections on the actor's own role, and keep targeted post-update browser-session invalidation limited to the active users assigned to the changed role.
- Zones must continue using only the existing company regions list/create and subregion-create endpoints.
- no role delete, user-role reassignment, or legacy-page reactivation behavior is part of the supported runtime.
- Requests to deprecated legacy HTML routes under `/root/*.html`, `/warehouse/*.html`, and `/agent/*.html` must continue responding from the same URL with the common migration screen and HTTP `410 Gone`, without redirect.
- `/migration.html?mode=post-login-transition` must remain a supported 200 post-login landing for non-wave-one browser profiles.
- `legacy-public-runtime/` must remain outside the active runtime unless a later approved change explicitly redefines the supported surface.
- `/api/auth/login`, `/api/auth/me`, and `/api/auth/logout` must remain supported.
- `GET /health` must remain a backward-compatible liveness endpoint.
- `GET /health/ready` must continue reflecting both database readiness and browser-session-store readiness.
- Supported browser flows must not reintroduce persisted bearer tokens in `localStorage`.
- `ProductionItem.consumedQuantity` must remain an auxiliary aggregate synchronized from `SUM(ProductionConsumption.quantity)` at the production-order scope, explicitly excluding waste and returns.
- the current procurement foundation must remain intention/approval only: purchase requests, quotations, RFQ invitations, supplier selections, optional approvals, and purchase orders must not mutate inventory, lots, warehouse balances, or stock movements directly; stock effects begin only through the separate receipt confirmation workflow under `/api/receipts/:id/confirm`.
- public RFQ throttling must remain route-specific on the existing request-throttle foundation: `GET /api/public/supplier-quotations/:token` at `30/min` and `POST /api/public/supplier-quotations/:token/response` at `10/min`, with `Retry-After` on rejection.
- RFQ invitation expiration must continue being lazily materialized to persisted status `EXPIRED` when public or relevant internal RFQ flows touch stale invitations, rather than silently leaving stale persisted status while only computing expiry in memory.
- purchase receipt confirmation must continue using `POST /api/receipts/:id/confirm` only from `ACCEPTED` or `PARTIALLY_ACCEPTED`, creating accepted lots transactionally, posting `PURCHASE_RECEIPT` stock movements, updating warehouse/product balances, and storing `PurchaseReceiptItem.confirmedLotId` for traceability.
- purchase receipt reversal must continue using `POST /api/receipts/:id/reverse` only from `CONFIRMED`, posting compensating `RECEIPT_REVERSAL` stock movements and reversing the related warehouse/product balances transactionally.
- fiscal references must continue being stored only as pending handoff metadata on confirmed receipts; `FiscalDocumentReference` persistence must not be interpreted as an implemented external Billing or Hacienda integration.
- production-stage QA inspections must remain linked to the latest persisted stage execution for the target order stage; `REJECTED` inspections must continue transitioning the order to `QA_HOLD`, and `APPROVED` / `CONDITIONALLY_ACCEPTED` inspections recorded while the order is already in `QA_HOLD` must continue restoring the order to `IN_PROGRESS` so the order can later complete through the QA-gated `/complete` flow.

## 14. Known defects
- The committed migration `20260811000000_add_product_sourcing_foundation` is validated at Prisma-schema/client-build level, but current repository evidence still does not show execution against a clean database baseline; deployment-time surprises remain a non-blocking residual risk for the new supply foundation.
- Route/integration coverage for the new product sourcing metadata remains thinner than schema/service-level coverage; the repository currently relies more heavily on `tests/product-sourcing-schema.test.js`, `tests/product-service-hotspot-characterization.test.js`, and aggregate validation than on endpoint-level regression tests for `POST /api/products` and `PUT /api/products/:id` with the new fields.
- Company-role updates now invalidate browser sessions for active users assigned to the changed role after successful permission persistence, but the invalidation happens after the role update commits. If the browser-session store is unavailable, the API can still return `503 service_unavailable` even though the role change was already persisted, leaving an operational ambiguity that requires follow-up handling/observability.
- Sensitive tenant role-admin reads are now partially hardened at the repository boundary: `role.repository.findCompanyOwnedRoleById()` is used first for company-role updates and `role.repository.findAssignableRoleByIdForCompany()` is used first for company-user creation, while the broad `findRoleById()` lookup remains only as a narrow fallback for differentiated `404` / `403` / `400` semantics around nonexistent, inactive, global, root, or foreign-company roles rather than as the primary lookup path.
- `production.override` is now enforced by `src/services/production.service.js`, but the repository still lacks persisted/audited justification workflow support; the new procurement routes currently use `procurement.view`, `procurement.manage`, and `procurement.approve` but do not yet consume `procurement.override`; `quality.override` and `inventory.intake.override` also remain metadata-only.
- The access-policy registry now contains active production policy entries consumed by mounted `/api/production` routes, including `production.complete`, and `quality.view` / `quality.inspect` are now proven at route level through inspection endpoints mounted under that same production route group. `procurement.view`, `procurement.manage`, and `procurement.approve` are now also proven at route level through the mounted `/api/procurement` group, `supplier.view` / `supplier.manage` are proven through the mounted `/api/suppliers` group, and `receipt.view`, `receipt.inspect`, `receipt.confirm`, and `receipt.reverse` are now proven at route level through the mounted `/api/receipts` group. Intentional sequencing still remains: standalone `/api/quality` route groups remain absent.
- The `root-admin-recipes-production` shell slice is now implemented with asymmetric but usable depth: `#recetas` is a richer root-admin workflow with recipe list/detail loading, local filters, recipe creation, draft version create/edit, version approval, and product assignment over the existing `/api/recipes/**` and `/api/products/:id` contracts, while `#produccion_ordenes` is now a usable read-only supervision workflow over `/api/production/orders/**` with list/detail/filter behavior but still keeps a narrower scope than `#recetas` and intentionally does not expose warehouse/QA actions.
- After `supply-inventory-entry` `TASK-015` plus the approved warehouse/runtime governance alignment work, the downstream supply gaps are now narrower and more explicit: procurement request/quotation/comparison/selection/optional-approval/purchase-order foundation is implemented; the RFQ invitation lifecycle plus public supplier-response flow are implemented; public RFQ throttling and lazy `EXPIRED` persistence now exist in production code; receipt document/inspection plus confirmation/reversal stock posting is implemented; fiscal-reference persistence for receipts is implemented as pending handoff metadata only; the supported warehouse SPA now exists at `/warehouse/` and is covered by validator, smoke, characterization, bounded typecheck, and browser tests; the supported root shell now also exposes list/detail receipt and fiscal-reference workspaces; but there is still no external billing handoff implementation, no standalone `/api/quality` route group, production detail rows still lack DB-enforced `warehouseId` / `productId` foreign keys, completion/override justification is not yet durably persisted or audited as a workflow artifact, and several lifecycle invariants still depend on Zod/service enforcement rather than DB constraints.
- Production lifecycle invariants are still only partially constrained at the database level: same-warehouse prevention, expiration-date ordering, sourcing/recipe guardrails, stage-execution timing/order assumptions, mandatory completion QA gating, and allowed status transitions are enforced in Zod/service code rather than by DB `CHECK` constraints or richer relational restrictions.
- `ProductionConsumption`, `ProductionWaste`, and `ProductionReturn` persist `warehouseId`, `productId`, and `lotId`; all three detail tables now require `lotId` and enforce referential integrity to `Lot`, while `warehouseId` / `productId` integrity still relies on application-controlled writes.
- The browser-runtime typecheck baseline remains intentionally bounded rather than repository-wide. It now includes the shared auth/session helpers, login runtime, the supported warehouse SPA files under `src/public/warehouse/**`, and a selected allowlisted subset of `src/public/root/**`, while still relying on lint, runtime-contract validation, characterization tests, smoke tests, and browser E2E for broader browser governance.
- `tsconfig.typecheck.json` still uses a bounded explicit include list for browser-runtime files and does not currently include every approved root-shell or agent-shell inventory module. Observable root-shell omissions still include `src/public/root/runtime-contract.js`, `src/public/root/categories-api.js`, `src/public/root/inventory-api.js`, `src/public/root/products-api.js`, `src/public/root/warehouses-api.js`, `src/public/root/rfq-tracking-api.js`, `src/public/root/views/rfq-tracking-admin.renderers.js`, `src/public/root/views/rfq-tracking-admin.js`, `src/public/root/views/warehouses-admin.helpers.js`, `src/public/root/views/warehouses-admin.renderers.js`, `src/public/root/views/warehouses-admin.js`, `src/public/root/views/products-admin.helpers.js`, `src/public/root/views/products-admin.state.js`, `src/public/root/views/products-admin.renderers.js`, `src/public/root/views/products-admin.js`, `src/public/root/views/lots-admin.js`, `src/public/root/views/movements-admin.helpers.js`, `src/public/root/views/movements-admin.renderers.js`, and `src/public/root/views/movements-admin.js`; the supported `src/public/agent/**` runtime is also outside the current bounded typecheck scope even though it remains part of the supported public inventory.
- Permission-governance hardening identified in `specs/p10-permission-governance/` remains only partially implemented, but the enforced scope has advanced: the centralized policy foundation, the stable `company.create` deny rule, and a first company-role deny rule now exist; company-role create/update reject platform-scoped permissions such as `companies.manage` before persistence, denied attempts can now emit dedicated service-level audit events through actions `roles.company.create.governance_denied` and `roles.company.update.governance_denied`, and other sensitive combinations still remain warning-only in success-path audit metadata.
- Denied company-role governance attempts are now recorded through the existing safe audit seam from the service-level denial path when request audit context is available; the dedicated actions are `roles.company.create.governance_denied` and `roles.company.update.governance_denied`, the recorded outcome is `REJECTED`, and metadata includes `governanceDecision`, `denialCode`, `ruleId`, `affectedPermissions`, `requestedPermissionCodes`, and `companyId`. This remains distinct from route-level authorization denial auditing and preserves the same `403` response contract.
- `src/services/agent-workspace.service.js` and `src/services/product.service.js` remain large orchestration hotspots with mixed coordination, filtering/serialization, and cross-service transaction responsibilities, although focused seams now exist in `agent-workspace-store-state.service.js`, `product-permission-shaping.service.js`, and `product-pricing.service.js`.
- `src/security/access-policies.js` remains a centralized authorization facade and policy entrypoint, but the registry, actor-scope, and denial-audit responsibilities are now split into dedicated modules; agent workspace routes now consume that same facade explicitly, while order routes still intentionally preserve a mixed baseline of permission-governed draft mutations and role-governed legacy operations.
- The supported post-login landing for non-wave-one roles remains transitional and informational (`/migration.html?mode=post-login-transition`), not a final functional destination.
- The Redis session store implementation uses a small raw-socket protocol client rather than a mature Redis library.
- Redis user-session membership sets can retain stale session IDs after natural key expiry because the reviewed store now maintains reverse membership for targeted invalidation but does not run a background cleanup or expiry-coupled set pruning.
- Some passing tests can still emit expected operational logs, though the previously known incidental browser E2E audit-DB noise for the addressed suites has already been isolated through DB-free seams.
- Authorization characterization tests can still pass while emitting expected `audit_record_failed` console noise when denied-path audit persistence cannot reach `db:5432`; this is currently diagnostic noise, not by itself a guard regression.
- `tests/public-surface-characterization.test.js` uses regex-based stylesheet characterization rather than screenshot diffs, so subtle per-browser pixel drift can still escape despite the stronger contract coverage.

## 15. Architectural debt
- The application remains layered without strict hexagonal separation.
- Service-layer responsibilities remain broad in several modules.
- `src/services/inventory.service.js`, `src/services/agent-workspace.service.js`, `src/services/product.service.js`, and `src/services/procurement-rfq.service.js` remain characterization-protected hotspots; the RFQ service now also centralizes token handling, lazy expiration materialization, public/internal response orchestration, tracking shaping, and audit coordination in one large module.
- product compatibility currently depends on dual semantics across legacy fields (`productType`, `sellableKind`) and the new additive sourcing foundation (`sourcingMethod`, `inventoryType`), increasing normalization and drift risk until later supply workflows converge on the newer fields.
- security governance truth for role and future supply operations remains split across route policies, service-level governance evaluation, seed data, additive backfill migrations, and browser presentation metadata; the recipes/production existing-database permission gap is now closed, but coordination cost remains because repository enforcement is still hybrid rather than centered in one module boundary.
- production execution detail persistence remains split between granular stage-execution records and the older aggregate `ProductionItem.consumedQuantity` field; the repository now explicitly synchronizes the latter as an auxiliary aggregate from `ProductionConsumption`, but it still carries dual-representation maintenance cost and requires downstream readers to treat granular consumption detail as authoritative.
- the operational role bundles in `src/security/role-bundles.config.js` remain `status: 'proposed'`; they document intended permission groupings but are not yet active seeded roles or enforced personas in runtime flows. That current bundle inventory now includes `company_admin` with default base permissions for the approved production grouping in this scope: `recipes.view`, `recipes.operations.view`, `recipes.manage`, `recipes.approve`, `production.view`, `production.create`, `production.approve`, `production.execute`, `production.complete`, `production.cancel`, and `production.override`, while explicitly excluding `quality.inspect` and `quality.override` from that default bundle.
- API runtime, static public delivery, and governance concerns still coexist in the same deployable.
- Operational assurance still depends on synchronization across docs, validators, tests, README, env examples, compose files, and workflows.
- The root shell still uses global browser objects and ordered file-level script composition rather than module bundling or stronger client-side encapsulation, although the current `window.RootShell` registry, explicit `runtime-contract.js` loader contract, and modularity governance tests now provide a bounded containment seam.
- The production group still has asymmetric depth: `#recetas` is the richer administrative workspace over existing recipe and product contracts, while `#produccion_ordenes` is now a usable read-only supervision workspace over `/api/production/orders/**` with list/detail/filter behavior. The remaining asymmetry is not route usability but depth and filtering model: production orders currently rely on server-side pagination only, with the remaining administrative filters executed client-side over the loaded page.
- Company-admin sidebar behavior in `src/public/root/app.js` currently includes hardcoded group identifiers and UI-state assumptions (`inventory-group`, `sales-group`, route-specific checks), which is workable but brittle for future menu expansion even after layout ownership was normalized.
- The warehouses screen is now partially decomposed into `warehouses-admin.js`, `warehouses-admin.helpers.js`, and `warehouses-admin.renderers.js`, but the main controller still owns DOM wiring, async orchestration, and dialog lifecycle in a single plain-script module rather than a fuller application/use-case boundary.
- The movements screen is now partially decomposed into `movements-admin.js`, `movements-admin.helpers.js`, and `movements-admin.renderers.js`, but the main controller still owns DOM wiring, async orchestration, pagination event handling, and drawer lifecycle in a single plain-script module rather than a fuller application/use-case boundary.
- The products screen is now partially decomposed into `products-admin.js`, `products-admin.helpers.js`, `products-admin.renderers.js`, and `products-admin.state.js`, but the main controller still owns DOM wiring, async orchestration, dialog lifecycle, and mutation coordination in a single plain-script module rather than a fuller application/use-case boundary.
- The zones screen is still implemented as plain-script DOM orchestration in `src/public/root/views/zones-admin.js` and `zones-admin.helpers.js`; behavior is now covered by E2E plus isolated selection/filter and dialog/feedback characterization tests, but the view remains large and UI-stateful rather than decomposed into smaller modules.
- The commercial root-shell screens are still plain-script DOM controllers with large mount functions in `agents-admin.js`, `clients-admin.js`, and `routes-admin.js`; maintainability improved because renderer/state seams now own list/detail/map/summary rendering and selection state concerns, but the main orchestration remains controller-centric rather than decomposed into fuller application/use-case boundaries.
- The browser-runtime `typecheck` baseline remains intentionally bounded through an explicit allowlist rather than a broad `src/public/**` expansion, and several approved inventory runtime files still remain outside that list.
- A temporary compatibility bridge still exists at the legacy hyphenated coding-standards path; the authoritative coding-standards content now lives only at `docs/coding_standard.md` and drift is guarded by `tests/coding-standard-path-alignment.test.js`.
- `legacy-public-runtime/` remains in-repo as transitional backup/reference debt until equivalent SPA functionality is implemented and validated.

## 16. Security risks
- the previously approved bcrypt supply-chain residual is now closed: the checked-in dependency tree no longer includes the `@mapbox/node-pre-gyp` / `tar` auth install chain and the current audit baseline records `0` vulnerabilities;
- native-module operational risk still exists because `bcrypt@6.0.0` resolves through `node-gyp-build` and may still depend on prebuilt-binary availability or fallback compilation in some environments;
Current architecture-facing security concerns still visible:
- supported non-test browser-session persistence depends on Redis availability and correct environment configuration;
- public RFQ throttling now exists, but its effective distributed behavior still depends on the configured throttle-store mode and deployment topology;
- permission-governance warnings currently affect audit metadata and service decisions only; route-level authorization still primarily depends on existing role/policy middleware;
- future supply override permissions (`production.override`, `procurement.override`, `quality.override`, `inventory.intake.override`) are discoverable and marked justification-required in metadata, but concrete justification capture/enforcement is not yet implemented; the procurement runtime does not yet consume `procurement.override`, and the receipt runtime now exposes confirm/reverse routes but still does not implement a richer override-justification workflow around exceptional receipt operations, so later exception-handling slices must not assume this security control already exists beyond config-level intent;
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
- the repository now contains future-facing supply/intake permission bundles and access policies, but current code still does not define whether those bundles will be materialized first as seeded roles, UI presets, or backend-only guidance; that consumption model remains unresolved in implemented code, bundle membership is still governance metadata rather than runtime enforcement, and the current bundle coverage remains selective rather than repository-wide.
- the runtime company-role update flow now exists, but it is implemented inside the current layered service/repository boundary rather than behind a deeper application/domain module split; authorization, governance, audit, and anti self-lockout rules remain concentrated in `src/services/role.service.js`.
- the production throttle-store mode actually used for public RFQ protection in each deployed environment is not directly evidenced in the reviewed repository artifacts.