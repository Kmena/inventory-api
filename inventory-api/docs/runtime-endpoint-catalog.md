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
- Operaciones montadas en routers descubiertas desde `src/app.js` + `src/routes/*.routes.js`: `156`
- Operaciones cubiertas por OpenAPI parcial: `113`
- Operaciones excluidas explícitamente del OpenAPI parcial: `43`
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
- Warehouse/QA SPA — operativa de bodega y control de calidad (TASK-017)

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
| PUT | `/api/roles/company/:roleId` | Sí | `authorizeAccessPolicy('role.company.update')` | Actualizar permisos y nombre de un rol de empresa | Requiere `settings.manage`; validación de tenant isolation, gobernanza de permisos platform-scoped, protección anti auto-bloqueo, auditoría de cambios |

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

## Producción y formulación
| Method | Path | Authentication | Authorization observed | Purpose | Notes |
|---|---|---|---|---|---|
| GET | `/api/recipes/` | Sí | `authorizeAccessPolicy('recipe.view')` | Listar recetas maestras | Superficie tenant-scoped factual ahora cubierta por el OpenAPI parcial |
| POST | `/api/recipes/` | Sí | `authorizeAccessPolicy('recipe.manage')` | Crear receta maestra | Validado por schema |
| GET | `/api/recipes/:id` | Sí | `authorizeAccessPolicy('recipe.view')` | Obtener detalle de receta | |
| PUT | `/api/recipes/:id` | Sí | `authorizeAccessPolicy('recipe.manage')` | Actualizar receta maestra | |
| GET | `/api/recipes/:id/versions` | Sí | `authorizeAccessPolicy('recipe.view')` | Listar versiones de receta | |
| POST | `/api/recipes/:id/versions` | Sí | `authorizeAccessPolicy('recipe.manage')` | Crear versión borrador | Validado por schema |
| PUT | `/api/recipes/versions/:id` | Sí | `authorizeAccessPolicy('recipe.manage')` | Actualizar versión borrador | Rechaza mutación in-place si ya fue aprobada |
| POST | `/api/recipes/versions/:id/approve` | Sí | `authorizeAccessPolicy('recipe.approve')` | Aprobar versión de receta | Congela la versión aprobada |
| GET | `/api/production/orders` | Sí | `authorizeAccessPolicy('production.view')` | Listar órdenes de producción | Paginado tenant-scoped |
| POST | `/api/production/orders` | Sí | `authorizeAccessPolicy('production.create')` | Crear orden de producción | Valida guardrails de sourcing/receta y congela `recipeVersionSnapshot` |
| GET | `/api/production/orders/:id` | Sí | `authorizeAccessPolicy('production.view')` | Obtener detalle de orden de producción | |
| GET | `/api/production/orders/:id/material-requirements` | Sí | `authorizeAccessPolicy('production.view')` | Consultar requerimientos de materiales y faltantes de la orden | Devuelve `required/available/missing` usando la bodega origen de la orden |
| GET | `/api/production/orders/:id/stages/:stageId/available-lots` | Sí | `authorizeAccessPolicy('production.execute')` | Consultar lotes sugeridos para una etapa | Ordena FEFO cuando aplica vencimiento y FIFO por `entryDate` cuando no; omite `internalLotNumber` |
| POST | `/api/production/orders/:id/submit` | Sí | `authorizeAccessPolicy('production.create')` | Enviar orden a aprobación | Transición `DRAFT -> PENDING_APPROVAL` |
| POST | `/api/production/orders/:id/approve` | Sí | `authorizeAccessPolicy('production.approve')` | Aprobar orden de producción | Revalida guardrails y mantiene snapshot congelado |
| POST | `/api/production/orders/:id/start` | Sí | `authorizeAccessPolicy('production.execute')` | Iniciar orden de producción | Transición `APPROVED -> IN_PROGRESS` |
| POST | `/api/production/orders/:id/stages/:stageId/execute` | Sí | `authorizeAccessPolicy('production.execute')` | Ejecutar etapa de producción | Valida payload de tiempos/materiales/evidencia, resuelve la etapa desde `recipeVersionSnapshot`, y registra movimientos `OUT` con `reasonCode` `PRODUCTION_CONSUMPTION` / `PRODUCTION_WASTE` |
| POST | `/api/production/orders/:id/stages/:stageId/returns` | Sí | `authorizeAccessPolicy('production.execute')` | Registrar devolución de materia prima por etapa/lote | Requiere `lotId`, usa una entidad explícita de devolución y registra movimiento `IN` ligado al detalle por etapa/producto/lote |
| POST | `/api/production/orders/:id/stages/:stageId/inspections` | Sí | `authorizeAccessPolicy('quality.inspect')` | Registrar inspección QA por etapa | Vincula inspección a la última ejecución de la etapa; si el resultado es `REJECTED`, la orden transiciona a `QA_HOLD`; si es `APPROVED`/`CONDITIONALLY_ACCEPTED` y la orden estaba en `QA_HOLD`, retorna a `IN_PROGRESS` |
| GET | `/api/production/orders/:id/inspections` | Sí | `authorizeAccessPolicy('quality.view')` | Listar inspecciones QA de una orden | Retorna todas las inspecciones ordenadas por fecha descendente |
| POST | `/api/production/orders/:id/complete` | Sí | `authorizeAccessPolicy('production.complete')` | Completar orden de producción | Valida QA gates, crea lote del producto terminado, registra movimiento `PRODUCTION_RECEIPT` en bodega destino, transiciona a `COMPLETED` |
| POST | `/api/production/orders/:id/cancel` | Sí | `authorizeAccessPolicy('production.cancel')` | Cancelar orden de producción | Transición compatible desde estados operativos tempranos |
| POST | `/api/production/orders/:id/stages/:stageId/losses` | Sí | `authorizeAccessPolicy('production.manage')` | Registrar pérdidas de materia prima por etapa | Requiere ejecución QA_REJECTED + lossesAcknowledged gate; feature: production-stage-rejection-and-reexecution |
| GET | `/api/production/orders/:id/stages/:stageId/losses` | Sí | `authorizeAccessPolicy('production.view')` | Listar pérdidas por etapa | Retorna todos los registros de pérdidas para la etapa |
| POST | `/api/production/orders/:id/recolections/:recolectionId/confirm` | Sí | `authorizeAccessPolicy('production.execute')` | Confirmar disponibilidad de material en etapa de recolección | feature: qa-rejection-disposition-and-continuation; sets status=COMPLETED, unblocks re-execution |
| POST | `/api/production/orders/:id/recolections/:recolectionId/reconciliation` | Sí | `authorizeAccessPolicy('production.execute')` | Registrar resultados de conciliación de material recolectado (USED/RETURNED/DISCARDED) | feature: qa-rejection-material-reconciliation-amendment (TASK-006); payload: `{ outcomes: [{productId, lotId, quantity, outcome, notes?}] }` |

## Gestión de proveedores
| Method | Path | Authentication | Authorization observed | Purpose | Notes |
|---|---|---|---|---|---|
| GET | `/api/suppliers/company` | Sí | `authorizeAccessPolicy('supplier.view')` | Listar proveedores de la compañía | Superficie tenant-scoped ahora cubierta por OpenAPI parcial |
| POST | `/api/suppliers/company` | Sí | `authorizeAccessPolicy('supplier.manage')` | Crear proveedor | Validado por schema; cubierto por OpenAPI parcial |
| GET | `/api/suppliers/company/:id` | Sí | `authorizeAccessPolicy('supplier.view')` | Obtener detalle de proveedor | |
| PUT | `/api/suppliers/company/:id` | Sí | `authorizeAccessPolicy('supplier.manage')` | Actualizar proveedor | |
| DELETE | `/api/suppliers/company/:id` | Sí | `authorizeAccessPolicy('supplier.manage')` | Eliminar proveedor | Devuelve `204` |
| POST | `/api/suppliers/company/:id/products` | Sí | `authorizeAccessPolicy('supplier.manage')` | Asignar producto autorizado al proveedor | Validado por schema |
| DELETE | `/api/suppliers/company/:id/products/:productId` | Sí | `authorizeAccessPolicy('supplier.manage')` | Remover producto autorizado del proveedor | Devuelve `204` |

## Abastecimiento y compras
| Method | Path | Authentication | Authorization observed | Purpose | Notes |
|---|---|---|---|---|---|
| GET | `/api/procurement/quotable-products` | Sí | `authorizeAccessPolicy('procurement.view')` | Listar productos cotizables | Superficie auxiliar de apoyo al workspace interno; clasificada por exclusión explícita en el manifiesto |
| GET | `/api/procurement/products/:id/suppliers-pricing` | Sí | `authorizeAccessPolicy('procurement.view')` | Consultar pricing y proveedores por producto | Lectura auxiliar para análisis interno; clasificada por exclusión explícita en el manifiesto |
| POST | `/api/procurement/products/:id/request-quotations` | Sí | `authorizeAccessPolicy('procurement.manage')` | Crear solicitud asistida de cotización por producto | Mutación auxiliar fuera del recorte OpenAPI parcial actual |
| GET | `/api/procurement/requests` | Sí | `authorizeAccessPolicy('procurement.view')` | Listar solicitudes de compra | Tenant-scoped, sin efectos de inventario |
| POST | `/api/procurement/requests` | Sí | `authorizeAccessPolicy('procurement.manage')` | Crear solicitud de compra | Crea intención de compra y sus items; no mueve stock |
| GET | `/api/procurement/requests/:id` | Sí | `authorizeAccessPolicy('procurement.view')` | Obtener detalle de solicitud de compra | Incluye cotizaciones, selecciones y POs relacionadas |
| POST | `/api/procurement/requests/:id/quotations` | Sí | `authorizeAccessPolicy('procurement.manage')` | Registrar cotización de proveedor | Cotización/proforma como intención comercial; sin efectos de inventario |
| GET | `/api/procurement/requests/:id/comparison` | Sí | `authorizeAccessPolicy('procurement.view')` | Comparar cotizaciones de proveedores | Ordena por monto total y expone lead time promedio |
| POST | `/api/procurement/requests/:id/select-quotation` | Sí | `authorizeAccessPolicy('procurement.manage')` | Seleccionar cotización/proveedor | Genera selección con aprobación automática o pendiente según threshold de la empresa |
| POST | `/api/procurement/selections/:id/approve` | Sí | `authorizeAccessPolicy('procurement.approve')` | Aprobar selección de proveedor | Requerido cuando el monto supera el threshold configurado |
| GET | `/api/procurement/orders` | Sí | `authorizeAccessPolicy('procurement.view')` | Listar órdenes de compra de la empresa | Ordenadas por `createdAt` DESC; incluye `supplier` e `items[].product` |
| POST | `/api/procurement/requests/:id/purchase-orders` | Sí | `authorizeAccessPolicy('procurement.manage')` | Crear orden de compra desde selección | Requiere selección aprobada cuando aplica; no afecta inventario |
| POST | `/api/procurement/requests/:id/cancel` | Sí | `authorizeAccessPolicy('procurement.manage')` | Cancelar solicitud de compra sin generar orden | Marca la solicitud como CANCELLED; disponible solo cuando status es OPEN |
| POST | `/api/procurement/requests/:id/rfq-invitations` | Sí | `authorizeAccessPolicy('procurement.manage')` | Crear invitaciones RFQ para proveedores | Genera link seguro y machote; sin envío automático de correo |
| GET | `/api/procurement/requests/:id/rfq-invitations` | Sí | `authorizeAccessPolicy('procurement.view')` | Listar invitaciones RFQ de una solicitud | Visible para seguimiento interno |
| POST | `/api/procurement/rfq-invitations/:id/refresh-template` | Sí | `authorizeAccessPolicy('procurement.manage')` | Regenerar machote y link seguro RFQ | Puede reemitir token y extender expiración |
| POST | `/api/procurement/rfq-invitations/:id/cancel` | Sí | `authorizeAccessPolicy('procurement.manage')` | Cancelar invitación RFQ | Terminal para uso público |
| POST | `/api/procurement/rfq-invitations/:id/manual-response` | Sí | `authorizeAccessPolicy('procurement.manage')` | Registrar respuesta manual de proveedor | Usado desde workspace interno y `#seguimiento_cotizaciones` |
| GET | `/api/procurement/rfq-tracking` | Sí | `authorizeAccessPolicy('procurement.view')` | Consultar tracking interno RFQ | Alimenta la página root-shell `#seguimiento_cotizaciones` |

## RFQ público por token
| Method | Path | Authentication | Authorization observed | Purpose | Notes |
|---|---|---|---|---|---|
| GET | `/api/public/supplier-quotations/:token` | No | None | Consultar invitación pública RFQ | Aplica throttling dedicado `30/min`, persiste `EXPIRED` de forma lazy y responde `429` con `Retry-After` cuando corresponde |
| POST | `/api/public/supplier-quotations/:token/response` | No | None | Registrar respuesta pública RFQ del proveedor | Aplica throttling dedicado `10/min`, materializa `SupplierQuotation` solo si la invitación sigue válida |

## Recepciones e inspección de ingreso
| Method | Path | Authentication | Authorization observed | Purpose | Notes |
|---|---|---|---|---|---|
| GET | `/api/receipts/` | Sí | `authorizeAccessPolicy('receipt.view')` | Listar documentos de recepción | Tenant-scoped, sin efectos de inventario en esta fase |
| POST | `/api/receipts/` | Sí | `authorizeAccessPolicy('receipt.inspect')` | Crear documento de recepción | Representa llegada real con diferencias, lotes, vencimiento, costo y observaciones; no confirma stock |
| GET | `/api/receipts/:id` | Sí | `authorizeAccessPolicy('receipt.view')` | Obtener detalle de documento de recepción | Incluye items e inspecciones |
| POST | `/api/receipts/:id/items/:itemId/inspections` | Sí | `authorizeAccessPolicy('receipt.inspect')` | Inspeccionar ítem de recepción | Actualiza el estado del documento según el resultado (`ACCEPTED`, `PARTIALLY_ACCEPTED`, `REJECTED`) |
| POST | `/api/receipts/:id/confirm` | Sí | `authorizeAccessPolicy('receipt.confirm')` | Confirmar recepción e ingresar stock | Transaccional: crea lote, actualiza WarehouseLotStock/WarehouseStock/Product, registra movimiento `PURCHASE_RECEIPT`; requiere estado `ACCEPTED` o `PARTIALLY_ACCEPTED` |
| POST | `/api/receipts/:id/reverse` | Sí | `authorizeAccessPolicy('receipt.reverse')` | Revertir recepción confirmada | Crea movimiento `RECEIPT_REVERSAL`, revierte stock sin borrar historia; requiere estado `CONFIRMED` |
| GET | `/api/receipts/:id/fiscal-references` | Sí | `authorizeAccessPolicy('receipt.view')` | Listar referencias de documentos fiscales de una recepción | Metadata de handoff hacia Billing/Hacienda; status siempre empieza en `PENDING` porque el API externo no existe aún |
| POST | `/api/receipts/:id/fiscal-references` | Sí | `authorizeAccessPolicy('receipt.confirm')` | Crear referencia de documento fiscal pendiente | Solo aplica a recepciones confirmadas; no invoca API externa (DEC-003) |

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
| DELETE | `/api/invoices/{id}` | `invoice-delete-compatibility-outside-current-openapi-baseline` |
| DELETE | `/api/orders/{id}` | `order-lifecycle-outside-current-openapi-baseline` |
| DELETE | `/api/products/{id}` | `product-delete-compatibility-outside-current-openapi-baseline` |
| DELETE | `/api/sales-routes/company/{routeId}/subzones/{subzoneId}` | `subzone-bulk-mutation-outside-current-openapi-baseline` |
| GET | `/api/agent/goals` | `agent-goals-read-surface-outside-current-openapi-baseline` |
| GET | `/api/agent/orders` | `agent-orders-read-surface-outside-current-openapi-baseline` |
| GET | `/api/agent/stores/{storeId}/purchase-history` | `agent-deep-read-subresource-outside-current-openapi-baseline` |
| GET | `/api/agent/stores/{storeId}/sellable-products` | `agent-deep-read-subresource-outside-current-openapi-baseline` |
| GET | `/api/clients/` | `legacy-client-list-alias-outside-preferred-company-contract` |
| GET | `/api/clients/{clientId}/ledger` | `client-billing-ledger-outside-current-openapi-baseline` |
| GET | `/api/economic-activities/` | `auxiliary-integration-lookup-outside-current-openapi-baseline` |
| GET | `/api/invoices/{id}` | `invoice-detail-lifecycle-outside-current-openapi-baseline` |
| GET | `/api/orders/{id}` | `order-lifecycle-outside-current-openapi-baseline` |
| GET | `/api/procurement/products/{id}/suppliers-pricing` | `procurement-supporting-read-outside-current-openapi-baseline` |
| GET | `/api/procurement/quotable-products` | `procurement-supporting-read-outside-current-openapi-baseline` |
| GET | `/api/procurement/requests` | `procurement-foundation-outside-current-openapi-baseline` |
| GET | `/api/procurement/requests/{id}` | `procurement-foundation-outside-current-openapi-baseline` |
| GET | `/api/procurement/requests/{id}/comparison` | `procurement-comparison-outside-current-openapi-baseline` |
| GET | `/api/production/orders/{id}/inspections` | `quality-inspection-list-outside-current-openapi-baseline` |
| GET | `/api/production/orders/{id}/material-requirements` | `production-material-readout-outside-current-openapi-baseline` |
| GET | `/api/production/orders/{id}/stages/{stageId}/available-lots` | `production-available-lots-outside-current-openapi-baseline` |
| GET | `/api/products/{id}` | `product-detail-lifecycle-outside-current-openapi-baseline` |
| GET | `/api/products/categories/company` | `product-category-admin-outside-current-openapi-baseline` |
| GET | `/api/receipts/{id}/fiscal-references` | `fiscal-reference-outside-current-openapi-baseline` |
| GET | `/api/users/` | `root-global-user-admin-outside-partial-openapi` |
| POST | `/api/orders/{id}/approve` | `order-lifecycle-outside-current-openapi-baseline` |
| POST | `/api/orders/{id}/cancel` | `order-lifecycle-outside-current-openapi-baseline` |
| POST | `/api/orders/{id}/dispatch` | `order-lifecycle-outside-current-openapi-baseline` |
| POST | `/api/procurement/products/{id}/request-quotations` | `procurement-assisted-request-outside-current-openapi-baseline` |
| POST | `/api/procurement/requests` | `procurement-foundation-outside-current-openapi-baseline` |
| POST | `/api/procurement/requests/{id}/purchase-orders` | `procurement-purchase-order-outside-current-openapi-baseline` |
| POST | `/api/procurement/requests/{id}/quotations` | `procurement-quotation-outside-current-openapi-baseline` |
| POST | `/api/procurement/requests/{id}/select-quotation` | `procurement-selection-outside-current-openapi-baseline` |
| POST | `/api/procurement/selections/{id}/approve` | `procurement-approval-outside-current-openapi-baseline` |
| POST | `/api/production/orders/{id}/stages/{stageId}/execute` | `production-stage-execution-outside-current-openapi-baseline` |
| POST | `/api/production/orders/{id}/stages/{stageId}/inspections` | `quality-inspection-outside-current-openapi-baseline` |
| POST | `/api/production/orders/{id}/stages/{stageId}/returns` | `production-stage-return-outside-current-openapi-baseline` |
| POST | `/api/products/categories/company` | `product-category-admin-outside-current-openapi-baseline` |
| POST | `/api/receipts/{id}/fiscal-references` | `fiscal-reference-outside-current-openapi-baseline` |
| POST | `/api/receipts/{id}/items/{itemId}/inspections` | `receipt-inspection-outside-current-openapi-baseline` |
| POST | `/api/users/` | `root-global-user-admin-outside-partial-openapi` |
| PUT | `/api/invoices/{id}` | `invoice-detail-lifecycle-outside-current-openapi-baseline` |
| PUT | `/api/orders/{id}` | `order-lifecycle-outside-current-openapi-baseline` |
| PUT | `/api/products/{id}` | `product-detail-lifecycle-outside-current-openapi-baseline` |
| PUT | `/api/sales-routes/company/{routeId}/subzones` | `subzone-bulk-mutation-outside-current-openapi-baseline` |

Vea `docs/runtime-contract-manifest.json` para el detalle justificativo completo.

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
