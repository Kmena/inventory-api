# Architectural Action Plan
## 1. Objective
Refresh the post-implementation plan for the implemented production/QA and recipe-admin UX slices so the repository distinguishes:
- what is already implemented
- what remains as follow-up hardening
- what should not be overstated as complete

## 2. Scope
This action plan covers the implemented feature area:
- recipe stage typing and process definition
- recipe approval UX safety and repair guidance in the root-shell admin
- QA rejection relevant-input scope
- replacement recovery stage support
- lot-level recolection entry capture
- same-lot usage validation
- terminal reconciliation recording
- production order read-model exposure
- warehouse SPA support
- architecture/documentation follow-up

## 3. Out of scope
- repository-wide rename of all `recolection` identifiers
- full production module rewrite into hexagonal packages
- event-driven redesign
- broader customer, billing, or procurement redesign unrelated to this feature
- claims of full operational completeness beyond currently recorded evidence

## 4. Requirements addressed
| Requirement | Current implementation status | Main implementation points |
|---|---|---|
| FR-001 / BR-001 | Implemented | `quality-relevant-input-scope.service.js`, `quality.service.js` |
| FR-002, FR-010, FR-011, FR-013 | Implemented | lot-level recolection entries + same-lot validation gate |
| FR-003 to FR-009 | Implemented in backend, partially follow-up in UI alignment | recipe schema/service + root-shell editor |
| recipe-approval-ux FR-001 to FR-011 | Implemented in root-shell UI without backend contract changes | `src/public/root/views/recipes-admin.js`, `recipes-admin.renderers.js`, `recipes-admin.version-editor.js`, existing recipe route/service/schema |
| FR-012 / BR-007 | Implemented | reconciliation endpoint + outcome validation |
| FR-014 | Implemented | `createReplacementRecoveryStage` |
| FR-015 | Implemented additively | production routes/schemas + runtime contract docs |
| FR-016 | Implemented for current read model | serialized `recolectionStages`, entries, reconciliations |
| FR-017 | Implemented | UI labels and process-code catalog are aligned with the backend-supported recipe editor contract |
| FR-018 | Implemented additively with compatibility defaults | migration defaults and legacy wrapper behavior |
| FR-019 | Implemented with remaining manual validation depth gap | warehouse SPA renderers/controllers updated |
| FR-020 | Implemented | spec docs + runtime docs + this refresh |

## 5. Current problems addressed
Problems already corrected in code:
- failed-stage-without-direct-consumption scenario lacked broader material scope
- production flow did not distinguish replacement recovery from legacy virtual recolection
- lot-level recolection tracking was missing
- terminal reconciliation recording was missing
- stage re-execution gate did not distinguish replacement recovery pending state
- production order read model did not expose the full recolection/reconciliation detail needed by the warehouse UI
- server-side same-lot validation was not active
- draft recipe approval had no explicit irreversible-action confirmation step
- recipe approval feedback was too distant from the triggering version-card actions
- incomplete stage-input rows in recipe drafts could be silently discarded during save
- recipe approval repair flow lacked direct draft-editor navigation and conservative highlight guidance

Problems still open:
- manual evidence for full warehouse operator flow remains incomplete in repository docs
- manual browser evidence for recipe approval dialog focus/scroll behavior is not yet checked in
- architecture is still service-heavy rather than domain/port oriented

## 6. Domains affected
- Recipes
- Production
- Quality
- Inventory
- Warehouse UI
- Root-shell recipe administration
- Root-shell recipe approval UX
- Documentation/governance

## 7. Behavior to preserve
- company-scoped production and QA access
- additive compatibility with existing `VIRTUAL_RECOLECTION`
- current production route paths, including legacy `confirm` wrapper
- server-side authority over lot validation and balance enforcement
- transaction-based stock mutation for production execution
- backward-compatible handling of legacy recipe stages without `stageType`
- recipe approval must continue using the existing backend route and backend validation authority for product association, lineage, and allocation rules
- warning-level incomplete `PROCESSING` rows may still be saved as draft work-in-progress, but the UI must keep those drafts visibly incomplete until corrected or successfully approved

## 8. Defects to correct
### Remaining follow-up defects
1. missing stronger manual/integration evidence for the full recovery/reconciliation workflow
2. manual browser evidence for recipe approval dialog focus/scroll behavior is not yet recorded in repository docs
3. ongoing architectural coupling across services, repositories, and browser DTOs

## 9. Future architectural changes
### Near-term follow-up
- add end-to-end characterization for QA rejection → replacement recovery → same-lot execution → reconciliation
- record manual/browser validation evidence for recipe approval confirmation, local feedback focus, and repair navigation
- evaluate whether incomplete recipe draft visibility needs persistence beyond the current frontend-only marker
- strengthen operational documentation and manual validation evidence for warehouse users

### Medium-term follow-up
- extract production/quality policy objects from large service modules
- define a clearer application/domain split for Production, Quality, and Inventory
- decide whether rejection scope should be persisted as an immutable audit snapshot

## 10. Database changes
Already implemented:
- `production_recolection_stages.recovery_type`
- `production_recolection_entries`
- `production_recolection_reconciliations`

Potential follow-up DB changes:
- none required immediately for the implemented feature set
- future audit-snapshot persistence only if the rejection-scope decision is approved later
- no database change is currently justified for `recipe-approval-ux`; a persisted incomplete-draft marker would require separate approval if cross-session visibility becomes necessary

## 11. API and integration changes
Already implemented:
- `POST /api/production/orders/:id/recolections/:recolectionId/reconciliation`
- additive inspection payload fields for replacement-recovery support
- production order serialization with `recolectionStages.entries` and `recolectionStages.reconciliations`

Follow-up API concerns:
- keep wording conservative around completeness of end-to-end operational validation
- review whether a future explicit read endpoint for reconciliation summaries would reduce over-fetching
- keep the recipe approval UX additive over the existing `POST /api/recipes/versions/:id/approve` contract unless a later requirement proves a persisted incomplete-draft state is needed

## 12. Container and deployment changes
No container-specific changes are required for this feature refresh.

The active deployment baseline already includes:
- multi-stage Docker build
- non-root runtime user
- healthcheck
- dev-only compose separation

## 13. Security changes
Already implemented for this feature area:
- company-scoped access to production/quality operations
- server-side validation of lot identity and recovered-balance limits
- state-transition guarding for re-execution and closed recovery stages

Follow-up security posture:
- treat manual validation evidence as incomplete rather than assuming full operational closure
- preserve server-side enforcement even if UI behavior changes later

## 14. Test strategy
### Implemented coverage
- migration/schema tests for recovery data model
- service tests for relevant-input scope
- service tests for same-lot validation
- service tests for replacement-recovery gate behavior
- service tests for reconciliation outcomes and balance computation
- recipe admin characterization tests for confirmation-dialog seams, action-local version feedback, incomplete-draft marker rendering, and repair/highlight hooks
- user-reported targeted validation for `recipe-approval-ux`: `node --test tests/root-shell-recipes-admin-view-characterization.test.js tests/recipe-service-foundation.test.js tests/recipe-schema.test.js` pass (72/72), plus lint/typecheck pass

### Remaining recommended coverage
- browser/E2E flow covering replacement recovery capture and reconciliation submission
- integration test proving enriched QA inspection envelope and order read-model interaction together
- executed manual/browser evidence for recipe approval cancel/confirm, scroll-to-feedback, `Reparar borrador`, and conservative repair highlighting behavior

## 15. Migration stages
### Stage 1 — Implemented
- recipe stage typing and process definition support
- QA relevant-input scope resolver
- recoveryType and recolection entry/reconciliation persistence
- replacement recovery orchestration
- same-lot usage guard
- reconciliation endpoint
- warehouse SPA updates
- production order serialization updates

### Stage 2 — Proposed follow-up
- add stronger end-to-end and manual evidence
- record recipe approval UX browser-validation evidence
- refresh operational docs/runbooks if warehouse workflow language changed

### Stage 3 — Proposed architecture hardening
- extract production/quality policy seams from service-heavy modules
- evaluate persisted audit snapshot for relevant-input scope

## 16. Risks and mitigations
| Risk | Level | Mitigation |
|---|---|---|
| Overstating feature completeness beyond available evidence | High | keep docs explicit about automated vs manual validation depth |
| Root-shell recipe editor process-code catalog | ~~Medium~~ | **RESOLVED** — UI catalog aligned with backend `RECIPE_STAGE_PROCESS_CODES` (DEF-002) |
| Regressions in full warehouse operator flow not covered by current service tests | Medium | add E2E/integration coverage and operator validation evidence |
| Recipe approval dialog/focus behavior differs across real browsers despite characterization coverage | Medium | record manual browser evidence and keep the implementation on native `<dialog>` behavior already used elsewhere |
| Further service-layer growth reducing maintainability | Medium | schedule policy extraction without rewriting public routes |

## 17. Rollback or recovery strategy
- no rollback is proposed in documentation refresh itself
- for future follow-up work, keep route contracts stable and prefer additive changes
- avoid changing the already-applied recovery migration in place; use new migrations only if additional persistence is needed

## 18. Manual validation
Still recommended despite implemented automated tests:
1. Reject a stage with no direct consumptions and verify relevant-input scope still shows prior-stage materials.
2. Trigger `requiresReplacementStage: true` and confirm a `REPLACEMENT_RECOVERY` stage appears in the warehouse UI.
3. Confirm replacement recovery with lot-level entries.
4. Attempt to execute with a non-recovered lot and verify server rejection.
5. Reconcile recovered balances with `USED`, `RETURNED`, and `DISCARDED` outcomes.
6. Cancel the recipe approval confirmation dialog and verify no approval API call occurs.
7. Confirm recipe approval failure scrolls/focuses the local version-card feedback region.
8. Use `Reparar borrador` from approval feedback and verify the editor reopens on the same draft with highlight only when the backend message maps safely.
9. Save a draft with incomplete `RECOLLECTION` rows and verify save is blocked.
10. Save a draft with incomplete `PROCESSING` rows and verify save continues, warning appears, and the versions tab marks the draft as `Incompleta`.

## 19. Approval status
**Status:** Documentation refresh completed for the implemented feature.

Implemented feature work is already present in the repository.
Remaining follow-up tasks below are not approved by this document; they remain proposed until explicitly requested.

## 20. Documentation governance
The governance test suite reads hosted workflow truth from `../.github/workflows/` to validate that local characterization and contract tests remain aligned with hosted CI baselines.

Runtime company-role update flow now exists. Company-role list/create/update flows are implemented and the action plan acknowledges their presence.

Browser session HTTPS enforcement is a residual risk tracked under `specs/p11-https-browser-session-migration/` and remains a follow-up dependency outside this feature's approved scope.

This plan operates under the p34-bounded-governance-coverage-expansion posture: partial OpenAPI/typecheck coverage posture bounded by the approved governance baseline. bounded governance evidence is preserved through characterization tests and contract docs.
