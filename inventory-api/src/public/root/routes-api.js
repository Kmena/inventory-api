(function attachRootRoutesApi(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const inventoryAuth = /** @type {any} */ (globalScope).InventoryAuth;

  async function parseJsonSafely(response) {
    try {
      return await response.json();
    } catch (_error) {
      return null;
    }
  }

  function buildApiError(data, fallbackMessage, statusCode) {
    const error = /** @type {Error & { statusCode?: number, fieldErrors?: Record<string, string[]> | null }} */ (
      new Error(data?.message || fallbackMessage)
    );
    error.statusCode = statusCode;
    error.fieldErrors = data?.details?.fieldErrors || null;
    return error;
  }

  async function sendJson(session, url, options = {}) {
    const response = await globalScope.fetch(url, {
      method: options.method || 'GET',
      credentials: 'same-origin',
      headers: inventoryAuth.buildHeaders(session, {
        includeJsonContentType: Boolean(options.body),
        headers: options.headers,
      }),
      body: options.body,
    });

    const data = response.status === 204 ? null : await parseJsonSafely(response);
    if (!response.ok) {
      if (response.status === 401) {
        inventoryAuth.handleUnauthorized(options.storageKey);
      }
      throw buildApiError(data, options.fallbackMessage || 'No se pudo completar la operacion.', response.status);
    }

    return data;
  }

  async function listRoutesOverview(session) {
    return inventoryAuth.fetchJson(session, '/api/sales-routes/company', {
      fallbackMessage: 'No se pudieron cargar las rutas comerciales.',
    });
  }

  async function getRouteDetail(session, routeId) {
    return inventoryAuth.fetchJson(session, `/api/sales-routes/company/${encodeURIComponent(routeId)}`, {
      fallbackMessage: 'No se pudo cargar el detalle de la ruta.',
    });
  }

  async function createRoute(session, payload) {
    return sendJson(session, '/api/sales-routes/company', {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo crear la ruta.',
    });
  }

  async function updateRoute(session, routeId, payload) {
    return sendJson(session, `/api/sales-routes/company/${encodeURIComponent(routeId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo guardar la ruta.',
    });
  }

  async function saveRouteSubzones(session, routeId, subregionIds) {
    return sendJson(session, `/api/sales-routes/company/${encodeURIComponent(routeId)}/subzones`, {
      method: 'PUT',
      body: JSON.stringify({ subregionIds }),
      fallbackMessage: 'No se pudieron guardar las subzonas.',
    });
  }

  async function saveRouteAssignments(session, routeId, userIds) {
    return sendJson(session, `/api/sales-routes/company/${encodeURIComponent(routeId)}/assignments`, {
      method: 'PUT',
      body: JSON.stringify({ userIds }),
      fallbackMessage: 'No se pudieron guardar los agentes asignados.',
    });
  }

  async function saveAgentGoals(session, userId, payload) {
    return sendJson(session, `/api/sales-routes/company/agents/${encodeURIComponent(userId)}/goals`, {
      method: 'PUT',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudieron guardar las metas del agente.',
    });
  }

  rootShell.register('routesApi', {
    createRoute,
    getRouteDetail,
    listRoutesOverview,
    saveAgentGoals,
    saveRouteAssignments,
    saveRouteSubzones,
    updateRoute,
  });
}(window));
