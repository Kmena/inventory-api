# RawUnsafe Inventory

## Scope and purpose
This inventory closes `TASK-001` for `p7-9-5-risk-closure`.

It lists every confirmed `RawUnsafe` occurrence identified during P7 implementation under `inventory-api/`, classifies the surface, and records the closure strategy and current status.

Current governed status after `TASK-004`:
- no free-form `RawUnsafe` usage remains in `inventory-api/src/`;
- no active `RawUnsafe` occurrences remain in the governed repository surfaces (`src/`, `scripts/`, `tests/`, `prisma/`);
- the only remaining repository references are historical audit/specification documents outside the governed execution surfaces.

## Classification scale
- **Critical:** runtime production path reachable from mounted routes or shared runtime infrastructure.
- **High:** operational script or integration test that executes against a real database and could replicate unsafe patterns.
- **Moderate:** test-only fake or documentation snippet that does not affect production behavior directly but should stay governed.

## Inventory
| File | Surface | Criticality | Runtime reachable | Raw usage context | SQL origin | Current purpose | Closure strategy | Current status |
|---|---|---|---|---|---|---|---|---|
| `inventory-api/src/lib/throttle-store.js` | Shared runtime infrastructure | Critical | Yes | `PrismaBackedThrottleStore#get`, `set`, `update`, `delete`, `clear` historically used `$queryRawUnsafe` / `$executeRawUnsafe` for `SELECT`, `INSERT ... ON CONFLICT`, `DELETE`, `DELETE FROM <table>` against `throttle_entries` | Fixed SQL plus dynamic table identifier from constructor option `tableName`; value parameters come from runtime throttle keys and payloads | Shared distributed throttling for login and authenticated lookup/request guards | Replaced with governed parameterized raw execution plus a closed allowlist for the table identifier, preserving upsert, expiry and transaction semantics | Remediated in `TASK-003` |
| `inventory-api/src/services/inventory.service.js` | Runtime application service | Critical | Yes | `registerStockEntryInTransaction` historically used `tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock($1)', context.companyId)` | Fixed SQL; parameter derived from tenant-scoped inventory context | Transaction-scoped advisory lock for stock-entry ordering and consistency | Replaced with a governed fixed-SQL special-case helper using parameterized raw execution | Remediated in `TASK-003` |
| `inventory-api/scripts/apply-committed-migrations.js` | Operational script | High | No | `verifyPhysicalSchema` historically used `$queryRawUnsafe` for `information_schema.tables` inspection | Fixed SQL string with no user input | Physical schema verification after sequential migration replay | Replaced with a governed parameterized raw query using Prisma tagged SQL | Remediated in `TASK-004` |
| `inventory-api/scripts/diagnose-hardening-constraints.js` | Operational diagnostic | High | No | `runDiagnostic` historically executed diagnostic SQL via `$queryRawUnsafe(diagnostic.query)` across a fixed query list | Fixed SQL constants from `DIAGNOSTIC_QUERIES` | Post-migration invariant diagnostics for P2 hardening constraints | Replaced with governed `Prisma.sql` constants executed through `$queryRaw` | Remediated in `TASK-004` |
| `inventory-api/tests/p2-hardening-constraints.test.js` | Integration test | High | No | Historically used `$queryRawUnsafe` and `$executeRawUnsafe` for fixture setup, cleanup and intentional constraint-violation checks | Inline fixed SQL with fixture identifiers inside a test-only database target | Validates physical DB constraints against a disposable database | Replaced with governed `Prisma.sql` helpers and tagged `$executeRaw` calls without changing test intent | Remediated in `TASK-004` |
| `inventory-api/tests/throttle-store.test.js` | Unit test support | Moderate | No | `FakePrismaThrottleClient` previously exposed `$queryRawUnsafe` / `$executeRawUnsafe` to mimic the old Prisma-backed throttle store behavior | Fake in-memory adapter, not real SQL execution | Characterization of current throttle store semantics | Updated alongside `TASK-003` to mimic the governed execution path while preserving behavioral assertions | Remediated in `TASK-003` |
| `inventory-api/tests/lot-datetime-characterization.test.js` | Characterization test support | Moderate | No | `createInventoryTransactionStub` previously exposed `$executeRawUnsafe` to satisfy the old inventory transaction contract under test | Fake transaction stub, not real SQL execution | Characterizes lot-date normalization around `registerStockEntryInTransaction` | Updated in `TASK-003` to track the governed advisory-lock call path | Remediated in `TASK-003` |
| `inventory-api/prisma/migration-instructions.md` | Documentation snippet | Moderate | No | Command examples historically included `prisma.$queryRawUnsafe(...)` for target-database verification | Fixed SQL example inside docs | Operational instructions for replay verification | Updated to use governed tagged `$queryRaw` examples so the docs no longer normalize `RawUnsafe` | Remediated in `TASK-004` |

## Scope split
### Mandatory hardening scope for this feature
- `inventory-api/src/lib/throttle-store.js` — remediated in `TASK-003`
- `inventory-api/src/services/inventory.service.js` — remediated in `TASK-003`

### Inventory-only scope for the initial closure phase
- `inventory-api/scripts/apply-committed-migrations.js` (remediated in `TASK-004`)
- `inventory-api/scripts/diagnose-hardening-constraints.js` (remediated in `TASK-004`)
- `inventory-api/tests/p2-hardening-constraints.test.js` (remediated in `TASK-004`)
- `inventory-api/tests/throttle-store.test.js` (already aligned to the governed runtime path)
- `inventory-api/tests/lot-datetime-characterization.test.js` (already aligned to the governed runtime path)
- `inventory-api/prisma/migration-instructions.md` (remediated in `TASK-004`)

## Final closure state
- No active `RawUnsafe` occurrences remain in the governed repository surfaces (`src/`, `scripts/`, `tests/`, `prisma/`).
- Historical audit/specification documents may still reference the term `RawUnsafe` descriptively, but they do not execute code and remain outside the governed execution surfaces checked by `tests/rawunsafe-inventory-governance.test.js`.

## Notes for TASK-002
- `throttle-store` is the highest-risk case because it combines shared runtime infrastructure with a dynamic identifier (`tableName`).
- `registerStockEntryInTransaction` is a narrower special-case query because the SQL text is fixed and the only variable is the advisory-lock key.
- The repository has compatible drift versus the earlier current-state analysis: `inventory-api/tests/lot-datetime-characterization.test.js` also carries a test-only `$executeRawUnsafe` stub and is now included in the canonical inventory.
- Scripts and tests remain in scope for visibility and governance, but not for mandatory first-pass runtime elimination under `DEC-003`.
