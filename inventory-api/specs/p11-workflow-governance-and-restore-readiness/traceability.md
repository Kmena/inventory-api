# Traceability

## Source traceability
| Source | Evidence/problem | This spec treatment | Planned task |
|---|---|---|---|
| `specs/p11-node24-runtime-migration/implementation-report.md` | Remaining risk: duplicated workflow trees | root-only governance convergence | TASK-001 |
| `docs/tasks.md` TASK-006 | duplicated workflow governance remained proposed follow-up | canonicalized into approved executable tasks here | TASK-001 |
| `/.github/workflows/operational-smoke.yml` | invokes `npm run validate:restore-readiness` | preserve gate but repair command contract | TASK-002 |
| hosted run reported by user | `Missing script: "validate:restore-readiness"` | expose npm script and align docs/tests | TASK-002 |
| `docs/production-operations-runbook.md` | references `docs/restore-readiness-baseline.md` and restore command | harmonize public contract | TASK-002 |
| `scripts/validate-restore-readiness.js` and tests | currently expect optional `internal-docs/` artifacts | reconcile validator/test contract to approved baseline | TASK-002 |

## Requirements to implementation matrix
| Requirement | Expected files | Expected tests/evidence | Planned status |
|---|---|---|---|
| FR-001 | `/.github/workflows/*`, docs/specs | source review + workflow baseline validation | Completed by TASK-001 |
| FR-002 | `inventory-api/.github/workflows/*`, scripts/tests/docs | repo structure review | Completed by TASK-001 |
| FR-003 | `scripts/validate-workflow-baseline.js`, workflow tests | `npm run validate:workflow-baseline` | Completed by TASK-001 |
| FR-004 | docs/specs + repo tree | diff review | Completed by TASK-001 |
| FR-005 | `package.json`, `operational-smoke.yml` | hosted/local smoke validation | Implemented locally; hosted review pending |
| FR-006 | `package.json`, `scripts/validate-restore-readiness.js` | `npm run validate:restore-readiness` | Completed locally |
| FR-007 | decisions/report docs | explicit decision review | Completed locally |
| FR-008 | docs/tests/validator | characterization tests + docs review | Completed locally |
| FR-009 | `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `docs/tasks.md` | documentation review | Implemented; final closure tied to hosted review |
| FR-010 | no business/API files expected | regression review | Completed |
| FR-011 | windows/workflow tests | existing workflow characterization remains green | Completed by TASK-001/TASK-002 |
| FR-012 | spec docs cross-reference | traceability review | Completed by TASK-003 |

## Validation matrix target
| Surface | Expected outcome |
|---|---|
| Workflow governance | Root-only source of truth, no active duplicate tree ✅ after TASK-001 |
| Workflow baseline validator | Passes against root official workflows only |
| Operational smoke | No missing npm script; restore readiness step remains valid ✅ |
| Restore readiness npm command | Exposed and executable ✅ |
| Public operational docs | Match the actual validated artifact set ✅ |
| Hosted evidence | Local contract repaired; next hosted run should no longer fail for the prior missing-script defect, but rerun evidence is still pending |
