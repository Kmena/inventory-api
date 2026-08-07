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

function renderSuccessOverlay(orderNumber, storeId) {
  return `
    <div class="agent-success-overlay" id="order-success-overlay">
      <div class="agent-success-card">
        <div style="font-size:3rem;">✅</div>
        <h2 style="margin:0;font-size:1.3rem;">¡Pedido creado!</h2>
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
  const storeId  = params?.storeId;
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
  try {
    const ctx = await api.fetchOrderContext(session, storeId);
    products = ctx?.sellableProducts?.products || ctx?.products || [];
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
  const qtyMap = new Map();
  products.forEach((p) => qtyMap.set(String(p.id), 0));

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
        <strong>${helpers.escapeHtml(cachedStore?.name || '—')}</strong>
        ${cachedStore?.pendingBalance != null ? `<span style="font-size:0.82rem;">Saldo: ${helpers.currency(cachedStore.pendingBalance)}</span>` : ''}
      </div>
      <header class="agent-header" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:0;">
        <button type="button" id="order-back-btn" class="secondary-button">← Volver</button>
        <h1 style="margin:0;font-size:1.2rem;flex:1;">Nuevo pedido</h1>
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
        <label for="order-notes" style="font-weight:700;">Notas (opcional)</label>
        <textarea id="order-notes" rows="3" maxlength="2000" placeholder="Observaciones del pedido…" style="font-size:16px;"></textarea>
      </div>
    </div>

    <div class="agent-summary-bar">
      <div>
        <div style="font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Total estimado</div>
        <span class="agent-summary-bar__total" id="order-total-value">${helpers.currency(0)}</span>
      </div>
      <button type="button" id="order-confirm-btn" class="btn" disabled>Confirmar pedido</button>
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

  // ─── Submit ───────────────────────────────────────────────────────────────
  const confirmBtn = /** @type {HTMLButtonElement|null} */ (containerEl.querySelector('#order-confirm-btn'));
  const errorBanner = containerEl.querySelector('#order-error-banner');

  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      const responsibleInput = /** @type {HTMLInputElement|null} */ (containerEl.querySelector('#order-responsible'));
      const notesInput       = /** @type {HTMLTextAreaElement|null} */ (containerEl.querySelector('#order-notes'));
      const responsibleError = containerEl.querySelector('#order-responsible-error');

      // Validación inline
      if (!responsibleInput?.value?.trim()) {
        if (responsibleError) responsibleError.hidden = false;
        if (responsibleInput) responsibleInput.classList.add('agent-input-error');
        return;
      }
      if (responsibleError) responsibleError.hidden = true;
      if (responsibleInput) responsibleInput.classList.remove('agent-input-error');

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
        responsibleName:  responsibleInput?.value?.trim() || undefined,
        notes:            notesInput?.value?.trim() || undefined,
        discountPercent:  0,
        discountAmount:   0,
        totalDiscount:    0,
        items,
      };

      // Estado saving (deshabilitar botón)
      if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Enviando…'; }
      if (errorBanner) errorBanner.hidden = true;

      try {
        const response = await api.postOrder(session, storeId, payload);
        const order = response?.order || response;
        const orderNumber = order?.orderNumber || order?.id;

        // SuccessOverlay — no responde a Escape ni click fuera (ADR-006)
        const overlayEl = document.createElement('div');
        overlayEl.innerHTML = renderSuccessOverlay(orderNumber, storeId);
        document.body.appendChild(overlayEl.firstElementChild);

        // Prevenir Escape
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') e.preventDefault(); }, { once: false });

        // CTAs del overlay
        const toStoreBtn = document.querySelector('#order-success-to-store');
        const toHomeBtn  = document.querySelector('#order-success-to-home');
        if (toStoreBtn) toStoreBtn.addEventListener('click', () => navigate('store-detail', { storeId }));
        if (toHomeBtn)  toHomeBtn.addEventListener('click', () => navigate('dashboard'));

      } catch (err) {
        // Preservar campos y Map; mostrar banner
        if (errorBanner) {
          errorBanner.textContent = err.message || 'No se pudo crear el pedido. Intenta de nuevo.';
          errorBanner.hidden = false;
        }
        if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Confirmar pedido'; }
        recalcTotal(); // re-evalúa disabled según qtyMap
      }
    });
  }
}

AgentShell.register('views.orderEntry', { render });

})();
