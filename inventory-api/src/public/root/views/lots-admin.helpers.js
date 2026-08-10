(function attachRootShellLotsAdminHelpers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;

  // --- Permission helpers ---

  function canViewLots(session, sessionAdapter) {
    return sessionAdapter.hasPermission(session, 'inventory.view')
      || sessionAdapter.hasPermission(session, 'inventory.manage');
  }

  function canManageLots(session, sessionAdapter) {
    return sessionAdapter.hasPermission(session, 'inventory.manage');
  }

  function canManageLotQa(session, sessionAdapter) {
    return sessionAdapter.hasPermission(session, 'inventory.qa.manage');
  }

  // --- Gate assessment ---

  /**
   * Determines whether the lot-level data from GET /api/inventory/stocks is
   * sufficient to render #lots in full mode.
   * Gate criteria (from decisions.md):
   *   - lotId or lot.id
   *   - lotNumber or internalLotNumber
   *   - productId or product.id
   *   - product.name
   *   - warehouseId or warehouse.id
   *   - warehouse.name
   *   - quantity
   * @param {Array<any>} lots - The `lots` array from listStocks response
   * @returns {{ passed: boolean, reason: string }}
   */
  function assessLotDataGate(lots) {
    if (!Array.isArray(lots) || lots.length === 0) {
      return {
        passed: false,
        reason: 'La consulta de existencias no retorno lotes disponibles.',
      };
    }

    const requiredFieldMissing = lots.every((entry) => {
      const hasLotId = entry?.lotId || entry?.lot?.id;
      const hasLotCode = entry?.lot?.internalLotNumber || entry?.lot?.lotNumber;
      const hasProductId = entry?.productId || entry?.product?.id;
      const hasProductName = entry?.product?.name;
      const hasWarehouseId = entry?.warehouseId || entry?.warehouse?.id;
      const hasWarehouseName = entry?.warehouse?.name;
      const hasQuantity = entry?.quantity !== undefined && entry?.quantity !== null;
      return !(hasLotId && hasLotCode && hasProductId && hasProductName && hasWarehouseId && hasWarehouseName && hasQuantity);
    });

    if (requiredFieldMissing) {
      return {
        passed: false,
        reason: 'La consulta de existencias no incluye lotId, codigo de lote y campos minimos para listar lotes con seguridad.',
      };
    }

    return { passed: true, reason: '' };
  }

  // --- Normalization ---

  /**
   * Derives source confidence for a normalized lot unit.
   * 'verified' = all required fields present
   * 'partial' = critical fields present but optional fields missing
   * 'estimated' = some required fields had to be inferred
   * @param {any} entry
   * @returns {'verified' | 'partial' | 'estimated'}
   */
  function deriveSourceConfidence(entry) {
    const hasExpiry = entry?.lot?.expirationDate !== undefined && entry?.lot?.expirationDate !== null;
    const hasQaStatus = Boolean(entry?.lot?.qaStatus);
    const hasLotStatus = Boolean(entry?.lot?.status);
    const hasReserved = entry?.reservedQuantity !== undefined && entry?.reservedQuantity !== null;

    if (hasExpiry && hasQaStatus && hasLotStatus && hasReserved) {
      return 'verified';
    }

    if (!entry?.lot?.internalLotNumber && !entry?.lot?.lotNumber) {
      return 'estimated';
    }

    return 'partial';
  }

  /**
   * Builds the set of alert IDs associated with a lot entry.
   * @param {any} entry
   * @param {Array<any>} alerts
   * @returns {string[]}
   */
  function buildAlertIdsForLot(entry, alerts) {
    if (!Array.isArray(alerts) || alerts.length === 0) {
      return [];
    }

    const lotId = String(entry?.lotId || entry?.lot?.id || '');
    return alerts
      .filter((alert) => lotId && String(alert?.lotId || '') === lotId)
      .map((alert) => String(alert?.id || ''));
  }

  /**
   * Converts a WarehouseLotStock API entry to a LotStockUnit presentation model.
   * @param {any} entry
   * @param {Array<any>} alerts
   * @returns {object}
   */
  function normalizeLotEntry(entry, alerts) {
    const quantity = Number(entry?.quantity ?? 0);
    const reservedQuantity = Number(entry?.reservedQuantity ?? 0);
    const availableQuantity = Math.max(0, quantity - reservedQuantity);

    return {
      lotId: String(entry?.lotId || entry?.lot?.id || ''),
      lotCode: String(entry?.lot?.internalLotNumber || entry?.lot?.lotNumber || ''),
      lotNumber: entry?.lot?.lotNumber || null,
      productId: String(entry?.productId || entry?.product?.id || ''),
      productName: String(entry?.product?.name || ''),
      productCode: entry?.product?.code || null,
      categoryName: entry?.product?.category?.name || null,
      subcategoryName: entry?.product?.subcategory?.name || null,
      warehouseId: String(entry?.warehouseId || entry?.warehouse?.id || ''),
      warehouseName: String(entry?.warehouse?.name || ''),
      quantity,
      availableQuantity,
      reservedQuantity,
      qaStatus: String(entry?.lot?.qaStatus || 'UNKNOWN'),
      lotStatus: String(entry?.lot?.status || 'UNKNOWN'),
      expirationDate: entry?.lot?.expirationDate || null,
      alertIds: buildAlertIdsForLot(entry, alerts),
      sourceConfidence: deriveSourceConfidence(entry),
    };
  }

  /**
   * Normalizes the full response from listStocks + listAlerts + listCompanyWarehouses
   * into a safe presentation model.
   * @param {any} stocksResponse
   * @param {any} alertsResponse
   * @param {any} warehousesResponse
   * @returns {{ lots: object[], gate: { passed: boolean, reason: string }, alertsAvailable: boolean, warehousesAvailable: boolean }}
   */
  function normalizeLotStocks(stocksResponse, alertsResponse, warehousesResponse) {
    const rawLots = Array.isArray(stocksResponse?.lots) ? stocksResponse.lots : [];
    const alerts = Array.isArray(alertsResponse) ? alertsResponse
      : Array.isArray(alertsResponse?.items) ? alertsResponse.items : [];
    const gate = assessLotDataGate(rawLots);

    if (!gate.passed) {
      return {
        lots: [],
        gate,
        alertsAvailable: alerts.length > 0,
        warehousesAvailable: Array.isArray(warehousesResponse?.items) && warehousesResponse.items.length > 0,
      };
    }

    const lots = rawLots.map((entry) => normalizeLotEntry(entry, alerts));

    return {
      lots,
      gate,
      alertsAvailable: alerts.length > 0,
      warehousesAvailable: Array.isArray(warehousesResponse?.items) && warehousesResponse.items.length > 0,
    };
  }

  // --- Date utilities ---

  const EXPIRY_WARNING_DAYS = 30;

  function calculateDaysToExpiry(expirationDate) {
    if (!expirationDate) {
      return null;
    }

    const expiry = new Date(expirationDate);
    if (Number.isNaN(expiry.getTime())) {
      return null;
    }

    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  function isExpiringSoon(daysToExpiry) {
    return daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= EXPIRY_WARNING_DAYS;
  }

  function isExpired(daysToExpiry) {
    return daysToExpiry !== null && daysToExpiry < 0;
  }

  function formatExpirationDate(expirationDate) {
    if (!expirationDate) {
      return 'Sin fecha';
    }

    const date = new Date(expirationDate);
    if (Number.isNaN(date.getTime())) {
      return 'Sin fecha';
    }

    return date.toLocaleDateString('es-CR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
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

  // --- Status labels ---

  function getLotStatusLabel(status) {
    switch (String(status || '').toUpperCase()) {
      case 'AVAILABLE': return 'Disponible';
      case 'BLOCKED': return 'Bloqueado';
      case 'QUARANTINED': return 'En cuarentena';
      case 'EXPIRED': return 'Vencido';
      default: return 'Sin dato';
    }
  }

  function getQaStatusLabel(qaStatus) {
    switch (String(qaStatus || '').toUpperCase()) {
      case 'APPROVED': return 'Aprobado';
      case 'PENDING': return 'Pendiente';
      case 'REJECTED': return 'Rechazado';
      case 'FAILED': return 'Fallido';
      default: return 'Sin dato';
    }
  }

  function getLotStatusVariant(status) {
    switch (String(status || '').toUpperCase()) {
      case 'AVAILABLE': return 'success';
      case 'BLOCKED':
      case 'EXPIRED': return 'error';
      case 'QUARANTINED': return 'warning';
      default: return 'default';
    }
  }

  function getQaStatusVariant(qaStatus) {
    switch (String(qaStatus || '').toUpperCase()) {
      case 'APPROVED': return 'success';
      case 'PENDING': return 'warning';
      case 'REJECTED':
      case 'FAILED': return 'error';
      default: return 'default';
    }
  }

  function getSourceConfidenceLabel(confidence) {
    switch (confidence) {
      case 'partial': return 'Parcial';
      case 'estimated': return 'Estimado';
      default: return '';
    }
  }

  // --- KPIs ---

  function buildLotsKpis(lots) {
    let withAlert = 0;
    let expiringSoon = 0;
    let expired = 0;
    let qaPendingOrBlocked = 0;
    let totalAvailable = 0;

    for (const lot of lots) {
      if (lot.alertIds && lot.alertIds.length > 0) {
        withAlert += 1;
      }

      const daysToExpiry = calculateDaysToExpiry(lot.expirationDate);
      if (isExpired(daysToExpiry)) {
        expired += 1;
      } else if (isExpiringSoon(daysToExpiry)) {
        expiringSoon += 1;
      }

      const qa = String(lot.qaStatus || '').toUpperCase();
      if (qa === 'PENDING' || qa === 'REJECTED' || qa === 'FAILED') {
        qaPendingOrBlocked += 1;
      }

      totalAvailable += Number(lot.availableQuantity || 0);
    }

    return {
      total: lots.length,
      withAlert,
      expiringSoon,
      expired,
      qaPendingOrBlocked,
      totalAvailable,
    };
  }

  // --- Filters ---

  function createDefaultFilters() {
    return {
      searchTerm: '',
      warehouseId: '',
      qaStatus: '',
      lotStatus: '',
      expiry: 'all',
      alertStatus: 'all',
    };
  }

  function hasActiveFilters(filters) {
    return Boolean(
      filters.searchTerm
      || filters.warehouseId
      || filters.qaStatus
      || filters.lotStatus
      || filters.expiry !== 'all'
      || filters.alertStatus !== 'all'
    );
  }

  function filterLots(lots, filters) {
    const searchTerm = String(filters.searchTerm || '').trim().toLowerCase();
    return (lots || []).filter((lot) => {
      if (filters.warehouseId && lot.warehouseId !== String(filters.warehouseId)) {
        return false;
      }

      if (filters.qaStatus && lot.qaStatus !== String(filters.qaStatus).toUpperCase()) {
        return false;
      }

      if (filters.lotStatus && lot.lotStatus !== String(filters.lotStatus).toUpperCase()) {
        return false;
      }

      if (filters.alertStatus === 'has_alert' && (!lot.alertIds || lot.alertIds.length === 0)) {
        return false;
      }
      if (filters.alertStatus === 'no_alert' && lot.alertIds && lot.alertIds.length > 0) {
        return false;
      }

      if (filters.expiry !== 'all') {
        const daysToExpiry = calculateDaysToExpiry(lot.expirationDate);
        if (filters.expiry === 'expiring' && !isExpiringSoon(daysToExpiry)) {
          return false;
        }
        if (filters.expiry === 'expired' && !isExpired(daysToExpiry)) {
          return false;
        }
      }

      if (searchTerm) {
        const haystack = [
          lot.lotCode,
          lot.productName,
          lot.productCode,
          lot.warehouseName,
        ].map((val) => String(val || '').toLowerCase()).join(' ');

        if (!haystack.includes(searchTerm)) {
          return false;
        }
      }

      return true;
    });
  }

  // --- Sort ---

  function getLotSortPriority(lot) {
    const daysToExpiry = calculateDaysToExpiry(lot.expirationDate);
    const hasAlert = lot.alertIds && lot.alertIds.length > 0;
    const expired = isExpired(daysToExpiry);
    const expiringSoon = isExpiringSoon(daysToExpiry);
    const qa = String(lot.qaStatus || '').toUpperCase();
    const qaPending = qa === 'PENDING' || qa === 'REJECTED' || qa === 'FAILED';

    if (hasAlert && expired) return 0;
    if (hasAlert) return 1;
    if (expired) return 2;
    if (expiringSoon) return 3;
    if (qaPending) return 4;
    return 5;
  }

  function sortLots(lots) {
    return [...lots].sort((a, b) => {
      const priorityDiff = getLotSortPriority(a) - getLotSortPriority(b);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      const daysA = calculateDaysToExpiry(a.expirationDate);
      const daysB = calculateDaysToExpiry(b.expirationDate);
      if (daysA !== null && daysB !== null) {
        return daysA - daysB;
      }
      if (daysA !== null) return -1;
      if (daysB !== null) return 1;
      return 0;
    });
  }

  // --- Category index for entry dialog ---

  /**
   * Derives a sorted category index (with subcategories) from a flat product array.
   * Only includes categories that actually have products.
   * @param {Array<any>} products
   * @returns {Array<{ id: string, name: string, subcategories: Array<{ id: string, name: string }> }>}
   */
  function buildCategoryIndex(products) {
    /** @type {Map<string, { id: string, name: string, subcategoryMap: Map<string, { id: string, name: string }> }>} */
    const categoryMap = new Map();

    for (const p of (products || [])) {
      if (!p?.category?.id) continue;
      const catId = String(p.category.id);

      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, {
          id: catId,
          name: String(p.category.name || ''),
          subcategoryMap: new Map(),
        });
      }

      if (p?.subcategory?.id) {
        const subId = String(p.subcategory.id);
        const cat = categoryMap.get(catId);
        if (!cat.subcategoryMap.has(subId)) {
          cat.subcategoryMap.set(subId, { id: subId, name: String(p.subcategory.name || '') });
        }
      }
    }

    return Array.from(categoryMap.values())
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        subcategories: Array.from(cat.subcategoryMap.values())
          .sort((a, b) => a.name.localeCompare(b.name, 'es')),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  /**
   * Filters a product array by category and optional subcategory (strict match).
   * Returns all products when categoryId is empty.
   * @param {Array<any>} products
   * @param {string} categoryId
   * @param {string} subcategoryId
   * @returns {Array<any>}
   */
  function filterProductsByCategory(products, categoryId, subcategoryId) {
    if (!categoryId) return products || [];
    return (products || []).filter((p) => {
      if (String(p?.category?.id || '') !== categoryId) return false;
      if (subcategoryId && String(p?.subcategory?.id || '') !== subcategoryId) return false;
      return true;
    });
  }

  /**
   * Filters a product array by a free-text search term.
   * Matches against product name, code, category name and subcategory name.
   * Returns all products when the search term is empty.
   * @param {Array<any>} products
   * @param {string} searchTerm
   * @returns {Array<any>}
   */
  function filterProductsBySearch(products, searchTerm) {
    const term = String(searchTerm || '').trim().toLowerCase();
    if (!term) return products || [];
    return (products || []).filter((p) => {
      const name = String(p?.name || '').toLowerCase();
      const code = String(p?.code || '').toLowerCase();
      const categoryName = String(p?.category?.name || '').toLowerCase();
      const subcategoryName = String(p?.subcategory?.name || '').toLowerCase();
      return name.includes(term) || code.includes(term)
        || categoryName.includes(term) || subcategoryName.includes(term);
    });
  }

  // --- Entry reason codes ---

  /** Catalog of approved reason codes for stock entries (movementType: IN). */
  const ENTRY_REASON_CODES = [
    { value: 'PURCHASE', label: 'Compra a proveedor' },
    { value: 'PRODUCTION_OUTPUT', label: 'Salida de produccion interna' },
    { value: 'INITIAL_LOAD', label: 'Carga inicial' },
    { value: 'RETURN_FROM_CLIENT', label: 'Devolucion de cliente' },
    { value: 'TRANSFER_IN', label: 'Traslado entrada' },
    { value: 'MANUAL_ENTRY', label: 'Entrada manual' },
  ];

  /**
   * Builds a stock entry payload from a FormData instance.
   * Omits optional fields when empty so they are not sent as empty strings.
   * @param {FormData} formData
   * @returns {object}
   */
  function buildStockEntryPayload(formData) {
    const payload = {
      warehouseId: Number(formData.get('warehouseId')),
      productId: Number(formData.get('productId')),
      quantity: parseFloat(/** @type {string} */ (formData.get('quantity'))),
      internalLotNumber: String(formData.get('internalLotNumber') || '').trim(),
      reasonCode: String(formData.get('reasonCode') || 'MANUAL_ENTRY'),
    };

    const expirationDate = String(formData.get('expirationDate') || '').trim();
    if (expirationDate) payload.expirationDate = expirationDate;

    const productionDate = String(formData.get('productionDate') || '').trim();
    if (productionDate) payload.productionDate = productionDate;

    const manufacturerLotNumber = String(formData.get('manufacturerLotNumber') || '').trim();
    if (manufacturerLotNumber) payload.manufacturerLotNumber = manufacturerLotNumber;

    const invoiceNumber = String(formData.get('invoiceNumber') || '').trim();
    if (invoiceNumber) payload.invoiceNumber = invoiceNumber;

    const note = String(formData.get('note') || '').trim();
    if (note) payload.note = note;

    return payload;
  }

  // --- QA action helpers ---

  function canExecuteQa(lot, session, sessionAdapter) {
    return Boolean(
      lot?.lotId
      && canManageLotQa(session, sessionAdapter)
    );
  }

  function buildQaPayload(formData) {
    return {
      action: String(formData.get('qaAction') || '').trim(),
      reason: String(formData.get('qaReason') || '').trim(),
    };
  }

  rootShell.register('views.lotsAdminHelpers', {
    ENTRY_REASON_CODES,
    assessLotDataGate,
    buildCategoryIndex,
    filterProductsByCategory,
    filterProductsBySearch,
    buildLotsKpis,
    buildQaPayload,
    buildStockEntryPayload,
    calculateDaysToExpiry,
    canExecuteQa,
    canManageLotQa,
    canManageLots,
    canViewLots,
    createDefaultFilters,
    filterLots,
    formatExpirationDate,
    formatQuantity,
    getLotStatusLabel,
    getLotStatusVariant,
    getQaStatusLabel,
    getQaStatusVariant,
    getSourceConfidenceLabel,
    hasActiveFilters,
    isExpired,
    isExpiringSoon,
    normalizeLotStocks,
    sortLots,
  });
}(window));
