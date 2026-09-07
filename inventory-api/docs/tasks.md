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
**Status:** Completed
**Priority:** High
**Domain:** Recipes / Root UI
**Requirement:** FR-007, FR-008, FR-009, FR-017
**Reason:** The recipe editor had to stop offering process-code values that backend validation would reject.
**Current problem:** The previous UI catalog could drift from `RECIPE_STAGE_PROCESS_CODES` in `src/schemas/recipe.schema.js` and create avoidable submission failures.
**Proposed change:** Converge UI options to the backend-supported catalog and keep characterization coverage for catalog parity.
**Affected files:** `src/public/root/views/recipes-admin.version-editor.js`, `src/schemas/recipe.schema.js`, root-shell recipe tests, docs
**Dependencies:** TASK-201
**Database impact:** None
**API impact:** Prevents avoidable client-side submission of invalid process codes
**Container impact:** None
**Security impact:** Low
**Acceptance criteria:** Implemented; `PROCESS_CODE_OPTIONS` now matches the backend-supported catalog and `OTHER` still requires free-text description.
**Required tests:** root-shell recipe editor characterization tests; recipe schema parity tests
**Migration considerations:** Additive UI alignment only; no persisted-code rewrite required
**Rollback or mitigation:** Keep the backend catalog authoritative if future UI options are revisited
**Risk:** Low

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

## TASK-213: Implement recipe approval UX confirmation, local feedback, incomplete draft marker, and repair highlighting
**Status:** Completed
**Priority:** High
**Domain:** Recipes / Root UI
**Requirement:** `recipe-approval-ux` FR-001 to FR-011
**Reason:** Draft recipe approval was too easy to trigger accidentally, feedback was distant from the action context, and incomplete stage-input rows could be lost without clear user awareness.
**Current problem:** Approval had no explicit confirmation modal, approval errors were not localized to the triggering version card, incomplete `PROCESSING` rows could disappear during save, and repair navigation lacked direct editor guidance.
**Proposed change:** Add a custom irreversible-action confirmation dialog, action-local version-card feedback, frontend-managed incomplete draft markers, stage-type-aware incomplete-row handling, and conservative repair highlighting in the existing recipe admin modules.
**Affected files:** `src/public/root/views/recipes-admin.js`, `src/public/root/views/recipes-admin.renderers.js`, `src/public/root/views/recipes-admin.version-editor.js`, `tests/root-shell-recipes-admin-view-characterization.test.js`
**Dependencies:** Existing recipe route/service/schema contracts; TASK-209 alignment for process-code parity
**Database impact:** None
**API impact:** Reuses the existing `POST /api/recipes/versions/:id/approve` contract without payload changes
**Container impact:** None
**Security impact:** Low positive impact through an explicit irreversible-action UX safeguard while preserving backend permission and validation authority
**Acceptance criteria:** Implemented with `#recipes-approval-dialog`, local version-card feedback, `Reparar borrador` CTA, `Incompleta` draft state, blocking save for incomplete `RECOLLECTION`, warning-only save for incomplete `PROCESSING`, and conservative exact-match repair highlighting.
**Required tests:** `tests/root-shell-recipes-admin-view-characterization.test.js`, `tests/recipe-service-foundation.test.js`, `tests/recipe-schema.test.js`, `npm run lint`, `npm run typecheck`
**Migration considerations:** Frontend-only behavior; no migrations or route-contract changes
**Rollback or mitigation:** The implementation is additive over the existing recipe admin modules and can be reverted without database rollback if necessary
**Risk:** Medium

## TASK-214: Record manual browser evidence for recipe approval UX behavior across supported dialogs
**Status:** Proposed
**Priority:** Medium
**Domain:** Recipes / Documentation / QA
**Requirement:** `recipe-approval-ux` NFR-005, AC-001, AC-003, AC-009, AC-010, AC-011
**Reason:** Automated characterization covers source and markup seams, but the repository still lacks executed browser evidence for dialog focus, cancellation, scroll-to-feedback, and repair navigation behavior.
**Current problem:** Current implementation reports targeted tests, lint, and typecheck as passing, yet manual browser validation for the new approval dialog and repair affordances is not recorded in repository docs.
**Proposed change:** Execute and document browser-level validation steps for confirm/cancel, local feedback focus, `Reparar borrador`, and conservative highlight behavior in supported browsers.
**Affected files:** `docs/action-plan.md`, feature implementation report(s), optional runbook or QA evidence docs, and possibly future browser/E2E tests under `tests/`
**Dependencies:** TASK-213
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** Low
**Acceptance criteria:**
- Manual evidence confirms cancel does not call approval.
- Approval failure visibly focuses or scrolls to the local version-card feedback.
- `Reparar borrador` reopens the same draft and only highlights when mapping is safe.
- Evidence is checked into repository docs with conservative wording.
**Required tests:** manual browser checks; optional future E2E characterization
**Migration considerations:** Documentation/test evidence only
**Rollback or mitigation:** None needed
**Risk:** Low

## TASK-301: Introduce store currency semantics and credit display alignment
**Status:** Completed
**Priority:** High
**Domain:** Customers / Stores / Root-shell clients administration
**Requirement:** `client-store-documents-credit-ux` FR-010, FR-011, BR-007
**Reason:** Create-time store `creditLimit` was implemented first, but store onboarding still needed store currency and clearer card-level credit semantics.
**Current problem:** The pre-TASK-006 repository lacked a `ClientStore.currency` field and store cards communicated credit usage ambiguously.
**Proposed change:** Add additive store `currency` persistence and validation, and update store-card credit rendering to show used/available values with a store-specific currency symbol while remaining safe for legacy `NULL` currency rows.
**Affected files:** `src/public/root/views/clients-admin-store-dialog.js`, `src/public/root/views/clients-admin.helpers.js`, `src/public/root/views/clients-admin.renderers.js`, `src/schemas/client.schema.js`, `src/services/client.service.js`, `prisma/schema.prisma`, `prisma/migrations/20261002000000_add_store_currency/migration.sql`, related tests/docs
**Dependencies:** Existing TASK-001 through TASK-005 characterization baseline
**Database impact:** Added additive nullable `ClientStore.currency` column through `20261002000000_add_store_currency`; no rewrite of prior migrations
**API impact:** Existing store-create contract now accepts `currency`; existing credit-limit patch route remains compatible
**Container impact:** None
**Security impact:** Low
**Acceptance criteria:** Implemented — `currency` is limited to `CRC | USD | EUR`; store cards render `Usado` / `Disponible` values in the configured currency; legacy `NULL` currency rows render `Moneda: Sin definir` and symbol-free amounts instead of defaulting to `CRC`; existing create-time `creditLimit` behavior remains compatible.
**Required tests:** `tests/client-store-credit-limit.test.js`, `tests/clients-store-map-characterization.test.js`, `tests/clients-view-characterization.test.js`; user-reported `npx prisma validate`, `npx prisma migrate deploy`, `npx prisma migrate status`, `npm run lint`, `npm run typecheck`, and `npm run build`
**Migration considerations:** Additive nullable rollout preserved backward compatibility for existing stores; any future backfill must use a new migration or data-fix strategy rather than editing applied history
**Rollback or mitigation:** Keep the existing credit-limit patch route operational as a fallback path during rollout; renderer compatibility protects legacy rows with `NULL` currency
**Risk:** Medium

## TASK-302: Complete remaining client fiscal catalog wiring and creation-form alignment
**Status:** Proposed
**Priority:** High
**Domain:** Customers / Root-shell clients administration
**Requirement:** `client-store-documents-credit-ux` FR-012, FR-028, FR-029, FR-030, FR-031, FR-032, BR-013, BR-014, BR-015
**Reason:** TASK-008 exposed the missing editable legal/geographic fields and removed dead client credit shaping, but the approved Hacienda-aligned client fiscal contract is still incomplete.
**Current problem:** The client edit form now exposes `legalName`, `commercialName`, `province`, `canton`, and `district`, and `buildClientPayload()` no longer sends dead client credit fields, but client create/edit still use free-text `documentType`, the create dialog still lacks the full approved fiscal/geographic field set, and economic activities are not yet loaded/catalog-backed in the clients workspace.
**Proposed change:** Finish the remaining client-side fiscal form alignment by constraining `documentType`, loading economic activities at mount time, wiring economic-activity selection/auto-fill, and bringing the create dialog into parity with the approved client fiscal/geographic contract without regressing current client update flows.
**Affected files:** `src/public/root/views/clients-admin.js`, `src/public/root/views/clients-admin.renderers.js`, `src/public/root/views/clients-admin.helpers.js`, `src/schemas/client.schema.js`, `src/services/client.service.js`, related tests/docs
**Dependencies:** TASK-307, TASK-306
**Database impact:** None required for this remaining slice
**API impact:** Existing client create/update payloads keep the same route shape while tightening browser-side fiscal field choices
**Container impact:** None
**Security impact:** Medium positive impact through clearer server-side validation and less free-text fiscal input
**Acceptance criteria:** Client create/edit forms expose the remaining approved fiscal/catalog fields; `documentType` is constrained to the approved identification types; economic activities are loaded and selectable from the approved catalog; current client create/update contracts remain compatible.
**Required tests:** schema validation tests, client-view characterization, payload-shaping regression tests, economic-activity loading assertions
**Migration considerations:** Preserve current client legal-entity linkage semantics and avoid widening the route surface
**Rollback or mitigation:** Keep existing client route contracts stable and stage UI changes behind characterization coverage
**Risk:** High

## TASK-306: Implement store fiscal inheritance/override foundation
**Status:** Completed
**Priority:** High
**Domain:** Customers / Stores / Root-shell clients administration
**Requirement:** `client-store-documents-credit-ux` FR-013, FR-014, FR-015, partial FR-016, BR-008, BR-009, BR-010, AC-010, AC-011
**Reason:** Store onboarding needed an explicit way to inherit client fiscal data or capture store-specific billing data without replacing the existing create-store contract.
**Current problem:** Before TASK-007, store creation had no explicit inherit-vs-override mode and no additive persistence for store-specific fiscal values.
**Proposed change:** Add seven nullable store fiscal override columns, extend the create-store schema/service path, expose inherit-vs-override controls with an inherited summary in the store dialog, and render compact store-card fiscal summaries.
**Affected files:** `prisma/schema.prisma`, `prisma/migrations/20261002001000_add_store_billing_fields/migration.sql`, `src/schemas/client.schema.js`, `src/services/client.service.js`, `src/public/root/views/clients-admin.js`, `src/public/root/views/clients-admin.helpers.js`, `src/public/root/views/clients-admin-store-dialog.js`, `src/public/root/views/clients-admin.renderers.js`, `tests/client-store-fiscal-overrides.test.js`, `tests/clients-store-map-characterization.test.js`, `tests/clients-view-characterization.test.js`
**Dependencies:** TASK-301
**Database impact:** Added seven nullable `ClientStore` override columns through additive migration `20261002001000_add_store_billing_fields`
**API impact:** Existing `POST /api/clients/company/:clientId/stores` contract now accepts additive nullable override fields; no new route introduced
**Container impact:** None
**Security impact:** Low positive impact through clearer validation of store billing payload shape
**Acceptance criteria:** Implemented — inherited mode shows a read-only client fiscal summary, override mode persists the current 7 store fiscal fields, omit/null continues to mean inherit, and store cards indicate inherited vs store-specific fiscal data.
**Required tests:** `tests/client-store-fiscal-overrides.test.js`, `tests/clients-store-map-characterization.test.js`, `tests/clients-view-characterization.test.js`; user-reported `npm run lint`, `npm run typecheck`, `npx prisma validate`, `npx prisma migrate deploy`, `npx prisma migrate status`, and `npm run build`
**Migration considerations:** Additive nullable rollout preserved backward compatibility and avoided introducing a persisted billing-mode flag
**Rollback or mitigation:** Keep inheritance as the default when override values are absent; no historical migration edits
**Risk:** Medium

## TASK-307: Expose client edit legal/geographic fields, remove dead client credit shaping, and align inline store-credit feedback
**Status:** Completed
**Priority:** High
**Domain:** Customers / Root-shell clients administration
**Requirement:** `client-store-documents-credit-ux` FR-017, FR-018, FR-019, FR-020, BR-002, BR-003, AC-012, AC-013, AC-014, AC-015
**Reason:** The backend update path already supported additional client fiscal/geographic fields, but the browser edit form and helper layer still lagged behind the active store-level credit model and the shared inline-message pattern.
**Current problem:** Before TASK-008, the client edit form omitted `legalName`, `commercialName`, `province`, `canton`, and `district`; `buildClientPayload()` still shaped dead client-level `creditLimit` / `creditBalance` values; and the store-credit mini-form used ad-hoc text feedback in a container not suited for block-level inline messages.
**Proposed change:** Expose the backend-supported client legal/geographic fields in the edit form, remove dead client-level credit shaping from `buildClientPayload()`, and standardize store-credit save feedback on `rootShellUi.renderInlineMessage(...)` inside a valid `aria-live` block container.
**Affected files:** `src/public/root/views/clients-admin.renderers.js`, `src/public/root/views/clients-admin.helpers.js`, `src/public/root/views/clients-admin.js`, `tests/clients-view-characterization.test.js`, related canonical/spec docs
**Dependencies:** TASK-301, TASK-306
**Database impact:** None
**API impact:** No route or payload-contract expansion beyond exposing already-supported client update fields and removing dead client-level credit fields from browser submissions
**Container impact:** None
**Security impact:** Low positive impact through reduced payload drift and continued use of `renderInlineMessage(...)` escaping semantics
**Acceptance criteria:** Implemented — the client edit form exposes `legalName`, `commercialName`, `province`, `canton`, and `district`; `buildClientPayload()` excludes `creditLimit` / `creditBalance`; and inline store-credit success/error feedback uses `renderInlineMessage(...)` in a valid `aria-live` block container.
**Required tests:** `tests/clients-view-characterization.test.js`; user-reported `node --test tests/client-store-credit-limit.test.js tests/client-store-fiscal-overrides.test.js tests/clients-store-map-characterization.test.js tests/clients-view-characterization.test.js` (`43/43`), `npm run lint`, and `npm run typecheck`
**Migration considerations:** Adapter-only/browser-only change; no database or historical migration change required
**Rollback or mitigation:** Existing client/store routes remain unchanged; characterization coverage protects the helper and renderer seams
**Risk:** Low

## TASK-303: Add store-scoped client documents and optional phase-2 store upload flow
**Status:** Proposed
**Priority:** High
**Domain:** Customers / Stores / Documents
**Requirement:** `client-store-documents-credit-ux` FR-021 through FR-025, BR-001, BR-012, NFR-002, NFR-007
**Reason:** The client document UX is now usable, but the domain still cannot represent store-owned credit-analysis documents without overloading client-owned documents.
**Current problem:** `ClientDocument` is currently client-scoped only, there is no `storeId` linkage, and the store dialog cannot continue into an optional document-upload phase after store creation.
**Proposed change:** Add nullable `storeId` support to `ClientDocument`, introduce an additive store-document upload route/use case, and extend the store dialog with an optional phase-2 upload section after successful store creation.
**Affected files:** `prisma/schema.prisma`, new additive migration, `src/routes/client.routes.js`, `src/schemas/client.schema.js`, `src/services/client.service.js`, `src/repositories/client.repository.js`, `src/public/root/clients-api.js`, `src/public/root/views/clients-admin-store-dialog.js`, related tests/docs
**Dependencies:** TASK-002 file-picker contract should be reused; TASK-005 create-store payload seam should be preserved; TASK-301 completed and should remain compatible
**Database impact:** Additive nullable `ClientDocument.storeId` foreign key plus related index/constraint work
**API impact:** New additive `POST /api/clients/:clientId/stores/:storeId/documents` route while preserving existing client-document routes
**Container impact:** None
**Security impact:** Medium positive impact if store/client ownership validation is tested explicitly
**Acceptance criteria:** Existing client-document flow remains backward-compatible; store documents can be uploaded for a valid client/store pair; invalid cross-linkage is rejected; phase-2 upload remains optional.
**Required tests:** route/service integration tests for store-document ownership; characterization for phase-2 dialog flow; regression tests for existing client document route
**Migration considerations:** Use new migration only; do not retrofit existing document rows destructively
**Rollback or mitigation:** Keep client-owned document flow untouched and gate phase-2 UI behind successful store creation only
**Risk:** High

## TASK-304: Wire Hacienda lookup, economic-activity catalog, and trade-type catalog into client/store onboarding
**Status:** Proposed
**Priority:** Medium
**Domain:** Customers / Fiscal data / Integrations
**Requirement:** `client-store-documents-credit-ux` FR-026 through FR-036, BR-011, BR-014, BR-016, BR-017
**Reason:** The repository already has taxpayer lookup and economic-activity adapters, but the client/store onboarding UI does not expose them where onboarding users need them.
**Current problem:** Client creation lacks taxpayer lookup, economic activities are not loaded at mount time in the clients workspace, and `tradeTypeCode` / `tradeTypeLabel` are not modeled in current client/store forms or persistence. TASK-008 removed the obsolete client-level `creditLimit` / `creditBalance` shaping, so the remaining gap is catalog/lookup wiring rather than dead client credit fields.
**Proposed change:** Reuse the existing taxpayer and economic-activity adapters in the client/store UI, constrain `documentType` and economic-activity selection to catalog-backed choices, and introduce a reusable trade-type catalog artifact plus persistence of `tradeTypeCode` and `tradeTypeLabel`.
**Affected files:** `src/public/root/clients-api.js`, `src/public/root/views/clients-admin.js`, `src/public/root/views/clients-admin.renderers.js`, `src/public/root/views/clients-admin-store-dialog.js`, `src/public/root/views/clients-admin.helpers.js`, `src/schemas/client.schema.js`, `src/services/client.service.js`, `src/lib/` catalog artifact, `prisma/schema.prisma`, new additive migration, docs/tests
**Dependencies:** TASK-302, TASK-306; TASK-301 completed and must remain compatible with legacy-null currency rendering semantics
**Database impact:** Additive client/store fiscal catalog fields as approved
**API impact:** Existing lookup/catalog routes reused; client/store create-update payloads gain additive validated fields
**Container impact:** None
**Security impact:** Medium positive impact through reduction of free-text fiscal data and clearer permission-gated lookup use
**Acceptance criteria:** Client/store forms surface the approved lookup/catalog flows; economic activities are loaded at mount time; trade type persists as code + label; browser behavior remains additive over existing routes.
**Required tests:** characterization for lookup wiring and dropdown rendering; integration tests for persisted trade-type/economic-activity fields; permission-gating tests for taxpayer lookup affordances
**Migration considerations:** Keep current routes stable and introduce only additive persistence/validation changes
**Rollback or mitigation:** Maintain manual entry fallback where business rules still allow it during rollout
**Risk:** Medium

## TASK-305: Record canonical validation evidence and reduce clients-admin adapter drift
**Status:** Proposed
**Priority:** Medium
**Domain:** Documentation / Root UI governance
**Requirement:** `client-store-documents-credit-ux` NFR-001, NFR-004, NFR-005, NFR-006
**Reason:** The feature now has user-reported targeted validation and improved browser seams; canonical docs are refreshed through TASK-008, but manual evidence and adapter hardening still lag behind the implemented state.
**Current problem:** Canonical docs now reflect TASK-008, but manual browser evidence for the new client/store UX is still not captured, the governed upload pattern is duplicated across browser modules, the additive store-currency rollout still relies on renderer compatibility for legacy `NULL` rows, and the new store override flow plus TASK-008 client-edit/inline-feedback behavior are covered structurally rather than by checked-in manual browser evidence.
**Proposed change:** Add executed manual validation evidence for the implemented client/store seams, refresh canonical runtime/governance docs after each approved increment, verify the legacy null-currency display path in a browser if such data exists, and evaluate extraction of a shared browser helper for governed file uploads.
**Affected files:** `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md`, feature implementation reports/evidence docs, possible new browser helper under `src/public/**`, related characterization tests
**Dependencies:** TASK-302 through TASK-304 as applicable; canonical doc refresh now covers TASK-001 through TASK-008
**Database impact:** None
**API impact:** None directly
**Container impact:** None
**Security impact:** Low positive impact through stronger validation evidence and reduced UX drift
**Acceptance criteria:** Canonical docs clearly distinguish implemented vs proposed client/store work; manual browser evidence exists for native download, file picker, client edit/save with the newly exposed legal/geographic fields, inline store-credit feedback, zone refresh, create-store `currency` + `creditLimit`, inherited vs override store billing behavior, and legacy null-currency-safe rendering when applicable; any helper extraction preserves existing contracts.
**Required tests:** documentation governance tests; existing client workspace characterization tests; optional new helper-level tests if extraction is approved
**Migration considerations:** Documentation-first; helper extraction should be sequenced only after characterization safety nets exist
**Rollback or mitigation:** If helper extraction is deferred, keep docs explicit about the duplication as active architectural debt
**Risk:** Low
