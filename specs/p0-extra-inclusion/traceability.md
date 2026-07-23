# Traceability Matrix

## 1. Alignment summary
This traceability file is aligned with the audited revision of `specs/p0-extra-inclusion/`.

- `tasks.md` defines the authoritative audited task model: `TASK-P0X-001` through `TASK-P0X-012`.
- Operational execution of the pending audited work has been extracted into `specs/p0-extra-closure-followup/`.
- `implementation-report.md` is preserved as historical evidence input, not as proof of completed closure.
- `validation-evidence.md` defines the durable evidence registry structure.
- The extension and the parent P0 were previously open until failed and inconclusive conditions were resolved; replay resolution is now back-propagated from `specs/p0-replay-blocker-fix/`.

## 2. Audit finding → Requirement → Decision → Task → Evidence → Current result
| Finding | Requirement | Planning decision | Task | Command or workflow | Evidence required | Current result |
|---|---|---|---|---|---|---|
| Documentation drift | FR-P0X-010, FR-P0X-012 | DEC-P0X-001, DEC-P0X-008 | TASK-P0X-001, TASK-P0X-007, TASK-P0X-011 | Repository docs and parent P0 docs | Updated docs and comparison | TASK-P0X-001 and TASK-P0X-007 completed; package documentation aligned; final closure still open due replay |
| Failed real CI run | FR-P0X-006, FR-P0X-011, FR-P0X-012 | DEC-P0X-004, DEC-P0X-007 | TASK-P0X-004, TASK-P0X-008, TASK-P0X-010, TASK-P0X-012 | `.github/workflows/p0-quality-gates.yml` | Workflow run reference and status | TASK-P0X-004 and TASK-P0X-010 completed; successful CI evidence preserved alongside historical failed runs |
| Incomplete clean replay | FR-P0X-008, FR-P0X-009, FR-P0X-012 | DEC-P0X-005, DEC-P0X-006 | TASK-P0X-005, TASK-P0X-006, TASK-P0X-008, TASK-P0X-012 | Replay sequence using Docker + Prisma | Replay log with classification | Historical failed attempts preserved; approved child package `specs/p0-replay-blocker-fix/` now provides successful canonical replay evidence |
| Negative evidence preservation | FR-P0X-011 | DEC-P0X-007 | TASK-P0X-001, TASK-P0X-008, TASK-P0X-012 | Evidence registry | Evidence registry entries | TASK-P0X-008 completed; negative evidence preserved across historical and follow-up runs |
| Script presence may be mistaken for closure | FR-P0X-001, FR-P0X-002, FR-P0X-003, FR-P0X-004, FR-P0X-005, FR-P0X-012 | DEC-P0X-001 | TASK-P0X-001, TASK-P0X-002, TASK-P0X-009 | package scripts | Per-gate execution evidence | TASK-P0X-009 completed; fresh supported-runtime gate evidence recorded; final closure still open due replay |
| Verify not directly evidenced in CI | FR-P0X-005, FR-P0X-006 | DEC-P0X-003, DEC-P0X-004 | TASK-P0X-002, TASK-P0X-004, TASK-P0X-009, TASK-P0X-010 | `npm run verify`, workflow | Verify gate evidence and CI comparison | TASK-P0X-010 completed using real CI evidence for child scripts; direct CI verify execution still absent as narrower drift item |
| Runtime drift risk | FR-P0X-007 | DEC-P0X-002 | TASK-P0X-003, TASK-P0X-007 | package.json, README, Docker, workflow | Runtime alignment review | TASK-P0X-003 and TASK-P0X-007 completed; runtime documentation aligned; closure still open due replay |

## 3. Requirement → Task → Evidence mapping
| Requirement | Task | Evidence required | Current closure status |
|---|---|---|---|
| FR-P0X-001 | TASK-P0X-002, TASK-P0X-009 | `EVID-LINT-*` | TASK-P0X-009 completed; local validation passed; combined closure failed |
| FR-P0X-002 | TASK-P0X-002, TASK-P0X-009 | `EVID-TYPE-*` | TASK-P0X-009 completed; local validation passed; combined closure failed |
| FR-P0X-003 | TASK-P0X-002, TASK-P0X-009 | `EVID-BUILD-*` | TASK-P0X-009 completed; local validation passed; combined closure failed |
| FR-P0X-004 | TASK-P0X-002, TASK-P0X-009 | `EVID-TEST-*` | TASK-P0X-009 completed; local validation passed; combined closure failed |
| FR-P0X-005 | TASK-P0X-002, TASK-P0X-009, TASK-P0X-010 | `EVID-VERIFY-*` | TASK-P0X-009 completed; local validation passed with preserved intermittent failed verify run; combined closure failed |
| FR-P0X-006 | TASK-P0X-004, TASK-P0X-010 | `EVID-CI-*` | TASK-P0X-004 and TASK-P0X-010 completed; resolved for CI evidence; combined closure still failed due replay |
| FR-P0X-007 | TASK-P0X-003, TASK-P0X-007 | `EVID-RUNTIME-*` | TASK-P0X-003 and TASK-P0X-007 completed; resolved technically and documentarily; combined closure failed |
| FR-P0X-008 | TASK-P0X-005, TASK-P0X-006 | `EVID-DB-*`, `EVID-RBF-003` | Historical failed evidence preserved; resolved by successful canonical replay in child package |
| FR-P0X-009 | TASK-P0X-006, TASK-P0X-008 | `EVID-DB-*`, `EVID-RBF-003` | Historical failed / environment-blocked evidence preserved; final replay truth now passed |
| FR-P0X-010 | TASK-P0X-011 | Parent package update review | Completed through follow-up back-propagation |
| FR-P0X-011 | TASK-P0X-001, TASK-P0X-008, TASK-P0X-010, TASK-P0X-012 | Evidence registry and preserved failed attempts | TASK-P0X-008 completed; negative evidence preserved |
| FR-P0X-012 | TASK-P0X-012 | Final closure assessment | Completed after replay-fix propagation |

## 4. Historical evidence preserved and aligned
| Evidence ID | Source | Related current tasks | Result | Resolution status |
|---|---|---|---|---|
| EVID-CI-001 | `specs/p0-extra-inclusion/implementation-report.md` real workflow run `29287056129` | TASK-P0X-004, TASK-P0X-008, TASK-P0X-010, TASK-P0X-012 | Failed at lint | Superseded but preserved |
| EVID-CI-002 | `specs/p0-extra-closure-followup/implementation-report.md` real workflow run `29288885694` | TASK-P0X-004, TASK-P0X-010, TASK-P0X-012 | Failed | Superseded but preserved |
| EVID-CI-003 | GitHub Actions real workflow run `29383737072` | TASK-P0X-004, TASK-P0X-010, TASK-P0X-012 | Passed on commit `5c16b2c91e22b49085e1cb7f72a3ae58bd1bf50f` under Node 20 | Resolved |
| EVID-DB-001 | `specs/p0-extra-inclusion/implementation-report.md` host-local replay attempt | TASK-P0X-005, TASK-P0X-006, TASK-P0X-008, TASK-P0X-012 | Inconclusive due to environment drift | Superseded but preserved |
| EVID-DB-002 | `specs/p0-extra-inclusion/implementation-report.md` compose-aligned replay attempt | TASK-P0X-005, TASK-P0X-006, TASK-P0X-008, TASK-P0X-012 | Migrations reported success; seed failed / environment blocked | Superseded but preserved |
| EVID-DB-003 | `specs/p0-extra-closure-followup/implementation-report.md` fresh compose replay `tracksys_replay_followup_20260713` | TASK-P0X-006, TASK-P0X-012 | Failed / environment blocked; target database disappeared after reported migration success | Superseded but preserved |
| EVID-DB-004 | `specs/p0-extra-inclusion/implementation-report.md` compose replay `tracksys_replay_validation` | TASK-P0X-006, TASK-P0X-012 | Failed / environment blocked; committed app image lacks migration script and seed fails on missing tables | Superseded but preserved |
| EVID-RBF-003 | `specs/p0-replay-blocker-fix/validation-evidence.md` canonical replay `tracksys_replay_task2` | TASK-P0X-006, TASK-P0X-012 | Passed with 47 tables, successful seed and `/health` 200 | Resolved |
| EVID-TEST-001 | `specs/p0-extra-inclusion/implementation-report.md` historical supported-runtime local `npm run test` pass | TASK-P0X-009, TASK-P0X-012 | Historical local pass | Superseded but preserved |
| EVID-TEST-002 | `specs/p0-extra-closure-followup/implementation-report.md` supported-runtime local `npm run test` pass | TASK-P0X-009, TASK-P0X-012 | Passed under Node 20 | Superseded but preserved |
| EVID-TEST-003 | `specs/p0-extra-inclusion/implementation-report.md` fresh supported-runtime local `npm run test` pass | TASK-P0X-009, TASK-P0X-012 | Passed under Node 20 | Resolved |
| EVID-VERIFY-001 | `specs/p0-extra-inclusion/implementation-report.md` historical supported-runtime local `npm run verify` pass | TASK-P0X-009, TASK-P0X-012 | Historical local pass | Superseded but preserved |
| EVID-VERIFY-002 | `specs/p0-extra-closure-followup/implementation-report.md` supported-runtime local `npm run verify` pass | TASK-P0X-009, TASK-P0X-012 | Passed under Node 20 | Superseded but preserved |
| EVID-VERIFY-004 | `specs/p0-extra-inclusion/implementation-report.md` fresh supported-runtime local `npm run verify` fail | TASK-P0X-009, TASK-P0X-012 | Failed when child `test` failed; proves fail-fast propagation | Superseded but preserved |
| EVID-VERIFY-005 | `specs/p0-extra-inclusion/implementation-report.md` fresh supported-runtime local `npm run verify` pass | TASK-P0X-009, TASK-P0X-012 | Passed under Node 20 after rerun | Resolved |
| EVID-RUNTIME-001 | `inventory-api/package.json`, `inventory-api/README.md`, `inventory-api/Dockerfile`, `.github/workflows/p0-quality-gates.yml` | TASK-P0X-003, TASK-P0X-007, TASK-P0X-012 | Node 20 contract aligned | Resolved for TASK-P0X-003 and TASK-P0X-007; remains relevant to final closure assessment |

## 5. Parent-P0 linkage
The parent specification `specs/p0-project-stabilization/` must continue to reference this extension as:
- the reason the parent package was not yet fully closed;
- the location of quality-gate, CI, runtime and replay evidence;
- the source of unresolved failed or inconclusive closure conditions.

## 6. Resolution rules
No audited finding may disappear without one of these outcomes:
- Resolved
- Accepted exception
- Failed
- Inconclusive
- Blocked
- Deferred with explicit approval
- False positive with evidence
