const PRIORITIZED_HEAVY_ENDPOINTS = Object.freeze([
  Object.freeze({
    key: 'agent-stores-list',
    method: 'GET',
    routePattern: '/api/agent/stores',
    payloadClass: 'medium',
    resultCountStrategy: 'stores',
    responseShape: 'summary-plus-collection',
    costDrivers: ['agent-coverage-scan', 'summary-aggregation', 'store-card-serialization'],
  }),
  Object.freeze({
    key: 'agent-store-detail',
    method: 'GET',
    routePattern: '/api/agent/stores/:storeId',
    payloadClass: 'medium',
    resultCountStrategy: 'single-resource',
    responseShape: 'deep-object',
    costDrivers: ['deep-nested-resource', 'purchase-history', 'sellable-products-snapshot'],
  }),
  Object.freeze({
    key: 'clients-list',
    method: 'GET',
    routePattern: '/api/clients',
    payloadClass: 'medium',
    resultCountStrategy: 'items',
    responseShape: 'paginated-collection',
    costDrivers: ['tenant-scoped-list', 'nested-client-serialization', 'pagination-optional'],
  }),
  Object.freeze({
    key: 'company-clients-list',
    method: 'GET',
    routePattern: '/api/clients/company',
    payloadClass: 'medium',
    resultCountStrategy: 'items',
    responseShape: 'paginated-collection',
    costDrivers: ['tenant-scoped-list', 'nested-client-serialization', 'company-dashboard-dependency'],
  }),
  Object.freeze({
    key: 'invoice-inconsistencies-list',
    method: 'GET',
    routePattern: '/api/invoices/inconsistencies',
    payloadClass: 'medium',
    resultCountStrategy: 'invoices',
    responseShape: 'summary-plus-collection',
    costDrivers: ['financial-state-review', 'cross-entity-consistency-check', 'summary-aggregation'],
  }),
  Object.freeze({
    key: 'inventory-stocks-list',
    method: 'GET',
    routePattern: '/api/inventory/stocks',
    payloadClass: 'medium',
    resultCountStrategy: 'items-plus-lots',
    responseShape: 'split-collection',
    costDrivers: ['warehouse-stock-scan', 'lot-stock-scan', 'dual-collection-response'],
  }),
  Object.freeze({
    key: 'payments-list',
    method: 'GET',
    routePattern: '/api/payments',
    payloadClass: 'medium',
    resultCountStrategy: 'items',
    responseShape: 'paginated-collection',
    costDrivers: ['tenant-scoped-list', 'receipt-metadata-serialization', 'ownership-scope-filtering'],
  }),
  Object.freeze({
    key: 'products-import',
    method: 'POST',
    routePattern: '/api/products/import',
    payloadClass: 'high',
    resultCountStrategy: 'mutation-summary',
    responseShape: 'mutation-summary',
    costDrivers: ['high-request-payload', 'batch-upsert-loop', 'inventory-side-effects'],
  }),
]);

function normalizeRequestPath(requestPath) {
  return String(requestPath || '').split('?')[0].replace(/\/+$/, '') || '/';
}

function routePatternToRegex(routePattern) {
  const normalizedPattern = normalizeRequestPath(routePattern);
  const escaped = normalizedPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/:(\w+)/g, '[^/]+')}$`);
}

function findGovernedHeavyEndpoint(method, requestPath) {
  const normalizedMethod = String(method || '').toUpperCase();
  const normalizedPath = normalizeRequestPath(requestPath);

  return PRIORITIZED_HEAVY_ENDPOINTS.find((entry) => (
    entry.method === normalizedMethod
    && routePatternToRegex(entry.routePattern).test(normalizedPath)
  )) || null;
}

function inferLogicalResultCount(payload, strategy) {
  switch (strategy) {
    case 'single-resource':
      return payload ? 1 : 0;
    case 'items':
      return Array.isArray(payload?.items) ? payload.items.length : Array.isArray(payload) ? payload.length : 0;
    case 'stores':
      return Array.isArray(payload?.stores) ? payload.stores.length : 0;
    case 'invoices':
      return Array.isArray(payload?.invoices) ? payload.invoices.length : 0;
    case 'items-plus-lots':
      return (Array.isArray(payload?.items) ? payload.items.length : 0) + (Array.isArray(payload?.lots) ? payload.lots.length : 0);
    case 'mutation-summary':
      return (Array.isArray(payload?.created) ? payload.created.length : 0)
        + (Array.isArray(payload?.updated) ? payload.updated.length : 0)
        + (Array.isArray(payload?.skipped) ? payload.skipped.length : 0);
    default:
      return Array.isArray(payload) ? payload.length : payload ? 1 : 0;
  }
}

function measureGovernedHeavyEndpointResponse(entry, payload) {
  const responseBytes = Buffer.byteLength(JSON.stringify(payload ?? null));
  return {
    endpointKey: entry.key,
    routePattern: entry.routePattern,
    payloadClass: entry.payloadClass,
    responseShape: entry.responseShape,
    responseBytes,
    resultCount: inferLogicalResultCount(payload, entry.resultCountStrategy),
  };
}

module.exports = {
  PRIORITIZED_HEAVY_ENDPOINTS,
  findGovernedHeavyEndpoint,
  inferLogicalResultCount,
  measureGovernedHeavyEndpointResponse,
  normalizeRequestPath,
};
