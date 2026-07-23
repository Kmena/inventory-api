const test = require('node:test');
const assert = require('node:assert/strict');

const agentWorkspaceService = require('../src/services/agent-workspace.service');
const agentWorkspaceRepository = require('../src/repositories/agent-workspace.repository');

function withRepositoryStubs(stubs, run) {
  const originals = new Map();

  for (const [key, value] of Object.entries(stubs)) {
    originals.set(key, agentWorkspaceRepository[key]);
    agentWorkspaceRepository[key] = value;
  }

  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [key, value] of originals.entries()) {
        agentWorkspaceRepository[key] = value;
      }
    });
}

function createAgentUser(userId = 15n, companyId = 7n) {
  return {
    id: userId,
    companyId,
    fullName: 'Agente Demo',
    username: 'agente-demo',
    role: { code: 'sales_agent', name: 'Agente', rolePermissions: [] },
    salesRouteAssignments: [{ salesRoute: { id: 4n, code: 'R-4', name: 'Ruta 4', visitFrequencyDays: 7, nearLimitDays: 2 } }],
    salesGoals: [{ id: 90n, goalType: 'VISITS', targetValue: 20, periodLabel: '2026-08' }],
  };
}

test('getAgentStorePurchaseHistory returns only the derived purchase history for a covered store', async () => {
  const purchaseHistory = await withRepositoryStubs(
    {
      findAgentUser: async () => createAgentUser(),
      findStoreByIdForAgent: async () => ({
        id: 101n,
        clientId: 22n,
        client: { name: 'Cliente 22', legalEntity: { legalName: 'Cliente 22 SA' }, contacts: [] },
        legalEntity: null,
        subregion: { salesRoutes: [{ salesRouteId: 4n, salesRoute: { id: 4n, code: 'R-4', name: 'Ruta 4', visitFrequencyDays: 7, nearLimitDays: 2 } }], region: { name: 'Central' }, name: 'Subzona 1' },
        routeVisitLogs: [],
        representatives: [],
        orders: [{
          id: 5001n,
          createdAt: new Date('2026-08-01T00:00:00Z'),
          status: 'DELIVERED',
          total: 100,
          items: [{ productId: 44n, quantity: 2, unitPrice: 50, product: { name: 'Producto A' } }],
          invoices: [{
            id: 7001n,
            clientId: 22n,
            number: 'F-001',
            issuedAt: new Date('2026-08-02T00:00:00Z'),
            dueAt: null,
            amount: 100,
            status: 'PENDING',
            payments: [],
            orderId: 5001n,
          }],
          clientId: 22n,
          clientStoreId: 101n,
          clientStore: { id: 101n, clientId: 22n },
        }],
      }),
      findOtherStoreProductSuggestions: async () => [],
      findSellableWarehouses: async () => [],
      findSellableProductAvailabilityRows: async () => [],
    },
    () => agentWorkspaceService.getAgentStorePurchaseHistory(101n, { companyId: '7', sub: '15' }),
  );

  assert.equal(purchaseHistory.pendingBalance, 100);
  assert.equal(purchaseHistory.orders.length, 1);
  assert.equal(purchaseHistory.orders[0].orderId, 5001n);
  assert.deepEqual(purchaseHistory.orders[0].invoiceNumbers, ['F-001']);
});

test('getAgentStoreSellableProducts returns the sellable snapshot for a covered store', async () => {
  const sellableProducts = await withRepositoryStubs(
    {
      findAgentUser: async () => createAgentUser(),
      findStoreByIdForAgent: async () => ({
        id: 101n,
        clientId: 22n,
        client: { name: 'Cliente 22', legalEntity: { legalName: 'Cliente 22 SA' }, contacts: [] },
        legalEntity: null,
        subregion: { salesRoutes: [{ salesRouteId: 4n, salesRoute: { id: 4n, code: 'R-4', name: 'Ruta 4', visitFrequencyDays: 7, nearLimitDays: 2 } }], region: { name: 'Central' }, name: 'Subzona 1' },
        routeVisitLogs: [],
        representatives: [],
        orders: [],
      }),
      findOtherStoreProductSuggestions: async () => [{
        productId: 44n,
        product: { name: 'Producto A' },
        order: { clientStore: { name: 'Sucursal Vecina' }, createdAt: new Date('2026-08-01T00:00:00Z') },
      }],
      findSellableWarehouses: async () => [{ id: 1n }],
      findSellableProductAvailabilityRows: async () => [{
        productId: 44n,
        warehouseId: 1n,
        lotId: 10n,
        quantity: 5,
        reservedQuantity: 1,
        lot: { status: 'AVAILABLE', qaStatus: 'APPROVED', expirationDate: null },
        product: { id: 44n, code: 'P-44', name: 'Producto A', price: 25, prices: [], category: { name: 'Cat' }, subcategory: { name: 'Sub' }, inCatalog: true },
      }],
    },
    () => agentWorkspaceService.getAgentStoreSellableProducts(101n, { companyId: '7', sub: '15' }),
  );

  assert.equal(sellableProducts.products.length, 1);
  assert.equal(sellableProducts.products[0].id, 44n);
  assert.equal(sellableProducts.products[0].availableQuantity, 4);
  assert.equal(sellableProducts.suggestions.length, 1);
  assert.equal(sellableProducts.suggestions[0].productId, 44n);
});

test('listAgentGoals returns the authenticated agent goals from the tenant-scoped context', async () => {
  const result = await withRepositoryStubs(
    {
      findAgentUser: async () => createAgentUser(),
    },
    () => agentWorkspaceService.listAgentGoals({ companyId: '7', sub: '15' }),
  );

  assert.equal(result.goals.length, 1);
  assert.equal(result.goals[0].id, 90n);
});

test('getAgentStoreOrderContext rejects stores outside the authenticated agent coverage', async () => {
  await withRepositoryStubs(
    {
      findAgentUser: async () => createAgentUser(),
      findStoreByIdForAgent: async () => null,
    },
    async () => {
      await assert.rejects(
        () => agentWorkspaceService.getAgentStoreOrderContext(999n, { companyId: '7', sub: '15' }),
        (error) => {
          assert.equal(error.statusCode, 404);
          assert.equal(error.code, 'not_found');
          return true;
        },
      );
    },
  );
});

test('getAgentStoreOrderContext rejects order preparation when no sellable warehouse is active', async () => {
  await withRepositoryStubs(
    {
      findAgentUser: async () => createAgentUser(),
      findStoreByIdForAgent: async () => ({
        id: 101n,
        clientId: 22n,
        client: { name: 'Cliente 22', legalEntity: { legalName: 'Cliente 22 SA' }, contacts: [] },
        legalEntity: null,
        code: 'S-101',
        name: 'Sucursal 101',
        phone: null,
        address: 'Direccion 101',
        locationReference: null,
        latitude: null,
        longitude: null,
        attentionSchedule: null,
        createdAt: new Date('2026-08-01T00:00:00Z'),
        subregionId: 12n,
        subregion: { salesRoutes: [{ salesRouteId: 4n, salesRoute: { id: 4n, code: 'R-4', name: 'Ruta 4', visitFrequencyDays: 7, nearLimitDays: 2 } }], region: { name: 'Central' }, name: 'Subzona 1' },
        routeVisitLogs: [],
        representatives: [],
        orders: [],
      }),
      findSellableWarehouses: async () => [],
    },
    async () => {
      await assert.rejects(
        () => agentWorkspaceService.getAgentStoreOrderContext(101n, { companyId: '7', sub: '15' }),
        (error) => {
          assert.equal(error.statusCode, 409);
          assert.equal(error.code, 'conflict');
          return true;
        },
      );
    },
  );
});
