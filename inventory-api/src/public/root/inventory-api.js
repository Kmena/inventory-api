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

  async function listStocks(session) {
    return inventoryAuth.fetchJson(session, '/api/inventory/stocks', {
      fallbackMessage: 'No se pudieron cargar las existencias de inventario.',
    });
  }

  async function listAlerts(session) {
    return inventoryAuth.fetchJson(session, '/api/inventory/alerts', {
      fallbackMessage: 'No se pudieron cargar las alertas de inventario.',
    });
  }

  async function listMovements(session, query = {}) {
    return inventoryAuth.fetchJson(session, `/api/inventory/movements${buildQueryString(query)}`, {
      fallbackMessage: 'No se pudieron cargar los movimientos de inventario.',
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

  rootShell.register('inventoryApi', {
    createStockEntry,
    listAlerts,
    listMovements,
    listStocks,
    updateLotQa,
  });
}(window));
