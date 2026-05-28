# Memoria de sesión para code puppy

Este documento resume el estado real de trabajo del proyecto `inventory-api`, incluyendo el contraste con el PRD actual, para retomar la siguiente sesión sin volver a inventar contexto a mano.

## Contexto general

`inventory-api` es la base nueva para modernizar el sistema anterior de `Track_sys` con una arquitectura más mantenible y menos cursed.

La dirección técnica actual sigue siendo:

- Node.js
- Express
- Prisma
- PostgreSQL
- Docker
- JWT
- bcrypt
- Zod

No se está trabajando sobre el backend viejo con MongoDB. El foco actual debe mantenerse en esta base nueva.

---

## Estructura relevante del proyecto

Ruta raíz actual:

```text
inventory-api/
```

Estructura importante:

- `README.md`
- `CHANGELOG.md`
- `docs/`
- `plan/`
- `sql/`
- `docker/`
- `inventory-api/` ← backend funcional principal

Dentro del backend principal:

```text
inventory-api/inventory-api/
```

Carpetas clave:

- `src/routes/`
- `src/services/`
- `src/repositories/`
- `src/schemas/`
- `src/middlewares/`
- `src/lib/`
- `src/public/`
- `prisma/`

La separación por capas ya existe y no debe romperse metiendo lógica de negocio en rutas solo porque “era más rápido”. Sí, rapidísimo hasta que luego nadie entiende nada.

---

## Estado actual del backend

La app HTTP principal está en:

```text
inventory-api/inventory-api/src/app.js
```

Características activas:

- CORS configurable
- `express.json()` y `express.urlencoded()` con límite de `25mb`
- logging con Morgan
- archivos estáticos servidos desde `src/public`
- serialización segura de `BigInt` a string en respuestas JSON
- manejo centralizado de errores

Routers montados actualmente:

- `/health`
- `/api/auth`
- `/api/companies`
- `/api/users`
- `/api/clients`
- `/api/products`
- `/api/orders`
- `/api/invoices`
- `/api/payments`
- `/api/inventory`

---

## Base de datos y modelo actual

El esquema principal está en:

```text
inventory-api/inventory-api/prisma/schema.prisma
```

La migración inicial ya existe y está versionada.

El modelo ya contempla, entre otras cosas:

- roles
- empresas
- configuración de empresa
- usuarios
- regiones
- clientes y contactos
- inventario
- categorías
- productos
- proveedores
- lotes
- movimientos de stock
- recetas
- pedidos y detalle
- facturas
- pagos
- producción
- órdenes de producción

La base objetivo sigue siendo **PostgreSQL + Prisma**.

Importante: aunque el modelo ya incluye varias piezas de producción, lotes y proveedores, eso **no significa** que toda la lógica de negocio del PRD ya esté implementada. Hay bastante estructura, pero todavía no toda la operación real.

---

## Seguridad implementada

Ya está implementado lo básico y correcto para no seguir heredando barbaridades del sistema viejo:

### Hash de contraseñas
- bcrypt

### Autenticación
- JWT

### Validación
- Zod

### Middlewares principales
- `authenticate.js` → valida token
- `authorize.js` → valida roles
- `validate.js` → valida payloads

Endpoint público de login:

- `POST /api/auth/login`

Endpoint protegido para sesión actual:

- `GET /api/auth/me`

---

## Roles actuales

Roles definidos y sembrados por seed:

- `admin`
- `sales`
- `warehouse`

Credenciales demo actuales:

- `admin / admin123`
- `ventas / ventas123`
- `bodega / bodega123`

Notas:

- `ventas` corresponde al rol `sales`
- `bodega` corresponde al rol `warehouse`
- estas credenciales sirven para pruebas locales y flujo demo

Documentación relacionada:

```text
inventory-api/inventory-api/docs/roles_y_permisos.md
```

---

## CRUDs y módulos ya disponibles

### Públicos
- `GET /health`
- `POST /api/auth/login`

### Protegidos con JWT
- `GET /api/auth/me`
- empresas
- usuarios
- clientes
- productos
- pedidos
- facturas
- pagos
- inventario

Hay base funcional para CRUD y operación de estos módulos:

- companies
- users
- clients
- products
- orders
- invoices
- payments

---

## Lógica de inventario ya implementada

Archivo clave:

```text
inventory-api/inventory-api/src/services/inventory.service.js
```

La fase 1 de inventario ya está funcional.

### Comportamientos activos

#### Entrada manual de inventario
- aumenta `product.quantity`
- opcionalmente crea o afecta lote
- registra movimiento `IN`

#### Ajuste manual de inventario
- sube o baja `product.quantity`
- puede afectar lote específico
- registra movimiento `ADJUSTMENT`

#### Aprobar pedido
- valida stock disponible
- aumenta `reservedQuantity`
- registra movimiento `RESERVE`
- cambia pedido a `APPROVED`
- registra `approved`, `approvedAt` y `approvedById`

#### Cancelar pedido aprobado
- libera reserva
- baja `reservedQuantity`
- registra movimiento `RELEASE`
- cambia pedido a `CANCELLED`
- limpia metadatos de aprobación

#### Despachar pedido
- baja `quantity`
- baja `reservedQuantity`
- registra movimiento `OUT`
- cambia pedido a `DELIVERED`

### Endpoints de inventario
- `GET /api/inventory/movements`
- `POST /api/inventory/entries`
- `POST /api/inventory/adjustments`

### Endpoints de flujo de pedido
- `POST /api/orders/:id/approve`
- `POST /api/orders/:id/cancel`
- `POST /api/orders/:id/dispatch`

Documentación relacionada:

```text
inventory-api/inventory-api/docs/logica_inventario_fase1.md
```

---

## Reglas de negocio importantes ya implementadas

Estas reglas ya están reflejadas en la implementación actual y no deben romperse alegremente:

1. **Los pedidos se crean en `DRAFT`**
2. **Solo pedidos en `DRAFT` se pueden editar**
3. **Aprobar pedido reserva stock**
4. **Cancelar pedido aprobado libera stock reservado**
5. **Despachar pedido descuenta stock real**
6. **No usar `PUT` genérico para simular aprobación, cancelación o despacho**
7. **Todo cambio de inventario debe generar `StockMovement`**
8. **El backend debe seguir por capas (`routes/services/repositories`)**
9. **No volver a hardcodear configuración estilo sistema viejo**
10. **PostgreSQL + Prisma sigue siendo la dirección oficial**

Además, `order.service.js` explícitamente bloquea el intento de usar actualización genérica para aprobar o despachar pedidos. Y hace bien. Milagro administrativo.

---

## Flujo frontend demo ya implementado

Existe una interfaz mínima servida desde:

```text
inventory-api/inventory-api/src/public/
```

### Login demo
Archivo principal:

```text
inventory-api/inventory-api/src/public/login.js
```

Flujo actual:

- `GET /` muestra login básico
- al autenticarse correctamente
- si el usuario tiene rol `warehouse`
- se redirige a:

```text
/warehouse/products.html
```

### Página demo de bodega
Archivos principales:

- `src/public/warehouse/products.html`
- `src/public/warehouse/products.js`

Capacidades actuales:

- listar productos con `GET /api/products`
- seleccionar archivo Excel `.xlsx` o `.xls`
- leer el archivo en navegador usando `xlsx`
- transformar filas válidas
- mostrar preview de importación
- seleccionar manualmente qué filas subir
- detectar si un `id` ya existe
- marcar si la acción será `Crear` o `Actualizar`
- pedir confirmación antes de actualizar existentes
- enviar importación al backend
- procesar importación por bloques

---

## Importación de productos desde Excel

Endpoint backend usado:

```text
POST /api/products/import
```

Ruta backend relevante:

```text
inventory-api/inventory-api/src/routes/product.routes.js
```

Servicio principal:

```text
inventory-api/inventory-api/src/services/product.service.js
```

### Regla actual de importación

El frontend arma filas con este mapeo:

- `Codigo Cliente` → `id` y `code`
- `Descripcion` → `name`
- `Codigo Barras`, `Codigo Cabys`, `Registromedicamento` → `description`
- `Precio Con Iva` o `Valor Unitario` → `price`
- `Existencias` → `quantity`
- `Familia Producto` → `categoryName`
- `unit` fijo → `UN`
- `currency` fijo → `CRC`

### Comportamiento actual del backend en importación

Para cada fila:

- busca productos existentes por `id`
- usa `companyId` del usuario autenticado
- asegura que exista inventario para esa empresa
- resuelve o crea categorías por nombre dentro del inventario de la empresa
- si el producto no existe → lo crea
- si el producto existe en la misma empresa y `overwrite` es `true` → lo actualiza
- si existe pero pertenece a otra empresa → lo omite
- si existe y `overwrite` es `false` → lo omite

### Resumen que devuelve la importación

El backend retorna:

- `created`
- `updated`
- `skipped`

Con eso el frontend acumula conteos por bloque.

---

## Importación en chunks

La UI ya hace importación por bloques para evitar requests gigantes y reducir el riesgo de errores tipo payload demasiado grande.

Constante actual en frontend:

```text
IMPORT_CHUNK_SIZE = 100
```

Archivo:

```text
inventory-api/inventory-api/src/public/warehouse/products.js
```

Flujo actual:

- se filtran filas seleccionadas
- se separan en bloques de 100
- cada bloque se envía a `POST /api/products/import`
- se muestran mensajes de progreso por bloque
- se acumula conteo total de creados, actualizados y omitidos

---

## Seed y datos demo

Archivo:

```text
inventory-api/inventory-api/prisma/seed.js
```

El seed actual deja una base demo con:

- roles `admin`, `sales`, `warehouse`
- empresa demo
- configuración de empresa
- inventario con categorías iniciales
- regiones demo
- usuarios demo
- cliente demo
- materia prima demo
- receta demo
- producto terminado demo
- pedido demo
- factura demo
- pago demo

Regla importante:

- el seed sigue siendo útil para credenciales y humo controlado de pruebas locales
- pero el flujo real de productos ya empezó a moverse hacia carga desde Excel en bodega
- no conviene diseñar el sistema final dependiendo del seed para poblar productos reales

---

## PRD revisado en esta sesión

Se revisó el documento:

```text
inventory-api/inventory-api/docs/Proyecto Inventario Interno - Prd V1.pdf
```

Versión identificada en el propio documento:

- versión `1.0`
- idioma `Español`
- estado `Borrador inicial`

### Resumen del PRD

El PRD define una plataforma web responsive para centralizar:

- inventario
- ventas
- producción
- clientes
- crédito comercial
- proveedores
- bodegas
- reportes y dashboards

La intención es reemplazar procesos manuales y archivos Excel heredados, mejorar trazabilidad y permitir aprobaciones sobre operaciones críticas.

### Objetivos principales del PRD

- centralizar inventario, ventas y producción
- reducir errores manuales
- mejorar trazabilidad
- mantener históricos confiables
- permitir aprobaciones de operaciones críticas
- mejorar visibilidad del negocio
- controlar clientes, crédito y pagos parciales
- gestionar proveedores y precios por producto

### Objetivos secundarios del PRD

- dejar base para futura facturación electrónica CR
- preparar expansión futura a múltiples empresas
- facilitar reportes exportables en PDF y Excel
- permitir futura integración con códigos de barras

---

## Alineación del sistema actual con el PRD

### Bien alineado

El estado actual ya va en buena dirección respecto al PRD en estos puntos:

- stack técnico: Node.js + PostgreSQL + Prisma
- backend por capas
- autenticación con JWT
- hash de contraseñas con bcrypt
- validación con Zod
- CRUD base para módulos principales
- inventario fase 1
- flujo de pedido con aprobación y despacho separado
- modelo base con clientes, pagos, proveedores, recetas, lotes y producción
- importación inicial desde Excel

### Parcialmente alineado

Estos temas ya tienen base, pero no cumplen todavía completo lo que pide el PRD:

- roles y permisos
- lotes
- clientes y crédito
- pagos parciales
- importación masiva de datos
- auditoría más amplia
- producción
- proveedores

### Gap claro respecto al PRD

Estos temas todavía no están realmente resueltos:

- multi-bodega real
- transferencias entre bodegas
- supervisor como rol operativo explícito
- dashboards y reportes
- exportación PDF/Excel
- múltiples precios por producto
- control formal de salidas aprobadas por supervisor según regla de negocio
- bitácora global de acciones críticas
- alertas automáticas de stock mínimo

---

## Cambios y consideraciones importantes detectadas por el PRD

### 1. Multi-bodega
El PRD pide inventario por bodega y transferencias entre bodegas.

Hoy el stock está manejado principalmente a nivel global por producto (`product.quantity` y `reservedQuantity`) y no por bodega.

Esto implica que en una siguiente fase seguramente habrá que modelar algo como:

- `Warehouse`
- balance por `warehouseId + productId`
- movimientos con origen y destino

Este es uno de los cambios de arquitectura más importantes pendientes.

### 2. Lotes obligatorios y salida configurable
El PRD dice que todos los productos deben usar lotes y que la estrategia de salida por lote debe ser configurable por producto.

Hoy:

- existe modelo `Lot`
- se puede registrar lote
- se pueden relacionar movimientos a lote
- pero el uso de lote es opcional
- no existe estrategia explícita FIFO/FEFO/manual por producto
- no existe bodega asociada al lote en el modelo actual
- no existe estado formal de lote

Esto requiere rediseño parcial del modelo y de la lógica de inventario.

### 3. No borrar históricos
El PRD es claro en varias reglas:

- no se deben borrar históricos
- catálogos con historial solo deben desactivarse

Hoy existen endpoints `DELETE` reales para varias entidades, incluyendo productos y pedidos en ciertos casos.

Eso choca con el PRD. A futuro habrá que moverse a:

- `isActive`
- `status`
- soft delete o desactivación lógica

### 4. Roles del PRD vs roles actuales
El PRD habla de estos perfiles:

- Administrador
- Supervisor
- Encargado de bodega
- Operador comercial
- Usuario ejecutivo

Hoy solo existen:

- `admin`
- `sales`
- `warehouse`

Posible mapeo inicial:

- `admin` → Administrador
- `sales` → Operador comercial
- `warehouse` → Encargado de bodega

Pero todavía faltan al menos:

- `supervisor`
- `executive`

Y no solo es renombre; también implica permisos nuevos y flujos de aprobación más finos.

### 5. Crédito comercial y aprobaciones
El PRD pide:

- límite de crédito
- saldo pendiente
- pagos parciales por factura
- aprobación si una venta excede el límite de crédito

Hoy el modelo ya tiene campos como:

- `creditLimit`
- `creditBalance`

Y ya existen facturas y pagos, pero la lógica de aprobación por crédito excedido todavía no está implementada.

### 6. Producción real
El PRD pide una operación de producción más completa y en esta sesión quedó más aterrizada la regla esperada:

- la orden de producción inicia en `DRAFT`
- luego pasa por `REQUESTED`
- requiere aprobación de supervisor para iniciar (`APPROVED_TO_START`)
- luego puede entrar en `IN_PROGRESS`
- antes de cerrar debe pasar por `PENDING_FINISH_APPROVAL`
- requiere aprobación de supervisor para finalizar
- puede terminar en `FINISHED`, `CANCELLED` o `REJECTED`

Además:

- el inventario de materias primas y envases **no se descuenta al iniciar**
- el descuento de insumos ocurre **al finalizar la producción**
- en ese mismo momento se debe registrar la merma
- en ese mismo momento se debe incrementar el inventario del producto terminado
- también conviene registrar una entidad explícita de merma, tipo `PRODUCTION_WASTE`

Hoy ya existen modelos para:

- recetas
- ingredientes de receta
- órdenes de producción
- items de producción

Pero la lógica real todavía no está cerrada. En la práctica sigue siendo una base estructural, no una implementación completa del flujo productivo.

### 7. Reportes y dashboards
El PRD pide visualizaciones y reportes sobre:

- inventario actual
- productos bajo stock
- ventas por período
- ventas por producto
- ventas por cliente
- ventas por vendedor
- producción realizada
- movimientos de inventario
- historial de aprobaciones

Además pide exportación a PDF y Excel.

Hoy eso no existe como módulo funcional real.

### 8. Importación formal de datos
El PRD pide importación desde archivos heredados con:

- validación antes de guardar
- log de errores o inconsistencias
- soporte para varios formatos heredados

Hoy sí existe importación de productos desde Excel, pero todavía con enfoque demo-operativo:

- frontend parsea el archivo
- manda filas ya transformadas al backend
- no hay log formal de errores por fila
- no hay auditoría fuerte de importación
- no hay soporte formal para todos los formatos mencionados en el PRD

---

## Reglas del PRD que deben recordarse como restricciones futuras

Estas reglas del PRD son especialmente importantes para no seguir construyendo en dirección equivocada:

1. **El inventario solo cambia mediante eventos controlados**
2. **No se deben borrar históricos**
3. **Los catálogos con historial deben desactivarse, no eliminarse**
4. **Todos los productos deben usar lotes**
5. **La estrategia de salida por lote debe ser configurable por producto**
6. **La venta no debe descontar inventario hasta la salida aprobada**
7. **Las ventas con crédito excedido requieren aprobación**
8. **Los ajustes relevantes pueden requerir aprobación**
9. **Toda merma debe llevar motivo**
10. **Toda entrada, salida, ajuste, transferencia o producción debe quedar registrada**
11. **Toda orden de producción requiere aprobación de supervisor para iniciar**
12. **Toda orden de producción requiere aprobación de supervisor para finalizar**
13. **El descuento de materias primas/envases por producción ocurre al finalizar la orden**
14. **La merma de producción debe registrarse junto con el cierre de la orden**
15. **Deben existir alertas por stock mínimo**
16. **Los pagos parciales deben quedar ligados a la factura correspondiente**

---

## Documentación útil ya existente

En:

```text
inventory-api/inventory-api/docs/
```

Archivos actuales:

- `Proyecto Inventario Interno - Prd V1.pdf`
- `auth_bcrypt_jwt.md`
- `estructura_base.md`
- `logica_inventario_fase1.md`
- `que_es_crud.md`
- `que_es_prisma.md`
- `roles_y_permisos.md`

En la raíz del proyecto también son importantes:

- `docs/resumen.md`
- `plan/roadmap_migracion.md`
- `sql/schema_inicial_postgresql.sql`
- `CHANGELOG.md`

---

## Reglas operativas que no se deben olvidar

1. **La UI demo de bodega ya forma parte del flujo actual**
2. **La importación masiva de productos ya existe; no reescribirla desde cero sin revisar lo actual**
3. **Los productos usan `id` único como referencia principal en la importación demo**
4. **Si un `id` ya existe, el flujo lo trata como actualización potencial**
5. **La actualización requiere confirmación del usuario en frontend**
6. **La importación ya se manda por chunks y eso no debe perderse**
7. **La protección por empresa ya existe y debe mantenerse**
8. **Cualquier nueva funcionalidad debe respetar capas y reglas de stock**
9. **Antes de seguir agregando features grandes, conviene alinear el diseño con el PRD y no solo con la demo actual**

---

## Qué falta o sigue incompleto

Todavía faltan o siguen verdes varias cosas, y varias de ellas ahora ya quedaron respaldadas por el PRD:

- multi-bodega real
- transferencias entre bodegas
- lotes obligatorios con estrategia de salida configurable
- soft delete o desactivación lógica en vez de borrado físico
- supervisor y usuario ejecutivo como roles explícitos
- permisos más granulares por acción
- aprobación por crédito excedido
- producción real con estados propios (`DRAFT`, `REQUESTED`, `APPROVED_TO_START`, `IN_PROGRESS`, `PENDING_FINISH_APPROVAL`, `FINISHED`, `CANCELLED`, `REJECTED`)
- producción real con doble aprobación de supervisor (inicio y cierre)
- entidad explícita para merma de producción (`PRODUCTION_WASTE`)
- integración completa entre producción e inventario
- lógica FIFO/FEFO por lotes
- reportes y dashboards
- exportación PDF y Excel
- alertas de stock mínimo
- auditoría más amplia de acciones críticas
- mejor diff visual antes de actualizar productos desde Excel
- reporte detallado de errores por fila o por bloque
- validaciones más finas del layout del Excel
- refresh tokens o manejo de sesión más robusto
- pruebas automatizadas
- filtrado y paginación real en algunos listados

---

## Próximos pasos recomendados después del PRD

Después de revisar el PRD, las siguientes líneas de trabajo se ven más naturales y más sanas:

### Opción A: alinear arquitectura base con el PRD

- diseñar entidad de bodegas
- definir stock por bodega
- modelar transferencias entre bodegas
- definir política de soft delete/desactivación
- revisar estrategia obligatoria de lotes
- aterrizar nuevos roles y aprobaciones de supervisor

### Opción B: inventario fase 2 / producción real

- consumir materia prima según receta
- producir producto terminado
- registrar movimientos de producción
- manejar merma con motivo
- crear lote del producto producido
- preparar soporte futuro para FIFO/FEFO

### Opción C: madurar la importación y trazabilidad

- mostrar diferencias campo por campo antes de actualizar
- guardar o exponer reporte de creados / actualizados / omitidos
- mejorar validaciones del archivo
- permitir mejor retroalimentación por fila fallida
- considerar auditoría de importaciones

### Recomendación honesta

Antes de seguir ampliando frontend o CRUDs al azar, conviene primero resolver o al menos diseñar bien:

1. **bodegas**
2. **lotes**
3. **soft delete / estados activos**
4. **roles + supervisor**
5. **crédito y aprobaciones**

Si no, luego tocará rehacer media casa. Y sí, sería bastante marca de la casa, pero mejor evitarlo.

---

## Recordatorio operativo para la próxima sesión

Al retomar este trabajo, asumir lo siguiente:

- el foco debe mantenerse en `inventory-api`
- la base nueva ya es funcional
- ya existe inventario fase 1
- ya existe frontend demo de login + bodega
- ya existe importación de productos por Excel
- ya existe envío por chunks
- ya existe protección para no actualizar productos de otra empresa
- el PRD ya fue revisado y sí introduce consideraciones importantes de diseño
- no se debe duplicar la lógica ya implementada sin revisar primero servicios, rutas y el PRD actual

### Comandos útiles que probablemente vuelvan a hacer falta

Desde:

```text
inventory-api/inventory-api
```

Para instalar dependencias:

```bash
npm install
```

Para generar Prisma Client:

```bash
npx prisma generate
```

Para aplicar migraciones en desarrollo:

```bash
npx prisma migrate dev --name init
```

Para levantar Docker:

```bash
docker compose up --build
```

Para seed manual dentro del contenedor:

```bash
docker compose exec app npm run prisma:seed
```

Nota importante:

- `docker compose down` conserva la base mientras no se use `-v`
- el contenedor no corre migraciones ni seed automáticamente al iniciar
- en base limpia puede hacer falta ejecutar manualmente migraciones y seed

---

## Resumen corto brutalmente útil

> `inventory-api` ya tiene backend funcional por capas, autenticación con JWT, seed demo, inventario fase 1, flujo dedicado de aprobación/cancelación/despacho de pedidos y una primera UI de bodega con importación de productos desde Excel en bloques de 100. Pero tras revisar `Proyecto Inventario Interno - Prd V1.pdf`, quedó claro que todavía faltan piezas importantes para alinearse al producto objetivo: multi-bodega, lotes obligatorios, soft delete, supervisor/aprobaciones, crédito comercial, producción real, reportes y trazabilidad más fuerte.
