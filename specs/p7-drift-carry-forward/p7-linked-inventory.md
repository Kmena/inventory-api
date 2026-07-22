# P7-Linked Drift Inventory Reconfirmation

## Baseline source
- `specs/p7-drift-fix/drift-inventory.md`
- current working-tree inspection via `git diff --name-only`, `git diff --stat`, and `git status --short`

## Reconfirmed P7-linked scope
### Runtime client/payment sub-batch
- `inventory-api/src/repositories/client.repository.js`
- `inventory-api/src/services/client.service.js`
- `inventory-api/src/services/payment-receipt-evidence.service.js`
- `inventory-api/src/services/payment.service.js`
- `inventory-api/tests/client-document-governance.test.js`
- `inventory-api/tests/client-document-security.test.js`
- `inventory-api/tests/payment-receipt-security.test.js`

### RawUnsafe non-runtime sub-batch
- `inventory-api/prisma/migration-instructions.md`
- `inventory-api/scripts/apply-committed-migrations.js`
- `inventory-api/scripts/diagnose-hardening-constraints.js`
- `inventory-api/tests/p2-hardening-constraints.test.js`
- `inventory-api/tests/rawunsafe-inventory-governance.test.js`
- `specs/p7-9-5-risk-closure/rawunsafe-inventory.md`

### Final evidence sub-batch
- `inventory-api/docs/p7-risk-closure-evidence.md`

## Inventory integrity check
- No additional file outside the approved P7 list was included in this spec inventory.
- The previously isolated `payment.repository.js` mixed-provenance case was resolved earlier in `specs/p7-mixed-provenance-fix/` and therefore is not reopened here.
- The root-spec historical batch remains outside this package and was already regularized separately.
- The P6-linked inventory remains out of scope for this package.

## Drift observations
- The current P7 diff remains fully representable as the three approved sub-batches: runtime, RawUnsafe, and final evidence.
- No obviously foreign file surfaced during this reconfirmation pass.

## Inventory conclusion
The P7-linked batch remains correctly scoped for carry-forward under `specs/p7-drift-carry-forward`.
