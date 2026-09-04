# Risks
## 1. Implementation risks
- **R-001: Ambigüedad de copy.**
  - Impacto: medio
  - Mitigación: revisar textos contra AC-001 a AC-006 y usar ejemplos concretos como tapas/etiquetas.

- **R-002: Sobrecarga de lógica en `recipes-admin.version-editor.js`.**
  - Impacto: medio
  - Mitigación: extraer helpers pequeños para formateo y compatibilidad, evitando un refactor amplio.

- **R-003: Validación demasiado dura para `UN`.**
  - Impacto: alto
  - Mitigación: comenzar con warnings no bloqueantes salvo aprobación explícita de bloqueo.

## 2. Regression risks
- **R-004: Romper el payload actual del editor de versiones.**
  - Impacto: alto
  - Mitigación: no alterar `buildVersionPayload(...)` más allá de comportamiento visual; ejecutar tests existentes de recetas.

- **R-005: Ocultar accidentalmente productos válidos en selectores.**
  - Impacto: medio
  - Mitigación: enriquecer labels sin cambiar el criterio de inclusión, excepto donde ya existe filtering por recolección previa.

## 3. UX risks
- **R-006: Que el usuario interprete que COUNT/UN está prohibido en recetas por kg.**
  - Impacto: alto
  - Mitigación: wording de warning como “implicación/atención” y no como error absoluto.

- **R-007: Que “legado” siga sesgando la decisión.**
  - Impacto: medio
  - Mitigación: de-emphasize o remover ese término del copy principal visible.

## 4. Security and privacy risks
- **R-008: Exponer metadata no autorizada del producto.**
  - Impacto: bajo
  - Mitigación: mostrar solo campos de catálogo ya disponibles por `productsApi` y no datos de inventario restringidos.

## 5. Operational risks
- **R-009: La limitación estructural de base global siga generando casos híbridos problemáticos.**
  - Impacto: alto
  - Mitigación: documentar explícitamente como follow-up fuera de alcance y no sobreprometer capacidad híbrida. El cierre de este spec debe dejar un recordatorio explícito para abrir el siguiente spec de soporte híbrido por insumo.

## 6. Migration risks
- **R-010: Introducir por accidente una migración innecesaria.**
  - Impacto: bajo
  - Mitigación: mantener el alcance frontend-only y validar que no se toquen `prisma/schema.prisma` ni migraciones.

- **R-011: La mejora de descubrimiento de productos en cliente no escale por el límite actual de carga.**
  - Impacto: medio
  - Mitigación: limitar el alcance a filtros cliente-side sobre el dataset actual; si `pageSize: 100` resulta insuficiente, registrar follow-up separado de carga/paginación/búsqueda estructural.
