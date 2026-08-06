(function attachRootShellWarehousesAdminView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const warehousesApi = rootShell.require('warehousesApi');
  const rootShellUi = rootShell.require('ui');
  const sessionAdapter = rootShell.require('sessionAdapter');
  const warehousesHelpers = rootShell.require('views.warehousesAdminHelpers');
  const warehousesRenderers = rootShell.require('views.warehousesAdminRenderers');

  function render() {
    return `
      <section class="root-hero" aria-labelledby="root-view-title">
        <p class="eyebrow">Inventario</p>
        <h2 id="root-view-title">Bodegas</h2>
        <p class="muted">Consulta y crea bodegas de la empresa sin prometer flujos de stock o movimientos que aun no estan soportados.</p>
      </section>

      <section class="routes-page warehouses-page" id="warehouses-page">
        <div id="warehouses-metrics" class="commercial-metrics" aria-live="polite"></div>
        <div id="warehouses-page-message"></div>

        <article class="card root-card warehouses-workspace">
          <div class="page-header warehouses-header">
            <div>
              <h3>Bodegas de la empresa</h3>
              <p id="warehouses-list-summary" class="muted">Carga la configuracion operativa disponible para inventario.</p>
            </div>
            <div class="action-row compact-action-row">
              <button id="warehouses-refresh-button" class="secondary-button" type="button">Actualizar</button>
              <button id="warehouses-open-create-button" type="button">Nueva bodega</button>
            </div>
          </div>

          <div class="client-command-bar warehouses-filter-bar">
            <label class="client-search-field"><span>Buscar</span><input id="warehouses-search-input" type="search" placeholder="Codigo o nombre" /></label>
            <label><span>Tipo</span><select id="warehouses-type-filter"><option value="">Todos</option></select></label>
            <label><span>Estado</span><select id="warehouses-status-filter"><option value="all">Todas</option><option value="active">Activas</option><option value="inactive">Inactivas</option></select></label>
            <label><span>Naturaleza</span><select id="warehouses-nature-filter"><option value="all">Todas</option><option value="physical">Fisicas</option><option value="virtual">Virtuales</option></select></label>
            <label><span>Fuente vendible</span><select id="warehouses-sellable-filter"><option value="all">Todas</option><option value="yes">Si</option><option value="no">No</option></select></label>
            <button id="warehouses-clear-filters-button" class="secondary-button" type="button">Limpiar filtros</button>
          </div>

          <div id="warehouses-list-region" aria-live="polite"></div>
        </article>
      </section>

      <dialog id="warehouses-create-dialog" class="modal-card">
        <form id="warehouses-create-form" class="root-form" method="dialog" novalidate>
          <div class="page-header">
            <div>
              <h3>Nueva bodega</h3>
              <p class="muted">Crea una bodega para organizar inventario por tipo y uso operativo.</p>
            </div>
            <button id="warehouses-close-create-button" class="secondary-button" type="button">Cerrar</button>
          </div>
          <div id="warehouses-create-message"></div>
          <fieldset class="root-form__section">
            <legend>Configuracion</legend>
            <div class="root-form-grid">
              <label><span>Codigo *</span><input id="warehouses-create-code" name="code" type="text" required minlength="2" maxlength="40" /></label>
              <label><span>Nombre *</span><input name="name" type="text" required minlength="2" maxlength="120" /></label>
              <label class="field-wide"><span>Tipo de bodega *</span><select id="warehouses-create-type" name="warehouseType" required></select></label>
              <div class="field-wide" id="warehouses-type-helper"></div>
              <label><span>Fuente vendible</span><input id="warehouses-create-sellable" name="isSellableSource" type="checkbox" /></label>
              <label><span>Activa</span><input name="isActive" type="checkbox" checked /></label>
            </div>
          </fieldset>
          <div id="warehouses-adjustment-message"></div>
          <div class="action-row">
            <button id="warehouses-create-submit-button" type="submit">Crear bodega</button>
            <button id="warehouses-create-cancel-button" class="secondary-button" type="button">Cancelar</button>
          </div>
        </form>
      </dialog>
    `;
  }

  async function mount(container, session, helpers = {}) {
    const setShellStatus = typeof helpers.setShellStatus === 'function' ? helpers.setShellStatus : () => {};
    const metricsRegion = /** @type {HTMLElement | null} */ (container.querySelector('#warehouses-metrics'));
    const pageMessage = /** @type {HTMLElement | null} */ (container.querySelector('#warehouses-page-message'));
    const listSummary = /** @type {HTMLElement | null} */ (container.querySelector('#warehouses-list-summary'));
    const listRegion = /** @type {HTMLElement | null} */ (container.querySelector('#warehouses-list-region'));
    const searchInput = /** @type {HTMLInputElement | null} */ (container.querySelector('#warehouses-search-input'));
    const typeFilter = /** @type {HTMLSelectElement | null} */ (container.querySelector('#warehouses-type-filter'));
    const statusFilter = /** @type {HTMLSelectElement | null} */ (container.querySelector('#warehouses-status-filter'));
    const natureFilter = /** @type {HTMLSelectElement | null} */ (container.querySelector('#warehouses-nature-filter'));
    const sellableFilter = /** @type {HTMLSelectElement | null} */ (container.querySelector('#warehouses-sellable-filter'));
    const clearFiltersButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#warehouses-clear-filters-button'));
    const refreshButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#warehouses-refresh-button'));
    const openCreateButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#warehouses-open-create-button'));
    const dialog = /** @type {HTMLDialogElement | null} */ (container.querySelector('#warehouses-create-dialog'));
    const form = /** @type {HTMLFormElement | null} */ (container.querySelector('#warehouses-create-form'));
    const formMessage = /** @type {HTMLElement | null} */ (container.querySelector('#warehouses-create-message'));
    const adjustmentMessage = /** @type {HTMLElement | null} */ (container.querySelector('#warehouses-adjustment-message'));
    const typeHelper = /** @type {HTMLElement | null} */ (container.querySelector('#warehouses-type-helper'));
    const typeInput = /** @type {HTMLSelectElement | null} */ (container.querySelector('#warehouses-create-type'));
    const sellableInput = /** @type {HTMLInputElement | null} */ (container.querySelector('#warehouses-create-sellable'));
    const closeButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#warehouses-close-create-button'));
    const cancelButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#warehouses-create-cancel-button'));
    const submitButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#warehouses-create-submit-button'));
    const codeInput = /** @type {HTMLInputElement | null} */ (container.querySelector('#warehouses-create-code'));

    if (!metricsRegion || !pageMessage || !listSummary || !listRegion || !searchInput || !typeFilter || !statusFilter || !natureFilter || !sellableFilter || !clearFiltersButton || !refreshButton || !openCreateButton || !dialog || !form || !formMessage || !adjustmentMessage || !typeHelper || !typeInput || !sellableInput || !closeButton || !cancelButton || !submitButton || !codeInput) {
      return;
    }

    const canView = warehousesHelpers.canViewWarehouses(session, sessionAdapter);
    const canCreate = warehousesHelpers.canCreateWarehouses(session, sessionAdapter);
    let dataset = {
      items: [],
      summary: { total: 0, active: 0, virtual: 0, sellable: 0 },
      summaryEstimated: false,
      warehouseTypes: [],
    };
    let filters = warehousesHelpers.createDefaultFilters();
    let loading = false;

    function syncCreateButtonVisibility() {
      openCreateButton.hidden = !canCreate;
      openCreateButton.disabled = !canCreate;
      if (!canCreate) {
        openCreateButton.title = 'Necesitas permiso de gestion de inventario para crear bodegas.';
      }
    }

    function renderFilterOptions() {
      const optionsMarkup = ['<option value="">Todos</option>', warehousesRenderers.renderWarehouseTypeOptions(dataset.warehouseTypes, filters.type)].join('');
      typeFilter.innerHTML = optionsMarkup;
    }

    function getVisibleItems() {
      return warehousesHelpers.filterWarehouses(dataset.items, filters);
    }

    function updateFilterStateFromInputs() {
      filters = {
        searchTerm: searchInput.value.trim(),
        type: typeFilter.value,
        status: statusFilter.value,
        nature: natureFilter.value,
        sellable: sellableFilter.value,
      };
    }

    function renderCurrentState() {
      const visibleItems = getVisibleItems();
      metricsRegion.innerHTML = warehousesRenderers.renderMetrics(dataset.summary, dataset.summaryEstimated);
      listSummary.textContent = warehousesHelpers.buildVisibleSummary(dataset.items.length, visibleItems.length, filters);
      clearFiltersButton.hidden = !warehousesHelpers.hasActiveFilters(filters);

      if (!dataset.items.length && !loading) {
        listRegion.innerHTML = warehousesRenderers.renderWarehouseState(
          canCreate ? 'Todavia no hay bodegas registradas' : 'Todavia no hay bodegas registradas para esta empresa.',
          canCreate
            ? 'Crea la primera bodega de la empresa para empezar a organizar el inventario.'
            : 'Todavia no hay bodegas registradas para esta empresa.'
        );
        return;
      }

      if (!visibleItems.length && !loading) {
        listRegion.innerHTML = warehousesRenderers.renderWarehouseState(
          'No hay resultados con los filtros actuales',
          'Prueba con otro termino de busqueda o limpia los filtros para ver mas bodegas.'
        );
        return;
      }

      listRegion.innerHTML = warehousesRenderers.renderWarehousesTable(visibleItems);
    }

    function renderForbiddenState() {
      metricsRegion.innerHTML = warehousesRenderers.renderMetrics({ total: 0, active: 0, virtual: 0, sellable: 0 });
      listSummary.textContent = 'No tienes acceso a esta vista.';
      listRegion.innerHTML = warehousesRenderers.renderWarehouseState(
        'No tienes acceso a esta vista',
        'Necesitas permisos de inventario para consultar las bodegas de la empresa.'
      );
    }

    function resetCreateForm() {
      form.reset();
      formMessage.innerHTML = '';
      adjustmentMessage.innerHTML = '';
      syncCreateTypeState('', true);
      typeInput.dataset.previousType = typeInput.value;
    }

    function syncCreateTypeState(previousType, initial = false) {
      const nextType = typeInput.value;
      const definition = warehousesHelpers.getWarehouseTypeDefinition(dataset.warehouseTypes, nextType);
      typeHelper.innerHTML = warehousesRenderers.renderTypeHelperText(definition);
      if (definition?.isVirtual) {
        sellableInput.checked = false;
        sellableInput.disabled = true;
      } else {
        sellableInput.disabled = false;
        if (initial) {
          sellableInput.checked = Boolean(definition?.defaultSellableSource);
        } else if (previousType !== nextType) {
          sellableInput.checked = Boolean(definition?.defaultSellableSource);
        }
      }

      const adjustmentText = warehousesHelpers.getTypeAdjustmentMessage(previousType, nextType, dataset.warehouseTypes);
      adjustmentMessage.innerHTML = adjustmentText ? rootShellUi.renderInlineMessage(adjustmentText, 'default') : '';
    }

    function openCreateDialog() {
      if (!canCreate) {
        return;
      }
      formMessage.innerHTML = '';
      adjustmentMessage.innerHTML = '';
      typeInput.innerHTML = warehousesRenderers.renderWarehouseTypeOptions(dataset.warehouseTypes, dataset.warehouseTypes[0]?.value || '');
      resetCreateForm();
      dialog.showModal();
      codeInput.focus();
    }

    function closeCreateDialog() {
      dialog.close();
      resetCreateForm();
      openCreateButton.focus();
    }

    async function loadWarehouses(options = {}) {
      loading = true;
      listRegion.innerHTML = '<p class="empty-state">Cargando bodegas...</p>';
      pageMessage.innerHTML = '';
      setShellStatus(options.loadingMessage || 'Cargando bodegas...');
      try {
        const response = await warehousesApi.listCompanyWarehouses(session);
        dataset = warehousesHelpers.normalizeWarehouseDataset(response);
        renderFilterOptions();
        renderCurrentState();
        setShellStatus('Sesion lista.');
      } catch (error) {
        dataset = {
          items: [],
          summary: { total: 0, active: 0, virtual: 0, sellable: 0 },
          summaryEstimated: false,
          warehouseTypes: [],
        };
        metricsRegion.innerHTML = warehousesRenderers.renderMetrics(dataset.summary);
        listSummary.textContent = 'No se pudieron cargar las bodegas.';
        listRegion.innerHTML = warehousesRenderers.renderWarehouseState(
          'No se pudieron cargar las bodegas',
          'Intenta nuevamente. Si el problema continua, contacta al administrador.',
          'Reintentar'
        );
        pageMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudieron cargar las bodegas.', 'error');
        setShellStatus('No se pudo cargar la vista de bodegas.', 'error');
      } finally {
        loading = false;
      }
    }

    if (!canView) {
      syncCreateButtonVisibility();
      renderForbiddenState();
      setShellStatus('No tienes permisos para consultar bodegas.', 'error');
      return;
    }

    syncCreateButtonVisibility();

    searchInput.addEventListener('input', () => {
      updateFilterStateFromInputs();
      renderCurrentState();
    });
    typeFilter.addEventListener('change', () => {
      updateFilterStateFromInputs();
      renderCurrentState();
    });
    statusFilter.addEventListener('change', () => {
      updateFilterStateFromInputs();
      renderCurrentState();
    });
    natureFilter.addEventListener('change', () => {
      updateFilterStateFromInputs();
      renderCurrentState();
    });
    sellableFilter.addEventListener('change', () => {
      updateFilterStateFromInputs();
      renderCurrentState();
    });

    clearFiltersButton.addEventListener('click', () => {
      filters = warehousesHelpers.createDefaultFilters();
      searchInput.value = '';
      typeFilter.value = '';
      statusFilter.value = 'all';
      natureFilter.value = 'all';
      sellableFilter.value = 'all';
      renderCurrentState();
    });

    refreshButton.addEventListener('click', async () => {
      await loadWarehouses({ loadingMessage: 'Actualizando bodegas...' });
    });

    openCreateButton.addEventListener('click', openCreateDialog);
    closeButton.addEventListener('click', closeCreateDialog);
    cancelButton.addEventListener('click', closeCreateDialog);

    typeInput.addEventListener('change', () => {
      const previousType = typeInput.dataset.previousType || '';
      syncCreateTypeState(previousType);
      typeInput.dataset.previousType = typeInput.value;
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      formMessage.innerHTML = '';
      if (!form.reportValidity()) {
        formMessage.innerHTML = rootShellUi.renderInlineMessage('Revisa los campos obligatorios antes de continuar.', 'error');
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = 'Creando...';
      setShellStatus('Creando bodega...');

      try {
        const payload = warehousesHelpers.buildCreateWarehousePayload(new globalScope.FormData(form), dataset.warehouseTypes);
        await warehousesApi.createCompanyWarehouse(session, payload);
        closeCreateDialog();
        await loadWarehouses({ loadingMessage: 'Actualizando bodegas...' });
        pageMessage.innerHTML = rootShellUi.renderInlineMessage('Bodega creada correctamente.');
        setShellStatus('Bodega creada correctamente.');
      } catch (error) {
        formMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo crear la bodega. Intenta nuevamente.', 'error');
        setShellStatus('No se pudo crear la bodega.', 'error');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Crear bodega';
      }
    });

    await loadWarehouses();
  }

  rootShell.register('views.warehousesAdmin', {
    mount,
    render,
  });
}(window));
