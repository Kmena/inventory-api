# Test Suite Catalog

## Purpose
This document explains the current purpose, dependency boundary, and execution expectations for the browser/runtime suites affected by DB-free vs DB-backed separation, plus the closely related audit and browser-session suites needed to keep the boundary understandable.

## Classification summary
| Suite | Purpose | Layer / contract | Classification | Database dependency | Redis dependency | Command / path | Notable seam assumptions |
|---|---|---|---|---|---|---|---|
| `tests/public-surface-characterization.test.js` | Verifies reduced supported public-surface inventory and static runtime contract | Browser/runtime governance | DB-free | No real DB intended | No | `node --test tests/public-surface-characterization.test.js` | Reads files and runtime artifacts only |
| `tests/public-runtime-http-smoke.test.js` | Verifies supported HTML/asset responses, headers, and deprecated-route `410` behavior | Browser/runtime HTTP contract | DB-free | No real DB intended | No | `node --test tests/public-runtime-http-smoke.test.js` | Starts Express and validates reduced public runtime; should not rely on DB-backed audit persistence |
| `tests/browser-e2e.e2e.js` | Verifies critical browser flows such as transition landing, login rendering, and safe logout | Browser/runtime E2E | DB-free | No real DB intended | No | `node --test tests/browser-e2e.e2e.js` | Uses Playwright plus a local Express server; audit seams are stubbed through `tests/helpers/db-free-audit.js` so incidental audit persistence does not reach Prisma |
| `tests/audit-instrumentation.test.js` | Verifies audit payload semantics and instrumentation call sites | Audit instrumentation | DB-free | No real DB intended | No | `node --test tests/audit-instrumentation.test.js` | Stubs audit persistence call sites; explicitly defaults to memory browser-session mode for stable imports |
| `tests/audit-repository.test.js` | Verifies audit persistence against a real database and redaction behavior | Audit persistence integration | DB-backed | Yes, explicit | No | `node --test tests/audit-repository.test.js` with `P2_AUDIT_DATABASE_URL` | Skips when the dedicated DB URL is not configured |
| `tests/browser-session-auth-boundary.test.js` | Verifies browser-session auth boundary behavior, cookie issuance, `/me`, and logout contracts | Browser/auth HTTP boundary | DB-free | No real DB intended | No | `node --test tests/browser-session-auth-boundary.test.js` | Uses module stubs and test reset hooks; not intended to validate audit persistence |
| `tests/browser-session-service-characterization.test.js` | Verifies in-memory browser-session lifecycle and readiness behavior | Browser-session service | DB-free | No | No | `node --test tests/browser-session-service-characterization.test.js` | Explicitly uses memory mode |
| `tests/browser-session-redis-store.test.js` | Verifies Redis-backed browser-session store behavior using a fake Redis server | Browser-session store integration | Redis-backed | No | Yes, fake/local test server | `node --test tests/browser-session-redis-store.test.js` | Exercises Redis-path semantics without requiring the default DB |
| `tests/health-routes.test.js` | Verifies liveness/readiness behavior and dependency-state mapping | Operational readiness HTTP contract | DB-free | No real DB intended | No real Redis intended | `node --test tests/health-routes.test.js` | Stubs Prisma readiness and browser-session-store readiness responses |

## Notes on the DB-free vs DB-backed boundary
- **DB-free** means the suite is not intended to prove real database-backed audit persistence. It may still start Express, create in-memory browser sessions, or stub services, but it should not depend on Prisma successfully writing audit records.
- **DB-backed** means the suite intentionally validates persistence against a real configured database.
- **Redis-backed** means the suite intentionally validates Redis-path behavior; it is distinct from DB-backed audit persistence.

## Aggregate runner context
- `npm run test` uses `scripts/run-tests.js`.
- The aggregate runner defaults to:
  - `NODE_ENV=test`
  - `BROWSER_SESSION_STORE_MODE=memory`
- `scripts/run-tests.js` now rejects unsupported `BROWSER_SESSION_STORE_MODE` values and fails fast with actionable guidance when `BROWSER_SESSION_STORE_MODE=redis` is requested without `REDIS_URL`.
- Explicit non-default infrastructure validation remains separate, for example:
  - `npm run test:redis-path`
  - `tests/audit-repository.test.js` with `P2_AUDIT_DATABASE_URL`
  - `tests/p2-hardening-constraints.test.js` with `P2_CONSTRAINTS_DATABASE_URL`

## Prerequisite summary by lane
- **Default aggregate lane (`npm run test`)**
  - intended for the broad repository suite
  - defaults to memory browser-session mode
  - should not require `REDIS_URL`, `P2_AUDIT_DATABASE_URL`, or `P2_CONSTRAINTS_DATABASE_URL`
- **Redis lane (`npm run test:redis-path`)**
  - validates the supported non-default Redis-backed browser-session path
  - uses the fake/local Redis server embedded in `tests/browser-session-redis-store.test.js`
  - does not require the default application database
- **DB-backed audit lane**
  - run `node --test tests/audit-repository.test.js`
  - requires `P2_AUDIT_DATABASE_URL`
- **DB-backed constraints lane**
  - run `node --test tests/p2-hardening-constraints.test.js`
  - requires `P2_CONSTRAINTS_DATABASE_URL`

## Failure guidance expectations
- Missing DB-only variables should remain explicit and environment-gated rather than silently assumed.
- Non-default Redis validation should stay outside the aggregate default suite.
- Aggregate test failures caused by invalid browser-session mode configuration should point maintainers back to the default memory lane or the dedicated Redis lane.

## Maintenance rule
When a test suite changes category or starts depending on different infrastructure, update this catalog in the same slice so the documented boundary stays accurate.

This catalog is intentionally limited to the currently affected boundary and closely related suites; it is not yet a full repository-wide suite inventory.

## Supplier-management browser coverage note
- `tests/suppliers-view-characterization.test.js` is currently the focused DB-free characterization suite for the root-shell supplier workspace. It verifies helper sorting/filtering, KPI derivation, renderer escaping, add-product dialog search/filter markup, `filterAvailableProducts()` behavior, `renderFilteredProductOptions()` empty/result states, and the current edit-dialog sequencing behavior expected by the implemented supplier screen.
- `tests/suppliers-view.e2e.js` is currently the focused DB-free Playwright suite for the same supplier workspace. It uses browser-session seeding plus route stubbing to verify the implemented `#proveedores` flows for list rendering, create, edit, filtered product assignment by name/SKU, and read-only action hiding without requiring a real application database.
- Both supplier suites currently follow the repository convention where `*.e2e.js` files are executed outside the default aggregate `scripts/run-tests.js` discovery lane unless invoked explicitly.
