(function attachRootShellInventoryAdminView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const inventoryApi = rootShell.require('inventoryApi');
  const rootShellUi = rootShell.require('ui');
  const helpers = rootShell.require('views.inventoryAdminHelpers');
  const renderers = rootShell.require('views.inventoryAdminRenderers');
  const sessionAdapter = rootShell.require('sessionAdapter');

  function render() {
    return `
      <section class="root-hero" aria-labelledby="root-view-title">
        <p class="eyebrow">Inventario</p>
        <h2 id="root-view-title">Inventario</h2>
        <p class="muted">Consulta existencias, lotes e historial operativo sin editar el Kardex desde esta vista.</p>
      </section>
      <section class="routes-page inventory-admin" id="inventory-page">
        <article class="card root-card warehouses-workspace">
          <div class="page-header warehouses-header">
            <div>
              <h3>Workspace de inventario</h3>
              <p class="muted">Productos no inventariables se muestran como “No aplica” en Producto y no generan stock falso.</p>
            </div>
            <button id="inventory-refresh-button" class="secondary-button" type="button">Actualizar</button>
          </div>
          <div id="inventory-tabs-region"></div>
          <div id="inventory-filters-region"></div>
          <div id="inventory-message" aria-live="polite"></div>
          <div id="inventory-metrics-region"></div>
          <div id="inventory-content-region" aria-live="polite"></div>
        </article>
      </section>
    `;
  }

  async function mount(container, session, helpersFromShell = {}) {
    const setShellStatus = typeof helpersFromShell.setShellStatus === 'function' ? helpersFromShell.setShellStatus : () => {};
    const tabsRegion = container.querySelector('#inventory-tabs-region');
    const filtersRegion = container.querySelector('#inventory-filters-region');
    const messageRegion = container.querySelector('#inventory-message');
    const metricsRegion = container.querySelector('#inventory-metrics-region');
    const contentRegion = container.querySelector('#inventory-content-region');
    const refreshButton = container.querySelector('#inventory-refresh-button');

    if (!tabsRegion || !filtersRegion || !messageRegion || !metricsRegion || !contentRegion || !refreshButton) return;

    const canManage = sessionAdapter.hasPermission(session, 'inventory.manage');

    let filters = helpers.parseRouteParams();
    let activeTab = filters.tab;

    function renderChrome() {
      tabsRegion.innerHTML = renderers.renderTabs(activeTab, { canManage });
      filtersRegion.innerHTML = renderers.renderFilters(filters);
    }

    function readFiltersFromInputs() {
      filters = {
        ...filters,
        q: container.querySelector('#inventory-search-input')?.value?.trim() || '',
        productId: container.querySelector('#inventory-product-filter')?.value?.trim() || '',
        warehouseId: container.querySelector('#inventory-warehouse-filter')?.value?.trim() || '',
      };
    }

    function syncHash() {
      const params = new URLSearchParams();
      params.set('tab', activeTab);
      if (filters.productId) params.set('productId', filters.productId);
      if (filters.warehouseId) params.set('warehouseId', filters.warehouseId);
      if (filters.lotId) params.set('lotId', filters.lotId);
      if (filters.q) params.set('q', filters.q);
      globalScope.history.replaceState(null, '', `/root/#inventory?${params.toString()}`);
    }

    async function loadData() {
      renderChrome();
      contentRegion.innerHTML = '<p class="empty-state">Cargando inventario...</p>';
      metricsRegion.innerHTML = '';
      messageRegion.innerHTML = '';
      setShellStatus('Cargando inventario...');
      syncHash();

      const query = {
        q: filters.q,
        productId: filters.productId,
        warehouseId: filters.warehouseId,
        lotId: filters.lotId,
      };

      try {
        let response;
        if (activeTab === 'requests') {
          // Requests tab shows all active requests — inventory filters (productId,
          // warehouseId, lotId) are lot/stock-specific and must not narrow them.
          response = await inventoryApi.listInventoryRequests(session, { status: 'PENDING,IN_PROGRESS,DELIVERED' });
        } else if (activeTab === 'lots') {
          response = await inventoryApi.listLots(session, query);
        } else if (activeTab === 'history') {
          response = await inventoryApi.listMovements(session, query);
        } else {
          response = await inventoryApi.listStocks(session, query);
        }
        const normalized = helpers.normalizeCollectionResponse(response);
        metricsRegion.innerHTML = activeTab === 'requests' ? '' : renderers.renderMetrics(normalized.items, activeTab);
        if (activeTab === 'requests') {
          contentRegion.innerHTML = renderers.renderRequestsTable(normalized.items);
        } else if (activeTab === 'lots') {
          contentRegion.innerHTML = renderers.renderLotsTable(normalized.items);
        } else if (activeTab === 'history') {
          contentRegion.innerHTML = renderers.renderHistoryTable(normalized.items);
        } else {
          contentRegion.innerHTML = renderers.renderStockTable(normalized.items);
        }
        setShellStatus('Inventario cargado.');
      } catch (error) {
        metricsRegion.innerHTML = '';
        contentRegion.innerHTML = renderers.renderState('No se pudo cargar inventario.', 'Reintenta la carga o valida tus permisos de inventario.');
        messageRegion.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo cargar inventario.', 'error');
        setShellStatus('No se pudo cargar inventario.', 'error');
      }
    }

    container.addEventListener('click', async (event) => {
      const target = event.target instanceof globalScope.HTMLElement ? event.target : null;
      const tabButton = target?.closest('[data-inventory-tab]');
      if (tabButton instanceof globalScope.HTMLElement) {
        activeTab = helpers.normalizeTab(tabButton.getAttribute('data-inventory-tab'));
        filters.tab = activeTab;
        await loadData();
        return;
      }
      if (target?.id === 'inventory-apply-filters-button') {
        readFiltersFromInputs();
        await loadData();
        return;
      }
      if (target?.id === 'inventory-clear-filters-button') {
        filters = { tab: activeTab, productId: '', warehouseId: '', lotId: '', q: '' };
        await loadData();
        return;
      }
      const requestAdjustBtn = target?.closest('[data-request-adjust]');
      if (requestAdjustBtn instanceof globalScope.HTMLElement) {
        const params = {
          lotId: requestAdjustBtn.dataset.lotId,
          lotLabel: requestAdjustBtn.dataset.lotLabel,
          productId: requestAdjustBtn.dataset.productId,
          productName: requestAdjustBtn.dataset.productName,
          warehouseId: requestAdjustBtn.dataset.warehouseId,
        };
        messageRegion.innerHTML = renderers.renderRequestAdjustmentModal(params);
        return;
      }
      const requestTransferBtn = target?.closest('[data-request-transfer]');
      if (requestTransferBtn instanceof globalScope.HTMLElement) {
        try {
          const warehousesRaw = await inventoryApi.listWarehouses(session);
          const warehouses = Array.isArray(warehousesRaw) ? warehousesRaw : (warehousesRaw?.items ?? []);
          const params = {
            lotId: requestTransferBtn.dataset.lotId,
            lotLabel: requestTransferBtn.dataset.lotLabel,
            productId: requestTransferBtn.dataset.productId,
            productName: requestTransferBtn.dataset.productName,
            warehouseId: requestTransferBtn.dataset.warehouseId,
            availableQuantity: requestTransferBtn.dataset.lotQuantity,
            warehouses,
          };
          messageRegion.innerHTML = renderers.renderRequestTransferModal(params);
        } catch (_err) {
          messageRegion.innerHTML = rootShellUi.renderInlineMessage('No se pudieron cargar las bodegas.', 'error');
        }
        return;
      }
      const cancelRequestBtn = target?.closest('[data-cancel-request-id]');
      if (cancelRequestBtn instanceof globalScope.HTMLElement) {
        const requestId = cancelRequestBtn.getAttribute('data-cancel-request-id');
        if (!globalScope.confirm('¿Cancelar esta solicitud?')) return;
        cancelRequestBtn.disabled = true;
        try {
          await inventoryApi.cancelInventoryRequest(session, requestId);
          messageRegion.innerHTML = rootShellUi.renderInlineMessage('Solicitud cancelada.');
          await loadData();
        } catch (error) {
          messageRegion.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo cancelar la solicitud.', 'error');
          cancelRequestBtn.disabled = false;
        }
        return;
      }
      if (target?.id === 'inventory-refresh-button') {
        readFiltersFromInputs();
        await loadData();
      }
    });

    container.addEventListener('submit', async (event) => {
      const form = event.target;
      if (!(form instanceof globalScope.HTMLFormElement)) return;
      if (form.id === 'inventory-request-adjustment-form') {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const submitBtn = form.querySelector('[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        const formData = new globalScope.FormData(form);
        const payload = {
          type: 'ADJUSTMENT',
          lotId: Number(formData.get('lotId')),
          productId: Number(formData.get('productId')),
          sourceWarehouseId: Number(formData.get('sourceWarehouseId')),
          note: formData.get('note') || undefined,
        };
        try {
          await inventoryApi.createInventoryRequest(session, payload);
          // Switch to requests tab so the user sees the created request
          // and doesn't re-submit thinking nothing happened.
          activeTab = 'requests';
          await loadData();
        } catch (error) {
          messageRegion.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo crear la solicitud.', 'error');
          if (submitBtn) submitBtn.disabled = false;
        }
        return;
      }
      if (form.id === 'inventory-request-transfer-form') {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const submitBtn = form.querySelector('[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        const formData = new globalScope.FormData(form);
        const payload = {
          type: 'TRANSFER',
          lotId: Number(formData.get('lotId')),
          productId: Number(formData.get('productId')),
          sourceWarehouseId: Number(formData.get('sourceWarehouseId')),
          destinationWarehouseId: Number(formData.get('destinationWarehouseId')),
          quantity: Number(formData.get('quantity')),
          note: formData.get('note') || undefined,
        };
        try {
          await inventoryApi.createInventoryRequest(session, payload);
          // Switch to requests tab so the user sees the created request
          // and doesn't re-submit thinking nothing happened.
          activeTab = 'requests';
          await loadData();
        } catch (error) {
          messageRegion.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo crear la solicitud.', 'error');
          if (submitBtn) submitBtn.disabled = false;
        }
        return;
      }
    });

    await loadData();
  }

  rootShell.register('views.inventoryAdmin', { render, mount });
}(window));
