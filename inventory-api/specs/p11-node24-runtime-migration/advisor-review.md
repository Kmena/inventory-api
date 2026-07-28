# Advisor Review
## Findings
- No advisor input has been provided yet.
- P11 ya delimitó que el problema Node 24 no es documental: existe evidencia concreta de incompatibilidad Prisma/runtime bajo host Node 24.
- El mayor riesgo técnico es cambiar el baseline completo a Node 24 sin aislar primero por qué `PrismaClient` deja de comportarse como constructor en el entorno observado.
- También es importante no mezclar el baseline Windows rename-lock con una regresión nueva de Node 24, porque llevaría a diagnósticos erróneos.

## Accepted guidance
- Usar P11 como fuente principal.
- Mantener la migración coordinada entre package, Docker y workflows.
- Exigir validación real y rollback explícito.

## Deferred guidance
- Decidir durante implementación si hace falta upgrade mínimo de Prisma/tooling o basta con ajustar bootstrap/generación.

## Rejected guidance
- Cerrar el substream solo con actualización declarativa de versiones.

## Requires clarification
- Confirmar durante implementación si Playwright o alguna dependencia auxiliar requiere ajuste adicional bajo Node 24.
