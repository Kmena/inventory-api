# User Requirements

## 1. Overview
Crear un spec para converger `validate:operational-readiness` a un contrato público y versionado bajo `inventory-api/docs/`, eliminando la dependencia funcional de overlays opcionales `internal-docs/` para este gate, y cerrar de forma verificable el tema de `.env.production.example` para que su existencia, uso y documentación queden correctos y auditables.

## 2. Business objective
Completar la coherencia del baseline operativo público del repositorio para que los validadores de readiness, los workflows oficiales, los scripts npm y la documentación operativa describan el mismo contrato reproducible sin depender de artefactos privados opcionales.

## 3. User problem
Tras reparar `validate:restore-readiness`, el repositorio todavía mantiene una diferencia importante:
- `validate:restore-readiness` ya usa artefactos públicos en `docs/`;
- `validate:operational-readiness` todavía depende de `internal-docs/production-operations-runbook.md` e `internal-docs/production-baseline.md` y puede hacer skip en modo público.

Además, un auditor reportó que la documentación referenciaba `.env.production.example` sin encontrarlo. La inspección actual del repositorio sí confirma la existencia de `inventory-api/.env.production.example`, por lo que ahora hace falta cerrar ese punto de forma explícita, ya sea reforzando validación/documentación o corrigiendo cualquier referencia ambigua.

## 4. Actors
- Maintainer de plataforma / CI
- Backend maintainer
- Reviewer de arquitectura
- QA / reviewer de evidencia operativa
- SDD Implementation Agent

## 5. Functional requirements
### FR-001
La solución debe hacer que `validate:operational-readiness` valide un contrato público respaldado por artefactos versionados en `inventory-api/docs/`.

### FR-002
La solución debe eliminar la dependencia funcional obligatoria de `internal-docs/production-operations-runbook.md` y `internal-docs/production-baseline.md` para el gate público `validate:operational-readiness`.

### FR-003
La solución debe definir explícitamente si `internal-docs/` permanece solo como overlay opcional no bloqueante o deja de ser relevante para este gate.

### FR-004
La solución debe actualizar scripts, tests, docs y runbooks para que `validate:operational-readiness` y `validate:restore-readiness` se apoyen en un modelo documental público coherente.

### FR-005
La solución debe confirmar y documentar correctamente el estado de `.env.production.example` como artefacto versionado requerido por el baseline operativo, o corregir cualquier referencia si el contrato real fuera distinto.

### FR-006
La solución debe, cuando sea adecuado, reforzar validación automatizada o tests para que futuras auditorías no vuelvan a marcar ambiguamente el estado de `.env.production.example`.

### FR-007
La solución debe preservar el workflow oficial `operational-smoke` y su baseline Node 24 ya aprobado.

### FR-008
La solución no debe cambiar comportamiento funcional de negocio, rutas API ni schema Prisma.

### FR-009
La solución debe actualizar la documentación de arquitectura/current-state/tasks para reflejar el modelo final de operational readiness público.

### FR-010
La solución debe mantener trazabilidad explícita a `p11-workflow-governance-and-restore-readiness`.

## 6. Non-functional requirements
### NFR-001
Los cambios deben mantenerse acotados a gobernanza operativa, scripts, tests y documentación.

### NFR-002
La solución debe hacer el baseline público más reproducible para otros agentes y maintainers sin acceso a overlays privados.

### NFR-003
La validación final debe incluir evidencia local reproducible y, cuando sea posible, evidencia hosted del workflow `operational-smoke`.

## 7. Business rules
### BR-001
Un gate público obligatorio no debe depender de artefactos privados opcionales para considerarse válido.

### BR-002
La documentación pública del baseline operativo debe corresponder con archivos realmente versionados en el repositorio.

### BR-003
`.env.production.example` debe tratarse como artefacto versionado explícito si forma parte del contrato documentado del baseline productivo.

## 8. Acceptance criteria
### AC-001
Given el validador actual de operational readiness When se implemente este spec Then ya no depende funcionalmente de `internal-docs/` para validar el baseline público.

### AC-002
Given la documentación pública de producción y operaciones When se implemente este spec Then queda alineada con el mismo contrato público que valida `validate:operational-readiness`.

### AC-003
Given `.env.production.example` When se cierre este spec Then su existencia y rol contractual quedan confirmados por documentación y/o validación automatizada, eliminando ambigüedad de auditoría.

### AC-004
Given el workflow `operational-smoke` When se valide este spec Then sigue ejecutando un baseline operacional coherente sin regresiones no aprobadas.

### AC-005
Given la revisión final del spec When se inspeccione la trazabilidad Then el trabajo queda enlazado al follow-up previo de workflow governance/restore readiness.

## 9. Constraints
- No introducir cambios funcionales de aplicación.
- No mezclar este spec con hardening no relacionado.
- No reabrir la migración Node 24.
- No dejar ambigüedad entre docs públicos y overlays privados para el gate operativo final.

## 10. Assumptions
- `inventory-api/.env.production.example` existe actualmente y forma parte del baseline operativo documentado.
- La convergencia de `validate:operational-readiness` a `docs/` es técnicamente viable sin cambiar comportamiento funcional del runtime.
- `internal-docs/` puede seguir existiendo como overlay opcional, pero no debería seguir siendo prerrequisito del gate público.

## 11. Resolved question
### OQ-001
**Decision provided by human direction:** `validate:operational-readiness` debe apoyarse inicialmente en los mismos dos documentos públicos base, `docs/production-baseline.md` y `docs/production-operations-runbook.md`.

**Create a third public document only if implementation reveals one of these signals:**
- el validador necesita reglas operativas que no caben claramente en los 2 docs actuales;
- observabilidad, hardening y readiness quedan mezclados de forma confusa;
- los tests/documentación terminan demasiado ambiguos para auditar.

## 12. Out of scope
- Reestructuración completa de todos los validadores opcionales basados en `internal-docs/`.
- Cambios de negocio o APIs.
- Nuevos requerimientos enterprise fuera del baseline operativo ya documentado.
