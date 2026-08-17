const test = require('node:test');
const assert = require('node:assert/strict');

const productRepository = require('../src/repositories/product.repository');
const productionRepository = require('../src/repositories/production.repository');
const inventoryRepository = require('../src/repositories/inventory.repository');
const inventoryTransactionSupport = require('../src/services/inventory-transaction-support.service');
const qualityService = require('../src/services/quality.service');
const productionService = require('../src/services/production.service');
const { productionCompletionSchema } = require('../src/schemas/production.schema');

const auth = {
  sub: 99,
  companyId: 7,
  permissions: ['production.complete'],
};

function buildOrder(overrides = {}) {
  return {
    id: 501n,
    companyId: 7n,
    productId: 11n,
    originWarehouseId: 5n,
    destinationWarehouseId: 6n,
    status: 'IN_PROGRESS',
    productionLotCode: 'PROD-LOT-001',
    productionDate: new Date('2026-08-18'),
    expirationDate: new Date('2027-08-18'),
    recipeVersionSnapshot: {
      recipeVersion: {
        stages: [
          { id: 101, stageOrder: 0, name: 'Mezcla', qaMandatory: false },
        ],
      },
    },
    ...overrides,
  };
}

function buildProduct(overrides = {}) {
  return {
    id: 11n,
    companyId: 7n,
    code: 'FG-11',
    name: 'Shampoo final',
    unit: 'KG',
    requiresLot: true,
    requiresExpiration: true,
    isActive: true,
    ...overrides,
  };
}

// --- Harness ---

const originals = {};

function captureOriginals() {
  originals.productRepo = {
    findProductById: productRepository.findProductById,
  };
  originals.productionRepo = {
    findProductionOrderById: productionRepository.findProductionOrderById,
    updateProductionOrder: productionRepository.updateProductionOrder,
  };
  originals.inventoryRepo = {
    transaction: inventoryRepository.transaction,
    acquireCompanyInventoryAdvisoryLock: inventoryRepository.acquireCompanyInventoryAdvisoryLock,
    createLot: inventoryRepository.createLot,
    updateProductById: inventoryRepository.updateProductById,
  };
  originals.inventoryTxSupport = {
    getInventoryContext: inventoryTransactionSupport.getInventoryContext,
    changeWarehouseStock: inventoryTransactionSupport.changeWarehouseStock,
    changeLotStock: inventoryTransactionSupport.changeLotStock,
    createMovement: inventoryTransactionSupport.createMovement,
    resolveUniqueInternalLotNumber: inventoryTransactionSupport.resolveUniqueInternalLotNumber,
  };
  originals.qualitySvc = {
    checkMandatoryQaGatesForOrder: qualityService.checkMandatoryQaGatesForOrder,
  };
}

function patchAll(overrides) {
  captureOriginals();

  Object.assign(productRepository, {
    findProductById: overrides.findProductById || originals.productRepo.findProductById,
  });
  Object.assign(productionRepository, {
    findProductionOrderById: overrides.findProductionOrderById || originals.productionRepo.findProductionOrderById,
    updateProductionOrder: overrides.updateProductionOrder || originals.productionRepo.updateProductionOrder,
  });
  Object.assign(inventoryRepository, {
    transaction: overrides.transaction || originals.inventoryRepo.transaction,
    acquireCompanyInventoryAdvisoryLock: overrides.acquireCompanyInventoryAdvisoryLock || originals.inventoryRepo.acquireCompanyInventoryAdvisoryLock,
    createLot: overrides.createLot || originals.inventoryRepo.createLot,
    updateProductById: overrides.updateProductById || originals.inventoryRepo.updateProductById,
  });
  Object.assign(inventoryTransactionSupport, {
    getInventoryContext: overrides.getInventoryContext || originals.inventoryTxSupport.getInventoryContext,
    changeWarehouseStock: overrides.changeWarehouseStock || originals.inventoryTxSupport.changeWarehouseStock,
    changeLotStock: overrides.changeLotStock || originals.inventoryTxSupport.changeLotStock,
    createMovement: overrides.createMovement || originals.inventoryTxSupport.createMovement,
    resolveUniqueInternalLotNumber: overrides.resolveUniqueInternalLotNumber || originals.inventoryTxSupport.resolveUniqueInternalLotNumber,
  });
  Object.assign(qualityService, {
    checkMandatoryQaGatesForOrder: overrides.checkMandatoryQaGatesForOrder || originals.qualitySvc.checkMandatoryQaGatesForOrder,
  });
}

function restoreAll() {
  Object.assign(productRepository, originals.productRepo);
  Object.assign(productionRepository, originals.productionRepo);
  Object.assign(inventoryRepository, originals.inventoryRepo);
  Object.assign(inventoryTransactionSupport, originals.inventoryTxSupport);
  Object.assign(qualityService, originals.qualitySvc);
}

async function withPatched(overrides, testFn) {
  patchAll(overrides);
  try {
    await testFn();
  } finally {
    restoreAll();
  }
}

function buildCompletionMocks(overrides = {}) {
  const movements = [];
  const lotsCreated = [];
  const orderUpdates = [];

  return {
    mocks: {
      transaction: async (work) => work({ txId: 'completion' }),
      acquireCompanyInventoryAdvisoryLock: async () => {},
      findProductionOrderById: overrides.findProductionOrderById || (async () => buildOrder()),
      findProductById: overrides.findProductById || (async () => buildProduct()),
      checkMandatoryQaGatesForOrder: overrides.checkMandatoryQaGatesForOrder || (async () => ({
        allMandatoryGatesPassed: true,
        pendingStages: [],
        rejectedStages: [],
      })),
      resolveUniqueInternalLotNumber: async (_tx, _companyId, code) => ({
        requested: code,
        assigned: code,
        collision: false,
      }),
      createLot: async (data) => {
        const lot = { id: 800n, ...data, createdAt: new Date(), updatedAt: new Date() };
        lotsCreated.push(lot);
        return lot;
      },
      getInventoryContext: async (_tx, _auth, warehouseId, productId) => ({
        companyId: 7n,
        userId: 99n,
        inventory: { id: 1n },
        warehouse: { id: BigInt(warehouseId) },
        product: { id: BigInt(productId), requiresLot: true },
      }),
      changeWarehouseStock: async () => ({ before: 0, after: 100 }),
      changeLotStock: async () => ({ before: 0, after: 100 }),
      updateProductById: async () => ({}),
      createMovement: async (_tx, _ctx, data) => {
        movements.push(data);
        return { id: 5001n, ...data };
      },
      updateProductionOrder: async (id, companyId, data) => {
        orderUpdates.push({ id, companyId, data });
        return { ...buildOrder(), ...data };
      },
    },
    captures: { movements, lotsCreated, orderUpdates },
  };
}

// --- Schema tests ---

test('productionCompletionSchema accepts a valid completion payload', () => {
  const result = productionCompletionSchema.safeParse({
    producedQuantity: 100,
    lotCode: 'PROD-LOT-001',
    expirationDate: '2027-08-18T00:00:00.000Z',
    productionDate: '2026-08-18T00:00:00.000Z',
    note: 'Completado sin observaciones',
  });
  assert.ok(result.success, `Schema must accept valid payload: ${JSON.stringify(result.error?.issues)}`);
  assert.equal(result.data.producedQuantity, 100);
});

test('productionCompletionSchema requires producedQuantity > 0', () => {
  const zero = productionCompletionSchema.safeParse({ producedQuantity: 0 });
  assert.ok(!zero.success);

  const negative = productionCompletionSchema.safeParse({ producedQuantity: -5 });
  assert.ok(!negative.success);
});

test('productionCompletionSchema accepts minimal payload with only producedQuantity', () => {
  const result = productionCompletionSchema.safeParse({ producedQuantity: 50 });
  assert.ok(result.success);
});

test('productionCompletionSchema rejects unexpected fields', () => {
  const result = productionCompletionSchema.safeParse({ producedQuantity: 50, unexpected: 'x' });
  assert.ok(!result.success);
});

// --- Service tests ---

test('completeProductionOrder creates lot, stock, movement and transitions to COMPLETED', async () => {
  const { mocks, captures } = buildCompletionMocks();

  await withPatched(mocks, async () => {
    const result = await productionService.completeProductionOrder(501n, {
      producedQuantity: 100,
    }, auth);

    assert.equal(result.status, 'COMPLETED');
    assert.equal(captures.lotsCreated.length, 1);
    assert.equal(captures.lotsCreated[0].productId, 11n);
    assert.equal(Number(captures.lotsCreated[0].quantity), 100);
    assert.equal(captures.lotsCreated[0].status, 'AVAILABLE');
    assert.equal(captures.lotsCreated[0].qaStatus, 'APPROVED');
    assert.equal(captures.movements.length, 1);
    assert.equal(captures.movements[0].reasonCode, 'PRODUCTION_RECEIPT');
    assert.equal(captures.movements[0].movementType, 'IN');
    assert.equal(captures.movements[0].sourceType, 'production_order');
    assert.equal(captures.movements[0].sourceId, 501n);
    assert.equal(Number(captures.movements[0].quantity), 100);
    assert.equal(captures.orderUpdates.length, 1);
    assert.equal(captures.orderUpdates[0].data.status, 'COMPLETED');
  });
});

test('completeProductionOrder uses custom lotCode and dates from payload', async () => {
  const { mocks, captures } = buildCompletionMocks();

  await withPatched(mocks, async () => {
    await productionService.completeProductionOrder(501n, {
      producedQuantity: 50,
      lotCode: 'CUSTOM-LOT',
      productionDate: new Date('2026-09-01'),
      expirationDate: new Date('2027-09-01'),
    }, auth);

    assert.equal(captures.lotsCreated[0].lotNumber, 'CUSTOM-LOT');
    assert.equal(captures.lotsCreated[0].productionDate.toISOString(), new Date('2026-09-01').toISOString());
    assert.equal(captures.lotsCreated[0].expirationDate.toISOString(), new Date('2027-09-01').toISOString());
  });
});

test('completeProductionOrder rejects when mandatory QA gates are not passed', async () => {
  const { mocks } = buildCompletionMocks({
    checkMandatoryQaGatesForOrder: async () => ({
      allMandatoryGatesPassed: false,
      pendingStages: [{ stageId: 101, stageName: 'Mezcla', reason: 'qa_inspection_missing' }],
      rejectedStages: [],
    }),
  });

  await withPatched(mocks, async () => {
    await assert.rejects(
      () => productionService.completeProductionOrder(501n, { producedQuantity: 100 }, auth),
      (error) => error?.statusCode === 409 && error?.code === 'conflict',
    );
  });
});

test('completeProductionOrder rejects when order is not IN_PROGRESS', async () => {
  const { mocks } = buildCompletionMocks({
    findProductionOrderById: async () => buildOrder({ status: 'QA_HOLD' }),
  });

  await withPatched(mocks, async () => {
    await assert.rejects(
      () => productionService.completeProductionOrder(501n, { producedQuantity: 100 }, auth),
      (error) => error?.statusCode === 409 && error?.code === 'conflict',
    );
  });
});

test('completeProductionOrder rejects non-existent order', async () => {
  const { mocks } = buildCompletionMocks({
    findProductionOrderById: async () => null,
  });

  await withPatched(mocks, async () => {
    await assert.rejects(
      () => productionService.completeProductionOrder(999n, { producedQuantity: 100 }, auth),
      (error) => error?.statusCode === 404 && error?.code === 'not_found',
    );
  });
});

test('completeProductionOrder rejects when product requires expiration and none is provided', async () => {
  const { mocks } = buildCompletionMocks({
    findProductionOrderById: async () => buildOrder({ expirationDate: null }),
    findProductById: async () => buildProduct({ requiresExpiration: true }),
  });

  await withPatched(mocks, async () => {
    await assert.rejects(
      () => productionService.completeProductionOrder(501n, { producedQuantity: 100 }, auth),
      (error) => error?.statusCode === 400 && error?.code === 'validation_error',
    );
  });
});

test('completeProductionOrder accepts expiration from order when not in payload', async () => {
  const { mocks, captures } = buildCompletionMocks({
    findProductById: async () => buildProduct({ requiresExpiration: true }),
  });

  await withPatched(mocks, async () => {
    await productionService.completeProductionOrder(501n, { producedQuantity: 75 }, auth);

    assert.ok(captures.lotsCreated[0].expirationDate, 'Lot must have expiration from order');
    assert.equal(captures.lotsCreated[0].expirationDate.toISOString(), new Date('2027-08-18').toISOString());
  });
});

test('completeProductionOrder generates PRODUCTION_RECEIPT movement distinct from generic stock entries', async () => {
  const { mocks, captures } = buildCompletionMocks();

  await withPatched(mocks, async () => {
    await productionService.completeProductionOrder(501n, { producedQuantity: 100 }, auth);

    assert.equal(captures.movements[0].reasonCode, 'PRODUCTION_RECEIPT');
    assert.notEqual(captures.movements[0].reasonCode, 'PURCHASE_RECEIPT');
    assert.notEqual(captures.movements[0].reasonCode, 'ADJUSTMENT');
  });
});
