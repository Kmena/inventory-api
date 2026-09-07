# Architecture
## 1. Purpose and scope
This document describes the architecture currently implemented in the repository, with emphasis on the active production, QA, recipe, customer/client, warehouse-browser, and root-shell browser flows after the `qa-rejection-material-reconciliation-amendment`, `recipe-input-per-unit-basis`, `recipe-approval-ux`, `create-product-with-subcategory`, and the currently partial `client-store-documents-credit-ux` implementation through TASK-008.

It documents current reality only: active runtime components, current boundaries, dependency rules in effect, and architectural limitations still present.

## 2. Current active architecture summary
The application is an Express + Prisma modular monolith with browser SPAs served from the same runtime.

Active production/quality architecture is layered:
- HTTP input adapters in `src/routes/production.routes.js`
- request validation with Zod in `src/schemas/production.schema.js` and `src/schemas/quality.schema.js`
- application/service orchestration in `src/services/production.service.js`, `production-execution.service.js`, `quality.service.js`, and `production-recolection.service.js`
- persistence adapters in `src/repositories/production.repository.js` and `inventory.repository.js`
- browser input adapters in `src/public/warehouse/` and `src/public/root/`

The recent amendments did not introduce a full hexagonal module split. They extended the existing layering with clearer service/UI seams:
- a dedicated relevant-input scope resolver
- dedicated recolection/reconciliation service logic
- repository includes for recolection entries and reconciliations
- SPA state/rendering support for replacement recovery and reconciliation
- recipe stage-input support for per-input quantity-basis override persisted in Prisma and exposed through recipe serialization
- production-planning and material-availability logic that resolve an effective basis per stage input from frozen recipe snapshots
- root-shell product-admin support for stacked native dialogs during inline subcategory creation
- browser helper export of `checkSubcategoryNameDuplicate(...)` for local UX validation ahead of the unchanged backend category API
- root-shell recipe-admin UX guidance for operational `quantityBasis`, COUNT/UN discovery, per-unit override controls, review badges, explicit approval confirmation, action-local version feedback, frontend-managed incomplete draft markers, and conservative repair highlighting
- root-shell clients-admin browser changes that keep the backend client-document API unchanged while moving document download and upload usability concerns into the browser adapter layer
- shared browser payload shaping for store creation, with the dialog delegating store payload normalization to `views.clientsAdminHelpers.buildStorePayload(...)` and the backend create-store contract now accepting store `currency`, optional create-time `creditLimit`, and additive nullable store fiscal override fields
- client payload shaping in the same browser helper now excludes dead client-level credit fields and includes the backend-supported legal/geographic fields exposed in the client edit form

## 3. Active architectural style and module boundaries
### Runtime style
- single deployable monolith
- Express routes per feature area
- service layer as primary business orchestration boundary
- Prisma repositories as data-access layer
- static/browser assets delivered from the same process

### Active module boundaries in practice
Logical module groupings currently in effect:
- Identity & Access
- Customer / Company / Roles / Users
- Products / Recipes
- Inventory / Warehouses / Lots
- Production / QA
- Procurement / Receipts
- Sales / Orders / Billing / Payments
- Root-shell browser views and helpers

For the amended feature set, the most relevant boundary is the Recipes + Production + QA cluster:
- recipe definitions provide version-level and per-stage-input quantity basis metadata
- production planning consumes recipe metadata and freezes it into production-order snapshots
- production execution consumes inventory and records stage facts
- material-availability resolution reads the frozen stage-input basis from the order snapshot
- QA rejection evaluates completed executions
- recolection/recovery closes the loop before re-execution

These are separate files and services, but still part of one tightly-coupled application layer rather than isolated bounded-context packages.

## 4. Current domain map
| Domain | Current responsibility | Main code locations |
|---|---|---|
| Identity & Access | authentication, actor reload, permission enforcement | `src/services/auth.service.js`, `src/middlewares/`, `src/security/` |
| Customers / Client Admin | company-scoped clients, stores, client-owned documents, create-time store currency + creditLimit support, create-time store fiscal inherit/override mode, editable client legal/geographic fields, shared client/store browser payload shaping, store credit updates, root-shell client workspace, Leaflet-backed store dialog | `src/routes/client.routes.js`, `src/services/client.service.js`, `src/repositories/client.repository.js`, `src/public/root/clients-api.js`, `src/public/root/views/clients-admin*.js` |
| Recipes | recipe versions, version-level quantity basis, per-stage-input basis override, stage typing, process-code validation | `src/services/recipe.service.js`, `src/schemas/recipe.schema.js`, root-shell recipe editor |
| Inventory | lots, warehouse balances, stock mutation, movement audit | `src/services/inventory*.js`, `src/repositories/inventory.repository.js` |
| Production | orders, planned-output scaling, material requirements, stage executions, losses, returns, completion | `src/services/production*.js`, `src/routes/production.routes.js` |
| Quality | inspections, rejection handling, relevant-input scope, continuation rules | `src/services/quality*.js` |
| Recolection / Recovery | pending recovery gates, lot-level entry capture, reconciliation outcomes | `src/services/production-recolection.service.js`, `src/repositories/production.repository.js` |
| Warehouse UI | operator-facing rendering and controller wiring for execution, QA, recovery, reconciliation | `src/public/warehouse/` |
| Root-shell Product Admin UI | product listing/detail, product form dialog, categories dialog, inline subcategory creation, local duplicate validation | `src/public/root/views/products-admin*.js` |
| Root-shell Recipe Admin UI | recipe listing/detail, version editor, operational quantity-basis guidance, COUNT/UN discovery filters, review badges, approval confirmation, local version-card feedback, incomplete draft markers, repair highlighting | `src/public/root/views/recipes-admin*.js` |

## 5. Current runtime components and responsibilities
### `client.routes.js`
Responsibilities:
- mounts company-scoped client CRUD, store creation, store credit-limit update, client reference creation, and protected client-document download/upload endpoints
- enforces authentication, access policy, and payload validation before delegating to `client.service.js`
- keeps the existing client-document upload and download route contracts stable while frontend UX evolves independently

### `client.service.js`
Responsibilities:
- coordinates company-scoped client and store operations
- validates company ownership for client/store/document access
- persists client-owned documents and writes protected files to private storage
- keeps store creation tied to the client legal entity while now accepting store `currency`, optional create-time `creditLimit`, and additive nullable fiscal override fields; separate credit-limit updates remain available as a follow-up use case for existing stores
- preserves current inherit semantics by omitting store override columns when the dialog remains in inherited billing mode instead of persisting a separate inheritance flag
- continues accepting client legal/geographic fields already supported by the backend update path; TASK-008 changed only the browser adapters and helper payload shaping, not the service contract itself

### Root-shell clients admin SPA components
Relevant files:
- `src/public/root/clients-api.js`
- `src/public/root/views/clients-admin.js`
- `src/public/root/views/clients-admin.renderers.js`
- `src/public/root/views/clients-admin-store-dialog.js`

Responsibilities:
- render the client workspace list/detail shell, client document form, and store cards
- translate the protected document download response into a native browser download using `blob` + `ObjectURL` + temporary `<a download>` dispatch
- derive `fileName`, `mimeType`, and `fileContentBase64` from a user-selected file before calling the unchanged client-document upload route
- create the store dialog dynamically, hide the unusable form when no zones exist, support in-place zone refresh via an injected browser callback, delegate store payload shaping to the shared clients-admin helper registry entry, expose inherit-vs-override fiscal mode with an inherited summary panel, render editable client legal/geographic fields in the detail pane, and render legacy-null-safe store credit summaries plus compact inherited/override fiscal summaries and inline store-credit feedback in store cards

### `production.routes.js`
Responsibilities:
- mounts production order lifecycle endpoints
- mounts stage execution, losses, returns, inspections, recolection confirm, and reconciliation endpoints
- enforces authentication, access policy, and payload validation before delegating to services

### `quality.service.js`
Responsibilities:
- creates QA inspection records
- branches approved vs rejected flow
- resolves Option A relevant-input scope for rejected stages
- coordinates continuation and invalidation logic
- optionally triggers creation of a `REPLACEMENT_RECOVERY` stage

### `quality-relevant-input-scope.service.js`
Responsibilities:
- pure resolver for relevant-input material scope
- includes all non-invalidated prior executed-stage consumptions up to the failed stage
- reports whether the failed stage had direct consumptions

### `production-stage-validation.service.js`
Responsibilities:
- prerequisite gates for stage execution and re-execution
- pending recolection vs replacement-recovery blocking logic
- override-related validation
- same-lot recolection-before-use coverage validation when lot-level entries exist

### `production-planning.service.js`
Responsibilities:
- builds production-order recipe snapshots
- freezes `quantityBasis` and `stageInputs[].inputQuantityBasis` into `recipeVersionSnapshot`
- resolves effective scaling quantity per stage input through `resolveInputScalingQuantity(...)`
- aggregates material requirements for mixed-basis recipes while preserving legacy inheritance behavior

### `production-execution.service.js`
Responsibilities:
- transactional execution of stage consumptions/waste
- reads completed recolection stages and applies same-lot gate before inventory mutation
- records stage execution facts and stock movements

### `production-recolection.service.js`
Responsibilities:
- confirms recolection stages
- persists lot-level entries when supplied
- creates replacement recovery stages idempotently
- records reconciliation outcomes
- computes unreconciled balances
- serializes recolection stages for API responses

### `production-material-availability.service.js`
Responsibilities:
- derives lot-level material availability for a production stage
- reads `stageInputs` from the frozen recipe snapshot
- computes `effectiveBasis = inputQuantityBasis ?? versionBasis` per stage input before FEFO/FIFO suggestion logic

### `production.repository.js`
Responsibilities:
- company-scoped production order lookup
- eager loading of stage executions, recolection stages, entries, reconciliations, QA inspections, and lot references
- persistence helpers for recolection entries and reconciliation rows

### Warehouse SPA components
Relevant files:
- `src/public/warehouse/api/warehouse-api.js`
- `src/public/warehouse/views/production.state.js`
- `src/public/warehouse/views/production.renderers.js`
- `src/public/warehouse/views/production.renderers.rejection.js`
- `src/public/warehouse/views/production.controllers.js`

Responsibilities:
- render stage cards and recovery/reconciliation UI
- call QA inspection, recolection confirmation, and reconciliation endpoints
- derive replacement-recovery pending/completed states in browser state logic

### Root-shell product admin SPA components
Relevant files:
- `src/public/root/views/products-admin.js`
- `src/public/root/views/products-admin.helpers.js`
- `src/public/root/views/products-admin.renderers.js`
- `src/public/root/categories-api.js`
- `src/public/root/products-api.js`

Responsibilities:
- render the products list, detail pane, product form dialog, deactivate dialog, and categories dialog
- allow inline subcategory creation from within the product form through a second stacked native `<dialog>`
- keep dialog trigger state per modal via `lastFormDialogTrigger`, `lastCategoriesDialogTrigger`, and `lastDeactivateDialogTrigger` for focus restoration when dialogs stack
- export reusable browser helper logic via `rootShell.register('views.productsAdminHelpers', ...)`, including `checkSubcategoryNameDuplicate(categories, categoryId, name)`
- perform local duplicate prevention as a UX optimization only; backend category creation remains the authoritative integrity boundary

### Root-shell recipe admin SPA components
Relevant files:
- `src/public/root/views/recipes-admin.js`
- `src/public/root/views/recipes-admin.helpers.js`
- `src/public/root/views/recipes-admin.renderers.js`
- `src/public/root/views/recipes-admin.version-editor.js`
- `src/public/root/recipes-api.js`
- `src/public/root/products-api.js`

Responsibilities:
- render the recipe admin workspace, detail pane, version review, and stage modal
- centralize operational `quantityBasis` labels/hints, effective-basis derivation, and COUNT/UN helper logic in browser helpers
- provide per-stage client-side search and category/subcategory filters over the already loaded product dataset
- show a per-unit checkbox only for eligible COUNT/UN-like inputs when the recipe version is still `PER_OUTPUT_KG`
- preserve and restore `inputQuantityBasis` during edit flows and payload serialization
- gate draft approval behind `#recipes-approval-dialog` before calling the unchanged recipe approval API
- render success/error/warning feedback inside the affected version card and offer `Reparar borrador` when the actor can manage recipes
- keep an adapter-local incomplete-draft marker keyed by version id so warning-level `PROCESSING` saves and some approval failures remain visible in the versions tab without backend contract changes
- detect incomplete stage-input rows before `collectStages()` drops name-less rows, blocking save for `RECOLLECTION` and warning-only for `PROCESSING`
- apply repair highlighting only when backend diagnostics match one stage name or one uniquely matched stage-input name
- show non-blocking compatibility guidance for discrete COUNT/UN materials, mixed-basis recipes, and `UN` decimal entry cases
- explain PROCESSING dependencies on prior RECOLLECTION, especially for CAPPING / packing-style steps
- keep root-shell review surfaces aligned with incremental read-only warehouse semantics without changing API contracts

## 6. Current dependency rules
Implemented dependency direction is mostly:
- route → service → repository → Prisma
- browser UI → browser API wrapper → HTTP route → service

Current rules actually followed in the amended area:
- controllers/routes do not contain the main recovery/reconciliation business rules
- services derive company scope from authenticated actor, not from client payload
- repositories own Prisma include graphs and row creation for production aggregates
- browser renderers/controllers remain presentation adapters and do not access Prisma directly
- the current client-document UX change is adapter-local: `clientsApi.downloadDocument(...)` still exposes backend response metadata and `clients-admin.js` owns native browser download dispatch plus file-picker-to-Base64 conversion
- TASK-008 remained adapter-local as well: the shared client payload helper dropped dead client-credit fields, the renderer exposed backend-supported client legal/geographic inputs, and the store-credit mini-form aligned with the shared `renderInlineMessage(...)` UI contract without changing backend routes or schemas
- create-store payload normalization is now intentionally centralized in `views.clientsAdminHelpers.buildStorePayload(...)`; `clients-admin-store-dialog.js` consumes that shared helper instead of maintaining a second payload builder
- the shared helper forwards the selected store `currency`, omits blank/zero browser `creditLimit` values, includes override fiscal fields only when `billingMode = 'override'`, and leaves `createClientStoreSchema` as the server-side authority for allowed `currency` values, numeric coercion, override-email validation, and non-negative validation
- recipe payload validation treats `inputQuantityBasis` as an adapter-boundary concern and normalizes omission to `null`
- production planning and material availability both apply the same effective-basis rule: `inputQuantityBasis ?? version.quantityBasis ?? 'PER_OUTPUT_KG'`
- root-shell product helpers are exported through the browser registry and reused from the product-admin view instead of duplicating that helper logic inline in submit handlers
- local SPA duplicate validation degrades gracefully to existing backend validation rather than replacing it
- recipe approval remains backend-authoritative; the root-shell adapter adds confirmation, local feedback, and incomplete-draft markers without changing approval payloads or duplicating lineage/allocation rules
- repair highlighting is intentionally conservative and only activates on exact stage-name or uniquely matched stage-input-name detection from backend-authored diagnostics

Current violations still present:
- services still hold substantial business logic instead of a separate domain layer
- service modules call repositories directly without explicit ports
- serialization logic and business rules are mixed in service files
- effective quantity-basis policy is duplicated across backend services and browser helpers instead of living in one backend-owned domain policy
- root-shell recipe admin remains a large browser module family where controller state, renderer wiring, and editor validation logic are spread across a few coarse-grained files rather than smaller focused components
- products-admin remains a large page-centric browser module with view rendering, local state, modal orchestration, and API-calling logic in one file

## 7. Current database ownership and transaction boundaries
### Logical ownership
- Recipes own recipe versions and stage contracts
- Production owns orders, stage executions, losses, returns, and recolection stages
- Inventory owns lots, warehouse stock, lot stock, and stock movements
- Quality owns inspection records but coordinates with Production state

### Active transaction boundaries
- stage execution inventory reductions occur in Prisma transactions coordinated by `production-execution.service.js`
- order completion inventory ingress occurs transactionally
- QA rejection handling is synchronous and may coordinate additional writes, but no evented outbox exists
- reconciliation recording is validated and persisted through production repository helpers

### Feature-specific persistence ownership
- `recipe_stage_inputs.input_quantity_basis` belongs to the recipe persistence model and is authored through recipe version create/update flows
- frozen `recipeVersionSnapshot.recipeVersion.stages[].stageInputs[].inputQuantityBasis` belongs to the production-order snapshot read model once an order is created
- `production_recolection_entries` and `production_recolection_reconciliations` are currently part of the production persistence model and loaded with the production order aggregate read model
- `client_stores.currency` belongs to the customers/stores persistence model; current create-store writes validate `CRC | USD | EUR`, while existing legacy rows may remain `NULL` and are normalized only at the renderer boundary today
- the nullable `client_stores.legal_name`, `commercial_name`, `legal_id`, `document_type`, `email_billing`, `economic_activity_code`, and `economic_activity_name` fields also belong to the customers/stores persistence model; omission/null currently represents inherit-from-client semantics during store creation

## 8. Current API and integration contracts
### Current API contracts in effect
- `POST /api/clients/:clientId/documents`
  - remains the current high-payload JSON upload contract for client-owned documents
  - browser code now fills `fileName`, `mimeType`, and `fileContentBase64` from a native file picker instead of visible text fields
- `GET /api/clients/:clientId/documents/:documentId/download`
  - remains the current protected document download contract
  - returns the file stream and `Content-Disposition`; browser code now consumes it through `clientsApi.downloadDocument(...)` and native download dispatch
- `POST /api/clients/company/:clientId/stores`
  - remains the current store-create contract and now accepts store `currency`, optional `creditLimit`, and additive nullable store fiscal override fields
  - browser payload shaping is shared through `views.clientsAdminHelpers.buildStorePayload(...)`, which forwards `currency`, omits blank/zero credit values, omits fiscal override fields in inherit mode, and reaches Zod validation before persistence
- `GET /api/regions/company`
  - remains the zone/subzone catalog contract used by the store dialog
  - the root-shell adapter now supports in-place re-fetch for the already-open dialog
- `GET /api/taxpayers/lookup?identification=...`
  - is already registered in `clientsApi` and remains an authenticated integration adapter used only in limited client-edit flows today
- `GET /api/economic-activities`
  - is already registered in `clientsApi` but is not yet loaded by the clients workspace at mount time
- `POST /api/production/orders/:id/stages/:stageId/inspections`
  - accepts QA inspection payloads, including rejection metadata, optional `requiresReplacementStage`, and `replacementItems`
  - may return a plain inspection object or an enriched envelope depending on rejection/disposition scope
- `POST /api/production/orders/:id/recolections/:recolectionId/confirm`
  - confirms a recolection/recovery stage
  - may accept lot-level `entries`
- `POST /api/production/orders/:id/recolections/:recolectionId/reconciliation`
  - records terminal reconciliation outcomes
  - returns computed remaining balance data
- recipe create/update contracts currently accept `stages[].stageInputs[].inputQuantityBasis` as nullable `RecipeQuantityBasis`
- recipe read models currently expose `stages[].stageInputs[].inputQuantityBasis`
- `GET /api/production/orders/:id`
  - currently includes `recolectionStages`, each serialized with `recoveryType`, `entries`, and `reconciliations`
  - includes a frozen `recipeVersionSnapshot` used internally for downstream material scaling decisions
- `POST /api/recipes/versions/:id/approve`
  - remains the existing approval contract consumed by the root-shell recipe admin UX improvements
  - the new confirmation dialog, local feedback, repair CTA, and incomplete-draft marker do not change the request/response contract
- the root-shell products admin continues consuming the existing product and category browser adapters; `create-product-with-subcategory` introduced no backend endpoint, payload-contract, or database change

### Current integration model
- no new external integration was added by this amendment
- the flow remains internal to Express, Prisma, and browser SPA clients
- the stacked-dialog subcategory flow depends on native browser `<dialog>.showModal()` behavior; browser support is documented in `README.md` as an active runtime compatibility note

## 9. Current security boundaries
Active security boundaries:
- bearer-authenticated actor context
- permission-based route protection through access policies
- company scoping in production and QA service entrypoints
- server-side validation of lot linkage and quantity limits for recovery/reconciliation operations

Security-relevant architectural choice in effect now:
- same-lot validation is enforced server-side in `production-execution.service.js`, not delegated to the warehouse SPA

Current security limitation:
- enforcement still depends on service-layer orchestration rather than explicit domain policy modules or cross-cutting tenant-boundary abstractions

## 10. Current container and deployment architecture
Current deployment architecture:
- single Node runtime container
- multi-stage Docker build
- production runtime runs as non-root user
- healthcheck probes `/health/ready`
- dev compose includes app, Postgres, and Redis with health checks

This is an active hardened baseline compared with earlier repository states, but it is still a single-process monolith deployment.

## 11. Current testing strategy
Current strategy includes:
- node:test-based unit/service tests
- migration/schema governance tests
- runtime contract and documentation governance tests
- browser/runtime characterization tests for the SPAs
- repo-level `verify` script chaining lint, typecheck, validations, build, and test

Feature-specific coverage currently present:
- relevant-input scope resolver tests
- migration/schema tests for recoveryType, recolection entries, and reconciliation rows
- same-lot validation tests
- replacement-recovery gate tests
- reconciliation balance and validation tests
- root-shell recipe admin characterization for approval confirmation seams, local version-card feedback, incomplete-draft marker rendering, approval gating hooks, and repair-highlight hooks
- root-shell clients characterization for protected-document browser download dispatch, file-picker upload contract, 5 MB guard, missing-zones guidance state, in-place zone refresh, shared store payload builder delegation, create-time store `currency` + `creditLimit` validation, store fiscal inherit/override rendering, and null-currency-safe credit rendering (`tests/clients-view-characterization.test.js`, `tests/clients-store-map-characterization.test.js`, `tests/client-store-credit-limit.test.js`, `tests/client-store-fiscal-overrides.test.js`)
- targeted `recipe-approval-ux` validation is user-reported as pass for `tests/root-shell-recipes-admin-view-characterization.test.js`, `tests/recipe-service-foundation.test.js`, `tests/recipe-schema.test.js`, plus lint and typecheck
- targeted `client-store-documents-credit-ux` validation for TASK-001 through TASK-008 is user-reported as pass for `node --test tests/client-store-credit-limit.test.js tests/client-store-fiscal-overrides.test.js tests/clients-store-map-characterization.test.js tests/clients-view-characterization.test.js` (`43/43`), plus `npm run lint` and `npm run typecheck`; TASK-008 introduced no production schema change, so earlier TASK-006/TASK-007 Prisma/build validation remains the latest reported persistence evidence

Current limitation:
- manual end-to-end evidence for the warehouse operator flow and manual browser validation for the recipe approval dialog/focus behavior are still weaker than the automated service-level evidence

## 12. Active architectural decisions
- Production and QA remain inside the current layered monolith; no microservice split is active.
- Company scope is enforced from authenticated actor context in production and quality services.
- Legacy `recolection` naming remains part of the public/internal contract for compatibility.
- `VIRTUAL_RECOLECTION` remains supported as compatibility behavior.
- `REPLACEMENT_RECOVERY` is the active additive recovery type for QA-driven replacement stages.
- Same-lot validation is enforced only when a completed recovery/recolection stage has persisted lot-level entries, preserving backward compatibility for older data/flows.
- `RecipeStageInput.inputQuantityBasis` is optional and `null` means inherit from `RecipeVersion.quantityBasis`.
- Mixed-basis scaling is an active implemented rule: each stage input may scale by planned output kg or planned finished-unit count according to its effective basis.
- Production-order snapshots freeze `inputQuantityBasis` per stage input so planning and execution remain stable after later recipe edits.
- Reconciliation outcomes are currently limited to `USED`, `RETURNED`, and `DISCARDED`.
- Production order read models now expose recolection stages with entries and reconciliations to support warehouse UI state and server-side validation.
- In the root-shell products admin, dialog focus restoration is managed per modal instance (`lastFormDialogTrigger`, `lastCategoriesDialogTrigger`, `lastDeactivateDialogTrigger`) rather than through one shared trigger variable.
- Local duplicate subcategory detection in the browser is an active UX optimization implemented through `views.productsAdminHelpers.checkSubcategoryNameDuplicate(...)`; backend category creation remains the final source of truth.
- Native stacked `<dialog>` behavior is an accepted dependency for inline subcategory creation in supported browsers, with the README compatibility note documenting the expected browser baseline.
- Recipe draft approval in the root-shell admin is currently mediated by a custom native `<dialog>` confirmation flow instead of `window.confirm`, keeping the API contract unchanged while adding an explicit irreversible-action boundary in the browser adapter.
- Action-local recipe approval feedback is an active UI decision: success/error state is stored per version id and rendered inside the corresponding version card.
- The `Incompleta` draft marker for recipe versions is currently an adapter-level state concern maintained in the root-shell view, not a persisted backend field.
- Repair highlighting for recipe approval failures is intentionally conservative: exact stage-name matches or uniquely matched input names are highlighted, otherwise the UI falls back to generic repair guidance.
- Client-document backend contracts remain unchanged while the root-shell adapter owns native browser download dispatch and FileReader-derived upload metadata.
- Store creation remains a one-phase backend use case, but it now accepts store `currency`, optional create-time `creditLimit`, and nullable fiscal override fields; inherit-vs-override is currently represented by null/omitted override values rather than a persisted mode flag, and store-scoped document upload is still absent.
- Shared store payload shaping through `views.clientsAdminHelpers.buildStorePayload(...)` is now an active browser-layer decision used by the store dialog to reduce payload drift.
- `views.clientsAdminHelpers.buildClientPayload(...)` is also an active browser-layer contract: it now forwards the backend-supported client legal/geographic fields and intentionally excludes client-level `creditLimit` / `creditBalance` because active credit ownership is store-level.
- The inline store-credit feedback region is now standardized on `rootShellUi.renderInlineMessage(...)` and rendered inside a block-level `aria-live` container.
- Legacy stores may still persist `NULL` currency because the migration was additive and nullable; the current clients renderer intentionally treats that as `Moneda: Sin definir` and avoids defaulting the symbol to `CRC`.
- Empty zone catalogs are treated as a first-class browser state in the store dialog; guidance + refresh are active UX decisions rather than backend errors.

## 13. Known architectural limitations
- no explicit domain layer for Production, Quality, Inventory, Recipes, or Product Catalog UI workflows
- no formal input/output port abstraction
- production order aggregate loading uses broad include graphs and service-level serialization
- QA relevant-input scope is computed dynamically rather than persisted as an immutable rejection snapshot
- browser UIs remain tightly coupled to server DTO structure
- effective-basis policy is duplicated in recipe admin helpers, warehouse preview logic, production planning, and lot-availability services
- recipe approval incomplete-state visibility currently depends on frontend-managed per-version state instead of a backend-persisted recipe-version attribute
- recipe repair highlighting relies on parsing backend-authored error text, which is intentionally narrow but still couples the UI affordance to message wording stability
- products-admin dialog orchestration, local state, helper invocation, and API calling remain concentrated in one browser module instead of smaller focused UI components
- clients-admin and clients-admin-store-dialog similarly remain coarse browser modules where DOM orchestration, adapter logic, and UI policy are mixed together
- store currency remains browser-required but persistence-nullable for backward compatibility, so legacy normalization is still handled in the renderer instead of at a stricter domain boundary
- store fiscal override semantics are split across browser helper payload shaping, dialog-mode toggling, renderer summary logic, and service-level selective persistence rather than one backend-owned policy seam
- the governed file-upload pattern is duplicated across browser surfaces instead of being exposed through one shared helper module
- `buildClientPayload()` no longer contains obsolete client-level `creditLimit` shaping or a stale `creditBalance` numeric-field entry, but the shared clients helper still aggregates multiple concerns (client payload shaping, store payload shaping, filtering, summaries) in one browser module

## 14. Open decisions requiring clarification
- Should relevant-input scope remain computed on demand, or be stored as a persisted audit snapshot per rejection event?
- Should effective quantity-basis resolution be extracted into a single backend-owned policy/helper to reduce duplication across production planning, availability, and browser previews?
- Should the root-shell recipe admin eventually persist an explicit incomplete-draft indicator server-side if cross-session visibility becomes a business requirement?
- Is stronger end-to-end evidence required before the amended warehouse flow is treated as operationally complete?
- Should legacy `recolection` path names remain indefinitely, or should a versioned rename strategy be planned later?
- If the root-shell product admin keeps growing, should its dialog orchestration and helper usage be split into smaller browser modules in a future UI-maintenance cycle?
- Should the root-shell clients workspace extract shared governed file-upload helpers instead of keeping separate FileReader logic in payment and client-document adapters?
- Should the shared clients helper be split so store payload shaping, client payload shaping, and filtering concerns do not continue accreting inside one browser helper module even after TASK-008 reduced one instance of payload drift?
- When the remaining client-store onboarding requirements are implemented, should the current store fiscal override mode and future store-scoped documents remain inside the current `client.service.js` boundary or be split into more explicit submodules?
- Should legacy `NULL` store currencies be backfilled or constrained more strictly at persistence level after the additive rollout, or is renderer-level compatibility sufficient for now?
- Does the current `window.open('#zones', '_blank', 'noopener')` guidance affordance remain acceptable after manual browser validation, or should navigation be redesigned?

## 15. Documentation governance
The canonical reviewed artifacts under `docs/**` represent implemented reality and are the authoritative reference for runtime contracts. The workflow-baseline validators and characterization tests intentionally read hosted workflow truth from that parent-root workflow tree.

Documentation ownership boundaries are defined in `docs/documentation-ownership-map.md`. CI workflow definitions live under `../.github/workflows/**` and are the authoritative hosted source for workflow-baseline validators.

Supported runtime company-role update flow now exists. Company-role list/create/update operations are implemented and tracked in current-state docs.

This feature operates under a p34-bounded-governance-coverage-expansion posture: partial OpenAPI baseline coverage is intentional for this amendment scope. bounded governance evidence is preserved through characterization tests and contract docs rather than full integration-test suites.

## 16. Cross-cutting security follow-up
Browser session HTTPS security (secure-cookie enforcement, HTTPS-only transport) is tracked as a residual risk and follow-up dependency under `specs/p11-https-browser-session-migration/`. This is not an in-slice blocker for the current amendment and must be handled as a separate initiative when HTTPS infrastructure is available.
