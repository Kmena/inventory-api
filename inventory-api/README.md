# inventory-api backend

Backend de la plataforma de inventario interno definida por el PRD. Expone una API REST para operar catalogos, clientes, productos, pedidos, facturas, pagos e inventario, usando una arquitectura por capas sobre PostgreSQL.

## Stack

- Node.js
- Express
- Prisma
- PostgreSQL
- Docker
- JWT
- bcrypt
- Zod

## Alcance del producto

El PRD plantea una plataforma web responsive para centralizar:

- inventario por bodega
- bodegas de cuarentena, proceso y producto terminado con disponibilidad configurable para venta
- ficha de cuarentena/aprobación para ingresos con lote interno y lote del manufacturador
- productos, categorias, subclasificaciones, proveedores y lotes
- proveeduria con proveedores, productos ofrecidos, materias primas sustitutas, ordenes de compra e ingreso a inventario
- flujo de compra por minimo, cotizaciones diarias, aprobacion gerencial, cuenta por pagar, COA, AQL, cuarentena y etiquetas de lote
- categorias para materia prima, envases, tapas, etiquetas, producto terminado y miscelaneos
- facturacion con pedidos, aprobacion administrativa, credito/cobro, proforma, factura, XML a Hacienda y pagos parciales
- pagos de contado, contra entrega y credito con comprobantes, abonos a facturas, recibos de dinero, tesoreria y conciliacion de efectivo de agentes
- notas de credito/debito ligadas a factura, Hacienda, saldo a favor/deuda, devoluciones por lote y decision de QA
- historial completo de pedidos y estados, incluyendo rechazado, aceptado, cancelado, facturado, entregado con firma, pagado y vencido
- clientes, credito comercial y aprobaciones
- productos vendibles no fisicos: cursos con cupos y afiliaciones recurrentes usando lotes en bodegas virtuales separadas
- zonas, subzonas, rutas y agentes comerciales para ventas y seguimiento
- jerarquia de ventas con gerente, supervisor y agente
- hojas de cobro, inventario, conozca a sus clientes y ruta para agentes
- tiendas con latitud, longitud, referencia, horario, representantes y razon social
- referencias, documentos, limite de credito y deuda inicial en alta de cliente
- metas comerciales por agente, incluyendo clientes nuevos creados
- analitica historica de ventas por zona, subzona y formato
- permisos configurables por rol para aprobaciones y operaciones criticas
- produccion con formulas, BOM, costos por etapa, precio minimo con margen, dispensado, QA por etapa, llenado, loteo, etiquetado, rendimiento, producto terminado y merma
- versiones historicas de formulas cuando se aceptan materias primas sustitutas
- catalogo para activar/desactivar productos terminados
- precio general por producto terminado y ajustes por promocion, bonificacion o regalia
- reportes, dashboards y exportaciones
- auditoria e historial de acciones criticas

Los ERD de `docs/` aterrizan ese alcance en dos niveles:

- `docs/er_mvp_prd.md` define el modelo minimo viable
- `docs/er_propuesto_prd.md` define el modelo ampliado recomendado

## Estado implementado

Esta base ya incluye:

- configuracion por variables de entorno
- autenticacion con JWT
- contrasenas con bcrypt
- validacion de payloads con Zod
- manejo centralizado de errores
- Prisma como capa de acceso a datos
- migracion inicial versionada
- seed de datos demo
- separacion por `routes`, `services`, `repositories`, `schemas`, `middlewares` y `lib`
- CRUD base de empresas, usuarios, clientes, productos, pedidos, facturas y pagos
- movimientos de inventario para entradas, ajustes, reservas, liberaciones y salidas
- flujo dedicado de facturacion: crear pedido, aprobar condiciones, revisar credito, generar proforma, facturar y registrar XML/respuesta de Hacienda
- UI demo de bodega para importar productos desde Excel por bloques
- dashboard root para crear, listar, activar y deshabilitar empresas
- dashboard ejecutivo para administradores de empresa
- sidebar de administracion con acceso a dashboard, usuarios y roles
- creacion de usuarios dentro de la empresa del administrador
- roles personalizados por empresa con seleccion de permisos
- autorizacion por permisos finos para bodega, productos e inventario

## Dominios cubiertos en el schema actual

El schema Prisma actual ya modela:

- empresas y configuracion
- roles globales, roles por empresa y usuarios
- permisos configurables por rol
- zonas, subzonas y rutas comerciales
- clientes, contactos y referencias
- zonas, subzonas, rutas comerciales y actividades de seguimiento
- inventario, categorias y subclasificaciones
- productos, proveedores y lotes
- movimientos de stock
- formulas, componentes y BOM
- costos de materia prima, mano de obra, energia y agua por etapa para calcular precio minimo con margen
- flujo de produccion con orden administrativa, aprobacion de gerente, dispensado, QA, transformacion, llenado, loteo, etiquetado y almacenamiento
- rendimiento teorico vs recibido por bodega y merma de proceso con datos fuente persistidos
- pedidos y detalle
- facturas y pagos
- ordenes e items de produccion

## Gaps frente al PRD/ERD

Aunque el backend ya es funcional, todavia no cubre completo el alcance del PRD. Los puntos principales pendientes son:

- `Warehouse` y stock real por bodega
- tipos de bodega (`QUARANTINE`, `PROCESS`, `FINISHED_GOODS`, `GENERAL`)
- bandera para definir si una bodega puede despachar ventas
- `WarehouseStock` para balance por producto y bodega
- transferencias entre bodegas
- lotes obligatorios con estrategia configurable de salida
- ficha de cuarentena, aprobación QA y autorización de movimientos por etapa
- alertas por vencimiento de lote, falla QA y salidas extraordinarias
- `ApprovalRequest` para aprobaciones criticas
- `Permission`, `RolePermission` y `ApprovalTypePermission` para permisos configurables
- `AuditLog` transversal
- roles `supervisor` y `executive`
- aprobacion por credito excedido
- zonas/subzonas/rutas comerciales y asignacion de agentes
- subclasificacion obligatoria por producto
- precio general y ajustes comerciales por promocion, bonificacion o regalia
- soft delete o desactivacion logica de catalogos con historial, especialmente productos terminados
- produccion real con estados propios, doble aprobacion, consumo, salida y merma
- reportes, dashboards, exportacion PDF/Excel y alertas de stock minimo/vencimiento/salidas extraordinarias

## Estructura

- `src/` -> aplicacion HTTP
- `src/routes/` -> definicion de endpoints
- `src/services/` -> reglas de negocio
- `src/repositories/` -> acceso a datos
- `src/schemas/` -> validaciones Zod
- `src/middlewares/` -> autenticacion, autorizacion y validacion
- `src/lib/` -> utilidades compartidas
- `src/public/` -> UI demo local
- `prisma/` -> schema, migraciones y seed
- `docs/` -> PRD, ERD y documentacion tecnica
- `Dockerfile` -> imagen base
- `docker-compose.yml` -> app + postgres

## Runtime soportado

Contrato explícito actual del repositorio:

- Node.js `20.x`
- `package.json` declara `"engines": { "node": ">=20 <21" }`
- `.github/workflows/p0-quality-gates.yml` ejecuta los gates obligatorios con Node 20
- `Dockerfile` base usa `node:20-bullseye-slim`

Fuera de este rango no se considera entorno soportado para la evidencia obligatoria de cierre P0. En esta implementación se observó drift local con Node 24, por lo que las validaciones canónicas deben ejecutarse con Node 20.

## Arranque local

1. Copiar `.env.example` a `.env`
2. Ejecutar `npm install`
3. Ejecutar `npx prisma generate`
4. Ejecutar `npx prisma migrate dev --name init`
5. Ejecutar `npm run prisma:seed`
6. Ejecutar `npm run dev`

### Nota para Windows

Si PowerShell bloquea `npm` o `npx` por politicas de ejecucion, use:

```powershell
npm.cmd install
npx.cmd prisma generate
npx.cmd prisma migrate dev --name init
```

## Quality gates

## Contract summary

Los scripts soportados del repositorio para validación del backend son:

| Script | Tipo | Propósito | Obligatorio en baseline P1 |
|---|---|---|---|
| `npm run lint` | gate individual | validación estática del backend, scripts y tests | Sí |
| `npm run typecheck` | gate individual | verificación de tipos JS con `tsc --noEmit` sobre alcance aprobado | Sí |
| `npm run build` | gate individual | generación de Prisma Client requerida por runtime | Sí |
| `npm run test` | gate individual | suites automatizadas obligatorias del backend | Sí |
| `npm run verify` | gate agregado | ejecución fail-fast de `lint + typecheck + build + test` | Sí |
| `npm run validate:agent-workspace` | diagnóstico | validación adicional de workspace/agente fuera del gate obligatorio | No |

Reglas de uso del contrato actual:

- `verify` reutiliza exactamente los mismos scripts obligatorios definidos de forma individual.
- `validate:agent-workspace` permanece como diagnóstico opcional mientras no forme parte del gate obligatorio aprobado.
- La evidencia canónica del repositorio debe seguir ejecutándose con Node 20, aunque localmente puedan observarse otros runtimes.

### Lint

El gate inicial de lint se ejecuta con:

```bash
npm run lint
```

Alcance inicial obligatorio para P0:

- `src/**/*.js`
- `scripts/**/*.js`
- `tests/**/*.js`

Exclusiones explícitas en esta primera iteración:

- `src/public/**`
- `node_modules/**`
- `storage/**`
- `back_end/**`
- `front_end/**`
- `prisma/migrations/**`
- archivos `*.log`

Este alcance prioriza el backend ejecutable y los scripts de validación del P0. El frontend estático bajo `src/public/` queda fuera del primer gate de lint y se podrá incorporar en una iteración posterior con reglas específicas de navegador.

### Typecheck

El gate inicial de typecheck se ejecuta con:

```bash
npm run typecheck
```

Configuración:

- `tsconfig.typecheck.json`
- `typescript` en modo `noEmit`
- `allowJs` + `checkJs`

Alcance inicial obligatorio para P0:

- `src/app.js`
- `src/server.js`
- `src/config.js`
- `src/lib/**/*.js`
- `src/middlewares/**/*.js`
- `src/routes/**/*.js`
- `src/services/**/*.js`
- `scripts/generate-local-project-map.js`
- `scripts/migrate-client-documents-to-private-storage.js`

Exclusiones explícitas en esta primera iteración:

- `src/public/**`
- `src/repositories/**`
- `src/schemas/**`
- `tests/**`
- `prisma/**`
- `scripts/validate-agent-workspace.js`
- `node_modules/**`
- `storage/**`
- `back_end/**`
- `front_end/**`

Además, algunos hotspots con tipado Prisma/Zod quedaron marcados con `// @ts-nocheck` de forma localizada y documentada para mantener un gate real sin rediseñar los repositorios en esta iteración P0.

### Automated tests

El gate obligatorio de pruebas para el cierre P0 se ejecuta con:

```bash
npm test
```

Suites obligatorias actuales:

- `tests/logging.test.js`
- `tests/client-tenant-scope.test.js`
- `tests/invoice-tenant-scope.test.js`
- `tests/payment-tenant-scope.test.js`
- `tests/client-document-security.test.js`

Validación diagnóstica opcional separada del cierre P0 actual:

```bash
npm run validate:agent-workspace
```

Esta validación adicional permanece fuera del gate obligatorio porque hoy falla en baseline y no forma parte del paquete mínimo de estabilización ya aceptado para P0/P1.

### Verify

El gate agregado fail-fast se ejecuta con:

```bash
npm run verify
```

Orden actual de ejecución:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. `npm run test`

El comando falla en el primer gate obligatorio que falle y reutiliza exactamente los mismos scripts definidos para ejecución individual.

### Build

El gate inicial de build se ejecuta con:

```bash
npm run build
```

Definición actual de build para este backend:

- ejecuta `prisma generate`
- valida que el Prisma Client requerido por el runtime quede generado sin crear artefactos de compilación adicionales
- corresponde al paso de preparación de runtime usado también por el `Dockerfile`

Salida esperada:

- Prisma Client generado/actualizado en `node_modules/@prisma/client`

Prerequisitos:

- dependencias instaladas
- `prisma/schema.prisma` disponible
- variables de entorno mínimas legibles por Prisma (`.env` o entorno equivalente)

## Arranque con Docker

Si ya creo y aplico la migracion inicial con Prisma desde su maquina local, puede levantar el proyecto con:

```bash
docker compose up --build
```

El contenedor de la app no ejecuta migraciones automaticamente al arrancar. Primero aplique migraciones con Prisma y luego levante Docker.

Importante para validacion de replay P0:

- la imagen comprometida actual copia `src/` y `prisma/`, pero no copia `scripts/`
- por eso `npm run prisma:apply-committed-migrations` no esta disponible dentro del contenedor `app` en el baseline actual
- la secuencia canonica y su clasificacion vigente se documentan en `prisma/migration-instructions.md`
- el ultimo replay compose preservado en `specs/p0-extra-inclusion/` quedo clasificado como `Failed / Environment blocked`; no trate el simple arranque de `/health` como prueba de replay exitoso

Si cambia la imagen base, Prisma o dependencias del contenedor, use reconstruccion completa:

```bash
docker compose down
docker compose build --no-cache
docker compose up
```

## Endpoints

### Publicos

- `GET /health`
- `POST /api/auth/login`

### Protegidos con JWT

- `GET /api/auth/me`
- `GET /api/companies`
- `POST /api/companies`
- `GET /api/companies/root/companies`
- `POST /api/companies/root/companies`
- `PATCH /api/companies/root/companies/:companyId/status`
- `GET /api/companies/root/dashboard`
- `GET /api/roles/permissions`
- `GET /api/roles/company`
- `POST /api/roles/company`
- `GET /api/users`
- `POST /api/users`
- `GET /api/users/company`
- `POST /api/users/company`
- `GET /api/clients`
- `GET /api/clients/:id`
  - compatibilidad P1: `GET /api/clients` y `GET /api/clients/company` aceptan `page` y `pageSize`; cuando se envían, responden `{ items, pagination }`; sin esos query params preservan la respuesta legacy basada en arreglos
- `POST /api/clients`
- `PUT /api/clients/:id`
- `DELETE /api/clients/:id`
- `GET /api/products`
- `GET /api/products/:id`
  - compatibilidad P1: `GET /api/products` acepta `page` y `pageSize`; con paginación responde `{ items, pagination }`; sin esos query params preserva la respuesta legacy basada en arreglos
- `POST /api/products`
- `POST /api/products/import`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`
- `GET /api/orders`
- `GET /api/orders/:id`
- `POST /api/orders`
- `PUT /api/orders/:id`
- `POST /api/orders/:id/approve`
- `POST /api/orders/:id/cancel`
- `POST /api/orders/:id/dispatch`
- `DELETE /api/orders/:id`
- `GET /api/invoices`
- `GET /api/invoices/:id`
  - compatibilidad P1: `GET /api/invoices` acepta `page` y `pageSize`; con paginación responde `{ items, pagination }`; sin esos query params preserva la respuesta legacy basada en arreglos
- `POST /api/invoices`
- `PUT /api/invoices/:id`
- `DELETE /api/invoices/:id`
- `GET /api/payments`
- `GET /api/payments/:id`
  - compatibilidad P1: `GET /api/payments` acepta `page` y `pageSize`; con paginación responde `{ items, pagination }`; sin esos query params preserva la respuesta legacy basada en arreglos
- `POST /api/payments`
- `PUT /api/payments/:id`
- `DELETE /api/payments/:id`
- `GET /api/inventory/movements`
  - compatibilidad P1: `GET /api/inventory/movements` acepta `page` y `pageSize`; con paginación responde `{ items, pagination }`; sin esos query params preserva la respuesta legacy basada en arreglos
- `POST /api/inventory/entries`
- `POST /api/inventory/adjustments`

## Reglas actuales de inventario y pedidos

- Los pedidos se crean en `DRAFT`
- Solo pedidos en `DRAFT` se pueden editar
- Todo producto debe tener categoria principal y subclasificacion
- El catalogo debe cubrir materia prima, envases, tapas, etiquetas, producto terminado y miscelaneos
- Solo proveeduria crea articulos nuevos; administracion/proveeduria gestionan categorias, descripciones y precios segun permisos
- Proveeduria registra proveedores, productos que venden, sustitutos y ordenes de compra
- El regente de produccion mantiene unidad, densidad y conversion tecnica para formulas
- Una materia prima sustituta aceptada puede generar una nueva version historica de formula
- Miscelaneos cubre productos de limpieza, material de oficina y otros insumos de soporte
- Los permisos se configuran por rol o tipo de usuario desde administracion
- Cada tipo de aprobacion valida el permiso requerido antes de permitir aprobar
- Salidas, entradas y transferencias entre bodegas pueden requerir permisos diferentes
- Todo cliente debe estar asignado a una subzona, y cada subzona pertenece a una zona
- Las rutas agrupan subzonas y se asignan a agentes comerciales
- Las actividades de venta y seguimiento registran cliente, agente, ruta, estado y fecha
- Gerente de ventas, supervisor y agente operan con permisos configurables por alcance
- El agente registra cobros, inventario de ruta, conozca a sus clientes y bitacora de visita
- La alta de cliente propuesta por agente distingue cliente de contado y cliente con solicitud de credito
- La solicitud de credito se envia a credito y cobro; si se apertura, se crea o confirma el codigo del cliente
- Las clasificaciones de cliente son configurables por root
- Una razon social puede tener varias tiendas; cada tienda conserva ubicacion con latitud/longitud, referencia, horario y representantes
- El alta de cliente contempla referencias, documentos, limite solicitado/aprobado y deuda inicial cuando aplique
- El agente creador del cliente queda registrado y puede alimentar metas comerciales
- El status activo del cliente depende de compras en los ultimos `n` meses configurables
- La frecuencia de pago alimenta una metrica de confianza configurable por root
- Las ventas pueden graficarse historicamente por zona, subzona y formato con ponderados mensuales
- Solo bodegas habilitadas como fuente de venta pueden facturar y descontar inventario
- Productos de ingreso deben registrar lote interno, lote del manufacturador y ficha de cuarentena/QA
- Cada etapa de movimiento entre bodegas requiere autorización de usuario encargado con permiso activo
- Lotes vencidos, en cuarentena o con QA rechazado/fallido no pueden venderse
- Lotes cercanos a vencimiento deben generar alerta
- Salidas extraordinarias por vencimiento, falla QA u otro motivo deben registrar motivo y generar alerta cuando aplique
- Los productos terminados se desactivan desde el catalogo, sin borrar historial
- Un producto terminado inactivo no se puede agregar a pedidos nuevos
- Todo producto terminado vendible debe tener precio general activo
- Las formulas maestras solo pueden usar materias primas existentes y deben sumar 100%
- El BOM se genera automaticamente desde la formula maestra y la cantidad solicitada
- La promocion, bonificacion o regalia modifica el precio final desde el precio general
- El detalle del pedido conserva precio general usado, ajuste aplicado y precio final historico
- Cualquier usuario autorizado puede registrar pedidos en facturacion
- Administrativo aprueba condiciones comerciales del pedido
- Credito y cobro aprueba pedidos a credito revisando saldo, historico y facturas abiertas
- Bodega genera proforma y factura, envia XML a Hacienda y registra la respuesta
- El inventario se descuenta hasta facturar, generando movimiento `OUT` ligado a la factura
- El transportista confirma la entrega con firma de recibido y datos de quien recibe
- Todo cambio de estado del pedido queda en historial auditable
- Todo pago requiere comprobante adjunto
- Los pagos parciales se registran como abonos a facturas y generan recibo de dinero
- El efectivo recibido por agentes se coteja contra sistema y administrativo firma recibido
- La factura conserva lote por item; devoluciones con nota de credito requieren cotejo administrativo del lote y decision de QA
- La nota de debito aumenta deuda sobre factura y tambien se registra ante Hacienda
- Entradas manuales registran movimiento `IN`
- Ajustes manuales registran movimiento `ADJUSTMENT`
- Todo cambio de inventario debe generar `StockMovement`

## Credenciales demo

- admin -> `admin` / `admin123`
- ventas -> `ventas` / `ventas123`
- bodega -> `bodega` / `bodega123`

Estas credenciales son solo para pruebas locales y seed demo.

## Documentacion util

- `docs/Proyecto Inventario Interno - Prd V1.pdf`
- `docs/prd_actualizacion_catalogo_precios.md`
- `docs/facturacion_hacienda_costa_rica.md`
- `docs/mvp_1_prd.md`
- `docs/erd_mvp_1.mmd`
- `docs/er_mvp_prd.md`
- `docs/er_propuesto_prd.md`

## Nota de alcance

El backend actual es una base operativa del producto, no el cierre completo del MVP. Antes de ampliar pantallas o CRUDs aislados, conviene alinear el modelo con multi-bodega, lotes obligatorios, aprobaciones, auditoria, credito y produccion real.
