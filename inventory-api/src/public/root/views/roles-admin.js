(function attachRootShellRolesAdminView(globalScope) {
  var rootShell = /** @type {any} */ (globalScope).RootShell;
  var rolesApi = rootShell.require('rolesApi');
  var rootShellUi = rootShell.require('ui');

  var SELF_LOCKOUT_CODES = ['settings.manage', 'users.manage'];

  function render(session) {
    var companyId = rootShellUi.escapeHtml(session?.user?.companyId || 'sin empresa');

    return '\
      <section class="root-hero" aria-labelledby="root-view-title">\
        <p class="eyebrow">Panel root</p>\
        <h2 id="root-view-title">Roles y permisos</h2>\
        <p class="muted">Crea y administra los roles de tu empresa ' + companyId + '. Los permisos se agrupan por area funcional.</p>\
      </section>\
      <div class="root-admin-layout root-admin-layout--roles">\
        <article class="card root-card root-admin-form-card">\
          <div id="roles-edit-banner" class="edit-banner" role="status" style="display:none;"></div>\
          <div class="page-header">\
            <div>\
              <h3 id="roles-form-title">Crear rol</h3>\
              <p id="roles-form-subtitle" class="muted">Define el nombre del rol y selecciona solo los permisos que realmente necesita.</p>\
            </div>\
          </div>\
          <div id="roles-form-message"></div>\
          <form id="roles-create-form" class="root-form" novalidate>\
            <fieldset class="root-form__section">\
              <legend>Identidad del rol</legend>\
              <div class="root-form-grid">\
                <label class="root-form-grid__full"><span>Nombre del rol *</span><input name="name" type="text" required minlength="2" maxlength="255" /></label>\
              </div>\
            </fieldset>\
            <fieldset class="root-form__section">\
              <legend>Acceso principal / landing</legend>\
              <p class="muted">Selecciona el acceso principal del rol. Determina a cual panel seran redirigidos los usuarios al iniciar sesion. Solo se puede seleccionar uno.</p>\
              <div id="roles-landing-region" class="root-landing-group"></div>\
            </fieldset>\
            <fieldset class="root-form__section">\
              <legend>Seleccion de permisos operativos</legend>\
              <label class="root-form-grid__full"><span>Buscar permiso</span><input id="roles-permission-search" type="search" placeholder="Buscar por nombre, descripcion o codigo" /></label>\
              <p id="roles-selection-count" class="muted" aria-live="polite">0 permisos seleccionados</p>\
              <div id="roles-permissions-region" class="root-permission-groups"></div>\
            </fieldset>\
            <div class="action-row">\
              <button id="roles-submit-button" type="submit">Crear rol</button>\
              <button id="roles-clear-button" class="secondary-button" type="button">Limpiar seleccion</button>\
            </div>\
          </form>\
        </article>\
        <article class="card root-card root-admin-list-card">\
          <div class="page-header">\
            <div>\
              <h3>Roles de la empresa</h3>\
              <p class="muted">Selecciona un rol de empresa para editarlo.</p>\
            </div>\
          </div>\
          <div id="roles-list-message"></div>\
          <div id="roles-list-region" class="role-list"></div>\
        </article>\
      </div>\
      <div id="roles-confirm-modal" class="modal-backdrop hidden" role="dialog" aria-modal="true">\
        <div class="modal-card" style="max-width:480px;">\
          <div class="confirm-modal__icon">&#9888;&#65039;</div>\
          <h3 class="confirm-modal__title">Permisos sensibles</h3>\
          <p class="muted">Estas a punto de guardar un rol con permisos sensibles que otorgan capacidades administrativas.</p>\
          <ul id="roles-confirm-list" class="confirm-modal__list"></ul>\
          <div class="confirm-modal__actions">\
            <button id="roles-confirm-yes" type="button">Confirmar y guardar</button>\
            <button id="roles-confirm-no" class="secondary-button" type="button">Volver a revisar</button>\
          </div>\
        </div>\
      </div>';
  }

  function renderPermissionItem(permission, isChecked, isLockout, isPlatform) {
    var classes = 'permission-option';
    if (isPlatform) {
      classes += ' permission-option--platform';
    } else if (isLockout) {
      classes += ' permission-option--lockout';
    } else if (permission.sensitivity === 'sensitive') {
      classes += ' permission-option--sensitive';
    }

    var disabled = isPlatform || isLockout ? ' disabled' : '';
    var checked = isChecked ? ' checked' : '';
    var label = permission.displayLabel || permission.code;
    var desc = permission.businessDescription || permission.description || '';
    var code = permission.code;

    var badgesHtml = '';
    if (isPlatform) {
      badgesHtml = '<span class="badge">Solo plataforma</span>';
    } else if (permission.sensitivity === 'sensitive') {
      badgesHtml = '<span class="badge badge-warning">Sensible</span>';
    }

    var lockoutHint = '';
    if (isLockout) {
      lockoutHint = '<small class="permission-option__lockout-hint">No puedes desactivar este permiso en tu propio rol activo.</small>';
    }

    return '<label class="' + classes + '">' +
      '<input type="checkbox" name="permissionCodes" value="' + rootShellUi.escapeHtml(code) + '"' + checked + disabled + ' />' +
      '<span>' +
        '<strong class="permission-option__label">' + rootShellUi.escapeHtml(label) + '</strong>' +
        (desc ? '<small class="permission-option__desc">' + rootShellUi.escapeHtml(desc) + '</small>' : '') +
        '<small class="permission-option__code">' + rootShellUi.escapeHtml(code) + '</small>' +
        badgesHtml +
        lockoutHint +
      '</span>' +
    '</label>';
  }

  var LANDING_SHELL_LABELS = {
    'root.access': 'Panel administrativo (/root/)',
    'warehouse.access': 'Espacio operativo de bodega (/warehouse/)',
    'agent.access': 'Espacio de agente comercial (/agent/)',
  };

  function renderLandingSection(permissions, selectedLandingCode) {
    var landingPerms = permissions.filter(function (p) {
      return p.permissionKind === 'landing';
    });

    if (!landingPerms.length) {
      return '<p class="empty-state">No hay permisos de acceso principal disponibles.</p>';
    }

    return landingPerms.map(function (p) {
      var isChecked = p.code === selectedLandingCode;
      var label = p.displayLabel || p.code;
      var shellLabel = LANDING_SHELL_LABELS[p.code] || '';

      return '<label class="permission-option permission-option--landing">' +
        '<input type="radio" name="landingPermission" value="' + rootShellUi.escapeHtml(p.code) + '"' + (isChecked ? ' checked' : '') + ' />' +
        '<span>' +
          '<strong class="permission-option__label">' + rootShellUi.escapeHtml(label) + '</strong>' +
          (shellLabel ? '<small class="permission-option__desc">' + rootShellUi.escapeHtml(shellLabel) + '</small>' : '') +
          '<small class="permission-option__code">' + rootShellUi.escapeHtml(p.code) + '</small>' +
        '</span>' +
      '</label>';
    }).join('');
  }

  function renderPermissions(permissions, selectedCodes, searchTerm, editingOwnRole) {
    var normalizedSearch = String(searchTerm || '').trim().toLowerCase();
    // Exclude landing permissions from the operational grid — they have their own section
    var nonLanding = permissions.filter(function (p) { return p.permissionKind !== 'landing'; });
    var filtered = nonLanding.filter(function (p) {
      if (!normalizedSearch) { return true; }
      return [p.displayLabel, p.businessDescription, p.moduleCategory, p.code, p.module, p.action]
        .filter(Boolean)
        .some(function (v) { return String(v).toLowerCase().includes(normalizedSearch); });
    });

    if (!filtered.length) {
      return '<p class="empty-state">No se encontraron permisos con ese criterio.</p>';
    }

    var grouped = rootShellUi.groupPermissionsByCategory(filtered);
    var sorted = rootShellUi.sortedCategoryEntries(grouped);

    return sorted.map(function (entry) {
      var catKey = entry[0];
      var catPerms = entry[1];
      var catLabel = rootShellUi.getCategoryDisplayLabel(catKey);
      var isPlatformCat = catKey === 'platform';
      var selectedInCat = catPerms.filter(function (p) { return selectedCodes.includes(p.code); }).length;

      var catClass = 'permission-category' + (isPlatformCat ? ' permission-category--platform' : '');
      var expanded = !isPlatformCat;

      var permItemsHtml = catPerms.map(function (p) {
        var isPlatform = p.scope === 'platform';
        var isLockout = editingOwnRole && SELF_LOCKOUT_CODES.includes(p.code) && selectedCodes.includes(p.code);
        var isChecked = selectedCodes.includes(p.code);
        return renderPermissionItem(p, isChecked, isLockout, isPlatform);
      }).join('');

      return '<section class="' + catClass + '">' +
        '<button class="permission-category__header" type="button" aria-expanded="' + expanded + '">' +
          '<span><span class="permission-category__toggle" aria-hidden="true">' + (expanded ? '\u25BC' : '\u25B6') + '</span>' + rootShellUi.escapeHtml(catLabel) + '</span>' +
          '<span class="permission-category__count">' + selectedInCat + '/' + catPerms.length + '</span>' +
        '</button>' +
        '<div class="permission-category__body"' + (expanded ? '' : ' hidden') + '>' +
          '<div class="permissions-grid">' + permItemsHtml + '</div>' +
        '</div>' +
      '</section>';
    }).join('');
  }

  function renderRoles(roles, editingRoleId) {
    var roleItems = Array.isArray(roles?.items) ? roles.items : roles;
    if (!Array.isArray(roleItems) || !roleItems.length) {
      return '<p class="empty-state">Aun no hay roles para esta empresa.</p>';
    }

    return roleItems.map(function (role) {
      var isGlobal = !role.companyId;
      var isEditing = editingRoleId && role.id && role.id.toString() === editingRoleId.toString();
      var cardClass = 'role-card';
      if (isGlobal) { cardClass += ' role-card--readonly'; }
      if (isEditing) { cardClass += ' role-card--editing'; }

      var landingBadge = '';
      if (role.landingPermission) {
        var shellName = LANDING_SHELL_LABELS[role.landingPermission.code] || role.landingPermission.displayLabel || role.landingPermission.code;
        landingBadge = '<span class="badge badge-info">' + rootShellUi.escapeHtml(shellName) + '</span>';
      }

      var operationalPerms = (role.operationalPermissions || role.permissions || []);
      var permTags = operationalPerms.slice(0, 6).map(function (p) {
        var label = p.displayLabel || p.code;
        return '<span>' + rootShellUi.escapeHtml(label) + '</span>';
      }).join('');
      var extraCount = operationalPerms.length - 6;
      if (extraCount > 0) {
        permTags += '<span>+' + extraCount + ' mas</span>';
      }

      var actionsHtml = '';
      if (!isGlobal) {
        actionsHtml = '<div class="role-card__actions">' +
          '<button class="secondary-button roles-edit-btn" data-role-id="' + rootShellUi.escapeHtml(String(role.id)) + '" aria-label="Editar rol ' + rootShellUi.escapeHtml(role.name) + '">Editar</button>' +
        '</div>';
      } else {
        actionsHtml = '<p class="muted" style="font-size:0.85rem;">Los roles globales no pueden editarse desde este panel.</p>';
      }

      return '<article class="' + cardClass + '">' +
        '<div class="page-header">' +
          '<div><h3>' + rootShellUi.escapeHtml(role.name) + '</h3><p class="muted">' + rootShellUi.escapeHtml(role.code) + '</p></div>' +
          '<div class="status-stack">' +
            rootShellUi.renderStatusBadge(Boolean(role.isActive), 'Activo', 'Inactivo') +
            '<span class="badge">' + (isGlobal ? 'Global' : 'Empresa') + '</span>' +
            (isGlobal ? '<span class="badge badge-info">Solo lectura</span>' : '') +
          '</div>' +
        '</div>' +
        (landingBadge ? '<p class="muted">Acceso principal: ' + landingBadge + '</p>' : '') +
        '<p class="muted">' + rootShellUi.escapeHtml(String(operationalPerms.length || 0)) + ' permisos operativos</p>' +
        '<div class="permission-tags">' + (permTags || '<span>Sin permisos</span>') + '</div>' +
        actionsHtml +
      '</article>';
    }).join('');
  }

  async function mount(container, session, helpers) {
    helpers = helpers || {};
    var setShellStatus = typeof helpers.setShellStatus === 'function' ? helpers.setShellStatus : function () {};
    var form = container.querySelector('#roles-create-form');
    var formMessage = container.querySelector('#roles-form-message');
    var formTitle = container.querySelector('#roles-form-title');
    var formSubtitle = container.querySelector('#roles-form-subtitle');
    var editBanner = container.querySelector('#roles-edit-banner');
    var landingRegion = container.querySelector('#roles-landing-region');
    var permissionsRegion = container.querySelector('#roles-permissions-region');
    var searchInput = container.querySelector('#roles-permission-search');
    var selectionCount = container.querySelector('#roles-selection-count');
    var rolesListRegion = container.querySelector('#roles-list-region');
    var rolesListMessage = container.querySelector('#roles-list-message');
    var submitButton = container.querySelector('#roles-submit-button');
    var clearButton = container.querySelector('#roles-clear-button');
    var confirmModal = container.querySelector('#roles-confirm-modal');
    var confirmList = container.querySelector('#roles-confirm-list');
    var confirmYes = container.querySelector('#roles-confirm-yes');
    var confirmNo = container.querySelector('#roles-confirm-no');

    if (!form || !formMessage || !landingRegion || !permissionsRegion || !searchInput || !selectionCount || !rolesListRegion || !rolesListMessage || !submitButton || !clearButton) {
      return;
    }

    var availablePermissions = [];
    var availableRoles = [];
    var editingRoleId = null;
    var currentUserRoleId = session?.user?.roleId ? String(session.user.roleId) : null;
    var confirmResolve = null;
    /** @type {string|null} Selected landing permission code */
    var _selectedLandingCode = null;
    /** @type {Set<string>} Source of truth for selected operational permission codes — survives search re-renders. */
    var _selectedPermissionCodes = new Set();

    function isEditingOwnRole() {
      return editingRoleId && currentUserRoleId && editingRoleId.toString() === currentUserRoleId.toString();
    }

    function getSelectedPermissionCodes() {
      return Array.from(_selectedPermissionCodes);
    }

    function getAllSelectedPermissionCodes() {
      var codes = getSelectedPermissionCodes();
      if (_selectedLandingCode) {
        codes.unshift(_selectedLandingCode);
      }
      return codes;
    }

    function updateSelectionCount() {
      selectionCount.textContent = _selectedPermissionCodes.size + ' permisos seleccionados';
    }

    function renderLandingRegion() {
      landingRegion.innerHTML = renderLandingSection(availablePermissions, _selectedLandingCode);
    }

    function renderPermissionsRegion() {
      renderLandingRegion();
      permissionsRegion.innerHTML = renderPermissions(availablePermissions, getSelectedPermissionCodes(), searchInput.value, isEditingOwnRole());
      attachCategoryToggles();
      updateSelectionCount();
    }

    function attachCategoryToggles() {
      var headers = permissionsRegion.querySelectorAll('.permission-category__header');
      headers.forEach(function (header) {
        header.addEventListener('click', function () {
          var body = header.nextElementSibling;
          var expanded = header.getAttribute('aria-expanded') === 'true';
          header.setAttribute('aria-expanded', String(!expanded));
          var toggle = header.querySelector('.permission-category__toggle');
          if (toggle) { toggle.textContent = expanded ? '\u25B6' : '\u25BC'; }
          if (body) {
            if (expanded) { body.setAttribute('hidden', ''); } else { body.removeAttribute('hidden'); }
          }
        });
      });
    }

    function enterEditMode(role) {
      editingRoleId = role.id;
      formTitle.textContent = 'Editando: ' + role.name;
      formSubtitle.textContent = 'Los cambios se aplicaran a todos los usuarios con este rol.';
      editBanner.innerHTML = '<p><strong>Editando: ' + rootShellUi.escapeHtml(role.name) + '</strong><br />Los cambios se aplicaran a todos los usuarios que tengan este rol asignado.</p>';
      editBanner.style.display = '';
      submitButton.textContent = 'Guardar cambios';
      clearButton.textContent = 'Cancelar edicion';
      var nameInput = form.querySelector('input[name="name"]');
      if (nameInput) { nameInput.value = role.name || ''; }
      formMessage.innerHTML = '';

      // Separate landing from operational codes
      _selectedLandingCode = role.landingPermission ? role.landingPermission.code : null;
      var opCodes = (role.operationalPermissions || role.permissions || []).map(function (p) { return p.code; });
      _selectedPermissionCodes = new Set(opCodes);

      renderPermissionsRegion();
      rolesListRegion.innerHTML = renderRoles(availableRoles, editingRoleId);
      attachEditButtons();
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function exitEditMode() {
      editingRoleId = null;
      formTitle.textContent = 'Crear rol';
      formSubtitle.textContent = 'Define el nombre del rol y selecciona solo los permisos que realmente necesita.';
      editBanner.style.display = 'none';
      submitButton.textContent = 'Crear rol';
      clearButton.textContent = 'Limpiar seleccion';
      form.reset();
      formMessage.innerHTML = '';
      _selectedLandingCode = null;
      _selectedPermissionCodes = new Set();
      renderPermissionsRegion();
      rolesListRegion.innerHTML = renderRoles(availableRoles, null);
      attachEditButtons();
    }

    function attachEditButtons() {
      var btns = rolesListRegion.querySelectorAll('.roles-edit-btn');
      btns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var roleId = btn.getAttribute('data-role-id');
          var roleItems = /** @type {Array<any>} */ (Array.isArray(/** @type {any} */ (availableRoles)?.items) ? /** @type {any} */ (availableRoles).items : availableRoles);
          var role = roleItems.find(function (r) { return String(r.id) === String(roleId); });
          if (role) { enterEditMode(role); }
        });
      });
    }

    function showConfirmModal(sensitivePermissions) {
      if (!confirmModal || !confirmList) {
        return Promise.resolve(true);
      }
      confirmList.innerHTML = sensitivePermissions.map(function (p) {
        return '<li>' + rootShellUi.escapeHtml(p.displayLabel || p.code) + ' (' + rootShellUi.escapeHtml(p.code) + ')</li>';
      }).join('');
      confirmModal.classList.remove('hidden');
      return new Promise(function (resolve) {
        confirmResolve = resolve;
      });
    }

    function hideConfirmModal() {
      if (confirmModal) { confirmModal.classList.add('hidden'); }
      confirmResolve = null;
    }

    if (confirmYes) {
      confirmYes.addEventListener('click', function () {
        if (confirmResolve) { confirmResolve(true); }
        hideConfirmModal();
      });
    }
    if (confirmNo) {
      confirmNo.addEventListener('click', function () {
        if (confirmResolve) { confirmResolve(false); }
        hideConfirmModal();
      });
    }

    async function refreshData() {
      setShellStatus('Cargando roles y permisos...');
      rolesListMessage.innerHTML = '';
      rolesListRegion.innerHTML = '<p class="empty-state">Cargando roles...</p>';
      permissionsRegion.innerHTML = '<p class="empty-state">Cargando permisos...</p>';

      try {
        var results = await Promise.all([
          rolesApi.listPermissions(session),
          rolesApi.listRoles(session),
        ]);

        availablePermissions = Array.isArray(results[0]) ? results[0] : [];
        availableRoles = Array.isArray(results[1]?.items) ? results[1].items : results[1];
        renderPermissionsRegion();
        rolesListRegion.innerHTML = renderRoles(availableRoles, editingRoleId);
        attachEditButtons();
        setShellStatus('Sesion lista.');
      } catch (error) {
        permissionsRegion.innerHTML = '<p class="empty-state">No se pudieron cargar los permisos.</p>';
        rolesListRegion.innerHTML = '<p class="empty-state">No se pudieron cargar los roles.</p>';
        rolesListMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo cargar la informacion.', 'error');
        setShellStatus('No se pudo cargar la vista de roles y permisos.', 'error');
      }
    }

    form.addEventListener('change', function (event) {
      if (event.target instanceof globalScope.HTMLInputElement && event.target.name === 'landingPermission') {
        _selectedLandingCode = event.target.value || null;
      }
      if (event.target instanceof globalScope.HTMLInputElement && event.target.name === 'permissionCodes') {
        if (event.target.checked) {
          _selectedPermissionCodes.add(event.target.value);
        } else {
          _selectedPermissionCodes.delete(event.target.value);
        }
        updateSelectionCount();
      }
    });

    searchInput.addEventListener('input', function () {
      renderPermissionsRegion();
    });

    clearButton.addEventListener('click', function () {
      if (editingRoleId) {
        exitEditMode();
        return;
      }
      _selectedLandingCode = null;
      _selectedPermissionCodes = new Set();
      renderPermissionsRegion();
    });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      formMessage.innerHTML = '';

      if (!form.reportValidity()) {
        formMessage.innerHTML = rootShellUi.renderInlineMessage('Revisa los campos obligatorios antes de continuar.', 'error');
        return;
      }

      if (!_selectedLandingCode) {
        formMessage.innerHTML = rootShellUi.renderInlineMessage('Selecciona un acceso principal (landing) para el rol.', 'error');
        return;
      }

      var selectedCodes = getAllSelectedPermissionCodes();
      if (selectedCodes.length < 1) {
        formMessage.innerHTML = rootShellUi.renderInlineMessage('Selecciona al menos un permiso.', 'error');
        return;
      }

      var sensitiveSelected = availablePermissions.filter(function (p) {
        return selectedCodes.includes(p.code) && p.sensitivity === 'sensitive';
      });

      if (sensitiveSelected.length > 0) {
        var confirmed = await showConfirmModal(sensitiveSelected);
        if (!confirmed) { return; }
      }

      submitButton.disabled = true;
      clearButton.disabled = true;
      var originalButtonText = submitButton.textContent;
      submitButton.textContent = editingRoleId ? 'Guardando cambios...' : 'Creando rol...';
      setShellStatus(editingRoleId ? 'Guardando cambios...' : 'Creando rol...');

      try {
        var payload = {
          name: String(new FormData(form).get('name') || '').trim(),
          permissionCodes: selectedCodes,
        };

        if (editingRoleId) {
          await rolesApi.updateRole(session, editingRoleId, payload);
          formMessage.innerHTML = rootShellUi.renderInlineMessage('Rol actualizado correctamente.');
          setShellStatus('Rol actualizado correctamente.');
          exitEditMode();
        } else {
          await rolesApi.createRole(session, payload);
          form.reset();
          formMessage.innerHTML = rootShellUi.renderInlineMessage('Rol creado correctamente.');
          setShellStatus('Rol creado correctamente.');
        }
        await refreshData();
      } catch (error) {
        formMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudieron guardar los cambios.', 'error');
        setShellStatus('No se pudieron guardar los cambios.', 'error');
      } finally {
        submitButton.disabled = false;
        clearButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
    });

    await refreshData();
  }

  rootShell.register('views.rolesAdmin', {
    mount,
    render,
  });
}(window));
