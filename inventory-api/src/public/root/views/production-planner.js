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

  // -------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------

  async function loadPlannerData(session, deps) {
    const products = await deps.productsApi.listProducts(session);
    const list = Array.isArray(products) ? products : (products?.items || []);
    const withRecipe = list.filter((p) => p && p.recipeId != null && p.isActive !== false);
    return withRecipe.map((p) => {
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

        <dialog id="planner-order-dialog" class="planner-dialog" aria-labelledby="planner-dialog-title" style="max-width:520px;width:calc(100% - 32px);border:none;border-radius:12px;padding:24px;box-shadow:0 8px 32px rgba(0,0,0,0.2)">
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
      recipeVersionId: ctx.recipeVersionId,
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

  async function openDialog(container, session, dialogCtx, refs, dialogState, deps) {
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

    // Resolve recipeVersionId lazily and cache per recipeId to avoid re-fetching.
    let recipeVersionId = dialogState.recipeVersionCache.get(String(dialogCtx.recipeId));
    if (!recipeVersionId) {
      try {
        const recipe = await deps.recipesApi.getRecipe(session, dialogCtx.recipeId);
        recipeVersionId = recipe?.latestApprovedVersionId;
        if (!recipeVersionId) {
          setDialogError(dialog, 'La receta de este producto no tiene una version aprobada. Aprueba una version antes de crear la orden.');
          dialog.showModal();
          return;
        }
        dialogState.recipeVersionCache.set(String(dialogCtx.recipeId), recipeVersionId);
      } catch (err) {
        setDialogError(dialog, err?.message || 'No se pudo cargar la receta.');
        return;
      }
    }
    dialogCtx.recipeVersionId = recipeVersionId;
    refs.currentCtx = dialogCtx;

    // Prefill product name + suggested quantity.
    const productLabel = dialog.querySelector('#planner-dialog-product');
    if (productLabel) { productLabel.textContent = dialogCtx.productName; }
    const qtyInput = /** @type {HTMLInputElement} */ (dialog.querySelector('#planner-field-quantity'));
    if (qtyInput) {
      qtyInput.value = dialogCtx.suggested ? String(dialogCtx.suggested) : '';
    }
    setDialogError(dialog, '');
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
    };
    const refs = { currentCtx: null };

    async function refresh() {
      setShellStatus('Cargando planificador...');
      if (pageMessage) { pageMessage.innerHTML = ''; }
      try {
        const rows = await loadPlannerData(session, deps);
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
      openDialog(container, session, dialogCtx, refs, dialogState, deps);
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
