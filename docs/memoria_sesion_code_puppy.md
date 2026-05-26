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

## Documentación útil ya existente en inventory-api/docs

- `que_es_prisma.md`
- `que_es_crud.md`
- `auth_bcrypt_jwt.md`
- `roles_y_permisos.md`
- `estructura_base.md`
- `logica_inventario_fase1.md`

---

## Qué falta / próximos pasos recomendados

Todavía no está implementado:

- consumo de ingredientes por receta
- producción de producto terminado
- lógica FIFO/FEFO por lotes
- integración de movimientos con producción
- pruebas automatizadas
- frontend de prueba
- refresh tokens / sesiones avanzadas
- permisos granulares por acción

### Próximo paso más natural
Implementar la **fase 2 de inventario**:

- consumir materia prima según receta
- producir producto terminado
- registrar movimientos de producción
- opcionalmente asignar por lote

---

## Recordatorio operativo para la próxima sesión

Si code puppy retoma este trabajo, lo primero que debe asumir es:

- ya existe una base nueva funcional
- no se está trabajando sobre MongoDB viejo
- el foco debe mantenerse en `inventory-api`
- la lógica de inventario ya comenzó y no debe duplicarse ni romperse
- cualquier nueva funcionalidad debe respetar el diseño por capas y las reglas de stock ya definidas

En resumen:

> el proyecto está en transición hacia un backend nuevo, relacional, con seguridad básica y lógica operativa inicial de inventario ya implementada.
