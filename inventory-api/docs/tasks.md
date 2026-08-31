## TASK-201: Implement recipe stage typing and processing-stage contract for production formulas
**Status:** Completed
**Priority:** High
**Domain:** Recipes / Production
**Requirement:** FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-018
**Reason:** The production domain needed explicit stage semantics and process definition instead of implicit stage meaning.
**Current problem:** The legacy recipe model did not distinguish recollection vs processing stages and did not require explicit process definition for processing stages.
**Proposed change:** Add `stageType`, `processCode`, and `processLabel` support in schema, service, persistence, and read models with additive backward compatibility.
**Affected files:** `src/schemas/recipe.schema.js`, `src/services/recipe.service.js`, `prisma/schema.prisma`, `prisma/migrations/20260923000000_recipe_stage_typing_and_process_code/`, root-shell recipe editor files, recipe tests
**Dependencies:** None
**Database impact:** Added recipe-stage columns through additive migration
**API impact:** Recipe version payloads and read models now include stage typing and process definition fields
**Container impact:** None
**Security impact:** Low positive impact through clearer server-side validation
**Acceptance criteria:** Implemented additively with schema validation, service serialization, and compatibility defaults for legacy stages
**Required tests:** `tests/recipe-schema.test.js`, `tests/qa-rejection-material-reconciliation-migration.test.js`
**Migration considerations:** Legacy stages default to `PROCESSING`; existing snapshots remain readable
**Rollback or mitigation:** Use new additive migrations only; do not rewrite applied history
**Risk:** Medium

## TASK-202: Implement Option A relevant-input scope resolver for QA rejection
**Status:** Completed
**Priority:** High
**Domain:** Quality / Production
**Requirement:** FR-001, BR-001, AC-001, AC-011
**Reason:** QA rejection needed broader material scope than direct consumptions on the failed stage.
**Current problem:** Rejection analysis could omit relevant prior-stage inputs when the failed stage had no direct consumptions.
**Proposed change:** Add a dedicated resolver that includes all non-invalidated prior executed-stage consumptions up to and including the failed stage.
**Affected files:** `src/services/quality-relevant-input-scope.service.js`, `src/services/quality.service.js`, `src/routes/production.routes.js`, warehouse rejection renderers/tests
**Dependencies:** TASK-201
**Database impact:** None
**API impact:** QA inspection responses may now include `relevantInputScope`
**Container impact:** None
**Security impact:** Low
**Acceptance criteria:** Implemented and returned through the QA rejection flow without breaking the backward-compatible simple inspection response path
**Required tests:** `tests/quality-relevant-input-scope.service.test.js`
**Migration considerations:** Dynamic computation is additive; no schema rewrite required
**Rollback or mitigation:** The enriched envelope is conditional and backward-compatible
**Risk:** Medium

## TASK-203: Add persistence for recovery type, lot-level recolection entries, and reconciliation rows
**Status:** Completed
**Priority:** High
**Domain:** Production / Persistence
**Requirement:** FR-010, FR-011, FR-012, FR-014, FR-016, FR-018
**Reason:** The amended workflow required auditable recovery context, recovered lots, and terminal outcomes.
**Current problem:** The previous schema only supported the legacy recolection stage shape and could not persist lot-level recovery or reconciliation detail.
**Proposed change:** Add `recoveryType` on recolection stages and create `ProductionRecolectionEntry` and `ProductionRecolectionReconciliation` models/tables.
**Affected files:** `prisma/schema.prisma`, `prisma/migrations/20260923001000_recolection_entry_and_reconciliation/migration.sql`, `src/repositories/production.repository.js`, migration/schema tests
**Dependencies:** TASK-201
**Database impact:** New additive column and tables with indexes
**API impact:** Production order read models can now expose entries and reconciliations
**Container impact:** None
**Security impact:** Medium positive impact through stronger auditability
**Acceptance criteria:** Implemented with additive migration and repository support
**Required tests:** `tests/qa-rejection-material-reconciliation-migration.test.js`
**Migration considerations:** Existing rows default to `VIRTUAL_RECOLECTION`
**Rollback or mitigation:** Future changes must use new migrations, not edits to this migration
**Risk:** Medium

## TASK-204: Support posterior replacement recovery stage creation in QA rejection flow
**Status:** Completed
**Priority:** High
**Domain:** Quality / Production
**Requirement:** FR-014, BR-008, AC-006, FR-015
**Reason:** QA rejection sometimes requires explicit replacement of damaged or missing inputs before re-execution.
**Current problem:** The legacy virtual recolection path was not explicit enough to model replacement recovery.
**Proposed change:** Extend rejection handling to create a posterior `REPLACEMENT_RECOVERY` stage and preserve `VIRTUAL_RECOLECTION` compatibility.
**Affected files:** `src/services/quality.service.js`, `src/services/production-recolection.service.js`, `src/schemas/quality.schema.js`, production validation tests
**Dependencies:** TASK-202, TASK-203
**Database impact:** Uses `recoveryType` added in TASK-203
**API impact:** QA rejection payload supports `requiresReplacementStage` and `replacementItems`
**Container impact:** None
**Security impact:** Low
**Acceptance criteria:** Implemented additively and exposed through existing production/QA routes
**Required tests:** `tests/production-replacement-recovery-gate.test.js`
**Migration considerations:** Keep legacy confirmation route behavior intact
**Rollback or mitigation:** Compatibility mode remains available via `VIRTUAL_RECOLECTION`
**Risk:** Medium

## TASK-205: Enforce same-lot recolection-before-use validation in production execution
**Status:** Completed
**Priority:** Critical
**Domain:** Production / Inventory
**Requirement:** FR-010, FR-011, FR-013, BR-004, BR-006, AC-002, AC-003
**Reason:** Usage had to be lot-bound and constrained by previously recovered material.
**Current problem:** Consumption was not guarded against using unrecovered lots or exceeding recovered balance in the amended workflow.
**Proposed change:** Activate server-side validation that checks proposed consumptions against completed recolection entries for the same product + lot pairs.
**Affected files:** `src/services/production-stage-validation.service.js`, `src/services/production-execution.service.js`, production execution tests
**Dependencies:** TASK-203, TASK-204
**Database impact:** Reads recolection entries added in TASK-203
**API impact:** Stage execution can now reject invalid lot linkage or overuse in recovery contexts
**Container impact:** None
**Security impact:** Medium positive impact through server-side integrity enforcement
**Acceptance criteria:** Implemented with backward-compatible skip behavior when no recolection entries exist
**Required tests:** `tests/production-same-lot-validation.service.test.js`, `tests/production-execution.service.test.js`, `tests/production-replacement-recovery-gate.test.js`
**Migration considerations:** Older legacy flows without entries remain compatible
**Rollback or mitigation:** Validation remains narrow to recovery contexts with actual entry data
**Risk:** High

## TASK-206: Implement reconciliation endpoint and terminal outcome validation
**Status:** Completed
**Priority:** High
**Domain:** Production / Quality
**Requirement:** FR-012, FR-015, FR-016, BR-007, AC-004, AC-005, AC-013
**Reason:** Recovered material needed a formal end-state instead of silent leftover balances.
**Current problem:** There was no API to record whether unused recovered material was used, returned, or discarded.
**Proposed change:** Add reconciliation payload schema, route, service validation, persistence calls, and remaining-balance computation.
**Affected files:** `src/routes/production.routes.js`, `src/schemas/production.schema.js`, `src/services/production-recolection.service.js`, `src/repositories/production.repository.js`, runtime docs/tests
**Dependencies:** TASK-203
**Database impact:** Writes to `production_recolection_reconciliations`
**API impact:** Added `POST /api/production/orders/:id/recolections/:recolectionId/reconciliation`
**Container impact:** None
**Security impact:** Medium positive impact through explicit state and quantity validation
**Acceptance criteria:** Implemented with allowed outcomes `USED`, `RETURNED`, `DISCARDED` and balance reporting
**Required tests:** `tests/production-reconciliation-outcomes.service.test.js`, `tests/production-routes-contract.test.js`, governance/runtime contract tests
**Migration considerations:** Additive endpoint; no breaking route rename introduced
**Rollback or mitigation:** Existing confirm route remains intact as compatibility path
**Risk:** Medium

## TASK-207: Update warehouse SPA to display replacement recovery, relevant-input scope, and reconciliation state
**Status:** Completed
**Priority:** High
**Domain:** Warehouse UI
**Requirement:** FR-016, FR-017, FR-019, AC-004, AC-011
**Reason:** Operators needed to see the amended recovery semantics clearly in the browser workflow.
**Current problem:** The warehouse SPA did not expose replacement-recovery status, broader relevant-input scope, or reconciliation controls.
**Proposed change:** Update warehouse API wrappers, state derivation, renderers, rejection helpers, and controller wiring for the new flow.
**Affected files:** `src/public/warehouse/api/warehouse-api.js`, `src/public/warehouse/views/production.state.js`, `src/public/warehouse/views/production.renderers.js`, `src/public/warehouse/views/production.renderers.rejection.js`, `src/public/warehouse/views/production.controllers.js`, `src/public/styles.css`
**Dependencies:** TASK-202, TASK-204, TASK-206
**Database impact:** None directly; consumes enriched production order read model
**API impact:** Uses the new reconciliation endpoint and enriched order serialization
**Container impact:** None
**Security impact:** Low
**Acceptance criteria:** Implemented in current UI code, with replacement-recovery status differentiation and reconciliation wiring
**Required tests:** warehouse SPA characterization tests, governance tests, targeted feature tests recorded in spec docs
**Migration considerations:** UI still depends on legacy route names and backend DTOs
**Rollback or mitigation:** Backend compatibility routes remain unchanged
**Risk:** Medium

## TASK-208: Expose amended production read model and update runtime documentation/governance registration
**Status:** Completed
**Priority:** Medium
**Domain:** Production / Governance / Documentation
**Requirement:** FR-015, FR-016, FR-020
**Reason:** The amended endpoint and read model needed to be visible to runtime governance and documentation.
**Current problem:** The new reconciliation route and enriched order payload required synchronization with runtime documentation/governance artifacts.
**Proposed change:** Serialize `recolectionStages` with entries/reconciliations and register the new route in runtime docs/governance files.
**Affected files:** `src/services/production.service.js`, `src/repositories/production.repository.js`, `docs/runtime-contract-manifest.json`, `docs/runtime-endpoint-catalog.md`, feature implementation report
**Dependencies:** TASK-203, TASK-206
**Database impact:** None
**API impact:** `GET /api/production/orders/:id` and list responses now expose richer recolection data
**Container impact:** None
**Security impact:** Low
**Acceptance criteria:** Implemented and reflected in repository documentation artifacts
**Required tests:** runtime contract/governance tests, production contract tests
**Migration considerations:** Additive response fields only
**Rollback or mitigation:** Keep enriched fields additive to preserve consumers
**Risk:** Low

## TASK-209: Align root-shell recipe editor process-code catalog with backend validation
**Status:** Proposed
**Priority:** High
**Domain:** Recipes / Root UI
**Requirement:** FR-007, FR-008, FR-009, FR-017
**Reason:** Current documentation refresh identified drift between backend-approved process codes and the root-shell editor option list.
**Current problem:** `src/public/root/views/recipes-admin.version-editor.js` includes UI options such as `FILLING`, `LABELING`, `PACKAGING`, and `QUALITY_CHECK`, while backend validation in `src/schemas/recipe.schema.js` expects the approved catalog including `PACKING_PREP` and `LABELING_PREP`.
**Proposed change:** Converge UI options to the backend-supported catalog and add characterization coverage for catalog parity.
**Affected files:** `src/public/root/views/recipes-admin.version-editor.js`, `src/schemas/recipe.schema.js`, root-shell recipe tests, docs
**Dependencies:** TASK-201
**Database impact:** None
**API impact:** Prevents avoidable client-side submission of invalid process codes
**Container impact:** None
**Security impact:** Low
**Acceptance criteria:**
- UI only offers backend-supported process codes.
- `OTHER` still requires free-text description in the UI.
- Catalog parity is covered by automated tests.
**Required tests:** root-shell recipe editor characterization tests; recipe schema parity tests
**Migration considerations:** Keep additive; do not change persisted codes already valid in DB
**Rollback or mitigation:** If parity cannot be completed immediately, block unsupported UI options instead of broadening backend catalog silently
**Risk:** Medium

## TASK-210: Add stronger end-to-end coverage for QA rejection to reconciliation workflow
**Status:** Proposed
**Priority:** High
**Domain:** Production / Quality / Warehouse UI
**Requirement:** FR-015, FR-016, FR-019, AC-002, AC-003, AC-004, AC-005, AC-006, AC-011, AC-013
**Reason:** Automated service-level tests exist, but repository evidence for the full operator flow remains lighter than the implementation surface.
**Current problem:** Manual validation in the checked-in implementation report is still pending, and current tests do not fully demonstrate the complete warehouse/browser path across rejection, replacement recovery, same-lot execution, and reconciliation.
**Proposed change:** Add integrated flow tests and/or documented executed manual evidence for the full amended workflow.
**Affected files:** new tests under `tests/`, relevant SPA characterization harnesses, runbook/docs files
**Dependencies:** TASK-202, TASK-204, TASK-205, TASK-206, TASK-207
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** Medium positive impact by reducing unnoticed workflow regressions
**Acceptance criteria:**
- End-to-end or integrated evidence covers rejected stage with no direct consumptions.
- Evidence covers replacement recovery creation and confirmation.
- Evidence covers same-lot rejection and successful reconciliation.
**Required tests:** integrated route/service/browser characterization tests
**Migration considerations:** Prefer additive tests and evidence only
**Rollback or mitigation:** If browser E2E is too costly first, add narrower integration tests plus executed manual evidence
**Risk:** Medium

## TASK-211: Decide whether relevant-input scope should be persisted as an immutable audit snapshot
**Status:** Proposed
**Priority:** Medium
**Domain:** Quality / Auditability
**Requirement:** NFR-002, FR-020
**Reason:** Current scope is computed dynamically, which is simple but may be weaker for long-term audit replay requirements.
**Current problem:** `relevantInputScope` is resolved from current stored executions at rejection time or read time rather than stored as an immutable rejection artifact.
**Proposed change:** Evaluate whether audit/regulatory needs require persistence of the scope snapshot and, if approved, design an additive persistence model.
**Affected files:** `src/services/quality.service.js`, `prisma/schema.prisma` (future), migrations (future), audit docs
**Dependencies:** TASK-202
**Database impact:** Possible future additive table or JSON snapshot field
**API impact:** Could add explicit snapshot exposure later
**Container impact:** None
**Security impact:** Low direct impact, medium auditability benefit
**Acceptance criteria:**
- Decision documented with trade-offs.
- If approved, an additive design exists before implementation.
**Required tests:** future schema and replay tests if implemented
**Migration considerations:** Do not retrofit by rewriting historical inspections
**Rollback or mitigation:** Keep dynamic computation until a snapshot model is explicitly approved
**Risk:** Low

## TASK-212: Publish stronger operator-facing validation evidence and documentation wording for the amended workflow
**Status:** Proposed
**Priority:** Medium
**Domain:** Documentation / Operations
**Requirement:** FR-019, FR-020
**Reason:** Current repository evidence is strong at service level but still lighter on operational wording and manual validation depth.
**Current problem:** The latest re-audit feedback still highlights completeness wording and documentation/testing depth concerns.
**Proposed change:** Update runbooks or feature docs with conservative completeness wording, executed validation notes, and known limitations.
**Affected files:** `specs/qa-rejection-material-reconciliation-amendment/implementation-report.md`, production runbook docs, architecture-facing docs
**Dependencies:** TASK-210
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** Low
**Acceptance criteria:**
- Documentation distinguishes automated evidence from manual evidence.
- Known limitations and pending validation are explicit.
- Operational users have a current runbook/reference for the amended workflow.
**Required tests:** documentation governance tests if impacted
**Migration considerations:** Documentation-only
**Rollback or mitigation:** None needed
**Risk:** Low
