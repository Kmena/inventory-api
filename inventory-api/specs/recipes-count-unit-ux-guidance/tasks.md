# Implementation Tasks
## TASK-001: Establecer cobertura de caracterización para la mejora UX
**Status:** Completed
**Completed at:** 2025-07
**Implemented files:**
- `tests/root-shell-recipes-admin-view-characterization.test.js`
**Validation evidence:**
- `node --test tests/root-shell-recipes-admin-view-characterization.test.js` (fallo esperado previo a implementación)
**Objective:** Definir pruebas que describan el comportamiento UX esperado antes de modificar la UI.
**Affected areas:**
- `tests/root-shell-recipes-admin-view-characterization.test.js`
- `src/public/root/views/recipes-admin.renderers.js`
- `src/public/root/views/recipes-admin.version-editor.js`
**Dependencies:**
- None
**Implementation notes:**
- Añadir assertions para copy de `quantityBasis`, labels enriquecidos, warnings COUNT/UN, guía `CAPPING` y badges de revisión.
- Mantener el enfoque characterization-first para reducir regresiones.
- **Related requirements:** FR-007, FR-008, NFR-001, NFR-004
**Tests:**
- Characterization test de root shell recetas
- Revisión local de fallos iniciales esperados
**Acceptance criteria:**
- [ ] Existen pruebas que fallen si no se implementa la guía UX nueva.
- [ ] Las pruebas cubren al menos copy, labels, warnings y badges.
- [ ] No se modifica código productivo en esta tarea.

## TASK-002: Clarificar el copy y hints de quantityBasis
**Status:** Completed
**Completed at:** 2025-07
**Implemented files:**
- `src/public/root/views/recipes-admin.helpers.js`
- `src/public/root/views/recipes-admin.renderers.js`
- `src/public/root/views/recipes-admin.version-editor.js`
- `tests/root-shell-recipes-admin-view-characterization.test.js`
**Validation evidence:**
- `node --test --test-name-pattern "^recipes admin quantityBasis copy uses operational language and removes visible legacy wording$|^recipes-admin.renderers.js and version-editor.js implement quantityBasis select and hint together \(TASK-006\)$|^recipes-admin.version-editor.js buildVersionPayload includes quantityBasis \(TASK-006\)$|^recipes-admin.version-editor.js restores quantityBasis when opening existing version for edit \(TASK-006\)$" tests/root-shell-recipes-admin-view-characterization.test.js`
- `npm run lint`
- `npm run typecheck`
**Objective:** Hacer explícito cuándo usar `PER_OUTPUT_KG` y cuándo usar `PER_FINISHED_UNIT` en el editor de versión.
**Affected areas:**
- `src/public/root/views/recipes-admin.renderers.js`
- `src/public/root/views/recipes-admin.version-editor.js`
- `src/public/root/views/recipes-admin.helpers.js`
**Dependencies:**
- TASK-001
**Implementation notes:**
- Ajustar labels del select y hint principal.
- Evitar que “legado” sea el principal driver de decisión UX.
- Incluir ejemplo textual de materiales discretos como tapas cuando aplique.
- **Related requirements:** FR-001, BR-001, BR-002, NFR-005
**Tests:**
- Characterization test de copy/hint de `quantityBasis`
- Verificación manual del editor
**Acceptance criteria:**
- [ ] El usuario ve una explicación clara para ambas bases.
- [ ] La UI explica que `1 tapa por producto terminado` encaja con `PER_FINISHED_UNIT`.
- [ ] El cambio no altera el payload enviado al backend.

## TASK-003: Enriquecer labels, metadata y descubrimiento del selector de insumos
**Status:** Completed
**Completed at:** 2025-07
**Implemented files:**
- `src/public/root/views/recipes-admin.helpers.js`
- `src/public/root/views/recipes-admin.version-editor.js`
**Validation evidence:**
- `node --test --test-name-pattern "^recipes admin source defines enriched COUNT/UN product labels and client-side discovery controls$" tests/root-shell-recipes-admin-view-characterization.test.js`
- `npm run lint`
- `npm run typecheck`
**Objective:** Mostrar metadata útil del producto para distinguir insumos discretos COUNT/UN en el flujo de recetas y mejorar el descubrimiento en catálogos grandes con filtros o búsqueda cliente-side cuando el dataset actual lo permita.
**Affected areas:**
- `src/public/root/views/recipes-admin.version-editor.js`
- `src/public/root/views/recipes-admin.helpers.js`
**Dependencies:**
- TASK-001
- TASK-002
**Implementation notes:**
- Construir labels con nombre, código, unidad y señal visible de COUNT/UN.
- Reusar metadata ya entregada por `productsApi.listProducts(...)`.
- Mantener compatibilidad para productos legacy sin `presentationType`.
- Si el dataset cargado en cliente es suficiente, agregar búsqueda o filtros por categoría, subcategoría, nombre y código sin tocar backend.
- Si el límite actual `pageSize: 100` vuelve insuficiente la solución cliente-side, documentar el bloqueo y dejarlo como follow-up estructural.
- **Related requirements:** FR-002, FR-008, FR-009, BR-005
**Tests:**
- Characterization test de selector enriquecido
- Characterization test de filtros o búsqueda cliente-side si entra en alcance
- Unit test de helper si se introduce helper nuevo
**Acceptance criteria:**
- [ ] El selector ya no muestra solo nombre/código.
- [ ] Los productos COUNT/UN son distinguibles visualmente.
- [ ] Si el dataset actual lo permite, existe búsqueda o filtro cliente-side por categoría, subcategoría, nombre y código.
- [ ] Los productos legacy siguen mostrando labels válidos.

## TASK-004: Mostrar compatibilidad COUNT/UN vs quantityBasis
**Status:** Completed
**Completed at:** 2025-07
**Implemented files:**
- `src/public/root/views/recipes-admin.version-editor.js`
**Validation evidence:**
- `node --test --test-name-pattern "^recipes admin source defines contextual warnings for COUNT/UN basis compatibility and decimal UN quantities$" tests/root-shell-recipes-admin-view-characterization.test.js`
- `npm run lint`
- `npm run typecheck`
**Objective:** Añadir warnings y hints contextuales según la combinación entre base de receta e insumos discretos.
**Affected areas:**
- `src/public/root/views/recipes-admin.version-editor.js`
- `src/public/root/views/recipes-admin.helpers.js`
- `src/public/root/ui.js` (solo si se necesita reutilizar render de mensajes inline)
**Dependencies:**
- TASK-002
- TASK-003
**Implementation notes:**
- Warning suave para COUNT/UN o `UN` en `PER_OUTPUT_KG`.
- Hint positivo/confirmación para COUNT/UN en `PER_FINISHED_UNIT`.
- No bloquear automáticamente casos técnicamente válidos.
- **Related requirements:** FR-003, BR-002, BR-004, BR-005
**Tests:**
- Characterization test de warning/hint contextual
- Verificación manual con cambio de basis
**Acceptance criteria:**
- [ ] La UI muestra warning visible en recetas por kg con insumo discreto.
- [ ] La UI muestra compatibilidad visible en recetas por unidad terminada.
- [ ] No se introducen nuevas validaciones backend en esta tarea.

## TASK-005: Guiar etapas PROCESSING/CAPPING/envasado y dependencia de RECOLLECTION
**Status:** Completed
**Completed at:** 2025-07
**Implemented files:**
- `src/public/root/views/recipes-admin.version-editor.js`
- `src/public/root/views/recipes-admin.renderers.js`
**Validation evidence:**
- `node --test --test-name-pattern "^recipes admin source explains PROCESSING recollection dependency and highlights review badges$" tests/root-shell-recipes-admin-view-characterization.test.js`
- `npm run lint`
- `npm run typecheck`
**Objective:** Explicar explícitamente la relación entre etapas de procesamiento como tapado o envasado/empaque y los materiales recolectados previamente.
**Affected areas:**
- `src/public/root/views/recipes-admin.version-editor.js`
- `src/public/root/views/recipes-admin.renderers.js`
**Dependencies:**
- TASK-001
- TASK-003
**Implementation notes:**
- Añadir help text específico cuando `processCode = CAPPING` y reusable para procesos equivalentes de envasado/empaque.
- Mejorar mensaje de ausencia de materiales recolectados para etapas `PROCESSING`.
- Mantener coherencia con el comportamiento ya implementado de filtering por balance recolectado.
- **Related requirements:** FR-004, BR-003, AC-005, AC-006
**Tests:**
- Characterization test de guía `CAPPING`
- Characterization test de mensaje por falta de recolección previa
**Acceptance criteria:**
- [ ] Una etapa `CAPPING` muestra guía inline visible.
- [ ] Si no hay recolección previa, el mensaje explica el siguiente paso esperado.
- [ ] La lógica operativa existente no cambia de semántica.

## TASK-006: Mejorar interacción de cantidades discretas UN con warning no bloqueante
**Status:** Completed
**Completed at:** 2025-07
**Implemented files:**
- `src/public/root/views/recipes-admin.version-editor.js`
**Validation evidence:**
- `node --test --test-name-pattern "^recipes admin source defines contextual warnings for COUNT/UN basis compatibility and decimal UN quantities$" tests/root-shell-recipes-admin-view-characterization.test.js`
- `npm run lint`
- `npm run typecheck`
**Objective:** Priorizar cantidades discretas para `UN` con feedback UX incremental y seguro.
**Affected areas:**
- `src/public/root/views/recipes-admin.version-editor.js`
**Dependencies:**
- TASK-003
- TASK-004
**Implementation notes:**
- Ajustar `step`, hint o warning cuando la unidad efectiva sea `UN`.
- Implementar warning no bloqueante sobre decimales en `UN`.
- Evitar afectar unidades no discretas.
- Mantener compatibilidad con casos donde un producto por unidades pueda usar fracciones operativas válidas.
- **Related requirements:** FR-005, BR-004, AC-007
**Tests:**
- Characterization test del comportamiento de inputs `UN`
- Verificación manual editando cantidades enteras y decimales
**Acceptance criteria:**
- [ ] `UN` ya no hereda ciegamente el comportamiento decimal genérico.
- [ ] La UI da feedback cuando una cantidad `UN` no parece discreta.
- [ ] Otras unidades siguen funcionando como antes.

## TASK-007: Resaltar basis, etapas y compatibilidad en la revisión, con paridad incremental en bodega cuando aplique
**Status:** Completed
**Completed at:** 2025-07
**Implemented files:**
- `src/public/root/views/recipes-admin.renderers.js`
- `src/public/warehouse/views/production-new.js`
- `src/public/warehouse/views/recipe-consultation.js`
- `tests/root-shell-recipes-admin-view-characterization.test.js`
**Validation evidence:**
- `node --test --test-name-pattern "^warehouse recipe surfaces keep incremental parity for quantityBasis and COUNT/UN visibility when implemented$" tests/root-shell-recipes-admin-view-characterization.test.js`
- `node --test tests/root-shell-recipes-admin-view-characterization.test.js`
- `npm run lint`
- `npm run typecheck`
**Objective:** Hacer revisable la interpretación de la receta desde las superficies de detalle sin abrir el editor.
**Affected areas:**
- `src/public/root/views/recipes-admin.renderers.js`
**Dependencies:**
- TASK-002
- TASK-004
- TASK-005
**Implementation notes:**
- Agregar badges o etiquetas para `quantityBasis`, `stageType`, `processCode`, unidad y/o compatibilidad discreta.
- Aplicar tanto en listado de versiones como en modal de etapas cuando sea razonable.
- Si existen vistas equivalentes en bodega que ya muestran esta semántica (`production-new.js`, `recipe-consultation.js`), mantener alineación visual/copy cuando el cambio sea incremental y seguro.
- **Related requirements:** FR-006, NFR-005, AC-008, AC-010
**Tests:**
- Characterization test del renderer de versiones
- Characterization test del modal de etapas
**Acceptance criteria:**
- [ ] La revisión de versión muestra `quantityBasis` visiblemente.
- [ ] La revisión de etapas muestra `stageType` y `processCode`.
- [ ] Las unidades relevantes son visibles en la revisión.

## TASK-008: Validar no-regresión, documentar cierre técnico y registrar follow-up híbrido
**Status:** Completed
**Completed at:** 2025-07
**Implemented files:**
- `tests/root-shell-recipes-admin-view-characterization.test.js`
- `specs/recipes-count-unit-ux-guidance/implementation-report.md`
- `specs/recipes-count-unit-ux-guidance/tasks.md`
- `specs/recipes-count-unit-ux-guidance/traceability.md`
- `specs/recipes-count-unit-ux-guidance/changelog.md`
- `specs/recipes-count-unit-ux-guidance/current-state.md`
- `docs/architecture.md`
**Validation evidence:**
- `node --test tests/root-shell-recipes-admin-view-characterization.test.js`
- `npm run lint`
- `npm run typecheck`
**Objective:** Confirmar que la mejora es incremental, compatible y lista para despliegue.
**Affected areas:**
- `tests/root-shell-recipes-admin-view-characterization.test.js`
- `tests/recipe-schema.test.js`
- `tests/recipe-service-foundation.test.js`
- `tests/production-service-foundation.test.js`
- `specs/recipes-count-unit-ux-guidance/implementation-report.md`
**Dependencies:**
- TASK-002
- TASK-003
- TASK-004
- TASK-005
- TASK-006
- TASK-007
**Implementation notes:**
- Ejecutar pruebas relevantes de recetas/producción.
- Verificar explícitamente que no hubo migraciones ni cambios de contrato API.
- Registrar validaciones y desviaciones en el implementation report.
- Dejar registrado como siguiente paso abrir un spec follow-up para soporte híbrido por insumo (`recipes-hybrid-input-scaling` o equivalente) derivado de la idea de checkbox/regla por línea.
- **Related requirements:** FR-007, FR-008, NFR-001, NFR-003, NFR-004
**Tests:**
- Suite automatizada relevante
- Checklist manual de escenarios clave
**Acceptance criteria:**
- [ ] Las pruebas relevantes pasan.
- [ ] No se introducen cambios de DB/API.
- [ ] El reporte de implementación queda preparado para revisión humana.
- [ ] El cierre deja explícito el recordatorio de abrir el spec follow-up para soporte híbrido por insumo.
