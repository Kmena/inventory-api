(function attachRootPurchaseOrdersApi(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const inventoryAuth = /** @type {any} */ (globalScope).InventoryAuth;

  async function listOrders(session) {
    return inventoryAuth.fetchJson(session, '/api/procurement/orders', {
      fallbackMessage: 'No se pudieron cargar las órdenes de compra.',
    });
  }

  rootShell.register('purchaseOrdersApi', {
    listOrders,
  });
}(window));
