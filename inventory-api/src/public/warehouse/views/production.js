/**
 * Warehouse SPA — Production view (orchestrator / delegate).
 *
 * This file is intentionally thin: it delegates to
 *   - views.productionState     (pure state helpers)
 *   - views.productionRenderers (HTML generation)
 *   - views.productionControllers (event wiring)
 *
 * Permissions:
 *   production.execute  — canExecuteProduction
 *   production.complete — canCompleteProduction
 *   production.view     — canViewProduction
 */
(() => {
const WarehouseShell = /** @type {any} */ (window).WarehouseShell;

async function renderOrderList(container, session) {
  const api = WarehouseShell.require('warehouseApi');
  const state = WarehouseShell.require('state');
  const renderers = WarehouseShell.require('views.productionRenderers');
  const controllers = WarehouseShell.require('views.productionControllers');
  const appShell = WarehouseShell.require('app');
  const permissions = state.derivePermissions(session);

  container.innerHTML = `
    <div class="warehouse-section">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <h2 class="warehouse-section__title" style="margin:0">Ordenes de produccion activas</h2>
        ${permissions.canCreateProduction
          ? '<button type="button" class="primary-button" id="prod-new-cta">➕ Nueva orden</button>'
          : ''}
      </div>
      <p id="production-status" role="status" aria-live="polite">Cargando ordenes...</p>
      <ul id="production-list" class="warehouse-card-list" aria-label="Ordenes de produccion activas"></ul>
    </div>
  `;

  container.querySelector('#prod-new-cta')?.addEventListener('click', () => appShell.navigate('production', { action: 'new' }));

  const statusEl = container.querySelector('#production-status');
  const listEl = container.querySelector('#production-list');

  try {
    const orders = await api.listActiveProductionOrders(session);
    if (statusEl) { statusEl.hidden = true; }
    if (listEl) { listEl.innerHTML = renderers.renderOrderList(orders); }
    controllers.attachOrderListHandlers(listEl || container);
  } catch (err) {
    if (statusEl) { statusEl.textContent = err?.message || 'Error al cargar ordenes.'; }
  }
}

async function renderOrderDetail(container, session, params) {
  const api = WarehouseShell.require('warehouseApi');
  const state = WarehouseShell.require('state');
  const productionState = WarehouseShell.require('views.productionState');
  const renderers = WarehouseShell.require('views.productionRenderers');
  const controllers = WarehouseShell.require('views.productionControllers');
  const app = WarehouseShell.require('app');
  const permissions = state.derivePermissions(session);

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

  const reload = () => renderOrderDetail(container, session, params);

  try {
    const [order, reqResponse, warehousesResponse] = await Promise.all([
      api.getProductionOrder(session, params.id),
      api.getMaterialRequirements(session, params.id).catch(() => null),
      api.listWarehouses(session).catch(() => null),
    ]);

    if (statusEl) { statusEl.hidden = true; }

    const requirements = Array.isArray(reqResponse?.items) ? reqResponse.items : [];
    const warehouses = Array.isArray(warehousesResponse?.items)
      ? warehousesResponse.items
      : (Array.isArray(warehousesResponse) ? warehousesResponse : []);
    const stagesVm = productionState.buildStagesViewModel(order, requirements);

    if (contentEl) {
      contentEl.innerHTML = renderers.renderOrderDetail(order, permissions, stagesVm, requirements, warehouses);
    }

    controllers.attachOrderDetailHandlers(
      contentEl || container, session, order, stagesVm, reload,
    );
  } catch (err) {
    if (statusEl) {
      statusEl.hidden = false; // restore visibility in case it was hidden before the error
      statusEl.textContent = err?.message || 'Error al cargar la orden.';
    }
  }
}

function render(container, session, params = {}) {
  if (params.action === 'new') {
    const productionNew = WarehouseShell.require('views.productionNew');
    productionNew.render(container, session, params);
    return;
  }
  if (params.id) {
    renderOrderDetail(container, session, params);
  } else {
    renderOrderList(container, session);
  }
}

WarehouseShell.register('views.production', { render });
})();
