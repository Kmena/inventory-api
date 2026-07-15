# Cómo validar la base desde cero

## Objetivo
Esta guía define la **secuencia canónica y reproducible** para replay limpio de base de datos usando únicamente tooling comprometido del repositorio.

Tambien documenta la verdad operativa del baseline actual: la ultima ejecucion compose preservada en `specs/p0-extra-inclusion/` quedo en estado **Failed / Environment blocked** porque la imagen `app` comprometida no incluye `scripts/apply-committed-migrations.js`.

Tooling comprometido relevante:

- `docker-compose.yml`
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
- el servicio `db` definido en `docker-compose.yml` debe estar disponible
- la base a validar debe ser **desechable** y distinta de la base por defecto `tracksys`
- el usuario `tracksys` del stack debe poder crear y eliminar la base disposable

## Importante sobre `DATABASE_URL`
Para evidencia canónica de cierre, el target debe ser el servicio `db` del `docker compose` del repositorio usando la red interna de Compose.

No use `localhost:5432` como referencia canónica de cierre a menos que se haya verificado explícitamente que apunta al mismo Postgres del stack y que no existe deriva entre host y contenedor. La clasificación histórica del paquete ya preserva casos donde `localhost:5432` no fue consistente con el estado observado dentro del servicio `db`.

## Secuencia canónica de replay limpio
Todos los comandos deben ejecutarse desde `inventory-api/`.

### 1. Construir el runtime comprometido del servicio `app`
```bash
docker compose build app
```

Esto garantiza dependencias instaladas y Prisma Client generado según el `Dockerfile` comprometido.

Baseline historico corregido por este paquete:
- el `Dockerfile` ahora copia `scripts/` junto con `prisma/` y `src/`
- la imagen resultante debe poder ejecutar `node scripts/apply-committed-migrations.js` dentro del contenedor
- la correccion debe seguir validandose con una corrida real de `docker compose run --rm ... app npm run prisma:apply-committed-migrations`

### 2. Levantar solo la base del stack
```bash
docker compose up -d db
```

### 3. Crear una base disposable vacía
Ejemplo con nombre `tracksys_replay_validation`:

```bash
docker compose exec -T db sh -lc "psql -U tracksys -d postgres -c 'DROP DATABASE IF EXISTS tracksys_replay_validation;' && psql -U tracksys -d postgres -c 'CREATE DATABASE tracksys_replay_validation;'"
```

### 4. Aplicar migraciones comprometidas con verificación física
La ruta canónica aprobada no debe confiar únicamente en `prisma migrate deploy`. La ruta aprobada usa el script comprometido `npm run prisma:apply-committed-migrations`, que aplica secuencialmente los `migration.sql` comprometidos y valida que el schema físico resultante exista realmente.

```bash
docker compose run --rm -e DATABASE_URL=postgresql://tracksys:tracksys@db:5432/tracksys_replay_validation?schema=public app npm run prisma:apply-committed-migrations
```

Criterio de validacion tras la correccion de empaquetado:
- este paso debe ejecutarse dentro de la imagen `app` sin `MODULE_NOT_FOUND`
- si la ejecucion falla en una etapa posterior, la clasificacion debe reflejar ese nuevo punto de fallo con evidencia fisica preservada
- no se debe marcar `Passed` solo por remover el bloqueo de empaquetado; seed y verificacion fisica siguen siendo obligatorios

### 5. Ejecutar seed/bootstrap comprometido
```bash
docker compose run --rm -e DATABASE_URL=postgresql://tracksys:tracksys@db:5432/tracksys_replay_validation?schema=public app npm run prisma:seed
```

### 6. Ejecutar validación de startup / smoke
La secuencia canónica debe comprobar que la aplicación puede levantar con la base replayed y responder el endpoint comprometido `/health`.

```bash
docker compose run --rm -e DATABASE_URL=postgresql://tracksys:tracksys@db:5432/tracksys_replay_validation?schema=public -e PORT=2500 app node -e "const http=require('http'); const app=require('./src/app'); const server=app.listen(2500,()=>{ http.get('http://127.0.0.1:2500/health',res=>{ console.log('health-status', res.statusCode); server.close(()=>process.exit(res.statusCode===200?0:1)); }).on('error',err=>{ console.error(err); server.close(()=>process.exit(1)); }); });"
```

### 7. Registrar la verificación final mínima
Registre al menos:
- existencia de la base disposable;
- tablas creadas en `public`;
- resultado del seed;
- resultado de la validación `/health`;
- cualquier discrepancia entre el target declarado y el estado real observado.

## Limpieza o reset
### Limpieza mínima de la base disposable
```bash
docker compose exec -T db sh -lc "psql -U tracksys -d postgres -c 'DROP DATABASE IF EXISTS tracksys_replay_validation;'"
```

### Detener el stack sin borrar volumen
```bash
docker compose down
```

### Reset destructivo del Postgres del stack
Use solo si necesita reiniciar completamente el estado local del cluster:

```bash
docker compose down -v
```

## Clasificación de resultados
- **Passed:** la base disposable se crea, las migraciones comprometidas se aplican con verificación física, el seed termina exitosamente y la validación `/health` responde con éxito.
- **Failed:** cualquier paso obligatorio termina con código no cero o evidencia un estado físico incorrecto del target.
- **Blocked by environment:** el tooling comprometido no puede ejecutarse por una condición externa reproducible del entorno, por ejemplo servicio inaccesible, permisos insuficientes o desaparición no explicada del target.
- **Inconclusive:** la ejecución dejó evidencia parcial pero no suficiente para afirmar Passed ni Failed con confianza.

## Interpretación actual del baseline
- El cierre operativo no debe confiar solo en el resultado textual de `prisma migrate deploy` en este entorno.
- La ruta canónica actual se basa en:
  - target controlado dentro del stack Compose;
  - aplicación secuencial verificada de migraciones comprometidas;
  - seed válido;
  - validación `/health` de arranque;
  - limpieza explícita.
- La evidencia real mas reciente (`EVID-DB-004`) muestra que el paso canónico de migración actualmente falla en Compose porque la imagen `app` no contiene `scripts/apply-committed-migrations.js`.
- En consecuencia, un `/health` exitoso despues de ese fallo no cambia la clasificacion del replay a `Passed`.

## Evidencia histórica relacionada
- La ejecución histórica preservada en el paquete muestra que `prisma migrate deploy` puede reportar éxito mientras el target reusable no conserva el estado esperado.
- Por eso la ruta canónica vigente para cierre usa `npm run prisma:apply-committed-migrations` como paso de migración verificable en lugar de tratar `prisma migrate deploy` como evidencia suficiente por sí solo.
