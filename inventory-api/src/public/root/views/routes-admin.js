(function attachRootShellRoutesAdminView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const routesApi = rootShell.require('routesApi');
  const rootShellUi = rootShell.require('ui');
  const routesHelpers = rootShell.require('views.routesAdminHelpers');
  const routesRenderers = rootShell.require('views.routesAdminRenderers');
  const routesState = rootShell.require('views.routesAdminState');

  function render(session) {
    const companyId = rootShellUi.escapeHtml(session?.user?.companyId || 'sin empresa');
    return `
      <section class="root-hero" aria-labelledby="root-view-title">
        <p class="eyebrow">Panel root</p>
        <h2 id="root-view-title">Rutas comerciales</h2>
        <p class="muted">Administra definicion, cobertura y operacion de rutas para la empresa ${companyId}.</p>
      </section>

      <section class="commercial-page" id="routes-page">
        <div class="commercial-metrics">
          <article class="card root-card metric-card"><p class="muted">Rutas</p><strong id="routes-metric-total">-</strong></article>
          <article class="card root-card metric-card"><p class="muted">Subzonas</p><strong id="routes-metric-subzones">-</strong></article>
          <article class="card root-card metric-card"><p class="muted">Tiendas</p><strong id="routes-metric-stores">-</strong></article>
          <article class="card root-card metric-card"><p class="muted">Agentes asignados</p><strong id="routes-metric-agents">-</strong></article>
        </div>

        <div id="routes-page-message"></div>

        <div class="commercial-layout commercial-layout--routes">
          <article class="card root-card commercial-list-card">
            <div class="page-header">
              <div>
                <h3>Rutas de la empresa</h3>
                <p id="routes-list-summary" class="muted">Gestiona las rutas desde un espacio centrado en definicion y cobertura.</p>
              </div>
              <div class="action-row compact-action-row">
                <button id="routes-refresh-button" class="secondary-button" type="button">Actualizar</button>
                <button id="routes-open-create-button" type="button">Nueva ruta</button>
              </div>
            </div>
            <label class="root-form-grid__full"><span>Buscar</span><input id="routes-search-input" type="search" placeholder="Codigo o nombre de ruta" /></label>
            <div id="routes-list-region" class="commercial-list" aria-live="polite"></div>
          </article>

          <article class="card root-card commercial-detail-card">
            <div class="page-header">
              <div>
                <h3 id="routes-detail-title">Selecciona una ruta</h3>
                <p class="muted">La vista mantiene prioridad en definicion, subzonas, cobertura y mapa.</p>
              </div>
            </div>
            <div id="routes-detail-message"></div>
            <div id="routes-detail-region" class="commercial-detail" aria-live="polite"></div>
          </article>
        </div>
      </section>

      <dialog id="routes-create-dialog" class="modal-card">
        <form id="routes-create-form" class="root-form" method="dialog" novalidate>
          <div class="page-header">
            <div>
              <h3>Nueva ruta</h3>
              <p class="muted">Crea una ruta antes de asignar subzonas, agentes o metas.</p>
            </div>
            <button id="routes-close-create-button" class="secondary-button" type="button">Cerrar</button>
          </div>
          <div id="routes-create-message"></div>
          <fieldset class="root-form__section">
            <legend>Definicion</legend>
            <div class="root-form-grid">
              <label><span>Codigo *</span><input name="code" type="text" required minlength="2" maxlength="40" /></label>
              <label><span>Nombre *</span><input name="name" type="text" required minlength="2" maxlength="120" /></label>
              <label><span>Frecuencia de visita (días) *</span><input name="visitFrequencyDays" type="number" min="5" required /></label>
              
              <label><span>Activa</span><input name="isActive" type="checkbox" checked /></label>
            </div>
          </fieldset>
          <div class="action-row">
            <button id="routes-create-submit-button" type="submit">Crear ruta</button>
            <button id="routes-create-cancel-button" class="secondary-button" type="button">Cancelar</button>
          </div>
        </form>
      </dialog>
    `;
  }


  async function mount(container, session, helpers = {}) {
    const setShellStatus = typeof helpers.setShellStatus === 'function' ? helpers.setShellStatus : () => {};
    const pageMessage = /** @type {HTMLElement | null} */ (container.querySelector('#routes-page-message'));
    const detailMessage = /** @type {HTMLElement | null} */ (container.querySelector('#routes-detail-message'));
    const listSummary = /** @type {HTMLElement | null} */ (container.querySelector('#routes-list-summary'));
    const listRegion = /** @type {HTMLElement | null} */ (container.querySelector('#routes-list-region'));
    const detailRegion = /** @type {HTMLElement | null} */ (container.querySelector('#routes-detail-region'));
    const detailTitle = /** @type {HTMLElement | null} */ (container.querySelector('#routes-detail-title'));
    const searchInput = /** @type {HTMLInputElement | null} */ (container.querySelector('#routes-search-input'));
    const refreshButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#routes-refresh-button'));
    const openCreateButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#routes-open-create-button'));
    const dialog = /** @type {HTMLDialogElement | null} */ (container.querySelector('#routes-create-dialog'));
    const createForm = /** @type {HTMLFormElement | null} */ (container.querySelector('#routes-create-form'));
    const createMessage = /** @type {HTMLElement | null} */ (container.querySelector('#routes-create-message'));
    const createSubmitButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#routes-create-submit-button'));
    const closeCreateButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#routes-close-create-button'));
    const cancelCreateButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#routes-create-cancel-button'));
    const metricTotal = /** @type {HTMLElement | null} */ (container.querySelector('#routes-metric-total'));
    const metricSubzones = /** @type {HTMLElement | null} */ (container.querySelector('#routes-metric-subzones'));
    const metricStores = /** @type {HTMLElement | null} */ (container.querySelector('#routes-metric-stores'));
    const metricAgents = /** @type {HTMLElement | null} */ (container.querySelector('#routes-metric-agents'));

    if (!pageMessage || !detailMessage || !listSummary || !listRegion || !detailRegion || !detailTitle || !searchInput || !refreshButton || !openCreateButton || !dialog || !createForm || !createMessage || !createSubmitButton || !closeCreateButton || !cancelCreateButton || !metricTotal || !metricSubzones || !metricStores || !metricAgents) {
      return;
    }

    let overview = null;
    let detailByRouteId = {};
    let selectedRouteId = null;
    let selectedGoalsAgentId = null;
    let goalRows = [];
    /** @type {any | null} Leaflet map instance — destroyed on each re-render */
    let routeLeafletMap = null;

    function destroyRouteLeafletMap() {
      if (routeLeafletMap) {
        routeLeafletMap.remove();
        routeLeafletMap = null;
      }
    }

    function initRouteLeafletMap(route) {
      destroyRouteLeafletMap();
      const L = /** @type {any} */ (globalScope).L;
      const mapContainer = detailRegion.querySelector('#routes-leaflet-map');
      if (!mapContainer || !L) { return; }

      const stores = (route?.stores || []).filter(
        (s) => s.latitude !== null && s.longitude !== null
          && Number.isFinite(Number(s.latitude)) && Number.isFinite(Number(s.longitude)),
      );
      if (!stores.length) { return; }

      // Init after DOM paint so container has dimensions (ADR-004)
      setTimeout(() => {
        routeLeafletMap = L.map(mapContainer, { zoomControl: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '\u00a9 <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(routeLeafletMap);

        const pin = L.divIcon({
          className: 'store-map-pin',
          html: '<div class="route-map-pin__dot"></div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        stores.forEach((s) => {
          L.marker([Number(s.latitude), Number(s.longitude)], { icon: pin })
            .bindTooltip(rootShellUi.escapeHtml(s.code || s.name || 'Tienda'), { permanent: false, direction: 'top' })
            .addTo(routeLeafletMap);
        });

        if (stores.length === 1) {
          routeLeafletMap.setView([Number(stores[0].latitude), Number(stores[0].longitude)], 14);
        } else {
          const bounds = L.latLngBounds(stores.map((s) => [Number(s.latitude), Number(s.longitude)]));
          routeLeafletMap.fitBounds(bounds, { padding: [32, 32] });
        }
        routeLeafletMap.invalidateSize();
      }, 50);
    }

    function renderMetrics() {
      const summary = routesHelpers.summarizeOverview(overview);
      metricTotal.textContent = String(summary.routesCount);
      metricSubzones.textContent = String(summary.subzonesCount);
      metricStores.textContent = String(summary.storesCount);
      metricAgents.textContent = String(summary.assignedAgentsCount);
    }

    function getFilteredRoutes() {
      return routesHelpers.filterRoutes(overview?.routes || [], searchInput.value);
    }

    function getSelectedRoute() {
      return routesState.getSelectedRoute(overview, detailByRouteId, selectedRouteId);
    }

    function renderCurrentState() {
      const filteredRoutes = getFilteredRoutes();
      if (!selectedRouteId && filteredRoutes[0]) {
        selectedRouteId = filteredRoutes[0].id;
      }
      const selectedRoute = getSelectedRoute();
      renderMetrics();
      listSummary.textContent = routesState.buildRoutesListSummary((overview?.routes || []).length, filteredRoutes.length);
      listRegion.innerHTML = routesRenderers.renderRouteList(filteredRoutes, selectedRouteId);
      detailTitle.textContent = selectedRoute?.name || selectedRoute?.code || 'Selecciona una ruta';
      detailRegion.innerHTML = routesRenderers.renderRouteDetail(selectedRoute, overview?.zones || [], overview?.agents || [], selectedGoalsAgentId, goalRows);
      initRouteLeafletMap(selectedRoute);
    }

    async function loadOverview() {
      setShellStatus('Cargando rutas comerciales...');
      listRegion.innerHTML = '<p class="empty-state">Cargando rutas...</p>';
      detailRegion.innerHTML = '<p class="empty-state">Cargando espacio de trabajo...</p>';
      pageMessage.innerHTML = '';
      detailMessage.innerHTML = '';
      try {
        overview = await routesApi.listRoutesOverview(session);
        renderCurrentState();
        setShellStatus('Sesion lista.');
      } catch (error) {
        listRegion.innerHTML = '<p class="empty-state">No se pudieron cargar las rutas.</p>';
        detailRegion.innerHTML = '<p class="empty-state">No se pudo abrir la vista de rutas.</p>';
        pageMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudieron cargar las rutas.', 'error');
        setShellStatus('No se pudo cargar la vista de rutas.', 'error');
      }
    }

    async function loadRouteDetail(routeId) {
      setShellStatus('Cargando detalle de la ruta...');
      detailMessage.innerHTML = '';
      try {
        const detail = await routesApi.getRouteDetail(session, routeId);
        detailByRouteId[String(routeId)] = detail;
        selectedRouteId = routeId;
        selectedGoalsAgentId = detail.agentIds?.[0] || null;
        goalRows = routesState.resolveGoalRows(detail, selectedGoalsAgentId);
        renderCurrentState();
        setShellStatus('Sesion lista.');
      } catch (error) {
        detailMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo cargar el detalle de la ruta.', 'error');
        setShellStatus('No se pudo cargar el detalle de la ruta.', 'error');
      }
    }

    searchInput.addEventListener('input', renderCurrentState);
    refreshButton.addEventListener('click', loadOverview);

    listRegion.addEventListener('click', async (event) => {
      const target = event.target instanceof globalScope.HTMLElement ? event.target.closest('[data-route-select]') : null;
      if (!(target instanceof globalScope.HTMLElement)) {
        return;
      }
      await loadRouteDetail(target.getAttribute('data-route-select'));
    });

    function closeDialog() {
      dialog.close();
      createForm.reset();
      createMessage.innerHTML = '';
    }

    openCreateButton.addEventListener('click', () => dialog.showModal());
    closeCreateButton.addEventListener('click', closeDialog);
    cancelCreateButton.addEventListener('click', closeDialog);

    createForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      createMessage.innerHTML = '';
      if (!createForm.reportValidity()) {
        createMessage.innerHTML = rootShellUi.renderInlineMessage('Revisa los campos obligatorios antes de continuar.', 'error');
        return;
      }
      createSubmitButton.disabled = true;
      createSubmitButton.textContent = 'Creando...';
      setShellStatus('Creando ruta...');
      try {
        const createdRoute = await routesApi.createRoute(session, routesHelpers.buildRoutePayload(new FormData(createForm)));
        closeDialog();
        await loadOverview();
        await loadRouteDetail(createdRoute.id);
        pageMessage.innerHTML = rootShellUi.renderInlineMessage('Ruta creada correctamente.');
        setShellStatus('Ruta creada correctamente.');
      } catch (error) {
        createMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo crear la ruta.', 'error');
        setShellStatus('No se pudo crear la ruta.', 'error');
      } finally {
        createSubmitButton.disabled = false;
        createSubmitButton.textContent = 'Crear ruta';
      }
    });

    detailRegion.addEventListener('change', (event) => {
      const target = event.target;
      if (target instanceof globalScope.HTMLSelectElement && target.id === 'routes-goals-agent-select') {
        selectedGoalsAgentId = target.value;
        const selectedRoute = getSelectedRoute();
        goalRows = routesState.resolveGoalRows(selectedRoute, selectedGoalsAgentId);
        renderCurrentState();
      }

      if (target instanceof globalScope.HTMLInputElement && target.hasAttribute('data-goal-field')) {
        const index = Number(target.getAttribute('data-goal-index') || 0);
        const fieldName = String(target.getAttribute('data-goal-field') || '');
        goalRows[index] = {
          ...(goalRows[index] || {}),
          [fieldName]: target.type === 'number' ? Number(target.value || 0) : target.value,
        };
      }
    });

    detailRegion.addEventListener('click', (event) => {
      const target = event.target;
      if (target instanceof globalScope.HTMLButtonElement && target.id === 'routes-goals-add-button') {
        goalRows = goalRows.concat([{ title: '', periodLabel: '', targetAmount: 0, currentAmount: 0, isActive: true }]);
        renderCurrentState();
      }
    });

    detailRegion.addEventListener('submit', async (event) => {
      const form = event.target;
      if (!(form instanceof globalScope.HTMLFormElement)) {
        return;
      }
      event.preventDefault();
      const formData = new FormData(form);
      const routeId = String(formData.get('routeId') || selectedRouteId || '');
      try {
        if (form.id === 'routes-definition-form') {
          await routesApi.updateRoute(session, routeId, routesHelpers.buildRoutePayload(formData));
          await loadOverview();
          await loadRouteDetail(routeId);
          detailMessage.innerHTML = rootShellUi.renderInlineMessage('Ruta guardada correctamente.');
          setShellStatus('Ruta guardada correctamente.');
          return;
        }

        if (form.id === 'routes-subzones-form') {
          const subregionIds = Array.from(/** @type {NodeListOf<HTMLInputElement>} */ (form.querySelectorAll('input[name="subregionIds"]:checked'))).map((input) => Number(input.value));
          await routesApi.saveRouteSubzones(session, routeId, subregionIds);
          await loadOverview();
          await loadRouteDetail(routeId);
          detailMessage.innerHTML = rootShellUi.renderInlineMessage('Subzonas guardadas correctamente.');
          setShellStatus('Subzonas guardadas correctamente.');
          return;
        }

        if (form.id === 'routes-assignments-form') {
          const userIds = Array.from(/** @type {NodeListOf<HTMLInputElement>} */ (form.querySelectorAll('input[name="userIds"]:checked'))).map((input) => Number(input.value));
          await routesApi.saveRouteAssignments(session, routeId, userIds);
          await loadOverview();
          await loadRouteDetail(routeId);
          detailMessage.innerHTML = rootShellUi.renderInlineMessage('Agentes asignados correctamente.');
          setShellStatus('Agentes asignados correctamente.');
          return;
        }

        if (form.id === 'routes-goals-form') {
          const goalsAgentId = selectedGoalsAgentId || getSelectedRoute()?.agentIds?.[0];
          if (!goalsAgentId) {
            detailMessage.innerHTML = rootShellUi.renderInlineMessage('Selecciona un agente antes de guardar metas.', 'warning');
            return;
          }
          await routesApi.saveAgentGoals(session, goalsAgentId, routesHelpers.buildGoalsPayload(goalRows));
          await loadOverview();
          await loadRouteDetail(routeId);
          detailMessage.innerHTML = rootShellUi.renderInlineMessage('Metas guardadas correctamente.');
          setShellStatus('Metas guardadas correctamente.');
        }
      } catch (error) {
        detailMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo completar la accion solicitada.', 'error');
        setShellStatus('No se pudo completar la accion solicitada.', 'error');
      }
    });

    await loadOverview();
  }

  rootShell.register('views.routesAdmin', {
    mount,
    render,
  });
}(window));
