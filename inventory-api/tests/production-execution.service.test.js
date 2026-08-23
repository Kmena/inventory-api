const test = require('node:test');
const assert = require('node:assert/strict');

const productionExecutionService = require('../src/services/production-execution.service');
const productionRepository = require('../src/repositories/production.repository');
const inventoryRepository = require('../src/repositories/inventory.repository');
const inventoryTransactionSupport = require('../src/services/inventory-transaction-support.service');
const companyRepository = require('../src/repositories/company.repository');

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
    // DEC-002: getProductionConsumptionTolerance is now called before the transaction;
    // unit tests must stub this to avoid hitting the real DB column (migration not yet applied).
    getProductionConsumptionTolerance: companyRepository.getProductionConsumptionTolerance,
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
  // Stub the company repository's tolerance function with a default 5% unless overridden.
  Object.assign(companyRepository, {
    getProductionConsumptionTolerance: overrides.getProductionConsumptionTolerance
      || (async () => 5.00),
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
      Object.assign(companyRepository, {
        getProductionConsumptionTolerance: originals.getProductionConsumptionTolerance,
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

// TASK-008: QA gate — blocks next stage when previous stage has qaMandatory and no approved QA
test('assertStagePrerequisites blocks next stage when previous stage has qaMandatory and no approved QA (TASK-008)', () => {
  const order = buildOrder({
    // Stage 101 (Mezcla) has qaMandatory: true but no approved QA inspection
    stageExecutions: [
      {
        id: 901n,
        recipeStageId: 101n,
        stageOrder: 0,
        stageName: 'Mezcla',
        endedAt: new Date('2026-08-20T08:30:00.000Z'),
        qualityInspections: [], // no inspections
      },
    ],
  });

  assert.throws(
    () => __private__.assertStagePrerequisites(order, 102n),
    (error) => error?.statusCode === 409 && error?.subCode === 'stage_qa_pending',
    'Must block next stage when previous qaMandatory stage has no approved QA',
  );
});

test('assertStagePrerequisites allows next stage when previous qaMandatory stage has approved QA (TASK-008)', () => {
  const order = buildOrder({
    stageExecutions: [
      {
        id: 901n,
        recipeStageId: 101n,
        stageOrder: 0,
        stageName: 'Mezcla',
        endedAt: new Date('2026-08-20T08:30:00.000Z'),
        qualityInspections: [
          { id: 1001n, result: 'APPROVED' }, // approved QA
        ],
      },
    ],
  });

  // Should NOT throw — previous stage has approved QA
  assert.doesNotThrow(
    () => __private__.assertStagePrerequisites(order, 102n),
    'Must allow next stage when previous stage has approved QA inspection',
  );
});

test('validateConsumptionAgainstRequirement rejects over-consumption without override permission', () => {
  const order = buildOrder();

  assert.throws(
    () => __private__.validateConsumptionAgainstRequirement(order, [{ productId: 31n, quantity: 10.6 }], auth, null),
    (error) => error?.statusCode === 409 && error?.subCode === 'consumption_exceeds_requirement',
  );
});

// TASK-014: tolerancia configurable por empresa leída desde BD
test('validateConsumptionAgainstRequirement uses company tolerancePercent from DB (TASK-014)', () => {
  const order = buildOrder();

  // Con tolerancia 2% (más estricta que el default 5%), 10.21 debe fallar
  assert.throws(
    () => __private__.validateConsumptionAgainstRequirement(order, [{ productId: 31n, quantity: 10.21 }], auth, null, 2.0),
    (error) => error?.statusCode === 409 && error?.subCode === 'consumption_exceeds_requirement',
    'With 2% tolerance, 10.21 on requirement of 10 must be rejected',
  );

  // Con tolerancia 10% (más permisiva), 10.9 debe pasar sin override
  const result = __private__.validateConsumptionAgainstRequirement(
    order,
    [{ productId: 31n, quantity: 10.9 }],
    auth,
    null,
    10.0, // 10% tolerance: allows up to 11.0
  );
  assert.equal(result.exceededProducts.length, 0, 'With 10% tolerance, 10.9 must be accepted');
  assert.equal(result.tolerancePercent, 10.0);
});

test('validateConsumptionAgainstRequirement falls back to 5% when tolerancePercent is undefined (TASK-014)', () => {
  const order = buildOrder();

  // 10.5 + epsilon barely exceeds 5% tolerance (allowed is 10.5)
  const resultWithDefault = __private__.validateConsumptionAgainstRequirement(
    order,
    [{ productId: 31n, quantity: 10.4 }], // within 5% → ok
    auth,
    null,
    undefined, // no tolerancePercent → fallback to 5%
  );
  assert.equal(resultWithDefault.tolerancePercent, 5.00, 'Must fallback to 5.00% when tolerancePercent is undefined');
  assert.equal(resultWithDefault.exceededProducts.length, 0);
});

test('executeProductionStage reads tolerance from companyRepository before transaction (TASK-014)', async () => {
  const toleranceCalls = [];
  const createdExecutions = [];

  await withPatchedDependencies({
    getProductionConsumptionTolerance: async (companyId) => {
      toleranceCalls.push(companyId);
      return 3.00; // custom 3% tolerance
    },
    transaction: async (work) => work({}),
    acquireCompanyInventoryAdvisoryLock: async () => {},
    findProductionOrderById: async () => buildOrder(),
    createProductionStageExecution: async (data) => {
      createdExecutions.push(data);
      return { id: 903n, ...data, consumptions: [], wastes: [], returns: [], qualityInspections: [], createdAt: new Date(), updatedAt: new Date() };
    },
    findProductionStageExecutionById: async () => ({
      id: 903n,
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
      movementGroupId: 'group-tolerance',
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
    await productionExecutionService.executeProductionStage(501n, 101n, {
      startedAt: new Date('2026-08-20T08:00:00.000Z'),
      endedAt: new Date('2026-08-20T08:30:00.000Z'),
      evidence: [],
      consumptions: [],
      waste: [],
    }, overrideAuth);

    // Repository must be called once before the transaction
    assert.equal(toleranceCalls.length, 1, 'getProductionConsumptionTolerance must be called once');
    assert.equal(toleranceCalls[0], 7n, 'Must be called with companyId from auth');
  });
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
