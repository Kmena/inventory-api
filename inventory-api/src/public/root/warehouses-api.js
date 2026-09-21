(function attachRootWarehousesApi(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const inventoryAuth = /** @type {any} */ (globalScope).InventoryAuth;

  async function listCompanyWarehouses(session) {
    return inventoryAuth.fetchJson(session, '/api/warehouses/company', {
      fallbackMessage: 'No se pudieron cargar las bodegas.',
    });
  }

  async function getCompanyWarehouse(session, warehouseId) {
    return inventoryAuth.fetchJson(session, `/api/warehouses/company/${encodeURIComponent(warehouseId)}`, {
      fallbackMessage: 'No se pudo cargar la ubicacion.',
    });
  }

  async function createCompanyWarehouse(session, payload) {
    return inventoryAuth.fetchJson(session, '/api/warehouses/company', {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo crear la ubicacion.',
    });
  }

  async function updateCompanyWarehouse(session, warehouseId, payload) {
    return inventoryAuth.fetchJson(session, `/api/warehouses/company/${encodeURIComponent(warehouseId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo actualizar la ubicacion.',
    });
  }

  async function updateCompanyWarehouseStatus(session, warehouseId, payload) {
    return inventoryAuth.fetchJson(session, `/api/warehouses/company/${encodeURIComponent(warehouseId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo actualizar el estado de la ubicacion.',
    });
  }

  rootShell.register('warehousesApi', {
    createCompanyWarehouse,
    getCompanyWarehouse,
    listCompanyWarehouses,
    updateCompanyWarehouse,
    updateCompanyWarehouseStatus,
  });
}(window));
