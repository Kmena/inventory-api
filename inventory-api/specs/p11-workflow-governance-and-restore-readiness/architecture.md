# Solution Architecture

## 1. Architecture summary
La solución aprobable converge la gobernanza de workflows a un modelo root-only y corrige el smoke operacional conservando el gate de restore readiness sobre su implementación real existente. Además, armoniza el contrato documental para que el baseline operativo versionado sea coherente entre workflows, package scripts, tests y documentación.

```mermaid
flowchart LR
Root[/.github/workflows official source] --> Validators[workflow validators/tests]
Root --> Smoke[operational-smoke workflow]
Smoke --> NpmScript[package.json validate:restore-readiness]
NpmScript --> RestoreValidator[scripts/validate-restore-readiness.js]
RestoreValidator --> Docs[versioned restore-readiness docs]
Docs --> Tests[characterization tests]
```

## 2. Design goals
- Declarar un solo source of truth para workflows oficiales.
- Eliminar el riesgo de drift derivado de YAML duplicados.
- Restaurar la validez de `operational-smoke` sin debilitar el gate de restore readiness.
- Dejar documentación pública y validadores alineados.
- Mantener el cambio acotado a gobernanza/CI/scripts/docs/tests.

## 3. Proposed components
### 3.1 Root-only workflow governance
- Mantener `/.github/workflows/` como único árbol oficial de workflows.
- Retirar `inventory-api/.github/workflows/` del flujo normal del repositorio.
- Simplificar `validate-workflow-baseline.js` y tests relacionados para leer solo el árbol root oficial.

### 3.2 Restore readiness gate preservation
- Exponer `validate:restore-readiness` en `inventory-api/package.json` apuntando al script real `scripts/validate-restore-readiness.js`.
- Mantener el paso `Validate restore readiness evidence` en `operational-smoke`.
- Ajustar validadores/tests/documentación si actualmente describen una ruta documental incompatible con el baseline público versionado.

### 3.3 Documentation contract harmonization
La solución implementada por este spec es:
- usar `inventory-api/docs/` como baseline documental público versionado para restore readiness;
- crear `docs/restore-readiness-baseline.md` como artefacto canónico público;
- actualizar `scripts/validate-restore-readiness.js` y tests para validar ese contrato público versionado;
- dejar `internal-docs/` fuera del gate público obligatorio de restore readiness.

### 3.4 Residual split kept in the implemented state
- `scripts/validate-operational-readiness.js` también fue alineado a la ruta root `/.github/workflows/operational-smoke.yml`.
- Sin embargo, ese validador conserva un modelo distinto al de restore readiness: `internal-docs/` sigue siendo un overlay opcional y no bloqueante para la validación operacional más amplia.

## 4. Responsibilities
- **Root workflows:** definir la automatización oficial hospedada.
- **package.json:** publicar los comandos npm soportados por el baseline.
- **validate-workflow-baseline.js:** verificar contratos de workflows oficiales root.
- **validate-restore-readiness.js:** verificar que la evidencia mínima de restore readiness permanezca versionada y coherente.
- **Tests de caracterización:** evitar drift de gobernanza y documentación.
- **Docs/runbooks/specs:** describir el estado real implementado.

## 5. Proposed data flow
1. GitHub Actions ejecuta `/.github/workflows/operational-smoke.yml`.
2. El workflow usa `working-directory: inventory-api`.
3. `npm run validate:restore-readiness` se resuelve desde `package.json`.
4. Ese script ejecuta `scripts/validate-restore-readiness.js`.
5. El validador inspecciona artefactos versionados acordados por el spec.
6. Los tests de caracterización verifican el mismo contrato.

## 6. Domain changes
No hay cambios funcionales de dominio.

## 7. API changes
No se proponen cambios de API.

## 8. Database changes
No se requieren cambios de schema ni migraciones.

## 9. Validation and business rules
- El workflow baseline debe seguir pasando después de retirar el árbol duplicado.
- `operational-smoke` no puede depender de un script npm ausente.
- Si el gate de restore readiness se conserva, debe usar la implementación real ya presente.
- La documentación pública debe ser suficiente para describir el contrato versionado validado por el workflow obligatorio.

## 10. Error handling
- Si retirar `inventory-api/.github/workflows/` revela referencias residuales, se deben corregir explícitamente y con pruebas.
- Si la validación de restore readiness descubre docs incompletos, la implementación debe completarlos o documentar bloqueo; no debe crear un bypass silencioso.

## 11. Security
- No modifica el modelo de seguridad de la aplicación.
- Mejora la integridad de gobernanza al evitar workflows duplicados y contratos CI rotos.

## 12. Observability
- Mantener evidencia local de `validate:workflow-baseline` y tests de caracterización.
- Mantener evidencia hosted de `operational-smoke` y workflows root afectados.

## 13. Testing strategy
- `npm run validate:workflow-baseline`
- `node --test tests/workflow-baseline-characterization.test.js tests/prisma-windows-build-stabilization.test.js`
- `node --test tests/production-baseline-characterization.test.js tests/restore-readiness-characterization.test.js`
- `npm run validate:restore-readiness`
- `git diff --check`
- evidencia hosted mínima de `operational-smoke` y del workflow Windows si sus contratos se tocan indirectamente

## 14. Compatibility and migration
- Mantener `working-directory: inventory-api` en workflows root.
- No reabrir la discusión Node 24; este spec opera sobre el baseline ya migrado.
- Evitar cambiar nombres de workflows oficiales salvo necesidad justificada.

## 15. Alternatives considered
### A. Mantener los dos árboles de workflows y solo reforzar paridad
Rechazada: conserva deuda y dos fuentes activas de verdad.

### B. Quitar el paso `validate:restore-readiness` del workflow
Rechazada como opción preferida: ya existe implementación base del gate y docs que lo consideran parte del baseline operativo.

### C. Root-only workflows + exponer/armonizar el gate real de restore readiness
Aceptada e implementada.

## 16. Risks and trade-offs
- Cambiar validadores/tests de `internal-docs/` a `docs/` puede requerir crear artefactos públicos que hoy no existen.
- Eliminar el árbol duplicado puede exigir actualizar varias referencias textuales/documentales.
- Mantener el gate de restore readiness obliga a definir claramente qué artefactos son obligatorios y públicos.

## 17. Architecture decision
El spec `p11-workflow-governance-and-restore-readiness` convergerá la gobernanza de workflows al root oficial `/.github/workflows/`, retirará el árbol duplicado `inventory-api/.github/workflows/`, preservará el gate `validate:restore-readiness` exponiéndolo correctamente vía `package.json`, y armonizará documentación/validadores/tests para que el baseline operativo público y el smoke workflow describan el mismo contrato ejecutable.
