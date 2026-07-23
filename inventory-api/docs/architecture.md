# Architecture

## 1. Architectural goals
### Proposed
- keep the repository as a single deployable modular monolith
- avoid redesigning production runtime architecture for a CI/governance-only closeout cycle
- make repository-level Windows Prisma governance explicit, auditable, and test-protected
- preserve the real failure semantics of `npm run build` while improving evidence capture
- centralize closeout evidence in versioned repository documentation

## 2. Current architecture summary
The production runtime remains an Express + Prisma layered modular monolith.

The architecture added or clarified in this cycle is repository-governance architecture around Windows Prisma stabilization:
- `npm run build` is the guarded Prisma-generation contract
- `.github/workflows/windows-prisma-build.yml` is the executable Windows CI adapter
- `inventory-api/.github/workflows/windows-prisma-build.yml` is a mirrored contractual baseline/reference
- `scripts/validate-workflow-baseline.js` is the local governance validator for workflow contracts
- `tests/workflow-baseline-characterization.test.js` and `tests/prisma-windows-build-stabilization.test.js` preserve the contract through regression coverage
- `docs/prisma-windows-stability-evidence.md` is the primary repository evidence source

## 3. Architectural problems
- historical Prisma/Windows closure evidence was fragmented across specs, workflow files, and prior reports
- a successful Windows run could be documented without a sufficiently explicit repository criterion for declaring stabilization
- workflow evidence needed summary/artifact output without converting real build failures into false success
- the final approved stabilization criterion still depends on at least one documented `workflow_dispatch` or rerun, which is not yet present in the repository evidence set
- governance now exists in both the root workflow and the mirrored app-local workflow baseline, so drift remains a maintainability concern

## 4. Target architecture proposal
### Proposed
For this scope, the target is **not** a new production architecture. The target is a clearer repository-governance architecture for Windows Prisma evidence.

Target governance shape:
- **Build contract layer**
  - `npm run build`
  - guarded Prisma wrapper preserving retryable/non-retryable classification and real exit status
- **CI adapter layer**
  - root Windows workflow runs the guarded build on `windows-latest`
  - captures log output, publishes summary, uploads artifact, and fails explicitly on real errors
- **Governance verification layer**
  - local workflow-baseline validator
  - characterization tests for workflow contract and wrapper behavior
- **Evidence layer**
  - single versioned Markdown source of truth for closeout criterion, historical runs, verdict, and remaining gap

## 5. Domain map
### Proposed
| Domain | Classification | Responsibility |
|---|---|---|
| Platform Runtime Governance | Supporting | repository build contracts, CI workflow baselines, evidence closure and validation |
| Build & Prisma Bootstrap | Supporting | guarded Prisma generation, retry/failure classification, build exit semantics |
| Evidence and Documentation Governance | Supporting | versioned closeout criterion, evidence consolidation, residual-risk verdict |
| Core Application Runtime | Core | business APIs, persistence and embedded browser runtime; unchanged by this cycle |

## 6. Bounded contexts
### Proposed
Relevant bounded contexts for this refresh:
- `PlatformRuntimeGovernance`
- `BuildPrismaBootstrap`
- `EvidenceDocumentationGovernance`

Boundary notes:
- `BuildPrismaBootstrap` owns wrapper behavior and classification semantics for local/CI build execution
- `PlatformRuntimeGovernance` owns executable workflow shape, baseline validation, and test-governed workflow contracts
- `EvidenceDocumentationGovernance` owns the closeout criterion and the final repository verdict
- the production application contexts remain outside the implementation scope of this cycle

## 7. Ubiquitous language
### Proposed
- **Guarded Prisma Build**: `npm run build` executed through the safe Prisma wrapper
- **Executable Windows Workflow**: the root GitHub Actions workflow used for real CI evidence
- **Mirrored Workflow Baseline**: the app-local workflow copy kept for contractual alignment and repository-local governance
- **Failure Classification**: `windows_rename_lock`, `non_retryable_failure`, `runner/environment issue`, or `success`
- **Explicit Failure Gate**: the final workflow step that re-fails the job when the guarded build exited non-zero
- **Residual Gobernado**: the approved status when evidence and governance exist but the full stabilization criterion is not yet satisfied
- **Estabilizado con evidencia CI**: the approved status only when the repository evidence meets the documented threshold, including a documented `workflow_dispatch` run or rerun

## 8. Domain models
### Proposed
This cycle does not introduce new persisted business entities. The most relevant model candidates are governance-policy concepts:

- **WindowsPrismaBuildResult** policy model candidate
  - attributes: run metadata, exit code, classification, artifact presence, summary presence, final result
  - responsibility: describe the auditable outcome of one Windows build execution

- **WindowsPrismaCloseoutCriterion** policy model candidate
  - attributes: minimum successful run count, distinct-run requirement, documented `workflow_dispatch`/rerun requirement, rename-lock blocker rule
  - responsibility: determine whether the verdict is `estabilizado con evidencia CI` or `residual gobernado`

- **WorkflowBaselineContract** policy model candidate
  - attributes: required job name, runner, Node version, build command, summary publication, artifact upload, explicit failure gate
  - responsibility: keep the versioned workflow shape stable and auditable

## 9. Aggregates and consistency boundaries
### Proposed
No database aggregate changes are proposed.

The relevant consistency boundaries are repository-governance boundaries:
- wrapper classification + build exit semantics must remain internally consistent
- workflow summary, artifact upload, and failure gate must remain consistent with the guarded build result
- the evidence document verdict must remain consistent with the documented closeout criterion and known runs

## 10. Application use cases
### Proposed
Relevant implemented or verified use cases:
- ExecuteGuardedPrismaBuild
- ClassifyPrismaGenerateFailure
- RunWindowsPrismaBuildWorkflow
- PublishWindowsBuildSummary
- UploadWindowsBuildLogArtifact
- FailWorkflowOnRealBuildFailure
- ValidateWorkflowBaselineContracts
- ConsolidatePrismaWindowsEvidence
- ReassessCloseoutVerdict

## 11. Input ports
### Proposed
- `ExecuteBuildPort`
- `RunWindowsWorkflowPort`
- `ValidateWorkflowBaselinePort`
- `CaptureWindowsBuildEvidencePort`
- `ReassessCloseoutVerdictPort`

## 12. Output ports
### Proposed
- `PrismaGeneratePort`
- `WorkflowExecutionPort` via GitHub Actions
- `WorkflowArtifactPublicationPort`
- `WorkflowSummaryPublicationPort`
- `EvidenceDocumentPort`

## 13. Input adapters
### Proposed
- `package.json` script entry for `npm run build`
- root GitHub Actions workflow `.github/workflows/windows-prisma-build.yml`
- local validation command `npm run validate:workflow-baseline`
- Node characterization tests under `tests/`
- versioned evidence document and README linkage

## 14. Output adapters
### Proposed
- `scripts/prisma-generate-safe.js` and `scripts/prisma-generate-safe-lib.js`
- GitHub Actions workflow summary via `GITHUB_STEP_SUMMARY`
- GitHub Actions artifact upload via `actions/upload-artifact@v4`
- Markdown evidence publication in `docs/prisma-windows-stability-evidence.md`

## 15. Dependency rules
### Proposed
- workflow governance tests may assert workflow-shape contracts, but they must not redefine the closeout criterion independently of the evidence document
- the mirrored workflow baseline must stay contract-aligned with the root executable workflow for the governed behavior it represents
- summary publication and artifact upload must never be implemented in a way that suppresses or hides a real non-zero build outcome
- documentation may report a stronger stabilization status only when supported by recorded evidence
- repository-governance changes must stay scoped; they must not silently redesign production business modules

## 16. Database ownership
### Proposed
No database ownership change is proposed in this cycle.

## 17. Transaction boundaries
### Proposed
No application transaction-boundary change is proposed in this cycle.

## 18. Event strategy
### Proposed
No in-application event strategy change is proposed.

Repository-governance note:
- GitHub Actions workflow runs are operational evidence events, not domain events inside the application runtime

## 19. API and integration contracts
### Proposed
No application API path changed.

Repository-governance contracts now explicitly protected:
- root Windows workflow must run on `windows-latest`
- Node version remains `20`
- the workflow must run `npm ci` and `npm run build`
- the workflow must publish a summary and upload a build-log artifact
- the workflow must preserve the real build failure through the explicit failure gate

## 20. Security boundaries
### Proposed
- the hardened workflow must not produce false-success evidence when `npm run build` actually fails
- failure classification should aid diagnosis without weakening build integrity
- documentation must distinguish confirmed remote evidence from local-only assumptions
- lack of `gh`/`GITHUB_TOKEN` in the current environment is an evidence-collection limitation, not a reason to overstate closure

## 21. Container and deployment architecture
### Proposed
No container or deployment redesign is proposed by this refresh. The scope is CI-governance hardening and documentation synchronization only.

## 22. Testing strategy
### Proposed
Preserve and rely on the current repository-governance safety net:
- `validate:workflow-baseline` for local workflow contract validation
- `tests/workflow-baseline-characterization.test.js` for workflow governance characterization
- `tests/prisma-windows-build-stabilization.test.js` for wrapper classification and Windows workflow contract assertions
- broader `npm run verify` aggregation to keep workflow-baseline validation in the main repository gate

## 23. Context map
### Proposed
- `BuildPrismaBootstrap -> PlatformRuntimeGovernance` through `npm run build`
- `PlatformRuntimeGovernance -> GitHub Actions` through `.github/workflows/windows-prisma-build.yml`
- `PlatformRuntimeGovernance -> EvidenceDocumentationGovernance` through run metadata, summary expectations, artifact expectations, and final verdict capture
- `README -> EvidenceDocumentationGovernance` through repository-source-of-truth linkage

## 24. Migration strategy
### Proposed
1. keep the guarded Prisma wrapper as the build contract
2. preserve the hardened root workflow and mirrored baseline contract
3. preserve local validation and characterization coverage
4. capture at least one documented `workflow_dispatch` run or rerun remotely
5. update the evidence document and architecture-facing docs again after that remote run
6. only then reconsider the verdict for `estabilizado con evidencia CI`

## 25. Forbidden dependencies
### Proposed
- treating historical successful runs alone as sufficient when the approved criterion still requires a documented `workflow_dispatch` run or rerun
- removing the explicit failure gate in a way that allows false-success workflow results
- reporting the repository as stabilized without documented evidence in `docs/prisma-windows-stability-evidence.md`
- expanding this closeout cycle into unrelated production refactors

## 26. Architectural decisions
### Proposed
- **ADR-P01**: the root workflow `.github/workflows/windows-prisma-build.yml` is the executable source for real Windows Prisma CI evidence
- **ADR-P02**: the mirrored workflow in `inventory-api/.github/workflows/windows-prisma-build.yml` remains a contract/reference baseline and should mirror the governed workflow shape
- **ADR-P03**: workflow summary publication, build-log artifact upload, and an explicit failure gate are mandatory parts of the Windows evidence contract
- **ADR-P04**: the repository source of truth for this risk is `docs/prisma-windows-stability-evidence.md`
- **ADR-P05**: current closeout status remains `residual gobernado` until the approved evidence threshold is fully met

## 27. Open decisions
### Proposed
- When remote execution becomes available, should the next evidence-collection run be a `workflow_dispatch` or a rerun of the latest successful workflow?
- Should the mirrored app-local workflow remain duplicated long term, or should a future governance step reduce duplication while preserving the baseline contract?
- After a documented remote run is captured, does the repository want an additional automation step to ingest run metadata into the evidence document, or is manual versioned documentation sufficient?
