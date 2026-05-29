# inventory-api

Plataforma backend para gestionar inventario interno, ventas, produccion, clientes, credito comercial, proveedores, bodegas, reportes y trazabilidad operativa.

El proyecto toma como referencia el PRD y los ERD ubicados en `inventory-api/docs/`, con una base tecnica clara para construir el producto objetivo.

## Alcance funcional

El producto esta orientado a centralizar:

- catalogo de productos, categorias, proveedores y recetas
- inventario por bodega, lotes y movimientos auditables
- entradas, ajustes, reservas, salidas y transferencias de stock
- clientes, credito comercial, facturas y pagos parciales
- pedidos de venta con aprobacion y despacho separado
- produccion con receta, consumo de insumos, salida de producto terminado y merma
- aprobaciones para operaciones criticas
- reportes, dashboards y exportacion futura a PDF/Excel
- auditoria de acciones relevantes e historial operativo

## Documentos de referencia

- `inventory-api/docs/Proyecto Inventario Interno - Prd V1.pdf` -> PRD del producto
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

Ya existe una base para los dominios principales: seguridad, clientes, productos, pedidos, facturacion, pagos, proveedores, recetas, lotes, produccion e inventario.

Los principales gaps frente al PRD/ERD son:

- multi-bodega real (`Warehouse`, `WarehouseStock`)
- transferencias entre bodegas
- lotes obligatorios y estrategia FIFO/FEFO/manual por producto
- soft delete o desactivacion logica en catalogos con historial
- roles `supervisor` y `executive`
- aprobaciones transversales (`ApprovalRequest`)
- aprobacion por credito excedido
- produccion real con doble aprobacion, consumo, salida y merma
- auditoria global (`AuditLog`)
- multiples precios por producto
- reportes, dashboards y exportaciones
- alertas de stock minimo

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
