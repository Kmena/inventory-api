# RawUnsafe Remediation Strategy

## Scope
This document closes `TASK-002` for `p7-9-5-risk-closure`.

It defines the approved implementation strategy for each runtime `RawUnsafe` case identified in `rawunsafe-inventory.md`.

## Runtime strategy by file
### 1. `inventory-api/src/lib/throttle-store.js`
**Current risk**
- shared runtime infrastructure;
- reachable from login throttling and authenticated request throttling;
- combines fixed SQL with a dynamic table identifier.

**Approved strategy**
- Replace runtime `$queryRawUnsafe` / `$executeRawUnsafe` calls with Prisma parameterized raw execution.
- Keep the table identifier behind a closed allowlist containing only `throttle_entries` for the initial closure phase.
- Validate the configured `tableName` at construction time so unsupported identifiers fail fast and do not reach execution.
- Preserve the existing `SELECT`, `INSERT ... ON CONFLICT`, `DELETE`, transaction and expiry semantics.

**Why this preserves behavior**
- keys, payload JSON and expiry timestamps remain query parameters;
- upsert shape and `FOR UPDATE` lock behavior remain unchanged;
- shared Prisma-backed throttling continues to operate through the same store interface consumed by `login-throttle` and `request-throttle`.

### 2. `inventory-api/src/services/inventory.service.js`
**Current risk**
- runtime business operation with transaction ordering semantics;
- current SQL text is fixed, but it is still executed through `$executeRawUnsafe`.

**Approved strategy**
- Replace the free-form call with a dedicated helper local to the inventory service.
- Execute the advisory lock through Prisma parameterized raw execution using fixed SQL.
- Keep the helper narrow and private to avoid speculative abstractions.

**Why this preserves behavior**
- the SQL operation remains `SELECT pg_advisory_xact_lock(...)` inside the same transaction;
- the lock key remains derived from the authenticated company scope already resolved by `getInventoryContext`;
- no HTTP contract or persistence workflow changes are introduced.

## Non-runtime inventory handling in this phase
### Scripts
- `inventory-api/scripts/apply-committed-migrations.js`
- `inventory-api/scripts/diagnose-hardening-constraints.js`

These remain inventoried but are not mandatory runtime-hardening targets under `DEC-003`.

### Tests and docs
- `inventory-api/tests/p2-hardening-constraints.test.js`
- `inventory-api/tests/throttle-store.test.js`
- `inventory-api/tests/lot-datetime-characterization.test.js`
- `inventory-api/prisma/migration-instructions.md`

These remain governed as visibility surfaces. They should be updated only where necessary to reflect the new runtime-safe execution path or to avoid re-normalizing unsafe patterns.

## Validation plan for TASK-003
- update throttle-store characterization to use safe Prisma-style statements;
- add a guard that rejects unsupported throttle table identifiers;
- verify inventory characterization still exercises the stock-entry path with the safe advisory-lock call;
- rerun lint, typecheck, targeted tests and the broader automated test suite.
