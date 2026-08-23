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

  var CATEGORY_LABELS = {
    landing: 'Acceso principal',
    platform: 'Plataforma',
    administration: 'Administracion',
    clients: 'Clientes',
    products: 'Articulos',
    inventory: 'Inventario',
    sales: 'Ventas y comercial',
    collections: 'Cobranza',
    warehouse: 'Bodega',
    supply: 'Abastecimiento',
    procurement: 'Compras',
    production: 'Produccion',
    quality: 'Calidad (QA)',
    'billing-boundary': 'Facturacion',
  };

  var CATEGORY_ORDER = [
    'landing',
    'administration', 'clients', 'products', 'inventory', 'warehouse',
    'sales', 'collections', 'supply', 'procurement', 'production',
    'quality', 'billing-boundary', 'platform',
  ];

  function getCategoryDisplayLabel(categoryKey) {
    return CATEGORY_LABELS[categoryKey] || categoryKey || 'General';
  }

  function groupPermissionsByCategory(permissions) {
    var groups = {};
    for (var i = 0; i < permissions.length; i++) {
      var key = permissions[i]?.moduleCategory || permissions[i]?.module || 'general';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(permissions[i]);
    }
    return groups;
  }

  function sortedCategoryEntries(groups) {
    var entries = Object.entries(groups);
    entries.sort(function (a, b) {
      var ai = CATEGORY_ORDER.indexOf(a[0]);
      var bi = CATEGORY_ORDER.indexOf(b[0]);
      if (ai === -1) { ai = 999; }
      if (bi === -1) { bi = 999; }
      return ai - bi;
    });
    return entries;
  }

  rootShell.register('ui', {
    escapeHtml,
    formatDate,
    getCategoryDisplayLabel,
    groupPermissionsByCategory,
    groupPermissionsByModule,
    renderInlineMessage,
    renderStatusBadge,
    sortedCategoryEntries,
    CATEGORY_LABELS,
  });
}(window));
