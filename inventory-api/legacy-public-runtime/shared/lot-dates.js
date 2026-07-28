(function attachLotDateHelpers(global) {
  const LOT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  function normalizeDateOnly(value) {
    const normalized = String(value || '').trim();
    return LOT_DATE_PATTERN.test(normalized) ? normalized : '';
  }

  function toApiLotDate(value) {
    const normalized = normalizeDateOnly(value);
    return normalized || null;
  }

  function dateKey(value) {
    if (!value) return '';
    return String(value).slice(0, 10);
  }

  function todayInGuatemala() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Guatemala',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  function validateLotDates({ entryDate, productionDate, expirationDate, rejectExpiredExpiration = false }) {
    const entry = normalizeDateOnly(entryDate);
    const production = normalizeDateOnly(productionDate);
    const expiration = normalizeDateOnly(expirationDate);

    if (production && expiration && production > expiration) {
      return 'La fecha de produccion no puede ser posterior a la fecha de vencimiento.';
    }
    if (entry && expiration && entry >= expiration) {
      return 'La fecha de ingreso debe ser anterior a la fecha de vencimiento.';
    }
    if (production && entry && production > entry) {
      return 'La fecha de produccion no puede ser posterior a la fecha de ingreso.';
    }
    if (rejectExpiredExpiration && expiration && expiration <= todayInGuatemala()) {
      return 'No se puede registrar un lote cuya fecha de vencimiento ya inicio.';
    }

    return '';
  }

  global.InventoryLotDates = {
    dateKey,
    normalizeDateOnly,
    toApiLotDate,
    todayInGuatemala,
    validateLotDates,
  };
})(window);
