# Cómo validar la base desde cero

## Objetivo
Esta guía define la **secuencia canónica y reproducible** para replay limpio de base de datos usando únicamente tooling comprometido del repositorio.

Tambien documenta la verdad operativa actual de P2: el flujo canónico quedó consolidado sobre `docker-compose.dev.yml`, con replay secuencial validado para constraints y capacidad base de auditoría ya instrumentada en operaciones sensibles priorizadas.

Tooling comprometido relevante:

- `docker-compose.dev.yml`
- `docker-compose.yml` (alias transicional dev-only)
- `Dockerfile`
- `package.json`
- `prisma/schema.prisma`
- `prisma/migrations/`
- `prisma/seed.js`
- `scripts/apply-committed-migrations.js`
- `src/app.js` y `src/routes/health.routes.js`

## Prerrequisitos de entorno
Desde `inventory-api/`:
- Docker Desktop o Docker Engine con `docker compose`
- capacidad para construir el servicio `app` del repositorio
- acceso a un entorno disposable donde el Postgres del stack pueda destruirse o recrearse sin afectar datos productivos

## Prerrequisitos de base de datos
- el servicio `db` definido en `docker-compose.dev.yml` debe estar disponible
- la base a validar debe ser **desechable** y distinta de la base por defecto `tracksys`
- el usuario `tracksys` del stack debe poder crear y eliminar la base disposable

## Importante sobre `DATABASE_URL`
Para evidencia canónica de cierre, el target debe ser el servicio `db` del `docker compose` del repositorio usando la red interna de Compose.

No use `localhost:5432` como referencia canónica de cierre a menos que se haya verificado explícitamente que apunta al mismo Postgres del stack y que no existe deriva entre host y contenedor. La clasificación histórica del paquete ya preserva casos donde `localhost:5432` no fue consistente con el estado observado dentro del servicio `db`.

## Secuencia canónica de replay limpio
Todos los comandos deben ejecutarse desde `inventory-api/`.

### 1. Construir el runtime comprometido del servicio `app`
```bash
docker compose --env-file .env.example -f docker-compose.dev.yml build app
```

Esto garantiza dependencias instaladas y Prisma Client generado según el `Dockerfile` comprometido.

Estado operativo vigente:
- el `Dockerfile` ya copia `scripts/`, `prisma/` y `src/` dentro de la imagen final
- la imagen resultante puede ejecutar `node scripts/apply-committed-migrations.js` y `npm run prisma:apply-committed-migrations` dentro del contenedor
- la validación canónica de P2 debe seguir usando una corrida real de Compose sobre una base disposable

### 2. Levantar solo la base del stack
```bash
docker compose --env-file .env.example -f docker-compose.dev.yml up -d db
```

### 3. Crear una base disposable vacía
Ejemplo con nombre `tracksys_replay_validation`:

```bash
docker compose --env-file .env.example -f docker-compose.dev.yml exec -T db sh -lc "PGPASSWORD=$POSTGRES_PASSWORD psql -h 127.0.0.1 -U tracksys -d postgres -c 'DROP DATABASE IF EXISTS tracksys_replay_validation;' && PGPASSWORD=$POSTGRES_PASSWORD psql -h 127.0.0.1 -U tracksys -d postgres -c 'CREATE DATABASE tracksys_replay_validation;'"
```

### 4. Aplicar migraciones comprometidas con verificación física
La ruta canónica aprobada no debe confiar únicamente en `prisma migrate deploy`. La ruta aprobada usa el script comprometido `npm run prisma:apply-committed-migrations`, que aplica secuencialmente los `migration.sql` comprometidos y valida que el schema físico resultante exista realmente.

```bash
docker compose --env-file .env.example -f docker-compose.dev.yml run --rm -e DATABASE_URL=postgresql://tracksys:replace_me_local_password@db:5432/tracksys_replay_validation?schema=public app npm run prisma:apply-committed-migrations
```

Criterio de validacion tras la correccion de empaquetado:
- este paso debe ejecutarse dentro de la imagen `app` sin `MODULE_NOT_FOUND`
- si la ejecucion falla en una etapa posterior, la clasificacion debe reflejar ese nuevo punto de fallo con evidencia fisica preservada
- no se debe marcar `Passed` solo por remover el bloqueo de empaquetado; seed y verificacion fisica siguen siendo obligatorios

### 5. Ejecutar seed/bootstrap comprometido
```bash
docker compose --env-file .env.example -f docker-compose.dev.yml run --rm -e DATABASE_URL=postgresql://tracksys:replace_me_local_password@db:5432/tracksys_replay_validation?schema=public app npm run prisma:seed
```

### 6. Ejecutar validación de startup / smoke
La secuencia canónica debe comprobar que la aplicación puede levantar con la base replayed y responder el endpoint comprometido `/health`.

Notas operativas vigentes para P2:
- `GET /health` permanece como liveness backward compatible.
- `GET /health/ready` valida readiness con conectividad mínima a base de datos.
- El `HEALTHCHECK` del contenedor debe consultar `/health/ready`, no `/health`.

```bash
docker compose --env-file .env.example -f docker-compose.dev.yml run --rm -e DATABASE_URL=postgresql://tracksys:replace_me_local_password@db:5432/tracksys_replay_validation?schema=public -e PORT=2500 app node -e "const http=require('http'); const app=require('./src/app'); const server=app.listen(2500,()=>{ http.get('http://127.0.0.1:2500/health',res=>{ console.log('health-status', res.statusCode); if(res.statusCode!==200){ server.close(()=>process.exit(1)); return; } http.get('http://127.0.0.1:2500/health/ready',readyRes=>{ console.log('ready-status', readyRes.statusCode); server.close(()=>process.exit(readyRes.statusCode===200?0:1)); }).on('error',err=>{ console.error(err); server.close(()=>process.exit(1)); }); }).on('error',err=>{ console.error(err); server.close(()=>process.exit(1)); }); });"
```

### 7. Registrar la verificación final mínima
Registre al menos:
- existencia de la base disposable;
- tablas creadas en `public`;
- resultado del seed;
- resultado de la validación `/health`;
- resultado de la validación `/health/ready` cuando aplique;
- cualquier discrepancia entre el target declarado y el estado real observado.

## Diagnóstico P2 previo a constraints

Antes de activar constraints físicos de P2 sobre pagos, pedidos y cantidades, ejecute el diagnóstico comprometido del repositorio contra una base disposable ya migrada y, de preferencia, ya seeded.

### Ruta canónica para cerrar TASK-005
Todos los pasos siguientes deben ejecutarse **en secuencia**, nunca en paralelo, y usando el Compose canónico con `--env-file .env.example` para evitar deriva entre el shell local, `docker compose`, Prisma y `psql`.

Base disposable de referencia para la rerun final validada:
- `tracksys_p2_replay_target`

#### 1. Levantar el Postgres canónico con variables alineadas
```bash
docker compose --env-file .env.example -f docker-compose.dev.yml down -v
docker compose --env-file .env.example -f docker-compose.dev.yml up -d db
docker compose --env-file .env.example -f docker-compose.dev.yml build app
```

#### 2. Recrear la base disposable
```bash
docker compose --env-file .env.example -f docker-compose.dev.yml exec -T db sh -lc "PGPASSWORD=$POSTGRES_PASSWORD psql -h 127.0.0.1 -U tracksys -d postgres -c 'DROP DATABASE IF EXISTS tracksys_p2_replay_target;' && PGPASSWORD=$POSTGRES_PASSWORD psql -h 127.0.0.1 -U tracksys -d postgres -c 'CREATE DATABASE tracksys_p2_replay_target;'"
```

#### 3. Confirmar el target efectivo dentro del runtime de app
```bash
docker compose --env-file .env.example -f docker-compose.dev.yml run --rm \
  -e DATABASE_URL=postgresql://tracksys:replace_me_local_password@db:5432/tracksys_p2_replay_target?schema=public \
  app \
  node -e "const {PrismaClient}=require('@prisma/client'); const prisma=new PrismaClient(); prisma.$queryRawUnsafe('select current_database() as db, current_schema() as schema, current_user as db_user, inet_server_addr()::text as host, inet_server_port() as port').then(r=>{console.log(JSON.stringify(r));}).finally(()=>prisma.$disconnect());"
```

Resultado esperado:
- `db = tracksys_p2_replay_target`
- `schema = public`
- `host = db`
- `port = 5432`

#### 4. Aplicar migraciones comprometidas
```bash
docker compose --env-file .env.example -f docker-compose.dev.yml run --rm \
  -e DATABASE_URL=postgresql://tracksys:replace_me_local_password@db:5432/tracksys_p2_replay_target?schema=public \
  app npm run prisma:apply-committed-migrations
```

#### 5. Verificar físicamente la misma base con `psql`
```bash
docker compose --env-file .env.example -f docker-compose.dev.yml exec -T db sh -lc "PGPASSWORD=$POSTGRES_PASSWORD psql -h 127.0.0.1 -U tracksys -d tracksys_p2_replay_target -c \"SELECT current_database() AS db, COUNT(*) AS public_tables FROM information_schema.tables WHERE table_schema='public';\""
```

Resultado esperado:
- `db = tracksys_p2_replay_target`
- `public_tables > 0`

#### 6. Ejecutar seed sobre el mismo target
```bash
docker compose --env-file .env.example -f docker-compose.dev.yml run --rm \
  -e DATABASE_URL=postgresql://tracksys:replace_me_local_password@db:5432/tracksys_p2_replay_target?schema=public \
  app npm run prisma:seed
```

#### 7. Verificar datos mínimos requeridos por la suite de constraints
```bash
docker compose --env-file .env.example -f docker-compose.dev.yml exec -T db sh -lc "PGPASSWORD=$POSTGRES_PASSWORD psql -h 127.0.0.1 -U tracksys -d tracksys_p2_replay_target -c \"SELECT (SELECT COUNT(*) FROM companies) AS companies, (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM clients) AS clients, (SELECT COUNT(*) FROM categories) AS categories, (SELECT COUNT(*) FROM inventories) AS inventories, (SELECT COUNT(*) FROM warehouses) AS warehouses;\""
```

Resultado esperado mínimo:
- existen `companies`, `users`, `clients`, `categories`, `inventories` y `warehouses`
- la suite `tests/p2-hardening-constraints.test.js` crea sus propios fixtures de `products` e `invoices` sobre esta base validada

#### 8. Ejecutar el diagnóstico P2 sobre el mismo target
```bash
docker compose --env-file .env.example -f docker-compose.dev.yml run --rm \
  -e DATABASE_URL=postgresql://tracksys:replace_me_local_password@db:5432/tracksys_p2_replay_target?schema=public \
  app node scripts/diagnose-hardening-constraints.js
```

Resultado esperado para un dataset compatible:
- `ok: true`
- conteo `0` en todas las categorías diagnosticadas

#### 9. Ejecutar la suite de constraints sobre el mismo target verificado
```bash
docker compose --env-file .env.example -f docker-compose.dev.yml run --rm \
  -v "<absolute-path-to-repo>/inventory-api/tests:/app/tests" \
  -e P2_CONSTRAINTS_DATABASE_URL=postgresql://tracksys:replace_me_local_password@db:5432/tracksys_p2_replay_target?schema=public \
  app node --test tests/p2-hardening-constraints.test.js
```

En Windows PowerShell reemplace `<absolute-path-to-repo>` por una ruta estilo `C:/Users/...`.

#### 10. Regla de interpretación
- Si replay, `psql` y la suite de constraints coinciden sobre `tracksys_p2_replay_target`, `TASK-005` puede cerrarse.
- Si vuelve a aparecer una discrepancia, clasificar el resultado como `Failed` o `Inconclusive`.
- No reutilizar evidencia obtenida con comandos ejecutados en paralelo, porque replay, seed y verificación física son dependientes entre sí.

## Validación de auditoría P2

La capacidad base de auditoría ya está desplegada y la cobertura inicial de operaciones sensibles fue instrumentada en `TASK-007`.

### Cobertura inicial esperada
- login exitoso / rechazado
- denegaciones de autenticación y autorización
- pedidos: create/update/approve/cancel/dispatch/delete
- pagos: create/update/reverse
- facturas: create/update/cancel
- administración priorizada: companies/users/roles
- inventario sensible: stock entry, QA de lotes, ajustes manuales

### Validación automatizada mínima
```bash
npm run lint
npm run typecheck
npm run build
node --test tests/audit-instrumentation.test.js tests/lifecycle-delete-authorization.test.js
npm test
```

### Qué verificar manualmente
- que `audit_events` exista en una base migrada con sus índices iniciales
- que los eventos persistidos registren `request_id`, `action`, `resource_type`, `outcome` y actor cuando aplica
- que no aparezcan `password`, `passwordHash`, `token`, `JWT_SECRET` ni secretos equivalentes en `metadata`, `before_state` o `after_state`
- que las denegaciones de seguridad respondan 401/403 aunque la persistencia de auditoría falle, dejando advertencia estructurada

## Limpieza o reset
### Limpieza mínima de la base disposable
```bash
docker compose --env-file .env.example -f docker-compose.dev.yml exec -T db sh -lc "PGPASSWORD=$POSTGRES_PASSWORD psql -h 127.0.0.1 -U tracksys -d postgres -c 'DROP DATABASE IF EXISTS tracksys_p2_replay_target;'"
```

### Detener el stack sin borrar volumen
```bash
docker compose --env-file .env.example -f docker-compose.dev.yml down
```

### Reset destructivo del Postgres del stack
Use solo si necesita reiniciar completamente el estado local del cluster:

```bash
docker compose --env-file .env.example -f docker-compose.dev.yml down -v
```

## Clasificación de resultados
- **Passed:** la base disposable se crea, las migraciones comprometidas se aplican con verificación física, el seed termina exitosamente y la validación `/health` responde con éxito.
- **Failed:** cualquier paso obligatorio termina con código no cero o evidencia un estado físico incorrecto del target.
- **Blocked by environment:** el tooling comprometido no puede ejecutarse por una condición externa reproducible del entorno, por ejemplo servicio inaccesible, permisos insuficientes o desaparición no explicada del target.
- **Inconclusive:** la ejecución dejó evidencia parcial pero no suficiente para afirmar Passed ni Failed con confianza.

## Interpretación operativa actual
- El cierre operativo no debe confiar solo en el resultado textual de `prisma migrate deploy`.
- La ruta canónica actual se basa en:
  - target controlado dentro del stack Compose canónico;
  - aplicación secuencial verificada de migraciones comprometidas;
  - verificación física por `psql`;
  - seed válido;
  - validación de `/health` y `/health/ready`;
  - limpieza explícita.
- La evidencia de P2 ya confirmó replay válido para constraints y presencia física de `audit_events` con índices iniciales.
- Para nuevas reruns, cualquier divergencia entre Prisma, `psql` y la app debe clasificarse nuevamente como `Failed` o `Inconclusive` según la evidencia real observada.

## Evidencia histórica relacionada
- La ejecución histórica preservada en el paquete mostró que `prisma migrate deploy` podía reportar éxito mientras el target reusable no conservaba el estado esperado.
- Por eso la ruta canónica vigente para cierre sigue usando `npm run prisma:apply-committed-migrations` como paso de migración verificable en lugar de tratar `prisma migrate deploy` como evidencia suficiente por sí solo.
