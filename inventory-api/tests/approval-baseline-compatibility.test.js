const test = require('node:test');
const assert = require('node:assert/strict');

const orderService = require('../src/services/order.service');
const orderRepository = require('../src/repositories/order.repository');
const inventoryService = require('../src/services/inventory.service');
const approvalBaselineService = require('../src/services/approval-baseline.service');
const billingConfigRepository = require('../src/repositories/billing-integration-config.repository');

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
  let reserveCallOrderId = null;
  let reserveCallAuth = null;
  let reserveCallOptions = 'NOT_CALLED';
  const auth = { companyId: '7', sub: '10', role: 'admin', permissions: ['sales.manage'] };

  const result = await withModuleStubs(
    [
      [orderRepository, {
        findOrderById: async (orderId) => ({ id: orderId, companyId: BigInt(auth.companyId), status: 'DRAFT', approved: false }),
      }],
      [inventoryService, {
        reserveStockForOrder: async (orderId, authArg, _req, opts) => {
          reserveCallOrderId = orderId;
          reserveCallAuth = authArg;
          reserveCallOptions = opts;
          return { id: orderId, status: 'APPROVED', approved: true };
        },
      }],
      // Billing disabled → approveOrder takes commercial path (no fiscal validation)
      [billingConfigRepository, {
        findByCompanyId: async () => null,
      }],
    ],
    () => orderService.approveOrder(5n, null, auth),
  );

  assert.strictEqual(reserveCallOrderId, 5n);
  assert.deepEqual(reserveCallAuth, auth);
  assert.strictEqual(reserveCallOptions, undefined, 'billing disabled: no fiscal approval options passed');
  assert.equal(result.status, 'APPROVED');
});

test('approveOrder blocks non-draft orders before entering the inventory reservation flow', async () => {
  let reserveCalled = false;
  const auth = { companyId: '7', sub: '10', role: 'admin', permissions: ['sales.manage'] };

  await withModuleStubs(
    [
      [orderRepository, {
        findOrderById: async (orderId) => ({ id: orderId, companyId: BigInt(auth.companyId), status: 'APPROVED', approved: true }),
      }],
      [inventoryService, {
        reserveStockForOrder: async () => {
          reserveCalled = true;
          return null;
        },
      }],
      [billingConfigRepository, {
        findByCompanyId: async () => null,
      }],
    ],
    async () => {
      await assert.rejects(
        () => orderService.approveOrder(8n, null, auth),
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
