# Changelog

## 2026-08-04
- Implementado `bcrypt-supply-chain-closeout`: actualizado `bcrypt` a `^6.0.0`, eliminado el chain `@mapbox/node-pre-gyp`/`tar`, añadida caracterización de compatibilidad de hashes/login y convergida la gobernanza de `npm audit` a un baseline de 0 vulnerabilidades documentando el bloqueo local de Docker.
- Implementado `due-diligence-final-closeout`: capturada la baseline fresca de `npm audit`, separadas correcciones seguras frente al path breaking de `bcrypt`, sincronizada la gobernanza/documentación del lane `dependency-hygiene`, añadidos índices Prisma acotados para `User`, `OrderItem` e `Invoice`, y actualizado el cierre final en `docs/audit/current-code-audit.md`.

## 2025-08-16
- Revalidado `merge-readiness-regression-control` `TASK-004`: actualizada la definición de la matriz markdown de autorización con columna de patrón de ownership, ejemplos base por endpoints representativos y corrección del drift que todavía describía `agent.routes.js` como `authenticate`-only.
- Implementado `merge-readiness-regression-control` (ciclo TASK-001 a TASK-003): diferenciada la evidencia CI de Windows Prisma frente al baseline local gobernado, añadido reporte local mínimo de diagnóstico para `prisma-generate-safe`, y convergida la protección de `agent.routes.js` sobre `authorizeAccessPolicy('agent.workspace.access')` con cobertura de regresión actualizada.

## 2025-08-15
- Implementado `p38-root-shell-modularity-hardening`: agregado `src/public/root/registry.js`, migrado el shell root soportado a `window.RootShell` (`register/require/has`), mantenido el comportamiento de `/root/` y `410 Gone`, y actualizada la validación/documentación asociada.

## 2025-08-14
- Implementado `root-shell-follow-up-alignment`: alineadas las pruebas de gobernanza con `/root/` como runtime soportado, ampliado el allowlist acotado de `typecheck` al shell root aprobado, sincronizada la documentación de baseline y diferida explícitamente la modularidad del shell a un spec futuro.
- Implementado `p28-flexible-permission-governance-foundation`: añadida una foundation central de gobernanza de permisos en `src/security/**`, endurecida la creación de compañías para que solo un `root` global pueda ejecutarla desde backend y documentada la guía UX + secuencia futura para `roles_permissions` sin activar todavía enforcement adicional no aprobado.

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
