# Restore Readiness Baseline

## Objetivo
Este documento fija el contrato mínimo verificable de restore readiness para el repositorio sin afirmar una automatización enterprise completa.

## Requisitos
- **RR-001:** Debe existir procedimiento documentado de backup lógico usando `pg_dump`.
- **RR-002:** Debe existir procedimiento documentado de restore validation usando `psql`.
- **RR-003:** Debe existir checklist posterior al restore y evidencia de readiness.
- **RR-004:** Debe preservarse evidencia de integridad del artefacto mediante `backup.sql.sha256` y `sha256sum`.
- **RR-005:** Debe preservarse evidencia de trazabilidad post-restore mediante consulta a `_prisma_migrations`.

## Evidencia mínima requerida
- Runbook operacional con comandos de backup y restore.
- Baseline productivo que referencia `npm run validate:restore-readiness`.
- Smoke workflow que ejecuta la validación y limpia `.env.production` temporal.
- Evidencia de `backup.sql.sha256`.
- Evidencia de `_prisma_migrations` después del restore.

## Límites explícitos
- No ejecuta automáticamente un restore real contra una base persistente de referencia.
- No sustituye drills operativos completos ni un programa de backups corporativo.
