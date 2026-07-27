# Production Operations Runbook

## Objetivo
Este runbook documenta la evidencia operativa adicional versionada que acompaña el baseline productivo mínimo. No promete una plataforma SRE/Cloud completa; describe procedimientos reproducibles y límites explícitos del repositorio.

## Artefactos relacionados
- `docs/production-baseline.md`
- `docs/restore-readiness-baseline.md`
- `.env.production.example`
- `docker-compose.prod.yml`
- `Dockerfile`
- `scripts/validate-production-baseline.js`
- `scripts/validate-restore-readiness.js`
- `scripts/validate-operational-readiness.js`
- `.github/workflows/operational-smoke.yml`
- `src/routes/health.routes.js`
- `src/lib/logging.js`
- `src/lib/request-context.js`

## Pre-requisitos
- Docker y Docker Compose disponibles
- `.env.production.example` disponible como artefacto versionado del baseline
- `.env.production` materializado desde `.env.production.example`
- variables obligatorias validadas con `npm run validate:production-baseline`

## Señales operativas mínimas versionadas
### Health y readiness
- liveness: `GET /health`
- readiness: `GET /health/ready`
- el contenedor usa `HEALTHCHECK` contra `/health/ready`

### Logging y trazabilidad de requests
- el runtime genera `requestId` por request
- en entornos no development el log HTTP es estructurado JSON
- los errores de request preservan `requestId`, `method`, `path`, `statusCode` y `errorCode`

### Smoke operacional local
```bash
npm run validate:production-baseline
npm run validate:restore-readiness
npm run validate:operational-readiness
# este comando valida el contrato operativo público versionado del repositorio
docker compose -f docker-compose.prod.yml config
docker build -t inventory-api:operational-smoke .
```

## Procedimiento de backup lógico
Con `db` levantado y `.env.production` configurado:

```bash
docker compose -f docker-compose.prod.yml up -d db
docker compose -f docker-compose.prod.yml exec -T db sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=plain --clean --if-exists' > backup.sql
```

Resultado esperado:
- se obtiene un dump lógico reproducible del baseline PostgreSQL
- el artefacto `backup.sql` debe resguardarse fuera del contenedor

### Endurecimiento adicional del artefacto de backup
```bash
sha256sum backup.sql > backup.sql.sha256
sha256sum -c backup.sql.sha256
```

Resultado esperado:
- el backup lógico queda acompañado por una huella verificable
- la validación previa al restore detecta corrupción o sustitución accidental del artefacto

## Procedimiento de restore validation
La validación mínima aprobada para P6 no automatiza un restore enterprise; verifica que el procedimiento de restauración quede documentado, ejecutable y trazable.
El contrato versionado complementario de esta capacidad vive en `docs/restore-readiness-baseline.md` y se valida con `npm run validate:restore-readiness`.

### Opción A: restaurar sobre una base temporal dentro del contenedor
```bash
sha256sum -c backup.sql.sha256
docker compose -f docker-compose.prod.yml exec -T db sh -lc 'createdb -U "$POSTGRES_USER" "${POSTGRES_DB}_restore_check"'
docker compose -f docker-compose.prod.yml exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "${POSTGRES_DB}_restore_check"' < backup.sql
docker compose -f docker-compose.prod.yml exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "${POSTGRES_DB}_restore_check" -c "SELECT current_database();"'
docker compose -f docker-compose.prod.yml exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "${POSTGRES_DB}_restore_check" -c "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;"'
```

### Opción B: restaurar en un entorno aislado equivalente
- verificar `sha256sum -c backup.sql.sha256`
- crear una base PostgreSQL vacía compatible
- aplicar `backup.sql` con `psql`
- verificar conectividad, consultas básicas posteriores al restore y presencia de `_prisma_migrations`

## Checklist posterior al restore
- la base restaurada responde conexiones
- `backup.sql.sha256` fue validado antes del restore
- la tabla `_prisma_migrations` responde y conserva trazabilidad visible de migraciones
- la aplicación puede volver a ejecutar `/health/ready`
- no hay errores evidentes de schema en logs
- el flujo de migración sigue siendo `npm run prisma:deploy`

## Medidas extra de hardening operativo cerradas en esta ola
1. Integridad del artefacto de backup mediante `sha256sum` antes del restore.
2. Verificación post-restore de trazabilidad de schema vía `_prisma_migrations`.
3. Limpieza explícita del `.env.production` temporal del workflow de smoke para no retener materialización accidental fuera del paso de compose smoke.

## Límites explícitos
- no hay backups automáticos programados en el repositorio
- no hay restore drill automático contra producción real
- no hay agregación externa de logs ni observabilidad SaaS versionada
- restore readiness y operational readiness usan contratos públicos versionados bajo `docs/`
- este runbook eleva la madurez operativa por encima del baseline mínimo, pero no equivale a una plataforma enterprise completa
