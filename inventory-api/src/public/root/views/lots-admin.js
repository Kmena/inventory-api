(function attachRootShellLotsAdminView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const inventoryApi = rootShell.require('inventoryApi');
  const productsApi = rootShell.require('productsApi');
  const _categoriesApi = rootShell.require('categoriesApi');
  const warehousesApi = rootShell.require('warehousesApi');
  const rootShellUi = rootShell.require('ui');
  const sessionAdapter = rootShell.require('sessionAdapter');
  const lotsHelpers = rootShell.require('views.lotsAdminHelpers');
  const lotsRenderers = rootShell.require('views.lotsAdminRenderers');
  const lotsState = rootShell.require('views.lotsAdminState');

  function render() {
    return `
      <section class="root-hero" aria-labelledby="root-view-title">
        <p class="eyebrow">Inventario</p>
        <h2 id="root-view-title">Lotes</h2>
        <p class="muted">Trazabilidad y estado actual de unidades de stock por lote. Para ver el historial de eventos, consulta Movimientos.</p>
      </section>

      <section class="routes-page lots-page" id="lots-page">
        <div id="lots-page-message"></div>

        <div id="lots-header-actions" class="action-row compact-action-row">
          <button id="lots-register-entry-button" type="button" hidden>Registrar entrada</button>
          <button id="lots-refresh-button" class="secondary-button" type="button">Actualizar</button>
        </div>

        <div id="lots-kpis-region" aria-live="polite"></div>

        <article class="card root-card warehouses-workspace" id="lots-main-card">
          <div class="page-header warehouses-header">
            <div>
              <h3>Lotes de inventario</h3>
              <p id="lots-list-summary" class="muted">Carga y consulta el estado actual de lotes por bodega y producto.</p>
            </div>
          </div>

          <div class="client-command-bar lots-filter-bar" id="lots-filter-bar">
            <label class="client-search-field">
              <span>Buscar</span>
              <input id="lots-search-input" type="search" placeholder="Lote, producto, codigo, bodega" />
            </label>
            <label>
              <span>Bodega</span>
              <select id="lots-warehouse-filter"><option value="">Todas</option></select>
            </label>
            <label>
              <span>Estado QA</span>
              <select id="lots-qa-filter">
                <option value="">Todos</option>
                <option value="PENDING">Pendiente</option>
                <option value="APPROVED">Aprobado</option>
                <option value="REJECTED">Rechazado</option>
                <option value="FAILED">Fallido</option>
              </select>
            </label>
            <label>
              <span>Estado lote</span>
              <select id="lots-status-filter">
                <option value="">Todos</option>
                <option value="AVAILABLE">Disponible</option>
                <option value="BLOCKED">Bloqueado</option>
                <option value="QUARANTINED">En cuarentena</option>
                <option value="EXPIRED">Vencido</option>
              </select>
            </label>
            <label>
              <span>Vencimiento</span>
              <select id="lots-expiry-filter">
                <option value="all">Todos</option>
                <option value="expiring">Proximos a vencer</option>
                <option value="expired">Vencidos</option>
              </select>
            </label>
            <label>
              <span>Alertas</span>
              <select id="lots-alert-filter">
                <option value="all">Todas</option>
                <option value="has_alert">Con alerta</option>
                <option value="no_alert">Sin alerta</option>
              </select>
            </label>
            <button id="lots-clear-filters-button" class="secondary-button" type="button" hidden>Limpiar filtros</button>
          </div>

          <div id="lots-list-region" aria-live="polite"></div>
        </article>
      </section>

      <div id="lots-entry-dialog-slot"></div>

      <div id="lots-detail-backdrop" class="drawer-backdrop hidden"></div>
      <aside id="lots-detail-drawer" class="client-drawer hidden" aria-hidden="true" aria-labelledby="lots-detail-title">
        <div class="drawer-header">
          <div>
            <h3 id="lots-detail-title">Detalle de lote</h3>
            <p id="lots-detail-subtitle" class="muted">Selecciona un lote para revisar su trazabilidad.</p>
          </div>
          <button id="lots-close-detail-button" class="secondary-button" type="button">Cerrar</button>
        </div>
        <div class="drawer-panel">
          <div id="lots-detail-region"></div>
          <div id="lots-qa-region"></div>
        </div>
        <div class="drawer-footer">
          <p class="muted">Vista de estado actual. Para historial, consulta Movimientos.</p>
          <button id="lots-close-detail-footer-button" class="secondary-button" type="button">Cerrar</button>
        </div>
      </aside>
    `;
  }

  async function mount(container, session, helpers = {}) {
    const setShellStatus = typeof helpers.setShellStatus === 'function' ? helpers.setShellStatus : () => {};

    const pageMessage = /** @type {HTMLElement | null} */ (container.querySelector('#lots-page-message'));
    const kpisRegion = /** @type {HTMLElement | null} */ (container.querySelector('#lots-kpis-region'));
    const listSummary = /** @type {HTMLElement | null} */ (container.querySelector('#lots-list-summary'));
    const listRegion = /** @type {HTMLElement | null} */ (container.querySelector('#lots-list-region'));
    const filterBar = /** @type {HTMLElement | null} */ (container.querySelector('#lots-filter-bar'));
    const searchInput = /** @type {HTMLInputElement | null} */ (container.querySelector('#lots-search-input'));
    const warehouseFilter = /** @type {HTMLSelectElement | null} */ (container.querySelector('#lots-warehouse-filter'));
    const qaFilter = /** @type {HTMLSelectElement | null} */ (container.querySelector('#lots-qa-filter'));
    const statusFilter = /** @type {HTMLSelectElement | null} */ (container.querySelector('#lots-status-filter'));
    const expiryFilter = /** @type {HTMLSelectElement | null} */ (container.querySelector('#lots-expiry-filter'));
    const alertFilter = /** @type {HTMLSelectElement | null} */ (container.querySelector('#lots-alert-filter'));
    const clearFiltersButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#lots-clear-filters-button'));
    const refreshButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#lots-refresh-button'));
    const detailBackdrop = /** @type {HTMLElement | null} */ (container.querySelector('#lots-detail-backdrop'));
    const detailDrawer = /** @type {HTMLElement | null} */ (container.querySelector('#lots-detail-drawer'));
    const detailTitle = /** @type {HTMLElement | null} */ (container.querySelector('#lots-detail-title'));
    const detailSubtitle = /** @type {HTMLElement | null} */ (container.querySelector('#lots-detail-subtitle'));
    const detailRegion = /** @type {HTMLElement | null} */ (container.querySelector('#lots-detail-region'));
    const qaRegion = /** @type {HTMLElement | null} */ (container.querySelector('#lots-qa-region'));
    const closeDetailButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#lots-close-detail-button'));
    const closeDetailFooterButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#lots-close-detail-footer-button'));
    const registerEntryButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#lots-register-entry-button'));
    const entryDialogSlot = /** @type {HTMLElement | null} */ (container.querySelector('#lots-entry-dialog-slot'));

    if (!pageMessage || !kpisRegion || !listSummary || !listRegion || !filterBar || !searchInput || !warehouseFilter || !qaFilter || !statusFilter || !expiryFilter || !alertFilter || !clearFiltersButton || !refreshButton || !detailBackdrop || !detailDrawer || !detailTitle || !detailSubtitle || !detailRegion || !qaRegion || !closeDetailButton || !closeDetailFooterButton) {
      return;
    }

    const canView = lotsHelpers.canViewLots(session, sessionAdapter);
    const canManage = lotsHelpers.canManageLots(session, sessionAdapter);
    const canQa = lotsHelpers.canManageLotQa(session, sessionAdapter);
    let viewState = lotsState.createInitialState();
    let warehouses = [];
    let lastDetailTrigger = null;

    function getSelectedLot() {
      return viewState.filteredLots.find((lot) => lot.lotId === viewState.selectedLotId) || null;
    }

    function renderListSummary() {
      const total = viewState.lots.length;
      const visible = viewState.filteredLots.length;
      const active = lotsHelpers.hasActiveFilters(viewState.filters);

      if (!total) {
        listSummary.textContent = active
          ? 'No hay lotes con los filtros actuales.'
          : 'Todavia no hay lotes visibles para esta empresa.';
        return;
      }

      if (active) {
        listSummary.textContent = `${visible} de ${total} lotes visibles con el filtro actual.`;
      } else {
        listSummary.textContent = `Consulta y filtra los ${total} lotes cargados de la empresa.`;
      }
    }

    function renderCurrentState() {
      const active = lotsHelpers.hasActiveFilters(viewState.filters);
      clearFiltersButton.hidden = !active;

      renderListSummary();

      if (!viewState.gate.passed) {
        kpisRegion.innerHTML = '';
        listRegion.innerHTML = lotsRenderers.renderDegradedState(viewState.gate);
        filterBar.hidden = true;
        return;
      }

      filterBar.hidden = false;
      kpisRegion.innerHTML = lotsRenderers.renderLotsKpis(
        lotsHelpers.buildLotsKpis(viewState.lots),
        viewState.gate
      );

      if (!viewState.filteredLots.length && !viewState.loading) {
        if (!viewState.lots.length) {
          listRegion.innerHTML = lotsRenderers.renderLotsState(
            'Todavia no hay lotes visibles',
            'Cuando existan entradas de inventario con lotes, apareceran aqui.'
          );
        } else {
          listRegion.innerHTML = lotsRenderers.renderLotsState(
            'No encontramos lotes con esos filtros',
            'Prueba con otro termino de busqueda o limpia los filtros para ver mas lotes.',
            '<button id="lots-empty-clear-filters-button" class="secondary-button" type="button">Limpiar filtros</button>'
          );
        }
        return;
      }

      listRegion.innerHTML = lotsRenderers.renderLotsTable(viewState.filteredLots);
    }

    function applyFiltersAndRender() {
      const sorted = lotsHelpers.sortLots(viewState.lots);
      viewState.filteredLots = lotsHelpers.filterLots(sorted, viewState.filters);
      renderCurrentState();
    }

    function updateFiltersFromInputs() {
      viewState.filters = {
        searchTerm: searchInput.value.trim(),
        warehouseId: warehouseFilter.value,
        qaStatus: qaFilter.value,
        lotStatus: statusFilter.value,
        expiry: expiryFilter.value,
        alertStatus: alertFilter.value,
      };
    }

    function syncFilterInputs() {
      searchInput.value = viewState.filters.searchTerm;
      warehouseFilter.value = viewState.filters.warehouseId;
      qaFilter.value = viewState.filters.qaStatus;
      statusFilter.value = viewState.filters.lotStatus;
      expiryFilter.value = viewState.filters.expiry;
      alertFilter.value = viewState.filters.alertStatus;
    }

    function populateWarehouseOptions() {
      const options = lotsRenderers.renderWarehouseOptions(warehouses, viewState.filters.warehouseId);
      warehouseFilter.innerHTML = `<option value="">Todas</option>${options}`;
    }

    // --- Drawer ---

    function closeDetailDrawer() {
      viewState.selectedLotId = null;
      viewState.drawerOpen = false;
      viewState.showQaForm = false;
      detailDrawer.classList.add('hidden');
      detailBackdrop.classList.add('hidden');
      detailDrawer.setAttribute('aria-hidden', 'true');
      globalScope.document.body.classList.remove('drawer-open');
      detailRegion.innerHTML = lotsRenderers.renderLotDetailBody(null, false);
      qaRegion.innerHTML = '';
      detailSubtitle.textContent = 'Selecciona un lote para revisar su trazabilidad.';
      if (lastDetailTrigger instanceof globalScope.HTMLElement) {
        lastDetailTrigger.focus();
      }
      lastDetailTrigger = null;
    }

    function renderDrawerBody(lot) {
      detailRegion.innerHTML = lotsRenderers.renderLotDetailBody(lot, canQa && lotsHelpers.canExecuteQa(lot, session, sessionAdapter));
      qaRegion.innerHTML = '';

      const qaButton = /** @type {HTMLButtonElement | null} */ (detailRegion.querySelector('#lots-register-qa-button'));
      if (qaButton) {
        qaButton.addEventListener('click', () => {
          const selected = getSelectedLot();
          if (selected && lotsHelpers.canExecuteQa(selected, session, sessionAdapter)) {
            qaRegion.innerHTML = lotsRenderers.renderQaForm(selected);
            bindQaFormEvents();
          }
        });
      }
    }

    function openDetailDrawer(lotId, trigger) {
      viewState.selectedLotId = lotId;
      const lot = getSelectedLot();
      if (!lot) {
        return;
      }

      lastDetailTrigger = trigger || null;
      viewState.drawerOpen = true;
      viewState.showQaForm = false;

      detailTitle.textContent = `Lote ${lot.lotCode}`;
      detailSubtitle.textContent = `${lot.productName} · ${lot.warehouseName}`;
      renderDrawerBody(lot);

      detailDrawer.classList.remove('hidden');
      detailBackdrop.classList.remove('hidden');
      detailDrawer.setAttribute('aria-hidden', 'false');
      globalScope.document.body.classList.add('drawer-open');
      closeDetailButton.focus();
    }

    function bindQaFormEvents() {
      const qaForm = /** @type {HTMLFormElement | null} */ (qaRegion.querySelector('#lots-qa-form'));
      const qaSubmitButton = /** @type {HTMLButtonElement | null} */ (qaRegion.querySelector('#lots-qa-submit-button'));
      const qaCancelButton = /** @type {HTMLButtonElement | null} */ (qaRegion.querySelector('#lots-qa-cancel-button'));
      const qaFormMessage = /** @type {HTMLElement | null} */ (qaRegion.querySelector('#lots-qa-form-message'));

      if (!qaForm || !qaSubmitButton || !qaCancelButton || !qaFormMessage) {
        return;
      }

      qaCancelButton.addEventListener('click', () => {
        qaRegion.innerHTML = '';
        viewState.showQaForm = false;
      });

      qaForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        qaFormMessage.innerHTML = '';

        if (!qaForm.reportValidity()) {
          qaFormMessage.innerHTML = rootShellUi.renderInlineMessage('Revisa los campos obligatorios.', 'error');
          return;
        }

        const lot = getSelectedLot();
        if (!lot || !lotsHelpers.canExecuteQa(lot, session, sessionAdapter)) {
          qaFormMessage.innerHTML = rootShellUi.renderInlineMessage('No se puede ejecutar QA en este lote.', 'error');
          return;
        }

        const payload = lotsHelpers.buildQaPayload(new globalScope.FormData(qaForm));

        qaSubmitButton.disabled = true;
        qaSubmitButton.textContent = 'Guardando...';
        setShellStatus('Registrando QA...');

        try {
          await inventoryApi.updateLotQa(session, lot.lotId, payload);
          qaRegion.innerHTML = '';
          pageMessage.innerHTML = rootShellUi.renderInlineMessage('QA del lote actualizado correctamente.');
          setShellStatus('QA registrado correctamente.');
          await loadData();
        } catch (error) {
          qaFormMessage.innerHTML = rootShellUi.renderInlineMessage(
            error.message || 'No pudimos actualizar el QA del lote. Revisa los datos e intenta nuevamente.',
            'error'
          );
          setShellStatus('No se pudo registrar el QA del lote.', 'error');
        } finally {
          qaSubmitButton.disabled = false;
          qaSubmitButton.textContent = 'Confirmar QA';
        }
      });
    }

    // --- Entry dialog ---

    function bindEntryDialogEvents(dialog) {
      const entryForm = /** @type {HTMLFormElement | null} */ (dialog.querySelector('#lots-entry-form'));
      const entryMessage = /** @type {HTMLElement | null} */ (dialog.querySelector('#lots-entry-message'));
      const entrySubmitButton = /** @type {HTMLButtonElement | null} */ (dialog.querySelector('#lots-entry-submit-button'));
      const closePrimaryButton = /** @type {HTMLButtonElement | null} */ (dialog.querySelector('#lots-close-entry-button'));
      const cancelButton = /** @type {HTMLButtonElement | null} */ (dialog.querySelector('#lots-cancel-entry-button'));
      const productSelect = /** @type {HTMLSelectElement | null} */ (dialog.querySelector('#lots-entry-product-select'));

      if (!entryForm || !entryMessage || !entrySubmitButton || !closePrimaryButton || !cancelButton || !productSelect) {
        return;
      }

      function closeDialog() {
        entryForm.reset();
        entryMessage.innerHTML = '';
        dialog.close();
        if (registerEntryButton) registerEntryButton.focus();
      }

      closePrimaryButton.addEventListener('click', closeDialog);
      cancelButton.addEventListener('click', closeDialog);

      dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        closeDialog();
      });

      entryForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        entryMessage.innerHTML = '';

        if (!entryForm.reportValidity()) {
          entryMessage.innerHTML = rootShellUi.renderInlineMessage('Revisa los campos obligatorios.', 'error');
          return;
        }

        const payload = lotsHelpers.buildStockEntryPayload(new globalScope.FormData(entryForm));

        entrySubmitButton.disabled = true;
        entrySubmitButton.textContent = 'Registrando...';
        setShellStatus('Registrando entrada de inventario...');

        try {
          await inventoryApi.createStockEntry(session, payload);
          closeDialog();
          pageMessage.innerHTML = rootShellUi.renderInlineMessage('Entrada de inventario registrada correctamente.');
          setShellStatus('Entrada registrada.');
          await loadData();
        } catch (error) {
          entryMessage.innerHTML = rootShellUi.renderInlineMessage(
            error.message || 'No se pudo registrar la entrada. Revisa los datos e intenta nuevamente.',
            'error'
          );
          setShellStatus('No se pudo registrar la entrada.', 'error');
        } finally {
          entrySubmitButton.disabled = false;
          entrySubmitButton.textContent = 'Registrar entrada';
        }
      });
    }

    async function openEntryDialog() {
      if (!entryDialogSlot || !canManage) {
        return;
      }

      entryDialogSlot.innerHTML = lotsRenderers.renderEntryDialog(warehouses);
      const dialog = /** @type {HTMLDialogElement | null} */ (entryDialogSlot.querySelector('#lots-entry-dialog'));
      if (!dialog) {
        return;
      }

      const productSelect = /** @type {HTMLSelectElement | null} */ (dialog.querySelector('#lots-entry-product-select'));
      const productSearch = /** @type {HTMLInputElement | null} */ (dialog.querySelector('#lots-entry-product-search'));

      if (productSelect) {
        try {
          const productsResponse = await productsApi.listProducts(session);

          // Soporta respuesta plana (array) o paginada ({ items, pagination })
          const allProducts = Array.isArray(productsResponse)
            ? productsResponse
            : Array.isArray(productsResponse?.items)
              ? productsResponse.items
              : [];

          function applySearchFilter() {
            const term = productSearch ? productSearch.value : '';
            const filtered = lotsHelpers.filterProductsBySearch(allProducts, term);
            productSelect.innerHTML = `<option value="">Selecciona un producto</option>${lotsRenderers.renderProductOptions(filtered)}`;
          }

          if (productSearch) {
            productSearch.addEventListener('input', applySearchFilter);
          }

          // Poblado inicial: muestra todos los productos
          applySearchFilter();

        } catch (err) {
          productSelect.innerHTML = '<option value="">No se pudieron cargar los productos</option>';
          pageMessage.innerHTML = rootShellUi.renderInlineMessage(
            err.message || 'No se pudieron cargar los productos para el formulario.',
            'warning'
          );
        }
      }

      bindEntryDialogEvents(dialog);
      dialog.showModal();
    }

    // --- Data loading ---

    async function loadData() {
      viewState.loading = true;
      listRegion.innerHTML = '<p class="empty-state">Cargando lotes...</p>';
      kpisRegion.innerHTML = '';
      pageMessage.innerHTML = '';
      setShellStatus('Cargando lotes...');

      let stocksResponse = null;
      let alertsResponse = null;
      let warehousesResponse = null;
      const partialWarnings = [];

      try {
        [stocksResponse, alertsResponse, warehousesResponse] = await Promise.all([
          inventoryApi.listStocks(session),
          inventoryApi.listAlerts(session).catch(() => {
            partialWarnings.push('Las alertas no estan disponibles temporalmente.');
            return null;
          }),
          warehousesApi.listCompanyWarehouses(session).catch(() => {
            partialWarnings.push('Las bodegas no pudieron enriquecer los filtros. Puedes seguir consultando los lotes.');
            return null;
          }),
        ]);
      } catch (error) {
        viewState.loading = false;
        kpisRegion.innerHTML = '';
        listRegion.innerHTML = lotsRenderers.renderLotsState(
          'No fue posible cargar los lotes',
          'Intenta nuevamente. Si el problema continua, contacta al administrador.'
        );
        pageMessage.innerHTML = rootShellUi.renderInlineMessage(
          error.message || 'No se pudieron cargar los lotes de inventario.',
          'error'
        );
        setShellStatus('No se pudo cargar la vista de lotes.', 'error');
        return;
      }

      const normalized = lotsHelpers.normalizeLotStocks(stocksResponse, alertsResponse, warehousesResponse);
      viewState.lots = normalized.lots;
      viewState.gate = normalized.gate;
      viewState.alertsAvailable = normalized.alertsAvailable;
      viewState.warehousesAvailable = normalized.warehousesAvailable;
      viewState.loading = false;

      warehouses = Array.isArray(warehousesResponse?.items) ? warehousesResponse.items : [];
      populateWarehouseOptions();

      if (partialWarnings.length > 0) {
        pageMessage.innerHTML = rootShellUi.renderInlineMessage(partialWarnings.join(' '), 'warning');
      }

      applyFiltersAndRender();

      if (viewState.selectedLotId && !getSelectedLot()) {
        closeDetailDrawer();
      }

      setShellStatus('Sesion lista.');
    }

    // --- Forbidden state ---

    if (!canView) {
      kpisRegion.innerHTML = '';
      filterBar.hidden = true;
      listRegion.innerHTML = lotsRenderers.renderLotsState(
        'No tienes acceso a esta vista',
        'Necesitas permisos de inventario para consultar los lotes de la empresa.'
      );
      listSummary.textContent = 'No tienes acceso a lotes.';
      setShellStatus('No tienes permisos para consultar lotes.', 'error');
      return;
    }

    // --- Event listeners ---

    searchInput.addEventListener('input', () => {
      updateFiltersFromInputs();
      applyFiltersAndRender();
    });

    warehouseFilter.addEventListener('change', () => {
      updateFiltersFromInputs();
      applyFiltersAndRender();
    });

    qaFilter.addEventListener('change', () => {
      updateFiltersFromInputs();
      applyFiltersAndRender();
    });

    statusFilter.addEventListener('change', () => {
      updateFiltersFromInputs();
      applyFiltersAndRender();
    });

    expiryFilter.addEventListener('change', () => {
      updateFiltersFromInputs();
      applyFiltersAndRender();
    });

    alertFilter.addEventListener('change', () => {
      updateFiltersFromInputs();
      applyFiltersAndRender();
    });

    clearFiltersButton.addEventListener('click', () => {
      viewState.filters = lotsHelpers.createDefaultFilters();
      syncFilterInputs();
      applyFiltersAndRender();
    });

    if (registerEntryButton && canManage) {
      registerEntryButton.hidden = false;
      registerEntryButton.addEventListener('click', async () => {
        await openEntryDialog();
      });
    }

    refreshButton.addEventListener('click', async () => {
      await loadData();
    });

    listRegion.addEventListener('click', (event) => {
      const trigger = event.target instanceof globalScope.HTMLElement
        ? event.target.closest('[data-lot-detail]')
        : null;

      if (trigger instanceof globalScope.HTMLElement) {
        openDetailDrawer(trigger.getAttribute('data-lot-detail'), trigger);
        return;
      }

      // Handle empty state clear-filters button rendered inside listRegion
      const clearBtn = event.target instanceof globalScope.HTMLElement
        ? event.target.closest('#lots-empty-clear-filters-button')
        : null;

      if (clearBtn instanceof globalScope.HTMLElement) {
        viewState.filters = lotsHelpers.createDefaultFilters();
        syncFilterInputs();
        applyFiltersAndRender();
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

    detailRegion.innerHTML = lotsRenderers.renderLotDetailBody(null, false);
    await loadData();
  }

  rootShell.register('views.lotsAdmin', {
    mount,
    render,
  });
}(window));
