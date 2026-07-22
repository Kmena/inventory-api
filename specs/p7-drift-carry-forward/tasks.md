# Implementation Tasks
## TASK-001: Reconfirmar inventario P7-linked
**Status:** Completed
**Completed at:** 2026-07-22
**Implemented files:**
- `specs/p7-drift-carry-forward/p7-linked-inventory.md`
- `specs/p7-drift-carry-forward/implementation-report.md`
- `specs/p7-drift-carry-forward/tasks.md`
- `specs/p7-drift-carry-forward/traceability.md`
**Validation evidence:**
- `git diff --name-only -- <p7 files>`
- `git diff --stat -- <p7 files>`
- `git status --short`
**Objective:** Verificar que el conjunto P7 separado por `p7-drift-fix` sigue siendo correcto.
**Affected areas:**
- archivos P7-linked
- `specs/p7-drift-fix/drift-inventory.md`
**Dependencies:**
- None
**Tests:**
- Revisión manual
**Acceptance criteria:**
- [ ] El inventario P7 quedó reconfirmado.
- [ ] Los archivos que no correspondan se detectaron.
- [ ] El lote no absorbe alcance ajeno.

## TASK-002: Resolver sublote runtime cliente/pagos
**Status:** Completed
**Completed at:** 2026-07-22
**Implemented files:**
- `specs/p7-drift-carry-forward/p7-validation-summary.md`
- `specs/p7-drift-carry-forward/implementation-report.md`
- `specs/p7-drift-carry-forward/tasks.md`
- `specs/p7-drift-carry-forward/traceability.md`
**Validation evidence:**
- `node --test tests/client-document-governance.test.js`
- `node --test tests/client-document-security.test.js`
- `node --test tests/payment-receipt-security.test.js`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
**Objective:** Cerrar o revertir el drift runtime/tests ligado a cliente y pagos.
**Affected areas:**
- `inventory-api/src/repositories/client.repository.js`
- `inventory-api/src/services/client.service.js`
- `inventory-api/src/services/payment-receipt-evidence.service.js`
- `inventory-api/src/services/payment.service.js`
- tests cliente/pagos relacionados
**Dependencies:**
- TASK-001
**Tests:**
- `inventory-api/tests/client-document-governance.test.js`
- `inventory-api/tests/client-document-security.test.js`
- `inventory-api/tests/payment-receipt-security.test.js`
**Acceptance criteria:**
- [ ] El sublote runtime quedó validado.
- [ ] Cada archivo tiene decisión final.
- [ ] No se introdujo mezcla con P6 ni con mixed provenance no resuelto.

## TASK-003: Resolver sublote RawUnsafe no runtime
**Status:** Completed
**Completed at:** 2026-07-22
**Implemented files:**
- `specs/p7-drift-carry-forward/p7-validation-summary.md`
- `specs/p7-drift-carry-forward/implementation-report.md`
- `specs/p7-drift-carry-forward/tasks.md`
- `specs/p7-drift-carry-forward/traceability.md`
**Validation evidence:**
- `node --test tests/p2-hardening-constraints.test.js` *(expected env-gated skip)*
- `node --test tests/rawunsafe-inventory-governance.test.js`
- `npm run lint`
- `npm run typecheck`
**Objective:** Cerrar o revertir el drift de scripts/docs/tests RawUnsafe ligado a P7.
**Affected areas:**
- `inventory-api/prisma/migration-instructions.md`
- `inventory-api/scripts/apply-committed-migrations.js`
- `inventory-api/scripts/diagnose-hardening-constraints.js`
- `inventory-api/tests/p2-hardening-constraints.test.js`
- `inventory-api/tests/rawunsafe-inventory-governance.test.js`
- `specs/p7-9-5-risk-closure/rawunsafe-inventory.md`
**Dependencies:**
- TASK-001
**Tests:**
- suites RawUnsafe relevantes
- lint/typecheck
**Acceptance criteria:**
- [ ] El sublote RawUnsafe quedó validado.
- [ ] No quedan cambios sin estado claro.
- [ ] La documentación distingue remediación vs aceptación.

## TASK-004: Resolver sublote evidencia final P7
**Status:** Completed
**Completed at:** 2026-07-22
**Implemented files:**
- `specs/p7-drift-carry-forward/p7-validation-summary.md`
- `specs/p7-drift-carry-forward/implementation-report.md`
- `specs/p7-drift-carry-forward/tasks.md`
- `specs/p7-drift-carry-forward/traceability.md`
**Validation evidence:**
- `node --test tests/p7-risk-closure-evidence.test.js`
- `npm run test -- --silent`
**Objective:** Actualizar documentación y evidencia final del cierre P7.
**Affected areas:**
- `inventory-api/docs/p7-risk-closure-evidence.md`
- `specs/p7-final-closure/*`
- tests/evidencia relacionados
**Dependencies:**
- TASK-002
- TASK-003
**Tests:**
- `inventory-api/tests/p7-risk-closure-evidence.test.js`
- revisión documental
**Acceptance criteria:**
- [ ] La evidencia final refleja el estado real del lote.
- [ ] Otro revisor puede distinguir claramente qué se cerró.
- [ ] No se sobreafirman cierres no validados.

## TASK-005: Consolidar cierre del carry-forward P7
**Status:** Completed
**Completed at:** 2026-07-22
**Implemented files:**
- `specs/p7-drift-carry-forward/current-state.md`
- `specs/p7-drift-carry-forward/p7-linked-inventory.md`
- `specs/p7-drift-carry-forward/p7-validation-summary.md`
- `specs/p7-drift-carry-forward/implementation-report.md`
- `specs/p7-drift-carry-forward/tasks.md`
- `specs/p7-drift-carry-forward/traceability.md`
- `specs/p7-drift-fix/drift-inventory.md`
**Validation evidence:**
- final documentation review
- `git status --short`
**Objective:** Dejar evidencia final del lote P7 y su relación con `p7-drift-fix`.
**Affected areas:**
- `specs/p7-drift-carry-forward/*`
- `specs/p7-final-closure/*`
- `specs/p7-drift-fix/*`
**Dependencies:**
- TASK-004
**Tests:**
- rerun final relevante
- revisión final
**Acceptance criteria:**
- [ ] El cierre P7 carry-forward quedó documentado.
- [ ] La trazabilidad entre drift y final closure es clara.
- [ ] El lote deja de estar pendiente o queda reducido a excepciones explícitas.
