(function attachInventorySession(globalScope) {
  const STORAGE_KEY = 'inventory-api-auth';
  const BROWSER_STATE_COOKIE_NAME = 'inventory_browser_state';

  function clear() {
    globalScope.localStorage.removeItem(STORAGE_KEY);
    if (globalScope.document) {
      globalScope.document.cookie = `${BROWSER_STATE_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
    }
  }

  function readCookie(name) {
    const serializedCookies = String(globalScope.document?.cookie || '');
    if (!serializedCookies) {
      return null;
    }

    for (const entry of serializedCookies.split(';')) {
      const [rawKey, ...rawValueParts] = entry.split('=');
      if (rawKey?.trim() === name) {
        return rawValueParts.join('=').trim() || null;
      }
    }

    return null;
  }

  function sanitizeUser(user) {
    if (!user || typeof user !== 'object') {
      return null;
    }

    const permissions = Array.isArray(user.permissions)
      ? user.permissions.filter((permission) => typeof permission === 'string' && permission.trim())
      : [];

    const landing = user.landing && typeof user.landing === 'object'
      ? {
        target: typeof user.landing.target === 'string' ? user.landing.target : null,
        path: typeof user.landing.path === 'string' ? user.landing.path : null,
        source: typeof user.landing.source === 'string' ? user.landing.source : null,
        permissionCode: typeof user.landing.permissionCode === 'string' ? user.landing.permissionCode : null,
      }
      : null;

    return {
      id: typeof user.id === 'string' ? user.id : null,
      fullName: typeof user.fullName === 'string' ? user.fullName : '',
      username: typeof user.username === 'string' ? user.username : '',
      companyId: typeof user.companyId === 'string' ? user.companyId : null,
      role: {
        code: typeof user.role?.code === 'string' ? user.role.code : null,
      },
      permissions,
      landing,
    };
  }

  function toBrowserSession(user) {
    const sanitizedUser = sanitizeUser(user);
    if (!sanitizedUser) {
      return null;
    }

    return {
      authMode: 'browser-session',
      user: sanitizedUser,
    };
  }

  function sanitizeSession(session) {
    if (!session || typeof session !== 'object') {
      return null;
    }

    return toBrowserSession(session.user || session);
  }

  function readStateCookieSession() {
    const cookieValue = readCookie(BROWSER_STATE_COOKIE_NAME);
    if (!cookieValue || !cookieValue.includes('.')) {
      return null;
    }

    const [encodedPayload] = cookieValue.split('.');
    try {
      const normalizedPayload = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
      const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=');
      return toBrowserSession(JSON.parse(globalScope.atob(paddedPayload)));
    } catch (_error) {
      return null;
    }
  }

  function readLegacyStorageSession() {
    const serializedSession = globalScope.localStorage.getItem(STORAGE_KEY);
    if (!serializedSession) {
      return null;
    }

    try {
      const parsedSession = JSON.parse(serializedSession);
      clear();
      return sanitizeSession(parsedSession);
    } catch (_error) {
      clear();
      return null;
    }
  }

  function read() {
    const cookieSession = readStateCookieSession();
    if (cookieSession) {
      return cookieSession;
    }

    return readLegacyStorageSession();
  }

  function write(session) {
    clear();
    return sanitizeSession(session);
  }

  function redirectToLogin(reason = null) {
    globalScope.location.href = reason ? `/?reason=${encodeURIComponent(reason)}` : '/';
  }

  function clearAndRedirectToLogin(reason = null) {
    clear();
    redirectToLogin(reason);
  }

  /** @type {any} */ (globalScope).InventorySession = {
    STORAGE_KEY,
    BROWSER_STATE_COOKIE_NAME,
    clear,
    sanitizeSession,
    read,
    write,
    redirectToLogin,
    clearAndRedirectToLogin,
  };
}(window));
