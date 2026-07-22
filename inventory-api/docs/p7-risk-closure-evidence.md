# P7 Risk Closure Evidence

## Objetivo
Este documento centraliza la evidencia versionada del cierre P7 para revisión humana y futura re-auditoría. Resume qué riesgos quedaron cerrados, qué artefactos gobiernan el comportamiento actual y qué riesgos siguen abiertos de forma explícita.

## Alcance cerrado en P7
### 1. SQL raw runtime hardening
Cerrado para runtime productivo bajo `src/`.

Evidencia principal:
- `specs/p7-9-5-risk-closure/rawunsafe-inventory.md`
- `specs/p7-9-5-risk-closure/rawunsafe-remediation-strategy.md`
- `src/lib/throttle-store.js`
- `src/services/inventory.service.js`
- `tests/rawunsafe-inventory-governance.test.js`
- `tests/throttle-store.test.js`
- `tests/lot-datetime-characterization.test.js`

Estado factual:
- ya no quedan usos libres de `RawUnsafe` en `inventory-api/src/`;
- las excepciones runtime restantes usan SQL parametrizado gobernado o helper de SQL fijo;
- scripts, documentación de migraciones y ciertos tests siguen inventariados como deuda aceptada fuera del umbral obligatorio de remediación de esta fase.

### 2. Partial failures DB/filesystem
Caracterización automatizada cerrada para documentos privados de cliente y comprobantes privados de pago.

Evidencia principal:
- `tests/client-document-security.test.js`
- `tests/payment-receipt-security.test.js`

Estado factual:
- los caminos de rollback/cleanup críticos están caracterizados;
- defectos residuales preservados quedaron explícitos y probados, no ocultos.

### 3. Heavy-endpoint governance
Baseline inicial y detección de drift cerrados para el conjunto priorizado aprobado.

Artefactos:
- `docs/heavy-endpoints-baseline.json`
- `docs/heavy-endpoints-baseline.md`
- `src/lib/heavy-endpoint-governance.js`
- `src/middlewares/heavy-endpoint-metrics.js`
- `tests/heavy-endpoint-governance.test.js`
- `tests/logging.test.js`

Set priorizado gobernado:
- `GET /api/agent/stores`
- `GET /api/agent/stores/:storeId`
- `GET /api/clients`
- `GET /api/clients/company`
- `GET /api/invoices/inconsistencies`
- `GET /api/inventory/stocks`
- `GET /api/payments`
- `POST /api/products/import`

Estado factual:
- la primera fase es representativa y orientada a drift detection;
- no impone budgets rígidos ni requiere APM externo;
- el logging solo registra métricas agregadas no sensibles.

### 4. Contract scope governance
El runtime montado y el OpenAPI parcial ya quedaron formalmente clasificados.

Artefactos:
- `docs/openapi/runtime-baseline.openapi.json`
- `docs/runtime-contract-manifest.json`
- `docs/runtime-endpoint-catalog.md`
- `tests/openapi-contract-consistency.test.js`
- `tests/runtime-contract-governance.test.js`

Estado factual:
- OpenAPI sigue siendo parcial y factual;
- toda operación montada en routers debe quedar cubierta por OpenAPI o listada explícitamente como exclusión intencional;
- `express.static(src/public)` se gobierna fuera de OpenAPI mediante documentación y pruebas HTTP/browser.

## Riesgos aún abiertos o aceptados
### Riesgos preservados explícitamente
- `RawUnsafe` sigue presente en superficies no runtime priorizadas:
  - `scripts/*`
  - `tests/p2-hardening-constraints.test.js`
  - `prisma/migration-instructions.md`
- flujo de documentos privados de cliente:
  - si el archivo se persiste y falla el update final de DB, puede quedar archivo privado + registro pendiente; este comportamiento está caracterizado, no corregido en esta fase.
- flujo de comprobantes de pago:
  - si falla el cleanup del pago tras error posterior de evidencia, el defecto actual queda visible y probado;
  - si falla el cleanup best-effort del archivo, puede quedar huérfano privado residual aceptado.
- baseline de endpoints pesados:
  - sigue siendo representativa, no producción-capturada.
- guard contractual del runtime:
  - depende de descubrimiento por regex sobre `src/app.js` y `src/routes/*.routes.js`.

## Validación reproducible
Desde `inventory-api/`:

### Validación mínima P7
```bash
node --test tests/rawunsafe-inventory-governance.test.js
node --test tests/client-document-security.test.js tests/payment-receipt-security.test.js
node --test tests/heavy-endpoint-governance.test.js tests/logging.test.js
node --test tests/openapi-contract-consistency.test.js tests/runtime-contract-governance.test.js
npm run lint
npm run typecheck
npm run build
npm run test -- --silent
```

### Interpretación de los 2 skips actuales
La suite completa puede terminar con `2 skipped` sin implicar regresión de P7.

Los skips esperados son environment-gated:
- `tests/p2-hardening-constraints.test.js`
  - requiere `P2_CONSTRAINTS_DATABASE_URL`
- `tests/audit-repository.test.js`
  - requiere `P2_AUDIT_DATABASE_URL`

Sin esas variables, la suite sigue siendo válida para el baseline general del repositorio y para la evidencia P7 cerrada en esta fase.

## Trazabilidad
Especificación canónica:
- `../specs/p7-9-5-risk-closure/metadata.yaml`
- `../specs/p7-9-5-risk-closure/requirements.md`
- `../specs/p7-9-5-risk-closure/tasks.md`
- `../specs/p7-9-5-risk-closure/traceability.md`
- `../specs/p7-9-5-risk-closure/implementation-report.md`

## Lectura recomendada para auditoría
1. `docs/p7-risk-closure-evidence.md`
2. `specs/p7-9-5-risk-closure/implementation-report.md`
3. `docs/heavy-endpoints-baseline.md`
4. `docs/runtime-endpoint-catalog.md`
5. `docs/runtime-contract-manifest.json`
