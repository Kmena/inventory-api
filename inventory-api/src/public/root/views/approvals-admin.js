(function attachApprovalsAdminView(globalScope) {
'use strict';

const rootShell = /** @type {any} */ (globalScope).RootShell;

const ORDER_STATUS_LABELS = {
  DRAFT:         { bg: '#FEF3C7', color: '#92400E', label: 'Pendiente' },
  APPROVED:      { bg: '#D1FAE5', color: '#065F46', label: 'Aprobado' },
  IN_PRODUCTION: { bg: '#DBEAFE', color: '#1E40AF', label: 'En producción' },
  DELIVERED:     { bg: '#E2E8F0', color: '#374151', label: 'Entregado' },
  CANCELLED:     { bg: '#F1F5F9', color: '#64748B', label: 'Cancelado' },
  REJECTED:      { bg: '#FEE2E2', color: '#991B1B', label: 'Devuelto al agente' },
};

const PAYMENT_LABELS = {
  CREDIT:   'Crédito',
  CASH:     'Contado',
  TRANSFER: 'Transferencia',
};

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = String(str ?? '');
  return d.innerHTML;
}

function currency(amount) {
  return '₡' + Number(amount || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch (_e) {
    return '—';
  }
}

function statusBadge(status) {
  const s = ORDER_STATUS_LABELS[status] || { bg: '#E2E8F0', color: '#374151', label: status || '—' };
  return `<span style="background:${s.bg};color:${s.color};padding:2px 10px;border-radius:999px;font-size:0.78rem;font-weight:700;white-space:nowrap;">${escapeHtml(s.label)}</span>`;
}

function calculateOrderTotal(order) {
  if (order.total && Number(order.total) > 0) return Number(order.total);
  return (order.items || []).reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0);
}

function renderSkeleton() {
  return `
    <section class="root-hero" aria-labelledby="approvals-title">
      <p class="root-hero__eyebrow">Gestión</p>
      <h2 id="approvals-title">Aprobaciones</h2>
    </section>
    <section class="commercial-page">
      <div class="agent-goals-skeleton">
        <div class="agent-skeleton-card" style="height:48px;border-radius:8px;background:#f1f5f9;"></div>
        <div class="agent-skeleton-card" style="height:48px;border-radius:8px;background:#f1f5f9;"></div>
        <div class="agent-skeleton-card" style="height:48px;border-radius:8px;background:#f1f5f9;"></div>
      </div>
    </section>`;
}

function renderOrderRow(order) {
  const total = calculateOrderTotal(order);
  const storeName = order.clientStore?.name || order.client?.tradeName || order.client?.legalName || '—';
  const agentName = order.user?.fullName || order.responsible || '—';
  const paymentLabel = PAYMENT_LABELS[order.paymentCondition] || order.paymentCondition || '—';
  const itemCount = (order.items || []).length;
  const isDraft    = order.status === 'DRAFT';
  const isApproved  = order.status === 'APPROVED';

  const itemsSummary = (order.items || []).slice(0, 5).map((item) =>
    `<div style="display:flex;justify-content:space-between;gap:8px;font-size:0.8rem;padding:2px 0;">
      <span>${escapeHtml(item.product?.name || 'Producto')}</span>
      <span>${item.quantity} × ${currency(item.unitPrice)}</span>
    </div>`
  ).join('');
  const moreItems = itemCount > 5 ? `<div style="font-size:0.78rem;color:#64748b;">… y ${itemCount - 5} más</div>` : '';

  return `
    <div class="commercial-list-item approvals-order-card" data-order-id="${escapeHtml(String(order.id))}" style="border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
        <div>
          <strong style="font-size:1rem;">#${escapeHtml(String(order.orderNumber || order.id))}</strong>
          <span style="margin-left:8px;">${statusBadge(order.status)}</span>
        </div>
        <span style="font-size:0.82rem;color:#64748b;">${escapeHtml(formatDate(order.createdAt))}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;font-size:0.85rem;">
        <div><span style="color:#64748b;">Tienda:</span> <strong>${escapeHtml(storeName)}</strong></div>
        <div><span style="color:#64748b;">Agente:</span> ${escapeHtml(agentName)}</div>
        <div><span style="color:#64748b;">Pago:</span> ${escapeHtml(paymentLabel)}</div>
        <div><span style="color:#64748b;">Total:</span> <strong>${currency(total)}</strong></div>
      </div>
      ${order.notes ? `<div style="margin-top:8px;font-size:0.82rem;color:#64748b;"><em>Nota: ${escapeHtml(order.notes)}</em></div>` : ''}
      <details style="margin-top:8px;">
        <summary style="cursor:pointer;font-size:0.82rem;font-weight:700;color:#2563EB;">${itemCount} producto${itemCount !== 1 ? 's' : ''}</summary>
        <div style="margin-top:6px;padding:8px 12px;background:#F8FAFC;border-radius:8px;">${itemsSummary}${moreItems}</div>
      </details>
      ${isDraft ? `
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
        <button type="button" class="btn approvals-approve-btn" data-order-id="${escapeHtml(String(order.id))}" style="background:#16A34A;flex:1;min-width:120px;">✓ Aprobar</button>
        <button type="button" class="secondary-button approvals-reject-btn" data-order-id="${escapeHtml(String(order.id))}" style="color:#DC2626;border-color:#DC2626;flex:1;min-width:120px;">✗ Rechazar</button>
      </div>` : ''}
      ${isApproved ? `
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button type="button" class="btn approvals-dispatch-btn" data-order-id="${escapeHtml(String(order.id))}" style="background:#2563EB;flex:1;min-width:120px;">🚚 Despachar</button>
      </div>` : ''}
    </div>`;
}

function renderEmptyState() {
  return `
    <div style="text-align:center;padding:48px 24px;">
      <div style="font-size:3rem;margin-bottom:12px;">✅</div>
      <h3 style="margin:0 0 8px;">Sin pedidos pendientes</h3>
      <p class="muted">No hay pedidos esperando aprobación en este momento.</p>
    </div>`;
}

function renderDispatchedRow(order) {
  const total = calculateOrderTotal(order);
  const storeName = order.clientStore?.name || order.client?.tradeName || order.client?.legalName || '—';
  const agentName = order.user?.fullName || order.responsible || '—';
  const transportLabel = { PRIVATE: '🚛 Privado', MAIL: '📮 Correo', COURIER: '📦 Courier', OWN: '🏍️ Propio', PICKUP: '🏪 Retiro' };
  const transport = order.transportMethod ? (transportLabel[order.transportMethod] || order.transportMethod) : '—';
  return `
    <div style="border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
        <div>
          <strong style="font-size:1rem;">#${escapeHtml(String(order.orderNumber || order.id))}</strong>
          <span style="margin-left:8px;">${statusBadge(order.status)}</span>
        </div>
        <span style="font-size:0.82rem;color:#64748b;">Despachado: ${escapeHtml(formatDate(order.dispatchedAt))}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;font-size:0.85rem;">
        <div><span style="color:#64748b;">Tienda:</span> <strong>${escapeHtml(storeName)}</strong></div>
        <div><span style="color:#64748b;">Agente:</span> ${escapeHtml(agentName)}</div>
        <div><span style="color:#64748b;">Total:</span> <strong>${currency(total)}</strong></div>
        <div><span style="color:#64748b;">Transporte:</span> ${escapeHtml(transport)}</div>
        ${order.transportResponsible ? `<div><span style="color:#64748b;">Responsable:</span> ${escapeHtml(order.transportResponsible)}</div>` : ''}
        ${order.trackingNumber ? `<div><span style="color:#64748b;">Guía:</span> ${escapeHtml(order.trackingNumber)}</div>` : ''}
        <div><span style="color:#64748b;">Bodega:</span> ${escapeHtml(order.warehouse?.name || '—')}</div>
      </div>
    </div>`;
}

function renderDispatchesTab(orders) {
  return `
    <section class="root-hero" aria-labelledby="approvals-title">
      <p class="root-hero__eyebrow">Gestión</p>
      <h2 id="approvals-title">Despachos</h2>
      <p class="muted">${orders.length} pedido${orders.length !== 1 ? 's' : ''} despachado${orders.length !== 1 ? 's' : ''}</p>
    </section>
    <section class="commercial-page">
      <div id="approvals-message" role="status" aria-live="polite"></div>
      <div id="dispatches-list">
        ${orders.length ? orders.map(renderDispatchedRow).join('') : '<div style="text-align:center;padding:48px 24px;"><div style="font-size:3rem;">📦</div><h3>Sin despachos registrados</h3></div>'}
      </div>
    </section>`;
}

function renderOrdersList(orders, filterStatus) {
  const filtered = filterStatus === 'ALL'
    ? orders
    : orders.filter((o) => o.status === filterStatus);

  const draftCount    = orders.filter((o) => o.status === 'DRAFT').length;
  const approvedCount = orders.filter((o) => o.status === 'APPROVED').length;
  const rejectedCount = orders.filter((o) => o.status === 'REJECTED').length;
  const allCount      = orders.length;

  return `
    <section class="root-hero" aria-labelledby="approvals-title">
      <p class="root-hero__eyebrow">Gestión</p>
      <h2 id="approvals-title">Aprobaciones</h2>
      <p class="muted">${draftCount} pendiente${draftCount !== 1 ? 's' : ''} · ${approvedCount} aprobado${approvedCount !== 1 ? 's' : ''} · ${rejectedCount} devuelto${rejectedCount !== 1 ? 's' : ''} · ${allCount} total</p>
    </section>
    <section class="commercial-page" id="approvals-page">
      <div id="approvals-message" role="status" aria-live="polite"></div>
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
        <button type="button" class="tab-button approvals-filter-btn ${filterStatus === 'DRAFT' ? 'active' : ''}" data-filter="DRAFT">Pendientes (${draftCount})</button>
        <button type="button" class="tab-button approvals-filter-btn ${filterStatus === 'APPROVED' ? 'active' : ''}" data-filter="APPROVED">Aprobados (${approvedCount})</button>
        <button type="button" class="tab-button approvals-filter-btn ${filterStatus === 'REJECTED' ? 'active' : ''}" data-filter="REJECTED">Devueltos (${rejectedCount})</button>
        <button type="button" class="tab-button approvals-filter-btn ${filterStatus === 'ALL' ? 'active' : ''}" data-filter="ALL">Todos (${allCount})</button>
      </div>
      <div id="approvals-list">
        ${filtered.length ? filtered.map(renderOrderRow).join('') : renderEmptyState()}
      </div>
    </section>`;
}

function showToast(containerEl, message, isError) {
  const region = containerEl.querySelector('#approvals-message');
  if (!region) return;
  region.innerHTML = `<div style="padding:10px 16px;border-radius:8px;font-weight:700;margin-bottom:12px;${isError ? 'background:#FEE2E2;color:#991B1B;' : 'background:#D1FAE5;color:#065F46;'}">${escapeHtml(message)}</div>`;
  setTimeout(() => { if (region) region.innerHTML = ''; }, 4000);
}

async function render(session, _item) {
  const containerEl = document.getElementById('root-view');
  if (!containerEl) return;

  const ordersApi = rootShell.require('ordersApi');
  let filterStatus = 'DRAFT';
  let activeTab = 'approvals'; // 'approvals' | 'dispatches'

  containerEl.innerHTML = renderSkeleton();

  let allOrders = [];
  let deliveredOrders = [];

  async function loadOrders() {
    try {
      const [ordersResult, dispatchedResult] = await Promise.all([
        ordersApi.listOrders(session),
        ordersApi.listDispatchedOrders(session),
      ]);
      allOrders = Array.isArray(ordersResult) ? ordersResult : (ordersResult?.items || ordersResult?.orders || []);
      allOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      deliveredOrders = Array.isArray(dispatchedResult) ? dispatchedResult : [];
    } catch (err) {
      containerEl.innerHTML = `
        <section class="root-hero"><h2>Aprobaciones</h2></section>
        <section class="commercial-page">
          <div class="agent-error-banner" style="margin-top:16px;">
            <p style="margin:0;font-weight:700;">Error al cargar pedidos</p>
            <p style="margin:0;">${escapeHtml(err.message || 'Error de red.')}</p>
            <button type="button" id="approvals-retry-btn" class="btn" style="margin-top:8px;">Reintentar</button>
          </div>
        </section>`;
      const retryBtn = containerEl.querySelector('#approvals-retry-btn');
      if (retryBtn) retryBtn.addEventListener('click', () => render(session, _item));
      return false;
    }
    return true;
  }

  function renderView() {
    const tabBar = `<div style="display:flex;gap:8px;margin-bottom:20px;">
      <button type="button" class="tab-button main-tab-btn ${activeTab === 'approvals' ? 'active' : ''}" data-tab="approvals">📋 Aprobaciones</button>
      <button type="button" class="tab-button main-tab-btn ${activeTab === 'dispatches' ? 'active' : ''}" data-tab="dispatches">🚚 Despachos (${deliveredOrders.length})</button>
    </div>`;
    if (activeTab === 'dispatches') {
      const inner = renderDispatchesTab(deliveredOrders);
      // Inject tab bar after root-hero
      containerEl.innerHTML = inner.replace('<section class="commercial-page">', `<section class="commercial-page">${tabBar}`);
    } else {
      const inner = renderOrdersList(allOrders, filterStatus);
      containerEl.innerHTML = inner.replace('<section class="commercial-page" id="approvals-page">', `<section class="commercial-page" id="approvals-page">${tabBar}`);
    }
    bindEvents();
  }

  function bindEvents() {
    // Filter tabs
    containerEl.querySelectorAll('.approvals-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        filterStatus = btn.getAttribute('data-filter') || 'DRAFT';
        renderView();
      });
    });

    // Approve buttons
    containerEl.querySelectorAll('.approvals-approve-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const orderId = btn.getAttribute('data-order-id');
        btn.disabled = true;
        btn.textContent = 'Aprobando…';
        try {
          await ordersApi.approveOrder(session, orderId);
          showToast(containerEl, `Pedido #${orderId} aprobado correctamente.`, false);
          await loadOrders();
          renderView();
        } catch (err) {
          showToast(containerEl, err.message || 'Error al aprobar el pedido.', true);
          btn.disabled = false;
          btn.textContent = '✓ Aprobar';
        }
      });
    });

    // Dispatch buttons
    containerEl.querySelectorAll('.approvals-dispatch-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const orderId = btn.getAttribute('data-order-id');
        btn.disabled = true;
        btn.textContent = 'Despachando…';
        try {
          await ordersApi.dispatchOrder(session, orderId);
          showToast(containerEl, `Pedido #${orderId} despachado correctamente.`, false);
          await loadOrders();
          renderView();
        } catch (err) {
          showToast(containerEl, err.message || 'Error al despachar el pedido.', true);
          btn.disabled = false;
          btn.textContent = '🚚 Despachar';
        }
      });
    });

    // Reject buttons — open a reason modal before calling /reject
    containerEl.querySelectorAll('.approvals-reject-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const orderId = btn.getAttribute('data-order-id');
        // Build inline modal
        const existing = containerEl.querySelector('#reject-reason-modal');
        if (existing) existing.remove();
        const modal = document.createElement('dialog');
        modal.id = 'reject-reason-modal';
        modal.style.cssText = 'border:none;border-radius:12px;padding:24px;max-width:420px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,.18);';
        modal.innerHTML = `
          <h3 style="margin:0 0 12px">↩️ Devolver pedido #${escapeHtml(String(orderId))} al agente</h3>
          <p style="font-size:.85rem;color:#64748b;margin:0 0 12px">El agente verá este motivo y podrá corregir y reenviar el pedido.</p>
          <label style="display:block;margin-bottom:16px">
            <span style="font-weight:600;font-size:.9rem">Motivo de rechazo *</span>
            <textarea id="reject-reason-input" rows="3" maxlength="500" placeholder="Ej: Precio incorrecto en producto X, ajustar descuento…"
              style="display:block;width:100%;margin-top:6px;padding:8px;border:1px solid #cbd5e1;border-radius:6px;font-size:.9rem;resize:vertical"></textarea>
          </label>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button type="button" id="reject-cancel-btn" class="secondary-button">Cancelar</button>
            <button type="button" id="reject-confirm-btn" style="background:#DC2626;color:#fff;border:none;padding:8px 20px;border-radius:6px;font-weight:700;cursor:pointer">Devolver al agente</button>
          </div>
          <p id="reject-modal-err" style="color:#c00;font-size:.85rem;margin:8px 0 0" hidden></p>`;
        containerEl.appendChild(modal);
        modal.showModal();
        modal.querySelector('#reject-cancel-btn').addEventListener('click', () => modal.close());
        modal.querySelector('#reject-confirm-btn').addEventListener('click', async () => {
          const reason = modal.querySelector('#reject-reason-input').value.trim();
          const errEl  = modal.querySelector('#reject-modal-err');
          if (reason.length < 5) { errEl.textContent = 'El motivo debe tener al menos 5 caracteres.'; errEl.hidden = false; return; }
          const confirmBtn = modal.querySelector('#reject-confirm-btn');
          confirmBtn.disabled = true;
          confirmBtn.textContent = 'Enviando…';
          try {
            await ordersApi.rejectOrder(session, orderId, reason);
            modal.close();
            showToast(containerEl, `Pedido #${orderId} devuelto al agente con motivo registrado.`, false);
            await loadOrders();
            renderView();
          } catch (err) {
            errEl.textContent = err.message || 'Error al rechazar el pedido.';
            errEl.hidden = false;
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Devolver al agente';
          }
        });
      });
    });
  }

  const loaded = await loadOrders();
  if (loaded) renderView();

  containerEl.addEventListener('click', (e) => {
    const btn = /** @type {HTMLElement} */ (e.target)?.closest('.main-tab-btn');
    if (!btn) return;
    const tab = btn.getAttribute('data-tab');
    if (tab && tab !== activeTab) {
      activeTab = tab;
      renderView();
    }
  });
}

rootShell.register('views.approvalsAdmin', { render });

})(typeof globalThis !== 'undefined' ? globalThis : window);
