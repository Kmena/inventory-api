(() => {
'use strict';

const AgentShell = /** @type {any} */ (window).AgentShell;

function renderSkeleton() {
  return `
    <div class="agent-page">
      <header class="agent-header" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:0;">
        <button type="button" id="orders-back-btn" class="secondary-button">← Volver</button>
        <h1 style="margin:0;font-size:1.2rem;flex:1;">Mis pedidos</h1>
      </header>
      <div class="agent-goals-skeleton">
        <div class="agent-skeleton-card"></div>
        <div class="agent-skeleton-card"></div>
        <div class="agent-skeleton-card"></div>
      </div>
    </div>`;
}

function renderOrderCard(order) {
  const h = AgentShell.require('helpers');
  const badge = h.buildOrderStatusBadge(order.status);
  const total = h.currency(order.total || 0);
  const storeName = order.storeName || order.clientName || '—';
  const paymentLabels = { CREDIT: 'Crédito', CASH: 'Contado', TRANSFER: 'Transferencia' };
  const paymentLabel = paymentLabels[order.paymentCondition] || order.paymentCondition || '—';

  return `
    <div class="commercial-list-item" style="border:1px solid #E2E8F0;border-radius:12px;padding:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <strong>#${h.escapeHtml(String(order.orderNumber || order.id))}</strong>
        ${badge}
      </div>
      <div style="display:flex;justify-content:space-between;gap:8px;margin-top:6px;font-size:0.85rem;">
        <span style="color:#64748b;">${h.escapeHtml(storeName)}</span>
        <span style="font-weight:700;">${total}</span>
      </div>
      <div style="display:flex;justify-content:space-between;gap:8px;margin-top:4px;font-size:0.82rem;color:#64748b;">
        <span>${h.escapeHtml(paymentLabel)}</span>
        <span>${h.escapeHtml(h.formatDate(order.createdAt))}</span>
      </div>
    </div>`;
}

async function render(containerEl, session, _params) {
  const api = AgentShell.require('api.agentApi');
  const navigate = AgentShell.require('navigate');
  const helpers = AgentShell.require('helpers');

  containerEl.innerHTML = renderSkeleton();

  // Bind back button immediately
  const earlyBack = containerEl.querySelector('#orders-back-btn');
  if (earlyBack) earlyBack.addEventListener('click', () => navigate('dashboard'));

  try {
    const result = await api.fetchOrders(session);
    const orders = result?.orders || [];

    if (!orders.length) {
      containerEl.innerHTML = `
        <div class="agent-page">
          <header class="agent-header" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:0;">
            <button type="button" id="orders-back-btn" class="secondary-button">← Volver</button>
            <h1 style="margin:0;font-size:1.2rem;flex:1;">Mis pedidos</h1>
          </header>
          <div style="text-align:center;padding:48px 24px;">
            <div style="font-size:3rem;margin-bottom:12px;">📋</div>
            <p class="muted">No tienes pedidos aún.</p>
          </div>
        </div>`;
    } else {
      const pendingCount = orders.filter((o) => o.status === 'DRAFT').length;
      const approvedCount = orders.filter((o) => o.status === 'APPROVED').length;

      containerEl.innerHTML = `
        <div class="agent-page">
          <header class="agent-header" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:0;">
            <button type="button" id="orders-back-btn" class="secondary-button">← Volver</button>
            <h1 style="margin:0;font-size:1.2rem;flex:1;">Mis pedidos</h1>
          </header>
          <p class="muted" style="margin:0 0 8px;">${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''} · ${approvedCount} aprobado${approvedCount !== 1 ? 's' : ''} · ${orders.length} total</p>
          <div style="display:grid;gap:10px;">
            ${orders.map(renderOrderCard).join('')}
          </div>
        </div>`;
    }

    const backBtn = containerEl.querySelector('#orders-back-btn');
    if (backBtn) backBtn.addEventListener('click', () => navigate('dashboard'));

  } catch (err) {
    containerEl.innerHTML = `
      <div class="agent-page">
        <header class="agent-header" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:0;">
          <button type="button" id="orders-back-btn" class="secondary-button">← Volver</button>
          <h1 style="margin:0;font-size:1.2rem;flex:1;">Mis pedidos</h1>
        </header>
        <div class="agent-error-banner">
          <p style="margin:0;font-weight:700;">No se pudieron cargar los pedidos</p>
          <p style="margin:0;">${helpers.escapeHtml(err.message || 'Error de red.')}</p>
          <button type="button" id="orders-retry-btn" class="btn" style="margin-top:8px;">Reintentar</button>
        </div>
      </div>`;
    const backBtn = containerEl.querySelector('#orders-back-btn');
    if (backBtn) backBtn.addEventListener('click', () => navigate('dashboard'));
    const retryBtn = containerEl.querySelector('#orders-retry-btn');
    if (retryBtn) retryBtn.addEventListener('click', () => render(containerEl, session, _params));
  }
}

AgentShell.register('views.orders', { render });

})();
