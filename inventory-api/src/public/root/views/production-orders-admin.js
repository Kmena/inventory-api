(function attachRootShellProductionOrdersAdminView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const productionAdminApi = rootShell.require('productionAdminApi');
  const rootShellUi = rootShell.require('ui');
  const sessionAdapter = rootShell.require('sessionAdapter');
  const productionOrdersHelpers = rootShell.require('views.productionOrdersAdminHelpers');
  const productionOrdersRenderers = rootShell.require('views.productionOrdersAdminRenderers');
  const productionOrdersState = rootShell.require('views.productionOrdersAdminState');

  function render() {
    return `
      <section class="root-hero" aria-labelledby="root-view-title">
        <p class="eyebrow">Produccion</p>
        <h2 id="root-view-title">Ordenes de produccion</h2>
        <p class="muted">Consulta administrativa de supervision. La operacion diaria ocurre en /warehouse/.</p>
      </section>

      <section class="routes-page products-page production-orders-admin" id="production-orders-page">
        <div id="production-orders-metrics" class="commercial-metrics" aria-live="polite"></div>
        <div id="production-orders-page-message" aria-live="polite"></div>

        <article class="card root-card warehouses-workspace">
          <div class="page-header warehouses-header">
            <div>
              <h3>Ordenes de produccion</h3>
              <p id="production-orders-list-summary" class="muted">Supervision read-only con filtros administrativos. La ejecucion e inspeccion siguen en /warehouse/.</p>
            </div>
            <div class="action-row compact-action-row">
              <button id="production-orders-refresh-button" class="secondary-button" type="button">Actualizar</button>
            </div>
          </div>

          <div class="client-command-bar products-filter-grid">
            <label class="client-search-field products-search-field"><span>Buscar</span><input id="production-orders-search-input" type="search" placeholder="Orden, lote, producto o receta" /></label>
            <label><span>Estado</span><select id="production-orders-status-filter"><option value="">Todos</option></select></label>
            <label><span>Producto</span><select id="production-orders-product-filter"><option value="">Todos</option></select></label>
            <label><span>Receta</span><select id="production-orders-recipe-filter"><option value="">Todas</option></select></label>
            <label><span>Version</span><select id="production-orders-version-filter"><option value="">Todas</option></select></label>
            <label><span>Responsable</span><select id="production-orders-responsible-filter"><option value="">Todos</option></select></label>
            <label><span>Planificada desde</span><input id="production-orders-planned-from-filter" type="date" /></label>
            <label><span>Planificada hasta</span><input id="production-orders-planned-to-filter" type="date" /></label>
            <label><span>Creada desde</span><input id="production-orders-created-from-filter" type="date" /></label>
            <label><span>Creada hasta</span><input id="production-orders-created-to-filter" type="date" /></label>
            <button id="production-orders-clear-filters-button" class="secondary-button" type="button">Limpiar filtros</button>
          </div>

          <div class="products-workspace-grid production-orders-workspace-grid">
            <div>
              <div id="production-orders-list-region" aria-live="polite"></div>
              <div id="production-orders-pagination-region"></div>
            </div>
            <aside class="card root-card products-detail-card" aria-labelledby="production-orders-detail-title">
              <div class="page-header">
                <div>
                  <h3 id="production-orders-detail-title">Detalle de orden</h3>
                  <p id="production-orders-detail-subtitle" class="muted">Selecciona una orden del listado para revisar su detalle de supervision.</p>
                </div>
              </div>
              <div id="production-orders-detail-message" aria-live="polite"></div>
              <div id="production-orders-detail-region"></div>
            </aside>
          </div>
        </article>
      </section>
    `;
  }

  async function mount(container, session, helpers = {}) {
    const setShellStatus = typeof helpers.setShellStatus === 'function' ? helpers.setShellStatus : () => {};
    const metricsRegion = container.querySelector('#production-orders-metrics');
    const pageMessage = container.querySelector('#production-orders-page-message');
    const listSummary = container.querySelector('#production-orders-list-summary');
    const listRegion = container.querySelector('#production-orders-list-region');
    const paginationRegion = container.querySelector('#production-orders-pagination-region');
    const detailSubtitle = container.querySelector('#production-orders-detail-subtitle');
    const detailMessage = container.querySelector('#production-orders-detail-message');
    const detailRegion = container.querySelector('#production-orders-detail-region');
    // filterSupportMessage removed — confusing technical note replaced by compact list summary
    const searchInput = container.querySelector('#production-orders-search-input');
    const statusFilter = container.querySelector('#production-orders-status-filter');
    const productFilter = container.querySelector('#production-orders-product-filter');
    const recipeFilter = container.querySelector('#production-orders-recipe-filter');
    const versionFilter = container.querySelector('#production-orders-version-filter');
    const responsibleFilter = container.querySelector('#production-orders-responsible-filter');
    const plannedFromFilter = container.querySelector('#production-orders-planned-from-filter');
    const plannedToFilter = container.querySelector('#production-orders-planned-to-filter');
    const createdFromFilter = container.querySelector('#production-orders-created-from-filter');
    const createdToFilter = container.querySelector('#production-orders-created-to-filter');
    const clearFiltersButton = container.querySelector('#production-orders-clear-filters-button');
    const refreshButton = container.querySelector('#production-orders-refresh-button');

    if (!metricsRegion || !pageMessage || !listSummary || !listRegion || !paginationRegion || !detailSubtitle || !detailMessage || !detailRegion || !searchInput || !statusFilter || !productFilter || !recipeFilter || !versionFilter || !responsibleFilter || !plannedFromFilter || !plannedToFilter || !createdFromFilter || !createdToFilter || !clearFiltersButton || !refreshButton) {
      return;
    }

    const canViewProductionOrders = productionOrdersHelpers.canViewProductionOrders(session, sessionAdapter);
    const canSubmitProduction = productionOrdersHelpers.canSubmitProductionOrders(session, sessionAdapter);
    const canApproveProduction = productionOrdersHelpers.canApproveProductionOrders(session, sessionAdapter);

    let ordersDataset = {
      items: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
    };
    let filters = productionOrdersHelpers.createDefaultFilters();
    let selectedOrderId = null;
    let selectedOrderDetail = null;
    let detailState = 'idle';

    function getVisibleOrders() {
      return productionOrdersHelpers.applyClientSideFilters(ordersDataset.items, filters);
    }

    function getSelectedOrder() {
      if (selectedOrderDetail && String(selectedOrderDetail.id) === String(selectedOrderId)) {
        return selectedOrderDetail;
      }
      return productionOrdersState.resolveSelectedOrder(getVisibleOrders(), selectedOrderId);
    }

    function renderFilterOptions() {
      statusFilter.innerHTML = productionOrdersRenderers.renderOptionList(productionOrdersState.buildStatusOptions(ordersDataset.items), filters.status, 'Todos');
      productFilter.innerHTML = productionOrdersRenderers.renderOptionList(productionOrdersState.buildProductOptions(ordersDataset.items), filters.productId, 'Todos');
      recipeFilter.innerHTML = productionOrdersRenderers.renderOptionList(productionOrdersState.buildRecipeOptions(ordersDataset.items), filters.recipeId, 'Todas');
      versionFilter.innerHTML = productionOrdersRenderers.renderOptionList(productionOrdersState.buildVersionOptions(ordersDataset.items), filters.versionId, 'Todas');
      responsibleFilter.innerHTML = productionOrdersRenderers.renderOptionList(productionOrdersState.buildResponsibleOptions(ordersDataset.items), filters.responsibleUserId, 'Todos');
    }

    function renderMetricsAndSummary() {
      const visibleOrders = getVisibleOrders();
      metricsRegion.innerHTML = productionOrdersRenderers.renderMetrics(visibleOrders);
      listSummary.textContent = productionOrdersHelpers.buildProductionOrdersListSummary(visibleOrders, ordersDataset.pagination, filters);
      // no filter-support message needed — filters apply to loaded page
    }

    function renderList() {
      if (!canViewProductionOrders) {
        listRegion.innerHTML = productionOrdersRenderers.renderState('Sin acceso', 'No tienes permisos para consultar ordenes de produccion desde root.');
        paginationRegion.innerHTML = '';
        return;
      }

      if (!ordersDataset.items.length) {
        listRegion.innerHTML = productionOrdersRenderers.renderState('Sin ordenes', 'Aun no hay ordenes de produccion registradas para esta empresa.');
        paginationRegion.innerHTML = '';
        return;
      }

      const visibleOrders = getVisibleOrders();
      if (!visibleOrders.length) {
        listRegion.innerHTML = productionOrdersRenderers.renderState('Sin resultados', 'No hay ordenes de produccion para los filtros seleccionados.');
        paginationRegion.innerHTML = productionOrdersRenderers.renderPagination(ordersDataset.pagination);
        return;
      }

      listRegion.innerHTML = productionOrdersRenderers.renderOrdersTable(visibleOrders, selectedOrderId);
      paginationRegion.innerHTML = productionOrdersRenderers.renderPagination(ordersDataset.pagination);
    }

    function renderDetail() {
      detailRegion.innerHTML = productionOrdersRenderers.renderOrderDetail(
        getSelectedOrder(), { detailState, canSubmitProduction, canApproveProduction },
      );
      const selectedOrder = getSelectedOrder();
      detailSubtitle.textContent = selectedOrder
        ? `${selectedOrder.orderId || `ORD-${selectedOrder.id}`} · ${selectedOrder.product?.name || 'Sin producto'} · ${productionOrdersState.resolveVersionLabel(selectedOrder)}`
        : 'Selecciona una orden del listado para revisar su detalle de supervision.';
    }

    function renderAll() {
      renderFilterOptions();
      if (!selectedOrderDetail || String(selectedOrderDetail.id) !== String(selectedOrderId)) {
        selectedOrderId = productionOrdersState.resolveSelectedOrderId(getVisibleOrders(), selectedOrderId);
      }
      renderMetricsAndSummary();
      renderList();
      renderDetail();
    }

    async function loadOrderDetail(orderId) {
      if (!orderId) {
        selectedOrderDetail = null;
        detailState = 'idle';
        renderDetail();
        return;
      }

      detailState = 'loading';
      renderDetail();

      try {
        selectedOrderDetail = await productionAdminApi.getProductionOrder(session, orderId);
        detailState = 'ready';
        detailMessage.innerHTML = '';
      } catch (error) {
        detailState = 'error';
        detailMessage.innerHTML = rootShellUi.renderInlineMessage(error?.message || 'No se pudo cargar el detalle de la orden de produccion.', 'error');
      }

      renderDetail();
    }

    async function loadOrders(page = ordersDataset.pagination.page || 1) {
      pageMessage.innerHTML = rootShellUi.renderInlineMessage('Cargando ordenes de produccion...', 'default');
      setShellStatus('Cargando ordenes de produccion...');

      try {
        const listQuery = productionOrdersHelpers.buildListQuery(filters, page, ordersDataset.pagination.pageSize || 10);
        const response = await productionAdminApi.listProductionOrders(session, listQuery.serverQuery);
        ordersDataset = productionOrdersHelpers.normalizeProductionOrdersResponse(response);
        pageMessage.innerHTML = '';
        selectedOrderDetail = null;
        selectedOrderId = productionOrdersState.resolveSelectedOrderId(getVisibleOrders(), selectedOrderId);
        renderAll();
        await loadOrderDetail(selectedOrderId);
        setShellStatus('Ordenes de produccion listas.');
      } catch (error) {
        pageMessage.innerHTML = rootShellUi.renderInlineMessage(error?.message || 'No se pudieron cargar las ordenes de produccion.', 'error');
        listRegion.innerHTML = productionOrdersRenderers.renderState('No se pudo cargar la informacion', 'Intenta nuevamente para recuperar la supervision de ordenes.');
        paginationRegion.innerHTML = '';
        detailRegion.innerHTML = '';
        setShellStatus('Error cargando ordenes de produccion.', 'error');
      }
    }

    if (!canViewProductionOrders) {
      pageMessage.innerHTML = rootShellUi.renderInlineMessage('No tienes permisos para consultar ordenes de produccion.', 'warning');
      listRegion.innerHTML = productionOrdersRenderers.renderState('Sin acceso', 'No tienes permisos para consultar ordenes de produccion desde root.');
      setShellStatus('Acceso restringido.', 'warning');
      return;
    }

    searchInput.addEventListener('input', () => {
      filters.searchTerm = searchInput.value;
      selectedOrderId = productionOrdersState.resolveSelectedOrderId(getVisibleOrders(), selectedOrderId);
      renderAll();
    });

    statusFilter.addEventListener('change', () => {
      filters.status = statusFilter.value;
      selectedOrderId = productionOrdersState.resolveSelectedOrderId(getVisibleOrders(), selectedOrderId);
      renderAll();
    });

    productFilter.addEventListener('change', () => {
      filters.productId = productFilter.value;
      selectedOrderId = productionOrdersState.resolveSelectedOrderId(getVisibleOrders(), selectedOrderId);
      renderAll();
    });

    recipeFilter.addEventListener('change', () => {
      filters.recipeId = recipeFilter.value;
      selectedOrderId = productionOrdersState.resolveSelectedOrderId(getVisibleOrders(), selectedOrderId);
      renderAll();
    });

    versionFilter.addEventListener('change', () => {
      filters.versionId = versionFilter.value;
      selectedOrderId = productionOrdersState.resolveSelectedOrderId(getVisibleOrders(), selectedOrderId);
      renderAll();
    });

    responsibleFilter.addEventListener('change', () => {
      filters.responsibleUserId = responsibleFilter.value;
      selectedOrderId = productionOrdersState.resolveSelectedOrderId(getVisibleOrders(), selectedOrderId);
      renderAll();
    });

    plannedFromFilter.addEventListener('change', () => {
      filters.plannedDateFrom = plannedFromFilter.value;
      selectedOrderId = productionOrdersState.resolveSelectedOrderId(getVisibleOrders(), selectedOrderId);
      renderAll();
    });

    plannedToFilter.addEventListener('change', () => {
      filters.plannedDateTo = plannedToFilter.value;
      selectedOrderId = productionOrdersState.resolveSelectedOrderId(getVisibleOrders(), selectedOrderId);
      renderAll();
    });

    createdFromFilter.addEventListener('change', () => {
      filters.createdDateFrom = createdFromFilter.value;
      selectedOrderId = productionOrdersState.resolveSelectedOrderId(getVisibleOrders(), selectedOrderId);
      renderAll();
    });

    createdToFilter.addEventListener('change', () => {
      filters.createdDateTo = createdToFilter.value;
      selectedOrderId = productionOrdersState.resolveSelectedOrderId(getVisibleOrders(), selectedOrderId);
      renderAll();
    });

    clearFiltersButton.addEventListener('click', () => {
      filters = productionOrdersHelpers.createDefaultFilters();
      searchInput.value = '';
      statusFilter.value = '';
      productFilter.value = '';
      recipeFilter.value = '';
      versionFilter.value = '';
      responsibleFilter.value = '';
      plannedFromFilter.value = '';
      plannedToFilter.value = '';
      createdFromFilter.value = '';
      createdToFilter.value = '';
      selectedOrderId = productionOrdersState.resolveSelectedOrderId(getVisibleOrders(), null);
      renderAll();
    });

    refreshButton.addEventListener('click', async () => {
      await loadOrders(ordersDataset.pagination.page || 1);
    });

    detailRegion.addEventListener('click', async (event) => {
      const target = event.target;
      if (!(target instanceof globalScope.HTMLElement)) { return; }

      const btn = target.closest('.production-submit-btn, .production-approve-btn');
      if (!(btn instanceof globalScope.HTMLButtonElement)) { return; }

      const orderId = btn.getAttribute('data-order-id');
      if (!orderId) { return; }

      const isSubmit = btn.classList.contains('production-submit-btn');
      const errEl = btn.nextElementSibling;
      const originalText = btn.textContent;

      btn.disabled = true;
      btn.textContent = isSubmit ? 'Enviando...' : 'Aprobando...';
      if (errEl) { errEl.hidden = true; }

      try {
        if (isSubmit) {
          await productionAdminApi.submitProductionOrder(session, orderId);
        } else {
          await productionAdminApi.approveProductionOrder(session, orderId, {});
        }
        await loadOrders(ordersDataset.pagination.page || 1);
      } catch (error) {
        btn.disabled = false;
        btn.textContent = originalText;
        if (errEl) {
          errEl.textContent = error?.message || (isSubmit ? 'No se pudo enviar la orden.' : 'No se pudo aprobar la orden.');
          errEl.hidden = false;
        }
      }
    });

    listRegion.addEventListener('click', async (event) => {
      const target = event.target;
      const button = target instanceof HTMLElement ? target.closest('[data-production-order-detail]') : null;
      if (!(button instanceof globalScope.HTMLButtonElement)) {
        return;
      }
      const orderId = button.getAttribute('data-production-order-detail');
      if (!orderId) {
        return;
      }
      selectedOrderId = orderId;
      renderAll();
      await loadOrderDetail(orderId);
    });

    paginationRegion.addEventListener('click', async (event) => {
      const target = event.target;
      if (!(target instanceof globalScope.HTMLButtonElement)) {
        return;
      }

      if (target.id === 'production-orders-previous-page-button') {
        await loadOrders(Math.max(1, (ordersDataset.pagination.page || 1) - 1));
        return;
      }

      if (target.id === 'production-orders-next-page-button') {
        await loadOrders(Math.min(ordersDataset.pagination.totalPages || 1, (ordersDataset.pagination.page || 1) + 1));
      }
    });

    await loadOrders(1);
  }

  rootShell.register('views.productionOrdersAdmin', {
    mount,
    render,
  });
}(window));
