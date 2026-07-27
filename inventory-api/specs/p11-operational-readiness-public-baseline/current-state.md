# Current State Analysis

## 1. System overview
El repositorio ya convergió a root-only workflow governance y ya reparó `validate:restore-readiness` sobre artefactos públicos en `docs/`. Sin embargo, `validate:operational-readiness` todavía depende de overlays opcionales `internal-docs/` para considerar presente su baseline de documentación operativa.

## 2. Relevant repository structure
- `inventory-api/scripts/validate-operational-readiness.js`
- `inventory-api/scripts/validate-restore-readiness.js`
- `inventory-api/docs/production-baseline.md`
- `inventory-api/docs/production-operations-runbook.md`
- `inventory-api/docs/restore-readiness-baseline.md`
- `inventory-api/.env.production.example`
- `/.github/workflows/operational-smoke.yml`
- `inventory-api/tests/production-baseline-characterization.test.js`
- `inventory-api/tests/restore-readiness-characterization.test.js`

## 3. Current implemented behavior
### 3.1 Operational readiness validator
- `validate-operational-readiness.js` still checks `internal-docs/production-operations-runbook.md` and `internal-docs/production-baseline.md`.
- When those artifacts are absent, the validator can skip rather than proving a fully public baseline.

### 3.2 Public restore-readiness baseline
- `validate:restore-readiness` already validates public `docs/production-baseline.md`, `docs/production-operations-runbook.md`, and `docs/restore-readiness-baseline.md`.
- This means the repository currently uses two different models for two related operational validators.

### 3.3 `.env.production.example`
- Repository inspection confirms `inventory-api/.env.production.example` exists.
- Public docs and README reference `.env.production.example` as the starting point for the production baseline flow.
- The auditor still raised a documentation/evidence concern, so the repository would benefit from making this contract more explicit and testable.

## 4. Current limitations
- Public operational-readiness is not yet fully self-contained because validator logic still depends on optional private overlays.
- The existence of `.env.production.example` is real, but its contractual role could be strengthened in validation or characterization to avoid future audit ambiguity.

## 5. Risks in current state
- Future maintainers may assume operational readiness is as public and reproducible as restore readiness when the validator still has different semantics.
- Audits may continue to raise false or stale concerns about `.env.production.example` if the repository does not codify its presence in the validated contract.

## 6. Likely affected files
- `inventory-api/scripts/validate-operational-readiness.js`
- `inventory-api/tests/production-baseline-characterization.test.js`
- `inventory-api/docs/production-baseline.md`
- `inventory-api/docs/production-operations-runbook.md`
- `inventory-api/README.md`
- potentially a new public operational-readiness baseline doc if needed
