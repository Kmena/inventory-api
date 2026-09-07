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

function describeQuantityBasis(quantityBasis) {
  if (quantityBasis === 'PER_FINISHED_UNIT') {
    return 'Por unidad terminada';
  }
  return 'Por kg de producto terminado';
}

function isCountOrUnitProduct(product, fallbackUnit = '') {
  return String(product?.presentationType || '').toUpperCase() === 'COUNT'
    || String(product?.unit || fallbackUnit).toUpperCase() === 'UN'
    || String(product?.netContentUnit || '').toUpperCase() === 'UN';
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
  const plannedOutputKg = kgPerUnit * qty;
  const scalingQty    = quantityBasis === 'PER_OUTPUT_KG' ? plannedOutputKg : qty;
  const plannedKgNote = quantityBasis === 'PER_OUTPUT_KG'
    ? ` (≈ <strong>${escapeHtml(formatQty(scalingQty))}</strong> kg de producto terminado)`
    : '';

  // FR-007: build per-product inputQuantityBasis map from stage inputs
  // so each ingredient can be scaled by its effective basis.
  const inputBasisByProductId = new Map();
  for (const stage of approvedVersion.stages || []) {
    for (const si of stage.stageInputs || []) {
      if (si.productId && si.inputQuantityBasis) {
        inputBasisByProductId.set(String(si.productId), si.inputQuantityBasis);
      }
    }
  }

  const hasCountOrUnitInputs = ingredients.some((ing) => isCountOrUnitProduct(ing.product, ing.unit));

  const rows = ingredients.map((ing) => {
    const p = ing.product;
    const name   = p ? p.name : `Insumo #${ing.productId}`;
    const code   = p?.code ? ` (${escapeHtml(p.code)})` : '';
    const unit   = p?.unit ? ` <span style="color:#666;font-size:.85em">${escapeHtml(p.unit)}</span>` : '';
    // FR-007, BR-002: use effective basis per ingredient
    const inputBasis = inputBasisByProductId.get(String(ing.productId)) ?? null;
    const effectiveBasis = inputBasis ?? quantityBasis;
    const ingScalingQty = effectiveBasis === 'PER_FINISHED_UNIT' ? qty : plannedOutputKg;
    const needed = formatQty(Number(ing.quantity) * ingScalingQty);
    const perUnitTag = (inputBasis === 'PER_FINISHED_UNIT' && quantityBasis !== 'PER_FINISHED_UNIT')
      ? ' <span style="font-size:.78em;color:#0a6c3b;font-weight:600">(por unidad)</span>'
      : '';
    return `<tr>
      <td style="padding:4px 0">${escapeHtml(name)}${code}</td>
      <td style="text-align:right;padding:4px 0;font-variant-numeric:tabular-nums">
        <strong>${escapeHtml(needed)}</strong>${unit}${perUnitTag}
      </td>
    </tr>`;
  }).join('');

  const quantityBasisLabel = describeQuantityBasis(quantityBasis);
  const countHint = hasCountOrUnitInputs
    ? `<p style="margin:0 0 8px;font-size:.82rem;color:#7a4b00">${escapeHtml(quantityBasis === 'PER_OUTPUT_KG'
      ? 'COUNT/UN detectado. Por kg de producto terminado revisa la operabilidad de cantidades discretas.'
      : 'COUNT/UN detectado. Por unidad terminada suele ser consistente para tapas y otros insumos discretos.')}</p>`
    : '';
  const unitHint = hasCountOrUnitInputs
    ? '<p style="margin:0 0 8px;font-size:.82rem;color:#555">La unidad UN normalmente se opera sin decimales.</p>'
    : '';

  return `
    <div style="background:#f0f7ff;border:1px solid #bcd;border-radius:8px;padding:12px 14px">
      <p style="margin:0 0 8px;font-weight:600;font-size:.9em">
        📦 Materias primas para <strong>${escapeHtml(String(qty))}</strong> unidades${plannedKgNote}
      </p>
      <p style="margin:0 0 8px;font-size:.82rem;color:#555">Base visible de la receta: <strong>${escapeHtml(quantityBasisLabel)}</strong>.</p>
      ${countHint}
      ${unitHint}
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
          <small id="pn-version-basis-hint" style="display:block;margin-top:4px;color:#555"></small>
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

        <div id="pn-recipe-product-warning" class="field" style="display:none" aria-live="polite"></div>

        <div id="pn-material-availability-preview" class="field" style="display:none" aria-live="polite"></div>

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
  const versionBasisHint = /** @type {HTMLElement|null} */ (container.querySelector('#pn-version-basis-hint'));
  if (!recipeSelect || !versionSelect || !versionField) { return; }

  function updateVersionBasisHint(recipe) {
    if (!versionBasisHint) return;
    const selectedVersion = (recipe?.versions || []).find((version) => String(version.id) === String(versionSelect.value));
    versionBasisHint.textContent = selectedVersion
      ? `Base visible de la receta: ${describeQuantityBasis(selectedVersion.quantityBasis || 'PER_OUTPUT_KG')}.`
      : '';
  }

  function populateVersions() {
    const recipe   = recipes.find((r) => String(r.id) === recipeSelect.value);
    const approved = (recipe?.versions || []).filter((v) => v.status === 'APPROVED');
    if (!approved.length) {
      versionField.style.display = 'none';
      versionSelect.innerHTML    = '<option value="">Sin versiones aprobadas</option>';
      versionSelect.required     = false;
      if (versionBasisHint) versionBasisHint.textContent = '';
      return;
    }
    const opts = approved.map((v) => {
      const isLatest   = String(v.id) === String(recipe.latestApprovedVersionId);
      const stageCount = Array.isArray(v.stages) ? v.stages.length : '?';
      const label = `v${v.versionNumber} — ${describeQuantityBasis(v.quantityBasis || 'PER_OUTPUT_KG')} — ${stageCount} etapa(s)${isLatest ? ' · activa ✓' : ''}`;
      return `<option value="${escapeHtml(String(v.id))}">${escapeHtml(label)}</option>`;
    });
    versionSelect.innerHTML = opts.join('');
    versionSelect.value     = String(recipe.latestApprovedVersionId); // pre-selecciona la activa
    versionSelect.required  = true;
    versionField.style.display = '';
    updateVersionBasisHint(recipe);
  }

  recipeSelect.addEventListener('change', populateVersions);
  versionSelect.addEventListener('change', () => {
    const recipe = recipes.find((entry) => String(entry.id) === recipeSelect.value);
    updateVersionBasisHint(recipe);
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

// FR-022, FR-023: Human-readable field label map for validation messages
const FIELD_LABELS = {
  productId: 'Producto a producir',
  recipeVersionId: 'Versión aprobada',
  productionLotCode: 'Código de lote',
  originWarehouseId: 'Bodega origen',
  destinationWarehouseId: 'Bodega destino',
  responsibleUserId: 'Responsable',
};

function validatePayload(payload) {
  const missing = [];
  for (const key of ['productId', 'recipeVersionId', 'productionLotCode', 'originWarehouseId', 'destinationWarehouseId', 'responsibleUserId']) {
    if (!payload[key]) { missing.push(FIELD_LABELS[key] || key); }
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

// FR-013, FR-014, FR-015: Recipe/product applicability guidance
function wireRecipeProductGuidance(container, recipes, products) {
  const recipeSelect = /** @type {HTMLSelectElement|null} */ (container.querySelector('#pn-recipe'));
  const productSelect = /** @type {HTMLSelectElement|null} */ (container.querySelector('#pn-product'));
  const warningRegion = /** @type {HTMLElement|null} */ (container.querySelector('#pn-recipe-product-warning'));
  if (!recipeSelect || !productSelect || !warningRegion) { return; }

  function checkApplicability() {
    warningRegion.style.display = 'none';
    warningRegion.innerHTML = '';

    const recipe = (recipes || []).find((r) => String(r.id) === recipeSelect.value);
    const product = (products || []).find((p) => String(p.id) === productSelect.value);
    if (!recipe || !product) { return; }

    // Check if product.recipeId matches the selected recipe
    if (product.recipeId && String(product.recipeId) === String(recipe.id)) {
      warningRegion.style.display = '';
      warningRegion.innerHTML = `
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:10px 14px;">
          <p style="margin:0;font-size:.88em;color:#166534;">✓ La receta <strong>${escapeHtml(recipe.name)}</strong> está asociada al producto <strong>${escapeHtml(product.name)}</strong>.</p>
        </div>`;
      return;
    }

    // Mismatch — show warning
    warningRegion.style.display = '';
    const productRecipe = product.recipeId
      ? (recipes || []).find((r) => String(r.id) === String(product.recipeId))
      : null;
    const expectedLabel = productRecipe
      ? `La receta asociada al producto es "${escapeHtml(productRecipe.name)}".`
      : 'El producto no tiene una receta directa asociada.';

    warningRegion.innerHTML = `
      <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:10px 14px;">
        <p style="margin:0 0 4px;font-weight:600;font-size:.88em;color:#854d0e;">⚠️ Receta y producto no coinciden directamente</p>
        <p style="margin:0;font-size:.84em;color:#713f12;">
          ${expectedLabel}
          La receta seleccionada es "${escapeHtml(recipe.name)}".
          Si esto es intencional, puede continuar. El backend validará la combinación.
        </p>
      </div>`;
  }

  recipeSelect.addEventListener('change', checkApplicability);
  productSelect.addEventListener('change', checkApplicability);
}

// FR-016, FR-018, FR-019: Pre-submit material availability preview
function wireMaterialAvailabilityPreview(container, api, session) {
  const productSelect = /** @type {HTMLSelectElement|null} */ (container.querySelector('#pn-product'));
  const recipeSelect = /** @type {HTMLSelectElement|null} */ (container.querySelector('#pn-recipe'));
  const versionSelect = /** @type {HTMLSelectElement|null} */ (container.querySelector('#pn-recipe-version-id'));
  const qtyInput = /** @type {HTMLInputElement|null} */ (container.querySelector('#pn-quantity'));
  const originSelect = /** @type {HTMLSelectElement|null} */ (container.querySelector('#pn-origin-wh'));
  const previewRegion = /** @type {HTMLElement|null} */ (container.querySelector('#pn-material-availability-preview'));
  if (!productSelect || !recipeSelect || !qtyInput || !originSelect || !previewRegion) { return; }

  let debounceTimer = null;

  function canPreview() {
    const versionId = versionSelect?.value || '';
    return productSelect.value && versionId && originSelect.value &&
      Number(qtyInput.value) > 0;
  }

  async function fetchPreview() {
    if (!canPreview()) {
      previewRegion.style.display = 'none';
      previewRegion.innerHTML = '';
      return;
    }

    previewRegion.style.display = '';
    previewRegion.innerHTML = `
      <div style="background:#f0f7ff;border:1px solid #bcd;border-radius:8px;padding:12px 14px">
        <p style="margin:0;font-size:.88em;color:#555">⏳ Consultando disponibilidad de materiales...</p>
      </div>`;

    try {
      const result = await api.previewMaterialAvailability(session, {
        productId: productSelect.value,
        recipeVersionId: versionSelect?.value || '',
        quantity: Number(qtyInput.value),
        originWarehouseId: originSelect.value,
      });

      if (!result || !Array.isArray(result.items) || result.items.length === 0) {
        previewRegion.innerHTML = `
          <div style="background:#f0f7ff;border:1px solid #bcd;border-radius:8px;padding:12px 14px">
            <p style="margin:0;font-size:.88em;color:#555">Sin requerimientos de material para esta combinación.</p>
          </div>`;
        return;
      }

      const rows = result.items.map((item) => {
        const isMissing = item.missing > 0.000001;
        const rowStyle = isMissing ? 'color:#991b1b;font-weight:600' : '';
        return `<tr style="${rowStyle}">
          <td style="padding:4px 0">${escapeHtml(item.productName || `#${item.productId}`)}</td>
          <td style="text-align:right;padding:4px 0">${escapeHtml(formatQty(item.required))}</td>
          <td style="text-align:right;padding:4px 0">${escapeHtml(formatQty(item.available))}</td>
          <td style="text-align:right;padding:4px 0">${isMissing ? escapeHtml(formatQty(item.missing)) : '—'}</td>
        </tr>`;
      }).join('');

      const shortageNote = result.hasShortage
        ? `<p style="margin:8px 0 0;font-size:.84em;color:#991b1b;font-weight:600">
            ⚠️ Hay faltantes. Considere cambiar la bodega origen, ajustar cantidad o solicitar un override.
          </p>`
        : `<p style="margin:8px 0 0;font-size:.84em;color:#166534">
            ✓ Stock suficiente en la bodega seleccionada.
          </p>`;

      const bgColor = result.hasShortage ? '#fef2f2' : '#f0fdf4';
      const borderColor = result.hasShortage ? '#fca5a5' : '#86efac';

      previewRegion.innerHTML = `
        <div style="background:${bgColor};border:1px solid ${borderColor};border-radius:8px;padding:12px 14px">
          <p style="margin:0 0 8px;font-weight:600;font-size:.9em">📦 Disponibilidad de materiales (vista previa)</p>
          <table style="width:100%;border-collapse:collapse;font-size:.88em">
            <thead>
              <tr style="border-bottom:1px solid #bcd">
                <th style="text-align:left;padding:3px 0;color:#555">Insumo</th>
                <th style="text-align:right;padding:3px 0;color:#555">Requerido</th>
                <th style="text-align:right;padding:3px 0;color:#555">Disponible</th>
                <th style="text-align:right;padding:3px 0;color:#555">Faltante</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          ${shortageNote}
          <p style="margin:4px 0 0;font-size:.78em;color:#888">Vista previa. La validación final ocurre al crear la orden.</p>
        </div>`;
    } catch (err) {
      previewRegion.innerHTML = `
        <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:12px 14px">
          <p style="margin:0;font-size:.88em;color:#991b1b">
            No se pudo consultar disponibilidad: ${escapeHtml(err?.message || 'Error de red')}.
          </p>
        </div>`;
    }
  }

  function schedulePreview() {
    if (debounceTimer) { clearTimeout(debounceTimer); }
    debounceTimer = setTimeout(fetchPreview, 600);
  }

  productSelect.addEventListener('change', schedulePreview);
  recipeSelect.addEventListener('change', schedulePreview);
  if (versionSelect) { versionSelect.addEventListener('change', schedulePreview); }
  qtyInput.addEventListener('input', schedulePreview);
  originSelect.addEventListener('change', schedulePreview);
}

// FR-024, FR-025: Editable lot-code suggestion using PROD-YYYYMMDD-<PRODUCTCODE>-001
function wireLotCodeSuggestion(container, products) {
  const productSelect = /** @type {HTMLSelectElement|null} */ (container.querySelector('#pn-product'));
  const lotInput = /** @type {HTMLInputElement|null} */ (container.querySelector('#pn-lot-code'));
  if (!productSelect || !lotInput) { return; }

  let userHasEdited = false;
  lotInput.addEventListener('input', () => { userHasEdited = lotInput.value.trim() !== ''; });

  function suggestLotCode() {
    if (userHasEdited && lotInput.value.trim() !== '') { return; }
    const product = (products || []).find((p) => String(p.id) === productSelect.value);
    if (!product) { return; }
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const code = product.code || product.name?.substring(0, 8)?.toUpperCase().replace(/\s+/g, '') || 'PROD';
    lotInput.value = `PROD-${dateStr}-${code}-001`;
  }

  productSelect.addEventListener('change', suggestLotCode);
}

// FR-026: Preselect current user as responsible when in company user list
function preselectResponsible(container, session, users) {
  const responsibleSelect = /** @type {HTMLSelectElement|null} */ (container.querySelector('#pn-responsible'));
  if (!responsibleSelect || !session?.user?.id) { return; }

  const currentUserId = String(session.user.id);
  const match = (users || []).find((u) => String(u.id) === currentUserId);
  if (match) {
    responsibleSelect.value = currentUserId;
  }
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
  wireRecipeProductGuidance(container, data.recipes, data.products);
  wireMaterialAvailabilityPreview(container, api, session);
  wireLotCodeSuggestion(container, data.products);
  preselectResponsible(container, session, data.users);
  wireSubmit(container, api, session);
}

WarehouseShell.register('views.productionNew', { render });
})();
