(function attachRootWarehousesApi(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const inventoryAuth = /** @type {any} */ (globalScope).InventoryAuth;

  async function listCompanyWarehouses(session) {
    return inventoryAuth.fetchJson(session, '/api/warehouses/company', {
      fallbackMessage: 'No se pudieron cargar las bodegas.',
    });
  }

  async function createCompanyWarehouse(session, payload) {
    return inventoryAuth.fetchJson(session, '/api/warehouses/company', {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo crear la bodega.',
    });
  }

  rootShell.register('warehousesApi', {
    createCompanyWarehouse,
    listCompanyWarehouses,
  });
}(window));
