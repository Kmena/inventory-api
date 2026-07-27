# Architectural Action Plan

## 1. Objective
Preserve the implemented Node 24 baseline, keep architecture-facing documentation synchronized with the real repository state, and reduce the remaining workflow-governance drift risk created by duplicated workflow trees.

## 2. Scope
In scope after the completed Node 24 alignment:
- preserve Node 24 runtime, Docker, and hosted workflow baseline
- preserve hosted root workflow execution from `/.github/workflows/`
- address the remaining governance risk created by duplicated root official workflows and application-local workflow mirror files
- continue broader P11 hardening follow-up already documented in the repository

## 3. Out of scope
- reverting Node 24 baseline without a newly reproduced critical incompatibility
- unrelated functional redesign
- broad architectural rewrite
- rewriting historical Prisma migrations

## 4. Requirements addressed
This plan now focuses on post-implementation governance and remaining hardening objectives:
- `p11-node24-runtime-migration` FR-008, FR-009, FR-012, FR-016 are already satisfied and must be preserved
- Architectural objective AO-001: maintain a trustworthy workflow source of truth after the official root workflow alignment
- Architectural objective AO-002: keep architecture-facing docs synchronized with actual hosted workflow behavior

## 5. Current problems addressed
- duplicated workflow governance between `/.github/workflows/` and `inventory-api/.github/workflows/`
- duplicated workflow trees remain a maintainability risk even though local validators/tests now resolve the hosted root official workflows first
- pre-existing Windows Prisma rename-lock debt
- broader P11 hardening debt outside this runtime baseline slice

## 6. Domains affected
- Repository/platform governance
- CI/workflow governance
- Runtime platform baseline
- Cross-cutting architecture documentation

## 7. Behavior to preserve
- Node 24 baseline in `package.json`, Docker, and workflows
- root hosted workflows executing with `working-directory: inventory-api`
- current root-first validator/test resolution with fallback to the application-local mirror until an approved replacement exists
- dedicated Windows Prisma build classification and artifact publication
- current API and browser-runtime contracts

## 8. Defects to correct
### High
- no automated parity guard currently proves that root official workflows and the duplicated application-local mirror remain aligned

### Medium
- duplicated workflow trees still create synchronization and maintainability overhead even after root-first validator/test hardening
- pre-existing Windows Prisma `EPERM` rename-lock issue remains operational debt

### Low
- workflow-governance knowledge is distributed across scripts, tests, root workflows, application-local copies, docs, and specs

## 9. Future architectural changes
Planned incremental changes:
1. introduce an explicit governance rule or automation to keep root official workflows and the duplicated application-local mirror aligned;
2. decide whether duplicated workflows remain versioned mirrors or should be replaced by a single authoritative source pattern;
3. continue broader P11 hardening slices without reopening the completed Node 24 migration.

## 10. Database changes
No database change is currently planned.

## 11. API and integration changes
No API contract change is currently planned.

Integration/governance follow-up may change workflow-validation internals only.

## 12. Container and deployment changes
No new container change is currently required.

The implemented container baseline to preserve is:
- `node:24-bullseye-slim`
- multi-stage build
- non-root runtime
- readiness healthcheck

## 13. Security changes
Future security-related governance work should:
- preserve current authorization behavior
- avoid weakening Windows Prisma failure classification
- continue broader P11 hardening outside this Node baseline slice

## 14. Test strategy
Future work should validate in this order:
1. add characterization or parity checks before changing workflow-governance behavior further;
2. verify the duplicated application-local mirror stays functionally aligned with the root hosted workflows;
3. keep `validate:workflow-baseline` and related tests green while they continue resolving the root official workflow tree first;
4. preserve Node 24 runtime evidence on local, Docker, and hosted workflows.

Evidence already recorded for the completed Node 24 baseline includes:
- local `validate:workflow-baseline`
- local workflow characterization tests
- previously recorded Node 24 mainline validation across build, lint, typecheck, tests, browser E2E, validators, and Docker build
- hosted success runs `30281932831`, `30281933453`, `30281933525`, `30281935485`, `30281937000`, and `30281935398`

## 15. Migration stages
### Stage 1 — Completed
- Reconcile external audit findings with repository evidence
- Record planning decisions and freeze policy in P11 packages

### Stage 2 — Completed
- Implement first tenant-isolation repository hardening slice

### Stage 3 — Completed
- Remove the root bootstrap repository-boundary violation

### Stage 4 — Completed
- Expand approved typecheck/CI governance slice

### Stage 5 — Completed
- Migrate runtime/tooling baseline from Node 20 to Node 24 in package, Docker, validators, and workflow copies

### Stage 6 — Completed
- Align the **official root workflows** to Node 24 with `working-directory: inventory-api`
- Record hosted GitHub Actions success evidence for the updated root workflow path

### Stage 7 — Proposed
- Add a workflow-governance parity guard or converge to a single workflow source-of-truth model

### Stage 8 — Proposed
- Continue remaining broader P11 hardening slices unrelated to the now-complete Node 24 baseline migration

## 16. Risks and mitigations
| Risk | Level | Mitigation |
|---|---|---|
| Root and application-local workflows drift again | High | add parity validation or converge to one source of truth |
| A later workflow edit updates only one duplicated workflow tree | High | require documentation and tests to name the official and mirrored locations explicitly, and add parity automation |
| Windows Prisma build instability obscures later regressions | Medium | preserve dedicated Windows workflow classification and artifact evidence |
| Broader P11 work accidentally reopens the Node 24 baseline question | Medium | treat Node 24 baseline as implemented and only reopen on new reproduced evidence |

## 17. Rollback or recovery strategy
- Do not roll back Node 24 baseline without a newly reproduced critical incompatibility.
- If workflow-governance changes create drift or break validators, revert only the governance slice and preserve the current root official workflows.
- Keep root hosted workflows as the operational truth during any parity-refactor work.

## 18. Manual validation
For future approved governance work, manually confirm:
- root hosted workflows still execute in `inventory-api/`
- Node setup still uses version 24
- cache path still points to `inventory-api/package-lock.json`
- local validators/tests still resolve the root official workflow tree first, and any fallback or mirror behavior is explicitly documented or parity-checked

## 19. Approval status
**Status:** Node 24 runtime migration completed and evidenced; follow-up governance work remains Proposed
