# Risks

## 1. Residual migration risks
- **Risk:** A future change updates only one workflow tree (`/.github/workflows/` or `inventory-api/.github/workflows/`).
  - **Impact:** local validation and hosted execution could diverge silently.
  - **Mitigation:** add a parity guard or converge to a single workflow source-of-truth model in follow-up governance work.

## 2. Platform risks
- **Risk:** The pre-existing Windows Prisma `EPERM rename-lock` issue can still appear in some environments.
  - **Impact:** a future Windows failure may need classification before it is treated as a Node 24 regression.
  - **Mitigation:** preserve the dedicated Windows Prisma workflow, summary, and artifact evidence path.

- **Risk:** The historical `PrismaClient is not a constructor` failure could still depend on stale generated artifacts or environment drift not recreated in the clean rerun.
  - **Impact:** a future environment could still reproduce the prior issue.
  - **Mitigation:** preserve the clean install/build-first validation path and treat any future reproduction as fresh evidence requiring its own investigation.

## 3. Governance risks
- **Risk:** Teams may treat the application-local workflow copies as the hosted source of truth.
  - **Impact:** documentation and validator assumptions may drift from real hosted GitHub Actions behavior.
  - **Mitigation:** keep the root official workflow location explicit in docs and future governance tasks.

## 4. Controlled risks already addressed
- **Controlled risk:** Mixed Node baseline across package/Docker/workflows.
  - **Outcome:** resolved.

- **Controlled risk:** Broad dependency upgrades without need.
  - **Outcome:** avoided; no dependency changes were required.

- **Controlled risk:** Browser E2E compatibility under Node 24.
  - **Outcome:** validated successfully.

- **Controlled risk:** Docker build compatibility on `node:24-bullseye-slim`.
  - **Outcome:** validated successfully.

- **Controlled risk:** Missing hosted Windows evidence for the updated Node 24 workflow.
  - **Outcome:** resolved through hosted run `30281935398` and related root-workflow evidence.
