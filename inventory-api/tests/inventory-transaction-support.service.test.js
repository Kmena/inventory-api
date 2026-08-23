const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getActiveAllocations,
  assertOrderHasOperationalWarehouse,
  sortLotsByFefo,
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

test('sortLotsByFefo returns a deterministic FEFO ordering without mutating the input array', () => {
  const lots = [
    { id: 9n, lot: { expirationDate: null } },
    { id: 2n, lot: { expirationDate: '2026-10-01T00:00:00.000Z' } },
    { id: 1n, lot: { expirationDate: '2026-10-01T00:00:00.000Z' } },
    { id: 5n, lot: { expirationDate: '2026-09-01T00:00:00.000Z' } },
  ];

  const sortedLots = sortLotsByFefo(lots);

  assert.deepEqual(sortedLots.map((entry) => entry.id), [5n, 1n, 2n, 9n]);
  assert.deepEqual(lots.map((entry) => entry.id), [9n, 2n, 1n, 5n]);
});

test('assertOrderHasOperationalWarehouse rejects orders without an assigned warehouse', () => {
  assert.throws(
    () => assertOrderHasOperationalWarehouse({ warehouseId: null }),
    /bodega operativa asignada/i,
  );
});
