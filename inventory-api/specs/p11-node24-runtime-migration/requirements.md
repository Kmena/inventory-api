# User Requirements
## 1. Overview
Implementar un substream aprobado de P11 para migrar el baseline real del repositorio desde Node 20 a Node.js 24 LTS, validando la compatibilidad completa del runtime, Prisma, Docker, scripts y GitHub Actions, y resolviendo o aislando correctamente los problemas detectados durante la validación previa.

## 2. Business objective
Alinear el baseline del repositorio con Node.js 24 LTS de forma controlada, con evidencia verificable de compatibilidad operativa y de CI, evitando que la migración quede en un cambio meramente documental de versión.

## 3. User problem
P11 ya reconciliado confirmó que:
- el baseline implementado sigue anclado a Node 20 (`package.json`, `Dockerfile`, workflows);
- una rerun posterior bajo host Node.js 24 falló en `tests/taxpayer-characterization.test.js` con `TypeError: PrismaClient is not a constructor` y traza desde `src/lib/prisma.js`;
- existe además un problema preexistente y separado de Prisma build en Windows (`EPERM` rename-lock) que no debe confundirse con los fallos nuevos de la migración Node 24.

## 4. Actors
- Equipo backend
- Maintainer de plataforma / CI
- Revisor de arquitectura
- QA / reviewer de evidencia
- SDD Implementation Agent

## 5. Functional requirements
### FR-001 La especificación debe usar `specs/p11-audit-emergency-hardening` como fuente principal aprobada para el finding reconciliado P0-003 y no rehacer P11 general.
### FR-002 La especificación debe inspeccionar el baseline actual en `package.json`, `Dockerfile`, `.github/workflows/*.yml`, `src/lib/prisma.js` y scripts de Prisma/build relacionados.
### FR-003 La solución debe definir la actualización de `package.json -> engines.node` al baseline objetivo de Node.js 24 LTS.
### FR-004 La solución debe definir la actualización de `Dockerfile` a imagen base compatible con Node.js 24 LTS.
### FR-005 La solución debe definir la actualización de todos los workflows GitHub Actions relevantes que hoy fijan Node 20.
### FR-006 La solución debe contemplar ajustes en scripts/builds relevantes si la migración Node 24 revela incompatibilidades de Prisma, CommonJS, tooling o validadores.
### FR-007 La especificación debe incorporar explícitamente la evidencia observada de fallo en `tests/taxpayer-characterization.test.js` bajo Node.js 24 con `TypeError: PrismaClient is not a constructor` desde `src/lib/prisma.js`.
### FR-008 La solución debe diferenciar claramente entre el fallo preexistente Windows Prisma `EPERM rename-lock` y los fallos nuevos asociados a la migración Node 24.
### FR-009 La especificación debe definir una validación mínima obligatoria bajo Node 24 que incluya install, build, lint, typecheck, tests, browser E2E cuando aplique, Docker build y smoke/health checks cuando aplique.
### FR-010 La solución no debe asumir que el cambio es solo de versión; debe contemplar compatibilidad real de Prisma, tooling, CommonJS, scripts y CI.
### FR-011 La solución debe mantener el comportamiento externo del sistema salvo ajuste técnico necesario y aprobado.
### FR-012 La especificación debe documentar rollback o plan de recuperación si Node 24 rompe parte del baseline.
### FR-013 Si la migración requiere actualizar dependencias, el alcance debe quedar delimitado y justificado, no abierto sin control.
### FR-014 La especificación debe enumerar los archivos esperados a tocar.
### FR-015 La especificación debe dejar trazabilidad explícita al P0-003 reconciliado por P11.
### FR-016 La especificación debe mantener este substream como trabajo bloqueante antes de funcionalidades no relacionadas mientras el baseline Node 24 no quede validado o correctamente aislado.

## 6. Non-functional requirements
### NFR-001 La migración debe planificarse de forma incremental y verificable por etapas.
### NFR-002 La solución debe minimizar cambios innecesarios de arquitectura o contratos públicos.
### NFR-003 La evidencia de validación debe ser reproducible en plataformas relevantes cuando aplique.
### NFR-004 Los cambios de dependencias deben limitarse a lo estrictamente necesario para compatibilidad Node 24.
### NFR-005 La documentación final debe permitir a otro agente ejecutar la migración sin redescubrir el problema.
### NFR-006 La migración a Node.js 24 LTS no debe degradar el comportamiento actual del repositorio, incluyendo build, tests, CI, runtime y contratos externos existentes.

## 7. Business rules
### BR-001 Un cambio de versión sin validación real de runtime, build y CI no cierra este substream.
### BR-002 El fallo Windows Prisma `EPERM rename-lock` debe tratarse como baseline preexistente hasta que la implementación pruebe lo contrario.
### BR-003 Cualquier incompatibilidad nueva observada bajo Node 24 debe registrarse como regresión de migración o aislarse explícitamente.
### BR-004 El baseline externo del sistema debe preservarse salvo ajuste técnico mínimo y justificado.
### BR-005 Este substream sigue alineado al programa P11 y permanece bloqueante antes de trabajo funcional no relacionado.

## 8. Acceptance criteria
### AC-001 Given el baseline actual en Node 20 When se implemente este spec Then `package.json`, `Dockerfile` y workflows relevantes quedan alineados con Node.js 24 LTS.
### AC-002 Given la evidencia del fallo `PrismaClient is not a constructor` bajo Node.js 24 When se cierre este substream Then el problema queda resuelto técnicamente o aislado con una excepción/aprobación explícita que impida considerarlo cierre falso.
### AC-003 Given la coexistencia de problemas Prisma distintos When se documente la migración Then queda separada la evidencia del baseline Windows `EPERM rename-lock` frente a regresiones nuevas de Node 24.
### AC-004 Given la migración a Node.js 24 LTS When se valide el baseline Then existen resultados verificables para install, build, lint, typecheck, tests, browser E2E cuando aplique, Docker build y smoke/health checks cuando aplique.
### AC-005 Given la implementación de la migración When se revise el alcance Then cualquier actualización de dependencias queda delimitada y justificada.
### AC-006 Given una regresión crítica durante la migración When se revise el plan Then existe rollback o plan de recuperación explícito.
### AC-007 Given la revisión final del spec When se inspeccione la trazabilidad Then el trabajo queda enlazado explícitamente al finding P0-003 reconciliado por P11.
### AC-008 Given la migración a Node.js 24 LTS When se cierre este substream Then no existen regresiones no aprobadas en tests, build, runtime, CI ni comportamiento externo respecto del baseline Node 20.

## 9. Constraints
- No rehacer el spec P11 general.
- No asumir compatibilidad Node 24 sin evidencia.
- No mezclar este substream con tenant isolation, boundary hardening o typecheck/CI más allá de la trazabilidad necesaria.
- No abrir upgrades de dependencias sin acotar su motivo y alcance.
- No cambiar contratos externos salvo necesidad técnica justificada.

## 10. Assumptions
- La base actual en Node 20 es funcional en Linux CI y baseline Docker actual, salvo el issue Windows Prisma ya conocido.
- El problema `PrismaClient is not a constructor` puede requerir ajustar dependencia Prisma, bootstrap de importación CommonJS o script de generación, pero debe confirmarse durante implementación.
- Los workflows actuales seguirán siendo la base de validación, ajustando su runtime Node.

## 11. Open questions
- Ninguna abierta por ahora. El usuario aprobó resolverlas con estas reglas y decisiones de implementación:
  - Se prioriza la **opción menos invasiva** que permita Node 24 sin romper tests, build, runtime, CI ni comportamiento actual.
  - Para la incompatibilidad `PrismaClient is not a constructor`, primero se intentará compatibilidad/regeneración o upgrade mínimo de Prisma; solo si eso no basta se ajustará `src/lib/prisma.js` o el patrón CommonJS relacionado.
  - El workflow Windows debe **mantenerse separado** para distinguir el baseline histórico `EPERM rename-lock` de regresiones nuevas de Node 24.
  - Browser E2E se resolverá primero por **reejecución simple** en Node 24; solo si falla se permitirán ajustes mínimos y justificados de Playwright o tooling auxiliar.
  - Ninguna alternativa se considerará aceptable si daña tests, código actual o comportamiento externo sin aprobación explícita.

## 12. Out of scope
- Rediseño de arquitectura de aplicación.
- Cierre de hallazgos tenant-isolation o repository-boundary.
- Expansión general de typecheck/CI fuera de este substream específico.
- Cambio de plataforma CI distinto de GitHub Actions.
