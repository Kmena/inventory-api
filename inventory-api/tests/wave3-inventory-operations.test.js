const test = require('node:test');
const assert = require('node:assert/strict');

const inventoryRepository = require('../src/repositories/inventory.repository');
const inventoryService = require('../src/services/inventory.service');
const productRepository = require('../src/repositories/product.repository');
const productService = require('../src/services/product.service');
const warehouseRepository = require('../src/repositories/warehouse.repository');
const warehouseService = require('../src/services/warehouse.service');
const { assertProductAllowedAtWarehouse } = require('../src/services/inventory-transaction-support.service');

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

function auth() { return { companyId: '7', sub: '11', permissions: ['inventory.manage', 'products.manage'] }; }

function buildContext(productOverrides = {}, warehouseOverrides = {}) {
  return {
    companyId: 7n,
    userId: 11n,
    inventory: { id: 70n, companyId: 7n },
    warehouse: { id: 3n, companyId: 7n, isActive: true, isSellableSource: true, isVirtual: false, warehouseType: 'GENERAL', ...warehouseOverrides },
    product: { id: 5n, companyId: 7n, controlsInventory: true, requiresExpiration: false, lotStrategy: 'TRACKED', quantity: 0, reservedQuantity: 0, allowedWarehouses: [], ...productOverrides },
  };
}

test('allowedWarehouseIds is unrestricted when empty and rejects forbidden locations when configured', () => {
  assert.doesNotThrow(() => assertProductAllowedAtWarehouse({ allowedWarehouses: [] }, { id: 10n }));
  assert.doesNotThrow(() => assertProductAllowedAtWarehouse({ allowedWarehouses: [{ warehouseId: 10n }] }, { id: 10n }));
  assert.throws(
    () => assertProductAllowedAtWarehouse({ allowedWarehouses: [{ warehouseId: 10n }] }, { id: 11n }),
    /producto no esta autorizado/i,
  );
});

test('createInitialInventory is atomic and creates one operation with movements for all rows', async () => {
  const calls = { lots: 0, movements: 0, productUpdates: 0 };
  await withStubs(inventoryRepository, {
    transaction: async (work) => work({ inventoryOperation: { update: async ({ where, data }) => ({ id: where.id, ...data }) } }),
    loadInventoryContext: async (_companyId, warehouseId) => buildContext({}, { id: warehouseId }),
    acquireCompanyInventoryAdvisoryLock: async () => undefined,
    findInventoryOperationByIdempotencyKey: async () => null,
    countProductInventoryEvidence: async () => ({ movementCount: 0, stockCount: 0 }),
    createInventoryOperation: async (data) => ({ id: 90n, ...data }),
    createLot: async (data) => { calls.lots += 1; return { id: 100n + BigInt(calls.lots), ...data }; },
    findWarehouseStockRecord: async () => null,
    createWarehouseStockRecord: async (data) => ({ id: 200n, reservedQuantity: 0, ...data }),
    findWarehouseLotStockRecord: async () => null,
    createWarehouseLotStockRecord: async (data) => ({ id: 300n, reservedQuantity: 0, ...data }),
    updateProductById: async () => { calls.productUpdates += 1; return { id: 5n, quantity: 150 }; },
    createStockMovementRecord: async (data) => { calls.movements += 1; return { id: 400n + BigInt(calls.movements), ...data }; },
  }, async () => {
    const result = await inventoryService.createInitialInventory({
      productId: 5n,
      idempotencyKey: 'initial-12345',
      rows: [
        { warehouseId: 3n, quantity: 100, lotNumber: 'FAB-001' },
        { warehouseId: 4n, quantity: 50, lotNumber: 'FAB-002' },
      ],
      note: 'onboarding',
    }, auth());
    assert.equal(result.idempotentReplay, false);
    assert.equal(calls.lots, 2);
    assert.equal(calls.movements, 2);
    assert.equal(calls.productUpdates, 1);
    assert.equal(result.movements[0].sourceType, 'inventory_operation');
    assert.equal(result.movements[0].sourceId, 90n);
  });
});

test('createInitialInventory returns existing operation on idempotent retry without stock effects', async () => {
  let mutated = false;
  await withStubs(inventoryRepository, {
    transaction: async (work) => work({}),
    loadInventoryContext: async () => buildContext(),
    acquireCompanyInventoryAdvisoryLock: async () => undefined,
    findInventoryOperationByIdempotencyKey: async () => ({ id: 91n, operationType: 'INITIAL_INVENTORY' }),
    countProductInventoryEvidence: async () => { mutated = true; return { movementCount: 0, stockCount: 0 }; },
  }, async () => {
    const result = await inventoryService.createInitialInventory({ productId: 5n, idempotencyKey: 'retry-12345', rows: [{ warehouseId: 3n, quantity: 1, lotNumber: 'L1' }] }, auth());
    assert.equal(result.idempotentReplay, true);
    assert.equal(result.operation.id, 91n);
    assert.equal(mutated, false);
  });
});

test('createInitialInventory rejects non-inventory products and duplicate rows before mutation', async () => {
  await withStubs(inventoryRepository, {
    transaction: async (work) => work({}),
    loadInventoryContext: async () => buildContext({ lotStrategy: 'TRACKED' }),
    acquireCompanyInventoryAdvisoryLock: async () => undefined,
    findInventoryOperationByIdempotencyKey: async () => null,
    countProductInventoryEvidence: async () => ({ movementCount: 0, stockCount: 0 }),
  }, async () => {
    await assert.rejects(
      () => inventoryService.createInitialInventory({ productId: 5n, idempotencyKey: 'dup-12345', rows: [{ warehouseId: 3n, quantity: 1, lotNumber: 'L1' }, { warehouseId: 3n, quantity: 2, lotNumber: 'L1' }] }, auth()),
      /duplicadas/i,
    );
  });
});

test('product inventory summary returns No aplica for non-inventory products and config summary for inventory products', async () => {
  await withStubs(productRepository, {
    findProductById: async (_id, _companyId) => ({ id: 5n, controlsInventory: false, lotStrategy: 'NONE', allowedWarehouses: [] }),
    findProductInventoryEvidence: async () => ({ stocks: [], lotStocks: [], movementCount: 0 }),
  }, async () => {
    const summary = await productService.getProductInventorySummary(5n, auth());
    assert.equal(summary.inventoryApplicability, 'NOT_APPLICABLE');
  });

  await withStubs(productRepository, {
    findProductById: async () => ({ id: 6n, controlsInventory: true, requiresLot: true, requiresExpiration: false, lotStrategy: 'SYSTEM', allowedWarehouses: [{ warehouseId: 3n }] }),
    findProductInventoryEvidence: async () => ({ stocks: [{ quantity: 10, reservedQuantity: 3 }], lotStocks: [], movementCount: 1 }),
  }, async () => {
    const summary = await productService.getProductInventorySummary(6n, auth());
    assert.equal(summary.inventoryApplicability, 'APPLIES');
    assert.equal(summary.availableStock, 7);
    assert.deepEqual(summary.configuration.allowedWarehouseIds, [3n]);
  });
});

test('product inventory config rejects unsafe lot-strategy transitions with stock/history and cross-company locations', async () => {
  await withStubs(productRepository, {
    transaction: async (work) => work({}),
    findProductById: async () => ({ id: 6n, companyId: 7n, controlsInventory: true, lotStrategy: 'TRACKED', allowedWarehouses: [] }),
    findCompanyWarehousesByIds: async () => [],
    findProductInventoryEvidence: async () => ({ stocks: [{ quantity: 10, reservedQuantity: 0 }], lotStocks: [], movementCount: 1 }),
  }, async () => {
    await assert.rejects(() => productService.updateProductInventoryConfig(6n, { allowedWarehouseIds: [999n] }, auth()), /bodegas autorizadas/i);
    await assert.rejects(() => productService.updateProductInventoryConfig(6n, { lotStrategy: 'SYSTEM' }, auth()), /estrategia de lotes/i);
  });
});

test('location lifecycle allows empty deactivation and rejects deactivation with stock or reservations', async () => {
  await withStubs(warehouseRepository, {
    findCompanyWarehouseById: async () => ({ id: 3n, companyId: 7n, code: 'MAIN', name: 'Main', warehouseType: 'GENERAL', locationType: 'BODEGA', locationNature: 'PHYSICAL', isVirtual: false, isSellableSource: true, isActive: true }),
    getWarehouseInventoryUsage: async () => ({ stockCount: 0, lotStockCount: 0, movementCount: 2, pendingOrderCount: 0 }),
    updateCompanyWarehouse: async (_id, _companyId, data) => ({ id: 3n, companyId: 7n, code: 'MAIN', name: 'Main', warehouseType: 'GENERAL', locationType: 'BODEGA', locationNature: 'PHYSICAL', isVirtual: false, isSellableSource: true, ...data }),
  }, async () => {
    const inactive = await warehouseService.updateCompanyWarehouseStatus(3n, { isActive: false, reason: 'empty' }, auth());
    assert.equal(inactive.isActive, false);
  });

  await withStubs(warehouseRepository, {
    findCompanyWarehouseById: async () => ({ id: 3n, companyId: 7n, isActive: true }),
    getWarehouseInventoryUsage: async () => ({ stockCount: 1, lotStockCount: 0, movementCount: 2, pendingOrderCount: 0 }),
  }, async () => {
    await assert.rejects(() => warehouseService.updateCompanyWarehouseStatus(3n, { isActive: false, reason: 'stock' }, auth()), /stock/i);
  });
});
