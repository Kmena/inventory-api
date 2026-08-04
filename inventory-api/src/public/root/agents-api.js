(function attachRootAgentsApi(globalScope) {
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

  async function listCompanyUsers(session) {
    return inventoryAuth.fetchJson(session, '/api/users/company', {
      fallbackMessage: 'No se pudieron cargar los usuarios de la empresa.',
    });
  }

  async function listCompanyRoles(session) {
    return inventoryAuth.fetchJson(session, '/api/roles/company', {
      fallbackMessage: 'No se pudieron cargar los roles de la empresa.',
    });
  }

  async function listRoutesOverview(session) {
    return inventoryAuth.fetchJson(session, '/api/sales-routes/company', {
      fallbackMessage: 'No se pudo cargar la informacion comercial de rutas.',
    });
  }

  async function createCompanyUser(session, payload) {
    return sendJson(session, '/api/users/company', {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo crear el agente.',
    });
  }

  function shapeAssignmentOperations(routesOverview, userId, selectedRouteIds) {
    const selectedSet = new Set((selectedRouteIds || []).map((routeId) => String(routeId)));
    const safeRoutes = Array.isArray(routesOverview?.routes) ? routesOverview.routes : [];
    const normalizedUserId = String(userId);

    return safeRoutes.reduce((operations, route) => {
      const routeId = String(route.id);
      const currentUserIds = new Set((route.agentIds || []).map((currentUserId) => String(currentUserId)));
      const shouldBeAssigned = selectedSet.has(routeId);
      const isCurrentlyAssigned = currentUserIds.has(normalizedUserId);

      if (shouldBeAssigned === isCurrentlyAssigned) {
        return operations;
      }

      if (shouldBeAssigned) {
        currentUserIds.add(normalizedUserId);
      } else {
        currentUserIds.delete(normalizedUserId);
      }

      operations.push({
        routeId: route.id,
        userIds: Array.from(currentUserIds),
      });
      return operations;
    }, []);
  }

  async function saveAgentRouteAssignments(session, routesOverview, userId, selectedRouteIds) {
    const operations = shapeAssignmentOperations(routesOverview, userId, selectedRouteIds);
    for (const operation of operations) {
      await sendJson(session, `/api/sales-routes/company/${encodeURIComponent(operation.routeId)}/assignments`, {
        method: 'PUT',
        body: JSON.stringify({ userIds: operation.userIds }),
        fallbackMessage: 'No se pudieron guardar las rutas asignadas.',
      });
    }

    return listRoutesOverview(session);
  }

  rootShell.register('agentsApi', {
    createCompanyUser,
    listCompanyRoles,
    listCompanyUsers,
    listRoutesOverview,
    saveAgentRouteAssignments,
    shapeAssignmentOperations,
  });
}(window));
