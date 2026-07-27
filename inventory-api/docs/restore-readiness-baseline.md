# Restore Readiness Baseline

## Objetivo
Este documento define el contrato versionado mínimo y público para la validación de restore readiness del repositorio.

No ejecuta automáticamente un restore real contra una base persistente de referencia. Su propósito es verificar que el procedimiento versionado, sus artefactos y sus checks críticos permanezcan presentes, auditables y alineados con el workflow `operational-smoke`.

## Requisitos del contrato
### RR-001
El baseline debe preservar un procedimiento documentado de backup lógico con `pg_dump` y resguardo del artefacto `backup.sql`.

### RR-002
El baseline debe preservar un procedimiento documentado de verificación de integridad del backup mediante `sha256sum` y el artefacto `backup.sql.sha256`.

### RR-003
El baseline debe preservar un procedimiento documentado de restore validation usando `psql` sobre una base temporal o aislada.

### RR-004
El baseline debe preservar verificación posterior al restore sobre `_prisma_migrations` para mantener trazabilidad visible del schema restaurado.

### RR-005
El baseline debe seguir alineado con el smoke workflow y con la materialización temporal de `.env.production` usada para validar el baseline operativo sin deploy.

## Artefactos y referencias mínimas
- `docs/production-baseline.md`
- `docs/production-operations-runbook.md`
- `.github/workflows/operational-smoke.yml`
- `scripts/validate-restore-readiness.js`
- `docker-compose.prod.yml`
- `src/routes/health.routes.js`

## Evidencia mínima preservada
El contrato se considera preservado cuando siguen presentes y alineados:
- referencia a `npm run validate:restore-readiness`
- referencia a `backup.sql.sha256`
- referencia a `_prisma_migrations`
- procedimiento de backup lógico con `pg_dump`
- procedimiento de restore validation con `psql`
- mención del smoke workflow o de `.env.production` temporal como parte del baseline operativo verificable

## Límites explícitos
- No ejecuta automáticamente un restore real contra producción.
- No sustituye un restore drill enterprise.
- No versiona backups reales ni secretos.
- No reemplaza la necesidad de validar `readiness` y health checks del runtime después de un restore.
