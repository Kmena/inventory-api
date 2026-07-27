# Solution Architecture

## 1. Architecture summary
La solución convergió `validate:operational-readiness` hacia el mismo modelo público de artefactos versionados en `docs/` que ya utiliza restore readiness, reforzando además el contrato de `.env.production.example` mediante documentación, validación y caracterización explícita.

## 2. Design goals
- Eliminar dependencia funcional de `internal-docs/` para el gate público de operational readiness.
- Mantener coherencia con `validate:restore-readiness`.
- Hacer explícito y verificable el rol de `.env.production.example`.

## 3. Proposed components
### 3.1 Public operational-readiness validator
- `scripts/validate-operational-readiness.js` ahora lee `docs/production-operations-runbook.md` y `docs/production-baseline.md`.
- No se creó documento público adicional y la implementación confirmó que no era necesario para esta convergencia.
- Crear un tercer documento público solo si en un cambio futuro aprobado aparece alguna de estas señales:
  - el validador necesita reglas operativas que no caben claramente en los 2 docs actuales;
  - observabilidad, hardening y readiness quedan mezclados de forma confusa;
  - los tests/documentación terminan demasiado ambiguos para auditar.

### 3.2 `.env.production.example` baseline closure
- Su presencia quedó confirmada con validación contractual, characterization tests y la excepción `!.env.production.example` en `inventory-api/.gitignore`.
- `scripts/validate-production-baseline.js` ahora lo trata como artefacto requerido del baseline productivo versionado.
- README y docs quedaron alineados para nombrarlo de forma consistente.

## 4. Validation strategy
- `npm run validate:operational-readiness`
- tests de characterization de production baseline y operational readiness
- revisión hosted de `operational-smoke` con run exitoso `30291012752`

## 5. Decision
El baseline operativo público debe dejar de depender de overlays opcionales para el gate principal y debe tratar `.env.production.example` como artefacto contractual explícito mientras siga formando parte del flujo documentado.

La implementación validó además que el contrato público de operational readiness cabe en dos documentos (`docs/production-baseline.md` y `docs/production-operations-runbook.md`) sin requerir un tercer documento público.

El estado final también confirma que el workflow root `operational-smoke` volvió a pasar en hosted (`30291012752`) después de materializar temporalmente `.env.production` en CI y de mantener `.env.production.example` como artefacto trackeado del baseline.
