# inventory-api

Plataforma backend para gestionar inventario interno, ventas, produccion, clientes, credito comercial, proveedores, bodegas, reportes y trazabilidad operativa.

El proyecto toma como referencia el PRD y los ERD ubicados en `inventory-api/docs/`, con una base tecnica clara para construir el producto objetivo.

## Alcance funcional

El producto esta orientado a centralizar:

- catalogo de productos, categorias, subclasificaciones, proveedores y formulas
- proveeduria con proveedores, productos ofrecidos, materias primas sustitutas, ordenes de compra e ingreso a inventario
- flujo de compra por minimo, cotizaciones diarias, aprobacion gerencial, cuenta por pagar, COA, AQL, cuarentena y etiquetas de lote
- categorias principales para materia prima, envases, tapas, etiquetas, producto terminado y miscelaneos
- jerarquia de articulos con alta por proveeduria, configuracion administrativa y caracteristicas tecnicas por regente de produccion
- activacion/desactivacion de productos terminados desde catalogo
- precio general por producto terminado y ajustes por promocion, bonificacion o regalia
- inventario por bodega, lotes y movimientos auditables
- bodegas de cuarentena, proceso y producto terminado con control de disponibilidad para venta
- ficha de cuarentena/aprobación para productos de ingreso con lote interno y lote del manufacturador
- entradas, ajustes, reservas, salidas y transferencias de stock
- clientes, credito comercial, facturas y pagos parciales
- cursos con cupos limitados y afiliaciones con cobro recurrente usando lotes en bodegas virtuales separadas
- pagos de contado, contra entrega y credito con comprobantes, abonos, recibos de dinero, tesoreria y conciliacion de efectivo de agentes
- notas de credito/debito ligadas a factura, Hacienda, saldo a favor/deuda, devoluciones por lote y decision de QA
- zonas, subzonas, rutas y agentes para ventas y seguimiento comercial
- jerarquia de ventas con gerente, supervisor y agente
- hojas de cobro, inventario, conozca a sus clientes y ruta para agentes
- tiendas con ubicacion GPS, referencia, horario, representantes y razon social
- referencias, documentos, limite de credito y deuda inicial en alta de cliente
- metas comerciales por agente y analitica historica de ventas por zona/subzona/formato
- alta de clientes de contado o con solicitud de credito revisada por credito y cobro
- clasificaciones de cliente configurables por root
- modulo de facturacion con pedidos, aprobacion administrativa, revision de credito/cobro, proforma, factura y XML a Hacienda
- historial completo de pedidos con estados rechazado, aceptado, cancelado, facturado, entregado con firma, pagado y vencido
- permisos configurables por rol para definir quién puede aprobar cada operación
- produccion con formula maestra, BOM automatico, costos por etapa, precio minimo recomendado con margen, dispensado, QA por etapa, llenado, loteo, etiquetado, rendimiento, salida de producto terminado y merma
- versiones historicas de formulas cuando se aceptan materias primas sustitutas
- aprobaciones para operaciones criticas
- reportes, dashboards y exportacion futura a PDF/Excel
- auditoria de acciones relevantes e historial operativo

## Documentos de referencia

- `inventory-api/docs/Proyecto Inventario Interno - Prd V1.pdf` -> PRD del producto
- `inventory-api/docs/prd_actualizacion_catalogo_precios.md` -> actualizacion PRD para catalogo, productos terminados y precios
- `inventory-api/docs/facturacion_hacienda_costa_rica.md` -> pasos y requerimientos para facturacion directa con Hacienda Costa Rica
- `inventory-api/docs/mvp_1_prd.md` -> PRD acotado para MVP 1: inventario, proveeduria y ventas basicas
- `inventory-api/docs/erd_mvp_1.mmd` -> ERD acotado para MVP 1
- `inventory-api/docs/er_mvp_prd.md` -> ER minimo viable alineado al PRD
- `inventory-api/docs/er_propuesto_prd.md` -> ER ampliado propuesto
- `inventory-api/docs/ERD_v1.md` y `inventory-api/docs/erDiagram.mmd` -> diagrama ER de referencia
- `docs/memoria_sesion_code_puppy.md` -> memoria tecnica con estado actual, gaps y siguientes pasos

## Estado actual

La carpeta `inventory-api/` contiene un backend funcional inicial con:

- Node.js + Express
- Prisma + PostgreSQL
- Docker y Docker Compose
- autenticacion con JWT
- hash de contrasenas con bcrypt
- validacion con Zod
- separacion por `routes`, `services`, `repositories`, `schemas`, `middlewares` y `lib`
- migracion inicial de Prisma
- seed de datos demo
- CRUD base de empresas, usuarios, clientes, productos, pedidos, facturas y pagos
- inventario fase 1 con movimientos de stock
- flujo de pedidos con aprobacion, cancelacion y despacho
- UI demo de bodega para importar productos desde Excel

## Alineacion con PRD/ERD

Ya existe una base para los dominios principales: seguridad, clientes, productos, pedidos, facturacion, pagos, proveedores, formulas, lotes, produccion e inventario.

Los principales gaps frente al PRD/ERD son:

- multi-bodega real (`Warehouse`, `WarehouseStock`)
- tipos de bodega y bandera de bodega habilitada para venta
- transferencias entre bodegas
- lotes obligatorios y estrategia FIFO/FEFO/manual por producto
- ficha de cuarentena, aprobación QA y autorización por etapa de movimiento
- alertas por lote cercano a vencimiento y salidas extraordinarias
- soft delete o desactivacion logica en catalogos con historial, especialmente productos terminados
- roles `supervisor` y `executive`
- aprobaciones transversales (`ApprovalRequest`)
- permisos configurables por rol (`Permission`, `RolePermission`, `ApprovalTypePermission`)
- aprobacion por credito excedido
- zonas/subzonas/rutas comerciales y asignacion de agentes
- produccion real con doble aprobacion, consumo, salida y merma
- auditoria global (`AuditLog`)
- subclasificacion obligatoria por producto
- precio general y ajustes comerciales por promocion, bonificacion o regalia
- reportes, dashboards y exportaciones
- alertas de stock minimo, vencimiento de lote y salidas extraordinarias

## Estructura

- `README.md` -> vision general y alcance del producto
- `CHANGELOG.md` -> historial de versiones
- `docs/` -> memoria y documentos locales de trabajo
- `inventory-api/` -> backend funcional principal
- `inventory-api/docs/` -> PRD, ERD y documentacion tecnica del backend
- `inventory-api/prisma/` -> schema, migraciones y seed
- `docker/` -> ejemplos base para contenedores
- `sql/` -> material SQL de referencia

## Arranque rapido del backend

Desde `inventory-api/`:

1. Copiar `.env.example` a `.env`
2. Ejecutar `npm install`
3. Ejecutar `npx prisma generate`
4. Ejecutar `npx prisma migrate dev --name init`
5. Ejecutar `npm run prisma:seed`
6. Ejecutar `npm run dev`

En Windows PowerShell puede usar `npm.cmd` y `npx.cmd` si la politica de ejecucion bloquea los wrappers de PowerShell.

## Objetivo tecnico

Construir una API mantenible y extensible para el producto definido por el PRD: inventario trazable, operacion comercial, produccion controlada, aprobaciones y reportes. La base actual es funcional, pero todavia debe evolucionar hacia el ERD propuesto antes de considerar cerrado el alcance del MVP.
