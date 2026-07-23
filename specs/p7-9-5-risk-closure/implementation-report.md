# Implementation Report
## 1. Specification
- Feature: `p7-9-5-risk-closure`
- Canonical spec path: `specs/p7-9-5-risk-closure`
- Application root: `inventory-api/`

## 2. Approval status
- `status: approved`
- `implementation_status: ready-for-implementation`

## 3. Pre-implementation baseline
### Repository drift assessment
- Drift classification for TASK-001: Minor conflict
- Observed drift:
  - the repository contains pre-existing uncommitted changes in P7-relevant files, including `inventory-api/src/lib/throttle-store.js`, `inventory-api/tests/throttle-store.test.js`, and `inventory-api/docs/openapi/runtime-baseline.openapi.json`;
  - the root-level canonical spec package exists under `specs/p7-9-5-risk-closure/` while a historical copy also exists under `inventory-api/specs/p7-9-5-risk-closure/`;
  - `inventory-api/docs/runtime-endpoint-catalog.md` is present in the visible workspace and forms part of the implemented P7 evidence set;
  - historical references to `inventory-api/docs/audit/p6-9_5-blockers.md` are not present in the visible workspace and are treated as documented historical drift, not as blocking prerequisites.
- Compatibility assessment:
  - the current runtime still exposes the `RawUnsafe` usage profile described by the approved current-state analysis;
  - the missing historical docs do not block TASK-001 because the approved advisor review downgraded them to drift notes.

### Commands executed before implementation
| Command | Result | Exit status | Affected module | Feature-related |
|---|---|---:|---|---|
| `npm run build` | Failed: Prisma client generation hit a Windows rename `EPERM` in `node_modules/.prisma/client/query_engine-windows.dll.node.tmp*` | 1 | build/tooling | No, pre-existing environment/tooling issue |
| `npm run typecheck` | Passed | 0 | typecheck | Baseline only |
| `npm run lint` | Passed | 0 | lint | Baseline only |
| `npm run test -- --silent` | Passed (`219` pass, `0` fail, `2` skip) | 0 | tests | Baseline only |
| `git status --short` | Completed; identified pre-existing modified/untracked files in repo and app root | 0 | repository state | Yes |

## 4. Tasks selected
- `TASK-001: Inventariar usos de RawUnsafe y clasificarlos`
- `TASK-002: Diseñar la estrategia segura para cada caso RawUnsafe`
- `TASK-003: Endurecer el runtime frente a RawUnsafe y actualizar pruebas asociadas`
- `TASK-004: Caracterizar fallos parciales en documentos privados de cliente`
- `TASK-005: Caracterizar fallos parciales en comprobantes privados de pago`
- `TASK-006: Medir endpoints pesados y crear baseline gobernada`
- `TASK-007: Formalizar el alcance contractual entre runtime y OpenAPI parcial`
- `TASK-008: Consolidar documentación y evidencia P7 para auditoría`
- Related requirements: `FR-001`, `FR-002`, `FR-003`, `FR-004`, `FR-005`, `FR-006`, `FR-007`, `AC-001`, `AC-002`, `AC-003`, `AC-004`, `AC-005`, `BR-001`, `BR-002`, `BR-003`, `BR-004`, `BR-005`
- Related decisions: `DEC-001`, `DEC-002`, `DEC-003`, `DEC-004`, `DEC-005`, `DEC-006`, `DEC-007`, `DEC-008`, `DEC-009`
- Related risks: `RISK-001`, `RISK-002`, `RISK-003`, `RISK-004`, `RISK-005`, `RISK-006`, `RISK-007`

## 5. Files changed
- `specs/p7-9-5-risk-closure/current-state.md`
- `specs/p7-9-5-risk-closure/implementation-report.md`
- `specs/p7-9-5-risk-closure/rawunsafe-inventory.md`
- `specs/p7-9-5-risk-closure/rawunsafe-remediation-strategy.md`
- `specs/p7-9-5-risk-closure/tasks.md`
- `specs/p7-9-5-risk-closure/traceability.md`
- `CHANGELOG.md`
- `inventory-api/src/lib/throttle-store.js`
- `inventory-api/src/lib/logging.js`
- `inventory-api/src/lib/heavy-endpoint-governance.js`
- `inventory-api/src/middlewares/heavy-endpoint-metrics.js`
- `inventory-api/src/services/inventory.service.js`
- `inventory-api/src/app.js`
- `inventory-api/docs/heavy-endpoints-baseline.json`
- `inventory-api/docs/heavy-endpoints-baseline.md`
- `inventory-api/docs/runtime-contract-manifest.json`
- `inventory-api/docs/runtime-endpoint-catalog.md`
- `inventory-api/docs/openapi/runtime-baseline.openapi.json`
- `inventory-api/docs/p7-risk-closure-evidence.md`
- `inventory-api/README.md`
- `inventory-api/tests/throttle-store.test.js`
- `inventory-api/tests/lot-datetime-characterization.test.js`
- `inventory-api/tests/rawunsafe-inventory-governance.test.js`
- `inventory-api/tests/client-document-security.test.js`
- `inventory-api/tests/payment-receipt-security.test.js`
- `inventory-api/tests/heavy-endpoint-governance.test.js`
- `inventory-api/tests/logging.test.js`
- `inventory-api/tests/openapi-contract-consistency.test.js`
- `inventory-api/tests/runtime-contract-governance.test.js`
- `inventory-api/tests/p7-risk-closure-evidence.test.js`

## 6. Architecture decisions followed
- `DEC-001`: free-form runtime `RawUnsafe` was eliminated from `inventory-api/src/`.
- `DEC-002`: runtime SQL special cases now use explicit controls:
  - closed allowlist for the throttle table identifier;
  - fixed-SQL helper for the advisory lock call.
- `DEC-003`: scripts, test-only DB fixtures and operational docs remain inventoried but are not yet remediated in this phase.
- `DEC-004`: the first partial-failure characterization targets are the private client-document flow and the private payment-receipt flow.
- `DEC-005`: the heavy-endpoint baseline covers exactly the approved initial prioritized route set.
- `DEC-006`: the first performance-governance phase uses representative machine-readable baseline data and drift detection instead of hard budgets.
- `DEC-007`: OpenAPI remains partial and factual rather than expanding into an aspirational total contract.
- `DEC-008`: the runtime now has an explicit complementary manifest that classifies every mounted router operation as covered or intentionally excluded.
- `DEC-009`: runtime behavior and route contracts were preserved while hardening SQL execution, characterizing failure semantics, adding best-effort heavy-endpoint instrumentation and formalizing contract scope.

## 7. Coding-standard validation
- `inventory-api/docs/coding-standards.md` was read before changes.
- Changes stayed focused on the selected tasks and affected modules.
- The runtime hardening remains incremental and local to existing layers.
- No unrelated refactoring or dead code was introduced.
- Tests were updated to characterize the new governed execution path instead of weakening assertions.

## 8. Tests added or updated
- Added `inventory-api/tests/rawunsafe-inventory-governance.test.js`
  - verifies the governed current `RawUnsafe` file set under `src/`, `scripts`, `tests` and `prisma`
  - verifies that the canonical inventory document lists every still-observable occurrence
- Updated `inventory-api/tests/throttle-store.test.js`
  - characterizes the Prisma-backed throttle store through safe Prisma statement objects
  - verifies invalid table identifiers are rejected
- Updated `inventory-api/tests/lot-datetime-characterization.test.js`
  - verifies the inventory stock-entry path still acquires the advisory lock through the governed raw execution path
- Updated `inventory-api/tests/client-document-security.test.js`
  - characterizes successful private document persistence outside `src/public`
  - characterizes file-write failure with successful DB rollback
  - characterizes file-write failure with failed DB rollback
  - characterizes the current preserved defect when the final DB update fails after file persistence
- Updated `inventory-api/tests/payment-receipt-security.test.js`
  - characterizes payment creation rollback after receipt DB persistence fails following successful file storage
  - characterizes the current preserved defect when payment cleanup itself fails
  - characterizes the accepted residual orphan when best-effort receipt-file cleanup fails
  - characterizes replacement cleanup when a new receipt file is written but the replacement transaction fails
- Added `inventory-api/tests/heavy-endpoint-governance.test.js`
  - verifies the approved prioritized heavy-endpoint set
  - verifies route-pattern normalization and best-effort metrics capture middleware
  - verifies the machine-readable baseline stays aligned with the representative fixtures
- Updated `inventory-api/tests/logging.test.js`
  - verifies non-development request logs include governed heavy-endpoint metadata only when available
- Updated `inventory-api/tests/openapi-contract-consistency.test.js`
  - verifies the partial OpenAPI baseline now cross-links the complementary runtime contract manifest and catalog
- Added `inventory-api/tests/runtime-contract-governance.test.js`
  - verifies every mounted router operation is classified as covered by OpenAPI or intentionally excluded in the manifest
  - verifies the companion artifacts stay cross-linked and keep the public static runtime surface explicitly outside OpenAPI
- Added `inventory-api/tests/p7-risk-closure-evidence.test.js`
  - verifies the consolidated P7 evidence document stays linked from `README.md`
  - verifies the document preserves the governed artifacts, validation commands and the explanation for the 2 expected environment-gated skips

## 9. Commands executed
- `npm run build`
- `npm run typecheck`
- `npm run lint`
- `npm run test -- --silent`
- `node --test tests/client-document-security.test.js`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run build`
- `npm run test -- --silent`
- `node --test tests/payment-receipt-security.test.js`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run build`
- `npm run test -- --silent`
- `node --test tests/heavy-endpoint-governance.test.js tests/logging.test.js`
- `node --test tests/openapi-contract-consistency.test.js tests/runtime-contract-governance.test.js`
- `node --test tests/p7-risk-closure-evidence.test.js tests/openapi-contract-consistency.test.js tests/runtime-contract-governance.test.js tests/heavy-endpoint-governance.test.js tests/logging.test.js`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test -- --silent`
- `npm run build`
- `git status --short`
- `npm run build`
- `npm run typecheck`
- `npm run lint`
- `npm run test -- --silent`
- `node --test tests/openapi-contract-consistency.test.js tests/runtime-contract-governance.test.js`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test -- --silent`
- `npm run build`
- `node --test tests/rawunsafe-inventory-governance.test.js`
- `npm run test -- --silent`
- `node --test tests/throttle-store.test.js tests/lot-datetime-characterization.test.js tests/rawunsafe-inventory-governance.test.js`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `node --test tests/throttle-store.test.js tests/lot-datetime-characterization.test.js tests/rawunsafe-inventory-governance.test.js`
- `npm run test -- --silent`

## 10. Validation results
- Baseline established before changes.
- `TASK-001`, `TASK-002`, `TASK-003`, `TASK-004`, `TASK-005`, `TASK-006`, `TASK-007` and `TASK-008` now pass their documented validation evidence.
- No free-form `RawUnsafe` usage remains in `inventory-api/src/`.
- The inventory/guard now captures the remaining non-runtime `RawUnsafe` surfaces still visible in scripts, tests and docs.
- The client-document flow now has executable characterization for the critical partial-failure branches required by `FR-003`/`AC-002`.
- The payment-receipt flow now has executable characterization for receipt-file persistence, DB failure compensation, failed payment rollback and replacement cleanup branches required by `FR-003`/`AC-002`.
- The runtime now emits governed heavy-endpoint metadata for the approved prioritized route set without logging payload bodies.
- A machine-readable heavy-endpoint baseline and drift test suite now satisfy the initial factual-governance requirement for `FR-004`/`FR-005`/`AC-003`.
- The repository now has an explicit machine-readable contract manifest and a human-readable runtime catalog (`inventory-api/docs/runtime-endpoint-catalog.md`) so every mounted router operation is classified as OpenAPI-covered or intentionally excluded, satisfying `FR-006`/`FR-007`/`AC-004`.
- The repository now has a consolidated P7 evidence entrypoint in `docs/p7-risk-closure-evidence.md`, with reproducible validation commands and explicit explanation of the 2 expected environment-gated skips, satisfying `AC-005`.
- Lint, typecheck, build and the full automated test suite pass after the new characterization, heavy-endpoint governance, contract-governance and evidence-consolidation coverage.

## 11. Existing failures
- Pre-implementation: `npm run build` initially failed with a local Windows Prisma generate `EPERM` rename error in the workspace.
- Post-implementation reruns: `npm run build` passed without any build-specific code change, confirming the earlier failure was environmental/transient.
- Full test suite still emits expected audit/database warning logs in scenarios intentionally exercising unavailable local DB dependencies, but the suite passes.
- Some tests now resolve Prisma/audit fallback failures against `db:5432` because the local `.env` was aligned to Docker during environment setup; those warnings remain non-blocking for the stubbed suites that intentionally do not require a host-level DB.

## 12. New failures
- `node --test tests/rawunsafe-inventory-governance.test.js` initially failed because the repository had compatible drift not captured by the prior current-state analysis: `inventory-api/tests/lot-datetime-characterization.test.js` also exposed a test-only `$executeRawUnsafe` stub.
- `node --test tests/throttle-store.test.js tests/lot-datetime-characterization.test.js tests/rawunsafe-inventory-governance.test.js` initially failed after the runtime hardening because the inventory transaction stub needed to capture tagged-template arguments instead of a Prisma SQL object.
- `npm run build` failed once again with the known transient Windows Prisma generate `EPERM` rename error and passed on immediate rerun without code changes.
- All of those failures were corrected or classified in-scope and the reruns passed.

## 13. Deviations from the approved plan
- No scope deviation.
- Implementation added an executable governance test in addition to the documented manual inventory review. This is compatible with the task's optional guard-script allowance.
- The canonical inventory document now records both historical identified occurrences and their current remediation status so it remains useful after runtime hardening.

## 14. Remaining risks
- Relevant P7 files already have pre-existing local modifications, so subsequent tasks must remain tightly scoped.
- `RawUnsafe` remains present in inventoried non-runtime surfaces (`scripts`, `tests/p2-hardening-constraints.test.js`, `prisma/migration-instructions.md`) until later governance work chooses whether to harden or leave them accepted for this phase.
- `TASK-004` intentionally preserves the current client-document defect where a successful file write followed by a final DB update failure leaves a private file and a pending DB record; this is now visible to future tasks rather than silently masked.
- `TASK-005` intentionally preserves two current payment-receipt risks that are now explicit and regression-tested: payment cleanup failure after receipt persistence failure, and orphaned receipt files when best-effort file cleanup itself fails.
- The heavy-endpoint baseline is representative rather than production-captured, so future tasks may still need to refine how closely fixture-driven logical volume maps to real tenant data distributions.
- The runtime contract guard currently relies on regex discovery of route definitions in `src/app.js` and `src/routes/*.routes.js`; if route declaration style changes materially, the guard will need maintenance.
- The 2 skipped integration-style tests remain environment-gated and require explicit DB URLs to run; they are documented but still depend on external setup.

## 15. Manual validation
- Manual review confirmed that `inventory-api/src/lib/throttle-store.js` now fails fast on unsupported table identifiers and uses governed parameterized raw execution for all shared throttle operations.
- Manual review confirmed that `inventory-api/src/services/inventory.service.js` now routes the advisory lock through a narrow fixed-SQL helper without altering the surrounding stock-entry workflow.
- Manual review confirmed that `specs/p7-9-5-risk-closure/rawunsafe-inventory.md` records both the historical discovery and the current remediation status of each identified surface.
- Manual review confirmed that the new client-document tests describe the DB/filesystem outcome for each failure branch and explicitly preserve the currently unsafe final-update branch as characterization evidence rather than silently changing runtime behavior.
- Manual review confirmed that the new payment-receipt tests describe both safe compensation branches and currently accepted residual orphan/rollback-failure branches without silently redesigning the payment flow.
- Manual review confirmed that the heavy-endpoint middleware only records aggregate metadata (`endpointKey`, `routePattern`, `payloadClass`, `responseShape`, `responseBytes`, `resultCount`) and does not serialize sensitive payload bodies into logs.
- Manual review confirmed that `docs/openapi/runtime-baseline.openapi.json`, `docs/runtime-contract-manifest.json` and `docs/runtime-endpoint-catalog.md` now have distinct factual roles and that the uncovered runtime routes are explicitly justified rather than silently undocumented.
- Manual review confirmed that `README.md` and `docs/p7-risk-closure-evidence.md` now provide an audit-friendly entrypoint to the full P7 evidence set without overstating unsupported scope.

## 16. Next executable task
- None inside the approved `p7-9-5-risk-closure` scope.
