(function attachRootProductionAdminApi(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const inventoryAuth = /** @type {any} */ (globalScope).InventoryAuth;

  function buildQueryString(query = {}) {
    const searchParams = new URLSearchParams();

    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      searchParams.set(key, String(value));
    });

    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  }

  function buildServerListQuery(query = {}) {
    return {
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async function listProductionOrders(session, query = {}) {
    return inventoryAuth.fetchJson(session, `/api/production/orders${buildQueryString(buildServerListQuery(query))}`, {
      fallbackMessage: 'No se pudieron cargar las ordenes de produccion.',
    });
  }

  async function getProductionOrder(session, productionOrderId) {
    return inventoryAuth.fetchJson(session, `/api/production/orders/${encodeURIComponent(productionOrderId)}`, {
      fallbackMessage: 'No se pudo cargar el detalle de la orden de produccion.',
    });
  }

  async function createProductionOrder(session, payload) {
    return inventoryAuth.fetchJson(session, '/api/production/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo crear la orden de produccion.',
    });
  }

  rootShell.register('productionAdminApi', {
    buildServerListQuery,
    createProductionOrder,
    getProductionOrder,
    listProductionOrders,
  });
}(window));
