# User Requirements
## 1. Overview
Planificar el cierre de la línea `p4-*` para dejar el repositorio auditable, reducir deuda técnica operativa y eliminar riesgos conocidos en trazabilidad, cálculos monetarios, gobernanza de autorización y automatización de calidad.

## 2. Business objective
Cerrar P4 con artefactos versionados y una base técnica mínima que permita implementar, validar y operar cambios futuros con menor riesgo documental, financiero y operativo.

## 3. User problem
Actualmente el repositorio presenta brechas que dificultan el cierre formal del cambio: referencias a specs inexistentes, deriva documental hacia artefactos rotos, cálculos monetarios derivados con `Number`, autorización híbrida difícil de razonar, ausencia de CI/CD versionado y ejecución de pruebas dependiente de una lista manual propensa a omisiones.

## 4. Actors
- Equipo de desarrollo
- Revisor/a técnico/a
- Responsable de arquitectura
- Responsable de operaciones / release
- Auditor/a interno o externo

## 5. Functional requirements
### FR-001 Crear y versionar un paquete de especificación `p4-*` de cierre.
El repositorio debe contener un paquete `specs/<feature>/` con requisitos, estado actual, arquitectura, plan de implementación y tareas para el cierre de P4.

### FR-002 Corregir referencias documentales rotas relacionadas con `specs/p4-*` y `specs/p3-*`.
La documentación versionada debe apuntar únicamente a artefactos presentes en el repositorio o declarar explícitamente que una referencia histórica ya no aplica.

### FR-003 Definir una estrategia segura para cálculos monetarios derivados.
La solución debe reemplazar o encapsular el uso directo de `Number` en cálculos financieros derivados para facturas y pagos, preservando la semántica actual de redondeo a 2 decimales y evitando drift binario.

### FR-004 Establecer una gobernanza explícita de autorización.
La solución debe definir qué superficies siguen autorización por rol, cuáles por permisos y cómo se expresan esas reglas de forma consistente en rutas y pruebas, con una migración progresiva hacia permisos en superficies operativas donde sea seguro.

### FR-005 Versionar una automatización mínima de calidad continua.
El repositorio debe incluir una automatización versionada que ejecute al menos instalación, generación Prisma, lint, typecheck y pruebas verificables para cada cambio relevante.

### FR-006 Eliminar la enumeración manual frágil del set de pruebas.
La ejecución de pruebas debe descubrir automáticamente nuevos archivos de test compatibles sin requerir actualizar manualmente `package.json` por cada prueba agregada.

### FR-007 Preservar compatibilidad funcional observable.
El cierre no debe cambiar sin justificación el comportamiento visible de autenticación, autorización efectiva, flujos de pagos, OpenAPI factual parcial ni la superficie `src/public/` actualmente soportada.

### FR-008 Corregir integralmente la deriva documental relacionada con P3/P4.
La corrección documental debe abarcar tanto Markdown fuente activo como artefactos documentales derivados versionados que hoy preservan referencias rotas, salvo que un archivo sea explícitamente retirado del baseline documental.

### FR-009 Versionar un CD parcial orientado a build y publicación de artefactos sin despliegue.
La solución debe poder avanzar más allá de un placeholder y dejar versionado un flujo de CD controlado para construir, versionar y publicar artefactos o imágenes, sin realizar despliegue automático a ambientes.

## 6. Non-functional requirements
### NFR-001 La propuesta debe preferir cambios incrementales y de bajo riesgo.
### NFR-002 La trazabilidad entre requisitos, arquitectura, plan y tareas debe ser explícita.
### NFR-003 La solución propuesta debe respetar la arquitectura actual Express -> services -> repositories -> Prisma.
### NFR-004 La automatización propuesta debe ser reproducible localmente y en CI sin dependencias manuales implícitas.
### NFR-005 La estrategia monetaria debe ser determinista para montos decimales de 2 posiciones.

## 7. Business rules
### BR-001 Las referencias canónicas de documentación no pueden apuntar a archivos inexistentes.
### BR-002 Los cálculos derivados de montos aprobados, pendientes y validaciones de sobrepago no deben depender de precisión binaria de `Number`.
### BR-003 Los controles platform-wide pueden seguir por rol cuando expresan fronteras globales (`root`) o administrativas legadas (`admin`), pero la política debe quedar documentada.
### BR-004 Las operaciones de dominio granular dentro del tenant deben tener una política uniforme y comprobable, con migración progresiva preferente hacia permisos explícitos cuando ya exista catálogo de permisos y la compatibilidad pueda preservarse.
### BR-005 Toda nueva prueba compatible bajo `tests/` debe ser incluida por el comando estándar de pruebas sin edición manual adicional.
### BR-006 La automatización versionada no debe asumir secretos de despliegue inexistentes en el repositorio.
### BR-007 Las correcciones documentales del cierre deben aplicarse a todas las piezas documentales versionadas que formen parte del baseline consultable, incluyendo artefactos derivados si siguen distribuyéndose en el repositorio.
### BR-008 El CD de esta iniciativa debe limitarse a build, versionado y publicación controlada de artefactos o imágenes; no debe ejecutar despliegue automático a ambientes.
### BR-009 Cualquier workflow de release/publicación debe requerir disparo controlado por tag, aprobación manual o condiciones equivalentes para no simular una capacidad operativa inexistente.

## 8. Acceptance criteria
### AC-001 Given que un revisor inspecciona `docs/architecture.md` y `docs/runtime-scope-baseline.md`, When sigue las referencias declaradas, Then todas las rutas documentales críticas resuelven a archivos existentes o indican explícitamente su reemplazo.
### AC-002 Given una factura con pagos aprobados y montos decimales de 2 posiciones, When se calculan `appliedAmount`, `pendingAmount` y la validación de sobrepago, Then el resultado es determinista sin conversiones intermedias inseguras a `Number`.
### AC-003 Given las rutas administrativas y operativas actuales, When un implementador revisa la política de acceso, Then puede identificar de forma centralizada qué endpoints dependen de rol, cuáles de permisos y cuáles están en transición progresiva hacia permisos.
### AC-004 Given un pull request o cambio equivalente, When corre la automatización versionada, Then se ejecutan los gates de calidad definidos sin pasos manuales no documentados.
### AC-005 Given que se agrega un nuevo archivo `tests/*.test.js`, When se ejecuta el comando estándar de pruebas, Then la nueva prueba es descubierta automáticamente.
### AC-006 Given el cierre de P4, When un auditor revisa el repositorio, Then puede reconstruir requisitos, análisis, arquitectura, plan y tareas desde el paquete de specs versionado.
### AC-007 Given que existen referencias rotas a `specs/p3-*` o `specs/p4-*` en documentación versionada, When se completa el cierre, Then esas referencias quedan corregidas también en artefactos derivados distribuidos en el repositorio.
### AC-008 Given que el repositorio no tiene infraestructura de despliegue plenamente definida, When se versiona CD, Then el flujo implementado se limita a build/versionado/publicación controlada y no realiza despliegue automático.
### AC-009 Given un tag o disparador manual autorizado, When corre el flujo de CD, Then genera artefactos reproducibles o una imagen versionada sin requerir pasos manuales implícitos de build.

## 9. Constraints
- No se debe introducir un rediseño completo del monolito.
- No se debe romper compatibilidad de rutas existentes salvo corrección documental explícita.
- No se debe asumir infraestructura de despliegue no versionada.
- El proyecto usa Node 20, Express, Prisma y `node --test`.
- El repositorio actual no contiene `.github/workflows/`.

## 10. Assumptions
- El alcance esperado de “cierre P4” incluye tanto trazabilidad documental como deuda técnica mínima identificada por la auditoría actual.
- La librería `Decimal` de Prisma es aceptable para resolver la precisión monetaria sin añadir una dependencia nueva.
- La migración de autorización puede ejecutarse progresivamente hacia permisos en superficies operativas, manteniendo compatibilidad en fronteras globales o legadas.
- El cierre debe corregir toda la documentación versionada distribuida en el repositorio, incluyendo artefactos derivados consultables.
- Puede versionarse un CD parcial de build/publicación aunque todavía no exista despliegue automático a ambientes.

## 11. Open questions
- ¿Qué dominios operativos deben priorizarse primero en la migración progresiva de rol a permisos: pedidos, clientes, facturas, geocoding/taxpayer u otros?
- ¿Cuál será el destino de publicación inicial del CD parcial: artifact upload del proveedor CI, container registry o ambos?
- ¿La publicación debe activarse por tag semántico, release manual, o ambos mecanismos?
- ¿Existe alguna expectativa externa de mantener referencias históricas antiguas además de corregirlas dentro del repositorio?

## 12. Out of scope
- Rediseño completo de seguridad o RBAC.
- Reemplazo de Express/Prisma por otra plataforma.
- Reescritura integral de la suite de pruebas.
- Implementación de observabilidad avanzada no relacionada con el cierre.
- Automatización de despliegue a producción o staging sin definición de infraestructura y secretos.
