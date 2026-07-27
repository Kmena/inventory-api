# Architectural Action Plan

## 1. Objective
Preserve the implemented Node 24 baseline, keep architecture-facing documentation synchronized with the real repository state, preserve root-only workflow governance, preserve the repaired public restore-readiness contract, and preserve the implemented public operational-readiness contract backed by public docs plus explicit `.env.production.example` evidence.

## 2. Scope
In scope after the completed Node 24 alignment:
- preserve Node 24 runtime, Docker, and hosted workflow baseline
- preserve hosted root workflow execution from `/.github/workflows/`
- preserve root-only workflow governance from `/.github/workflows/`
- preserve the repaired restore-readiness smoke contract used by the official operational workflow
- preserve the public `docs/`-backed contracts for both restore readiness and operational readiness
- preserve `.env.production.example` as explicit required versioned evidence of the production baseline
- preserve the implemented two-document public operational-readiness contract without introducing an unnecessary third public document
- continue broader P11 hardening follow-up already documented in the repository

## 3. Out of scope
- reverting Node 24 baseline without a newly reproduced critical incompatibility
- unrelated functional redesign
- broad architectural rewrite
- rewriting historical Prisma migrations

## 4. Requirements addressed
This plan now focuses on post-implementation governance and remaining hardening objectives:
- `p11-node24-runtime-migration` FR-008, FR-009, FR-012, FR-016 are already satisfied and must be preserved
- `p11-workflow-governance-and-restore-readiness` FR-001 through FR-012 are implemented and must be preserved
- `p11-operational-readiness-public-baseline` FR-001 through FR-010 are implemented and must be preserved
- Architectural objective AO-001: maintain a trustworthy workflow source of truth after the official root workflow alignment
- Architectural objective AO-002: keep architecture-facing docs synchronized with actual hosted workflow behavior
- Architectural objective AO-003: preserve public operational-readiness assurance without optional private-document prerequisites

## 5. Current problems addressed
- operational-readiness governance still depends on synchronized public docs, validators, tests, README, `.env.production.example`, and workflows
- pre-existing Windows Prisma rename-lock debt
- broader P11 hardening debt outside this runtime and workflow-governance slice

## 6. Domains affected
- Repository/platform governance
- CI/workflow governance
- Runtime platform baseline
- Cross-cutting architecture documentation

## 7. Behavior to preserve
- Node 24 baseline in `package.json`, Docker, and workflows
- root hosted workflows executing with `working-directory: inventory-api`
- local workflow validators/tests reading the same root workflow definitions directly
- dedicated Windows Prisma build classification and artifact publication
- current API and browser-runtime contracts
- the current two-document public operational-readiness contract and explicit `.env.production.example` baseline evidence

## 8. Defects to correct
### High
- none currently identified in this completed governance slice

### Medium
- operational-readiness and restore-readiness still depend on distributed governance artifacts staying synchronized
- `.env.production.example`, README, docs, validators, and tests must continue evolving together to avoid reintroducing audit ambiguity
- pre-existing Windows Prisma `EPERM` rename-lock issue remains operational debt

### Low
- workflow-governance knowledge is distributed across scripts, tests, root workflows, docs, and specs

## 9. Future architectural changes
Planned incremental changes:
1. preserve the single authoritative root workflow source already implemented;
2. preserve the exposed and validated restore-readiness npm gate used by the official operational smoke workflow;
3. preserve the now-public `validate:operational-readiness` contract and only evolve it through approved slices;
4. preserve the explicit validator/test/documentation treatment of `.env.production.example` as production-baseline evidence;
5. avoid adding a third public operational-readiness document unless a later approved slice demonstrates a real auditability or clarity gap;
6. continue broader P11 hardening slices without reopening the completed Node 24 migration.

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
1. keep `validate:workflow-baseline` and related tests green against the root official workflow tree;
2. keep `validate:restore-readiness` green as part of the operational smoke contract;
3. keep `validate:operational-readiness` green against the public `docs/` contract and root workflow path;
4. keep `validate:production-baseline` green with `.env.production.example` remaining versioned and documented;
5. preserve Node 24 runtime evidence on local, Docker, and hosted workflows.

Evidence already recorded for the completed Node 24 and workflow-governance baselines includes:
- local `npm run build`
- local `npm run lint`
- local `npm run typecheck`
- local `npm run validate:workflow-baseline`
- local `npm run validate:restore-readiness`
- local `npm run validate:operational-readiness`
- local `npm run validate:production-baseline` with explicit production environment values
- local `node --test tests/workflow-baseline-characterization.test.js tests/prisma-windows-build-stabilization.test.js`
- local `node --test tests/production-baseline-characterization.test.js tests/restore-readiness-characterization.test.js`
- previously recorded Node 24 mainline validation across tests, browser E2E, validators, and Docker build
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

### Stage 7 — Completed
- Converge governance fully to the root official workflow tree and remove the duplicated application-local workflow YAML

### Stage 8 — Completed
- Repair and document the restore-readiness smoke contract used by the official operational workflow
- Add `docs/restore-readiness-baseline.md` as the public canonical restore-readiness baseline
- Keep `validate:operational-readiness` on the root workflow path after the local workflow YAML removal

### Stage 9 — Completed
- Converge `validate:operational-readiness` onto public `docs/` artifacts and close `.env.production.example` as explicit baseline evidence
- Keep the public operational-readiness contract on `docs/production-baseline.md` plus `docs/production-operations-runbook.md` without introducing a third public document

### Stage 10 — Proposed
- Continue remaining broader P11 hardening slices unrelated to the now-complete Node 24 and workflow-governance baselines

## 16. Risks and mitigations
| Risk | Level | Mitigation |
|---|---|---|
| Public operational contracts drift across docs, validators, tests, README, `.env.production.example`, and workflows | Medium | preserve focused characterization tests and validator coverage for both readiness contracts and the explicit production-baseline artifact |
| Windows Prisma build instability obscures later regressions | Medium | preserve dedicated Windows workflow classification and artifact evidence |
| Broader P11 work accidentally reopens the Node 24 baseline question | Medium | treat Node 24 baseline as implemented and only reopen on new reproduced evidence |

## 17. Rollback or recovery strategy
- Do not roll back Node 24 baseline without a newly reproduced critical incompatibility.
- If governance changes break validators, revert only the affected governance slice and preserve the current root official workflows.
- Keep root hosted workflows as the operational truth for future governance/operational documentation changes.

## 18. Manual validation
For future approved governance work, manually confirm:
- root hosted workflows still execute in `inventory-api/`
- Node setup still uses version 24
- cache path still points to `inventory-api/package-lock.json`
- local validators/tests still read the root official workflow tree directly
- the restore-readiness npm command exists and matches the documented operational baseline
- operational-readiness continues to validate the public `docs/` contract without hidden private prerequisites
- `.env.production.example` remains versioned, documented, and required by `validate:production-baseline`
- no third public operational-readiness document was introduced unless a later approved slice justifies it
- root-only workflow governance is preserved with no reintroduced application-local workflow YAML mirror

## 19. Approval status
**Status:** Node 24 runtime migration completed and evidenced; root-only workflow governance plus public restore-readiness and operational-readiness contracts are implemented; `.env.production.example` is explicit validated baseline evidence; no third public operational-readiness document was needed; broader P11 hardening follow-up remains optional future work
