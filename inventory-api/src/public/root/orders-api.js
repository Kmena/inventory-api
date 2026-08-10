(function attachOrdersApi(globalScope) {
'use strict';

const rootShell = /** @type {any} */ (globalScope).RootShell;
const inventoryAuth = /** @type {any} */ (globalScope).InventoryAuth;

const BASE = '/api/orders';

/**
 * GET /api/orders — list orders for the company.
 * @param {any} session
 * @param {{ page?: number, pageSize?: number }} [pagination]
 */
async function listOrders(session, pagination) {
  const params = new URLSearchParams();
  if (pagination?.page) params.set('page', String(pagination.page));
  if (pagination?.pageSize) params.set('pageSize', String(pagination.pageSize));
  const qs = params.toString();
  return inventoryAuth.fetchJson(session, `${BASE}${qs ? '?' + qs : ''}`, { credentials: 'same-origin' });
}

/**
 * POST /api/orders/:id/approve
 * @param {any} session
 * @param {string|number} orderId
 */
async function approveOrder(session, orderId) {
  return inventoryAuth.fetchJson(session, `${BASE}/${encodeURIComponent(orderId)}/approve`, {
    method: 'POST',
    credentials: 'same-origin',
  });
}

/**
 * POST /api/orders/:id/cancel
 * @param {any} session
 * @param {string|number} orderId
 */
async function cancelOrder(session, orderId) {
  return inventoryAuth.fetchJson(session, `${BASE}/${encodeURIComponent(orderId)}/cancel`, {
    method: 'POST',
    credentials: 'same-origin',
  });
}

/**
 * POST /api/orders/:id/dispatch
 * @param {any} session
 * @param {string|number} orderId
 */
async function dispatchOrder(session, orderId) {
  return inventoryAuth.fetchJson(session, `${BASE}/${encodeURIComponent(orderId)}/dispatch`, {
    method: 'POST',
    credentials: 'same-origin',
  });
}

rootShell.register('ordersApi', {
  listOrders,
  approveOrder,
  cancelOrder,
  dispatchOrder,
});

})(typeof globalThis !== 'undefined' ? globalThis : window);
