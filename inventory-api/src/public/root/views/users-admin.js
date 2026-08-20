(function attachRootShellUsersAdminView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const usersApi = rootShell.require('usersApi');
  const ui = rootShell.require('ui');
  const usersHelpers = rootShell.require('views.usersAdminHelpers');
  const usersRenderers = rootShell.require('views.usersAdminRenderers');

  function renderInlineMessage(text, tone = 'success') {
    const cls = tone === 'error' ? 'message error' : 'message success';
    return `<p class="${cls}" role="status">${ui.escapeHtml(String(text))}</p>`;
  }

  function buildErrorMessage(error) {
    const fieldErrors = error?.fieldErrors;
    if (fieldErrors && typeof fieldErrors === 'object') {
      const lines = Object.entries(fieldErrors)
        .flatMap(([field, msgs]) => (msgs || []).map((m) => `${field}: ${m}`));
      if (lines.length) {
        return lines.join(' | ');
      }
    }
    return error?.message || 'No se pudo crear el usuario.';
  }

  function render() {
    return `
      <section class="root-hero" aria-labelledby="users-view-title">
        <p class="eyebrow">Administracion</p>
        <h2 id="users-view-title">Usuarios</h2>
        <p class="muted">Gestioná los usuarios de la empresa, sus roles y accesos.</p>
      </section>

      <section class="commercial-page" id="users-page">
        <div class="commercial-metrics" id="users-metrics">
          <article class="card root-card metric-card"><p class="muted">Total</p><strong id="users-metric-total">-</strong></article>
          <article class="card root-card metric-card"><p class="muted">Root / Admin</p><strong id="users-metric-root">-</strong></article>
          <article class="card root-card metric-card"><p class="muted">Agentes</p><strong id="users-metric-agent">-</strong></article>
          <article class="card root-card metric-card"><p class="muted">Bodega</p><strong id="users-metric-warehouse">-</strong></article>
        </div>

        <div id="users-page-message"></div>

        <div class="commercial-layout" id="users-layout">
          <article class="card root-card commercial-list-card">
            <div class="page-header">
              <div>
                <h3>Equipo</h3>
                <p id="users-list-summary" class="muted">Consulta usuarios, roles y accesos de la empresa.</p>
              </div>
              <div class="action-row compact-action-row">
                <button id="users-refresh-button" class="secondary-button" type="button">Actualizar</button>
                <button id="users-open-create-button" type="button">Nuevo usuario</button>
              </div>
            </div>

            <div class="root-form-grid root-form-grid--filters">
              <label>
                <span>Buscar</span>
                <input id="users-search-input" type="search" placeholder="Nombre, usuario o rol" />
              </label>
              <label>
                <span>Dashboard</span>
                <select id="users-dashboard-filter">
                  <option value="all">Todos</option>
                  <option value="/root/">Root / Admin</option>
                  <option value="/agent/">Agente</option>
                  <option value="/warehouse/">Bodega</option>
                  <option value="/no-access.html">Sin acceso</option>
                </select>
              </label>
            </div>

            <div id="users-list-region" class="commercial-list" aria-live="polite"></div>
          </article>

          <article class="card root-card commercial-detail-card">
            <div class="page-header">
              <div>
                <h3 id="users-detail-title">Selecciona un usuario</h3>
                <p class="muted">Consulta rol, permisos y acceso del usuario seleccionado.</p>
              </div>
            </div>
            <div id="users-detail-region" class="commercial-detail" aria-live="polite"></div>
          </article>
        </div>
      </section>

      <dialog id="users-create-dialog" class="modal-card">
        <form id="users-create-form" class="root-form" method="dialog" novalidate>
          <div class="page-header">
            <div>
              <h3>Nuevo usuario</h3>
              <p class="muted">Crea un usuario de empresa con un rol disponible.</p>
            </div>
            <button id="users-close-create-button" class="secondary-button" type="button">Cerrar</button>
          </div>
          <div id="users-create-message"></div>
          <fieldset class="root-form__section">
            <legend>Datos principales</legend>
            <div class="root-form-grid">
              <label class="root-form-grid__full"><span>Nombre completo *</span><input id="users-input-fullname" name="fullName" type="text" required minlength="2" maxlength="255" /></label>
              <label><span>Usuario *</span><input id="users-input-username" name="username" type="text" required minlength="3" maxlength="100" /></label>
              <label><span>Correo</span><input id="users-input-email" name="email" type="email" maxlength="255" /></label>
              <label><span>Telefono</span><input id="users-input-phone" name="phone" type="text" maxlength="50" /></label>
              <label><span>Contrasena *</span><input id="users-input-password" name="password" type="password" required minlength="8" maxlength="100" /></label>
              <label><span>Rol *</span><select id="users-role-select" name="roleId" required></select></label>
            </div>
          </fieldset>
          <div id="users-role-guidance" class="muted"></div>
          <div class="action-row">
            <button id="users-submit-create-button" type="submit">Crear usuario</button>
            <button id="users-cancel-create-button" class="secondary-button" type="button">Cancelar</button>
          </div>
        </form>
      </dialog>
    `.trim();
  }

  async function mount(container, session, helpers = {}) {
    const setShellStatus = helpers.setShellStatus || (() => {});

    container.innerHTML = render(session);

    // ── Referencias DOM ────────────────────────────────────────────────────────
    const pageMessage = container.querySelector('#users-page-message');
    const listRegion = container.querySelector('#users-list-region');
    const listSummary = container.querySelector('#users-list-summary');
    const detailRegion = container.querySelector('#users-detail-region');
    const detailTitle = container.querySelector('#users-detail-title');
    const searchInput = container.querySelector('#users-search-input');
    const dashboardFilter = container.querySelector('#users-dashboard-filter');
    const openCreateButton = container.querySelector('#users-open-create-button');
    const refreshButton = container.querySelector('#users-refresh-button');
    const dialog = container.querySelector('#users-create-dialog');
    const createForm = container.querySelector('#users-create-form');
    const closeCreateButton = container.querySelector('#users-close-create-button');
    const cancelCreateButton = container.querySelector('#users-cancel-create-button');
    const createMessage = container.querySelector('#users-create-message');
    const roleSelect = container.querySelector('#users-role-select');
    const roleGuidance = container.querySelector('#users-role-guidance');
    const submitButton = container.querySelector('#users-submit-create-button');
    const metricTotal = container.querySelector('#users-metric-total');
    const metricRoot = container.querySelector('#users-metric-root');
    const metricAgent = container.querySelector('#users-metric-agent');
    const metricWarehouse = container.querySelector('#users-metric-warehouse');

    if (!listRegion || !detailRegion || !searchInput || !dialog || !createForm || !roleSelect) {
      setShellStatus('Error al inicializar la vista de usuarios.', 'error');
      return;
    }

    // ── Estado local ───────────────────────────────────────────────────────────
    let usersResponse = [];
    let rolesResponse = [];
    let selectedUserId = null;
    let rolesLoadError = '';

    function composeRolesWithDashboard(roles) {
      return (roles || []).map((role) => ({
        ...role,
        dashboardDescriptor: usersHelpers.inferDashboard(role),
      }));
    }

    function renderRoleOptionsCurrentState() {
      const rolesWithDashboard = composeRolesWithDashboard(rolesResponse);
      roleSelect.innerHTML = usersRenderers.renderRoleOptions(rolesWithDashboard);
      openCreateButton.disabled = Boolean(rolesLoadError);
      roleGuidance.textContent = rolesLoadError
        ? `No se pudieron cargar los roles: ${rolesLoadError}`
        : '';
    }

    function renderCurrentState() {
      const composedUsers = usersHelpers.composeUsersDataset(usersResponse);
      const filteredUsers = usersHelpers.filterUsers(composedUsers, searchInput.value, dashboardFilter.value);
      const summary = usersHelpers.summarizeUsers(composedUsers);

      if (metricTotal) metricTotal.textContent = String(summary.total);
      if (metricRoot) metricRoot.textContent = String(summary.root);
      if (metricAgent) metricAgent.textContent = String(summary.agent);
      if (metricWarehouse) metricWarehouse.textContent = String(summary.warehouse);

      listSummary.textContent = filteredUsers.length === composedUsers.length
        ? `${composedUsers.length} usuario(s)`
        : `${filteredUsers.length} de ${composedUsers.length} usuario(s)`;

      if (!selectedUserId && composedUsers.length) {
        selectedUserId = composedUsers[0].id;
      }

      listRegion.innerHTML = usersRenderers.renderList(filteredUsers, selectedUserId);

      const selectedUser = composedUsers.find((u) => String(u.id) === String(selectedUserId))
        || composedUsers[0]
        || null;

      detailTitle.textContent = selectedUser?.fullName || 'Selecciona un usuario';
      detailRegion.innerHTML = usersRenderers.renderDetail(selectedUser);

      renderRoleOptionsCurrentState();
    }

    async function loadUsersAndRoles() {
      setShellStatus('Cargando usuarios...');
      rolesLoadError = '';

      const [usersResult, rolesResult] = await Promise.allSettled([
        usersApi.listCompanyUsers(session),
        usersApi.listCompanyRoles(session),
      ]);

      if (usersResult.status === 'rejected') {
        pageMessage.innerHTML = renderInlineMessage(
          usersResult.reason?.message || 'No se pudieron cargar los usuarios.',
          'error'
        );
        setShellStatus('Error al cargar usuarios.', 'error');
        return;
      }

      usersResponse = usersResult.value || [];

      if (rolesResult.status === 'rejected') {
        rolesLoadError = rolesResult.reason?.message || 'Error desconocido';
        pageMessage.innerHTML = renderInlineMessage(
          'Los roles no se pudieron cargar. La creacion de usuarios esta deshabilitada.',
          'error'
        );
      } else {
        rolesResponse = rolesResult.value || [];
        pageMessage.innerHTML = '';
      }

      renderCurrentState();
      setShellStatus('');
    }

    function closeDialog() {
      createForm.reset();
      createMessage.innerHTML = '';
      dialog.close();
    }

    // ── Event listeners ────────────────────────────────────────────────────────
    searchInput.addEventListener('input', () => renderCurrentState());
    dashboardFilter.addEventListener('change', () => renderCurrentState());

    listRegion.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-user-select]');
      if (!btn) return;
      selectedUserId = btn.getAttribute('data-user-select');
      renderCurrentState();
    });

    openCreateButton.addEventListener('click', () => {
      if (!openCreateButton.disabled) dialog.showModal();
    });

    closeCreateButton.addEventListener('click', () => closeDialog());
    cancelCreateButton.addEventListener('click', () => closeDialog());

    roleSelect.addEventListener('change', () => {
      const roleId = roleSelect.value;
      const selectedRole = (rolesResponse || []).find((r) => String(r.id) === String(roleId));
      const descriptor = selectedRole ? usersHelpers.inferDashboard(selectedRole) : null;
      roleGuidance.textContent = descriptor ? `Dashboard: ${descriptor.label}` : '';
    });

    refreshButton.addEventListener('click', () => loadUsersAndRoles());

    createForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (!createForm.reportValidity()) {
        createMessage.innerHTML = renderInlineMessage('Completá todos los campos requeridos.', 'error');
        return;
      }

      const formData = new FormData(createForm);
      const payload = {
        fullName: formData.get('fullName')?.toString().trim(),
        username: formData.get('username')?.toString().trim(),
        password: formData.get('password')?.toString(),
        email: formData.get('email')?.toString().trim() || undefined,
        phone: formData.get('phone')?.toString().trim() || undefined,
        roleId: formData.get('roleId') ? Number(formData.get('roleId')) : undefined,
      };

      submitButton.disabled = true;
      submitButton.textContent = 'Creando...';

      try {
        await usersApi.createCompanyUser(session, payload);
        closeDialog();
        await loadUsersAndRoles();
        pageMessage.innerHTML = renderInlineMessage('Usuario creado correctamente.');
      } catch (error) {
        createMessage.innerHTML = renderInlineMessage(buildErrorMessage(error), 'error');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Crear usuario';
      }
    });

    await loadUsersAndRoles();
  }

  rootShell.register('views.usersAdmin', { render, mount });
}(window));
