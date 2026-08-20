/**
 * Warehouse SPA — Receive from Purchase Order view.
 *
 * Allows warehouse operators to create a receipt document pre-filled
 * from an existing approved Purchase Order (OC).
 *
 * Two-phase flow:
 *   Phase 1: OC selection — list of available purchase orders
 *   Phase 2: Receipt form — editable items, warehouse selector, confirm
 *
 * Permissions: receipts.inspect (canReceive)
 * Endpoints consumed:
 *   GET  /api/receipts/purchase-orders  (listPurchaseOrdersForReceipt)
 *   GET  /api/warehouses               (listWarehouses)
 *   POST /api/receipts                 (createReceipt)
 */
(() => {
const WarehouseShell = /** @type {any} */ (window).WarehouseShell;

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// -----------------------------------------------------------------------
// Phase 1: OC selection list
// -----------------------------------------------------------------------

function renderPoSelectionPhase(container, session, onPoSelected) {
  const api = WarehouseShell.require('warehouseApi');

  const poPhaseEl = container.querySelector('#rfpo-po-phase');
  const formPhaseEl = container.querySelector('#rfpo-form-phase');
  const poStatusEl = container.querySelector('#rfpo-po-status');
  const poListEl = container.querySelector('#rfpo-po-list');

  if (!poPhaseEl || !formPhaseEl || !poStatusEl || !poListEl) { return; }

  poPhaseEl.hidden = false;
  formPhaseEl.hidden = true;

  api.listPurchaseOrdersForReceipt(session)
    .then((/** @type {any[]} */ orders) => {
      poStatusEl.hidden = true;
      if (!orders || orders.length === 0) {
        poListEl.innerHTML = '<li class="warehouse-empty">No hay órdenes de compra disponibles para recepción.</li>';
        return;
      }

      poListEl.innerHTML = '';
      for (const po of orders) {
        const li = document.createElement('li');
        li.innerHTML = `
          <article class="wh-receipt-card">
            <div class="wh-receipt-card__header">
              <span class="wh-receipt-card__id">OC #${escapeHtml(String(po.id))}</span>
              <span class="wh-badge wh-badge--confirmed">Aprobada</span>
            </div>
            <p class="wh-receipt-card__meta">
              Proveedor: ${escapeHtml(po.supplier?.name || '—')}
            </p>
            <p class="wh-receipt-card__meta">
              ${escapeHtml(String(po.items?.length || 0))} ítem(s)
            </p>
            <div class="wh-receipt-card__cta">
              <button type="button"
                      class="primary-button rfpo-select-po-btn"
                      data-po-index="${escapeHtml(String(orders.indexOf(po)))}">
                Seleccionar →
              </button>
            </div>
          </article>
        `;
        poListEl.append(li);
      }

      poListEl.addEventListener('click', (evt) => {
        const btn = /** @type {HTMLElement} */ (evt.target);
        if (btn.classList.contains('rfpo-select-po-btn')) {
          const idx = parseInt(btn.dataset.poIndex || '0', 10);
          if (orders[idx]) {
            onPoSelected(orders[idx]);
          }
        }
      });
    })
    .catch((/** @type {any} */ err) => {
      poStatusEl.textContent = err?.message || 'Error al cargar las órdenes de compra.';
    });
}

// -----------------------------------------------------------------------
// Phase 2: Receipt form (pre-filled from the selected PO)
// -----------------------------------------------------------------------

function renderFormPhase(container, session, selectedPo, onChangePo) {
  const api = WarehouseShell.require('warehouseApi');
  const app = WarehouseShell.require('app');

  const poPhaseEl = container.querySelector('#rfpo-po-phase');
  const formPhaseEl = container.querySelector('#rfpo-form-phase');

  if (!poPhaseEl || !formPhaseEl) { return; }

  poPhaseEl.hidden = true;
  formPhaseEl.hidden = false;

  // Context banner
  const poInfoEl = formPhaseEl.querySelector('#rfpo-po-info');
  if (poInfoEl) {
    poInfoEl.textContent = `OC #${selectedPo.id} — ${selectedPo.supplier?.name || '—'} — ${selectedPo.items?.length || 0} ítem(s)`;
  }

  // Render item inputs
  const itemsListEl = formPhaseEl.querySelector('#rfpo-items-list');
  if (itemsListEl) {
    itemsListEl.innerHTML = '';
    for (const item of (selectedPo.items || [])) {
      const itemId = String(item.id);
      const li = document.createElement('li');
      li.innerHTML = `
        <article class="wh-item-card"
                 aria-label="Ítem: ${escapeHtml(item.product?.name || String(item.productId))}">
          <h3 class="wh-item-card__name">
            ${escapeHtml(item.product?.name || '—')}
            <small style="font-weight:400">&nbsp;· ${escapeHtml(item.product?.code || '')}</small>
          </h3>
          <p class="wh-item-card__meta">
            Solicitado: <strong>${escapeHtml(String(item.quantity))} unid.</strong>
          </p>

          <div class="field">
            <label for="rfpo-qty-recv-${escapeHtml(itemId)}">Cantidad recibida *</label>
            <input type="number"
                   id="rfpo-qty-recv-${escapeHtml(itemId)}"
                   class="rfpo-qty-recv"
                   data-item-id="${escapeHtml(itemId)}"
                   data-product-id="${escapeHtml(String(item.product?.id || item.productId))}"
                   data-requested="${escapeHtml(String(item.quantity))}"
                   min="0"
                   value="${escapeHtml(String(item.quantity))}"
                   required
                   aria-required="true" />
            <p class="wh-error-msg" hidden
               id="rfpo-qty-error-${escapeHtml(itemId)}"
               role="alert" aria-live="assertive"></p>
          </div>

          <div class="field">
            <label for="rfpo-qty-rej-${escapeHtml(itemId)}">Cantidad rechazada</label>
            <input type="number"
                   id="rfpo-qty-rej-${escapeHtml(itemId)}"
                   class="rfpo-qty-rej"
                   data-item-id="${escapeHtml(itemId)}"
                   min="0"
                   value="0" />
          </div>

          <div class="field">
            <label for="rfpo-lot-${escapeHtml(itemId)}">Número de lote (opcional)</label>
            <input type="text"
                   id="rfpo-lot-${escapeHtml(itemId)}"
                   class="rfpo-lot"
                   data-item-id="${escapeHtml(itemId)}"
                   placeholder="LOT-001" />
          </div>

          <div class="field">
            <label for="rfpo-expiry-${escapeHtml(itemId)}">Fecha de vencimiento (opcional)</label>
            <input type="date"
                   id="rfpo-expiry-${escapeHtml(itemId)}"
                   class="rfpo-expiry"
                   data-item-id="${escapeHtml(itemId)}" />
          </div>
        </article>
      `;
      itemsListEl.append(li);
    }
  }

  // Warehouse selector
  const warehouseSelectEl = /** @type {HTMLSelectElement | null} */ (
    formPhaseEl.querySelector('#rfpo-warehouse-select')
  );
  if (warehouseSelectEl) {
    warehouseSelectEl.innerHTML = '<option value="" disabled selected>Cargando bodegas...</option>';
    warehouseSelectEl.disabled = true;

    api.listWarehouses(session)
      .then((/** @type {any[]} */ warehouses) => {
        warehouseSelectEl.innerHTML = '<option value="" disabled selected>Selecciona una bodega</option>';
        for (const wh of (warehouses || [])) {
          const opt = document.createElement('option');
          opt.value = String(wh.id);
          opt.textContent = escapeHtml(wh.name);
          warehouseSelectEl.append(opt);
        }
        warehouseSelectEl.disabled = false;
      })
      .catch(() => {
        warehouseSelectEl.closest('.field')?.insertAdjacentHTML(
          'afterend',
          '<div class="wh-alert wh-alert--warning" role="alert">No se pudieron cargar las bodegas. Recargue la página.</div>',
        );
        warehouseSelectEl.disabled = true;
      });
  }

  // Default received-at to now
  const receivedAtEl = /** @type {HTMLInputElement | null} */ (
    formPhaseEl.querySelector('#rfpo-received-at')
  );
  if (receivedAtEl && !receivedAtEl.value) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    receivedAtEl.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

  // Change PO button
  formPhaseEl.querySelector('#rfpo-change-po-btn')
    ?.addEventListener('click', () => { onChangePo(); });

  // Submit
  const submitBtn = /** @type {HTMLButtonElement | null} */ (
    formPhaseEl.querySelector('#rfpo-submit-btn')
  );
  const errorEl = /** @type {HTMLElement | null} */ (
    formPhaseEl.querySelector('#rfpo-submit-error')
  );

  submitBtn?.addEventListener('click', () => {
    if (!validateForm(selectedPo, formPhaseEl)) { return; }

    const payload = buildPayload(selectedPo, formPhaseEl);
    if (!payload.warehouseId) {
      if (errorEl) {
        errorEl.textContent = 'Selecciona una bodega destino.';
        errorEl.hidden = false;
      }
      warehouseSelectEl?.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creando...';
    }
    if (errorEl) { errorEl.hidden = true; }

    api.createReceipt(session, payload)
      .then(() => {
        app.showToast('Recepción creada exitosamente ✓');
        app.navigate('receipts');
      })
      .catch((/** @type {any} */ err) => {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Crear recepción ✓';
        }
        if (errorEl) {
          errorEl.textContent = err?.message || 'No se pudo crear la recepción. Intente de nuevo.';
          errorEl.hidden = false;
        }
      });
  });
}

// -----------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------

function validateForm(selectedPo, formEl) {
  let valid = true;
  for (const item of (selectedPo.items || [])) {
    const itemId = String(item.id);
    const recv = Number(formEl.querySelector(`#rfpo-qty-recv-${itemId}`)?.value || 0);
    const rej  = Number(formEl.querySelector(`#rfpo-qty-rej-${itemId}`)?.value  || 0);
    const errEl = /** @type {HTMLElement | null} */ (formEl.querySelector(`#rfpo-qty-error-${itemId}`));
    if (recv + rej > item.quantity) {
      if (errEl) {
        errEl.textContent = `Recibido (${recv}) + rechazado (${rej}) no puede superar lo solicitado (${item.quantity}).`;
        errEl.hidden = false;
      }
      valid = false;
    } else {
      if (errEl) { errEl.hidden = true; }
    }
  }
  return valid;
}

// -----------------------------------------------------------------------
// Payload builder
// -----------------------------------------------------------------------

function buildPayload(selectedPo, formEl) {
  const items = (selectedPo.items || []).map((item) => {
    const itemId = String(item.id);
    return {
      purchaseOrderItemId: itemId,
      productId:           String(item.product?.id || item.productId),
      requestedQuantity:   item.quantity,
      receivedQuantity:    Number(formEl.querySelector(`#rfpo-qty-recv-${itemId}`)?.value || 0),
      rejectedQuantity:    Number(formEl.querySelector(`#rfpo-qty-rej-${itemId}`)?.value  || 0),
      lotNumber:           formEl.querySelector(`#rfpo-lot-${itemId}`)?.value?.trim() || null,
      expirationDate:      formEl.querySelector(`#rfpo-expiry-${itemId}`)?.value || null,
    };
  });

  const receivedAtRaw = formEl.querySelector('#rfpo-received-at')?.value;

  return {
    purchaseOrderId: String(selectedPo.id),
    supplierId:      String(selectedPo.supplier?.id || selectedPo.supplierId),
    warehouseId:     formEl.querySelector('#rfpo-warehouse-select')?.value || '',
    receivedAt:      receivedAtRaw ? new Date(receivedAtRaw).toISOString() : new Date().toISOString(),
    notes:           formEl.querySelector('#rfpo-notes')?.value?.trim() || null,
    items,
  };
}

// -----------------------------------------------------------------------
// Main render
// -----------------------------------------------------------------------

function render(container, session, _params) {
  const app = WarehouseShell.require('app');

  container.innerHTML = `
    <div class="warehouse-section">

      <button type="button" class="wh-back-btn" id="rfpo-back-btn">
        ← Recepciones
      </button>

      <!-- Phase 1: OC selection -->
      <section class="wh-step-section" id="rfpo-po-phase"
               aria-labelledby="rfpo-po-title">
        <h2 class="wh-step-section__title" id="rfpo-po-title">
          Seleccionar Orden de Compra
        </h2>
        <p class="wh-step-section__hint">
          Solo se muestran órdenes aprobadas pendientes de recepción.
        </p>
        <p id="rfpo-po-status" role="status" aria-live="polite">
          Cargando órdenes de compra...
        </p>
        <ul id="rfpo-po-list"
            class="warehouse-card-list"
            aria-label="Órdenes de compra disponibles"></ul>
      </section>

      <!-- Phase 2: receipt form (hidden until OC is selected) -->
      <section class="wh-step-section" id="rfpo-form-phase"
               aria-labelledby="rfpo-form-title" hidden>

        <h2 class="wh-step-section__title" id="rfpo-form-title">
          Ajustar recepción
        </h2>

        <div class="wh-alert wh-alert--info" id="rfpo-po-info" role="note"></div>

        <p class="wh-step-section__hint">
          Ajusta cantidades recibidas, lote y fecha de vencimiento por ítem.
          Los campos de lote y fecha son opcionales.
        </p>

        <ul id="rfpo-items-list"
            class="warehouse-card-list"
            aria-label="Ítems a recibir"></ul>

        <div class="field">
          <label for="rfpo-warehouse-select">Bodega destino *</label>
          <select id="rfpo-warehouse-select"
                  required
                  aria-required="true"
                  aria-describedby="rfpo-warehouse-hint">
            <option value="" disabled selected>Selecciona una bodega</option>
          </select>
          <span id="rfpo-warehouse-hint" class="wh-step-section__hint">
            Bodega donde se almacenará la mercancía recibida.
          </span>
        </div>

        <div class="field">
          <label for="rfpo-received-at">Fecha y hora de recepción *</label>
          <input type="datetime-local"
                 id="rfpo-received-at"
                 required
                 aria-required="true" />
        </div>

        <div class="field">
          <label for="rfpo-notes">Notas (opcional)</label>
          <textarea id="rfpo-notes"
                    rows="2"
                    placeholder="Observaciones generales de la recepción..."></textarea>
        </div>

        <div class="wh-step-nav">
          <button type="button" class="secondary-button" id="rfpo-change-po-btn">
            ← Cambiar OC
          </button>
          <button type="button" class="primary-button" id="rfpo-submit-btn">
            Crear recepción ✓
          </button>
        </div>

        <p id="rfpo-submit-error" class="wh-error-msg" hidden
           role="alert" aria-live="assertive"></p>

      </section>

    </div>
  `;

  // Back navigation
  container.querySelector('#rfpo-back-btn')
    ?.addEventListener('click', () => { app.navigate('receipts'); });

  let selectedPo = null;

  function showPoSelection() {
    selectedPo = null;
    renderPoSelectionPhase(container, session, (po) => {
      selectedPo = po;
      renderFormPhase(container, session, selectedPo, showPoSelection);
    });
  }

  showPoSelection();
}

WarehouseShell.register('views.receiveFromPo', { render });
})();
