# Implementation Plan

## 1. Objective
Converger la gobernanza de workflows a una única fuente oficial en el root del repositorio y reparar el gate `operational-smoke` exponiendo y alineando el contrato real de restore readiness.

## 2. Scope
Incluye:
- retiro del árbol duplicado `inventory-api/.github/workflows/`
- actualización de scripts/tests/validadores a root-only workflow governance
- exposición del script npm `validate:restore-readiness`
- armonización del contrato documental de restore readiness
- actualización de docs/specs/evidencia asociada

Excluye:
- cambios funcionales de aplicación
- upgrades amplios de dependencias
- rediseño completo de CI
- nuevos controles operativos no ya insinuados por el baseline actual

## 3. Preconditions
- `p11-node24-runtime-migration` permanece como baseline previo completado.
- `/.github/workflows/` sigue siendo el árbol realmente ejecutado por GitHub Actions hospedado.
- El script `scripts/validate-restore-readiness.js` existe y puede reutilizarse.
- Este nuevo spec debe recibir aprobación humana antes de implementación.

## 4. Implementation sequence
### Step 1
- Purpose
  - Delimitar todas las referencias activas al árbol duplicado y al contrato actual de restore readiness.
- Changes
  - Inventariar referencias en scripts, tests, docs y specs.
  - Confirmar si `internal-docs/` sigue siendo solo overlay opcional o si bloquea algún gate público.
- Files
  - `scripts/validate-workflow-baseline.js`
  - `scripts/validate-restore-readiness.js`
  - `tests/*.test.js`
  - `docs/*.md`
- Tests
  - búsqueda estática + revisión contractual
- Validation
  - Se conoce exactamente qué referencias deben migrarse.

### Step 2
- Purpose
  - Converger workflow governance a root-only.
- Changes
  - Eliminar `inventory-api/.github/workflows/*.yml`.
  - Actualizar validadores/tests para leer solo `/.github/workflows/`.
  - Eliminar fallback lógico al árbol duplicado.
  - Actualizar docs que aún hablen del mirror local.
- Files
  - `inventory-api/.github/workflows/*`
  - `scripts/validate-workflow-baseline.js`
  - `tests/workflow-baseline-characterization.test.js`
  - `tests/prisma-windows-build-stabilization.test.js`
  - `docs/current-state.md`
  - `docs/architecture.md`
  - `docs/action-plan.md`
  - `docs/tasks.md`
- Tests
  - `npm run validate:workflow-baseline`
  - workflow characterization tests
- Validation
  - Los workflows root quedan como única fuente activa y el baseline sigue validando.

### Step 3
- Purpose
  - Corregir el gate de restore readiness y armonizar el contrato documental asociado.
- Changes
  - Agregar `validate:restore-readiness` a `package.json` apuntando a `scripts/validate-restore-readiness.js`.
  - Ajustar `scripts/validate-restore-readiness.js` y tests para el contrato documental aprobado.
  - Crear o actualizar `docs/restore-readiness-baseline.md` y referencias relacionadas.
  - Confirmar que `operational-smoke` mantiene el gate sobre un comando válido.
- Files
  - `package.json`
  - `scripts/validate-restore-readiness.js`
  - `docs/production-baseline.md`
  - `docs/production-operations-runbook.md`
  - `docs/restore-readiness-baseline.md`
  - `tests/production-baseline-characterization.test.js`
  - `tests/restore-readiness-characterization.test.js`
  - `/.github/workflows/operational-smoke.yml` si requiere ajuste textual menor
- Tests
  - `npm run validate:restore-readiness`
  - tests de production baseline / restore readiness
- Validation
  - El workflow deja de fallar por script faltante y el contrato documental es coherente.

### Step 4
- Purpose
  - Consolidar documentación, trazabilidad y evidencia final.
- Changes
  - Actualizar spec docs, current-state, architecture y reportes.
  - Registrar evidencia local y hosted.
- Files
  - `specs/p11-workflow-governance-and-restore-readiness/*`
  - `docs/current-state.md`
  - `docs/architecture.md`
  - `docs/action-plan.md`
  - `docs/tasks.md`
- Tests
  - review final de evidencia
- Validation
  - El repositorio queda documentado conforme al estado real resultante.

## 5. Database migration plan
No hay migraciones de base de datos.

## 6. Testing plan
- `npm run validate:workflow-baseline`
- `node --test tests/workflow-baseline-characterization.test.js tests/prisma-windows-build-stabilization.test.js`
- `npm run validate:restore-readiness`
- `node --test tests/production-baseline-characterization.test.js tests/restore-readiness-characterization.test.js`
- `git diff --check`
- cuando sea viable, revisión de runs hosted para `operational-smoke` y workflows root afectados

## 7. Deployment considerations
No hay cambios de deploy funcional. Sí cambia la gobernanza operacional al eliminar el árbol duplicado y reactivar el gate real de restore readiness.

## 8. Rollback plan
- Si la eliminación del árbol duplicado rompe validadores o workflows no previstos, revertir solo ese slice y documentar la referencia faltante.
- Si el contrato de restore readiness público no puede completarse de forma coherente, revertir el cambio del gate o documentar explicitamente una reducción aprobada del gate antes de continuar.

## 9. Risks
- Referencias residuales al árbol duplicado.
- Ambigüedad entre `docs/` e `internal-docs/` para restore readiness.
- Posible necesidad de crear documentación pública faltante para soportar el gate.

## 10. Definition of done
- `/.github/workflows/` queda como única fuente oficial activa de workflows.
- `inventory-api/.github/workflows/` queda retirado conforme a la decisión aprobada.
- `operational-smoke` deja de fallar por script npm inexistente.
- `validate:restore-readiness` existe y funciona conforme al contrato aprobado.
- Docs/tests/validadores quedan alineados con el mismo baseline operativo.
- La trazabilidad a `p11-node24-runtime-migration` queda registrada.

## Requirements traceability
| Requirement | Architecture component | Task | Test |
|---|---|---|---|
| FR-001 | root workflow governance | TASK-001 | workflow source review |
| FR-002 | duplicate-tree retirement | TASK-001 | static review + diff review |
| FR-003 | validator/test root-only behavior | TASK-001 | workflow baseline tests |
| FR-004 | duplicate-tree explicit disposition | TASK-001 | repo structure review |
| FR-005 | operational-smoke fix | TASK-002 | hosted/local command validation |
| FR-006 | restore readiness gate preservation | TASK-002 | npm script + validator pass |
| FR-008 | documentation contract alignment | TASK-002, TASK-003 | docs/tests validation |
| FR-009 | architecture/current-state/doc refresh | TASK-003 | documentation review |
| FR-012 | traceability to Node 24 follow-up | TASK-003 | traceability review |
