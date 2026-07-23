# Historical Root-Spec Drift Inventory

## Source batch
- Baseline: `specs/p7-drift-fix/drift-inventory.md`
- Batch: `BATCH-HISTORICAL-ROOT-SPECS`

## Files reviewed
| File | Diff reviewed | Initial result |
|---|---|---|
| `specs/p0-extra-inclusion/changelog.md` | Yes | recoverable provenance |
| `specs/p0-extra-inclusion/implementation-report.md` | Yes | recoverable provenance |
| `specs/p0-extra-inclusion/tasks.md` | Yes | recoverable provenance |
| `specs/p0-extra-inclusion/traceability.md` | Yes | recoverable provenance |
| `specs/p0-project-stabilization/changelog.md` | Yes | recoverable provenance |
| `specs/p0-project-stabilization/closure-report.md` | Yes | recoverable provenance |
| `specs/p0-project-stabilization/current-state.md` | Yes | recoverable provenance |
| `specs/p0-project-stabilization/implementation-report.md` | Yes | recoverable provenance |
| `specs/p0-project-stabilization/metadata.yaml` | Yes | recoverable provenance |
| `specs/p0-project-stabilization/traceability.md` | Yes | recoverable provenance |
| `specs/p7-9-5-risk-closure/current-state.md` | Yes | recoverable provenance |
| `specs/p7-9-5-risk-closure/implementation-report.md` | Yes | recoverable provenance |

## Diff summary by group
### Group A — `specs/p0-extra-inclusion/*`
The diffs align with approved and traceable closure follow-up evidence already present in the repository:
- operational execution extraction into `specs/p0-extra-closure-followup/`;
- preserved failed GitHub Actions evidence (`29287056129`, `29288885694`);
- successful GitHub Actions evidence (`29383737072`, job `87252601412`);
- replay-resolution back-propagation from `specs/p0-replay-blocker-fix/`.

### Group B — `specs/p0-project-stabilization/*`
The diffs align with parent-package back-propagation from approved child/follow-up packages:
- closure report now references `specs/p0-extra-closure-followup/` and `specs/p0-replay-blocker-fix/`;
- parent current-state / implementation-report / traceability were updated to reflect successful CI and successful replay evidence while preserving historical failures;
- metadata closure markers were advanced in line with the approved follow-up evidence chain.

### Group C — `specs/p7-9-5-risk-closure/*`
The diffs align with current repository reality and the approved P7 evidence set:
- `inventory-api/docs/runtime-endpoint-catalog.md` is present in the visible workspace and is already referenced across the implemented P7 package;
- the earlier historical note that the file was missing is obsolete and was corrected in `current-state.md` and `implementation-report.md`.

## Inventory conclusion
All currently listed files in `BATCH-HISTORICAL-ROOT-SPECS` were reviewed.
No additional historical root-spec file outside the batch list appeared in the inspected `git diff --name-only` result for this batch scope.

No file in this batch currently requires default revert based on the reviewed evidence.
