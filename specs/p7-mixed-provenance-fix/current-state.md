# Current State Analysis
## 1. System overview
`specs/p7-drift-fix/drift-inventory.md` documenta que `inventory-api/src/repositories/payment.repository.js` quedó aislado como `BATCH-MIXED-PROVENANCE`.

## 2. Relevant repository structure
- `specs/p7-drift-fix/drift-inventory.md`
- `specs/p6-audit-excellence-program/*`
- `specs/p7-final-closure/*`
- `inventory-api/src/repositories/payment.repository.js`
- `inventory-api/tests/payment-receipt-security.test.js`
- `inventory-api/tests/throttle-behavior.test.js`
- `inventory-api/tests/payment-lifecycle-schema-characterization.test.js`

## 3. Current components
### Confirmed behavior
- `payment.repository.js` aparece como archivo runtime modificado en el snapshot git congelado por `p7-drift-fix`.
- El diff real revisado en esta spec muestra solo dos cambios lógicos: creación de `reservePaymentId()` y su export.
- La procedencia mixta quedó resuelta: el diff pendiente es atribuible a `specs/p7-final-closure`, no a una mezcla real P6/P7.

### Missing information
- No queda una brecha de procedencia para este archivo en el diff actual.
- El trabajo pendiente ya no es de clasificación, sino de arrastre limpio dentro del batch P7 correspondiente.

## 4. Current data flow
P7-drift-fix -> detecta archivo mixed provenance -> lo retiene fuera de P6/P7 -> requiere revisión dedicada antes de mezclar.

## 5. Current domain model
- Procedencia P6: probable soporte de schema/throttling o acoplamientos de lifecycle ya trazados en P6.
- Procedencia P7: probable soporte de payment-receipt residual closure.
- Estado actual: bloqueo de mezcla por procedencia cruzada no resuelta.

## 6. Current APIs or interfaces
No se propone API nueva. El archivo es un repositorio interno de persistencia.

## 7. Current database behavior
**Inferido:** el archivo puede tocar consultas o persistencia relacionadas con lifecycle de pagos y/o soporte de throttling/documentación de esquema.

## 8. Existing tests
- `inventory-api/tests/payment-receipt-security.test.js`
- `inventory-api/tests/throttle-behavior.test.js`
- `inventory-api/tests/payment-lifecycle-schema-characterization.test.js`

## 9. Current limitations
- Esta spec resolvió la duda de procedencia, pero no cierra por sí sola el arrastre completo del batch P7 al que pertenece el archivo.
- La resolución depende de que los documentos aguas arriba (`p7-drift-fix` y el carry-forward P7) permanezcan consistentes.

## 10. Technical debt related to the change
- La clasificación mixed-provenance previa fue conservadora pero inexacta; el repositorio aún requiere que el carry-forward P7 absorba formalmente este archivo ya reclassificado.

## 11. Risks
- Revertir mal una parte puede romper P6 o P7.
- Mezclarlo sin separación puede contaminar auditoría.

## 12. Relevant files
- `specs/p7-drift-fix/drift-inventory.md`
- `inventory-api/src/repositories/payment.repository.js`
- `inventory-api/tests/payment-receipt-security.test.js`
- `inventory-api/tests/throttle-behavior.test.js`
- `inventory-api/tests/payment-lifecycle-schema-characterization.test.js`
