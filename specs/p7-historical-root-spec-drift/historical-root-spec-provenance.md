# Historical Root-Spec Provenance Recovery

## Decision method
Per approved policy, each file was evaluated only against repository-visible evidence:
- `git diff` output for the exact file set;
- related spec documents already present under `specs/p0-extra-inclusion/`, `specs/p0-extra-closure-followup/`, `specs/p0-replay-blocker-fix/`, and `specs/p7-9-5-risk-closure/`;
- explicit references in current changelog, tasks, traceability and implementation-report files.

## File-level classification
| File | Recoverable? | Evidence | Final action |
|---|---|---|---|
| `specs/p0-extra-inclusion/changelog.md` | Yes | mentions `p0-extra-closure-followup`, CI runs `29288885694` and `29383737072`, and `p0-replay-blocker-fix` | Keep |
| `specs/p0-extra-inclusion/implementation-report.md` | Yes | records follow-up execution package and replay-fix evidence chain | Keep |
| `specs/p0-extra-inclusion/tasks.md` | Yes | explicitly references `p0-extra-closure-followup` artifacts and extracted operational execution | Keep |
| `specs/p0-extra-inclusion/traceability.md` | Yes | traceability table links replay/CI evidence IDs to follow-up and replay-fix packages | Keep |
| `specs/p0-project-stabilization/changelog.md` | Yes | changelog explicitly back-propagates `p0-replay-blocker-fix` and successful CI run `29383737072` | Keep |
| `specs/p0-project-stabilization/closure-report.md` | Yes | closure report identifies follow-up execution package and preserved/green CI evidence | Keep |
| `specs/p0-project-stabilization/current-state.md` | Yes | current state explicitly references follow-up operational package and replay-fix outcome | Keep |
| `specs/p0-project-stabilization/implementation-report.md` | Yes | addendum documents the same follow-up evidence chain | Keep |
| `specs/p0-project-stabilization/metadata.yaml` | Yes | closure markers are supported by the documented successful follow-up evidence chain | Keep |
| `specs/p0-project-stabilization/traceability.md` | Yes | table entries align with preserved failed evidence + successful replay/CI evidence | Keep |
| `specs/p7-9-5-risk-closure/current-state.md` | Yes | repository-visible file `inventory-api/docs/runtime-endpoint-catalog.md` exists and is referenced across the approved P7 package | Keep |
| `specs/p7-9-5-risk-closure/implementation-report.md` | Yes | report correction matches current workspace visibility and approved P7 evidence roles | Keep |

## Non-recoverable files
None in the currently reviewed batch.

## Provenance conclusion
The batch was historically classified as ambiguous, but current repository-visible evidence is sufficient to recover exact documentary provenance for every file in scope.

Therefore:
- no file in this batch should be reverted by default;
- the batch should be regularized as a documented historical-drift resolution;
- `p7-drift-fix` should be updated so `BATCH-HISTORICAL-ROOT-SPECS` is no longer treated as unresolved ambiguous drift.
