# UI Guidelines

## Purpose
Este documento define reglas operables para la UI embebida servida desde `src/public/`.

## Runtime position
- `src/public/` forma parte del runtime real del repositorio.
- La UI embebida depende del mismo backend Express que sirve los endpoints API.
- No existe en este repo una separación física verificable entre backend y frontend como proyectos independientes.
- Por esa razón, cualquier cambio de UI debe tratar sus fetch paths, navegación y controles de acceso como contrato soportado del runtime.

## Scope
Estas reglas aplican a:
- `/index.html` y `login.js`
- superficies `root/*`
- superficies `warehouse/*`
- superficies `agent/*`
- helpers compartidos bajo `src/public/root/*.shared.js` y `src/public/shared/*`

## 1. Navigation and session rules
- La navegación inicial debe derivarse de la sesión autenticada, rol y permisos efectivos observables.
- `login.js` es la referencia actual para resolver landing pages por rol/permisos.
- Si una pantalla requiere un perfil específico, debe validar la sesión al cargar y redirigir fuera del flujo cuando no exista acceso.
- No introducir navegación basada solo en ocultar botones; el backend sigue siendo la autoridad final.
- Las pantallas actuales deben permanecer separadas por contexto operativo:
  - `root/*` para root/admin/supervisión administrativa según la página
  - `warehouse/*` para flujos de bodega
  - `agent/*` para operación comercial en campo

## 2. Authenticated fetch conventions
- Los requests autenticados deben enviar `Authorization: Bearer <token>`.
- Cuando el request envía JSON, incluir también `Content-Type: application/json`.
- Reutilizar helpers compartidos cuando ya existan para headers, mensajes y utilidades de sesión.
- No hardcodear tokens, IDs de tenant ni permisos en archivos públicos.
- Toda ruta consumida por la UI debe mapearse a un endpoint realmente montado o, si el contrato es legacy, documentarse explícitamente como tal.

## 3. Error-handling rules
- La UI debe presentar mensajes operables y breves para fallos esperables de red, autorización o validación.
- No asumir que toda respuesta contiene JSON válido; cuando el código actual ya contempla parse defensivo, mantener ese patrón.
- El estado visual del formulario o acción debe restaurarse después de errores (`disabled`, labels de botón, mensajes).
- No ocultar silenciosamente errores críticos de carga inicial; deben reflejarse en la pantalla con un mensaje visible.

## 4. Business-logic boundary
- La UI puede:
  - parsear formularios
  - construir payloads
  - renderizar listas, métricas y estados visuales
  - aplicar validaciones básicas de experiencia de usuario
- La UI no debe convertirse en la fuente principal de:
  - autorización
  - tenant scoping
  - reglas contables o de lifecycle
  - validaciones de ownership
  - decisiones críticas de negocio
- Si una regla es importante para integridad del negocio, debe vivir también en backend.

## 5. Protected files and downloads
- Los documentos privados y comprobantes no deben exponerse mediante rutas estáticas públicas.
- Las descargas protegidas deben hacerse con fetch autenticado y manejo explícito de `blob`.
- Después de descargar un archivo, revocar `ObjectURL` temporales para evitar fugas de recursos.
- No loggear contenido sensible de documentos ni tokens en consola.

## 6. External integration usage from UI
- La UI puede consumir integraciones expuestas por el backend, por ejemplo geocoding o lookup tributario, pero nunca debe llamar directamente desde el navegador a servicios privados del dominio si el backend ya provee una fachada controlada.
- Cuando una integración sea auxiliar de un formulario, la UI debe tratar sus errores como recuperables y mostrar mensajes claros.

## 7. Shared helpers and duplication control
- Si varias pantallas usan el mismo patrón de headers, mensajes, descarga o formatting, preferir helpers compartidos ya existentes.
- No duplicar lógica de sesión/autorización si ya existe un helper razonable en `*.shared.js`.
- No introducir abstracciones genéricas innecesarias; mantener helpers pequeños y explícitos.

## 8. Contract governance rules
- Antes de cambiar un fetch path público, revisar:
  - `internal-docs/runtime-endpoint-catalog.md`
  - `docs/runtime-ui-api-contract-map.md`
  - `tests/public-surface-characterization.test.js`
- Si una ruta legacy sigue existiendo por compatibilidad, no sustituirla en backend sin documentar primero el impacto en UI.
- Si se agrega una nueva pantalla embebida, documentar al menos:
  - rol/permisos esperados
  - endpoints consumidos
  - si descarga/sube archivos protegidos
  - mensajes de error principales

## 9. Current practical examples
- `login.js` decide la redirección inicial por rol/permisos y guarda la sesión autenticada.
- `root/dashboard.js` consume el alias semántico `/api/companies/company/dashboard` y no el path legacy.
- `warehouse/products.js` oculta capacidades de importación/gestión según permisos efectivos.
- `agent/workspace.js` consume dashboard, tiendas, metas y visitas como parte del runtime soportado.
- `root/client-detail.shared.js` usa fetch autenticado para descargas privadas.

## 10. Out-of-scope assumptions to avoid
- No asumir que `src/public/` es solo demo local.
- No asumir que existe un SPA separado fuera de este repo.
- No asumir que README/PRD equivalen automáticamente a pantalla runtime disponible.
- No asumir que una capacidad documentada en Prisma o en visión de producto ya tiene UI operable.
