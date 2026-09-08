(function attachRootShellProductionOrdersAdminView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const productionAdminApi = rootShell.require('productionAdminApi');
  const rootShellUi = rootShell.require('ui');
  const sessionAdapter = rootShell.require('sessionAdapter');
  const productionOrdersHelpers = rootShell.require('views.productionOrdersAdminHelpers');
  const productionOrdersRenderers = rootShell.require('views.productionOrdersAdminRenderers');
  const productionOrdersState = rootShell.require('views.productionOrdersAdminState');
  const feedbackWidget = rootShell.has('feedbackWidget') ? rootShell.require('feedbackWidget') : null;

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

      <dialog id="production-approve-confirm-dialog" class="modal-card" aria-labelledby="production-approve-confirm-title">
        <div class="page-header">
          <div>
            <h3 id="production-approve-confirm-title">Confirmar aprobación de orden</h3>
            <p class="muted">Revisá el contexto antes de aprobar.</p>
          </div>
          <button id="production-approve-confirm-close" class="secondary-button" type="button" aria-label="Cerrar">Cancelar</button>
        </div>
        <div id="production-approve-confirm-message" role="status" aria-live="polite"></div>
        <div class="stack-section">
          <div class="detail-grid" id="production-approve-confirm-info"></div>
          <div id="production-approve-confirm-actions" style="display:flex;gap:0.75rem;margin-top:1rem;">
            <button id="production-approve-confirm-submit" type="button" style="background:var(--color-success,#16A34A)">Confirmar aprobación</button>
            <button id="production-approve-confirm-cancel" class="secondary-button" type="button">Cancelar</button>
          </div>
        </div>
      </dialog>

      <dialog id="production-cancel-confirm-dialog" class="modal-card" aria-labelledby="production-cancel-confirm-title">
        <div class="page-header">
          <div>
            <h3 id="production-cancel-confirm-title">Cancelar orden de producción</h3>
            <p class="muted">Esta acción no se puede deshacer.</p>
          </div>
          <button id="production-cancel-confirm-close" class="secondary-button" type="button" aria-label="Cerrar">✕</button>
        </div>
        <div id="production-cancel-confirm-message" role="status" aria-live="polite"></div>
        <div class="stack-section">
          <div class="detail-grid" id="production-cancel-confirm-info"></div>
          <div style="display:flex;gap:0.75rem;margin-top:1rem;">
            <button id="production-cancel-confirm-submit" type="button"
                    style="background:var(--color-danger,#c00);color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer">
              Confirmar cancelación
            </button>
            <button id="production-cancel-confirm-back" class="secondary-button" type="button">Volver</button>
          </div>
        </div>
      </dialog>
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
    const canSubmitProduction  = productionOrdersHelpers.canSubmitProductionOrders(session, sessionAdapter);
    const canApproveProduction = productionOrdersHelpers.canApproveProductionOrders(session, sessionAdapter);
    const canCancelProduction  = productionOrdersHelpers.canCancelProductionOrders(session, sessionAdapter);

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
        getSelectedOrder(), { detailState, canSubmitProduction, canApproveProduction, canCancelProduction },
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

    // TASK-009 (FR-020, FR-021, BR-010): Approval confirmation dialog
    const approveDialog = container.querySelector('#production-approve-confirm-dialog');
    const approveDialogInfo = container.querySelector('#production-approve-confirm-info');
    const approveDialogMessage = container.querySelector('#production-approve-confirm-message');
    const approveDialogSubmitBtn = container.querySelector('#production-approve-confirm-submit');
    const approveDialogCancelBtn = container.querySelector('#production-approve-confirm-cancel');
    const approveDialogCloseBtn = container.querySelector('#production-approve-confirm-close');
    let pendingApproveOrderId = null;
    let pendingApproveOrderSnapshot = null;

    function openApproveConfirmDialog(order) {
      if (!approveDialog) { return; }
      pendingApproveOrderId = order?.id ? String(order.id) : null;
      pendingApproveOrderSnapshot = order ?? null;
      approveDialogMessage.innerHTML = '';

      const esc = rootShellUi.escapeHtml;
      approveDialogInfo.innerHTML = `
        <article class="detail-item"><span>Producto</span><strong>${esc(order?.product?.name || 'Sin producto')}</strong></article>
        <article class="detail-item"><span>Cantidad</span><strong>${esc(String(order?.quantity ?? '—'))}</strong></article>
        <article class="detail-item"><span>Bodega origen</span><strong>${esc(order?.originWarehouse?.name || '—')}</strong></article>
        <article class="detail-item"><span>Bodega destino</span><strong>${esc(order?.destinationWarehouse?.name || '—')}</strong></article>
        <article class="detail-item"><span>Responsable</span><strong>${esc(productionOrdersState.resolveResponsibleLabel(order))}</strong></article>
        <article class="detail-item"><span>Lote</span><strong>${esc(order?.productionLotCode || '—')}</strong></article>
        ${order?.overrideJustification ? `<article class="detail-item"><span>Override</span><strong>${esc(order.overrideJustification)}</strong></article>` : ''}
      `;

      approveDialogSubmitBtn.disabled = false;
      approveDialogSubmitBtn.textContent = 'Confirmar aprobación';
      approveDialog.showModal();
    }

    function closeApproveConfirmDialog() {
      pendingApproveOrderId = null;
      pendingApproveOrderSnapshot = null;
      if (approveDialog) { approveDialog.close(); }
    }

    if (approveDialogCloseBtn) {
      approveDialogCloseBtn.addEventListener('click', closeApproveConfirmDialog);
    }
    if (approveDialogCancelBtn) {
      approveDialogCancelBtn.addEventListener('click', closeApproveConfirmDialog);
    }
    if (approveDialogSubmitBtn) {
      approveDialogSubmitBtn.addEventListener('click', async () => {
        if (!pendingApproveOrderId) { return; }
        approveDialogSubmitBtn.disabled = true;
        approveDialogSubmitBtn.textContent = 'Aprobando...';
        approveDialogMessage.innerHTML = '';

        try {
          const approvedOrderCode = pendingApproveOrderSnapshot?.orderId || `#${pendingApproveOrderId}`;
          const approvedProductName = pendingApproveOrderSnapshot?.product?.name || 'Sin producto';
          await productionAdminApi.approveProductionOrder(session, pendingApproveOrderId, {});
          closeApproveConfirmDialog();
          await loadOrders(ordersDataset.pagination.page || 1);
          pageMessage.innerHTML = rootShellUi.renderInlineMessage(`✓ Orden ${approvedOrderCode} aprobada — ${approvedProductName}. Lista para iniciar en /warehouse/.`, 'success');
          // in-app-feedback nudge after production order approval
          if (feedbackWidget) feedbackWidget.triggerNudge('produccion', session);
        } catch (error) {
          approveDialogMessage.innerHTML = rootShellUi.renderInlineMessage(
            error?.message || 'No se pudo aprobar la orden.', 'error',
          );
          approveDialogSubmitBtn.disabled = false;
          approveDialogSubmitBtn.textContent = 'Confirmar aprobación';
        }
      });
    }

    // --- Cancel confirmation dialog ---
    const cancelDialog          = container.querySelector('#production-cancel-confirm-dialog');
    const cancelDialogCloseBtn  = container.querySelector('#production-cancel-confirm-close');
    const cancelDialogBackBtn   = container.querySelector('#production-cancel-confirm-back');
    const cancelDialogSubmitBtn = container.querySelector('#production-cancel-confirm-submit');
    let pendingCancelOrderId    = null;
    let pendingCancelOrderSnapshot = null;

    function openCancelConfirmDialog(order) {
      if (!cancelDialog) { return; }
      pendingCancelOrderId = order?.id ? String(order.id) : null;
      pendingCancelOrderSnapshot = order ?? null;
      cancelDialogSubmitBtn.disabled = false;
      cancelDialogSubmitBtn.textContent = 'Confirmar cancelación';
      cancelDialog.querySelector('#production-cancel-confirm-message').innerHTML = '';
      productionOrdersRenderers.populateCancelDialog(cancelDialog, order);
      cancelDialog.showModal();
    }
    function closeCancelConfirmDialog() {
      pendingCancelOrderId = null;
      pendingCancelOrderSnapshot = null;
      if (cancelDialog?.open) { cancelDialog.close(); }
    }
    cancelDialogCloseBtn?.addEventListener('click', closeCancelConfirmDialog);
    cancelDialogBackBtn?.addEventListener('click', closeCancelConfirmDialog);
    cancelDialog?.addEventListener('cancel', (e) => { e.preventDefault(); closeCancelConfirmDialog(); });

    cancelDialogSubmitBtn?.addEventListener('click', async () => {
      if (!pendingCancelOrderId) { return; }
      cancelDialogSubmitBtn.disabled = true;
      cancelDialogSubmitBtn.textContent = 'Cancelando...';
      const msgEl = cancelDialog.querySelector('#production-cancel-confirm-message');
      try {
        const cancelledOrderCode = pendingCancelOrderSnapshot?.orderId || `#${pendingCancelOrderId}`;
        const cancelledProductName = pendingCancelOrderSnapshot?.product?.name || 'Sin producto';
        await productionAdminApi.cancelProductionOrder(session, pendingCancelOrderId, {});
        closeCancelConfirmDialog();
        await loadOrders(ordersDataset.pagination.page || 1);
        pageMessage.innerHTML = rootShellUi.renderInlineMessage(`Orden ${cancelledOrderCode} cancelada — ${cancelledProductName}.`, 'success');
      } catch (error) {
        msgEl.innerHTML = rootShellUi.renderInlineMessage(
          error?.message || 'No se pudo cancelar la orden.', 'error',
        );
        cancelDialogSubmitBtn.disabled = false;
        cancelDialogSubmitBtn.textContent = 'Confirmar cancelación';
      }
    });

    detailRegion.addEventListener('click', async (event) => {
      const target = event.target;
      if (!(target instanceof globalScope.HTMLElement)) { return; }

      const btn = target.closest('.production-submit-btn, .production-approve-btn, .production-cancel-btn');
      if (!(btn instanceof globalScope.HTMLButtonElement)) { return; }

      const orderId = btn.getAttribute('data-order-id');
      if (!orderId) { return; }

      const isSubmit = btn.classList.contains('production-submit-btn');
      const isCancel = btn.classList.contains('production-cancel-btn');

      if (isCancel) {
        openCancelConfirmDialog(getSelectedOrder());
        return;
      }

      if (!isSubmit) {
        // FR-021: approval requires confirmation dialog
        const orderToApprove = getSelectedOrder();
        openApproveConfirmDialog(orderToApprove);
        return;
      }

      // Submit to approval (no dialog required per DEC-008)
      const submitOrder = getSelectedOrder();
      const submitOrderCode = submitOrder?.orderId || `#${orderId}`;
      const submitProductName = submitOrder?.product?.name || 'Sin producto';
      const errEl = btn.nextElementSibling;
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Enviando...';
      if (errEl) { errEl.hidden = true; }

      try {
        await productionAdminApi.submitProductionOrder(session, orderId);
        await loadOrders(ordersDataset.pagination.page || 1);
        pageMessage.innerHTML = rootShellUi.renderInlineMessage(`✓ Orden ${submitOrderCode} enviada para aprobación — ${submitProductName}.`, 'success');
      } catch (error) {
        btn.disabled = false;
        btn.textContent = originalText;
        if (errEl) {
          errEl.textContent = error?.message || 'No se pudo enviar la orden.';
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
