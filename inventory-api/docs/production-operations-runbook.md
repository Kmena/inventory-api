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

## Postura de red del baseline productivo
- `docker-compose.prod.yml` ya no publica el puerto PostgreSQL al host.
- El acceso esperado a la base del baseline es interno al stack mediante `docker compose -f docker-compose.prod.yml exec -T db ...`.
- Si un entorno requiere exposición adicional, debe documentarse como excepción operativa fuera de este baseline mínimo.
- HSTS permanece diferido porque este baseline no estandariza todavía la topología TLS ni el contrato de trusted proxy necesario para emitir `Strict-Transport-Security` con seguridad.
- Si HSTS se evalúa más adelante, el único camino aprobado es enablement condicional, con `TRUST_PROXY` explícito antes de cualquier ruta detrás de proxy y con `preload` fuera de alcance.

## Señales operativas mínimas versionadas
### Health y readiness
- liveness: `GET /health`
- readiness: `GET /health/ready`
- el contenedor usa `HEALTHCHECK` contra `/health/ready`
- en el baseline soportado con browser sessions sobre Redis, readiness exige dos prerequisitos: `checks.database = up` y `checks.browserSessionStore = up`
- en memory mode explícito o de test, readiness sigue siendo compatible y puede reportar `checks.browserSessionStore = memory` sin requerir Redis

### Logging y trazabilidad de requests
- el runtime genera `requestId` por request
- en entornos no development el log HTTP es estructurado JSON
- los errores de request preservan `requestId`, `method`, `path`, `statusCode` y `errorCode`

## Diagnóstico y recuperación de browser sessions sobre Redis
### Síntomas esperados
- `GET /health/ready` responde `503`
- el payload de readiness muestra `checks.browserSessionStore = down`
- login browser-cookie, `/api/auth/me` o logout pueden responder errores explícitos de servicio no disponible relacionados con sesiones browser
- el runtime no hace fallback silencioso a memory mode

### Diagnóstico mínimo
1. Verificar liveness y readiness:
```bash
curl http://localhost:${PORT:-2500}/health
curl http://localhost:${PORT:-2500}/health/ready
```
2. Confirmar que el baseline productivo mantiene `REDIS_URL` y `BROWSER_SESSION_STORE_MODE=redis` cuando corresponda.
3. Validar que el servicio Redis esté levantado en el entorno/compose esperado.
4. Revisar logs estructurados del runtime buscando fallos de `service_unavailable` o de `auth.browser_session_store` sin exponer secretos.
5. Reproducir la verificación repositorio-controlada con el lane dedicado:
```bash
npm run test:redis-path
```

### Recuperación mínima
1. Restablecer conectividad y disponibilidad del servicio Redis configurado por `REDIS_URL`.
2. Verificar que la aplicación siga apuntando al host/base correcta y que no exista configuración faltante en variables productivas.
3. Si aplica al entorno local o de smoke, relanzar dependencias y app:
```bash
docker compose -f docker-compose.prod.yml up -d db redis
docker compose -f docker-compose.prod.yml up -d app
```
4. Revalidar readiness:
```bash
curl http://localhost:${PORT:-2500}/health/ready
```

### Verificación posterior a la recuperación
- `/health/ready` vuelve a responder `200`
- el payload refleja `checks.database = up` y `checks.browserSessionStore = up` en Redis mode
- el flujo browser-cookie vuelve a permitir login, `/api/auth/me` y logout sin errores de store no disponible
- `npm run test:redis-path` permanece verde cuando se ejecuta en un entorno con Redis disponible

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
