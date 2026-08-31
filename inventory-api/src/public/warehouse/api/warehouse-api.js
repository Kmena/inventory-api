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
  return safeFetch(session, '/api/production/orders?status=DRAFT,PENDING_APPROVAL,APPROVED,IN_PROGRESS,WAITING_QA');
}

function getProductionOrder(session, orderId) {
  return safeFetch(session, `/api/production/orders/${orderId}`);
}

function getMaterialRequirements(session, orderId) {
  return safeFetch(session, `/api/production/orders/${orderId}/material-requirements`);
}

function getAvailableLotsForStage(session, orderId, stageId) {
  return safeFetch(session, `/api/production/orders/${orderId}/stages/${stageId}/available-lots`);
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
// Purchase orders (for receipt workflow)
// -----------------------------------------------------------------------

function listPurchaseOrdersForReceipt(session) {
  return safeFetch(session, '/api/receipts/purchase-orders');
}

function createReceipt(session, payload) {
  return safeFetch(session, '/api/receipts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function listWarehouses(session) {
  return safeFetch(session, '/api/warehouses/company')
    .then((result) => result?.items ?? result ?? []);
}

// -----------------------------------------------------------------------
// Inventory (stocks + lot stocks)
// -----------------------------------------------------------------------

function listInventoryStocks(session) {
  return safeFetch(session, '/api/inventory/stocks');
}

// -----------------------------------------------------------------------
// Production order lifecycle
// -----------------------------------------------------------------------

function submitProductionOrder(session, orderId) {
  return safeFetch(session, `/api/production/orders/${orderId}/submit`, { method: 'POST' });
}

function approveProductionOrder(session, orderId, payload = {}) {
  return safeFetch(session, `/api/production/orders/${orderId}/approve`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function startProductionOrder(session, orderId) {
  return safeFetch(session, `/api/production/orders/${orderId}/start`, { method: 'POST' });
}

function completeProductionOrder(session, orderId, payload) {
  return safeFetch(session, `/api/production/orders/${orderId}/complete`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function createProductionOrder(session, payload) {
  return safeFetch(session, '/api/production/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * POST /api/production/orders/:id/cancel
 * Cancels a production order and optionally returns consumed materials to stock.
 * payload.returns[] — array of { productId, quantity, targetLotId?, newLotCode?, expirationDate?, note? }
 * Returns[] with quantity = 0 are ignored by the server.
 * Permission: production.cancel
 */
function cancelProductionOrder(session, orderId, payload = {}) {
  return safeFetch(session, `/api/production/orders/${orderId}/cancel`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// -----------------------------------------------------------------------
// Dropdown data sources (used by the production creation form)
// -----------------------------------------------------------------------

function listRecipes(session) {
  return safeFetch(session, '/api/recipes')
    .then((result) => result?.items ?? result ?? []);
}

function listProducts(session) {
  return safeFetch(session, '/api/products')
    .then((result) => result?.items ?? result ?? []);
}

function listCompanyUsers(session) {
  return safeFetch(session, '/api/users/company')
    .then((result) => result?.items ?? result ?? []);
}

// -----------------------------------------------------------------------
// Register
// -----------------------------------------------------------------------

// ─── TASK-007: Stage loss API (production-stage-rejection-and-reexecution) ───

/**
 * POST /api/production/orders/:orderId/stages/:stageId/losses
 * Registers post-rejection losses (or declares zero losses with losses:[]).
 * Permission: production.manage
 */
function registerStageLosses(session, orderId, stageId, payload) {
  return safeFetch(
    session,
    `/api/production/orders/${orderId}/stages/${stageId}/losses`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

/**
 * GET /api/production/orders/:orderId/stages/:stageId/losses
 * Returns all loss records for all executions of this stage.
 * Permission: production.view
 */
function getStageLosses(session, orderId, stageId) {
  return safeFetch(
    session,
    `/api/production/orders/${orderId}/stages/${stageId}/losses`,
  );
}

/**
 * POST /api/production/orders/:orderId/recolections/:recolectionId/confirm
 * Confirms that the material for a recolection stage is available.
 * Permission: production.execute
 * @param {any} session
 * @param {string|bigint} orderId
 * @param {string|bigint} recolectionId
 * @param {{notes?:string}} payload
 */
function confirmRecolection(session, orderId, recolectionId, payload) {
  return safeFetch(
    session,
    `/api/production/orders/${orderId}/recolections/${recolectionId}/confirm`,
    {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    },
  );
}

/**
 * Records reconciliation outcomes for a recolection/recovery stage.
 * TASK-007 (qa-rejection-material-reconciliation-amendment)
 * @param {object} session
 * @param {string|bigint} orderId
 * @param {string|bigint} recolectionId
 * @param {Array<{productId:string|bigint, lotId:string|bigint, quantity:number, outcome:string, notes?:string|null}>} outcomes
 */
function reconcileRecolection(session, orderId, recolectionId, outcomes) {
  return safeFetch(
    session,
    `/api/production/orders/${orderId}/recolections/${recolectionId}/reconciliation`,
    {
      method: 'POST',
      body: JSON.stringify({ outcomes }),
    },
  );
}

WarehouseShell.register('warehouseApi', {
  listPendingReceipts,
  getReceipt,
  inspectReceiptItem,
  confirmReceipt,
  reverseReceipt,
  listActiveProductionOrders,
  getProductionOrder,
  getMaterialRequirements,
  getAvailableLotsForStage,
  executeProductionStage,
  createProductionQAInspection,
  listPurchaseOrdersForReceipt,
  createReceipt,
  listWarehouses,
  listInventoryStocks,
  submitProductionOrder,
  approveProductionOrder,
  startProductionOrder,
  completeProductionOrder,
  createProductionOrder,
  listRecipes,
  listProducts,
  listCompanyUsers,
  // TASK-007: rejection + re-execution
  registerStageLosses,
  getStageLosses,
  // Cancel with optional stock returns
  cancelProductionOrder,
  // TASK-007 (qa-rejection-disposition): recolection confirmation
  confirmRecolection,
  // TASK-007 (qa-rejection-material-reconciliation-amendment): reconciliation outcomes
  reconcileRecolection,
});
})();
