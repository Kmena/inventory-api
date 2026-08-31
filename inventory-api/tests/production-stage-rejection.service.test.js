/**
 * TASK-004 — Tests for production-stage-loss.service.js
 *
 * Covers: FR-002, FR-003, FR-004, BR-001, BR-002, BR-006
 * AC-002, AC-003, AC-004, AC-010
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const productionRepository = require('../src/repositories/production.repository');
const stageLossService = require('../src/services/production-stage-loss.service');
const { __private__: p } = stageLossService;

const auth = {
  sub: 42,
  companyId: 7,
  permissions: ['production.manage'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Harness — monkey-patch repository
// ─────────────────────────────────────────────────────────────────────────────

const originals = {
  findProductionOrderById: productionRepository.findProductionOrderById,
  findLatestStageExecutionForOrderStage: productionRepository.findLatestStageExecutionForOrderStage,
  findConsumptionsByExecutionId: productionRepository.findConsumptionsByExecutionId,
  createStageLoss: productionRepository.createStageLoss,
  acknowledgeStageExecutionLosses: productionRepository.acknowledgeStageExecutionLosses,
  findStageLossesByOrderAndStage: productionRepository.findStageLossesByOrderAndStage,
};

function patch(overrides) {
  Object.assign(productionRepository, {
    findProductionOrderById: overrides.findProductionOrderById ?? originals.findProductionOrderById,
    findLatestStageExecutionForOrderStage: overrides.findLatestStageExecutionForOrderStage ?? originals.findLatestStageExecutionForOrderStage,
    findConsumptionsByExecutionId: overrides.findConsumptionsByExecutionId ?? originals.findConsumptionsByExecutionId,
    createStageLoss: overrides.createStageLoss ?? originals.createStageLoss,
    acknowledgeStageExecutionLosses: overrides.acknowledgeStageExecutionLosses ?? originals.acknowledgeStageExecutionLosses,
    findStageLossesByOrderAndStage: overrides.findStageLossesByOrderAndStage ?? originals.findStageLossesByOrderAndStage,
  });
}

function restore() {
  Object.assign(productionRepository, originals);
}

async function withPatched(overrides, fn) {
  // Also patch prisma.$transaction to execute the callback with the mock tx (= productionRepository itself)
  const prismaLib = require('../src/lib/prisma');
  const origTransaction = prismaLib.$transaction;
  prismaLib.$transaction = async (cb) => cb(productionRepository);

  patch(overrides);
  try {
    return await fn();
  } finally {
    restore();
    prismaLib.$transaction = origTransaction;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests for private guards
// ─────────────────────────────────────────────────────────────────────────────

test('assertStageExecutionRejected throws 409 stage_not_rejected when status=COMPLETED', () => {
  assert.throws(
    () => p.assertStageExecutionRejected({ id: 1n, status: 'COMPLETED' }),
    (err) => err?.statusCode === 409 && err?.subCode === 'stage_not_rejected',
  );
});

test('assertStageExecutionRejected throws 409 stage_not_rejected when status=undefined', () => {
  assert.throws(
    () => p.assertStageExecutionRejected({ id: 1n }),
    (err) => err?.statusCode === 409 && err?.subCode === 'stage_not_rejected',
  );
});

test('assertStageExecutionRejected does not throw when status=QA_REJECTED', () => {
  assert.doesNotThrow(() => p.assertStageExecutionRejected({ id: 1n, status: 'QA_REJECTED' }));
});

test('assertLossQuantityWithinConsumed allows empty losses array', async () => {
  // Should not call the repository at all
  const calls = [];
  patch({ findConsumptionsByExecutionId: async () => { calls.push(1); return []; } });
  try {
    await p.assertLossQuantityWithinConsumed(1n, []);
    assert.equal(calls.length, 0, 'should not call DB for empty losses');
  } finally {
    restore();
  }
});

test('assertLossQuantityWithinConsumed throws 400 when loss qty > consumed', async () => {
  patch({
    findConsumptionsByExecutionId: async () => [
      { productId: 1n, lotId: 5n, quantity: 10 },
    ],
  });
  try {
    await assert.rejects(
      () => p.assertLossQuantityWithinConsumed(1n, [
        { productId: 1n, lotId: 5n, quantity: 15 },
      ]),
      (err) => err?.statusCode === 400 && err?.code === 'validation_error',
    );
  } finally {
    restore();
  }
});

test('assertLossQuantityWithinConsumed allows loss qty === consumed (boundary)', async () => {
  patch({
    findConsumptionsByExecutionId: async () => [
      { productId: 1n, lotId: 5n, quantity: 10 },
    ],
  });
  try {
    // Should not throw
    await p.assertLossQuantityWithinConsumed(1n, [
      { productId: 1n, lotId: 5n, quantity: 10 },
    ]);
  } finally {
    restore();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// registerStageLosses — happy path
// ─────────────────────────────────────────────────────────────────────────────

test('[AC-002] registerStageLosses happy path — creates losses and acknowledges', async () => {
  const createdLosses = [];
  let acknowledged = false;

  const result = await withPatched({
    findProductionOrderById: async () => ({ id: 100n, companyId: 7n, status: 'QA_HOLD' }),
    findLatestStageExecutionForOrderStage: async () => ({
      id: 50n,
      status: 'QA_REJECTED',
      lossesAcknowledged: false,
      startedAt: new Date(),
      endedAt: new Date(),
      createdAt: new Date(),
    }),
    findConsumptionsByExecutionId: async () => [
      { productId: 1n, lotId: 5n, quantity: 10 },
    ],
    createStageLoss: async (data) => {
      const rec = { id: BigInt(createdLosses.length + 1), ...data, createdAt: new Date() };
      createdLosses.push(rec);
      return rec;
    },
    acknowledgeStageExecutionLosses: async () => { acknowledged = true; return {}; },
  }, async () => stageLossService.registerStageLosses(
    100n,
    1n,
    { losses: [{ productId: 1n, lotId: 5n, quantity: 3.5, reasonCode: 'CONTAMINATED' }] },
    auth,
  ));

  assert.equal(result.lossesAcknowledged, true);
  assert.equal(result.losses.length, 1);
  assert.equal(result.losses[0].reasonCode, 'CONTAMINATED');
  assert.equal(createdLosses.length, 1);
  assert.ok(acknowledged, 'acknowledgeStageExecutionLosses must be called');
});

test('[AC-002 empty] registerStageLosses with losses:[] → 201 with lossesAcknowledged=true', async () => {
  let acknowledged = false;

  const result = await withPatched({
    findProductionOrderById: async () => ({ id: 100n, companyId: 7n, status: 'QA_HOLD' }),
    findLatestStageExecutionForOrderStage: async () => ({
      id: 50n,
      status: 'QA_REJECTED',
      lossesAcknowledged: false,
      startedAt: new Date(),
      endedAt: new Date(),
      createdAt: new Date(),
    }),
    findConsumptionsByExecutionId: async () => [],
    createStageLoss: async () => { throw new Error('should not be called'); },
    acknowledgeStageExecutionLosses: async () => { acknowledged = true; return {}; },
  }, async () => stageLossService.registerStageLosses(
    100n,
    1n,
    { losses: [] },
    auth,
  ));

  assert.equal(result.lossesAcknowledged, true);
  assert.equal(result.losses.length, 0);
  assert.ok(acknowledged, 'acknowledgeStageExecutionLosses must be called even for empty losses');
});

// ─────────────────────────────────────────────────────────────────────────────
// registerStageLosses — error cases
// ─────────────────────────────────────────────────────────────────────────────

test('registerStageLosses → 409 losses_already_declared with inline disposition detail when losses were already acknowledged', async () => {
  await withPatched({
    findProductionOrderById: async () => ({ id: 100n, companyId: 7n, status: 'QA_HOLD' }),
    findLatestStageExecutionForOrderStage: async () => ({
      id: 50n,
      status: 'QA_REJECTED',
      lossesAcknowledged: true,
      qualityInspections: [{
        result: 'REJECTED',
        inspectedAt: new Date('2026-01-01T10:00:00.000Z'),
        inspectorUserId: 42n,
        materialDispositions: [{ productId: '1', lotId: '5', disposition: 'DISCARD', quantity: 3.5 }],
      }],
      startedAt: new Date(),
      endedAt: new Date(),
      createdAt: new Date(),
    }),
  }, async () => {
    await assert.rejects(
      () => stageLossService.registerStageLosses(100n, 1n, { losses: [] }, auth),
      (err) => err?.statusCode === 409
        && err?.code === 'losses_already_declared'
        && Array.isArray(err?.detail?.materialDispositions),
    );
  });
});

test('[AC-003] registerStageLosses → 409 stage_not_rejected when execution.status=COMPLETED', async () => {
  await withPatched({
    findProductionOrderById: async () => ({ id: 100n, companyId: 7n, status: 'IN_PROGRESS' }),
    findLatestStageExecutionForOrderStage: async () => ({
      id: 50n,
      status: 'COMPLETED',
      lossesAcknowledged: false,
      startedAt: new Date(),
      endedAt: new Date(),
      createdAt: new Date(),
    }),
  }, async () => {
    await assert.rejects(
      () => stageLossService.registerStageLosses(100n, 1n, { losses: [] }, auth),
      (err) => err?.statusCode === 409 && err?.subCode === 'stage_not_rejected',
    );
  });
});

test('registerStageLosses → 404 when order not found', async () => {
  await withPatched({
    findProductionOrderById: async () => null,
  }, async () => {
    await assert.rejects(
      () => stageLossService.registerStageLosses(999n, 1n, { losses: [] }, auth),
      (err) => err?.statusCode === 404 && err?.code === 'not_found',
    );
  });
});

test('registerStageLosses → 404 when no execution exists for stage', async () => {
  await withPatched({
    findProductionOrderById: async () => ({ id: 100n, companyId: 7n }),
    findLatestStageExecutionForOrderStage: async () => null,
  }, async () => {
    await assert.rejects(
      () => stageLossService.registerStageLosses(100n, 1n, { losses: [] }, auth),
      (err) => err?.statusCode === 404 && err?.code === 'not_found',
    );
  });
});

test('registerStageLosses → 403 when auth has no companyId', async () => {
  await assert.rejects(
    () => stageLossService.registerStageLosses(100n, 1n, { losses: [] }, { sub: 1 }),
    (err) => err?.statusCode === 403 && err?.code === 'forbidden',
  );
});

test('[AC-004] registerStageLosses → 400 validation_error when loss qty > consumed', async () => {
  await withPatched({
    findProductionOrderById: async () => ({ id: 100n, companyId: 7n }),
    findLatestStageExecutionForOrderStage: async () => ({
      id: 50n,
      status: 'QA_REJECTED',
      lossesAcknowledged: false,
      startedAt: new Date(),
      endedAt: new Date(),
      createdAt: new Date(),
    }),
    findConsumptionsByExecutionId: async () => [
      { productId: 1n, lotId: 5n, quantity: 10 },
    ],
  }, async () => {
    await assert.rejects(
      () => stageLossService.registerStageLosses(100n, 1n, {
        losses: [{ productId: 1n, lotId: 5n, quantity: 15, reasonCode: 'BROKEN' }],
      }, auth),
      (err) => err?.statusCode === 400 && err?.code === 'validation_error',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-010: No stock movement — changeWarehouseStock must NOT be called
// ─────────────────────────────────────────────────────────────────────────────

test('[AC-010] registerStageLosses does NOT call changeWarehouseStock or any inventory function', async () => {
  // We check that inventory-transaction-support is never required/called
  const inventorySupport = require('../src/services/inventory-transaction-support.service');
  const changeWarehouseStockCalls = [];
  const origChange = inventorySupport.changeWarehouseStock;
  inventorySupport.changeWarehouseStock = async (...args) => {
    changeWarehouseStockCalls.push(args);
    return { before: 0, after: 0 };
  };

  try {
    await withPatched({
      findProductionOrderById: async () => ({ id: 100n, companyId: 7n }),
      findLatestStageExecutionForOrderStage: async () => ({
        id: 50n,
        status: 'QA_REJECTED',
        lossesAcknowledged: false,
        startedAt: new Date(),
        endedAt: new Date(),
        createdAt: new Date(),
      }),
      findConsumptionsByExecutionId: async () => [
        { productId: 1n, lotId: 5n, quantity: 10 },
      ],
      createStageLoss: async (data) => ({ id: 1n, ...data, createdAt: new Date() }),
      acknowledgeStageExecutionLosses: async () => ({}),
    }, async () => stageLossService.registerStageLosses(100n, 1n, {
      losses: [{ productId: 1n, lotId: 5n, quantity: 5, reasonCode: 'DAMAGED' }],
    }, auth));
  } finally {
    inventorySupport.changeWarehouseStock = origChange;
  }

  assert.equal(
    changeWarehouseStockCalls.length,
    0,
    'registerStageLosses must NOT call changeWarehouseStock (stock is declarative)',
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// listStageLosses
// ─────────────────────────────────────────────────────────────────────────────

test('listStageLosses returns grouped losses by execution', async () => {
  const execution1 = {
    id: 50n,
    status: 'QA_REJECTED',
    startedAt: new Date('2026-09-10T10:00:00Z'),
    endedAt: new Date('2026-09-10T11:00:00Z'),
    createdAt: new Date('2026-09-10T10:00:00Z'),
    lossesAcknowledged: true,
    lossesAcknowledgedAt: new Date(),
    recipeStageId: 1n,
    stageOrder: 0,
    stageName: 'Mezcla',
  };

  const mockLosses = [
    {
      id: 1n,
      companyId: 7n,
      productionOrderId: 100n,
      stageExecutionId: 50n,
      productId: 1n,
      lotId: 5n,
      quantity: 3.5,
      reasonCode: 'CONTAMINATED',
      note: null,
      registeredByUserId: 42n,
      createdAt: new Date(),
      stageExecution: execution1,
    },
  ];

  const result = await withPatched({
    findProductionOrderById: async () => ({ id: 100n, companyId: 7n }),
    findStageLossesByOrderAndStage: async () => mockLosses,
  }, async () => stageLossService.listStageLosses(100n, 1n, auth));

  assert.equal(result.orderId, 100n);
  assert.equal(result.executions.length, 1);
  assert.equal(result.executions[0].executionId, 50n);
  assert.equal(result.executions[0].losses.length, 1);
  assert.equal(result.executions[0].losses[0].reasonCode, 'CONTAMINATED');
});

test('listStageLosses → 404 when order not found', async () => {
  await withPatched({
    findProductionOrderById: async () => null,
  }, async () => {
    await assert.rejects(
      () => stageLossService.listStageLosses(999n, 1n, auth),
      (err) => err?.statusCode === 404 && err?.code === 'not_found',
    );
  });
});
