(function attachRootClientsApi(globalScope) {
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

  async function listClients(session) {
    return inventoryAuth.fetchJson(session, '/api/clients/company', {
      fallbackMessage: 'No se pudieron cargar los clientes.',
    });
  }

  async function listClassifications(session) {
    return inventoryAuth.fetchJson(session, '/api/clients/classifications/company', {
      fallbackMessage: 'No se pudieron cargar las clasificaciones.',
    });
  }

  async function listDocumentTypes(session) {
    return inventoryAuth.fetchJson(session, '/api/clients/document-types', {
      fallbackMessage: 'No se pudieron cargar los tipos de documento.',
    });
  }

  async function getClientDetail(session, clientId) {
    return inventoryAuth.fetchJson(session, `/api/clients/${encodeURIComponent(clientId)}`, {
      fallbackMessage: 'No se pudo cargar el detalle del cliente.',
    });
  }

  async function createClient(session, payload) {
    return sendJson(session, '/api/clients/company', {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo crear el cliente.',
    });
  }

  async function updateClient(session, clientId, payload) {
    return sendJson(session, `/api/clients/${encodeURIComponent(clientId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo actualizar el cliente.',
    });
  }

  async function deactivateClient(session, clientId) {
    return sendJson(session, `/api/clients/${encodeURIComponent(clientId)}`, {
      method: 'DELETE',
      fallbackMessage: 'No se pudo desactivar el cliente.',
    });
  }

  async function createStore(session, clientId, payload) {
    return sendJson(session, `/api/clients/company/${encodeURIComponent(clientId)}/stores`, {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo crear la tienda.',
    });
  }

  async function createReference(session, clientId, payload) {
    return sendJson(session, `/api/clients/${encodeURIComponent(clientId)}/references`, {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo crear la referencia.',
    });
  }

  async function uploadDocument(session, clientId, payload) {
    return sendJson(session, `/api/clients/${encodeURIComponent(clientId)}/documents`, {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo cargar el documento.',
    });
  }

  async function listZones(session) {
    return inventoryAuth.fetchJson(session, '/api/regions/company', {
      fallbackMessage: 'No se pudieron cargar las zonas y subzonas.',
    });
  }

  async function lookupTaxpayer(session, query) {
    const searchParams = new URLSearchParams();
    searchParams.set('identification', query);
    return inventoryAuth.fetchJson(session, `/api/taxpayers/lookup?${searchParams.toString()}`, {
      fallbackMessage: 'No se pudo consultar la identificacion.',
    });
  }

  async function listEconomicActivities(session) {
    return inventoryAuth.fetchJson(session, '/api/economic-activities', {
      fallbackMessage: 'No se pudieron cargar las actividades economicas.',
    });
  }

  async function downloadDocument(session, clientId, documentId) {
    const response = await globalScope.fetch(`/api/clients/${encodeURIComponent(clientId)}/documents/${encodeURIComponent(documentId)}/download`, {
      method: 'GET',
      credentials: 'same-origin',
      headers: inventoryAuth.buildHeaders(session),
    });

    if (!response.ok) {
      const data = await parseJsonSafely(response);
      if (response.status === 401) {
        inventoryAuth.handleUnauthorized();
      }
      throw buildApiError(data, 'No se pudo descargar el documento.', response.status);
    }

    const blob = await response.blob();
    return {
      blob,
      fileName: response.headers.get('content-disposition') || '',
      mimeType: response.headers.get('content-type') || 'application/octet-stream',
    };
  }

  rootShell.register('clientsApi', {
    createClient,
    createReference,
    createStore,
    deactivateClient,
    downloadDocument,
    getClientDetail,
    listClassifications,
    listClients,
    listDocumentTypes,
    listEconomicActivities,
    listZones,
    lookupTaxpayer,
    updateClient,
    uploadDocument,
  });
}(window));
