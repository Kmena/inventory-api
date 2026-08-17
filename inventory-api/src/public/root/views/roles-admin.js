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
              <legend>Seleccion de permisos</legend>\
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

  function renderPermissions(permissions, selectedCodes, searchTerm, editingOwnRole) {
    var normalizedSearch = String(searchTerm || '').trim().toLowerCase();
    var filtered = permissions.filter(function (p) {
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

      var permTags = (role.permissions || []).slice(0, 6).map(function (p) {
        var label = p.displayLabel || p.code;
        return '<span>' + rootShellUi.escapeHtml(label) + '</span>';
      }).join('');
      var extraCount = (role.permissions || []).length - 6;
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
        '<p class="muted">' + rootShellUi.escapeHtml(String(role.permissions?.length || 0)) + ' permisos asignados</p>' +
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

    if (!form || !formMessage || !permissionsRegion || !searchInput || !selectionCount || !rolesListRegion || !rolesListMessage || !submitButton || !clearButton) {
      return;
    }

    var availablePermissions = [];
    var availableRoles = [];
    var editingRoleId = null;
    var currentUserRoleId = session?.user?.roleId ? String(session.user.roleId) : null;
    var confirmResolve = null;

    function isEditingOwnRole() {
      return editingRoleId && currentUserRoleId && editingRoleId.toString() === currentUserRoleId.toString();
    }

    function getSelectedPermissionCodes() {
      var checked = Array.from(form.querySelectorAll('input[name="permissionCodes"]:checked'));
      var disabled = Array.from(form.querySelectorAll('input[name="permissionCodes"]:disabled:checked'));
      var allChecked = new Set(checked.map(function (i) { return i.value; }));
      disabled.forEach(function (i) { allChecked.add(i.value); });
      return Array.from(allChecked);
    }

    function updateSelectionCount() {
      selectionCount.textContent = getSelectedPermissionCodes().length + ' permisos seleccionados';
    }

    function renderPermissionsRegion() {
      var selected = getSelectedPermissionCodes();
      permissionsRegion.innerHTML = renderPermissions(availablePermissions, selected, searchInput.value, isEditingOwnRole());
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

      var roleCodes = (role.permissions || []).map(function (p) { return p.code; });
      var allCheckboxes = form.querySelectorAll('input[name="permissionCodes"]');
      allCheckboxes.forEach(function (cb) {
        cb.checked = roleCodes.includes(cb.value);
        cb.disabled = false;
      });

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
      if (event.target instanceof globalScope.HTMLInputElement && event.target.name === 'permissionCodes') {
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
      var checkboxes = form.querySelectorAll('input[name="permissionCodes"]');
      checkboxes.forEach(function (cb) { cb.checked = false; });
      updateSelectionCount();
    });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      formMessage.innerHTML = '';

      var selectedCodes = getSelectedPermissionCodes();
      if (!form.reportValidity()) {
        formMessage.innerHTML = rootShellUi.renderInlineMessage('Revisa los campos obligatorios antes de continuar.', 'error');
        return;
      }

      if (!selectedCodes.length) {
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
