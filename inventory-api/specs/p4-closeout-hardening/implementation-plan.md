# Implementation Plan
## 1. Objective
Cerrar formalmente la línea `p4-*` con trazabilidad versionada y reducir las principales brechas detectadas en documentación, precisión monetaria, gobernanza de autorización, automatización de calidad y descubrimiento de pruebas.

## 2. Scope
Incluye:
- creación/consolidación del paquete de specs P4 de cierre;
- corrección de referencias documentales rotas;
- encapsulación monetaria segura para lógica derivada de facturas/pagos;
- definición y aplicación incremental de una política central de autorización con migración progresiva hacia permisos;
- workflow CI mínimo versionado;
- CD parcial versionado para build/versionado/publicación sin deploy;
- reemplazo del script de pruebas manual por descubrimiento automático.

No incluye:
- rediseño completo de RBAC;
- habilitación de despliegue automático a ambientes sin definición de infraestructura;
- cambios de esquema de base de datos no necesarios.

## 3. Preconditions
- Verificar que la suite actual pueda ejecutarse sin dependencias no documentadas en un runner CI.
- Identificar qué documentación derivada versionada debe corregirse además del Markdown fuente.
- Definir qué dominios operativos serán la primera ola de migración progresiva a permisos.

## 4. Implementation sequence
### Step 1
- Purpose
  - Restaurar la base documental canónica de P4 y eliminar referencias rotas más críticas.
- Changes
  - Crear el paquete `specs/p4-closeout-hardening/`.
  - Actualizar `docs/architecture.md` para apuntar al paquete canónico real.
  - Actualizar `docs/runtime-scope-baseline.md` para reemplazar la referencia a `specs/p3-*`.
  - Corregir también Markdown y artefactos documentales derivados versionados que sigan distribuyéndose en el repositorio (`docs/audit/*.md`, `docs/audit/*.html` y equivalentes aplicables).
- Files
  - `specs/p4-closeout-hardening/*`
  - `docs/architecture.md`
  - `docs/runtime-scope-baseline.md`
  - `docs/audit/current-code-audit.md`
  - `docs/audit/current-code-audit.html`
  - otros `docs/*` versionados que contengan referencias rotas
- Tests
  - Revisión manual de enlaces.
  - Prueba/script documental que detecte referencias a specs inexistentes en docs activos.
- Validation
  - Todo puntero crítico resuelve a archivo existente.
  - El nombre canónico P4 queda unificado.
  - La documentación derivada distribuida no conserva referencias rotas conocidas.

### Step 2
- Purpose
  - Eliminar el riesgo de precisión monetaria en lógica derivada sin tocar persistencia.
- Changes
  - Introducir un helper monetario basado en `Decimal`.
  - Refactorizar `src/services/invoice-financial-state.js` para usar el helper.
  - Refactorizar validación de sobrepago en `src/services/payment.service.js`.
  - Evaluar y, si aplica en el mismo cierre, refactorizar cálculos visibles de `src/services/agent-workspace.service.js` donde impacten montos monetarios.
- Files
  - `src/lib/money.js` o equivalente
  - `src/services/invoice-financial-state.js`
  - `src/services/payment.service.js`
  - posiblemente `src/services/agent-workspace.service.js`
  - nuevas pruebas en `tests/`
- Tests
  - Unit tests de helper monetario.
  - Regresión de sincronización factura/pago.
  - Casos de borde: sumas decimales, sobrepago exacto, saldo cero, pagos parciales.
- Validation
  - No hay conversiones inseguras a `Number` en validaciones monetarias críticas.
  - Los resultados funcionales observados se preservan.

### Step 3
- Purpose
  - Hacer gobernable la autorización sin reescribir todo el sistema.
- Changes
  - Inventariar endpoints por rol/permiso en una policy central.
  - Definir convenciones: global/admin legacy por rol; negocio granular por permisos; excepciones justificadas.
  - Identificar endpoints operativos candidatos a migración progresiva hacia permisos.
  - Introducir wrapper o helpers para consumir la policy en rutas críticas nuevas o modificadas.
  - Añadir pruebas de caracterización para asegurar equivalencia de acceso.
- Files
  - `src/security/access-policies.js` o equivalente
  - `src/middlewares/authorize.js`
  - `src/middlewares/authorizePermission.js`
  - rutas críticas: `src/routes/order.routes.js`, `payment.routes.js`, `company.routes.js`, `user.routes.js`, `product.routes.js`, `inventory.routes.js`
  - pruebas de autorización en `tests/`
- Tests
  - Regresión de pruebas actuales de autorización.
  - Nuevas pruebas de policy central.
- Validation
  - Un implementador puede identificar centralmente la regla de acceso por endpoint o dominio.
  - Los endpoints en transición progresiva hacia permisos quedan identificados explícitamente.
  - No se expanden permisos efectivos respecto al baseline actual.

### Step 4
- Purpose
  - Eliminar fragilidad del comando de pruebas.
- Changes
  - Reemplazar la lista manual del script `test` por descubrimiento automático compatible con Node 20 y Windows/Linux.
  - Si el runner nativo no es suficientemente explícito o portable, añadir un script `scripts/run-tests.js` que descubra `tests/**/*.test.js`.
- Files
  - `package.json`
  - opcionalmente `scripts/run-tests.js`
- Tests
  - Ejecutar suite actual completa.
  - Añadir temporal o permanentemente un test simple nuevo para comprobar autodiscovery.
- Validation
  - Nuevos tests son incluidos sin editar `package.json`.

### Step 5
- Purpose
  - Versionar una automatización mínima de calidad continua.
- Changes
  - Crear workflow en `.github/workflows/quality-gates.yml`.
  - Ejecutar `npm ci`, `prisma generate` y `npm run verify`.
  - Documentar variables/limitaciones si alguna prueba requiere entorno especial.
- Files
  - `.github/workflows/quality-gates.yml`
  - opcionalmente `README.md` o `docs/production-baseline.md`
- Tests
  - Validación estática del YAML.
  - Ejecución local equivalente del pipeline.
- Validation
  - Existe un gate versionado reproducible desde el repositorio.

### Step 6
- Purpose
  - Avanzar el CD hasta build y publicación controlada sin prometer despliegue productivo operativo.
- Changes
  - Crear workflow de build-and-publish o equivalente.
  - Construir artefactos reproducibles y/o imagen Docker versionada.
  - Definir triggers controlados: tag, release manual o ambos.
  - Publicar artefactos del pipeline y, si se aprueba, imagen a registry objetivo.
  - Documentar explícitamente que el flujo no realiza deploy a ambientes.
- Files
  - `.github/workflows/build-and-publish.yml` o equivalente
  - opcionalmente `README.md`, `docs/production-baseline.md` u otra documentación de release
- Tests
  - Validación estática del YAML.
  - Revisión manual de triggers y condiciones de publicación.
  - Ejecución controlada de build/versionado si el entorno lo permite.
- Validation
  - El repositorio contiene un flujo versionado que construye y publica artefactos o imágenes sin desplegar.

## 5. Database migration plan
- No se planean migraciones de base de datos.
- Verificar que el cambio monetario reutilice `Decimal` ya existente y no exija alterar esquema.
- Si durante implementación se detecta un campo monetario serializado erróneamente, abrir cambio separado; no mezclarlo con este cierre sin nueva aprobación.

## 6. Testing plan
- Ejecutar `npm run verify` con el nuevo mecanismo de pruebas.
- Añadir pruebas específicas para helper monetario y regresión de flujos de pago/factura.
- Mantener pruebas de autorización existentes y ampliar con policy central y transición progresiva.
- Incorporar verificación de referencias documentales activas y derivadas versionadas.
- Validar el flujo de build/publicación con revisión estática y, si se cuenta con el entorno, corrida controlada de empaquetado.
- Revisar que `tests/openapi-contract-consistency.test.js` y `tests/production-baseline-characterization.test.js` sigan verdes tras cambios documentales/CI.

## 7. Deployment considerations
- El workflow inicial de CI debe quedar operativo sin despliegue automático a ambientes.
- No introducir secretos ni ambientes no definidos.
- El CD parcial debe quedar limitado a build/publicación controlada y documentar claramente la ausencia de deploy.

## 8. Rollback plan
- Revertir cambios documentales si generan referencias externas inválidas, manteniendo al menos el paquete spec creado.
- Revertir helper monetario a implementación previa sólo si rompe compatibilidad funcional demostrada; conservar pruebas que expongan el problema.
- Desactivar temporalmente el workflow si falla por dependencias ambientales no resueltas, pero mantener scripts locales corregidos.
- Restaurar script de pruebas anterior sólo como contingencia breve, con issue explícito para autodiscovery.

## 9. Risks
- Posible aparición de diferencias numéricas en casos borde históricos.
- Refactor parcial de autorización puede dejar coexistencia temporal controlada durante la migración progresiva a permisos.
- El workflow CI puede fallar inicialmente por precondiciones no documentadas del entorno.
- Corregir también documentación derivada puede requerir decisiones sobre artefactos generados y su fuente de verdad.
- Un workflow de build/publicación mal rotulado podría interpretarse como capacidad de deploy si no se documenta con claridad.

## 10. Definition of done
- Existe un paquete `specs/p4-*` de cierre versionado y completo.
- Las referencias documentales activas ya no apuntan a specs inexistentes.
- Los cálculos monetarios críticos derivados no usan `Number` de forma insegura.
- La política de autorización está centralizada y probada.
- El comando estándar de pruebas descubre automáticamente nuevos tests.
- Existe workflow CI versionado ejecutando gates mínimos.
- Existe un flujo de CD parcial versionado para build/publicación sin deploy.
- La suite y validaciones relevantes pasan.

## Requirements traceability
| Requirement | Architecture component | Task | Test |
|---|---|---|---|
| FR-001 | Paquete de especificación P4 de cierre | TASK-001 | Revisión manual de estructura `specs/p4-closeout-hardening/` |
| FR-002 | Punteros documentales corregidos | TASK-002 | Verificación manual/script de referencias en `docs/architecture.md` y `docs/runtime-scope-baseline.md` |
| FR-003 | Utilidad monetaria decimal | TASK-003 | Unit tests monetarios + `tests/invoice-payment-sync-characterization.test.js` |
| FR-004 | Política central de autorización | TASK-004 | Pruebas de autorización existentes + nuevas pruebas de policy |
| FR-005 | Workflow CI versionado | TASK-006 | Validación YAML + ejecución local equivalente de `npm run verify` |
| FR-006 | Ejecución automática de pruebas | TASK-005 | Prueba de autodiscovery de nuevo `tests/*.test.js` |
| FR-007 | Compatibilidad funcional observable | TASK-003, TASK-004, TASK-005, TASK-006, TASK-007 | Regresión de suite relevante (`verify`) |
| FR-008 | Punteros documentales corregidos en todo el baseline | TASK-002 | Validación de referencias activas y derivadas |
| FR-009 | CD parcial controlado | TASK-007 | Validación YAML + revisión manual de triggers y publicación |
| AC-001 | Punteros documentales corregidos | TASK-002 | Validación de referencias activas |
| AC-002 | Utilidad monetaria decimal | TASK-003 | Casos de borde monetarios y sobrepago |
| AC-003 | Política central de autorización | TASK-004 | Pruebas de acceso por endpoint |
| AC-004 | Workflow CI versionado | TASK-006 | Ejecución del pipeline versionado |
| AC-005 | Ejecución automática de pruebas | TASK-005 | Alta de prueba nueva detectada automáticamente |
| AC-006 | Paquete de especificación P4 de cierre | TASK-001 | Revisión del paquete completo |
| AC-007 | Corrección documental integral | TASK-002 | Validación de referencias activas y derivadas |
| AC-008 | CD sin deploy automático | TASK-007 | Revisión manual del workflow y ausencia de pasos de deploy |
| AC-009 | Build/publicación controlada | TASK-007 | Ejecución controlada o validación estática del flujo de publicación |
