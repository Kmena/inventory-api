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

AgentShell.register('api.agentApi', {
  fetchDashboard,
  fetchStores,
  fetchGoals,
  fetchStoreDetail,
  fetchOrderContext,
  postVisit,
  postOrder,
});

})();
