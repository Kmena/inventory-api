# Tasks

## TASK-104: Refresh architecture-facing docs after `recipes-production-qa-execution-hardening` warehouse UI `TASK-011` + `TASK-012`
**Status:** Completed
**Priority:** Low
**Domain:** Warehouse production browser runtime / Architecture documentation
**Requirement:** `specs/recipes-production-qa-execution-hardening`; post-implementation refresh after warehouse UI `TASK-011` + `TASK-012` executed by `sdd-implementation-agent-5c0604`
**Reason:** After the approved warehouse production execution hardening shipped, the canonical architecture-facing docs still described the warehouse production UI too generically and still referenced older execute-stage form details instead of the implemented modular split, inline QA capture, shared override flow, and updated validation baseline with known unrelated repository failures.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now record that `src/public/warehouse/views/production.js` remains a thin orchestrator while `production.state.js`, `production.renderers.js`, and `production.controllers.js` own the active production-detail behavior; the current warehouse execute-stage form now includes inline numeric QA capture for `qaMandatory` snapshot stages, shares the `overrideJustification` client flow between QA out-of-tolerance and lot over-consumption warning paths, and derives `WAITING_QA` with the same `qaOutOfTolerance` semantics expected by the backend completion gate.
**Implemented change:** Documentation-only refresh aligned to the observable repository state after warehouse UI `TASK-011` + `TASK-012`, including the current validation evidence (`node --test tests/warehouse-spa-runtime.test.js` ✅, targeted eslint ✅, `npm run build` ✅, with unrelated pre-existing `typecheck` and full `npm test` failures still outstanding) and the note that manual browser validation remains pending.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Implemented browser/runtime code in `src/public/warehouse/views/production.state.js`, `src/public/warehouse/views/production.renderers.js`, `src/public/warehouse/views/production.controllers.js`, `src/public/warehouse/views/production.js`, `src/public/warehouse/index.html`, updated characterization coverage in `tests/warehouse-spa-runtime.test.js`, and the supplied validation evidence from `sdd-implementation-agent-5c0604`
**Database impact:** None; this refresh documents warehouse UI behavior only
**API impact:** None; the current `/api/production/**` contract remains unchanged
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because the active warehouse QA/override gating behavior and known validation debt are now explicit
**Acceptance criteria:** Architecture-facing docs reflect the observable post-implementation warehouse production split, inline QA capture, shared override flow, `WAITING_QA` gating semantics, current targeted validation evidence, and the fact that manual browser validation is still pending
**Validation evidence:** User-supplied results report `node --test tests/warehouse-spa-runtime.test.js` ✅, targeted eslint for `src/public/warehouse/views/production.state.js`, `src/public/warehouse/views/production.renderers.js`, `src/public/warehouse/views/production.controllers.js`, and `tests/warehouse-spa-runtime.test.js` ✅, `npm run build` ✅, `npm run typecheck` ❌ because of pre-existing unrelated landing typing failures, and full `npm test` ❌ because of pre-existing governance-baseline/documentation drift failures
**Required tests:** Preserve `tests/warehouse-spa-runtime.test.js`; keep the warehouse runtime contract coverage aligned with the production module split and inline QA/override flow language
**Migration considerations:** Keep this refresh documentation-only and additive; do not reinterpret the warehouse modular split as a backend production contract change
**Rollback or mitigation:** Revert documentation wording if a later verified repository state changes the warehouse production runtime contract, module split, or validation baseline again
**Risk:** Low

## TASK-103: Refresh architecture-facing docs after `recipes-production-qa-execution-hardening` `TASK-010`
**Status:** Completed
**Priority:** Low
**Domain:** Root recipes admin browser runtime / Architecture documentation
**Requirement:** `specs/recipes-production-qa-execution-hardening`; post-implementation refresh after `TASK-010` executed by `sdd-implementation-agent-5c0604`
**Reason:** After the approved root recipes-admin hardening shipped, the canonical architecture-facing docs still described the `#recetas` browser module too generically and did not record the new renderer-owned workspace markup seam, the dedicated registered version-editor seam, or the updated validation baseline with unrelated repository-wide typecheck debt outside this feature.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now record that `src/public/root/views/recipes-admin.renderers.js` owns static workspace markup through `renderWorkspace()`, `src/public/root/views/recipes-admin.version-editor.js` owns dynamic stage and QA editor behavior through the registered `views.recipesAdminVersionEditor` seam, `src/public/root/index.html` and `src/public/root/runtime-contract.js` treat that seam as part of the approved loader contract, and the current validation evidence for this cycle is aligned with the repository truth.
**Implemented change:** Documentation-only refresh aligned to the observable repository state after `recipes-production-qa-execution-hardening` `TASK-010`, including the line-count compliance note (`recipes-admin.js=569`) and the supplied validation evidence, without changing production code.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Implemented browser/runtime code in `src/public/root/views/recipes-admin.renderers.js`, `src/public/root/views/recipes-admin.version-editor.js`, `src/public/root/views/recipes-admin.js`, `src/public/root/index.html`, `src/public/root/runtime-contract.js`, the updated characterization coverage in `tests/root-shell-recipes-admin-view-characterization.test.js` and `tests/root-shell-modularity-governance.test.js`, and the supplied validation evidence from `sdd-implementation-agent-5c0604`
**Database impact:** None; this refresh documents browser-runtime modularity and validation only
**API impact:** None; `/api/recipes/**` and related product assignment contracts remain unchanged
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because the supported loader contract and bounded validation truth are now explicit
**Acceptance criteria:** Architecture-facing docs reflect the observable post-`TASK-010` root recipes-admin structure, distinguish the implemented renderer/version-editor seam split from any future deeper decomposition, record the current line-count compliance fact, and preserve that `npm run typecheck` is still failing only for unrelated permission-metadata typing outside this feature scope
**Validation evidence:** User-supplied results report `node --test tests/root-shell-recipes-admin-view-characterization.test.js tests/root-shell-modularity-governance.test.js` ✅, targeted eslint ✅, `npm run build` ✅, `npm test -- --silent` ✅, and `npm run typecheck` still red only for unrelated permission-metadata typing outside this feature
**Required tests:** Preserve `tests/root-shell-recipes-admin-view-characterization.test.js` and `tests/root-shell-modularity-governance.test.js` coverage for the recipes-admin seam split and approved loader/runtime contract
**Migration considerations:** Keep this refresh documentation-only and additive; do not reinterpret the UI hardening as a backend recipe/production contract change
**Rollback or mitigation:** Revert documentation wording if a later verified repository state changes the recipes-admin loader contract, seam registration, or validation baseline again
**Risk:** Low

## TASK-102: Refresh architecture-facing docs after `recipes-production-qa-execution-hardening` Fase 2 / `TASK-007`
**Status:** Completed
**Priority:** Low
**Domain:** Production material-availability read model / Architecture documentation
**Requirement:** `specs/recipes-production-qa-execution-hardening`; post-implementation refresh after Fase 2 / `TASK-007` executed by `sdd-implementation-agent-e88e1e`
**Reason:** After the approved `TASK-007` implementation added the production material-availability read model and two mounted production read endpoints, the canonical architecture-facing docs still described the production surface as if those runtime reads were pending.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now record that `src/services/production-material-availability.service.js` exists, that `GET /api/production/orders/:id/material-requirements` and `GET /api/production/orders/:id/stages/:stageId/available-lots` are active tenant-scoped runtime contracts, that material availability is derived from persisted `production_order_material_requirements` plus current origin-warehouse stock, and that available-lot suggestions use the frozen stage snapshot together with current tenant product `requiresLot` / `requiresExpiration` flags, sellable-lot filtering, FEFO/FIFO ordering, and omission of `internalLotNumber`.
**Implemented change:** Documentation-only refresh aligned to the observable repository state after `TASK-007`, including the runtime-contract governance classification and supplied validation evidence, without changing production code.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Implemented code in `src/services/production-material-availability.service.js`, `src/routes/production.routes.js`, `src/repositories/production.repository.js`, `src/repositories/inventory.repository.js`, `src/repositories/product.repository.js`, `tests/production-material-availability.service.test.js`, `tests/production-routes-contract.test.js`, and the updated runtime governance artifacts, plus the supplied validation evidence from `sdd-implementation-agent-e88e1e`
**Database impact:** None; this refresh documents reads over the already-implemented `production_order_material_requirements` persistence boundary and current inventory stock state
**API impact:** None beyond documentation alignment to the already-mounted runtime contracts for `GET /api/production/orders/:id/material-requirements` and `GET /api/production/orders/:id/stages/:stageId/available-lots`
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because the tenant-scoped production read contracts and data-exposure limits are now explicit
**Acceptance criteria:** Architecture-facing docs reflect the observable post-`TASK-007` state, distinguish persisted planning requirements from current-stock-derived availability, capture the current dependency on live product `requiresLot` / `requiresExpiration` flags because those are not frozen in existing snapshots, and do not claim unimplemented execution-hardening work
**Validation evidence:** User-supplied results report targeted service + route tests ✅, focused eslint ✅, `npm run typecheck` ✅, full test suite ✅, and `npm run build` ✅
**Required tests:** Preserve `tests/production-material-availability.service.test.js`, `tests/production-routes-contract.test.js`, and `tests/runtime-contract-governance.test.js` coverage for the mounted read-model contract and runtime-governance classification
**Migration considerations:** Keep this refresh documentation-only and explicit that the available-lots read currently depends on live tenant product flags because `requiresLot` / `requiresExpiration` are not frozen in the existing production-order snapshot
**Rollback or mitigation:** Revert documentation wording if a later verified repository state changes the read-model source, freezes those product flags into snapshots, or alters the mounted route contracts
**Risk:** Low

## TASK-101: Refresh architecture-facing docs after `recipes-production-qa-execution-hardening` Fase 2 / `TASK-006`
**Status:** Completed
**Priority:** Low
**Domain:** Production planning QA snapshot hardening / Architecture documentation
**Requirement:** `specs/recipes-production-qa-execution-hardening`; post-implementation refresh after Fase 2 / `TASK-006` executed by `sdd-implementation-agent-e88e1e`
**Reason:** After the approved `TASK-006` implementation hardened production-order snapshot serialization, the canonical architecture docs still described planning snapshots only at the material-requirements level and did not record the formal QA-parameter normalization, legacy `parameterTolerances` retention rules, or the fact that the change reuses existing create/approve snapshot builders without altering routes or schema.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now record that snapshot creation lives in `src/services/production-planning.service.js`, that `buildRecipeVersionSnapshot(...)` explicitly normalizes stage `expectedParameters` to `{ name, unit, expectedValue, minTolerance, maxTolerance }`, omits empty `parameterTolerances`, preserves non-empty legacy `parameterTolerances` arrays for backward compatibility, and feeds the unchanged create/approve route contracts through `buildEnrichedSnapshot(...)` and `buildOrderSnapshotWithMaterialRequirements(...)`.
**Implemented change:** Documentation-only refresh aligned to the observable repository state after `TASK-006`, keeping the update narrowly scoped to the planning-layer snapshot contract and the supplied validation evidence.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Implemented code in `src/services/production-planning.service.js`, `src/services/production.service.js`, `tests/production-planning.service.test.js`, and `tests/production-service-foundation.test.js`, plus the supplied validation evidence from `sdd-implementation-agent-e88e1e`
**Database impact:** None; this refresh documents that `TASK-006` changed snapshot serialization only and did not alter Prisma schema or migrations
**API impact:** None; existing create/approve endpoints keep the same mounted route surface while their snapshot payloads now carry normalized QA parameter definitions
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because the frozen QA snapshot contract is now explicit
**Acceptance criteria:** Architecture-facing docs reflect the observable post-`TASK-006` state, distinguish the normalized QA snapshot contract from still-pending execution-time QA tolerance enforcement, and do not claim any route or schema change
**Validation evidence:** User-supplied results report targeted tests ✅, focused eslint ✅, `npm run typecheck` ✅, and `npm test -- --silent` ✅
**Required tests:** Preserve `tests/production-planning.service.test.js` and `tests/production-service-foundation.test.js` coverage for snapshot normalization behavior
**Migration considerations:** Keep this refresh documentation-only and additive; preserve that legacy non-empty `parameterTolerances` still appear in snapshots for backward compatibility
**Rollback or mitigation:** Revert documentation wording if a later verified repository state changes snapshot serialization or removes the legacy compatibility field
**Risk:** Low

## TASK-100: Refresh architecture-facing docs after `recipes-production-qa-execution-hardening` Fase 2 / `TASK-005` functional scope
**Status:** Completed
**Priority:** Low
**Domain:** Production planning hardening / Architecture documentation
**Requirement:** `specs/recipes-production-qa-execution-hardening`; post-implementation refresh after Fase 2 / `TASK-005` functional scope executed by `sdd-implementation-agent-e88e1e`
**Reason:** After the approved Fase 2 implementation materially changed production-order planning behavior, the canonical architecture docs still described planning as internal-only and did not reflect persisted material requirements, approval-time stock revalidation, advisory-lock-backed planning transactions, or request-aware stock-override audit correlation.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now record that migration `20260915001000_production_order_material_requirements` and Prisma model `ProductionOrderMaterialRequirement` are active repository truth; `production.repository.js` includes/persists `materialRequirements`; `production.service.js` now computes and persists planning requirements, enriches `recipeVersionSnapshot.materialRequirements`, revalidates stock on approval inside inventory transactions with advisory lock, and emits stock-override audit events when request context is available; `production.routes.js` now passes `req` into create/approve calls for audit correlation; and the repository has since advanced the originally later execution split by explicit user authorization so `src/services/production.service.js` is now a 585-line façade delegating execution/return/completion work to `src/services/production-execution.service.js` while preserving public API and `__private__` compatibility.
**Implemented change:** Documentation-only refresh aligned to the observable repository state after the Fase 2 / `TASK-005` closure, explicitly recording that an originally later structural split was advanced by explicit user authorization only far enough to satisfy the approved `production.service.js <= 600 lines` acceptance, while also preserving that the remaining `TASK-008` execution-validation features were not implemented in this cycle.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Implemented code in `prisma/migrations/20260915001000_production_order_material_requirements/migration.sql`, `prisma/schema.prisma`, `src/repositories/production.repository.js`, `src/services/production.service.js`, `src/services/production-planning.service.js`, `src/services/production-execution.service.js`, and `src/routes/production.routes.js`, plus the supplied validation evidence from `sdd-implementation-agent-e88e1e`
**Database impact:** Documentation records additive migration `20260915001000_production_order_material_requirements` and active model `ProductionOrderMaterialRequirement`; no new schema change in this refresh
**API impact:** None in this refresh beyond documenting the already-implemented runtime behavior change on existing create/approve production endpoints
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because approval-time stock enforcement and request-aware override auditing are now explicit
**Acceptance criteria:** Architecture-facing docs reflect the observable post-closure state of Fase 2 / `TASK-005`, state that the `production.service.js <= 600 lines` acceptance is now satisfied through an explicitly user-authorized early split, and still distinguish that from the not-yet-implemented `TASK-008` execution-validation features
**Validation evidence:** User-supplied results report targeted tests ✅, focused eslint ✅, `npm run typecheck` ✅, `npm run build` ✅, and `npm test -- --silent` ✅
**Required tests:** Preserve the targeted Fase 2 production planning coverage together with the repository-wide green validation lane supplied for this cycle
**Migration considerations:** Keep this refresh documentation-only and additive; record that the execution-service split is already implemented by explicit user authorization, but do not reinterpret the still-pending `TASK-008` validation enhancements as already delivered
**Rollback or mitigation:** Revert documentation wording if a later verified repository state changes the create/approve planning behavior or finally completes the deferred service split
**Risk:** Low

## TASK-099: Refresh architecture-facing docs after `recipes-production-qa-execution-hardening` Fase 2 / `TASK-004`
**Status:** Completed
**Priority:** Low
**Domain:** Production planning foundation / Architecture documentation
**Requirement:** `specs/recipes-production-qa-execution-hardening`; post-implementation refresh after Fase 2 / `TASK-004`
**Reason:** After the approved planning extraction shipped, the canonical architecture docs still needed to reflect the new internal planning seam and FEFO helper extraction without overstating later create/approve behavior as already implemented.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now record that `production-planning.service.js` exists, `production.service.js` reuses the centralized snapshot builder, `sortLotsByFefo(...)` is a pure exported helper used by `reserveLots(...)`, and material-requirement persistence / active stock enforcement remain future work.
**Implemented change:** Documentation-only refresh aligned to the observable repository state after `src/services/production-planning.service.js` was introduced and FEFO sorting was extracted.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Implemented code in `src/services/production-planning.service.js`, `src/services/inventory-transaction-support.service.js`, `src/services/production.service.js`, plus focused tests
**Database impact:** None in this refresh
**API impact:** None; no public contract change documented
**Container impact:** None
**Security impact:** Low
**Acceptance criteria:** Docs describe the new planning seam and FEFO extraction as current truth, explicitly preserve that create/approve runtime behavior is not yet changed, and note the unrelated governance-baseline test failure accurately.
**Validation evidence:** User-supplied targeted tests ✅, focused eslint ✅, `npm run typecheck` ✅, `npm run build` ✅; repository-wide `npm test` still fails only in `tests/governance-baseline-sync-guardrails.test.js` due to `docs/audit/current-code-audit.md` wording drift
**Required tests:** Preserve `tests/production-planning.service.test.js`, `tests/inventory-transaction-support.service.test.js`, and `tests/production-service-foundation.test.js`
**Migration considerations:** Keep this refresh documentation-only and do not claim active stock enforcement or persisted material requirements before later tasks
**Rollback or mitigation:** Revert wording if a later verified implementation changes the actual adoption level of the planning seam
**Risk:** Low

## TASK-098: Refresh architecture-facing docs after `recipes-production-qa-execution-hardening` Fase 1
**Status:** Completed
**Priority:** Low
**Domain:** Recipe / production QA hardening / Architecture documentation
**Requirement:** `specs/recipes-production-qa-execution-hardening`; mandatory post-implementation documentation refresh requested by `sdd-implementation-agent-e88e1e` after Fase 1 (`TASK-001`, `TASK-002`, `TASK-003`)
**Reason:** After the approved Fase 1 implementation shipped, the canonical architecture-facing docs still needed to reflect the active recipe-write invariants, the new additive production QA persistence fields, and the remaining stage-execution idempotency contradiction without overstating later phases as already implemented.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now record the observable repository truth after Fase 1: recipe stage-input unit consistency is enforced in Zod, service, and DB layers; `qaMandatory` stages require formal numeric expected parameters; `RecipeStageInput.quantity` is explicitly documented as per-unit quantity on the existing column; additive `ProductionStageExecution.qaOutOfTolerance` / `overrideJustification` fields exist but are not yet consumed by runtime flows; and the `endedAt` / active-execution contradiction is explicitly tracked as remaining risk.
**Implemented change:** Synchronized architecture-facing documentation to the actual repository state after `recipes-production-qa-execution-hardening` Fase 1 without changing production runtime contracts beyond the implemented backend hardening already completed in code.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Implemented Fase 1 code in `prisma/migrations/20260915000000_recipe_qa_and_stage_input_unit/migration.sql`, `prisma/schema.prisma`, `src/schemas/recipe.schema.js`, `src/services/recipe.service.js`, plus focused tests and spec documentation updated by `sdd-implementation-agent-e88e1e`
**Database impact:** Documentation records additive migration `20260915000000_recipe_qa_and_stage_input_unit`; no new schema change in this refresh
**API impact:** None; this refresh only documents the already-implemented recipe write-contract hardening
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because tenant-scoped validation boundaries and remaining production-QA runtime gaps are now explicit
**Acceptance criteria:** Architecture-facing docs reflect the observable Fase 1 implementation, distinguish active recipe-write hardening from future production-execution hardening, and note the active-state/idempotency contradiction without claiming it is solved
**Validation evidence:** User-supplied Fase 1 results report `npm run prisma:deploy` ✅, `npm run build` ✅, `npm run typecheck` ✅, `node --test tests/recipe-schema.test.js` ✅, `node --test tests/recipe-service-foundation.test.js` ✅, and `npm test -- --silent` ✅ (`1205` pass, `0` fail, `2` skipped); `npm run lint` remains red only because of unrelated pre-existing files outside this feature slice
**Required tests:** Preserve `tests/recipe-schema.test.js`, `tests/recipe-service-foundation.test.js`, and the documented aggregate validation evidence for this implementation cycle
**Migration considerations:** Keep the documented migration additive; do not claim a new `quantity_per_unit` column or fully implemented execution-QA tolerance behavior until later phases wire those runtime flows
**Rollback or mitigation:** Revert documentation wording if a later verified implementation changes the actual recipe or production QA runtime behavior
**Risk:** Low

## TASK-097: Refresh architecture-facing docs after supplier-management RFQ tracking layout cycle
**Status:** Completed
**Priority:** Low
**Domain:** Architecture documentation / Root shell browser runtime / Supplier management RFQ tracking
**Requirement:** `specs/supplier-management`; mandatory post-implementation documentation refresh requested by `sdd-implementation-agent-24580e` after the `rfq-tracking-admin` sidebar+detail layout cycle
**Reason:** After the browser-side RFQ tracking layout refresh shipped, the canonical architecture-facing docs still described the older RFQ tracking renderer shape and did not yet record the commercial sidebar+detail layout, the active RFQ tracking CSS rules, or the updated repository-wide validation baseline for this cycle.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now record that `#seguimiento_cotizaciones` uses the commercial sidebar+detail pattern, that `renderTrackingTable` is no longer part of the active renderer contract, that `.rfq-tracking-sidebar-list` and `#rfq-tracking-detail-panel` are active style hooks, and that the user-supplied validation baseline for this cycle reports `npm run typecheck` ✅, `npm run lint` ✅, `npm run test -- --silent` ✅ with `974/976` passing, `0` failing, and `2` skipped, plus governance tests green after the audit-file correction.
**Implemented change:** Synchronized the architecture-facing documentation to the observable repository state after the RFQ tracking sidebar+detail layout change without modifying backend routes, services, repositories, schemas, or migrations.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Implemented browser/runtime code in `src/public/root/views/rfq-tracking-admin.js`, `src/public/root/views/rfq-tracking-admin.renderers.js`, `src/public/styles.css`, the focused audit record in `docs/audit/current-code-audit.md`, and the updated validation evidence in `tests/rfq-tracking-view-characterization.test.js`
**Database impact:** Documentation only; no schema or migration change
**API impact:** None; RFQ tracking continues using `GET /api/procurement/rfq-tracking` and `POST /api/procurement/rfq-invitations/:id/manual-response`
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because the browser contract, active validation baseline, and governance-test recovery are now aligned with the actual implemented state
**Acceptance criteria:** Canonical docs describe the RFQ sidebar+detail layout, the updated renderer export contract, the new RFQ tracking CSS classes, and the latest user-supplied green validation baseline without claiming direct command execution by this refresh
**Validation evidence:** User-supplied cycle results report `npm run typecheck` ✅, `npm run lint` ✅, `npm run test -- --silent` ✅ (`974/976` pass, `0` fail, `2` skipped), and governance tests ✅ after the audit file was corrected
**Required tests:** Preserve `tests/rfq-tracking-view-characterization.test.js`, `tests/root-shell-rfq-tracking-api-characterization.test.js`, `tests/rfq-runtime-governance-alignment.test.js`, `tests/root-shell-supply-manifest.test.js`, `tests/root-shell-router-characterization.test.js`, and the repository-wide aggregate validation gates already referenced in the canonical docs
**Migration considerations:** Keep this refresh documentation-only and incremental; do not reinterpret the browser-layout change as a backend/API/schema redesign
**Rollback or mitigation:** Revert documentation wording if a later verified repository state changes the RFQ tracking browser contract or validation baseline again
**Risk:** Low

## TASK-096: Refresh architecture-facing docs after supplier-management final validation recovery
**Status:** Completed
**Priority:** Low
**Domain:** Architecture documentation / Governance baseline / Supplier management
**Requirement:** `specs/supplier-management`; final-cycle architecture refresh requested by `sdd-implementation-agent-24580e`
**Reason:** After the implemented supplier-management slice remained validated and the final cycle restored repository-wide `typecheck`, `lint`, and aggregate test health, the canonical architecture-facing docs still carried older RFQ-era statements that described repository-wide lint/test debt as current truth.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, and `docs/action-plan.md` now record the latest user-supplied final-cycle validation reality: `npm run typecheck` passed, `npm run lint` passed, and `npm test -- --silent` passed for the current implemented repository state, while preserving the remaining operational and architectural follow-up items that are still real.
**Implemented change:** Synchronized architecture-facing documentation to the final validated repository state without redesigning production code, schemas, or runtime contracts.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** User-supplied final validation evidence; active runtime/browser-governance documentation already in `docs/current-state.md`, `docs/architecture.md`, and `docs/action-plan.md`
**Database impact:** Documentation only; no schema or migration change
**API impact:** None; endpoint contracts remain unchanged
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because repository-wide validation posture is now aligned with the actual final cycle state
**Acceptance criteria:** Architecture-facing docs no longer describe repository-wide lint/test debt as current truth, they preserve the bounded same-origin helper and supplier-management runtime facts already documented, and they record the final-cycle green validation evidence without claiming direct command execution by this refresh
**Validation evidence:** User-supplied final-cycle results report `npm run typecheck` ✅, `npm run lint` ✅, and `npm test -- --silent` ✅
**Required tests:** Preserve the existing repository-wide validation gates and the supplier/RFQ/browser-governance characterization suites already named in the canonical docs
**Migration considerations:** Keep this refresh documentation-only and incremental; do not reinterpret the green validation baseline as proof that all architectural debt is removed
**Rollback or mitigation:** Revert documentation wording if a later verified repository state reintroduces aggregate validation failures
**Risk:** Low

## TASK-095: Refresh architecture-facing docs after `rfq-hardening-alignment`
**Status:** Completed
**Priority:** Low
**Domain:** Procurement / Public RFQ surface / RFQ tracking root shell / Architecture documentation
**Requirement:** `rfq-hardening-alignment`; mandatory post-implementation documentation refresh requested after RFQ throttling, lazy expiration persistence, runtime/OpenAPI alignment, and terminal expired-invitation rendering shipped
**Reason:** After the RFQ hardening slice landed, the canonical architecture-facing docs still described public RFQ throttling, runtime-contract alignment, and persisted `EXPIRED` materialization as open gaps, and they did not yet record the added runtime-governance test or the fact that broader full lint/test debt remains outside the RFQ slice.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now explicitly record route-specific public RFQ throttling (`GET /api/public/supplier-quotations/:token` => `30/min`, `POST /api/public/supplier-quotations/:token/response` => `10/min`), lazy persistence of stale invitations to `EXPIRED` on relevant public/internal RFQ access paths, synchronized root runtime/OpenAPI/runtime-catalog governance for RFQ surfaces, terminal expired-invitation rendering on the dedicated tracking UI, the new `tests/rfq-runtime-governance-alignment.test.js` baseline, and the fact that broader repo lint/test debt remains unrelated and still open.
**Implemented change:** Synchronized architecture-facing documentation to the actual repository state after `rfq-hardening-alignment` without changing production code.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Implemented code in `src/middlewares/request-throttle.js`, `src/routes/public-supplier-quotation.routes.js`, `src/services/procurement-rfq.service.js`, `src/public/root/runtime-contract.js`, `src/public/root/views/rfq-tracking-admin.renderers.js`, `docs/openapi/runtime-baseline.openapi.json`, `docs/runtime-endpoint-catalog.md`, and focused validation in `tests/rfq-runtime-governance-alignment.test.js` plus the existing RFQ contract/service/audit/browser suites
**Database impact:** Documentation now reflects the already-implemented lazy persisted `EXPIRED` transition behavior; no schema or migration change
**API impact:** Documentation now reflects the active public RFQ throttle contract, lazy expiration persistence semantics, and runtime/OpenAPI/catalog alignment without changing endpoint paths or payloads
**Container impact:** None
**Security impact:** Medium documentation-accuracy impact because the public RFQ hardening posture is now explicit while the remaining uncertainty is limited to broader deployment/store-mode operations rather than missing route protection in code
**Acceptance criteria:** Architecture-facing docs truthfully describe the implemented RFQ hardening behavior, the aligned runtime/OpenAPI/catalog surfaces, the terminal expired-invitation UI behavior, the added focused governance test, and the remaining broader governance debt outside the RFQ slice
**Validation evidence:** User-supplied results report `npm run typecheck` passed, targeted ESLint passed, and the targeted RFQ suite passed `103/103`, including `tests/rfq-runtime-governance-alignment.test.js`
**Required tests:** Preserve `tests/secure-token.test.js`, `tests/procurement-rfq-routes-contract.test.js`, `tests/procurement-rfq-service.test.js`, `tests/procurement-rfq-audit.test.js`, `tests/rfq-tracking-view-characterization.test.js`, `tests/root-shell-rfq-tracking-api-characterization.test.js`, and `tests/rfq-runtime-governance-alignment.test.js`
**Migration considerations:** Keep the docs explicit that this continuation closes the previously documented public-throttling, lazy-expiration-persistence, and RFQ runtime-governance gaps without introducing schema changes, inventory mutation, or broader repository-wide quality recovery
**Rollback or mitigation:** Revert documentation-only wording if later repository changes alter the throttle contract, expiration materialization semantics, approved RFQ browser/runtime inventory, or targeted validation evidence
**Risk:** Low

## TASK-094: Refresh architecture-facing docs after `supplier-rfq-requests` continuation
**Status:** Completed
**Priority:** Low
**Domain:** Procurement / RFQ tracking root shell / Audit instrumentation / Architecture documentation
**Requirement:** `supplier-rfq-requests`; mandatory post-continuation documentation refresh requested after the previously missing RFQ tracking page and audit coverage were implemented
**Reason:** After the follow-up continuation landed, the canonical architecture-facing docs still implied that RFQ tracking lived only inside `#cotizaciones` and did not yet record the dedicated `#seguimiento_cotizaciones` page, the new RFQ tracking browser modules, the request-item serialization used for manual capture, or the added RFQ audit coverage in `src/services/procurement-rfq.service.js`.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, and `docs/action-plan.md` now explicitly record the dedicated root-shell route/page `#seguimiento_cotizaciones`, browser modules `src/public/root/rfq-tracking-api.js`, `src/public/root/views/rfq-tracking-admin.js`, and `src/public/root/views/rfq-tracking-admin.renderers.js`, RFQ tracking payload serialization of purchase-request items for manual response capture, focused RFQ audit instrumentation in `src/services/procurement-rfq.service.js`, and the updated focused regression coverage for the RFQ tracking and audit seam.
**Implemented change:** Synchronized architecture-facing documentation to the actual repository state after the `supplier-rfq-requests` continuation without changing production code.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Active runtime and backend code in `src/public/root/manifest.js`, `src/public/root/router.js`, `src/public/root/index.html`, `src/public/root/rfq-tracking-api.js`, `src/public/root/views/rfq-tracking-admin.js`, `src/public/root/views/rfq-tracking-admin.renderers.js`, `src/routes/procurement-rfq.routes.js`, `src/routes/public-supplier-quotation.routes.js`, `src/services/procurement-rfq.service.js`, and focused validation in `tests/procurement-rfq-audit.test.js`, `tests/rfq-tracking-view-characterization.test.js`, `tests/root-shell-rfq-tracking-api-characterization.test.js`, `tests/root-shell-supply-manifest.test.js`, and `tests/root-shell-router-characterization.test.js`
**Database impact:** Documentation now reflects implemented RFQ tracking serialization/audit behavior; no schema or migration change
**API impact:** Documentation now reflects the dedicated RFQ tracking page consumption of `GET /api/procurement/rfq-tracking` and `POST /api/procurement/rfq-invitations/:id/manual-response` without changing endpoint paths or payloads
**Container impact:** None
**Security impact:** Medium documentation-accuracy impact because the new RFQ audit coverage is now explicit, while the remaining public-throttling and runtime-contract drift risks stay documented as open follow-up
**Acceptance criteria:** Architecture-facing docs truthfully describe the implemented dedicated RFQ tracking page, RFQ audit coverage, request-item-aware manual-capture payloads, focused validation evidence, and the remaining bounded RFQ governance gaps
**Validation evidence:** User-supplied results report `npm run typecheck`, targeted eslint, and RFQ suites green with 93 passing tests, including `tests/procurement-rfq-audit.test.js`, `tests/rfq-tracking-view-characterization.test.js`, `tests/root-shell-rfq-tracking-api-characterization.test.js`, `tests/root-shell-supply-manifest.test.js`, and `tests/root-shell-router-characterization.test.js`
**Required tests:** Preserve the named RFQ audit, RFQ tracking view/API, manifest, and router characterization suites together with the existing `tests/secure-token.test.js`, `tests/procurement-rfq-routes-contract.test.js`, and `tests/procurement-rfq-service.test.js` baseline
**Migration considerations:** Keep the docs explicit that this continuation closes the dedicated root follow-up page and audit-observability gap without changing the additive database model, without introducing inventory mutations, and without yet closing the public throttling or `runtime-contract.js` drift follow-ups
**Rollback or mitigation:** Revert documentation-only wording if later repository changes alter the dedicated RFQ tracking route, audit event coverage, or approved browser module inventory
**Risk:** Low

## TASK-093: Refresh architecture-facing docs after `supplier-rfq-requests` implementation
**Status:** Completed
**Priority:** Low
**Domain:** Procurement / Public supplier quotation surface / Architecture documentation
**Requirement:** `supplier-rfq-requests`; mandatory post-implementation documentation refresh requested after the RFQ invitation lifecycle shipped
**Reason:** After the supplier RFQ invitation lifecycle was implemented, the canonical architecture-facing docs still described procurement mainly in terms of purchase requests, quotations, comparison, selection, and purchase-order flows, and did not yet record the new invitation persistence model, the public token-based supplier flow, or the expanded `#cotizaciones` runtime scope.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, and `docs/action-plan.md` now explicitly record Prisma model `SupplierQuotationInvitation` plus enum `SupplierQuotationInvitationStatus`, migration `20260823000000_add_supplier_quotation_invitations`, the layered `procurement-rfq` backend module, the unauthenticated public route `/api/public/supplier-quotations/:token`, the internal RFQ routes under `/api/procurement/**`, `src/lib/secure-token.js` token-hash behavior, the public `/supplier-quote/` browser surface, the `#cotizaciones` RFQ UI additions, and the remaining security/automation gaps around public throttling and persisted `EXPIRED` transitions.
**Implemented change:** Synchronized architecture-facing documentation to the actual repository state after `supplier-rfq-requests`, preserving prior procurement refresh history while updating current truth and validation references without changing production code.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Active runtime and backend code in `prisma/schema.prisma`, `prisma/migrations/20260823000000_add_supplier_quotation_invitations/migration.sql`, `src/lib/secure-token.js`, `src/schemas/procurement-rfq.schema.js`, `src/repositories/procurement-rfq.repository.js`, `src/services/procurement-rfq.service.js`, `src/routes/procurement-rfq.routes.js`, `src/routes/public-supplier-quotation.routes.js`, `src/app.js`, `src/public/root/quotations-api.js`, `src/public/root/views/quotations-admin.helpers.js`, `src/public/root/views/quotations-admin.renderers.js`, `src/public/root/views/quotations-admin.js`, `src/public/supplier-quote/index.html`, `src/public/supplier-quote/app.js`, and focused validation in `tests/secure-token.test.js`, `tests/procurement-rfq-routes-contract.test.js`, and `tests/procurement-rfq-service.test.js`
**Database impact:** Documentation now reflects the already-implemented additive RFQ invitation table, enum, and migration; no new schema or migration added by this refresh
**API impact:** Documentation now reflects the active authenticated RFQ internal routes and the unauthenticated public supplier-quotation token contract without changing endpoint paths or payloads
**Container impact:** None
**Security impact:** Medium documentation-accuracy impact because token-hash-only persistence, tenant scoping, public CSP, and the remaining missing throttling/auto-expire gaps are now explicit as current truth
**Acceptance criteria:** Architecture-facing docs truthfully describe the completed `supplier-rfq-requests` feature state, including the internal/public route split, token-hash storage model, public browser surface, extended `#cotizaciones` workspace behavior, and remaining bounded RFQ risks
**Validation evidence:** User-supplied results report typecheck passed, lint passed, migration applied, and 66 new tests passed including `tests/secure-token.test.js`, `tests/procurement-rfq-routes-contract.test.js`, and `tests/procurement-rfq-service.test.js`
**Required tests:** Preserve `tests/secure-token.test.js`, `tests/procurement-rfq-routes-contract.test.js`, `tests/procurement-rfq-service.test.js`, and the existing root-shell quotations/runtime governance suites that cover `#cotizaciones`
**Migration considerations:** Keep the docs explicit that the RFQ slice is additive under the existing layered monolith, that the procurement area still remains non-stock-mutating until receipt confirmation, and that the public supplier token flow is intentionally unauthenticated but not yet separately rate-limited
**Rollback or mitigation:** Revert documentation-only wording if later repository changes alter the RFQ route surface, token-storage approach, or public supplier page exposure
**Risk:** Low

## TASK-092: Refresh architecture-facing docs after `procurement-quotation-workspace` `TASK-008` convergence closure
**Status:** Completed
**Priority:** Low
**Domain:** Procurement / Root shell runtime / Architecture documentation
**Requirement:** `specs/procurement-quotation-workspace`; mandatory post-implementation documentation refresh requested after final `TASK-008` closure
**Reason:** After all approved `procurement-quotation-workspace` tasks (`TASK-001` through `TASK-008`) were completed, the canonical architecture-facing docs needed to record the final integrated state rather than the earlier backend-only and root-shell-only checkpoints.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now explicitly record that convergence migrations `20260822000000_backfill_suppliers_permission_catalog` and `20260822001000_backfill_supplier_product_pricing_convergence` are present and tested, that the procurement quotations backend and root-shell `#cotizaciones` workspace are both implemented, that `tests/procurement-quotation-workspace-convergence.test.js` is the final cross-layer convergence suite for this feature, and that the remaining compras placeholders are exactly `#solicitudes_compra`, `#ordenes_compra`, `#recepciones`, and `#referencias_fiscales`.
**Implemented change:** Synchronized architecture-facing documentation to the actual repository state after `procurement-quotation-workspace` `TASK-008`, preserving earlier refresh history while updating current truth and validation references without changing production code.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Active runtime and backend code in `src/routes/procurement.routes.js`, `src/services/procurement.service.js`, `src/repositories/procurement.repository.js`, `src/schemas/procurement.schema.js`, `src/public/root/manifest.js`, `src/public/root/router.js`, `src/public/root/quotations-api.js`, `src/public/root/views/quotations-admin.helpers.js`, `src/public/root/views/quotations-admin.renderers.js`, `src/public/root/views/quotations-admin.js`, migrations `prisma/migrations/20260822000000_backfill_suppliers_permission_catalog/migration.sql` and `prisma/migrations/20260822001000_backfill_supplier_product_pricing_convergence/migration.sql`, and convergence coverage in `tests/procurement-quotation-workspace-convergence.test.js`
**Database impact:** Documentation only; no schema or migration change
**API impact:** Documentation now reflects the completed integrated procurement quotation-workspace contract without changing endpoint paths, payloads, or authorization semantics
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because the supported procurement workspace surface, tested convergence migrations, and remaining placeholder split are now explicit as current truth
**Acceptance criteria:** Architecture-facing docs truthfully describe the completed `procurement-quotation-workspace` feature state after `TASK-008`, include the final convergence suite, preserve the non-stock-mutating procurement truth, and identify the remaining compras placeholders exactly
**Validation evidence:** User-supplied results report the targeted `TASK-008` validation lane passed, including `node --test tests/suppliers-permission-catalog-backfill-migration.test.js tests/supplier-pricing-migration.test.js tests/procurement-foundation.test.js tests/procurement-routes-contract.test.js tests/root-shell-quotations-api-characterization.test.js tests/quotations-view-characterization.test.js tests/root-shell-supply-manifest.test.js tests/root-shell-router-characterization.test.js tests/public-surface-characterization.test.js tests/public-runtime-http-smoke.test.js tests/procurement-quotation-workspace-convergence.test.js`, plus `npm run typecheck` and targeted eslint
**Required tests:** Preserve `tests/suppliers-permission-catalog-backfill-migration.test.js`, `tests/supplier-pricing-migration.test.js`, `tests/procurement-foundation.test.js`, `tests/procurement-routes-contract.test.js`, `tests/root-shell-quotations-api-characterization.test.js`, `tests/quotations-view-characterization.test.js`, `tests/root-shell-supply-manifest.test.js`, `tests/root-shell-router-characterization.test.js`, `tests/public-surface-characterization.test.js`, `tests/public-runtime-http-smoke.test.js`, and `tests/procurement-quotation-workspace-convergence.test.js`
**Migration considerations:** Keep the docs explicit that the completed feature still stops at procurement quotation workspace and does not yet implement root-shell screens for `#solicitudes_compra`, `#ordenes_compra`, `#recepciones`, or `#referencias_fiscales`
**Rollback or mitigation:** Revert documentation-only wording if later repository changes alter the convergence suite, route surface, or remaining compras placeholder split
**Risk:** Low

## TASK-091: Refresh architecture-facing docs after `procurement-quotation-workspace` `TASK-007` root-shell quotations workspace implementation
**Status:** Completed
**Priority:** Low
**Domain:** Procurement / Root shell runtime / Architecture documentation
**Requirement:** `specs/procurement-quotation-workspace`; post-implementation documentation refresh requested after `TASK-007` for the implemented root-shell quotations workspace
**Reason:** After the procurement quotations workspace became reachable from the supported root shell, the canonical architecture-facing docs still described `#cotizaciones` as a placeholder route and did not yet record the approved runtime asset surface, router/manifest wiring, or the updated split between implemented versus still-pending compras entries.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now explicitly record that `#cotizaciones` is an implemented company-admin route, that the supported root runtime now includes `root/quotations-api.js`, `root/views/quotations-admin.helpers.js`, `root/views/quotations-admin.renderers.js`, and `root/views/quotations-admin.js`, that the procurement grouped quotation workflow is reachable from the root shell, and that the remaining compras placeholders are now only `#solicitudes_compra`, `#ordenes_compra`, `#recepciones`, and `#referencias_fiscales`.
**Implemented change:** Synchronized architecture-facing documentation to the actual repository state after `procurement-quotation-workspace` `TASK-007`, preserving the previously documented backend quotation-workspace foundation while updating root-shell/runtime truth and validation evidence without changing production code.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Active runtime code in `src/public/root/manifest.js`, `src/public/root/router.js`, `src/public/root/quotations-api.js`, `src/public/root/views/quotations-admin.helpers.js`, `src/public/root/views/quotations-admin.renderers.js`, `src/public/root/views/quotations-admin.js`, plus supported public-surface/runtime coverage in `tests/public-surface-characterization.test.js`, `tests/public-runtime-http-smoke.test.js`, `tests/root-shell-supply-manifest.test.js`, `tests/root-shell-router-characterization.test.js`, `tests/root-shell-quotations-api-characterization.test.js`, and `tests/quotations-view-characterization.test.js`
**Database impact:** Documentation only; no schema or migration change
**API impact:** Documentation now reflects the active root-shell consumption of the already-implemented procurement quotation-workspace backend contract without changing endpoint paths, payloads, or authorization semantics
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because the supported root runtime surface and implemented procurement route exposure are now explicit while remaining compras placeholders are not overstated as complete
**Acceptance criteria:** Architecture-facing docs truthfully describe `#cotizaciones` as an implemented root-shell route, list the supported quotations runtime assets, preserve the non-stock-mutating procurement truth, identify the remaining compras placeholders exactly, and record the supplied validation evidence without claiming broader production-code changes
**Validation evidence:** User-supplied results report targeted shell/runtime tests passed, `npm run typecheck` passed, and targeted eslint passed for the quotations workspace slice; repository evidence reviewed from the runtime files and named tests listed above
**Required tests:** Preserve `tests/public-surface-characterization.test.js`, `tests/public-runtime-http-smoke.test.js`, `tests/root-shell-supply-manifest.test.js`, `tests/root-shell-router-characterization.test.js`, `tests/root-shell-quotations-api-characterization.test.js`, and `tests/quotations-view-characterization.test.js`
**Migration considerations:** Keep the docs explicit that this slice closes the root-shell quotations workspace only; `#solicitudes_compra`, `#ordenes_compra`, `#recepciones`, and `#referencias_fiscales` remain pending root-shell placeholders
**Rollback or mitigation:** Revert documentation-only wording if later runtime changes retire the quotations route, change the approved asset surface, or alter the remaining compras placeholder split
**Risk:** Low

## TASK-090: Refresh architecture-facing docs after partial `procurement-quotation-workspace` backend implementation
**Status:** Completed
**Priority:** Low
**Domain:** Procurement / Supplier pricing / Architecture documentation
**Requirement:** `specs/procurement-quotation-workspace`; post-implementation documentation refresh requested after partial backend delivery by `sdd-implementation-agent-24580e`
**Reason:** After the approved backend portion of the procurement quotation workspace shipped, the canonical architecture-facing docs still described the procurement slice mainly in terms of request/quotation/comparison/selection/order flows and did not yet state that quotable-product listing, supplier-pricing lookup, grouped assisted quotation-request creation, supplier permission backfill, and pricing convergence migrations are now active repository truth.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, and `docs/action-plan.md` now explicitly record the active backend endpoints `GET /api/procurement/quotable-products`, `GET /api/procurement/products/:id/suppliers-pricing`, and `POST /api/procurement/products/:id/request-quotations`; the grouped assisted quotation payload contract in `src/schemas/procurement.schema.js`; additive supplier-pricing reads backed by `product_suppliers.unit_price` and `currency`; and the fact that root-shell/frontend procurement tasks remained pending at that earlier backend-only checkpoint even though these backend capabilities now exist.
**Implemented change:** Synchronized architecture-facing documentation to the actual repository state after the partial `procurement-quotation-workspace` backend implementation, and added a focused note file `docs/procurement-quotation-workspace-doc-refresh.md` summarizing the refresh scope and remaining frontend gap without changing production code.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`, `docs/procurement-quotation-workspace-doc-refresh.md`
**Dependencies:** Implemented backend changes in `src/routes/procurement.routes.js`, `src/services/procurement.service.js`, `src/repositories/procurement.repository.js`, `src/schemas/procurement.schema.js`, migrations `prisma/migrations/20260822000000_backfill_suppliers_permission_catalog/migration.sql` and `prisma/migrations/20260822001000_backfill_supplier_product_pricing_convergence/migration.sql`, and focused validation in `tests/procurement-foundation.test.js`, `tests/procurement-routes-contract.test.js`, `tests/suppliers-permission-catalog-backfill-migration.test.js`, and `tests/supplier-pricing-migration.test.js`
**Database impact:** Documentation now reflects already-implemented additive backfill/convergence migrations and additive supplier-pricing read dependencies; no new schema or migration added by this refresh
**API impact:** Documentation now reflects the active procurement quotation-workspace backend contract without changing endpoint paths, payloads, or authorization semantics
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because active procurement/supplier permission and pricing-read behavior is now explicit while the remaining runtime gaps for that earlier checkpoint were not misrepresented as implemented
**Acceptance criteria:** Architecture-facing docs truthfully describe the active procurement quotation-workspace backend surface, preserve the fact that procurement remains non-stock-mutating, and explicitly capture that this earlier refresh preceded the later root-shell quotations implementation
**Validation evidence:** Repository evidence reviewed from the changed backend files and focused tests listed above; this documentation refresh does not claim fresh command execution beyond repository inspection
**Required tests:** Preserve `tests/procurement-foundation.test.js`, `tests/procurement-routes-contract.test.js`, `tests/suppliers-permission-catalog-backfill-migration.test.js`, and `tests/supplier-pricing-migration.test.js`
**Migration considerations:** Keep the documentation explicit that these migrations are additive and that backend truth preceded the later procurement frontend/runtime implementation
**Rollback or mitigation:** Revert documentation-only wording if later repository changes alter the assisted quotation contract, supplier-pricing ownership, or procurement route surface
**Risk:** Low


## TASK-089: Refresh architecture-facing docs after supplier browser-runtime same-origin hardening
**Status:** Completed
**Priority:** Low
**Domain:** Browser runtime / Supplier management / Architecture documentation
**Requirement:** `specs/supplier-management`; post-debug documentation refresh requested by `sdd-implementation-agent-24580e`
**Reason:** After validating the supplier-management runtime, the shared browser auth helper was hardened so nested supported shells resolve root-relative API URLs against same origin, and local debugging also revealed that a host-side `node src/server.js` process on port `2500` can mask the Docker-published app and produce misleading supplier-route 404s.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, and `docs/action-plan.md` now record that `src/public/shared/auth.js` resolves `/api/**` calls such as `/api/auth/me`, `/api/auth/logout`, and `/api/suppliers/company` through `window.location.origin` before dispatch, preserving same-origin browser-session behavior under `/root/` and other nested shells, while also documenting the development-time host-port conflict risk on `2500`.
**Implemented change:** Synchronized architecture-facing documentation to the post-debug repository state for the supplier browser runtime and shared auth helper without changing backend contracts.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Active runtime code in `src/public/shared/auth.js`, `src/public/root/suppliers-api.js`, `src/public/root/views/suppliers-admin.js`; focused validation in `tests/public-auth-helper-characterization.test.js`, `tests/public-auth-helper-same-origin-resolution.test.js`, and `tests/root-shell-suppliers-api-characterization.test.js`
**Database impact:** Documentation only; no schema or migration change
**API impact:** Documentation now reflects same-origin URL resolution in the shared browser helper without changing endpoint paths or payloads
**Container impact:** Documentation now records the local host-port conflict risk that can hide the Docker-published app during debugging, but no container contract changed in this documentation refresh
**Security impact:** Low direct impact; medium documentation-accuracy impact because cookie-authenticated nested-shell API resolution is now explicit and the misleading local-port conflict is called out
**Acceptance criteria:** Architecture-facing docs explicitly state the shared auth helper same-origin resolution behavior and the local `2500` port-conflict debugging caveat without overstating any broader platform redesign
**Validation evidence:** `node --test tests/public-auth-helper-characterization.test.js tests/public-auth-helper-same-origin-resolution.test.js tests/root-shell-suppliers-api-characterization.test.js` passed; container verification confirmed `/health/ready` 200 and `/api/suppliers/company` 401 inside the active app runtime when unauthenticated
**Required tests:** Preserve the named shared-auth-helper and supplier browser-runtime characterization suites
**Migration considerations:** Keep this documentation refresh scoped to the browser helper/runtime behavior and local development diagnostics; do not imply broader auth-model or infrastructure redesign
**Rollback or mitigation:** Revert documentation-only wording if later runtime changes replace the shared helper resolution strategy or the local development port model
**Risk:** Low

## TASK-088: Refresh architecture-facing docs after `supplier-management`
**Status:** Completed
**Priority:** Low
**Domain:** Supply / Supplier management / Architecture documentation
**Requirement:** `specs/supplier-management`; post-implementation refresh requested by `sdd-implementation-agent-24580e`
**Reason:** After the approved supplier-management slice was validated, the canonical architecture-facing docs still described standalone supplier routes and the root-shell `#proveedores` destination as pending or placeholder-only behavior.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, and `docs/action-plan.md` now record that `/api/suppliers` is mounted for company-scoped supplier CRUD plus product assignment/removal, that mounted supplier routes actively consume `supplier.view` / `supplier.manage`, and that the root-shell company-admin route `#proveedores` is now an implemented destination rather than a shared `in_process` placeholder.
**Implemented change:** Synchronized architecture-facing documentation to the post-implementation repository state for `supplier-management`, documenting the active backend route group, authorization consumption, root-shell route exposure, and bounded browser runtime support without changing production code.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Active runtime code in `src/routes/supplier.routes.js`, `src/app.js`, `src/public/root/manifest.js`, `src/public/root/router.js`, `src/public/root/suppliers-api.js`, `src/public/root/views/suppliers-admin.js`; focused validation in `tests/supplier-routes-contract.test.js`, `tests/root-shell-suppliers-api-characterization.test.js`, `tests/suppliers-view-characterization.test.js`, `tests/root-shell-supply-manifest.test.js`, `tests/root-shell-router-characterization.test.js`, and `tests/runtime-contract-governance.test.js`
**Database impact:** Documentation only; no schema or migration change
**API impact:** Documentation now reflects the active `/api/suppliers` runtime contract without changing endpoint paths or payloads
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because active `supplier.view` / `supplier.manage` enforcement is now explicit
**Acceptance criteria:** Architecture-facing docs stop describing `/api/suppliers` and `#proveedores` as pending, accurately state the mounted route/policy/browser-runtime truth, and do not overstate broader procurement or quality scope
**Validation evidence:** `npx prisma validate` passed; `node --test tests/supplier-pricing-migration.test.js tests/supplier-schema.test.js tests/supplier-routes-contract.test.js tests/suppliers-view-characterization.test.js` passed; `node --test tests/runtime-contract-governance.test.js` passed; `node --test tests/root-shell-suppliers-api-characterization.test.js` passed; `node --test tests/suppliers-view-characterization.test.js` passed; `node --test tests/root-shell-supply-manifest.test.js` passed; `node --test tests/root-shell-router-characterization.test.js` passed; `npm run typecheck` passed; `npm test -- --silent` passed earlier in the cycle; scoped baseline audit verdict `8.4/10` `Acceptable` is documented as a warning below the preferred threshold
**Required tests:** Preserve the named supplier-management route, browser-runtime, router, manifest, runtime-governance, and aggregate validation evidence
**Migration considerations:** Keep this documentation refresh scoped to the implemented supplier-management slice; do not imply standalone quality routes, procurement-shell screens beyond suppliers, or external billing handoff completion
**Rollback or mitigation:** Revert documentation-only wording if later repository changes retire the supplier route group or change root-shell supplier exposure
**Risk:** Low

## TASK-087: Refresh architecture-facing docs after `platform-permission-catalog-filter`
**Status:** Completed
**Priority:** Low
**Domain:** Identity and access / Company-role governance / Architecture documentation
**Requirement:** `specs/platform-permission-catalog-filter`; post-implementation refresh requested by the user after implementation by `sdd-implementation-agent-a4adf0`
**Reason:** After the approved permission-catalog filtering slice shipped, the canonical architecture-facing docs still needed to state explicitly that `GET /api/roles/permissions` no longer returns platform-scoped permission entries to company-admin callers.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now record that `src/services/role.service.js` filters the metadata-enriched permission catalog by governance `scope` before returning it to company-admin callers, so platform-scoped permissions such as `companies.manage` no longer reach `#roles_permissions` through `GET /api/roles/permissions`.
**Implemented change:** Synchronized architecture-facing documentation to the post-implementation repository state for `platform-permission-catalog-filter`, documenting the server-side catalog filter, the unchanged defense-in-depth assignment denial for platform-scoped permissions, and the focused test evidence without changing production code.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Implemented service change in `src/services/role.service.js`; active route in `src/routes/role.routes.js`; focused validation in `tests/role-permissions-enrichment.test.js`
**Database impact:** Documentation only; no schema or migration change
**API impact:** Documentation now reflects the active runtime contract that `GET /api/roles/permissions` excludes platform-scoped permissions for company-admin callers while preserving the same endpoint path and metadata-enriched response shape for returned entries
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because the least-exposure behavior for the company-admin permission catalog is now explicit
**Acceptance criteria:** Architecture-facing docs state that company-admin callers of `GET /api/roles/permissions` do not receive platform-scoped permissions, preserve the truth that create/update governance denial remains in place as defense in depth, and reference the focused catalog-filter test evidence without overstating broader scope changes
**Validation evidence:** User-supplied results report `68/68` passing, `lint` passing, and `typecheck` passing after the implementation; focused repository evidence includes the added coverage in `tests/role-permissions-enrichment.test.js`
**Required tests:** Preserve `tests/role-permissions-enrichment.test.js`; keep the broader role-permission governance suites intact as existing supporting evidence
**Migration considerations:** Keep this documentation refresh scoped to the implemented server-side filter; do not imply bundle, governance-config, or UI redesign changes that were explicitly out of scope
**Rollback or mitigation:** Revert documentation-only wording if later repository changes alter the permission-catalog response contract or broaden the caller set beyond the current company-admin path
**Risk:** Low

## TASK-086: Add guardrail for permission-catalog config/seed/backfill drift
**Status:** Proposed
**Priority:** Medium
**Domain:** Identity and access / Supply governance / Database migration governance
**Requirement:** `supply-inventory-entry` remediation follow-up after migration `20260819000000_backfill_production_permission_catalog`
**Reason:** The current remediation now keeps the approved `recipes.*` and `production.*` permission rows aligned for fresh environments (`prisma/seed.js`) and already-provisioned databases (additive backfill migration), but repository truth still relies on manual coordination across governance metadata, seed data, and backfill SQL.
**Current problem:** `src/security/permission-governance.config.js`, `prisma/seed.js`, and `prisma/migrations/20260819000000_backfill_production_permission_catalog/migration.sql` can drift in future slices because no automated guardrail currently verifies that approved permission codes remain synchronized across those sources.
**Proposed change:** Add an approved automated guardrail that compares the active governance-backed permission catalog against the seeded and backfilled recipes/production permission rows, failing fast when approved codes diverge across config, seed, or remediation migration sources.
**Affected files:** `src/security/permission-governance.config.js`, `prisma/seed.js`, `prisma/migrations/20260819000000_backfill_production_permission_catalog/migration.sql`, new or updated governance tests/scripts, `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Current metadata enrichment in `src/services/role.service.js`; active role-permission route at `src/routes/role.routes.js`; existing targeted tests `tests/role-permissions-enrichment.test.js`, `tests/role-permissions-route.test.js`, and `tests/production-permission-catalog-backfill-migration.test.js`
**Database impact:** None expected unless a later approved approach adds catalog-version tracking or broader remediation migrations
**API impact:** None expected; the task preserves current `GET /api/roles/permissions` and root `#roles_permissions` behavior
**Container impact:** None
**Security impact:** Medium positive impact because drift in approved permission rows can silently break authorization-dependent administration surfaces on upgraded databases
**Acceptance criteria:** A repeatable automated check fails when approved recipes/production permission definitions diverge across governance config, seed data, or backfill SQL, and current docs describe the synchronized catalog truth without reintroducing the closed existing-database gap
**Required tests:** `tests/production-permission-catalog-backfill-migration.test.js`, `tests/role-permissions-enrichment.test.js`, `tests/role-permissions-route.test.js`, any new drift-guardrail suite, plus existing lint/typecheck/build guardrails
**Migration considerations:** Keep the current remediation additive; do not rewrite prior applied migrations or remove the existing backfill path for already-provisioned databases
**Rollback or mitigation:** If the guardrail proves too brittle, keep the current backfill + seed baseline and narrow the check scope rather than removing the existing remediation path
**Risk:** Medium

## TASK-085: Refresh architecture-facing docs after production permission-catalog remediation
**Status:** Completed
**Priority:** Low
**Domain:** Identity and access / Supply governance / Architecture documentation
**Requirement:** Post-implementation refresh requested by the user after remediation in feature `supply-inventory-entry`; implementation executed by `sdd-implementation-agent-e8c511`
**Reason:** After the additive existing-database permission-catalog remediation shipped, the canonical architecture-facing docs still described the recipes/production permission gap mainly in terms of seed alignment and did not yet reflect the new additive backfill migration or its targeted validation evidence.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now state that migration `20260819000000_backfill_production_permission_catalog` upserts/reactivates the approved `recipes.*` and `production.*` permission rows required by `GET /api/roles/permissions` and the root `#roles_permissions` UI, closing the previously documented existing-database catalog gap for this scope.
**Implemented change:** Synchronized architecture-facing documentation to the post-remediation repository state, documenting the additive backfill migration, the current role-permission surface dependency on those rows, the updated residual-risk posture, and the supplied targeted validation evidence without changing production code.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Implemented migration `prisma/migrations/20260819000000_backfill_production_permission_catalog/migration.sql`; tests `tests/production-permission-catalog-backfill-migration.test.js`, `tests/role-permissions-enrichment.test.js`, `tests/role-permissions-route.test.js`; active runtime consumers in `src/services/role.service.js`, `src/routes/role.routes.js`, and `src/public/root/views/roles-admin.js`
**Database impact:** Documentation now reflects the already-implemented additive backfill migration for existing databases; no new schema or migration added by this refresh
**API impact:** Documentation now reflects the existing `GET /api/roles/permissions` and root `#roles_permissions` dependency on approved recipes/production permission rows without changing runtime contracts
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because the closed existing-database permission gap and the remaining drift-guardrail follow-up are now explicit
**Acceptance criteria:** Architecture-facing docs record the additive backfill migration, stop treating the recipes/production permission gap for existing databases as an open current defect, and preserve the remaining follow-up need for automated config/seed/backfill drift detection
**Validation evidence:** User-supplied results report targeted remediation suites passing (`16/16`) across `tests/production-permission-catalog-backfill-migration.test.js`, `tests/role-permissions-enrichment.test.js`, and `tests/role-permissions-route.test.js`, together with `npm run lint`, `npm run typecheck`, `npx prisma validate --schema prisma/schema.prisma`, and `npm run build`; pre-existing unrelated Windows Prisma file-lock/full-suite characterization issues remain documented
**Required tests:** Preserve `tests/production-permission-catalog-backfill-migration.test.js`, `tests/role-permissions-enrichment.test.js`, `tests/role-permissions-route.test.js`, and the supplied lint/typecheck/prisma-validate/build evidence
**Migration considerations:** Keep the current remediation documented as additive and safe for already-provisioned databases; do not imply that historical applied migrations were rewritten
**Rollback or mitigation:** Revert documentation-only wording if later repository changes materially alter the permission-catalog remediation path or broaden the scope beyond the approved recipes/production rows
**Risk:** Low

## TASK-084: Refresh architecture-facing docs after `session-docs-tenant-hardening` `TASK-008` final validation closeout
**Status:** Completed
**Priority:** Low
**Domain:** Identity and access / Governance validation / Architecture documentation
**Requirement:** `specs/session-docs-tenant-hardening`; final validation closeout requested by `sdd-implementation-agent-a4adf0`
**Reason:** After the final focused plus aggregate validation cycle completed, the canonical architecture-facing docs still described the reviewed auth/runtime seam as awaiting aggregate closure and did not yet classify the remaining `9.4/10` audit posture as operational/maintainability follow-up.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now record that the aggregate suite is green, that focused compatibility/governance/tenant/session evidence is closed for the reviewed seam, and that the remaining audit warnings are tracked as operational/maintainability follow-up rather than confirmed regressions.
**Implemented change:** Synchronized architecture-facing documentation to the post-implementation state of `session-docs-tenant-hardening` `TASK-008`, documenting the green aggregate evidence, the closed focused validation lane, the discarded invalid parallel validation attempt, and the remaining warning posture without changing production code.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** User-supplied validation evidence for `tests/governance-baseline-sync-guardrails.test.js`, `tests/access-policies.test.js`, `tests/critical-contract-governance.test.js`, `tests/permission-governance-backend-consumption.test.js`, auth/runtime compatibility suites, `npm run test -- --silent`, `npm run lint`, `npm run typecheck`, and `npm run build`; current repository truth in `docs/critical-contract-matrix.json`
**Database impact:** Documentation only; no schema or migration change
**API impact:** Documentation now reflects the already-implemented validation closure without changing runtime contracts
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because the green validation lane and the remaining warning posture are now explicit and no longer misclassified as active regressions
**Acceptance criteria:** Architecture-facing docs state that the reviewed `session-docs-tenant-hardening` seam has green focused and aggregate evidence, do not continue treating `TASK-008` as pending, and classify the remaining `9.4/10` audit concerns as operational/maintainability follow-up only
**Validation evidence:** User-supplied results report targeted compatibility/governance/tenant/session suites passing, `npm run test -- --silent` passing with `812` tests (`810` pass, `0` fail, `2` skipped), `npm run lint` passing, `npm run typecheck` passing, `npm run build` passing, and a baseline audit verdict of `9.4/10` with verdict `Acceptable`; the earlier invalid parallel `test` + `build` attempt was explicitly discarded
**Required tests:** Preserve the focused auth/runtime, governance, tenant-scope, session-invalidation, and aggregate validation suites already named in the supplied evidence; do not weaken coverage to preserve closure wording
**Migration considerations:** Keep the docs aligned with the isolated aggregate rerun evidence and avoid restating the discarded parallel attempt as valid proof
**Rollback or mitigation:** Revert documentation wording if later repository changes reopen the validation lane or materially change the remaining warning posture
**Risk:** Low

## TASK-083: Refresh architecture-facing docs after auth/runtime compatibility validation
**Status:** Completed
**Priority:** Low
**Domain:** Identity and access / Embedded browser runtime / Architecture documentation
**Requirement:** `specs/session-docs-tenant-hardening`; post-implementation refresh requested by `sdd-implementation-agent-a4adf0` after `TASK-007 Validate backward compatibility of auth/runtime behavior`
**Reason:** After the focused compatibility-validation cycle completed, the canonical architecture-facing docs still needed to state explicitly that supported auth-route compatibility evidence exists, that browser-session login/me/logout behavior remains compatible in the reviewed seam, that root-shell actor-scoped fallback behavior remains compatible in the reviewed seam, and that repository-wide aggregate confidence is still gated by pending `TASK-008`.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now explicitly record the focused TASK-007 validation evidence for `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`, root-shell router fallback behavior, and the remaining dependency on `TASK-008` for broader aggregate compatibility confidence.
**Implemented change:** Synchronized architecture-facing documentation to the post-implementation state of `session-docs-tenant-hardening` `TASK-007`, documenting the reviewed auth/runtime compatibility seam without changing production code or overstating repository-wide closure.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Focused validation evidence from `tests/browser-session-auth-boundary.test.js`, `tests/root-shell-router-characterization.test.js`, `tests/root-shell-route-governance.test.js`, `npm run lint`, and `npm run typecheck`; supporting runtime truth in `src/app.js`, `src/routes/auth.routes.js`, `src/middlewares/authenticate.js`, and `src/public/root/router.js`
**Database impact:** Documentation only; no schema or migration change
**API impact:** Documentation now reflects the already-implemented supported auth-route and root-shell compatibility baseline without changing runtime contracts
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because the reviewed compatibility seam and the remaining aggregate-confidence limitation are now explicit
**Acceptance criteria:** Architecture-facing docs mention the focused compatibility evidence for supported auth routes and root-shell fallback behavior, preserve the current browser-session semantics truthfully, and state that aggregate compatibility confidence still depends on pending `TASK-008`
**Validation evidence:** User-supplied results report `node --test tests/browser-session-auth-boundary.test.js`, `node --test tests/root-shell-router-characterization.test.js`, `node --test tests/root-shell-route-governance.test.js`, `npm run lint`, and `npm run typecheck` all passing after the implementation cycle; baseline audit verdict supplied by the user is `9.2/10` with verdict `Acceptable`
**Required tests:** Preserve `tests/browser-session-auth-boundary.test.js`, `tests/root-shell-router-characterization.test.js`, `tests/root-shell-route-governance.test.js`, and keep the broader aggregate confidence gate explicit through pending `TASK-008`
**Migration considerations:** Keep the docs explicit that this refresh closes focused compatibility documentation only; do not treat the TASK-007 evidence as full-repository aggregate verification
**Rollback or mitigation:** Revert documentation-only wording if later repository changes alter supported auth-route behavior, root-shell fallback semantics, or the remaining aggregate-validation dependency
**Risk:** Low

## TASK-082: Refresh architecture-facing docs after focused docs/contracts/tests sync coverage
**Status:** Completed
**Priority:** Low
**Domain:** Governance documentation / Runtime-contract governance / Company-role update seam
**Requirement:** `specs/session-docs-tenant-hardening`; post-implementation refresh requested by the user after `TASK-006`
**Reason:** After the implemented focused governance/doc-sync follow-up, the canonical architecture-facing docs still did not fully state that the new drift guardrails are intentionally bounded, that canonical docs plus runtime-contract artifacts now explicitly freeze the role-update seam, or that the bounded OpenAPI consistency guardrail now covers `PUT /api/roles/company/{roleId}`.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now explicitly record that the focused governance/doc-sync seam is intentionally narrow, that canonical `docs/**` plus runtime-contract artifacts are the authority for the audited role-update surface, that the role-update seam is frozen by focused route/service/browser-session tests, and that `tests/openapi-contract-consistency.test.js` explicitly covers `PUT /api/roles/company/{roleId}` in the reviewed partial OpenAPI baseline.
**Implemented change:** Synchronized architecture-facing documentation to the post-implementation state of `session-docs-tenant-hardening` `TASK-006`, documenting the intentionally bounded guardrail scope, the canonical docs/runtime-contract freeze around the role-update seam, and the explicit OpenAPI consistency coverage for the company-role update operation without changing runtime behavior.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Implemented guardrail changes in `tests/governance-baseline-sync-guardrails.test.js`, `tests/openapi-contract-consistency.test.js`, and the canonical runtime-contract artifacts under `docs/**`
**Database impact:** Documentation only; no schema or migration change
**API impact:** Documentation now reflects the already-implemented bounded OpenAPI coverage for `PUT /api/roles/company/{roleId}` without changing runtime contracts
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because the guarded role-update seam and the intentionally bounded scope of the drift tests are now explicit
**Acceptance criteria:** Architecture-facing docs state that the focused governance/doc-sync guardrail is intentionally bounded, identify canonical docs/runtime-contract artifacts as the authority for the role-update seam, and mention that `tests/openapi-contract-consistency.test.js` explicitly includes `PUT /api/roles/company/{roleId}`
**Validation evidence:** User-supplied results report `node --test tests/governance-baseline-sync-guardrails.test.js`, `node --test tests/documentation-ownership-governance.test.js`, `node --test tests/openapi-contract-consistency.test.js`, `npm run lint`, and `npm run typecheck` all passing after the implementation cycle
**Required tests:** Preserve `tests/governance-baseline-sync-guardrails.test.js`, `tests/documentation-ownership-governance.test.js`, `tests/openapi-contract-consistency.test.js`, and the supplied lint/typecheck evidence
**Migration considerations:** Keep the docs explicit that these guardrails are focused drift detectors for selected truths only and do not represent full repository-wide semantic verification
**Rollback or mitigation:** Revert documentation-only wording if later repository changes materially widen or narrow the guardrail scope or change the covered role-update contract surface
**Risk:** Low

## TASK-081: Refresh architecture-facing docs after tenant-scoped role-read hardening
**Status:** Completed
**Priority:** Low
**Domain:** Company-role governance / Company-user provisioning / Architecture documentation
**Requirement:** `specs/session-docs-tenant-hardening`; post-implementation refresh requested by the user after `TASK-005`
**Reason:** After the implemented tenant role-read hardening slice, the canonical architecture-facing docs still described the repository lookup boundary too broadly and did not fully reflect the new scoped-first read behavior for company-role updates and company-user creation.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now describe that `role.repository.findCompanyOwnedRoleById(...)` is used first for company-role updates, `role.repository.findAssignableRoleByIdForCompany(...)` is used first for company-user creation, active global non-root roles remain assignable when they satisfy the scoped assignable lookup, and the remaining broad `findRoleById(...)` read is retained only as a narrow fallback for differentiated `404` / `403` / `400` semantics.
**Implemented change:** Synchronized architecture-facing documentation to the post-implementation state of `session-docs-tenant-hardening` `TASK-005`, documenting the stronger repository boundary, the preserved classification-only fallback behavior, and the unchanged residual risks around post-commit session invalidation ambiguity and Redis reverse-index hygiene.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Implemented repository changes in `src/repositories/role.repository.js`, `src/services/role.service.js`, `src/services/user.service.js`, and validation evidence from `tests/role-update-service.test.js`, `tests/user-company-role-scope.test.js`, `tests/audit-instrumentation.test.js`, `tests/bcrypt-supply-chain-closeout.test.js`, `tests/browser-session-auth-boundary.test.js`, `npm run lint`, and `npm run typecheck`
**Database impact:** Documentation only; no schema or migration change
**API impact:** Documentation now reflects the already-implemented scoped-first lookup behavior without changing runtime contracts
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because tenant role-read boundaries and remaining fallback semantics are now explicit
**Acceptance criteria:** Architecture-facing docs record the scoped-first repository reads for role update and company-user creation, preserve the truth that active global non-root roles remain assignable, and keep the remaining fallback and post-commit invalidation limitations explicit without overstating the hardening
**Validation evidence:** User-supplied results report `node --test tests/role-update-service.test.js`, `node --test tests/user-company-role-scope.test.js`, `node --test tests/audit-instrumentation.test.js`, `node --test tests/bcrypt-supply-chain-closeout.test.js`, `node --test tests/browser-session-auth-boundary.test.js`, `npm run lint`, and `npm run typecheck` all passing after the implementation cycle
**Required tests:** Preserve `tests/role-update-service.test.js`, `tests/user-company-role-scope.test.js`, `tests/audit-instrumentation.test.js`, `tests/bcrypt-supply-chain-closeout.test.js`, `tests/browser-session-auth-boundary.test.js`, and the supplied lint/typecheck evidence
**Migration considerations:** Keep the current documentation explicit that fallback broad reads still exist for classification semantics and that the browser-session invalidation step remains post-persistence
**Rollback or mitigation:** Revert documentation-only wording if later repository changes materially alter the scoped lookup contract or retire the remaining fallback path
**Risk:** Low

## TASK-080: Clarify or mitigate post-commit role-update session-invalidation failures
**Status:** Proposed
**Priority:** High
**Domain:** Identity and access / Company-role governance / Browser-session reliability
**Requirement:** `specs/session-docs-tenant-hardening`; baseline audit follow-up noted by `sdd-implementation-agent-a4adf0`
**Reason:** Repository truth now shows that successful company-role updates trigger targeted browser-session invalidation, but that invalidation is executed after persistence.
**Current problem:** `src/services/role.service.js` commits the role-permission update before calling browser-session invalidation. If the browser-session store is unavailable, the API can return `503 service_unavailable` even though the permission change already committed, creating an ambiguous post-commit error contract for operators and clients.
**Proposed change:** Evaluate and implement an approved mitigation for post-commit invalidation failure semantics, such as explicit response-contract clarification, compensating retry/outbox handling, or stronger operational observability, while preserving the current security goal that affected sessions must not continue with stale permissions silently.
**Affected files:** `src/services/role.service.js`, `src/services/browser-session.service.js`, related audit/role/session tests, `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Implemented targeted invalidation in `src/services/browser-session.service.js`; implemented role-update coupling in `src/services/role.service.js`
**Database impact:** None unless a later approved retry/outbox design introduces persistence for deferred invalidation work
**API impact:** Possible clarification or adjustment of the role-update error contract; backward compatibility review required
**Container impact:** None unless a later approved async worker/retry mechanism is introduced
**Security impact:** Medium to High because the task affects how quickly and transparently permission changes converge during partial infrastructure failure
**Acceptance criteria:** The repository documents and/or implements an approved strategy for role-update cases where persistence succeeds but session invalidation fails, and regression tests cover the chosen behavior without weakening the security boundary
**Required tests:** `tests/role-update-service.test.js`, `tests/browser-session-auth-boundary.test.js`, any new failure-semantics characterization, plus existing lint/typecheck guardrails
**Migration considerations:** Preserve the current successful invalidation behavior and avoid implying transactional coupling with Redis unless that design is explicitly approved
**Rollback or mitigation:** Keep any mitigation incremental so the flow can fall back to the current explicit `503` behavior if the new strategy proves too risky
**Risk:** High

## TASK-079: Prune stale Redis browser-session user membership sets
**Status:** Proposed
**Priority:** Medium
**Domain:** Identity and access / Browser-session infrastructure
**Requirement:** `specs/session-docs-tenant-hardening`; baseline audit follow-up noted by `sdd-implementation-agent-a4adf0`
**Reason:** The Redis browser-session adapter now keeps user-scoped session-ID sets to enable targeted invalidation, but repository truth still shows no cleanup path for stale set members left behind after natural session-key expiry.
**Current problem:** `src/services/browser-session-redis.store.js` removes membership on explicit invalidation, but naturally expired session keys can leave orphaned IDs in the user-scoped Redis set, increasing reverse-index drift and unnecessary work during later invalidation calls.
**Proposed change:** Add safe reverse-index hygiene for Redis-backed browser sessions, either by pruning missing session IDs during user/batch invalidation and lookup-adjacent paths or by introducing an approved cleanup mechanism that preserves the current raw-socket adapter boundary.
**Affected files:** `src/services/browser-session-redis.store.js`, targeted browser-session tests, `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Current targeted invalidation primitives in `src/services/browser-session.service.js` and `src/services/browser-session-redis.store.js`; existing Redis-path coverage in `tests/browser-session-redis-store.test.js`
**Database impact:** None
**API impact:** None unless a later approved slice exposes operational metrics or admin controls for cleanup state
**Container impact:** None expected unless a later approved cleanup worker is introduced
**Security impact:** Low direct confidentiality impact; medium session-governance integrity/operability impact because stale reverse-index entries can weaken confidence in targeted invalidation hygiene
**Acceptance criteria:** Redis-backed targeted invalidation no longer leaves unbounded stale user-set memberships after natural key expiry, and regression tests cover the approved cleanup behavior without changing current login/logout contracts
**Required tests:** `tests/browser-session-redis-store.test.js`, relevant auth/session regression suites, and any new DB-free characterization for stale-membership cleanup
**Migration considerations:** Preserve the current Redis key prefixes and supported session contracts; avoid introducing background infrastructure unless explicitly approved
**Rollback or mitigation:** Keep cleanup additive and reversible so the store can fall back to the current explicit-invalidation-only behavior if the hygiene path causes regressions
**Risk:** Medium

## TASK-078: Integrate role updates with targeted browser-session invalidation
**Status:** Completed
**Priority:** High
**Domain:** Identity and access / Company-role governance
**Requirement:** `specs/session-docs-tenant-hardening`; existing role-governance update flow documented in `docs/current-state.md`
**Reason:** The browser-session service exposed targeted invalidation primitives by user and deduplicated user batches, and the reviewed role-update flow needed to invoke them to prevent stale browser authorization state.
**Current problem resolved:** Successful company-role permission updates now resolve active users assigned to the changed role, invalidate only those users' browser sessions with reason `role_permission_change`, preserve unaffected sessions, and force subsequent affected browser requests such as `GET /api/auth/me` to fail until a new login occurs.
**Implemented change:** Wired the approved role-permission mutation flow to call `browserSessionService.invalidateBrowserSessionsForUsers(...)` after successful persistence, using `userRepository.findActiveUsersByRoleId(...)` to resolve the impacted active tenant users while preserving the current `PUT /api/roles/company/:roleId` contract and existing audit semantics.
**Affected files:** `src/services/role.service.js`, `src/repositories/user.repository.js`, `src/services/browser-session.service.js`, `tests/role-update-service.test.js`, `tests/browser-session-auth-boundary.test.js`, `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Current role update flow in `src/services/role.service.js`; targeted invalidation primitives in `src/services/browser-session.service.js`; browser-session store readiness/error semantics
**Database impact:** None
**API impact:** No success-path contract change; current failure-path behavior still allows `503 service_unavailable` when invalidation fails after persistence, which is tracked separately
**Container impact:** None
**Security impact:** Medium to High positive impact because permission changes now converge immediately for already-authenticated browser sessions by forcing re-authentication
**Acceptance criteria:** Approved role-update flows invalidate the affected browser sessions through the existing service seam, unrelated sessions are preserved, and regression tests prove that affected stale browser sessions no longer continue authenticating after a successful role change
**Required tests:** `tests/role-update-service.test.js`, `tests/browser-session-auth-boundary.test.js`, plus existing lint/typecheck guardrails named in the supplied implementation evidence
**Migration considerations:** Preserve current role-update API semantics; note that invalidation remains post-persistence and therefore is not transactionally coupled to the role update
**Rollback or mitigation:** The integration remains behind the current service boundary, so the flow could revert to refresh-on-next-auth behavior if a later approved change requires decoupling
**Risk:** High

## TASK-077: Refresh architecture-facing docs after browser-session targeted invalidation primitives
**Status:** Completed
**Priority:** Low
**Domain:** Identity and access / Architecture documentation
**Requirement:** `specs/session-docs-tenant-hardening`; post-implementation refresh requested by `sdd-implementation-agent-a4adf0`
**Reason:** After `TASK-003` added targeted browser-session invalidation primitives, the canonical architecture-facing docs still needed to reflect the actual implemented service/store behavior and the remaining pending role-update integration.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` were synchronized to describe the new user- and batch-scoped invalidation primitives, the memory-store reverse index, the Redis user-scoped session-ID sets plus `SMEMBERS` array parsing, the focused test coverage, and the then-remaining gaps around role-update integration and stale Redis user-set memberships.
**Implemented change:** Synchronized architecture-facing documentation to the post-implementation state of the browser-session targeted invalidation slice without changing production code or public API contracts.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Implemented repository changes in `src/services/browser-session.service.js`, `src/services/browser-session-memory.store.js`, `src/services/browser-session-redis.store.js`, `tests/browser-session-targeted-invalidation.test.js`, and `tests/browser-session-redis-store.test.js`
**Database impact:** Documentation only; no schema or migration change
**API impact:** Documentation now reflects internal service/store capabilities only; no new public endpoint was introduced in this refresh
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because session invalidation boundaries and remaining convergence gaps are now explicit
**Acceptance criteria:** Architecture-facing docs record targeted invalidation primitives, reverse-index/store details, the tested current behavior at that time, and the then-pending role-update integration truthfully
**Required tests:** Preserve `tests/browser-session-targeted-invalidation.test.js`, `tests/browser-session-redis-store.test.js`, `tests/browser-session-auth-boundary.test.js`, plus the supplied `npm run lint` and `npm run typecheck` validation baseline
**Migration considerations:** Keep the docs aligned with the current internal-only invalidation seam until a later approved slice changes runtime integration or exposes new contracts
**Rollback or mitigation:** Revert documentation wording if later repository changes alter the targeted invalidation seam or close the pending role-update/stale-membership gaps
**Risk:** Low

## TASK-076: Refresh architecture-facing docs after session-docs/governance and company-admin production-bundle alignment
**Status:** Completed
**Priority:** Low
**Domain:** Root shell governance / Role-governance baseline / Permission bundle documentation
**Requirement:** `specs/session-docs-tenant-hardening`, `specs/supply-inventory-entry` `TASK-019`; post-implementation refresh requested by `sdd-implementation-agent-a4adf0`
**Reason:** After the implemented router/governance/bundle follow-up, the canonical architecture-facing docs did not yet explicitly capture the current root-shell router dependencies for `#recetas` and `#produccion_ordenes`, the guarded current truth that runtime company-role update exists, or the updated `company_admin` default production-permission grouping.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, and `docs/action-plan.md` now state that `root/router.js` explicitly depends on `views.recipesAdmin` and `views.productionOrdersAdmin`, that `tests/governance-baseline-sync-guardrails.test.js` guards canonical `docs/**` ownership plus the current `PUT /api/roles/company/:roleId` truth, and that the implemented `company_admin` bundle includes `recipes.*` plus `production.*` by default while excluding `quality.*` from that grouping.
**Implemented change:** Synchronized architecture-facing documentation to the post-implementation state of the completed session-docs/governance and permission-governance follow-up, documenting router dependency truth, current documentation guardrail truth, metadata-backed production-category grouping in the root roles-permissions path, the default `company_admin` bundle coverage, and the remaining limitation that bundles are still governance metadata rather than runtime-enforced personas.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Implemented repository changes in `src/public/root/router.js`, `src/security/role-bundles.config.js`, `tests/root-shell-router-characterization.test.js`, `tests/governance-baseline-sync-guardrails.test.js`, `tests/permission-governance-foundation.test.js`, and `tests/root-roles-permissions-governance.test.js`
**Database impact:** Documentation only in this refresh; records current permission-catalog and bundle truth without schema or migration changes
**API impact:** Documentation now reflects the already-implemented metadata-backed roles-permissions catalog and existing `PUT /api/roles/company/:roleId` truth without changing runtime contracts
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because company-role governance truth and bundle boundaries are now explicit
**Acceptance criteria:** Architecture-facing docs explicitly record the router dependencies for `#recetas` / `#produccion_ordenes`, the current company-role update governance truth, and that the approved production grouping for this scope is `recipes.*` + `production.*`, excluding `quality.*`
**Validation evidence:** User-supplied results report router characterization, governance baseline sync, documentation ownership governance, OpenAPI consistency, permission governance foundation, root roles-permissions governance, lint, typecheck, and build all passing after the implementation cycle
**Required tests:** Preserve `tests/root-shell-router-characterization.test.js`, `tests/governance-baseline-sync-guardrails.test.js`, `tests/permission-governance-foundation.test.js`, `tests/root-roles-permissions-governance.test.js`, `tests/openapi-contract-consistency.test.js`, and the broader lint/typecheck/build guardrails named in the supplied validation evidence
**Migration considerations:** Keep bundle behavior documented as metadata-backed guidance only until a later approved slice adds runtime enforcement, seeded presets, or broader persona coverage
**Rollback or mitigation:** Revert documentation-only wording if later repository changes alter the router dependency map, production-category grouping, or bundle composition
**Risk:** Low

## TASK-075: Refresh architecture-facing docs after `audit-findings-remediation` role-governance update flow
**Status:** Completed
**Priority:** Low
**Domain:** Company-role governance / Root roles admin UI / Architecture documentation
**Requirement:** `specs/audit-findings-remediation`; post-implementation refresh requested by the user after the approved remediation slice
**Reason:** After the implemented role-governance remediation, the canonical architecture-facing docs still contained stale statements that the runtime had no company-role update flow and that the roles admin shell was limited to list/create behavior only.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, and `docs/action-plan.md` now describe the active `PUT /api/roles/company/:roleId` backend surface, the metadata-enriched permission catalog returned by `GET /api/roles/permissions`, the editable `#roles_permissions` shell workflow, the read-only treatment of global roles, the self-lockout guard for own-role edits, and the remaining advisory risks around session-permission refresh timing plus the then-current reliance on a broader repository lookup path.
**Implemented change:** Synchronized architecture-facing documentation to the post-implementation state of the `audit-findings-remediation` role-governance slice, documenting the enriched permission catalog fields, the `role.company.update` access-policy requirement for `settings.manage`, the transactional role-permission replacement path, the denial-audit actions `roles.company.create.governance_denied` / `roles.company.update.governance_denied`, the updated root roles admin browser behavior, and the fact that `prisma/seed.js` now includes the missing active permission definitions needed by the current catalog.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Implemented repository changes in `src/security/**`, `src/routes/role.routes.js`, `src/services/role.service.js`, `src/repositories/role.repository.js`, `src/schemas/role.schema.js`, `src/public/root/**`, and `prisma/seed.js`
**Database impact:** Documentation only in this refresh; records that the permission seed catalog is now aligned for the implemented role-governance surface, with no Prisma schema migration added by this doc task
**API impact:** Documentation now reflects the active `PUT /api/roles/company/:roleId` contract and the metadata-enriched `GET /api/roles/permissions` response without changing the runtime contracts themselves
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because the active tenant role-update boundary, self-lockout protection, and remaining session-refresh/repository-boundary advisory risks are now explicit
**Acceptance criteria:** Architecture-facing docs no longer claim that role updates are unimplemented, record the actual root roles admin edit workflow and permission catalog metadata shape, and keep the remaining advisory risks explicit without redesigning the module
**Validation evidence:** User-supplied results report `npm run lint`, `npm run typecheck`, `npm run build`, `npm run validate:public-runtime`, 35 feature-specific tests, `tests/runtime-contract-governance.test.js`, and `tests/pagination.test.js` all passing; repository inspection also confirms mounted `PUT /api/roles/company/:roleId`, enriched `role.service.js` serialization, `roles-api.js.updateRole(...)`, and the updated roles-admin browser workflow
**Required tests:** Preserve `tests/role-update-service.test.js`, `tests/role-update-authorization.test.js`, `tests/role-permissions-enrichment.test.js`, `tests/runtime-contract-governance.test.js`, and the broader lint/typecheck/build/public-runtime guardrails named in the supplied validation evidence
**Migration considerations:** Keep the current update flow documented as additive within the existing layered monolith; do not imply session-permission auto-refresh, role delete, or user-role reassignment behavior that is not implemented
**Rollback or mitigation:** Revert documentation-only wording if later repository changes materially alter the active role update contract, remove the edit workflow, or add deeper permission/session propagation behavior
**Risk:** Low

## TASK-074: Refresh architecture-facing docs after `root-admin-recipes-production` TASK-006 production-orders supervision view
**Status:** Completed
**Priority:** Low
**Domain:** Root shell production-order supervision surface / Architecture documentation
**Requirement:** `specs/root-admin-recipes-production/requirements.md` (`FR-011`, `FR-012`, `FR-013`, `FR-014`, `AC-009`, `AC-010`); post-implementation refresh requested by `sdd-implementation-agent-a4adf0`
**Reason:** After the approved `root-admin-recipes-production` `TASK-006` implementation cycle, the canonical architecture-facing docs still described `/root/#produccion_ordenes` as a structural oversight screen rather than the now-usable read-only supervision workflow.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, and `docs/action-plan.md` now record that `#produccion_ordenes` actively consumes `productionAdminApi` plus helper/state/renderer seams, that the route now offers list/detail/KPI/filter behavior, and that the explicit limitation remains server-side pagination only with the remaining filters applied client-side over the loaded page.
**Implemented change:** Synchronized architecture-facing documentation to the post-`TASK-006` state, documenting the live read-only supervision workflow, runtime-contract and `index.html` registration of the production-orders state/renderer files, the characterization coverage in `tests/root-shell-production-orders-admin-view-characterization.test.js` and `tests/root-shell-modularity-governance.test.js`, and the remaining architectural limitation around filter depth.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Implementation by `sdd-implementation-agent-a4adf0`
**Database impact:** Documentation only; no schema change
**API impact:** Documentation now reflects active root-shell consumption of the read-only `/api/production/orders/**` list/detail contracts with server-side pagination only; no backend contract change in this refresh
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because the root supervision boundary, permission seam, and no-warehouse-actions constraint are now explicit together with the client-side-filter limitation
**Acceptance criteria:** Architecture-facing docs state that `/root/#produccion_ordenes` is now a usable read-only supervision workflow, that runtime/test inventory includes the new production-orders state/renderer/view characterization coverage, and that only pagination is currently server-side while the remaining filters are client-side over the loaded page.
**Validation evidence:** User-supplied results report `tests/root-shell-production-orders-admin-view-characterization.test.js`, `tests/root-shell-production-admin-api-characterization.test.js`, `tests/root-shell-modularity-governance.test.js`, `npm run validate:public-runtime`, `npm run typecheck`, `npm run lint`, and `npm run build` all passing.
**Required tests:** Preserve `tests/root-shell-production-orders-admin-view-characterization.test.js`, `tests/root-shell-production-admin-api-characterization.test.js`, `tests/root-shell-modularity-governance.test.js`, and `scripts/validate-public-runtime.js`.
**Migration considerations:** Keep the workflow documented as read-only supervision and keep the pagination-server-side / remaining-filters-client-side limitation explicit until a later approved slice deepens backend query support.
**Rollback or mitigation:** Revert documentation-only wording if later repository changes either remove the production-orders live supervision behavior or extend backend filtering in a way that changes the limitation statement.
**Risk:** Low

## TASK-073: Refresh architecture-facing docs after `root-admin-recipes-production` TASK-005 production-orders seam
**Status:** Completed
**Priority:** Low
**Domain:** Root shell production-order oversight surface / Architecture documentation
**Requirement:** `specs/root-admin-recipes-production/requirements.md` (`FR-011`, `FR-012`, `FR-013`, `FR-014`, `AC-009`, `AC-010`); post-implementation refresh requested by `sdd-implementation-agent-a4adf0`
**Reason:** After the approved `root-admin-recipes-production` `TASK-005` implementation cycle, the canonical architecture-facing docs still described `/root/#produccion_ordenes` as lacking a dedicated adapter seam and did not reflect the new read-only production-orders browser boundary.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, and `docs/action-plan.md` now record that `#produccion_ordenes` has `productionAdminApi` plus `production-orders-admin.helpers.js` registered in the public runtime, that the seam remains read-only and keeps unsupported filters explicitly client-side, and that the shipped route still does not provide the usable admin list/detail screen yet.
**Implemented change:** Synchronized architecture-facing documentation to the post-`TASK-005` state, documenting the dedicated `/api/production/orders/**` browser adapter, helper-owned filter/permission normalization, characterization coverage in `tests/root-shell-production-admin-api-characterization.test.js`, runtime-contract/index.html registration, and the remaining gap that `views.productionOrdersAdmin` still renders only structural oversight guidance.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Implementation by `sdd-implementation-agent-a4adf0`
**Database impact:** Documentation only; no schema change
**API impact:** Documentation now reflects active root-shell registration of the read-only `/api/production/orders/**` browser adapter and unchanged backend production-order contracts
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because the root oversight boundary, permission seam, and still-missing usable view are now explicit
**Acceptance criteria:** Architecture-facing docs state that `/root/#produccion_ordenes` now has a dedicated read-only browser adapter/helper seam, that runtime/test inventory includes the new files, and that the shipped route is still not a usable production-orders admin workspace.
**Validation evidence:** User-supplied results report `tests/root-shell-production-admin-api-characterization.test.js`, `npm run validate:public-runtime`, `npm run typecheck`, `npm run lint`, and `npm run build` all passing.
**Required tests:** Preserve `tests/root-shell-production-admin-api-characterization.test.js`, `tests/root-shell-route-governance.test.js`, `tests/root-shell-modularity-governance.test.js`, and `scripts/validate-public-runtime.js`.
**Migration considerations:** Keep the seam documented as partial implementation until a later approved slice wires list/detail/filter behavior into `views.productionOrdersAdmin`.
**Rollback or mitigation:** Revert documentation-only wording if later repository changes either remove the adapter/helper seam or complete the live admin view.
**Risk:** Low

## TASK-072: Refresh architecture-facing docs after `root-admin-recipes-production` recipes workflow activation
**Status:** Completed
**Priority:** Low
**Domain:** Root shell production/recipe administration surface / Architecture documentation
**Requirement:** `specs/root-admin-recipes-production/requirements.md`; post-implementation refresh requested by `sdd-implementation-agent-a4adf0`
**Reason:** After the latest `root-admin-recipes-production` implementation cycle, the canonical architecture-facing docs still described both production-group routes as shallow starter pages and did not reflect that `/root/#recetas` is now a usable administrative workflow while `/root/#produccion_ordenes` remains only structurally wired.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, and `docs/action-plan.md` now distinguish the two production-group routes accurately: `#recetas` is documented as a live root-admin workflow over `recipesApi` and `productsApi`, while `#produccion_ordenes` is documented as a dedicated oversight route that still lacks `/api/production/orders/**` orchestration.
**Implemented change:** Synchronized architecture-facing documentation to the post-implementation state of the root recipes workflow, documenting recipe list/detail/filter behavior, root-side recipe creation, draft version create/edit, version approval, product assignment via `productsApi.assignRecipeToProduct(...)`, the runtime-contract registration of `recipes-admin.state.js` and `recipes-admin.renderers.js`, the characterization coverage added for the recipes admin view, and the remaining production-orders gap.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Implementation by `sdd-implementation-agent-a4adf0`
**Database impact:** Documentation only; no schema change
**API impact:** Documentation now reflects active root-shell consumption of `/api/recipes/**` plus recipe assignment through `PUT /api/products/:id`; no backend contract change in this refresh
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because permission-gated recipe admin behavior and the still-missing production-orders data path are now explicit
**Acceptance criteria:** Architecture-facing docs state that `/root/#recetas` is a usable admin workflow, that `/root/#produccion_ordenes` is still structurally wired but not functionally complete, and that the current runtime/test inventory includes the recipe workflow support files and characterization coverage.
**Validation evidence:** User-supplied results report `tests/root-shell-recipes-admin-view-characterization.test.js`, `tests/root-shell-recipes-api-characterization.test.js`, `tests/root-shell-modularity-governance.test.js`, `npm run validate:public-runtime`, `npm run typecheck`, `npm run lint`, and `npm run build` all passing.
**Required tests:** Preserve `tests/root-shell-recipes-admin-view-characterization.test.js`, `tests/root-shell-recipes-api-characterization.test.js`, `tests/root-shell-route-governance.test.js`, `tests/root-shell-modularity-governance.test.js`, and `scripts/validate-public-runtime.js`.
**Migration considerations:** Keep the current split-depth production-group behavior documented truthfully until a later approved slice implements production-order list/detail/filter orchestration.
**Rollback or mitigation:** Revert documentation-only wording if later repository changes either deepen `#produccion_ordenes` or materially reduce the current `#recetas` workflow.
**Risk:** Low

## TASK-071: Refresh architecture-facing docs after `root-admin-recipes-production`
**Status:** Completed
**Priority:** Low
**Domain:** Root shell production/recipe administration surface / Architecture documentation
**Requirement:** `specs/root-admin-recipes-production/requirements.md`; post-implementation refresh requested by `sdd-implementation-agent-a4adf0`
**Reason:** After the approved `root-admin-recipes-production` implementation cycle, the canonical architecture-facing docs still described the root production area as placeholder-heavy and did not reflect the actual mounted `#recetas` / `#produccion_ordenes` routes, runtime-contract entries, recipe adapter seam, or the still-limited depth of the shipped UI.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, and `docs/action-plan.md` now record that the root shell exposes dedicated `#recetas` and `#produccion_ordenes` routes, that `root/recipes-api.js` and `root/views/recipes-admin.helpers.js` are part of the approved runtime inventory, that public-runtime and governance validators cover those files, and that the shipped browser behavior is currently a route-level implementation with introductory administrative content rather than full live recipe/order workflows.
**Implemented change:** Synchronized architecture-facing documentation to the post-implementation state of `root-admin-recipes-production`, documented the `produccion-group` and `compras-group` sidebar structure, the continued backward-compatible legacy `#production` / `#purchases` route keys, the new `recipesApi` adapter and `assignRecipeToProduct(...)` helper seam, the dedicated `views.recipesAdmin` and `views.productionOrdersAdmin` registrations, and the remaining architectural gap that `#produccion_ordenes` still lacks a production-orders adapter while both new views remain starter screens.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Implementation by `sdd-implementation-agent-a4adf0`
**Database impact:** Documentation only; no schema change
**API impact:** Documentation now reflects active root-shell consumption of `/api/recipes/**` and the additive product recipe-assignment helper contract; no backend contract change in this refresh
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because the implemented route depth and permission/governance seams are now explicit
**Acceptance criteria:** Architecture-facing docs distinguish generic `in_process` routes from the now-mounted production routes, record the active recipe adapter/helper/runtime inventory, and state clearly that current root production screens are starter implementations rather than full operational workflows.
**Validation evidence:** User-supplied results report `npm run lint`, `npm run typecheck`, `npm run build`, `npm run validate:public-runtime`, root shell governance tests, and `tests/root-shell-recipes-api-characterization.test.js` all passing after the feature implementation.
**Required tests:** Preserve `tests/root-shell-supply-manifest.test.js`, `tests/root-shell-route-governance.test.js`, `tests/root-shell-modularity-governance.test.js`, `tests/root-shell-recipes-api-characterization.test.js`, and `scripts/validate-public-runtime.js`.
**Migration considerations:** Keep the route-level implementation documented truthfully until a later approved slice adds live CRUD/list/filter behavior.
**Rollback or mitigation:** Revert documentation-only wording if later repository changes deepen or remove the current root production screens.
**Risk:** Low

## TASK-070: Refresh architecture-facing docs after `audit-findings-remediation` warehouse/runtime governance alignment
**Status:** Completed
**Priority:** Low
**Domain:** Browser runtime governance / Warehouse QA SPA / Architecture documentation
**Requirement:** `specs/audit-findings-remediation`; warehouse/runtime governance alignment follow-up implemented by `sdd-implementation-agent-a4adf0`
**Reason:** After the approved warehouse/runtime alignment cycle was implemented, the canonical architecture-facing docs still needed a final synchronization pass so supported browser runtime inventory, warehouse/QA SPA governance status, bounded typecheck coverage, validator ownership, and remaining non-warehouse risks matched the repository reality.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, and `docs/action-plan.md` now reflect `/warehouse/` as a supported runtime, record validator and smoke/characterization coverage for the warehouse SPA, clarify that bounded typecheck now includes the warehouse runtime while still excluding broader root/agent inventory, and remove stale wording that treated the warehouse gap as still open.
**Implemented change:** Synchronized architecture-facing documentation to the post-implementation state of the `audit-findings-remediation` warehouse/runtime alignment work, documenting supported `/root/`, `/agent/`, and `/warehouse/` browser inventory, `scripts/validate-public-runtime.js` warehouse inventory enforcement, `tsconfig.typecheck.json` warehouse coverage, the updated warehouse/browser test baseline, and the remaining non-warehouse risk set (production-detail DB integrity, override-auditability, root-admin receipt/fiscal pages, standalone quality/supplier routes, external billing handoff, and broader Playwright-lane instability).
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Implementation by `sdd-implementation-agent-a4adf0`
**Database impact:** Documentation only; no schema change
**API impact:** Documentation now reflects the already-supported `/warehouse/` browser runtime surface and unchanged backend receipt/production contracts consumed by that SPA
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because current runtime boundaries and remaining non-warehouse risk ownership are now explicit
**Acceptance criteria:** Architecture-facing docs describe `/warehouse/` as supported current runtime, identify warehouse-specific governance alignment as closed, record bounded typecheck/runtime-validator coverage truthfully, and limit remaining open-risk wording to non-warehouse concerns only.
**Validation evidence:** User-supplied results for `npm run lint`, `npm run typecheck`, `npm run build`, `node scripts/validate-public-runtime.js`, and `npm run test -- --silent` all passed (`763` pass, `0` fail, `2` skipped pre-existing DB-dependent); the final audit score is `9.1/10` with verdict `Acceptable`.
**Required tests:** Preserve `tests/warehouse-spa-runtime.test.js`, `tests/public-surface-characterization.test.js`, `tests/public-runtime-http-smoke.test.js`, `tests/post-audit-baseline-hardening.test.js`, `tests/browser-e2e.e2e.js`, and `scripts/validate-public-runtime.js`.
**Migration considerations:** Keep the warehouse alignment documented as implemented current-state/runtime-governance truth; do not re-open warehouse-gap wording unless repository evidence changes.
**Rollback or mitigation:** Revert documentation-only wording if later repository changes redefine the supported browser inventory or bounded typecheck scope.
**Risk:** Low

## TASK-069: Refresh architecture-facing docs after `supply-inventory-entry` `TASK-014` and `TASK-015`
**Status:** Completed
**Priority:** Low
**Domain:** Receipt confirmation/reversal and fiscal-reference boundary / Architecture documentation
**Requirement:** `supply-inventory-entry` `TASK-014`; `supply-inventory-entry` `TASK-015`
**Reason:** After the approved receipt-confirmation and fiscal-reference slices were implemented, the canonical architecture/runtime docs still described `/api/receipts` as pre-confirmation only and still treated fiscal handoff persistence as future work rather than active pending metadata storage.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now describe `TASK-014` and `TASK-015` as implemented slices, record mounted `/api/receipts` confirmation/reversal/fiscal-reference behavior, document transactional stock effects plus `confirmedLotId` traceability, clarify that `FiscalDocumentReference` is pending metadata only with no external Billing/Hacienda integration, and identify `TASK-016` as the next downstream supply follow-up.
**Implemented change:** Synchronized architecture-facing documentation to the post-implementation state of `supply-inventory-entry` `TASK-014` and `TASK-015`, documented migrations `20260818030000_add_receipt_confirmation_lot_link` and `20260818040000_add_fiscal_document_reference`, the new `fiscal-reference` repository/service/schema modules, the active routes `POST /api/receipts/:id/confirm`, `POST /api/receipts/:id/reverse`, `GET /api/receipts/:id/fiscal-references`, and `POST /api/receipts/:id/fiscal-references`, the transactional stock workflow with movement reasons `PURCHASE_RECEIPT` / `RECEIPT_REVERSAL`, and the remaining root-admin-page plus warehouse-SPA gaps after this slice.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Implementation by `sdd-implementation-agent-a4adf0`
**Database impact:** Documentation records the already-implemented additive receipt confirmation/fiscal-reference schema baseline; no new schema change in this refresh
**API impact:** Documentation now reflects the mounted authenticated `/api/receipts` confirmation, reversal, and fiscal-reference contract
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because active receipt authorization and the non-integrated fiscal boundary are now explicit
**Acceptance criteria:** Architecture-facing docs reflect the observable `supply-inventory-entry` `TASK-014` and `TASK-015` implementation, distinguish transactional stock posting from pending fiscal metadata persistence, record that no external billing API exists yet, and identify `TASK-016` as the next supply follow-up.
**Validation evidence:** User-supplied results report 102 tests passed with all validations green; repository inspection also confirms mounted `/api/receipts` confirm/reverse/fiscal-reference routes, receipt transactional stock logic, new `fiscal-reference` modules, and additive Prisma receipt/fiscal migrations.
**Required tests:** Preserve `tests/receipt-confirmation.test.js`, `tests/fiscal-reference-boundary.test.js`, `tests/receipt-routes-contract.test.js`, and the broader lint/typecheck/build guardrails for this slice.
**Migration considerations:** Keep the receipt/fiscal baseline documented as additive under the existing layered monolith; do not claim external billing submission, root-admin UI completion, or warehouse SPA completion beyond reviewed repository evidence.
**Rollback or mitigation:** Revert documentation-only wording if later verified repository evidence changes the implemented receipt/fiscal baseline or downstream sequencing.
**Risk:** Low

## TASK-068: Refresh architecture-facing docs after `supply-inventory-entry` `TASK-013`
**Status:** Completed
**Priority:** Low
**Domain:** Receipt foundation / Architecture documentation
**Requirement:** `supply-inventory-entry` `TASK-013`
**Reason:** After the approved receipt slice was implemented, the canonical architecture/runtime docs still described `/api/receipts` as absent and still treated receipt confirmation work as if no receipt runtime foundation existed yet.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now describe `TASK-013` as an implemented receipt slice, record mounted `/api/receipts` runtime behavior plus additive receipt persistence, clarify that the workflow currently stops at actual-arrival document plus inspection-driven pre-confirmation states, and identify `TASK-014` as the next downstream supply follow-up.
**Implemented change:** Synchronized architecture-facing documentation to the post-implementation state of `supply-inventory-entry` `TASK-013`, documented the additive Prisma receipt enums/models and migration `20260818020000_add_purchase_receipt_foundation`, the new route/service/repository/schema module set, the current workflow `actual-arrival receipt document -> item inspection -> pre-confirmation state transitions`, the active route-policy usage `receipt.view/inspect`, and the remaining confirmation/reversal, fiscal handoff, and supplier/runtime gaps after this slice.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Implementation by `sdd-implementation-agent-a4adf0`
**Database impact:** Documentation records the already-implemented additive receipt schema and migration baseline; no new schema change in this refresh
**API impact:** Documentation now reflects the mounted authenticated `/api/receipts` route group and its current contract limits
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because active receipt authorization and non-confirming scope are now explicit
**Acceptance criteria:** Architecture-facing docs reflect the observable `supply-inventory-entry` `TASK-013` implementation, distinguish the active receipt foundation from later confirmation/reversal and fiscal handoff work, record that no inventory mutations occur in this slice, and identify `TASK-014` as the next supply follow-up.
**Validation evidence:** User-supplied results report 87 tests passed, plus `npm run lint`, `npm run typecheck`, and `npm run build`; repository inspection also confirms mounted `/api/receipts`, new receipt schema/repository/service/route files, and additive Prisma receipt models/migration.
**Required tests:** Preserve `tests/receipt-foundation.test.js`, `tests/receipt-routes-contract.test.js`, `tests/receipt-migration.test.js`, and the broader lint/typecheck/build guardrails for this slice.
**Migration considerations:** Keep the receipt baseline documented as additive under the existing layered monolith; do not claim inventory confirmation, reversal, supplier runtime, or fiscal handoff completion beyond reviewed repository evidence.
**Rollback or mitigation:** Revert documentation-only wording if later verified repository evidence changes the implemented receipt baseline or downstream sequencing.
**Risk:** Low

## TASK-067: Refresh architecture-facing docs after `supply-inventory-entry` `TASK-012`
**Status:** Completed
**Priority:** Low
**Domain:** Procurement foundation / Architecture documentation
**Requirement:** `supply-inventory-entry` `TASK-012`
**Reason:** After the approved procurement slice was implemented, the canonical architecture/runtime docs still described `/api/procurement` as absent, still treated procurement as config-only, and still identified `TASK-012` as the next downstream supply task.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now describe `TASK-012` as an implemented procurement slice, record mounted `/api/procurement` runtime behavior plus additive procurement persistence, clarify that the workflow is intention/approval only without stock mutation, and identify `TASK-013` as the next downstream supply task.
**Implemented change:** Synchronized architecture-facing documentation to the post-implementation state of `supply-inventory-entry` `TASK-012`, documented the additive Prisma procurement enums/models and migration `20260818010000_add_procurement_foundation`, the new route/service/repository/schema module set, the current workflow `request -> quotation -> comparison -> selection -> optional approval -> purchase order`, the active route-policy usage `procurement.view/manage/approve`, and the remaining receipt/fiscal handoff gaps after this slice.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Implementation by `sdd-implementation-agent-a4adf0`
**Database impact:** Documentation records the already-implemented additive procurement schema and migration baseline; no new schema change in this refresh
**API impact:** Documentation now reflects the mounted authenticated `/api/procurement` route group and its current contract limits
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because active procurement authorization and non-stock-mutating scope are now explicit
**Acceptance criteria:** Architecture-facing docs reflect the observable `supply-inventory-entry` `TASK-012` implementation, distinguish the active procurement foundation from later receipt and fiscal handoff work, record that no inventory mutations occur in this slice, and identify `TASK-013` as the next supply follow-up.
**Validation evidence:** User-supplied results report 79 tests passed, plus `npm run lint`, `npm run typecheck`, and `npm run build`; repository inspection also confirms mounted `/api/procurement`, new procurement schema/repository/service/route files, and additive Prisma procurement models/migration.
**Required tests:** Preserve `tests/procurement-foundation.test.js`, `tests/procurement-routes-contract.test.js`, `tests/procurement-migration.test.js`, and the broader lint/typecheck/build guardrails for this slice.
**Migration considerations:** Keep the procurement baseline documented as additive under the existing layered monolith; do not claim receipt posting, inventory impact, standalone supplier runtime, or fiscal handoff completion beyond reviewed repository evidence.
**Rollback or mitigation:** Revert documentation-only wording if later verified repository evidence changes the implemented procurement baseline or downstream sequencing.
**Risk:** Low

## TASK-066: Refresh architecture-facing docs after `supply-inventory-entry` `TASK-011`
**Status:** Completed
**Priority:** Low
**Domain:** Production completion / QA-gated finished-goods receipt / Architecture documentation
**Requirement:** `supply-inventory-entry` `TASK-011`
**Reason:** After the approved production-completion slice was implemented, the canonical architecture/runtime docs still described completion as future work, still treated `checkMandatoryQaGatesForOrder` as only preparatory, and still identified `TASK-011` as the next downstream supply task.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now describe `TASK-011` as an implemented production slice, record `/api/production/orders/:id/complete`, active `PRODUCTION_RECEIPT` intake behavior, QA-gated completion wiring, the full current production-order lifecycle, the narrowed remaining production gaps after completion, and identify `TASK-012` as the next downstream supply task.
**Implemented change:** Synchronized architecture-facing documentation to the post-implementation state of `supply-inventory-entry` `TASK-011`, documented transactional `completeProductionOrder(...)`, `productionCompletionSchema`, route policy `production.complete`, mandatory QA-gate enforcement during completion, finished-goods lot creation, destination-warehouse receipt posting with `reasonCode: PRODUCTION_RECEIPT`, and the `COMPLETED` transition reached through `/complete`.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Implementation by `sdd-implementation-agent-a4adf0`
**Database impact:** Documentation records runtime behavior over the existing production/inventory schema; no new schema change in this refresh
**API impact:** Documentation now reflects mounted authenticated route `POST /api/production/orders/:id/complete` and its current validation/policy/runtime-contract posture
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because production completion authorization, QA gating, and finished-goods intake behavior are now explicit
**Acceptance criteria:** Architecture-facing docs reflect the observable `supply-inventory-entry` `TASK-011` implementation, distinguish the active completion baseline from later downstream supply work, record the active movement reason `PRODUCTION_RECEIPT`, and identify `TASK-012` as the next supply follow-up without inventing its scope.
**Validation evidence:** User-supplied results report 12 new tests with 59 total passing, plus `npm run lint`, `npm run typecheck`, and `npm run build`; repository inspection also confirms `completeProductionOrder(...)`, `productionCompletionSchema`, and mounted `POST /api/production/orders/:id/complete` guarded by `production.complete`.
**Required tests:** Preserve `tests/production-completion.test.js`, existing production route/schema/service governance coverage, and the broader lint/typecheck/build guardrails for this slice.
**Migration considerations:** Keep the completion baseline documented as additive under the existing `/api/production` route group; do not claim broader downstream receipt, standalone quality, or warehouse/QA module completion beyond reviewed repository evidence.
**Rollback or mitigation:** Revert documentation-only wording if later verified repository evidence changes the implemented production-completion baseline or downstream sequencing.
**Risk:** Low

## TASK-065: Refresh architecture-facing docs after `supply-inventory-entry` `TASK-010`
**Status:** Completed
**Priority:** Low
**Domain:** Production / Quality inspection foundation / Architecture documentation
**Requirement:** `supply-inventory-entry` `TASK-010`
**Reason:** After the approved QA inspection slice was implemented, the canonical architecture/runtime docs still described quality as future work and still identified `TASK-010` as the next downstream supply task.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now describe `TASK-010` as an implemented production/quality slice, record `QualityInspection` and `QualityInspectionResult` as active repository truth, classify the inspection endpoints under the existing `/api/production` mount with `quality.inspect` / `quality.view` policies, and identify `TASK-011` as the next downstream supply task.
**Implemented change:** Synchronized architecture-facing documentation to the post-implementation state of `supply-inventory-entry` `TASK-010`, documented the additive Prisma enum/model and migration `20260818000000_add_quality_inspection_foundation`, the new schema/repository/service quality layer, the current status transitions (`REJECTED -> QA_HOLD`, `APPROVED` or `CONDITIONALLY_ACCEPTED` on `QA_HOLD -> IN_PROGRESS`), and the reusable `checkMandatoryQaGatesForOrder` helper prepared for downstream production completion gating.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** Implementation by `sdd-implementation-agent-a4adf0`
**Database impact:** Documentation records the already-implemented additive quality-inspection schema and migration baseline; no new schema change in this refresh
**API impact:** Documentation now reflects the mounted authenticated routes `POST /api/production/orders/:id/stages/:stageId/inspections` and `GET /api/production/orders/:id/inspections` under the existing production route group
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because the active quality route policies and current QA gate/status behavior are now explicit
**Acceptance criteria:** Architecture-facing docs reflect the observable `supply-inventory-entry` `TASK-010` implementation, distinguish the implemented QA inspection foundation from still-pending completion-gate wiring in `TASK-011`, and record the supplied validation evidence without claiming broader warehouse-QA or standalone quality-module completion.
**Validation evidence:** User-supplied results report 53 tests passed, plus `npm run lint`, `npm run typecheck`, and `npm run build`; repository inspection also confirms `src/schemas/quality.schema.js`, `src/repositories/quality.repository.js`, `src/services/quality.service.js`, mounted production inspection endpoints, and Prisma `QualityInspection` schema/migration changes.
**Required tests:** Preserve `tests/quality-inspection-foundation.test.js`, route/contract governance coverage, and the broader production, lint, typecheck, and build guardrails for this slice.
**Migration considerations:** Keep the current quality foundation documented as additive under the existing production mount; do not claim production completion gating, standalone `/api/quality` routing, or richer override-justification persistence beyond reviewed repository evidence.
**Rollback or mitigation:** Revert documentation-only wording if later verified repository evidence changes the implemented quality-inspection baseline or downstream sequencing.
**Risk:** Low

## TASK-064: Refresh architecture-facing docs after `supply-inventory-entry` `TASK-009`
**Status:** Completed
**Priority:** Low
**Domain:** Production auxiliary aggregate alignment / Architecture documentation
**Requirement:** `supply-inventory-entry` `TASK-009`
**Reason:** After the approved production aggregate-alignment slice was implemented, the canonical architecture/runtime docs and the standing audit still described `ProductionItem.consumedQuantity` drift plus downstream aggregate-first assumptions as open residual risks.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`, and `docs/audit/current-code-audit.md` now describe `TASK-009` as an implemented production slice, record `ProductionItem.consumedQuantity` as an explicitly synchronized auxiliary aggregate, close `RISK-007` and `RISK-009`, mark the `TASK-006` through `TASK-009` amendment sequence complete, and identify `TASK-010` as the next downstream supply task.
**Implemented change:** Synchronized architecture-facing documentation to the post-implementation state of `supply-inventory-entry` `TASK-009`, documented repository/service aggregate sync and reconciliation behavior, clarified the current aggregation rule (`SUM(ProductionConsumption.quantity)` at order scope; waste and returns excluded), and narrowed the remaining production follow-up posture to execution-detail FK hardening and later downstream supply work.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`, `docs/audit/current-code-audit.md`
**Dependencies:** Implementation by `sdd-implementation-agent-a4adf0`
**Database impact:** Documentation records current auxiliary aggregate synchronization behavior only; no schema change in this refresh
**API impact:** None; runtime endpoint surface is unchanged in `TASK-009`
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because downstream consumers must now treat granular `ProductionConsumption` detail as authoritative while the synchronized aggregate remains explicitly auxiliary
**Acceptance criteria:** Architecture-facing docs reflect the observable `supply-inventory-entry` `TASK-009` implementation, state the aggregate rule precisely, close the documented aggregate-drift risks without claiming new DB FK hardening, and record the supplied validation evidence plus downstream sequencing.
**Validation evidence:** User-supplied results report 31 tests passed, plus `npm run lint`, `npm run typecheck`, and `npm run build`; repository inspection also confirms `syncProductionItemConsumedQuantity`, `getProductionItemAggregateState`, `reconcileProductionOrderAggregates`, and the expanded `tests/production-service-foundation.test.js` coverage.
**Required tests:** Preserve `tests/production-service-foundation.test.js` aggregate synchronization/reconciliation coverage together with the broader production, lint, typecheck, and build guardrails for this slice.
**Migration considerations:** Keep the aggregate alignment documented as additive behavior over the existing production foundation; do not claim new FK enforcement, new API routes, or completion of later downstream supply tasks beyond the reviewed repository evidence.
**Rollback or mitigation:** Revert documentation-only wording if later verified repository evidence changes the implemented aggregate-alignment baseline or reopens the documented risks.
**Risk:** Low

## TASK-063: Refresh architecture-facing docs after `supply-inventory-entry` `TASK-008`
**Status:** Completed
**Priority:** Low
**Domain:** Production return foundation / Architecture documentation
**Requirement:** `supply-inventory-entry` `TASK-008`
**Reason:** After the approved production-return slice was implemented, the canonical architecture/runtime docs and the standing audit still described explicit returns modeling as future work.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`, and `docs/audit/current-code-audit.md` now describe `TASK-008` as an implemented production slice, record migration `20260817000000_add_production_return_foundation`, and narrow the remaining production follow-ups to missing `warehouseId` / `productId` FK hardening, aggregate synchronization for `ProductionItem.consumedQuantity`, and broader downstream supply workflows.
**Implemented change:** Synchronized architecture-facing documentation to the post-implementation state of `supply-inventory-entry` `TASK-008`, documented mounted route `POST /api/production/orders/:id/stages/:stageId/returns`, explicit `ProductionReturn` persistence, current stock-restoring movement behavior, validated runtime-contract classification, and the remaining follow-up posture without redesigning later approved tasks.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`, `docs/audit/current-code-audit.md`
**Dependencies:** `specs/supply-inventory-entry/implementation-report.md`; implementation by `sdd-implementation-agent-a4adf0`
**Database impact:** Documentation records the already-implemented additive production-return migration and current `ProductionReturn -> Lot` integrity; no new schema change in this refresh
**API impact:** Documentation now reflects the mounted authenticated route `POST /api/production/orders/:id/stages/:stageId/returns` and its current runtime-contract governance posture
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because the production contract and remaining gaps are now stated more precisely
**Acceptance criteria:** Architecture-facing docs reflect the observable `supply-inventory-entry` `TASK-008` implementation, distinguish implemented return modeling from still-open FK and aggregate-alignment follow-ups, and record the supplied validation evidence without claiming broader completion than the repository currently enforces.
**Validation evidence:** User-supplied results for `node --test tests/production-service-foundation.test.js tests/production-schema.test.js tests/production-routes-contract.test.js tests/runtime-contract-governance.test.js tests/production-return-foundation-migration.test.js`, `npm run lint`, `npm run typecheck`, `npx prisma validate --schema prisma/schema.prisma`, and `npm run build`.
**Required tests:** Preserve `tests/production-service-foundation.test.js`, `tests/production-schema.test.js`, `tests/production-routes-contract.test.js`, `tests/runtime-contract-governance.test.js`, `tests/production-return-foundation-migration.test.js`, and the broader lint/typecheck/build/prisma-validate guardrails for this slice.
**Migration considerations:** Keep the current return foundation additive; do not claim warehouse/product FK enforcement, aggregate synchronization, QA completion, or procurement/receipt integration beyond reviewed repository evidence.
**Rollback or mitigation:** Revert documentation-only wording if later verified repository evidence changes the implemented production-return baseline or closes the currently documented follow-ups.
**Risk:** Low

## TASK-062: Refresh architecture-facing docs after `supply-inventory-entry` `TASK-007`
**Status:** Completed
**Priority:** Low
**Domain:** Production waste hardening / Architecture documentation
**Requirement:** `supply-inventory-entry` `TASK-007`
**Reason:** After the approved production-waste hardening slice was implemented, the canonical architecture/runtime docs still described waste detail as less constrained than the actual repository state.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now describe `TASK-007` as an implemented production hardening slice, record migration `20260816000000_harden_production_waste_lot_fk`, and narrow the remaining gaps to missing `warehouseId` / `productId` FKs, explicit returns modeling, and `ProductionItem.consumedQuantity` drift.
**Implemented change:** Synchronized architecture-facing documentation to the post-implementation state of `supply-inventory-entry` `TASK-007`, documented mandatory `ProductionWaste.lotId`, enforced FK linkage to `Lot`, current validation evidence, and the remaining follow-up posture without redesigning later approved tasks.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** `specs/supply-inventory-entry/implementation-report.md`; implementation by `sdd-implementation-agent-a4adf0`
**Database impact:** Documentation records the already-implemented additive hardening migration and current lot-bound waste integrity; no new schema change in this refresh
**API impact:** None; the runtime endpoint surface is unchanged in `TASK-007`
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because current DB/detail integrity guarantees are now stated more precisely
**Acceptance criteria:** Architecture-facing docs reflect the observable `supply-inventory-entry` `TASK-007` implementation, distinguish the now-hardened waste detail from the still-open execution-detail and aggregate gaps, and record the remaining risks without claiming broader integrity than the repository currently enforces.
**Validation evidence:** User-supplied results for `node --test tests/production-service-foundation.test.js tests/production-schema.test.js tests/production-waste-hardening-migration.test.js`, `npm run lint`, `npm run typecheck`, `npx prisma validate --schema prisma/schema.prisma`, and `npm run build`.
**Required tests:** Preserve `tests/production-service-foundation.test.js`, `tests/production-schema.test.js`, `tests/production-waste-hardening-migration.test.js`, and the broader lint/typecheck/build/prisma-validate guardrails for this slice.
**Migration considerations:** Keep the current hardening additive; do not claim clean-database execution evidence, warehouse/product FK enforcement, explicit returns modeling, or aggregate synchronization beyond reviewed repository evidence.
**Rollback or mitigation:** Revert documentation-only wording if later verified repository evidence changes the implemented hardening baseline or closes the currently documented follow-ups.
**Risk:** Low

## TASK-061: Refresh architecture-facing docs after `supply-inventory-entry` `TASK-006`
**Status:** Completed
**Priority:** Low
**Domain:** Production consumption hardening / Architecture documentation
**Requirement:** `supply-inventory-entry` `TASK-006`
**Reason:** After the approved production-consumption hardening slice was implemented, the canonical architecture/runtime docs still understated the current DB-enforced `ProductionConsumption -> Lot` integrity and still described both execution-detail tables as equally unhardened.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now describe `TASK-006` as an implemented production hardening slice, record migration `20260815000000_harden_production_consumption_lot_fk`, and narrow the remaining gaps to waste hardening, missing `warehouseId` / `productId` FKs, and `ProductionItem.consumedQuantity` drift.
**Implemented change:** Synchronized architecture-facing documentation to the post-implementation state of `supply-inventory-entry` `TASK-006`, documented mandatory `ProductionConsumption.lotId`, enforced FK linkage to `Lot`, current validation evidence, and the remaining follow-up posture without redesigning later approved tasks.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** `specs/supply-inventory-entry/implementation-report.md`; implementation by `sdd-implementation-agent-a4adf0`
**Database impact:** Documentation records the already-implemented additive hardening migration and current lot-bound consumption integrity; no new schema change in this refresh
**API impact:** None; the runtime endpoint surface is unchanged in `TASK-006`
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because current DB/detail integrity guarantees are now stated more precisely
**Acceptance criteria:** Architecture-facing docs reflect the observable `supply-inventory-entry` `TASK-006` implementation, distinguish hardened consumption detail from still-pending waste hardening, and record the remaining detail-table and aggregate risks without claiming broader integrity than the repository currently enforces.
**Validation evidence:** User-supplied results for `node --test tests/production-service-foundation.test.js tests/production-schema.test.js tests/production-consumption-hardening-migration.test.js`, `npm run lint`, `npm run typecheck`, `npx prisma validate --schema prisma/schema.prisma`, and `npm run build`.
**Required tests:** Preserve `tests/production-service-foundation.test.js`, `tests/production-schema.test.js`, `tests/production-consumption-hardening-migration.test.js`, and the broader lint/typecheck/build/prisma-validate guardrails for this slice.
**Migration considerations:** Keep the current hardening additive; do not claim equivalent waste hardening, clean-database execution evidence, warehouse/product FK enforcement, or aggregate synchronization beyond reviewed repository evidence.
**Rollback or mitigation:** Revert documentation-only wording if later verified repository evidence changes the implemented hardening baseline or closes the currently documented follow-ups.
**Risk:** Low

## TASK-060: Refresh architecture-facing docs after `supply-inventory-entry` `TASK-005`
**Status:** Completed
**Priority:** Low
**Domain:** Production execution foundation / Architecture documentation
**Requirement:** `supply-inventory-entry` `TASK-005`
**Reason:** After the approved production stage-execution slice was implemented, the canonical architecture/runtime docs still understated the mounted `/api/production/orders/:id/stages/:stageId/execute` contract, the new execution detail persistence, and the remaining post-audit follow-ups.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`, and `docs/runtime-endpoint-catalog.md` now describe `TASK-005` as an implemented production execution foundation, include the stage-execution route in the human-readable runtime catalog, and keep the remaining DB/read-model follow-ups explicit.
**Implemented change:** Synchronized architecture-facing documentation to the post-implementation state of `supply-inventory-entry` `TASK-005`, recorded migration `20260814000000_add_production_stage_execution_foundation`, documented `ProductionStageExecution` / `ProductionConsumption` / `ProductionWaste`, clarified that stage resolution now comes from the frozen `recipeVersionSnapshot`, and preserved the current audit-backed warnings about FK hardening and `ProductionItem.consumedQuantity` drift.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`, `docs/runtime-endpoint-catalog.md`
**Dependencies:** `specs/supply-inventory-entry/implementation-report.md`; `inventory-api/docs/audit/current-code-audit.md`; implementation by `sdd-implementation-agent-a4adf0`
**Database impact:** Documentation records the already-implemented additive production execution schema and migration baseline; no new schema change in this refresh
**API impact:** Documentation records mounted `/api/production/orders/:id/stages/:stageId/execute` and its current manifest-based contract governance posture
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because active `production.execute` enforcement, transactional stock deductions, and remaining integrity gaps are now explicit
**Acceptance criteria:** Architecture-facing docs reflect the observable `supply-inventory-entry` `TASK-005` implementation, distinguish current production execution behavior from later QA/completion/receipt workflows, and document the current contract-governance plus DB/read-model limitation posture without claiming stronger integrity guarantees than the repository currently enforces.
**Validation evidence:** User-supplied results for `node --test tests/production-service-foundation.test.js tests/production-schema.test.js tests/production-routes-contract.test.js tests/runtime-contract-governance.test.js`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npx prisma validate`, together with the post-implementation audit score `8.6/10` and its remaining warnings.
**Required tests:** Preserve `tests/production-service-foundation.test.js`, `tests/production-schema.test.js`, `tests/production-routes-contract.test.js`, `tests/runtime-contract-governance.test.js`, and the broader lint/typecheck/build/prisma-validate guardrails for this slice.
**Migration considerations:** Keep the current migration additive; do not claim warehouse/product/lot FK hardening, synchronized aggregate consumption totals, QA gating, or completion-posting behavior beyond the reviewed repository evidence.
**Rollback or mitigation:** Revert documentation-only wording if later verified repository evidence changes the implemented production execution baseline or closes the currently documented DB/detail-model follow-ups.
**Risk:** Low

## TASK-059: Refresh architecture-facing docs after `supply-inventory-entry` `TASK-004`
**Status:** Completed
**Priority:** Low
**Domain:** Production foundation / Architecture documentation
**Requirement:** `supply-inventory-entry` `TASK-004`
**Reason:** After the approved production-order lifecycle foundation was implemented, the architecture-facing documents still needed to reflect the real mounted `/api/production` runtime, additive Prisma lifecycle/snapshot fields, service-layer guardrail enforcement, and the remaining warnings around permission-seed drift and app-layer-only production invariants.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now describe `TASK-004` as an implemented production-order lifecycle foundation, stop understating the mounted `/api/production` runtime, and preserve the current warnings about seed/runtime permission drift plus permissive DB-level production invariants.
**Implemented change:** Synchronized architecture-facing documentation to the post-implementation state of `supply-inventory-entry` `TASK-004`, recorded the additive migration `20260813000000_add_production_order_lifecycle_foundation`, documented the mounted production routes and current service/repository boundaries, and clarified that production guardrails and several lifecycle invariants are currently enforced in Zod/service code rather than fully constrained in the database.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** `specs/supply-inventory-entry/implementation-report.md`; implementation by `sdd-implementation-agent-a4adf0`
**Database impact:** Documentation records the already-implemented additive production-order lifecycle schema and migration baseline; no new schema change in this refresh
**API impact:** Documentation records mounted `/api/production/**` endpoints and their current manifest-based runtime-contract governance posture
**Container impact:** None
**Security impact:** Low direct impact; medium documentation-accuracy impact because active production policy consumption and current `production.override` justification enforcement are now explicit while broader persistence/audit gaps remain visible
**Acceptance criteria:** Architecture-facing docs reflect the observable `supply-inventory-entry` `TASK-004` implementation, distinguish current production-lifecycle behavior from later QA/completion/receipt workflows, and document the current contract-governance and DB-constraint posture without claiming broader OpenAPI coverage or stronger database enforcement than exists today.
**Validation evidence:** User-supplied results for `node --test tests/production-schema.test.js tests/production-service-foundation.test.js tests/production-routes-contract.test.js tests/runtime-contract-governance.test.js`, `npm run lint`, `npm run typecheck`, and `npm run build` with local Windows Prisma retry noise handled by the existing safe script.
**Required tests:** Preserve `tests/production-schema.test.js`, `tests/production-service-foundation.test.js`, `tests/production-routes-contract.test.js`, `tests/runtime-contract-governance.test.js`, and the broader lint/typecheck/build guardrails for this slice.
**Migration considerations:** Keep the current migration additive; do not claim clean-database execution evidence, stronger DB-level lifecycle constraints, or completed QA/receipt behavior beyond the reviewed repository evidence.
**Rollback or mitigation:** Revert documentation-only wording if later verified repository evidence changes the implemented production baseline or closes the currently documented seed-drift, persistence/audit, or DB-constraint gaps.
**Risk:** Low

## TASK-058: Refresh architecture-facing docs after `supply-inventory-entry` `TASK-003`
**Status:** Completed
**Priority:** Low
**Domain:** Recipe / formulation foundation / Architecture documentation
**Requirement:** `supply-inventory-entry` `TASK-003`
**Reason:** After the approved recipe versioning foundation was implemented, the architecture-facing documents still needed to reflect the real Prisma schema, mounted `/api/recipes` runtime surface, service-layer tenant validation, approval immutability rules, and current governance posture without overstating downstream production workflows.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now describe `TASK-003` as an implemented additive recipe/versioning foundation, distinguish it from later production/procurement work, and record that the runtime surface is mounted but intentionally excluded from the current partial OpenAPI baseline.
**Implemented change:** Synchronized architecture-facing documentation to the post-implementation state of `supply-inventory-entry` `TASK-003`, recorded the additive migration `20260812000000_add_recipe_versioning_foundation`, documented the mounted recipe routes and current service/repository boundaries, and preserved the current governance/architecture limitations such as legacy recipe coexistence and manifest-based contract exclusion.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** `specs/supply-inventory-entry/implementation-report.md`; implementation by `sdd-implementation-agent-a4adf0`
**Database impact:** Documentation records the already-implemented additive recipe-versioning schema and migration baseline; no new schema change in this refresh
**API impact:** Documentation records mounted `/api/recipes/**` endpoints and their current manifest-based contract governance posture
**Container impact:** None
**Security impact:** Low direct impact; medium governance accuracy impact because active recipe policy consumption and company-scoped nested product validation are now explicit
**Acceptance criteria:** Architecture-facing docs reflect the observable `supply-inventory-entry` `TASK-003` implementation, distinguish current recipe/versioning behavior from future production workflows, and document the current contract-governance posture without claiming broader OpenAPI coverage than exists today.
**Validation evidence:** User-supplied results for targeted recipe tests, `npm run lint`, `npm run typecheck`, `npx prisma validate --schema prisma/schema.prisma`, `npm run test -- --silent`, and note that local Windows build remains environment-sensitive due to the existing Prisma rename-lock behavior.
**Required tests:** Preserve `tests/recipe-routes-contract.test.js`, `tests/recipe-schema.test.js`, `tests/recipe-service-foundation.test.js`, runtime-contract governance coverage, and aggregate regressions.
**Migration considerations:** Keep the current migration additive; do not claim full model migration away from legacy recipe ingredients or OpenAPI coverage expansion beyond reviewed evidence.
**Rollback or mitigation:** Revert documentation wording only if later verified repository evidence changes the implemented recipe/versioning baseline or closes the currently documented coexistence/governance gaps.
**Risk:** Low

## TASK-057: Refresh architecture-facing docs after `supply-inventory-entry` `TASK-002`
**Status:** Completed
**Priority:** Low
**Domain:** Security governance / Supply foundation / Architecture documentation
**Requirement:** `supply-inventory-entry` `TASK-002`
**Reason:** After the approved supply security/governance foundation was implemented, the architecture-facing documents still needed to reflect the real access-policy registry, permission metadata, justification markers, proposed bundles, and the remaining readiness gaps without overstating unmounted supply APIs as active runtime behavior.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now describe `TASK-002` as implemented centralized security metadata and named policy foundation only, explicitly distinguish it from future production/procurement/receipt runtime modules, and record the current follow-up warning about permission-catalog drift versus `prisma/seed.js` plus metadata-only override enforcement.
**Implemented change:** Synchronized architecture-facing documentation to the post-implementation state of `supply-inventory-entry` `TASK-002`, recorded the new named supply/intake access policies, centralized permission metadata and justification helpers, proposed operational role bundles, and the fact that no new route groups, browser surfaces, or database migrations were introduced in this cycle.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** `specs/supply-inventory-entry/implementation-report.md`; `inventory-api/docs/audit/current-code-audit.md`; implementation by `sdd-implementation-agent-a4adf0`
**Database impact:** Documentation records current config-to-seed drift risk only; no schema change in this refresh
**API impact:** Documentation records that new named policies exist before the related supply APIs are mounted; no new endpoint introduced by this refresh
**Container impact:** None
**Security impact:** Low direct impact; high documentation-accuracy impact because override metadata, future policy inventory, and permission-seed drift are now stated explicitly
**Acceptance criteria:** Architecture-facing docs reflect the observable `supply-inventory-entry` `TASK-002` implementation, distinguish current security/governance foundation from future supply workflows, and document the latest audit concerns without claiming unimplemented route enforcement or seed synchronization.
**Validation evidence:** User-supplied results for targeted security/governance tests, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test -- --silent`, and the audit follow-up scoring `9.1/10` with `TASK-002` marked baseline-safe.
**Required tests:** Preserve `tests/access-policies.test.js`, `tests/permission-governance-foundation.test.js`, aggregate regression coverage, and later add config-to-seed synchronization guardrails before supply APIs are exposed.
**Migration considerations:** Keep the current change documented as configuration-only; do not treat proposed bundles or permission metadata as active seeded permission/role rollout until `prisma/seed.js` and future runtime consumers are aligned.
**Rollback or mitigation:** Revert documentation-only wording if later verified repository evidence changes the implemented governance baseline or closes the documented seed-drift and justification-enforcement gaps.
**Risk:** Low

## TASK-056: Refresh architecture-facing docs after `supply-inventory-entry` `TASK-001`
**Status:** Completed
**Priority:** Low
**Domain:** Product catalog / Inventory foundation / Architecture documentation
**Requirement:** `supply-inventory-entry` `TASK-001`
**Reason:** After the approved product sourcing foundation was implemented, the architecture-facing documents still needed to reflect the real schema, service, repository, migration, and test baseline without overstating later supply/procurement work as already active.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now describe the additive product sourcing foundation as implemented repository truth, including new Prisma enums and columns, company-scoped warehouse/supplier authorization validation, hotspot/schema characterization coverage, and the remaining non-blocking gaps called out by the latest audit rerun.
**Implemented change:** Synchronized architecture-facing documentation to the post-implementation state of `supply-inventory-entry` `TASK-001`, recorded the current product contract expansion on existing `/api/products/**` routes, documented the committed migration `20260811000000_add_product_sourcing_foundation`, and preserved the open concerns around clean-database migration execution evidence, thinner route/integration coverage, and `product.service.js` hotspot sensitivity as current limitations rather than hidden debt.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** `specs/supply-inventory-entry/implementation-report.md`; implementation by `sdd-implementation-agent-a4adf0`
**Database impact:** Documentation records the already-implemented additive Prisma schema and migration baseline; no new schema change in this refresh
**API impact:** Documentation records additive product payload/response fields on existing `/api/products/**` contracts; no new endpoint introduced by this refresh
**Container impact:** None
**Security impact:** Low direct impact; medium governance accuracy impact because tenant-scoped warehouse/supplier validation and remaining coverage gaps are now documented explicitly
**Acceptance criteria:** Architecture-facing docs reflect the observable `supply-inventory-entry` `TASK-001` implementation, distinguish current product-foundation behavior from future supply workflows, and document the latest audit concerns without claiming unverified migration execution.
**Validation evidence:** User-supplied results for targeted product/regression tests, `npm run lint`, `npm run typecheck`, `npx prisma validate --schema prisma/schema.prisma`, `npm run build`, `npm run test -- --silent`, and the audit rerun scoring `9.2/10` with `TASK-001` marked baseline-safe.
**Required tests:** Preserve `tests/product-sourcing-schema.test.js`, `tests/product-service-hotspot-characterization.test.js`, aggregate product regressions, and later add endpoint-level route/integration coverage before downstream supply slices expand.
**Migration considerations:** Keep the current migration additive; do not claim deployment readiness beyond the reviewed schema/build/test evidence until the committed migration has been executed on a clean database baseline.
**Rollback or mitigation:** Revert documentation-only wording if later verified repository evidence changes the implemented supply foundation baseline or closes the currently documented non-blocking concerns.
**Risk:** Low

## TASK-055: Refresh architecture-facing docs after the modern products and categories admin implementation
**Status:** Completed
**Priority:** Low
**Domain:** Embedded browser runtime / Architecture documentation
**Requirement:** `inventory-admin-views` `TASK-007`; `inventory-admin-views` `TASK-008`
**Reason:** After `#products` became a functional company-admin screen and tenant category administration moved into the supported root shell, the architecture-facing documents still needed to stop describing `#products` as a placeholder route and record the real runtime/testing state.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`, and `docs/audit/current-code-audit.md` now describe `#products` as a functional root-shell module over `/api/products/**` plus `GET/POST /api/products/categories/company`, while keeping `#lots` documented as the remaining inventory placeholder and recording the bounded typecheck/public-runtime governance gap honestly.
**Implemented change:** Synchronized architecture-facing docs and the current-code audit to the post-`TASK-007` / `TASK-008` repository truth, including products helper/state/renderer seams, runtime-contract membership, category admin surface behavior, strengthened characterization/E2E coverage, and the still-bounded browser-runtime typecheck scope.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`, `docs/audit/current-code-audit.md`
**Dependencies:** `inventory-admin-views` `TASK-007` and `TASK-008` implemented by `sdd-implementation-agent-0c5369`
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** Low direct impact; medium governance accuracy impact
**Acceptance criteria:** Architecture-facing docs reflect the observable products/categories implementation without overstating future inventory modules, and the remaining typecheck/governance gaps remain documented as current debt rather than hidden.
**Validation evidence:** User-supplied results for `node --test tests/products-view-characterization.test.js tests/products-view.e2e.js`, `node --test tests/public-surface-characterization.test.js tests/root-shell-router-characterization.test.js`, `npm run lint`, `npm run lint:public-runtime`, `npm run typecheck`, `npm run validate:public-runtime`, and `npm run build`.
**Required tests:** Preserve product characterization/E2E coverage, route/public-surface governance coverage, and the existing inventory adapter/category contract coverage.
**Migration considerations:** Keep the current backend product/category contracts stable; do not reinterpret the implemented UI as a broader inventory redesign.
**Rollback or mitigation:** Revert documentation-only wording if later verified code changes alter the current products/categories runtime behavior.
**Risk:** Low

## TASK-054: Refresh architecture-facing docs after the modern movements view implementation
**Status:** Completed
**Priority:** Low
**Domain:** Embedded browser runtime / Architecture documentation
**Requirement:** `inventory-admin-views` `TASK-006`
**Reason:** After `#movements` became a functional company-admin screen, the architecture-facing documents still needed to stop describing it as a placeholder route and record the real runtime/testing state.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now describe `#movements` as a functional root-shell module over paginated `GET /api/inventory/movements`, while keeping `#products` and `#lots` documented as the remaining placeholder routes and recording the bounded typecheck/public-surface governance gap honestly.
**Implemented change:** Synchronized architecture-facing docs to the post-`TASK-006` repository truth, including movement helper/renderer seams, runtime-contract membership, movement-specific characterization/E2E coverage, and the still-bounded typecheck/public-surface governance gaps.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** `inventory-admin-views` `TASK-006` implemented by `sdd-implementation-agent-0c5369`
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** Low direct impact; medium governance accuracy impact
**Acceptance criteria:** Architecture-facing docs reflect the observable movements implementation without overstating future inventory modules, and the remaining typecheck/governance gaps remain documented as current debt rather than hidden.
**Validation evidence:** User-supplied results for `node --test tests/movements-view-characterization.test.js tests/movements-view.e2e.js`, `npm run lint`, `npm run lint:public-runtime`, `npm run typecheck`, `npm run validate:public-runtime`, and `npm run build`.
**Required tests:** Preserve movement characterization/E2E coverage and public-runtime governance coverage.
**Migration considerations:** Keep the current backend inventory movements contract stable; do not reinterpret the implemented UI as a broader inventory redesign.
**Rollback or mitigation:** Revert documentation-only wording if later verified code changes alter the current movements runtime behavior.
**Risk:** Low

## TASK-053: Refresh architecture-facing docs after the modern warehouses view implementation
**Status:** Completed
**Priority:** Low
**Domain:** Embedded browser runtime / Architecture documentation
**Requirement:** `inventory-admin-views` `TASK-005`
**Reason:** After `#warehouses` became a functional company-admin screen, the architecture-facing documents still needed to stop describing it as a placeholder route and record the real runtime/testing state.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/audit/current-code-audit.md` now describe `#warehouses` as a functional root-shell module over `GET/POST /api/warehouses/company`, while keeping `#products`, `#lots`, and `#movements` documented as placeholders and recording the remaining bounded typecheck gap honestly.
**Implemented change:** Synchronized architecture-facing docs and the current-code audit to the post-`TASK-005` repository truth, including warehouses helper/renderer seams, runtime-contract membership, warehouse-specific characterization/E2E coverage, and the still-bounded typecheck/public-surface governance gaps.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/audit/current-code-audit.md`, `docs/tasks.md`
**Dependencies:** `inventory-admin-views` `TASK-005` implemented by `sdd-implementation-agent-0c5369`
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** Low direct impact; medium governance accuracy impact
**Acceptance criteria:** Architecture-facing docs reflect the observable warehouses implementation without overstating future inventory modules, and the remaining typecheck/governance gaps remain documented as current debt rather than hidden.
**Validation evidence:** User-supplied results for `node --test tests/warehouses-view-characterization.test.js`, `node --test tests/warehouses-view.e2e.js`, `npm run lint`, `npm run lint:public-runtime`, `npm run typecheck`, `npm run validate:public-runtime`, and `npm run build`.
**Required tests:** Preserve warehouse characterization/E2E coverage and public-runtime governance coverage.
**Migration considerations:** Keep the current backend warehouse contract stable; do not reinterpret the implemented UI as a broader inventory redesign.
**Rollback or mitigation:** Revert documentation-only wording if later verified code changes alter the current warehouses runtime behavior.
**Risk:** Low

## TASK-052: Refresh architecture-facing docs after bcrypt supply-chain closeout
**Status:** Completed
**Priority:** Low
**Domain:** Repository/platform governance / Architecture documentation
**Requirement:** `bcrypt-supply-chain-closeout` FR-003; FR-004; FR-005; FR-007; FR-008
**Reason:** After the approved bcrypt remediation was implemented, architecture-facing documentation still needed to reflect the real dependency baseline, zero-residual governance posture, and the remaining Docker evidence gap honestly.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/tasks.md` now describe `bcrypt@^6.0.0` as the active auth dependency baseline, no longer describe the `@mapbox/node-pre-gyp` / `tar` chain as an approved residual, and distinguish Docker validation unavailability from actual repository vulnerability state.
**Implemented change:** Synchronized architecture-facing documentation to the implemented bcrypt closeout, recorded zero approved residual vulnerabilities as the current dependency-hygiene baseline, and documented Docker validation as an environment evidence gap only.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** `specs/bcrypt-supply-chain-closeout/implementation-report.md`, `audit-baseline.json`, `docs/audit/dependency-hygiene-baseline.md`
**Database impact:** None
**API impact:** None
**Container impact:** None to versioned assets; documentation now records pending environment-specific Docker evidence
**Security impact:** Medium positive governance impact through accurate supply-chain posture documentation
**Acceptance criteria:** Architecture-facing docs reflect `bcrypt@^6.0.0`, closure of the `@mapbox/node-pre-gyp` / `tar` residual chain, zero approved residual vulnerabilities, and Docker validation as an evidence gap rather than a code-level residual vulnerability.
**Validation evidence:** Clean mirrored workspace: `npm ci`; `npm run lint`; `npm run typecheck`; `npm run test -- --silent`; `npm run verify`; `npm audit --json` with `0` vulnerabilities; `npm run validate:dependency-hygiene` with `Approved residual set: none`; `node --test tests/bcrypt-supply-chain-closeout.test.js`; `node --test tests/dependency-hygiene-governance.test.js`
**Required tests:** Preserve bcrypt compatibility coverage and dependency-hygiene governance coverage.
**Migration considerations:** Do not reopen auth redesign, password migration, or dependency exceptions while documenting this closeout.
**Rollback or mitigation:** Revert documentation-only wording if later verified dependency evidence changes.
**Risk:** Low

## TASK-051: Refresh architecture-facing docs after hotspot validation closure
**Status:** Completed
**Priority:** Low
**Domain:** Repository/platform governance / Architecture documentation
**Requirement:** `hotspot-seams-doc-ownership` TASK-008; FR-006; FR-007; FR-008
**Reason:** After the validation matrix closed, the architecture-facing docs still needed to stop describing `TASK-008` as pending and reflect the current accepted baseline accurately.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`, and `docs/audit/current-code-audit.md` now reflect that the governance baseline sync guardrails passed, coding-standard path alignment passed, lint/typecheck passed, and the aggregate suite passed with `BROWSER_SESSION_STORE_MODE=memory`, while keeping the pre-existing Windows Prisma `EPERM` rename-lock documented as a separate platform issue.
**Implemented change:** Synchronized architecture-facing documentation to the post-`TASK-008` repository truth, updated the audit verdict and score, and removed stale wording that still treated the hotspot validation lane as open.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`, `docs/audit/current-code-audit.md`
**Dependencies:** `TASK-050`
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** Low direct impact; medium governance accuracy impact
**Acceptance criteria:** Architecture-facing docs reflect the completed hotspot validation closure without redesigning the current layered monolith; the Windows Prisma instability remains documented as pre-existing platform debt rather than a feature regression.
**Validation evidence:** user-supplied post-implementation results for `tests/governance-baseline-sync-guardrails.test.js`, `tests/coding-standard-path-alignment.test.js`, `npm run lint`, `npm run typecheck`, `set BROWSER_SESSION_STORE_MODE=memory && npm run test -- --silent`, and the rerun baseline audit (`7.4/10`, `Acceptable`, no regressions observed)
**Required tests:** Preserve governance baseline sync, coding-standard path alignment, aggregate memory-session suite, and audit baseline refresh evidence.
**Migration considerations:** Keep the docs aligned to the current memory-session aggregate baseline and do not reinterpret the Windows Prisma `EPERM` issue as application behavior.
**Rollback or mitigation:** Revert documentation-only wording if a later verified validation run changes the accepted baseline.
**Risk:** Low

## TASK-050: Document auth/service/repository ownership for hotspot seams
**Status:** Completed
**Priority:** Medium
**Domain:** Repository/platform governance / Architecture documentation
**Requirement:** `hotspot-seams-doc-ownership` TASK-007; FR-004; FR-005; FR-006
**Reason:** After the seam extractions, the repository needed explicit architecture-facing documentation of what responsibility still belongs to auth, service, and repository layers.
**Current problem resolved:** `docs/current-state.md`, `docs/architecture.md`, and `docs/documentation-ownership-map.md` now describe concrete ownership examples for access-policy, inventory, agent-workspace, and product seams without redesigning the layered monolith.
**Implemented change:** Documented the stable access-policy facade vs registry/actor-scope/audit seams, the focused service seams extracted from inventory, agent workspace, and product services, and the continued repository ownership of Prisma persistence boundaries; synchronized the feature spec architecture/domain analysis accordingly.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/documentation-ownership-map.md`, `specs/hotspot-seams-doc-ownership/architecture.md`, `specs/hotspot-seams-doc-ownership/domain-analysis.md`
**Dependencies:** `TASK-049`, `TASK-048`, `TASK-047`, `TASK-046`, `TASK-045`
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** Low direct impact; medium reviewability and governance impact
**Acceptance criteria:** Auth, service, and repository ownership is explicit in architecture-facing docs using real repository examples; the documentation does not invent new layers or target-state redesign.
**Validation evidence:** `node --test tests/documentation-ownership-governance.test.js tests/p36-doc-validator-ownership.test.js tests/workflow-baseline-characterization.test.js`; `npm run lint`; `npm run typecheck`
**Required tests:** Preserve `tests/documentation-ownership-governance.test.js`, `tests/p36-doc-validator-ownership.test.js`, and workflow/doc governance coverage.
**Migration considerations:** Keep the existing layered monolith description accurate; do not overstate seam extraction as a module rewrite.
**Rollback or mitigation:** Revert documentation-only ownership wording if a statement overreaches the implemented code.
**Risk:** Low

## TASK-049: Consolidate canonical documentation ownership map
**Status:** Completed
**Priority:** Medium
**Domain:** Repository/platform governance / Documentation ownership
**Requirement:** `hotspot-seams-doc-ownership` TASK-006; FR-003; FR-007
**Reason:** The repository needed one explicit map for canonical, auxiliary, historical, and auto-validated artifacts across docs and workflows.
**Current problem resolved:** `docs/documentation-ownership-map.md` now classifies documentation and workflow artifacts, including canonical architecture-facing docs, auxiliary `internal-docs/**`, compatibility bridges, and the current workflow source of truth under `../.github/workflows/**`.
**Implemented change:** Added the ownership map, aligned architecture/current-state references to it, and introduced `tests/documentation-ownership-governance.test.js` as the focused guardrail for canonical workflow/documentation references.
**Affected files:** `docs/documentation-ownership-map.md`, `docs/current-state.md`, `docs/architecture.md`, `tests/documentation-ownership-governance.test.js`
**Dependencies:** `TASK-044`
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** Low direct impact; medium governance drift-prevention impact
**Acceptance criteria:** Canonical vs auxiliary vs historical vs auto-validated ownership is explicit; workflow authority does not contradict the implemented validator baseline.
**Validation evidence:** `node --test tests/documentation-ownership-governance.test.js tests/p36-doc-validator-ownership.test.js tests/workflow-baseline-characterization.test.js`; `npm run validate:workflow-baseline`; `npm run lint`; `npm run typecheck`
**Required tests:** Preserve documentation/workflow governance suites.
**Migration considerations:** Keep `internal-docs/**` support-only unless a later approved change promotes an artifact.
**Rollback or mitigation:** Revert the ownership map and doc references together if governance wording drifts from repository truth.
**Risk:** Low

## TASK-048: Extract focused product seams for permission shaping and pricing
**Status:** Completed
**Priority:** Medium
**Domain:** Product catalog
**Requirement:** `hotspot-seams-doc-ownership` TASK-005; FR-002; FR-004; FR-007
**Reason:** `src/services/product.service.js` mixed product CRUD/import orchestration with permission shaping and general-price synchronization concerns.
**Current problem resolved:** Permission-aware shaping now lives in `src/services/product-permission-shaping.service.js` and general-price synchronization now lives in `src/services/product-pricing.service.js`, while `product.service.js` keeps the higher-level product/import workflow.
**Implemented change:** Extracted permission-shaping and pricing seams, rewired `product.service.js` to consume them, and preserved inventory-linked initial-stock coordination behavior.
**Affected files:** `src/services/product.service.js`, `src/services/product-permission-shaping.service.js`, `src/services/product-pricing.service.js`, related architecture-facing docs/spec files
**Dependencies:** `TASK-044`
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** Low direct impact; medium maintainability impact
**Acceptance criteria:** Product permission shaping and price synchronization responsibilities are isolated without changing observable product API behavior.
**Validation evidence:** `node --test tests/product-service-hotspot-characterization.test.js tests/product-delete-semantics.test.js tests/pagination.test.js`; `npm run lint`; `npm run typecheck`
**Required tests:** Preserve product hotspot characterization and related product regression suites.
**Migration considerations:** Keep `product.service.js` as the service facade; do not reinterpret this slice as a new module boundary.
**Rollback or mitigation:** Revert extracted seams together with the service call-site wiring if regressions appear.
**Risk:** Medium

## TASK-047: Extract focused agent-workspace store-state and debt shaping seam
**Status:** Completed
**Priority:** Medium
**Domain:** Sales routing / agent workspace
**Requirement:** `hotspot-seams-doc-ownership` TASK-004; FR-002; FR-004; FR-005; FR-007
**Reason:** `src/services/agent-workspace.service.js` mixed actor scoping, route/store filtering, visit-state derivation, debt visibility rules, serialization, and order delegation.
**Current problem resolved:** Store-state, visit-state, debt visibility, purchase-history shaping, and sorting now live in `src/services/agent-workspace-store-state.service.js`, while the main service keeps actor scoping and higher-level orchestration.
**Implemented change:** Extracted the focused store-state seam, rewired the service to consume it, and preserved tenant-scope behavior and delegation to `order.service.js` / `inventory.service.js`.
**Affected files:** `src/services/agent-workspace.service.js`, `src/services/agent-workspace-store-state.service.js`, related architecture-facing docs/spec files
**Dependencies:** `TASK-044`
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** Low direct impact; medium maintainability and reviewability impact
**Acceptance criteria:** Tenant scope and agent eligibility remain unchanged while store-state and debt-shaping responsibilities are isolated into the extracted seam.
**Validation evidence:** `node --test tests/agent-workspace-hotspot-characterization.test.js tests/agent-workspace-tenant-scope.test.js tests/agent-workspace-contract-characterization.test.js`; `npm run lint`; `npm run typecheck`
**Required tests:** Preserve agent-workspace hotspot, tenant-scope, and contract characterization suites.
**Migration considerations:** Keep the existing service facade and route contracts stable.
**Rollback or mitigation:** Revert the extracted seam and service call-site wiring together if behavior drifts.
**Risk:** Medium

## TASK-046: Extract focused inventory-alert seam from inventory service
**Status:** Completed
**Priority:** Medium
**Domain:** Inventory
**Requirement:** `hotspot-seams-doc-ownership` TASK-003; FR-002; FR-004; FR-007
**Reason:** `src/services/inventory.service.js` mixed inventory-alert behavior with broader stock, lot, and transaction orchestration.
**Current problem resolved:** Inventory-alert permission checks, serialization, transition validation, metadata merge behavior, and alert-focused audit coordination now live in `src/services/inventory-alerts.service.js`.
**Implemented change:** Extracted the inventory-alert seam, rewired `inventory.service.js` to delegate alert behavior to it, and preserved existing transactional stock and lot behavior.
**Affected files:** `src/services/inventory.service.js`, `src/services/inventory-alerts.service.js`, related architecture-facing docs/spec files
**Dependencies:** `TASK-044`
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** Low direct impact; medium maintainability impact
**Acceptance criteria:** Alert behavior is isolated into a focused seam without changing current inventory API contracts or transaction semantics.
**Validation evidence:** `node --test tests/inventory-service-hotspot-characterization.test.js tests/inventory-alerts-tenant-scope.test.js tests/audit-instrumentation.test.js`; `npm run lint`; `npm run typecheck`
**Required tests:** Preserve inventory hotspot characterization, inventory-alert scope, and audit instrumentation coverage.
**Migration considerations:** Keep transaction-sensitive stock and lot orchestration in `inventory.service.js` until a later approved slice.
**Rollback or mitigation:** Revert the extracted seam and its call-site wiring together if inventory alert behavior changes unexpectedly.
**Risk:** Medium

## TASK-045: Split access-policy hotspot into facade, registry, actor-scope, and denial-audit seams
**Status:** Completed
**Priority:** Medium
**Domain:** Identity and access
**Requirement:** `hotspot-seams-doc-ownership` TASK-002; FR-001; FR-005; FR-006; FR-007
**Reason:** `src/security/access-policies.js` concentrated declarative policy data, actor-scope checks, denial-audit side effects, and guard composition in one file.
**Current problem resolved:** Declarative registry data now lives in `src/security/access-policy-registry.js`, actor-scope logic in `src/security/access-policy-actor-scope.js`, and denial-audit behavior in `src/security/access-policy-audit.js`, while `src/security/access-policies.js` remains the stable facade.
**Implemented change:** Extracted the new security seam files, preserved `authorizeAccessPolicy(...)`, `getAccessPolicy(...)`, and `listAccessPolicies(...)`, and kept current authorization behavior compatible.
**Affected files:** `src/security/access-policies.js`, `src/security/access-policy-registry.js`, `src/security/access-policy-actor-scope.js`, `src/security/access-policy-audit.js`, related architecture-facing docs/spec files
**Dependencies:** `TASK-044`
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** Medium positive impact through clearer reviewability of authorization behavior
**Acceptance criteria:** Route consumers keep the same access-policy facade contract while registry, actor-scope, and denial-audit responsibilities are isolated.
**Validation evidence:** `node --test tests/access-policies.test.js tests/authorization-convergence-characterization.test.js`; `node --test tests/audit-instrumentation.test.js`; `npm run lint`; `npm run typecheck`
**Required tests:** Preserve access-policy characterization and audit instrumentation suites.
**Migration considerations:** Keep the facade path stable for route consumers.
**Rollback or mitigation:** Revert facade and extracted seam files together if authorization compatibility regresses.
**Risk:** Medium

## TASK-044: Revalidate hotspot responsibilities and reusable seams before extraction
**Status:** Completed
**Priority:** Low
**Domain:** Cross-cutting architecture hardening
**Requirement:** `hotspot-seams-doc-ownership` TASK-001; FR-001; FR-002; FR-004
**Reason:** Seam extraction needed to be grounded in real current responsibilities rather than speculative architecture.
**Current problem resolved:** The feature now has an implementation record that ties each hotspot extraction to the actual mixed responsibilities observed in `access-policies.js`, `inventory.service.js`, `agent-workspace.service.js`, and `product.service.js`.
**Implemented change:** Revalidated hotspot responsibilities and existing helper seams in the feature spec/report artifacts before and during implementation.
**Affected files:** `specs/hotspot-seams-doc-ownership/implementation-report.md`, `specs/hotspot-seams-doc-ownership/tasks.md`, `specs/hotspot-seams-doc-ownership/traceability.md`, `specs/hotspot-seams-doc-ownership/changelog.md`
**Dependencies:** None
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** Low direct impact; medium planning integrity impact
**Acceptance criteria:** Each hotspot has its current responsibilities enumerated and each extraction is tied to a real reusable seam.
**Validation evidence:** `npm run lint`; `npm run typecheck`; `npm run validate:workflow-baseline`; manual hotspot responsibility review
**Required tests:** Manual/spec review plus reuse of existing hotspot baselines.
**Migration considerations:** Keep seam extraction incremental and evidence-based.
**Rollback or mitigation:** Revert only spec/report changes if responsibility wording is found inaccurate.
**Risk:** Low

## TASK-042: Implement company-admin zones view in the supported root shell
**Status:** Completed
**Priority:** Medium
**Domain:** Embedded browser runtime / Geography administration
**Requirement:** `zones-view`; company-admin root-shell module delivery over the existing regions contract
**Reason:** The approved company-admin sidebar already exposed `Zonas`, but the route still resolved to the shared neutral `in_process` view and did not provide an implemented geography-management surface.
**Current problem resolved:** `#zones` is now a functional company-admin route in the supported `/root/` shell, backed by `GET /api/regions/company`, `POST /api/regions/company`, and `POST /api/regions/company/:regionId/subregions`, with local in-memory search, create-zone/create-subzone modal flows, toast feedback, temporary subzone highlight, and mobile consecutive list/detail behavior.
**Implemented change:** Added the root-shell zones API adapter and zones view modules, wired the route through the manifest/router/runtime validator, expanded the bounded browser-runtime typecheck allowlist to include the new files, refreshed root-shell characterization/governance coverage, and synchronized architecture-facing documentation to the implemented state. Later follow-up work under `quality-baseline-recovery` added small helper seams in `src/public/root/views/zones-admin.helpers.js` for selection/filter and dialog/form behavior, plus isolated characterization coverage in `tests/zones-view-selection-filters-characterization.test.js` and `tests/zones-view-dialog-feedback-characterization.test.js`, without changing the supported API or shell contract.
**Affected files:** `scripts/validate-public-runtime.js`, `src/public/root/index.html`, `src/public/root/manifest.js`, `src/public/root/router.js`, `src/public/root/zones-api.js`, `src/public/root/views/zones-admin.helpers.js`, `src/public/root/views/zones-admin.js`, `src/public/styles.css`, `tests/public-surface-characterization.test.js`, `tests/root-shell-route-governance.test.js`, `tests/zones-view.e2e.js`, `tsconfig.typecheck.json`, `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** `TASK-039` and `TASK-040` completed baseline
**Database impact:** None
**API impact:** None; reused existing region company endpoints and did not change backend contracts
**Container impact:** None
**Security impact:** Low direct impact; medium UX/traceability impact through a supported authenticated geography-management surface
**Acceptance criteria:** `#zones` is reachable for company-admin users; the page loads data from the existing regions endpoints; zone/subzone search remains local in memory; create-zone and create-subzone flows succeed with inline error handling; mobile uses consecutive list/detail behavior; public-runtime validators and bounded tests reflect the new route.
**Validation evidence:** `npm run lint:public-runtime`; `npm run typecheck`; `npm run validate:public-runtime`; `npm run lint`; `node --test tests/root-shell-route-governance.test.js tests/public-surface-characterization.test.js tests/zones-view.e2e.js`; `npm run build` ⚠️ pre-existing local Windows Prisma rename-lock `EPERM`; `node --test tests/zones-view-selection-filters-characterization.test.js`; `node --test tests/zones-view-dialog-feedback-characterization.test.js`; `node --test tests/zones-view.e2e.js`; `node --test tests/root-shell-route-governance.test.js`; `npm run validate:public-runtime`; `npm run typecheck`; `npm run lint:public-runtime`
**Required tests:** Preserve `tests/root-shell-route-governance.test.js`, `tests/public-surface-characterization.test.js`, `tests/zones-view-selection-filters-characterization.test.js`, `tests/zones-view-dialog-feedback-characterization.test.js`, and `tests/zones-view.e2e.js` coverage for the supported `#zones` route.
**Migration considerations:** Preserve the existing company-regions API contract and the current root-shell actor split; do not reinterpret the implemented view as a new backend geography module boundary.
**Rollback or mitigation:** Revert the zones route wiring and view modules together if a supported-shell regression is detected, while preserving validator/test updates for diagnosis.
**Risk:** Medium

## TASK-043: Add isolated characterization for zones dialogs and feedback flows
**Status:** Completed
**Priority:** Medium
**Domain:** Embedded browser runtime / Root shell maintainability
**Requirement:** `quality-baseline-recovery` TASK-005
**Reason:** Selection/filter behavior had isolated coverage, but dialog lifecycle, inline errors, and toast feedback remained concentrated in `zones-admin.js`.
**Current problem resolved:** `#zones` no longer depends only on integrated behavior for dialog open/close/reset, submit feedback, and inline error rendering; those behaviors now have focused characterization coverage.
**Implemented change:** Added isolated characterization coverage for zone/subzone dialogs, success toast behavior, inline error rendering, and field-error handling without changing the supported UI contract. The implementation kept the existing DOM/API contract and extracted only small helper seams in `zones-admin.helpers.js` for `resetFormState`, `renderFormError`, and `setSubmitButtonState`.
**Affected files:** `src/public/root/views/zones-admin.js`, `src/public/root/views/zones-admin.helpers.js`, `tests/zones-view-dialog-feedback-characterization.test.js`, `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** `TASK-042` completed baseline
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** Low direct impact; medium regression-prevention impact
**Acceptance criteria:** Dialog open/close/reset, success feedback, inline error messaging, and field-error behavior are covered by isolated tests while `tests/zones-view.e2e.js` remains green.
**Validation evidence:** `node --test tests/zones-view-dialog-feedback-characterization.test.js`; `node --test tests/zones-view.e2e.js`; `node --test tests/zones-view-selection-filters-characterization.test.js`; `node --test tests/root-shell-route-governance.test.js`; `npm run validate:public-runtime`; `npm run typecheck`; `npm run lint:public-runtime`
**Required tests:** Preserve `tests/zones-view-dialog-feedback-characterization.test.js`, `tests/zones-view-selection-filters-characterization.test.js`, `tests/zones-view.e2e.js`, and `tests/root-shell-route-governance.test.js` coverage.
**Migration considerations:** Preserve current DOM contract and API usage.
**Rollback or mitigation:** Revert only the added seam/tests if they unintentionally alter supported UI behavior.
**Risk:** Medium

## TASK-044: Implement company-admin commercial views in the supported root shell
**Status:** Completed
**Priority:** High
**Domain:** Embedded browser runtime / Company-admin operations
**Requirement:** `root-shell-commercial-views`
**Reason:** The rebranded company-admin sidebar already exposed `Agentes`, `Clientes`, and `Rutas`, but those destinations still needed supported runtime modules instead of remaining placeholder navigation or requiring legacy HTML pages.
**Current problem resolved:** `#agents`, `#clients`, and `#routes` are now functional company-admin shell routes under `/root/`, and the follow-up hardening slice extracted adjacent renderer/state seams, aligned the clients taxpayer lookup adapter with the mounted backend contract, and strengthened browser/governance coverage without changing supported product behavior.
**Implemented change:** Added manifest/router wiring, same-origin API adapters, helper seams, and DOM controllers for the supported commercial views. `agents-admin.js` now composes company users, company roles, and sales-route overview data for commercial-user management plus route assignments and delegates list/detail rendering to `agents-admin.renderers.js`; `clients-admin.js` now provides list/detail, create/update/deactivate, store, document, reference, taxpayer lookup, and document download flows while delegating rendering/state helpers to `clients-admin.renderers.js` and `clients-admin.state.js`, and `clients-api.js` now uses `/api/taxpayers/lookup?identification=...`; `routes-admin.js` now provides route overview/detail, create/update, subzone assignment, agent assignment, goal editing, covered-store rendering, and simplified map behavior while delegating rendering/state helpers to `routes-admin.renderers.js` and `routes-admin.state.js`. Follow-up hardening also expanded browser E2E coverage in `tests/root-shell-commercial-views.e2e.js`, extended `tests/root-shell-modularity-governance.test.js`, updated public-surface/http-smoke/typecheck governance allowlists, preserved payment behavior through targeted regression suites, and refreshed architecture-facing docs to the implemented state.
**Affected files:** `src/public/root/index.html`, `src/public/root/manifest.js`, `src/public/root/router.js`, `src/public/root/agents-api.js`, `src/public/root/clients-api.js`, `src/public/root/routes-api.js`, `src/public/root/views/agents-admin.helpers.js`, `src/public/root/views/agents-admin.js`, `src/public/root/views/agents-admin.renderers.js`, `src/public/root/views/clients-admin.helpers.js`, `src/public/root/views/clients-admin.js`, `src/public/root/views/clients-admin.renderers.js`, `src/public/root/views/clients-admin.state.js`, `src/public/root/views/routes-admin.helpers.js`, `src/public/root/views/routes-admin.js`, `src/public/root/views/routes-admin.renderers.js`, `src/public/root/views/routes-admin.state.js`, `src/public/styles.css`, `src/services/payment.service.js`, `scripts/validate-public-runtime.js`, `scripts/run-eslint.js`, `scripts/run-tsc.js`, `package.json`, `package-lock.json`, `tests/root-shell-route-governance.test.js`, `tests/root-shell-router-characterization.test.js`, `tests/root-shell-modularity-governance.test.js`, `tests/public-surface-characterization.test.js`, `tests/public-runtime-http-smoke.test.js`, `tests/typecheck-ci-hardening-governance.test.js`, `tests/agents-view-characterization.test.js`, `tests/clients-view-characterization.test.js`, `tests/routes-view-characterization.test.js`, `tests/root-shell-commercial-views.e2e.js`, `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`
**Dependencies:** `TASK-039`, `TASK-040`, `TASK-042`, `TASK-043`, and `TASK-038` completed baselines
**Database impact:** None; existing persistence and migrations remain authoritative
**API impact:** None to backend contracts; the browser runtime now consumes existing `/api/users/company`, `/api/roles/company`, `/api/sales-routes/company**`, `/api/clients/**`, `/api/taxpayers/lookup?identification=...`, `/api/economic-activities`, and `/api/regions/company` endpoints from supported shell routes
**Container impact:** None
**Security impact:** Medium positive impact through removal of unsupported commercial-navigation gaps inside the supported shell, stronger browser/runtime governance, and corrected taxpayer lookup contract alignment; no new backend authorization contract was introduced
**Acceptance criteria:** Company-admin users with `companyId` can reach `#agents`, `#clients`, and `#routes` from the supported sidebar; each view preserves the current existing backend contracts and documented UI behavior; adjacent renderer/state seams remain in use; validators and focused characterization/browser suites cover the route/runtime contract; docs reflect the implemented shell truth without claiming broader backend redesign.
**Validation evidence:** `npm run validate:public-runtime`; `node --test tests/root-shell-route-governance.test.js`; `node --test tests/root-shell-router-characterization.test.js`; `node --test tests/root-shell-modularity-governance.test.js`; `node --test tests/public-surface-characterization.test.js`; `node --test tests/public-runtime-http-smoke.test.js tests/prisma-client-baseline-characterization.test.js tests/public-surface-characterization.test.js tests/typecheck-ci-hardening-governance.test.js`; `node --test tests/agents-view-characterization.test.js tests/clients-view-characterization.test.js tests/routes-view-characterization.test.js`; `node --test tests/root-shell-commercial-views.e2e.js`; `node --test tests/payment-tenant-scope.test.js tests/invoice-payment-sync-characterization.test.js tests/pagination.test.js tests/payment-receipt-security.test.js tests/audit-instrumentation.test.js`; `npm run lint`; `npm run lint:public-runtime`; `npm run typecheck`; `npm run build`
**Required tests:** Preserve `tests/root-shell-route-governance.test.js`, `tests/root-shell-router-characterization.test.js`, `tests/root-shell-modularity-governance.test.js`, `tests/public-surface-characterization.test.js`, `tests/public-runtime-http-smoke.test.js`, `tests/typecheck-ci-hardening-governance.test.js`, `tests/agents-view-characterization.test.js`, `tests/clients-view-characterization.test.js`, `tests/routes-view-characterization.test.js`, `tests/root-shell-commercial-views.e2e.js`, and the targeted payment regression lane coverage.
**Migration considerations:** Preserve `/root/` as the only supported commercial shell entrypoint; preserve the current backend API and authorization contracts; preserve `/api/taxpayers/lookup?identification=...` in the root-shell clients adapter; do not reinterpret the browser compositions as new backend bounded contexts without a future approved slice.
**Rollback or mitigation:** Revert each commercial view wiring together with its adapter/helper/controller/render/state/test updates if a supported-shell regression is detected, while keeping documentation explicit about any fallback to placeholder or legacy behavior.
**Risk:** High

## TASK-041: Align coding-standards canonical path and compatibility governance
**Status:** Completed
**Priority:** Low
**Domain:** Repository/platform governance / Documentation ownership
**Requirement:** `coding-standard-doc-path-alignment`; FR-001; FR-002; FR-003; FR-004; FR-005; AC-001; AC-002; AC-003
**Reason:** The repository needed one authoritative coding-standards path without leaving two independently maintained standards bodies.
**Current problem resolved:** `docs/coding_standard.md` now holds the full standards body, the legacy hyphenated alias is only a compatibility notice, and repo-owned docs/tests/scripts are guarded against stale hyphenated-path references.
**Implemented change:** Completed through `coding-standard-doc-path-alignment`; established `docs/coding_standard.md` as canonical, reduced the legacy hyphenated alias to a compatibility bridge, added `tests/coding-standard-path-alignment.test.js`, and refreshed spec evidence for the final path policy.
**Affected files:** `docs/coding_standard.md`, legacy hyphenated coding-standards compatibility bridge, `tests/coding-standard-path-alignment.test.js`, `specs/coding-standard-doc-path-alignment/**`, `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`
**Dependencies:** None
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** Low direct impact; medium governance and drift-prevention impact
**Acceptance criteria:** `docs/coding_standard.md` remains the single authoritative standards body; the legacy hyphenated alias remains compatibility-only; a focused repository test fails if stale repo-owned hyphenated references or duplicate authoritative content reappear.
**Validation evidence:** `node --test tests/coding-standard-path-alignment.test.js`; `node --test tests/workflow-baseline-characterization.test.js`; `npm run typecheck`; `npm run build` ⚠️ pre-existing local Windows Prisma rename-lock `EPERM`
**Required tests:** Preserve `tests/coding-standard-path-alignment.test.js` and `tests/workflow-baseline-characterization.test.js` coverage for documentation-path governance.
**Migration considerations:** Keep the compatibility bridge until remaining consumers no longer depend on the hyphenated path; do not restore a second full copy of the standards body.
**Rollback or mitigation:** Revert only the documentation-path alignment slice if an external dependency unexpectedly requires temporary rollback, while keeping the path-governance evidence for diagnosis.
**Risk:** Low

## TASK-040: Harden company-admin sidebar overflow behavior and regression coverage
**Status:** Completed
**Priority:** Medium
**Domain:** Embedded browser runtime / Frontend shell hardening
**Requirement:** `sidebar-rebrand-permissions` `TASK-004`; FR-021; FR-022; NFR-003; NFR-005; AC-011; AC-012; AC-014
**Reason:** The implemented company-admin sidebar already matched the approved IA, but hidden tooltip boxes and long nested content still needed stronger defensive styling so latent horizontal overflow would not survive inside the supported `/root/` shell.
**Current problem resolved:** `src/public/styles.css` now keeps sidebar tooltips out of layout until collapsed hover/focus, applies defensive `box-sizing` and `min-width: 0` rules across nested sidebar wrappers, truncates long labels and footer identity text, and limits the styled thin scrollbar to the middle `.root-sidebar__scroll` region while header/footer stay fixed.
**Implemented change:** Completed through `sidebar-rebrand-permissions` `TASK-004`; hardened the existing sidebar CSS contract and updated `tests/public-surface-characterization.test.js` to assert scrollbar, truncation, overflow, tooltip-display, and current root-shell wiring expectations.
**Affected files:** `src/public/styles.css`, `tests/public-surface-characterization.test.js`, `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`
**Dependencies:** `sidebar-rebrand-permissions` `TASK-003` completed baseline
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** Low direct impact; medium resilience and UX integrity impact
**Acceptance criteria:** The company-admin sidebar no longer keeps hidden tooltip boxes contributing to width; only the center navigation lane scrolls; labels/footer text truncate safely; focused characterization coverage reflects the supported CSS/runtime contract.
**Validation evidence:** `npm run typecheck`; `npm run lint:public-runtime`; `npm run validate:public-runtime`; `node --test tests/public-surface-characterization.test.js`; `node --test tests/root-shell-route-governance.test.js`; `node --test tests/browser-e2e.e2e.js`; `npm run build` ⚠️ pre-existing local Windows Prisma rename-lock `EPERM`
**Required tests:** Preserve `tests/public-surface-characterization.test.js`, `tests/root-shell-route-governance.test.js`, and `tests/browser-e2e.e2e.js` coverage for the supported root shell.
**Migration considerations:** Preserve the current actor split, shell route semantics, and backend-owned auth/session contracts; do not reintroduce width-bearing hidden tooltip elements.
**Rollback or mitigation:** Revert only the sidebar hardening slice if a visual regression is detected, while preserving the manifest/router semantics and current supported `/root/` runtime contract.
**Risk:** Medium

## TASK-039: Reconcile company-admin sidebar route semantics with current shell truth
**Status:** Completed
**Priority:** Medium
**Domain:** Embedded browser runtime / Architecture documentation
**Requirement:** `sidebar-rebrand-permissions` follow-up after implemented `TASK-001`
**Reason:** The company-admin sidebar was already implemented and visible in `/root/`, but its richer IA needed explicit current-state route semantics, a neutral shared placeholder view, and aligned layout ownership so docs/tests would match the real shell.
**Current problem resolved:** `src/public/root/manifest.js` now declares explicit company-admin sidebar route items, `src/public/root/router.js` resolves actor-aware fallback to the first accessible route, company-admin sessions default to `#admin_home` when no hash is present, `src/public/root/views/in-process.js` now uses the neutral approved copy, and shell-owned offsets are no longer duplicated inside view layouts.
**Implemented change:** Completed through `sidebar-rebrand-permissions` `TASK-002` and `TASK-003`; enriched the manifest and router for explicit company-admin route semantics, kept only `#roles_permissions` functional, routed the remaining approved company-admin entries to the shared neutral `in_process` view, normalized shell/view layout ownership, and refreshed browser/runtime tests plus architecture-facing documentation.
**Affected files:** `src/public/root/manifest.js`, `src/public/root/router.js`, `src/public/root/app.js`, `src/public/root/views/in-process.js`, `src/public/root/views/roles-admin.js`, `src/public/styles.css`, `tests/root-shell-route-governance.test.js`, `tests/browser-e2e.e2e.js`, `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, feature spec follow-up files
**Dependencies:** `sidebar-rebrand-permissions` `TASK-001` completed baseline
**Database impact:** None
**API impact:** None; existing backend endpoints remain authoritative
**Container impact:** None
**Security impact:** Low direct impact; medium UX/traceability integrity impact
**Acceptance criteria:** Company-admin visible entries have explicit current-state route semantics; `in_process` content matches the documented supported baseline; company-admin sessions land on `#admin_home` when no hash is present; docs/tests no longer imply that placeholder entries are separate functional modules.
**Validation evidence:** `npm run typecheck`; `npm run lint:public-runtime`; `npm run validate:public-runtime`; `node --test tests/root-shell-route-governance.test.js`; `node --test tests/browser-e2e.e2e.js`; `npm run build` ⚠️ pre-existing local Windows Prisma rename-lock `EPERM`
**Required tests:** Focused browser/runtime characterization coverage for admin sidebar route semantics and current `in_process` content, preserving `tests/root-shell-route-governance.test.js` and `tests/browser-e2e.e2e.js` coverage.
**Migration considerations:** Preserve root-global top navigation, the current actor split, existing `/root/` route authority, and the `410 Gone` legacy HTML contract.
**Rollback or mitigation:** Revert only the sidebar-semantics slice if route or copy changes create confusion; keep current actor-aware shell behavior intact.
**Risk:** Medium

## TASK-038: Harden root-shell internal modularity with a bounded registry seam
**Status:** Completed
**Priority:** Low
**Domain:** Embedded browser runtime / Architecture documentation
**Requirement:** `p38-root-shell-modularity-hardening`
**Reason:** The supported `/root/` shell kept behavior-preserving runtime coverage but still depended on many independent top-level globals for internal wiring.
**Implemented change:** Added `src/public/root/registry.js`, migrated shell modules to publish/consume through `window.RootShell` (`register`, `require`, `has`), then completed the follow-up `root-shell-runtime-modularity-hardening` slice by adding `src/public/root/runtime-contract.js`, aligning `src/public/root/app.js` bootstrap to that contract, and extending `scripts/validate-public-runtime.js` plus the focused governance tests to fail on missing, extra, or misordered approved shell scripts.
**Affected files:** `src/public/root/**`, `tests/root-shell-modularity-governance.test.js`, `tests/public-surface-characterization.test.js`, `tests/public-runtime-http-smoke.test.js`, `scripts/validate-public-runtime.js`, docs/spec traceability files
**Dependencies:** `root-shell-follow-up-alignment` completed baseline
**Database impact:** None
**API impact:** None; `/root/` and related APIs remain compatible
**Container impact:** None
**Security impact:** Low direct impact; medium maintainability and regression-prevention impact
**Acceptance criteria:** Focused registry-contract test exists; root-shell modules use `window.RootShell`; the approved loader/module contract is explicit and validated; `/root/` behavior and legacy `410 Gone` routes remain unchanged.
**Validation evidence:** `node --test tests/root-shell-modularity-governance.test.js`; `node --test tests/root-shell-route-governance.test.js`; `node --test tests/public-surface-characterization.test.js`; `node --test tests/public-runtime-http-smoke.test.js`; `node --test tests/browser-runtime-auth-convergence-inventory.test.js`; `node --test tests/browser-e2e.e2e.js`; `npm run validate:public-runtime`; `npm run lint:public-runtime`; `npm run typecheck`; `npm run build`
**Rollback or mitigation:** Revert the registry seam and all migrated root-shell modules together to avoid mixed global/registry wiring.
**Risk:** Low

## TASK-001: Implement confirmed tenant-isolation fixes from P11 inventory
**Status:** Completed
**Priority:** Critical
**Domain:** Multi-tenant repository governance
**Requirement:** P11 FR-004, FR-005, FR-006, FR-007, FR-008, BR-002, BR-003, AC-002, AC-004
**Reason:** P11 planning identified unsafe or review-required tenant-owned repository writes.
**Current problem:** Confirmed and review-required mutations relied on `id`-only writes or derived context instead of preserving company scope at the repository mutation boundary.
**Proposed change:** Harden the confirmed P11 inventory cases and resolve review-required cases with explicit tenant-safe behavior.
**Affected files:** `src/repositories/client.repository.js`, `src/repositories/order.repository.js`, `src/repositories/sales-route.repository.js`, `src/repositories/payment.repository.js`, `src/repositories/product.repository.js`, related services/tests/docs/specs
**Dependencies:** None
**Database impact:** None expected initially; new migration only if an approved integrity constraint becomes necessary
**API impact:** None expected
**Container impact:** None
**Security impact:** Critical positive impact
**Acceptance criteria:** Confirmed unsafe repository writes are tenant-safe at the mutation boundary; legitimate root-global flows remain functional.
**Required tests:** Cross-tenant regression tests for client documents, orders, routes, legal entities, and payment receipt replacement
**Migration considerations:** Preserve current public behavior while tightening internal write scoping.
**Rollback or mitigation:** Revert affected repository/service slice if a legitimate flow breaks; keep regression evidence.
**Risk:** High

## TASK-002: Remove direct Prisma usage from root company bootstrap flow
**Status:** Completed
**Priority:** High
**Domain:** Company administration / Architecture governance
**Requirement:** P11 FR-004, FR-005, FR-007, BR-002, AC-003
**Reason:** P11 confirmed a repository-boundary violation in `src/services/company.service.js#registerRootCompany`.
**Current problem:** The service layer performed direct Prisma reads and transaction orchestration instead of delegating persistence ownership to repositories.
**Proposed change:** Introduce repository-owned persistence orchestration for root company bootstrap while preserving transaction semantics, audit behavior, and root-global authorization constraints.
**Affected files:** `src/services/company.service.js`, `src/repositories/company.repository.js`, related tests/docs/specs
**Dependencies:** TASK-001
**Database impact:** None
**API impact:** None expected
**Container impact:** None
**Security impact:** Medium positive impact through cleaner boundary enforcement
**Acceptance criteria:** `company.service.js` no longer uses Prisma directly in the root bootstrap flow; transaction and audit behavior remain functionally equivalent.
**Required tests:** Service/repository regression tests for root company bootstrap and duplicate-admin conflict handling
**Migration considerations:** Preserve root-global exception behavior while moving persistence responsibilities.
**Rollback or mitigation:** Revert repository extraction slice if bootstrap semantics drift.
**Risk:** Medium

## TASK-029: Reconcile stale permission-governance planning metadata after `p28` foundation
**Status:** Completed
**Priority:** Medium
**Domain:** Repository/platform governance / Permission governance planning
**Requirement:** `p10-permission-governance` implementation report; `p28-flexible-permission-governance-foundation`; sidebar/navigation planning dependency accuracy
**Reason:** The repository now has completed `p10` analysis artifacts plus the first runtime implementation slice from `p28`, but some planning metadata may still imply an outdated dependency/readiness state.
**Current problem:** Older spec metadata blurred the distinction between analysis completion, partial runtime implementation, and remaining follow-up work for role-governance/UI slices; the stale `p10` readiness blocker and related sidebar dependency wording had to be reconciled to reflect actual repository state.
**Proposed change:** Reconcile spec metadata and dependency markers so future planning distinguishes clearly between analysis completion, partial implementation now in runtime, and still-pending follow-up work.
**Implementation status:** Completed documentation-only reconciliation through `p29-permission-governance-metadata-reconciliation`; `p10` readiness metadata no longer points to stale `p11`, repository docs now describe that blocker as already resolved, and `sidebar-rebrand-permissions` now points to `p30-company-role-governance-hardening` as the practical follow-up dependency.
**Affected files:** `specs/p10-permission-governance/**`, related sidebar/navigation spec metadata files, `docs/action-plan.md`, `docs/architecture.md`, future governance notes if needed
**Dependencies:** None
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** Low direct impact; medium governance/sequencing integrity impact
**Acceptance criteria:**
- `p10` metadata no longer reports stale readiness blockers that are already materially satisfied.
- Related sidebar/navigation specs reference the correct dependency state for permission-governance planning.
- Repository docs distinguish analysis completion from runtime implementation completion.
**Required tests:** Documentary review; repository validation already recorded by the implementation agent with `npm run lint`, `npm run typecheck`, `npm run build`, and `git diff --check` all passing
**Migration considerations:** Do not rewrite planning history; only clarify current readiness/dependency truth.
**Completion evidence:** `specs/p29-permission-governance-metadata-reconciliation/**`, `specs/p10-permission-governance/metadata.yaml`, `specs/sidebar-rebrand-permissions/metadata.yaml`, and this architecture-facing documentation now reflect the reconciled state.
**Rollback or mitigation:** Revert metadata-only changes if they accidentally obscure approved-but-unimplemented follow-up work.
**Risk:** Low

## TASK-031: Align architecture-facing governance documentation after `p30`
**Status:** Completed
**Priority:** Medium
**Domain:** Repository/platform governance / Architecture documentation
**Requirement:** `p31-governance-architecture-documentation-alignment`
**Reason:** After `p30`, the primary governance docs were mostly refreshed, but a few architecture-facing references still under-described the new company-role deny boundary or pointed to outdated future-work framing.
**Current problem resolved:** The repository now describes the post-`p30` baseline consistently across current-state, architecture, action-plan/task inventory, and endpoint-catalog surfaces without inventing a company-role update flow or denied-governance audit persistence.
**Implemented change:** Documentation-only alignment completed through `p31-governance-architecture-documentation-alignment`; architecture-facing docs now describe the hybrid route/service split, the implemented company-role platform-scope deny, the absence of a company-role update flow, and the still-separate denial-audit follow-up.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/runtime-endpoint-catalog.md`, `docs/tasks.md`, `specs/p31-governance-architecture-documentation-alignment/**`
**Dependencies:** TASK-030 (completed)
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** Low direct impact; medium governance/traceability impact
**Acceptance criteria:**
- Current architecture-facing docs describe the post-`p30` runtime truth without overstating convergence.
- Company-role update hardening remains documented as deferred because no runtime update surface exists.
- Denied-governance audit persistence remains documented as a separate follow-up concern rather than active behavior.
**Validation evidence:** `npm run lint`; `npm run typecheck`; `npm run build`; `git diff --check`
**Rollback or mitigation:** Revert documentation-only changes if any wording overstates runtime behavior.
**Risk:** Low

## TASK-032: Add denied governance audit visibility for company-role creation
**Status:** Completed
**Priority:** Medium
**Domain:** Identity and access / Audit observability
**Requirement:** `p32-governance-denial-audit-visibility`
**Reason:** The approved `p30` deny boundary for company-role creation blocked platform-scoped permission assignment, but denied attempts were still invisible in persisted audit history.
**Current problem resolved:** Denied `role.company.create` attempts now emit a dedicated fail-open audit attempt from the service-level governance denial path while preserving the same `403` response contract and without broadening governance scope.
**Implemented change:** `p32-governance-denial-audit-visibility` added action `roles.company.create.governance_denied` with structured denial metadata (`governanceDecision`, `denialCode`, `ruleId`, `affectedPermissions`, `requestedPermissionCodes`, `companyId`) using the existing safe audit seam.
**Affected files:** `src/services/role.service.js`, `tests/permission-governance-backend-consumption.test.js`, `tests/audit-instrumentation.test.js`, `docs/current-state.md`, `docs/architecture.md`, `docs/runtime-endpoint-catalog.md`, `specs/p32-governance-denial-audit-visibility/**`
**Dependencies:** TASK-031 (completed)
**Database impact:** None
**API impact:** None; denied response remains backward-compatible
**Container impact:** None
**Security impact:** Medium positive impact through stronger governance-denial observability
**Acceptance criteria:**
- Denied company-role governance attempts trigger safe audit recording when request context exists.
- Audit persistence failure does not change the denial response.
- Success-path role creation audit behavior remains intact.
- No new governance deny rule is introduced.
**Validation evidence:** `node --test tests/permission-governance-backend-consumption.test.js`; `node --test tests/audit-instrumentation.test.js`; `npm run lint`; `npm run typecheck`; `npm run build`; `git diff --check`
**Rollback or mitigation:** Revert deny-path audit instrumentation if it alters response semantics or produces incorrect payloads; keep the existing `p30` deny rule intact.
**Risk:** Medium

## TASK-033: Converge admin authorization/governance contract for company and company-role flows
**Status:** Completed
**Priority:** Medium
**Domain:** Identity and access / Architecture governance
**Requirement:** `p33-admin-authorization-governance-convergence` FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, BR-001, BR-002, BR-003, BR-004, AC-001, AC-002, AC-003, AC-004
**Reason:** The highest-signal company/company-role admin flows still had a hard-to-read split between route intent and service governance.
**Current problem resolved:** A bounded convergence seam now exists for the affected company/company-role admin routes without redesigning unrelated route families.
**Implemented change:** `src/security/access-policies.js` now declares explicit actor-scope checks for company list/create and company-role list/create flows, `POST /api/companies/` uses dedicated policy `company.create-global`, route-level actor-scope denials audit through action `security.authorization.access_policy`, and sensitive service-level governance remains in `company.service.js` and `role.service.js`.
**Affected files:** `src/security/access-policies.js`, `src/routes/company.routes.js`, `tests/access-policies.test.js`, `tests/company-authorization-characterization.test.js`, `tests/audit-instrumentation.test.js`, `docs/current-state.md`, `docs/architecture.md`, `docs/runtime-endpoint-catalog.md`, `specs/p33-admin-authorization-governance-convergence/**`
**Dependencies:** TASK-032 (completed)
**Database impact:** None
**API impact:** None; endpoint paths, payloads, and `403` semantics remain compatible
**Container impact:** None
**Security impact:** Medium positive impact through clearer authorization boundaries and preserved distinct denial semantics
**Acceptance criteria:**
- Company/company-role admin flows have a clearer route-policy/service-governance contract.
- Existing compatibility and `403` semantics remain intact.
- Route-level and service-level denial auditing remain distinct.
- No unrelated route families were migrated.
**Validation evidence:** `set BROWSER_SESSION_STORE_MODE=memory&& node --test tests/access-policies.test.js`; `set BROWSER_SESSION_STORE_MODE=memory&& node --test tests/company-authorization-characterization.test.js`; `set BROWSER_SESSION_STORE_MODE=memory&& node --test tests/authorization-convergence-characterization.test.js`; `set BROWSER_SESSION_STORE_MODE=memory&& node --test tests/audit-instrumentation.test.js`; `node --test tests/permission-governance-backend-consumption.test.js`; `npm run lint`; `npm run typecheck`; `npm run build`; `git diff --check`
**Rollback or mitigation:** Revert only the bounded actor-scope seam if it changes compatibility or weakens the distinct service-level governance checks.
**Risk:** Medium

## TASK-030: Harden company-role governance beyond warning-only audit metadata
**Status:** Completed
**Priority:** High
**Domain:** Identity and access / Role governance
**Requirement:** `p10-permission-governance`; `p28-flexible-permission-governance-foundation`
**Reason:** `p28` introduced a centralized governance foundation and warning contract, but tenant role creation still allows any active permission combination accepted by the current backend.
**Current problem:** `src/services/role.service.js` previously evaluated governance for `role.company.create` only as audit metadata; the first approved hardening slice needed to enforce the platform-vs-tenant boundary without broadening deny scope beyond repository evidence.
**Proposed change:** Extend backend company-role governance to use the centralized foundation for explicit allow/warn/deny handling on company-role creation, preserving compatibility until each new deny rule is explicitly approved. Update-flow hardening remains deferred because no runtime update surface exists.
**Affected files:** `src/services/role.service.js`, `src/security/permission-governance*.js`, related role routes/tests, `docs/current-state.md`, `docs/architecture.md`, future spec artifacts if approved
**Dependencies:** TASK-029 (completed)
**Database impact:** None expected
**API impact:** Possible error/warning contract expansion for role-governance responses; must remain backward-compatible unless separately approved
**Container impact:** None
**Security impact:** High positive impact through tighter tenant-role governance and clearer platform-vs-tenant separation
**Acceptance criteria:**
- Approved deny rules for company-role governance are enforced in backend services.
- Warning-only rules remain structured and documented when not yet approved for denial.
- Tests cover allowed, warned, and denied company-role combinations.
- Docs distinguish current runtime behavior from future policy ambitions.
**Implementation status:** Completed through `p30-company-role-governance-hardening`; `companies.manage` is now denied in company-role creation before persistence, warning-only combinations remain allowed, and update hardening remains deferred because no update flow exists.
**Required tests:** Completed with focused governance unit tests and role-service characterization coverage: `tests/permission-governance-foundation.test.js` and `tests/permission-governance-backend-consumption.test.js`
**Validation evidence:** `npm run lint`; `npm run typecheck`; `npm run build`; `node --test tests/permission-governance-foundation.test.js`; `node --test tests/permission-governance-backend-consumption.test.js tests/permission-governance-foundation.test.js`; `git diff --check`
**Migration considerations:** Introduce deny rules incrementally and only for approved combinations to avoid breaking legitimate tenant flows.
**Rollback or mitigation:** Revert new deny decisions to warning-only posture if production behavior or approval scope proves incorrect.
**Risk:** High

## TASK-009: Document browser-session HTTPS dependency and prepare partial hardening slice
**Status:** Completed
**Priority:** Medium
**Domain:** Frontend/session security governance
**Requirement:** future P11 hardening follow-up for browser session risk
**Reason:** Browser auth/session state still depends on `localStorage`, but the environment is still test-only and does not yet expose the final HTTPS capability required for a full `Secure` cookie-based closure.
**Current problem:** The repository needs explicit documentation that final browser-session hardening is blocked from full closure by the lack of HTTPS, while still allowing partial mitigations that reduce client-side exposure before the final deployment model exists.
**Proposed change:** Record the HTTPS dependency as technical debt in architecture/current-state/action-plan docs and implement a separate approved preparatory slice for partial mitigations such as centralized session access, reduced client persistence, and improved session cleanup without claiming full closure.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, future spec package for session-hardening prep, browser runtime files under `src/public/**` when approved
**Dependencies:** TASK-008
**Database impact:** None
**API impact:** None unless a later approved session-hardening prep slice requires compatibility-safe auth response changes
**Container impact:** None
**Security impact:** Medium positive governance impact through explicit risk framing before partial mitigations
**Acceptance criteria:** Docs explicitly state the HTTPS dependency for final session hardening; a follow-up spec exists for partial mitigations; no false claim is made that `localStorage` session risk is fully closed before HTTPS exists.
**Implemented outcome:** Technical debt was documented and the approved preparatory mitigation slice centralized browser-session read/write/cleanup through `src/public/shared/session.js` while preserving the current runtime contract.
**Required tests:** documentation/spec review for this planning slice; future session-hardening prep validations to be defined by the approved follow-up spec
**Risk:** Medium

## TASK-012: Converge browser-runtime auth helpers before HTTPS-backed cookie migration
**Status:** Completed
**Priority:** Medium
**Domain:** Frontend/session security governance
**Requirement:** future P11 browser-session hardening follow-up
**Reason:** After centralizing browser-session read/write/cleanup, browser auth header construction and `401` handling are still distributed across multiple public runtime pages.
**Current problem:** Future auth/security changes still require broad edits because many pages keep local `authHeaders()` patterns or inline unauthorized-response handling.
**Proposed change:** Create and approve a follow-up slice that converges authenticated request construction and unauthorized-response cleanup onto shared public-runtime helper(s) while preserving the current `localStorage` compatibility baseline and deferring HTTPS-backed secure-cookie migration.
**Affected files:** `src/public/shared/**`, selected `src/public/agent/**`, `src/public/warehouse/**`, selected `src/public/root/**`, `scripts/validate-public-runtime.js`, related tests, follow-up spec package
**Dependencies:** TASK-009
**Database impact:** None
**API impact:** None unless a later approved auth/logout slice changes backend contracts
**Container impact:** None
**Security impact:** Medium positive impact through reduced auth drift and narrower regression surface
**Acceptance criteria:** Shared auth-runtime helper(s) cover approved priority pages; duplicated `401` handling is reduced; docs/tests reflect that HTTPS is still required for final session closure.
**Implemented outcome:** `src/public/shared/auth.js` now centralizes auth-header construction and approved `401` cleanup for priority runtime pages, with migrated agent, warehouse, and selected root helpers plus updated validators/tests.
**Required tests:** public-runtime validators, characterization tests, browser E2E for affected flows
**Validation evidence:** `npm run lint:public-runtime`; `npm run validate:public-runtime`; `node --test tests/public-surface-characterization.test.js tests/public-session-helper-characterization.test.js tests/public-auth-helper-characterization.test.js`; `node --test tests/browser-e2e.e2e.js`; `npm run lint`; `npm run typecheck`; `npm run build`
**Risk:** Medium

## TASK-003: Expand typecheck coverage and enforce stronger CI evidence for critical controls
**Status:** Completed
**Priority:** High
**Domain:** Platform / CI governance
**Requirement:** P11 FR-005, FR-011, FR-012, FR-013, FR-014, FR-015, BR-005, AC-003, AC-006, AC-007
**Reason:** P11 classified evidence strength but the repository needed stronger mandatory CI mapping and incremental static coverage.
**Current problem:** Relevant repository/schema areas were excluded from typecheck and some important controls lacked a dedicated required CI gate.
**Proposed change:** Expand approved typecheck coverage incrementally, classify critical tests in repository docs/workflows, and ensure important controls are covered by required jobs or documented exceptions.
**Affected files:** `tsconfig.typecheck.json`, `.github/workflows/*`, `tests/*.test.js`, `scripts/run-tests.js`, governance docs/specs
**Dependencies:** TASK-001, TASK-002
**Database impact:** None directly
**API impact:** None
**Container impact:** Possible CI/runtime image alignment later
**Security impact:** High positive impact through stronger verification
**Acceptance criteria:** Typecheck coverage expands over approved surfaces; critical controls have required CI jobs or approved documented exceptions.
**Required tests:** Updated static checks, workflow validation, and CI-governance tests
**Migration considerations:** Expand coverage incrementally to keep signal actionable.
**Rollback or mitigation:** Revert the last coverage expansion slice if it blocks unrelated work without clear remediation path.
**Risk:** High

## TASK-004: Migrate the repository baseline to Node.js 24 LTS and record mainline validation
**Status:** Completed
**Priority:** High
**Domain:** Runtime platform baseline
**Requirement:** P11 FR-003, FR-004, FR-005, FR-006, FR-007, FR-009, FR-010, FR-013, FR-015, AC-001, AC-002, AC-003, AC-005, AC-007
**Reason:** P11 required the real repository baseline to move from Node 20 to Node.js 24 LTS with compatibility evidence rather than a documentation-only version bump.
**Current problem:** The repository previously declared Node 20 in package, Docker, and workflows, and historical Node 24 evidence had reported Prisma/runtime uncertainty.
**Proposed change:** Align package/runtime/workflow Node baselines to Node 24, preserve the existing Prisma bootstrap when compatible, and revalidate the mainline path.
**Affected files:** `package.json`, `Dockerfile`, `.github/workflows/*`, `scripts/prisma-generate-safe-lib.js`, `scripts/validate-workflow-baseline.js`, workflow characterization tests, `README.md`, relevant specs/docs
**Dependencies:** TASK-003
**Database impact:** None
**API impact:** None
**Container impact:** Runtime/build image updated to Node 24 and validated through Docker build evidence
**Security impact:** Medium positive impact through supported-platform alignment
**Acceptance criteria:** Repository baseline targets Node.js 24 in package/runtime/workflow configuration and the previously reported Prisma constructor incompatibility is no longer reproduced on the validated clean path.
**Required tests:** `npm ci`, `npm run build`, `npm run lint`, `npm run typecheck`, `node --test tests/taxpayer-characterization.test.js`, `npm run validate:workflow-baseline`, workflow characterization tests, validators, and aggregate tests
**Migration considerations:** Keep the Windows Prisma rename-lock behavior classified as a pre-existing baseline issue unless new evidence proves otherwise.
**Rollback or mitigation:** Revert Node baseline declarations only if a later critical incompatibility is reproduced and cannot be isolated safely.
**Risk:** Medium

## TASK-005: Complete cross-surface closure evidence for the Node.js 24 baseline
**Status:** Completed
**Priority:** High
**Domain:** Runtime platform baseline / CI evidence
**Requirement:** P11 FR-008, FR-009, FR-012, FR-016, AC-003, AC-004, AC-006, AC-008
**Reason:** The Node 24 baseline needed evidence across local/mainline, Docker, and hosted workflow surfaces before the feature could be treated as closed.
**Current problem:** Closure previously lacked hosted root-workflow evidence after the official workflow location changed to repository root.
**Proposed change:** Align the root official workflows, preserve `working-directory: inventory-api`, and record hosted success evidence for the Node 24 baseline.
**Affected files:** `/.github/workflows/windows-prisma-build.yml`, `/.github/workflows/p0-quality-gates.yml`, `/.github/workflows/static-checks.yml`, `/.github/workflows/repository-tests.yml`, `/.github/workflows/contract-validations.yml`, `/.github/workflows/browser-e2e.yml`, `/.github/workflows/operational-smoke.yml`, `/.github/workflows/build-and-publish.yml`, `/.github/workflows/db-constraints-tests.yml`, `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `specs/p11-node24-runtime-migration/*`
**Dependencies:** TASK-004
**Database impact:** None
**API impact:** None
**Container impact:** None beyond preserving the implemented Node 24 image baseline
**Security impact:** Low direct impact; medium governance impact through stronger release evidence
**Acceptance criteria:** Browser E2E and Docker evidence are recorded; a hosted Node 24 Windows workflow run is reviewed successfully; documentation distinguishes the root official workflow location from application-local workflow copies.
**Required tests:** Local `npm run validate:workflow-baseline`; `node --test tests/workflow-baseline-characterization.test.js tests/prisma-windows-build-stabilization.test.js`; hosted runs `30281932831`, `30281933453`, `30281933525`, `30281935485`, `30281937000`, `30281935398`
**Migration considerations:** Treat any future hosted Windows failure signature separately from the historical rename-lock path.
**Rollback or mitigation:** If a future surface fails, reopen the compatibility task instead of rolling back documented evidence.
**Risk:** Medium

## TASK-006: Retire duplicated application-local workflow YAML and preserve root-only governance
**Status:** Completed
**Completed at:** 2026-07-27
**Priority:** High
**Domain:** CI/workflow governance
**Requirement:** Architectural objective AO-001 workflow source-of-truth governance after root alignment
**Reason:** The repository already established `/.github/workflows/` as the official source of truth; the remaining application-local workflow YAML only adds maintainability drift.
**Current problem:** Although validators/tests already anchor to the official root workflow tree, the repository still versions duplicated YAML under `inventory-api/.github/workflows/`.
**Proposed change:** Remove the duplicated application-local workflow YAML, update validators/tests to read the root official workflows directly, and refresh architecture-facing docs accordingly.
**Affected files:** `scripts/validate-workflow-baseline.js`, `tests/workflow-baseline-characterization.test.js`, `tests/prisma-windows-build-stabilization.test.js`, `inventory-api/.github/workflows/*`, `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`
**Dependencies:** TASK-005
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** Medium positive impact through stronger governance integrity
**Acceptance criteria:** Root workflows are the only versioned workflow definitions; validators/tests use the root tree directly; documentation no longer describes an active duplicated mirror.
**Implemented files:** `inventory-api/scripts/validate-workflow-baseline.js`, `inventory-api/tests/workflow-baseline-characterization.test.js`, `inventory-api/tests/prisma-windows-build-stabilization.test.js`, `inventory-api/docs/current-state.md`, `inventory-api/docs/architecture.md`, `inventory-api/docs/action-plan.md`, `inventory-api/docs/tasks.md`, `inventory-api/docs/prisma-windows-stability-evidence.md`, removed `inventory-api/.github/workflows/*.yml`
**Validation evidence:** `npm run validate:workflow-baseline`; `node --test tests/workflow-baseline-characterization.test.js tests/prisma-windows-build-stabilization.test.js`; `git diff --check`
**Migration considerations:** Preserve current root hosted workflow behavior while removing local duplication.
**Rollback or mitigation:** Revert only the governance slice if a hidden local reference to the deleted YAML is discovered.
**Risk:** Medium

## TASK-007: Repair restore-readiness smoke contract and publish its public baseline
**Status:** Completed
**Completed at:** 2026-07-27
**Priority:** High
**Domain:** Operational governance
**Requirement:** Operational smoke baseline consistency after root workflow convergence
**Reason:** `operational-smoke` invoked `npm run validate:restore-readiness` even though `package.json` did not expose that command, and the validator/tests were still split between public `docs/` and optional `internal-docs/` assumptions.
**Current problem resolved:** The repository now exposes the npm command, validates restore readiness against public `docs/` artifacts, documents the same contract in the production baseline and runbook, and keeps `validate:operational-readiness` aligned to the root workflow path.
**Implemented files:** `inventory-api/package.json`, `inventory-api/scripts/validate-restore-readiness.js`, `inventory-api/scripts/validate-operational-readiness.js`, `inventory-api/tests/workflow-baseline-characterization.test.js`, `inventory-api/tests/production-baseline-characterization.test.js`, `inventory-api/tests/restore-readiness-characterization.test.js`, `inventory-api/docs/production-baseline.md`, `inventory-api/docs/restore-readiness-baseline.md`
**Validation evidence:** `npm run build`; `npm run lint`; `npm run typecheck`; `npm run validate:workflow-baseline`; `npm run validate:restore-readiness`; `npm run validate:operational-readiness`; `node --test tests/workflow-baseline-characterization.test.js tests/prisma-windows-build-stabilization.test.js`; `node --test tests/production-baseline-characterization.test.js tests/restore-readiness-characterization.test.js`; `git diff --check`
**Migration considerations:** Preserve the existing `operational-smoke` workflow step while making the package/validator/docs contract real.
**Rollback or mitigation:** Revert only the restore-readiness contract slice if a later hosted run reveals a second independent operational-smoke defect.
**Risk:** Medium

## TASK-008: Converge operational-readiness to the public docs baseline and codify `.env.production.example`
**Status:** Completed
**Completed at:** 2026-07-27
**Priority:** High
**Domain:** Operational governance / Production baseline governance
**Requirement:** `p11-operational-readiness-public-baseline` FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-009, FR-010; BR-001, BR-002, BR-003; AC-001, AC-002, AC-003, AC-004, AC-005
**Reason:** After restore-readiness moved to public docs, the public operational-readiness gate still depended on optional private overlays and `.env.production.example` still needed explicit contractual closure.
**Current problem resolved:** `validate:operational-readiness` now validates `docs/production-baseline.md` and `docs/production-operations-runbook.md` directly, `.env.production.example` is required by the production baseline validator and characterization tests, remains intentionally tracked through the `!.env.production.example` exception in `inventory-api/.gitignore`, and the public contract converged without introducing a third operational-readiness document.
**Implemented files:** `inventory-api/.gitignore`, `inventory-api/scripts/validate-operational-readiness.js`, `inventory-api/scripts/validate-production-baseline.js`, `inventory-api/tests/production-baseline-characterization.test.js`, `inventory-api/docs/production-baseline.md`, `inventory-api/docs/production-operations-runbook.md`, `inventory-api/README.md`, `inventory-api/docs/current-state.md`, `inventory-api/docs/architecture.md`, `inventory-api/docs/action-plan.md`, `inventory-api/docs/tasks.md`, `inventory-api/specs/p11-operational-readiness-public-baseline/*`
**Dependencies:** TASK-007
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** Medium positive governance impact through auditable public readiness evidence and explicit baseline-artifact validation
**Acceptance criteria:** Operational-readiness validates public `docs/` artifacts without `internal-docs/` prerequisites; `.env.production.example` remains versioned, documented, and validator-covered; README and public docs describe the same operational-readiness contract; no third public operational-readiness document is required.
**Required tests:** `npm run validate:operational-readiness`; `node --test tests/production-baseline-characterization.test.js tests/restore-readiness-characterization.test.js`; `npm run validate:production-baseline` with explicit production environment values; `npm run lint`; `npm run typecheck`; `npm run build`; hosted `operational-smoke` run `30291012752`
**Migration considerations:** Preserve the existing `operational-smoke` workflow path and Node 24 baseline while shifting the gate to public repository artifacts only.
**Rollback or mitigation:** Revert only this governance slice if a later approved change demonstrates that the two-document public contract is insufficient.
**Risk:** Medium

## TASK-010: Centralize browser-session read/write/cleanup for the embedded public runtime
**Status:** Completed
**Completed at:** 2026-07-27
**Priority:** High
**Domain:** Frontend/session security governance
**Requirement:** `p11-session-hardening-prep` FR-002, FR-003, FR-004, FR-005, FR-006; BR-001, BR-002, BR-003
**Reason:** The browser runtime still depended on client-side session persistence, but session bootstrap and cleanup behavior needed a safer compatibility seam before any future HTTPS-backed cookie migration.
**Current problem resolved:** Session read/write/cleanup was previously open-coded across public pages. The repository now uses `src/public/shared/session.js` as the active helper for storage-key ownership, payload sanitization, malformed-session cleanup, and redirect-to-login behavior, while preserving the current `localStorage` compatibility baseline.
**Proposed change:** Add a shared browser-session helper, converge critical login/root/warehouse/agent screens onto it, and add characterization/runtime validation coverage without changing the overall auth model or claiming full security closure.
**Affected files:** `src/public/shared/session.js`, `src/public/index.html`, `src/public/login.js`, `src/public/no-access.html`, `src/public/agent/*.html`, `src/public/agent/*.js`, `src/public/root/*.html`, `src/public/root/*.js`, `src/public/warehouse/products.html`, `src/public/warehouse/products.js`, `scripts/validate-public-runtime.js`, `tests/public-surface-characterization.test.js`, `tests/public-session-helper-characterization.test.js`, `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`
**Dependencies:** TASK-009
**Database impact:** None
**API impact:** None; `/api/auth/login` and protected API contracts remain unchanged
**Container impact:** None
**Security impact:** Medium positive impact through centralized browser-session cleanup, payload minimization, and corrupt-session removal; residual token-exposure risk remains because `localStorage` is still used
**Acceptance criteria:** The embedded login screen persists sessions through the shared helper; malformed stored sessions are cleared automatically; protected root/warehouse/agent screens bootstrap from the helper; logout and unauthorized cleanup use helper-driven redirect behavior; runtime validators and characterization tests cover the shared helper contract.
**Implemented files:** `inventory-api/src/public/shared/session.js`, `inventory-api/src/public/index.html`, `inventory-api/src/public/login.js`, `inventory-api/src/public/no-access.html`, `inventory-api/src/public/agent/order-entry.html`, `inventory-api/src/public/agent/order-entry.js`, `inventory-api/src/public/agent/visit.html`, `inventory-api/src/public/agent/visit.js`, `inventory-api/src/public/agent/workspace.html`, `inventory-api/src/public/agent/workspace.js`, `inventory-api/src/public/root/client-detail.html`, `inventory-api/src/public/root/client-detail.js`, `inventory-api/src/public/root/client-detail.shared.js`, `inventory-api/src/public/root/clients.html`, `inventory-api/src/public/root/clients.js`, `inventory-api/src/public/root/dashboard.html`, `inventory-api/src/public/root/dashboard.js`, `inventory-api/src/public/root/index.html`, `inventory-api/src/public/root/index.js`, `inventory-api/src/public/root/invoice-inconsistencies.html`, `inventory-api/src/public/root/invoice-inconsistencies.js`, `inventory-api/src/public/root/products.html`, `inventory-api/src/public/root/products.js`, `inventory-api/src/public/root/products.shared.js`, `inventory-api/src/public/root/roles.html`, `inventory-api/src/public/root/roles.js`, `inventory-api/src/public/root/routes.html`, `inventory-api/src/public/root/routes.js`, `inventory-api/src/public/root/users.html`, `inventory-api/src/public/root/users.js`, `inventory-api/src/public/root/warehouses.html`, `inventory-api/src/public/root/warehouses.js`, `inventory-api/src/public/root/zones.html`, `inventory-api/src/public/root/zones.js`, `inventory-api/src/public/warehouse/products.html`, `inventory-api/src/public/warehouse/products.js`, `inventory-api/scripts/validate-public-runtime.js`, `inventory-api/tests/public-surface-characterization.test.js`, `inventory-api/tests/public-session-helper-characterization.test.js`, `inventory-api/docs/current-state.md`, `inventory-api/docs/architecture.md`, `inventory-api/docs/action-plan.md`, `inventory-api/docs/tasks.md`
**Validation evidence:** `npm run build`; `npm run lint`; `npm run typecheck`; `npm run lint:public-runtime`; `npm run validate:public-runtime`; `node --test tests/public-surface-characterization.test.js tests/public-session-helper-characterization.test.js`; `node --test tests/browser-e2e.e2e.js`; `git diff --check`
**Migration considerations:** Preserve the current bearer-token and `localStorage` behavior until a separate HTTPS-capable secure-cookie migration is approved.
**Rollback or mitigation:** Revert only the browser-runtime helper slice if a protected page bootstrap regression appears; preserve the characterization tests for diagnosis.
**Risk:** Medium

## TASK-011: Close browser bearer persistence with a backend-owned browser-session boundary
**Status:** Completed
**Priority:** High
**Domain:** Frontend/session security governance
**Requirement:** `p12-browser-session-closure` FR-001, FR-002, FR-003, FR-004, FR-005; BR-001, BR-002, BR-003, BR-004; AC-001, AC-002, AC-003, AC-004, AC-005
**Reason:** The helper-based preparation baseline still left the supported browser runtime dependent on browser-readable persisted bearer credentials and client-only logout semantics.
**Current problem resolved:** Supported embedded browser flows no longer persist bearer tokens in `localStorage`. The backend now owns browser-session issuance, validation, refresh, and invalidation through a cookie boundary, and the later `p17-browser-auth-compatibility-removal` slice removed the supported-page compatibility sentinel bridge so those pages are now cookie-auth only.
**Proposed change:** Issue browser sessions from `/api/auth/login` when `X-Inventory-Browser-Session: cookie` is requested, validate cookie sessions in `authenticate.js`, refresh browser cookies through `/api/auth/me`, invalidate them through `/api/auth/logout`, bootstrap supported pages from cookie-backed state via `src/public/shared/session.js`, and preserve same-origin/browser compatibility with shared helpers and characterization coverage.
**Affected files:** `src/services/browser-session.service.js`, `src/lib/browser-session.js`, `src/services/auth.service.js`, `src/middlewares/authenticate.js`, `src/routes/auth.routes.js`, `src/public/shared/session.js`, `src/public/shared/auth.js`, `src/public/login.js`, selected `src/public/root/**`, `src/public/warehouse/products.js`, `src/public/agent/workspace.js`, `scripts/validate-public-runtime.js`, `tests/browser-session-auth-boundary.test.js`, `tests/public-session-helper-characterization.test.js`, `tests/public-auth-helper-characterization.test.js`, `tests/public-surface-characterization.test.js`, `tests/browser-e2e.e2e.js`, related docs/specs
**Dependencies:** TASK-010, TASK-012
**Database impact:** None
**API impact:** Yes; `/api/auth/login` now supports browser-session issuance via `X-Inventory-Browser-Session: cookie`, `/api/auth/me` refreshes browser-session cookies for cookie-authenticated requests, and `/api/auth/logout` is part of the supported auth surface
**Container impact:** None
**Security impact:** High positive impact through removal of supported browser bearer persistence and introduction of backend-owned invalidation semantics
**Acceptance criteria:** Supported browser flows no longer persist bearer tokens in `localStorage`; `/api/auth/login` can issue browser sessions; `/api/auth/me` returns the browser-session user projection and refreshes cookies; `/api/auth/logout` invalidates the browser session and clears cookies; mutating cookie-authenticated requests enforce same-origin `Origin` validation; docs/runtime validators/tests reflect the implemented state.
**Implemented outcome:** The repository now uses an opaque `inventory_browser_session` `HttpOnly` cookie plus a signed `inventory_browser_state` cookie, shared browser helpers bootstrap/logout through same-origin requests, and supported browser pages now authenticate through cookie auth without a browser-visible compatibility sentinel.
**Required tests:** `node --test tests/browser-session-auth-boundary.test.js tests/public-session-helper-characterization.test.js tests/public-auth-helper-characterization.test.js tests/public-surface-characterization.test.js tests/browser-e2e.e2e.js`; `npm run validate:public-runtime`; `npm run lint`; `npm run typecheck`; `npm run build`
**Migration considerations:** Do not reintroduce persisted browser bearer storage or browser-visible compatibility bearer paths on supported pages.
**Rollback or mitigation:** Revert only the browser-session closure slice if a supported browser flow regresses; preserve the boundary/helper/browser characterization suites for diagnosis.
**Risk:** Medium

## TASK-013: Externalize browser-session storage beyond the in-memory process boundary
**Status:** Completed
**Priority:** Medium
**Domain:** Frontend/session security governance / Runtime platform
**Requirement:** Current architectural limitation after `p12-browser-session-closure`; implemented by `p16-browser-session-persistent-store`
**Reason:** The implemented browser-session boundary was backend-owned, but the original session store was a process-local `Map`.
**Current problem resolved:** Supported non-test browser sessions no longer depend on process-local memory. `src/services/browser-session.service.js` now resolves its backing store through `src/services/browser-session-store.factory.js`, defaults to Redis outside explicit test-memory mode, uses async store calls across auth/login/logout/middleware callsites, and is now operationally aligned with the versioned baseline that explicitly declares `BROWSER_SESSION_STORE_MODE=redis` plus `REDIS_URL`.
**Proposed change:** Introduce a shared browser-session store abstraction that preserves the current cookie contracts while removing the supported production single-process limitation, keep explicit memory mode for tests, fail explicitly when the configured Redis-backed store is unavailable, and align env examples, compose files, validators, docs, README, and workflow smoke coverage around that supported Redis baseline.
**Affected files:** `src/services/browser-session.service.js`, `src/services/browser-session-store.factory.js`, `src/services/browser-session-memory.store.js`, `src/services/browser-session-redis.store.js`, auth middleware/routes/services callsites, `.env.example`, `.env.production.example`, `docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.prod.yml`, `scripts/validate-production-baseline.js`, `scripts/validate-workflow-baseline.js`, `.github/workflows/operational-smoke.yml`, `README.md`, `docs/production-baseline.md`, related docs/tests
**Dependencies:** TASK-011
**Database impact:** None
**API impact:** None expected; cookie contracts remain stable
**Container impact:** Environment/runtime now requires Redis configuration for the supported non-test path; compose baselines now declare the Redis service plus `BROWSER_SESSION_STORE_MODE` and `REDIS_URL`
**Security impact:** Medium positive impact through stronger session durability and explicit failure semantics
**Acceptance criteria:** Browser-session validation and invalidation survive process restarts or multi-instance deployment according to the Redis-backed store model; test mode remains explicit memory mode; Redis-unavailable runtime fails explicitly rather than silently downgrading; the versioned operational baseline documents and validates `BROWSER_SESSION_STORE_MODE=redis` plus `REDIS_URL` consistently.
**Implemented outcome:** Browser-session persistence is now externalized behind the store abstraction and the final operational baseline alignment explicitly declares Redis as the supported non-test store across env examples, compose files, validators, docs, README, and hosted operational smoke coverage.
**Required tests:** `node --test tests/browser-session-service-characterization.test.js tests/browser-session-redis-store.test.js tests/browser-session-callsite-characterization.test.js tests/browser-session-auth-boundary.test.js tests/browser-e2e.e2e.js`; `node --test tests/production-baseline-characterization.test.js tests/workflow-baseline-characterization.test.js`; `npm run validate:public-runtime`; `npm run validate:workflow-baseline`; `npm run validate:production-baseline` with explicit production environment values; `docker compose -f docker-compose.prod.yml config` with temporary `.env.production`; `npm run lint`; `npm run typecheck`; `npm run build`
**Migration considerations:** Preserve the current cookie names and helper contracts; keep memory mode explicit and scoped to tests or explicit configuration; keep workflow/docs/env/compose alignment synchronized with the Redis baseline.
**Rollback or mitigation:** Revert only the externalized-session storage slice or the follow-up operational-baseline alignment if deployment-specific regressions appear.
**Risk:** Medium

## TASK-014: Retire compatibility-sentinel drift from remaining browser modules
**Status:** Completed
**Priority:** Medium
**Domain:** Frontend/session security governance
**Requirement:** Current architectural limitation after `p12-browser-session-closure`
**Reason:** Supported flows now use the backend-owned cookie session boundary, but some modules still rely on direct request patterns and the compatibility sentinel bridge.
**Current problem resolved:** Supported root, warehouse, and agent pages no longer depend on `session.token` guards, compatibility bearer headers, or the sentinel-aware browser branch in `authenticate.js`. Browser auth behavior is still partially distributed structurally across some non-priority page scripts, which is now convergence debt rather than a supported auth-contract gap.
**Proposed change:** Incrementally move remaining browser modules to `src/public/shared/auth.js` and remove explicit sentinel/header assumptions where no longer needed.
**Affected files:** `src/public/root/**`, `src/public/warehouse/**`, `src/public/agent/**`, `scripts/validate-public-runtime.js`, related tests/docs/specs
**Dependencies:** TASK-011
**Database impact:** None
**API impact:** None expected
**Container impact:** None
**Security impact:** Medium positive impact through narrower browser auth drift surface
**Acceptance criteria:** Remaining approved browser modules delegate authenticated fetch/bootstrap/logout behavior to the shared helpers; compatibility-sentinel assumptions are removed from supported flows without breaking them.
**Required tests:** `tests/public-auth-helper-characterization.test.js`, `tests/public-surface-characterization.test.js`, `tests/browser-e2e.e2e.js`, `npm run validate:public-runtime`
**Migration considerations:** Remove compatibility-path assumptions incrementally and preserve current browser routes/user journeys.
**Rollback or mitigation:** Revert only the affected browser-module slice if a supported page flow regresses.
**Risk:** Medium

## TASK-015: Strengthen Redis operational safeguards for browser-session persistence
**Status:** Completed
**Completed at:** 2026-07-28
**Implemented files:** `src/services/browser-session-memory.store.js`, `src/services/browser-session-redis.store.js`, `src/services/browser-session.service.js`, `src/routes/health.routes.js`, `docs/production-baseline.md`, `docs/production-operations-runbook.md`, `tests/browser-session-redis-store.test.js`, `tests/browser-session-service-characterization.test.js`, `tests/health-routes.test.js`
**Validation evidence:** `node --test tests/browser-session-redis-store.test.js`; `node --test tests/browser-session-service-characterization.test.js`; `node --test tests/health-routes.test.js`; `node --test tests/production-baseline-characterization.test.js`; `node --test tests/browser-session-auth-boundary.test.js`; `npm run test:redis-path`; `npm run validate:operational-readiness`; `npm run lint -- --quiet`; `npm run typecheck`; `npm run build`; `npm run test -- --silent`
**Priority:** Medium
**Domain:** Frontend/session security governance / Runtime platform
**Requirement:** Remaining architectural limitation after `p16-browser-session-persistent-store`
**Reason:** The supported non-test browser-session path is now correctly aligned on Redis, but runtime assurance still relies mainly on configuration validation and explicit failure behavior.
**Current problem:** Redis-backed browser-session persistence lacks stronger repository-level observability and recovery guidance beyond validators, smoke coverage, and explicit runtime failure semantics.
**Proposed change:** Add incremental Redis operational hardening such as clearer health/diagnostic signals, improved failure observability, and documented recovery expectations without changing the active cookie contract.
**Affected files:** `src/services/browser-session-redis.store.js`, `src/services/browser-session.service.js`, `src/routes/health.routes.js`, `docs/production-baseline.md`, `docs/production-operations-runbook.md`, related tests/specs
**Dependencies:** TASK-013
**Database impact:** None
**API impact:** Low; `GET /health/ready` now includes browser-session-store readiness in its operational contract while preserving `GET /health` compatibility
**Container impact:** Possible additions to Redis/app health signaling only
**Security impact:** Medium positive impact through faster detection and safer operation of browser-session persistence dependencies
**Acceptance criteria:** Approved diagnostics or observability improvements make Redis-backed browser-session dependency status easier to detect and operate without weakening current explicit-failure behavior or cookie boundaries.
**Implemented outcome:** `/health/ready` now combines database readiness with browser-session-store readiness, Redis-backed store outages map to explicit `503 service_unavailable` behavior instead of silent downgrade, memory mode stays explicitly compatible for tests, and the production baseline/runbook now document diagnosis and recovery expectations.
**Required tests:** `node --test tests/browser-session-redis-store.test.js`; `node --test tests/browser-session-service-characterization.test.js`; `node --test tests/health-routes.test.js`; `node --test tests/production-baseline-characterization.test.js`; `node --test tests/browser-session-auth-boundary.test.js`; `npm run test:redis-path`; `npm run validate:operational-readiness`; `npm run lint -- --quiet`; `npm run typecheck`; `npm run build`; `npm run test -- --silent`
**Migration considerations:** Keep the supported Redis baseline stable while improving operational signals incrementally.
**Rollback or mitigation:** Revert only the observability/hardening slice if it creates noise or contract drift.
**Risk:** Medium

## TASK-016: Converge supported root browser auth runtime on shared helper ownership
**Status:** Completed
**Priority:** Medium
**Domain:** Frontend/session security governance / Embedded browser runtime
**Requirement:** `p18-browser-runtime-auth-convergence-final` FR-001, FR-002, FR-003, FR-004, FR-005; AC-001, AC-002, AC-003, AC-004
**Reason:** After `p17`, the backend-owned cookie session boundary was implemented, but several supported root pages still kept page-local auth-header builders and distributed JSON auth behavior.
**Current problem resolved:** The targeted supported root screens now delegate authenticated JSON fetch, logout, protected downloads, or unauthorized cleanup through `src/public/shared/auth.js` and supporting shared modules instead of maintaining page-local auth-header builders.
**Proposed change:** Freeze the remaining supported auth divergence with characterization coverage, converge the targeted root pages on direct shared-helper ownership, remove redundant page-local auth logic, and refresh validator/documentation coverage to the final converged cookie-auth runtime model.
**Affected files:** `src/public/root/index.js`, `src/public/root/users.js`, `src/public/root/roles.js`, `src/public/root/warehouses.js`, `src/public/root/zones.js`, `src/public/root/routes.js`, `src/public/root/routes.shared.js`, `src/public/root/clients.js`, `src/public/root/clients.shared.js`, `src/public/root/client-detail.shared.js`, `src/public/root/client-detail.references.js`, `scripts/validate-public-runtime.js`, `tests/browser-runtime-auth-convergence-inventory.test.js`, `tests/public-surface-characterization.test.js`, `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `specs/p18-browser-runtime-auth-convergence-final/*`
**Dependencies:** TASK-014
**Database impact:** None
**API impact:** None; browser pages continue using the existing `/api/auth/*` and existing domain endpoints
**Container impact:** None
**Security impact:** Medium positive impact through reduced browser auth drift and removal of duplicated page-local auth-header logic on supported root pages
**Acceptance criteria:** Targeted supported root pages no longer keep page-local auth-header builders; shared browser helpers remain the supported auth-runtime seam; residual divergence is explicitly inventoried; validators/tests/docs reflect the converged cookie-auth browser model.
**Required tests:** `node --test tests/browser-runtime-auth-convergence-inventory.test.js tests/public-surface-characterization.test.js tests/public-session-helper-characterization.test.js tests/public-auth-helper-characterization.test.js tests/browser-session-auth-boundary.test.js tests/browser-e2e.e2e.js`; `npm run validate:public-runtime`; `npm run lint`; `npm run typecheck`; `npm run build`
**Migration considerations:** Preserve current root routes and page-specific guards while removing only duplicated auth-header ownership on the targeted supported pages.
**Rollback or mitigation:** Revert only the supported-root convergence slice if a browser regression appears; preserve the convergence inventory and public-surface characterization tests for diagnosis.
**Risk:** Medium

## TASK-017: Expand the first approved public-runtime typecheck allowlist
**Status:** Completed
**Priority:** Medium
**Domain:** Frontend/runtime quality governance / Embedded browser runtime
**Requirement:** `p19-public-runtime-typecheck-expansion` FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008
**Reason:** `npm run typecheck` was still green without checking the browser login/session helper seam that now owns the supported cookie-auth runtime baseline.
**Current problem resolved:** The approved first browser-runtime slice is now inside the `typecheck` baseline, so regressions in `src/public/shared/session.js`, `src/public/shared/auth.js`, and `src/public/login.js` gain compile-time governance without broadening scope to the rest of `src/public/**`.
**Proposed change:** Add an explicit allowlist for `src/public/shared/session.js`, `src/public/shared/auth.js`, and `src/public/login.js`; make only the minimal JSDoc/browser-typing adjustments needed to keep that slice green; freeze the allowlist through governance tests and baseline docs without expanding to all of `src/public/**`.
**Affected files:** `tsconfig.typecheck.json`, `src/public/shared/session.js`, `src/public/shared/auth.js`, `src/public/login.js`, `scripts/validate-public-runtime.js`, `tests/typecheck-ci-hardening-governance.test.js`, `tests/public-surface-characterization.test.js`, `tests/browser-runtime-auth-convergence-inventory.test.js`, `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/ci-critical-controls.md`, `specs/p19-public-runtime-typecheck-expansion/*`
**Dependencies:** TASK-016
**Database impact:** None
**API impact:** None; public login and shared browser helper contracts remain unchanged
**Container impact:** None
**Security impact:** Medium positive impact through stronger compile-time assurance on the supported browser login/session seam without broadening runtime permissions or routes
**Acceptance criteria:** `npm run typecheck` covers only the approved first public-runtime allowlist; no accidental expansion to the rest of `src/public/**` occurs; validators/tests/docs freeze the new baseline and keep the remaining browser files explicitly out of scope.
**Required tests:** Passed `npm run typecheck`; passed `npm run lint:public-runtime`; passed `npm run validate:public-runtime`; passed `node --test tests/typecheck-ci-hardening-governance.test.js tests/public-surface-characterization.test.js tests/browser-runtime-auth-convergence-inventory.test.js`; passed `npm run build`
**Migration considerations:** Preserve the current browser runtime contracts, routes, and helper ownership from `p18` while adding only enough typing to make the first slice safe under `checkJs`.
**Rollback or mitigation:** Revert only the public-runtime allowlist and helper typing slice if the browser baseline regresses; keep the governance inventory to separate pre-existing debt from new regressions.
**Risk:** Medium

## TASK-017A: Align bounded root-shell governance and typecheck baseline
**Status:** Completed
**Completed at:** 2025-08-14
**Implemented files:** `tests/browser-auth-compatibility-inventory.test.js`, `tests/typecheck-ci-hardening-governance.test.js`, `tsconfig.typecheck.json`, `src/public/login.js`, `src/public/root/app.js`, `src/public/root/views/roles-admin.js`, `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/ci-critical-controls.md`, `specs/root-shell-follow-up-alignment/*`
**Validation evidence:** `node --test tests/browser-auth-compatibility-inventory.test.js tests/typecheck-ci-hardening-governance.test.js`; `npm run typecheck`; `npm run lint:public-runtime`; `npm run validate:public-runtime`; `node --test tests/public-surface-characterization.test.js tests/browser-runtime-auth-convergence-inventory.test.js tests/root-shell-route-governance.test.js`; `node --test tests/public-runtime-http-smoke.test.js`; `npm run build`; `git diff --check`
**Priority:** Medium
**Domain:** Frontend/runtime quality governance / Embedded browser runtime
**Requirement:** post-`p37` bounded governance alignment for the supported `/root/` shell
**Reason:** The repository supported `/root/` at runtime, but one governance test still modeled `src/public/root/**` as retired and the browser-runtime `typecheck` baseline still excluded the approved root-shell files.
**Current problem resolved:** Governance tests, `tsconfig.typecheck.json`, and architecture-facing docs now agree that the bounded `/root/` shell is supported runtime and part of the approved explicit browser-runtime `typecheck` allowlist, while `warehouse` and `agent` remain retired and legacy HTML still returns `410 Gone`.
**Implemented change:** Updated stale browser-runtime governance tests, added an explicit root-shell allowlist to `tsconfig.typecheck.json`, applied only the minimal `checkJs` compatibility fixes required in `src/public/login.js`, `src/public/root/app.js`, and `src/public/root/views/roles-admin.js`, aligned baseline docs, and explicitly deferred broader root-shell modularity refactor.
**Affected files:** `tests/browser-auth-compatibility-inventory.test.js`, `tests/typecheck-ci-hardening-governance.test.js`, `tsconfig.typecheck.json`, `src/public/login.js`, `src/public/root/app.js`, `src/public/root/views/roles-admin.js`, `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/ci-critical-controls.md`, `specs/root-shell-follow-up-alignment/*`
**Dependencies:** TASK-017
**Database impact:** None
**API impact:** None; `/root/`, `/api/auth/*`, company admin endpoints, and legacy `410 Gone` routes remain unchanged
**Container impact:** None
**Security impact:** Medium positive impact through stronger compile-time and governance coverage for the approved root-shell surface without broadening to all `src/public/**`
**Acceptance criteria:** Completed. `/root/` remains supported runtime, root-shell files are inside the approved bounded `typecheck` baseline, docs/tests/tsconfig are aligned, and broader shell modularity work remains explicitly deferred.
**Required tests:** Passed `node --test tests/browser-auth-compatibility-inventory.test.js tests/typecheck-ci-hardening-governance.test.js`; passed `npm run typecheck`; passed `npm run lint:public-runtime`; passed `npm run validate:public-runtime`; passed `node --test tests/public-surface-characterization.test.js tests/browser-runtime-auth-convergence-inventory.test.js tests/root-shell-route-governance.test.js`; passed `node --test tests/public-runtime-http-smoke.test.js`; passed `npm run build`; passed `git diff --check`
**Migration considerations:** Keep the allowlist explicit and preserve the current static shell composition unless a later approved spec widens scope.
**Rollback or mitigation:** Revert the allowlist and its minimal `checkJs` compatibility adjustments together with the aligned docs/tests if the bounded baseline needs to be withdrawn.
**Risk:** Medium

## TASK-018: Define the long-term disposition of `legacy-public-runtime/`
**Status:** Completed
**Completed at:** 2026-07-28
**Implemented files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`, `specs/p24-legacy-runtime-governance-closure/*`
**Validation evidence:** `npm run validate:public-runtime`; `node --test tests/public-surface-characterization.test.js`; `npm run typecheck`
**Priority:** Low
**Domain:** Frontend/runtime governance / Embedded browser runtime
**Requirement:** Post-implementation follow-up after `p21-legacy-public-html-deprecation-for-spa-transition`
**Reason:** `p21` moved the functional legacy browser inventory out of `src/public/`, and repository governance needed an explicit implemented policy so that preserved files are not mistaken for supported runtime.
**Current problem resolved:** `legacy-public-runtime/` remains outside the active runtime and is now documented consistently as transitional backup/reference inventory only, not an implicit rollback path.
**Implemented change:** The repository now states that the preserved legacy browser inventory remains in-repo only until equivalent SPA sections are implemented and validated, after which a later approved slice should remove it. This closed the lifecycle-policy ambiguity without reactivating legacy HTML as supported runtime.
**Affected files:** `legacy-public-runtime/**`, related validators/tests/docs/specs
**Dependencies:** `p21-legacy-public-html-deprecation-for-spa-transition`
**Database impact:** None
**API impact:** None expected
**Container impact:** None
**Security impact:** Low positive impact through clearer governance and lower risk of future confusion between preserved inventory and active runtime
**Acceptance criteria:** Completed. Repository docs now define `legacy-public-runtime/` as transitional backup/reference inventory only, explicitly outside supported runtime and outside implicit rollback behavior, with later removal deferred until equivalent SPA sections are implemented and validated.
**Required tests:** `npm run validate:public-runtime`; `node --test tests/public-surface-characterization.test.js`; `npm run typecheck`
**Migration considerations:** Keep `legacy-public-runtime/` outside `src/public/` and outside supported runtime governance unless a new approved spec changes the contract.
**Rollback or mitigation:** Revert only the documentation/governance wording if preservation rationale needs correction; do not reactivate the legacy runtime as a shortcut.
**Risk:** Low

## TASK-020: Harden login and no-access CSP without blocking on legacy public-runtime remediation
**Status:** Completed
**Priority:** Medium
**Domain:** Frontend/security hardening / Embedded browser runtime
**Requirement:** `p20-login-csp-hardening` FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008
**Reason:** The login screen and static no-access fallback were still inheriting a CSP broad enough for legacy browser pages with third-party and inline-style dependencies.
**Current problem resolved:** `src/app.js` now selects a stricter same-origin CSP for `/`, `/index.html`, `/no-access.html`, and the post-`p21` migration surface, while `src/public/no-access.html` no longer relies on inline script because its logout behavior moved to `/no-access.js`.
**Proposed change:** Segment CSP by route/surface, preserve non-CSP security headers, add focused header assertions, and document temporary legacy allowances rather than blocking closure on full legacy remediation.
**Affected files:** `src/app.js`, `src/public/no-access.html`, `src/public/no-access.js`, `tests/auth-hardening-characterization.test.js`, `tests/public-surface-characterization.test.js`, `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `specs/p20-login-csp-hardening/*`
**Dependencies:** TASK-017
**Database impact:** None
**API impact:** None; browser-session login/bootstrap/logout contracts remain unchanged
**Container impact:** None
**Security impact:** Medium positive impact through tighter CSP on the mandatory public login and static fallback surfaces while keeping legacy allowances explicit and temporary
**Acceptance criteria:** `/`, `/index.html`, and `/no-access.html` receive the stricter CSP baseline; the browser-first login/session flow remains functional; and later slices document any remaining compatibility allowances without reviving retired legacy HTML pages as supported runtime.
**Required tests:** Passed `node --test tests/auth-hardening-characterization.test.js tests/public-surface-characterization.test.js`; passed `node --test tests/browser-e2e.e2e.js`; passed `npm run typecheck`; passed `npm run lint:public-runtime`; passed `npm run validate:public-runtime`; passed `git diff --check`
**Migration considerations:** Preserve the strict CSP on the reduced supported documents and avoid re-expanding the supported runtime back into retired legacy HTML pages.
**Rollback or mitigation:** Revert only the CSP segmentation and `no-access.js` extraction if the public login or static fallback screen regresses; preserve the focused header tests and the documented legacy-allowance inventory.
**Risk:** Medium

## TASK-019: Preserve the reduced public-runtime typecheck allowlist and avoid re-expanding retired legacy pages
**Status:** Completed
**Completed at:** 2026-07-28
**Implemented files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`, `specs/p24-legacy-runtime-governance-closure/*`
**Validation evidence:** `npm run validate:public-runtime`; `node --test tests/public-surface-characterization.test.js`; `npm run typecheck`
**Priority:** Medium
**Domain:** Frontend/runtime quality governance / Embedded browser runtime
**Requirement:** Reduced supported surface after `p21-legacy-public-html-deprecation-for-spa-transition`
**Reason:** `p21` removed `src/public/root/**`, `src/public/warehouse/**`, and `src/public/agent/**` from the supported runtime, so the approved typecheck baseline must stay intentionally bounded to the shared login/session seam instead of re-expanding into retired HTML surfaces.
**Current problem resolved:** Follow-up governance work is now constrained by explicit repository policy so retired legacy pages are not implicitly revived inside the supported public runtime.
**Implemented change:** The repository now documents that `tsconfig.typecheck.json` remains bounded to the approved reduced public-runtime baseline (`src/public/shared/session.js`, `src/public/shared/auth.js`, `src/public/login.js`, and any future explicitly approved reduced-surface additions), and that retired legacy pages plus `legacy-public-runtime/` cannot re-enter supported runtime, validator scope, or typecheck scope without a new approved spec.
**Affected files:** `tsconfig.typecheck.json`, reduced supported `src/public/**` files, related validators/tests/docs/specs
**Dependencies:** TASK-017, `p21-legacy-public-html-deprecation-for-spa-transition`
**Database impact:** None
**API impact:** None expected; existing browser/API contracts must remain stable
**Container impact:** None
**Security impact:** Medium positive impact through tighter scope governance and prevention of accidental legacy-surface revival
**Acceptance criteria:** Completed. Repository docs now preserve the reduced supported browser contract, require explicit approved planning for any future additions, and do not allow retired legacy pages or `legacy-public-runtime/` to re-enter `typecheck`, validator scope, or supported runtime governance implicitly.
**Required tests:** `npm run validate:public-runtime`; `node --test tests/public-surface-characterization.test.js`; `npm run typecheck`
**Migration considerations:** Expand compile-time scope only over the reduced supported public runtime or its explicit successors, not over `legacy-public-runtime/`.
**Rollback or mitigation:** Revert only the newly added allowlist entries if a future bounded reduced-surface expansion proves unstable.
**Risk:** Medium

## TASK-021: Replace deprecated post-login HTML aliases with the supported transition landing
**Status:** Completed
**Priority:** Medium
**Domain:** Frontend/navigation governance / Embedded browser runtime
**Requirement:** `p22-public-runtime-contract-reduction-follow-through`
**Reason:** After `p21`, `login.js` still sent authenticated users to historical role-based HTML aliases that now landed on the controlled `410` migration response instead of a supported post-login destination.
**Current problem resolved:** Company-admin, warehouse, supervisor, root, and agent sessions no longer resolve to `/root/*.html`, `/warehouse/*.html`, or `/agent/*.html` from `src/public/login.js`. They now land on `/migration.html?mode=post-login-transition`, while direct requests to retired legacy HTML routes still return the same-URL `410 Gone` migration response.
**Proposed change:** Preserve `/migration.html?mode=post-login-transition` as the supported interim landing until a later approved slice defines real functional destinations.
**Affected files:** `src/public/login.js`, `src/public/migration.html`, `src/public/migration.js`, `scripts/validate-public-runtime.js`, `tests/public-surface-characterization.test.js`, `tests/public-runtime-http-smoke.test.js`, `tests/browser-runtime-auth-convergence-inventory.test.js`, `tests/browser-e2e.e2e.js`, `docs/runtime-contract-manifest.json`, `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `README.md`
**Dependencies:** TASK-022
**Database impact:** None
**API impact:** None for backend auth/session APIs; supported browser post-login navigation now targets `/migration.html?mode=post-login-transition` instead of deprecated legacy HTML aliases
**Container impact:** None
**Security impact:** Medium positive impact through removal of confusing deprecated-route landings and clearer supported-surface boundaries
**Acceptance criteria:** Authenticated retired-runtime roles no longer land on `/root/*.html`, `/warehouse/*.html`, or `/agent/*.html`; `/migration.html?mode=post-login-transition` is the supported interim landing; `migration.html` + `migration.js` distinguish post-login transition rendering from deprecated-route `410` rendering; direct legacy HTML requests still return the same-URL `410 Gone` migration response.
**Required tests:** Passed `npm run lint:public-runtime`; passed `npm run validate:public-runtime`; passed `node --test tests/public-surface-characterization.test.js tests/public-runtime-http-smoke.test.js tests/browser-runtime-auth-convergence-inventory.test.js`; passed `node --test tests/browser-e2e.e2e.js`; passed `npm run typecheck`
**Migration considerations:** Keep the supported transition landing explicit in validators, tests, manifest metadata, and docs until final functional destinations are approved.
**Rollback or mitigation:** Revert only the landing-target follow-through if the supported transition contract regresses; keep direct retired legacy HTML routes on the `410 Gone` contract.
**Risk:** Medium

## TASK-022: Record the reduced supported public-runtime baseline from `p21`
**Status:** Completed
**Priority:** High
**Domain:** Frontend/runtime governance / Embedded browser runtime
**Requirement:** `p21-legacy-public-html-deprecation-for-spa-transition` FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009
**Reason:** The embedded public runtime needed a real reduction of supported HTML surface before the SPA transition, not just documentation-only deprecation.
**Current problem resolved:** `src/public/` now contains only the reduced supported baseline; deprecated role-specific HTML routes respond from the same URL with the shared migration page and HTTP `410 Gone`; the former functional legacy runtime was relocated to `legacy-public-runtime/`; and validators/tests/docs were updated to govern the reduced contract.
**Proposed change:** Preserve the reduced active runtime baseline, the pre-static `410` gate, the out-of-runtime legacy relocation, and the bounded validator/typecheck contract.
**Affected files:** `src/app.js`, `src/public/index.html`, `src/public/migration.html`, `src/public/migration.js`, `src/public/no-access.html`, `src/public/no-access.js`, `src/public/login.js`, `src/public/shared/session.js`, `src/public/shared/auth.js`, `src/public/styles.css`, `legacy-public-runtime/**`, `scripts/validate-public-runtime.js`, `tests/public-surface-characterization.test.js`, `tests/public-runtime-http-smoke.test.js`, `tests/auth-hardening-characterization.test.js`, `tests/browser-runtime-auth-convergence-inventory.test.js`, `tests/browser-e2e.e2e.js`, `tests/post-audit-baseline-hardening.test.js`, `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `specs/p21-legacy-public-html-deprecation-for-spa-transition/*`
**Dependencies:** TASK-017, TASK-020
**Database impact:** None
**API impact:** None for backend auth/session APIs; legacy HTML contract changed to same-URL `410 Gone` migration response
**Container impact:** None
**Security impact:** High positive impact through reduction of the functional public HTML surface and elimination of active support for retired role-specific browser pages
**Acceptance criteria:** Supported HTML is limited to login, no-access, and migration documents; `/root/*.html`, `/warehouse/*.html`, and `/agent/*.html` return the shared migration response with `410 Gone` and no redirect; preserved legacy runtime lives outside `src/public/`; validators/tests/docs reflect the reduced contract.
**Required tests:** Passed `npm run lint:public-runtime`; passed `npm run validate:public-runtime`; passed `npm run lint`; passed `npm run typecheck`; passed `node --test tests/public-surface-characterization.test.js tests/public-runtime-http-smoke.test.js tests/auth-hardening-characterization.test.js tests/browser-runtime-auth-convergence-inventory.test.js`; passed `node --test tests/browser-e2e.e2e.js`; passed `node --test tests/post-audit-baseline-hardening.test.js`
**Migration considerations:** Preserve the reduced public-runtime contract and do not resume governing `root/**`, `warehouse/**`, or `agent/**` as supported browser runtime unless a later approved spec explicitly changes the support model.
**Rollback or mitigation:** If a future approved replacement shell is not yet ready, keep the `410` migration response rather than restoring the functional legacy runtime as implicit support.
**Risk:** Medium

## TASK-023: Define final functional post-login destinations beyond the interim transition page
**Status:** Completed
**Completed at:** 2026-07-28
**Implemented files:** `src/public/migration.js`, `scripts/validate-public-runtime.js`, `tests/public-surface-characterization.test.js`, `tests/public-runtime-http-smoke.test.js`, `tests/browser-e2e.e2e.js`, `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`, `specs/p25-post-login-transition-and-test-noise-closure/*`
**Validation evidence:** `node --test tests/browser-e2e.e2e.js`; `node --test tests/audit-instrumentation.test.js tests/audit-repository.test.js` (with `tests/audit-repository.test.js` skipped when env is absent); `npm run typecheck`; `npm run validate:public-runtime`; `npm run lint -- --quiet`
**Priority:** Medium
**Domain:** Frontend/navigation governance / Embedded browser runtime
**Requirement:** Post-implementation follow-up after `p22-public-runtime-contract-reduction-follow-through`
**Reason:** The repository now has a supported interim landing for retired-runtime-dependent roles, but it is informational and not a final operational destination.
**Current problem resolved:** The repository now makes the interim intent explicit: `/migration.html?mode=post-login-transition` is the supported temporary landing for retired-runtime-dependent roles, confirms successful authentication, clearly states that the destination module is not implemented yet, and preserves safe return-to-login/logout behavior without reviving legacy HTML runtime.
**Implemented change:** The current transition page remains the approved default placeholder while future role-specific SPA destinations are deferred to later approved slices. This closure is governance/runtime-contract work only; it does not claim the role-specific SPA destinations already exist.
**Affected files:** `src/public/login.js`, `src/public/migration.html`, `src/public/migration.js`, future replacement shell files, related validators/tests/docs/specs
**Dependencies:** TASK-021, TASK-022
**Database impact:** None expected unless a later approved replacement flow requires new persistence-backed projections
**API impact:** None expected unless new authenticated browser entrypoints require supporting endpoints documented by a future approved spec
**Container impact:** None expected
**Security impact:** Medium positive impact through removal of transitional UX and tighter supported-role navigation
**Acceptance criteria:** Completed. The repository now explicitly documents and validates that `/migration.html?mode=post-login-transition` is a supported temporary "not implemented yet" landing with safe exit behavior, while final role-specific SPA destinations remain future approved work and retired legacy HTML pages stay inactive.
**Required tests:** `npm run lint:public-runtime`; `npm run validate:public-runtime`; `node --test tests/public-surface-characterization.test.js tests/public-runtime-http-smoke.test.js tests/browser-runtime-auth-convergence-inventory.test.js`; `node --test tests/browser-e2e.e2e.js`; any additional approved landing-flow tests; `npm run typecheck`
**Migration considerations:** Keep the current supported transition page until final destinations are approved; do not introduce speculative routes.
**Rollback or mitigation:** Revert only the final-destination slice if replacement entrypoints regress, keeping the interim transition landing intact.
**Risk:** Medium

## TASK-024: Reduce expected database-unavailable audit-log noise in focused browser/runtime tests
**Status:** Completed
**Completed at:** 2026-07-28
**Implemented files:** `tests/helpers/db-free-audit.js`, `tests/browser-e2e.e2e.js`, `tests/audit-instrumentation.test.js`, `docs/test-suite-catalog.md`, `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`, `CHANGELOG.md`, `specs/p25-post-login-transition-and-test-noise-closure/*`, `specs/p26-browser-runtime-db-free-suite-separation/*`
**Validation evidence:** `npm run validate:public-runtime`; `node --test tests/public-surface-characterization.test.js tests/public-runtime-http-smoke.test.js`; `node --test tests/browser-e2e.e2e.js`; `npm run typecheck`
**Priority:** Low
**Domain:** Test governance / Observability
**Requirement:** Post-implementation follow-up after `p22-public-runtime-contract-reduction-follow-through`
**Reason:** Focused browser/runtime tests can pass while still emitting expected audit-log noise for database unavailability (`db:5432`), which can obscure real failures during triage.
**Current governance ambiguity resolved:** The repository now has an implemented remediation for the addressed suites: DB-free browser/runtime suites use explicit seam control where audit persistence is not under test, while explicit DB-backed audit coverage remains in dedicated suites.
**Implemented change:** Governance docs first defined that browser/runtime noise cleanup should prefer separating DB-free browser/runtime suites from explicit DB-backed audit/persistence suites rather than broadly suppressing logs, and the later `p26-browser-runtime-db-free-suite-separation` slice applied that strategy by adding a maintained suite catalog, stabilizing `tests/audit-instrumentation.test.js` as a DB-free suite, and isolating incidental browser E2E audit persistence from Prisma without weakening dedicated audit coverage.
**Affected files:** selected browser/runtime tests, test helpers, logging/audit seams if needed, related docs
**Dependencies:** TASK-021
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** Low positive impact by improving signal clarity for test evidence without reducing runtime protections
**Acceptance criteria:** Completed. The repository now both documents and implements the first-line remediation for the addressed suites, preserves real-failure visibility, and preserves explicit DB-backed audit/persistence coverage instead of authorizing broad log suppression.
**Required tests:** affected browser/runtime tests; any logging characterization tests touched by the approved cleanup
**Migration considerations:** Do not weaken runtime error handling or audit coverage just to silence tests.
**Rollback or mitigation:** Revert only the noise-reduction slice if it obscures real failures or alters runtime behavior.
**Risk:** Low

## TASK-025: Align repository-wide test baseline and runtime-contract coverage after `p23`
**Status:** Completed
**Priority:** High
**Domain:** Repository/platform governance / Embedded browser runtime
**Requirement:** `p23-repository-test-failure-contract-alignment` FR-003, FR-004, FR-005, FR-006, FR-009, FR-010; BR-001, BR-002, BR-003, BR-005, BR-006; AC-001, AC-002, AC-003, AC-004, AC-005
**Reason:** The aggregate repository suite was failing due to stale reduced-runtime expectations, unclassified logout governance, and missing default test-environment bootstrap.
**Current problem resolved:** `tests/browser-auth-compatibility-inventory.test.js` now targets the approved reduced public runtime instead of retired browser files, `POST /api/auth/logout` is explicitly covered in the runtime-contract artifacts, and `scripts/run-tests.js` now defaults the official aggregate suite to `NODE_ENV=test` plus `BROWSER_SESSION_STORE_MODE=memory` unless explicitly overridden.
**Proposed change:** Preserve the bounded `p23` alignment across tests, runtime-contract artifacts, and the official aggregate test runner without reactivating retired browser runtime or redesigning auth/session behavior.
**Affected files:** `tests/browser-auth-compatibility-inventory.test.js`, `internal-docs/openapi/runtime-baseline.openapi.json`, `internal-docs/runtime-endpoint-catalog.md`, `scripts/run-tests.js`, `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `specs/p23-repository-test-failure-contract-alignment/*`
**Dependencies:** TASK-021, TASK-022
**Database impact:** None
**API impact:** No runtime API behavior change; `POST /api/auth/logout` contract governance is now explicit
**Container impact:** None
**Security impact:** Medium positive impact through stronger contract/test alignment and stable auth-suite execution defaults
**Acceptance criteria:** `npm run test -- --silent` passes with the official test runner, reduced-runtime browser inventory tests match current support boundaries, and `POST /api/auth/logout` is no longer unclassified in runtime-contract governance.
**Required tests:** `npm run validate:public-runtime`; `npm run test -- --silent`; `npm run lint -- --quiet`; `npm run typecheck`; `npm run build`
**Migration considerations:** Preserve explicit override ability for non-default test environments and do not treat the memory default as a change to the supported non-test Redis baseline.
**Rollback or mitigation:** Revert only the bounded `p23` runner/governance alignment if a hidden suite dependency is discovered; preserve the updated failing-baseline evidence for diagnosis.
**Risk:** Medium

## TASK-026: Converge runtime-contract artifact governance between `docs/**` and `internal-docs/**`
**Status:** Completed
**Completed at:** 2026-07-28
**Implemented files:** `README.md`, `.gitignore`, `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`
**Validation evidence:** `node --test tests/runtime-contract-governance.test.js tests/openapi-contract-consistency.test.js tests/critical-contract-governance.test.js`; `npm run lint -- --quiet`
**Follow-up audit:** Baseline governance score `8.8/10` (acceptable, no meaningful regression found; warning remains below `9.5`)
**Priority:** Medium
**Domain:** Repository/platform governance / Documentation
**Requirement:** Audit warning after `p23`; runtime-contract governance integrity
**Reason:** The repository currently carries runtime-contract artifacts in public `docs/**` and companion `internal-docs/**` locations, which increases drift risk and weakens enforcement clarity.
**Current problem:** Architecture-facing docs describe public `docs/**` artifacts while repository governance tests consume `internal-docs/**`; maintaining both locations requires synchronized updates and can allow confidence gaps if one side lags.
**Proposed change:** Choose and implement one explicit governance strategy: a single authoritative artifact location, or a clearly documented mirrored/public-private model with automated synchronization rules and tests.
**Affected files:** `docs/openapi/runtime-baseline.openapi.json`, `docs/runtime-endpoint-catalog.md`, `docs/runtime-contract-manifest.json`, `internal-docs/openapi/runtime-baseline.openapi.json`, `internal-docs/runtime-endpoint-catalog.md`, `internal-docs/runtime-contract-manifest.json`, related governance tests, architecture docs, README
**Dependencies:** TASK-025
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** Low direct impact; medium governance integrity impact
**Acceptance criteria:** The repository documents one authoritative runtime-contract artifact strategy, tests enforce it, and future route changes have one unambiguous update path.
**Required tests:** `tests/runtime-contract-governance.test.js`; `tests/openapi-contract-consistency.test.js`; any added synchronization/governance tests; `npm run test -- --silent`
**Migration considerations:** Preserve current runtime behavior and route classification completeness while changing only governance/documentation ownership.
**Rollback or mitigation:** Revert only the artifact-location convergence slice if it introduces public/private documentation regressions.
**Risk:** Medium

## TASK-027: Add explicit Redis-path validation alongside the stable memory-mode aggregate suite
**Status:** Completed
**Completed at:** 2026-07-28
**Implemented files:** `package.json`, `.github/workflows/redis-browser-session-tests.yml`, `scripts/validate-workflow-baseline.js`, `tests/workflow-baseline-characterization.test.js`, `docs/ci-critical-controls.md`, `docs/production-baseline.md`
**Validation evidence:** `npm run test:redis-path`; `npm run validate:workflow-baseline`; `node --test tests/workflow-baseline-characterization.test.js`; `npm run test -- --silent`
**Follow-up audit:** Baseline governance score `8.8/10` (acceptable, no meaningful regression found; warning remains below `9.5`)
**Priority:** Medium
**Domain:** Frontend/session security governance / Test governance
**Requirement:** Post-`p23` repository-wide test baseline follow-up
**Reason:** The aggregate suite now boots reliably by default in memory mode, but the supported non-test browser-session path still depends on Redis.
**Current problem:** Plain `npm run test` no longer exercises Redis-backed browser-session persistence unless developers or CI explicitly override the default environment.
**Proposed change:** Add or document a dedicated Redis-path validation command or CI lane that exercises browser-session behavior with `BROWSER_SESSION_STORE_MODE=redis` and the required infrastructure, without destabilizing the default aggregate suite.
**Affected files:** `package.json`, `scripts/run-tests.js`, browser-session tests, CI workflows if approved, production/readiness docs
**Dependencies:** TASK-025
**Database impact:** None
**API impact:** None
**Container impact:** Possible CI or compose usage additions for Redis-backed validation
**Security impact:** Medium positive impact through better coverage of the supported non-test session path
**Acceptance criteria:** The repository keeps the stable default aggregate suite and also has an explicit, repeatable Redis-path validation path for browser-session behavior.
**Required tests:** existing browser-session boundary/store tests under Redis mode; repository or CI validation command added by the approved slice
**Migration considerations:** Keep Redis validation explicit and additive rather than folding it back into the default aggregate suite.
**Rollback or mitigation:** Revert only the dedicated Redis-path validation slice if it proves too unstable, while preserving the stable default suite.
**Risk:** Medium

## TASK-028: Introduce the initial supported root SPA shell
**Status:** Completed
**Completed at:** 2025-08-14
**Priority:** High
**Domain:** Embedded browser runtime / Identity and access
**Requirement:** `p27-root-initial-spa-shell` FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-012; AC-001, AC-002, AC-003, AC-004, AC-005, AC-006, AC-007
**Reason:** The reduced browser runtime still lacked a supported authenticated destination for wave-one root users after login.
**Current problem resolved:** The repository now exposes a supported root shell at `/root/`, routes wave-one eligible root users there after login, reuses the existing cookie-session plus `/api/auth/me` bootstrap, keeps legacy `/root/*.html` pages retired on the `410 Gone` contract, and preserves the transition landing only for non-wave-one profiles.
**Proposed change:** Preserve the initial root shell as the supported wave-one root browser surface and continue expanding it only through later approved incremental slices.
**Affected files:** `src/public/root/index.html`, `src/public/root/app.js`, `src/public/root/router.js`, `src/public/root/guards.js`, `src/public/root/manifest.js`, `src/public/root/session-adapter.js`, `src/public/root/views/home.js`, `src/public/root/views/in-process.js`, `src/public/login.js`, `src/public/styles.css`, `src/app.js`, `scripts/validate-public-runtime.js`, `tests/public-runtime-http-smoke.test.js`, `tests/public-surface-characterization.test.js`, `tests/browser-runtime-auth-convergence-inventory.test.js`, `tests/browser-e2e.e2e.js`, `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`
**Dependencies:** TASK-021, TASK-022, TASK-023, TASK-024, TASK-025, TASK-026, TASK-027
**Database impact:** None
**API impact:** No new backend API endpoints; browser post-login routing now sends `root` and `admin` with `companyId` to `/root/`
**Container impact:** None
**Security impact:** Medium positive impact through a supported authenticated destination that still relies on backend-owned browser-session contracts rather than reviving legacy runtime pages
**Acceptance criteria:** `/root/` is a supported browser entrypoint; eligible `root` and `admin` sessions land there after login; the shell bootstraps through `/api/auth/me`; invalid or ineligible sessions exit to login or no-access; legacy `/root/*.html` URLs remain `410 Gone`; validators/tests/docs reflect the implemented state.
**Required tests:** `npm run validate:public-runtime`; `npm run lint:public-runtime`; `npm run typecheck`; `npm run lint -- --quiet`; `npm run build`; `node --test tests/browser-e2e.e2e.js`; `node --test tests/public-runtime-http-smoke.test.js tests/public-surface-characterization.test.js tests/browser-runtime-auth-convergence-inventory.test.js`
**Migration considerations:** Preserve the reduced supported runtime contract, keep non-wave-one roles on the transition landing until later approved destinations exist, and do not reactivate legacy HTML pages as a shortcut.
**Rollback or mitigation:** Revert only the bounded root-shell slice if the supported authenticated browser flow regresses; keep legacy HTML routes retired.
**Risk:** Medium
