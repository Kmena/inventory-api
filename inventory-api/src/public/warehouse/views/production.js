/**
 * Warehouse SPA — Production view.
 *
 * Lists active production orders and exposes:
 *  - Stage execution (warehouse.receive permission)
 *  - QA inspection creation (quality.inspect permission)
 *  - Read-only recipe snapshot navigation
 *
 * Permission: warehouse.receive | quality.inspect
 */
(() => {
const WarehouseShell = /** @type {any} */ (window).WarehouseShell;

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const ORDER_STATUS_LABELS = /** @type {Record<string, string>} */ ({
  IN_PROGRESS:  'En progreso',
  WAITING_QA:   'Esperando QA',
  QA_HOLD:      'Retenido QA',
  COMPLETED:    'Completado',
  CANCELLED:    'Cancelado',
});

const ORDER_STATUS_BADGE = /** @type {Record<string, string>} */ ({
  IN_PROGRESS: 'wh-badge--pending',
  WAITING_QA:  'wh-badge--hold',
  QA_HOLD:     'wh-badge--hold',
  COMPLETED:   'wh-badge--confirmed',
  CANCELLED:   'wh-badge--rejected',
});

function renderStatusBadge(status) {
  const label = ORDER_STATUS_LABELS[status] || status;
  const cls = ORDER_STATUS_BADGE[status] || 'wh-badge--pending';
  return `<span class="wh-badge ${cls}">${escapeHtml(label)}</span>`;
}

// -----------------------------------------------------------------------
// Order list
// -----------------------------------------------------------------------

function renderOrderList(container, session) {
  const api = WarehouseShell.require('warehouseApi');
  const app = WarehouseShell.require('app');

  container.innerHTML = `
    <div class="warehouse-section">
      <h2 class="warehouse-section__title">Ordenes de produccion activas</h2>
      <p id="production-status" role="status" aria-live="polite">Cargando ordenes...</p>
      <ul id="production-list" class="warehouse-card-list" aria-label="Ordenes de produccion activas"></ul>
    </div>
  `;

  const statusEl = container.querySelector('#production-status');
  const listEl = container.querySelector('#production-list');

  api.listActiveProductionOrders(session)
    .then((/** @type {any[]} */ orders) => {
      if (statusEl) { statusEl.hidden = true; }
      if (!orders || orders.length === 0) {
        if (listEl) { listEl.innerHTML = '<li class="warehouse-empty">No hay ordenes de produccion activas.</li>'; }
        return;
      }

      if (listEl) { listEl.innerHTML = ''; }
      for (const order of orders) {
        const li = document.createElement('li');
        li.innerHTML = `
          <article class="wh-receipt-card">
            <div class="wh-receipt-card__header">
              <span class="wh-receipt-card__id">#ORD-${escapeHtml(String(order.id))}</span>
              ${renderStatusBadge(order.status)}
            </div>
            <p class="wh-receipt-card__meta">${escapeHtml(order.productName || '—')}</p>
            <p class="wh-receipt-card__meta">Cantidad planificada: <strong>${escapeHtml(String(order.plannedQuantity || '—'))}</strong></p>
            <div class="wh-receipt-card__cta">
              <button type="button" class="primary-button wh-order-view-btn"
                      data-order-id="${escapeHtml(String(order.id))}">Ver →</button>
            </div>
          </article>
        `;
        if (listEl) { listEl.append(li); }
      }

      if (listEl) {
        listEl.addEventListener('click', (evt) => {
          const btn = /** @type {HTMLElement} */ (evt.target);
          if (btn.classList.contains('wh-order-view-btn')) {
            const oid = btn.dataset.orderId;
            if (oid) { app.navigate('production', { id: oid }); }
          }
        });
      }
    })
    .catch((/** @type {any} */ err) => {
      if (statusEl) { statusEl.textContent = err?.message || 'Error al cargar ordenes.'; }
    });
}

// -----------------------------------------------------------------------
// Order detail
// -----------------------------------------------------------------------

function renderOrderDetail(container, session, params) {
  const api = WarehouseShell.require('warehouseApi');
  const app = WarehouseShell.require('app');
  const state = WarehouseShell.require('state');

  const permissions = state.derivePermissions(session);
  const orderId = params.id;

  container.innerHTML = `
    <div class="warehouse-section">
      <button type="button" class="wh-back-btn" id="back-to-orders">← Produccion</button>
      <p id="order-detail-status" role="status" aria-live="polite">Cargando orden...</p>
      <div id="order-detail-content"></div>
    </div>
  `;

  container.querySelector('#back-to-orders')?.addEventListener('click', () => app.navigate('production'));
  const statusEl = container.querySelector('#order-detail-status');
  const contentEl = container.querySelector('#order-detail-content');

  api.getProductionOrder(session, orderId)
    .then((/** @type {any} */ order) => {
      if (statusEl) { statusEl.hidden = true; }
      renderOrderContent(contentEl, session, order, permissions, params);
    })
    .catch((/** @type {any} */ err) => {
      if (statusEl) { statusEl.textContent = err?.message || 'Error al cargar la orden.'; }
    });
}

function renderOrderContent(container, session, order, permissions, params = {}) {
  const app = WarehouseShell.require('app');
  const stages = order.stages || [];

  let stagesHtml = '';
  for (const stage of stages) {
    const qaRequired = stage.requiresQualityCheck === true;
    stagesHtml += `
      <li class="wh-item-card">
        <h3 class="wh-item-card__name">${escapeHtml(stage.name || `Etapa ${stage.sequence || stage.id}`)}</h3>
        ${qaRequired ? '<p class="wh-qa-required-badge">🔍 QA Obligatorio</p>' : ''}
        <p class="wh-item-card__meta">Estado: ${renderStatusBadge(stage.status || 'PENDING')}</p>
        <div class="wh-stage-actions">
          ${permissions.canReceive
            ? `<button type="button" class="secondary-button wh-execute-stage-btn"
                       data-stage-id="${escapeHtml(String(stage.id))}"
                       data-order-id="${escapeHtml(String(order.id))}">
                 Ejecutar etapa
               </button>`
            : ''}
          ${permissions.canInspect && qaRequired
            ? `<button type="button" class="secondary-button wh-inspect-stage-btn"
                       data-stage-id="${escapeHtml(String(stage.id))}"
                       data-order-id="${escapeHtml(String(order.id))}">
                 Inspeccionar
               </button>`
            : ''}
        </div>
      </li>
    `;
  }

  if (container) {
    container.innerHTML = `
      <header class="wh-order-detail__header">
        <span class="wh-receipt-card__id">#ORD-${escapeHtml(String(order.id))}</span>
        ${renderStatusBadge(order.status)}
      </header>
      <p class="wh-receipt-card__meta">Producto: <strong>${escapeHtml(order.productName || '—')}</strong></p>
      <div class="wh-order-detail__actions">
        <button type="button" class="secondary-button" id="view-recipe-btn"
                data-order-id="${escapeHtml(String(order.id))}">
          📋 Ver receta congelada
        </button>
      </div>
      <h2 class="warehouse-section__title">Etapas</h2>
      ${params.action === 'execute' ? '<div class="wh-alert wh-alert--info" role="note">La captura detallada de ejecucion por etapa seguira en un ciclo posterior. Esta vista mantiene navegacion y consulta segura.</div>' : ''}
      ${params.action === 'inspect' ? '<div class="wh-alert wh-alert--info" role="note">La captura guiada de inspeccion por etapa seguira en un ciclo posterior. Use la consulta de orden y receta congelada mientras se habilita el formulario dedicado.</div>' : ''}
      <ul class="wh-item-list" id="stages-list">${stagesHtml}</ul>
    `;

    container.querySelector('#view-recipe-btn')?.addEventListener('click', () => {
      app.navigate('recipe-consultation', { orderId: String(order.id) });
    });

    // Execute stage buttons (stub interaction for TASK-017)
    container.querySelectorAll('.wh-execute-stage-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const stageId = /** @type {HTMLElement} */ (btn).dataset.stageId;
        app.navigate('production', { id: String(order.id), action: 'execute', stageId });
      });
    });

    // Inspect stage buttons (stub interaction for TASK-017)
    container.querySelectorAll('.wh-inspect-stage-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const stageId = /** @type {HTMLElement} */ (btn).dataset.stageId;
        app.navigate('production', { id: String(order.id), action: 'inspect', stageId });
      });
    });
  }
}

// -----------------------------------------------------------------------
// Main render
// -----------------------------------------------------------------------

function render(container, session, params) {
  if (params.id) {
    renderOrderDetail(container, session, params);
  } else {
    renderOrderList(container, session);
  }
}

WarehouseShell.register('views.production', { render });
})();
