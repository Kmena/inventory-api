const test = require('node:test');
const assert = require('node:assert/strict');

const orderService = require('../src/services/order.service');
const orderRepository = require('../src/repositories/order.repository');
const inventoryService = require('../src/services/inventory.service');
const approvalBaselineService = require('../src/services/approval-baseline.service');

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

test('approval baseline rejects users without required permissions', async () => {
  assert.throws(
    () => approvalBaselineService.assertHasAnyPermission({ permissions: ['inventory.view'] }, ['collections.payments.approve'], 'Sin permiso'),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'forbidden');
      return true;
    },
  );
});

test('approveOrder preserves compatibility by delegating draft orders to inventory reservation flow', async () => {
  let reserveCall = null;

  const result = await withModuleStubs(
    [
      [orderRepository, {
        findOrderById: async (orderId, companyId) => ({ id: orderId, companyId, status: 'DRAFT', approved: false }),
      }],
      [inventoryService, {
        reserveStockForOrder: async (orderId, auth) => {
          reserveCall = { orderId, auth };
          return { id: orderId, status: 'APPROVED', approved: true };
        },
      }],
    ],
    () => orderService.approveOrder(5n, { companyId: '7', sub: '10', role: 'admin', permissions: ['sales.manage'] }),
  );

  assert.deepEqual(reserveCall, {
    orderId: 5n,
    auth: { companyId: '7', sub: '10', role: 'admin', permissions: ['sales.manage'] },
  });
  assert.equal(result.status, 'APPROVED');
});

test('approveOrder blocks non-draft orders before entering the inventory reservation flow', async () => {
  let reserveCalled = false;

  await withModuleStubs(
    [
      [orderRepository, {
        findOrderById: async (orderId, companyId) => ({ id: orderId, companyId, status: 'APPROVED', approved: true }),
      }],
      [inventoryService, {
        reserveStockForOrder: async () => {
          reserveCalled = true;
          return null;
        },
      }],
    ],
    async () => {
      await assert.rejects(
        () => orderService.approveOrder(8n, { companyId: '7', sub: '10', role: 'admin', permissions: ['sales.manage'] }),
        (error) => {
          assert.equal(error.statusCode, 409);
          assert.equal(error.code, 'conflict');
          return true;
        },
      );
    },
  );

  assert.equal(reserveCalled, false);
});
