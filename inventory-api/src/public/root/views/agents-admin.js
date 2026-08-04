(function attachRootShellAgentsAdminView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const agentsApi = rootShell.require('agentsApi');
  const rootShellUi = rootShell.require('ui');
  const agentsHelpers = rootShell.require('views.agentsAdminHelpers');
  const agentsRenderers = rootShell.require('views.agentsAdminRenderers');

  function render(session) {
    const companyId = rootShellUi.escapeHtml(session?.user?.companyId || 'sin empresa');

    return `
      <section class="root-hero" aria-labelledby="root-view-title">
        <p class="eyebrow">Panel root</p>
        <h2 id="root-view-title">Agentes comerciales</h2>
        <p class="muted">Administra agentes, revisa cobertura y asigna rutas para la empresa ${companyId}.</p>
      </section>

      <section class="commercial-page" id="agents-page">
        <div class="commercial-metrics" id="agents-metrics">
          <article class="card root-card metric-card"><p class="muted">Agentes visibles</p><strong id="agents-metric-total">-</strong></article>
          <article class="card root-card metric-card"><p class="muted">Con rutas</p><strong id="agents-metric-routed">-</strong></article>
          <article class="card root-card metric-card"><p class="muted">Sin ruta</p><strong id="agents-metric-unrouted">-</strong></article>
          <article class="card root-card metric-card"><p class="muted">Con metas</p><strong id="agents-metric-goals">-</strong></article>
        </div>

        <div id="agents-page-message"></div>

        <div class="commercial-layout commercial-layout--agents" id="agents-layout">
          <article class="card root-card commercial-list-card">
            <div class="page-header">
              <div>
                <h3>Equipo comercial</h3>
                <p id="agents-list-summary" class="muted">Consulta agentes, supervisores y perfiles comerciales relevantes.</p>
              </div>
              <div class="action-row compact-action-row">
                <button id="agents-refresh-button" class="secondary-button" type="button">Actualizar</button>
                <button id="agents-open-create-button" type="button">Nuevo agente</button>
              </div>
            </div>

            <div class="root-form-grid root-form-grid--filters">
              <label>
                <span>Buscar</span>
                <input id="agents-search-input" type="search" placeholder="Nombre, usuario, correo o rol" />
              </label>
              <label>
                <span>Grupo</span>
                <select id="agents-group-filter">
                  <option value="all">Todos</option>
                  <option value="Agente comercial">Agentes comerciales</option>
                  <option value="Supervisor comercial">Supervisores comerciales</option>
                  <option value="Rol legado ventas">Rol legado ventas</option>
                  <option value="Otros comerciales">Otros comerciales</option>
                </select>
              </label>
            </div>

            <div id="agents-list-region" class="commercial-list" aria-live="polite"></div>
          </article>

          <article class="card root-card commercial-detail-card">
            <div class="page-header">
              <div>
                <h3 id="agents-detail-title">Selecciona un agente</h3>
                <p class="muted">Consulta rutas asignadas, metas visibles y disponibilidad operativa.</p>
              </div>
            </div>
            <div id="agents-detail-message"></div>
            <div id="agents-detail-region" class="commercial-detail" aria-live="polite"></div>
          </article>
        </div>
      </section>

      <dialog id="agents-create-dialog" class="modal-card">
        <form id="agents-create-form" class="root-form" method="dialog" novalidate>
          <div class="page-header">
            <div>
              <h3>Nuevo agente</h3>
              <p class="muted">Crea un usuario comercial usando un rol de empresa disponible.</p>
            </div>
            <button id="agents-close-create-button" class="secondary-button" type="button">Cerrar</button>
          </div>
          <div id="agents-create-message"></div>
          <fieldset class="root-form__section">
            <legend>Datos principales</legend>
            <div class="root-form-grid">
              <label class="root-form-grid__full"><span>Nombre completo *</span><input name="fullName" type="text" required minlength="2" maxlength="255" /></label>
              <label><span>Usuario *</span><input name="username" type="text" required minlength="3" maxlength="100" /></label>
              <label><span>Correo</span><input name="email" type="email" maxlength="255" /></label>
              <label><span>Telefono</span><input name="phone" type="text" maxlength="50" /></label>
              <label><span>Contrasena *</span><input name="password" type="password" required minlength="8" maxlength="100" /></label>
              <label><span>Rol *</span><select id="agents-role-select" name="roleId" required></select></label>
            </div>
          </fieldset>
          <div id="agents-role-guidance" class="muted"></div>
          <div class="action-row">
            <button id="agents-create-submit-button" type="submit">Crear agente</button>
            <button id="agents-create-cancel-button" class="secondary-button" type="button">Cancelar</button>
          </div>
        </form>
      </dialog>
    `;
  }

  async function mount(container, session, helpers = {}) {
    const setShellStatus = typeof helpers.setShellStatus === 'function' ? helpers.setShellStatus : () => {};
    const pageMessage = /** @type {HTMLElement | null} */ (container.querySelector('#agents-page-message'));
    const detailMessage = /** @type {HTMLElement | null} */ (container.querySelector('#agents-detail-message'));
    const listSummary = /** @type {HTMLElement | null} */ (container.querySelector('#agents-list-summary'));
    const listRegion = /** @type {HTMLElement | null} */ (container.querySelector('#agents-list-region'));
    const detailRegion = /** @type {HTMLElement | null} */ (container.querySelector('#agents-detail-region'));
    const detailTitle = /** @type {HTMLElement | null} */ (container.querySelector('#agents-detail-title'));
    const searchInput = /** @type {HTMLInputElement | null} */ (container.querySelector('#agents-search-input'));
    const groupFilter = /** @type {HTMLSelectElement | null} */ (container.querySelector('#agents-group-filter'));
    const refreshButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#agents-refresh-button'));
    const openCreateButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#agents-open-create-button'));
    const dialog = /** @type {HTMLDialogElement | null} */ (container.querySelector('#agents-create-dialog'));
    const createForm = /** @type {HTMLFormElement | null} */ (container.querySelector('#agents-create-form'));
    const createMessage = /** @type {HTMLElement | null} */ (container.querySelector('#agents-create-message'));
    const roleSelect = /** @type {HTMLSelectElement | null} */ (container.querySelector('#agents-role-select'));
    const roleGuidance = /** @type {HTMLElement | null} */ (container.querySelector('#agents-role-guidance'));
    const createSubmitButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#agents-create-submit-button'));
    const closeCreateButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#agents-close-create-button'));
    const cancelCreateButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#agents-create-cancel-button'));
    const metricTotal = /** @type {HTMLElement | null} */ (container.querySelector('#agents-metric-total'));
    const metricRouted = /** @type {HTMLElement | null} */ (container.querySelector('#agents-metric-routed'));
    const metricUnrouted = /** @type {HTMLElement | null} */ (container.querySelector('#agents-metric-unrouted'));
    const metricGoals = /** @type {HTMLElement | null} */ (container.querySelector('#agents-metric-goals'));

    if (!pageMessage || !detailMessage || !listSummary || !listRegion || !detailRegion || !detailTitle || !searchInput || !groupFilter || !refreshButton || !openCreateButton || !dialog || !createForm || !createMessage || !roleSelect || !roleGuidance || !createSubmitButton || !closeCreateButton || !cancelCreateButton || !metricTotal || !metricRouted || !metricUnrouted || !metricGoals) {
      return;
    }

    /** @type {any} */
    let usersResponse = [];
    /** @type {any} */
    let rolesResponse = [];
    /** @type {any} */
    let routesOverview = null;
    let routesLoadError = '';
    let rolesLoadError = '';
    let selectedAgentId = null;

    function renderMetrics(agents) {
      const summary = agentsHelpers.summarizeAgents(agents);
      metricTotal.textContent = String(summary.total);
      metricRouted.textContent = String(summary.withRoutes);
      metricUnrouted.textContent = String(summary.withoutRoutes);
      metricGoals.textContent = String(summary.withGoals);
    }

    function getComposedAgents() {
      return agentsHelpers.composeAgentsDataset(usersResponse, rolesResponse, routesOverview);
    }

    function getFilteredAgents() {
      return agentsHelpers.filterAgents(getComposedAgents(), searchInput.value, groupFilter.value);
    }

    function getSelectedAgent() {
      const composedAgents = getComposedAgents();
      return composedAgents.find((agent) => String(agent.id) === String(selectedAgentId)) || composedAgents[0] || null;
    }

    function renderRoleOptions() {
      const roleItems = (Array.isArray(rolesResponse?.items) ? rolesResponse.items : Array.isArray(rolesResponse) ? rolesResponse : [])
        .filter((role) => agentsHelpers.isCommercialRole(role));
      roleSelect.innerHTML = ['<option value="">Selecciona un rol</option>']
        .concat(roleItems.map((role) => `<option value="${rootShellUi.escapeHtml(role.id)}">${rootShellUi.escapeHtml(role.name || role.code)}</option>`))
        .join('');
      openCreateButton.disabled = Boolean(rolesLoadError);
      roleGuidance.textContent = rolesLoadError
        ? 'No se pudieron cargar los roles. La creacion de agentes no esta disponible por ahora.'
        : 'Usa un rol comercial. Si eliges el rol legado ventas, la vista lo mostrara como advertencia operativa.';
    }

    function renderCurrentState() {
      const composedAgents = getComposedAgents();
      const filteredAgents = getFilteredAgents();
      if (composedAgents.length && !selectedAgentId) {
        selectedAgentId = composedAgents[0].id;
      }
      const selectedAgent = getSelectedAgent();
      renderMetrics(composedAgents);
      listSummary.textContent = filteredAgents.length === composedAgents.length
        ? `Consulta ${composedAgents.length} perfiles comerciales visibles de la empresa.`
        : `${filteredAgents.length} de ${composedAgents.length} perfiles visibles con el filtro actual.`;
      listRegion.innerHTML = agentsRenderers.renderList(filteredAgents, selectedAgent?.id || null);
      detailTitle.textContent = selectedAgent?.fullName || 'Selecciona un agente';
      detailRegion.innerHTML = agentsRenderers.renderDetail(
        selectedAgent,
        Array.isArray(routesOverview?.routes) ? routesOverview.routes : [],
        routesLoadError || '',
      );
      pageMessage.innerHTML = routesLoadError
        ? rootShellUi.renderInlineMessage('No fue posible cargar la informacion comercial de rutas. Puedes seguir viendo los agentes.', 'warning')
        : '';
      detailMessage.innerHTML = '';
      renderRoleOptions();
    }

    async function loadAgents() {
      setShellStatus('Cargando agentes comerciales...');
      pageMessage.innerHTML = '';
      detailMessage.innerHTML = '';
      listRegion.innerHTML = '<p class="empty-state">Cargando agentes...</p>';
      detailRegion.innerHTML = '<p class="empty-state">Cargando detalle...</p>';

      const [usersResult, rolesResult, routesResult] = await Promise.allSettled([
        agentsApi.listCompanyUsers(session),
        agentsApi.listCompanyRoles(session),
        agentsApi.listRoutesOverview(session),
      ]);

      if (usersResult.status !== 'fulfilled') {
        listRegion.innerHTML = '<p class="empty-state">No se pudieron cargar los agentes.</p>';
        detailRegion.innerHTML = '<p class="empty-state">No se pudieron cargar los agentes.</p>';
        pageMessage.innerHTML = rootShellUi.renderInlineMessage(usersResult.reason?.message || 'No se pudieron cargar los agentes.', 'error');
        setShellStatus('No se pudo cargar la vista de agentes.', 'error');
        return;
      }

      usersResponse = usersResult.value;
      rolesResponse = rolesResult.status === 'fulfilled' ? rolesResult.value : [];
      routesOverview = routesResult.status === 'fulfilled' ? routesResult.value : null;
      rolesLoadError = rolesResult.status === 'rejected' ? (rolesResult.reason?.message || 'No se pudieron cargar los roles.') : '';
      routesLoadError = routesResult.status === 'rejected' ? (routesResult.reason?.message || 'No se pudieron cargar las rutas.') : '';
      renderCurrentState();
      setShellStatus(routesLoadError || rolesLoadError ? 'La vista de agentes se cargo con informacion parcial.' : 'Sesion lista.');
    }

    searchInput.addEventListener('input', () => {
      renderCurrentState();
    });

    groupFilter.addEventListener('change', () => {
      renderCurrentState();
    });

    listRegion.addEventListener('click', (event) => {
      const button = event.target instanceof globalScope.HTMLElement ? event.target.closest('[data-agent-select]') : null;
      if (!(button instanceof globalScope.HTMLElement)) {
        return;
      }
      selectedAgentId = button.getAttribute('data-agent-select');
      renderCurrentState();
    });

    detailRegion.addEventListener('submit', async (event) => {
      const form = event.target;
      if (!(form instanceof globalScope.HTMLFormElement) || form.id !== 'agents-assignments-form') {
        return;
      }
      event.preventDefault();
      const selectedAgent = getSelectedAgent();
      if (!selectedAgent) {
        return;
      }

      const selectedRouteIds = Array.from(/** @type {NodeListOf<HTMLInputElement>} */ (form.querySelectorAll('input[name="routeIds"]:checked'))).map((input) => input.value);
      const submitButton = /** @type {HTMLButtonElement | null} */ (form.querySelector('#agents-save-assignments-button'));
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Guardando...';
      }
      detailMessage.innerHTML = '';
      setShellStatus('Guardando rutas asignadas...');

      try {
        routesOverview = await agentsApi.saveAgentRouteAssignments(session, routesOverview, selectedAgent.id, selectedRouteIds);
        renderCurrentState();
        detailMessage.innerHTML = rootShellUi.renderInlineMessage('Rutas asignadas correctamente.');
        setShellStatus('Rutas asignadas correctamente.');
      } catch (error) {
        detailMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudieron guardar las rutas asignadas.', 'error');
        setShellStatus('No se pudieron guardar las rutas asignadas.', 'error');
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Guardar rutas asignadas';
        }
      }
    });

    function closeDialog() {
      dialog.close();
      createForm.reset();
      createMessage.innerHTML = '';
    }

    openCreateButton.addEventListener('click', () => {
      if (openCreateButton.disabled) {
        return;
      }
      createMessage.innerHTML = '';
      dialog.showModal();
    });
    closeCreateButton.addEventListener('click', closeDialog);
    cancelCreateButton.addEventListener('click', closeDialog);

    createForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      createMessage.innerHTML = '';
      if (!createForm.reportValidity()) {
        createMessage.innerHTML = rootShellUi.renderInlineMessage('Revisa los campos obligatorios antes de continuar.', 'error');
        return;
      }
      const formData = new FormData(createForm);
      const payload = {
        fullName: String(formData.get('fullName') || '').trim(),
        username: String(formData.get('username') || '').trim(),
        email: String(formData.get('email') || '').trim() || undefined,
        phone: String(formData.get('phone') || '').trim() || undefined,
        password: String(formData.get('password') || ''),
        roleId: Number(formData.get('roleId') || 0),
      };
      createSubmitButton.disabled = true;
      createSubmitButton.textContent = 'Creando...';
      setShellStatus('Creando agente...');

      try {
        await agentsApi.createCompanyUser(session, payload);
        closeDialog();
        await loadAgents();
        pageMessage.innerHTML = rootShellUi.renderInlineMessage('Agente creado correctamente.');
        setShellStatus('Agente creado correctamente.');
      } catch (error) {
        createMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo crear el agente.', 'error');
        setShellStatus('No se pudo crear el agente.', 'error');
      } finally {
        createSubmitButton.disabled = false;
        createSubmitButton.textContent = 'Crear agente';
      }
    });

    refreshButton.addEventListener('click', loadAgents);

    await loadAgents();
  }

  rootShell.register('views.agentsAdmin', {
    mount,
    render,
  });
}(window));
