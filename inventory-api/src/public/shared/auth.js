(function attachInventoryAuth(globalScope) {
  const inventorySession = /** @type {any} */ (globalScope).InventorySession;

  /**
   * @param {{ token?: string | null } | null | undefined} session
   * @param {{ includeJsonContentType?: boolean, headers?: Record<string, string> }} [options]
   */
  function buildHeaders(session, options = {}) {
    const normalizedOptions = options && typeof options === 'object' ? options : {};
    const baseHeaders = normalizedOptions.includeJsonContentType
      ? { 'Content-Type': 'application/json' }
      : {};
    const shouldAttachBearer = typeof session?.token === 'string' && session.token.trim().length > 0;

    return {
      ...baseHeaders,
      ...(shouldAttachBearer ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(normalizedOptions.headers || {}),
    };
  }

  async function parseJsonSafely(response) {
    try {
      return await response.json();
    } catch (_error) {
      return null;
    }
  }

  /**
   * @param {string} [storageKey]
   * @param {string | null} [reason]
   */
  function handleUnauthorized(storageKey = inventorySession.STORAGE_KEY, reason = 'session-expired') {
    if (storageKey !== inventorySession.STORAGE_KEY) {
      globalScope.localStorage.removeItem(storageKey);
      globalScope.location.href = reason ? `/?reason=${encodeURIComponent(reason)}` : '/';
      return;
    }

    inventorySession.clearAndRedirectToLogin(reason);
  }

  function buildErrorMessage(data, fallbackMessage) {
    const validationMessage = data?.details?.fieldErrors
      ? Object.values(data.details.fieldErrors).flat().join(' ')
      : null;

    return validationMessage || data?.message || fallbackMessage;
  }

  async function fetchJson(session, url, options = {}) {
    const response = await globalScope.fetch(url, {
      ...options,
      credentials: options.credentials || 'same-origin',
      headers: buildHeaders(session, {
        includeJsonContentType: Boolean(options.body),
        headers: options.headers,
      }),
    });

    const data = response.status === 204 ? null : await parseJsonSafely(response);
    if (!response.ok) {
      if (response.status === 401) {
        handleUnauthorized(options.storageKey);
      }

      throw new Error(buildErrorMessage(data, options.fallbackMessage || 'No se pudo completar la operacion'));
    }

    return data;
  }

  async function downloadProtectedFile(session, fileUrl, options = {}) {
    const response = await globalScope.fetch(fileUrl, {
      credentials: options.credentials || 'same-origin',
      headers: buildHeaders(session, { headers: options.headers }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        handleUnauthorized(options.storageKey);
      }

      const data = await parseJsonSafely(response);
      throw new Error(buildErrorMessage(data, options.fallbackMessage || 'No se pudo descargar el documento'));
    }

    const blob = await response.blob();
    const downloadUrl = globalScope.URL.createObjectURL(blob);
    const link = globalScope.document.createElement('a');
    link.href = downloadUrl;
    link.download = options.fileName || 'documento';
    globalScope.document.body.appendChild(link);
    link.click();
    link.remove();
    globalScope.URL.revokeObjectURL(downloadUrl);
  }

  async function bootstrapSession(options = {}) {
    const response = await globalScope.fetch('/api/auth/me', {
      credentials: 'same-origin',
      headers: options.headers || {},
    });

    if (response.status === 401) {
      return null;
    }

    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(buildErrorMessage(data, options.fallbackMessage || 'No se pudo validar la sesion'));
    }

    return inventorySession.write({ user: data });
  }

  async function logout(session, options = {}) {
    try {
      await globalScope.fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: buildHeaders(session, {
          includeJsonContentType: false,
          headers: options.headers,
        }),
      });
    } finally {
      inventorySession.clearAndRedirectToLogin('signed-out');
    }
  }

  /** @type {any} */ (globalScope).InventoryAuth = {
    bootstrapSession,
    buildHeaders,
    fetchJson,
    downloadProtectedFile,
    handleUnauthorized,
    logout,
  };
}(window));
