# Traceability
## Requirements to architecture and tasks
| Requirement | Architecture element | Tasks | Validation |
|---|---|---|---|
| FR-001 | `recipes-admin.renderers.js`, `recipes-admin.version-editor.js` | TASK-002 | Characterization test de copy/hints |
| FR-002 | `recipes-admin.version-editor.js`, `recipes-admin.helpers.js` | TASK-003 | Characterization test de labels enriquecidos |
| FR-003 | `recipes-admin.version-editor.js`, `recipes-admin.helpers.js` | TASK-004 | Characterization test de warning/hint contextual |
| FR-004 | `recipes-admin.version-editor.js`, `recipes-admin.renderers.js` | TASK-005 | Characterization test de `PROCESSING`/`CAPPING`/`RECOLLECTION` |
| FR-005 | `recipes-admin.version-editor.js` | TASK-006 | Characterization test de input `UN` |
| FR-006 | `recipes-admin.renderers.js`, superficies equivalentes de bodega si aplican | TASK-007 | Characterization test de badges/revisión + verificación manual de consistencia |
| FR-007 | Enfoque incremental frontend-only | TASK-001, TASK-008 | Revisión de diff y ausencia de migraciones |
| FR-008 | Contratos actuales de receta/producto | TASK-003, TASK-008 | Suite de no-regresión |
| FR-009 | Descubrimiento cliente-side sobre dataset ya cargado | TASK-003, TASK-008 | Characterization test de filtro/búsqueda o documentación de bloqueo |
| NFR-001 | Diseño incremental | TASK-001, TASK-008 | Revisión técnica |
| NFR-002 | Reuso de arquitectura actual | TASK-002, TASK-003, TASK-005 | Characterization tests |
| NFR-003 | Compatibilidad hacia atrás | TASK-008 | recipe/production tests |
| NFR-004 | Cobertura automatizada | TASK-001 a TASK-008 | Suite automatizada |
| NFR-005 | Copy claro y no ambiguo | TASK-002, TASK-005, TASK-007 | Revisión manual + characterization |

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

## Coverage notes
- No se requiere nuevo requisito para soporte híbrido porque quedó explícitamente fuera de alcance en este spec y debe abrirse como follow-up separado al cierre.
- Si durante implementación aparece necesidad de tocar backend o DB para datos ya presentes en productos, debe abrirse decisión de cambio y reevaluarse este spec.
