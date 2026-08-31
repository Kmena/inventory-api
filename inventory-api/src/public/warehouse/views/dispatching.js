/**
 * Warehouse SPA — Dispatching view.
 *
 * Shows APPROVED orders waiting for dispatch.
 * Bodega selects transport method, tracking number, responsible person
 * and confirms dispatch. Shows the auto-allocated lots per product.
 */
(function attachWarehouseDispatchingView(globalScope) {
'use strict';

const WarehouseShell = /** @type {any} */ (globalScope).WarehouseShell;
const inventoryAuth  = /** @type {any} */ (globalScope).InventoryAuth;

const TRANSPORT_OPTIONS = [
  { value: 'PRIVATE',  label: '🚛 Transporte privado' },
  { value: 'MAIL',     label: '📮 Correo / Postal' },
  { value: 'COURIER',  label: '📦 Mensajería (courier)' },
  { value: 'OWN',      label: '🏍️ Delivery propio' },
  { value: 'PICKUP',   label: '🏪 Retiro en tienda' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function esc(str) {
  const d = document.createElement('div');
  d.textContent = String(str ?? '');
  return d.innerHTML;
}

function currency(v) {
  return '₡' + Number(v || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  } catch (_) { return '—'; }
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return `${fmtDate(iso)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  } catch (_) { return '—'; }
}

// ─── API ────────────────────────────────────────────────────────────────────

async function fetchApprovedOrders(session) {
  return inventoryAuth.fetchJson(session, '/api/warehouse-orders', { credentials: 'same-origin' });
}

async function fetchOrderDetail(session, orderId) {
  return inventoryAuth.fetchJson(session, `/api/warehouse-orders/${encodeURIComponent(orderId)}`, { credentials: 'same-origin' });
}

async function postDispatch(session, orderId, payload) {
  return inventoryAuth.fetchJson(session, `/api/warehouse-orders/${encodeURIComponent(orderId)}/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'same-origin',
  });
}

// ─── Renderers ──────────────────────────────────────────────────────────────

function renderSkeleton() {
  return `<div class="warehouse-section"><p class="warehouse-message">Cargando pedidos aprobados…</p></div>`;
}

function renderEmpty() {
  return `
    <div class="warehouse-section" style="text-align:center;padding:48px 16px;">
      <div style="font-size:3rem;margin-bottom:12px;">✅</div>
      <h3 style="margin:0 0 8px;">Sin pedidos pendientes de despacho</h3>
      <p class="warehouse-muted">Todos los pedidos aprobados ya fueron despachados.</p>
    </div>`;
}

function renderLotBadge(lot) {
  if (!lot) return '<span class="warehouse-muted" style="font-size:0.78rem;">Sin lote</span>';
  const exp = lot.expiresAt ? ` · vence ${fmtDate(lot.expiresAt)}` : '';
  return `<span style="font-size:0.78rem;background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:999px;">${esc(lot.code)}${exp}</span>`;
}

/** Render allocations grouped by productId */
function renderAllocations(allocations, items) {
  if (!allocations?.length) {
    return `<p class="warehouse-muted" style="font-size:0.82rem;">Sin asignaciones de lote (productos sin estrategia de lote).</p>`;
  }
  return items.map((item) => {
    const itemAllocs = allocations.filter((a) => String(a.productId) === String(item.productId));
    const lots = itemAllocs.map((a) => renderLotBadge(a.lot)).join(' ');
    return `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid #f1f5f9;flex-wrap:wrap;">
        <div>
          <span style="font-size:0.85rem;font-weight:600;">${esc(item.product?.name || '—')}</span>
          <span class="warehouse-muted" style="font-size:0.78rem;"> · ${esc(item.product?.code || '')}</span>
        </div>
        <div style="text-align:right;">
          <span style="font-size:0.85rem;">× ${esc(String(item.quantity))}</span>
          <div style="margin-top:4px;">${lots || '<span class="warehouse-muted" style="font-size:0.78rem;">Sin lote asignado</span>'}</div>
        </div>
      </div>`;
  }).join('');
}

function renderDispatchForm(order, allocations) {
  const orderId = String(order.id);
  const storeName = order.clientStore?.name || order.client?.tradeName || '—';
  const agentName = order.user?.fullName || '—';
  const total = Number(order.total || 0);
  const itemCount = (order.items || []).length;
  const transportOpts = TRANSPORT_OPTIONS.map((o) =>
    `<option value="${esc(o.value)}">${esc(o.label)}</option>`
  ).join('');

  return `
    <div class="warehouse-card dispatch-order-card" data-order-id="${esc(orderId)}" style="border:1px solid #bfdbfe;border-radius:12px;padding:20px;margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
        <div>
          <strong style="font-size:1rem;">#${esc(String(order.orderNumber || order.id))}</strong>
          <span style="margin-left:8px;font-size:0.78rem;background:#fef3c7;color:#92400e;padding:2px 10px;border-radius:999px;font-weight:700;">Aprobado</span>
        </div>
        <span class="warehouse-muted" style="font-size:0.82rem;">Aprobado: ${fmtDateTime(order.approvedAt)}</span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.85rem;margin-bottom:12px;">
        <div><span class="warehouse-muted">Tienda:</span> <strong>${esc(storeName)}</strong></div>
        <div><span class="warehouse-muted">Agente:</span> ${esc(agentName)}</div>
        <div><span class="warehouse-muted">Total:</span> <strong>${currency(total)}</strong></div>
        <div><span class="warehouse-muted">Bodega:</span> ${esc(order.warehouse?.name || '—')}</div>
      </div>

      <details style="margin-bottom:12px;">
        <summary style="cursor:pointer;font-size:0.85rem;font-weight:700;color:#2563eb;">
          Lotes asignados (${itemCount} producto${itemCount !== 1 ? 's' : ''})
        </summary>
        <div style="margin-top:8px;padding:10px 12px;background:#f8fafc;border-radius:8px;">
          ${renderAllocations(allocations, order.items || [])}
        </div>
      </details>

      <form class="dispatch-form" data-order-id="${esc(orderId)}">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <label style="display:flex;flex-direction:column;gap:4px;font-size:0.85rem;">
            <span style="font-weight:600;">Medio de transporte <span style="color:#dc2626;">*</span></span>
            <select name="transportMethod" required style="padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.85rem;">
              <option value="">— Seleccione —</option>
              ${transportOpts}
            </select>
          </label>
          <label style="display:flex;flex-direction:column;gap:4px;font-size:0.85rem;">
            <span style="font-weight:600;">Número de guía / tracking</span>
            <input name="trackingNumber" type="text" placeholder="ej. CR123456789" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.85rem;" />
          </label>
        </div>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:0.85rem;margin-bottom:12px;">
          <span style="font-weight:600;">Responsable del transporte <span style="color:#dc2626;">*</span></span>
          <input name="transportResponsible" type="text" placeholder="Nombre del transportista o empresa" required style="padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.85rem;" />
        </label>
        <div class="dispatch-msg" style="margin-bottom:8px;font-size:0.85rem;"></div>
        <button type="submit" class="warehouse-btn warehouse-btn--primary" style="width:100%;">
          🚚 Confirmar despacho
        </button>
      </form>
    </div>`;
}

function renderOrderList(orders) {
  const count = orders.length;
  return `
    <div class="warehouse-section">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
        <h2 style="margin:0;font-size:1.1rem;">Pedidos aprobados por despachar <span style="font-size:0.85rem;color:#64748b;">(${count})</span></h2>
        <button type="button" id="dispatch-refresh-btn" class="warehouse-btn warehouse-btn--secondary" style="font-size:0.82rem;">↻ Actualizar</button>
      </div>
      <div id="dispatch-orders-container">
        ${count ? orders.map((o) => renderDispatchForm(o, o.allocations || [])).join('') : renderEmpty()}
      </div>
    </div>`;
}

// ─── Main render ─────────────────────────────────────────────────────────────

async function render(containerEl, session) {
  containerEl.innerHTML = renderSkeleton();

  async function load() {
    try {
      const raw = await fetchApprovedOrders(session);
      const orders = Array.isArray(raw) ? raw : (raw?.items || []);

      // Enrich each order with its allocations
      const enriched = await Promise.all(orders.map(async (o) => {
        try {
          const detail = await fetchOrderDetail(session, String(o.id));
          return { ...o, allocations: detail?.allocations || [] };
        } catch (_) {
          return { ...o, allocations: [] };
        }
      }));

      containerEl.innerHTML = renderOrderList(enriched);
      bindEvents(containerEl, session, load);
    } catch (err) {
      containerEl.innerHTML = `
        <div class="warehouse-section">
          <div class="warehouse-error-banner">
            <p style="margin:0;font-weight:700;">Error al cargar pedidos</p>
            <p style="margin:0;">${esc(err.message || 'Error de red.')}</p>
            <button type="button" id="dispatch-retry-btn" class="warehouse-btn warehouse-btn--secondary" style="margin-top:8px;">Reintentar</button>
          </div>
        </div>`;
      const retryBtn = containerEl.querySelector('#dispatch-retry-btn');
      if (retryBtn) retryBtn.addEventListener('click', load);
    }
  }

  await load();
}

function bindEvents(containerEl, session, reload) {
  const refreshBtn = containerEl.querySelector('#dispatch-refresh-btn');
  if (refreshBtn) refreshBtn.addEventListener('click', reload);

  containerEl.querySelectorAll('.dispatch-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const orderId = form.getAttribute('data-order-id') || '';
      const fd = new FormData(/** @type {HTMLFormElement} */ (form));
      const payload = {
        transportMethod:       String(fd.get('transportMethod') || '').trim() || null,
        trackingNumber:        String(fd.get('trackingNumber') || '').trim() || null,
        transportResponsible:  String(fd.get('transportResponsible') || '').trim() || null,
      };
      const msgEl = form.querySelector('.dispatch-msg');
      const submitBtn = form.querySelector('[type="submit"]');

      if (!payload.transportMethod) {
        if (msgEl) msgEl.innerHTML = '<span style="color:#dc2626;">Seleccione el medio de transporte.</span>';
        return;
      }
      if (!payload.transportResponsible) {
        if (msgEl) msgEl.innerHTML = '<span style="color:#dc2626;">Ingrese el responsable del transporte.</span>';
        return;
      }

      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Despachando…'; }
      if (msgEl) msgEl.innerHTML = '';

      try {
        await postDispatch(session, orderId, payload);
        // Remove the card from the DOM immediately
        const card = containerEl.querySelector(`[data-order-id="${CSS.escape(orderId)}"].dispatch-order-card`);
        if (card) {
          card.innerHTML = `<div style="padding:12px;background:#d1fae5;border-radius:8px;color:#065f46;font-weight:700;">✅ Pedido #${esc(orderId)} despachado correctamente.</div>`;
          setTimeout(() => { if (card.parentNode) card.remove(); }, 3000);
        }
      } catch (err) {
        if (msgEl) msgEl.innerHTML = `<span style="color:#dc2626;">${esc(err.message || 'Error al despachar.')}</span>`;
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '🚚 Confirmar despacho'; }
      }
    });
  });
}

WarehouseShell.register('views.dispatching', { render });

})(typeof globalThis !== 'undefined' ? globalThis : window);
