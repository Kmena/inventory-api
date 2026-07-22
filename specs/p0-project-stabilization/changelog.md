# Changelog

## 2026-07-15 - replay resolution back-propagation
- Back-propagated approved replay-fix results from `specs/p0-replay-blocker-fix/` into the parent P0 package.
- Preserved historical failed and unstable replay attempts while recording successful canonical replay evidence as the final closure condition.
- Updated parent closure interpretation from failed/incomplete to completed.

## 2026-07-15
- Updated parent-package closure documentation to record successful real GitHub Actions run `29383737072` / job `87252601412` for commit `5c16b2c91e22b49085e1cb7f72a3ae58bd1bf50f`.
- Preserved earlier failed GitHub Actions runs `29287056129` and `29288885694` as historical negative evidence rather than deleting them.
- Narrowed the remaining closure blocker to the clean database replay inconsistency.

## 2026-07-13
- Completed closure back-propagation from `specs/p0-extra-inclusion/` into the original `p0-project-stabilization` package.
- Recorded durable GitHub Actions evidence: preserved failed runs `29287056129` and `29288885694`, including the newer failed `quality-gates` job `86947744464`.
- Recorded explicit supported-runtime contract alignment across `package.json`, README, CI, and Docker (Node 20.x / `>=20 <21`).
- Updated original P0 documents to reflect the fresh compose-aligned clean-DB replay attempt and its reproduced target-database disappearance anomaly.
- Added a dedicated post-implementation `closure-report.md` for the original package.
- Preserved the earlier closure review as a historical snapshot while clarifying the combined interpretation after the approved follow-up packages.

## 2026-07-12
- Aprobado el paquete `specs/p0-project-stabilization/` para implementación.
- Agregados `advisor-review.md`, `domain-analysis.md` y `traceability.md` para completar el paquete obligatorio.
- Implementada la política de logging por ambiente para `development`, `staging`, `test` y `production`.
- Reemplazado el logging completo de errores en no-dev por logging saneado con `errorCode`, método, ruta y status.
- Agregadas pruebas mínimas con `node:test` para validar la política de logging.
- Scopeadas por tenant las lecturas, actualizaciones y eliminaciones de clientes.
- Alineado `POST /api/clients` para derivar `companyId` desde el usuario autenticado y descartar inyección por payload.
- Scopeadas por tenant las consultas de listado y detalle de facturas usando `Invoice -> Client.companyId`.
- Validadas las referencias `clientId` y `orderId` en create/update de facturas y scopeadas las mutaciones delete/update por tenant.
- Scopeadas por tenant las consultas de listado y detalle de pagos usando `Payment -> Invoice -> Client.companyId`.
- Validadas las referencias `invoiceId` en create/update de pagos y scopeadas las mutaciones delete/update por tenant.
- Movidos los documentos nuevos de clientes a almacenamiento privado, expuesta la descarga autenticada por tenant y adaptado el frontend interno para descargar con `fetch` autenticado.
- Agregado un script operativo para migrar documentos históricos desde rutas públicas legacy a almacenamiento privado.
- Agregado `npm test` como comando reproducible para ejecutar la suite mínima de estabilización con `node:test`.

## 2025-02-14
- Creado el paquete `specs/p0-project-stabilization/`.
- Documentados requerimientos de la etapa 1 urgente basados en `docs/audit/audit.json`.
- Analizado el estado actual de clientes, facturas, pagos, documentos y logging.
- Diseñada una solución incremental compatible con la arquitectura actual.
- Definido plan de implementación secuencial con trazabilidad.
- Definidas 9 tareas ejecutables y verificables.
- Registrados riesgos y decisiones propuestas para revisión humana.
- Incorporadas decisiones confirmadas por el usuario: roots fuera de clientes/facturas/pagos, `POST /api/clients` forzado por `req.auth.companyId`, migración sistemática de documentos históricos, `fileUrl` protegido y `node:test` como base mínima.
- Confirmado que el acceso protegido a documentos será solo descarga y que la eliminación física de clientes/facturas/pagos queda documentada como deuda.
- Confirmado que `staging` conservará logging mínimo con contexto técnico básico.

## 2026-07-13 - Closure review update by `baseline-audit-agent-b9bb2c`
- Revisados `metadata.yaml`, `tasks.md`, `implementation-report.md`, `traceability.md`, `current-state.md` y `risks.md` del paquete aprobado `specs/p0-project-stabilization/`.
- Confirmado estáticamente que las tareas `TASK-001` a `TASK-009` tienen artefactos de código consistentes en el repositorio actual.
- Confirmado estáticamente que `AUD-001`, `AUD-002`, `AUD-003`, `AUD-012` y `AUD-013` tienen trazabilidad clara hacia código y pruebas.
- Detectado drift documental en `current-state.md` respecto al estado real del repositorio; el documento fue actualizado con una sección de diferencias.
- Registrado resultado de cierre como `P0 Incomplete` porque esta revisión no pudo re-ejecutar pruebas, smoke checks ni replay de migraciones desde base limpia.
- Registrados riesgos de cierre remanentes por falta de `lint`, `typecheck` y `build` en `inventory-api/package.json`.
