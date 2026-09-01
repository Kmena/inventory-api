/**
 * Root shell — Production Planner view.
 *
 * Lists every product that has an assigned recipe (`recipeId != null`) with
 * its current on-hand quantity, min/max stock thresholds and a computed
 * severity badge. Each row exposes a "Generar orden" action that opens an
 * inline dialog to POST /api/production/orders (createProductionOrderSchema).
 *
 * Route:      /root/#produccion_planificador
 * Guard:      guards.isCompanyAdmin (see manifest.js)
 * Backend:    createProductionOrderSchema — 7 required fields.
 */
(function attachRootShellProductionPlannerView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;

  // NOTE: dependencies are resolved lazily inside mount() so this view can
  // be loaded in any script order without breaking the shell bootstrap when
  // a sibling API script hasn't executed yet. Regression-tested via
  // tests/root-shell-production-planner.test.js.
  function resolveDeps() {
    return {
      productsApi: rootShell.require('productsApi'),
      productionAdminApi: rootShell.require('productionAdminApi'),
      warehousesApi: rootShell.require('warehousesApi'),
      usersApi: rootShell.require('usersApi'),
      recipesApi: rootShell.require('recipesApi'),
      rootShellUi: rootShell.require('ui'),
    };
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  // -------------------------------------------------------------------
  // Domain helpers (pure) — status classification and suggested batch
  // -------------------------------------------------------------------

  function toNum(value) {
    if (value === null || value === undefined || value === '') { return null; }
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Classifies stock health into one of four buckets.
   * @param {number|null} qty
   * @param {number|null} min
   * @param {number|null} max
   */
  function classifyStock(qty, min, max) {
    const q = qty ?? 0;
    if (min != null && q < min) { return 'critical'; }
    if (min != null && q < min * 1.2) { return 'low'; }
    if (max != null && q > max) { return 'over'; }
    return 'ok';
  }

  const STATUS_LABELS = {
    critical: 'Bajo mínimo',
    low: 'Cerca del mínimo',
    ok: 'En rango',
    over: 'Sobre-stock',
  };
  const STATUS_CLASS = {
    critical: 'badge badge-danger',
    low: 'badge badge-warning',
    ok: 'badge badge-success',
    over: 'badge badge-info',
  };
  const STATUS_ORDER = { critical: 0, low: 1, ok: 2, over: 3 };

  /**
   * Suggests how much to produce to bring stock to a healthy level.
   * Rule of thumb: aim for max (or minStock * 1.5 if max is missing).
   */
  function suggestedBatch(qty, min, max) {
    const q = qty ?? 0;
    const target = max != null ? max : (min != null ? min * 1.5 : null);
    if (target == null || target <= q) { return null; }
    return Math.ceil(target - q);
  }

  function formatQty(value) {
    if (value === null || value === undefined) { return '—'; }
    const n = Number(value);
    if (!Number.isFinite(n)) { return '—'; }
    // Trim trailing zeros (Decimal(14,3) tends to send 100.000)
    return n.toLocaleString('es-CR', { maximumFractionDigits: 3 });
  }

  /**
   * TASK-006: Implementación cliente de la misma lógica que product-size-conversion.helper.js.
   * Derivar kg por unidad comercial a partir de los campos de presentación del producto.
   * Returns null cuando faltan datos requeridos (se oculta el preview en ese caso).
   *
   * @param {object} product - Objeto con campos de conversión del productStockMap.
   * @returns {number|null}
   */
  function deriveKgPerUnitClient(product) {
    const { presentationType, netContent, netContentUnit, density, kgConversionFactor } = product;

    if (!presentationType) {
      // Legado: usar kgConversionFactor si existe, sino 1.
      return Number(kgConversionFactor != null ? kgConversionFactor : 1);
    }

    if (presentationType === 'VOLUME') {
      if (!netContent || netContent <= 0) return null;
      if (!netContentUnit || (netContentUnit !== 'ML' && netContentUnit !== 'L')) return null;
      if (!density || density <= 0) return null;
      const contentInLiters = netContentUnit === 'ML' ? netContent * 0.001 : netContent;
      return contentInLiters * density;
    }

    if (presentationType === 'MASS') {
      if (!netContent || netContent <= 0) return null;
      if (!netContentUnit || (netContentUnit !== 'G' && netContentUnit !== 'KG')) return null;
      return netContentUnit === 'G' ? netContent * 0.001 : netContent;
    }

    if (presentationType === 'LENGTH') {
      if (!netContent || netContent <= 0) return null;
      if (!kgConversionFactor || kgConversionFactor <= 0) return null;
      return netContent * kgConversionFactor;
    }

    if (presentationType === 'COUNT') {
      return Number(kgConversionFactor != null ? kgConversionFactor : 1);
    }

    return null;
  }

  /**
   * Renders a compact material-availability panel for the planner dialog.
   * Compares required quantity (ingredient.quantity × qty) against available
   * stock from productStockMap. Returns empty string if no data to show.
   *
   * @param {Array<object>} ingredients - from approved recipe version
   * @param {number}        qty         - production quantity entered by user
   * @param {Map<string,object>} productStockMap - productId → { quantity, name, unit, code }
   */
  function renderIngredientAvailability(ingredients, qty, productStockMap) {
    if (!ingredients || !ingredients.length || !qty || qty <= 0) { return ''; }

    let allOk = true;
    const rows = ingredients.map((ing) => {
      const stock   = productStockMap.get(String(ing.productId)) || {};
      const avail   = stock.quantity ?? 0;
      const needed  = Number(ing.quantity) * qty;
      const unit    = ing.product?.unit   || stock.unit || '';
      const name    = ing.product?.name   || stock.name || `Insumo #${ing.productId}`;
      const code    = ing.product?.code   || stock.code || '';
      const ok      = avail >= needed - 0.0001;
      if (!ok) { allOk = false; }
      const diff    = formatQty(needed - avail);
      const status  = ok
        ? '<span style="color:green">✓</span>'
        : `<span style="color:#c00">✗ falta ${escapeHtml(diff)} ${escapeHtml(unit)}</span>`;
      return `<tr>
        <td style="padding:3px 4px">${escapeHtml(name)}${code ? ` <small class="muted">(${escapeHtml(code)})</small>` : ''}</td>
        <td style="text-align:right;padding:3px 4px;white-space:nowrap">${escapeHtml(formatQty(needed))} ${escapeHtml(unit)}</td>
        <td style="text-align:right;padding:3px 4px;white-space:nowrap">${escapeHtml(formatQty(avail))} ${escapeHtml(unit)}</td>
        <td style="padding:3px 4px">${status}</td>
      </tr>`;
    }).join('');

    const bg     = allOk ? '#e6f4ea' : '#fff3cd';
    const border = allOk ? '#4caf50' : '#ffc107';
    const title  = allOk ? '✅ Suficiente materia prima' : '⚠️ Stock insuficiente para algunos insumos';

    return `
      <div style="background:${bg};border:1px solid ${border};border-radius:6px;padding:10px 12px;font-size:.87em">
        <strong style="display:block;margin-bottom:6px">${title}</strong>
        <table style="width:100%;min-width:480px;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:1px solid rgba(0,0,0,.12)">
              <th style="text-align:left;padding:2px 6px;font-weight:600;color:#555">Insumo</th>
              <th style="text-align:right;padding:2px 6px;font-weight:600;color:#555">Requerido</th>
              <th style="text-align:right;padding:2px 6px;font-weight:600;color:#555">Disponible</th>
              <th style="padding:2px 6px;font-weight:600;color:#555">Estado</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // -------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------

  async function loadPlannerData(session, deps) {
    const products = await deps.productsApi.listProducts(session);
    const list = Array.isArray(products) ? products : (products?.items || []);

    // Build stock map for ALL products so the dialog can check ingredient availability.
    const productStockMap = new Map();
    for (const p of list) {
      if (p && p.id != null) {
        productStockMap.set(String(p.id), {
          quantity: toNum(p.quantity) ?? 0,
          name: p.name || `Producto #${p.id}`,
          unit: p.unit || '',
          code: p.code || '',
          // TASK-006: campos de conversión para el preview de kg planeados.
          presentationType: p.presentationType || null,
          netContent: toNum(p.netContent),
          netContentUnit: p.netContentUnit || null,
          density: toNum(p.density),
          kgConversionFactor: toNum(p.kgConversionFactor),
        });
      }
    }

    const withRecipe = list.filter((p) => p && p.recipeId != null && p.isActive !== false);
    const rows = withRecipe.map((p) => {
      const qty = toNum(p.quantity);
      const min = toNum(p.minStock);
      const max = toNum(p.maxStock);
      return {
        id: p.id,
        code: p.code || '—',
        name: p.name || `Producto #${p.id}`,
        unit: p.unit || '',
        recipeId: p.recipeId,
        quantity: qty,
        minStock: min,
        maxStock: max,
        status: classifyStock(qty, min, max),
        suggested: suggestedBatch(qty, min, max),
      };
    }).sort((a, b) => {
      const sa = STATUS_ORDER[a.status];
      const sb = STATUS_ORDER[b.status];
      if (sa !== sb) { return sa - sb; }
      return a.name.localeCompare(b.name);
    });
    return { rows, productStockMap };
  }

  // -------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------

  function render() {
    return `
      <section class="root-hero" aria-labelledby="root-view-title">
        <p class="eyebrow">Produccion</p>
        <h2 id="root-view-title">Planificador de produccion</h2>
        <p class="muted">Productos con formula, existencias y limites de inventario. Genera ordenes de produccion con un click cuando el stock lo requiera.</p>
      </section>

      <section class="routes-page products-page production-planner-page">
        <div id="planner-page-message" aria-live="polite"></div>

        <article class="card root-card">
          <div class="page-header">
            <div>
              <h3>Productos con formula</h3>
              <p id="planner-summary" class="muted">Cargando datos...</p>
            </div>
            <div class="action-row compact-action-row">
              <button id="planner-refresh-button" class="secondary-button" type="button">Actualizar</button>
            </div>
          </div>

          <div id="planner-table-region" aria-live="polite"></div>
        </article>

        <dialog id="planner-order-dialog" class="planner-dialog" aria-labelledby="planner-dialog-title" style="max-width:720px;width:calc(100% - 32px);max-height:90vh;overflow-y:auto;border:none;border-radius:12px;padding:24px;box-shadow:0 8px 32px rgba(0,0,0,0.2)">
          <form id="planner-order-form" method="dialog">
            <header style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px">
              <div>
                <p class="eyebrow" style="margin:0">Nueva orden</p>
                <h3 id="planner-dialog-title" style="margin:4px 0 0">Generar orden de produccion</h3>
                <p id="planner-dialog-product" class="muted" style="margin:4px 0 0"></p>
              </div>
              <button type="button" class="secondary-button" id="planner-dialog-close" aria-label="Cerrar">✕</button>
            </header>

            <div id="planner-dialog-error" class="message message-error" role="alert" hidden></div>

            <label style="display:block;margin-bottom:12px">
              <span>Cantidad a producir *</span>
              <input type="number" id="planner-field-quantity" min="0.001" step="0.001" required />
            </label>
            <!-- TASK-006: preview estimado de kg planeados (solo visible cuando el producto
                 tiene presentationType configurado y la cantidad es válida). -->
            <p id="planner-kg-preview"
               aria-live="polite"
               class="muted"
               style="display:none;margin:-6px 0 12px 0;font-size:0.875rem">
              Kg planeados: <strong id="planner-kg-preview-value">—</strong>
            </p>
            <label style="display:block;margin-bottom:12px">
              <span>Codigo de lote de produccion *</span>
              <input type="text" id="planner-field-lot-code" maxlength="100" required placeholder="Ej. LOT-2025-001" />
            </label>
            <label style="display:block;margin-bottom:12px">
              <span>Bodega origen (materias primas) *</span>
              <select id="planner-field-origin-wh" required></select>
            </label>
            <label style="display:block;margin-bottom:12px">
              <span>Bodega destino (producto terminado) *</span>
              <select id="planner-field-destination-wh" required></select>
            </label>
            <label style="display:block;margin-bottom:12px">
              <span>Responsable *</span>
              <select id="planner-field-responsible" required></select>
            </label>
            <label style="display:block;margin-bottom:12px">
              <span>Fecha planificada (opcional)</span>
              <input type="date" id="planner-field-planned-date" />
            </label>
            <label style="display:block;margin-bottom:12px" id="planner-version-field">
              <span>Version de receta *</span>
              <select id="planner-field-recipe-version" required></select>
            </label>

            <div id="planner-ingredients-preview" aria-live="polite" style="margin-bottom:12px;overflow-x:auto;max-height:260px;overflow-y:auto"></div>

            <footer style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
              <button type="button" class="secondary-button" id="planner-dialog-cancel">Cancelar</button>
              <button type="submit" class="primary-button" id="planner-dialog-submit">Crear orden ✓</button>
            </footer>
          </form>
        </dialog>
      </section>
    `;
  }

  function renderTable(container, rows) {
    if (rows.length === 0) {
      container.innerHTML = '<p class="muted" style="padding:16px">No hay productos con formula asignada. Asigna una receta a un producto en el modulo de Productos para empezar.</p>';
      return;
    }

    const rowsHtml = rows.map((row) => {
      const badge = `<span class="${STATUS_CLASS[row.status]}">${escapeHtml(STATUS_LABELS[row.status])}</span>`;
      const suggested = row.suggested != null
        ? `<small class="muted">Sugerido: ${escapeHtml(formatQty(row.suggested))}</small>`
        : '';
      return `
        <tr>
          <td>
            <strong>${escapeHtml(row.name)}</strong><br />
            <small class="muted">${escapeHtml(row.code)}${row.unit ? ` · ${escapeHtml(row.unit)}` : ''}</small>
          </td>
          <td style="text-align:right">${escapeHtml(formatQty(row.quantity))}</td>
          <td style="text-align:right">${escapeHtml(formatQty(row.minStock))}</td>
          <td style="text-align:right">${escapeHtml(formatQty(row.maxStock))}</td>
          <td>${badge}</td>
          <td style="text-align:right">
            <button type="button" class="primary-button planner-generate-btn"
                    data-product-id="${escapeHtml(String(row.id))}"
                    data-recipe-id="${escapeHtml(String(row.recipeId))}"
                    data-product-name="${escapeHtml(row.name)}"
                    data-suggested="${row.suggested != null ? row.suggested : ''}">
              Generar orden
            </button>
            <div style="margin-top:4px">${suggested}</div>
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div class="table-scroll" style="overflow-x:auto">
        <table class="root-table" style="width:100%;border-collapse:collapse">
          <thead>
            <tr>
              <th style="text-align:left">Producto</th>
              <th style="text-align:right">Existencia</th>
              <th style="text-align:right">Minimo</th>
              <th style="text-align:right">Maximo</th>
              <th style="text-align:left">Estado</th>
              <th style="text-align:right">Accion</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  // -------------------------------------------------------------------
  // Dialog wiring
  // -------------------------------------------------------------------

  /**
   * Populates a native <select> element from a list of `{ id, label }` items.
   * Uses a single placeholder to keep the "required" contract at the browser level.
   */
  function fillSelect(selectEl, items, placeholder) {
    if (!selectEl) { return; }
    const opts = [`<option value="">${escapeHtml(placeholder)}</option>`];
    for (const item of items) {
      opts.push(`<option value="${escapeHtml(String(item.id))}">${escapeHtml(item.label)}</option>`);
    }
    selectEl.innerHTML = opts.join('');
  }

  function setDialogError(dialog, message) {
    const errorEl = dialog.querySelector('#planner-dialog-error');
    if (!errorEl) { return; }
    if (!message) { errorEl.hidden = true; errorEl.textContent = ''; return; }
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

  function collectDialogPayload(dialog, ctx) {
    const value = (id) => /** @type {HTMLInputElement|HTMLSelectElement} */ (dialog.querySelector(id))?.value?.trim() || '';
    const payload = {
      productId: ctx.productId,
      recipeVersionId: value('#planner-field-recipe-version') || ctx.recipeVersionId,
      quantity: Number(value('#planner-field-quantity')),
      productionLotCode: value('#planner-field-lot-code'),
      originWarehouseId: value('#planner-field-origin-wh'),
      destinationWarehouseId: value('#planner-field-destination-wh'),
      responsibleUserId: value('#planner-field-responsible'),
    };
    const plannedDate = value('#planner-field-planned-date');
    if (plannedDate) { payload.plannedDate = plannedDate; }
    return payload;
  }

  function validateDialogPayload(payload) {
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

  async function openDialog(container, session, dialogCtx, refs, dialogState, deps, productStockMap) {
    const dialog = /** @type {HTMLDialogElement} */ (container.querySelector('#planner-order-dialog'));
    if (!dialog) { return; }

    // Populate dropdowns lazily so the initial page render stays cheap.
    if (!dialogState.dropdownsLoaded) {
      try {
        const [warehouses, users] = await Promise.all([
          deps.warehousesApi.listCompanyWarehouses(session),
          deps.usersApi.listCompanyUsers(session),
        ]);
        const whList = (Array.isArray(warehouses) ? warehouses : warehouses?.items || [])
          .map((w) => ({ id: w.id, label: w.name || `Bodega #${w.id}` }));
        const userList = (Array.isArray(users) ? users : users?.items || [])
          .map((u) => ({ id: u.id, label: u.fullName || u.username || `Usuario #${u.id}` }));
        fillSelect(dialog.querySelector('#planner-field-origin-wh'), whList, 'Seleccione bodega origen');
        fillSelect(dialog.querySelector('#planner-field-destination-wh'), whList, 'Seleccione bodega destino');
        fillSelect(dialog.querySelector('#planner-field-responsible'), userList, 'Seleccione responsable');
        dialogState.dropdownsLoaded = true;
      } catch (err) {
        setDialogError(dialog, err?.message || 'No se pudieron cargar los datos del formulario.');
        return;
      }
    }

    // Resolve approved versions lazily; cache per recipeId.
    let cached = dialogState.recipeVersionCache.get(String(dialogCtx.recipeId));
    if (!cached) {
      try {
        const recipe = await deps.recipesApi.getRecipe(session, dialogCtx.recipeId);
        const vId = recipe?.latestApprovedVersionId;
        if (!vId) {
          setDialogError(dialog, 'La receta de este producto no tiene una version aprobada. Aprueba una version antes de crear la orden.');
          dialog.showModal();
          return;
        }
        const approvedVersions = (recipe?.versions || []).filter((v) => v.status === 'APPROVED');
        cached = { defaultVersionId: vId, approvedVersions };
        dialogState.recipeVersionCache.set(String(dialogCtx.recipeId), cached);
      } catch (err) {
        setDialogError(dialog, err?.message || 'No se pudo cargar la receta.');
        return;
      }
    }
    dialogCtx.recipeVersionId = cached.defaultVersionId;
    refs.currentCtx = dialogCtx;

    // Populate version select with all approved versions.
    const versionSelect = /** @type {HTMLSelectElement} */ (dialog.querySelector('#planner-field-recipe-version'));
    if (versionSelect) {
      versionSelect.innerHTML = cached.approvedVersions.map((v) => {
        const isDefault = String(v.id) === String(cached.defaultVersionId);
        const label = `v${v.versionNumber} — ${(v.stages || []).length} etapa(s)${isDefault ? ' · activa ✓' : ''}`;
        return `<option value="${escapeHtml(String(v.id))}"${isDefault ? ' selected' : ''}>${escapeHtml(label)}</option>`;
      }).join('');
    }

    // Prefill product name + suggested quantity.
    const productLabel = dialog.querySelector('#planner-dialog-product');
    if (productLabel) { productLabel.textContent = dialogCtx.productName; }
    const qtyInput = /** @type {HTMLInputElement} */ (dialog.querySelector('#planner-field-quantity'));
    if (qtyInput) { qtyInput.value = dialogCtx.suggested ? String(dialogCtx.suggested) : ''; }

    // Wire live ingredient-availability preview (reacts to qty AND version changes).
    const ingPreview = dialog.querySelector('#planner-ingredients-preview');

    // TASK-006: refs al preview de kg planeados.
    const kgPreviewEl = dialog.querySelector('#planner-kg-preview');
    const kgPreviewValueEl = dialog.querySelector('#planner-kg-preview-value');
    const plannerProduct = productStockMap.get(String(dialogCtx.productId));

    /**
     * Actualiza el indicador de kg planeados debajo del input de cantidad.
     * Solo se muestra cuando el producto tiene presentationType configurado
     * y la cantidad ingresada es un número positivo válido.
     */
    function updateKgPreview() {
      if (!kgPreviewEl || !kgPreviewValueEl || !plannerProduct) {
        if (kgPreviewEl) kgPreviewEl.style.display = 'none';
        return;
      }
      // Productos legacy (sin presentationType) solo muestran el preview si tienen kgConversionFactor
      // distinto de 1 o si explicitamente tienen el tipo definido.
      if (!plannerProduct.presentationType) {
        kgPreviewEl.style.display = 'none';
        return;
      }
      const qty = Number(qtyInput?.value || 0);
      const kgPerUnit = deriveKgPerUnitClient(plannerProduct);
      if (kgPerUnit === null || !Number.isFinite(qty) || qty <= 0) {
        kgPreviewEl.style.display = 'none';
        return;
      }
      kgPreviewValueEl.textContent = (qty * kgPerUnit).toFixed(3) + ' kg';
      kgPreviewEl.style.display = '';
    }

    function updatePreview() {
      const qty    = Number(qtyInput?.value || 0);
      const selVer = cached.approvedVersions.find((v) => String(v.id) === (versionSelect?.value || cached.defaultVersionId));
      const ings   = selVer?.ingredients || [];

      // PER_OUTPUT_KG recipes express ingredient quantities per kg of finished
      // product, so we must scale by (kgPerUnit × qty), not by unit count alone.
      // Passing raw qty would multiply by units and over-report requirements.
      const quantityBasis = selVer?.quantityBasis ?? 'PER_OUTPUT_KG';
      const kgPerUnit     = deriveKgPerUnitClient(plannerProduct) ?? 1;
      const scalingQty    = quantityBasis === 'PER_OUTPUT_KG' ? kgPerUnit * qty : qty;

      if (ingPreview) { ingPreview.innerHTML = renderIngredientAvailability(ings, scalingQty, productStockMap); }
      updateKgPreview();
    }
    if (dialogState.currentQtyListener && qtyInput) {
      qtyInput.removeEventListener('input', dialogState.currentQtyListener);
    }
    dialogState.currentQtyListener = updatePreview;
    qtyInput?.addEventListener('input', updatePreview);
    versionSelect?.addEventListener('change', updatePreview);

    setDialogError(dialog, '');
    updatePreview();
    dialog.showModal();
  }

  function wireDialog(container, session, refs, dialogState, deps, onSuccess) {
    const dialog = /** @type {HTMLDialogElement} */ (container.querySelector('#planner-order-dialog'));
    const form = /** @type {HTMLFormElement} */ (container.querySelector('#planner-order-form'));
    const cancelBtn = container.querySelector('#planner-dialog-cancel');
    const closeBtn = container.querySelector('#planner-dialog-close');
    const submitBtn = /** @type {HTMLButtonElement} */ (container.querySelector('#planner-dialog-submit'));

    const closeDialog = () => { if (dialog?.open) { dialog.close(); } };
    cancelBtn?.addEventListener('click', closeDialog);
    closeBtn?.addEventListener('click', closeDialog);

    form?.addEventListener('submit', async (evt) => {
      evt.preventDefault();
      const ctx = refs.currentCtx;
      if (!ctx) { return; }
      const payload = collectDialogPayload(dialog, ctx);
      const validationError = validateDialogPayload(payload);
      if (validationError) {
        setDialogError(dialog, validationError);
        return;
      }
      submitBtn.disabled = true;
      const originalLabel = submitBtn.textContent;
      submitBtn.textContent = 'Creando...';
      setDialogError(dialog, '');
      try {
        await deps.productionAdminApi.createProductionOrder(session, payload);
        closeDialog();
        if (typeof onSuccess === 'function') { onSuccess(); }
      } catch (err) {
        setDialogError(dialog, err?.message || 'No se pudo crear la orden.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      }
    });
  }

  // -------------------------------------------------------------------
  // Mount
  // -------------------------------------------------------------------

  async function mount(container, session, helpers = {}) {
    const deps = resolveDeps();
    const setShellStatus = typeof helpers.setShellStatus === 'function' ? helpers.setShellStatus : () => {};
    const pageMessage = container.querySelector('#planner-page-message');
    const summary = container.querySelector('#planner-summary');
    const tableRegion = container.querySelector('#planner-table-region');
    const refreshBtn = container.querySelector('#planner-refresh-button');

    const dialogState = {
      dropdownsLoaded: false,
      recipeVersionCache: new Map(),
      currentQtyListener: null,
    };
    const refs = { currentCtx: null };
    let productStockMap = new Map();

    async function refresh() {
      setShellStatus('Cargando planificador...');
      if (pageMessage) { pageMessage.innerHTML = ''; }
      try {
        const result = await loadPlannerData(session, deps);
        const { rows } = result;
        productStockMap = result.productStockMap; // refresh for next dialog open
        if (summary) {
          const critical = rows.filter((r) => r.status === 'critical').length;
          const low = rows.filter((r) => r.status === 'low').length;
          summary.textContent = `${rows.length} productos con formula · ${critical} bajo minimo · ${low} cerca del minimo.`;
        }
        renderTable(tableRegion, rows);
        setShellStatus('');
      } catch (err) {
        if (pageMessage) {
          pageMessage.innerHTML = deps.rootShellUi.renderInlineMessage(err?.message || 'No se pudieron cargar los productos.', 'error');
        }
        setShellStatus('');
      }
    }

    refreshBtn?.addEventListener('click', () => { refresh(); });

    // Delegated click for "Generar orden" buttons (they re-render on refresh).
    tableRegion?.addEventListener('click', (evt) => {
      const btn = /** @type {HTMLElement} */ (evt.target).closest('.planner-generate-btn');
      if (!btn) { return; }
      const el = /** @type {HTMLElement} */ (btn);
      const dialogCtx = {
        productId: el.dataset.productId,
        recipeId: el.dataset.recipeId,
        recipeVersionId: null,
        productName: el.dataset.productName || '',
        suggested: el.dataset.suggested ? Number(el.dataset.suggested) : null,
      };
      openDialog(container, session, dialogCtx, refs, dialogState, deps, productStockMap);
    });

    wireDialog(container, session, refs, dialogState, deps, () => {
      if (pageMessage) {
        pageMessage.innerHTML = deps.rootShellUi.renderInlineMessage('Orden de produccion creada correctamente.', 'success');
      }
      refresh();
    });

    await refresh();
  }

  rootShell.register('views.productionPlanner', {
    render,
    mount,
  });
}(window));
