(function attachRootShellUi(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function renderInlineMessage(message, tone = 'default') {
    if (!message) {
      return '';
    }

    const className = tone === 'default' ? 'message' : `message ${tone}`;
    return `<p class="${className}" role="status">${escapeHtml(message)}</p>`;
  }

  function renderStatusBadge(isActive, activeLabel = 'Activa', inactiveLabel = 'Inactiva') {
    return isActive
      ? `<span class="badge badge-success">${escapeHtml(activeLabel)}</span>`
      : `<span class="badge badge-warning">${escapeHtml(inactiveLabel)}</span>`;
  }

  function formatDate(value) {
    if (!value) {
      return 'Sin fecha';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Sin fecha';
    }

    return date.toLocaleDateString('es-CR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  function groupPermissionsByModule(permissions) {
    return permissions.reduce((groups, permission) => {
      const moduleName = permission?.module || 'general';
      if (!groups[moduleName]) {
        groups[moduleName] = [];
      }

      groups[moduleName].push(permission);
      return groups;
    }, {});
  }

  rootShell.register('ui', {
    escapeHtml,
    formatDate,
    groupPermissionsByModule,
    renderInlineMessage,
    renderStatusBadge,
  });
}(window));
