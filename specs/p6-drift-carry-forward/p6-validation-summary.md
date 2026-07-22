# P6 Carry-Forward Validation Summary

## security-contract
### Files covered
- workflow / dependency / prisma / middleware / route / security / security-test surfaces listed in `p6-linked-inventory.md`

### Commands executed
- `node --test tests/administrative-authorization-characterization.test.js`
- `node --test tests/auth-hardening-characterization.test.js`
- `node --test tests/authorization-convergence-characterization.test.js`
- `node --test tests/throttle-behavior.test.js`
- `npm run test:e2e:browser`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

### Results
- Focused tests: passed
- Lint: passed
- Typecheck: passed
- Browser E2E: passed
- Build: environmental failure

### Environmental failure detail
- `npm run build` failed with Prisma Windows `EPERM` rename failure during `prisma generate`.
- This matches the approved known environmental risk documented by the spec and is not treated as a newly introduced regression.

### Keep/revert decision
- Keep the sub-batch as P6-aligned carry-forward work.
- No file in the security-contract list was identified as obsolete or requiring revert during this validation pass.

## ops
### Files covered
- `inventory-api/.github/workflows/operational-smoke.yml`
- `inventory-api/docs/production-baseline.md`
- `inventory-api/tests/production-baseline-characterization.test.js`
- `inventory-api/tests/workflow-baseline-characterization.test.js`

### Commands executed
- `node --test tests/production-baseline-characterization.test.js`
- `node --test tests/workflow-baseline-characterization.test.js`
- `npm run validate:production-baseline`
- `npm run validate:workflow-baseline`
- `npm run validate:operational-readiness`

### Results
- Characterization tests: passed
- Workflow baseline validator: passed
- Operational readiness validator: passed
- Production baseline validator: environment-precondition failure

### Environmental failure detail
- `npm run validate:production-baseline` failed because required production variables were not present in the current shell:
  - `NODE_ENV`, `PORT`, `DATABASE_URL`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `CORS_ORIGIN`, `APP_BASE_URL`, `JWT_SECRET`
- This does not contradict the passing characterization test, which validates the same baseline under explicit production values.

### Keep/revert decision
- Keep the sub-batch as P6-aligned carry-forward work.
- No file in the ops list was identified as obsolete or requiring revert during this validation pass.

## Overall P6 carry-forward conclusion
- Inventory reconfirmed.
- `security-contract` validated with one documented environmental build failure.
- `ops` validated with one documented environment-precondition validator failure.
- No reviewed P6-linked file currently requires revert.
