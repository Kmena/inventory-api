(function attachRootShellInventoryAdminRenderers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const rootShellUi = rootShell.require('ui');
  const helpers = rootShell.require('views.inventoryAdminHelpers');

  function renderState(title, description) {
    return `<div class="products-empty-panel"><h3>${rootShellUi.escapeHtml(title)}</h3><p class="muted">${rootShellUi.escapeHtml(description)}</p></div>`;
  }

  /**
   * @param {string} activeTab
   * @param {{ canManage?: boolean }} [options]
   */
  function renderTabs(activeTab, options = {}) {
    const tabs = [
      ['stock', 'Existencias'],
      ['lots', 'Lotes'],
      ['history', 'Historial'],
    ];
    if (options.canManage) {
      tabs.push(['requests', 'Solicitudes']);
    }
    return `<div class="inventory-tabs" role="tablist" aria-label="Secciones de inventario">${tabs.map(([tab, label]) => `
      <button class="secondary-button ${tab === activeTab ? 'active' : ''}" type="button" role="tab" aria-selected="${tab === activeTab ? 'true' : 'false'}" data-inventory-tab="${tab}">${label}</button>
    `).join('')}</div>`;
  }

  function renderFilters(filters) {
    return `
      <div class="client-command-bar products-filter-grid">
        <label class="client-search-field"><span>Buscar</span><input id="inventory-search-input" type="search" placeholder="Producto, codigo o lote" value="${rootShellUi.escapeHtml(filters.q || '')}" /></label>
        <label><span>Producto ID</span><input id="inventory-product-filter" type="text" inputmode="numeric" value="${rootShellUi.escapeHtml(filters.productId || '')}" /></label>
        <label><span>Ubicacion ID</span><input id="inventory-warehouse-filter" type="text" inputmode="numeric" value="${rootShellUi.escapeHtml(filters.warehouseId || '')}" /></label>
        <button id="inventory-apply-filters-button" class="secondary-button" type="button">Aplicar filtros</button>
        <button id="inventory-clear-filters-button" class="secondary-button" type="button">Limpiar filtros</button>
      </div>
    `;
  }

  function renderMetrics(items, activeTab) {
    const totalQuantity = items.reduce((sum, item) => sum + Number(item?.quantity || item?.availableQuantity || item?.onHandQuantity || 0), 0);
    const labels = activeTab === 'history'
      ? ['Movimientos visibles', items.length]
      : activeTab === 'lots'
        ? ['Lotes visibles', items.length]
        : ['Existencias visibles', items.length];
    return `
      <div class="commercial-metrics">
        <article class="card root-card metric-card"><p class="muted">${labels[0]}</p><strong>${helpers.formatNumber(labels[1])}</strong></article>
        <article class="card root-card metric-card"><p class="muted">Cantidad visible</p><strong>${helpers.formatNumber(totalQuantity)}</strong></article>
      </div>
    `;
  }

  /**
   * Stock table — direct Ajustar/Trasladar buttons replaced by a "→ Ver lotes" link.
   * Operators use the Lotes tab to create requests from specific lots.
   */
  function renderStockTable(items) {
    if (!items.length) return renderState('No hay existencias registradas.', 'Cuando existan productos con inventario físico aparecerán aqui.');
    return `<div class="table-wrapper products-table-wrapper"><table class="products-admin-table"><thead><tr><th>Producto</th><th>Ubicacion</th><th>Disponible</th><th>Reservado</th><th>Acciones</th></tr></thead><tbody>${items.map((item) => {
      const productId = rootShellUi.escapeHtml(String(item?.productId || item?.product?.id || ''));
      const warehouseId = rootShellUi.escapeHtml(String(item?.warehouseId || item?.locationId || item?.warehouse?.id || item?.location?.id || ''));
      return `<tr><td data-label="Producto"><strong>${rootShellUi.escapeHtml(helpers.getProductName(item))}</strong><br><span class="muted">${rootShellUi.escapeHtml(helpers.getProductCode(item))}</span></td><td data-label="Ubicacion">${rootShellUi.escapeHtml(helpers.getWarehouseName(item))}</td><td data-label="Disponible">${helpers.formatNumber(item?.quantity ?? item?.availableQuantity ?? item?.onHandQuantity)}</td><td data-label="Reservado">${helpers.formatNumber(item?.reservedQuantity)}</td><td data-label="Acciones"><div class="action-row compact-action-row"><a class="secondary-button" href="/root/#inventory?tab=history&productId=${productId}&warehouseId=${warehouseId}">Historial</a><a class="secondary-button" href="/root/#inventory?tab=lots&productId=${productId}&warehouseId=${warehouseId}">→ Ver lotes</a></div></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  /**
   * Lots table — adds Acciones column with data-request-adjust and data-request-transfer buttons.
   */
  function renderLotsTable(items) {
    if (!items.length) return renderState('No hay lotes para los filtros seleccionados.', 'Los lotes comerciales apareceran sin exponer identificadores internos del sistema.');
    return `<div class="table-wrapper products-table-wrapper"><table class="products-admin-table"><thead><tr><th>Lote visible</th><th>Producto</th><th>Ubicacion</th><th>Cantidad</th><th>Vencimiento</th><th>Historial</th><th>Acciones</th></tr></thead><tbody>${items.map((item) => {
      const lotId = rootShellUi.escapeHtml(String(item?.id || item?.lotId || item?.lot?.id || ''));
      const lotLabel = rootShellUi.escapeHtml(helpers.getLotLabel(item));
      const productId = rootShellUi.escapeHtml(String(item?.productId || item?.product?.id || ''));
      const productName = rootShellUi.escapeHtml(item?.product?.name || helpers.getProductName(item) || '');
      // Lot objects from /lots expose warehouseLotStocks[]; WarehouseLotStock
      // shapes carry warehouseId directly. Generate one button-pair per stock
      // entry so sourceWarehouseId is never empty (avoids FK violation).
      const stocks = Array.isArray(item?.warehouseLotStocks) && item.warehouseLotStocks.length > 0
        ? item.warehouseLotStocks
        : [{ warehouseId: item?.warehouseId || item?.warehouse?.id || '', warehouse: item?.warehouse || null, quantity: item?.quantity ?? item?.availableQuantity ?? '0' }];
      const multiWh = stocks.length > 1;
      const actionButtons = stocks.map((s) => {
        const wId = rootShellUi.escapeHtml(String(s?.warehouseId || s?.warehouse?.id || ''));
        const wName = multiWh ? rootShellUi.escapeHtml(String(s?.warehouse?.name || wId)) : '';
        const wQty = rootShellUi.escapeHtml(String(s?.quantity ?? '0'));
        const suffix = multiWh ? ` (${wName})` : '';
        return `<button class="secondary-button" type="button" data-request-adjust data-lot-id="${lotId}" data-lot-label="${lotLabel}" data-product-id="${productId}" data-product-name="${productName}" data-warehouse-id="${wId}">Solicitar ajuste${suffix}</button><button class="secondary-button" type="button" data-request-transfer data-lot-id="${lotId}" data-lot-label="${lotLabel}" data-product-id="${productId}" data-product-name="${productName}" data-warehouse-id="${wId}" data-lot-quantity="${wQty}">Solicitar traslado${suffix}</button>`;
      }).join('');
      const historyLotId = rootShellUi.escapeHtml(String(item?.lotId || item?.id || item?.lot?.id || ''));
      return `<tr><td data-label="Lote visible">${lotLabel}</td><td data-label="Producto"><strong>${rootShellUi.escapeHtml(helpers.getProductName(item))}</strong></td><td data-label="Ubicacion">${rootShellUi.escapeHtml(helpers.getWarehouseName(item))}</td><td data-label="Cantidad">${helpers.formatNumber(item?.quantity ?? item?.availableQuantity)}</td><td data-label="Vencimiento">${rootShellUi.escapeHtml(rootShellUi.formatDate(item?.expirationDate || item?.expiresAt))}</td><td data-label="Historial"><a class="secondary-button" href="/root/#inventory?tab=history&lotId=${historyLotId}">Ver historial</a></td><td data-label="Acciones"><div class="action-row compact-action-row">${actionButtons}</div></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function renderHistoryTable(items) {
    if (!items.length) return renderState('No hay movimientos registrados.', 'El historial / Kardex es solo lectura y conserva los hechos de inventario.');
    return `<div class="table-wrapper products-table-wrapper"><table class="products-admin-table"><thead><tr><th>Fecha</th><th>Producto</th><th>Ubicacion</th><th>Lote</th><th>Tipo</th><th>Cantidad</th></tr></thead><tbody>${items.map((item) => `<tr><td data-label="Fecha">${rootShellUi.escapeHtml(rootShellUi.formatDate(item?.createdAt || item?.movementDate))}</td><td data-label="Producto">${rootShellUi.escapeHtml(helpers.getProductName(item))}</td><td data-label="Ubicacion">${rootShellUi.escapeHtml(helpers.getWarehouseName(item))}</td><td data-label="Lote">${rootShellUi.escapeHtml(helpers.getLotLabel(item))}</td><td data-label="Tipo">${rootShellUi.escapeHtml(item?.movementType || item?.type || 'Movimiento')}</td><td data-label="Cantidad">${helpers.formatNumber(item?.quantity)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  /**
   * Modal form for creating an ADJUSTMENT request from a lot.
   * @param {{ lotId: string, lotLabel: string, productId: string, productName: string, warehouseId: string }} params
   */
  function renderRequestAdjustmentModal(params) {
    const lotId = rootShellUi.escapeHtml(String(params.lotId || ''));
    const lotLabel = rootShellUi.escapeHtml(String(params.lotLabel || ''));
    const productId = rootShellUi.escapeHtml(String(params.productId || ''));
    const productName = rootShellUi.escapeHtml(String(params.productName || ''));
    const warehouseId = rootShellUi.escapeHtml(String(params.warehouseId || ''));
    return `
      <div class="inline-modal">
        <h4>Solicitar ajuste de inventario</h4>
        <form id="inventory-request-adjustment-form" class="root-form root-form--compact">
          <input type="hidden" name="lotId" value="${lotId}" />
          <input type="hidden" name="productId" value="${productId}" />
          <input type="hidden" name="sourceWarehouseId" value="${warehouseId}" />
          <div class="root-form-grid">
            <div class="detail-item"><span>Lote</span><strong>${lotLabel}</strong></div>
            <div class="detail-item"><span>Producto</span><strong>${productName}</strong></div>
            <label class="root-form-grid__full"><span>Nota</span><input name="note" type="text" maxlength="500" placeholder="Descripción del ajuste requerido" /></label>
          </div>
          <div class="action-row compact-action-row">
            <button type="submit">Crear solicitud de ajuste</button>
          </div>
        </form>
      </div>
    `;
  }

  /**
   * Modal form for creating a TRANSFER request from a lot.
   * @param {{ lotId: string, lotLabel: string, productId: string, productName: string, warehouseId: string, availableQuantity: string, warehouses: Array }} params
   */
  function renderRequestTransferModal(params) {
    const lotId = rootShellUi.escapeHtml(String(params.lotId || ''));
    const lotLabel = rootShellUi.escapeHtml(String(params.lotLabel || ''));
    const productId = rootShellUi.escapeHtml(String(params.productId || ''));
    const productName = rootShellUi.escapeHtml(String(params.productName || ''));
    const warehouseId = rootShellUi.escapeHtml(String(params.warehouseId || ''));
    const warehouses = Array.isArray(params.warehouses) ? params.warehouses : [];

    // Parse to number so we never end up with max="0" making the range impossible.
    const maxQty = parseFloat(String(params.availableQuantity));
    const hasStock = Number.isFinite(maxQty) && maxQty > 0;
    const maxAttr = hasStock ? ` max="${maxQty}"` : '';
    const stockHint = hasStock
      ? `Máximo: ${maxQty}`
      : 'Sin existencias disponibles en este lote';

    const destinationOptions = warehouses
      .filter((w) => String(w?.id) !== String(params.warehouseId))
      .map((w) => `<option value="${rootShellUi.escapeHtml(String(w.id))}">${rootShellUi.escapeHtml(w.name || w.code || String(w.id))}</option>`)
      .join('');
    return `
      <div class="inline-modal">
        <h4>Solicitar traslado de inventario</h4>
        <form id="inventory-request-transfer-form" class="root-form root-form--compact">
          <input type="hidden" name="lotId" value="${lotId}" />
          <input type="hidden" name="productId" value="${productId}" />
          <input type="hidden" name="sourceWarehouseId" value="${warehouseId}" />
          <div class="root-form-grid">
            <div class="detail-item"><span>Lote</span><strong>${lotLabel}</strong></div>
            <div class="detail-item"><span>Producto</span><strong>${productName}</strong></div>
            <label><span>Cantidad a trasladar *</span>
              <input name="quantity" type="number" step="0.001" min="0.001"${maxAttr} required />
              <small class="muted">${rootShellUi.escapeHtml(stockHint)}</small>
            </label>
            <label><span>Bodega destino *</span><select name="destinationWarehouseId" required>${destinationOptions || '<option value="">Sin bodegas disponibles</option>'}</select></label>
            <label class="root-form-grid__full"><span>Nota</span><input name="note" type="text" maxlength="500" placeholder="Descripción del traslado requerido" /></label>
          </div>
          <div class="action-row compact-action-row">
            <button type="submit"${hasStock ? '' : ' disabled'}>Crear solicitud de traslado</button>
          </div>
        </form>
      </div>
    `;
  }

  /**
   * Table of inventory requests for the admin Solicitudes tab.
   * @param {Array} items
   */
  function renderRequestsTable(items) {
    if (!Array.isArray(items) || !items.length) {
      return renderState('No hay solicitudes activas.', 'Las solicitudes de ajuste y traslado pendientes aparecerán aquí.');
    }
    const statusLabel = { PENDING: 'Pendiente', IN_PROGRESS: 'En tránsito', DELIVERED: 'Entregado', COMPLETED: 'Completado', CANCELLED: 'Cancelado' };
    const typeLabel = { ADJUSTMENT: 'Ajuste', TRANSFER: 'Traslado' };
    return `<div class="table-wrapper products-table-wrapper"><table class="products-admin-table"><thead><tr><th>Tipo</th><th>Lote</th><th>Producto</th><th>Bodega origen</th><th>Destino</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${items.map((item) => {
      const status = item?.status || '';
      const type = item?.type || '';
      const id = rootShellUi.escapeHtml(String(item?.id || ''));
      const canCancel = status === 'PENDING';
      const cancelBtn = canCancel
        ? `<button class="secondary-button" type="button" data-cancel-request-id="${id}">Cancelar</button>`
        : '—';
      return `<tr><td data-label="Tipo">${rootShellUi.escapeHtml(typeLabel[type] || type)}</td><td data-label="Lote">${rootShellUi.escapeHtml(item?.lot?.lotNumber || item?.lot?.internalLotNumber || String(item?.lotId || ''))}</td><td data-label="Producto">${rootShellUi.escapeHtml(item?.product?.name || String(item?.productId || ''))}</td><td data-label="Bodega origen">${rootShellUi.escapeHtml(item?.sourceWarehouse?.name || String(item?.sourceWarehouseId || ''))}</td><td data-label="Destino">${rootShellUi.escapeHtml(item?.destinationWarehouse?.name || (item?.destinationWarehouseId ? String(item.destinationWarehouseId) : '—'))}</td><td data-label="Estado"><span class="badge">${rootShellUi.escapeHtml(statusLabel[status] || status)}</span></td><td data-label="Acciones">${cancelBtn}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  rootShell.register('views.inventoryAdminRenderers', {
    renderFilters,
    renderHistoryTable,
    renderLotsTable,
    renderMetrics,
    renderRequestAdjustmentModal,
    renderRequestTransferModal,
    renderRequestsTable,
    renderState,
    renderStockTable,
    renderTabs,
  });
}(window));
