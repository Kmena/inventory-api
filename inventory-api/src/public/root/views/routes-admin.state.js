(function attachRootShellRoutesAdminState(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;

  function getSelectedRoute(overview, detailByRouteId, selectedRouteId) {
    return detailByRouteId[String(selectedRouteId)]
      || (overview?.routes || []).find((route) => String(route.id) === String(selectedRouteId))
      || null;
  }

  function buildRoutesListSummary(totalRoutes, filteredRoutes) {
    if (filteredRoutes === totalRoutes) {
      return `Consulta ${totalRoutes} rutas visibles de la empresa.`;
    }

    return `${filteredRoutes} de ${totalRoutes} rutas visibles con el filtro actual.`;
  }

  function resolveGoalRows(selectedRoute, selectedGoalsAgentId) {
    return selectedRoute?.agents?.find((agent) => String(agent.id) === String(selectedGoalsAgentId))?.goals || [];
  }

  rootShell.register('views.routesAdminState', {
    buildRoutesListSummary,
    getSelectedRoute,
    resolveGoalRows,
  });
}(window));
