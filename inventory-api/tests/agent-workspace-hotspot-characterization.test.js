const test = require('node:test');
const assert = require('node:assert/strict');

const agentWorkspaceRepository = require('../src/repositories/agent-workspace.repository');
const agentWorkspaceService = require('../src/services/agent-workspace.service');
const orderService = require('../src/services/order.service');

function withStubs(moduleStubs, run) {
  const originals = [];

  for (const [moduleRef, stubs] of moduleStubs) {
    for (const [key, value] of Object.entries(stubs)) {
      originals.push([moduleRef, key, moduleRef[key]]);
      moduleRef[key] = value;
    }
  }

  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [moduleRef, key, value] of originals) {
        moduleRef[key] = value;
      }
    });
}

function createAgentUser() {
  return {
    id: 15n,
    companyId: 7n,
    fullName: 'Agente Demo',
    username: 'agente-demo',
    role: { code: 'sales_agent', name: 'Agente', rolePermissions: [] },
    salesRouteAssignments: [{
      salesRoute: { id: 4n, code: 'R-4', name: 'Ruta 4', visitFrequencyDays: 7, nearLimitDays: 2 },
    }],
  };
}

function createVisibleStore({
  id,
  name,
  regionName,
  subregionName,
  latestVisitDaysAgo,
  createdAtDaysAgo = 30,
}) {
  const createdAt = new Date(Date.now() - (createdAtDaysAgo * 24 * 60 * 60 * 1000));
  const latestVisit = latestVisitDaysAgo === null
    ? []
    : [{ visitedAt: new Date(Date.now() - (latestVisitDaysAgo * 24 * 60 * 60 * 1000)), comment: `Visita ${name}` }];

  return {
    id,
    clientId: 21n + id,
    client: { name: `Cliente ${name}`, legalEntity: { legalName: `Legal ${name}` } },
    legalEntity: null,
    code: `S-${id}`,
    name,
    phone: null,
    address: `Direccion ${name}`,
    locationReference: null,
    latitude: '9.9321',
    longitude: '-84.0796',
    createdAt,
    subregion: {
      name: subregionName,
      region: { name: regionName },
      salesRoutes: [{
        salesRouteId: 4n,
        salesRoute: { id: 4n, code: 'R-4', name: 'Ruta 4', visitFrequencyDays: 7, nearLimitDays: 2 },
      }],
    },
    representatives: [],
    routeVisitLogs: latestVisit,
    orders: [],
  };
}

function createCoveredStore(overrides = {}) {
  return {
    id: 101n,
    clientId: 22n,
    client: {
      name: 'Cliente 22',
      legalEntity: { legalName: 'Cliente 22 SA' },
      contacts: [{ id: 1n, name: 'Contacto 1', role: 'Compras', email: 'contacto@example.com', phone: '1111', mobile: '2222' }],
    },
    legalEntity: null,
    code: 'S-101',
    name: 'Sucursal 101',
    phone: '2222-3333',
    address: 'Direccion 101',
    locationReference: 'Frente al parque',
    attentionSchedule: 'L-V 8am-5pm',
    latitude: null,
    longitude: null,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    subregionId: 12n,
    subregion: {
      name: 'Subzona 1',
      region: { name: 'Central' },
      salesRoutes: [{
        salesRouteId: 4n,
        salesRoute: { id: 4n, code: 'R-4', name: 'Ruta 4', visitFrequencyDays: 7, nearLimitDays: 2 },
      }],
    },
    representatives: [{
      id: 8n,
      fullName: 'Ana Contacto',
      position: 'Encargada',
      role: 'Compras',
      email: 'ana@example.com',
      phonePrimary: '3333',
      phoneSecondary: null,
      comment: null,
      isPrimaryContact: true,
    }],
    routeVisitLogs: [],
    orders: [],
    ...overrides,
  };
}

test('listAgentStores preserves tenant-scoped filtering, summary counts, and status-first sorting', async () => {
  let receivedStoreLookup = null;

  const result = await withStubs(
    [[agentWorkspaceRepository, {
      findAgentUser: async () => createAgentUser(),
      findVisibleStoresForAgent: async (companyId, assignedRouteIds) => {
        receivedStoreLookup = { companyId, assignedRouteIds };
        return [
          createVisibleStore({ id: 1n, name: 'Mercado Norte', regionName: 'Central', subregionName: 'Subzona A', latestVisitDaysAgo: 10 }),
          createVisibleStore({ id: 2n, name: 'Mercado Nuevo', regionName: 'Central', subregionName: 'Subzona B', latestVisitDaysAgo: null, createdAtDaysAgo: 2 }),
          createVisibleStore({ id: 3n, name: 'Tienda Sur', regionName: 'Pacifico', subregionName: 'Subzona C', latestVisitDaysAgo: 1 }),
        ];
      },
    }]],
    () => agentWorkspaceService.listAgentStores({ name: 'mercado', zone: 'central' }, { companyId: '7', sub: '15' }),
  );

  assert.deepEqual(receivedStoreLookup, { companyId: 7n, assignedRouteIds: [4n] });
  assert.deepEqual(result.summary, {
    total: 2,
    byStatus: {
      VENCIDA: 1,
      PROXIMA_A_VENCER: 0,
      NUEVA: 1,
      AL_DIA: 0,
    },
  });
  assert.deepEqual(result.stores.map((store) => ({ name: store.name, status: store.status })), [
    { name: 'Mercado Norte', status: 'VENCIDA' },
    { name: 'Mercado Nuevo', status: 'NUEVA' },
  ]);
  assert.equal(result.stores[0].routeName, 'Ruta 4');
  assert.equal(result.stores[0].latitude, 9.9321);
  assert.equal(result.stores[0].longitude, -84.0796);
});

test('createAgentStoreOrder preserves covered-store scope and coerces sellable order payload before delegating', async () => {
  const captured = {
    warehouseCompanyIds: [],
    availabilityCompanyIds: [],
    orderPayload: null,
    orderAuth: null,
  };

  const result = await withStubs(
    [
      [agentWorkspaceRepository, {
        findAgentUser: async () => createAgentUser(),
        findStoreByIdForAgent: async (companyId, assignedRouteIds, storeId) => {
          assert.equal(companyId, 7n);
          assert.deepEqual(assignedRouteIds, [4n]);
          assert.equal(storeId, 101n);
          return createCoveredStore();
        },
        findSellableWarehouses: async (companyId) => {
          captured.warehouseCompanyIds.push(companyId);
          return [{ id: 1n }];
        },
        findSellableProductAvailabilityRows: async (companyId) => {
          captured.availabilityCompanyIds.push(companyId);
          return [{
            productId: 44n,
            warehouseId: 1n,
            lotId: 10n,
            quantity: 5,
            reservedQuantity: 1,
            lot: { status: 'AVAILABLE', qaStatus: 'APPROVED', expirationDate: null },
            product: { id: 44n, code: 'P-44', name: 'Producto A', price: 25, prices: [], category: { name: 'Cat' }, subcategory: { name: 'Sub' }, inCatalog: true },
          }];
        },
      }],
      [orderService, {
        createOrder: async (payload, auth) => {
          captured.orderPayload = payload;
          captured.orderAuth = auth;
          return { id: 9001n, status: 'DRAFT' };
        },
      }],
    ],
    () => agentWorkspaceService.createAgentStoreOrder(
      101n,
      {
        notes: '  Entrega prioritaria  ',
        responsible: '  Ana Contacto  ',
        items: [{
          productId: '44',
          quantity: '4',
          unitPrice: '25.5',
          discountPercent: '5',
          discountAmount: '1.25',
          totalDiscount: '1.25',
        }],
      },
      { companyId: '7', sub: '15' },
    ),
  );

  assert.deepEqual(captured.warehouseCompanyIds, [7n]);
  assert.deepEqual(captured.availabilityCompanyIds, [7n]);
  assert.deepEqual(captured.orderPayload, {
    clientId: 22n,
    clientStoreId: 101n,
    paymentCondition: null,
    transferMetadata: null,
    notes: 'Entrega prioritaria',
    responsible: 'Ana Contacto',
    transport: null,
    items: [{
      productId: 44n,
      quantity: 4,
      unitPrice: 25.5,
      discountPercent: 5,
      discountAmount: 1.25,
      totalDiscount: 1.25,
    }],
  });
  assert.deepEqual(captured.orderAuth, { companyId: '7', sub: '15' });
  assert.deepEqual(result, { id: 9001n, status: 'DRAFT' });
});
