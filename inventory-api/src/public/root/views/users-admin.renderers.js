(function attachRootShellUsersAdminRenderers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const ui = rootShell.require('ui');

  function renderDashboardBadge(descriptor) {
    if (!descriptor) {
      return '<span class="root-badge badge-warning">Sin acceso</span>';
    }

    const path = descriptor.path;
    let cls = 'badge-warning';
    if (path === '/root/') cls = 'badge-success';
    else if (path === '/agent/') cls = 'badge-info';
    else if (path === '/warehouse/') cls = 'badge-purple';

    const noteHtml = descriptor.note
      ? ` <small>(${ui.escapeHtml(descriptor.note)})</small>`
      : '';

    return `<span class="root-badge ${cls}">${ui.escapeHtml(descriptor.label)}${noteHtml}</span>`;
  }

  function normalizeActiveStatus(user) {
    const s = user?.status;
    return s === 'ACTIVE' || s === 1 || s === '1' || s === true;
  }

  function renderList(composedUsers, selectedUserId) {
    if (!composedUsers || composedUsers.length === 0) {
      return '<p class="empty-state">No hay usuarios registrados.</p>';
    }

    return composedUsers.map((user) => {
      const isActive = normalizeActiveStatus(user);
      const isSelected = String(user.id) === String(selectedUserId);
      const statusBadge = ui.renderStatusBadge(isActive ? 'active' : 'inactive');
      const dashBadge = renderDashboardBadge(user.dashboardDescriptor);

      return `
        <button
          class="commercial-list-item${isSelected ? ' active' : ''}"
          type="button"
          data-user-select="${ui.escapeHtml(user.id)}"
        >
          <span class="commercial-list-item__title">${ui.escapeHtml(user.fullName || user.username)}</span>
          <span class="commercial-list-item__meta">${ui.escapeHtml(user.role?.name || user.role?.code || '—')}</span>
          <span class="commercial-list-item__badges">${statusBadge} ${dashBadge}</span>
        </button>
      `.trim();
    }).join('');
  }

  function renderDetail(composedUser) {
    if (!composedUser) {
      return '<p class="empty-state">Selecciona un usuario para ver sus detalles.</p>';
    }

    const isActive = normalizeActiveStatus(composedUser);
    const statusBadge = ui.renderStatusBadge(isActive ? 'active' : 'inactive');
    const dashBadge = renderDashboardBadge(composedUser.dashboardDescriptor);

    const rawPerms = (composedUser?.role?.permissions || composedUser?.role?.rolePermissions || [])
      .map((p) => p?.code || p?.permission?.code)
      .filter(Boolean);

    const permsHtml = rawPerms.length
      ? rawPerms.map((c) => `<li><code>${ui.escapeHtml(c)}</code></li>`).join('')
      : '<li class="muted">Sin permisos configurados.</li>';

    return `
      <section class="detail-section">
        <h3 class="detail-section__title">Identificacion</h3>
        <dl class="detail-dl">
          <dt>Nombre</dt><dd>${ui.escapeHtml(composedUser.fullName || '—')}</dd>
          <dt>Usuario</dt><dd>${ui.escapeHtml(composedUser.username || '—')}</dd>
          <dt>Email</dt><dd>${ui.escapeHtml(composedUser.email || '—')}</dd>
          <dt>Telefono</dt><dd>${ui.escapeHtml(composedUser.phone || '—')}</dd>
          <dt>Estado</dt><dd>${statusBadge}</dd>
        </dl>
      </section>
      <section class="detail-section">
        <h3 class="detail-section__title">Rol y acceso</h3>
        <dl class="detail-dl">
          <dt>Rol</dt><dd>${ui.escapeHtml(composedUser.role?.name || '—')}</dd>
          <dt>Codigo</dt><dd><code>${ui.escapeHtml(composedUser.role?.code || '—')}</code></dd>
          <dt>Dashboard</dt><dd>${dashBadge}</dd>
        </dl>
        <details class="detail-permissions">
          <summary>Permisos del rol (${rawPerms.length})</summary>
          <ul class="permissions-list">${permsHtml}</ul>
        </details>
      </section>
    `.trim();
  }

  function renderRoleOptions(rolesWithDashboard) {
    const filtered = (rolesWithDashboard || []).filter(
      (r) => r.code !== 'root' && r.isActive !== false
    );

    const groups = {};
    for (const role of filtered) {
      const label = role.dashboardDescriptor?.label || 'Sin acceso';
      if (!groups[label]) groups[label] = [];
      groups[label].push(role);
    }

    const optgroupsHtml = Object.entries(groups).map(([groupLabel, roles]) => {
      const optionsHtml = roles.map((r) =>
        `<option value="${ui.escapeHtml(r.id)}">${ui.escapeHtml(r.name || r.code)} — ${ui.escapeHtml(r.dashboardDescriptor?.label || '')}</option>`
      ).join('');
      return `<optgroup label="${ui.escapeHtml(groupLabel)}">${optionsHtml}</optgroup>`;
    }).join('');

    return `<option value="">Selecciona un rol</option>${optgroupsHtml}`;
  }

  rootShell.register('views.usersAdminRenderers', {
    renderDashboardBadge,
    renderDetail,
    renderList,
    renderRoleOptions,
  });
}(window));
