# Traceability

| Requirement | Architecture component | Task | Validation |
|---|---|---|---|
| FR-001 | reconfirmación de inventario | TASK-001 | revisión inventario |
| FR-002 | sublote runtime cliente/pagos + sublote rawunsafe | TASK-002, TASK-003 | suites focalizadas P7 |
| FR-003 | evidence/documentation final | TASK-002, TASK-003, TASK-004 | lint/typecheck/test/build relevantes |
| FR-004 | sublote evidencia/documentación final | TASK-004, TASK-005 | evidence tests + revisión final |
| FR-005 | boundary enforcement | TASK-001, TASK-005 | revisión de alcance |

## Task implementation status
| Task | Status | Implementation files | Validation |
|---|---|---|---|
| TASK-001 | Completed | `specs/p7-drift-carry-forward/p7-linked-inventory.md`, `specs/p7-drift-carry-forward/implementation-report.md`, `specs/p7-drift-carry-forward/tasks.md`, `specs/p7-drift-carry-forward/traceability.md` | `git diff --name-only`, `git diff --stat`, `git status --short` |
| TASK-002 | Completed | `specs/p7-drift-carry-forward/p7-validation-summary.md`, `specs/p7-drift-carry-forward/implementation-report.md`, `specs/p7-drift-carry-forward/tasks.md`, `specs/p7-drift-carry-forward/traceability.md` | client/payment focused tests, lint, typecheck, build |
| TASK-003 | Completed | `specs/p7-drift-carry-forward/p7-validation-summary.md`, `specs/p7-drift-carry-forward/implementation-report.md`, `specs/p7-drift-carry-forward/tasks.md`, `specs/p7-drift-carry-forward/traceability.md` | RawUnsafe governance tests, lint, typecheck |
| TASK-004 | Completed | `specs/p7-drift-carry-forward/p7-validation-summary.md`, `specs/p7-drift-carry-forward/implementation-report.md`, `specs/p7-drift-carry-forward/tasks.md`, `specs/p7-drift-carry-forward/traceability.md` | evidence test, full suite |
| TASK-005 | Completed | `specs/p7-drift-carry-forward/current-state.md`, `specs/p7-drift-carry-forward/p7-linked-inventory.md`, `specs/p7-drift-carry-forward/p7-validation-summary.md`, `specs/p7-drift-carry-forward/implementation-report.md`, `specs/p7-drift-carry-forward/tasks.md`, `specs/p7-drift-carry-forward/traceability.md`, `specs/p7-drift-fix/drift-inventory.md` | final documentation review, `git status --short` |

## Decision-to-task mapping
- DEC-001 -> TASK-001, TASK-002, TASK-003
- DEC-002 -> TASK-002, TASK-003, TASK-004
- DEC-003 -> TASK-002, TASK-003, TASK-004
- DEC-004 -> TASK-002, TASK-003, TASK-005
