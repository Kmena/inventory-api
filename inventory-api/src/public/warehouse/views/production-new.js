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

// Round to 3 decimal places, strip trailing zeros
function formatQty(num) {
  if (!Number.isFinite(num) || num === 0) { return '0'; }
  return parseFloat(num.toFixed(3)).toString();
}

// -----------------------------------------------------------------------
// Ingredients preview — computed client-side from already-loaded recipe data
// -----------------------------------------------------------------------

/**
 * Client-side mirror of the backend's deriveKgPerUnit helper.
 * Computes kg per commercial unit so we can scale PER_OUTPUT_KG recipes correctly.
 * Returns 1 as a safe fallback when conversion data is missing.
 *
 * @param {object|null|undefined} product
 * @returns {number}
 */
function clientKgPerUnit(product) {
  if (!product) { return 1; }
  const type    = product.presentationType;
  const content = Number(product.netContent ?? 0);
  const unit    = product.netContentUnit;
  const density = Number(product.density ?? 0);
  const factor  = Number(product.kgConversionFactor ?? 1);

  if (!type) { return factor || 1; }
  if (type === 'VOLUME') {
    const liters = unit === 'ML' ? content * 0.001 : content;
    return liters * density || 1;
  }
  if (type === 'MASS') {
    return (unit === 'G' ? content * 0.001 : content) || 1;
  }
  if (type === 'LENGTH') { return content * factor || 1; }
  if (type === 'COUNT')  { return factor || 1; }
  return 1;
}

/**
 * Build the inner HTML of the ingredient preview panel.
 * Returns empty string when there is nothing to show.
 *
 * For PER_OUTPUT_KG recipes the scaling factor is plannedOutputKg
 * (kg of finished product), NOT the raw unit count. Without this
 * correction the preview overstates or understates requirements.
 *
 * @param {object|undefined} recipe
 * @param {number} qty            - units ordered
 * @param {string|null} selectedVersionId
 * @param {object|null} selectedProduct  - full product record (may be null before selection)
 * @returns {string}
 */
function renderIngredientsPreview(recipe, qty, selectedVersionId, selectedProduct) {
  if (!recipe || !qty || qty <= 0) { return ''; }

  // Use the explicitly-selected version; fall back to latestApprovedVersionId
  const vId = selectedVersionId || recipe.latestApprovedVersionId;
  const approvedVersion = (recipe.versions || []).find(
    (v) => String(v.id) === String(vId),
  );
  if (!approvedVersion) { return ''; }

  const ingredients = approvedVersion.ingredients || [];
  if (!ingredients.length) {
    return `
      <div style="background:#f0f7ff;border:1px solid #bcd;border-radius:8px;padding:12px 14px">
        <p style="margin:0;font-size:.9em;color:#555">Esta receta no tiene insumos de materia prima definidos.</p>
      </div>`;
  }

  // PER_OUTPUT_KG: scale by total kg of finished product, not by unit count.
  const quantityBasis = approvedVersion.quantityBasis ?? 'PER_OUTPUT_KG';
  const kgPerUnit     = quantityBasis === 'PER_OUTPUT_KG' ? clientKgPerUnit(selectedProduct) : 1;
  const scalingQty    = quantityBasis === 'PER_OUTPUT_KG' ? kgPerUnit * qty : qty;
  const plannedKgNote = quantityBasis === 'PER_OUTPUT_KG'
    ? ` (≈ <strong>${escapeHtml(formatQty(scalingQty))}</strong> kg de producto terminado)`
    : '';

  const rows = ingredients.map((ing) => {
    const p = ing.product;
    const name   = p ? p.name : `Insumo #${ing.productId}`;
    const code   = p?.code ? ` (${escapeHtml(p.code)})` : '';
    const unit   = p?.unit ? ` <span style="color:#666;font-size:.85em">${escapeHtml(p.unit)}</span>` : '';
    const needed = formatQty(Number(ing.quantity) * scalingQty);
    return `<tr>
      <td style="padding:4px 0">${escapeHtml(name)}${code}</td>
      <td style="text-align:right;padding:4px 0;font-variant-numeric:tabular-nums">
        <strong>${escapeHtml(needed)}</strong>${unit}
      </td>
    </tr>`;
  }).join('');

  return `
    <div style="background:#f0f7ff;border:1px solid #bcd;border-radius:8px;padding:12px 14px">
      <p style="margin:0 0 8px;font-weight:600;font-size:.9em">
        📦 Materias primas para <strong>${escapeHtml(String(qty))}</strong> unidades${plannedKgNote}
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:.9em">
        <thead>
          <tr style="border-bottom:1px solid #bcd">
            <th style="text-align:left;padding:3px 0;color:#555">Insumo</th>
            <th style="text-align:right;padding:3px 0;color:#555">Cantidad requerida</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/**
 * Wire the live ingredient preview.
 * Reacts to recipe-select, product-select, and quantity-input changes.
 *
 * @param {HTMLElement} container
 * @param {Array<object>} recipes  - full recipe list (with .versions[].ingredients[])
 * @param {Array<object>} products - full product list (needed for PER_OUTPUT_KG kg conversion)
 */
function wireIngredientsPreview(container, recipes, products) {
  const recipeSelect   = /** @type {HTMLSelectElement|null} */ (container.querySelector('#pn-recipe'));
  const productSelect  = /** @type {HTMLSelectElement|null} */ (container.querySelector('#pn-product'));
  const versionSelect  = /** @type {HTMLSelectElement|null} */ (container.querySelector('#pn-recipe-version-id'));
  const qtyInput       = /** @type {HTMLInputElement|null}  */ (container.querySelector('#pn-quantity'));
  const preview        = /** @type {HTMLElement|null}       */ (container.querySelector('#pn-ingredients-preview'));
  if (!recipeSelect || !qtyInput || !preview) { return; }

  function update() {
    const recipe            = recipes.find((r) => String(r.id) === recipeSelect.value);
    const qty               = Number(qtyInput.value);
    const selectedVersionId = versionSelect?.value || null;
    const selectedProduct   = (products || []).find((p) => String(p.id) === productSelect?.value) || null;
    const html              = renderIngredientsPreview(recipe, qty, selectedVersionId, selectedProduct);
    if (html) {
      preview.style.display = '';
      preview.innerHTML = html;
    } else {
      preview.style.display = 'none';
      preview.innerHTML = '';
    }
  }

  recipeSelect.addEventListener('change', update);
  versionSelect?.addEventListener('change', update);
  productSelect?.addEventListener('change', update); // product affects PER_OUTPUT_KG scaling
  qtyInput.addEventListener('input', update);
  // Fire immediately if the user navigated back with values already set
  if (recipeSelect.value && qtyInput.value) { update(); }
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
            ${toOptions(recipes, 'id', (r) => `${r.code || r.name} — ${r.name}`, 'Seleccione una receta aprobada')}
          </select>
        </div>

        <div class="field" id="pn-version-field" style="display:none" aria-live="polite">
          <label for="pn-recipe-version-id">Version aprobada *</label>
          <select id="pn-recipe-version-id" required aria-required="true">
            <option value="">Seleccione version...</option>
          </select>
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

        <div id="pn-ingredients-preview" class="field" style="display:none" aria-live="polite"></div>

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
  const recipeSelect  = /** @type {HTMLSelectElement} */ (container.querySelector('#pn-recipe'));
  const versionSelect = /** @type {HTMLSelectElement} */ (container.querySelector('#pn-recipe-version-id'));
  const versionField  = /** @type {HTMLElement}       */ (container.querySelector('#pn-version-field'));
  if (!recipeSelect || !versionSelect || !versionField) { return; }

  function populateVersions() {
    const recipe   = recipes.find((r) => String(r.id) === recipeSelect.value);
    const approved = (recipe?.versions || []).filter((v) => v.status === 'APPROVED');
    if (!approved.length) {
      versionField.style.display = 'none';
      versionSelect.innerHTML    = '<option value="">Sin versiones aprobadas</option>';
      versionSelect.required     = false;
      return;
    }
    const opts = approved.map((v) => {
      const isLatest   = String(v.id) === String(recipe.latestApprovedVersionId);
      const stageCount = Array.isArray(v.stages) ? v.stages.length : '?';
      const label = `v${v.versionNumber} — ${stageCount} etapa(s)${isLatest ? ' · activa ✓' : ''}`;
      return `<option value="${escapeHtml(String(v.id))}">${escapeHtml(label)}</option>`;
    });
    versionSelect.innerHTML = opts.join('');
    versionSelect.value     = String(recipe.latestApprovedVersionId); // pre-selecciona la activa
    versionSelect.required  = true;
    versionField.style.display = '';
  }

  recipeSelect.addEventListener('change', populateVersions);
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
  wireIngredientsPreview(container, data.recipes, data.products);
  wireSubmit(container, api, session);
}

WarehouseShell.register('views.productionNew', { render });
})();
