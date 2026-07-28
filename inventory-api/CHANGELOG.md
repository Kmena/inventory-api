# Changelog

## 2026-07-28
- Convergida la gobernanza contractual de runtime para que `docs/**` sea la fuente canónica revisada y `internal-docs/**` quede solo como soporte auxiliar no canónico.
- Añadido el lane obligatorio `redis-browser-session-tests` junto con el comando `npm run test:redis-path` para validar explícitamente la ruta Redis de browser sessions sin desestabilizar el suite agregado en memory mode.
- Endurecida la observabilidad operativa de browser sessions sobre Redis con readiness del store, cobertura de pruebas para `/health/ready` y guía de diagnóstico/recuperación en el runbook productivo.
- Cerrada `TASK-018` documentando que `legacy-public-runtime/` queda solo como respaldo/referencia transicional hasta que las secciones equivalentes estén implementadas y validadas en el SPA.
- Cerrada `TASK-019` documentando que el runtime público reducido y su baseline de `typecheck`/validación no pueden reexpandirse hacia páginas legacy retiradas sin un nuevo spec aprobado.
- Cerradas `TASK-023` y `TASK-024` definiendo que `/migration.html?mode=post-login-transition` sigue como landing temporal de “no implementado aún” con salida segura al login/logout, y que la mitigación aprobada para el ruido de auditoría en tests es separar suites DB-free de suites DB-backed antes de considerar supresión estrecha de logs.
- Implementado `p26-browser-runtime-db-free-suite-separation`: añadido `docs/test-suite-catalog.md`, estabilizado `tests/audit-instrumentation.test.js` como suite DB-free en memory mode y aislado el ruido incidental de persistencia de auditoría en `tests/browser-e2e.e2e.js` mediante un helper de seam compartido sin tocar la semántica productiva de auditoría.

## 2026-07-21
- Endurecido el store de throttling con modo por archivo compartible y soporte configurable `memory|file`.
- Unificada la validación de archivos sensibles para documentos de cliente y comprobantes de pago.
- Extendida la gobernanza central de autorización a rutas de clientes, geocoding y taxpayer.
- Eliminado riesgo monetario residual en cálculos derivados adicionales y añadidas pruebas de regresión focalizadas.
- Alineado `uploadClientDocumentSchema` con la gobernanza sensible compartida y actualizada la caracterización de payloads al contrato central de access policies.

## 2025-10-29
- Completed `p12-browser-session-closure`: moved supported browser flows from persisted bearer tokens to backend-owned browser sessions with cookie-backed bootstrap/logout, updated shared browser helpers, and added session-boundary/browser E2E coverage.
