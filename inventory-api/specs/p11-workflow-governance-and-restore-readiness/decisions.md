# Decisions

## Accepted planning decisions
1. Este spec se modela como follow-up de `p11-node24-runtime-migration`, no como reapertura de la migración Node 24.
2. La ruta oficial y única de workflows a converger es `/.github/workflows/`.
3. El árbol `inventory-api/.github/workflows/` debe retirarse como fuente activa; la preferencia aprobable es eliminar los YAML duplicados.
4. El gate `validate:restore-readiness` debe preservarse si puede apoyarse en la implementación real ya existente en `scripts/validate-restore-readiness.js`.
5. La corrección preferida del fallo actual es exponer el script npm faltante y armonizar el contrato documental, no eliminar el paso del workflow.
6. El contrato documental de restore readiness debe quedar alineado con artefactos versionados y comprobables por el repositorio público; `internal-docs/` no debe seguir siendo prerrequisito implícito de un workflow obligatorio público salvo que quede explícitamente modelado como overlay opcional y no bloqueante.

## Priority rule
La prioridad principal de este spec es restaurar integridad de gobernanza y smoke operacional sin introducir cambios funcionales no relacionados.

## Implementation choices expected
- Simplificar validadores/tests a root-only workflow governance.
- Agregar `validate:restore-readiness` a `package.json` usando el script real existente.
- Crear o completar `docs/restore-readiness-baseline.md` si se confirma que el contrato público debe vivir en `docs/`.
- Actualizar docs de arquitectura/current-state/action-plan/tasks para declarar el modelo final sin árbol duplicado.

## Rejected alternatives
- Mantener duplicación de workflows como estado permanente.
- Resolver el fallo de CI solamente quitando el paso `validate:restore-readiness` sin revisar la implementación existente.
- Dejar sin resolver la divergencia entre documentación pública `docs/` y referencias opcionales `internal-docs/`.

## Resolved implementation decision
### OD-001
**Question:** ¿Se adopta `docs/` como ubicación canónica pública de restore-readiness baseline para el gate obligatorio?
**Implemented decision:** Sí.
**Reason:** es la opción más coherente con el workflow público, el runbook público y la necesidad de documentación reproducible por otros agentes sin acceso a overlays privados.
**Implemented outcome:** `docs/restore-readiness-baseline.md` fue creado, `validate:restore-readiness` quedó expuesto en `package.json`, y `scripts/validate-restore-readiness.js` ahora valida el contrato público versionado bajo `docs/`.
