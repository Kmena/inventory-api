# Implementation Plan
## 1. Objective
Implementar una mejora incremental del flujo administrativo de recetas para hacer explícito el uso de COUNT/UN, clarificar `quantityBasis`, guiar etapas `PROCESSING` como `CAPPING` y envasado/empaque con `RECOLLECTION` previa, mejorar la revisión visual de versiones y facilitar el descubrimiento de insumos en catálogos grandes, sin modificar el modelo persistido.

## 2. Scope
Incluye:
- copy y hint de `quantityBasis`
- warnings contextuales de compatibilidad COUNT/UN vs base
- labels enriquecidos en selectores de insumos
- filtros o búsqueda cliente-side por categoría, subcategoría, nombre y código sobre el dataset ya cargado
- feedback incremental para cantidades `UN` con warning no bloqueante
- guía inline para `PROCESSING`/`CAPPING`/envasado y ausencia de `RECOLLECTION`
- badges visibles en superficies de revisión
- consistencia de copy/señales en superficies equivalentes de bodega cuando el cambio sea incremental
- pruebas automatizadas asociadas

Excluye:
- cambios de Prisma
- cambios de endpoints
- soporte híbrido por etapa/insumo

## 3. Preconditions
- Mantener intactos los contratos actuales de `recipesApi` y `productsApi`.
- Reusar la metadata ya disponible del producto.
- Política UX resuelta: decimales en `UN` se manejan con warning no bloqueante en esta iteración.

## 4. Implementation sequence
### Step 1
- **Purpose:** establecer línea base de pruebas para las superficies UX a cambiar.
- **Changes:** ampliar characterization tests del root shell de recetas para cubrir copy, labels, warnings y badges esperados.
- **Files:**
  - `tests/root-shell-recipes-admin-view-characterization.test.js`
  - opcionalmente nuevo test de helper si se crean utilidades pequeñas
- **Tests:** characterization/view tests
- **Validation:** la suite debe fallar primero describiendo el comportamiento deseado nuevo.

### Step 2
- **Purpose:** aclarar `quantityBasis` sin alterar persistencia.
- **Changes:** actualizar copy visible del selector, hint principal y mensajes de compatibilidad por base usando lenguaje operativo simple, eliminando “legado” del copy visible.
- **Files:**
  - `src/public/root/views/recipes-admin.renderers.js`
  - `src/public/root/views/recipes-admin.version-editor.js`
  - `src/public/root/views/recipes-admin.helpers.js` si se extraen mensajes
- **Tests:** characterization tests del renderer/editor
- **Validation:** el editor explica claramente cuándo usar kg vs unidad y ya no depende del wording sesgado “legado” como señal principal.

### Step 3
- **Purpose:** enriquecer el selector de insumos y hacer visible la naturaleza discreta del producto.
- **Changes:** formar labels con nombre, código, unidad y metadata COUNT/UN; añadir detección de compatibilidad discreta; incorporar filtros o búsqueda cliente-side por categoría, subcategoría, nombre y código si el dataset cargado actual lo permite sin cambios de backend.
- **Files:**
  - `src/public/root/views/recipes-admin.version-editor.js`
  - `src/public/root/views/recipes-admin.helpers.js`
- **Tests:** characterization tests y unit tests de helper si aplica
- **Validation:** el usuario puede distinguir insumos discretos de otros desde el selector y desde la fila del insumo.

### Step 4
- **Purpose:** añadir feedback incremental para cantidades `UN`.
- **Changes:** adaptar `step`, hints o warnings del campo cantidad cuando la unidad efectiva sea `UN`, preservando compatibilidad.
- **Files:**
  - `src/public/root/views/recipes-admin.version-editor.js`
- **Tests:** characterization tests del editor
- **Validation:** la UI prioriza cantidades discretas sin romper casos existentes.

### Step 5
- **Purpose:** hacer explícita la relación entre `PROCESSING`, `CAPPING`, envasado/empaque y `RECOLLECTION`.
- **Changes:** mostrar guía inline para etapas `CAPPING` y otras etapas de procesamiento equivalentes; mejorar el mensaje cuando no existan materiales recolectados previos.
- **Files:**
  - `src/public/root/views/recipes-admin.version-editor.js`
  - `src/public/root/views/recipes-admin.renderers.js`
- **Tests:** characterization tests del editor y del modal/revisión
- **Validation:** el usuario entiende por qué no puede agregar consumo procesable y qué debe hacer antes.

### Step 6
- **Purpose:** mejorar revisión de versiones y etapas.
- **Changes:** agregar badges o resúmenes visibles de `quantityBasis`, `stageType`, `processCode`, unidad y compatibilidad discreta; replicar copy/señales equivalentes en vistas de bodega relevantes cuando el cambio sea incremental.
- **Files:**
  - `src/public/root/views/recipes-admin.renderers.js`
- **Tests:** characterization tests del renderer
- **Validation:** la revisión ya no depende de abrir el editor para interpretar la receta.

### Step 7
- **Purpose:** cerrar la entrega con no-regresión y validación manual.
- **Changes:** ejecutar suite relevante y documentar escenarios manuales objetivo.
- **Files:**
  - `tests/root-shell-recipes-admin-view-characterization.test.js`
  - `implementation-report.md` de este spec como guía para el agente implementador
- **Tests:** pruebas automatizadas + validación manual
- **Validation:** todos los escenarios definidos en aceptación quedan cubiertos.

## 5. Database migration plan
No aplica. No se proponen migraciones.

## 6. Testing plan
- Ejecutar tests de root shell de recetas.
- Ejecutar tests de esquema/servicio de recetas para confirmar que no hay regresión accidental.
- Validar manualmente:
  1. versión `PER_FINISHED_UNIT` con insumo tapa COUNT/UN y cantidad `1`
  2. versión `PER_OUTPUT_KG` con el mismo insumo y warning visible
  3. etapa `CAPPING` o proceso de envasado/empaque sin `RECOLLECTION` previa
  4. búsqueda cliente-side de insumo por categoría, subcategoría, nombre y código si queda implementada sin backend
  5. revisión de versión con badges de base y etapas
  6. consistencia de copy visible en superficies equivalentes de bodega afectadas

## 7. Deployment considerations
- Cambio esperado solo en frontend servido por la app.
- Bajo riesgo operativo al no tocar DB ni contratos HTTP.
- Requiere revisión de copy en español antes de despliegue.

## 8. Rollback plan
- Revertir cambios de frontend en `recipes-admin.renderers.js`, `recipes-admin.version-editor.js` y helpers asociados.
- No se requiere rollback de datos ni migraciones.

## 9. Risks
- Ambigüedad de copy.
- Validación excesiva para `UN`.
- Sobrecarga de lógica en el editor.
- Persistencia de la limitación estructural de `quantityBasis` global.

## 10. Definition of done
- El editor explica `quantityBasis` claramente con lenguaje operativo.
- Los selectores de insumo muestran metadata suficiente para COUNT/UN.
- Si el dataset actual lo permite, existe búsqueda o filtro cliente-side por categoría, subcategoría, nombre y código.
- Existen warnings/hints de compatibilidad por base.
- `CAPPING` y procesos equivalentes explican su dependencia de `RECOLLECTION`.
- La revisión visual muestra badges operativos relevantes.
- Las superficies equivalentes de bodega mantienen consistencia cuando entren en alcance incremental.
- La mejora queda cubierta por pruebas automatizadas y validación manual.
- No se introducen cambios de DB ni ruptura de API.
- El cierre del spec deja registrado como siguiente paso abrir un spec follow-up para soporte híbrido por insumo (`recipes-hybrid-input-scaling` o equivalente).

## Requirements traceability
| Requirement | Architecture component | Task | Test |
|---|---|---|---|
| FR-001 | `recipes-admin.renderers.js`, `recipes-admin.version-editor.js` | TASK-002 | Characterization test de copy/hint de `quantityBasis` |
| FR-002 | `recipes-admin.version-editor.js`, `recipes-admin.helpers.js` | TASK-003 | Characterization test de labels enriquecidos |
| FR-003 | `recipes-admin.version-editor.js`, `recipes-admin.helpers.js` | TASK-004 | Characterization test de warnings COUNT/UN vs basis |
| FR-004 | `recipes-admin.version-editor.js`, `recipes-admin.renderers.js` | TASK-005 | Characterization test de guía `CAPPING` / `RECOLLECTION` |
| FR-005 | `recipes-admin.version-editor.js` | TASK-006 | Characterization test de step/hint/warning para `UN` |
| FR-006 | `recipes-admin.renderers.js` | TASK-007 | Characterization test de badges de revisión |
| FR-007 | Enfoque frontend incremental, sin cambios de DB/API | TASK-001, TASK-008 | Revisión de diff + no migration assertions manuales |
| FR-008 | Reutilización de contratos actuales | TASK-008 | Suite de no-regresión de recetas/producción relevante |
| NFR-001 | Arquitectura incremental | TASK-001, TASK-008 | Revisión de archivos modificados |
| NFR-002 | Root shell actual + APIs actuales | TASK-002, TASK-003 | Characterization tests |
| NFR-003 | Compatibilidad hacia atrás | TASK-008 | Tests existentes de recipe schema/service/production |
| NFR-004 | Pruebas automatizadas | TASK-001 a TASK-008 | Suite correspondiente |
| NFR-005 | Copy claro | TASK-002, TASK-005, TASK-007 | Revisión manual de contenido visible |
