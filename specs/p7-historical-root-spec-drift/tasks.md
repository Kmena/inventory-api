# Implementation Tasks
## TASK-001: Inventariar diffs del lote histórico
**Status:** Completed
**Completed at:** 2026-07-22
**Implemented files:**
- `specs/p7-historical-root-spec-drift/historical-root-spec-inventory.md`
- `specs/p7-historical-root-spec-drift/implementation-report.md`
- `specs/p7-historical-root-spec-drift/tasks.md`
- `specs/p7-historical-root-spec-drift/traceability.md`
**Validation evidence:**
- `git diff --name-only -- <batch files>`
- `git diff --stat -- <batch files>`
- `git diff -- <batch files>`
**Objective:** Abrir y registrar el diff de cada root-spec driftado.
**Affected areas:**
- archivos de `BATCH-HISTORICAL-ROOT-SPECS`
**Dependencies:**
- None
**Tests:**
- Revisión manual
**Acceptance criteria:**
- [ ] Cada archivo del lote tiene diff revisado.
- [ ] El lote está completo.
- [ ] No hay archivos históricos fuera del inventario.

## TASK-002: Recuperar o descartar procedencia por archivo
**Status:** Completed
**Completed at:** 2026-07-22
**Implemented files:**
- `specs/p7-historical-root-spec-drift/historical-root-spec-provenance.md`
- `specs/p7-historical-root-spec-drift/implementation-report.md`
- `specs/p7-historical-root-spec-drift/tasks.md`
- `specs/p7-historical-root-spec-drift/traceability.md`
**Validation evidence:**
- repository-visible evidence review across related spec documents
- file-level provenance matrix in `historical-root-spec-provenance.md`
**Objective:** Determinar si cada cambio puede respaldarse con evidencia exacta.
**Affected areas:**
- root specs afectadas
- reportes/traceability/changelog históricos
**Dependencies:**
- TASK-001
**Tests:**
- Revisión documental
**Acceptance criteria:**
- [ ] Cada archivo queda marcado como recuperable o no recuperable.
- [ ] La decisión usa evidencia verificable.
- [ ] No se acepta procedencia por intuición.

## TASK-003: Ejecutar regularización del lote histórico
**Status:** Completed
**Completed at:** 2026-07-22
**Implemented files:**
- `specs/p7-drift-fix/drift-inventory.md`
- `specs/p7-historical-root-spec-drift/historical-root-spec-provenance.md`
- `specs/p7-historical-root-spec-drift/implementation-report.md`
- `specs/p7-historical-root-spec-drift/tasks.md`
- `specs/p7-historical-root-spec-drift/traceability.md`
**Validation evidence:**
- `git status --short`
- documented regularization in `specs/p7-drift-fix/drift-inventory.md`
**Objective:** Conservar documentando o revertir según procedencia.
**Affected areas:**
- archivos históricos afectados
**Dependencies:**
- TASK-002
**Tests:**
- `git status --short`
**Acceptance criteria:**
- [ ] Los archivos sin procedencia suficiente fueron revertidos o bloqueados explícitamente.
- [ ] Los archivos conservados tienen procedencia documentada.
- [ ] El lote deja de ser drift ambiguo.

## TASK-004: Consolidar evidencia final
**Status:** Completed
**Completed at:** 2026-07-22
**Implemented files:**
- `specs/p7-historical-root-spec-drift/current-state.md`
- `specs/p7-historical-root-spec-drift/historical-root-spec-inventory.md`
- `specs/p7-historical-root-spec-drift/historical-root-spec-provenance.md`
- `specs/p7-historical-root-spec-drift/implementation-report.md`
- `specs/p7-historical-root-spec-drift/tasks.md`
- `specs/p7-historical-root-spec-drift/traceability.md`
- `specs/p7-drift-fix/drift-inventory.md`
**Validation evidence:**
- final documentation review
- `git status --short`
**Objective:** Dejar cierre documental del batch histórico.
**Affected areas:**
- `specs/p7-historical-root-spec-drift/*`
- `specs/p7-drift-fix/*`
**Dependencies:**
- TASK-003
**Tests:**
- Revisión final
**Acceptance criteria:**
- [ ] Existe reporte final del lote.
- [ ] Otro agente puede verificar qué se conservó y qué se revirtió.
- [ ] La trazabilidad quedó actualizada.
