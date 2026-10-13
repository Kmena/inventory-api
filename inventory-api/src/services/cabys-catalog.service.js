'use strict';

const { createHttpError } = require('../lib/errors');

const HACIENDA_CABYS_BASE_URL = 'https://api.hacienda.go.cr/fe/cabys';
const CABYS_EXACT_CODE_PATTERN = /^\d{13}$/;
const CABYS_MIN_TEXT_LENGTH = 3;
const CABYS_MAX_QUERY_LENGTH = 120;
const CABYS_SEARCH_TOP = 10;
const CABYS_TIMEOUT_MS = 5000;
function hasControlCharacters(value) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

function normalizeQuery(rawQuery) {
  const query = String(rawQuery || '').trim();
  if (!query) {
    throw createHttpError(400, 'Debe indicar una búsqueda CAByS.', 'CABYS_QUERY_REQUIRED');
  }
  if (query.length > CABYS_MAX_QUERY_LENGTH) {
    throw createHttpError(400, 'La búsqueda CAByS es demasiado larga.', 'CABYS_QUERY_TOO_LONG');
  }
  if (hasControlCharacters(query)) {
    throw createHttpError(400, 'La búsqueda CAByS contiene caracteres inválidos.', 'CABYS_QUERY_INVALID');
  }
  return query;
}

function getQueryMode(query) {
  if (CABYS_EXACT_CODE_PATTERN.test(query)) return 'exact';
  if (query.length < CABYS_MIN_TEXT_LENGTH) {
    throw createHttpError(400, 'Ingrese al menos 3 caracteres para buscar CAByS.', 'CABYS_QUERY_TOO_SHORT');
  }
  return 'text';
}

function buildHaciendaCabysUrl(query) {
  const url = new URL(HACIENDA_CABYS_BASE_URL);
  const mode = getQueryMode(query);
  if (mode === 'exact') {
    url.searchParams.set('codigo', query);
  } else {
    url.searchParams.set('q', query);
    url.searchParams.set('top', String(CABYS_SEARCH_TOP));
  }
  return { url: url.toString(), mode };
}

function normalizeCategories(rawCategories) {
  if (!Array.isArray(rawCategories)) return [];
  return rawCategories
    .filter((category) => category && typeof category === 'object')
    .map((category) => ({ ...category }));
}

function normalizeCabysItem(item) {
  if (!item || typeof item !== 'object') return null;
  const code = typeof item.codigo === 'string' ? item.codigo.trim() : '';
  if (!CABYS_EXACT_CODE_PATTERN.test(code)) return null;
  return {
    code,
    description: typeof item.descripcion === 'string' ? item.descripcion : '',
    taxRate: Number.isFinite(Number(item.impuesto)) ? Number(item.impuesto) : null,
    categories: normalizeCategories(item.categorias),
  };
}

function normalizeHaciendaCabysResponse(payload) {
  const rawItems = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.cabys)
      ? payload.cabys
      : null;

  if (!rawItems) {
    throw createHttpError(502, 'No fue posible consultar el catálogo CAByS en este momento.', 'CABYS_UPSTREAM_MALFORMED');
  }

  return {
    items: rawItems.map(normalizeCabysItem).filter(Boolean),
  };
}

function sanitizeUpstreamError(error) {
  if (error?.statusCode && error?.code?.startsWith?.('CABYS_')) return error;
  return createHttpError(502, 'No fue posible consultar el catálogo CAByS en este momento.', 'CABYS_UPSTREAM_UNAVAILABLE');
}

async function fetchHaciendaCabys(query, options = {}) {
  const normalizedQuery = normalizeQuery(query);
  const { url, mode } = buildHaciendaCabysUrl(normalizedQuery);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = options.timeoutMs || CABYS_TIMEOUT_MS;
  const controller = new globalThis.AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response || !response.ok) {
      throw createHttpError(502, 'No fue posible consultar el catálogo CAByS en este momento.', 'CABYS_UPSTREAM_UNAVAILABLE');
    }

    const payload = await response.json();
    return {
      ...normalizeHaciendaCabysResponse(payload),
      mode,
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw createHttpError(502, 'No fue posible consultar el catálogo CAByS en este momento.', 'CABYS_UPSTREAM_TIMEOUT');
    }
    throw sanitizeUpstreamError(error);
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  CABYS_EXACT_CODE_PATTERN,
  CABYS_MAX_QUERY_LENGTH,
  CABYS_MIN_TEXT_LENGTH,
  CABYS_SEARCH_TOP,
  CABYS_TIMEOUT_MS,
  buildHaciendaCabysUrl,
  fetchHaciendaCabys,
  normalizeHaciendaCabysResponse,
  normalizeQuery,
};
