(function attachRootShellWarehousesAdminHelpers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;

  function canViewWarehouses(session, sessionAdapter) {
    return sessionAdapter.hasPermission(session, 'inventory.view')
      || sessionAdapter.hasPermission(session, 'inventory.manage');
  }

  function canCreateWarehouses(session, sessionAdapter) {
    return sessionAdapter.hasPermission(session, 'inventory.manage');
  }

  function deriveWarehouseSummary(items, summary) {
    if (summary && typeof summary === 'object') {
      const hasAllFields = ['total', 'active', 'virtual', 'sellable'].every((key) => Number.isFinite(Number(summary[key])));
      if (hasAllFields) {
        return {
          summary: {
            total: Number(summary.total),
            active: Number(summary.active),
            virtual: Number(summary.virtual),
            sellable: Number(summary.sellable),
          },
          estimated: false,
        };
      }
    }

    return {
      summary: {
        total: items.length,
        active: items.filter((item) => item.isActive).length,
        virtual: items.filter((item) => item.isVirtual).length,
        sellable: items.filter((item) => item.isSellableSource).length,
      },
      estimated: true,
    };
  }

  function normalizeWarehouseDataset(response) {
    const items = Array.isArray(response?.items) ? response.items : [];
    const warehouseTypes = Array.isArray(response?.warehouseTypes) ? response.warehouseTypes : [];
    const summaryResult = deriveWarehouseSummary(items, response?.summary);

    return {
      items,
      summary: summaryResult.summary,
      summaryEstimated: summaryResult.estimated,
      warehouseTypes,
    };
  }

  function normalizeSearchText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function filterWarehouses(items, filters) {
    const searchTerm = normalizeSearchText(filters.searchTerm);
    return items.filter((item) => {
      if (searchTerm) {
        const haystack = `${item.code || ''} ${item.name || ''}`.toLowerCase();
        if (!haystack.includes(searchTerm)) {
          return false;
        }
      }

      if (filters.type && item.warehouseType !== filters.type) {
        return false;
      }

      if (filters.status === 'active' && !item.isActive) {
        return false;
      }
      if (filters.status === 'inactive' && item.isActive) {
        return false;
      }

      if (filters.nature === 'virtual' && !item.isVirtual) {
        return false;
      }
      if (filters.nature === 'physical' && item.isVirtual) {
        return false;
      }

      if (filters.sellable === 'yes' && !item.isSellableSource) {
        return false;
      }
      if (filters.sellable === 'no' && item.isSellableSource) {
        return false;
      }

      return true;
    });
  }

  function hasActiveFilters(filters) {
    return Boolean(
      filters.searchTerm
      || filters.type
      || filters.status !== 'all'
      || filters.nature !== 'all'
      || filters.sellable !== 'all'
    );
  }

  function buildVisibleSummary(totalItems, visibleItems, filters) {
    if (!totalItems) {
      return 'No hay bodegas registradas para esta empresa.';
    }

    if (!hasActiveFilters(filters)) {
      return `Consulta y filtra las ${totalItems} bodegas registradas de la empresa.`;
    }

    return `${visibleItems} de ${totalItems} bodegas visibles con el filtro actual.`;
  }

  function getWarehouseTypeDefinition(warehouseTypes, selectedValue) {
    return warehouseTypes.find((item) => item?.value === selectedValue) || warehouseTypes[0] || null;
  }

  function buildCreateWarehousePayload(formData, warehouseTypes) {
    const warehouseType = String(formData.get('warehouseType') || '').trim();
    const typeDefinition = getWarehouseTypeDefinition(warehouseTypes, warehouseType);
    const isVirtual = Boolean(typeDefinition?.isVirtual);

    return {
      code: String(formData.get('code') || '').trim(),
      name: String(formData.get('name') || '').trim(),
      warehouseType,
      isSellableSource: isVirtual ? false : formData.get('isSellableSource') === 'on',
      isActive: formData.get('isActive') === 'on',
    };
  }

  function getTypeAdjustmentMessage(previousType, nextType, warehouseTypes) {
    if (!nextType || previousType === nextType) {
      return '';
    }

    const nextDefinition = getWarehouseTypeDefinition(warehouseTypes, nextType);
    if (nextDefinition?.isVirtual || nextDefinition?.defaultSellableSource) {
      return 'La fuente vendible se ajusto segun el tipo de bodega seleccionado.';
    }

    return '';
  }

  function createDefaultFilters() {
    return {
      searchTerm: '',
      type: '',
      status: 'all',
      nature: 'all',
      sellable: 'all',
    };
  }

  rootShell.register('views.warehousesAdminHelpers', {
    buildCreateWarehousePayload,
    buildVisibleSummary,
    canCreateWarehouses,
    canViewWarehouses,
    createDefaultFilters,
    filterWarehouses,
    getTypeAdjustmentMessage,
    getWarehouseTypeDefinition,
    hasActiveFilters,
    normalizeWarehouseDataset,
  });
}(window));
