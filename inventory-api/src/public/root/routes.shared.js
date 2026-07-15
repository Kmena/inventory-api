(function attachRootRoutesShared(global) {
  function authHeaders(session) {
    return {
      Authorization: `Bearer ${session.token}`,
      'Content-Type': 'application/json',
    };
  }

  function setMessage(element, text, isError = false) {
    element.textContent = text;
    element.className = 'message';
    if (isError) {
      element.classList.add('error');
    }
  }

  function metricValue(value) {
    return new Intl.NumberFormat('es-CR', { maximumFractionDigits: 2 }).format(Number(value || 0));
  }

  function filterRoutes(routes, query) {
    const normalizedQuery = query.trim().toLowerCase();
    return routes.filter((route) => {
      if (!normalizedQuery) return true;
      return `${route.code} ${route.name}`.toLowerCase().includes(normalizedQuery);
    });
  }

  function emptyGoal() {
    return {
      title: '',
      periodLabel: '',
      targetAmount: 0,
      currentAmount: 0,
      notes: '',
      isActive: true,
    };
  }

  global.RootRoutesShared = {
    authHeaders,
    setMessage,
    metricValue,
    filterRoutes,
    emptyGoal,
  };
})(window);
