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
- Hosted workflow source of truth: repository-root `/.github/workflows/`
- Reference/baseline mirror: `inventory-api/.github/workflows/windows-prisma-build.yml`
- Local validator/test resolution: root official workflow tree first, with fallback to the application-local mirror only when the root hosted layout is unavailable
- Guarded build command: `npm run build`
- Node version: `24`
- Runner: `windows-latest`

## 4. Failure classification taxonomy
When the guarded build fails, the repository uses the following diagnostic states:

- `windows_rename_lock`
- `non_retryable_failure`
- `runner/environment issue`

The wrapper remains responsible for explicit retryable vs non-retryable Prisma classification. The workflow closeout layer is responsible for preserving the real build exit code while publishing auditable evidence.

## 5. Real CI evidence gathered

| Run ID | Job ID | Event | Run attempt | Branch | Commit SHA | Created at (UTC) | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| `30036436367` | Not captured in prior spec package | `push` | `1` | `login-guidelines-alignment` | `6c35570a7e1b8371fd74e36527d9fb17e22c212b` | `2026-07-23T19:04:05Z` | `success` | Historical real Windows success identified during closeout review |
| `30036439578` | `89305462913` | `pull_request` | `1` | `login-guidelines-alignment` | `6c35570a7e1b8371fd74e36527d9fb17e22c212b` | `2026-07-23T19:04:07Z` | `success` | Historical baseline run already documented in `specs/p9-windows-prisma-build-evidence/implementation-report.md` |
| `30037594527` | Not captured during this local implementation cycle | `push` | `1` | `login-guidelines-alignment` | `90c4797cfde49cdb0f95818c78d3e21e8e7a66d7` | `2026-07-23T19:21:05Z` | `success` | Historical real Windows success identified through GitHub Actions API |
| `30037598602` | `89309366617` | `pull_request` | `1` | `login-guidelines-alignment` | `90c4797cfde49cdb0f95818c78d3e21e8e7a66d7` | `2026-07-23T19:21:09Z` | `success` | Historical real Windows success identified through GitHub Actions API |
| `30043423266` | `89328614862` | `push` | `1` | `login-guidelines-alignment` | `f1ab9a26842a36e98aa4f042128d88c484e37a28` | `2026-07-23T20:45:22Z` | `success` | Hardened workflow version validated remotely after push |
| `30043427099` | `89328625061` | `pull_request` | `1` | `login-guidelines-alignment` | `f1ab9a26842a36e98aa4f042128d88c484e37a28` | `2026-07-23T20:45:24Z` | `success` | Hardened workflow version validated remotely on PR execution |
| `30043427099` | `89330039291` | `pull_request` | `2` | `login-guidelines-alignment` | `f1ab9a26842a36e98aa4f042128d88c484e37a28` | `2026-07-23T20:45:24Z` | `success` | Documented rerun of the hardened workflow with 1 artifact published |
| `30281935398` | `90030223669` | `push` | `1` | `34-p11-extrenal-audit-fix` | `24106ee8fae3e5a21197e3a6494261e08e0ee8d7` | `2026-07-27T15:50:57Z` | `success` | Root-official workflow aligned to Node 24; Jobs API confirms `Set up Node.js 24` and artifact `windows-prisma-build-log-30281935398` |

## 6. Current conclusion
### Verdict
**`estabilizado con evidencia CI`**

### Why the criterion is now considered satisfied
The repository now has:

1. more than **3 real successful Windows workflow executions**;
2. remote validation of the **hardened workflow version** on commit `f1ab9a26842a36e98aa4f042128d88c484e37a28`;
3. a **documented rerun** (`run_attempt=2`) for run `30043427099` that completed successfully;
4. a newer root-official success run (`30281935398`) that confirms the executable hosted workflow is now on Node 24;
5. no documented new failure classified as `windows_rename_lock` during this closeout cycle.

Based on the approved criterion, the current evidence is sufficient to classify the risk as **`estabilizado con evidencia CI`**.

## 7. Evidence validated in the hardened workflow version
The hardened workflow has now been remotely validated as publishing or supporting:
- workflow summary contract;
- build log artifact publication;
- explicit final failure gate preserving the real build exit code.

## 8. How to preserve the closeout safely
1. Keep `.github/workflows/windows-prisma-build.yml` as the executable source of truth.
2. Keep `inventory-api/.github/workflows/windows-prisma-build.yml` aligned as the baseline mirror while the duplicated workflow-tree model remains in place.
3. Preserve `npm run validate:workflow-baseline` and the workflow characterization tests, which now resolve the root official workflow tree first and validate 9 workflows including `p0-quality-gates.yml` when the root hosted layout is present.
4. If a future run produces `windows_rename_lock`, reassess whether the verdict should fall back to `residual gobernado` for that cycle.

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
