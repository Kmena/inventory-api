# Cómo validar la base desde cero

## Objetivo
Esta guía documenta la secuencia canónica para validar replay limpio de la base de datos usando artefactos comprometidos del repositorio:

- `prisma/schema.prisma`
- `prisma/migrations/`
- `prisma/seed.js`
- `docker-compose.yml`

## Prerrequisitos
- Docker Desktop o Docker Engine con `docker compose`
- Dependencias del proyecto instaladas en `inventory-api/`
- Entorno desechable para la base validada

## Importante sobre `DATABASE_URL`
Para evidencia de cierre operativa, la validación debe ejecutarse contra el servicio `db` del `docker compose` del repositorio o contra otra base disposable explícitamente controlada.

No use `localhost:5432` como referencia canónica de cierre sin verificar previamente que realmente apunta al Postgres del stack del proyecto. En esta sesión se observó deriva de entorno: comandos host-local sobre `localhost:5432` no fueron consistentes con el estado inspeccionado dentro del contenedor `db`.

## Secuencia canónica de replay limpio
Desde `inventory-api/`:

### 1. Levantar solo la base
```bash
docker compose up -d db
```

### 2. Crear una base desechable vacía
Ejemplo con nombre `tracksys_replay_validation`:

```bash
docker compose exec -T db sh -lc "psql -U tracksys -d postgres -c 'DROP DATABASE IF EXISTS tracksys_replay_validation;' && psql -U tracksys -d postgres -c 'CREATE DATABASE tracksys_replay_validation;'"
```

### 3. Aplicar migraciones comprometidas
```bash
docker compose run --rm -e DATABASE_URL=postgresql://tracksys:tracksys@db:5432/tracksys_replay_validation?schema=public app npx prisma migrate deploy
```

### 4. Ejecutar seed/bootstrap comprometido
```bash
docker compose run --rm -e DATABASE_URL=postgresql://tracksys:tracksys@db:5432/tracksys_replay_validation?schema=public app npm run prisma:seed
```

### 5. Verificar estado final
Si la validación requiere evidencia adicional, inspeccione el servidor `db` y registre:
- existencia de la base desechable;
- tablas creadas;
- resultado del seed;
- cualquier discrepancia entre el target declarado y el estado real observado.

## Resultado observado en esta implementación
Evidencia registrada en `specs/p0-extra-inclusion/implementation-report.md`:

- La secuencia de migraciones comprometidas fue invocada con éxito aparente mediante `prisma migrate deploy`.
- La validación host-local contra `localhost:5432` mostró deriva de entorno y no se considera evidencia canónica fiable.
- La validación alineada con `docker compose` siguió mostrando un bloqueo operacional: después del reporte de éxito de `prisma migrate deploy`, el target no quedó verificable de forma consistente desde el servicio `db`, y `npm run prisma:seed` falló porque la base objetivo no existía para el servidor inspeccionado.

## Interpretación actual
- El historial de migraciones comprometidas es invocable y no falló con un error SQL directo en esta sesión.
- El cierre operativo sigue bloqueado por una inconsistencia reproducible del entorno/target de replay.
- Hasta resolver esa inconsistencia, el replay limpio no debe considerarse cerrado aunque exista una ruta documentada.
