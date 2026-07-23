# Implementation Tasks
## TASK-001: Obtener diff real de payment.repository.js
**Status:** Completed
**Completed at:** 2026-07-22
**Implemented files:**
- `specs/p7-mixed-provenance-fix/payment-repository-diff.md`
- `specs/p7-mixed-provenance-fix/implementation-report.md`
- `specs/p7-mixed-provenance-fix/tasks.md`
- `specs/p7-mixed-provenance-fix/traceability.md`
**Validation evidence:**
- `git diff -- inventory-api/src/repositories/payment.repository.js`
- manual diff review
**Objective:** Capturar el diff línea por línea del archivo mixto.
**Affected areas:**
- `inventory-api/src/repositories/payment.repository.js`
**Dependencies:**
- None
**Implementation notes:**
- No decidir sin diff real.
**Tests:**
- Revisión manual del diff
**Acceptance criteria:**
- [ ] Existe diff documentado del archivo.
- [ ] El diff cubre todo el cambio pendiente.
- [ ] No hay bloques sin revisar.

## TASK-002: Clasificar bloques por procedencia P6/P7
**Status:** Completed
**Completed at:** 2026-07-22
**Implemented files:**
- `specs/p7-mixed-provenance-fix/payment-repository-diff.md`
- `specs/p7-mixed-provenance-fix/implementation-report.md`
- `specs/p7-mixed-provenance-fix/tasks.md`
- `specs/p7-mixed-provenance-fix/traceability.md`
**Validation evidence:**
- review of `specs/p7-mixed-provenance-fix/payment-repository-diff.md`
- manual provenance review of the real diff
**Objective:** Etiquetar cada bloque como P6, P7 o compartido.
**Affected areas:**
- `inventory-api/src/repositories/payment.repository.js`
- `specs/p7-mixed-provenance-fix/*`
**Dependencies:**
- TASK-001
**Implementation notes:**
- Documentar dependencias cruzadas.
**Tests:**
- Revisión documental
**Acceptance criteria:**
- [ ] Cada bloque tiene procedencia.
- [ ] Los bloques compartidos están justificados.
- [ ] La clasificación es auditable.

## TASK-003: Resolver el batch mixed provenance
**Status:** Completed
**Completed at:** 2026-07-22
**Implemented files:**
- `specs/p7-mixed-provenance-fix/payment-repository-diff.md`
- `specs/p7-mixed-provenance-fix/implementation-report.md`
- `specs/p7-mixed-provenance-fix/tasks.md`
- `specs/p7-mixed-provenance-fix/traceability.md`
- `specs/p7-drift-fix/drift-inventory.md`
**Validation evidence:**
- `node --test tests/payment-receipt-security.test.js`
- `node --test tests/payment-lifecycle-schema-characterization.test.js`
- `npm run lint`
- `npm run typecheck`
**Objective:** Decidir y ejecutar la resolución segura del archivo.
**Affected areas:**
- `inventory-api/src/repositories/payment.repository.js`
- spec de destino correspondiente
**Dependencies:**
- TASK-002
**Implementation notes:**
- Elegir separación, aceptación compuesta o revert parcial.
**Tests:**
- `inventory-api/tests/payment-receipt-security.test.js`
- `inventory-api/tests/throttle-behavior.test.js`
- `inventory-api/tests/payment-lifecycle-schema-characterization.test.js`
**Acceptance criteria:**
- [ ] El archivo deja de estar bloqueado como mixed provenance.
- [ ] La decisión tiene validación asociada.
- [ ] La resolución no mezcla alcance sin justificación.

## TASK-004: Consolidar evidencia final
**Status:** Completed
**Completed at:** 2026-07-22
**Implemented files:**
- `specs/p7-mixed-provenance-fix/current-state.md`
- `specs/p7-mixed-provenance-fix/payment-repository-diff.md`
- `specs/p7-mixed-provenance-fix/implementation-report.md`
- `specs/p7-mixed-provenance-fix/tasks.md`
- `specs/p7-mixed-provenance-fix/traceability.md`
- `specs/p7-drift-fix/drift-inventory.md`
**Validation evidence:**
- final documentation review
- `git status --short`
**Objective:** Actualizar trazabilidad y estado final del archivo.
**Affected areas:**
- `specs/p7-mixed-provenance-fix/*`
- `specs/p7-drift-fix/*`
**Dependencies:**
- TASK-003
**Implementation notes:**
- Reflejar la resolución exacta.
**Tests:**
- Revisión final
**Acceptance criteria:**
- [ ] La evidencia final es clara.
- [ ] Otro agente puede verificar la resolución sin reinterpretar el caso.
- [ ] La trazabilidad queda restaurada.
