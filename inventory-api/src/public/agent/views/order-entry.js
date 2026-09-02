(() => {
'use strict';

const AgentShell = /** @type {any} */ (window).AgentShell;

// ─── Stepper HTML ─────────────────────────────────────────────────────────────

function renderStepper(productId, qty) {
  return `
    <div class="agent-stepper" data-product-id="${productId}">
      <button type="button" class="agent-stepper__btn stepper-dec" data-product-id="${productId}" ${qty <= 0 ? 'disabled' : ''} aria-label="Reducir cantidad">−</button>
      <span class="agent-stepper__value">
        <input type="number" class="stepper-input" data-product-id="${productId}" value="${qty}" min="0" inputmode="numeric" aria-label="Cantidad" style="font-size:16px;" />
      </span>
      <button type="button" class="agent-stepper__btn stepper-inc" data-product-id="${productId}" aria-label="Aumentar cantidad">+</button>
    </div>`;
}

// ─── Fila de producto ─────────────────────────────────────────────────────────

function renderProductRow(product, qty) {
  const h = AgentShell.require('helpers');
  const pid = String(product.id);
  const noStock = !product.availableQuantity || product.availableQuantity <= 0;
  const overStock = qty > (product.availableQuantity || 0);
  const rowStyle = noStock ? 'opacity:0.55;' : '';

  return `
    <tr data-product-id="${pid}" style="${rowStyle}">
      <td>
        <div style="display:grid;gap:2px;">
          <strong style="font-size:0.9rem;">${h.escapeHtml(product.name || '—')}</strong>
          ${product.code ? `<span style="font-size:0.75rem;color:#64748b;">${h.escapeHtml(product.code)}</span>` : ''}
          ${noStock ? '<span class="badge" style="background:#fee2e2;color:#a11b1b;font-size:0.72rem;padding:2px 8px;border-radius:999px;">Sin stock</span>' : ''}
          ${overStock && !noStock ? '<span style="color:#d97706;font-size:0.75rem;">Supera el stock disponible</span>' : ''}
        </div>
      </td>
      <td class="numeric-cell" style="font-size:0.9rem;font-weight:700;">${h.currency(product.price || 0)}</td>
      <td>
        ${noStock
          ? `<div class="agent-stepper"><button type="button" class="agent-stepper__btn" disabled>−</button><span class="agent-stepper__value" style="display:inline-flex;align-items:center;padding:0 10px;">0</span><button type="button" class="agent-stepper__btn" disabled>+</button></div>`
          : renderStepper(pid, qty)}
      </td>
      <td class="numeric-cell" id="row-subtotal-${pid}" style="font-size:0.9rem;">${h.currency((qty || 0) * (product.price || 0))}</td>
    </tr>`;
}

// ─── SuccessOverlay ───────────────────────────────────────────────────────────

function renderSuccessOverlay(orderNumber, storeId, title = '¡Pedido creado!') {
  return `
    <div class="agent-success-overlay" id="order-success-overlay">
      <div class="agent-success-card">
        <div style="font-size:3rem;">✅</div>
        <h2 style="margin:0;font-size:1.3rem;">${AgentShell.require('helpers').escapeHtml(title)}</h2>
        <p style="margin:0;color:#64748b;">Número de pedido: <strong>#${AgentShell.require('helpers').escapeHtml(String(orderNumber || '—'))}</strong></p>
        <div style="display:grid;gap:8px;margin-top:8px;">
          <button type="button" id="order-success-to-store" class="btn" data-store-id="${AgentShell.require('helpers').escapeHtml(String(storeId))}">Ver ficha de tienda</button>
          <button type="button" id="order-success-to-home" class="secondary-button">Ir al inicio</button>
        </div>
      </div>
    </div>`;
}

// ─── Render principal ─────────────────────────────────────────────────────────

async function render(containerEl, session, params) {
  const storeId       = params?.storeId;
  const orderId       = params?.orderId || null;  // present when correcting a REJECTED order
  // existingItems arrives as a JSON string from navigate() URL params — parse it back.
  let existingItems = [];
  try { existingItems = params?.existingItems ? JSON.parse(params.existingItems) : []; } catch (_) { existingItems = []; }
  const api      = AgentShell.require('api.agentApi');
  const state    = AgentShell.require('state');
  const helpers  = AgentShell.require('helpers');
  const navigate = AgentShell.require('navigate');

  // Skeleton
  const cachedStore = state.getStores().find((s) => String(s.id) === String(storeId));
  containerEl.innerHTML = `
    <div class="agent-page">
      <div class="agent-context-strip">
        <strong>${helpers.escapeHtml(cachedStore?.name || 'Cargando…')}</strong>
        ${cachedStore?.pendingBalance != null ? `<span style="font-size:0.82rem;">Saldo: ${helpers.currency(cachedStore.pendingBalance)}</span>` : ''}
      </div>
      <div class="agent-goals-skeleton" style="margin-top:20px;">
        <div class="agent-skeleton-card"></div>
        <div class="agent-skeleton-card" style="height:60px;"></div>
      </div>
    </div>`;

  let products = [];
  // freshStore: datos del API, siempre disponibles y actualizados (name, pendingBalance, etc.)
  // Toma precedencia sobre cachedStore que puede ser undefined o stale.
  let freshStore = cachedStore || null;
  try {
    const ctx = await api.fetchOrderContext(session, storeId);
    products   = ctx?.sellableProducts?.products || ctx?.products || [];
    if (ctx?.store) freshStore = ctx.store;
  } catch (err) {
    containerEl.innerHTML = `
      <div class="agent-page">
        <div class="agent-error-banner">
          <p style="margin:0;font-weight:700;">No se pudo cargar el contexto del pedido</p>
          <p style="margin:0;">${helpers.escapeHtml(err.message || 'Error de red.')}</p>
          <button type="button" id="order-retry-btn" class="btn" style="background:#DC2626;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:700;width:max-content;">Reintentar</button>
        </div>
      </div>`;
    const retryBtn = containerEl.querySelector('#order-retry-btn');
    if (retryBtn) retryBtn.addEventListener('click', () => render(containerEl, session, params));
    return;
  }

  // Fuente de verdad de cantidades (Map<productId, qty>)
  // Pre-fill from existingItems when correcting a rejected order.
  const qtyMap = new Map();
  products.forEach((p) => qtyMap.set(String(p.id), 0));
  existingItems.forEach(({ productId, quantity }) => {
    const pid = String(productId);
    if (qtyMap.has(pid)) qtyMap.set(pid, Number(quantity) || 0);
  });

  let visibleProducts = products.slice();
  let searchQuery = '';

  // Mensaje de lista vacía: distingue entre sin productos disponibles y sin resultados de búsqueda
  const noProductsAvailable = products.length === 0;

  // ─── Función de render de la tabla ───────────────────────────────────────
  function renderTable() {
    if (!visibleProducts.length) {
      if (noProductsAvailable) {
        return `
          <div style="padding:24px;text-align:center;">
            <p class="muted" style="margin:0 0 8px;">No hay productos disponibles para este pedido.</p>
            <p style="font-size:0.82rem;color:#64748b;margin:0;">Para que los productos aparezcan aqui, registra entradas de lote en bodegas marcadas como <strong>fuente vendible</strong> en la administracion de inventario.</p>
          </div>`;
      }
      return '<p class="muted" style="padding:24px;text-align:center;">No se encontraron productos con esa busqueda.</p>';
    }
    return `
      <div class="table-wrapper">
        <table class="products-admin-table" style="width:100%;">
          <thead>
            <tr>
              <th>Producto</th>
              <th class="numeric-cell">Precio</th>
              <th>Cant.</th>
              <th class="numeric-cell">Subtotal</th>
            </tr>
          </thead>
          <tbody id="order-tbody">
            ${visibleProducts.map((p) => renderProductRow(p, qtyMap.get(String(p.id)) || 0)).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function recalcTotal() {
    let total = 0;
    for (const [pid, qty] of qtyMap) {
      const prod = products.find((p) => String(p.id) === pid);
      if (prod && qty > 0) total += qty * (prod.price || 0);
    }
    const totalEl = containerEl.querySelector('#order-total-value');
    if (totalEl) totalEl.textContent = helpers.currency(total);
    const confirmBtn = /** @type {HTMLButtonElement|null} */ (containerEl.querySelector('#order-confirm-btn'));
    if (confirmBtn) confirmBtn.disabled = total <= 0;
  }

  containerEl.innerHTML = `
    <div class="agent-page" style="padding-bottom:120px;">
      <div class="agent-context-strip">
        <strong>${helpers.escapeHtml(freshStore?.name || '—')}</strong>
        ${freshStore?.pendingBalance != null ? `<span style="font-size:0.82rem;">Saldo: ${helpers.currency(freshStore.pendingBalance)}</span>` : ''}
      </div>
      <header class="agent-header" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:0;">
        <button type="button" id="order-back-btn" class="secondary-button">← Volver</button>
        <h1 style="margin:0;font-size:1.2rem;flex:1;">${orderId ? 'Corregir pedido' : 'Nuevo pedido'}</h1>
      </header>

      <div id="order-error-banner" hidden class="agent-error-banner"></div>

      <div class="field">
        <input type="search" id="order-search" placeholder="Buscar producto por nombre o código…" style="font-size:16px;" />
      </div>

      <div id="order-product-table">${renderTable()}</div>

      <div class="field" style="margin-top:12px;">
        <label for="order-responsible" style="font-weight:700;">Responsable del pedido *</label>
        <input type="text" id="order-responsible" placeholder="Nombre del responsable" style="font-size:16px;" />
        <span class="agent-field-error" id="order-responsible-error" hidden>El nombre del responsable es requerido.</span>
      </div>

      <div class="field">
        <label for="order-payment-condition" style="font-weight:700;">Condición de pago *</label>
        <select id="order-payment-condition" style="font-size:16px;min-height:48px;width:100%;padding:10px 14px;border:1.5px solid #E2E8F0;border-radius:10px;background:#fff;color:#0F172A;">
          <option value="CREDIT" selected>Crédito</option>
          <option value="CASH">Contado</option>
          <option value="TRANSFER">Transferencia</option>
        </select>
        <span class="agent-field-error" id="order-payment-condition-error" hidden>Selecciona la condición de pago.</span>
      </div>

      <div id="order-transfer-fields" hidden style="background:#EFF6FF;border:1px solid #BFDBFE;border-left:4px solid #3B82F6;border-radius:10px;padding:14px 16px;margin-top:8px;display:grid;gap:12px;">
        <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#1E40AF;margin-bottom:4px;">DATOS DE LA TRANSFERENCIA</div>
        <div class="field">
          <label for="order-transfer-bank" style="font-weight:700;">Banco *</label>
          <input type="text" id="order-transfer-bank" maxlength="100" placeholder="Ej: BCR, Banco Nacional, BAC…" style="font-size:16px;" />
          <span class="agent-field-error" id="order-transfer-bank-error" hidden>El banco es requerido.</span>
        </div>
        <div class="field">
          <label for="order-transfer-reference" style="font-weight:700;">Referencia / comprobante *</label>
          <input type="text" id="order-transfer-reference" maxlength="255" placeholder="Número de referencia o comprobante" style="font-size:16px;" />
          <span class="agent-field-error" id="order-transfer-reference-error" hidden>La referencia es requerida.</span>
        </div>
        <div class="field">
          <label for="order-transfer-amount" style="font-weight:700;">Monto transferido *</label>
          <input type="number" id="order-transfer-amount" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00" style="font-size:16px;" />
          <span class="agent-field-error" id="order-transfer-amount-error" hidden>El monto debe ser mayor a cero.</span>
        </div>
        <div class="field">
          <label for="order-transfer-date" style="font-weight:700;">Fecha de transferencia *</label>
          <input type="date" id="order-transfer-date" style="font-size:16px;" />
          <span class="agent-field-error" id="order-transfer-date-error" hidden>La fecha de transferencia es requerida.</span>
        </div>
      </div>

      <div id="order-credit-warning" hidden class="agent-warning-banner" role="alert" aria-live="polite">
        <span style="font-size:1.1rem;flex-shrink:0;">⚠️</span>
        <span>Este cliente tiene saldo pendiente. Está cerca o sobre su límite de crédito. Confirme el crédito solo si tiene autorización.</span>
      </div>

      <div class="field">
        <label for="order-notes" style="font-weight:700;">Notas (opcional)</label>
        <textarea id="order-notes" rows="3" maxlength="2000" placeholder="Observaciones del pedido…" style="font-size:16px;"></textarea>
      </div>
    </div>

    <div class="agent-summary-bar">
      <div>
        <div style="font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Total estimado</div>
        <span class="agent-summary-bar__total" id="order-total-value">${helpers.currency(0)}</span>
      </div>
      <button type="button" id="order-confirm-btn" class="btn" disabled>${orderId ? 'Reenviar pedido' : 'Confirmar pedido'}</button>
    </div>`;

  // ─── Binding de eventos ───────────────────────────────────────────────────

  const backBtn = containerEl.querySelector('#order-back-btn');
  if (backBtn) backBtn.addEventListener('click', () => navigate('store-detail', { storeId }));

  // Búsqueda local preservando cantidades del Map
  const searchInput = /** @type {HTMLInputElement|null} */ (containerEl.querySelector('#order-search'));
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value.trim().toLowerCase();
      visibleProducts = searchQuery
        ? products.filter((p) => (p.name || '').toLowerCase().includes(searchQuery) || (p.code || '').toLowerCase().includes(searchQuery))
        : products.slice();
      const tableEl = containerEl.querySelector('#order-product-table');
      if (tableEl) tableEl.innerHTML = renderTable();
      bindSteppers();
      recalcTotal();
    });
  }

  function bindSteppers() {
    containerEl.querySelectorAll('.stepper-dec').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pid = btn.getAttribute('data-product-id');
        const current = qtyMap.get(pid) || 0;
        if (current <= 0) return;
        const newQty = current - 1;
        qtyMap.set(pid, newQty);
        updateRow(pid, newQty);
        recalcTotal();
      });
    });

    containerEl.querySelectorAll('.stepper-inc').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pid = btn.getAttribute('data-product-id');
        const current = qtyMap.get(pid) || 0;
        const newQty = current + 1;
        qtyMap.set(pid, newQty);
        updateRow(pid, newQty);
        recalcTotal();
      });
    });

    containerEl.querySelectorAll('.stepper-input').forEach((input) => {
      input.addEventListener('change', () => {
        const pid = input.getAttribute('data-product-id');
        const val = Math.max(0, parseInt(input.value, 10) || 0);
        qtyMap.set(pid, val);
        updateRow(pid, val);
        recalcTotal();
      });
    });
  }

  function updateRow(pid, qty) {
    const prod = products.find((p) => String(p.id) === pid);
    if (!prod) return;
    // Actualiza botón − (disabled cuando qty===0)
    const decBtn = /** @type {HTMLButtonElement|null} */ (containerEl.querySelector(`.stepper-dec[data-product-id="${pid}"]`));
    if (decBtn) decBtn.disabled = qty <= 0;
    // Actualiza input
    const inp = /** @type {HTMLInputElement|null} */ (containerEl.querySelector(`.stepper-input[data-product-id="${pid}"]`));
    if (inp) inp.value = String(qty);
    // Actualiza subtotal
    const subEl = containerEl.querySelector(`#row-subtotal-${pid}`);
    if (subEl) subEl.textContent = helpers.currency(qty * (prod.price || 0));
  }

  bindSteppers();
  recalcTotal();

  // ─── Payment condition toggle ─────────────────────────────────────────────
  const paymentConditionSelect = /** @type {HTMLSelectElement|null} */ (containerEl.querySelector('#order-payment-condition'));
  const transferFieldsBlock    = containerEl.querySelector('#order-transfer-fields');
  const creditWarningBanner    = containerEl.querySelector('#order-credit-warning');

  function updatePaymentConditionVisibility() {
    const val = paymentConditionSelect?.value;
    if (transferFieldsBlock) transferFieldsBlock.hidden = (val !== 'TRANSFER');
    // Credit warning rules:
    //  - No balance owed → never warn (client is clean regardless of limit).
    //  - Balance > 0 + no credit limit set → warn (selling on credit without authorization).
    //  - Balance > 0 + within 80 % of approved limit → no warn (normal, authorized usage).
    //  - Balance >= 80 % of approved limit → warn (at or over limit).
    const pendingBalance = Number(freshStore?.pendingBalance || 0);
    const creditLimit   = Number(freshStore?.creditLimit   || 0);
    const NEAR_PCT      = 0.8;
    const isOverOrNearLimit = pendingBalance > 0
      && (creditLimit === 0 || pendingBalance >= creditLimit * NEAR_PCT);
    const showCredit = val === 'CREDIT' && isOverOrNearLimit;
    if (creditWarningBanner) creditWarningBanner.style.display = showCredit ? 'flex' : 'none';
  }

  if (paymentConditionSelect) {
    paymentConditionSelect.addEventListener('change', updatePaymentConditionVisibility);
    // Trigger once on load to apply initial state
    updatePaymentConditionVisibility();
  }

  // ─── Submit ───────────────────────────────────────────────────────────────
  const confirmBtn = /** @type {HTMLButtonElement|null} */ (containerEl.querySelector('#order-confirm-btn'));
  const errorBanner = containerEl.querySelector('#order-error-banner');

  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      const responsibleInput = /** @type {HTMLInputElement|null} */ (containerEl.querySelector('#order-responsible'));
      const notesInput       = /** @type {HTMLTextAreaElement|null} */ (containerEl.querySelector('#order-notes'));
      const responsibleError = containerEl.querySelector('#order-responsible-error');
      const pcSelect         = /** @type {HTMLSelectElement|null} */ (containerEl.querySelector('#order-payment-condition'));
      const pcError          = containerEl.querySelector('#order-payment-condition-error');
      const bankInput        = /** @type {HTMLInputElement|null} */ (containerEl.querySelector('#order-transfer-bank'));
      const refInput         = /** @type {HTMLInputElement|null} */ (containerEl.querySelector('#order-transfer-reference'));
      const amountInput      = /** @type {HTMLInputElement|null} */ (containerEl.querySelector('#order-transfer-amount'));
      const dateInput        = /** @type {HTMLInputElement|null} */ (containerEl.querySelector('#order-transfer-date'));
      const bankError        = containerEl.querySelector('#order-transfer-bank-error');
      const refError         = containerEl.querySelector('#order-transfer-reference-error');
      const amountError      = containerEl.querySelector('#order-transfer-amount-error');
      const dateError        = containerEl.querySelector('#order-transfer-date-error');

      let hasError = false;

      // Validación: Responsable
      if (!responsibleInput?.value?.trim()) {
        if (responsibleError) responsibleError.hidden = false;
        if (responsibleInput) responsibleInput.classList.add('agent-input-error');
        hasError = true;
      } else {
        if (responsibleError) responsibleError.hidden = true;
        if (responsibleInput) responsibleInput.classList.remove('agent-input-error');
      }

      // Validación: condición de pago
      const paymentCondition = pcSelect?.value || '';
      if (!paymentCondition) {
        if (pcError) pcError.hidden = false;
        if (pcSelect) pcSelect.classList.add('agent-input-error');
        hasError = true;
      } else {
        if (pcError) pcError.hidden = true;
        if (pcSelect) pcSelect.classList.remove('agent-input-error');
      }

      // Validación: campos de transferencia (solo cuando condición es TRANSFER)
      let transferMetadata;
      if (paymentCondition === 'TRANSFER') {
        const bankVal   = bankInput?.value?.trim() || '';
        const refVal    = refInput?.value?.trim() || '';
        const amountVal = parseFloat(amountInput?.value || '0');
        const dateVal   = dateInput?.value || '';

        if (!bankVal) {
          if (bankError) bankError.hidden = false;
          if (bankInput) bankInput.classList.add('agent-input-error');
          hasError = true;
        } else {
          if (bankError) bankError.hidden = true;
          if (bankInput) bankInput.classList.remove('agent-input-error');
        }

        if (!refVal) {
          if (refError) refError.hidden = false;
          if (refInput) refInput.classList.add('agent-input-error');
          hasError = true;
        } else {
          if (refError) refError.hidden = true;
          if (refInput) refInput.classList.remove('agent-input-error');
        }

        if (!amountVal || amountVal <= 0) {
          if (amountError) amountError.hidden = false;
          if (amountInput) amountInput.classList.add('agent-input-error');
          hasError = true;
        } else {
          if (amountError) amountError.hidden = true;
          if (amountInput) amountInput.classList.remove('agent-input-error');
        }

        if (!dateVal) {
          if (dateError) dateError.hidden = false;
          if (dateInput) dateInput.classList.add('agent-input-error');
          hasError = true;
        } else {
          if (dateError) dateError.hidden = true;
          if (dateInput) dateInput.classList.remove('agent-input-error');
        }

        if (!hasError) {
          transferMetadata = {
            bank:      bankVal,
            reference: refVal,
            amount:    amountVal,
            date:      new Date(dateVal + 'T00:00:00').toISOString(),
          };
        }
      }

      if (hasError) return;

      // Construir items del Map con qty > 0
      const items = [];
      for (const [pid, qty] of qtyMap) {
        if (qty <= 0) continue;
        const prod = products.find((p) => String(p.id) === pid);
        if (!prod) continue;
        items.push({
          productId:    prod.id,
          quantity:     qty,
          unitPrice:    prod.price,
          discountPercent: 0,
          discountAmount:  0,
          totalDiscount:   0,
        });
      }

      const payload = {
        responsible:      responsibleInput?.value?.trim() || undefined,
        notes:            notesInput?.value?.trim() || undefined,
        paymentCondition: paymentCondition || undefined,
        transferMetadata: transferMetadata || undefined,
        discountPercent:  0,
        discountAmount:   0,
        totalDiscount:    0,
        items,
      };

      // Estado saving (deshabilitar botón)
      if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Enviando…'; }
      if (errorBanner) errorBanner.hidden = true;

      try {
        let orderNumber;
        if (orderId) {
          // Edit mode: update the existing REJECTED order then resubmit it
          await api.updateOrderItems(session, orderId, payload);
          await api.resubmitOrder(session, orderId);
          orderNumber = orderId;
        } else {
          const response = await api.postOrder(session, storeId, payload);
          const order = response?.order || response;
          orderNumber = order?.orderNumber || order?.id;
        }

        // SuccessOverlay — no responde a Escape ni click fuera (ADR-006)
        const overlayEl = document.createElement('div');
        overlayEl.innerHTML = orderId
          ? renderSuccessOverlay(orderNumber, storeId, '¡Pedido reenviado!')
          : renderSuccessOverlay(orderNumber, storeId);
        const overlayNode = overlayEl.firstElementChild;
        document.body.appendChild(overlayNode);

        // Prevenir Escape
        const blockEscape = (e) => { if (e.key === 'Escape') e.preventDefault(); };
        document.addEventListener('keydown', blockEscape);

        function dismissOverlay() {
          if (overlayNode && overlayNode.parentNode) overlayNode.parentNode.removeChild(overlayNode);
          document.removeEventListener('keydown', blockEscape);
        }

        // CTAs del overlay
        const toStoreBtn = document.querySelector('#order-success-to-store');
        const toHomeBtn  = document.querySelector('#order-success-to-home');
        if (toStoreBtn) toStoreBtn.addEventListener('click', () => { dismissOverlay(); navigate('store-detail', { storeId }); });
        if (toHomeBtn)  toHomeBtn.addEventListener('click', () => { dismissOverlay(); navigate('dashboard'); });

      } catch (err) {
        // Preservar campos y Map; mostrar banner
        if (errorBanner) {
          errorBanner.textContent = err.message || 'No se pudo crear el pedido. Intenta de nuevo.';
          errorBanner.hidden = false;
        }
        if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = orderId ? 'Reenviar pedido' : 'Confirmar pedido'; }
        // Restore payment condition visibility after network error
        updatePaymentConditionVisibility();
        recalcTotal(); // re-evalúa disabled según qtyMap
      }
    });
  }
}

AgentShell.register('views.orderEntry', { render });

})();
