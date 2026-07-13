# Changelog

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
