# Traceability
## Requirements to architecture and tasks
| Requirement | Architecture element | Tasks | Validation |
|---|---|---|---|
| FR-001 | `recipes-admin.helpers.js`, `recipes-admin.renderers.js`, `recipes-admin.version-editor.js` | TASK-002 | Completed with operational labels/hints; targeted characterization test de copy/hints |
| FR-002 | `recipes-admin.version-editor.js`, `recipes-admin.helpers.js` | TASK-003 | Completed with enriched labels and client-side discovery controls |
| FR-003 | `recipes-admin.version-editor.js`, `recipes-admin.helpers.js` | TASK-004 | Completed with non-blocking compatibility hints for COUNT/UN by quantityBasis |
| FR-004 | `recipes-admin.version-editor.js`, `recipes-admin.renderers.js` | TASK-005 | Completed with inline PROCESSING/CAPPING guidance and clearer RECOLLECTION dependency messaging |
| FR-005 | `recipes-admin.version-editor.js` | TASK-006 | Completed with non-blocking `UN` quantity hint and decimal warning |
| FR-006 | `recipes-admin.renderers.js`, `production-new.js`, `recipe-consultation.js` | TASK-007 | Completed with review badges, visible quantityBasis/stage metadata, and incremental warehouse parity |
| FR-007 | Enfoque incremental frontend-only | TASK-001, TASK-008 | Completed with characterization-first implementation, no DB/API changes, no migrations |
| FR-008 | Contratos actuales de receta/producto | TASK-003, TASK-008 | TASK-003 completada sin cambiar payloads; suite de no-regresión |
| FR-009 | Descubrimiento cliente-side sobre dataset ya cargado | TASK-003, TASK-008 | TASK-003 completada con búsqueda/filtros cliente-side sobre dataset ya cargado |
| NFR-001 | Diseño incremental | TASK-001, TASK-008 | Revisión técnica |
| NFR-002 | Reuso de arquitectura actual | TASK-002, TASK-003, TASK-005 | Characterization tests |
| NFR-003 | Compatibilidad hacia atrás | TASK-008 | Completed with root-shell characterization + lint + typecheck; no contract changes |
| NFR-004 | Cobertura automatizada | TASK-001 a TASK-008 | Completed with expanded characterization coverage and closing validation suite |
| NFR-005 | Copy claro y no ambiguo | TASK-002, TASK-005, TASK-007 | TASK-002 completada sin “legado” visible; revisión manual + characterization |

## Acceptance criteria to tests
| Acceptance criterion | Covered by task | Test or validation |
|---|---|---|
| AC-001 | TASK-002 | Characterization test del select y hint de `quantityBasis` |
| AC-002 | TASK-003 | Characterization test de labels del selector |
| AC-003 | TASK-004 | Characterization test de warning COUNT/UN en `PER_OUTPUT_KG` |
| AC-004 | TASK-004 | Characterization test de hint positivo en `PER_FINISHED_UNIT` |
| AC-005 | TASK-005 | Characterization test de guía inline `CAPPING`/envasado equivalente |
| AC-006 | TASK-005 | Characterization test del mensaje por falta de recolección |
| AC-007 | TASK-006 | Characterization test del input `UN` + validación manual |
| AC-008 | TASK-007 | Characterization test de versión/modal de etapas |
| AC-009 | TASK-003 / TASK-008 | Characterization test o validación manual de filtro/búsqueda cliente-side |
| AC-010 | TASK-007 / TASK-008 | Verificación manual de consistencia visual en bodega si aplica |
| AC-011 | TASK-008 | Ejecución de suite relevante + revisión de que no hay migraciones |

## Implementation progress notes
- `TASK-001` completada con ampliación de `tests/root-shell-recipes-admin-view-characterization.test.js` para copy operativo, labels enriquecidos, warnings COUNT/UN, guía de recolección y paridad incremental de bodega.
- Evidencia inicial: `node --test tests/root-shell-recipes-admin-view-characterization.test.js` falla contra el código previo, confirmando caracterización efectiva.
- `TASK-002` completada con copy operativo centralizado en helpers y hint dinámico sin cambiar el payload ni la persistencia de `quantityBasis`.
- `TASK-003` completada usando metadata ya disponible de `product.category` y `product.subcategory` para labels enriquecidos y filtros cliente-side por etapa.
- `TASK-004` completada con warnings/hints no bloqueantes para compatibilidad COUNT/UN y basis de receta.
- `TASK-005` completada con guía inline de PROCESSING/CAPPING y mensaje accionable cuando falta RECOLLECTION previa.
- `TASK-006` completada con hint no bloqueante para cantidades `UN` y alerta contextual de decimales.
- `TASK-007` completada con badges de revisión en root y paridad incremental en superficies de warehouse.
- `TASK-008` completada con no-regresión automatizada y registro explícito del follow-up híbrido fuera de alcance.

## Coverage notes
- No se requiere nuevo requisito para soporte híbrido porque quedó explícitamente fuera de alcance en este spec y debe abrirse como follow-up separado al cierre (`recipes-hybrid-input-scaling`).
- Si durante implementación aparece necesidad de tocar backend o DB para datos ya presentes en productos, debe abrirse decisión de cambio y reevaluarse este spec.
