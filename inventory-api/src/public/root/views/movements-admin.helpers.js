(function attachRootShellMovementsAdminHelpers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;

  const DEFAULT_PAGE = 1;
  const DEFAULT_PAGE_SIZE = 10;

  function canViewMovements(session, sessionAdapter) {
    return sessionAdapter.hasPermission(session, 'inventory.view')
      || sessionAdapter.hasPermission(session, 'inventory.manage');
  }

  function hasActiveFilters(filters) {
    return Boolean(filters.warehouseId || filters.productId || filters.lotId);
  }

  function createDefaultFilters() {
    return {
      warehouseId: '',
      productId: '',
      lotId: '',
    };
  }

  function normalizeMovementsResponse(response) {
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

  function buildMovementsListSummary(items, pagination, filters) {
    const visibleCount = items.length;
    if (!pagination.totalItems) {
      return hasActiveFilters(filters)
        ? 'No hay movimientos para los filtros actuales.'
        : 'Todavia no hay movimientos registrados.';
    }

    if (hasActiveFilters(filters)) {
      return `Mostrando ${visibleCount} resultado(s) en la pagina ${pagination.page} para los filtros actuales.`;
    }

    return `Mostrando ${visibleCount} movimiento(s) de ${pagination.totalItems} en la pagina ${pagination.page}.`;
  }

  function countMovementsByType(items, movementType) {
    return items.filter((item) => String(item?.movementType || '') === movementType).length;
  }

  function formatQuantity(value) {
    if (value === undefined || value === null || value === '') {
      return '0';
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return String(value);
    }

    return numericValue.toLocaleString('es-CR', {
      minimumFractionDigits: Number.isInteger(numericValue) ? 0 : 2,
      maximumFractionDigits: 3,
    });
  }

  function formatDateTime(value) {
    if (!value) {
      return 'Sin fecha visible';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Sin fecha visible';
    }

    return date.toLocaleString('es-CR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function resolveMovementActor(movement) {
    return movement?.user?.fullName || movement?.user?.username || 'Sin actor visible';
  }

  function resolveMovementLotLabel(movement) {
    return movement?.lot?.internalLotNumber || movement?.lot?.lotNumber || 'Sin lote';
  }

  function buildMovementChangeLabel(movement) {
    const quantityLabel = formatQuantity(movement?.quantity);
    if (movement?.quantityBefore === undefined || movement?.quantityBefore === null || movement?.quantityAfter === undefined || movement?.quantityAfter === null) {
      return quantityLabel;
    }

    return `${formatQuantity(movement.quantityBefore)} -> ${formatQuantity(movement.quantityAfter)}`;
  }

  function buildMovementReference(movement) {
    const parts = [];
    if (movement?.reasonCode) {
      parts.push(String(movement.reasonCode));
    }
    if (movement?.sourceType) {
      parts.push(String(movement.sourceType));
    }
    if (movement?.sourceId !== undefined && movement?.sourceId !== null) {
      parts.push(`Ref ${movement.sourceId}`);
    }
    return parts.join(' · ') || 'Sin referencia visible';
  }

  function buildPaginationQuery(filters, page, pageSize) {
    return {
      page,
      pageSize,
      warehouseId: filters.warehouseId,
      productId: filters.productId,
      lotId: filters.lotId,
    };
  }

  rootShell.register('views.movementsAdminHelpers', {
    buildMovementChangeLabel,
    buildMovementReference,
    buildMovementsListSummary,
    buildPaginationQuery,
    canViewMovements,
    countMovementsByType,
    createDefaultFilters,
    formatDateTime,
    formatQuantity,
    hasActiveFilters,
    normalizeMovementsResponse,
    resolveMovementActor,
    resolveMovementLotLabel,
  });
}(window));
