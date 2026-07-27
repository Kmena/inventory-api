# User Requirements

## 1. Overview
Crear un spec aprobado y ejecutable para converger la gobernanza de workflows a una sola fuente oficial en el root del repositorio y corregir el gate `operational-smoke` que hoy falla por invocar `npm run validate:restore-readiness` sin script npm expuesto, dejando además la documentación operativa coherente con el estado real resultante.

## 2. Business objective
Reducir drift de CI/gobernanza y restaurar la confiabilidad del smoke operacional para que GitHub Actions, scripts locales, tests y documentación describan y validen el mismo baseline operativo real.

## 3. User problem
El repositorio ya confirmó que GitHub Actions hospedado usa `/.github/workflows/` como ruta oficial, pero aún conserva una copia duplicada en `inventory-api/.github/workflows/`. Esa duplicación crea deuda de mantenibilidad y riesgo de drift.

Además, el workflow oficial `/.github/workflows/operational-smoke.yml` invoca `npm run validate:restore-readiness`, pero `inventory-api/package.json` no expone ese script. El job falla aunque sí existe `scripts/validate-restore-readiness.js` y documentación que lo referencia.

También existe inconsistencia documental/técnica adicional: el runbook público habla de `docs/restore-readiness-baseline.md`, mientras que el validador y varios tests caracterizan artefactos opcionales bajo `internal-docs/`.

## 4. Actors
- Maintainer de plataforma / CI
- Backend maintainer
- Reviewer de arquitectura
- QA / reviewer de evidencia operativa
- SDD Implementation Agent

## 5. Functional requirements
### FR-001
La solución debe declarar `/.github/workflows/` como la única fuente oficial de definición de workflows versionados del repositorio.

### FR-002
La solución debe eliminar la dependencia funcional de `inventory-api/.github/workflows/` como árbol duplicado de workflows.

### FR-003
La solución debe actualizar scripts, tests y validadores para leer y validar únicamente el árbol oficial de workflows en el root.

### FR-004
La solución debe definir explícitamente qué hacer con `inventory-api/.github/workflows/`: eliminarlo del repositorio o dejarlo fuera de uso con justificación aprobada. El objetivo preferido de este spec es eliminarlo.

### FR-005
La solución debe corregir el workflow `operational-smoke` para que no falle por invocar un script npm inexistente.

### FR-006
La solución debe preservar el gate de restore readiness como capacidad operativa explícita si ya existe implementación suficiente en `scripts/validate-restore-readiness.js`; en ese caso debe exponerse mediante un script npm válido.

### FR-007
Si la capacidad de restore readiness no estuviera realmente implementada o fuera inconsistente para su uso como gate, la solución debe documentar y aprobar explícitamente una reducción temporal del gate. Este spec parte de la evidencia actual de que sí existe implementación base y prefiere conservar el gate.

### FR-008
La solución debe reconciliar el contrato documental de restore readiness para que workflow, package scripts, tests, validadores y documentación apunten al mismo conjunto de artefactos soportados.

### FR-009
La solución debe actualizar la documentación de arquitectura, current-state, tasks, runbooks y spec docs para reflejar:
- root workflows como única fuente oficial;
- eliminación del árbol duplicado o su retiro funcional;
- comportamiento real del gate `validate:restore-readiness`.

### FR-010
La solución debe preservar el comportamiento externo de la aplicación, sin cambios de API ni cambios funcionales de negocio no relacionados.

### FR-011
La solución debe mantener la validación del workflow Windows Prisma y del resto de workflows oficiales ya alineados a Node 24.

### FR-012
La solución debe dejar trazabilidad explícita a `p11-node24-runtime-migration`, ya que este spec corrige deuda residual detectada después del cierre de ese substream.

## 6. Non-functional requirements
### NFR-001
Los cambios deben ser pequeños, enfocados y limitados a gobernanza/CI/scripts/tests/docs.

### NFR-002
La solución no debe reabrir la migración Node 24 ni introducir upgrades amplios de dependencias.

### NFR-003
La validación debe ser reproducible localmente y, cuando aplique, mediante evidencia de GitHub Actions hospedado.

### NFR-004
La documentación final debe permitir a otro agente identificar sin ambigüedad dónde viven los workflows oficiales y cómo se valida restore readiness.

### NFR-005
La solución no debe depender de documentación privada opcional para que el workflow público obligatorio pase, salvo que la omisión esté aprobada y explícitamente modelada como skip controlado.

## 7. Business rules
### BR-001
El repositorio no debe mantener dos fuentes activas de verdad para workflows oficiales.

### BR-002
Un gate obligatorio de GitHub Actions no debe llamar un script npm inexistente.

### BR-003
La documentación operativa versionada no debe prometer un artefacto o comando que el repositorio no pueda ejecutar de forma coherente.

### BR-004
No se deben introducir cambios de negocio, API o base de datos para resolver este spec.

## 8. Acceptance criteria
### AC-001
Given el árbol oficial de workflows en `/.github/workflows/` When se implemente este spec Then scripts, tests y validadores usan solo esa ruta como source of truth.

### AC-002
Given la duplicación actual bajo `inventory-api/.github/workflows/` When se implemente este spec Then el árbol duplicado es eliminado o queda fuera de uso con justificación explícita aprobada; la opción objetivo es eliminarlo.

### AC-003
Given el workflow `operational-smoke` actual When se implemente este spec Then deja de fallar por `Missing script: "validate:restore-readiness"`.

### AC-004
Given la capacidad existente `scripts/validate-restore-readiness.js` When se implemente este spec Then `package.json` expone un script npm válido y documentado para ejecutarla, salvo decisión aprobada en contrario.

### AC-005
Given la documentación operativa actual When se implemente este spec Then runbook, production baseline, restore readiness baseline, tests y validadores quedan alineados sobre el mismo contrato documental soportado.

### AC-006
Given los workflows oficiales root alineados a Node 24 When se validen los cambios Then no se introducen regresiones no aprobadas en `validate:workflow-baseline`, tests de workflow governance, ni `operational-smoke`.

### AC-007
Given la revisión final del spec When se inspeccione la trazabilidad Then el trabajo queda enlazado a `p11-node24-runtime-migration` como follow-up de gobernanza y smoke readiness.

## 9. Constraints
- No cambiar contratos de API ni comportamiento funcional del dominio.
- No reintroducir el árbol duplicado como fuente secundaria activa de workflows.
- No inventar un script placeholder vacío de restore readiness; si el gate se conserva, debe usar la implementación real existente.
- No depender de aprobación implícita: si el gate de restore readiness debe reducirse, debe documentarse como decisión explícita.
- No mezclar este spec con hardening no relacionado de repositorios, tenant isolation o rediseño arquitectónico amplio.

## 10. Assumptions
- `/.github/workflows/` ya es la ruta ejecutada por GitHub Actions hospedado.
- `scripts/validate-restore-readiness.js` representa una implementación base real y utilizable del gate de restore readiness.
- La ausencia del script npm en `package.json` es el fallo inmediato que rompe `operational-smoke`.
- Parte de la deuda actual proviene de una transición incompleta entre documentación pública `docs/` y artefactos opcionales `internal-docs/`.

## 11. Open questions
### OQ-001
¿La fuente documental canónica para restore readiness debe quedar en `docs/` o en `internal-docs/` con un modelo opcional explícito?
- Recomendación del spec: preferir artefactos versionados en `docs/` para el contrato público que el workflow obligatorio necesita validar.

### OQ-002
¿El árbol `inventory-api/.github/workflows/` debe eliminarse físicamente o puede reemplazarse por una nota/README mínima que explique su retiro?
- Recomendación del spec: eliminar los YAML duplicados y actualizar referencias.

## 12. Out of scope
- Rediseño general de CI más allá de la convergencia root-only.
- Cambios de negocio, rutas HTTP o modelos Prisma.
- Nuevos controles operativos enterprise no ya insinuados por el baseline actual.
- Expansión de restore readiness más allá de alinear el contrato ya existente y su gate actual.
