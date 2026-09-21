const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const inventoryRepository = require('../src/repositories/inventory.repository');
const inventoryService = require('../src/services/inventory.service');

function withStubs(target, stubs, run) {
  const originals = new Map();
  for (const [key, value] of Object.entries(stubs)) {
    originals.set(key, target[key]);
    target[key] = value;
  }
  return Promise.resolve().then(run).finally(() => {
    for (const [key, value] of originals.entries()) target[key] = value;
  });
}

function auth() { return { companyId: '7', sub: '11', permissions: ['inventory.manage'] }; }

function buildContext(warehouseId, productOverrides = {}) {
  return {
    companyId: 7n,
    userId: 11n,
    inventory: { id: 70n, companyId: 7n },
    warehouse: { id: BigInt(warehouseId), companyId: 7n, isActive: true, isSellableSource: true, isVirtual: false, warehouseType: 'GENERAL' },
    product: { id: 5n, companyId: 7n, controlsInventory: true, lotStrategy: 'TRACKED', allowedWarehouses: [], ...productOverrides },
  };
}

test('adjustStock creates an InventoryOperation and movement group for manual adjustments', async () => {
  await withStubs(inventoryRepository, {
    transaction: async (work) => work({}),
    loadInventoryContext: async (_companyId, warehouseId) => buildContext(warehouseId),
    acquireCompanyInventoryAdvisoryLock: async () => undefined,
    findInventoryOperationByIdempotencyKey: async () => null,
    createInventoryOperation: async (data) => ({ id: 90n, ...data }),
    findLotForProduct: async () => ({ id: 30n, productId: 5n, quantity: 10, isSystemGenerated: false }),
    findWarehouseStockRecord: async () => ({ id: 100n, quantity: 10, reservedQuantity: 0 }),
    updateWarehouseStockRecord: async () => ({ count: 1 }),
    findWarehouseStockRecordById: async () => ({ id: 100n, warehouseId: 3n, productId: 5n, quantity: 8, reservedQuantity: 0 }),
    findWarehouseLotStockRecord: async () => ({ id: 200n, warehouseId: 3n, lotId: 30n, productId: 5n, quantity: 10, reservedQuantity: 0 }),
    updateWarehouseLotStockRecord: async () => ({ count: 1 }),
    findWarehouseLotStockRecordById: async () => ({ id: 200n, warehouseId: 3n, lotId: 30n, productId: 5n, quantity: 8, reservedQuantity: 0 }),
    updateProductById: async () => ({ id: 5n, quantity: 8 }),
    updateLotById: async (_id, data) => ({ id: 30n, ...data }),
    createStockMovementRecord: async (data) => ({ id: 500n, ...data }),
  }, async () => {
    const result = await inventoryService.adjustStock({
      warehouseId: 3n,
      productId: 5n,
      quantity: 2,
      direction: 'OUT',
      reasonCode: 'COUNT_CORRECTION',
      note: 'Conteo fisico',
      lotId: 30n,
      idempotencyKey: 'adjust-12345',
    }, auth());

    assert.equal(result.operation.operationType, 'ADJUSTMENT');
    assert.equal(result.movement.sourceType, 'inventory_operation');
    assert.equal(result.movement.sourceId, 90n);
    assert.equal(result.movement.movementGroupId, result.operation.movementGroupId);
  });
});

test('transferInventory creates balanced transfer movements and preserves product total', async () => {
  const movements = [];
  let productUpdated = false;
  await withStubs(inventoryRepository, {
    transaction: async (work) => work({}),
    loadInventoryContext: async (_companyId, warehouseId) => buildContext(warehouseId),
    acquireCompanyInventoryAdvisoryLock: async () => undefined,
    findInventoryOperationByIdempotencyKey: async () => null,
    createInventoryOperation: async (data) => ({ id: 91n, ...data }),
    findLotForProduct: async () => ({ id: 30n, productId: 5n, quantity: 10, isSystemGenerated: false }),
    findWarehouseStockRecord: async (warehouseId) => ({ id: warehouseId === 3n ? 101n : 102n, warehouseId, productId: 5n, quantity: warehouseId === 3n ? 10 : 1, reservedQuantity: 0 }),
    updateWarehouseStockRecord: async () => ({ count: 1 }),
    findWarehouseStockRecordById: async (id) => ({ id, productId: 5n, quantity: id === 101n ? 7 : 4, reservedQuantity: 0 }),
    findWarehouseLotStockRecord: async (warehouseId) => ({ id: warehouseId === 3n ? 201n : 202n, warehouseId, lotId: 30n, productId: 5n, quantity: warehouseId === 3n ? 10 : 1, reservedQuantity: 0 }),
    updateWarehouseLotStockRecord: async () => ({ count: 1 }),
    findWarehouseLotStockRecordById: async (id) => ({ id, productId: 5n, lotId: 30n, quantity: id === 201n ? 7 : 4, reservedQuantity: 0 }),
    updateProductById: async () => { productUpdated = true; return null; },
    updateLotById: async (_id, data) => ({ id: 30n, ...data }),
    createStockMovementRecord: async (data) => { movements.push(data); return { id: BigInt(500 + movements.length), ...data }; },
  }, async () => {
    const result = await inventoryService.transferInventory({
      sourceWarehouseId: 3n,
      destinationWarehouseId: 4n,
      productId: 5n,
      quantity: 3,
      lotId: 30n,
      reasonCode: 'REBALANCE',
      note: 'Rebalanceo operativo',
      idempotencyKey: 'transfer-12345',
    }, auth());

    assert.equal(result.operation.operationType, 'TRANSFER');
    assert.equal(result.movements.length, 2);
    assert.deepEqual(movements.map((movement) => movement.movementType), ['TRANSFER_OUT', 'TRANSFER_IN']);
    assert.equal(movements[0].movementGroupId, movements[1].movementGroupId);
    assert.equal(productUpdated, false, 'transfers must not change aggregate product quantity');
  });
});

test('transferInventory returns idempotent operation without stock effects on retry', async () => {
  let mutated = false;
  await withStubs(inventoryRepository, {
    transaction: async (work) => work({}),
    loadInventoryContext: async (_companyId, warehouseId) => buildContext(warehouseId),
    acquireCompanyInventoryAdvisoryLock: async () => undefined,
    findInventoryOperationByIdempotencyKey: async () => ({ id: 92n, operationType: 'TRANSFER' }),
    findLotForProduct: async () => { mutated = true; return null; },
  }, async () => {
    const result = await inventoryService.transferInventory({
      sourceWarehouseId: 3n,
      destinationWarehouseId: 4n,
      productId: 5n,
      quantity: 1,
      lotId: 30n,
      reasonCode: 'RETRY',
      idempotencyKey: 'transfer-retry-12345',
    }, auth());

    assert.equal(result.idempotentReplay, true);
    assert.equal(result.operation.id, 92n);
    assert.equal(mutated, false);
  });
});

test('transfer stock movement enum values are present in Prisma schema and migration', () => {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'schema.prisma'), 'utf8');
  const migration = fs.readFileSync(
    path.join(__dirname, '..', 'prisma', 'migrations', '20261027000000_add_transfer_stock_movement_types', 'migration.sql'),
    'utf8',
  );

  const enumBlock = schema.match(/enum\s+StockMovementType\s+\{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(enumBlock, /\bTRANSFER_OUT\b/);
  assert.match(enumBlock, /\bTRANSFER_IN\b/);
  assert.match(migration, /ALTER TYPE "StockMovementType" ADD VALUE 'TRANSFER_OUT'/);
  assert.match(migration, /ALTER TYPE "StockMovementType" ADD VALUE 'TRANSFER_IN'/);
  assert.match(migration, /pg_enum/);
});

test('transferInventory rejects same source and destination before mutation', async () => {
  await assert.rejects(
    () => inventoryService.transferInventory({
      sourceWarehouseId: 3n,
      destinationWarehouseId: 3n,
      productId: 5n,
      quantity: 1,
      reasonCode: 'BAD',
      idempotencyKey: 'same-warehouse-12345',
    }, auth()),
    /origen y destino deben ser diferentes/i,
  );
});
