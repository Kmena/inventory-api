(function attachRootInventoryApi(globalScope) {
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

  async function listStocks(session, query = {}) {
    return inventoryAuth.fetchJson(session, `/api/inventory/stocks${buildQueryString(query)}`, {
      fallbackMessage: 'No se pudieron cargar las existencias de inventario.',
    });
  }

  async function listAlerts(session) {
    return inventoryAuth.fetchJson(session, '/api/inventory/alerts', {
      fallbackMessage: 'No se pudieron cargar las alertas de inventario.',
    });
  }

  async function listLots(session, query = {}) {
    return inventoryAuth.fetchJson(session, `/api/inventory/lots${buildQueryString(query)}`, {
      fallbackMessage: 'No se pudieron cargar los lotes de inventario.',
    });
  }

  async function listMovements(session, query = {}) {
    return inventoryAuth.fetchJson(session, `/api/inventory/movements${buildQueryString(query)}`, {
      fallbackMessage: 'No se pudieron cargar los movimientos de inventario.',
    });
  }

  async function createInitialInventory(session, payload) {
    return inventoryAuth.fetchJson(session, '/api/inventory/initial-inventory', {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo registrar el inventario inicial.',
    });
  }

  async function createAdjustment(session, payload) {
    return inventoryAuth.fetchJson(session, '/api/inventory/adjustments', {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo registrar el ajuste de inventario.',
    });
  }

  async function createTransfer(session, payload) {
    return inventoryAuth.fetchJson(session, '/api/inventory/transfers', {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo registrar el traslado de inventario.',
    });
  }

  async function updateLotQa(session, lotId, payload) {
    return inventoryAuth.fetchJson(session, `/api/inventory/lots/${encodeURIComponent(lotId)}/qa`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo registrar la actualizacion QA del lote.',
    });
  }

  async function createStockEntry(session, payload) {
    return inventoryAuth.fetchJson(session, '/api/inventory/entries', {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo registrar la entrada de inventario.',
    });
  }

  async function createInventoryRequest(session, payload) {
    return inventoryAuth.fetchJson(session, '/api/inventory/requests', {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo crear la solicitud de movimiento.',
    });
  }

  async function listInventoryRequests(session, query = {}) {
    return inventoryAuth.fetchJson(session, `/api/inventory/requests${buildQueryString(query)}`, {
      fallbackMessage: 'No se pudieron cargar las solicitudes de movimiento.',
    });
  }

  async function cancelInventoryRequest(session, id, payload = {}) {
    return inventoryAuth.fetchJson(session, `/api/inventory/requests/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo cancelar la solicitud.',
    });
  }

  async function listWarehouses(session) {
    return inventoryAuth.fetchJson(session, '/api/warehouses/company', {
      fallbackMessage: 'No se pudieron cargar las bodegas.',
    });
  }

  rootShell.register('inventoryApi', {
    cancelInventoryRequest,
    createAdjustment,
    createInitialInventory,
    createInventoryRequest,
    createStockEntry,
    createTransfer,
    listAlerts,
    listInventoryRequests,
    listLots,
    listMovements,
    listStocks,
    listWarehouses,
    updateLotQa,
  });
}(window));
