(function attachRootShellAgentsAdminHelpers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;

  const COMMERCIAL_PERMISSION_CODES = [
    'clients.view',
    'sales.orders.create',
    'sales.routes.view.own',
    'sales.routes.view.all',
    'customer.activities.manage',
  ];

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isCommercialRole(role) {
    const roleCode = normalizeText(role?.code);
    if (['sales_agent', 'sales_supervisor', 'sales'].includes(roleCode)) {
      return true;
    }

    const permissionCodes = (role?.permissions || role?.rolePermissions || [])
      .map((permission) => permission?.code || permission?.permission?.code)
      .filter(Boolean)
      .map(normalizeText);

    return COMMERCIAL_PERMISSION_CODES.some((permissionCode) => permissionCodes.includes(permissionCode));
  }

  function createRouteIndex(routes) {
    return (Array.isArray(routes) ? routes : []).reduce((index, route) => {
      const routeId = String(route?.id || '');
      if (routeId) {
        index[routeId] = route;
      }
      return index;
    }, {});
  }

  function composeAgentsDataset(users, _roles, routesOverview) {
    const usersList = Array.isArray(users?.items) ? users.items : Array.isArray(users) ? users : [];
    const routes = Array.isArray(routesOverview?.routes) ? routesOverview.routes : [];
    const overviewAgents = Array.isArray(routesOverview?.agents) ? routesOverview.agents : [];
    const overviewByUserId = overviewAgents.reduce((index, agent) => {
      index[String(agent.id)] = agent;
      return index;
    }, {});
    const routeIndex = createRouteIndex(routes);

    const composedAgents = usersList
      .filter((user) => {
        if (isCommercialRole(user?.role)) {
          return true;
        }
        return Boolean(overviewByUserId[String(user?.id)]);
      })
      .map((user) => {
        const overviewAgent = overviewByUserId[String(user.id)] || null;
        const permissionCodes = Array.from(new Set([
          ...(overviewAgent?.permissionCodes || []),
          ...((user?.role?.permissions || user?.role?.rolePermissions || [])
            .map((permission) => permission?.code || permission?.permission?.code)
            .filter(Boolean)),
        ]));
        const routeIds = Array.isArray(overviewAgent?.assignments)
          ? overviewAgent.assignments.map((assignment) => assignment?.salesRouteId || assignment?.routeId).filter(Boolean)
          : Array.isArray(overviewAgent?.routeIds)
            ? overviewAgent.routeIds.filter(Boolean)
            : routes.filter((route) => (route.agentIds || []).map(String).includes(String(user.id))).map((route) => route.id);
        const assignedRoutes = routeIds
          .map((routeId) => routeIndex[String(routeId)])
          .filter(Boolean)
          .map((route) => ({ id: route.id, code: route.code, name: route.name }));
        const roleCode = user?.role?.code || overviewAgent?.role?.code || '';
        const group = roleCode === 'sales_supervisor'
          ? 'Supervisor comercial'
          : roleCode === 'sales_agent'
            ? 'Agente comercial'
            : roleCode === 'sales'
              ? 'Rol legado ventas'
              : 'Otros comerciales';

        return {
          id: user.id,
          fullName: user.fullName,
          username: user.username,
          email: user.email,
          phone: user.phone,
          status: user.status,
          role: user.role || overviewAgent?.role || null,
          permissionCodes,
          group,
          assignedRoutes,
          routeIds: assignedRoutes.map((route) => route.id),
          assignmentsCount: assignedRoutes.length,
          goals: overviewAgent?.goals || [],
          goalsCount: overviewAgent?.goalsCount || 0,
          hasCommercialOverview: Boolean(overviewAgent),
          isLegacySalesRole: roleCode === 'sales',
          isReady: assignedRoutes.length > 0,
        };
      });

    composedAgents.sort((left, right) => String(left.fullName || '').localeCompare(String(right.fullName || ''), 'es'));
    return composedAgents;
  }

  function filterAgents(agents, searchTerm, groupFilter) {
    const normalizedSearchTerm = normalizeText(searchTerm);
    return (Array.isArray(agents) ? agents : []).filter((agent) => {
      const matchesGroup = !groupFilter || groupFilter === 'all' || normalizeText(agent.group) === normalizeText(groupFilter);
      if (!matchesGroup) {
        return false;
      }

      if (!normalizedSearchTerm) {
        return true;
      }

      return [agent.fullName, agent.username, agent.email, agent.phone, agent.role?.name, agent.role?.code]
        .filter(Boolean)
        .some((value) => normalizeText(value).includes(normalizedSearchTerm));
    });
  }

  function summarizeAgents(agents) {
    const safeAgents = Array.isArray(agents) ? agents : [];
    return {
      total: safeAgents.length,
      withRoutes: safeAgents.filter((agent) => agent.assignmentsCount > 0).length,
      withoutRoutes: safeAgents.filter((agent) => agent.assignmentsCount === 0).length,
      withGoals: safeAgents.filter((agent) => agent.goalsCount > 0).length,
    };
  }

  rootShell.register('views.agentsAdminHelpers', {
    COMMERCIAL_PERMISSION_CODES,
    composeAgentsDataset,
    filterAgents,
    isCommercialRole,
    normalizeText,
    summarizeAgents,
  });
}(window));
