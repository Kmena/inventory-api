# Traceability

| Requirement | Architecture component | Task | Validation |
|---|---|---|---|
| FR-001 | inventario histórico de root-specs | TASK-001 | revisión del lote |
| FR-002 | matriz de procedencia recuperada/no recuperada | TASK-002 | revisión documental |
| FR-003 | batch de revert/documentación | TASK-003 | `git status --short` |
| FR-004 | batch de revert/documentación | TASK-003 | revisión post-batch |
| FR-005 | evidencia final del lote | TASK-004 | revisión final |

## Task implementation status
| Task | Status | Implementation files | Validation |
|---|---|---|---|
| TASK-001 | Completed | `specs/p7-historical-root-spec-drift/historical-root-spec-inventory.md`, `specs/p7-historical-root-spec-drift/implementation-report.md`, `specs/p7-historical-root-spec-drift/tasks.md`, `specs/p7-historical-root-spec-drift/traceability.md` | `git diff --name-only`, `git diff --stat`, `git diff` for batch files |
| TASK-002 | Completed | `specs/p7-historical-root-spec-drift/historical-root-spec-provenance.md`, `specs/p7-historical-root-spec-drift/implementation-report.md`, `specs/p7-historical-root-spec-drift/tasks.md`, `specs/p7-historical-root-spec-drift/traceability.md` | repository-visible provenance recovery review |
| TASK-003 | Completed | `specs/p7-drift-fix/drift-inventory.md`, `specs/p7-historical-root-spec-drift/historical-root-spec-provenance.md`, `specs/p7-historical-root-spec-drift/implementation-report.md`, `specs/p7-historical-root-spec-drift/tasks.md`, `specs/p7-historical-root-spec-drift/traceability.md` | `git status --short`, upstream drift regularization review |
| TASK-004 | Completed | `specs/p7-historical-root-spec-drift/current-state.md`, `specs/p7-historical-root-spec-drift/historical-root-spec-inventory.md`, `specs/p7-historical-root-spec-drift/historical-root-spec-provenance.md`, `specs/p7-historical-root-spec-drift/implementation-report.md`, `specs/p7-historical-root-spec-drift/tasks.md`, `specs/p7-historical-root-spec-drift/traceability.md`, `specs/p7-drift-fix/drift-inventory.md` | final documentation review, `git status --short` |

## Decision-to-task mapping
- DEC-001 -> TASK-001, TASK-002
- DEC-002 -> TASK-003, TASK-004
- DEC-003 -> TASK-002, TASK-003
