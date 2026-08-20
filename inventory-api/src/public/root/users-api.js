(function attachRootUsersApi(globalScope) {
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

  async function createCompanyUser(session, payload) {
    return sendJson(session, '/api/users/company', {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo crear el usuario.',
    });
  }

  rootShell.register('usersApi', {
    listCompanyUsers,
    listCompanyRoles,
    createCompanyUser,
  });
}(window));
