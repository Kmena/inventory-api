## TASK-001: Capture the missing documented remote Windows workflow execution for final closeout reassessment
**Status:** Proposed
**Priority:** High
**Domain:** Platform Runtime Governance
**Requirement:** BR-006, AC-003, AC-007
**Reason:** The repository has hardened workflow governance and 4 successful historical Windows runs, but it still lacks the documented `workflow_dispatch` run or rerun required by the approved criterion.
**Current problem:** The implemented closeout is auditable and stronger than before, but the evidence set still does not satisfy the full threshold for `estabilizado con evidencia CI`.
**Proposed change:** When GitHub execution access is available, trigger or rerun `.github/workflows/windows-prisma-build.yml`, capture run metadata and artifact/summary evidence, then update `docs/prisma-windows-stability-evidence.md` and architecture-facing docs.
**Affected files:** `.github/workflows/windows-prisma-build.yml`, `inventory-api/docs/prisma-windows-stability-evidence.md`, `inventory-api/docs/current-state.md`, `inventory-api/docs/architecture.md`, `inventory-api/docs/action-plan.md`
**Dependencies:** None
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** Low positive impact by improving auditability and reducing false closure claims
**Acceptance criteria:**
- A documented remote `workflow_dispatch` run or rerun exists.
- The run records run ID, run attempt, event, branch, commit SHA, result, and artifact/summary presence.
- The evidence document and architecture-facing docs reflect the updated real verdict.
**Required tests:** Existing `npm run validate:workflow-baseline`, `node --test tests/workflow-baseline-characterization.test.js`, `node --test tests/prisma-windows-build-stabilization.test.js`
**Migration considerations:** Keep scope limited to evidence capture and documentation refresh; do not broaden into unrelated workflow redesign.
**Rollback or mitigation:** If the remote run cannot be performed yet, preserve the current `residual gobernado` verdict and keep the evidence gap explicit.
**Risk:** Medium

## TASK-002: Preserve workflow-baseline and Windows Prisma governance anti-regression coverage
**Status:** Proposed
**Priority:** Medium
**Domain:** Platform Runtime Governance
**Requirement:** FR-002, FR-004, FR-008, NFR-001
**Reason:** The implemented hardening is contractual and can regress if workflow shape or failure-gate behavior drifts.
**Current problem:** Root and mirrored workflow definitions must stay synchronized enough to preserve the governed contract, and build-evidence semantics must not be weakened later.
**Proposed change:** Keep `scripts/validate-workflow-baseline.js`, `tests/workflow-baseline-characterization.test.js`, and `tests/prisma-windows-build-stabilization.test.js` as required repository governance coverage for future changes touching Windows Prisma build behavior.
**Affected files:** `inventory-api/scripts/validate-workflow-baseline.js`, `inventory-api/tests/workflow-baseline-characterization.test.js`, `inventory-api/tests/prisma-windows-build-stabilization.test.js`, future related workflow files and docs
**Dependencies:** None
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** Low positive impact through stronger evidence integrity
**Acceptance criteria:**
- Workflow baseline validation remains part of supported repository governance.
- Characterization tests continue guarding summary publication, artifact upload, and explicit failure-gate behavior.
- Future workflow changes do not silently remove the governed contract.
**Required tests:** `npm run validate:workflow-baseline`, `node --test tests/workflow-baseline-characterization.test.js`, `node --test tests/prisma-windows-build-stabilization.test.js`
**Migration considerations:** Keep governance assertions focused on contractually relevant behavior; avoid overfitting to incidental YAML formatting.
**Rollback or mitigation:** If workflow structure must evolve later, update tests and validator together while preserving the auditable contract.
**Risk:** Low
