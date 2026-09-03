# Advisor Review
## Findings
Se incorporó guidance externo del audit UX resumido por el solicitante:
- **UX-101**: base global única por versión dificulta recetas híbridas (High)
- **UX-102**: tapado no explica que necesita RECOLLECTION previa (High)
- **UX-103**: selector de insumos no muestra unidad/tipo/presentationType (High)
- **UX-104**: wording de quantityBasis es ambiguo y “legado” sesga la decisión (Medium)
- **UX-105**: cantidades discretas UN usan step decimal genérico (Medium)
- **UX-106**: revisión de etapa no resalta stageType/processCode/base (Medium)
- **UX-107**: compatibilidad COUNT/UN con receta no es visible entre módulos (Medium)

## Accepted guidance
- Priorizar un alcance incremental y seguro, centrado en UX.
- No introducir re-arquitectura del modelo híbrido dentro de este spec.
- Hacer explícito el uso de `PER_FINISHED_UNIT` para casos como `1 tapa por producto terminado`.
- Mejorar guía de `CAPPING` y dependencia de `RECOLLECTION`.
- Enriquecer labels del selector y revisión visible de recetas.

## Deferred guidance
- UX-101 queda documentado como limitación estructural real y follow-up recomendado, no como cambio de este alcance.

## Rejected guidance
- No hubo guidance rechazada del auditor; solo se limitó el alcance para no mezclar una mejora UX incremental con un rediseño estructural mayor.

## Requires clarification
No quedan aclaraciones funcionales críticas abiertas para esta iteración.

## Resolved since initial review
- Decimales en `UN`: warning no bloqueante.
- “Legado”: se elimina del copy visible y queda solo como referencia técnica interna si fuera necesario.
- La guía no será exclusiva de `CAPPING`; cubrirá también `PROCESSING` equivalente, incluyendo envasado/empaque cuando aplique.
- Se permite replicar copy y señales visibles en superficies equivalentes de bodega cuando el cambio sea incremental y seguro.
- Se acepta mejora cliente-side de descubrimiento por categoría, subcategoría, nombre y código sobre el dataset ya cargado.
