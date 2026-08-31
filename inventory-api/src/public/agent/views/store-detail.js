(() => {
'use strict';

const AgentShell = /** @type {any} */ (window).AgentShell;

// ─── Helpers de renderizado ───────────────────────────────────────────────────

function renderSkeleton(storeName) {
  const h = AgentShell.require('helpers');
  return `
    <div class="agent-page">
      <header class="agent-header" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:0;">
        <button type="button" id="sd-back-btn" class="secondary-button">← Volver</button>
        <h1 style="margin:0;font-size:1.2rem;flex:1;">${h.escapeHtml(storeName || 'Cargando…')}</h1>
        <div style="display:flex;gap:8px;flex-wrap:wrap;opacity:0.4;pointer-events:none;">
          <button type="button" class="secondary-button">Registrar visita</button>
          <button type="button" class="btn">Crear pedido</button>
        </div>
      </header>
      <div class="agent-goals-skeleton">
        <div class="agent-skeleton-card"></div>
        <div class="agent-skeleton-card" style="height:80px;"></div>
        <div class="agent-skeleton-card" style="height:200px;"></div>
      </div>
    </div>`;
}

function renderError404(_storeId) {
  return `
    <div class="agent-page">
      <div class="agent-error-banner">
        <p style="margin:0;font-weight:700;">Tienda fuera de cobertura</p>
        <p style="margin:0;">La tienda no pertenece a tu cobertura.</p>
        <button type="button" id="sd-home-btn-404" class="btn" style="background:#DC2626;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:700;width:max-content;">Ir al inicio</button>
      </div>
    </div>`;
}

function renderNetworkError(message) {
  return `
    <div class="agent-page">
      <div class="agent-error-banner">
        <p style="margin:0;font-weight:700;">Error de red</p>
        <p style="margin:0;">${AgentShell.require('helpers').escapeHtml(message || 'No se pudo cargar la tienda.')}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" id="sd-retry-btn" class="btn" style="background:#DC2626;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:700;">Reintentar</button>
          <button type="button" id="sd-home-btn" class="secondary-button">Ir al inicio</button>
        </div>
      </div>
    </div>`;
}

function renderPhone(phone) {
  if (!phone) return '';
  const h = AgentShell.require('helpers');
  return `<a href="tel:${h.escapeHtml(phone)}" style="color:var(--primary);">${h.escapeHtml(phone)}</a>`;
}

function renderContacts(store) {
  const h = AgentShell.require('helpers');
  const contacts = store.contacts || store.representatives || [];
  if (!contacts.length) return '<p class="muted">Sin contactos registrados.</p>';
  return contacts.map((c) => `
    <div class="detail-item">
      <strong>${h.escapeHtml(c.name || c.fullName || '—')}</strong>
      ${c.phone  ? '<div>' + renderPhone(c.phone)  + '</div>' : ''}
      ${c.phone2 ? '<div>' + renderPhone(c.phone2) + '</div>' : ''}
      ${c.email  ? `<div style="font-size:0.82rem;">${h.escapeHtml(c.email)}</div>` : ''}
    </div>`).join('');
}

function renderVisitHistory(history) {
  const h = AgentShell.require('helpers');
  if (!history?.length) return '<p class="muted">Sin historial de visitas.</p>';
  return history.slice(0, 6).map((v) => `
    <div class="detail-item" style="font-size:0.85rem;">
      <div style="display:flex;justify-content:space-between;gap:8px;">
        <strong>${h.escapeHtml(v.motive || '—')}</strong>
        <span>${h.escapeHtml(h.formatDate(v.visitedAt || v.createdAt))}</span>
      </div>
      <div style="color:#64748b;">${h.escapeHtml(v.result || '—')}${v.comment ? ' — ' + h.escapeHtml(v.comment) : ''}</div>
    </div>`).join('');
}

function renderPurchaseHistory(history) {
  const h = AgentShell.require('helpers');
  if (!history?.length) return '<p class="muted">Sin historial de compras.</p>';
  return history.slice(0, 10).map((p) => {
    const status = p.status || '—';
    const badge = h.buildOrderStatusBadge(status);
    return `
    <div class="detail-item" style="font-size:0.85rem;">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
        <strong>#${h.escapeHtml(String(p.orderId || p.orderNumber || p.id || '—'))}</strong>
        ${badge}
      </div>
      <div style="display:flex;justify-content:space-between;gap:8px;margin-top:4px;">
        <span>${h.escapeHtml(h.formatDate(p.createdAt))}</span>
        <span style="font-weight:700;">${h.currency(p.total || 0)}</span>
      </div>
    </div>`;
  }).join('');
}

function renderSellableProducts(products) {
  const h = AgentShell.require('helpers');
  if (!products?.length) return '<p class="muted">Sin productos disponibles.</p>';
  return `<ul style="margin:0;padding:0;list-style:none;display:grid;gap:6px;">
    ${products.slice(0, 20).map((p) => `
      <li style="font-size:0.85rem;display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">
        <span>${h.escapeHtml(p.name || '—')}${p.code ? ' <span style="color:#64748b;">(' + h.escapeHtml(p.code) + ')</span>' : ''}</span>
        <span style="font-weight:700;white-space:nowrap;">${h.currency(p.price || 0)}</span>
      </li>`).join('')}
  </ul>`;
}

function renderStoreDetail(store, storeId) {
  const h = AgentShell.require('helpers');
  const isVencida = store.status === 'VENCIDA';
  const pendingBalance = store.pendingBalance ?? 0;
  const balanceColor = pendingBalance > 0 ? '#DC2626' : '#16A34A';
  const balanceLabel = pendingBalance === 0 ? 'Sin saldo pendiente ✓' : h.currency(pendingBalance);

  return `
    <div class="agent-page" style="padding-bottom:80px;">
      <header class="agent-header" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:0;">
        <button type="button" id="sd-back-btn" class="secondary-button">← Volver</button>
        <h1 style="margin:0;font-size:1.2rem;flex:1;">${h.escapeHtml(store.name || '—')}</h1>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" id="sd-visit-btn-header" class="secondary-button" data-store-id="${h.escapeHtml(String(storeId))}">Registrar visita</button>
          <button type="button" id="sd-order-btn-header" class="btn" data-store-id="${h.escapeHtml(String(storeId))}">Crear pedido</button>
        </div>
      </header>

      ${isVencida ? '<div class="agent-alert-banner">⚠️ Esta tienda tiene saldo vencido. Gestiona el cobro antes de tomar un pedido.</div>' : ''}

      <div class="detail-item">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div>
            <div class="muted" style="font-size:0.8rem;">Cliente</div>
            <strong>${h.escapeHtml(store.clientName || '—')}</strong>
          </div>
          ${h.buildStatusBadge(store.status)}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-top:8px;">
          <div>
            <div class="muted" style="font-size:0.8rem;">Saldo pendiente</div>
            <span class="agent-summary-saldo" style="color:${balanceColor};">${h.escapeHtml(balanceLabel)}</span>
          </div>
          ${store.regionName ? `<div class="muted" style="font-size:0.82rem;">${h.escapeHtml(store.regionName)}${store.subregionName ? ' · ' + h.escapeHtml(store.subregionName) : ''}</div>` : ''}
        </div>
      </div>

      <details open>
        <summary style="cursor:pointer;font-weight:700;padding:12px 0;border-bottom:1px solid var(--border);">Contactos</summary>
        <div style="padding:12px 0;display:grid;gap:10px;">${renderContacts(store)}</div>
      </details>

      <details>
        <summary style="cursor:pointer;font-weight:700;padding:12px 0;border-bottom:1px solid var(--border);">Historial de visitas</summary>
        <div style="padding:12px 0;display:grid;gap:8px;" id="sd-visit-history">${renderVisitHistory(store.visitHistory)}</div>
      </details>

      <details>
        <summary style="cursor:pointer;font-weight:700;padding:12px 0;border-bottom:1px solid var(--border);">Historial de pedidos</summary>
        <div style="padding:12px 0;display:grid;gap:8px;">${renderPurchaseHistory(store.purchaseHistory)}</div>
      </details>

      <details>
        <summary style="cursor:pointer;font-weight:700;padding:12px 0;border-bottom:1px solid var(--border);">Productos sugeridos</summary>
        <div style="padding:12px 0;">${renderSellableProducts(store.sellableProducts)}</div>
      </details>
    </div>

    <div class="agent-action-bar">
      <button type="button" id="sd-visit-btn-bar" class="secondary-button" data-store-id="${h.escapeHtml(String(storeId))}" style="flex:1;">Registrar visita</button>
      <button type="button" id="sd-order-btn-bar" class="btn" data-store-id="${h.escapeHtml(String(storeId))}" style="flex:1;">Crear pedido</button>
    </div>`;
}

// ─── Render principal ─────────────────────────────────────────────────────────

async function render(containerEl, session, params) {
  const storeId = params?.storeId;
  const api      = AgentShell.require('api.agentApi');
  const state    = AgentShell.require('state');
  const navigate = AgentShell.require('navigate');

  // Pre-carga el nombre desde el estado compartido sin esperar el fetch
  const cachedStores = state.getStores();
  const cachedStore  = cachedStores.find((s) => String(s.id) === String(storeId));
  containerEl.innerHTML = renderSkeleton(cachedStore?.name);

  function bindNavButtons(root) {
    const backBtn = root.querySelector('#sd-back-btn');
    if (backBtn) backBtn.addEventListener('click', () => navigate('dashboard'));

    root.querySelectorAll('[id^="sd-visit-btn"]').forEach((btn) => {
      btn.addEventListener('click', () => navigate('visit', { storeId }));
    });
    root.querySelectorAll('[id^="sd-order-btn"]').forEach((btn) => {
      btn.addEventListener('click', () => navigate('order', { storeId }));
    });
    const homeBtn404 = root.querySelector('#sd-home-btn-404');
    if (homeBtn404) homeBtn404.addEventListener('click', () => navigate('dashboard'));
    const homeBtn = root.querySelector('#sd-home-btn');
    if (homeBtn) homeBtn.addEventListener('click', () => navigate('dashboard'));
  }

  try {
    const data = await api.fetchStoreDetail(session, storeId);
    // fetchStoreDetail returns { store, visitHistory, purchaseHistory: { pendingBalance, orders }, sellableProducts }.
    // Merge top-level detail fields into the store card so renderStoreDetail
    // can access them as store.visitHistory, store.purchaseHistory, store.sellableProducts.
    const store = {
      ...(data?.store || data),
      visitHistory:    data?.visitHistory    ?? [],
      purchaseHistory: data?.purchaseHistory?.orders ?? data?.purchaseHistory ?? [],
      sellableProducts: data?.sellableProducts ?? [],
    };
    containerEl.innerHTML = renderStoreDetail(store, storeId);
  } catch (err) {
    const is404 = err?.message?.toLowerCase().includes('404')
      || err?.message?.toLowerCase().includes('cobertura')
      || err?.message?.toLowerCase().includes('not found');

    if (is404) {
      containerEl.innerHTML = renderError404(storeId);
    } else {
      containerEl.innerHTML = renderNetworkError(err.message);
      const retryBtn = containerEl.querySelector('#sd-retry-btn');
      if (retryBtn) retryBtn.addEventListener('click', () => render(containerEl, session, params));
    }
  }

  bindNavButtons(containerEl);
}

AgentShell.register('views.storeDetail', { render });

})();
