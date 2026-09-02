(() => {
'use strict';

const AgentShell = /** @type {any} */ (window).AgentShell;
const inventoryAuth = /** @type {any} */ (window).InventoryAuth;

const BASE = '/api/agent';

/**
 * GET /api/agent/dashboard
 * @param {any} session
 */
async function fetchDashboard(session) {
  return inventoryAuth.fetchJson(session, `${BASE}/dashboard`, { credentials: 'same-origin' });
}

/**
 * GET /api/agent/stores
 * @param {any} session
 */
async function fetchStores(session) {
  return inventoryAuth.fetchJson(session, `${BASE}/stores`, { credentials: 'same-origin' });
}

/**
 * GET /api/agent/goals
 * @param {any} session
 */
async function fetchGoals(session) {
  return inventoryAuth.fetchJson(session, `${BASE}/goals`, { credentials: 'same-origin' });
}

/**
 * GET /api/agent/stores/:storeId
 * Retorna { store, latestVisit, visitHistory[], purchaseHistory, sellableProducts }
 * @param {any} session
 * @param {string|number} storeId
 */
async function fetchStoreDetail(session, storeId) {
  return inventoryAuth.fetchJson(session, `${BASE}/stores/${encodeURIComponent(storeId)}`, { credentials: 'same-origin' });
}

/**
 * GET /api/agent/stores/:storeId/order-context
 * @param {any} session
 * @param {string|number} storeId
 */
async function fetchOrderContext(session, storeId) {
  return inventoryAuth.fetchJson(session, `${BASE}/stores/${encodeURIComponent(storeId)}/order-context`, { credentials: 'same-origin' });
}

/**
 * POST /api/agent/visits
 * El clientStoreId va dentro del payload (body), no en el path.
 * @param {any} session
 * @param {{ clientStoreId: string|number, motive: string, result: string, comment?: string, suggestedNextVisitAt?: string }} payload
 */
async function postVisit(session, payload) {
  return inventoryAuth.fetchJson(session, `${BASE}/visits`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/**
 * GET /api/agent/orders — pedidos del agente.
 * @param {any} session
 */
async function fetchOrders(session) {
  return inventoryAuth.fetchJson(session, `${BASE}/orders`, { credentials: 'same-origin' });
}

/**
 * POST /api/agent/stores/:storeId/orders
 * @param {any} session
 * @param {string|number} storeId
 * @param {any} payload
 */
async function postOrder(session, storeId, payload) {
  return inventoryAuth.fetchJson(session, `${BASE}/stores/${encodeURIComponent(storeId)}/orders`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/**
 * POST /api/agent/stores/:storeId/payments
 * @param {any} session
 * @param {string|number} storeId
 * @param {any} payload
 */
async function postPayment(session, storeId, payload) {
  return inventoryAuth.fetchJson(session, `${BASE}/stores/${encodeURIComponent(storeId)}/payments`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/**
 * PATCH /api/orders/:id — update items/fields of an existing REJECTED order before resubmitting.
 * @param {any} session
 * @param {string|number} orderId
 * @param {any} payload
 */
async function updateOrderItems(session, orderId, payload) {
  return inventoryAuth.fetchJson(session, `/api/orders/${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/**
 * POST /api/orders/:id/resubmit — agent resubmits a REJECTED order after correction.
 * @param {any} session
 * @param {string|number} orderId
 */
async function resubmitOrder(session, orderId) {
  return inventoryAuth.fetchJson(session, `/api/orders/${encodeURIComponent(orderId)}/resubmit`, {
    method: 'POST',
    credentials: 'same-origin',
  });
}

AgentShell.register('api.agentApi', {
  fetchDashboard,
  fetchStores,
  fetchGoals,
  fetchStoreDetail,
  fetchOrderContext,
  fetchOrders,
  updateOrderItems,
  resubmitOrder,
  postVisit,
  postOrder,
  postPayment,
});

})();
