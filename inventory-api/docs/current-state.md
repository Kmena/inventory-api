# Current State

<!-- MAINT-002: per-section update log — append a row when a section is materially changed -->
| Section | Last updated | Change summary |
|---|---|---|
| §4 Existing domains and modules | 2026-09-01 | Documented products-admin SPA inline subcategory creation support and exported helper usage |
| §6 Current data flows | 2026-09-01 | Added stacked-dialog product/subcategory flow in root-shell product admin |
| §8 APIs and integrations | 2026-09-01 | Clarified no backend/API changes for create-product-with-subcategory; documented existing category/product endpoint consumption |
| §12 Current testing strategy | 2026-09-01 | Added products SPA characterization coverage for duplicate helper and render contract |
| §7 Database and persistence | 2026-09-01 | Added Client.creditLimit/creditBalance and ClientStore credit fields |
| §14 Known defects | 2026-09-01 | Removed DEF-PRD-001 (resolved); DEF-PRD-002 remains open |
| §1 System overview | 2026-09-26 | Added implemented `recipe-input-per-unit-basis` feature summary and audit-fix status |
| §4 Existing domains and modules | 2026-09-26 | Documented per-input quantity-basis override across recipe, production planning, and UI layers |
| §5 Main use cases | 2026-09-26 | Added mixed-basis recipe authoring and production material scaling behavior |
| §6 Current data flows | 2026-09-26 | Added recipe save, production planning snapshot, and lot-availability flows for per-input basis |
| §7 Database and persistence | 2026-09-26 | Added RecipeStageInput.inputQuantityBasis schema/migration and snapshot freezing behavior |
| §8 APIs and integrations | 2026-09-26 | Added recipe contract exposure of inputQuantityBasis and production preview consumption |
| §12 Current testing strategy | 2026-09-26 | Added automated coverage for per-input basis scaling and noted reported full-suite pass |
| §13 Behavior to preserve | 2026-09-26 | Added backward-compatible inheritance/null semantics and frozen per-input basis behavior |
| §14 Known defects | 2026-09-26 | Marked AUD-004 and AUD-005 as corrected; DEF-PRD-002 remains open |
| §15 Architectural debt | 2026-09-26 | Added note about duplicated effective-basis logic across backend and browser adapters |
| §17 Unknowns and assumptions | 2026-09-26 | Added note that full-suite validation is user-reported and not re-executed in this refresh |
| §1 System overview | Post `recipe-approval-ux` refresh | Added implemented recipe approval UX summary for draft approval confirmation, local feedback, incomplete markers, and repair highlighting |
| §4 Existing domains and modules | Post `recipe-approval-ux` refresh | Documented recipe admin approval dialog, action-local feedback, incomplete draft marker, and editor repair guidance |
| §5 Main use cases | Post `recipe-approval-ux` refresh | Added approval confirmation, draft repair, and incomplete-row save semantics |
| §6 Current data flows | Post `recipe-approval-ux` refresh | Added approval confirmation and incomplete-draft save flows in the root-shell recipe admin UI |
| §8 APIs and integrations | Post `recipe-approval-ux` refresh | Clarified reuse of the unchanged recipe approval API contract by the new frontend UX |
| §12 Current testing strategy | Post `recipe-approval-ux` refresh | Added recipe admin characterization coverage and user-reported targeted regression results |
| §13 Behavior to preserve | Post `recipe-approval-ux` refresh | Added approval immutability, backend validation authority, and stage-type-aware incomplete-row semantics |
| §15 Architectural debt | Post `recipe-approval-ux` refresh | Added note about frontend-local incomplete markers and message-parsing-based repair guidance |
| §17 Unknowns and assumptions | Post `recipe-approval-ux` refresh | Added manual browser validation gap for dialog focus and scroll behavior |
| §1 System overview | 2026-10-02 | Added partial implementation status for `client-store-documents-credit-ux` in the root-shell clients workspace |
| §4 Existing domains and modules | 2026-10-02 | Documented current client/store admin UI behavior for native document download, file-picker upload, and zone-refresh guidance |
| §5 Main use cases | 2026-10-02 | Added implemented client-document and store-dialog UX flows |
| §6 Current data flows | 2026-10-02 | Added authenticated document download, FileReader upload, and in-dialog zone refresh flows |
| §8 APIs and integrations | 2026-10-02 | Clarified unchanged client document/backend contracts and current taxpayer/economic-activity adapters |
| §12 Current testing strategy | 2026-10-02 | Added client workspace characterization coverage for TASK-001 through TASK-004 |
| §13 Behavior to preserve | 2026-10-02 | Added current client-document contract and in-dialog zone-refresh compatibility constraints |
| §14 Known defects | 2026-10-02 | Added remaining client/store UX and model gaps after TASK-001 through TASK-004 |
| §15 Architectural debt | 2026-10-02 | Added duplicated FileReader pattern and large page-controller debt in clients admin |
| §17 Unknowns and assumptions | 2026-10-02 | Added pending manual browser verification for native download and real zone navigation/refresh behavior |
| §1 System overview | 2026-10-03 | Refreshed `client-store-documents-credit-ux` status after TASK-005 and zero-credit omission alignment |
| §4 Existing domains and modules | 2026-10-03 | Documented create-time store creditLimit support and shared store payload builder ownership |
| §5 Main use cases | 2026-10-03 | Added create-store creditLimit behavior and zero-value omission semantics |
| §6 Current data flows | 2026-10-03 | Added shared store payload builder flow for create-store submissions |
| §8 APIs and integrations | 2026-10-03 | Clarified create-store contract now accepts optional creditLimit without new routes |
| §12 Current testing strategy | 2026-10-03 | Added user-reported TASK-005 targeted validation and 32/32 pass evidence |
| §13 Behavior to preserve | 2026-10-03 | Added create-store creditLimit compatibility and zero-omission behavior |
| §14 Known defects | 2026-10-03 | Removed obsolete missing-create-time-credit defect and retained remaining onboarding gaps |
| §15 Architectural debt | 2026-10-03 | Added note about shared builder reducing drift while client payload dead fields remain |
| §17 Unknowns and assumptions | 2026-10-03 | Recorded user-reported lint/typecheck/audit evidence for TASK-005 refresh |
| §1 System overview | 2026-10-04 | Refreshed `create-product-with-subcategory` as fully implemented frontend-only and advanced `client-store-documents-credit-ux` to current partial TASK-012 state |
| §4 Existing domains and modules | 2026-10-04 | Documented store-document Phase 2, taxpayer/economic-activity UI wiring, and completed product-admin inline subcategory UX |
| §5 Main use cases | 2026-10-04 | Added two-phase store onboarding/document flow and inline product subcategory creation details |
| §6 Current data flows | 2026-10-04 | Added store-document upload route usage and taxpayer/economic-activity-assisted client flows |
| §8 APIs and integrations | 2026-10-04 | Added active store-document upload route and clarified frontend-only nature of create-product-with-subcategory |
| §12 Current testing strategy | 2026-10-04 | Added TASK-009/TASK-012 characterization coverage and user-reported full-suite/lint/typecheck pass |
| §13 Behavior to preserve | 2026-10-04 | Added store-document contract compatibility and consume-once/focus behavior for product subcategory UX |
| §14 Known defects | 2026-10-04 | Reframed remaining client onboarding gaps after TASK-009/TASK-012 and noted no active defect in the product subcategory slice |
| §15 Architectural debt | 2026-10-04 | Added Phase-2 dialog/file-upload duplication and coarse browser-module notes |
| §17 Unknowns and assumptions | 2026-10-04 | Added user-reported 1600-test validation and pending manual evidence for new browser flows |
| §1 System overview | Post TASK-006 refresh | Refreshed `client-store-documents-credit-ux` status after store currency support and null-currency-safe credit rendering |
| §4 Existing domains and modules | Post TASK-006 refresh | Documented required store currency capture and legacy-null-safe renderer behavior in clients admin |
| §5 Main use cases | Post TASK-006 refresh | Added create-store currency flow and legacy null-currency credit summary behavior |
| §6 Current data flows | Post TASK-006 refresh | Added store currency propagation through shared payload shaping, schema validation, and persistence |
| §7 Database and persistence | Post TASK-006 refresh | Added additive `ClientStore.currency` column and migration status |
| §8 APIs and integrations | Post TASK-006 refresh | Clarified existing store-create contract now accepts required browser-side currency selection without a new route |
| §12 Current testing strategy | Post TASK-006 refresh | Added TASK-006 coverage and user-reported 36/36 targeted validation plus Prisma/build results |
| §13 Behavior to preserve | Post TASK-006 refresh | Added currency-enum compatibility and null-currency-safe renderer semantics |
| §14 Known defects | Post TASK-006 refresh | Removed obsolete missing-store-currency gap and retained remaining onboarding work |
| §15 Architectural debt | Post TASK-006 refresh | Added note that legacy nullable currency remains in persistence while browser creation now requires currency |
| §17 Unknowns and assumptions | Post TASK-006 refresh | Recorded user-reported TASK-006 validation and unresolved manual browser verification |
| §1 System overview | Post TASK-007 refresh | Added store fiscal override foundation status, additive migration, and updated targeted validation evidence |
| §4 Existing domains and modules | Post TASK-007 refresh | Documented explicit inherit-vs-override billing mode and current store-card fiscal summary behavior |
| §5 Main use cases | Post TASK-007 refresh | Added create-store inherited-vs-override fiscal capture behavior |
| §6 Current data flows | Post TASK-007 refresh | Added store billing-mode payload shaping and null-as-inherit persistence flow |
| §7 Database and persistence | Post TASK-007 refresh | Added 7 nullable `ClientStore` fiscal override fields and migration `20261002001000_add_store_billing_fields` |
| §8 APIs and integrations | Post TASK-007 refresh | Clarified existing store-create contract now accepts additive fiscal override fields without a new route |
| §12 Current testing strategy | Post TASK-007 refresh | Added `client-store-fiscal-overrides` coverage and user-reported 42/42 targeted validation |
| §13 Behavior to preserve | Post TASK-007 refresh | Added null-as-inherit store fiscal semantics and current override-summary compatibility |
| §14 Known defects | Post TASK-007 refresh | Removed obsolete missing-store-override gap and retained remaining onboarding work |
| §15 Architectural debt | Post TASK-007 refresh | Added note about override-mode rules remaining browser/service heavy and client payload drift still open |
| §17 Unknowns and assumptions | Post TASK-007 refresh | Recorded user-reported TASK-007 Prisma/build validation and remaining manual browser checks |
| §1 System overview | Post TASK-008 refresh | Added implemented client edit fiscal/geographic fields, client-payload dead-code cleanup, and inline credit-feedback alignment |
| §4 Existing domains and modules | Post TASK-008 refresh | Documented editable client legal/geographic fields and styled credit mini-form feedback |
| §5 Main use cases | Post TASK-008 refresh | Added implemented client edit completion and inline credit-feedback behavior |
| §6 Current data flows | Post TASK-008 refresh | Added client update payload cleanup and inline store-credit feedback flow |
| §8 APIs and integrations | Post TASK-008 refresh | Clarified no new backend/API contract change for TASK-008 and preserved existing taxpayer/economic-activity gaps |
| §12 Current testing strategy | Post TASK-008 refresh | Added TASK-008 characterization coverage and user-reported 43/43 targeted validation |
| §13 Behavior to preserve | Post TASK-008 refresh | Added editable client-field compatibility and inline credit-feedback semantics |
| §14 Known defects | Post TASK-008 refresh | Removed obsolete client-payload dead-field defect and retained remaining onboarding gaps |
| §15 Architectural debt | Post TASK-008 refresh | Recorded reduced payload drift after dead-code removal while clients-admin modules remain coarse |
| §17 Unknowns and assumptions | Post TASK-008 refresh | Recorded user-reported TASK-008 validation plus remaining manual browser validation gaps |

## 1. System overview
The implemented system is a Node.js 24 + Express + Prisma modular monolith that serves both JSON APIs and browser-delivered SPAs from one runtime.

The repository currently supports:
- identity and permission-based access control
- company-scoped master data
- inventory, lots, receipts, and stock movements
- recipes and production orders
- QA inspection and rejection handling
- supplier/procurement workflows
- warehouse and root-shell browser UIs

The feature `qa-rejection-material-reconciliation-amendment` is implemented in the current codebase as an additive extension over the existing production + QA workflow. It adds broader QA relevant-input scope resolution, replacement-recovery support, lot-level recolection entry capture, same-lot usage validation, terminal reconciliation recording, and warehouse SPA support for those states.

The feature `recipe-input-per-unit-basis` is also implemented. `RecipeStageInput` now supports an optional per-input quantity basis override through `inputQuantityBasis` (`PER_OUTPUT_KG | PER_FINISHED_UNIT`). When the field is `null`, the stage input inherits `RecipeVersion.quantityBasis`. When it is `PER_FINISHED_UNIT`, that individual input scales by planned unit count even when the recipe version remains `PER_OUTPUT_KG`, enabling mixed recipes such as gravimetric bulk inputs plus discrete packaging inputs.

The feature `recipe-approval-ux` is implemented in the root-shell recipe administration workspace. Draft-version approval is now gated by a custom irreversible-action confirmation dialog, approval success/failure feedback is rendered inside the affected version card, draft versions can be marked locally as `Incompleta` after warning-level save conditions or approval failures, and the draft editor applies conservative repair highlighting when backend approval diagnostics can be mapped safely to a stage or uniquely matched input.

The feature `create-product-with-subcategory` is fully implemented as a frontend-only change in the root-shell products administration workspace. The product form now exposes an inline `+ Nueva` subcategory action next to the subcategory selector, the categories dialog can stack over the still-open product dialog using native `<dialog>.showModal()`, read-only users no longer see the create-subcategory fieldset, local duplicate detection is performed through `views.productsAdminHelpers.checkSubcategoryNameDuplicate(...)` before the unchanged category API call, and `lastCreatedSubcategoryId` is consumed once so the next create-product dialog can preselect the newly created subcategory without affecting edit mode.

The feature `client-store-documents-credit-ux` remains partially implemented, but current repository state now goes beyond TASK-008. The root-shell clients workspace still delivers protected client-document downloads through a native browser download flow, replaces the raw Base64 textarea with a file-picker + `FileReader` derivation flow, allows the store dialog to show a no-zones guidance state with in-place zone refresh, accepts create-time store `currency`, optional `creditLimit`, and nullable fiscal override fields through the existing backend create-store path, and exposes backend-supported client legal/geographic fields in the detail form. In the current code it also loads economic-activity options at mount time, uses dropdowns plus hidden `economicActivityName` fields in create/edit forms, reveals taxpayer-lookup actions when the actor has `integration.taxpayer.lookup`, and transitions the dynamic store dialog to a second optional Phase 2 document-upload step after a store is created. That Phase 2 uses `clientsApi.uploadStoreDocument(...)` against the active store-scoped backend route, keeps the 5 MB file-size guard, and converts files to Base64 in-browser before calling the unchanged governed upload contract.

Remaining client onboarding gaps still include incomplete fiscal/trade-type coverage and the absence of a richer finalized store-document module. No backend, API, schema, migration, or permission change was introduced for `create-product-with-subcategory`.

User-reported validation for this refresh: 1600 tests passed, 0 failed; `npm run typecheck` passed; and `npm run lint` passed. This document records that reported state and the checked-in tests, but does not independently rerun those commands.

## 2. Repository structure
Primary application root:
- `inventory-api/`

Observed relevant structure:
- `src/app.js`, `src/server.js` — Express bootstrap and runtime entrypoint
- `src/routes/` — HTTP route adapters grouped by feature area
- `src/services/` — application/service layer with most business orchestration and validation
- `src/repositories/` — Prisma-backed persistence helpers
- `src/schemas/` — Zod request validation
- `src/security/`, `src/middlewares/`, `src/lib/` — auth, permission, request, and infrastructure helpers
- `src/public/root/` — root/admin SPA assets
- `src/public/warehouse/` — warehouse SPA assets
- `prisma/schema.prisma` — canonical relational model
- `prisma/migrations/` — additive SQL migrations
- `tests/` — node:test characterization, contract, migration, governance, and service tests
- `docs/` — operational, architectural, and governance documentation
- `specs/qa-rejection-material-reconciliation-amendment/` — feature specification, traceability, risks, and implementation report

## 3. Current architecture
The implemented architecture is a layered monolith, not a full hexagonal architecture.

Observed dependency flow:
- Express routes call service functions directly.
- Services coordinate validation, authorization assumptions, business rules, persistence calls, and response serialization.
- Repositories encapsulate Prisma queries/includes and are reused across services.
- Browser SPAs call the same backend routes through in-repo API wrappers.

For the production + QA area, the active architecture is:
- `production.routes.js` exposes production order, execution, QA, recolection, and reconciliation endpoints
- `recipe.service.js` persists recipe version basis plus per-stage-input `inputQuantityBasis` and serializes the same structure for UI/API consumers
- `production.service.js` creates and serializes production orders, passing `plannedUnits` into material planning for mixed-basis recipes
- `production-planning.service.js` resolves effective per-input scaling and freezes `inputQuantityBasis` into production snapshots
- `production-material-availability.service.js` resolves lot availability using per-stage-input effective basis from the frozen snapshot
- `production-execution.service.js` coordinates execution, inventory mutation, and same-lot validation gates
- `quality.service.js` coordinates QA inspections, rejection handling, relevant-input scope resolution, and optional replacement recovery creation
- `production-recolection.service.js` coordinates recolection confirmation, replacement recovery, reconciliation balance calculation, and outcome recording
- `production.repository.js` loads production orders with stage executions, recolection entries, reconciliations, and the snapshot data used by API and UI consumers

## 4. Existing domains and modules
### Identity and Access
Current code:
- `src/services/auth.service.js`
- `src/middlewares/authenticate.js`
- `src/security/access-policies.js`
- `src/security/access-policy-registry.js`

Responsibilities:
- login
- bearer-token authentication
- permission checks
- authenticated actor reloading from persistence

### Customer / Store / Root-shell Clients Admin
Current code:
- `src/routes/client.routes.js`
- `src/services/client.service.js`
- `src/repositories/client.repository.js`
- `src/public/root/clients-api.js`
- `src/public/root/views/clients-admin.js`
- `src/public/root/views/clients-admin.renderers.js`
- `src/public/root/views/clients-admin-store-dialog.js`

Current behavior:
- root-shell users can list company clients, open a contextual detail pane, create clients, update clients, deactivate clients, create stores, update store credit limits, upload client-owned documents, upload store-scoped documents after store creation, and create client references
- client document downloads continue using the existing protected backend route, but the browser adapter now consumes `{ blob, fileName, mimeType }` from `clientsApi.downloadDocument(...)`, derives a filename from `Content-Disposition` when possible, dispatches a native `<a download>` click, and revokes the `ObjectURL` after dispatch
- client document upload in the detail pane now uses a native `input[type=file]` with hidden derived `fileName`, `mimeType`, and `fileContentBase64` inputs; `clients-admin.js` performs extension/MIME checks, a 5 MB client-side size guard, and `FileReader` conversion before the unchanged payload builder submits to `POST /api/clients/:clientId/documents`
- the store creation dialog is still a browser-created native `<dialog>` backed by Leaflet and company subzone options from `GET /api/regions/company`
- when no zones/subzones are available, the store dialog now hides the unusable form and instead renders a guidance state with `Ir a Zonas` and `Refrescar zonas`; the same dialog can now re-fetch zone options in place without a full page reload
- store creation now renders a required `Moneda de crédito` select plus an optional `Límite de crédito` input, delegates payload shaping to the shared `views.clientsAdminHelpers.buildStorePayload(...)` helper, persists `currency` plus positive `creditLimit` values through `createClientStoreSchema` and `createCompanyClientStore()`, and still omits zero/blank credit values from the outbound payload
- the dynamic store dialog also supports taxpayer-assisted override billing capture and then transitions to an optional Phase 2 document-upload screen that uses `clientsApi.uploadStoreDocument(...)` against `POST /api/clients/:clientId/stores/:storeId/documents`
- client create and edit flows now use `documentType` dropdowns, economic-activity dropdowns plus hidden `economicActivityName` fields, and taxpayer lookup buttons that populate known legal/fiscal fields when the actor has the integration permission
- client create/edit payload shaping in `views.clientsAdminHelpers.buildClientPayload(...)` now includes `legalName`, `commercialName`, `province`, `canton`, and `district`, while no longer sending dead client-level `creditLimit` or `creditBalance` fields
- store cards now show `Moneda: <código>` when the persisted store has a supported currency, show `Moneda: Sin definir` for legacy `null` currency rows, and avoid inventing a default symbol in that legacy case while still rendering numeric used/available amounts safely
- stores still inherit `legalEntityId` implicitly on the backend, but the create dialog now exposes an explicit browser-side fiscal mode: inherited mode sends no override fields and override mode sends only the populated store billing values; no persisted boolean flag exists because null/empty override fields continue to mean `inherit from client`
- trade-type fields and a fuller finalized store-document lifecycle are not implemented yet

### Recipes and Product Definition
Current code:
- `src/services/recipe.service.js`
- `src/schemas/recipe.schema.js`
- root-shell recipe editor assets

Current production-related behavior:
- recipe versions expose a version-level `quantityBasis` with default `PER_OUTPUT_KG`
- recipe stage inputs expose optional `inputQuantityBasis`; `null` means inherit the version basis
- recipe stages support `stageType` = `RECOLLECTION | PROCESSING`
- processing stages require `processCode`
- `processLabel` is required only when `processCode = OTHER`
- legacy stages without `stageType` are treated as `PROCESSING` in serialization/service logic
- recipe serialization and persistence preserve `inputQuantityBasis` so browser editors, production planning, and frozen production snapshots consume the same field
- draft version approval in the root-shell UI is gated by a dedicated native `<dialog>` confirmation step before `recipesApi.approveRecipeVersion(...)` is called
- version cards can render local success/error/warning feedback plus a `Reparar borrador` CTA without changing backend payloads
- draft versions may be marked locally as incomplete in UI state when warning-level `PROCESSING` rows are saved or when approval errors indicate unresolved stage-input issues
- the version editor differentiates incomplete stage-input rows by stage type: incomplete `RECOLLECTION` rows block save, while incomplete `PROCESSING` rows warn, allow save, and keep approval blocked by backend rules until corrected

### Product Catalog Admin SPA
Current code:
- `src/public/root/views/products-admin.js`
- `src/public/root/views/products-admin.helpers.js`
- `src/public/root/views/products-admin.renderers.js`
- `tests/products-view-characterization.test.js`

Current behavior:
- the root-shell products view exposes a product form dialog and a categories dialog using native `<dialog>` elements
- the product form now supports inline subcategory creation through `#products-form-add-subcategory-button`, which opens the categories dialog stacked over the still-open product form
- focus-return tracking is maintained per dialog through `lastFormDialogTrigger`, `lastCategoriesDialogTrigger`, and `lastDeactivateDialogTrigger`
- `lastCreatedSubcategoryId` is used as consume-once UI state so the next product-create dialog can preselect a newly created subcategory after `resetFormDialog()`
- `views.productsAdminHelpers` now exports `checkSubcategoryNameDuplicate(categories, categoryId, name)` for case-insensitive, trim-normalized duplicate checks scoped to the selected parent category, with graceful fallback to backend validation when local data is unavailable
- the product-form `+ Nueva` button is visible with category-list access, opens the categories dialog as a stacked modal, and cooperates with consume-once `lastCreatedSubcategoryId` state plus per-dialog focus restoration
- the categories dialog hides the `Nueva subcategoria` fieldset for read-only users when `canCreateCategories = false`

### Inventory and Lots
Current code:
- `src/services/inventory.service.js`
- `src/services/inventory-transaction-support.service.js`
- `src/repositories/inventory.repository.js`

Responsibilities:
- warehouse stock and lot stock mutation
- lot creation/update
- stock movement recording
- transactional inventory adjustments used by production and receiving flows

### Production Execution
Current code:
- `src/services/production.service.js`
- `src/services/production-execution.service.js`
- `src/services/production-stage-validation.service.js`
- `src/repositories/production.repository.js`
- `src/routes/production.routes.js`

Responsibilities:
- production order lifecycle
- stage execution and material consumption
- loss declaration, returns, completion
- material requirement calculation using version-level and per-input quantity basis
- gating of re-execution after QA rejection
- lot-bound same-stage/recovery consumption validation when recolection entries exist
- freezing recipe stage-input basis into production order snapshots so downstream execution/availability reads do not depend on live recipe edits

### Quality / QA Rejection Handling
Current code:
- `src/services/quality.service.js`
- `src/services/quality-rejection-disposition.service.js`
- `src/services/quality-relevant-input-scope.service.js`

Current behavior:
- QA inspections can reject an executed stage
- relevant-input scope is resolved with Option A: all consumptions from prior executed stages up to and including the failed stage, excluding `INVALIDATED` executions
- rejection flow can request a posterior `REPLACEMENT_RECOVERY` recolection stage
- backward-compatible legacy behavior without replacement recovery remains in place

### Recolection / Recovery / Reconciliation
Current code:
- `src/services/production-recolection.service.js`
- `src/repositories/production.repository.js`
- warehouse SPA production state/renderers/controllers

Current behavior:
- recolection stages now have `recoveryType`
- `VIRTUAL_RECOLECTION` remains the default compatibility mode
- `REPLACEMENT_RECOVERY` is used for QA-driven replacement of damaged or missing inputs
- confirmation can persist lot-level recolection entries
- reconciliation outcomes are recorded per product + lot with `USED | RETURNED | DISCARDED`
- remaining unreconciled balances are computed from recolected minus reconciled quantities

## 5. Main use cases
Implemented and observable from code:
- create/update recipe versions with stage typing, process definition, and optional per-input quantity-basis override
- approve a draft recipe version only after an explicit irreversible-action confirmation dialog in the root-shell recipe admin UI
- repair a failed draft approval directly from version-card feedback by reopening the affected draft editor with conservative stage/input highlighting when mapping is reliable
- save a draft recipe with warning-level incomplete `PROCESSING` rows while keeping the draft visibly marked as incomplete for later repair
- create and read production orders with serialized stage executions and recolection stages
- download a client-owned document from the root-shell detail pane through the authenticated browser adapter and native browser download dispatch
- upload a client-owned document from the root-shell detail pane through a file-picker flow that derives Base64 payload fields in-browser before calling the unchanged backend endpoint
- open the store-creation dialog even when no zones exist and receive dependency guidance plus in-place zone refresh instead of a dead-end required select
- create a store through the existing backend route with a required browser-side `currency` selection, an optional create-time `creditLimit`, and an explicit inherit-vs-override billing choice, where blank and zero credit values are omitted by the shared browser payload builder before the unchanged backend route is called
- attach optional store-scoped credit-analysis documents immediately after store creation from the same dynamic dialog, using the store-scoped upload route and governed file payload fields
- populate client and store fiscal fields from taxpayer lookup results and economic-activity catalogs when permissions and catalog data are available
- calculate material requirements for mixed-basis recipes where some inputs scale by planned output kg and others by planned finished-unit count
- execute a production stage with lot-bound consumptions and wastes
- inspect a stage in QA and optionally reject it
- resolve relevant-input scope for a rejected stage, including failed-stage-without-direct-consumption scenarios
- create a replacement-recovery stage when rejection requires material replacement
- confirm a recolection/recovery stage and optionally capture product/lot/quantity entries
- block stage re-execution while required losses or pending recovery/recolection remain unresolved
- record reconciliation outcomes for recovered material
- compute order-level stage status in the warehouse SPA, including replacement recovery pending/completed states
- create a product from the root-shell products admin while opening a stacked categories dialog to register a missing subcategory inline without clearing the product form

## 6. Current data flows
### QA rejection with relevant-input scope
1. Warehouse or QA client submits `POST /api/production/orders/:id/stages/:stageId/inspections`.
2. `quality.service.js` loads the company-scoped production order and latest stage execution.
3. If the result is `REJECTED`, the service resolves `relevantInputScope` through `resolveOptionARelevantInputs`.
4. The response envelope may include `inspection`, `dispositionsSummary`, and `relevantInputScope`.
5. If `requiresReplacementStage === true`, the service can create a posterior replacement-recovery stage.

### Replacement recovery confirmation
1. Warehouse client calls `POST /api/production/orders/:id/recolections/:recolectionId/confirm`.
2. `production-recolection.service.js` validates order scope, stage ownership, and status.
3. The stage is marked `COMPLETED`.
4. If entries were provided, lot-level `production_recolection_entries` rows are created.

### Same-lot consumption gate after recovery
1. Stage execution is submitted through `POST /api/production/orders/:id/stages/:stageId/execute`.
2. `production-execution.service.js` loads the order and related completed recolection stage for that recipe stage.
3. When recolection entries exist, `assertRecolectionCoverageForConsumption` validates that proposed usage is tied to previously recolected product + lot pairs and does not exceed recovered balance.
4. Inventory reductions and movement recording continue transactionally if validation succeeds.

### Reconciliation flow
1. Warehouse client calls `POST /api/production/orders/:id/recolections/:recolectionId/reconciliation`.
2. `production-recolection.service.js` validates scope, stage state, allowed outcome catalog, and quantity limits against recolection entries.
3. Reconciliation rows are created.
4. The response includes a computed balance with `complete` and `remainingBalances`.

### Recipe mixed-basis authoring and save flow
1. Root-shell user edits a recipe version in `recipes-admin.version-editor.js`.
2. The version-level `quantityBasis` is selected once for the recipe version.
3. For COUNT/UN-like stage inputs, the UI may show a per-unit checkbox using `shouldShowPerUnitCheckbox(...)`.
4. When checked, the editor serializes `inputQuantityBasis = 'PER_FINISHED_UNIT'`; otherwise it serializes `null` so the input inherits the version basis.
5. `recipe.schema.js` validates the field as nullable `RecipeQuantityBasis` and defaults omitted values to `null`.
6. `recipe.service.js` persists the field and exposes it again in recipe serialization.

### Recipe draft approval and repair flow in root-shell
1. Root-shell user opens a recipe detail and works from the versions tab rendered by `recipes-admin.renderers.js`.
2. Clicking `Aprobar version` on a draft opens `#recipes-approval-dialog`; no approval API call is made until the user confirms.
3. `recipes-admin.js` calls `recipesApi.approveRecipeVersion(session, versionId, {})` only after the dialog confirmation action.
4. On success, the affected version card shows local success feedback and the detail/list refresh continues.
5. On failure, the affected version card shows local error feedback, preserves backend diagnostic text, and may expose `Reparar borrador` for users with manage permission.
6. If the failure message safely matches one stage name or one uniquely matched stage-input name, `recipes-admin.js` builds repair-highlight metadata and passes it into `recipes-admin.version-editor.js` when reopening the draft editor.
7. `recipes-admin.version-editor.js` highlights only the reliably matched stage or input and otherwise falls back to generic repair guidance.

### Recipe draft save flow with incomplete-row handling
1. Before payload serialization, `inspectIncompleteStageInputs()` scans stage-input rows before `collectStages()` filters rows by stage-input name.
2. Incomplete rows in `RECOLLECTION` stages are treated as blocking issues: the editor outlines the first affected row, scrolls it into view, focuses the product/name field, and aborts save.
3. Incomplete rows in `PROCESSING` stages are treated as warning issues: the editor focuses the first affected row but still builds and submits the draft payload.
4. `buildVersionPayload(...)` returns `markVersionIncomplete` and a warning message when warning-level issues were found.
5. `recipes-admin.js` stores that incomplete marker in frontend view state and the versions tab renders the saved draft as `Incompleta` until a later successful repair/save or approval clears the marker.

### Production planning snapshot and requirement flow for mixed-basis recipes
1. Production order creation resolves the version-level scaling basis through `resolveOrderScalingQuantity(...)`.
2. `production.service.js` passes both the scaling quantity and `plannedUnits` into `buildMaterialRequirements(...)`.
3. `production-planning.service.js` computes the effective basis per stage input with `resolveInputScalingQuantity(...)`.
4. Gravimetric inputs inherit or use `PER_OUTPUT_KG` and scale by `plannedOutputKg`; per-unit overrides scale by order unit count.
5. `buildRecipeVersionSnapshot(...)` freezes `inputQuantityBasis` into `recipeVersionSnapshot.recipeVersion.stages[].stageInputs[]` so later execution and availability logic remain tied to the approved planning state.

### Lot availability flow for stage inputs with per-input basis
1. Warehouse client requests available lots for a production stage.
2. `production-material-availability.service.js` reads the frozen stage inputs from the order snapshot.
3. The service derives `effectiveBasis = stageInput.inputQuantityBasis ?? versionBasis` for each input.
4. Required quantity per input is calculated by planned kg or planned units according to that effective basis.
5. FEFO/FIFO lot suggestion logic continues unchanged after the required quantity is derived.

### Product create with inline subcategory flow
1. Root-shell user opens the products admin view and launches `#products-form-dialog` from `#products-open-create-button`.
2. If the required subcategory does not exist, the user can open `#products-categories-dialog` from `#products-form-add-subcategory-button` without closing the product form.
3. `products-admin.js` keeps product-form state in place while the categories dialog is stacked with `showModal()` over the product dialog.
4. Before calling the existing category API, the categories submit handler uses `productsHelpers.checkSubcategoryNameDuplicate(...)` for local duplicate prevention within the selected parent category; if data is unavailable, the flow degrades gracefully and the backend remains the final validator.
5. After successful subcategory creation, the view stores `lastCreatedSubcategoryId`, refreshes category options, and applies the new subcategory immediately when the product form is still open.
6. When the product form is opened later from the header flow, `openFormDialog('create')` consumes `lastCreatedSubcategoryId` once after `resetFormDialog()` to preselect the newly created subcategory.
7. Closing each dialog returns focus according to the dialog-specific trigger variable rather than one shared trigger reference.

### Authenticated client-document download flow in root-shell
1. Root-shell user clicks `Descargar` in the client detail document card.
2. `clients-admin.js` disables only the clicked button, sets `Descargando...`, and calls `clientsApi.downloadDocument(session, client.id, documentId)`.
3. `clientsApi.downloadDocument(...)` performs the authenticated fetch against `GET /api/clients/:clientId/documents/:documentId/download`, reads the response as a `blob`, and returns `{ blob, fileName, mimeType }` where `fileName` is still the raw `Content-Disposition` header value.
4. `clients-admin.js` resolves a browser-safe filename, creates an `ObjectURL`, dispatches a hidden `<a download>` click, revokes the URL asynchronously, and only then renders `Descarga iniciada en el navegador.` in the detail message area.

### Client-document upload flow with file picker
1. Root-shell user selects a file from the document form in the client detail pane.
2. `clients-admin.js` validates extension/MIME compatibility and rejects files larger than 5 MB before submit.
3. While `FileReader` runs, the submit button switches to `Procesando archivo...` and hidden `fileName`, `mimeType`, and `fileContentBase64` fields are populated from the selected file.
4. The existing `buildDocumentPayload()` helper reads the same hidden field names and submits the unchanged JSON contract to `POST /api/clients/:clientId/documents`.

### Store dialog zone-refresh flow
1. `loadClients()` fetches zone/subzone data once and flattens it for the clients workspace.
2. When a user opens the store dialog with an empty `zoneOptions` snapshot, `clients-admin-store-dialog.js` renders a guidance panel instead of the form.
3. Clicking `Refrescar zonas` calls the injected async callback from `clients-admin.js`, which re-runs `clientsApi.listZones(session)` and `clientsState.flattenZoneOptions(...)`.
4. The dialog repopulates only the subregion `<select>` and reevaluates whether to keep the guidance state or restore the store form and focus the store-name field.

### Store creation flow with shared payload shaping
1. Root-shell user submits the store dialog after completing the required store fields.
2. `clients-admin-store-dialog.js` builds the outbound payload through `views.clientsAdminHelpers.buildStorePayload(...)` instead of maintaining a dialog-local payload builder.
3. The shared helper always sends `name` and numeric `subregionId`, forwards `currency` when selected, includes optional text fields only when non-empty, includes `creditLimit` only when the entered value is greater than zero, and reads `billingMode` to decide whether store fiscal override fields should travel at all.
4. In `billingMode = 'inherit'`, no override fiscal fields are added to the payload; in `billingMode = 'override'`, the helper forwards only populated values for `legalName`, `commercialName`, `legalId`, `documentType`, `emailBilling`, `economicActivityCode`, and `economicActivityName`.
5. The same dialog can expose taxpayer lookup in override mode, filling legal-name data from `GET /api/taxpayers/lookup` when the actor has permission.
6. `createClientStoreSchema` accepts `currency` only as `CRC | USD | EUR`, coerces the optional `creditLimit` to a number, validates the optional override fields, and rejects negative credit values before `client.service.js` persists the store.
7. `createCompanyClientStore()` forwards the selected `currency`, optional `creditLimit`, and any populated override fiscal fields into the existing repository create call together with the inherited `legalEntityId`, `isPrimary`, and `isActive` flags.

### Store document Phase 2 flow
1. After a successful store creation, `clients-admin-store-dialog.js` replaces the dialog body with `buildPhase2Html(...)` instead of closing immediately.
2. The Phase 2 screen collects `documentType`, file, and optional notes for store-scoped credit-analysis evidence.
3. File input handling keeps a 5 MB guard and uses `FileReader` to populate hidden `fileName`, `mimeType`, and `fileContentBase64` fields.
4. `clientsApi.uploadStoreDocument(...)` submits the governed payload to `POST /api/clients/:clientId/stores/:storeId/documents`.
5. Uploaded file names are rendered inside the same dialog until the user finishes and closes it.

### Client update and store-credit feedback flow
1. Root-shell user edits a selected client in the detail pane.
2. `clients-admin.renderers.js` now renders editable `legalName`, `commercialName`, `province`, `canton`, and `district` inputs together with the pre-existing general client fields.
3. On create/update submit, `views.clientsAdminHelpers.buildClientPayload(...)` includes those legal/geographic values when non-empty and no longer includes dead client-level `creditLimit` or `creditBalance` entries.
4. When a user saves a store credit limit from the inline store card form, `clients-admin.js` still calls the existing `clientsApi.updateStoreCreditLimit(...)` route but now renders success/error feedback through `rootShellUi.renderInlineMessage(...)` into `.clients-store-credit-msg`.
5. The renderer changed the message container to `<div class="clients-store-credit-msg" aria-live="polite">`, keeping the feedback HTML semantically valid for the shared block-level inline-message component.

## 7. Database and persistence
Primary persistence stack:
- PostgreSQL via Prisma
- `prisma/schema.prisma`
- additive migrations under `prisma/migrations/`

Feature-relevant current schema elements:
- `RecipeVersion.quantityBasis`
- `RecipeStage.stageType`
- `RecipeStage.processCode`
- `RecipeStage.processLabel`
- `RecipeStageInput.inputQuantityBasis` — nullable `RecipeQuantityBasis`; `NULL` means inherit version basis
- `ProductionRecolectionStage.recoveryType`
- `ProductionRecolectionEntry`
- `ProductionRecolectionReconciliation`
- `Client.creditLimit` — aggregate credit limit at client level (migration `20260924020000_add_credit_fields_to_client`)
- `Client.creditBalance` — aggregate credit balance at client level (same migration)
- `ClientStore.currency` — nullable per-store currency code added by migration `20261002000000_add_store_currency`; current browser create flow requires one of `CRC | USD | EUR`, but legacy rows may still remain `NULL`
- `ClientStore.legalName`, `commercialName`, `legalId`, `documentType`, `emailBilling`, `economicActivityCode`, `economicActivityName` — nullable store fiscal override fields added by migration `20261002001000_add_store_billing_fields`; `NULL`/omission currently represents inherit-from-client semantics
- `ClientStore.creditLimit` — per-store credit limit
- `ClientStore.creditBalance` — per-store credit balance
- `ClientDocument.storeId` — nullable association used by the current store-scoped document upload route so store documents reuse the same governed document persistence model

Feature-relevant migrations observed:
- `20260923001000_recolection_entry_and_reconciliation/`
  - adds `production_recolection_stages.recovery_type`
  - creates `production_recolection_entries`
  - creates `production_recolection_reconciliations`
- `20260926000000_add_recipe_stage_input_quantity_basis/`
  - adds nullable `recipe_stage_inputs.input_quantity_basis`
  - reuses existing `RecipeQuantityBasis` enum instead of creating a new type
- `20261002000000_add_store_currency/`
  - adds nullable `client_stores.currency`
  - preserves backward compatibility for pre-existing store rows by leaving legacy data nullable
- `20261002001000_add_store_billing_fields/`
  - adds seven nullable store fiscal override columns on `client_stores`
  - preserves inherit-from-client behavior by keeping those new fields nullable

Current persistence behavior:
- recipe version writes persist `inputQuantityBasis` per stage input when provided and store `null` when the input should inherit the version basis
- recipe serialization exposes `inputQuantityBasis` back to API consumers and browser editors
- production order snapshots freeze `inputQuantityBasis` for each stage input so planning/execution semantics remain stable even if the recipe version changes later
- production orders are loaded with stage executions, lot references, QA inspections, losses, recolection stages, recolection entries, and reconciliations
- company scoping is applied in production order lookups used by production/quality services
- inventory mutation still occurs in explicit Prisma transactions

## 8. APIs and integrations
Feature-relevant API endpoints currently implemented:
- `POST /api/production/orders/:id/stages/:stageId/inspections`
- `POST /api/production/orders/:id/recolections/:recolectionId/confirm`
- `POST /api/production/orders/:id/recolections/:recolectionId/reconciliation`
- `GET /api/production/orders/:id`
- `GET /api/production/orders`
- `GET /api/clients/:id/ledger` — exposes `client.creditLimit` and `client.creditBalance` (TASK-015 cycle)
- `POST /api/clients/company/:clientId/stores` — existing store-create route; current implementation accepts `currency`, optional `creditLimit`, and additive nullable store fiscal override fields while still creating stores against the client's legal entity without a new contract version
- `POST /api/clients/:clientId/stores/:storeId/documents` — active governed store-document upload route; current implementation validates store ownership/activity, reuses the client-document payload contract, and persists the document with a `storeId` association
- `POST /api/clients/:clientId/documents` — unchanged high-payload JSON upload contract for client-owned documents
- `GET /api/clients/:clientId/documents/:documentId/download` — unchanged protected backend download route; the current implementation change is in the root-shell browser adapter, not in the route/service contract
- `GET /api/regions/company` — existing zone/subzone catalog used by the store dialog and re-fetched in place through the browser adapter callback
- `GET /api/taxpayers/lookup?identification=...` — existing authenticated taxpayer lookup adapter registered in `clientsApi` and now consumed by current client/store billing flows when permissions allow it
- `GET /api/economic-activities` — existing catalog endpoint registered in `clientsApi` and now loaded by the clients workspace at mount time to populate create/edit economic-activity dropdowns
- TASK-008 introduced no backend route, schema, or migration change; later TASK-009/TASK-012 did add an active store-document route plus adapter/UI wiring, while `create-product-with-subcategory` stayed entirely frontend-only
- existing root-shell product/category endpoints consumed by `products-admin.js` remained unchanged for `create-product-with-subcategory`; the implementation uses the already-registered `productsApi` and `categoriesApi` browser adapters rather than new backend contracts
- `recipe-approval-ux` reuses the existing `POST /api/recipes/versions/:id/approve` route and does not add recipe approval payload fields, database writes beyond the existing approval transition, or external integrations

Credit balance lifecycle (TASK-015):
- `paymentService.approvePayment` decrements `Client.creditBalance` via `tx.client.update` inside the Prisma transaction
- `paymentService.reversePayment` increments `Client.creditBalance` symmetrically
- Per-store `ClientStore.creditBalance` is also updated when the invoice is linked to an order with a `clientStoreId`

Current contract behavior:
- production routes are authenticated and permission-guarded through `authorizeAccessPolicy`
- recipe create/update payloads accept `stageInputs[].inputQuantityBasis` as nullable `RecipeQuantityBasis`, defaulting to `null` when omitted
- recipe read models expose `stages[].stageInputs[].inputQuantityBasis`
- production order serialization includes `recolectionStages`, each with `entries` and `reconciliations`
- production planning and lot-availability consumers read per-input basis from the persisted/frozen recipe structures rather than inventing local defaults beyond the documented inheritance fallback
- QA inspection route preserves backward compatibility: when no disposition summary and no relevant-input scope exist, the route returns the inspection object; otherwise it returns the richer envelope

External integration posture in this feature area:
- none added; this amendment stays within production, quality, inventory, Prisma, and warehouse/root-shell UI layers
- the create-product-with-subcategory implementation is frontend-only and does not add backend, database, or infrastructure integrations

## 9. Authentication and authorization
Observed current behavior:
- production and quality endpoints require authenticated actors
- access is permission-based, for example `production.execute`, `production.view`, `production.manage`, `quality.inspect`, and `quality.view`
- production/quality services derive company scope from `auth.companyId`
- feature-relevant writes reject access when the actor lacks company association

## 10. Events and background processing
Observed current implementation:
- no domain-event bus
- no async worker or broker for this feature
- replacement recovery and reconciliation are handled synchronously during request/response

## 11. Containers and deployment
Observed runtime/container baseline:
- `Dockerfile` is multi-stage
- runtime image uses `node:24-bullseye-slim`
- runtime switches to non-root user `inventory`
- healthcheck targets `/health/ready`
- dev compose file is explicitly marked dev-only and includes Postgres and Redis health checks

## 12. Current testing strategy
Observed automated testing baseline:
- extensive `node:test` suite under `tests/`
- migration, schema, service, SPA characterization, governance, and runtime contract tests exist
- `package.json` includes `test`, `lint`, `typecheck`, `build`, and `verify` scripts

Feature-specific tests present:
- `tests/quality-relevant-input-scope.service.test.js`
- `tests/qa-rejection-material-reconciliation-migration.test.js`
- `tests/production-same-lot-validation.service.test.js`
- `tests/production-replacement-recovery-gate.test.js`
- `tests/production-reconciliation-outcomes.service.test.js`
- `tests/production-planning.service.test.js` covers effective per-input basis resolution, snapshot freezing of `inputQuantityBasis`, mixed-basis material requirement calculation, and backward-compatible inheritance behavior
- `tests/production-material-availability.service.test.js` covers per-input lot scaling by planned units vs planned output kg and legacy fallback when `inputQuantityBasis` is absent
- `tests/products-view-characterization.test.js` covers `views.productsAdminHelpers`, renderer/state behavior, `checkSubcategoryNameDuplicate`, and `products-admin.render()` markup for the subcategory label, inline add button, and create-subcategory fieldset contract
- `tests/root-shell-recipes-admin-view-characterization.test.js` now covers the approval confirmation dialog seam, local version-card feedback rendering, incomplete-draft marker rendering, approval gating hooks, and incomplete-row / repair-highlight hooks in `recipes-admin.version-editor.js`
- `tests/clients-view-characterization.test.js` covers the current root-shell client detail document-download seam, file-picker document form contract, `FileReader` usage, 5 MB client-side guard, shared-helper integration seams expected by the root-shell clients workspace, editable `legalName`/`commercialName`/`province`/`canton`/`district` client fields, document-type and economic-activity dropdown markup, dead-field removal from `buildClientPayload()`, taxpayer lookup adapter usage, and `renderInlineMessage` usage for store-credit save feedback
- `tests/clients-store-map-characterization.test.js` covers the store-dialog missing-zones guidance state, `refreshZones` callback contract, in-place subregion-option refresh behavior, store-dialog delegation to the shared payload helper, and the source-level Phase 2 store-document upload seam (`enterPhase2`, `uploadStoreDocument`, 5 MB guard, FileReader)
- `tests/client-store-credit-limit.test.js` covers create-store schema validation for `currency`, coercion/rejection for `creditLimit`, and `client.service.js` persistence of create-time `currency` + `creditLimit`
- `tests/client-store-fiscal-overrides.test.js` covers schema acceptance of the seven optional store fiscal override fields, invalid override billing email rejection, service persistence of populated override fields, and omit-as-inherit semantics when those fields are absent
- `tests/clients-view-characterization.test.js` now also covers `Usado` / `Disponible` rendering, `Sin límite configurado`, the null-currency-safe fallback (`Moneda: Sin definir` with symbol-free amounts) for legacy store rows, and the store-card fiscal-summary copy for inherited vs override billing
- the user-provided implementation validation for `recipe-approval-ux` reports `node --test tests/root-shell-recipes-admin-view-characterization.test.js tests/recipe-service-foundation.test.js tests/recipe-schema.test.js` as pass (72/72), plus `npm run lint` pass and `npm run typecheck` pass
- the user-provided implementation validation for `client-store-documents-credit-ux` now includes TASK-009/TASK-012 state in the repository code, while the latest explicit targeted evidence still names the earlier client-focused suite (`43/43`) plus lint/typecheck/build/prisma checks from prior subtasks

Evidence available in repository docs:
- `specs/qa-rejection-material-reconciliation-amendment/implementation-report.md` records command results for targeted tests and a full suite pass after implementation
- the user request for `create-product-with-subcategory` reports `tests/products-view-characterization.test.js` as 9 pass, 0 fail after adding duplicate-helper and render-contract assertions
- the user request for this documentation refresh also reports 1600 tests pass, 0 fail, with `npm run typecheck` and `npm run lint` passing for the current repository state

This document records that evidence as repository/user-reported validation. It does not independently re-execute the test suite.

## 13. Behavior to preserve
- company-scoped production and QA lookups
- recipe stage inputs with `inputQuantityBasis = null` must remain backward-compatible and inherit `RecipeVersion.quantityBasis`
- per-input overrides must be frozen into production order snapshots so later recipe edits do not change existing order planning semantics
- mixed-basis material requirement and lot-availability calculations must scale each stage input by its own effective basis, not by a single version-wide assumption
- approved recipe versions remain immutable and root-shell approval must continue to use the existing backend approval route and business-rule validation as the authority
- incomplete `RECOLLECTION` stage-input rows must continue blocking draft save, while incomplete `PROCESSING` rows may warn and save but must remain visible as approval-blocking draft debt in the UI
- approval success/failure feedback should remain tied to the triggering version-card context rather than regressing to only page-level or distant detail-panel messaging
- additive compatibility with legacy `VIRTUAL_RECOLECTION`
- QA rejection handling that can continue returning the legacy simple inspection object when no enriched envelope is needed
- stage re-execution gating on losses acknowledgment and pending recovery/recolection resolution
- transactional inventory reductions and movement recording during production execution
- same-lot validation only when actual recolection entries exist, preserving legacy compatibility for older flows
- production order read model including recolection stages, entries, and reconciliations
- in the root-shell products admin, inline subcategory creation must preserve the product-form data while the categories dialog is stacked, `lastCreatedSubcategoryId` must remain consume-once for create mode, and focus return must remain dialog-specific
- `clientsApi.downloadDocument(...)` must remain backward-compatible with the existing protected backend route and continue returning the browser adapter metadata currently expected by `clients-admin.js`
- the client document form must preserve the existing backend payload shape (`fileName`, `mimeType`, `fileContentBase64`) even though those values are now derived from a file picker instead of visible text fields
- the store dialog must continue to tolerate an empty zone catalog by showing guidance instead of an unusable required select, and any zone refresh must remain in-dialog without forcing a full root-shell reload
- store-document uploads must continue using the same governed payload fields (`fileName`, `mimeType`, `fileContentBase64`) already used by client-document uploads, even though the target route is store-scoped
- create-store requests must continue using the existing store-create contract, now with browser-side currency restricted to `CRC | USD | EUR`, optional create-time `creditLimit`, and optional store fiscal override fields, with blank or `0` credit input omitted by the shared payload helper and negative values rejected server-side
- client create/update payloads must continue excluding client-level `creditLimit` and `creditBalance`, because credit ownership is currently store-level in the active onboarding model
- the client detail pane must continue exposing editable `legalName`, `commercialName`, `province`, `canton`, and `district` fields and keep store-credit save feedback on the shared inline-message pattern inside the `aria-live` credit message container
- store-card credit summaries must remain null-currency-safe for legacy rows: supported currencies render their symbol, while persisted `NULL` currency renders `Moneda: Sin definir` and symbol-free `Usado` / `Disponible` values instead of silently defaulting to `CRC`
- store fiscal override semantics must remain null-as-inherit compatible: when override fields are omitted the store continues inheriting the client fiscal profile, and when override fields are populated the current dialog/store-card summary behavior must remain additive over the existing create-store contract

## 14. Known defects
`AUD-004` and `AUD-005` are reported as corrected by the implemented `recipe-input-per-unit-basis` slice and related defect fixes. This refresh therefore does not list them as active defects.

### DEF-PRD-002 Manual end-to-end evidence gap for amended warehouse flow — Medium
Observed in repository evidence:
- implementation report lists manual validation as pending for replacement recovery, reconciliation, and recipe-editor UX
- automated service and migration tests exist, but the repository does not include completed manual evidence for the full operator flow

Impact:
- implementation is test-backed but operational completeness should not be overstated

### DEF-CLI-001 Client/store onboarding feature remains partially implemented — Medium
Observed in current code:
- current repository state includes TASK-001 through TASK-012 level changes across the clients workspace, including taxpayer lookup buttons, economic-activity dropdowns, and Phase 2 optional store-document upload
- despite that progress, trade-type fields, fuller constrained fiscal catalogs, and a more complete finalized store-document workflow are still absent from the canonical runtime code

Impact:
- the most visible document, zone-navigation, create-time store-credit, store-currency, store-fiscal-mode, taxpayer-assist, and store-document route gaps have narrowed, but the end-to-end onboarding specification is not yet complete

### DEF-CLI-002 Manual browser evidence is still pending for the new client/store UX seams — Low
Observed in repository evidence:
- automated characterization covers source/markup seams for native download dispatch, file-picker upload, and zone refresh
- manual confirmation is still missing for actual browser save behavior, real file selection/submission, popup behavior for `Ir a Zonas`, and real cross-module zone creation followed by in-dialog refresh

Impact:
- current implementation confidence is good for adapter seams, but browser/runtime behavior should remain described conservatively

## 15. Architectural debt
- service layer still mixes orchestration, business rules, persistence, and response shaping
- effective quantity-basis resolution is currently implemented in multiple places (`recipe.service.js`, `production-planning.service.js`, `production-material-availability.service.js`, and browser helpers/views) rather than behind one shared domain policy module
- production, quality, recipe, and inventory concerns are logically separated but not isolated as explicit ports/adapters or domain modules
- `recolection` legacy spelling remains in routes, schema, services, and persistence for compatibility
- relevant-input scope is computed on demand rather than stored as a persisted immutable rejection snapshot
- warehouse and root-shell UIs remain large browser scripts coupled to backend DTOs
- the recipe-admin incomplete draft marker is currently frontend-managed ephemeral state rather than a backend-persisted recipe-version attribute
- recipe repair guidance depends partly on conservative parsing of backend-authored error text, which keeps validation authority server-side but couples highlight affordances to message wording
- `clients-admin.js` and `clients-admin-store-dialog.js` remain large page/controller adapters that mix DOM orchestration, local state, async API calls, and UX policy details such as download filename resolution, file validation, FileReader conversion, zone-refresh state toggling, billing-mode switching, inherited-summary rendering, dialog lifecycle behavior, inline credit-feedback orchestration, taxpayer lookup, and Phase 2 store-document upload transitions
- `clients-admin-store-dialog.js` no longer owns a duplicate store payload builder, and `buildClientPayload()` no longer carries dead credit fields, but the browser layer still relies on one broad shared helper module rather than smaller focused form/adapter components
- store currency is browser-required but database-nullable for backward compatibility, so the current adapter/rendering layer must continue handling legacy `null` currency rows explicitly until a future backfill or stricter persistence policy is approved
- the FileReader-based governed-upload pattern now exists in both `src/public/agent/views/payment.js` and `src/public/root/views/clients-admin.js`, and now also appears in the store-dialog Phase 2 flow in `src/public/root/views/clients-admin-store-dialog.js`, without a shared browser helper module

## 16. Security risks
### Medium
- the amended production flow is company-scoped and permission-gated, but the broader application still depends heavily on service-layer scope enforcement rather than explicit domain/application boundaries
- manual validation evidence for the QA rejection/replacement workflow is incomplete in repository documentation

### Low
- no new external integration or async surface was introduced by this feature, limiting incremental attack surface in this amendment

## 17. Unknowns and assumptions
Unknown from repository inspection alone:
- whether warehouse operators have completed live/manual validation of the full rejected-stage replacement and reconciliation workflow
- whether any shared-environment legacy `client_stores` rows still hold `NULL` currency after the additive TASK-006 rollout beyond the characterized renderer fallback
- whether all existing client consumers are already adapted to the enriched QA inspection envelope in real deployments
- whether the new Phase 2 store-document upload flow has been manually confirmed end to end in real browsers after store creation
- whether relevant-input scope should remain computed dynamically or eventually be persisted for audit replay stability
- whether all supported user browsers in deployed environments satisfy the native stacked-`<dialog>` compatibility note now documented in `README.md`
- whether any external/reporting consumers outside the repository read recipe stage inputs and need explicit release communication about the new `inputQuantityBasis` field
- whether supported deployed browsers have been manually validated for focus return, scroll-to-feedback, and dialog cancellation behavior in the new recipe approval confirmation flow
- whether the native browser download flow has been manually confirmed across supported browsers and operating-system download settings for protected client documents
- whether `window.open('#zones', '_blank', 'noopener')` behaves consistently enough in supported browsers or needs a different navigation affordance after real manual testing
- whether the client-store onboarding users require additional backend validation or API refinements once the remaining client fiscal, trade-type, and store-document requirements are implemented

Assumptions used in this refresh:
- implementation status is taken from the checked-in specification docs, repository code/tests, and the user-provided validation summary
- earlier targeted client-slice validation evidence (`43/43`, lint, typecheck, baseline audit 9.4/10) is recorded as user-provided / audit-reported evidence and was not independently re-executed during this refresh
- the broader validation summary for the current repository state (`1600` tests passing, `0` failing, plus lint and typecheck passing) is also treated as user-reported evidence and was not independently rerun during this refresh
- documentation intentionally avoids claiming full operational completeness beyond the automated and recorded evidence currently present
- the browser compatibility note in `README.md` is treated as the current source of truth for stacked-dialog expectations in the products admin UI

## 18. Documentation governance
The canonical runtime-contract governance lives under `docs/**`. This includes `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/audit/`. Documentation ownership boundaries are defined in `docs/documentation-ownership-map.md`. CI workflow definitions live under `../.github/workflows/**` and are the authoritative hosted source consumed by workflow-baseline validators.

authoritative hosted workflow location for local validators/tests: `../.github/workflows/`. Governance and characterization tests read CI workflow truth from that parent-root directory.

Runtime company-role update flow now exists. The `PUT /api/roles/company/:roleId` endpoint and the full company-role list/create/update flows are implemented and documented.

This feature area reflects bounded coverage of QA rejection flows. partial coverage of edge cases may remain pending future integration tests. Documentation operates under the p34-bounded-governance-coverage-expansion posture.

## 19. Cross-cutting security follow-up
Browser session security hardening (HTTPS enforcement, secure-cookie transport, token-over-HTTPS) is tracked as a residual risk and follow-up dependency under `specs/p11-https-browser-session-migration/`. This is not an in-slice blocker for the currently implemented feature and must be addressed separately when HTTPS infrastructure is fully in place.
