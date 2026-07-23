# Prisma Windows Stability Evidence

## 1. Purpose
This document is the repository source of truth for the Prisma/Windows build-stability closeout.

It consolidates:
- the approved closeout criterion;
- the real GitHub Actions evidence gathered so far;
- the current repository conclusion;
- the diagnostic classification used when failures happen.

## 2. Closeout criterion
The approved closeout criterion for this repository is:

- **`estabilizado con evidencia CI`** only when there are at least **3 distinct successful real runs** of `.github/workflows/windows-prisma-build.yml`, including at least **1 documented `workflow_dispatch` run or rerun**;
- **`residual gobernado`** in any other case, even if multiple successful push/pull_request runs already exist.

A new failure classified as `windows_rename_lock` during the same closeout cycle prevents claiming `estabilizado con evidencia CI` for that cycle.

## 3. Workflow under governance
- Executable workflow: `.github/workflows/windows-prisma-build.yml`
- Reference/baseline mirror: `inventory-api/.github/workflows/windows-prisma-build.yml`
- Guarded build command: `npm run build`
- Node version: `20`
- Runner: `windows-latest`

## 4. Failure classification taxonomy
When the guarded build fails, the repository uses the following diagnostic states:

- `windows_rename_lock`
- `non_retryable_failure`
- `runner/environment issue`

The wrapper remains responsible for explicit retryable vs non-retryable Prisma classification. The workflow closeout layer is responsible for preserving the real build exit code while publishing auditable evidence.

## 5. Real CI evidence gathered

| Run ID | Job ID | Event | Branch | Commit SHA | Created at (UTC) | Result | Notes |
|---|---|---|---|---|---|---|---|
| `30036436367` | Not captured in prior spec package | `push` | `login-guidelines-alignment` | `6c35570a7e1b8371fd74e36527d9fb17e22c212b` | `2026-07-23T19:04:05Z` | `success` | Additional real Windows success identified during closeout review |
| `30036439578` | `89305462913` | `pull_request` | `login-guidelines-alignment` | `6c35570a7e1b8371fd74e36527d9fb17e22c212b` | `2026-07-23T19:04:07Z` | `success` | Historical baseline run already documented in `specs/p9-windows-prisma-build-evidence/implementation-report.md` |
| `30037594527` | Not captured during this local implementation cycle | `push` | `login-guidelines-alignment` | `90c4797cfde49cdb0f95818c78d3e21e8e7a66d7` | `2026-07-23T19:21:05Z` | `success` | Additional real Windows success identified through GitHub Actions API |
| `30037598602` | `89309366617` | `pull_request` | `login-guidelines-alignment` | `90c4797cfde49cdb0f95818c78d3e21e8e7a66d7` | `2026-07-23T19:21:09Z` | `success` | Additional real Windows success identified through GitHub Actions API |

## 6. Current conclusion
### Verdict
**`residual gobernado`**

### Why it is not yet `estabilizado con evidencia CI`
Although the repository now has **4 real successful Windows runs**, the approved criterion is still **not fully met** because:

1. the documented evidence set does **not yet include a `workflow_dispatch` run or rerun**;
2. this local implementation environment cannot trigger or authenticate a new GitHub Actions run (`gh` unavailable, `GITHUB_TOKEN` absent);
3. the newly hardened workflow version with summary + build-log artifact has been updated in git, but its remote execution evidence must be captured after push.

## 7. Evidence expected after the next remote execution
The hardened workflow should publish, per run:
- workflow summary including workflow path, event, run ID, run attempt, branch, commit SHA, runner OS, node version, build exit code and failure classification;
- artifact `windows-prisma-build-log-<run_id>`;
- real workflow failure if `npm run build` fails.

## 8. How to finish the closeout safely
1. Push the updated workflow files.
2. Trigger or rerun `.github/workflows/windows-prisma-build.yml`.
3. Capture:
   - run ID
   - run attempt
   - event (`workflow_dispatch` or rerun preferred)
   - job ID
   - branch
   - commit SHA
   - timestamps
   - result
   - summary/artifact presence
4. Reassess the verdict:
   - if the documented `workflow_dispatch`/rerun succeeds and no new `windows_rename_lock` appears, the repository can be reconsidered for `estabilizado con evidencia CI`;
   - otherwise, keep `residual gobernado`.

## 9. Related repository files
- `.github/workflows/windows-prisma-build.yml`
- `inventory-api/.github/workflows/windows-prisma-build.yml`
- `inventory-api/scripts/prisma-generate-safe.js`
- `inventory-api/scripts/prisma-generate-safe-lib.js`
- `inventory-api/scripts/validate-workflow-baseline.js`
- `inventory-api/tests/prisma-windows-build-stabilization.test.js`
- `inventory-api/tests/workflow-baseline-characterization.test.js`

## 10. Historical spec linkage
- `specs/p8-prisma-windows-build-stabilization/implementation-report.md`
- `specs/p9-windows-prisma-build-evidence/implementation-report.md`
- `specs/p9-prisma-windows-closeout/implementation-report.md`
