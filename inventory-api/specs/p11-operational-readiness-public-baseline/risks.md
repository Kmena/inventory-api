# Risks

- Migrar operational readiness a docs públicos puede revelar supuestos no documentados actualmente en `internal-docs/`.
- Reforzar `.env.production.example` podría requerir ajustar tests o validadores de baseline.
- Un rerun hosted podría revelar un segundo fallo en `operational-smoke` no visible aún.
