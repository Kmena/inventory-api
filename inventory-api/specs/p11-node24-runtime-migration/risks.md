# Risks

## 1. Residual migration risks
- **Risk:** A fresh hosted Windows run of the updated Node 24 workflow may still surface a regression not visible in local validation.
  - **Impact:** `TASK-004` cannot be closed confidently.
  - **Mitigation:** push the workflow changes, trigger or wait for a hosted `windows-prisma-build` execution, and review the generated artifact/log.

## 2. Platform risks
- **Risk:** Hosted Windows workflow may classify failures differently from local guarded build reruns.
  - **Impact:** the repository may still lack final evidence separating baseline rename-lock from any hosted Node 24 regression.
  - **Mitigation:** execute and review `windows-prisma-build` workflow artifact/log under Node 24.

- **Risk:** Publicly reviewable hosted runs can lag behind the local repository state.
  - **Impact:** artifact review may only confirm the historical Node 20 workflow instead of the updated Node 24 one.
  - **Mitigation:** treat public artifact review as insufficient when the workflow revision has not been pushed/executed yet.

- **Risk:** The historical `PrismaClient is not a constructor` failure could still depend on stale generated artifacts or environment drift not recreated in the clean local rerun.
  - **Impact:** a future environment could still reproduce the prior issue.
  - **Mitigation:** preserve the evidence in traceability, keep the install/build-first validation path explicit, and treat any future reproduction as an environment-specific regression requiring fresh evidence.

## 3. Governance risks
- **Risk:** Claiming the substream fully closed after only local validation.
  - **Impact:** false closure of P0-003.
  - **Mitigation:** keep `TASK-004` in `Implemented` and `TASK-005` pending until the remaining validations are executed.

## 4. Controlled risks already addressed
- **Controlled risk:** Mixed Node baseline across package/Docker/workflows.
  - **Outcome:** resolved in this cycle.

- **Controlled risk:** Broad dependency upgrades without need.
  - **Outcome:** avoided; no dependency changes were required.

- **Controlled risk:** Browser E2E compatibility under Node 24.
  - **Outcome:** validated successfully in this cycle.

- **Controlled risk:** Docker build compatibility on `node:24-bullseye-slim`.
  - **Outcome:** validated successfully in this cycle.

- **Controlled risk:** New Node 24 regression being confused with Windows rename-lock baseline.
  - **Outcome:** current evidence still supports the rename-lock as a separate known baseline issue, but hosted Node 24 proof is still pending.
