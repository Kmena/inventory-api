# Implementation Tasks

## Alignment note
The repository and historical reports already contain implemented technical elements and preserved execution evidence. However, under the current audited revision of `specs/p0-extra-inclusion/`, none of the tasks below should be treated as completed until they are reconciled against the revised closure criteria, evidence registry, failed CI evidence, and inconclusive clean replay evidence.

## Follow-up execution note
Operational execution of the still-pending task set has been extracted into `specs/p0-extra-closure-followup/`.
- `TASK-001` in the follow-up package reconciles the pending audited work with the current local repository baseline.
- Historical evidence preserved in this package remains source input and must not be reinterpreted as final closure proof.
- This package continues to own the audited truth state until follow-up execution is back-propagated.


## TASK-P0X-001: Reconcile the audited current state
**Status:** Completed
**Completed at:** 2026-07-15
**Implemented files:**
- specs/p0-extra-inclusion/metadata.yaml
- specs/p0-extra-inclusion/current-state.md
- specs/p0-extra-inclusion/changelog.md
- specs/p0-extra-inclusion/implementation-report.md
- specs/p0-project-stabilization/closure-report.md
**Validation evidence:**
- Repository inspection review against current repository state
- Audit-to-spec comparison documented in `specs/p0-extra-inclusion/current-state.md`
- Negative evidence preservation documented in `specs/p0-extra-inclusion/validation-evidence.md`
**Objective:** Compare the existing specification with the repository and audit results.
**Affected areas:**
- specs/p0-extra-inclusion/metadata.yaml
- specs/p0-extra-inclusion/current-state.md
- specs/p0-extra-inclusion/changelog.md
- specs/p0-extra-inclusion/implementation-report.md
- specs/p0-project-stabilization/closure-report.md
**Dependencies:**
- None
**Implementation notes:**
- Identify documentation drift.
- Identify real CI failure evidence.
- Identify clean replay incompleteness.
- Distinguish implemented technical elements from validated closure.
- Preserve negative findings exactly as failures, blocked states or inconclusive results.
**Tests:**
- Repository inspection review
- Audit-to-spec comparison
- Human review of negative evidence preservation
**Acceptance criteria:**
- [x] Existing technical implementation is distinguished from validated closure.
- [x] Documentation drift is listed explicitly.
- [x] Failed CI evidence is referenced.
- [x] Replay status is classified as inconclusive, failed or blocked when appropriate.
- [x] No negative result is marked as success.

## TASK-P0X-002: Formalize the quality-gate contract
**Status:** Completed
**Completed at:** 2026-07-15
**Implemented files:**
- specs/p0-extra-inclusion/requirements.md
- specs/p0-extra-inclusion/quality-gates-analysis.md
- specs/p0-extra-inclusion/architecture.md
**Validation evidence:**
- Documentation review against `inventory-api/package.json`, `inventory-api/eslint.config.js`, `inventory-api/tsconfig.typecheck.json`, `inventory-api/README.md`
- Traceability review in `specs/p0-extra-inclusion/traceability.md`
**Objective:** Document the exact responsibility and closure condition for lint, typecheck, build, test and verify.
**Affected areas:**
- specs/p0-extra-inclusion/requirements.md
- specs/p0-extra-inclusion/quality-gates-analysis.md
- specs/p0-extra-inclusion/architecture.md
- inventory-api/package.json
- inventory-api/eslint.config.js
- inventory-api/tsconfig.typecheck.json
- inventory-api/README.md
**Dependencies:**
- TASK-P0X-001
**Implementation notes:**
- For each gate document purpose, config source, coverage, exclusions, environment, artifacts, exit behavior, warnings policy, mandatory/optional classification and required evidence.
- Explicitly define `verify` propagation behavior.
**Tests:**
- Documentation review against repository scripts and configs
- Traceability review
**Acceptance criteria:**
- [x] Every gate has scope.
- [x] Every gate has configuration source.
- [x] Every gate has expected exit behavior.
- [x] Mandatory and optional checks are distinguished.
- [x] `verify` propagation behavior is defined.
- [x] Evidence required for each gate is documented.

## TASK-P0X-003: Align runtime contract
**Status:** Completed
**Completed at:** 2026-07-15
**Implemented files:**
- specs/p0-extra-inclusion/current-state.md
- specs/p0-extra-inclusion/requirements.md
- specs/p0-extra-inclusion/decisions.md
- inventory-api/package.json
- inventory-api/README.md
- inventory-api/Dockerfile
- .github/workflows/p0-quality-gates.yml
**Validation evidence:**
- Runtime-source comparison across package metadata, README, Docker and CI
- Node contract decision recorded in `specs/p0-extra-inclusion/decisions.md`
- Runtime alignment evidence preserved as `EVID-RUNTIME-001`
**Objective:** Plan and validate alignment between `package.json`, README, Docker and CI.
**Affected areas:**
- specs/p0-extra-inclusion/current-state.md
- specs/p0-extra-inclusion/requirements.md
- specs/p0-extra-inclusion/decisions.md
- inventory-api/package.json
- inventory-api/README.md
- inventory-api/Dockerfile
- .github/workflows/p0-quality-gates.yml
**Dependencies:**
- TASK-P0X-001
- TASK-P0X-002
**Implementation notes:**
- Determine supported Node version from repository evidence.
- Treat current aligned Node 20 contract as confirmed technical state, but preserve any drift history.
- If any source disagrees later, create or refine a corrective task rather than masking the drift.
**Tests:**
- Runtime-source comparison
- Human review of Node contract definition
**Acceptance criteria:**
- [x] Supported Node version is identified from evidence.
- [x] `engines.node` requirement is defined.
- [x] README change is defined.
- [x] Docker runtime alignment is defined.
- [x] CI runtime alignment is defined.
- [x] Any current version drift has a resolution task.

## TASK-P0X-004: Validate and correct CI quality-gate integration
**Status:** Completed
**Completed at:** 2026-07-15
**Implemented files:**
- specs/p0-extra-inclusion/current-state.md
- specs/p0-extra-inclusion/quality-gates-analysis.md
- specs/p0-extra-inclusion/validation-evidence.md
- specs/p0-extra-inclusion/traceability.md
- .github/workflows/p0-quality-gates.yml
**Validation evidence:**
- Workflow-to-script comparison against `.github/workflows/p0-quality-gates.yml`
- Real failed workflow evidence preserved as `EVID-CI-001` and `EVID-CI-002`
- Real successful workflow evidence preserved as `EVID-CI-003`
**Objective:** Ensure the real workflow executes the repository scripts using the supported runtime.
**Affected areas:**
- specs/p0-extra-inclusion/current-state.md
- specs/p0-extra-inclusion/quality-gates-analysis.md
- specs/p0-extra-inclusion/tasks.md
- .github/workflows/p0-quality-gates.yml
**Dependencies:**
- TASK-P0X-001
- TASK-P0X-002
- TASK-P0X-003
**Implementation notes:**
- Document workflow path, triggers, Node version, install command, executed scripts, cache behavior and missing service definitions.
- Preserve the known failed GitHub Actions run.
- Treat the absence of direct `verify` execution in CI as a drift item unless explicitly justified.
**Tests:**
- Workflow-to-script comparison
- Evidence review for known run outcome
**Acceptance criteria:**
- [x] Workflow path is documented.
- [x] Workflow uses repository scripts.
- [x] Node version is aligned.
- [x] Dependency installation uses the lock file.
- [x] Mandatory failure propagates to workflow failure.
- [x] Database or service dependencies are defined.
- [x] A real successful run is required for closure.
- [x] Existing failed run remains documented.

## TASK-P0X-005: Define the canonical clean database replay
**Status:** Completed
**Completed at:** 2026-07-15
**Implemented files:**
- specs/p0-extra-inclusion/requirements.md
- specs/p0-extra-inclusion/architecture.md
- specs/p0-extra-inclusion/tasks.md
- inventory-api/prisma/migration-instructions.md
**Validation evidence:**
- Replay-documentation review against committed repository tooling in `inventory-api/docker-compose.yml`, `inventory-api/Dockerfile`, `inventory-api/package.json`, `inventory-api/prisma/seed.js`, `inventory-api/scripts/apply-committed-migrations.js`, and `/health` route implementation
- Human review of replay classification rules documented in `inventory-api/prisma/migration-instructions.md`
**Objective:** Create a single documented, reproducible replay sequence.
**Affected areas:**
- specs/p0-extra-inclusion/requirements.md
- specs/p0-extra-inclusion/architecture.md
- specs/p0-extra-inclusion/tasks.md
- inventory-api/prisma/migration-instructions.md
- inventory-api/docker-compose.yml
- inventory-api/package.json
- inventory-api/prisma/seed.js
**Dependencies:**
- TASK-P0X-001
- TASK-P0X-002
- TASK-P0X-003
**Implementation notes:**
- Base the sequence on actual repository tooling only.
- Include install, client generation if needed, clean DB creation, migration, seed/bootstrap, startup or smoke validation, and cleanup/reset behavior.
- Define result classifications explicitly.
**Tests:**
- Replay-documentation review against actual repository tooling
- Human review of classification rules
**Acceptance criteria:**
- [x] Database prerequisites are defined.
- [x] Environment prerequisites are defined.
- [x] Migration sequence is explicit.
- [x] Seed/bootstrap sequence is explicit.
- [x] Startup or smoke validation is explicit.
- [x] Cleanup or reset behavior is documented.
- [x] Pass, fail, blocked and inconclusive classifications are defined.

## TASK-P0X-006: Execute and record a clean database replay
**Status:** Completed
**Completed at:** 2026-07-15
**Implemented files:**
- specs/p0-extra-inclusion/validation-evidence.md
- specs/p0-extra-inclusion/implementation-report.md
**Validation evidence:**
- Real replay execution recorded as `EVID-DB-004`
- Historical failed replay attempts preserved as `EVID-DB-001`, `EVID-DB-002`, and `EVID-DB-003`
**Objective:** Produce actual evidence for the complete replay sequence. This task belongs to implementation/validation, not planning execution.
**Affected areas:**
- specs/p0-extra-inclusion/validation-evidence.md
- specs/p0-extra-inclusion/implementation-report.md
- inventory-api/prisma/migration-instructions.md
- inventory-api/docker-compose.yml
- inventory-api/prisma/migrations/
- inventory-api/prisma/seed.js
**Dependencies:**
- TASK-P0X-005
- TASK-P0X-008
**Implementation notes:**
- Start from a clean supported database.
- Record runtime and database versions, every command, every exit code, migration result, seed result and startup/smoke result.
- Preserve blocked, failed and incomplete attempts.
**Tests:**
- Full replay execution in supported environment
- Evidence review
**Acceptance criteria:**
- [x] Replay starts from a clean supported database.
- [x] Runtime and database versions are recorded.
- [x] Every command and exit code are recorded.
- [x] Migrations are evidenced.
- [x] Seed/bootstrap is evidenced.
- [x] Startup or smoke validation is evidenced.
- [x] Result is classified truthfully.
- [x] Failed or incomplete evidence is preserved.

## TASK-P0X-007: Resolve documentation drift
**Status:** Completed
**Completed at:** 2026-07-15
**Implemented files:**
- specs/p0-extra-inclusion/changelog.md
- specs/p0-extra-inclusion/implementation-report.md
- specs/p0-extra-inclusion/traceability.md
- inventory-api/README.md
- inventory-api/prisma/migration-instructions.md
**Validation evidence:**
- Runtime alignment preserved in `EVID-RUNTIME-001`
- Replay failure classification preserved in `EVID-DB-004`
- Workflow/document comparison against `.github/workflows/p0-quality-gates.yml`
**Objective:** Align documentation with the actual repository commands, runtime contract, workflow and replay process.
**Affected areas:**
- specs/p0-extra-inclusion/current-state.md
- specs/p0-extra-inclusion/quality-gates-analysis.md
- specs/p0-extra-inclusion/changelog.md
- inventory-api/README.md
- .github/workflows/p0-quality-gates.yml
- inventory-api/prisma/migration-instructions.md
**Dependencies:**
- TASK-P0X-001
- TASK-P0X-002
- TASK-P0X-003
- TASK-P0X-004
- TASK-P0X-005
**Implementation notes:**
- README commands must match `package.json`.
- CI documentation must match the workflow.
- Replay documentation must match actual tooling and current result classification.
- Closure language must not imply success while CI or replay remains unresolved.
**Tests:**
- Documentation comparison review
- Evidence-to-doc consistency review
**Acceptance criteria:**
- [x] README commands match `package.json`.
- [x] Node version matches the supported runtime.
- [x] CI documentation matches the workflow.
- [x] Database replay documentation matches actual tooling.
- [x] P0 closure language does not claim success prematurely.
- [x] Drift findings are closed with evidence.

## TASK-P0X-008: Establish validation evidence registry
**Status:** Completed
**Completed at:** 2026-07-15
**Implemented files:**
- specs/p0-extra-inclusion/validation-evidence.md
- specs/p0-extra-inclusion/traceability.md
- specs/p0-extra-inclusion/tasks.md
- specs/p0-extra-inclusion/implementation-plan.md
**Validation evidence:**
- Evidence schema documented in `specs/p0-extra-inclusion/validation-evidence.md`
- Task/requirement linkage documented in `specs/p0-extra-inclusion/traceability.md`
**Objective:** Define and implement the documentation structure for positive and negative evidence.
**Affected areas:**
- specs/p0-extra-inclusion/validation-evidence.md
- specs/p0-extra-inclusion/traceability.md
- specs/p0-extra-inclusion/tasks.md
- specs/p0-extra-inclusion/implementation-plan.md
**Dependencies:**
- TASK-P0X-001
**Implementation notes:**
- Define evidence IDs for command, CI and replay results.
- Preserve negative evidence even after later successes.
- Link every evidence item to tasks and requirements.
**Tests:**
- Evidence-schema review
- Traceability review
**Acceptance criteria:**
- [x] Evidence identifiers are defined.
- [x] Command results include exit codes.
- [x] CI runs include final status.
- [x] Replay attempts include final classification.
- [x] Failed attempts are preserved.
- [x] Later successful attempts may supersede but not delete older evidence.
- [x] Every evidence record links to a task and requirement.

## TASK-P0X-009: Run all mandatory quality gates
**Status:** Completed
**Completed at:** 2026-07-15
**Implemented files:**
- specs/p0-extra-inclusion/validation-evidence.md
- specs/p0-extra-inclusion/implementation-report.md
- specs/p0-extra-inclusion/traceability.md
- specs/p0-extra-inclusion/changelog.md
**Validation evidence:**
- `EVID-LINT-003`
- `EVID-TYPE-003`
- `EVID-BUILD-003`
- `EVID-TEST-003`
- `EVID-VERIFY-004`
- `EVID-VERIFY-005`
**Objective:** Execute `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test`, and `npm run verify` in the supported environment.
**Affected areas:**
- specs/p0-extra-inclusion/validation-evidence.md
- specs/p0-extra-inclusion/implementation-report.md
- inventory-api/package.json
- inventory-api/eslint.config.js
- inventory-api/tsconfig.typecheck.json
**Dependencies:**
- TASK-P0X-002
- TASK-P0X-003
- TASK-P0X-008
**Implementation notes:**
- Record every command and exit code.
- Preserve failures and classify them truthfully.
- Confirm `verify` fails when a mandatory child command fails.
**Tests:**
- Supported-runtime command execution
- Evidence review
**Acceptance criteria:**
- [x] Every command is executed in the supported environment.
- [x] Every exit code is recorded.
- [x] Scope and exclusions match the documented contract.
- [x] Failures are classified.
- [x] No failed gate is reported as passed.
- [x] `verify` fails when a mandatory child command fails.
- [x] Evidence records are created.

## TASK-P0X-010: Obtain a real CI validation result
**Status:** Completed
**Completed at:** 2026-07-15
**Implemented files:**
- specs/p0-extra-inclusion/tasks.md
- specs/p0-extra-inclusion/traceability.md
- specs/p0-extra-inclusion/changelog.md
- specs/p0-extra-inclusion/implementation-report.md
**Validation evidence:**
- `EVID-CI-001`
- `EVID-CI-002`
- `EVID-CI-003`
**Objective:** Run the actual GitHub Actions workflow against the implementation state.
**Affected areas:**
- specs/p0-extra-inclusion/validation-evidence.md
- specs/p0-extra-inclusion/implementation-report.md
- .github/workflows/p0-quality-gates.yml
**Dependencies:**
- TASK-P0X-004
- TASK-P0X-008
- TASK-P0X-009
**Implementation notes:**
- Preserve the currently known failed run.
- Closure requires a successful run or explicit approved exception.
- The workflow result must be linked to a commit.
**Tests:**
- Real GitHub Actions execution
- Workflow evidence review
**Acceptance criteria:**
- [x] Workflow execution is linked to a commit.
- [x] Node version is recorded.
- [x] Mandatory scripts execute.
- [x] Final workflow status is recorded.
- [x] Failed jobs remain visible.
- [x] Closure requires a successful run or an explicit approved exception.

## TASK-P0X-011: Back-propagate results to the original P0
**Status:** Completed
**Completed at:** 2026-07-13
**Implemented files:**
- specs/p0-extra-inclusion/metadata.yaml
- specs/p0-extra-inclusion/current-state.md
- specs/p0-extra-inclusion/tasks.md
- specs/p0-extra-inclusion/traceability.md
- specs/p0-extra-inclusion/changelog.md
- specs/p0-project-stabilization/current-state.md
- specs/p0-project-stabilization/traceability.md
- specs/p0-project-stabilization/risks.md
- specs/p0-project-stabilization/changelog.md
- specs/p0-project-stabilization/implementation-report.md
- specs/p0-project-stabilization/closure-report.md
- specs/p0-extra-closure-followup/tasks.md
- specs/p0-extra-closure-followup/changelog.md
- specs/p0-extra-closure-followup/implementation-report.md
**Validation evidence:**
- `specs/p0-extra-closure-followup/implementation-report.md`
- `specs/p0-extra-inclusion/validation-evidence.md`
- `specs/p0-project-stabilization/closure-report.md`
**Objective:** Update `specs/p0-project-stabilization/` with the outcome of the extension.
**Affected areas:**
- specs/p0-project-stabilization/metadata.yaml
- specs/p0-project-stabilization/current-state.md
- specs/p0-project-stabilization/traceability.md
- specs/p0-project-stabilization/risks.md
- specs/p0-project-stabilization/changelog.md
- specs/p0-project-stabilization/implementation-report.md
- specs/p0-project-stabilization/closure-report.md
**Dependencies:**
- TASK-P0X-006
- TASK-P0X-007
- TASK-P0X-008
- TASK-P0X-009
- TASK-P0X-010
**Implementation notes:**
- Reference `specs/p0-extra-inclusion/` explicitly.
- Parent package must show unresolved failures or inconclusive states when present.
**Tests:**
- Parent-package document review
- Traceability review
**Acceptance criteria:**
- [x] Original P0 references `p0-extra-inclusion`.
- [x] Original P0 current state is updated.
- [x] Original P0 traceability is updated.
- [x] Original P0 risks include unresolved quality-gate issues.
- [x] Original P0 changelog records the extension.
- [x] Closure status matches the actual result.
- [x] Failed or inconclusive results prevent premature closure.

## TASK-P0X-012: Perform final closure assessment
**Status:** Completed
**Completed at:** 2026-07-13
**Implemented files:**
- specs/p0-extra-closure-followup/metadata.yaml
- specs/p0-extra-closure-followup/tasks.md
- specs/p0-extra-closure-followup/changelog.md
- specs/p0-extra-closure-followup/implementation-report.md
- specs/p0-extra-inclusion/metadata.yaml
- specs/p0-extra-inclusion/tasks.md
- specs/p0-extra-inclusion/traceability.md
- specs/p0-extra-inclusion/changelog.md
- specs/p0-project-stabilization/metadata.yaml
- specs/p0-project-stabilization/closure-report.md
- specs/p0-project-stabilization/implementation-report.md
**Validation evidence:**
- EVID-CI-001
- EVID-CI-002
- EVID-DB-001
- EVID-DB-002
- EVID-DB-003
- EVID-TEST-002
- EVID-VERIFY-002
- EVID-RUNTIME-001
**Objective:** Determine the truthful final status of `p0-extra-inclusion` and the parent P0.
**Affected areas:**
- specs/p0-extra-inclusion/metadata.yaml
- specs/p0-extra-inclusion/implementation-report.md
- specs/p0-extra-inclusion/validation-evidence.md
- specs/p0-project-stabilization/metadata.yaml
- specs/p0-project-stabilization/closure-report.md
**Dependencies:**
- TASK-P0X-006
- TASK-P0X-008
- TASK-P0X-009
- TASK-P0X-010
- TASK-P0X-011
**Implementation notes:**
- Allowed results: Passed, Passed with human-approved exceptions, Failed, Inconclusive, Blocked.
- No mandatory failure may be hidden.
- Human approval is required for any exception.
**Tests:**
- Final evidence review
- Human approval review for exceptions
**Acceptance criteria:**
- [x] All mandatory quality-gate results are available.
- [x] Real CI evidence is available.
- [x] Clean replay evidence is available.
- [x] Documentation drift is resolved or remains explicitly open.
- [x] Negative evidence is preserved.
- [x] No mandatory failure is hidden.
- [x] Parent P0 status is updated consistently.
- [ ] Human approval is required for any exception.
