const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  PRIORITIZED_HEAVY_ENDPOINTS,
  findGovernedHeavyEndpoint,
  measureGovernedHeavyEndpointResponse,
} = require('../src/lib/heavy-endpoint-governance');
const { createHeavyEndpointMetricsMiddleware } = require('../src/middlewares/heavy-endpoint-metrics');

const { skipIfMissing } = require('./internal-docs-optional');
const baselinePath = path.join(__dirname, '..', 'internal-docs', 'heavy-endpoints-baseline.json');

function createRepresentativeFixtures() {
  return {
    'agent-stores-list': {
      summary: {
        total: 2,
        byStatus: {
          VENCIDA: 1,
          PROXIMA_A_VENCER: 0,
          NUEVA: 0,
          AL_DIA: 1,
        },
      },
      stores: [
        { id: '101', name: 'Farmacia Central', status: 'AL_DIA', clientName: 'Cliente 1' },
        { id: '102', name: 'Mini Super Norte', status: 'VENCIDA', clientName: 'Cliente 2' },
      ],
    },
    'agent-store-detail': {
      store: {
        id: '101',
        name: 'Farmacia Central',
        representatives: [{ id: '1', fullName: 'Ana Contacto' }],
      },
      latestVisit: { id: '9001', visitedAt: '2026-07-22T10:00:00.000Z' },
      visitHistory: [{ id: '9001' }, { id: '9000' }],
      purchaseHistory: {
        pendingBalance: 120.5,
        orders: [{ orderId: '5001' }, { orderId: '5002' }],
      },
      sellableProducts: {
        products: [{ id: '44' }, { id: '45' }],
        suggestions: [{ productId: '45' }],
      },
    },
    'clients-list': {
      items: [
        { id: '10', name: 'Cliente 1', storesCount: 2 },
        { id: '11', name: 'Cliente 2', storesCount: 1 },
      ],
      page: 1,
      pageSize: 2,
      totalItems: 10,
      totalPages: 5,
    },
    'company-clients-list': {
      items: [
        { id: '10', name: 'Cliente 1', storesCount: 2 },
        { id: '11', name: 'Cliente 2', storesCount: 1 },
        { id: '12', name: 'Cliente 3', storesCount: 4 },
      ],
      page: 1,
      pageSize: 3,
      totalItems: 12,
      totalPages: 4,
    },
    'invoice-inconsistencies-list': {
      summary: {
        total: 2,
        assignmentInconsistencies: 2,
      },
      invoices: [
        { id: '30', number: 'FAC-1', inconsistencyTypes: ['ASIGNACION_TIENDA'] },
        { id: '31', number: 'FAC-2', inconsistencyTypes: ['ASIGNACION_TIENDA'] },
      ],
    },
    'inventory-stocks-list': {
      items: [
        { warehouseId: '1', productId: '44', quantity: 12 },
        { warehouseId: '2', productId: '45', quantity: 8 },
      ],
      lots: [
        { lotId: '500', productId: '44', quantity: 7 },
        { lotId: '501', productId: '44', quantity: 5 },
        { lotId: '600', productId: '45', quantity: 8 },
      ],
    },
    'payments-list': {
      items: [
        { id: '70', status: 'PENDING_APPROVAL', amount: 50, receipts: [{ id: '1' }] },
        { id: '71', status: 'APPROVED', amount: 25, receipts: [] },
      ],
      page: 1,
      pageSize: 2,
      totalItems: 6,
      totalPages: 3,
    },
    'products-import': {
      created: [{ id: '100', name: 'Producto Nuevo' }],
      updated: [{ id: '101', name: 'Producto Actualizado' }],
      skipped: [{ id: '102', name: 'Producto Omitido', reason: 'exists_without_overwrite' }],
    },
  };
}

test('heavy-endpoint governance manifest stays aligned with the approved prioritized endpoints', () => {
  assert.deepEqual(
    PRIORITIZED_HEAVY_ENDPOINTS.map((entry) => `${entry.method} ${entry.routePattern}`),
    [
      'GET /api/agent/stores',
      'GET /api/agent/stores/:storeId',
      'GET /api/clients',
      'GET /api/clients/company',
      'GET /api/invoices/inconsistencies',
      'GET /api/inventory/stocks',
      'GET /api/payments',
      'POST /api/products/import',
    ],
  );
});

test('heavy-endpoint matcher normalizes concrete runtime paths to the governed route patterns', () => {
  assert.equal(findGovernedHeavyEndpoint('GET', '/api/agent/stores')?.key, 'agent-stores-list');
  assert.equal(findGovernedHeavyEndpoint('GET', '/api/agent/stores/123')?.key, 'agent-store-detail');
  assert.equal(findGovernedHeavyEndpoint('GET', '/api/clients/company?page=1')?.key, 'company-clients-list');
  assert.equal(findGovernedHeavyEndpoint('POST', '/api/products/import')?.key, 'products-import');
  assert.equal(findGovernedHeavyEndpoint('GET', '/api/agent/stores/123/orders'), null);
  assert.equal(findGovernedHeavyEndpoint('DELETE', '/api/payments/1'), null);
});

test('heavy-endpoint metrics middleware captures governed JSON metrics without changing the response body', () => {
  const middleware = createHeavyEndpointMetricsMiddleware();
  const req = {
    method: 'GET',
    path: '/api/inventory/stocks',
    originalUrl: '/api/inventory/stocks?warehouseId=1',
  };
  const res = {
    locals: {},
    jsonPayload: null,
    json(body) {
      this.jsonPayload = body;
      return body;
    },
  };

  let nextCalls = 0;
  middleware(req, res, () => {
    nextCalls += 1;
  });

  const payload = {
    items: [{ warehouseId: '1' }, { warehouseId: '2' }],
    lots: [{ lotId: '10' }],
  };
  const returnedBody = res.json(payload);

  assert.equal(nextCalls, 1);
  assert.equal(returnedBody, payload);
  assert.equal(res.jsonPayload, payload);
  assert.deepEqual(res.locals.heavyEndpointMetrics, {
    endpointKey: 'inventory-stocks-list',
    routePattern: '/api/inventory/stocks',
    payloadClass: 'medium',
    responseShape: 'split-collection',
    responseBytes: Buffer.byteLength(JSON.stringify(payload)),
    resultCount: 3,
  });
});

test('heavy-endpoints baseline document stays aligned with the governed representative fixtures', (t) => {
  if (skipIfMissing(t, ['internal-docs/heavy-endpoints-baseline.json'], 'internal-docs heavy endpoint baseline is optional in public repo mode')) {
    return;
  }

  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const representativeFixtures = createRepresentativeFixtures();
  const expectedEntries = PRIORITIZED_HEAVY_ENDPOINTS.map((entry) => ({
    key: entry.key,
    method: entry.method,
    routePattern: entry.routePattern,
    payloadClass: entry.payloadClass,
    responseShape: entry.responseShape,
    resultCountStrategy: entry.resultCountStrategy,
    costDrivers: entry.costDrivers,
    baselineMetrics: measureGovernedHeavyEndpointResponse(entry, representativeFixtures[entry.key]),
  }));

  assert.equal(baseline.version, 1);
  assert.equal(baseline.generationMode, 'representative-fixtures');
  assert.deepEqual(baseline.endpoints, expectedEntries);
});
