# Architecture
## 1. Purpose and scope
This document describes the architecture currently implemented in the repository, with emphasis on the active production, QA, recipe, warehouse-browser, and root-shell product-catalog browser flows after the `qa-rejection-material-reconciliation-amendment`, `recipe-input-per-unit-basis`, `recipe-approval-ux`, and `create-product-with-subcategory` implementations.

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
| Recipes | recipe versions, version-level quantity basis, per-stage-input basis override, stage typing, process-code validation | `src/services/recipe.service.js`, `src/schemas/recipe.schema.js`, root-shell recipe editor |
| Inventory | lots, warehouse balances, stock mutation, movement audit | `src/services/inventory*.js`, `src/repositories/inventory.repository.js` |
| Production | orders, planned-output scaling, material requirements, stage executions, losses, returns, completion | `src/services/production*.js`, `src/routes/production.routes.js` |
| Quality | inspections, rejection handling, relevant-input scope, continuation rules | `src/services/quality*.js` |
| Recolection / Recovery | pending recovery gates, lot-level entry capture, reconciliation outcomes | `src/services/production-recolection.service.js`, `src/repositories/production.repository.js` |
| Warehouse UI | operator-facing rendering and controller wiring for execution, QA, recovery, reconciliation | `src/public/warehouse/` |
| Root-shell Product Admin UI | product listing/detail, product form dialog, categories dialog, inline subcategory creation, local duplicate validation | `src/public/root/views/products-admin*.js` |
| Root-shell Recipe Admin UI | recipe listing/detail, version editor, operational quantity-basis guidance, COUNT/UN discovery filters, review badges, approval confirmation, local version-card feedback, incomplete draft markers, repair highlighting | `src/public/root/views/recipes-admin*.js` |

## 5. Current runtime components and responsibilities
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

## 8. Current API and integration contracts
### Current API contracts in effect
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
- targeted `recipe-approval-ux` validation is user-reported as pass for `tests/root-shell-recipes-admin-view-characterization.test.js`, `tests/recipe-service-foundation.test.js`, `tests/recipe-schema.test.js`, plus lint and typecheck

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

## 14. Open decisions requiring clarification
- Should relevant-input scope remain computed on demand, or be stored as a persisted audit snapshot per rejection event?
- Should effective quantity-basis resolution be extracted into a single backend-owned policy/helper to reduce duplication across production planning, availability, and browser previews?
- Should the root-shell recipe admin eventually persist an explicit incomplete-draft indicator server-side if cross-session visibility becomes a business requirement?
- Is stronger end-to-end evidence required before the amended warehouse flow is treated as operationally complete?
- Should legacy `recolection` path names remain indefinitely, or should a versioned rename strategy be planned later?
- If the root-shell product admin keeps growing, should its dialog orchestration and helper usage be split into smaller browser modules in a future UI-maintenance cycle?

## 15. Documentation governance
The canonical reviewed artifacts under `docs/**` represent implemented reality and are the authoritative reference for runtime contracts. The workflow-baseline validators and characterization tests intentionally read hosted workflow truth from that parent-root workflow tree.

Documentation ownership boundaries are defined in `docs/documentation-ownership-map.md`. CI workflow definitions live under `../.github/workflows/**` and are the authoritative hosted source for workflow-baseline validators.

Supported runtime company-role update flow now exists. Company-role list/create/update operations are implemented and tracked in current-state docs.

This feature operates under a p34-bounded-governance-coverage-expansion posture: partial OpenAPI baseline coverage is intentional for this amendment scope. bounded governance evidence is preserved through characterization tests and contract docs rather than full integration-test suites.

## 16. Cross-cutting security follow-up
Browser session HTTPS security (secure-cookie enforcement, HTTPS-only transport) is tracked as a residual risk and follow-up dependency under `specs/p11-https-browser-session-migration/`. This is not an in-slice blocker for the current amendment and must be handled as a separate initiative when HTTPS infrastructure is available.
