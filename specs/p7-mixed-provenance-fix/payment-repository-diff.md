# payment.repository.js Diff Review

## Source
- Command: `git diff -- inventory-api/src/repositories/payment.repository.js`
- File reviewed: `inventory-api/src/repositories/payment.repository.js`

## Raw diff summary
The pending diff is limited to one logical change:

1. Add `reservePaymentId()`
   - new repository function:
     - executes `SELECT nextval(pg_get_serial_sequence('payments', 'id')) AS id`
     - returns `BigInt(rows[0].id)`
2. Export `reservePaymentId` from `module.exports`

No other runtime query logic, tenant-scoping logic, receipt lookup logic, lifecycle transition logic, or throttling-related repository behavior changed in this file.

## Block-level review
| Block | Lines / area | Change | Initial provenance assessment |
|---|---|---|---|
| New function | after `findCompanyPaymentById` | adds `reservePaymentId()` | Candidate P7 |
| Export list | `module.exports` | exports `reservePaymentId` | Candidate P7 |

## Negative findings
The diff does **not** include:
- distributed throttling storage logic;
- auth throttling query logic;
- workflow/ops logic;
- payment receipt read/include changes beyond the already committed baseline;
- payment lifecycle metadata transition changes;
- schema-related code paths other than reserving a payment id for pre-persistence consistency.

## Provenance classification
| Block | Final provenance | Rationale |
|---|---|---|
| `reservePaymentId()` | `P7` | The function exists to reserve a payment identifier before persistence so the payment/receipt flow can avoid a later cleanup-dependent DB update path. This matches the P7 residual fix that hardened private payment receipt persistence sequencing. |
| `module.exports.reservePaymentId` | `P7` | This export exists only to make the new P7 repository function available to `payment.service.js`. |

## Cross-dependency review
- No block in the actual diff maps to P6 distributed throttling.
- No block maps to P6 workflow, browser E2E, operational baseline or authorization convergence.
- The file may still coexist in the same repository state as P6 changes elsewhere, but the pending diff for this file is not mixed by block provenance.

## Classification conclusion
The pending diff is fully attributable to `P7`, not to a mixed `P6/P7` composition.

This resolves the file as **not actually mixed-provenance** at the current diff level. The next task should therefore:
1. remove the mixed-provenance hold;
2. reclassify the file into the P7 carry-forward batch/evidence;
3. validate the P7-linked payment suites.
