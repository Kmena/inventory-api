# Traceability

| Requirement | Architecture component | Task | Validation |
|---|---|---|---|
| FR-001 | reconfirmación de inventario | TASK-001 | revisión inventario |
| FR-002 | sublote P6 security-contract / sublote P6 ops | TASK-002, TASK-003 | suites por sublote |
| FR-003 | evidence update layer | TASK-002, TASK-003 | revisión de alineación P6 |
| FR-004 | sublotes validados | TASK-002, TASK-003 | lint/typecheck/test/build/checks focalizados |
| FR-005 | evidence update layer | TASK-004 | revisión final |

## Task implementation status
| Task | Status | Implementation files | Validation |
|---|---|---|---|
| TASK-001 | Completed | `specs/p6-drift-carry-forward/p6-linked-inventory.md`, `specs/p6-drift-carry-forward/implementation-report.md`, `specs/p6-drift-carry-forward/tasks.md`, `specs/p6-drift-carry-forward/traceability.md` | `git diff --name-only`, `git diff --stat`, `git status --short` |
| TASK-002 | Completed | `specs/p6-drift-carry-forward/p6-validation-summary.md`, `specs/p6-drift-carry-forward/implementation-report.md`, `specs/p6-drift-carry-forward/tasks.md`, `specs/p6-drift-carry-forward/traceability.md` | auth/throttle/browser tests, lint, typecheck, build with known EPERM note |
| TASK-003 | Completed | `specs/p6-drift-carry-forward/p6-validation-summary.md`, `specs/p6-drift-carry-forward/implementation-report.md`, `specs/p6-drift-carry-forward/tasks.md`, `specs/p6-drift-carry-forward/traceability.md` | production/workflow baseline tests and validators |
| TASK-004 | Completed | `specs/p6-drift-carry-forward/current-state.md`, `specs/p6-drift-carry-forward/p6-linked-inventory.md`, `specs/p6-drift-carry-forward/p6-validation-summary.md`, `specs/p6-drift-carry-forward/implementation-report.md`, `specs/p6-drift-carry-forward/tasks.md`, `specs/p6-drift-carry-forward/traceability.md`, `specs/p7-drift-fix/drift-inventory.md` | final documentation review, `git status --short` |

## Decision-to-task mapping
- DEC-001 -> TASK-001, TASK-002, TASK-003
- DEC-002 -> TASK-002, TASK-003
- DEC-003 -> TASK-002, TASK-003
- DEC-004 -> TASK-002, TASK-003, TASK-004
