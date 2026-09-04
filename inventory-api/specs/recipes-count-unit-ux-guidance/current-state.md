# Current State Analysis
## 1. System overview
**Confirmed behavior**
- El repositorio es una API Node/Express con Prisma y un root shell web servido desde `src/public/root/`.
- El flujo de recetas administrativas vive principalmente en `src/public/root/views/recipes-admin.js`, `recipes-admin.renderers.js`, `recipes-admin.version-editor.js`, `recipes-admin.helpers.js` y `recipes-admin.state.js`.
- La persistencia de recetas usa `src/routes/recipe.routes.js`, `src/schemas/recipe.schema.js`, `src/services/recipe.service.js` y `src/repositories/recipe.repository.js`.
- Los productos consultados por el editor de recetas provienen de `productsApi.listProducts(...)` en `src/public/root/views/recipes-admin.js:269`.

**Inferred behavior**
- La mejora solicitada es mayormente frontend, porque el backend ya soporta `COUNT/UN`, `CAPPING` y `quantityBasis` por versión.

**Missing information**
- No hay evidencia en el repositorio de un documento formal del audit `ux-flow-auditor`; solo se recibió su resumen como input externo de esta planificación.

## 2. Relevant repository structure
- `src/public/root/views/recipes-admin.js` — montaje de la vista administrativa de recetas.
- `src/public/root/views/recipes-admin.renderers.js` — markup de workspace, diálogo de versión y detalle/revisión.
- `src/public/root/views/recipes-admin.version-editor.js` — lógica del editor de etapas, inputs, cantidad base y recolección previa.
- `src/public/root/views/recipes-admin.helpers.js` — helpers de permisos y patch mínimo al seleccionar producto.
- `src/public/root/views/products-admin.js` — formulario de producto con soporte de `presentationType` y `netContentUnit`.
- `src/public/warehouse/views/production-new.js` — superficie de bodega que ya consume `quantityBasis` al preparar producción.
- `src/public/warehouse/views/recipe-consultation.js` — superficie de bodega que consulta snapshots/recetas aprobadas.
- `src/schemas/recipe.schema.js` — validación de receta/versiones/etapas.
- `src/schemas/product.schema.js` — validación de `presentationType`, `COUNT` y `UN`.
- `src/services/recipe.service.js` — persistencia, serialización y validaciones de receta.
- `src/services/production.service.js` — cálculo de escalamiento por `quantityBasis`.
- `src/services/production-execution.service.js` y `src/services/production-stage-validation.service.js` — prerrequisitos operativos entre etapas y recolección.
- `prisma/schema.prisma` — modelos `RecipeVersion`, `RecipeStage`, `RecipeStageInput` y enum `RecipeQuantityBasis`.
- `tests/root-shell-recipes-admin-view-characterization.test.js` — characterization tests del editor/renderer de recetas.

## 3. Current components
### 3.1 Recipe schema and backend contracts
**Confirmed behavior**
- `src/schemas/recipe.schema.js:119` define `recipeQuantityBasisSchema` con `PER_OUTPUT_KG` y `PER_FINISHED_UNIT`.
- `src/schemas/recipe.schema.js:130` hace default a `PER_OUTPUT_KG`.
- `src/schemas/recipe.schema.js:17-18` incluye `CAPPING` dentro del catálogo válido de `processCode`.
- `src/schemas/recipe.schema.js` soporta `stageType = RECOLLECTION | PROCESSING` y valida que etapas `PROCESSING` requieran `processCode`.

### 3.2 Recipe service
**Confirmed behavior**
- `src/services/recipe.service.js:236-237` persiste `quantityBasis` con default `PER_OUTPUT_KG`.
- `src/services/recipe.service.js:327` permite actualizar `quantityBasis`.
- `src/services/recipe.service.js:408` serializa `quantityBasis` hacia consumidores.
- `src/services/recipe.service.js` valida consistencia entre unidad del insumo y unidad del producto cuando hay `productId`, pero no valida compatibilidad UX entre `quantityBasis` y productos COUNT/UN.

### 3.3 Recipe repository and routes
**Confirmed behavior**
- `src/repositories/recipe.repository.js` ya incluye `stageInputs.product` al leer versiones, por lo que la UI recibe metadata del producto referenciado.
- `src/routes/recipe.routes.js` expone endpoints CRUD y aprobación sin necesidad visible de cambios para esta mejora.

### 3.4 Root recipe UI
**Confirmed behavior**
- `src/public/root/views/recipes-admin.renderers.js:107-113` ya renderiza un select de `quantityBasis` con hint básico.
- El option visible actual dice `Por unidad terminada · legado (PER_FINISHED_UNIT)` en `src/public/root/views/recipes-admin.renderers.js:111`, lo cual coincide con el hallazgo UX sobre wording sesgado.
- `src/public/root/views/recipes-admin.version-editor.js:17-35` ya cambia el hint de `quantityBasis`, pero solo entre dos mensajes genéricos.
- `src/public/root/views/recipes-admin.version-editor.js:40-46` construye labels del selector de producto usando solo `name` y `code`.
- `src/public/root/views/recipes-admin.version-editor.js:146-147` usa `step="0.001"` para toda cantidad de insumo, incluso cuando la unidad es `UN`.
- `src/public/root/views/recipes-admin.version-editor.js:347-373` oculta el botón de agregar insumo si una etapa `PROCESSING` no tiene materiales recolectados previos, pero el mensaje visible es genérico: `Sin materiales recolectados disponibles para esta etapa.`
- `src/public/root/views/recipes-admin.renderers.js:275-317` muestra versiones con ingredientes, etapas, rendimiento y merma, pero no resalta `quantityBasis`.
- `src/public/root/views/recipes-admin.renderers.js:395+` muestra insumos y QA en el modal de etapas, pero no resalta `stageType`, `processCode` ni compatibilidad discreta.

### 3.5 Product model and product admin UI
**Confirmed behavior**
- `src/schemas/product.schema.js:6-7` soporta `presentationType = COUNT` y `netContentUnit = UN`.
- `src/schemas/product.schema.js:180` indica que `COUNT` no tiene restricciones adicionales a nivel esquema.
- `src/public/root/views/products-admin.js:289-290` restringe `COUNT` a `UN` en el selector de unidad del formulario de producto.
- `src/public/root/views/products-admin.js:347-350` muestra `kgConversionFactor` opcional para `COUNT`, con el hint: `Necesario si la receta opera en kg.`

### 3.6 Production scaling and execution
**Confirmed behavior**
- `src/services/production.service.js:361-379` usa `plannedOutputKg` para recetas `PER_OUTPUT_KG` y cantidad comercial para `PER_FINISHED_UNIT`.
- `src/services/production-execution.service.js:303-306` documenta que etapas `PROCESSING` consumen materiales previamente recolectados por una `RECOLLECTION` anterior.
- `src/services/production-stage-validation.service.js:112-181` bloquea la ejecución fuera de secuencia y también bloquea re-ejecución cuando falta confirmar recolección pendiente.

## 4. Current data flow
1. La vista root de recetas carga recetas con `recipesApi.listRecipes(...)` y productos con `productsApi.listProducts(...)` en `src/public/root/views/recipes-admin.js:265-269`.
2. El editor de versión toma `quantityBasis` del formulario y lo serializa en `buildVersionPayload(...)` en `src/public/root/views/recipes-admin.version-editor.js:531-556`.
3. Cada fila de insumo usa la unidad del producto mediante `buildStageInputPatchFromProduct(...)` desde `src/public/root/views/recipes-admin.helpers.js:91-97`.
4. Para etapas `PROCESSING`, el editor filtra opciones con base en balances recolectados previos mediante `computeRecollectedBalances(...)` y `renderProcessingProductOptions(...)` en `src/public/root/views/recipes-admin.version-editor.js:67-112`.
5. El backend persiste la versión sin reinterpretar COUNT/UN; solo valida referencias, unidad y lineage entre etapas.
6. Producción usa el `quantityBasis` persistido para escalar requerimientos en `src/services/production.service.js:361-379`.

## 5. Current domain model
**Confirmed behavior**
- `RecipeVersion.quantityBasis` existe en `prisma/schema.prisma:1554` y es único por versión.
- `RecipeStage.stageType` y `RecipeStage.processCode` existen en `prisma/schema.prisma:1594-1599`.
- `RecipeStageInput.quantity` está documentado en `prisma/schema.prisma:1616` como “cantidad por 1 unidad de producto terminado”, lo cual hoy queda desalineado con el soporte real de `PER_OUTPUT_KG` y constituye deuda documental/modelo.
- `Product` ya expone `presentationType`, `netContentUnit`, `unit` y `kgConversionFactor` a nivel de servicios y UI de productos.

## 6. Current APIs or interfaces
- `GET /api/recipes` y `GET /api/recipes/:id/versions` ya exponen `quantityBasis` vía `serializeRecipeVersion(...)` en `src/services/recipe.service.js:399-427`.
- `GET /api/products` es usado por la UI de recetas y, por el shaping actual en `src/services/product-permission-shaping.service.js:19-33`, no elimina campos de catálogo como `unit`, `presentationType` o `netContentUnit`; solo oculta datos de inventario cuando faltan permisos.
- No se observa una necesidad técnica actual de agregar endpoints para esta mejora UX.

## 7. Current database behavior
**Confirmed behavior**
- `RecipeVersion.quantityBasis` está persistido como enum en Prisma (`prisma/schema.prisma:1554`).
- No se detecta necesidad actual de migración para soportar COUNT/UN o `CAPPING`; ya existen en esquema y validaciones.

## 8. Existing tests
- `tests/recipe-schema.test.js` cubre `quantityBasis` y defaults.
- `tests/recipe-service-foundation.test.js` cubre persistencia y serialización de `quantityBasis`.
- `tests/production-service-foundation.test.js` cubre el escalamiento distinto entre `PER_OUTPUT_KG` y `PER_FINISHED_UNIT`.
- `tests/root-shell-recipes-admin-view-characterization.test.js` cubre la presencia del select de `quantityBasis`, su hint y el editor desacoplado.
- `tests/production-execution.service.test.js` cubre prerrequisitos de recolección para ejecución.
- Tras esta implementación, `tests/root-shell-recipes-admin-view-characterization.test.js` cubre labels enriquecidos de insumos, warnings COUNT/UN, guía de recolección y badges de revisión en recetas.

## 9. Current limitations
- `quantityBasis` es global por versión; no hay soporte híbrido por etapa o por insumo.
- El soporte sigue siendo version-level; no existe soporte híbrido por insumo o por etapa.
- El descubrimiento cliente-side sigue limitado al dataset visible cargado actualmente (`pageSize: 100`), por lo que catálogos mayores requieren un follow-up estructural.

## 10. Technical debt related to the change
- Comentario/documentación desalineada en `prisma/schema.prisma:1616` sobre `RecipeStageInput.quantity` como base unitaria fija.
- `recipes-admin.version-editor.js` sigue concentrando bastante lógica de UX; esta implementación movió parte del copy y clasificación a helpers, pero aún conviene seguir extrayendo reglas incrementales con cuidado.
- El editor de recetas carga productos con `pageSize: 100` (`src/public/root/views/recipes-admin.js:269`), lo que sigue siendo un límite funcional en catálogos grandes; este spec solo añadió filtros cliente-side sobre el dataset actual.

## 11. Risks
- Cambios de copy o warnings pueden inducir a pensar erróneamente que COUNT/UN está prohibido en recetas por kg si no se redactan con cuidado.
- Endurecer demasiado la validación de `UN` podría romper usos válidos o datos heredados.
- Añadir lógica UX ad hoc dentro del editor puede aumentar complejidad si no se encapsula mínimamente.

## 12. Post-implementation update
- `recipes-admin.helpers.js` ahora centraliza labels/hints operativos de `quantityBasis`, clasificación `COUNT/UN`, labels enriquecidos y filtros cliente-side por etapa.
- `recipes-admin.version-editor.js` ahora ofrece búsqueda/filtros de insumos por etapa, warnings no bloqueantes de compatibilidad `COUNT/UN`, hint para `UN`, y guía inline de `PROCESSING`/`CAPPING` dependiente de `RECOLLECTION`.
- `recipes-admin.renderers.js` ahora expone `quantityBasis`, `stageType`, `processCode` y badges de revisión en superficies de detalle.
- `production-new.js` y `recipe-consultation.js` recibieron paridad incremental de copy y semántica visible para `quantityBasis`, `COUNT/UN` y dependencia de recolección.
- No hubo cambios de backend, rutas, contratos API, Prisma ni migraciones.
- Follow-up explícito recomendado: `recipes-hybrid-input-scaling` para soporte híbrido por insumo fuera de alcance.

## 13. Relevant files
- `src/public/root/views/recipes-admin.js`
- `src/public/root/views/recipes-admin.renderers.js`
- `src/public/root/views/recipes-admin.version-editor.js`
- `src/public/root/views/recipes-admin.helpers.js`
- `src/public/root/views/products-admin.js`
- `src/public/root/ui.js`
- `src/schemas/recipe.schema.js`
- `src/schemas/product.schema.js`
- `src/services/recipe.service.js`
- `src/services/production.service.js`
- `src/services/production-execution.service.js`
- `src/services/production-stage-validation.service.js`
- `src/services/product-permission-shaping.service.js`
- `prisma/schema.prisma`
- `tests/root-shell-recipes-admin-view-characterization.test.js`
- `tests/recipe-schema.test.js`
- `tests/recipe-service-foundation.test.js`
- `tests/production-service-foundation.test.js`
- `tests/production-execution.service.test.js`
