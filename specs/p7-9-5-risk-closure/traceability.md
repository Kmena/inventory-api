# Traceability

## Requirements to architecture to tasks matrix
| Requirement | Architecture component | Implementation plan step | Task | Validation/Test |
|---|---|---|---|---|
| FR-001 | SQL raw governance layer | Step 1 | TASK-001 | Repo-wide inventory review / optional guard script |
| FR-002 | SQL raw governance layer | Step 2 | TASK-002, TASK-003 | `tests/throttle-store.test.js` + runtime SQL governance tests |
| FR-003 | Partial-failure characterization suite | Step 3 | TASK-004, TASK-005 | `tests/client-document-security.test.js`, `tests/payment-receipt-security.test.js` |
| FR-004 | Heavy-endpoint measurement/governance layer | Step 4 | TASK-006 | Baseline script/test for prioritized endpoints |
| FR-005 | Heavy-endpoint measurement/governance layer | Step 4, Step 6 | TASK-006, TASK-008 | Drift validation + documentation review |
| FR-006 | Contract scope manifest | Step 5 | TASK-007 | `tests/openapi-contract-consistency.test.js` + exhaustive route classification test |
| FR-007 | Contract scope manifest + governance tests | Step 4, Step 5, Step 6 | TASK-006, TASK-007, TASK-008 | Drift suite for runtime, OpenAPI and manifest |
| NFR-001 | Incremental architecture alignment | Step 2 | TASK-003 | Code review against current architecture |
| NFR-002 | Compatibility preservation | Steps 2-5 | TASK-003, TASK-004, TASK-005, TASK-007 | Regression tests on existing flows |
| NFR-003 | Versioned executable evidence | Steps 3-6 | TASK-004, TASK-005, TASK-006, TASK-007, TASK-008 | Executable tests/scripts committed |
| NFR-004 | Safe observability | Step 4 | TASK-006 | Logging/metrics tests ensure no sensitive payload capture |
| NFR-005 | Explicit facts/exclusions | Steps 5-6 | TASK-007, TASK-008 | Manual review + contract tests |
| AC-001 | SQL raw governance layer | Steps 1-2 | TASK-001, TASK-002, TASK-003 | Inventory review + runtime governance tests |
| AC-002 | Partial-failure characterization suite | Step 3 | TASK-004, TASK-005 | Partial-failure tests |
| AC-003 | Heavy-endpoint measurement/governance layer | Step 4 | TASK-006 | Baseline/drift validation |
| AC-004 | Contract scope manifest | Step 5 | TASK-007 | Runtime/OpenAPI/manifest classification tests |
| AC-005 | Cross-cutting evidence package | Step 6 | TASK-008 | Final documentation + suite rerun |

## Requirement coverage check
### Functional requirements
- FR-001 covered by TASK-001
- FR-002 covered by TASK-002 and TASK-003
- FR-003 covered by TASK-004 and TASK-005
- FR-004 covered by TASK-006
- FR-005 covered by TASK-006 and TASK-008
- FR-006 covered by TASK-007
- FR-007 covered by TASK-006, TASK-007 and TASK-008

### Business rules
- BR-001 covered by TASK-007
- BR-002 covered by TASK-007
- BR-003 covered by TASK-004 and TASK-005
- BR-004 covered by TASK-002 and TASK-003
- BR-005 covered by TASK-006

## Decision-to-task mapping
| Decision | Affected tasks |
|---|---|
| DEC-001 / DEC-002 | TASK-001, TASK-002, TASK-003 |
| DEC-003 | TASK-001, TASK-008 |
| DEC-004 | TASK-004, TASK-005 |
| DEC-005 | TASK-006 |
| DEC-006 | TASK-006, TASK-008 |
| DEC-007 / DEC-008 | TASK-007, TASK-008 |
| DEC-009 | TASK-003, TASK-004, TASK-005, TASK-007 |

## File-level handoff map
- `requirements.md`: approved user intent and acceptance criteria
- `current-state.md`: evidence-backed repository analysis for implementers
- `architecture.md`: target solution shape and design constraints
- `implementation-plan.md`: ordered execution path
- `tasks.md`: executable implementation work packages
- `decisions.md`: approved scope and policy decisions
- `traceability.md`: requirement-to-task-to-test mapping
- `implementation-handoff.md`: concise execution brief for the implementation agent
- `metadata.yaml`: package status and inventory

## Task implementation status
| Task | Status | Implementation files | Tests | Evidence |
|---|---|---|---|---|
| TASK-001 | Completed | `specs/p7-9-5-risk-closure/rawunsafe-inventory.md`, `inventory-api/tests/rawunsafe-inventory-governance.test.js` | `inventory-api/tests/rawunsafe-inventory-governance.test.js` | `node --test tests/rawunsafe-inventory-governance.test.js`, `npm run test -- --silent`, `npm run lint`, `npm run typecheck`, `npm run build` |
| TASK-002 | Completed | `specs/p7-9-5-risk-closure/rawunsafe-remediation-strategy.md`, `specs/p7-9-5-risk-closure/rawunsafe-inventory.md` | `inventory-api/tests/throttle-store.test.js`, `inventory-api/tests/lot-datetime-characterization.test.js`, `inventory-api/tests/rawunsafe-inventory-governance.test.js` | `node --test tests/throttle-store.test.js tests/lot-datetime-characterization.test.js tests/rawunsafe-inventory-governance.test.js` |
| TASK-003 | Completed | `inventory-api/src/lib/throttle-store.js`, `inventory-api/src/services/inventory.service.js`, `inventory-api/tests/throttle-store.test.js`, `inventory-api/tests/lot-datetime-characterization.test.js`, `inventory-api/tests/rawunsafe-inventory-governance.test.js`, `specs/p7-9-5-risk-closure/rawunsafe-inventory.md` | `inventory-api/tests/throttle-store.test.js`, `inventory-api/tests/lot-datetime-characterization.test.js`, `inventory-api/tests/rawunsafe-inventory-governance.test.js` | `node --test tests/throttle-store.test.js tests/lot-datetime-characterization.test.js tests/rawunsafe-inventory-governance.test.js`, `npm run test -- --silent`, `npm run lint`, `npm run typecheck`, `npm run build` |
| TASK-004 | Completed | `inventory-api/tests/client-document-security.test.js` | `inventory-api/tests/client-document-security.test.js` | `node --test tests/client-document-security.test.js`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test -- --silent` |
| TASK-005 | Completed | `inventory-api/tests/payment-receipt-security.test.js` | `inventory-api/tests/payment-receipt-security.test.js` | `node --test tests/payment-receipt-security.test.js`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test -- --silent` |
| TASK-006 | Completed | `inventory-api/src/lib/heavy-endpoint-governance.js`, `inventory-api/src/middlewares/heavy-endpoint-metrics.js`, `inventory-api/src/lib/logging.js`, `inventory-api/src/app.js`, `inventory-api/docs/heavy-endpoints-baseline.json`, `inventory-api/docs/heavy-endpoints-baseline.md`, `inventory-api/tests/heavy-endpoint-governance.test.js`, `inventory-api/tests/logging.test.js` | `inventory-api/tests/heavy-endpoint-governance.test.js`, `inventory-api/tests/logging.test.js` | `node --test tests/heavy-endpoint-governance.test.js tests/logging.test.js`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test -- --silent` |
| TASK-007 | Completed | `inventory-api/docs/openapi/runtime-baseline.openapi.json`, `inventory-api/docs/runtime-contract-manifest.json`, `inventory-api/docs/runtime-endpoint-catalog.md`, `inventory-api/tests/openapi-contract-consistency.test.js`, `inventory-api/tests/runtime-contract-governance.test.js` | `inventory-api/tests/openapi-contract-consistency.test.js`, `inventory-api/tests/runtime-contract-governance.test.js` | `node --test tests/openapi-contract-consistency.test.js tests/runtime-contract-governance.test.js`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test -- --silent` |
| TASK-008 | Completed | `inventory-api/README.md`, `inventory-api/docs/p7-risk-closure-evidence.md`, `inventory-api/tests/p7-risk-closure-evidence.test.js`, `specs/p7-9-5-risk-closure/tasks.md`, `specs/p7-9-5-risk-closure/traceability.md`, `specs/p7-9-5-risk-closure/implementation-report.md`, `CHANGELOG.md` | `inventory-api/tests/p7-risk-closure-evidence.test.js`, `inventory-api/tests/openapi-contract-consistency.test.js`, `inventory-api/tests/runtime-contract-governance.test.js`, `inventory-api/tests/heavy-endpoint-governance.test.js`, `inventory-api/tests/logging.test.js` | `node --test tests/p7-risk-closure-evidence.test.js tests/openapi-contract-consistency.test.js tests/runtime-contract-governance.test.js tests/heavy-endpoint-governance.test.js tests/logging.test.js`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test -- --silent` |

## Implementation readiness notes
- The spec is approved for implementation.
- No open scope questions remain for the initial P7 phase.
- `TASK-001`, `TASK-002`, `TASK-003`, `TASK-004`, `TASK-005`, `TASK-006`, `TASK-007` and `TASK-008` are completed.
- No further executable task remains inside the approved P7 scope.
