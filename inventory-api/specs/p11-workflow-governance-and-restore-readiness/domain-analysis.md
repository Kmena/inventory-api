# Domain Analysis

## Scope boundary
Este spec cubre gobernanza de workflows y baseline operativo documental/técnico alrededor de restore readiness. No cubre lógica funcional de dominio, seguridad de negocio, ni rediseño general del pipeline CI.

## Affected domain concepts
- **Workflow source of truth:** ruta única aprobada desde la cual GitHub Actions y validadores toman la definición oficial.
- **Workflow governance contract:** relación entre YAML, scripts npm, scripts Node, tests caracterizadores y documentación de soporte.
- **Operational smoke gate:** conjunto mínimo de checks operativos exigidos por `operational-smoke`.
- **Restore readiness evidence:** artefactos versionados y comandos que documentan y validan el baseline mínimo de backup/restore.

## Actors and goals
- **Platform maintainer:** evitar drift entre workflows y garantizar que CI ejecute contratos reales.
- **Backend maintainer:** preservar scripts y tests operativos sin introducir deuda nueva.
- **Architecture reviewer:** confirmar que el repositorio usa una sola fuente oficial de workflows y un contrato documental coherente.
- **QA / evidence reviewer:** poder reejecutar validaciones y revisar evidencias hosted/locales sin ambigüedad.

## Business rules in domain terms
- Una sola definición oficial de workflow debe gobernar hosted CI y validación local.
- Un workflow obligatorio solo puede exigir comandos npm realmente expuestos por el paquete.
- El contrato de restore readiness debe ser auditable en artefactos versionados coherentes.
- Los cambios deben permanecer fuera del dominio funcional de negocio.

## Boundaries and invariants
- `/.github/workflows/` es el boundary operativo oficial del pipeline hospedado.
- `inventory-api/package.json` es el contrato de comandos soportados por el subproyecto.
- `inventory-api/scripts/validate-restore-readiness.js` define la lógica técnica del gate de restore readiness.
- `inventory-api/docs/*` y los tests de caracterización deben describir el mismo baseline operativo que el workflow usa.

## Known unknowns
- Si conviene soportar simultáneamente documentación pública `docs/` y una capa privada `internal-docs/`, o si esa dualidad debe eliminarse para este baseline.
- Si la eliminación física de `inventory-api/.github/workflows/` requerirá un pequeño ajuste adicional en scripts/tests no identificados aún.

## Recommended framing
Tratar este spec como un cierre de deuda operativa y de gobernanza. El éxito no es solo “borrar una carpeta” o “agregar un script npm”, sino garantizar que workflows oficiales, package scripts, validadores, tests y documentación describen exactamente el mismo baseline ejecutable.
