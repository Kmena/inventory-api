# Traceability

| Requirement | Architecture component | Task | Validation |
|---|---|---|---|
| FR-001 | análisis de diff por bloque | TASK-001 | revisión manual del diff |
| FR-002 | matriz de procedencia P6/P7 | TASK-002 | revisión documental |
| FR-003 | decisión de batch final | TASK-003 | suites P6/P7 focalizadas |
| FR-004 | validación cruzada P6/P7 | TASK-003 | pago/throttle/schema tests |
| FR-005 | evidencia final | TASK-004 | revisión final |

## Task implementation status
| Task | Status | Implementation files | Validation |
|---|---|---|---|
| TASK-001 | Completed | `specs/p7-mixed-provenance-fix/payment-repository-diff.md`, `specs/p7-mixed-provenance-fix/implementation-report.md`, `specs/p7-mixed-provenance-fix/tasks.md`, `specs/p7-mixed-provenance-fix/traceability.md` | `git diff -- inventory-api/src/repositories/payment.repository.js`, manual diff review |
| TASK-002 | Completed | `specs/p7-mixed-provenance-fix/payment-repository-diff.md`, `specs/p7-mixed-provenance-fix/implementation-report.md`, `specs/p7-mixed-provenance-fix/tasks.md`, `specs/p7-mixed-provenance-fix/traceability.md` | review of provenance classification by block |
| TASK-003 | Completed | `specs/p7-mixed-provenance-fix/payment-repository-diff.md`, `specs/p7-mixed-provenance-fix/implementation-report.md`, `specs/p7-mixed-provenance-fix/tasks.md`, `specs/p7-mixed-provenance-fix/traceability.md`, `specs/p7-drift-fix/drift-inventory.md` | `tests/payment-receipt-security.test.js`, `tests/payment-lifecycle-schema-characterization.test.js`, lint, typecheck |
| TASK-004 | Completed | `specs/p7-mixed-provenance-fix/current-state.md`, `specs/p7-mixed-provenance-fix/payment-repository-diff.md`, `specs/p7-mixed-provenance-fix/implementation-report.md`, `specs/p7-mixed-provenance-fix/tasks.md`, `specs/p7-mixed-provenance-fix/traceability.md`, `specs/p7-drift-fix/drift-inventory.md` | final documentation review, `git status --short` |

## Decision-to-task mapping
- DEC-001 -> TASK-001, TASK-002
- DEC-002 -> TASK-002, TASK-003
- DEC-003 -> TASK-003, TASK-004
