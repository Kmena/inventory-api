(function attachRootShellRouter(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const manifest = rootShell.require('manifest');
  const guards = rootShell.require('guards');
  const homeView = rootShell.require('views.home');
  const inProcessView = rootShell.require('views.inProcess');
  const companiesAdminView = rootShell.require('views.companiesAdmin');
  const rolesAdminView = rootShell.require('views.rolesAdmin');
  const zonesAdminView = rootShell.require('views.zonesAdmin');
  const agentsAdminView = rootShell.require('views.agentsAdmin');
  const clientsAdminView = rootShell.require('views.clientsAdmin');
  const routesAdminView = rootShell.require('views.routesAdmin');
  const warehousesAdminView = rootShell.require('views.warehousesAdmin');
  const productsAdminView = rootShell.require('views.productsAdmin');
  const lotsAdminView = rootShell.require('views.lotsAdmin');
  const movementsAdminView = rootShell.require('views.movementsAdmin');
  // TASK-012: billing admin view (client-payment-ledger)
  const billingAdminView = rootShell.require('views.billingAdmin');
  const approvalsAdminView = rootShell.require('views.approvalsAdmin');

  function normalizeHashRoute(hashValue) {
    return String(hashValue || '').replace(/^#/, '').trim();
  }

  function findNavigationItem(routeKey) {
    return manifest.items.find((item) => item.routeKey === routeKey) || null;
  }

  function getFirstAccessibleRoute(session) {
    const firstVisibleItem = manifest.items.find((item) => {
      if (item.includeInLanding === false) {
        return false;
      }

      return guards.canAccessRoute(session, item);
    });

    return firstVisibleItem?.routeKey || 'in_process';
  }

  function getRouteView(item) {
    if (!item) {
      return inProcessView;
    }

    if (!item.implemented) {
      return inProcessView;
    }

    if (item.routeKey === 'home') {
      return homeView;
    }

    if (item.routeKey === 'companies') {
      return companiesAdminView;
    }

    if (item.routeKey === 'roles_permissions') {
      return rolesAdminView;
    }

    if (item.routeKey === 'zones') {
      return zonesAdminView;
    }

    if (item.routeKey === 'agents') {
      return agentsAdminView;
    }

    if (item.routeKey === 'clients') {
      return clientsAdminView;
    }

    if (item.routeKey === 'routes') {
      return routesAdminView;
    }

    if (item.routeKey === 'warehouses') {
      return warehousesAdminView;
    }

    if (item.routeKey === 'products') {
      return productsAdminView;
    }

    if (item.routeKey === 'lots') {
      return lotsAdminView;
    }

    if (item.routeKey === 'movements') {
      return movementsAdminView;
    }

    if (item.routeKey === 'billing') {
      return billingAdminView;
    }

    if (item.routeKey === 'approvals') {
      return approvalsAdminView;
    }

    return inProcessView;
  }

  function resolveRoute(hashValue, session) {
    const requestedRouteKey = normalizeHashRoute(hashValue);
    const requestedItem = requestedRouteKey ? findNavigationItem(requestedRouteKey) : null;

    if (!requestedItem) {
      const fallbackRouteKey = getFirstAccessibleRoute(session);
      const fallbackItem = findNavigationItem(fallbackRouteKey);
      return {
        allowed: true,
        requestedRouteKey,
        routeKey: fallbackRouteKey,
        item: fallbackItem,
        view: getRouteView(fallbackItem),
      };
    }

    if (!guards.canAccessRoute(session, requestedItem)) {
      const fallbackRouteKey = getFirstAccessibleRoute(session);
      const fallbackItem = findNavigationItem(fallbackRouteKey);
      return {
        allowed: false,
        requestedRouteKey,
        routeKey: fallbackRouteKey,
        item: fallbackItem,
        view: getRouteView(fallbackItem),
      };
    }

    return {
      allowed: true,
      requestedRouteKey,
      routeKey: requestedItem.routeKey,
      item: requestedItem,
      view: getRouteView(requestedItem),
    };
  }

  function renderRoute(routeResolution, session) {
    return routeResolution.view.render(session, routeResolution.item);
  }

  rootShell.register('router', {
    findNavigationItem,
    normalizeHashRoute,
    getFirstAccessibleRoute,
    renderRoute,
    resolveRoute,
  });
}(window));
