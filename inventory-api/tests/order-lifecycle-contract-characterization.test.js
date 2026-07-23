const test = require('node:test');
const assert = require('node:assert/strict');

const orderService = require('../src/services/order.service');
const orderRepository = require('../src/repositories/order.repository');
const inventoryService = require('../src/services/inventory.service');

function withModuleStubs(stubsByModule, run) {
  const originals = [];

  for (const [moduleRef, stubs] of stubsByModule) {
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

test('getOrder returns not_found when the order is outside the authenticated tenant scope', async () => {
  await withModuleStubs(
    [
      [orderRepository, {
        findOrderById: async () => null,
      }],
    ],
    async () => {
      await assert.rejects(
        () => orderService.getOrder(9n, { companyId: '7', sub: '10', role: 'sales' }),
        (error) => {
          assert.equal(error.statusCode, 404);
          assert.equal(error.code, 'not_found');
          return true;
        },
      );
    },
  );
});

test('cancelOrder transitions a draft order to CANCELLED inside the tenant scope', async () => {
  let updateCall = null;

  const cancelledOrder = await withModuleStubs(
    [
      [orderRepository, {
        findOrderById: async (orderId, companyId) => ({ id: orderId, companyId, status: 'DRAFT', approved: false }),
        updateOrder: async (orderId, payload) => {
          updateCall = { orderId, payload };
          return { id: orderId, status: 'CANCELLED', approved: false };
        },
      }],
    ],
    () => orderService.cancelOrder(12n, { companyId: '7', sub: '10', role: 'sales' }),
  );

  assert.deepEqual(updateCall, {
    orderId: 12n,
    payload: { status: 'CANCELLED' },
  });
  assert.equal(cancelledOrder.status, 'CANCELLED');
});

test('cancelOrder delegates approved orders to inventory reservation release compatibility flow', async () => {
  let releaseCall = null;

  const cancelledOrder = await withModuleStubs(
    [
      [orderRepository, {
        findOrderById: async (orderId, companyId) => ({ id: orderId, companyId, status: 'APPROVED', approved: true }),
      }],
      [inventoryService, {
        releaseStockReservation: async (orderId, cancelOrder, auth) => {
          releaseCall = { orderId, cancelOrder, auth };
          return { id: orderId, status: 'CANCELLED', approved: false };
        },
      }],
    ],
    () => orderService.cancelOrder(15n, { companyId: '7', sub: '10', role: 'admin' }),
  );

  assert.deepEqual(releaseCall, {
    orderId: 15n,
    cancelOrder: true,
    auth: { companyId: '7', sub: '10', role: 'admin' },
  });
  assert.equal(cancelledOrder.status, 'CANCELLED');
});

test('removeOrder rejects approved orders until they are cancelled to release reservations', async () => {
  await withModuleStubs(
    [
      [orderRepository, {
        findOrderById: async (orderId, companyId) => ({ id: orderId, companyId, status: 'APPROVED', approved: true }),
      }],
    ],
    async () => {
      await assert.rejects(
        () => orderService.removeOrder(18n, { companyId: '7', sub: '10', role: 'admin' }),
        (error) => {
          assert.equal(error.statusCode, 409);
          assert.equal(error.code, 'conflict');
          return true;
        },
      );
    },
  );
});

test('removeOrder deletes non-approved and non-delivered orders after tenant-scoped lookup', async () => {
  let deleteCall = null;

  await withModuleStubs(
    [
      [orderRepository, {
        findOrderById: async (orderId, companyId) => ({
          id: orderId,
          companyId,
          status: 'DRAFT',
          approved: false,
          clientId: 4n,
          warehouseId: 8n,
        }),
        deleteOrder: async (orderId) => {
          deleteCall = orderId;
          return { id: orderId };
        },
      }],
    ],
    () => orderService.removeOrder(20n, { companyId: '7', sub: '10', role: 'admin' }),
  );

  assert.equal(deleteCall, 20n);
});
