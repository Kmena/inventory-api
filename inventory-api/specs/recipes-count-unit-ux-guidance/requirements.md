# User Requirements
## 1. Overview
Se requiere un paquete de mejora incremental para el flujo de creación/edición de recetas que haga más claro el uso de insumos discretos como tapas, etiquetas y cajas definidos como `presentationType = COUNT` y `unit = UN`, especialmente en etapas de tapado (`CAPPING`). El objetivo no es rediseñar el modelo de receta, sino reducir fricción y errores de UX usando la arquitectura actual.

## 2. Business objective
Permitir que usuarios administrativos definan y usen insumos discretos COUNT/UN en recetas de forma comprensible, segura y coherente con el modelo actual, haciendo explícito cuándo una receta debe configurarse `PER_FINISHED_UNIT`, cómo se relacionan etapas de procesamiento como `CAPPING` y envasado/empaque con una `RECOLLECTION` previa, y mejorando el descubrimiento de insumos en catálogos grandes sin rediseñar el modelo actual.

## 3. User problem
Hoy el sistema soporta técnicamente COUNT/UN y `CAPPING`, pero el flujo no deja claro:
- cuándo conviene `PER_OUTPUT_KG` vs `PER_FINISHED_UNIT`
- qué pasa si se selecciona un insumo COUNT/UN dentro de una receta por kg
- que una etapa de tapado depende de materiales recolectados previamente
- qué metadata del producto seleccionado ayuda a decidir si el insumo es discreto o no

## 4. Actors
- Administrador/a root con permiso `recipes.manage`
- Aprobador/a con permiso `recipes.approve`
- Usuario/a administrativo que consulta recetas y productos asociados
- Usuario/a de bodega que consulta o ejecuta flujos equivalentes donde la semántica de `quantityBasis` y de insumos discretos debe mostrarse de forma consistente
- Futuro implementation agent que debe ejecutar este spec sin reinterpretar el alcance

## 5. Functional requirements
### FR-001 Explicar de forma explícita el significado operativo de `quantityBasis` en el editor de versiones.
El flujo de receta debe mostrar copy contextual que explique cuándo usar `PER_OUTPUT_KG` y cuándo usar `PER_FINISHED_UNIT`, incluyendo ejemplos orientados a materiales discretos como tapas.

### FR-002 Hacer visible la metadata relevante del producto en los selectores de insumos de receta.
Cuando el usuario seleccione o vea insumos en el editor de etapas, el flujo debe mostrar al menos nombre, código, unidad y señales de presentación discreta (`COUNT`/`UN`) para evitar decisiones ciegas.

### FR-003 Advertir sobre compatibilidad entre base de receta e insumos discretos.
Si la versión está en `PER_OUTPUT_KG` y el usuario selecciona un insumo COUNT/UN o unidad `UN`, el sistema debe mostrar una advertencia contextual explicando la implicación. Si la versión está en `PER_FINISHED_UNIT`, debe mostrar una confirmación o hint de compatibilidad para casos como `1 tapa por producto terminado`.

### FR-004 Guiar al usuario cuando una etapa `PROCESSING` requiere recolección previa.
El flujo de edición y revisión debe explicar que etapas de procesamiento como `CAPPING` y envasado/empaque consumen materiales previamente recolectados y que, si no existen materiales recolectados en etapas anteriores, no podrá agregarse consumo procesable para esa etapa.

### FR-005 Mejorar la interacción de cantidades para insumos discretos `UN`.
El editor debe aplicar hints y/o validaciones incrementales para cantidades discretas `UN`, priorizando entradas enteras y evitando que el control numérico sugiera decimales genéricos como comportamiento por defecto cuando se trata de unidades discretas. En esta iteración, el comportamiento debe ser de advertencia no bloqueante para cantidades no enteras en `UN`.

### FR-006 Hacer visibles en revisión los elementos que afectan la interpretación de la receta.
Las superficies de revisión de versión y etapas deben resaltar al menos `quantityBasis`, `stageType`, `processCode` y unidades de insumo, para que el usuario pueda revisar la receta sin depender de memoria implícita. Cuando existan superficies equivalentes en bodega que consuman la misma semántica, debe mantenerse consistencia visual y de copy.

### FR-007 Preservar el soporte actual sin introducir un rediseño estructural del modelo.
La mejora debe funcionar sobre el modelo actual, donde `quantityBasis` es único por versión. No debe introducir soporte híbrido por etapa o insumo en este alcance.

### FR-008 Mantener compatibilidad con versiones, productos y órdenes existentes.
La mejora no debe romper la creación, edición, aprobación, serialización ni consumo actual de recetas y productos ya soportados por el repositorio.

### FR-009 Mejorar el descubrimiento de productos en el flujo de selección de insumos.
El flujo debe permitir filtrar o buscar productos por categoría, subcategoría, nombre y código cuando el dataset ya esté disponible en cliente. Si la mejora requiere cambios estructurales de carga o backend, debe quedar fuera de esta iteración y registrarse como follow-up.

## 6. Non-functional requirements
### NFR-001 La solución debe ser incremental y de bajo riesgo.
Debe priorizar cambios UX/frontend y evitar migraciones o cambios de persistencia salvo que el análisis los demuestre indispensables.

### NFR-002 La solución debe respetar la arquitectura actual.
Debe reutilizar el root shell administrativo existente, los endpoints actuales y los contratos ya expuestos por `recipesApi` y `productsApi`.

### NFR-003 La solución debe mantener compatibilidad hacia atrás.
Recetas existentes sin nuevos campos o con valores actuales deben seguir funcionando sin migración de datos.

### NFR-004 La solución debe ser verificable por pruebas automatizadas.
Cada mejora UX crítica debe quedar respaldada por characterization tests, pruebas de vista o pruebas unitarias de helpers donde aplique.

### NFR-005 La solución debe minimizar ambigüedad de copy.
El wording nuevo debe estar orientado a decisiones operativas y no debe sesgar indebidamente al usuario hacia un modo llamándolo únicamente “legado”.

## 7. Business rules
### BR-001 `quantityBasis` sigue siendo global por versión de receta.
La versión completa usa una sola base de cantidades. No existe base por etapa ni por insumo en el alcance actual.

### BR-002 `1 tapa por producto terminado` es un caso válido del modelo actual.
Ese caso debe guiarse como compatible cuando la receta use `PER_FINISHED_UNIT`.

### BR-003 Las etapas `PROCESSING` consumen materiales recolectados previamente.
La UX debe reflejar la relación ya existente entre etapas de procesamiento y materiales provenientes de etapas `RECOLLECTION` anteriores.

### BR-004 La mejora de `UN` debe ser principalmente preventiva y explicativa.
Para no romper datos o usos existentes, las advertencias sobre cantidades discretas deben implementarse como soft warnings no bloqueantes en esta iteración, no como bloqueos duros.

### BR-005 COUNT/UN en recetas por kg no está prohibido técnicamente.
La UX debe explicarlo como una decisión con implicaciones, no como un error automático, porque puede depender de conversiones o convenciones operativas del producto.

### BR-006 El soporte híbrido real queda fuera de alcance inmediato.
Si el análisis concluye que el soporte híbrido es deseable, debe tratarse como follow-up separado.

### BR-007 El copy de `quantityBasis` debe explicarse con lenguaje operativo.
`PER_FINISHED_UNIT` debe explicarse como cuánto insumo se usa por cada producto terminado (ejemplo: `1 tapa por cada vaselina producida`). `PER_OUTPUT_KG` debe explicarse como cuánto insumo se usa por cada kilogramo del producto terminado (ejemplo: `para producir 1 kg de vaselina, cuánta agua o base se requiere`).

## 8. Acceptance criteria
### AC-001 Given que el usuario abre el editor de versión, When revisa o cambia `quantityBasis`, Then ve una explicación clara de cuándo usar cada base y cómo interpretar las cantidades de insumo.

### AC-002 Given que el usuario agrega un insumo de etapa, When abre el selector de producto, Then puede ver metadata suficiente para distinguir materiales discretos COUNT/UN de otros materiales.

### AC-003 Given que la receta está en `PER_OUTPUT_KG` y el usuario selecciona un insumo COUNT/UN o `UN`, When completa la línea del insumo, Then ve una advertencia contextual que explique la implicación de definir una cantidad discreta en una receta por kg.

### AC-004 Given que la receta está en `PER_FINISHED_UNIT` y el usuario selecciona un insumo discreto COUNT/UN, When completa la línea del insumo, Then ve una señal visible de que el caso es compatible para relaciones como `1 tapa por producto terminado`.

### AC-005 Given que el usuario configura una etapa con `processCode = CAPPING` o una etapa de procesamiento equivalente para envasado/empaque, When revisa o edita la etapa, Then ve guía inline que explique la dependencia con una `RECOLLECTION` previa.

### AC-006 Given que cualquier etapa `PROCESSING` no tiene materiales recolectados previos disponibles, When el usuario intenta agregar insumos de esa etapa, Then la interfaz muestra una explicación explícita del motivo y del siguiente paso esperado.

### AC-007 Given que el usuario edita una cantidad para un insumo con unidad `UN`, When interactúa con el campo numérico, Then la interfaz prioriza entradas discretas y muestra feedback cuando la cantidad no parece una unidad discreta esperable.

### AC-008 Given que el usuario revisa una versión o las etapas desde el detalle, When inspecciona la receta, Then puede ver badges o etiquetas visibles con `quantityBasis`, `stageType`, `processCode` y unidades relevantes.

### AC-009 Given que el usuario busca un insumo en un catálogo amplio ya cargado en cliente, When usa los controles de filtro o búsqueda disponibles, Then puede encontrar productos por categoría, subcategoría, nombre o código sin requerir cambios de backend en esta iteración.

### AC-010 Given que existen superficies equivalentes en bodega que muestran o consumen `quantityBasis` y semántica de insumos discretos, When la mejora se replica allí, Then el copy y señales visibles mantienen consistencia con root admin.

### AC-011 Given que existen recetas, productos y órdenes ya soportados, When se despliega la mejora, Then el flujo sigue funcionando sin cambios de base de datos ni ruptura de contratos API.

## 9. Constraints
- No implementar soporte híbrido de `quantityBasis` por etapa o insumo en este spec.
- No inventar nuevas capacidades de backend si el frontend ya cuenta con datos suficientes.
- Mantener el alcance centrado en creación/edición/revisión de recetas dentro del root shell y en superficies equivalentes de bodega solo cuando la mejora pueda replicarse de forma incremental, sin rediseño estructural.
- No modificar código productivo durante la fase de planificación.

## 10. Assumptions
- El flujo prioritario es la UI administrativa `src/public/root/views/recipes-admin*`.
- Los datos de producto expuestos por `productsApi` ya contienen suficiente metadata para enriquecer labels del selector sin cambiar el backend.
- Las advertencias de compatibilidad pueden resolverse inicialmente en cliente, usando el `quantityBasis` seleccionado y la metadata del producto.
- La mejora puede usar copy, badges y warnings sin necesidad de alterar el esquema Prisma.

## 11. Resolved questions
- **Decimales en `UN`:** se implementan como advertencia no bloqueante, no bloqueo duro.
- **Término “legado”:** debe eliminarse del copy visible y mantenerse solo como referencia técnica interna si fuera necesario.
- **Guía de `CAPPING`:** no será exclusiva de tapado; debe cubrir también cualquier `PROCESSING` dependiente de `RECOLLECTION` previa, incluyendo envasado/empaque cuando aplique.
- **Alcance en otras vistas:** el alcance inicial cubre root admin y debe replicarse en superficies equivalentes de bodega cuando consuman la misma semántica y el cambio pueda hacerse sin rediseño estructural.
- **Catálogo grande / `pageSize: 100`:** se permite mejorar descubrimiento con filtros cliente-side por categoría, subcategoría, nombre y código si los datos ya están cargados; si la solución exige cambios estructurales de carga/paginación/backend, se tratará como follow-up separado.
- **Formato visual del selector:** se aprueba un formato enriquecido tipo `Nombre · Código · Unidad · COUNT/UN` cuando aplique.
- **Recordatorio follow-up:** al cierre de este spec debe quedar registrado abrir un spec separado para soporte híbrido por insumo (ej. checkbox o regla por línea para escalar por unidad terminada vs kg).

## 12. Out of scope
- Soporte híbrido real de `quantityBasis` por etapa.
- Soporte híbrido real de `quantityBasis` por insumo.
- Checkbox o selector por insumo para elegir escalado por unidad terminada vs kg dentro de una misma versión.
- Rediseño del modelo de producción, ejecución o cálculo de materiales.
- Nuevos endpoints o migraciones de base de datos si el análisis no los vuelve imprescindibles.
- Refactors amplios de módulos de productos, recetas o producción que no sean necesarios para la guía UX incremental.
