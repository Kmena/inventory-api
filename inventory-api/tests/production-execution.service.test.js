const test = require('node:test');
const assert = require('node:assert/strict');

const productionExecutionService = require('../src/services/production-execution.service');
const productionRepository = require('../src/repositories/production.repository');
const inventoryRepository = require('../src/repositories/inventory.repository');
const inventoryTransactionSupport = require('../src/services/inventory-transaction-support.service');

const { __private__ } = productionExecutionService;

const auth = {
  sub: 99,
  companyId: 7,
  permissions: ['production.execute'],
};

const overrideAuth = {
  sub: 99,
  companyId: 7,
  permissions: ['production.execute', 'production.override'],
};

function buildOrder(overrides = {}) {
  return {
    id: 501n,
    companyId: 7n,
    status: 'IN_PROGRESS',
    originWarehouseId: 5n,
    stageExecutions: [],
    materialRequirements: [
      { productId: 31n, requiredQuantity: 10, unit: 'KG' },
    ],
    recipeVersionSnapshot: {
      recipeVersion: {
        stages: [
          { id: 101, stageOrder: 0, name: 'Mezcla', qaMandatory: true, expectedParameters: [{ name: 'pH', unit: 'pH', expectedValue: 7, minTolerance: 0.5, maxTolerance: 0.5 }] },
          { id: 102, stageOrder: 1, name: 'Envasado', qaMandatory: false, expectedParameters: [] },
        ],
      },
    },
    ...overrides,
  };
}

function withPatchedDependencies(overrides, callback) {
  const originals = {
    transaction: inventoryRepository.transaction,
    acquireCompanyInventoryAdvisoryLock: inventoryRepository.acquireCompanyInventoryAdvisoryLock,
    findLotForProduct: inventoryRepository.findLotForProduct,
    updateProductById: inventoryRepository.updateProductById,
    updateLotById: inventoryRepository.updateLotById,
    findProductionOrderById: productionRepository.findProductionOrderById,
    createProductionStageExecution: productionRepository.createProductionStageExecution,
    createProductionConsumption: productionRepository.createProductionConsumption,
    createProductionWaste: productionRepository.createProductionWaste,
    findProductionStageExecutionById: productionRepository.findProductionStageExecutionById,
    syncProductionItemConsumedQuantity: productionRepository.syncProductionItemConsumedQuantity,
    getInventoryContext: inventoryTransactionSupport.getInventoryContext,
    changeWarehouseStock: inventoryTransactionSupport.changeWarehouseStock,
    changeLotStock: inventoryTransactionSupport.changeLotStock,
    createMovement: inventoryTransactionSupport.createMovement,
  };

  Object.assign(inventoryRepository, {
    transaction: overrides.transaction || originals.transaction,
    acquireCompanyInventoryAdvisoryLock: overrides.acquireCompanyInventoryAdvisoryLock || originals.acquireCompanyInventoryAdvisoryLock,
    findLotForProduct: overrides.findLotForProduct || originals.findLotForProduct,
    updateProductById: overrides.updateProductById || originals.updateProductById,
    updateLotById: overrides.updateLotById || originals.updateLotById,
  });
  Object.assign(productionRepository, {
    findProductionOrderById: overrides.findProductionOrderById || originals.findProductionOrderById,
    createProductionStageExecution: overrides.createProductionStageExecution || originals.createProductionStageExecution,
    createProductionConsumption: overrides.createProductionConsumption || originals.createProductionConsumption,
    createProductionWaste: overrides.createProductionWaste || originals.createProductionWaste,
    findProductionStageExecutionById: overrides.findProductionStageExecutionById || originals.findProductionStageExecutionById,
    syncProductionItemConsumedQuantity: overrides.syncProductionItemConsumedQuantity || originals.syncProductionItemConsumedQuantity,
  });
  Object.assign(inventoryTransactionSupport, {
    getInventoryContext: overrides.getInventoryContext || originals.getInventoryContext,
    changeWarehouseStock: overrides.changeWarehouseStock || originals.changeWarehouseStock,
    changeLotStock: overrides.changeLotStock || originals.changeLotStock,
    createMovement: overrides.createMovement || originals.createMovement,
  });

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      Object.assign(inventoryRepository, {
        transaction: originals.transaction,
        acquireCompanyInventoryAdvisoryLock: originals.acquireCompanyInventoryAdvisoryLock,
        findLotForProduct: originals.findLotForProduct,
        updateProductById: originals.updateProductById,
        updateLotById: originals.updateLotById,
      });
      Object.assign(productionRepository, {
        findProductionOrderById: originals.findProductionOrderById,
        createProductionStageExecution: originals.createProductionStageExecution,
        createProductionConsumption: originals.createProductionConsumption,
        createProductionWaste: originals.createProductionWaste,
        findProductionStageExecutionById: originals.findProductionStageExecutionById,
        syncProductionItemConsumedQuantity: originals.syncProductionItemConsumedQuantity,
      });
      Object.assign(inventoryTransactionSupport, {
        getInventoryContext: originals.getInventoryContext,
        changeWarehouseStock: originals.changeWarehouseStock,
        changeLotStock: originals.changeLotStock,
        createMovement: originals.createMovement,
      });
    });
}

test('assertStagePrerequisites rejects stage execution when a previous stage is incomplete', () => {
  const order = buildOrder({ stageExecutions: [] });

  assert.throws(
    () => __private__.assertStagePrerequisites(order, 102n),
    (error) => error?.statusCode === 409 && error?.subCode === 'stage_out_of_sequence',
  );
});

test('validateConsumptionAgainstRequirement rejects over-consumption without override permission', () => {
  const order = buildOrder();

  assert.throws(
    () => __private__.validateConsumptionAgainstRequirement(order, [{ productId: 31n, quantity: 10.6 }], auth, null),
    (error) => error?.statusCode === 409 && error?.subCode === 'consumption_exceeds_requirement',
  );
});

test('validateQaMeasurements rejects out-of-tolerance values without override', () => {
  const order = buildOrder();
  const stage = order.recipeVersionSnapshot.recipeVersion.stages[0];

  assert.throws(
    () => __private__.validateQaMeasurements(stage, [{ name: 'pH', actualValue: 8 }], auth, null),
    (error) => error?.statusCode === 400 && error?.subCode === 'qa_out_of_tolerance_without_override',
  );
});

// Modelo nuevo: el operador NO registra parametros QA en la ejecucion.
// Los registra el inspector de calidad por separado via POST .../inspections.
// qaOutOfTolerance siempre es false en la ejecucion del operador.
test('executeProductionStage always persists qaOutOfTolerance=false (QA is a separate inspector step)', async () => {
  const createdExecutions = [];

  await withPatchedDependencies({
    transaction: async (work) => work({}),
    acquireCompanyInventoryAdvisoryLock: async () => {},
    findProductionOrderById: async () => buildOrder(),
    createProductionStageExecution: async (data) => {
      createdExecutions.push(data);
      return { id: 901n, ...data, consumptions: [], wastes: [], returns: [], qualityInspections: [], createdAt: new Date(), updatedAt: new Date() };
    },
    findProductionStageExecutionById: async () => ({
      id: 901n,
      productionOrderId: 501n,
      recipeStageId: 101n,
      stageOrder: 0,
      stageName: 'Mezcla',
      responsibleUserId: 99n,
      qaOutOfTolerance: false,
      overrideJustification: null,
      actualParameters: null,
      evidence: [],
      notes: null,
      movementGroupId: 'group-1',
      consumptions: [],
      wastes: [],
      returns: [],
      qualityInspections: [],
      startedAt: new Date('2026-08-20T08:00:00.000Z'),
      endedAt: new Date('2026-08-20T08:30:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  }, async () => {
    const result = await productionExecutionService.executeProductionStage(501n, 101n, {
      startedAt: new Date('2026-08-20T08:00:00.000Z'),
      endedAt: new Date('2026-08-20T08:30:00.000Z'),
      evidence: [],
      consumptions: [],
      waste: [],
    }, overrideAuth);

    assert.equal(createdExecutions.length, 1);
    // El operador no lleva qaOutOfTolerance — eso lo determina el inspector QA
    assert.equal(createdExecutions[0].qaOutOfTolerance, false);
    assert.equal(createdExecutions[0].actualParameters, null);
    assert.equal(result.qaOutOfTolerance, false);
    assert.equal(result.qaApproved, false); // no hay inspecciones aun
  });
});

test('executeProductionStage decrements inventory and records consumptions for selected lots', async () => {
  const recordedConsumptions = [];
  const movementCalls = [];

  await withPatchedDependencies({
    transaction: async (work) => work({}),
    acquireCompanyInventoryAdvisoryLock: async () => {},
    findProductionOrderById: async () => buildOrder({
      recipeVersionSnapshot: {
        recipeVersion: {
          stages: [
            { id: 101, stageOrder: 0, name: 'Mezcla', qaMandatory: false, expectedParameters: [] },
          ],
        },
      },
    }),
    createProductionStageExecution: async (data) => ({ id: 902n, ...data, consumptions: [], wastes: [], returns: [], createdAt: new Date(), updatedAt: new Date() }),
    createProductionConsumption: async (data) => {
      recordedConsumptions.push(data);
      return data;
    },
    createProductionWaste: async () => {},
    syncProductionItemConsumedQuantity: async () => ({ totalConsumed: 4, updatedItemCount: 1 }),
    findProductionStageExecutionById: async () => ({
      id: 902n,
      productionOrderId: 501n,
      recipeStageId: 101n,
      stageOrder: 0,
      stageName: 'Mezcla',
      responsibleUserId: 99n,
      qaOutOfTolerance: false,
      overrideJustification: null,
      actualParameters: [],
      evidence: [],
      notes: null,
      movementGroupId: 'group-2',
      consumptions: recordedConsumptions,
      wastes: [],
      returns: [],
      startedAt: new Date('2026-08-20T08:00:00.000Z'),
      endedAt: new Date('2026-08-20T08:30:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    getInventoryContext: async () => ({
      companyId: 7n,
      warehouse: { id: 5n },
      product: { id: 31n },
    }),
    findLotForProduct: async () => ({ id: 701n }),
    changeWarehouseStock: async () => ({ before: 20, after: 16 }),
    changeLotStock: async () => ({ before: 10, after: 6 }),
    updateProductById: async () => {},
    updateLotById: async () => {},
    createMovement: async (_tx, _context, data) => {
      movementCalls.push(data);
      return data;
    },
  }, async () => {
    const result = await productionExecutionService.executeProductionStage(501n, 101n, {
      startedAt: new Date('2026-08-20T08:00:00.000Z'),
      endedAt: new Date('2026-08-20T08:30:00.000Z'),
      actualParameters: [],
      evidence: [],
      consumptions: [{ productId: 31n, lotId: 701n, quantity: 4, note: 'Consumo lote FEFO seleccionado' }],
      waste: [],
    }, auth);

    assert.equal(recordedConsumptions.length, 1);
    assert.equal(recordedConsumptions[0].lotId, 701n);
    assert.equal(recordedConsumptions[0].quantity, 4);
    assert.equal(movementCalls.length, 1);
    assert.equal(movementCalls[0].reasonCode, 'PRODUCTION_CONSUMPTION');
    assert.equal(result.consumptions.length, 1);
  });
});
