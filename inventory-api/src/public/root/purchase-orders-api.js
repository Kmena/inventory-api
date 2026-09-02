(function attachRootPurchaseOrdersApi(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const inventoryAuth = /** @type {any} */ (globalScope).InventoryAuth;

  async function listOrders(session) {
    return inventoryAuth.fetchJson(session, '/api/procurement/orders', {
      fallbackMessage: 'No se pudieron cargar las órdenes de compra.',
    });
  }

  async function issueOrder(session, orderId) {
    return inventoryAuth.fetchJson(session, `/api/procurement/orders/${encodeURIComponent(orderId)}/issue`, {
      method: 'POST',
      fallbackMessage: 'No se pudo emitir la orden de compra.',
    });
  }

  /**
   * Cancela una OC. reopen=true también reabre la solicitud de compra.
   * @param {{ reopen?: boolean }} [options]
   */
  async function cancelOrder(session, orderId, options = {}) {
    return inventoryAuth.fetchJson(session, `/api/procurement/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reopen: Boolean(options.reopen) }),
      fallbackMessage: 'No se pudo cancelar la orden de compra.',
    });
  }

  rootShell.register('purchaseOrdersApi', {
    listOrders,
    issueOrder,
    cancelOrder,
  });
}(window));
