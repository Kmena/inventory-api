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
  const isRejected = order.status === 'REJECTED';

  const rejectionBanner = isRejected ? `
    <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:10px 12px;margin-top:10px;">
      <p style="margin:0 0 4px;font-weight:700;font-size:.85rem;color:#991B1B;">↩️ Devuelto por la oficina</p>
      <p style="margin:0;font-size:.83rem;color:#7F1D1D;">${h.escapeHtml(order.rejectionReason || 'Sin motivo especificado')}</p>
      <button type="button" class="agent-resubmit-btn btn"
              data-order-id="${h.escapeHtml(String(order.id))}"
              style="margin-top:10px;background:#2563EB;font-size:.85rem;width:100%;">
        ✏️ Corregir y reenviar
      </button>
    </div>` : '';

  return `
    <div class="commercial-list-item" style="border:1px solid ${isRejected ? '#FECACA' : '#E2E8F0'};border-radius:12px;padding:14px;">
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
      ${rejectionBanner}
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
      const pendingCount  = orders.filter((o) => o.status === 'DRAFT').length;
      const approvedCount = orders.filter((o) => o.status === 'APPROVED').length;
      const rejectedCount = orders.filter((o) => o.status === 'REJECTED').length;

      // Sort: REJECTED first so agent sees them prominently
      const sorted = [...orders].sort((a, b) => {
        const pri = { REJECTED: 0, DRAFT: 1 };
        return (pri[a.status] ?? 9) - (pri[b.status] ?? 9);
      });

      containerEl.innerHTML = `
        <div class="agent-page">
          <header class="agent-header" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:0;">
            <button type="button" id="orders-back-btn" class="secondary-button">← Volver</button>
            <h1 style="margin:0;font-size:1.2rem;flex:1;">Mis pedidos</h1>
          </header>
          ${rejectedCount > 0 ? `<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:10px 14px;margin-bottom:12px;"><strong style="color:#991B1B;">⚠️ ${rejectedCount} pedido${rejectedCount !== 1 ? 's' : ''} devuelto${rejectedCount !== 1 ? 's' : ''} para corrección</strong></div>` : ''}
          <p class="muted" style="margin:0 0 8px;">${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''} · ${approvedCount} aprobado${approvedCount !== 1 ? 's' : ''} · ${orders.length} total</p>
          <div id="orders-list" style="display:grid;gap:10px;">
            ${sorted.map(renderOrderCard).join('')}
          </div>
        </div>`;

      // Wire resubmit buttons
      containerEl.querySelectorAll('.agent-resubmit-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const orderId = btn.getAttribute('data-order-id');
          btn.disabled = true;
          btn.textContent = 'Enviando…';
          try {
            await api.resubmitOrder(session, orderId);
            // Reload orders so the card reflects DRAFT status
            await render(containerEl, session, _params);
          } catch (err) {
            btn.disabled = false;
            btn.textContent = '✏️ Corregir y reenviar';
            alert(err.message || 'Error al reenviar el pedido.');
          }
        });
      });
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
