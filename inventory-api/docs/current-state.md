# Current State

## 1. System overview
This repository contains a Node.js 20 + Express + Prisma modular monolith in `inventory-api/`, plus repository-governance assets at the repo root.

The runtime still serves:
- JSON APIs
- embedded browser screens from `src/public/`
- Prisma-backed persistence through `src/repositories/`

In the completed `p9-prisma-windows-closeout` cycle, the implemented change was not a production-domain redesign. It was a repository-governance hardening increment focused on Windows Prisma build evidence and documentation.

Current verified scope for this cycle:
- the root GitHub Actions workflow `.github/workflows/windows-prisma-build.yml` now captures the Windows build log, publishes a workflow summary, uploads an artifact, and fails explicitly when `npm run build` really fails
- the same contractual workflow shape is mirrored in `inventory-api/.github/workflows/windows-prisma-build.yml` as an internal baseline/reference copy
- workflow governance is validated by `scripts/validate-workflow-baseline.js`
- regression protection exists in `tests/workflow-baseline-characterization.test.js` and `tests/prisma-windows-build-stabilization.test.js`
- repository evidence is consolidated in `docs/prisma-windows-stability-evidence.md`

The current closeout verdict is **`estabilizado con evidencia CI`** based on multiple successful real Windows runs of the hardened workflow version, including a documented rerun success.

## 2. Repository structure
Key paths inspected for this refresh:
- `.github/workflows/windows-prisma-build.yml` — executable Windows Prisma build workflow at repository root
- `inventory-api/.github/workflows/windows-prisma-build.yml` — mirrored baseline/reference workflow inside the app folder
- `inventory-api/scripts/prisma-generate-safe.js` — guarded Prisma generate wrapper used by `npm run build`
- `inventory-api/scripts/prisma-generate-safe-lib.js` — wrapper classification logic and retry helpers
- `inventory-api/scripts/validate-workflow-baseline.js` — workflow baseline contract validator
- `inventory-api/tests/workflow-baseline-characterization.test.js` — characterization tests for workflow contracts
- `inventory-api/tests/prisma-windows-build-stabilization.test.js` — governance tests for Windows Prisma workflow and wrapper classification
- `inventory-api/docs/prisma-windows-stability-evidence.md` — source of truth for closeout evidence and verdict
- `inventory-api/README.md` — links the evidence document as the primary reference
- `inventory-api/package.json` — exposes `build`, `validate:workflow-baseline`, `test`, and `verify`

Relevant package scripts currently implemented:
- `npm run build` → `node scripts/prisma-generate-safe.js`
- `npm run validate:workflow-baseline` → validates versioned GitHub workflow contracts
- `npm run verify` → aggregates lint, typecheck, public-runtime checks, workflow baseline validation, operational readiness, build, and test

## 3. Current architecture
The application runtime remains a layered modular monolith:
- routes call services
- services coordinate business and persistence behavior
- repositories use Prisma directly
- static browser assets are served by the same Express process

In addition, the repository now has a clearer **Platform Runtime Governance** slice for build/CI stabilization:
- `npm run build` is intentionally a guarded Prisma-generation contract
- the root Windows workflow is the executable CI adapter for Windows Prisma evidence
- the mirrored workflow under `inventory-api/.github/workflows/` acts as a versioned baseline/reference contract for the subproject
- workflow governance is enforced by a local validation script and characterization tests
- evidence and verdict are centralized in a versioned Markdown document rather than scattered across historical specs

This cycle changed governance architecture and documentation, not the production runtime architecture.

## 4. Existing domains and modules
Observed modules relevant to this refresh:

### Platform Runtime Governance
Current code location:
- `.github/workflows/windows-prisma-build.yml`
- `inventory-api/.github/workflows/windows-prisma-build.yml`
- `scripts/validate-workflow-baseline.js`
- `tests/workflow-baseline-characterization.test.js`
- `tests/prisma-windows-build-stabilization.test.js`
- `docs/prisma-windows-stability-evidence.md`

Responsibility:
- preserve the contractual shape of workflow baselines
- validate the dedicated Windows Prisma workflow locally
- keep Windows build evidence auditable
- classify workflow failures without masking real build errors
- document whether the risk remains residual or is stabilized with CI evidence

### Build and Prisma Bootstrap
Current code location:
- `scripts/prisma-generate-safe.js`
- `scripts/prisma-generate-safe-lib.js`
- `package.json`

Responsibility:
- generate Prisma Client through the guarded wrapper
- classify retryable Windows rename-lock failures versus non-retryable failures
- preserve explicit failure semantics for real build problems

### Core application runtime
Still present and unchanged in architectural role for this cycle:
- Identity and Access
- Company Administration
- Customer Management
- Product Catalog
- Inventory
- Sales Routing / Agent Workspace
- Orders
- Billing and Collections
- Embedded Browser Runtime

## 5. Main use cases
Repository-governance use cases observable from code and docs:
- execute `npm run build` through the guarded Prisma wrapper
- run a dedicated Windows GitHub Actions build on `windows-latest`
- capture a build log file for the Windows run
- classify failures as `windows_rename_lock`, `non_retryable_failure`, or `runner/environment issue`
- publish a structured workflow summary with run metadata
- upload a build-log artifact for auditability
- fail the workflow explicitly when the guarded build exits non-zero
- validate the workflow baseline locally with `npm run validate:workflow-baseline`
- preserve governance contracts with characterization tests
- consolidate real CI evidence and the repository verdict in `docs/prisma-windows-stability-evidence.md`

## 6. Current data flows

### Guarded Prisma build flow
1. `npm run build` executes `node scripts/prisma-generate-safe.js`
2. the wrapper delegates to Prisma generate behavior
3. failure signals are classified using shared library logic from `scripts/prisma-generate-safe-lib.js`
4. retryable Windows rename-lock behavior remains distinguished from non-retryable Prisma failures
5. the command preserves the real exit outcome for callers

### Windows workflow evidence flow
1. GitHub Actions runs `.github/workflows/windows-prisma-build.yml` on `windows-latest`
2. the workflow installs dependencies with `npm ci`
3. the guarded build step runs with `continue-on-error: true` only to allow evidence capture before the explicit failure gate
4. stdout/stderr are tee'd into `npm-run-build.log`
5. the workflow stores `build_exit_code` and `build_log_path` in step outputs
6. a follow-up step classifies the result as `success`, `windows_rename_lock`, `non_retryable_failure`, or `runner/environment issue`
7. the workflow publishes a structured summary to `GITHUB_STEP_SUMMARY`
8. the workflow uploads `windows-prisma-build-log-<run_id>` as an artifact
9. the final failure gate exits non-zero if the guarded build actually failed

### Evidence closeout flow
1. real CI runs are recorded in `docs/prisma-windows-stability-evidence.md`
2. the evidence document compares actual runs against the approved closeout criterion
3. the repository verdict is currently `estabilizado con evidencia CI` because the documented criterion is now met
4. README links the evidence document as the repository source of truth

## 7. Database and persistence
Persistence remains Prisma + PostgreSQL.

Scope-relevant observations for this cycle:
- no Prisma schema change was made in this documentation refresh
- no database migration change was made in this cycle summary
- the affected `build` contract is about Prisma Client generation and CI evidence, not schema redesign

## 8. APIs and integrations
No application API contract changed in this cycle.

Repository-governance integrations relevant here:
- GitHub Actions is the remote execution surface for the dedicated Windows Prisma workflow
- local repository validation uses Node-based scripts and `node --test`
- evidence currently depends on versioned Markdown plus previously captured GitHub Actions run metadata

## 9. Authentication and authorization
No application auth/authorization contract changed in this cycle.

Repository-level observation:
- initial implementation from this environment could not trigger GitHub Actions directly because `gh` was unavailable and `GITHUB_TOKEN` was absent
- final closeout evidence was nevertheless obtained through successful remote GitHub Actions executions after push, including a documented rerun

## 10. Events and background processing
No event bus or background-processing architecture changed in this cycle.

The dedicated Windows workflow is CI orchestration, not an in-application event mechanism.

## 11. Containers and deployment
Container/runtime deployment architecture was not changed by this cycle.

Relevant operational governance additions remain in GitHub Actions rather than Docker:
- Windows Prisma build evidence workflow at repo root
- mirrored workflow baseline under `inventory-api/.github/workflows/`

## 12. Current testing strategy
The repository has an active automated baseline using Node tests plus validation scripts.

Cycle-relevant tests and validations:
- `npm run validate:workflow-baseline` ✅ user-reported passed
- `node --test tests/workflow-baseline-characterization.test.js` ✅ user-reported passed
- `node --test tests/prisma-windows-build-stabilization.test.js` ✅ user-reported passed

Additional governance coverage visible in the repository:
- `npm run build` uses the guarded Prisma wrapper
- `npm run verify` includes `validate:workflow-baseline`

This document records those results as user-supplied implementation evidence. They were not re-executed during this documentation refresh.

## 13. Behavior to preserve
- `npm run build` must continue using the guarded Prisma wrapper
- the root workflow `.github/workflows/windows-prisma-build.yml` must remain the executable Windows evidence workflow
- the mirrored workflow under `inventory-api/.github/workflows/windows-prisma-build.yml` must remain contract-aligned with the root workflow shape
- workflow summary publication must remain in place
- build-log artifact upload must remain in place
- the explicit failure gate must continue preserving real build failure semantics
- workflow failure classification taxonomy must remain documented and test-governed
- `docs/prisma-windows-stability-evidence.md` must remain the primary repository source of truth for closeout evidence

## 14. Known defects
- the Prisma/Windows closeout criterion is now satisfied and documented in `docs/prisma-windows-stability-evidence.md`
- the remaining issues in this area are maintainability-oriented rather than an open closeout gap:
  - workflow duplication between root executable workflow and app-local mirror
  - future dependency on keeping evidence docs synchronized with CI reality

## 15. Architectural debt
- workflow evidence depends on both a root executable workflow and a mirrored app-local baseline file, which introduces duplication that must stay synchronized
- the governance path still includes manual evidence capture and documentation synchronization after real remote runs
- future Windows/Prisma or runner changes could still require renewed evidence collection, even though the present closeout state is stabilized

## 16. Security risks
- No new application security defect was identified in this refresh scope
- The hardened workflow reduces false-success risk by preserving the real build exit code
- Residual risk is operational and audit/governance-oriented rather than a newly confirmed application security vulnerability

## 17. Unknowns and assumptions
- This refresh records the successful remote runs and rerun as the closeout evidence baseline for the hardened workflow version
- The evidence document remains the source of truth and must be updated if future Windows behavior changes materially
- The repository still treats workflow summary, artifact publication and explicit failure-gate behavior as compatibility-sensitive governance contracts
