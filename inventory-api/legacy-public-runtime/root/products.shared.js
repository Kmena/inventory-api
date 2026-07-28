(function attachRootProductsShared(global) {
  const inventoryAuth = global.InventoryAuth;
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function number(value) {
    const result = Number(value ?? 0);
    return Number.isFinite(result) ? result : 0;
  }

  function formatQuantity(value) {
    return new Intl.NumberFormat('es-GT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(number(value));
  }

  function formatMoney(value, currency = 'CRC') {
    if (value === null || value === undefined || value === '') return '—';
    return new Intl.NumberFormat('es-GT', {
      style: 'currency',
      currency: currency || 'CRC',
      maximumFractionDigits: 2,
    }).format(number(value));
  }

  function addDaysToDateKey(value, days) {
    const base = new Date(`${value}T12:00:00-06:00`);
    base.setDate(base.getDate() + days);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Guatemala',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(base);
  }

  function formatDate(value, lotDates) {
    const key = lotDates.dateKey(value);
    if (!key) return 'Sin fecha';
    const [year, month, day] = key.split('-');
    return `${day}/${month}/${year}`;
  }

  function productTypeLabel(type) {
    const labels = {
      FINISHED_PRODUCT: 'Producto terminado',
      RAW_MATERIAL: 'Materia prima',
      PACKAGING: 'Empaque',
      MISCELLANEOUS: 'Misceláneo',
    };
    return labels[type] || type || 'Sin tipo';
  }

  function lotStatusLabel(status) {
    const labels = {
      AVAILABLE: 'Disponible',
      QUARANTINED: 'Cuarentena',
      BLOCKED: 'Bloqueado',
      EXPIRED: 'Vencido',
      CONSUMED: 'Consumido',
    };
    return labels[status] || status || 'Sin estado';
  }

  function qaStatusLabel(status) {
    const labels = {
      APPROVED: 'Aprobado',
      PENDING: 'Pendiente',
      REJECTED: 'Rechazado',
      FAILED: 'Fallido',
    };
    return labels[status] || status || 'Sin QA';
  }

  function statusChip(value, label, escape) {
    const className = String(value || '').toLowerCase();
    return `<span class="products-status-chip ${className}">${escape(label)}</span>`;
  }

  async function apiFetch(session, storageKey, url, options = {}) {
    return inventoryAuth.fetchJson(session, url, {
      ...options,
      storageKey,
      fallbackMessage: options.fallbackMessage || 'No se pudo completar la operación',
    });
  }

  global.RootProductsShared = {
    escapeHtml,
    number,
    formatQuantity,
    formatMoney,
    addDaysToDateKey,
    formatDate,
    productTypeLabel,
    lotStatusLabel,
    qaStatusLabel,
    statusChip,
    apiFetch,
  };
})(window);
