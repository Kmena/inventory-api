# Memoria de sesión para code puppy

Este documento resume lo más importante de la sección de trabajo actual sobre la modernización de `Track_sys`.

## Contexto general

Se revisó el proyecto original `Track_sys-master` y se concluyó que:

- la arquitectura original está muy acoplada
- usa MongoDB con conexiones repetidas por modelo
- tiene configuración hardcodeada
- guarda contraseñas de forma insegura en el sistema viejo
- no conviene seguir ampliándolo directamente sin una base técnica más sana

Por eso se creó una carpeta de trabajo nueva:

```text
proyectos/track_sys_recomendado
```

Esta carpeta **no reemplaza automáticamente** al proyecto viejo, pero sí contiene la propuesta y la base técnica nueva para arrancar correctamente.

---

## Estructura importante creada

### 1. Documentación estratégica
Ruta:

```text
proyectos/track_sys_recomendado/docs/
```

Archivos clave:
- `acciones_recomendadas.html`
- `resumen.md`
- `memoria_sesion_code_puppy.md` ← este archivo

### 2. Plan y recomendación
Rutas:
- `plan/roadmap_migracion.md`
- `sql/schema_inicial_postgresql.sql`

### 3. Template funcional nuevo
Ruta:

```text
proyectos/track_sys_recomendado/inventory-api
```

Este es el punto más importante del trabajo actual.

---

## Qué es `inventory-api`

Es una plantilla real para construir el nuevo backend desde cero con:

- Node.js
- Express
- Prisma
- PostgreSQL
- Docker
- JWT
- bcrypt
- Zod

No es una maqueta conceptual. Ya contiene estructura funcional.

---

## Arquitectura actual de `inventory-api`

El backend quedó separado por capas:

- `src/routes/`
- `src/services/`
- `src/repositories/`
- `src/middlewares/`
- `src/schemas/`
- `src/lib/`

Esto se hizo para evitar repetir el problema del sistema viejo, donde la lógica, las rutas y la base de datos estaban mezcladas.

---

## Base de datos actual

Se definió un esquema Prisma en:

```text
inventory-api/prisma/schema.prisma
```

La base ya modela:

- roles
- empresas
- configuración de empresa
- usuarios
- regiones
- clientes
- contactos de clientes
- referencias de clientes
- inventario
- categorías
- productos
- competidores de producto
- proveedores
- producto-proveedor
- lotes
- movimientos de stock
- recetas
- ingredientes de receta
- pedidos
- detalle de pedido
- facturas
- pagos
- producción
- detalle de producción

Importante: el enfoque actual es **PostgreSQL + Prisma**, no MongoDB.

---

## Seguridad implementada

Ya se implementó:

### bcrypt
Para hash de contraseñas.

### JWT
Para autenticación por token.

### Middlewares
- `authenticate.js` → valida token
- `authorize.js` → valida roles
- `validate.js` → valida payloads con Zod

---

## Roles actuales

Se definieron 3 roles iniciales:

### admin
Puede hacer todo.

### sales
Pensado para ventas:
- clientes
- pedidos
- facturas
- pagos
- lectura de productos
- aprobar/cancelar pedidos

### warehouse
Pensado para bodega:
- productos
- ver pedidos
- despachar pedidos
- entradas de inventario
- ajustes de inventario
- ver movimientos

Documentación relacionada:

```text
inventory-api/docs/roles_y_permisos.md
```

---

## Credenciales demo actuales

Generadas por el seed:

- `admin / admin123`
- `ventas / ventas123`
- `bodega / bodega123`

Estas sirven para probar login y permisos por rol.

Importante:

- el proyecto todavía usa `seed` para poblar datos demo de prueba
- en la versión final no se pretende depender de datos iniciales cargados por seed para productos
- el flujo objetivo para productos ya empezó a moverse hacia carga desde Excel en la interfaz de bodega

---

## CRUDs y módulos ya implementados

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

Ya hay CRUD base implementado para:

- clients
- products
- orders
- invoices
- payments

---

## Lógica de inventario ya implementada

Esta es una de las partes más importantes del estado actual.

Se implementó la **fase 1 de lógica real de inventario**.

Archivo clave:

```text
inventory-api/src/services/inventory.service.js
```

### Comportamientos ya activos

#### Entrada manual de inventario
- aumenta `product.quantity`
- opcionalmente crea lote
- registra movimiento `IN`

#### Ajuste manual de inventario
- sube o baja `product.quantity`
- puede tocar lote específico
- registra movimiento `ADJUSTMENT`

#### Aprobar pedido
- valida stock disponible
- aumenta `reservedQuantity`
- registra movimiento `RESERVE`
- cambia pedido a `APPROVED`

#### Cancelar pedido aprobado
- libera reserva
- baja `reservedQuantity`
- registra movimiento `RELEASE`
- cambia pedido a `CANCELLED`

#### Despachar pedido
- baja `quantity`
- baja `reservedQuantity`
- registra movimiento `OUT`
- cambia pedido a `DELIVERED`

### Endpoints nuevos de inventario
- `GET /api/inventory/movements`
- `POST /api/inventory/entries`
- `POST /api/inventory/adjustments`

### Endpoints nuevos de flujo de pedido
- `POST /api/orders/:id/approve`
- `POST /api/orders/:id/cancel`
- `POST /api/orders/:id/dispatch`

Documentación relacionada:

```text
inventory-api/docs/logica_inventario_fase1.md
```

---

## Reglas importantes ya decididas

Estas reglas no deberían olvidarse en la siguiente sesión:

1. **Los pedidos se crean en `DRAFT`**
2. **Solo pedidos en `DRAFT` se pueden editar**
3. **Aprobar pedido reserva stock**
4. **Cancelar pedido aprobado libera stock reservado**
5. **Despachar pedido descuenta stock real**
6. **No usar `PUT` genérico para simular aprobación o despacho**
7. **Todo cambio de inventario debe generar `StockMovement`**
8. **El backend nuevo debe seguir usando capas (`routes/services/repositories`)**
9. **No volver a meter configuración hardcodeada estilo proyecto viejo**
10. **PostgreSQL + Prisma es la dirección actual del proyecto**

---

## Frontend demo ya implementado

Ya existe una primera parte de frontend mínima dentro del backend en:

```text
inventory-api/src/public/
```

### Flujo demo ya activo

- `GET /` muestra un login sencillo
- al hacer login con `bodega / bodega123`
- si el rol autenticado es `warehouse`
- redirige a:

```text
/warehouse/products.html
```

### Página demo de bodega

La página de bodega ya permite:

- listar productos actuales desde `GET /api/products`
- seleccionar un archivo Excel `.xlsx`
- leer el archivo en navegador
- previsualizar filas válidas
- marcar qué productos subir
- detectar si un `id` ya existe en la base
- mostrar si la acción será `Crear` o `Actualizar`
- pedir confirmación antes de actualizar productos existentes
- importar los productos seleccionados al backend

### Regla actual de importación por Excel

El archivo de referencia usado en esta sesión fue:

```text
C:\Users\kmena\Documents\Productos.xlsx
```

Columnas detectadas:

- `Codigo Cliente`
- `Descripcion`
- `Codigo Barras`
- `Codigo Cabys`
- `Registromedicamento`
- `Valor Unitario`
- `Precio Con Iva`
- `Existencias`
- `Familia Producto`

Mapeo actual de la demo:

- `Codigo Cliente` → `id` y `code`
- `Descripcion` → `name`
- `Codigo Barras`, `Codigo Cabys`, `Registromedicamento` → `description`
- `Precio Con Iva` o `Valor Unitario` → `price`
- `Existencias` → `quantity`
- `Familia Producto` → `categoryName`
- `unit` fijo → `UN`
- `currency` fijo → `CRC`

### Importación en chunks

Para evitar errores como `request entity too large` y dejar mejor control a futuro:

- la importación del frontend ya no manda todo el Excel de una vez
- ahora envía bloques de filas al endpoint
- tamaño actual del chunk en frontend:

```text
100 filas por bloque
```

Endpoint usado:

```text
POST /api/products/import
```

### Regla importante sobre IDs existentes

- si un `id` del Excel no existe → se crea
- si un `id` del Excel ya existe → se marca como actualización
- la UI pide confirmación antes de actualizar
- si el usuario no confirma, esos productos no deben actualizarse
- además se agregó protección para no actualizar productos de otra empresa si el `id` pertenece a otra compañía

---

## Reglas operativas nuevas decididas en esta sesión

1. **La base de datos no debe depender a futuro del seed para cargar productos reales**
2. **La carga real de productos debe venir desde la interfaz de bodega por Excel**
3. **Solo puede haber un `id` por producto**
4. **Si el Excel trae un `id` existente, el flujo debe tratarlo como actualización potencial**
5. **La actualización debe requerir confirmación del usuario**
6. **La importación masiva debe enviarse en chunks y no en un solo request gigante**
7. **La UI de bodega ya es parte del flujo de trabajo actual y no debe romperse al seguir iterando**

---

## Documentación útil ya existente en inventory-api/docs

- `que_es_prisma.md`
- `que_es_crud.md`
- `auth_bcrypt_jwt.md`
- `roles_y_permisos.md`
- `estructura_base.md`
- `logica_inventario_fase1.md`
- `memoria_sesion_code_puppy.md`

---

## Qué falta / próximos pasos recomendados

Todavía no está implementado o sigue incompleto:

- consumo de ingredientes por receta
- producción de producto terminado
- lógica FIFO/FEFO por lotes
- integración de movimientos con producción
- pruebas automatizadas
- diferencias visuales por fila antes de actualizar desde Excel
- reporte detallado de errores por chunk o por fila importada
- validaciones más finas del layout del Excel
- refresh tokens / sesiones avanzadas
- permisos granulares por acción

### Próximo paso más natural
Hay dos líneas naturales de continuación:

#### Opción A: seguir con inventario fase 2

- consumir materia prima según receta
- producir producto terminado
- registrar movimientos de producción
- opcionalmente asignar por lote

#### Opción B: madurar el flujo de Excel en bodega

- mostrar diferencias entre datos actuales y datos del Excel antes de actualizar
- guardar reporte de creados / actualizados / omitidos
- validar mejor categorías y campos faltantes
- considerar carga backend real del archivo si luego se requiere auditoría

---

## Recordatorio operativo para la próxima sesión

Si code puppy retoma este trabajo, lo primero que debe asumir es:

- ya existe una base nueva funcional
- no se está trabajando sobre MongoDB viejo
- el foco debe mantenerse en `inventory-api`
- la lógica de inventario ya comenzó y no debe duplicarse ni romperse
- ya existe un frontend demo mínimo de login + página de bodega
- la carga de productos por Excel ya empezó y no debe reescribirse desde cero sin revisar el flujo actual
- la importación desde Excel ya trabaja con detección de `id` existente y envío en chunks
- cualquier nueva funcionalidad debe respetar el diseño por capas y las reglas de stock ya definidas
- `docker compose down` conserva la base si no se usa `-v`
- el stack actual no corre migraciones ni seed automáticamente al iniciar el contenedor, así que para una base limpia aún puede requerirse:
  - `docker compose exec app npx prisma migrate deploy`
  - `docker compose exec app npm run prisma:seed`

En resumen:

> el proyecto ya no solo tiene backend base e inventario fase 1; ahora también tiene una primera interfaz funcional de bodega con login, listado de productos e importación de productos desde Excel en chunks.
