# Runtime Endpoint Catalog

## Purpose
Este documento formaliza el inventario actual de endpoints montados en runtime para `inventory-api`.

## Contract-scope baseline
### Artifact roles
- `docs/openapi/runtime-baseline.openapi.json`
  - contiene únicamente las operaciones cubiertas por el contrato OpenAPI factual parcial;
  - cada operación cubierta debe declarar `x-runtime-source`.
- `docs/runtime-contract-manifest.json`
  - contiene toda operación montada en routers que queda intencionalmente fuera del OpenAPI parcial, con razón explícita;
  - también registra superficies runtime no enrutadas que siguen fuera de OpenAPI, como `express.static(src/public)`.
- `docs/critical-contract-matrix.json`
  - resume la superficie mínima crítica resuelta con la opción aprobada B.
- Este catálogo
  - funciona como referencia humana consolidada del runtime montado y del criterio de clasificación contractual.

### Classification rule
Toda operación montada en routers debe quedar clasificada por exactamente uno de estos mecanismos:
1. `covered-by-openapi`: la operación aparece en `docs/openapi/runtime-baseline.openapi.json` con `x-runtime-source`.
2. `intentionally-excluded`: la operación aparece en `docs/runtime-contract-manifest.json` con `reasonCode` y razón explícita.

No se aceptan rutas montadas sin clasificar.

### Current contract summary
Option B satisfied for the minimum critical contract surface.
- Operaciones montadas en routers descubiertas desde `src/app.js` + `src/routes/*.routes.js`: `95`
- Operaciones cubiertas por OpenAPI parcial: `75`
- Operaciones excluidas explícitamente del OpenAPI parcial: `20`
- Superficie runtime adicional intencionalmente fuera de OpenAPI: `express.static(src/public)`

### Intentionally excluded OpenAPI operations
Las exclusiones actuales viven en `docs/runtime-contract-manifest.json`. Option B satisfied para la superficie mínima crítica documentada en `docs/critical-contract-matrix.json`. Las categorías activas son:
- aliases o formas legacy compatibles preservadas;
- superficies root/global fuera del recorte contractual actual;
- mutaciones o subrecursos profundos de lifecycle aún no formalizados en OpenAPI parcial;
- integraciones auxiliares o superficies runtime gobernadas por otras pruebas/documentos.

## Scope and evidence rules
- Solo se documentan endpoints verificables en `src/routes/` y montados en `src/app.js`.
- La autorización indicada refleja lo observable en los middlewares de ruta.
- Cuando una ruta solo exige `authenticate`, la política detallada puede vivir en servicios/repositorios y debe revisarse allí para cambios funcionales.
- Este documento describe **runtime actual confirmado**, no roadmap.

## Canonical domains covered
- Plataforma y seguridad
- Gobierno organizacional y tenant
- Clientes y crédito comercial
- Geografía comercial
- Fuerza de ventas y operación en campo
- Catálogo comercial y productos
- Inventario, bodegas y lotes
- Pedidos
- Facturación y documentos comerciales
- Cobros, pagos y conciliación
- Alertas operativas
- Integraciones externas
- Producción y formulación
- Aprobaciones transversales
- Reportes, dashboards y exportaciones

## Plataforma y seguridad
| Method | Path | Authentication | Authorization observed | Purpose | Notes |
|---|---|---|---|---|---|
| GET | `/health` | No | None | Liveness básica del servicio | `health.routes.js` |
| GET | `/health/ready` | No | None | Readiness con chequeo de base de datos | Responde `503` si DB no está lista |
| POST | `/api/auth/login` | No | None | Iniciar sesión y emitir contexto autenticado | Validado por `loginSchema`; emite sesión browser por cookie cuando recibe `X-Inventory-Browser-Session: cookie` |
| GET | `/api/auth/me` | Sí | `authenticate` | Obtener sesión/auth payload actual | Sin role middleware adicional; refresca cookies para requests browser autenticados por cookie |
| POST | `/api/auth/logout` | Sí | `authenticate` | Cerrar sesión autenticada actual | Invalida la sesión browser backend-owned y limpia cookies |

## Gobierno organizacional y tenant
| Method | Path | Authentication | Authorization observed | Purpose | Notes |
|---|---|---|---|---|---|
| GET | `/api/companies/` | Sí | `authorizeAccessPolicy('company.list-global')` | Listar compañías globales | Superficie root con actor scope `global-root` |
| GET | `/api/companies/root/companies` | Sí | `authorizeAccessPolicy('company.root-companies.list')` | Listar compañías para gestión root | Consumido por UI root; actor scope `global-root` |
| GET | `/api/companies/root/dashboard` | Sí | `authorizeAccessPolicy('company.dashboard')` | Dashboard ejecutivo de compañía | Ruta legacy preservada; requiere actor `admin` con `companyId` |
| GET | `/api/companies/company/dashboard` | Sí | `authorizeAccessPolicy('company.dashboard')` | Dashboard ejecutivo de compañía | Alias semántico aprobado; requiere actor `admin` con `companyId` |
| PATCH | `/api/companies/root/companies/:companyId/status` | Sí | `authorizeAccessPolicy('company.root-companies.update-status')` | Activar/inactivar compañía | Validado por schema |
| POST | `/api/companies/` | Sí | `authorizeAccessPolicy('company.create-global')` | Crear compañía | Flujo root; la policy declara actor scope `global-root` y el servicio revalida el límite global-root antes de persistir |
| POST | `/api/companies/root/companies` | Sí | `authorizeAccessPolicy('company.root-companies.create')` | Crear compañía root-style | Compatibilidad explícita; actor scope `global-root` y revalidación sensible en servicio |
| GET | `/api/users/` | Sí | `authorize('root')` | Listar usuarios globales | Scope root |
| GET | `/api/users/company` | Sí | `authorize('admin')` | Listar usuarios de la compañía autenticada | Consumido por UI root/admin |
| POST | `/api/users/company` | Sí | `authorize('admin')` | Crear usuario de compañía | Validado por schema |
| POST | `/api/users/` | Sí | `authorize('root')` | Crear usuario global | Scope root |
| GET | `/api/roles/permissions` | Sí | `authorizeAccessPolicy('role.permissions.list')` | Listar permisos asignables | Base para roles personalizados |
| GET | `/api/roles/company` | Sí | `authorizeAccessPolicy('role.company.list')` | Listar roles asignables por compañía | Consumido por UI; actor scope `company-admin` |
| POST | `/api/roles/company` | Sí | `authorizeAccessPolicy('role.company.create')` | Crear rol de compañía | Validado por schema; actor scope `company-admin`, y el servicio aplica gobernanza adicional, niega permisos de alcance plataforma como `companies.manage` antes de persistir y registra el deny path mediante auditoría fail-open cuando hay contexto de request |

## Clientes y crédito comercial
| Method | Path | Authentication | Authorization observed | Purpose | Notes |
|---|---|---|---|---|---|
| GET | `/api/clients/` | Sí | `authorize('admin', 'sales')` | Listar clientes | Variante general |
| GET | `/api/clients/company` | Sí | `authorize('admin', 'sales')` | Listar clientes de la compañía | Consumido por UI |
| GET | `/api/clients/classifications/company` | Sí | `authorize('admin', 'sales')` | Listar clasificaciones de cliente | Consumido por UI |
| GET | `/api/clients/document-types` | Sí | `authorize('admin', 'sales')` | Listar tipos de documento soportados | Catálogo estático/servicio |
| POST | `/api/clients/company` | Sí | `authorize('admin', 'sales')` | Crear cliente de compañía | Validado por schema |
| POST | `/api/clients/company/:clientId/stores` | Sí | `authorize('admin', 'sales')` | Crear tienda/sucursal de cliente | UI root/admin |
| POST | `/api/clients/:clientId/documents` | Sí | `authorize('admin', 'sales')` | Registrar documento privado de cliente | Descarga protegida asociada |
| POST | `/api/clients/:clientId/references` | Sí | `authorize('admin', 'sales')` | Crear referencia comercial del cliente | UI root/admin |
| GET | `/api/clients/:clientId/documents/:documentId/download` | Sí | `authorize('admin', 'sales')` | Descargar documento privado de cliente | No expone static public path |
| GET | `/api/clients/:id` | Sí | `authorize('admin', 'sales')` | Obtener detalle de cliente | UI root/admin |
| POST | `/api/clients/` | Sí | `authorize('admin', 'sales')` | Crear cliente | Duplicación intencional de contrato actual |
| PUT | `/api/clients/:id` | Sí | `authorize('admin', 'sales')` | Actualizar cliente | Validado por schema |
| DELETE | `/api/clients/:id` | Sí | `authorize('admin')` | Eliminar cliente | Restringido a admin |

## Geografía comercial
| Method | Path | Authentication | Authorization observed | Purpose | Notes |
|---|---|---|---|---|---|
| GET | `/api/regions/company` | Sí | `authorize('admin')` | Listar regiones de compañía | Consumido por UI |
| POST | `/api/regions/company` | Sí | `authorize('admin')` | Crear región | Validado por schema |
| POST | `/api/regions/company/:regionId/subregions` | Sí | `authorize('admin')` | Crear subregión | Consumido por UI de zonas |
| GET | `/api/economic-activities` | Sí | `authorize('admin', 'sales')` | Buscar actividades económicas | Endpoint de apoyo para clientes |

## Fuerza de ventas y operación en campo
| Method | Path | Authentication | Authorization observed | Purpose | Notes |
|---|---|---|---|---|---|
| GET | `/api/sales-routes/company` | Sí | `authorize('admin', 'sales_supervisor')` | Listar rutas comerciales | UI root/routes |
| POST | `/api/sales-routes/company` | Sí | `authorize('admin', 'sales_supervisor')` | Crear ruta comercial | Validado por schema |
| GET | `/api/sales-routes/company/:routeId` | Sí | `authorize('admin', 'sales_supervisor')` | Obtener detalle de ruta | UI root/routes |
| PUT | `/api/sales-routes/company/:routeId` | Sí | `authorize('admin', 'sales_supervisor')` | Actualizar ruta | |
| PUT | `/api/sales-routes/company/:routeId/subzones` | Sí | `authorize('admin', 'sales_supervisor')` | Guardar subzonas de ruta | |
| DELETE | `/api/sales-routes/company/:routeId/subzones/:subzoneId` | Sí | `authorize('admin', 'sales_supervisor')` | Remover subzona de ruta | |
| PUT | `/api/sales-routes/company/:routeId/assignments` | Sí | `authorize('admin', 'sales_supervisor')` | Guardar asignaciones de ruta | |
| PUT | `/api/sales-routes/company/agents/:userId/goals` | Sí | `authorize('admin', 'sales_supervisor')` | Guardar metas de agente | |
| GET | `/api/agent/dashboard` | Sí | `authenticate` | Dashboard del agente autenticado | Scope fino en servicio |
| GET | `/api/agent/stores` | Sí | `authenticate` | Listar tiendas visibles para agente | Scope fino en servicio |
| GET | `/api/agent/stores/:storeId` | Sí | `authenticate` | Obtener detalle de tienda del agente | |
| GET | `/api/agent/stores/:storeId/purchase-history` | Sí | `authenticate` | Historial de compras por tienda | |
| GET | `/api/agent/stores/:storeId/sellable-products` | Sí | `authenticate` | Productos vendibles por tienda | |
| GET | `/api/agent/stores/:storeId/order-context` | Sí | `authenticate` | Contexto de pedido para la tienda | |
| GET | `/api/agent/goals` | Sí | `authenticate` | Listar metas del agente | |
| POST | `/api/agent/visits` | Sí | `authenticate` | Registrar visita del agente | Validado por schema |
| GET | `/api/agent/visits` | Sí | `authenticate` | Listar visitas del agente | |
| POST | `/api/agent/stores/:storeId/orders` | Sí | `authenticate` | Crear pedido desde tienda del agente | Validado por schema |

## Catálogo comercial y productos
| Method | Path | Authentication | Authorization observed | Purpose | Notes |
|---|---|---|---|---|---|
| GET | `/api/products/` | Sí | `authorizePermission('products.view', 'products.manage')` | Listar productos | Soporta paginación |
| GET | `/api/products/:id` | Sí | `authorizePermission('products.view', 'products.manage')` | Obtener detalle de producto | |
| POST | `/api/products/` | Sí | `authorizePermission('products.manage')` | Crear producto | Validado por schema |
| POST | `/api/products/import` | Sí | `authorizePermission('products.import', 'products.manage')` | Importar productos | Consumido por UI warehouse/root |
| PUT | `/api/products/:id` | Sí | `authorizePermission('products.manage')` | Actualizar producto | |
| DELETE | `/api/products/:id` | Sí | `authorizePermission('products.manage')` | Eliminar producto | Semántica caracterizada por tests |

## Inventario, bodegas y lotes
| Method | Path | Authentication | Authorization observed | Purpose | Notes |
|---|---|---|---|---|---|
| GET | `/api/inventory/alerts` | Sí | `authorizePermission('inventory.view', 'inventory.manage', 'inventory.qa.manage')` | Listar alertas operables de inventario | Soporta paginación y filtros |
| GET | `/api/inventory/alerts/:id` | Sí | `authorizePermission('inventory.view', 'inventory.manage', 'inventory.qa.manage')` | Obtener detalle contextual de alerta | |
| PATCH | `/api/inventory/alerts/:id/status` | Sí | `authorizePermission('inventory.manage', 'inventory.qa.manage')` | Actualizar estado operativo de alerta | `ACKNOWLEDGED` / `RESOLVED` |
| GET | `/api/inventory/stocks` | Sí | `authorizePermission('inventory.view', 'inventory.manage')` | Listar existencias | Filtros opcionales |
| GET | `/api/inventory/movements` | Sí | `authorizePermission('inventory.view', 'inventory.manage')` | Listar movimientos de inventario | Soporta paginación |
| POST | `/api/inventory/entries` | Sí | `authorizePermission('inventory.manage')` | Registrar entrada de stock | UI root/products |
| PATCH | `/api/inventory/lots/:id/qa` | Sí | `authorizePermission('inventory.qa.manage')` | Registrar QA de lote | |
| POST | `/api/inventory/adjustments` | Sí | `authorizePermission('inventory.manage')` | Ajustar stock | |
| GET | `/api/warehouses/company` | Sí | `authorizePermission('inventory.view', 'inventory.manage')` | Listar bodegas de compañía | Consumido por UI |
| POST | `/api/warehouses/company` | Sí | `authorizePermission('inventory.manage')` | Crear bodega de compañía | |

## Pedidos
| Method | Path | Authentication | Authorization observed | Purpose | Notes |
|---|---|---|---|---|---|
| GET | `/api/orders/` | Sí | `authorize('admin', 'sales', 'warehouse')` | Listar pedidos | |
| GET | `/api/orders/:id` | Sí | `authorize('admin', 'sales', 'warehouse')` | Obtener detalle de pedido | |
| POST | `/api/orders/` | Sí | `authorizePermission('sales.manage', 'sales.orders.create')` | Crear pedido | |
| PUT | `/api/orders/:id` | Sí | `authorizePermission('sales.manage', 'sales.orders.create')` | Actualizar pedido | |
| POST | `/api/orders/:id/approve` | Sí | `authorize('admin', 'sales')` | Aprobar pedido | Aprobación específica del dominio pedido |
| POST | `/api/orders/:id/cancel` | Sí | `authorize('admin', 'sales')` | Cancelar pedido | |
| POST | `/api/orders/:id/dispatch` | Sí | `authorize('admin', 'warehouse')` | Despachar pedido | |
| DELETE | `/api/orders/:id` | Sí | `authorize('admin')` | Eliminar pedido | |

## Facturación y documentos comerciales
| Method | Path | Authentication | Authorization observed | Purpose | Notes |
|---|---|---|---|---|---|
| GET | `/api/invoices/` | Sí | `authorize('admin', 'sales')` | Listar facturas | Soporta paginación |
| GET | `/api/invoices/inconsistencies` | Sí | `authorize('admin')` | Listar inconsistencias de deuda/facturación | Consumido por UI root |
| GET | `/api/invoices/:id` | Sí | `authorize('admin', 'sales')` | Obtener detalle de factura | |
| POST | `/api/invoices/` | Sí | `authorize('admin', 'sales')` | Crear factura | |
| PUT | `/api/invoices/:id` | Sí | `authorize('admin', 'sales')` | Actualizar factura | Guardrails adicionales en servicio |
| DELETE | `/api/invoices/:id` | Sí | `authorize('admin')` | Eliminar factura | |

## Cobros, pagos y conciliación
| Method | Path | Authentication | Authorization observed | Purpose | Notes |
|---|---|---|---|---|---|
| GET | `/api/payments/` | Sí | `authorizePermission('sales.manage', 'collections.view.all', 'collections.manage.own', 'collections.payments.approve', 'collections.payments.reverse')` | Listar pagos | Soporta paginación |
| GET | `/api/payments/:id` | Sí | Mismo que listado | Obtener detalle de pago | |
| POST | `/api/payments/` | Sí | `authorizePermission('sales.manage', 'collections.manage.own')` | Crear pago | |
| PUT | `/api/payments/:id` | Sí | `authorizePermission('sales.manage', 'collections.manage.own')` | Actualizar pago | Sujeto a guardrails de lifecycle |
| POST | `/api/payments/:id/under-review` | Sí | `authorizePermission('collections.payments.approve')` | Marcar pago en revisión | |
| POST | `/api/payments/:id/approve` | Sí | `authorizePermission('collections.payments.approve')` | Aprobar pago | |
| POST | `/api/payments/:id/reject` | Sí | `authorizePermission('collections.payments.approve')` | Rechazar pago | |
| POST | `/api/payments/:id/reverse` | Sí | `authorizePermission('collections.payments.reverse')` | Revertir pago | |
| GET | `/api/payments/:id/receipts/:receiptId/download` | Sí | Permisos de lectura/gestión/aprobación/reverso | Descargar comprobante privado de pago | Descarga protegida |
| DELETE | `/api/payments/:id` | Sí | `authorizePermission('collections.payments.reverse')` | Eliminar pago | Restringido como operación sensible |

## Alertas operativas
- La primera superficie operable confirmada nace desde el dominio de inventario/lotes.
- Endpoints dedicados verificados:
  - `GET /api/inventory/alerts`
  - `GET /api/inventory/alerts/:id`
  - `PATCH /api/inventory/alerts/:id/status`
- La UI embebida de warehouse consume esta superficie para consulta, detalle y atención básica.

## Integraciones externas
| Method | Path | Authentication | Authorization observed | Purpose | Notes |
|---|---|---|---|---|---|
| GET | `/api/taxpayers/lookup` | Sí | `authorize('admin', 'sales')` | Consultar contribuyente externo | Timeout y errores controlados en servicio |
| GET | `/api/geocoding/search` | Sí | `authorize('admin', 'sales')` | Buscar lugares para geocodificación | Acotado a CR y con errores controlados |
| GET | `/api/geocoding/reverse` | Sí | `authorize('admin', 'sales')` | Geocodificación inversa: coordenadas → provincia/cantón/distrito | Llama Nominatim /reverse; respuesta normalizada para CR |

## Exclusions currently governed outside partial OpenAPI
| Method | Path | Reason code |
|---|---|---|
| GET | `/api/users/` | `root-global-user-admin-outside-partial-openapi` |
| POST | `/api/users/` | `root-global-user-admin-outside-partial-openapi` |
| GET | `/api/clients/` | `legacy-client-list-alias-outside-preferred-company-contract` |
| GET | `/api/products/:id` | `product-detail-lifecycle-outside-current-openapi-baseline` |
| PUT | `/api/products/:id` | `product-detail-lifecycle-outside-current-openapi-baseline` |
| DELETE | `/api/products/:id` | `product-delete-compatibility-outside-current-openapi-baseline` |
| GET | `/api/orders/:id` | `order-lifecycle-outside-current-openapi-baseline` |
| PUT | `/api/orders/:id` | `order-lifecycle-outside-current-openapi-baseline` |
| POST | `/api/orders/:id/approve` | `order-lifecycle-outside-current-openapi-baseline` |
| POST | `/api/orders/:id/cancel` | `order-lifecycle-outside-current-openapi-baseline` |
| POST | `/api/orders/:id/dispatch` | `order-lifecycle-outside-current-openapi-baseline` |
| DELETE | `/api/orders/:id` | `order-lifecycle-outside-current-openapi-baseline` |
| GET | `/api/invoices/:id` | `invoice-detail-lifecycle-outside-current-openapi-baseline` |
| PUT | `/api/invoices/:id` | `invoice-detail-lifecycle-outside-current-openapi-baseline` |
| DELETE | `/api/invoices/:id` | `invoice-delete-compatibility-outside-current-openapi-baseline` |
| PUT | `/api/sales-routes/company/:routeId/subzones` | `subzone-bulk-mutation-outside-current-openapi-baseline` |
| DELETE | `/api/sales-routes/company/:routeId/subzones/:subzoneId` | `subzone-bulk-mutation-outside-current-openapi-baseline` |
| GET | `/api/agent/stores/:storeId/purchase-history` | `agent-deep-read-subresource-outside-current-openapi-baseline` |
| GET | `/api/agent/stores/:storeId/sellable-products` | `agent-deep-read-subresource-outside-current-openapi-baseline` |
| GET | `/api/agent/goals` | `agent-goals-read-surface-outside-current-openapi-baseline` |
| GET | `/api/economic-activities/` | `auxiliary-integration-lookup-outside-current-openapi-baseline` |

Vea `docs/runtime-contract-manifest.json` para el detalle justificativo completo.

## Producción y formulación
- No se observaron rutas montadas en `src/app.js` que expongan un módulo runtime dedicado de producción o formulación.

## Aprobaciones transversales
- No existe un router transversal único de aprobaciones.
- Sí existe un baseline reusable mínimo en backend (`approval-baseline.service.js`) aplicado a pagos y a la prevalidación de aprobación de pedidos.
- Existen operaciones de aprobación dentro de dominios específicos, por ejemplo:
  - `/api/orders/:id/approve`
  - `/api/payments/:id/under-review`
  - `/api/payments/:id/approve`
  - `/api/payments/:id/reject`
  - `/api/payments/:id/reverse`
- Cualquier clasificación más amplia debe tratarse como capacidad por dominio, no como motor transversal ya consolidado.

## Reportes, dashboards y exportaciones
- Se observaron dashboards y vistas operativas puntuales, pero no un router dedicado de reporting/exportaciones de propósito general montado en `src/app.js`.
- Dashboards confirmados desde rutas actuales:
  - `/api/companies/root/dashboard` (legacy)
  - `/api/companies/company/dashboard`
  - `/api/agent/dashboard`
