/**
 * Warehouse SPA — API wrappers.
 *
 * All calls use InventoryAuth.fetchJson() with credentials: 'same-origin'.
 * No auth logic is duplicated here (§2 ui-guidelines).
 * Callers receive structured error objects when requests fail.
 */
(() => {
const inventoryAuth = /** @type {any} */ (window).InventoryAuth;
const WarehouseShell = /** @type {any} */ (window).WarehouseShell;

function buildApiError(message, statusCode = 0) {
  return { error: true, message, statusCode };
}

async function safeFetch(session, url, options = {}) {
  try {
    return await inventoryAuth.fetchJson(session, url, options);
  } catch (err) {
    const message = /** @type {any} */ (err)?.message || 'Error de red. Intente de nuevo.';
    throw buildApiError(message, /** @type {any} */ (err)?.statusCode || 0);
  }
}

// -----------------------------------------------------------------------
// Receipts
// -----------------------------------------------------------------------

function listPendingReceipts(session) {
  return safeFetch(session, '/api/receipts?status=PENDING_INSPECTION');
}

function getReceipt(session, id) {
  return safeFetch(session, `/api/receipts/${id}`);
}

function inspectReceiptItem(session, receiptId, itemId, payload) {
  return safeFetch(session, `/api/receipts/${receiptId}/items/${itemId}/inspections`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function confirmReceipt(session, id) {
  return safeFetch(session, `/api/receipts/${id}/confirm`, { method: 'POST' });
}

function reverseReceipt(session, id) {
  return safeFetch(session, `/api/receipts/${id}/reverse`, { method: 'POST' });
}

// -----------------------------------------------------------------------
// Production
// -----------------------------------------------------------------------

function listActiveProductionOrders(session) {
  return safeFetch(session, '/api/production/orders?status=IN_PROGRESS,WAITING_QA');
}

function getProductionOrder(session, orderId) {
  return safeFetch(session, `/api/production/orders/${orderId}`);
}

function executeProductionStage(session, orderId, stageId, payload) {
  return safeFetch(session, `/api/production/orders/${orderId}/stages/${stageId}/execute`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function createProductionQAInspection(session, orderId, stageId, payload) {
  return safeFetch(session, `/api/production/orders/${orderId}/stages/${stageId}/inspections`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// -----------------------------------------------------------------------
// Register
// -----------------------------------------------------------------------

WarehouseShell.register('warehouseApi', {
  listPendingReceipts,
  getReceipt,
  inspectReceiptItem,
  confirmReceipt,
  reverseReceipt,
  listActiveProductionOrders,
  getProductionOrder,
  executeProductionStage,
  createProductionQAInspection,
});
})();
