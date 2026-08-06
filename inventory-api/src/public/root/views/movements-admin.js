(function attachRootShellMovementsAdminView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const inventoryApi = rootShell.require('inventoryApi');
  const warehousesApi = rootShell.require('warehousesApi');
  const rootShellUi = rootShell.require('ui');
  const sessionAdapter = rootShell.require('sessionAdapter');
  const movementsHelpers = rootShell.require('views.movementsAdminHelpers');
  const movementsRenderers = rootShell.require('views.movementsAdminRenderers');

  const DEFAULT_PAGE_SIZE = 10;

  function render() {
    return `
      <section class="root-hero" aria-labelledby="root-view-title">
        <p class="eyebrow">Inventario</p>
        <h2 id="root-view-title">Movimientos</h2>
        <p class="muted">Consulta el historial auditado de inventario sin editar ni revertir eventos historicos desde esta pantalla.</p>
      </section>

      <section class="routes-page movements-page" id="movements-page">
        <div id="movements-metrics" class="commercial-metrics" aria-live="polite"></div>
        <div id="movements-page-message"></div>

        <article class="card root-card warehouses-workspace">
          <div class="page-header warehouses-header">
            <div>
              <h3>Historial de inventario</h3>
              <p id="movements-list-summary" class="muted">Carga el historial auditado de la empresa y abre detalle sin salir del listado.</p>
            </div>
            <div class="action-row compact-action-row">
              <button id="movements-refresh-button" class="secondary-button" type="button">Actualizar</button>
            </div>
          </div>

          <div class="client-command-bar movements-filter-bar">
            <label><span>Bodega</span><select id="movements-warehouse-filter"><option value="">Todas</option></select></label>
            <label><span>Producto ID</span><input id="movements-product-filter" type="number" min="1" placeholder="Ej. 15" /></label>
            <label><span>Lote ID</span><input id="movements-lot-filter" type="number" min="1" placeholder="Ej. 9" /></label>
            <button id="movements-apply-filters-button" type="button">Aplicar filtros</button>
            <button id="movements-clear-filters-button" class="secondary-button" type="button">Limpiar filtros</button>
          </div>

          <div id="movements-list-region" aria-live="polite"></div>
          <div id="movements-pagination-region"></div>
        </article>
      </section>

      <div id="movements-detail-backdrop" class="drawer-backdrop hidden"></div>
      <aside id="movements-detail-drawer" class="client-drawer hidden" aria-hidden="true" aria-labelledby="movements-detail-title">
        <div class="drawer-header">
          <div>
            <h3 id="movements-detail-title">Movimiento</h3>
            <p id="movements-detail-subtitle" class="muted">Selecciona un movimiento para revisar su trazabilidad.</p>
          </div>
          <button id="movements-close-detail-button" class="secondary-button" type="button">Cerrar</button>
        </div>
        <div class="drawer-panel">
          <div id="movements-detail-region"></div>
        </div>
        <div class="drawer-footer">
          <p class="muted">Vista de solo lectura.</p>
          <button id="movements-close-detail-footer-button" class="secondary-button" type="button">Cerrar</button>
        </div>
      </aside>
    `;
  }

  async function mount(container, session, helpers = {}) {
    const setShellStatus = typeof helpers.setShellStatus === 'function' ? helpers.setShellStatus : () => {};
    const metricsRegion = /** @type {HTMLElement | null} */ (container.querySelector('#movements-metrics'));
    const pageMessage = /** @type {HTMLElement | null} */ (container.querySelector('#movements-page-message'));
    const listSummary = /** @type {HTMLElement | null} */ (container.querySelector('#movements-list-summary'));
    const listRegion = /** @type {HTMLElement | null} */ (container.querySelector('#movements-list-region'));
    const paginationRegion = /** @type {HTMLElement | null} */ (container.querySelector('#movements-pagination-region'));
    const warehouseFilter = /** @type {HTMLSelectElement | null} */ (container.querySelector('#movements-warehouse-filter'));
    const productFilter = /** @type {HTMLInputElement | null} */ (container.querySelector('#movements-product-filter'));
    const lotFilter = /** @type {HTMLInputElement | null} */ (container.querySelector('#movements-lot-filter'));
    const applyFiltersButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#movements-apply-filters-button'));
    const clearFiltersButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#movements-clear-filters-button'));
    const refreshButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#movements-refresh-button'));
    const detailBackdrop = /** @type {HTMLElement | null} */ (container.querySelector('#movements-detail-backdrop'));
    const detailDrawer = /** @type {HTMLElement | null} */ (container.querySelector('#movements-detail-drawer'));
    const detailTitle = /** @type {HTMLElement | null} */ (container.querySelector('#movements-detail-title'));
    const detailSubtitle = /** @type {HTMLElement | null} */ (container.querySelector('#movements-detail-subtitle'));
    const detailRegion = /** @type {HTMLElement | null} */ (container.querySelector('#movements-detail-region'));
    const closeDetailButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#movements-close-detail-button'));
    const closeDetailFooterButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#movements-close-detail-footer-button'));

    if (!metricsRegion || !pageMessage || !listSummary || !listRegion || !paginationRegion || !warehouseFilter || !productFilter || !lotFilter || !applyFiltersButton || !clearFiltersButton || !refreshButton || !detailBackdrop || !detailDrawer || !detailTitle || !detailSubtitle || !detailRegion || !closeDetailButton || !closeDetailFooterButton) {
      return;
    }

    const canView = movementsHelpers.canViewMovements(session, sessionAdapter);
    let warehouses = [];
    let movementsState = {
      items: [],
      pagination: { page: 1, pageSize: DEFAULT_PAGE_SIZE, totalItems: 0, totalPages: 0 },
    };
    let filters = movementsHelpers.createDefaultFilters();
    let selectedMovementId = null;
    let lastDetailTrigger = null;
    let warehouseFiltersWarning = '';

    function getSelectedMovement() {
      return movementsState.items.find((movement) => String(movement.id) === String(selectedMovementId)) || null;
    }

    function renderWarehouseFilterOptions() {
      warehouseFilter.innerHTML = movementsRenderers.renderWarehouseOptions(warehouses, filters.warehouseId);
    }

    function syncFilterInputs() {
      warehouseFilter.value = filters.warehouseId;
      productFilter.value = filters.productId;
      lotFilter.value = filters.lotId;
    }

    function updateFilterStateFromInputs() {
      filters = {
        warehouseId: warehouseFilter.value.trim(),
        productId: productFilter.value.trim(),
        lotId: lotFilter.value.trim(),
      };
    }

    function renderListState() {
      metricsRegion.innerHTML = movementsRenderers.renderMetrics(movementsState.items);
      listSummary.textContent = movementsHelpers.buildMovementsListSummary(movementsState.items, movementsState.pagination, filters);
      clearFiltersButton.hidden = !movementsHelpers.hasActiveFilters(filters);

      if (!movementsState.pagination.totalItems) {
        listRegion.innerHTML = movementsRenderers.renderState(
          movementsHelpers.hasActiveFilters(filters) ? 'No hay movimientos para los filtros actuales' : 'Todavia no hay movimientos registrados',
          movementsHelpers.hasActiveFilters(filters)
            ? 'Prueba con otra bodega, producto o lote, o limpia los filtros para ver mas resultados.'
            : 'Cuando existan entradas o ajustes de inventario, apareceran aqui en orden cronologico.'
        );
        paginationRegion.innerHTML = '';
        return;
      }

      listRegion.innerHTML = movementsRenderers.renderMovementsTable(movementsState.items);
      paginationRegion.innerHTML = movementsRenderers.renderPagination(movementsState.pagination);
    }

    function renderForbiddenState() {
      metricsRegion.innerHTML = movementsRenderers.renderMetrics([]);
      listSummary.textContent = 'No tienes acceso a movimientos.';
      listRegion.innerHTML = movementsRenderers.renderState(
        'No tienes acceso a movimientos',
        'Necesitas permisos de inventario para consultar el historial auditado de la empresa.'
      );
      paginationRegion.innerHTML = '';
    }

    function closeDetailDrawer() {
      selectedMovementId = null;
      detailDrawer.classList.add('hidden');
      detailBackdrop.classList.add('hidden');
      detailDrawer.setAttribute('aria-hidden', 'true');
      globalScope.document.body.classList.remove('drawer-open');
      detailRegion.innerHTML = movementsRenderers.renderDetail(null);
      detailSubtitle.textContent = 'Selecciona un movimiento para revisar su trazabilidad.';
      if (lastDetailTrigger instanceof globalScope.HTMLElement) {
        lastDetailTrigger.focus();
      }
      lastDetailTrigger = null;
    }

    function openDetailDrawer(movementId, trigger = null) {
      selectedMovementId = movementId;
      const selectedMovement = getSelectedMovement();
      if (!selectedMovement) {
        return;
      }

      lastDetailTrigger = trigger;
      detailTitle.textContent = `Movimiento ${selectedMovement.id}`;
      detailSubtitle.textContent = movementsHelpers.buildMovementReference(selectedMovement);
      detailRegion.innerHTML = movementsRenderers.renderDetail(selectedMovement);
      detailDrawer.classList.remove('hidden');
      detailBackdrop.classList.remove('hidden');
      detailDrawer.setAttribute('aria-hidden', 'false');
      globalScope.document.body.classList.add('drawer-open');
      closeDetailButton.focus();
    }

    async function loadWarehouses() {
      try {
        const response = await warehousesApi.listCompanyWarehouses(session);
        warehouses = Array.isArray(response?.items) ? response.items : Array.isArray(response) ? response : [];
        warehouseFiltersWarning = '';
        renderWarehouseFilterOptions();
      } catch (_error) {
        warehouses = [];
        warehouseFiltersWarning = 'No se pudieron cargar las bodegas para enriquecer los filtros. Puedes seguir consultando por IDs.';
        renderWarehouseFilterOptions();
        pageMessage.innerHTML = rootShellUi.renderInlineMessage(warehouseFiltersWarning, 'warning');
      }
    }

    async function loadMovements(options = {}) {
      const page = options.page || 1;
      listRegion.innerHTML = `<p class="empty-state">${page > 1 ? 'Actualizando historial...' : 'Cargando movimientos...'}</p>`;
      paginationRegion.innerHTML = '';
      pageMessage.innerHTML = warehouseFiltersWarning ? rootShellUi.renderInlineMessage(warehouseFiltersWarning, 'warning') : '';
      setShellStatus(page > 1 ? 'Actualizando historial...' : 'Cargando movimientos...');

      try {
        const response = await inventoryApi.listMovements(
          session,
          movementsHelpers.buildPaginationQuery(filters, page, movementsState.pagination.pageSize || DEFAULT_PAGE_SIZE),
        );
        movementsState = movementsHelpers.normalizeMovementsResponse(response);
        if (!movementsState.pagination.pageSize) {
          movementsState.pagination.pageSize = DEFAULT_PAGE_SIZE;
        }
        renderListState();
        if (warehouseFiltersWarning) {
          pageMessage.innerHTML = rootShellUi.renderInlineMessage(warehouseFiltersWarning, 'warning');
        }
        setShellStatus('Sesion lista.');
        if (selectedMovementId && !getSelectedMovement()) {
          closeDetailDrawer();
        }
      } catch (error) {
        movementsState = {
          items: [],
          pagination: { page, pageSize: DEFAULT_PAGE_SIZE, totalItems: 0, totalPages: 0 },
        };
        metricsRegion.innerHTML = movementsRenderers.renderMetrics([]);
        listSummary.textContent = 'No fue posible cargar los movimientos.';
        listRegion.innerHTML = movementsRenderers.renderState(
          'No fue posible cargar los movimientos',
          'Intenta nuevamente. Si el problema continua, contacta al administrador.'
        );
        paginationRegion.innerHTML = '';
        pageMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudieron cargar los movimientos de inventario.', 'error');
        setShellStatus('No se pudo cargar la vista de movimientos.', 'error');
      }
    }

    if (!canView) {
      renderForbiddenState();
      detailRegion.innerHTML = movementsRenderers.renderDetail(null);
      setShellStatus('No tienes permisos para consultar movimientos.', 'error');
      return;
    }

    applyFiltersButton.addEventListener('click', async () => {
      updateFilterStateFromInputs();
      closeDetailDrawer();
      await loadMovements({ page: 1 });
    });

    clearFiltersButton.addEventListener('click', async () => {
      filters = movementsHelpers.createDefaultFilters();
      syncFilterInputs();
      closeDetailDrawer();
      await loadMovements({ page: 1 });
    });

    refreshButton.addEventListener('click', async () => {
      await loadMovements({ page: movementsState.pagination.page || 1 });
    });

    listRegion.addEventListener('click', (event) => {
      const trigger = event.target instanceof globalScope.HTMLElement ? event.target.closest('[data-movement-detail]') : null;
      if (!(trigger instanceof globalScope.HTMLElement)) {
        return;
      }
      openDetailDrawer(trigger.getAttribute('data-movement-detail'), trigger);
    });

    paginationRegion.addEventListener('click', async (event) => {
      const target = event.target instanceof globalScope.HTMLElement ? event.target : null;
      if (!target) {
        return;
      }

      if (target.id === 'movements-previous-page-button' && movementsState.pagination.page > 1) {
        closeDetailDrawer();
        await loadMovements({ page: movementsState.pagination.page - 1 });
      }

      if (target.id === 'movements-next-page-button' && movementsState.pagination.page < movementsState.pagination.totalPages) {
        closeDetailDrawer();
        await loadMovements({ page: movementsState.pagination.page + 1 });
      }
    });

    closeDetailButton.addEventListener('click', closeDetailDrawer);
    closeDetailFooterButton.addEventListener('click', closeDetailDrawer);
    detailBackdrop.addEventListener('click', closeDetailDrawer);
    detailDrawer.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDetailDrawer();
      }
    });

    detailRegion.innerHTML = movementsRenderers.renderDetail(null);
    await loadWarehouses();
    await loadMovements({ page: 1 });
  }

  rootShell.register('views.movementsAdmin', {
    mount,
    render,
  });
}(window));
