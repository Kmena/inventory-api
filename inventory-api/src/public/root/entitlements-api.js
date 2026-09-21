(function attachRootEntitlementsApi(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const inventoryAuth = /** @type {any} */ (globalScope).InventoryAuth;

  function buildQueryString(query = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      searchParams.set(key, String(value));
    });
    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  }

  async function listEntitlements(session, query = {}) {
    return inventoryAuth.fetchJson(session, `/api/entitlements${buildQueryString(query)}`, {
      fallbackMessage: 'No se pudieron cargar los derechos del cliente.',
    });
  }

  async function cancelEntitlement(session, entitlementId, payload) {
    return inventoryAuth.fetchJson(session, `/api/entitlements/${encodeURIComponent(entitlementId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo cancelar el derecho.',
    });
  }

  async function renewEntitlement(session, entitlementId, payload) {
    return inventoryAuth.fetchJson(session, `/api/entitlements/${encodeURIComponent(entitlementId)}/renew`, {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo renovar el derecho.',
    });
  }

  async function manuallyActivateEntitlement(session, payload) {
    return inventoryAuth.fetchJson(session, '/api/entitlements/manual-activate', {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo activar manualmente el derecho.',
    });
  }

  rootShell.register('entitlementsApi', {
    cancelEntitlement,
    listEntitlements,
    manuallyActivateEntitlement,
    renewEntitlement,
  });
}(window));
