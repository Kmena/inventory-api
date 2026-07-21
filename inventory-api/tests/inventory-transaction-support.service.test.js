const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getActiveAllocations,
  assertOrderHasOperationalWarehouse,
} = require('../src/services/inventory-transaction-support.service');

test('getActiveAllocations derives the net reserved balance per product and lot', async () => {
  const tx = {
    stockMovement: {
      findMany: async () => ([
        { id: 1n, productId: 10n, lotId: 100n, quantity: 5, movementType: 'RESERVE' },
        { id: 2n, productId: 10n, lotId: 100n, quantity: 2, movementType: 'RELEASE' },
        { id: 3n, productId: 10n, lotId: 100n, quantity: 1, movementType: 'OUT' },
        { id: 4n, productId: 10n, lotId: null, quantity: 4, movementType: 'RESERVE' },
      ]),
    },
  };

  const allocations = await getActiveAllocations(tx, {
    id: 77n,
    companyId: 1n,
    warehouseId: 8n,
  });

  assert.deepEqual(allocations, [
    { productId: 10n, lotId: 100n, quantity: 2 },
    { productId: 10n, lotId: null, quantity: 4 },
  ]);
});

test('assertOrderHasOperationalWarehouse rejects orders without an assigned warehouse', () => {
  assert.throws(
    () => assertOrderHasOperationalWarehouse({ warehouseId: null }),
    /bodega operativa asignada/i,
  );
});
