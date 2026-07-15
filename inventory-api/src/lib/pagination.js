const { createHttpError } = require('./errors');

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function parseInteger(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed)) {
    throw createHttpError(400, `El parametro ${fieldName} debe ser un entero positivo.`, 'validation_error');
  }

  return parsed;
}

function parsePaginationQuery(query = {}) {
  const hasPage = query.page !== undefined;
  const hasPageSize = query.pageSize !== undefined;

  if (!hasPage && !hasPageSize) {
    return null;
  }

  const page = parseInteger(query.page, 'page') ?? DEFAULT_PAGE;
  const pageSize = parseInteger(query.pageSize, 'pageSize') ?? DEFAULT_PAGE_SIZE;

  if (page < 1) {
    throw createHttpError(400, 'El parametro page debe ser mayor o igual a 1.', 'validation_error');
  }

  if (pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw createHttpError(400, `El parametro pageSize debe estar entre 1 y ${MAX_PAGE_SIZE}.`, 'validation_error');
  }

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

function buildPaginatedResponse(items, pagination, totalItems) {
  return {
    items,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems,
      totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pagination.pageSize),
    },
  };
}

module.exports = {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parsePaginationQuery,
  buildPaginatedResponse,
};
