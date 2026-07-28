# Current State Analysis

## 1. System overview
Después del cierre de `p11-node24-runtime-migration`, el baseline oficial de CI vive en `/.github/workflows/`. Tras `TASK-001`, el árbol duplicado `inventory-api/.github/workflows/` fue retirado y la gobernanza local ahora lee directamente el mismo árbol oficial del root que ejecuta GitHub Actions hospedado.

En paralelo, el workflow oficial `operational-smoke` ya quedó reconciliado con `package.json`: el comando `npm run validate:restore-readiness` ahora existe y ejecuta el validador real de restore readiness.

## 2. Relevant repository structure
- Workflows oficiales hospedados: `/.github/workflows/*.yml`
- Scripts de validación local: `inventory-api/scripts/validate-workflow-baseline.js`
- Script real de restore readiness: `inventory-api/scripts/validate-restore-readiness.js`
- Package scripts: `inventory-api/package.json`
- Runbooks/docs operativos: `inventory-api/docs/production-baseline.md`, `inventory-api/docs/production-operations-runbook.md`, `inventory-api/docs/restore-readiness-baseline.md`
- Tests de gobernanza/operaciones: `inventory-api/tests/workflow-baseline-characterization.test.js`, `inventory-api/tests/production-baseline-characterization.test.js`, `inventory-api/tests/restore-readiness-characterization.test.js`

## 3. Current implemented behavior
### 3.1 Workflow source of truth
- GitHub Actions hospedado ejecuta los archivos del root `/.github/workflows/`.
- Los validadores/tests de workflows ya leen el root oficial directamente.
- Ya no queda un árbol YAML duplicado activo dentro de `inventory-api/.github/workflows/`.

### 3.2 Operational smoke contract after repair
- `/.github/workflows/operational-smoke.yml` contiene el paso `npm run validate:restore-readiness`.
- `inventory-api/package.json` ahora contiene el script `validate:restore-readiness`.
- Resultado: el contrato local ya no falla con `Missing script: "validate:restore-readiness"`.

### 3.3 Restore readiness contract after repair
- `inventory-api/scripts/validate-restore-readiness.js` valida ahora artefactos públicos bajo `docs/production-operations-runbook.md`, `docs/production-baseline.md` y `docs/restore-readiness-baseline.md`.
- `inventory-api/docs/restore-readiness-baseline.md` fue creado como baseline público canónico.
- `inventory-api/package.json` expone `validate:restore-readiness` como comando npm soportado.
- Los tests de restore readiness y production baseline ahora caracterizan ese mismo contrato público versionado.

### 3.4 Residual operational-readiness split
- `inventory-api/scripts/validate-operational-readiness.js` ya sigue la ruta root de `/.github/workflows/operational-smoke.yml`.
- Aun así, ese validador conserva un modelo distinto: usa overlays opcionales `internal-docs/production-operations-runbook.md` e `internal-docs/production-baseline.md` cuando existen, y puede hacer skip en modo repo público.

## 4. Existing validation evidence and failures
### 4.1 Confirmed original failure
- Hosted failure observed by the user in `operational-smoke`: `Missing script: "validate:restore-readiness"`.

### 4.2 Confirmed supporting evidence
- `inventory-api/scripts/validate-restore-readiness.js` exists and is now exposed through `package.json`.
- `inventory-api/tests/workflow-baseline-characterization.test.js` expects `operational-smoke.yml` to keep the `npm run validate:restore-readiness` step.
- `inventory-api/docs/production-operations-runbook.md`, `inventory-api/docs/production-baseline.md`, and `inventory-api/docs/restore-readiness-baseline.md` now define the public baseline used by that validator.

## 5. Repository drift relevant to this spec
- Drift A was resolved by TASK-001: workflow governance now uses the root-only official workflow tree.
- Drift B was resolved by exposing `validate:restore-readiness` in `package.json`.
- Drift C was resolved by aligning the validator/tests to the public `docs/` artifacts.
- Drift D: the mandatory coding-standard path named by the implementation workflow is `docs/coding_standard.md`, but the repository currently exposes `docs/coding-standards.md`.
- Drift E remains intentionally unresolved in this spec: broader `validate:operational-readiness` still uses optional `internal-docs` overlays.

## 6. Risks in the current state
- Future workflow edits still require docs/tests synchronization around the root official workflow tree, but no longer risk dual-tree YAML drift.
- Hosted `operational-smoke` still needs a new run to confirm that no second independent defect remains after the missing-script repair.
- Operational readiness outside the restore slice still mixes public docs and optional `internal-docs` overlays.

## 7. Files most likely affected
- `/.github/workflows/operational-smoke.yml`
- `inventory-api/package.json`
- `inventory-api/scripts/validate-workflow-baseline.js`
- `inventory-api/scripts/validate-restore-readiness.js`
- `inventory-api/tests/workflow-baseline-characterization.test.js`
- `inventory-api/tests/production-baseline-characterization.test.js`
- `inventory-api/tests/restore-readiness-characterization.test.js`
- `inventory-api/docs/production-baseline.md`
- `inventory-api/docs/production-operations-runbook.md`
- `inventory-api/docs/restore-readiness-baseline.md` (likely create)
- `inventory-api/docs/current-state.md`
- `inventory-api/docs/architecture.md`
- `inventory-api/docs/action-plan.md`
- `inventory-api/docs/tasks.md`
