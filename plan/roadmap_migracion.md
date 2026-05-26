# Roadmap viable de migración

## Fase 0 - Higiene mínima

### Objetivo
Corregir problemas que bloquean la modernización.

### Acciones
- crear o recuperar `package.json`
- mover configuraciones a variables de entorno
- centralizar la conexión a la base de datos
- eliminar IPs hardcodeadas del front-end
- implementar hash de contraseñas con `bcrypt`
- definir un archivo `.env.example`

### Entregables
- backend configurable por ambiente
- arranque local reproducible
- seguridad básica corregida

---

## Fase 1 - Docker de desarrollo

### Objetivo
Levantar el sistema con servicios aislados y reproducibles.

### Acciones
- crear `Dockerfile`
- crear `docker-compose.dev.yml`
- montar volúmenes para uploads e imágenes
- exponer variables `PORT`, `DATABASE_URL`, `APP_BASE_URL`, `CORS_ORIGIN`

### Entregables
- ambiente local con `app` + `db`
- persistencia de datos vía volúmenes

---

## Fase 2 - Diseño SQL base

### Objetivo
Crear el modelo relacional inicial.

### Acciones
- modelar `companies`, `users`, `clients`, `products`, `orders`, `order_items`
- usar claves foráneas e índices
- usar JSONB solo donde haga falta transición temporal

### Entregables
- esquema PostgreSQL inicial
- mapa colección -> tabla

---

## Fase 3 - Migración del core

### Objetivo
Mover primero lo que más valor genera.

### Orden recomendado
1. empresas
2. usuarios
3. clientes
4. categorías y productos
5. pedidos y detalle
6. facturas y pagos

### Entregables
- backend híbrido temporal o backend nuevo para core
- datos validados en SQL

---

## Fase 4 - Refactor del backend

### Objetivo
Separar responsabilidades.

### Acciones
- crear capas `routes`, `services`, `repositories`
- quitar lógica pesada de rutas
- agregar validaciones de entrada
- preparar pruebas básicas

### Entregables
- backend más mantenible
- menor acoplamiento con la base de datos

---

## Fase 5 - Producción

### Objetivo
Preparar despliegue estable.

### Acciones
- agregar reverse proxy si aplica
- definir backups de PostgreSQL
- definir estrategia de logs
- endurecer CORS, secretos y usuarios de BD

### Entregables
- stack listo para ambientes QA/producción

---

## Ruta viable recomendada

La ruta más viable es **no reescribir todo**. Se recomienda:

1. estabilizar el backend actual
2. preparar Docker para desarrollo
3. levantar PostgreSQL
4. construir un nuevo módulo o capa para el core comercial
5. migrar gradualmente datos y endpoints críticos
6. retirar Mongo por dominios, no por sistema completo
