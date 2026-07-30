(function attachRootShellRolesAdminView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const rolesApi = rootShell.require('rolesApi');
  const rootShellUi = rootShell.require('ui');

  function render(session) {
    const companyId = rootShellUi.escapeHtml(session?.user?.companyId || 'sin empresa');

    return `
      <section class="root-hero" aria-labelledby="root-view-title">
        <p class="eyebrow">Panel root</p>
        <h2 id="root-view-title">Roles y permisos</h2>
        <p class="muted">Crea roles para tu empresa y revisa los permisos disponibles para la empresa ${companyId}.</p>
      </section>

      <div class="root-admin-layout root-admin-layout--roles">
        <article class="card root-card root-admin-form-card">
          <div class="page-header">
            <div>
              <h3>Crear rol</h3>
              <p class="muted">Define el nombre del rol y selecciona solo los permisos que realmente necesita.</p>
            </div>
          </div>
          <div id="roles-form-message"></div>
          <form id="roles-create-form" class="root-form" novalidate>
            <fieldset class="root-form__section">
              <legend>Identidad del rol</legend>
              <div class="root-form-grid">
                <label class="root-form-grid__full"><span>Nombre del rol *</span><input name="name" type="text" required minlength="2" maxlength="255" /></label>
              </div>
            </fieldset>

            <fieldset class="root-form__section">
              <legend>Seleccion de permisos</legend>
              <label class="root-form-grid__full"><span>Buscar permiso</span><input id="roles-permission-search" type="search" placeholder="Filtrar por codigo, modulo o accion" /></label>
              <p id="roles-selection-count" class="muted">0 permisos seleccionados</p>
              <div id="roles-permissions-region" class="root-permission-groups"></div>
            </fieldset>

            <div class="action-row">
              <button id="roles-submit-button" type="submit">Crear rol</button>
              <button id="roles-clear-button" class="secondary-button" type="button">Limpiar seleccion</button>
            </div>
          </form>
        </article>

        <article class="card root-card root-admin-list-card">
          <div class="page-header">
            <div>
              <h3>Roles creados para la empresa</h3>
              <p class="muted">Este listado es informativo. No incluye acciones de edicion, eliminacion o reasignacion.</p>
            </div>
          </div>
          <div id="roles-list-message"></div>
          <div id="roles-list-region" class="role-list"></div>
        </article>
      </div>
    `;
  }

  function renderPermissions(permissions, selectedPermissionCodes = [], searchTerm = '') {
    const normalizedSearch = String(searchTerm || '').trim().toLowerCase();
    const filteredPermissions = permissions.filter((permission) => {
      if (!normalizedSearch) {
        return true;
      }

      return [permission.code, permission.module, permission.action]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    });

    if (!filteredPermissions.length) {
      return '<p class="empty-state">No hay permisos disponibles para asignar en este momento.</p>';
    }

    const groupedPermissions = rootShellUi.groupPermissionsByModule(filteredPermissions);
    return Object.entries(groupedPermissions).map(([moduleName, modulePermissions]) => `
      <section class="root-permission-group">
        <h4>${rootShellUi.escapeHtml(moduleName)}</h4>
        <div class="permissions-grid">
          ${modulePermissions.map((permission) => `
            <label class="permission-option">
              <input type="checkbox" name="permissionCodes" value="${rootShellUi.escapeHtml(permission.code)}" ${selectedPermissionCodes.includes(permission.code) ? 'checked' : ''} />
              <span>
                <strong>${rootShellUi.escapeHtml(permission.code)}</strong>
                <small>Modulo: ${rootShellUi.escapeHtml(permission.module || 'general')} · Accion: ${rootShellUi.escapeHtml(permission.action || 'sin accion')}</small>
              </span>
            </label>
          `).join('')}
        </div>
      </section>
    `).join('');
  }

  function renderRoles(roles) {
    const roleItems = Array.isArray(roles?.items) ? roles.items : roles;
    if (!Array.isArray(roleItems) || !roleItems.length) {
      return '<p class="empty-state">Aun no hay roles personalizados para esta empresa.</p>';
    }

    return roleItems.map((role) => `
      <article class="role-card">
        <div class="page-header">
          <div>
            <h3>${rootShellUi.escapeHtml(role.name)}</h3>
            <p class="muted">${rootShellUi.escapeHtml(role.code)}</p>
          </div>
          <div class="status-stack">
            ${rootShellUi.renderStatusBadge(Boolean(role.isActive), 'Activo', 'Inactivo')}
            <span class="badge">${role.companyId ? 'Empresa' : 'Global'}</span>
          </div>
        </div>
        <p class="muted">${rootShellUi.escapeHtml(String(role.permissions?.length || 0))} permisos asignados</p>
        <div class="permission-tags">
          ${(role.permissions || []).slice(0, 8).map((permission) => `<span>${rootShellUi.escapeHtml(permission.code)}</span>`).join('') || '<span>Sin permisos visibles</span>'}
        </div>
      </article>
    `).join('');
  }

  async function mount(container, session, helpers = {}) {
    const setShellStatus = typeof helpers.setShellStatus === 'function' ? helpers.setShellStatus : () => {};
    const form = /** @type {HTMLFormElement | null} */ (container.querySelector('#roles-create-form'));
    const formMessage = /** @type {HTMLElement | null} */ (container.querySelector('#roles-form-message'));
    const permissionsRegion = /** @type {HTMLElement | null} */ (container.querySelector('#roles-permissions-region'));
    const searchInput = /** @type {HTMLInputElement | null} */ (container.querySelector('#roles-permission-search'));
    const selectionCount = /** @type {HTMLElement | null} */ (container.querySelector('#roles-selection-count'));
    const rolesListRegion = /** @type {HTMLElement | null} */ (container.querySelector('#roles-list-region'));
    const rolesListMessage = /** @type {HTMLElement | null} */ (container.querySelector('#roles-list-message'));
    const submitButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#roles-submit-button'));
    const clearButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#roles-clear-button'));

    if (!form || !formMessage || !permissionsRegion || !searchInput || !selectionCount || !rolesListRegion || !rolesListMessage || !submitButton || !clearButton) {
      return;
    }

    let availablePermissions = [];
    let availableRoles = [];

    function getSelectedPermissionCodes() {
      return Array.from(
        /** @type {NodeListOf<HTMLInputElement>} */ (form.querySelectorAll('input[name="permissionCodes"]:checked')),
      ).map((input) => input.value);
    }

    function updateSelectionCount() {
      selectionCount.textContent = `${getSelectedPermissionCodes().length} permisos seleccionados`;
    }

    function renderPermissionsRegion() {
      permissionsRegion.innerHTML = renderPermissions(availablePermissions, getSelectedPermissionCodes(), searchInput.value);
      updateSelectionCount();
    }

    async function refreshData() {
      setShellStatus('Cargando roles y permisos...');
      rolesListMessage.innerHTML = '';
      rolesListRegion.innerHTML = '<p class="empty-state">Cargando roles...</p>';
      permissionsRegion.innerHTML = '<p class="empty-state">Cargando permisos...</p>';

      try {
        const [permissions, roles] = await Promise.all([
          rolesApi.listPermissions(session),
          rolesApi.listRoles(session),
        ]);

        availablePermissions = Array.isArray(permissions) ? permissions : [];
        availableRoles = Array.isArray(roles?.items) ? roles.items : roles;
        renderPermissionsRegion();
        rolesListRegion.innerHTML = renderRoles(availableRoles);
        setShellStatus('Sesion lista.');
      } catch (error) {
        permissionsRegion.innerHTML = '<p class="empty-state">No se pudieron cargar los permisos.</p>';
        rolesListRegion.innerHTML = '<p class="empty-state">No se pudieron cargar los roles.</p>';
        rolesListMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo cargar la informacion. Intenta nuevamente.', 'error');
        setShellStatus('No se pudo cargar la vista de roles y permisos.', 'error');
      }
    }

    form.addEventListener('change', (event) => {
      const target = event.target;
      if (target instanceof window.HTMLInputElement && target.name === 'permissionCodes') {
        updateSelectionCount();
      }
    });

    searchInput.addEventListener('input', () => {
      renderPermissionsRegion();
    });

    clearButton.addEventListener('click', () => {
      for (const checkbox of Array.from(
        /** @type {NodeListOf<HTMLInputElement>} */ (form.querySelectorAll('input[name="permissionCodes"]')),
      )) {
        checkbox.checked = false;
      }
      updateSelectionCount();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      formMessage.innerHTML = '';

      const selectedPermissionCodes = getSelectedPermissionCodes();
      if (!form.reportValidity()) {
        formMessage.innerHTML = rootShellUi.renderInlineMessage('Revisa los campos obligatorios antes de continuar.', 'error');
        return;
      }

      if (!selectedPermissionCodes.length) {
        formMessage.innerHTML = rootShellUi.renderInlineMessage('Selecciona al menos un permiso.', 'error');
        return;
      }

      submitButton.disabled = true;
      clearButton.disabled = true;
      submitButton.textContent = 'Creando rol...';
      setShellStatus('Creando rol...');

      try {
        await rolesApi.createRole(session, {
          name: String(new FormData(form).get('name') || '').trim(),
          permissionCodes: selectedPermissionCodes,
        });
        form.reset();
        renderPermissionsRegion();
        formMessage.innerHTML = rootShellUi.renderInlineMessage('Rol creado correctamente.');
        setShellStatus('Rol creado correctamente.');
        await refreshData();
      } catch (error) {
        formMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo crear el rol. Revisa el nombre y los permisos seleccionados.', 'error');
        setShellStatus('No se pudo crear el rol.', 'error');
      } finally {
        submitButton.disabled = false;
        clearButton.disabled = false;
        submitButton.textContent = 'Crear rol';
      }
    });

    await refreshData();
  }

  rootShell.register('views.rolesAdmin', {
    mount,
    render,
  });
}(window));
