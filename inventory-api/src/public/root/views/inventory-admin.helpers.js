(function attachRootShellInventoryAdminHelpers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;

  function parseRouteParams() {
    const rawHash = String(globalScope.location?.hash || '').replace(/^#/, '');
    const [, queryString = ''] = rawHash.split('?');
    const params = new URLSearchParams(queryString);
    return {
      tab: normalizeTab(params.get('tab')),
      productId: params.get('productId') || '',
      warehouseId: params.get('warehouseId') || params.get('locationId') || '',
      lotId: params.get('lotId') || '',
      q: params.get('q') || '',
    };
  }

  function normalizeTab(value) {
    if (value === 'lots') return 'lots';
    if (value === 'history' || value === 'movements') return 'history';
    if (value === 'requests') return 'requests';
    return 'stock';
  }

  function formatNumber(value) {
    const numericValue = Number(value || 0);
    if (!Number.isFinite(numericValue)) return String(value || '0');
    return numericValue.toLocaleString('es-CR', {
      minimumFractionDigits: Number.isInteger(numericValue) ? 0 : 2,
      maximumFractionDigits: 2,
    });
  }

  function normalizeCollectionResponse(response) {
    if (Array.isArray(response)) {
      return { items: response, pagination: { page: 1, totalItems: response.length, totalPages: response.length ? 1 : 0 } };
    }
    const items = Array.isArray(response?.items) ? response.items : [];
    return {
      items,
      pagination: response?.pagination || { page: 1, totalItems: items.length, totalPages: items.length ? 1 : 0 },
    };
  }

  function getProductName(record) {
    return record?.product?.name || record?.productName || record?.name || 'Producto sin nombre';
  }

  function getProductCode(record) {
    return record?.product?.code || record?.productCode || record?.code || 'Sin codigo visible';
  }

  function getWarehouseName(record) {
    // warehouseLotStock shape (from /stocks): warehouse is a direct relation
    if (record?.warehouse?.name) return record.warehouse.name;
    if (record?.location?.name) return record.location.name;
    // Lot shape (from /lots): warehouse is nested inside warehouseLotStocks[]
    // Only show warehouses where the lot actually has stock (quantity > 0).
    if (Array.isArray(record?.warehouseLotStocks)) {
      const names = record.warehouseLotStocks
        .filter((s) => Number(s?.quantity ?? 0) > 0)
        .map((s) => s?.warehouse?.name)
        .filter(Boolean);
      if (names.length === 1) return names[0];
      if (names.length > 1) return names.join(' · ');
    }
    return record?.warehouseName || record?.locationName || 'Sin ubicacion visible';
  }

  function getLotLabel(record) {
    // Lot shape (from /lots): serializeLot adds visibleLotLabel ('Sin lote visible' for system lots)
    if (record?.visibleLotLabel !== undefined) return record.visibleLotLabel;
    // warehouseLotStock shape (from /stocks): lot is a nested relation
    const lot = record?.lot || record;
    if (lot?.isSystemLot || lot?.systemManaged || lot?.isSystem || lot?.isSystemGenerated) {
      return 'Lote interno';
    }
    return lot?.internalLotNumber || lot?.lotNumber || lot?.lotCode || lot?.code || lot?.visibleCode || 'Sin lote visible';
  }

  function shouldShowInventoryForProduct(product) {
    if (typeof product?.controlsInventory === 'boolean') return product.controlsInventory;
    return true;
  }

  rootShell.register('views.inventoryAdminHelpers', {
    formatNumber,
    getLotLabel,
    getProductCode,
    getProductName,
    getWarehouseName,
    normalizeCollectionResponse,
    normalizeTab,
    parseRouteParams,
    shouldShowInventoryForProduct,
  });
}(window));
