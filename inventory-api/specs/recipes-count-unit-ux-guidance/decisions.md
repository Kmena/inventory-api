# Decisions
## Accepted decisions
### DEC-001: Mantener `quantityBasis` global por versión en este spec
Se adopta el modelo actual como restricción explícita. La mejora se enfoca en UX clarificatoria y no en soporte híbrido.

### DEC-002: Preferir cambios frontend-only
Dado que el backend ya soporta `COUNT/UN`, `CAPPING`, `RECOLLECTION` y `quantityBasis`, la solución preferida no requiere cambios de API ni DB.

### DEC-003: Tratar compatibilidad COUNT/UN vs basis como guidance, no como prohibición
Las combinaciones COUNT/UN en recetas por kg deben advertirse, no bloquearse automáticamente en esta fase.

### DEC-004: Tratar la mejora de `UN` como feedback incremental seguro
Sin aprobación explícita para endurecer validación, se prefiere hint/warning antes que error bloqueante.

### DEC-005: Eliminar “legado” del copy visible de `quantityBasis`
El término “legado” no debe ser parte del wording principal visible al usuario. Puede mantenerse solo como referencia técnica interna si es necesario para documentación o comentarios.

### DEC-006: Extender la guía de recolección previa a `PROCESSING`, no solo `CAPPING`
La UX debe cubrir explícitamente no solo tapado, sino también envasado/empaque y cualquier etapa `PROCESSING` que dependa de materiales recolectados previamente.

### DEC-007: Permitir mejora de descubrimiento cliente-side en catálogos grandes
Se acepta incluir filtros o búsqueda por categoría, subcategoría, nombre y código siempre que opere sobre el dataset ya cargado y no exija nuevos endpoints ni cambios estructurales de carga.

### DEC-008: Mantener consistencia visual en superficies equivalentes de bodega
Cuando existan vistas de bodega que consuman la misma semántica de `quantityBasis` o de insumos discretos, el copy y las señales visibles deben mantenerse alineados con root admin, siempre que el cambio siga siendo incremental.

### DEC-009: Fijar wording operativo explícito para `quantityBasis`
`PER_FINISHED_UNIT` debe explicarse como cuánto insumo se usa por cada producto terminado; `PER_OUTPUT_KG` debe explicarse como cuánto insumo se usa por cada kilogramo del producto terminado.

## Assumptions recorded
- Los productos cargados por `productsApi` contienen `unit`, `presentationType` y `netContentUnit` suficientes para enriquecer labels.
- La principal superficie afectada es el root shell de recetas; cuando existan superficies equivalentes de bodega que ya consuman la misma semántica, se permite extender copy y señales visibles allí sin rediseño estructural.

## Rejected alternatives
### REJ-001: Rediseño híbrido por etapa/insumo dentro de este mismo spec
Rechazado por alto impacto y porque el solicitante pidió explícitamente evitar una gran re-arquitectura salvo necesidad indispensable.

### REJ-002: Resolver el problema solo con documentación externa
Rechazado porque la fricción ocurre en decisiones inline dentro del editor.

## Items requiring approval or clarification
No quedan bloqueos funcionales para aprobación del spec.
Durante implementación deberá verificarse:
- si la paridad con bodega afecta solo copy/resumen (`production-new.js`, `recipe-consultation.js`) o requiere un follow-up separado;
- si el filtro cliente-side sobre el dataset actual de productos es suficiente o si el límite `pageSize: 100` exige separar la mejora estructural.

## Follow-up recommendation
Abrir un spec separado al terminar este spec para soporte híbrido por insumo, por ejemplo `recipes-hybrid-input-scaling`, que evalúe checkbox/regla por línea para decidir si un insumo escala por unidad terminada o por kg dentro de una misma versión. Ese trabajo no debe mezclarse con la presente mejora incremental.
