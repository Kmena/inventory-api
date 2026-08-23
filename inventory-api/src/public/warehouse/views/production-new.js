/**
 * Warehouse SPA — Create Production Order form.
 *
 * Route: /warehouse/#production?action=new
 *
 * Backend contract (createProductionOrderSchema):
 *   Required:
 *     productId               bigint
 *     recipeVersionId         bigint (APPROVED version)
 *     quantity                number > 0
 *     originWarehouseId       bigint (must differ from destination)
 *     destinationWarehouseId  bigint
 *     responsibleUserId       bigint
 *     productionLotCode       string 1..100
 *   Optional:
 *     priority                int 0..999
 *     plannedDate / productionDate / expirationDate (ISO date or null)
 *     overrideJustification   string 10..1000 (only when using unapproved recipe)
 *
 * Permission: production.create
 */
(() => {
const WarehouseShell = /** @type {any} */ (window).WarehouseShell;

// -----------------------------------------------------------------------
// Small helpers (Zen of Python: simple is better than complex)
// -----------------------------------------------------------------------

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toOptions(items, valueKey, labelFn, placeholder = 'Seleccione...') {
  const opts = [`<option value="">${escapeHtml(placeholder)}</option>`];
  for (const item of items || []) {
    const value = item[valueKey];
    if (value === undefined || value === null) { continue; }
    opts.push(`<option value="${escapeHtml(String(value))}">${escapeHtml(labelFn(item))}</option>`);
  }
  return opts.join('');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// -----------------------------------------------------------------------
// Data loader — fetch every dropdown source in parallel
// -----------------------------------------------------------------------

async function loadFormData(api, session) {
  const [recipes, products, warehouses, users] = await Promise.all([
    api.listRecipes(session),
    api.listProducts(session),
    api.listWarehouses(session),
    api.listCompanyUsers(session),
  ]);
  // Only recipes that have an APPROVED version are usable for a production order
  const approvedRecipes = (recipes || []).filter((r) => r.latestApprovedVersionId != null);
  return { recipes: approvedRecipes, products, warehouses, users };
}

// -----------------------------------------------------------------------
// Rendering
// -----------------------------------------------------------------------

function renderForm(container, data) {
  const { recipes, products, warehouses, users } = data;

  container.innerHTML = `
    <div class="warehouse-section">
      <button type="button" class="wh-back-btn" id="prod-new-back">← Produccion</button>
      <h2 class="warehouse-section__title">Nueva orden de produccion</h2>
      <p class="wh-step-section__hint">Complete los datos para crear una orden. Solo se muestran recetas con al menos una version aprobada.</p>

      <form id="prod-new-form" novalidate>

        <div class="field">
          <label for="pn-recipe">Receta *</label>
          <select id="pn-recipe" required aria-required="true">
            ${toOptions(recipes, 'id', (r) => `${r.code || r.name} — ${r.name} (v${r.latestApprovedVersionNumber})`, 'Seleccione una receta aprobada')}
          </select>
          <input type="hidden" id="pn-recipe-version-id" />
        </div>

        <div class="field">
          <label for="pn-product">Producto a producir *</label>
          <select id="pn-product" required aria-required="true">
            ${toOptions(products, 'id', (p) => `${p.code || '—'} · ${p.name}`, 'Seleccione un producto')}
          </select>
        </div>

        <div class="field">
          <label for="pn-quantity">Cantidad a producir *</label>
          <input type="number" id="pn-quantity" min="0.001" step="0.001" required aria-required="true" placeholder="Ej. 100" />
        </div>

        <div class="field">
          <label for="pn-lot-code">Codigo de lote de produccion *</label>
          <input type="text" id="pn-lot-code" required aria-required="true" maxlength="100" placeholder="Ej. LOT-2025-001" />
        </div>

        <div class="field">
          <label for="pn-origin-wh">Bodega origen (materias primas) *</label>
          <select id="pn-origin-wh" required aria-required="true">
            ${toOptions(warehouses, 'id', (w) => w.name)}
          </select>
        </div>

        <div class="field">
          <label for="pn-destination-wh">Bodega destino (producto terminado) *</label>
          <select id="pn-destination-wh" required aria-required="true">
            ${toOptions(warehouses, 'id', (w) => w.name)}
          </select>
          <small style="color:#a33">La bodega destino debe ser distinta a la origen.</small>
        </div>

        <div class="field">
          <label for="pn-responsible">Responsable *</label>
          <select id="pn-responsible" required aria-required="true">
            ${toOptions(users, 'id', (u) => u.fullName || u.username || `Usuario #${u.id}`)}
          </select>
        </div>

        <div class="field">
          <label for="pn-planned-date">Fecha planificada (opcional)</label>
          <input type="date" id="pn-planned-date" min="${today()}" />
        </div>

        <div class="field">
          <label for="pn-priority">Prioridad (0-999, opcional)</label>
          <input type="number" id="pn-priority" min="0" max="999" step="1" placeholder="0 = normal" />
        </div>

        <p id="pn-error" class="wh-error-msg" role="alert" aria-live="assertive" hidden></p>

        <div class="wh-step-nav">
          <button type="button" class="secondary-button" id="pn-cancel">Cancelar</button>
          <button type="submit" class="primary-button" id="pn-submit">Crear orden ✓</button>
        </div>
      </form>
    </div>
  `;
}

// -----------------------------------------------------------------------
// Wire up form behaviour (auto-fill recipe version, submit, validate)
// -----------------------------------------------------------------------

function wireRecipeVersionAutoFill(container, recipes) {
  const recipeSelect = /** @type {HTMLSelectElement} */ (container.querySelector('#pn-recipe'));
  const versionHidden = /** @type {HTMLInputElement} */ (container.querySelector('#pn-recipe-version-id'));
  if (!recipeSelect || !versionHidden) { return; }
  recipeSelect.addEventListener('change', () => {
    const selected = recipes.find((r) => String(r.id) === recipeSelect.value);
    versionHidden.value = selected ? String(selected.latestApprovedVersionId) : '';
  });
}

function collectPayload(container) {
  const readValue = (id) => /** @type {HTMLInputElement | HTMLSelectElement} */ (container.querySelector(id))?.value?.trim() || '';
  const productId = readValue('#pn-product');
  const recipeVersionId = readValue('#pn-recipe-version-id');
  const quantity = Number(readValue('#pn-quantity'));
  const productionLotCode = readValue('#pn-lot-code');
  const originWarehouseId = readValue('#pn-origin-wh');
  const destinationWarehouseId = readValue('#pn-destination-wh');
  const responsibleUserId = readValue('#pn-responsible');
  const plannedDate = readValue('#pn-planned-date');
  const priorityRaw = readValue('#pn-priority');

  const payload = {
    productId,
    recipeVersionId,
    quantity,
    productionLotCode,
    originWarehouseId,
    destinationWarehouseId,
    responsibleUserId,
  };
  if (plannedDate) { payload.plannedDate = plannedDate; }
  if (priorityRaw !== '') { payload.priority = Number(priorityRaw); }
  return payload;
}

function validatePayload(payload) {
  const missing = [];
  for (const key of ['productId', 'recipeVersionId', 'productionLotCode', 'originWarehouseId', 'destinationWarehouseId', 'responsibleUserId']) {
    if (!payload[key]) { missing.push(key); }
  }
  if (missing.length > 0) { return `Complete los campos obligatorios: ${missing.join(', ')}.`; }
  if (!Number.isFinite(payload.quantity) || payload.quantity <= 0) {
    return 'La cantidad debe ser un numero mayor a 0.';
  }
  if (payload.originWarehouseId === payload.destinationWarehouseId) {
    return 'La bodega destino debe ser distinta a la bodega origen.';
  }
  return null;
}

function wireSubmit(container, api, session) {
  const form = /** @type {HTMLFormElement} */ (container.querySelector('#prod-new-form'));
  const submitBtn = /** @type {HTMLButtonElement} */ (container.querySelector('#pn-submit'));
  const errorEl = /** @type {HTMLElement} */ (container.querySelector('#pn-error'));
  const cancelBtn = container.querySelector('#pn-cancel');
  const backBtn = container.querySelector('#prod-new-back');
  const app = WarehouseShell.require('app');

  const goBack = () => { app.navigate('production'); };
  cancelBtn?.addEventListener('click', goBack);
  backBtn?.addEventListener('click', goBack);

  form?.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    errorEl.hidden = true;

    const payload = collectPayload(container);
    const validationError = validatePayload(payload);
    if (validationError) {
      errorEl.textContent = validationError;
      errorEl.hidden = false;
      return;
    }

    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.textContent = 'Creando...';

    try {
      const order = await api.createProductionOrder(session, payload);
      app.showToast('Orden de produccion creada ✓');
      const newId = order?.id;
      if (newId) {
        app.navigate('production', { id: String(newId) });
      } else {
        app.navigate('production');
      }
    } catch (err) {
      errorEl.textContent = err?.message || 'No se pudo crear la orden.';
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
}

// -----------------------------------------------------------------------
// Entry point
// -----------------------------------------------------------------------

async function render(container, session, _params) {
  const api = WarehouseShell.require('warehouseApi');
  const state = WarehouseShell.require('state');
  const app = WarehouseShell.require('app');

  const permissions = state.derivePermissions(session);
  if (!permissions.canCreateProduction) {
    container.innerHTML = `
      <div class="warehouse-section">
        <button type="button" class="wh-back-btn" id="prod-new-back">← Produccion</button>
        <p class="warehouse-error" role="alert">No tiene permisos para crear ordenes de produccion (se requiere production.create).</p>
      </div>
    `;
    container.querySelector('#prod-new-back')?.addEventListener('click', () => app.navigate('production'));
    return;
  }

  container.innerHTML = `
    <div class="warehouse-section">
      <p class="warehouse-message" aria-live="polite">Cargando datos del formulario...</p>
    </div>
  `;

  let data;
  try {
    data = await loadFormData(api, session);
  } catch (err) {
    container.innerHTML = `
      <div class="warehouse-section">
        <button type="button" class="wh-back-btn" id="prod-new-back">← Produccion</button>
        <p class="warehouse-error" role="alert">${escapeHtml(err?.message || 'No se pudieron cargar los datos del formulario.')}</p>
      </div>
    `;
    container.querySelector('#prod-new-back')?.addEventListener('click', () => app.navigate('production'));
    return;
  }

  if (data.recipes.length === 0) {
    container.innerHTML = `
      <div class="warehouse-section">
        <button type="button" class="wh-back-btn" id="prod-new-back">← Produccion</button>
        <h2 class="warehouse-section__title">Nueva orden de produccion</h2>
        <p class="wh-alert wh-alert--warning">No hay recetas con version aprobada. Debe aprobar al menos una version de receta antes de crear ordenes de produccion.</p>
      </div>
    `;
    container.querySelector('#prod-new-back')?.addEventListener('click', () => app.navigate('production'));
    return;
  }

  renderForm(container, data);
  wireRecipeVersionAutoFill(container, data.recipes);
  wireSubmit(container, api, session);
}

WarehouseShell.register('views.productionNew', { render });
})();
