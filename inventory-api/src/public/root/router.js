(function attachRootShellRouter(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const manifest = rootShell.require('manifest');
  const guards = rootShell.require('guards');
  const homeView = rootShell.require('views.home');
  const inProcessView = rootShell.require('views.inProcess');
  const companiesAdminView = rootShell.require('views.companiesAdmin');
  const rolesAdminView = rootShell.require('views.rolesAdmin');

  function normalizeHashRoute(hashValue) {
    const normalizedHash = String(hashValue || '').replace(/^#/, '').trim();
    if (!normalizedHash) {
      return 'home';
    }

    return normalizedHash;
  }

  function findNavigationItem(routeKey) {
    return manifest.items.find((item) => item.routeKey === routeKey) || null;
  }

  function getFirstAccessibleRoute(session) {
    const firstVisibleItem = manifest.items.find((item) => guards.canAccessRoute(session, item));
    return firstVisibleItem?.routeKey || 'home';
  }

  function getRouteView(routeKey) {
    if (routeKey === 'home') {
      return homeView;
    }

    if (routeKey === 'companies') {
      return companiesAdminView;
    }

    if (routeKey === 'roles_permissions') {
      return rolesAdminView;
    }

    if (routeKey === 'in_process') {
      return inProcessView;
    }

    return inProcessView;
  }

  function resolveRoute(hashValue, session) {
    const requestedRouteKey = normalizeHashRoute(hashValue);
    const item = findNavigationItem(requestedRouteKey);

    if (!item) {
      const fallbackRouteKey = getFirstAccessibleRoute(session);
      return {
        allowed: true,
        requestedRouteKey,
        routeKey: fallbackRouteKey,
        item: findNavigationItem(fallbackRouteKey),
        view: getRouteView(fallbackRouteKey),
      };
    }

    if (!guards.canAccessRoute(session, item)) {
      const fallbackRouteKey = getFirstAccessibleRoute(session);
      return {
        allowed: false,
        requestedRouteKey,
        routeKey: fallbackRouteKey,
        item: findNavigationItem(fallbackRouteKey),
        view: getRouteView(fallbackRouteKey),
      };
    }

    return {
      allowed: true,
      requestedRouteKey,
      routeKey: item.routeKey,
      item,
      view: getRouteView(item.routeKey),
    };
  }

  function renderRoute(routeResolution, session) {
    return routeResolution.view.render(session);
  }

  rootShell.register('router', {
    findNavigationItem,
    normalizeHashRoute,
    getFirstAccessibleRoute,
    renderRoute,
    resolveRoute,
  });
}(window));
