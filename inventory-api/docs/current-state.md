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

User-reported post-implementation status for this slice: lint has 0 warnings, typecheck has 0 errors, the automated suite passed 140/140 tests, and audit findings `AUD-004` and `AUD-005` are reported as corrected. This refresh records that reported state but does not independently rerun those commands.

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
- `ClientStore.creditLimit` — per-store credit limit
- `ClientStore.creditBalance` — per-store credit balance

Feature-relevant migrations observed:
- `20260923001000_recolection_entry_and_reconciliation/`
  - adds `production_recolection_stages.recovery_type`
  - creates `production_recolection_entries`
  - creates `production_recolection_reconciliations`
- `20260926000000_add_recipe_stage_input_quantity_basis/`
  - adds nullable `recipe_stage_inputs.input_quantity_basis`
  - reuses existing `RecipeQuantityBasis` enum instead of creating a new type

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
- the user-provided implementation validation for `recipe-approval-ux` reports `node --test tests/root-shell-recipes-admin-view-characterization.test.js tests/recipe-service-foundation.test.js tests/recipe-schema.test.js` as pass (72/72), plus `npm run lint` pass and `npm run typecheck` pass

Evidence available in repository docs:
- `specs/qa-rejection-material-reconciliation-amendment/implementation-report.md` records command results for targeted tests and a full suite pass after implementation
- the user request for `create-product-with-subcategory` reports `tests/products-view-characterization.test.js` as 9 pass, 0 fail after adding duplicate-helper and render-contract assertions

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
- in the root-shell products admin, inline subcategory creation must preserve the product-form data while the categories dialog is stacked, and focus return must remain dialog-specific

## 14. Known defects
`AUD-004` and `AUD-005` are reported as corrected by the implemented `recipe-input-per-unit-basis` slice and related defect fixes. This refresh therefore does not list them as active defects.

### DEF-PRD-002 Manual end-to-end evidence gap for amended warehouse flow — Medium
Observed in repository evidence:
- implementation report lists manual validation as pending for replacement recovery, reconciliation, and recipe-editor UX
- automated service and migration tests exist, but the repository does not include completed manual evidence for the full operator flow

Impact:
- implementation is test-backed but operational completeness should not be overstated

## 15. Architectural debt
- service layer still mixes orchestration, business rules, persistence, and response shaping
- effective quantity-basis resolution is currently implemented in multiple places (`recipe.service.js`, `production-planning.service.js`, `production-material-availability.service.js`, and browser helpers/views) rather than behind one shared domain policy module
- production, quality, recipe, and inventory concerns are logically separated but not isolated as explicit ports/adapters or domain modules
- `recolection` legacy spelling remains in routes, schema, services, and persistence for compatibility
- relevant-input scope is computed on demand rather than stored as a persisted immutable rejection snapshot
- warehouse and root-shell UIs remain large browser scripts coupled to backend DTOs
- the recipe-admin incomplete draft marker is currently frontend-managed ephemeral state rather than a backend-persisted recipe-version attribute
- recipe repair guidance depends partly on conservative parsing of backend-authored error text, which keeps validation authority server-side but couples highlight affordances to message wording

## 16. Security risks
### Medium
- the amended production flow is company-scoped and permission-gated, but the broader application still depends heavily on service-layer scope enforcement rather than explicit domain/application boundaries
- manual validation evidence for the QA rejection/replacement workflow is incomplete in repository documentation

### Low
- no new external integration or async surface was introduced by this feature, limiting incremental attack surface in this amendment

## 17. Unknowns and assumptions
Unknown from repository inspection alone:
- whether warehouse operators have completed live/manual validation of the full rejected-stage replacement and reconciliation workflow
- whether all existing client consumers are already adapted to the enriched QA inspection envelope in real deployments
- whether relevant-input scope should remain computed dynamically or eventually be persisted for audit replay stability
- whether all supported user browsers in deployed environments satisfy the native stacked-`<dialog>` compatibility note now documented in `README.md`
- whether any external/reporting consumers outside the repository read recipe stage inputs and need explicit release communication about the new `inputQuantityBasis` field
- whether supported deployed browsers have been manually validated for focus return, scroll-to-feedback, and dialog cancellation behavior in the new recipe approval confirmation flow

Assumptions used in this refresh:
- implementation status is taken from the checked-in specification docs, repository code/tests, and the user-provided validation summary
- documentation intentionally avoids claiming full operational completeness beyond the automated and recorded evidence currently present
- the browser compatibility note in `README.md` is treated as the current source of truth for stacked-dialog expectations in the products admin UI

## 18. Documentation governance
The canonical runtime-contract governance lives under `docs/**`. This includes `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/audit/`. Documentation ownership boundaries are defined in `docs/documentation-ownership-map.md`. CI workflow definitions live under `../.github/workflows/**` and are the authoritative hosted source consumed by workflow-baseline validators.

authoritative hosted workflow location for local validators/tests: `../.github/workflows/`. Governance and characterization tests read CI workflow truth from that parent-root directory.

Runtime company-role update flow now exists. The `PUT /api/roles/company/:roleId` endpoint and the full company-role list/create/update flows are implemented and documented.

This feature area reflects bounded coverage of QA rejection flows. partial coverage of edge cases may remain pending future integration tests. Documentation operates under the p34-bounded-governance-coverage-expansion posture.

## 19. Cross-cutting security follow-up
Browser session security hardening (HTTPS enforcement, secure-cookie transport, token-over-HTTPS) is tracked as a residual risk and follow-up dependency under `specs/p11-https-browser-session-migration/`. This is not an in-slice blocker for the currently implemented feature and must be addressed separately when HTTPS infrastructure is fully in place.
