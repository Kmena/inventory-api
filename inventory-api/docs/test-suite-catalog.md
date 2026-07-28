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
- Explicit non-default infrastructure validation remains separate, for example:
  - `npm run test:redis-path`
  - `tests/audit-repository.test.js` with `P2_AUDIT_DATABASE_URL`

## Maintenance rule
When a test suite changes category or starts depending on different infrastructure, update this catalog in the same slice so the documented boundary stays accurate.

This catalog is intentionally limited to the currently affected boundary and closely related suites; it is not yet a full repository-wide suite inventory.
