# Domain Analysis
## Domain summary
La mejora impacta el dominio de definición administrativa de recetas, no el cálculo estructural del modelo. El problema central es de interpretación: el sistema ya puede representar insumos discretos y etapas de tapado, pero la UX no comunica suficientemente cómo usar esos conceptos dentro de una receta cuya base de cantidades es global por versión.

## Actors
- **Gestor/a de recetas**: crea y edita versiones de receta.
- **Aprobador/a de recetas**: revisa y aprueba versiones ya creadas.
- **Operación de producción**: consume la receta aprobada; no edita la receta, pero depende de que su definición sea entendible.

## Affected entities
### RecipeVersion
- Invariante actual: tiene un solo `quantityBasis` global.
- Valores relevantes: `PER_OUTPUT_KG`, `PER_FINISHED_UNIT`.
- Riesgo de interpretación: una misma versión no puede mezclar cómodamente insumos “por kg” y “por unidad” sin fricción UX.

### RecipeStage
- Invariante actual: `stageType` puede ser `RECOLLECTION` o `PROCESSING`.
- `processCode = CAPPING` representa tapado dentro de etapas de procesamiento.
- La UX debe reforzar que `PROCESSING` consume materiales ya recolectados.

### RecipeStageInput
- Representa un insumo ligado o no a un producto.
- Cuando tiene `productId`, la unidad debe coincidir con el producto referenciado.
- Para el problema actual, importa distinguir si el producto seleccionado es discreto (`COUNT`/`UN`).

### Product
- Conceptos clave: `presentationType`, `unit`, `netContentUnit`, `kgConversionFactor`.
- Caso objetivo: tapas, etiquetas, cajas y otros materiales discretos como `presentationType = COUNT` y `unit/netContentUnit = UN`.
- Regla contextual: si un producto COUNT/UN participa en una receta `PER_OUTPUT_KG`, el usuario debe entender que la cantidad representa una relación por kg y no “por unidad terminada”.

## Business rules and invariants
- **BR-001**: `quantityBasis` es único por versión.
- **BR-002**: `1 tapa por producto terminado` es coherente con `PER_FINISHED_UNIT`.
- **BR-003**: una etapa `PROCESSING`, incluyendo `CAPPING`, depende de recolección previa para materiales de lote.
- **BR-004**: COUNT/UN no implica automáticamente invalidación en recetas por kg; requiere aclaración, no prohibición ciega.

## Bounded context impact
### Recipes bounded context
Es el contexto principal afectado. Aquí se decide la semántica visible de cantidades, etapas e insumos.

### Products bounded context
Aporta metadata descriptiva para la toma de decisiones UX, pero no requiere rediseño del modelo.

### Production bounded context
Se ve afectado indirectamente porque una mejor receta reduce errores de interpretación en planeación y ejecución, pero el spec no propone alterar su lógica base.

## Known unknowns
- Verificar durante implementación si la paridad con superficies de bodega puede resolverse solo con copy/resumen o necesita un follow-up separado.
- Verificar si el dataset actual de productos (`pageSize: 100`) es suficiente para que el filtro cliente-side sea útil sin cambios estructurales.

## Follow-up candidate explicitly outside current scope
- **Soporte híbrido real por etapa o por insumo**: requeriría rediseño de contratos, validaciones, serialización, UI y probablemente cálculo de materiales en producción. Debe abrirse como spec separado si se aprueba.
