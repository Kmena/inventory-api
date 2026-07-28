# Production Baseline

## Objetivo
Este documento define el baseline productivo **mínimo y verificable** soportado por el repositorio. No afirma una plataforma cloud completa ni una postura final de hardening; documenta el flujo realmente versionado.

## Artefactos versionados
- `Dockerfile`
- `docker-compose.prod.yml`
- `.env.production.example`
- `scripts/validate-production-baseline.js`
- `scripts/validate-restore-readiness.js`
- `scripts/validate-operational-readiness.js`
- `scripts/validate-workflow-baseline.js`
- `docs/production-operations-runbook.md`
- `docs/restore-readiness-baseline.md`
- `src/routes/health.routes.js`
- `prisma/schema.prisma`
- `.github/workflows/operational-smoke.yml`

## Variables y secretos requeridos
Copie `.env.production.example` a `.env.production` y reemplace todos los placeholders.

`.env.production.example` es un artefacto versionado del baseline productivo y `npm run validate:production-baseline` confirma que siga presente en el repositorio.

Variables obligatorias del baseline:
- `NODE_ENV=production`
- `PORT`
- `DATABASE_URL`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `CORS_ORIGIN`
- `APP_BASE_URL`
- `JWT_SECRET`
- `REDIS_URL`

Notas:
- `JWT_SECRET` debe ser real, no placeholder, y suficientemente largo.
- `config.js` ya impide arrancar en producción con el secret inseguro por defecto.
- `REDIS_URL` es obligatorio porque la persistencia soportada de browser sessions fuera de test usa Redis como store explícito.
- La gobernanza del repositorio ahora conserva además un lane dedicado `redis-browser-session-tests` para validar explícitamente la ruta Redis fuera del suite agregado estable en memory mode.

## Flujo ejecutable mínimo
Desde `inventory-api/`:

### 1. Validar configuración
```bash
cp .env.production.example .env.production
# editar .env.production
npm run validate:production-baseline
npm run validate:restore-readiness
npm run validate:operational-readiness
```

### 2. Validar sintaxis Compose del baseline productivo
```bash
docker compose -f docker-compose.prod.yml config
```

### 3. Construir imagen
```bash
docker compose -f docker-compose.prod.yml build
```

### 4. Levantar base de datos
```bash
docker compose -f docker-compose.prod.yml up -d db redis
```

### 5. Aplicar migraciones versionadas
```bash
docker compose -f docker-compose.prod.yml run --rm migrate
```

### 6. Levantar aplicación
```bash
docker compose -f docker-compose.prod.yml up -d app
```

### 7. Verificar health y readiness
```bash
curl http://localhost:${PORT:-2500}/health
curl http://localhost:${PORT:-2500}/health/ready
```

## Workflow operativo versionado
El repositorio ahora incluye además un smoke workflow explícito en:

- `.github/workflows/operational-smoke.yml`

Alcance del workflow:
- `npm ci`
- `npm run build`
- `node scripts/validate-workflow-baseline.js`
- `npm run validate:production-baseline`
- materialización temporal de `REDIS_URL` y `BROWSER_SESSION_STORE_MODE` junto con el `.env.production` temporal del smoke
- `npm run validate:restore-readiness`
- `npm run validate:operational-readiness`
- materialización temporal de `.env.production` en el runner para satisfacer `env_file` del compose smoke
- `docker compose -f docker-compose.prod.yml config`
- `docker build -t inventory-api:operational-smoke .`

Límites explícitos:
- no hace deploy
- no publica imágenes
- no sustituye validaciones de migración con base real
- no ejecuta restore real automático contra una base persistente de referencia
- funciona como evidencia operativa adicional versionada y smoke del baseline productivo

## Checklist local de smoke operacional
Desde `inventory-api/` con Docker disponible:

```bash
cp .env.production.example .env.production
# editar .env.production
npm run validate:production-baseline
npm run validate:restore-readiness
npm run validate:operational-readiness
docker compose -f docker-compose.prod.yml config
docker build -t inventory-api:operational-smoke .
```

## Cobertura operativa mínima del baseline
### Despliegue de aplicación
- La app corre desde la imagen definida en `Dockerfile`.
- `docker-compose.prod.yml` usa `restart: unless-stopped` para `app` y `db`.

### Configuración de secretos / variables
- El baseline requiere `.env.production` fuera de git.
- `.env.production.example` permanece versionado como plantilla contractual mínima del baseline.
- La validación automatizada rechaza placeholders inseguros y confirma que el ejemplo versionado siga presente.

### Migraciones
- El servicio `migrate` ejecuta `npm run prisma:deploy`.
- El flujo separa migración y arranque para evitar esconder fallos de schema dentro del `CMD` principal.

### Health / readiness
- `Dockerfile` expone `HEALTHCHECK` contra `/health/ready`.
- El runtime también conserva `/health` como liveness simple.

### Restore / runbook / observabilidad mínima
- `docs/production-operations-runbook.md` documenta backup lógico, restore validation y checklist posterior al restore.
- `docs/restore-readiness-baseline.md` define el contrato versionado mínimo y público de restore readiness.
- `scripts/validate-restore-readiness.js` valida que el contrato público de restore readiness, el runbook y el workflow operativo sigan alineados.
- `scripts/validate-operational-readiness.js` valida el workflow operativo root junto con los documentos públicos `docs/production-baseline.md` y `docs/production-operations-runbook.md`.
- El runtime ya emite `X-Request-Id`, logging estructurado fuera de development y contexto útil de error/request.

### Persistencia
- PostgreSQL persiste en el volumen `postgres_data`.
- Redis sostiene la persistencia soportada de browser sessions fuera de test y se referencia vía `REDIS_URL`.
- Archivos operativos del runtime persisten en `app_storage`.

## Build/publicación controlada sin deploy

El repositorio también versiona un flujo parcial de release en:

- `.github/workflows/build-and-publish.yml`

Alcance explícito del workflow:
- trigger por tag `v*` o `workflow_dispatch`
- `npm ci`
- `npm run build`
- `npm run verify`
- `docker build`
- empaquetado de imagen Docker versionada como artefacto de GitHub Actions
- publicación de checksum y metadata de release

Límites explícitos del workflow:
- no hace deploy a `staging`, `production` ni a otros ambientes
- no requiere secretos de registry para el baseline actual
- no sustituye una estrategia posterior de publicación a registry o despliegue

## Límites conocidos
- No incluye TLS, reverse proxy ni certificados.
- No incluye backups automatizados programados ni restore drill automático con datos reales persistidos.
- No incluye observabilidad externa ni agregación de logs SaaS; sí preserva señales mínimas versionadas de health, requestId y logging estructurado.
- El contrato público de restore readiness y operational readiness se valida desde artefactos versionados bajo `docs/`.
- No reemplaza una estrategia cloud específica.
- `docker-compose.prod.yml` es un baseline mínimo verificable, no una certificación de production-ready total.
