# TASK-008 — UX Spec: campos faltantes en edición de cliente, limpieza de payload y feedback de crédito

**ID agente:** senior-ux-ui-designer-unpinned-20eb55
**Coordinado con:** sdd-implementation-agent-d75f97
**Feature branch:** client-store-documents-credit-ux
**Fecha:** 2025-07

---

## Paso 0 — `ui-guidelines.md`

✅ Encontrado y revisado: `inventory-api/docs/ui-guidelines.md`

Reglas aplicadas:
- §3 — mensajes de error deben persistir y el estado del formulario restaurarse tras cada acción.
- §4 — `creditLimit` y `creditBalance` son reglas de negocio de nivel tienda; no deben vivir en el payload del endpoint de cliente.
- §7 — `renderInlineMessage` es el helper compartido canónico; no introducir variantes `textContent` ad-hoc en ninguna superficie.
- §8 — campos nuevos expuestos en el formulario deben documentar el endpoint que los consume.

---

## Análisis

### Tres sub-cambios de alcance estricto

| # | Sub-cambio | Archivo objetivo |
|---|---|---|
| A | Añadir `legalName`, `commercialName`, `province`, `canton`, `district` al formulario de edición | `clients-admin.renderers.js` → `renderClientDetail` |
| B | Eliminar `creditLimit` / `creditBalance` de `buildClientPayload` | `clients-admin.helpers.js` → `buildClientPayload` |
| C | Reemplazar feedback de texto plano en mini-form de crédito con `renderInlineMessage` | `clients-admin.js` → bloque `clients-store-credit-form` |

### Por qué son dead code (Sub-cambio B)

`buildClientPayload` se usa para `PUT /api/clients/:id`.
`creditLimit` y `creditBalance` pertenecen al modelo `Store`, no al modelo `Client`.
En el formulario de edición de cliente nunca hay `<input name="creditLimit">` ni `<input name="creditBalance">`, por lo que `formData.get(...)` devuelve `null` y el bloque reduce los omite de todas formas. Son código que nunca tiene efecto, que confunde al lector y que señala el lugar equivocado para esa lógica.

---

## Sub-cambio A — Posicionamiento en el formulario de edición

### Layout actual del `clients-update-form` (2 columnas, `root-form-grid`)

```
┌─────────────────────────────────────────────┐
│ [hidden] clientId                           │
├─────────────────────────────────────────────┤
│ Nombre *                          [full-row]│
├──────────────────────┬──────────────────────┤
│ Codigo               │ Clasificacion        │
├──────────────────────┼──────────────────────┤
│ Identificacion       │ Tipo de documento    │
├──────────────────────┼──────────────────────┤
│ Telefono             │ Correo facturacion   │
├──────────────────────┼──────────────────────┤
│ Tipo de pago         │ Dias de pago         │
├─────────────────────────────────────────────┤
│ Direccion (textarea)              [full-row]│
├─────────────────────────────────────────────┤
│ [Guardar] [Consultar id.] [Desactivar]      │
└─────────────────────────────────────────────┘
```

### Layout propuesto (sólo se añaden filas; ninguna se mueve ni elimina)

```
┌─────────────────────────────────────────────┐
│ [hidden] clientId                           │
├─────────────────────────────────────────────┤
│ Nombre *                          [full-row]│
├──────────────────────┬──────────────────────┤
│ Codigo               │ Clasificacion        │
├──────────────────────┼──────────────────────┤
│ Identificacion       │ Tipo de documento    │
├──────────────────────┼──────────────────────┤  ← INSERTAR AQUÍ (sub-A1)
│ Razon social         │ Nombre comercial     │  ← NUEVA FILA
├──────────────────────┼──────────────────────┤
│ Telefono             │ Correo facturacion   │
├──────────────────────┼──────────────────────┤
│ Tipo de pago         │ Dias de pago         │
├──────────────────────┼──────────────────────┤  ← INSERTAR AQUÍ (sub-A2)
│ Provincia            │ Canton               │  ← NUEVA FILA
├──────────────────────┴──────────────────────┤
│ Distrito              [col simple, sin par] │  ← NUEVA FILA
├─────────────────────────────────────────────┤
│ Direccion (textarea)              [full-row]│
├─────────────────────────────────────────────┤
│ [Guardar] [Consultar id.] [Desactivar]      │
└─────────────────────────────────────────────┘
```

---

## Sub-cambio A1 — `legalName` y `commercialName`

### Posición exacta

**Insertar inmediatamente después de la fila `Identificacion | Tipo de documento`**,
antes de la fila `Telefono | Correo facturacion`.

### Layout: dos columnas estándar (half + half)

Ninguno usa `root-form-grid__full`. Son campos de texto corto-medio. Irán como `<label>` sin modificador, ocupando cada uno una columna del grid.

```html
<label>
  <span>Razon social</span>
  <input name="legalName" type="text" maxlength="255"
         value="${rootShellUi.escapeHtml(client.legalName || '')}" />
</label>
<label>
  <span>Nombre comercial</span>
  <input name="commercialName" type="text" maxlength="255"
         value="${rootShellUi.escapeHtml(client.commercialName || '')}" />
</label>
```

### Justificación de posición

1. `legalName` es el nombre fiscal oficial. `documentType` + `legalId` son el tipo e identificador fiscal. La secuencia lógica es:
   `Identificacion | Tipo de documento` → `Razon social | Nombre comercial`.
   El usuario ve el bloque de identidad fiscal completo en cuatro celdas contiguas.

2. El botón **Consultar identificacion** ya intenta poblar `input[name="legalName"]` cuando la consulta al padrón fiscal devuelve datos (ver `clients-admin.js`, handler `#clients-lookup-taxpayer-button`). Al estar `legalName` inmediatamente debajo de `Identificacion`, el usuario ve el campo completarse justo debajo del ID consultado. Esto refuerza la conexión visual acción-resultado sin ningún scroll.

3. Situarlos antes de `Telefono` evita mezclar datos de identidad fiscal con datos de contacto.

### Etiquetas en español

| Campo `name` | Etiqueta en el `<span>` |
|---|---|
| `legalName` | `Razon social` |
| `commercialName` | `Nombre comercial` |

> **Criterio de estilo:** el formulario existente omite tildes de forma consistente (`Clasificacion`, `Identificacion`, `Telefono`, `Direccion`, `Correo facturacion`). Se mantiene ese criterio. No introducir tildes sólo en los campos nuevos.

---

## Sub-cambio A2 — `province`, `canton`, `district`

### Posición exacta

**Insertar inmediatamente antes de `Direccion` (textarea full-row)**,
después de la fila `Tipo de pago | Dias de pago`.

### Layout: province + canton como col+col; district como columna simple

```html
<label>
  <span>Provincia</span>
  <input name="province" type="text" maxlength="100"
         value="${rootShellUi.escapeHtml(client.province || '')}" />
</label>
<label>
  <span>Canton</span>
  <input name="canton" type="text" maxlength="100"
         value="${rootShellUi.escapeHtml(client.canton || '')}" />
</label>
<label>
  <span>Distrito</span>
  <input name="district" type="text" maxlength="100"
         value="${rootShellUi.escapeHtml(client.district || '')}" />
</label>
```

> `district` no lleva `root-form-grid__full`. Ocupa sólo la columna izquierda de la fila.
> La columna derecha queda vacía. Esto es intencional: refleja que el campo es corto
> y que no hay un cuarto campo geográfico en el modelo.

### Por qué esta posición y no full-row para los tres

- Los tres campos son geográficos y complementan `Direccion`. Agruparlos justo encima del textarea los convierte en un bloque de dirección estructurada → dirección libre. El usuario completa primero los campos controlados y luego el texto libre.
- Ninguno de los tres requiere `full-row`: son campos de texto corto (máx 100 caracteres). La anchura de media columna es suficiente.
- `Distrito` como columna simple (sin par) es coherente con como `buildStorePayload` los trata (misma tripleta, mismo nivel) y evita inventar un cuarto campo ficticio.
- Un grid de tres columnas quiebra `root-form-grid` existente. No se introduce ninguna variante nueva de grid.

### Etiquetas en español

| Campo `name` | Etiqueta en el `<span>` |
|---|---|
| `province` | `Provincia` |
| `canton` | `Canton` |
| `district` | `Distrito` |

> `Provincia` y `Distrito` llevan tilde natural en español estándar, pero siguen el mismo criterio del formulario. `Canton` lo omite igual que `Clasificacion`. Mantener coherencia interna del formulario sobre corrección tipográfica es la regla dominante aquí.

---

## Sub-cambio B — `buildClientPayload`: eliminar campos muertos

### Cambio en `numericFields`

```js
// ANTES
const numericFields = new Set(['clientClassificationId', 'paymentDays', 'creditLimit', 'creditBalance']);

// DESPUÉS
const numericFields = new Set(['clientClassificationId', 'paymentDays']);
```

### Cambio en `allowedFields`

```js
// ANTES (fragmento final de la lista)
      'paymentType',
      'paymentDays',
      'creditLimit',      // ← eliminar
    ];

// DESPUÉS
      'paymentType',
      'paymentDays',
    ];
```

`creditBalance` ya no está en `allowedFields` (nunca estuvo), pero sí en `numericFields`.
Eliminar ambas referencias limpia la función sin riesgo de regresión: el formulario de edición de cliente nunca tiene `<input name="creditLimit">` ni `<input name="creditBalance">`, por lo que `formData.get(...)` devuelve `null` y el reduce las omite igualmente hoy.

**No requiere cambio en ningún otro archivo:** `buildStorePayload` mantiene su propia lógica de `creditLimit` porque ahí sí es válido (la tienda tiene `creditLimit` en el modelo).

---

## Sub-cambio C — Credit mini-form: reemplazar feedback con `renderInlineMessage`

### Estado actual (plain text, incorrecto)

```js
// En clients-admin.js, bloque clients-store-credit-form:
try {
  await clientsApi.updateStoreCreditLimit(session, clientId, storeId, { creditLimit });
  if (msgEl) { msgEl.textContent = '✓ Guardado'; }          // ← plain text
} catch (err) {
  if (msgEl) { msgEl.textContent = err.message || 'Error'; } // ← plain text
}
```

### Estado deseado

```js
try {
  await clientsApi.updateStoreCreditLimit(session, clientId, storeId, { creditLimit });
  if (msgEl) { msgEl.innerHTML = rootShellUi.renderInlineMessage('Limite de credito guardado.'); }
} catch (err) {
  if (msgEl) { msgEl.innerHTML = rootShellUi.renderInlineMessage(err.message || 'No se pudo guardar el limite de credito.', 'error'); }
}
```

### Decisión sobre auto-clear vs persistencia

**Regla: el mensaje persiste hasta el siguiente intento de guardado.**

No se introduce ningún `setTimeout` de auto-clear.

Razones:
1. **Consistencia total con el codebase.** Cada una de las ~40 llamadas a `renderInlineMessage` en `root/` persiste hasta que la siguiente acción sobreescribe el contenedor. Introducir auto-clear únicamente en la mini-form de crédito crearía el único caso divergente en toda la superficie.
2. **Mensajes de error deben persistir** (ui-guidelines §3): el usuario necesita leer el mensaje de error antes de corregir; un timer puede borrarlo antes de que lo lea.
3. **Implementación más simple:** sin `setTimeout`, sin IDs para cancelar timers, sin riesgo de limpiar el mensaje del store incorrecto cuando hay múltiples tiendas visibles.
4. **El mensaje de éxito también es útil pasados unos segundos** cuando hay varios stores y el usuario hace scroll para confirmar cuál se guardó.

> Si en el futuro se desea auto-clear opcional, puede implementarse como helper compartido en `ui.js` con signature `renderInlineMessage(msg, tone, { autoClearMs })`. Eso está fuera del alcance de TASK-008.

### Cambio requerido en el renderer (contenedor de la mini-form)

`renderInlineMessage` devuelve `<p class="message …" role="status">…</p>`.
Asignar ese HTML via `innerHTML` a un `<span>` es HTML inválido (elemento de bloque dentro de inline).

**El contenedor `.clients-store-credit-msg` debe cambiar de `<span>` a `<div>`** en `clients-admin.renderers.js`:

```js
// ANTES (en la inline-card de la tienda)
<span class="clients-store-credit-msg" style="font-size:0.78rem;"></span>

// DESPUÉS
<div class="clients-store-credit-msg" aria-live="polite"></div>
```

Añadir `aria-live="polite"` para que lectores de pantalla anuncien el resultado del guardado.
El atributo `style="font-size:0.78rem;"` se elimina: `renderInlineMessage` usa la clase `.message` del sistema de estilos global, que ya tiene tamaño y color propios.

---

## Wireframe ASCII — formulario de edición después de TASK-008

```
┌─ clients-update-form (root-form-grid) ───────────────────────────────────────┐
│                                                                               │
│  [hidden: clientId]                                                           │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Nombre *                                                               │  │  ← full-row
│  │ [________________________________________________]                    │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                  │
│  │ Codigo                   │  │ Clasificacion             │                  │
│  │ [____________________]   │  │ [▼ Sin clasificacion   ]  │                  │
│  └──────────────────────────┘  └──────────────────────────┘                  │
│                                                                               │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                  │
│  │ Identificacion           │  │ Tipo de documento         │                  │
│  │ [____________________]   │  │ [____________________ ▾]  │                  │
│  └──────────────────────────┘  └──────────────────────────┘                  │
│                                                                               │
│  ┌──────────────────────────┐  ┌──────────────────────────┐  ◄── NUEVA FILA  │
│  │ Razon social             │  │ Nombre comercial          │                  │
│  │ [____________________]   │  │ [____________________]    │                  │
│  └──────────────────────────┘  └──────────────────────────┘                  │
│                                                                               │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                  │
│  │ Telefono                 │  │ Correo facturacion        │                  │
│  │ [____________________]   │  │ [____________________]    │                  │
│  └──────────────────────────┘  └──────────────────────────┘                  │
│                                                                               │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                  │
│  │ Tipo de pago             │  │ Dias de pago              │                  │
│  │ [▼ Selecciona         ]  │  │ [____________________]    │                  │
│  └──────────────────────────┘  └──────────────────────────┘                  │
│                                                                               │
│  ┌──────────────────────────┐  ┌──────────────────────────┐  ◄── NUEVA FILA  │
│  │ Provincia                │  │ Canton                    │                  │
│  │ [____________________]   │  │ [____________________]    │                  │
│  └──────────────────────────┘  └──────────────────────────┘                  │
│                                                                               │
│  ┌──────────────────────────┐                                ◄── NUEVA FILA  │
│  │ Distrito                 │   (columna derecha vacía)                       │
│  │ [____________________]   │                                                 │
│  └──────────────────────────┘                                                 │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Direccion                                                              │  │  ← full-row
│  │ [                                                                    ] │  │
│  │ [                                                                    ] │  │
│  │ [                                                                    ] │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  [Guardar cambios]  [Consultar identificacion]  [Desactivar cliente]          │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## Diseño visual

Todos los nuevos campos siguen el sistema visual existente. **No se introduce ningún token nuevo.**

| Decisión | Valor |
|---|---|
| Clase contenedora | `root-form-grid` (sin cambios) |
| Campos half-row | `<label>` sin modificador (comportamiento por defecto del grid) |
| Campos full-row | `<label class="root-form-grid__full">` (sólo para `Nombre *` y `Direccion`, sin cambios) |
| `maxlength` nuevos campos | `legalName`: 255 · `commercialName`: 255 · `province`: 100 · `canton`: 100 · `district`: 100 |
| `type` nuevos campos | `text` para todos |
| `required` | Ninguno de los cinco nuevos campos es obligatorio |
| Tono éxito credit form | `renderInlineMessage('…')` sin tono (default = clase `.message`) |
| Tono error credit form | `renderInlineMessage('…', 'error')` |
| Contenedor feedback | `<div class="clients-store-credit-msg" aria-live="polite"></div>` |

---

## Recomendaciones adicionales (fuera del scope estricto de TASK-008)

1. **`economicActivityCode` y `economicActivityName`** también están en `buildClientPayload.allowedFields` pero no son renderizados en el formulario. El handler `#clients-lookup-taxpayer-button` ya intenta poblarlos. Considerar exponerlos en una tarea siguiente con el mismo patrón (col + col, antes o después del bloque fiscal).

2. **Formulario de creación (`clients-create-form`)** tampoco expone `legalName`, `commercialName`, `province`, `canton`, `district`. Si la empresa los necesita al crear, deberían añadirse también en ese dialog en una tarea aparte. TASK-008 sólo alcanza el formulario de edición.

3. **`province`, `canton`, `district` como `<select>` vs `<input type="text"`**: actualmente el store dialog también usa `text` libre para estos campos. Mantener consistencia con ese precedente. Si en el futuro se quiere conectar a un catálogo de provincias/cantones de CR, ese cambio debe aplicarse simultáneamente en ambos formularios.

---

## Especificaciones para desarrollo

### Archivo 1 — `clients-admin.renderers.js`

**Cambio 1A:** insertar `legalName` + `commercialName` después de la fila `Identificacion | Tipo de documento`.

```
old_str (la línea de identificacion, última de las dos):
            <label><span>Tipo de documento</span><input name="documentType" ... /></label>
            <label><span>Telefono</span>...

new_str (insertar entre ambas):
            <label><span>Tipo de documento</span><input name="documentType" ... /></label>
            <label><span>Razon social</span><input name="legalName" type="text" maxlength="255" value="${rootShellUi.escapeHtml(client.legalName || '')}" /></label>
            <label><span>Nombre comercial</span><input name="commercialName" type="text" maxlength="255" value="${rootShellUi.escapeHtml(client.commercialName || '')}" /></label>
            <label><span>Telefono</span>...
```

**Cambio 1B:** insertar `province` + `canton` + `district` antes de la fila `Direccion`.

```
old_str (dirección existente):
            <label class="root-form-grid__full"><span>Direccion</span><textarea ...

new_str:
            <label><span>Provincia</span><input name="province" type="text" maxlength="100" value="${rootShellUi.escapeHtml(client.province || '')}" /></label>
            <label><span>Canton</span><input name="canton" type="text" maxlength="100" value="${rootShellUi.escapeHtml(client.canton || '')}" /></label>
            <label><span>Distrito</span><input name="district" type="text" maxlength="100" value="${rootShellUi.escapeHtml(client.district || '')}" /></label>
            <label class="root-form-grid__full"><span>Direccion</span><textarea ...
```

**Cambio 1C:** cambiar el contenedor del feedback de crédito de `<span>` a `<div>`.

```
old_str:
                <span class="clients-store-credit-msg" style="font-size:0.78rem;"></span>

new_str:
                <div class="clients-store-credit-msg" aria-live="polite"></div>
```

---

### Archivo 2 — `clients-admin.helpers.js`

**Cambio 2A:** eliminar `creditLimit` y `creditBalance` de `buildClientPayload`.

```
old_str:
  function buildClientPayload(formData) {
    const numericFields = new Set(['clientClassificationId', 'paymentDays', 'creditLimit', 'creditBalance']);
    const allowedFields = [
      ...
      'paymentType',
      'paymentDays',
      'creditLimit',
    ];

new_str:
  function buildClientPayload(formData) {
    const numericFields = new Set(['clientClassificationId', 'paymentDays']);
    const allowedFields = [
      ...
      'paymentType',
      'paymentDays',
    ];
```

> Aplicar con dos llamadas separadas a `replace_in_file`:
> 1. Reemplazar la línea de `numericFields`.
> 2. Reemplazar el cierre de `allowedFields` eliminando `'creditLimit',`.

---

### Archivo 3 — `clients-admin.js`

**Cambio 3A:** reemplazar las dos asignaciones `textContent` del bloque `clients-store-credit-form`.

```
old_str:
            try {
              await clientsApi.updateStoreCreditLimit(session, clientId, storeId, { creditLimit });
              if (msgEl) { msgEl.textContent = '✓ Guardado'; }
            } catch (err) {
              if (msgEl) { msgEl.textContent = err.message || 'Error'; }
            }

new_str:
            try {
              await clientsApi.updateStoreCreditLimit(session, clientId, storeId, { creditLimit });
              if (msgEl) { msgEl.innerHTML = rootShellUi.renderInlineMessage('Limite de credito guardado.'); }
            } catch (err) {
              if (msgEl) { msgEl.innerHTML = rootShellUi.renderInlineMessage(err.message || 'No se pudo guardar el limite de credito.', 'error'); }
            }
```

`rootShellUi` ya está en scope en `clients-admin.js` (línea 3: `const rootShellUi = rootShell.require('ui');`). No requiere ningún import adicional.

---

### Resumen de cambios por archivo

| Archivo | Tipo de cambio | Riesgo |
|---|---|---|
| `clients-admin.renderers.js` | Añadir 5 campos HTML + cambiar `<span>` a `<div>` | Muy bajo — sólo añade markup, no toca lógica |
| `clients-admin.helpers.js` | Eliminar 2 entradas de Set y 1 de Array | Muy bajo — no tiene efecto en runtime actual (formData siempre devuelve null para esos campos) |
| `clients-admin.js` | Cambiar `textContent` a `innerHTML` con `renderInlineMessage` | Muy bajo — misma semántica, helper ya en scope |

### Endpoint afectado

`PUT /api/clients/:id` — el payload resultante puede recibir ahora hasta 5 campos adicionales (`legalName`, `commercialName`, `province`, `canton`, `district`). El backend ya los acepta (están en `buildClientPayload.allowedFields` desde antes de TASK-008). No requiere cambio de contrato.

### Tests a revisar antes de merge

- `tests/public-surface-characterization.test.js` — verificar que no hay mención a `creditLimit` en el payload de cliente que deba actualizarse.
- `tests/browser-e2e.e2e.js` — verificar que el test de clients no depende del markup de `<span class="clients-store-credit-msg">`.
