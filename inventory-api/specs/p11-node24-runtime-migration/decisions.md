# Decisions

## Accepted planning decisions
1. Este spec implementa el substream de migración real a Node.js 24 LTS derivado del P0-003 reconciliado por P11.
2. La migración debe mover coordinadamente `package.json`, `Dockerfile`, workflows y scripts/guidance relacionados.
3. El error `PrismaClient is not a constructor` observado bajo Node 24 es evidencia técnica obligatoria de este substream y no puede ignorarse.
4. El issue Windows Prisma `EPERM rename-lock` se considera baseline preexistente separado, salvo evidencia nueva en contra durante la implementación.
5. La validación mínima obligatoria debe cubrir install, build, lint, typecheck, tests, browser E2E cuando aplique, Docker build y smoke/validators aplicables.
6. Si la migración requiere actualizar dependencias, el cambio debe limitarse a compatibilidad Node 24 y quedar justificado explícitamente.
7. No se acepta un cierre basado solo en cambios declarativos de versión.
8. Este substream sigue siendo bloqueante antes de funcionalidades no relacionadas mientras el baseline Node 24 no quede validado o correctamente aislado.

## Migration priority rule
La prioridad principal de este substream es que la migración a Node.js 24 LTS no dañe ningún test, build, flujo CI, contrato externo ni comportamiento actual del repositorio.

## Implementation outcomes recorded
1. **Node 24 baseline alignment accepted:** `package.json`, `Dockerfile`, workflows y validadores quedaron alineados a Node 24.
2. **No dependency upgrade required:** no fue necesario actualizar `prisma` ni `@prisma/client`; el alcance se mantuvo en la opción menos invasiva aprobada.
3. **Prisma constructor issue isolated as non-reproducible on clean baseline:** tras `npm ci` + `npm run build` + reruns en Node `v24.16.0`, no se reprodujo `TypeError: PrismaClient is not a constructor`.
4. **Windows rename-lock remains baseline behavior:** el wrapper siguió manejando el `EPERM` conocido con cleanup + retry; no apareció una regresión Node 24 distinta.
5. **Hosted closure evidence completed:** el workflow oficial `windows-prisma-build` del root corrió exitosamente en Node 24 (`30281935398`, job `90030223669`) y quedó acompañado por runs exitosos de `static-checks`, `db-constraints-tests`, `contract-validations`, `repository-tests` y `browser-e2e`.
6. **Official workflow location clarified:** GitHub Actions hospedado toma como fuente oficial `/.github/workflows/`; las copias en `inventory-api/.github/workflows/` permanecen como fixtures de validación local hasta nueva decisión aprobada.

## Resolved open questions
### OQ-001
**Question:** ¿Será suficiente actualizar Prisma a una versión compatible con Node 24 o habrá que ajustar también bootstrap/import patterns en `src/lib/prisma.js` y scripts relacionados?
**Decision implemented:** no fue necesario ninguno de los dos cambios en este ciclo.
**Reason:** la falla histórica no se reprodujo en un baseline limpio Node 24.

### OQ-002
**Question:** ¿El workflow Windows deberá mantenerse como evidencia separada aun si el rename-lock sigue siendo un baseline conocido bajo Node 24?
**Decision:** Sí, se mantiene separado.
**Reason:** sigue siendo la manera correcta de distinguir el `EPERM rename-lock` histórico de regresiones nuevas.

### OQ-003
**Question:** ¿La validación browser E2E bajo Node 24 requerirá cambios de Playwright/dependencias o solo reejecución sobre el nuevo runtime?
**Decision implemented:** solo requirió reejecución sobre el nuevo runtime.
**Evidence:** `npm run test:e2e:browser` pasó sin cambios adicionales de dependencias.

## Rejected alternatives
- Actualizar solo `engines.node` sin tocar Docker y workflows.
- Forzar upgrades de Prisma sin necesidad reproducible.
- Declarar el substream como si el source-of-truth de workflows siguiera dentro de `inventory-api/.github/workflows/` cuando el path oficial hospedado ya es `/.github/workflows/`.
