# Architectural Action Plan
## 1. Objective
Refresh the post-implementation plan for the implemented production/QA, recipe-admin UX, and partially implemented client/store onboarding UX slices so the repository distinguishes:
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
- root-shell clients admin document + store-dialog UX follow-up after TASK-001 through TASK-008 of `client-store-documents-credit-ux`

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
| client-store-documents-credit-ux FR-001 to FR-008 | Implemented in the root-shell browser layer without backend contract changes | `src/public/root/views/clients-admin.js`, `clients-admin.renderers.js`, `clients-admin-store-dialog.js`, existing `clientsApi` / client routes |
| client-store-documents-credit-ux FR-009 | Implemented through the existing create-store contract and shared browser payload builder | `src/public/root/views/clients-admin.helpers.js`, `clients-admin-store-dialog.js`, `src/schemas/client.schema.js`, `src/services/client.service.js` |
| client-store-documents-credit-ux FR-010, FR-011 | Implemented additively through store currency persistence, renderer alignment, and legacy-null-safe display behavior | `prisma/schema.prisma`, `prisma/migrations/20261002000000_add_store_currency/`, `src/public/root/views/clients-admin.helpers.js`, `clients-admin-store-dialog.js`, `clients-admin.renderers.js`, `src/schemas/client.schema.js`, `src/services/client.service.js` |
| client-store-documents-credit-ux FR-013, FR-014, FR-015 | Implemented additively through nullable store fiscal override fields, explicit inherit-vs-override dialog mode, and inherited fiscal summary rendering | `prisma/schema.prisma`, `prisma/migrations/20261002001000_add_store_billing_fields/`, `src/public/root/views/clients-admin.helpers.js`, `clients-admin-store-dialog.js`, `clients-admin.renderers.js`, `src/schemas/client.schema.js`, `src/services/client.service.js` |
| client-store-documents-credit-ux FR-017, FR-018, FR-019, FR-020 | Implemented in the root-shell browser layer | `src/public/root/views/clients-admin.renderers.js`, `src/public/root/views/clients-admin.helpers.js`, `src/public/root/views/clients-admin.js`, `tests/clients-view-characterization.test.js` |
| client-store-documents-credit-ux FR-016 | Partially implemented | current code supports the 7 store fiscal override fields only; `tradeTypeCode` / `tradeTypeLabel` remain pending |
| client-store-documents-credit-ux FR-012, FR-021 to FR-036 | Proposed follow-up only | remaining client fiscal catalog completion, store-scoped documents, Hacienda/economic-activity/trade-type wiring, and later persistence extensions |

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
- protected client-document download showed success without reliably delivering a browser download
- client document upload required manual Base64 entry instead of a native file picker
- the store dialog became a dead end when no zones existed and could not refresh zone options without a full page reload
- store creation previously required a second backend step to set `creditLimit` and duplicated payload shaping in the dialog
- store creation previously lacked per-store currency capture and store cards previously communicated credit usage with an ambiguous `Saldo` label
- store creation previously had no explicit inherit-vs-override fiscal mode and could not persist the current 7-field store billing override foundation

Problems still open:
- manual evidence for full warehouse operator flow remains incomplete in repository docs
- manual browser evidence for recipe approval dialog focus/scroll behavior is not yet checked in
- architecture is still service-heavy rather than domain/port oriented
- the client/store onboarding feature remains only partially implemented beyond TASK-008

## 6. Domains affected
- Recipes
- Production
- Quality
- Inventory
- Warehouse UI
- Root-shell recipe administration
- Root-shell recipe approval UX
- Documentation/governance
- Customers / Stores / Root-shell clients administration

## 7. Behavior to preserve
- company-scoped production and QA access
- additive compatibility with existing `VIRTUAL_RECOLECTION`
- current production route paths, including legacy `confirm` wrapper
- server-side authority over lot validation and balance enforcement
- transaction-based stock mutation for production execution
- backward-compatible handling of legacy recipe stages without `stageType`
- recipe approval must continue using the existing backend route and backend validation authority for product association, lineage, and allocation rules
- warning-level incomplete `PROCESSING` rows may still be saved as draft work-in-progress, but the UI must keep those drafts visibly incomplete until corrected or successfully approved
- the existing client-document upload/download backend contracts must remain backward-compatible while the browser UX evolves
- the store dialog should keep the new in-place zone-refresh and guidance behavior while later store-creation requirements are added
- the current create-store path must preserve required browser-side currency selection (`CRC | USD | EUR`), optional create-time `creditLimit` support, and null-as-inherit store fiscal override semantics, including the browser-side omission of blank/zero credit values and server-side rejection of negatives

## 8. Defects to correct
### Remaining follow-up defects
1. missing stronger manual/integration evidence for the full recovery/reconciliation workflow
2. manual browser evidence for recipe approval dialog focus/scroll behavior is not yet recorded in repository docs
3. ongoing architectural coupling across services, repositories, and browser DTOs
4. missing client/store onboarding capabilities still required by the approved feature spec: client fiscal catalog completion, store-scoped documents, Hacienda/economic-activity wiring, and `tradeTypeCode` / `tradeTypeLabel`
5. manual browser evidence for the new client/store UX seams is not yet checked in as executed evidence, even though canonical docs now reflect the implemented TASK-008 state
6. backend validation still does not enforce stronger completeness rules for override-mode fiscal payloads beyond the current optional-field constraints

## 9. Future architectural changes
### Near-term follow-up
- add end-to-end characterization for QA rejection → replacement recovery → same-lot execution → reconciliation
- record manual/browser validation evidence for recipe approval confirmation, local feedback focus, and repair navigation
- evaluate whether incomplete recipe draft visibility needs persistence beyond the current frontend-only marker
- strengthen operational documentation and manual validation evidence for warehouse users
- complete the remaining client/store onboarding slices incrementally, preserving the newly stabilized browser seams, the shared store payload builder seam, the cleaned-up client payload builder seam, the additive store-currency contract, the null-currency-safe renderer behavior for legacy rows, the current null-as-inherit store fiscal semantics, the editable client legal/geographic fields, and the existing backend client-document contract

### Medium-term follow-up
- extract production/quality policy objects from large service modules
- define a clearer application/domain split for Production, Quality, and Inventory
- decide whether rejection scope should be persisted as an immutable audit snapshot
- evaluate whether the client/store browser adapters should extract a shared governed file-upload helper before more upload surfaces are added

## 10. Database changes
Already implemented:
- `production_recolection_stages.recovery_type`
- `production_recolection_entries`
- `production_recolection_reconciliations`
- `client_stores.currency` via `20261002000000_add_store_currency`
- nullable store fiscal override columns on `client_stores` via `20261002001000_add_store_billing_fields`

Potential follow-up DB changes:
- none required immediately for the implemented feature set
- future audit-snapshot persistence only if the rejection-scope decision is approved later
- no database change is currently justified for `recipe-approval-ux`; a persisted incomplete-draft marker would require separate approval if cross-session visibility becomes necessary
- the remaining client/store onboarding work will require additive schema changes for nullable store linkage on `ClientDocument`, client/store fiscal catalog fields still missing from canonical flows, and later `tradeTypeCode` / `tradeTypeLabel`; store currency is already implemented through migration `20261002000000_add_store_currency`, and the 7 nullable store fiscal override fields are already implemented through `20261002001000_add_store_billing_fields`

## 11. API and integration changes
Already implemented:
- `POST /api/production/orders/:id/recolections/:recolectionId/reconciliation`
- additive inspection payload fields for replacement-recovery support
- production order serialization with `recolectionStages.entries` and `recolectionStages.reconciliations`

Follow-up API concerns:
- keep wording conservative around completeness of end-to-end operational validation
- review whether a future explicit read endpoint for reconciliation summaries would reduce over-fetching
- keep the recipe approval UX additive over the existing `POST /api/recipes/versions/:id/approve` contract unless a later requirement proves a persisted incomplete-draft state is needed
- keep client/store onboarding changes additive over `POST /api/clients/:clientId/documents`, `GET /api/clients/:clientId/documents/:documentId/download`, `PUT /api/clients/:clientId`, and `POST /api/clients/company/:clientId/stores`; preserve the current store `currency` + optional create-time `creditLimit` + nullable override-field contract, the TASK-008 client payload cleanup, and introduce any new store-document route additively rather than replacing existing client-document flows

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
- user-reported targeted validation for `client-store-documents-credit-ux` TASK-001 through TASK-008: `node --test tests/client-store-credit-limit.test.js tests/client-store-fiscal-overrides.test.js tests/clients-store-map-characterization.test.js tests/clients-view-characterization.test.js` pass (`43/43`), `npm run lint` pass, and `npm run typecheck` pass; TASK-008 introduced no production schema change, so the earlier TASK-006/TASK-007 `npx prisma validate`, `npx prisma migrate deploy`, `npx prisma migrate status`, and `npm run build` results remain the latest persistence-validation evidence

### Remaining recommended coverage
- browser/E2E flow covering replacement recovery capture and reconciliation submission
- integration test proving enriched QA inspection envelope and order read-model interaction together
- executed manual/browser evidence for recipe approval cancel/confirm, scroll-to-feedback, `Reparar borrador`, and conservative repair highlighting behavior
- integration/browser evidence for actual protected client-document save behavior, real file submission with the new file picker, client edit/save with the newly exposed legal/geographic fields, live zone creation followed by in-dialog refresh, inline store-credit feedback behavior in a real browser, end-to-end create-store `currency` + `creditLimit` + inherit/override persistence in the root-shell UI, and browser confirmation of the null-currency-safe legacy display path if such rows still exist in shared environments

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
- complete the remaining client/store onboarding feature increments after the stabilized UX foundation in TASK-001 through TASK-008

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
| Remaining client/store onboarding work introduces additive schema + UI complexity on already-large adapters | Medium | stage the work behind characterization tests, preserve the shared store payload seam plus the cleaned-up client payload seam, preserve the additive currency + override-field contract, and keep route changes additive |
| Browser behavior for native downloads, legacy null-currency display, store billing-mode interaction, and `Ir a Zonas` popup handling may vary across environments | Low | capture manual browser evidence before declaring UX fully complete |

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
11. In the root-shell clients workspace, click `Descargar` for a protected document and confirm the browser receives the file with the expected filename.
12. Select a valid document in the file-picker flow and confirm the unchanged upload contract still succeeds end to end.
13. Open the store dialog with no zones, navigate to Zones, create a zone/subzone, return, click `Refrescar zonas`, and confirm the form unlocks without a full page reload.
14. Edit a client and confirm `legalName`, `commercialName`, `province`, `canton`, and `district` can be changed and persisted through the current update flow.
15. Save a store credit limit from the inline store card and confirm both success and error states use the styled inline-message container inside the card.
16. Create a store with `Moneda de crédito` plus a positive `Límite de crédito` and confirm the persisted store reflects both values with the expected card symbol.
17. Create a store in inherited billing mode and confirm no store override values are persisted while the card indicates inherited fiscal data.
18. Create a store in override mode with the current 7 fiscal fields and confirm the persisted store reflects those values and the card indicates store-specific fiscal data.
19. Create a store with `Moneda de crédito` and blank or `0` `Límite de crédito` and confirm the request succeeds without sending a store `creditLimit` value.
20. If legacy stores with `NULL` currency still exist, open their detail cards and confirm the renderer shows `Moneda: Sin definir` plus symbol-free `Usado` / `Disponible` amounts instead of incorrectly defaulting to `CRC`.

## 19. Approval status
**Status:** Documentation refresh completed for the implemented production/recipe slices and for the partially implemented `client-store-documents-credit-ux` TASK-001 through TASK-008 slice.

Implemented feature work is already present in the repository.
Remaining follow-up tasks below are not approved by this document; they remain proposed until explicitly requested.

## 20. Documentation governance
The governance test suite reads hosted workflow truth from `../.github/workflows/` to validate that local characterization and contract tests remain aligned with hosted CI baselines.

Runtime company-role update flow now exists. Company-role list/create/update flows are implemented and the action plan acknowledges their presence.

Browser session HTTPS enforcement is a residual risk tracked under `specs/p11-https-browser-session-migration/` and remains a follow-up dependency outside this feature's approved scope.

This plan operates under the p34-bounded-governance-coverage-expansion posture: partial OpenAPI/typecheck coverage posture bounded by the approved governance baseline. bounded governance evidence is preserved through characterization tests and contract docs.
