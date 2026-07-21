const { createHttpError } = require('../lib/errors');

const BUSINESS_TIME_ZONE = 'America/Guatemala';
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function guatemalaDateKey(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function toGuatemalaStartOfDay(dateKey) {
  return new Date(`${dateKey}T00:00:00-06:00`);
}

function defaultLotDateValue(defaultToNow) {
  return defaultToNow ? new Date() : null;
}

function dateKeyFromAcceptedLotInput(value, fieldLabel) {
  const normalized = String(value).trim();
  if (DATE_ONLY_PATTERN.test(normalized)) {
    return normalized;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw createHttpError(400, `La fecha de ${fieldLabel} no tiene un formato valido. Use YYYY-MM-DD o un datetime ISO.`, 'validation_error');
  }

  const calendarDatePrefix = normalized.slice(0, 10);
  if (DATE_ONLY_PATTERN.test(calendarDatePrefix)) {
    return calendarDatePrefix;
  }

  return guatemalaDateKey(parsed);
}

function normalizeLotDateInput(value, fieldLabel, options = {}) {
  const { defaultToNow = false, normalizeToStartOfDay = true } = options;
  if (value === undefined || value === null || value === '') {
    return defaultLotDateValue(defaultToNow);
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return defaultLotDateValue(defaultToNow);
  }

  const dateKey = dateKeyFromAcceptedLotInput(normalized, fieldLabel);
  if (!normalizeToStartOfDay) {
    return new Date(normalized);
  }

  return toGuatemalaStartOfDay(dateKey);
}

function lotDateKey(value) {
  if (!value) return '';
  if (DATE_ONLY_PATTERN.test(String(value))) return String(value);
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return guatemalaDateKey(parsed);
}

function isLotExpired(expirationDate, referenceDate = new Date()) {
  const expirationKey = lotDateKey(expirationDate);
  return Boolean(expirationKey && expirationKey <= guatemalaDateKey(referenceDate));
}

function deriveLotUsability(lot, referenceDate = new Date()) {
  const expired = isLotExpired(lot?.expirationDate ?? lot, referenceDate);
  const sellable = !expired && lot?.status === 'AVAILABLE' && lot?.qaStatus === 'APPROVED';
  return {
    expired,
    sellable,
    expirationDateKey: lotDateKey(lot?.expirationDate ?? lot),
  };
}

function validateLotDateRelationships({ entryDate, productionDate, expirationDate }) {
  const entryKey = lotDateKey(entryDate);
  const productionKey = lotDateKey(productionDate);
  const expirationKey = lotDateKey(expirationDate);

  if (productionKey && expirationKey && productionKey > expirationKey) {
    throw createHttpError(400, 'La fecha de produccion no puede ser posterior a la fecha de vencimiento.', 'validation_error');
  }
  if (entryKey && expirationKey && entryKey >= expirationKey) {
    throw createHttpError(400, 'La fecha de ingreso debe ser anterior a la fecha de vencimiento.', 'validation_error');
  }
  if (productionKey && entryKey && productionKey > entryKey) {
    throw createHttpError(400, 'La fecha de produccion no puede ser posterior a la fecha de ingreso.', 'validation_error');
  }
}

function normalizeLotDates(payload) {
  const productionDate = normalizeLotDateInput(payload.productionDate, 'produccion');
  const expirationDate = normalizeLotDateInput(payload.expirationDate, 'vencimiento');
  const entryDate = normalizeLotDateInput(payload.entryDate, 'ingreso', { defaultToNow: true });

  validateLotDateRelationships({ entryDate, productionDate, expirationDate });

  if (isLotExpired(expirationDate, entryDate)) {
    throw createHttpError(400, 'No se puede registrar un lote cuya fecha de vencimiento ya inicio.', 'validation_error');
  }

  return { productionDate, expirationDate, entryDate };
}

module.exports = {
  BUSINESS_TIME_ZONE,
  guatemalaDateKey,
  normalizeLotDates,
  lotDateKey,
  isLotExpired,
  deriveLotUsability,
};
