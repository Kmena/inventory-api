# UI Guidelines

## Purpose
Este documento define reglas operables para la UI embebida servida desde `src/public/`.

## Runtime position
- `src/public/` forma parte del runtime real del repositorio.
- La UI embebida depende del mismo backend Express que sirve los endpoints API.
- No existe en este repo una separación física verificable entre backend y frontend como proyectos independientes.
- Por esa razón, cualquier cambio de UI debe tratar sus fetch paths, navegación, storage y controles de acceso como contrato soportado del runtime.

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
- La sesión browser soportada se deriva del boundary backend-owned formado por las cookies `inventory_browser_session` y `inventory_browser_state`; la clave `inventory-api-auth` solo permanece como puente de limpieza/compatibilidad legacy y no debe volver a usarse para persistir bearer tokens soportados.
- Si una pantalla requiere un perfil específico, debe validar la sesión al cargar y redirigir fuera del flujo cuando no exista acceso.
- No introducir navegación basada solo en ocultar botones; el backend sigue siendo la autoridad final.
- Las pantallas actuales deben permanecer separadas por contexto operativo:
  - `root/*` para root/admin/supervisión administrativa según la página
  - `warehouse/*` para flujos de bodega
  - `agent/*` para operación comercial en campo

## 2. Authenticated fetch conventions
- Los requests autenticados del runtime browser deben usar `credentials: 'same-origin'` y reutilizar `src/public/shared/auth.js` cuando corresponda.
- Solo enviar `Authorization: Bearer <token>` cuando el helper realmente reciba un bearer token explícito; para la sesión browser soportada, el helper omite ese header y depende de la cookie same-origin.
- Cuando el request envía JSON, incluir también `Content-Type: application/json`.
- Reutilizar helpers compartidos cuando ya existan para headers, mensajes y utilidades de sesión.
- No hardcodear tokens, IDs de tenant ni permisos en archivos públicos.
- Toda ruta consumida por la UI debe mapearse a un endpoint realmente montado o, si el contrato es legacy, documentarse explícitamente como tal.
- Para login público, el contrato soportado sigue siendo `POST /api/auth/login`.

## 3. Error-handling rules
- La UI debe presentar mensajes operables y breves para fallos esperables de red, autorización o validación.
- No asumir que toda respuesta contiene JSON válido; cuando el código actual ya contempla parse defensivo, mantener ese patrón.
- El estado visual del formulario o acción debe restaurarse después de errores (`disabled`, labels de botón, mensajes).
- Las validaciones locales de UX pueden prevenir roundtrips innecesarios, pero deben degradarse graciosamente: si el dato en memoria no es suficiente o falla la verificación local, el flujo debe poder continuar hacia la validación autoritativa del backend.
- No ocultar silenciosamente errores críticos de carga inicial; deben reflejarse en la pantalla con un mensaje visible.
- Si existe una sesión legacy o corrupta en storage, debe limpiarse y permitirse continuar con login normal.

## 4. Business-logic boundary
- La UI puede:
  - parsear formularios
  - construir payloads
  - renderizar listas, métricas y estados visuales
  - aplicar validaciones básicas de experiencia de usuario
  - resolver composición responsive y jerarquía visual
  - reutilizar helpers browser registrados en `RootShell` para evitar duplicación de lógica visual o de validación liviana
- La UI no debe convertirse en la fuente principal de:
  - autorización
  - tenant scoping
  - reglas contables o de lifecycle
  - validaciones de ownership
  - decisiones críticas de negocio
- Si una regla es importante para integridad del negocio, debe vivir también en backend.
- Ejemplo actual: `views.productsAdminHelpers.checkSubcategoryNameDuplicate(...)` mejora UX en el formulario de productos, pero no sustituye la validación backend de duplicados.

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
- Los helpers exportados vía `rootShell.register(...)` deben encapsular utilidades pequeñas, explícitas y reutilizables; cuando una validación o transformación de UI se use desde la vista principal, preferir helper exportado antes que duplicación inline.
- No introducir abstracciones genéricas innecesarias; mantener helpers pequeños y explícitos.
- `login.js` puede seguir siendo el orquestador principal del login mientras el contrato permanezca pequeño y estable.

## 8. Contract governance rules
- Antes de cambiar un fetch path público, revisar:
  - `tests/public-surface-characterization.test.js`
  - `tests/browser-e2e.e2e.js`
- Si una ruta legacy sigue existiendo por compatibilidad, no sustituirla en backend sin documentar primero el impacto en UI.
- Si se agrega o altera una pantalla embebida, documentar al menos:
  - rol/permisos esperados
  - endpoints consumidos
  - storage/session contract afectado
  - si descarga/sube archivos protegidos
  - mensajes de error principales
  - reglas responsive críticas si afectan la tarea principal

## 9. Login-screen specific rules
- El login público puede evolucionar visualmente, pero debe preservar:
  - `POST /api/auth/login`
  - el request header `X-Inventory-Browser-Session: cookie` para el flujo browser soportado
  - la lógica actual de landing por rol/permisos
- El mensaje de ayuda debe describir una acción real soportada. Actualmente el wording correcto es contactar al administrador de la empresa, no prometer recuperación de contraseña inexistente.
- En desktop, el login actual usa una composición de dos columnas hero/form.
- En mobile, la prioridad debe mantenerse sobre el formulario antes del bloque hero expandido.
- La acción primaria de login debe permanecer visible above the fold en el viewport cubierto por regresión (`1366x768`).

## 10. Current practical examples
- `login.js` decide la redirección inicial por rol/permisos, solicita la sesión browser al backend con `X-Inventory-Browser-Session: cookie`, limpia estado legacy/corrupto y bootstrapea la sesión mediante cookies same-origin.
- `index.html` muestra un hero editorial más fuerte sin cambiar el contrato de autenticación.
- `tests/browser-e2e.e2e.js` valida la redirección al dashboard, el retorno de usuarios anónimos al login y la visibilidad del CTA above the fold.
- `root/dashboard.js` consume el alias semántico `/api/companies/company/dashboard` y no el path legacy.
- `warehouse/products.js` oculta capacidades de importación/gestión según permisos efectivos.
- `agent/workspace.js` consume dashboard, tiendas, metas y visitas como parte del runtime soportado.
- `root/client-detail.shared.js` usa fetch autenticado para descargas privadas.
- `src/public/root/views/products-admin.js` usa dialogs nativos apilados para crear subcategorías inline desde el formulario de producto y mantiene el retorno de foco por dialog mediante triggers separados.
- `src/public/root/views/products-admin.helpers.js` exporta `checkSubcategoryNameDuplicate(...)` como validación local, case-insensitive y trim-normalizada, con fallback al backend si la data en memoria no alcanza.

## 11. Browser-native dialog usage
- Si una vista usa `<dialog>.showModal()` sobre otro dialog activo, tratar ese apilado como una dependencia explícita del navegador, no como comportamiento implícito garantizado.
- El manejo de foco debe seguir el dialog real que abrió la interacción; evitar una sola referencia global de trigger cuando haya múltiples dialogs que puedan apilarse.
- Cuando exista una nota de compatibilidad en el README para una capacidad UI concreta, esa nota pasa a ser parte del baseline operativo del frontend embebido.
- Si el navegador objetivo no soporta correctamente el apilado requerido, documentar y preservar un flujo alterno no apilado.

## 12. Out-of-scope assumptions to avoid
- No asumir que `src/public/` es solo demo local.
- No asumir que existe un SPA separado fuera de este repo.
- No asumir que README/PRD equivalen automáticamente a pantalla runtime disponible.
- No asumir que una capacidad documentada en Prisma o en visión de producto ya tiene UI operable.
- No asumir que un refresh visual habilita por sí mismo nuevas capacidades de autenticación o recuperación de cuenta.
- No asumir soporte universal de stacked dialogs: cuando una vista dependa de esa capacidad, debe existir nota de compatibilidad visible para el proyecto y, si aplica, un flujo alterno documentado.
