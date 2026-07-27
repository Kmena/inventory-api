# Solution Architecture

## 1. Architecture summary
La solución convergerá `validate:operational-readiness` hacia el mismo modelo público de artefactos versionados en `docs/` que ya utiliza restore readiness, reforzando además el contrato de `.env.production.example` mediante documentación y, si hace falta, validación o caracterización explícita.

## 2. Design goals
- Eliminar dependencia funcional de `internal-docs/` para el gate público de operational readiness.
- Mantener coherencia con `validate:restore-readiness`.
- Hacer explícito y verificable el rol de `.env.production.example`.

## 3. Proposed components
### 3.1 Public operational-readiness validator
- Actualizar `scripts/validate-operational-readiness.js` para leer `docs/production-operations-runbook.md` y `docs/production-baseline.md`.
- Crear documento público adicional solo si el contrato actual en esos dos docs no basta.

### 3.2 `.env.production.example` baseline closure
- Confirmar su presencia con tests o validación contractual.
- Alinear README y docs para nombrarlo de forma consistente.

## 4. Validation strategy
- `npm run validate:operational-readiness`
- tests de characterization de production baseline y operational readiness
- revisión hosted de `operational-smoke`

## 5. Decision
El baseline operativo público debe dejar de depender de overlays opcionales para el gate principal y debe tratar `.env.production.example` como artefacto contractual explícito si sigue formando parte del flujo documentado.
