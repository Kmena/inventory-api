# Architectural Action Plan

## 1. Objective
Synchronize architecture-facing documentation with the real post-implementation state of `p9-prisma-windows-closeout`, while leaving only the residual evidence-collection gap as proposed follow-up work.

## 2. Scope
In scope:
- refresh `docs/current-state.md` and `docs/architecture.md`
- keep the implemented Windows Prisma workflow hardening visible in architecture-facing docs
- record the actual closeout verdict as `residual gobernado`
- define only the remaining evidence-governance follow-up needed for final reassessment

## 3. Out of scope
- production code redesign
- Prisma schema or migration changes
- unrelated runtime or domain refactors
- claiming `estabilizado con evidencia CI` without the missing remote evidence

## 4. Requirements addressed
| Requirement | Current status | Documentation response |
|---|---|---|
| FR-001 / AC-001 explicit closeout criterion | Implemented and documented in `docs/prisma-windows-stability-evidence.md` | reflected in architecture-facing docs |
| FR-002 / FR-010 / AC-002 / AC-008 hardened Windows workflow with auditable evidence and real failure preservation | Implemented in both workflow files | reflected as current behavior to preserve |
| FR-004 / AC-006 explicit failure classification taxonomy | Implemented and tested | reflected in current-state and architecture docs |
| FR-005 / FR-009 / AC-007 real repository closeout documentation | Implemented in `docs/prisma-windows-stability-evidence.md` and linked from README | reflected as source of truth |
| FR-006 / AC-004 workflow -> tests -> evidence traceability | Implemented in scripts/tests/docs | reflected in architecture-facing docs |
| FR-008 characterization tests only where needed | Implemented with workflow governance tests | reflected in testing strategy |
| BR-006 minimum stabilization criterion including documented `workflow_dispatch` or rerun | Not yet fully satisfied | kept as residual follow-up |
| BR-005 residual-governed fallback when full stabilization cannot yet be claimed | Current actual state | documented as present verdict |

## 5. Current problems addressed
- architecture-facing docs were stale and described a different implementation cycle
- the implemented Windows Prisma workflow hardening was not reflected as current repository architecture/governance
- the actual closeout state needed to be recorded as residual, not stabilized

## 6. Domains affected
- Platform Runtime Governance
- Build & Prisma Bootstrap
- Evidence and Documentation Governance

## 7. Behavior to preserve
- `npm run build` uses the guarded Prisma wrapper
- the root Windows workflow publishes build summary and artifact evidence
- the explicit workflow failure gate preserves real build failure
- workflow baseline validation remains part of repository governance
- the evidence document remains the primary source of truth

## 8. Defects to correct
- documentation drift after the implementation cycle
- incomplete remote-evidence closure against the approved criterion

## 9. Target architectural changes
- no production architectural redesign
- update architecture-facing docs so they describe the implemented governance architecture accurately
- keep the residual gap constrained to remote evidence collection and verdict reassessment

## 10. Database changes
None.

## 11. API and integration changes
No application API changes are proposed.

Repository-governance integration follow-up remains:
- obtain a documented remote `workflow_dispatch` run or rerun when GitHub execution access is available

## 12. Container and deployment changes
None.

## 13. Security changes
No new application security change is proposed.

Governance integrity to preserve:
- no false success on real build failure
- no overstatement of stabilization without evidence

## 14. Test strategy
- preserve `npm run validate:workflow-baseline`
- preserve `tests/workflow-baseline-characterization.test.js`
- preserve `tests/prisma-windows-build-stabilization.test.js`
- continue using the user-supplied successful test executions as implementation evidence for this refresh until a later cycle re-executes them

## 15. Migration stages
1. Refresh architecture-facing docs to the real implemented state
2. Keep current verdict as `residual gobernado`
3. When GitHub remote execution is available, capture a documented `workflow_dispatch` run or rerun
4. Update `docs/prisma-windows-stability-evidence.md` and the architecture-facing docs again after that evidence exists

## 16. Risks and mitigations
| Risk | Level | Mitigation |
|---|---|---|
| Overstating the closure as stabilized | High | keep `residual gobernado` explicitly documented |
| Drift between root workflow and mirrored workflow baseline | Medium | preserve validation script and characterization tests |
| Losing traceability between workflow, tests and evidence | Medium | keep the evidence document as the repository source of truth and README entry point |

## 17. Rollback or recovery strategy
- docs-only updates can be reverted independently if wording needs correction
- no production rollback, migration rollback, or deployment rollback is required for this refresh

## 18. Manual validation
Next follow-up cycle should manually validate:
- remote execution of the hardened root workflow
- presence of workflow summary for the new run
- presence of `windows-prisma-build-log-<run_id>` artifact
- result classification and final exit status
- whether the new evidence satisfies the approved closeout criterion

## 19. Approval status
**Status:** Proposed

Completed implementation is reflected as current state. Remaining follow-up tasks stay Proposed until explicitly requested.
