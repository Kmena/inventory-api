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

## 3. Evidence hierarchy
### Primary evidence
The repository treats the following as primary closeout evidence:
- real CI Windows executions of `.github/workflows/windows-prisma-build.yml`;
- stable and repeatable success of the guarded `npm run build` step in that workflow;
- workflow/log evidence and this operational document kept in sync.

### Complementary evidence
The repository allows the following as complementary evidence only:
- local developer runs of `npm run build`;
- local wrapper diagnostics and retry classification output;
- ad-hoc troubleshooting notes or one-off reruns outside the official CI Windows baseline.

Complementary evidence is useful for diagnosis and remediation planning, but complementary local developer runs do not on their own overturn a CI-based closeout verdict.

## 4. Workflow under governance
- Executable workflow: `.github/workflows/windows-prisma-build.yml`
- Hosted workflow source of truth: repository-root `/.github/workflows/`
- Local validator/test resolution: root official workflow tree only
- Guarded build command: `npm run build`
- Node version: `24`
- Runner: `windows-latest`

## 5. Failure classification taxonomy
When the guarded build fails, the repository uses the following diagnostic states:

- `windows_rename_lock`
- `non_retryable_failure`
- `runner/environment issue`

The wrapper remains responsible for explicit retryable vs non-retryable Prisma classification. The workflow closeout layer is responsible for preserving the real build exit code while publishing auditable evidence.

## 5.1 Local wrapper contract under governance
The current local wrapper baseline is intentionally bounded:
- `inventory-api/scripts/prisma-generate-safe.js` remains the only supported Prisma generate wrapper for `npm run build` and `npm run prisma:generate`;
- stale `query_engine-windows.dll.node.tmp*` files are removed before the initial generate attempt and after a successful generate;
- retryable `windows_rename_lock` handling is limited to **up to 2 bounded retries**;
- the current bounded retry delays are `750ms` and `1500ms`;
- if the bounded retries do not recover the build, the wrapper must still preserve the real failure exit and emit actionable local guidance.
- each guarded local run may persist a minimal diagnostics report at `logs/prisma-generate-last-run.json` so developers can inspect the latest local classification, attempt count, retry delays, and temp-file evidence without re-parsing the console manually.

## 5.2 Diagnostic gaps still open
Even with the bounded wrapper and the hosted workflow evidence, the repository still treats the following Windows/Prisma gaps as active residual diagnostic debt:
- the wrapper can classify `windows_rename_lock`, but it does not identify which local process is actually holding the Prisma engine file lock;
- the wrapper now persists a minimal local diagnostics report, but it still does not capture richer process-attribution evidence beyond the latest structured run summary and emitted console/log output;
- the hosted Windows workflow proves the guarded CI lane is stable, but it does not prove that every developer-local Windows environment is equally stable under antivirus, shell, or background-process variation;
- a local `windows_rename_lock` failure therefore remains a governed residual operating risk until a later slice either isolates the root cause further or reduces recurrence with stronger reproducible evidence.

## 6. Real CI evidence gathered

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

## 7. Current conclusion
### Verdict
**`estabilizado con evidencia CI`**

### Baseline interpretation during local remediation
A local Windows `npm run build` failure classified as `windows_rename_lock` remains important diagnostic input for remediation work and must be recorded in implementation reports when it occurs. A local success after stale-temp cleanup or bounded retries is also useful diagnostic evidence. However, by policy both remain complementary evidence only and do not on their own overturn a CI-based closeout verdict unless the same closeout cycle also records new primary CI Windows failure evidence.

### Dual-status interpretation now in force
The repository now treats Windows/Prisma stability as two related but distinct status lines:
- **Hosted closeout status:** `estabilizado con evidencia CI` when the approved workflow criterion remains satisfied.
- **Local Windows operating status:** `residual gobernado` whenever developer-local runs can still reproduce `windows_rename_lock`, even if CI remains green.

This dual-status interpretation is intentional. It prevents the repository from overstating universal Windows stability while still preserving the value of the hosted CI closeout evidence.

### Why the criterion is now considered satisfied
The repository now has:

1. more than **3 real successful Windows workflow executions**;
2. remote validation of the **hardened workflow version** on commit `f1ab9a26842a36e98aa4f042128d88c484e37a28`;
3. a **documented rerun** (`run_attempt=2`) for run `30043427099` that completed successfully;
4. a newer root-official success run (`30281935398`) that confirms the executable hosted workflow is now on Node 24;
5. no documented new failure classified as `windows_rename_lock` during this closeout cycle.

Based on the approved criterion, the current evidence is sufficient to classify the risk as **`estabilizado con evidencia CI`**.

## 8. Evidence validated in the hardened workflow version
The hardened workflow has now been remotely validated as publishing or supporting:
- workflow summary contract;
- build log artifact publication;
- explicit final failure gate preserving the real build exit code.

## 9. How to preserve the closeout safely
1. Keep `.github/workflows/windows-prisma-build.yml` as the executable source of truth.
2. Preserve `npm run validate:workflow-baseline` and the workflow characterization tests, which validate 9 root official workflows including `p0-quality-gates.yml`.
3. If a future run produces `windows_rename_lock`, reassess whether the verdict should fall back to `residual gobernado` for that cycle.

## 10. Related repository files
- `.github/workflows/windows-prisma-build.yml`
- `inventory-api/scripts/prisma-generate-safe.js`
- `inventory-api/scripts/prisma-generate-safe-lib.js`
- `inventory-api/scripts/validate-workflow-baseline.js`
- `inventory-api/tests/prisma-windows-build-stabilization.test.js`
- `inventory-api/tests/workflow-baseline-characterization.test.js`

## 11. Historical spec linkage
- `specs/p8-prisma-windows-build-stabilization/implementation-report.md`
- `specs/p9-windows-prisma-build-evidence/implementation-report.md`
- `specs/p9-prisma-windows-closeout/implementation-report.md`
