const test = require('node:test');
const assert = require('node:assert/strict');

const orderRepository = require('../src/repositories/order.repository');
const {
  toOrderCreateData,
  assertEditableStatus,
  validateOrderReferences,
} = require('../src/services/order-access-policy.service');

test('toOrderCreateData forces draft ownership fields and normalizes item defaults', () => {
  const result = toOrderCreateData({
    clientId: 5n,
    warehouseId: 7n,
    status: 'APPROVED',
    approved: true,
    approvedAt: new Date('2026-01-01T00:00:00Z'),
    approvedById: 55n,
    companyId: 999n,
    userId: 999n,
    items: [{ productId: 11n, quantity: 3 }],
  }, {
    companyId: 1n,
    userId: 2n,
  });

  assert.equal(result.companyId, 1n);
  assert.equal(result.userId, 2n);
  assert.equal(result.status, 'DRAFT');
  assert.equal(result.approved, false);
  assert.deepEqual(result.items.create[0], {
    productId: 11n,
    quantity: 3,
    unitPrice: 0,
    discountPercent: 0,
    discountAmount: 0,
    totalDiscount: 0,
    approved: false,
  });
});

test('assertEditableStatus rejects non-draft transitions through the edit endpoint', () => {
  assert.throws(
    () => assertEditableStatus({ status: 'APPROVED' }),
    /no permite cambiar el estado/i,
  );
});

test('validateOrderReferences rejects non-sellable warehouses for order creation', async () => {
  const originalFindWarehouse = orderRepository.findWarehouse;
  orderRepository.findWarehouse = async () => ({ id: 7n, isSellableSource: false, isVirtual: false });

  try {
    await assert.rejects(
      () => validateOrderReferences({ warehouseId: 7n }, 1n),
      /no esta habilitada como fuente de venta/i,
    );
  } finally {
    orderRepository.findWarehouse = originalFindWarehouse;
  }
});
