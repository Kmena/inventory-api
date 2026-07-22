# P6-Linked Drift Inventory Reconfirmation

## Baseline source
- `specs/p7-drift-fix/drift-inventory.md`
- current working-tree inspection via `git diff --name-only`, `git diff --stat`, and `git status --short`

## Reconfirmed sub-batch scope
### security-contract
Tracked modified files:
- `inventory-api/.github/workflows/quality-gates.yml`
- `inventory-api/package.json`
- `inventory-api/package-lock.json`
- `inventory-api/prisma/schema.prisma`
- `inventory-api/src/middlewares/login-throttle.js`
- `inventory-api/src/middlewares/request-throttle.js`
- `inventory-api/src/routes/auth.routes.js`
- `inventory-api/src/routes/economic-activity.routes.js`
- `inventory-api/src/routes/region.routes.js`
- `inventory-api/src/routes/role.routes.js`
- `inventory-api/src/routes/sales-route.routes.js`
- `inventory-api/src/routes/warehouse.routes.js`
- `inventory-api/src/security/access-policies.js`
- `inventory-api/tests/administrative-authorization-characterization.test.js`
- `inventory-api/tests/auth-hardening-characterization.test.js`

Untracked files/dirs still aligned with the approved P6 batch list:
- `inventory-api/prisma/migrations/20260721000000_add_distributed_throttle_entries/`
- `inventory-api/tests/authorization-convergence-characterization.test.js`
- `inventory-api/tests/browser-e2e.e2e.js`
- `inventory-api/tests/throttle-behavior.test.js`

### ops
Tracked modified files:
- `inventory-api/.github/workflows/operational-smoke.yml`
- `inventory-api/docs/production-baseline.md`
- `inventory-api/tests/production-baseline-characterization.test.js`
- `inventory-api/tests/workflow-baseline-characterization.test.js`

## Obsolescence check
- No additional file outside the approved P6 lists was pulled into this inventory.
- No listed file has yet been identified as obviously obsolete from the inventory-only pass.
- Deeper keep/revert decisions remain for TASK-002 and TASK-003.

## Drift observations
- The currently visible inventory is consistent with `p7-drift-fix` after excluding the already-resolved mixed-provenance and historical-root-spec batches.
- Some P6 files are tracked modifications and some are still untracked additions, which means later validation must cover both categories explicitly.

## Inventory conclusion
The P6-linked inventory remains correct and is still safely separable into:
1. `security-contract`
2. `ops`
