(function attachRootShellProductionOrdersAdminHelpers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;

  const DEFAULT_PAGE = 1;
  const DEFAULT_PAGE_SIZE = 10;
  const FILTER_SUPPORT = Object.freeze({
    searchTerm: 'client',
    status: 'client',
    productId: 'client',
    recipeId: 'client',
    versionId: 'client',
    plannedDateFrom: 'client',
    plannedDateTo: 'client',
    createdDateFrom: 'client',
    createdDateTo: 'client',
    responsibleUserId: 'client',
    page: 'server',
    pageSize: 'server',
  });

  function hasAnyPermission(session, sessionAdapter, permissions) {
    return permissions.some((permission) => sessionAdapter.hasPermission(session, permission));
  }

  function canViewProductionOrders(session, sessionAdapter) {
    return hasAnyPermission(session, sessionAdapter, [
      'production.view',
      'production.create',
      'production.approve',
      'production.execute',
      'production.complete',
      'production.cancel',
    ]);
  }

  function createDefaultFilters() {
    return {
      searchTerm: '',
      status: '',
      productId: '',
      recipeId: '',
      versionId: '',
      plannedDateFrom: '',
      plannedDateTo: '',
      createdDateFrom: '',
      createdDateTo: '',
      responsibleUserId: '',
    };
  }

  function hasActiveFilters(filters) {
    const defaultFilters = createDefaultFilters();
    return Object.keys(defaultFilters).some((key) => Boolean(filters?.[key]));
  }

  function normalizeProductionOrdersResponse(response) {
    if (Array.isArray(response)) {
      return {
        items: response,
        pagination: {
          page: DEFAULT_PAGE,
          pageSize: response.length || DEFAULT_PAGE_SIZE,
          totalItems: response.length,
          totalPages: response.length ? 1 : 0,
        },
      };
    }

    const items = Array.isArray(response?.items) ? response.items : [];
    const pagination = response?.pagination && typeof response.pagination === 'object'
      ? response.pagination
      : {};

    return {
      items,
      pagination: {
        page: Number(pagination.page) || DEFAULT_PAGE,
        pageSize: Number(pagination.pageSize) || DEFAULT_PAGE_SIZE,
        totalItems: Number(pagination.totalItems) || items.length,
        totalPages: Number(pagination.totalPages) || (items.length ? 1 : 0),
      },
    };
  }

  function buildListQuery(filters, page = DEFAULT_PAGE, pageSize = DEFAULT_PAGE_SIZE) {
    return {
      page,
      pageSize,
      serverQuery: {
        page,
        pageSize,
      },
      clientFilters: {
        ...createDefaultFilters(),
        ...filters,
      },
      filterSupport: FILTER_SUPPORT,
    };
  }

  function normalizeSearchText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function toComparableDate(value) {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  function matchesDateRange(value, fromValue, toValue) {
    if (!fromValue && !toValue) {
      return true;
    }

    const date = toComparableDate(value);
    if (!date) {
      return false;
    }

    const fromDate = toComparableDate(fromValue);
    const toDate = toComparableDate(toValue);

    if (fromDate && date < fromDate) {
      return false;
    }
    if (toDate && date > toDate) {
      return false;
    }
    return true;
  }

  function applyClientSideFilters(items, filters) {
    const normalizedSearchTerm = normalizeSearchText(filters.searchTerm);

    return (items || []).filter((order) => {
      if (filters.status && String(order?.status || '') !== String(filters.status)) {
        return false;
      }

      if (filters.productId && String(order?.productId || order?.product?.id || '') !== String(filters.productId)) {
        return false;
      }

      if (filters.recipeId && String(order?.recipeId || order?.recipe?.id || '') !== String(filters.recipeId)) {
        return false;
      }

      if (filters.versionId && String(order?.recipeVersionId || order?.recipeVersion?.id || '') !== String(filters.versionId)) {
        return false;
      }

      if (filters.responsibleUserId && String(order?.responsibleUserId || order?.responsibleUser?.id || '') !== String(filters.responsibleUserId)) {
        return false;
      }

      if (!matchesDateRange(order?.plannedDate, filters.plannedDateFrom, filters.plannedDateTo)) {
        return false;
      }

      if (!matchesDateRange(order?.createdAt, filters.createdDateFrom, filters.createdDateTo)) {
        return false;
      }

      if (!normalizedSearchTerm) {
        return true;
      }

      const haystack = [
        order?.orderId,
        order?.productionLotCode,
        order?.product?.code,
        order?.product?.name,
        order?.recipe?.code,
        order?.recipe?.name,
        order?.recipeVersion?.versionNumber ? `v${order.recipeVersion.versionNumber}` : '',
      ].map(normalizeSearchText).join(' ');

      return haystack.includes(normalizedSearchTerm);
    });
  }

  function buildProductionOrdersListSummary(items, pagination, filters) {
    const visibleCount = items.length;
    if (!pagination.totalItems) {
      return hasActiveFilters(filters)
        ? 'No hay ordenes de produccion para los filtros actuales.'
        : 'Todavia no hay ordenes de produccion registradas.';
    }

    if (hasActiveFilters(filters)) {
      return `Mostrando ${visibleCount} orden(es) de la pagina ${pagination.page} con filtros client-side de supervision.`;
    }

    return `Mostrando ${visibleCount} orden(es) de ${pagination.totalItems} en la pagina ${pagination.page}.`;
  }

  rootShell.register('views.productionOrdersAdminHelpers', {
    FILTER_SUPPORT,
    applyClientSideFilters,
    buildListQuery,
    buildProductionOrdersListSummary,
    canViewProductionOrders,
    createDefaultFilters,
    hasActiveFilters,
    normalizeProductionOrdersResponse,
  });
}(window));
