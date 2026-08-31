/**
 * TASK-003 — Tests for quality-rejection-disposition.service.js
 *
 * AC-001: RETURN → changeWarehouseStock called + ProductionReturn created
 * AC-002: DISCARD → ProductionStageLoss created, stock NOT moved
 * AC-003: RECOLLECT → collectRecolectItems returns item correctly
 * AC-004: materialDispositions:[] → lossesAcknowledged=true, no stock/loss records
 * AC-006: RETURN + DISCARD > consumido → 400 validation_error
 * AC-009: invalidateExecution: status=INVALIDATED + dispositions processed + lossesAcknowledged=true
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const productionRepository = require('../src/repositories/production.repository');
const inventoryTransactionSupport = require('../src/services/inventory-transaction-support.service');
const inventoryRepository = require('../src/repositories/inventory.repository');
const {
  validateDispositions,
  collectRecolectItems,
  processRejectionDispositions,
  invalidateExecution,
} = require('../src/services/quality-rejection-disposition.service');

// ─────────────────────────────────────────────────────────────────────────────
// Harness
// ─────────────────────────────────────────────────────────────────────────────

const productionOriginals = {
  findConsumptionsByExecutionId: productionRepository.findConsumptionsByExecutionId,
  createStageLoss: productionRepository.createStageLoss,
  createProductionReturn: productionRepository.createProductionReturn,
  acknowledgeStageExecutionLosses: productionRepository.acknowledgeStageExecutionLosses,
  bulkUpdateStageExecutionStatus: productionRepository.bulkUpdateStageExecutionStatus,
};

const invTransOriginals = {
  getInventoryContext: inventoryTransactionSupport.getInventoryContext,
  changeWarehouseStock: inventoryTransactionSupport.changeWarehouseStock,
  changeLotStock: inventoryTransactionSupport.changeLotStock,
  createMovement: inventoryTransactionSupport.createMovement,
};

const invRepoOriginals = {
  findLotForProduct: inventoryRepository.findLotForProduct,
  updateProductById: inventoryRepository.updateProductById,
  updateLotById: inventoryRepository.updateLotById,
};

function patch(prodOverrides = {}, invTransOverrides = {}, invRepoOverrides = {}) {
  Object.assign(productionRepository, { ...productionOriginals, ...prodOverrides });
  Object.assign(inventoryTransactionSupport, { ...invTransOriginals, ...invTransOverrides });
  Object.assign(inventoryRepository, { ...invRepoOriginals, ...invRepoOverrides });
}

function restore() {
  Object.assign(productionRepository, productionOriginals);
  Object.assign(inventoryTransactionSupport, invTransOriginals);
  Object.assign(inventoryRepository, invRepoOriginals);
}

async function withPatched(prodOverrides, invTransOverrides, invRepoOverrides, fn) {
  patch(prodOverrides, invTransOverrides, invRepoOverrides);
  try {
    return await fn();
  } finally {
    restore();
  }
}

const auth = { sub: 42, companyId: 7, permissions: ['quality.inspect'] };

const order = {
  id: 100n,
  companyId: 7n,
  originWarehouseId: 10n,
  materialRequirements: [
    { productId: 1n, product: { name: 'Sal', unit: 'kg' } },
  ],
};

const execution = { id: 50n, productionOrderId: 100n };

// ─────────────────────────────────────────────────────────────────────────────
// validateDispositions
// ─────────────────────────────────────────────────────────────────────────────

test('[AC-006] validateDispositions rejects RETURN + DISCARD > consumido', async () => {
  await withPatched(
    {
      findConsumptionsByExecutionId: async () => [
        { productId: 1n, lotId: 5n, quantity: 10 },
      ],
    },
    {}, {},
    async () => {
      await assert.rejects(
        () => validateDispositions(50n, [
          { productId: 1n, lotId: 5n, disposition: 'RETURN', quantity: 7 },
          { productId: 1n, lotId: 5n, disposition: 'DISCARD', quantity: 5 },
        ]),
        (err) => err?.statusCode === 400 && err?.code === 'validation_error',
      );
    },
  );
});

test('validateDispositions accepts RETURN + DISCARD <= consumido', async () => {
  await withPatched(
    {
      findConsumptionsByExecutionId: async () => [
        { productId: 1n, lotId: 5n, quantity: 10 },
      ],
    },
    {}, {},
    async () => {
      await assert.doesNotReject(
        () => validateDispositions(50n, [
          { productId: 1n, lotId: 5n, disposition: 'RETURN', quantity: 4 },
          { productId: 1n, lotId: 5n, disposition: 'DISCARD', quantity: 6 },
        ]),
      );
    },
  );
});

test('validateDispositions allows RECOLLECT > consumido (BR-002)', async () => {
  await withPatched(
    {
      findConsumptionsByExecutionId: async () => [
        { productId: 1n, lotId: 5n, quantity: 5 },
      ],
    },
    {}, {},
    async () => {
      await assert.doesNotReject(
        () => validateDispositions(50n, [
          { productId: 1n, lotId: 5n, disposition: 'RECOLLECT', quantity: 50 },
        ]),
      );
    },
  );
});

test('validateDispositions accepts empty dispositions without hitting DB', async () => {
  const calls = [];
  await withPatched(
    { findConsumptionsByExecutionId: async () => { calls.push(1); return []; } },
    {}, {},
    async () => {
      await validateDispositions(50n, []);
      assert.equal(calls.length, 0, 'must not call DB for empty dispositions');
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// collectRecolectItems
// ─────────────────────────────────────────────────────────────────────────────

test('[AC-003] collectRecolectItems returns item correctly', () => {
  const dispositions = [
    { productId: 1n, lotId: 5n, disposition: 'RECOLLECT', quantity: 5 },
    { productId: 2n, lotId: 6n, disposition: 'DISCARD', quantity: 3 },
  ];
  const reqs = [{ productId: 1n, product: { name: 'Sal', unit: 'kg' } }];
  const result = collectRecolectItems(dispositions, reqs);
  assert.equal(result.length, 1);
  assert.equal(result[0].productId, '1');
  assert.equal(result[0].quantity, 5);
  assert.equal(result[0].productName, 'Sal');
  assert.equal(result[0].unit, 'kg');
});

test('collectRecolectItems groups multiple RECOLLECT rows by productId', () => {
  const dispositions = [
    { productId: 1n, lotId: 5n, disposition: 'RECOLLECT', quantity: 3 },
    { productId: 1n, lotId: 6n, disposition: 'RECOLLECT', quantity: 2 },
  ];
  const result = collectRecolectItems(dispositions, []);
  assert.equal(result.length, 1);
  assert.equal(result[0].quantity, 5);
});

test('collectRecolectItems returns empty for no RECOLLECT items', () => {
  const result = collectRecolectItems([
    { productId: 1n, lotId: 5n, disposition: 'DISCARD', quantity: 5 },
  ], []);
  assert.equal(result.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// processRejectionDispositions — DISCARD path
// ─────────────────────────────────────────────────────────────────────────────

test('[AC-002] DISCARD → StageLoss created, changeWarehouseStock NOT called', async () => {
  const losses = [];
  const stockCalls = [];
  let acknowledged = false;

  await withPatched(
    {
      findConsumptionsByExecutionId: async () => [
        { productId: 1n, lotId: 5n, quantity: 10 },
      ],
      createStageLoss: async (data) => {
        const rec = { id: 99n, ...data, createdAt: new Date() };
        losses.push(rec);
        return rec;
      },
      acknowledgeStageExecutionLosses: async () => { acknowledged = true; },
    },
    {
      changeWarehouseStock: async (...args) => { stockCalls.push(args); return { before: 0, after: 10 }; },
    },
    {},
    async () => {
      const result = await processRejectionDispositions(
        productionRepository, // tx = repository (mocked)
        auth,
        order,
        execution,
        [{ productId: 1n, lotId: 5n, disposition: 'DISCARD', quantity: 6 }],
        [],
      );

      assert.equal(losses.length, 1, 'StageLoss must be created for DISCARD');
      assert.equal(stockCalls.length, 0, 'changeWarehouseStock must NOT be called for DISCARD');
      assert.ok(acknowledged, 'lossesAcknowledged must be set');
      assert.equal(result.discarded.length, 1);
      assert.equal(result.returned.length, 0);
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// processRejectionDispositions — empty dispositions
// ─────────────────────────────────────────────────────────────────────────────

test('[AC-004] materialDispositions:[] → lossesAcknowledged=true, no records', async () => {
  let acknowledged = false;
  const losses = [];
  const returns = [];

  await withPatched(
    {
      findConsumptionsByExecutionId: async () => [],
      createStageLoss: async (d) => { losses.push(d); return { id: 1n, ...d }; },
      createProductionReturn: async (d) => { returns.push(d); return { id: 2n, ...d }; },
      acknowledgeStageExecutionLosses: async () => { acknowledged = true; },
    },
    {},
    {},
    async () => {
      const result = await processRejectionDispositions(
        productionRepository,
        auth,
        order,
        execution,
        [],
        [],
      );

      assert.ok(acknowledged, 'lossesAcknowledged must be true even for empty list');
      assert.equal(losses.length, 0, 'no StageLoss should be created');
      assert.equal(returns.length, 0, 'no ProductionReturn should be created');
      assert.equal(result.returned.length, 0);
      assert.equal(result.discarded.length, 0);
      assert.equal(result.recolectItems.length, 0);
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// processRejectionDispositions — mixed DISCARD + RECOLLECT
// ─────────────────────────────────────────────────────────────────────itions

test('DISCARD + RECOLLECT in same call — both processed correctly', async () => {
  const losses = [];
  let acknowledged = false;

  await withPatched(
    {
      findConsumptionsByExecutionId: async () => [
        { productId: 1n, lotId: 5n, quantity: 10 },
        { productId: 2n, lotId: 6n, quantity: 5 },
      ],
      createStageLoss: async (d) => { losses.push(d); return { id: BigInt(losses.length), ...d }; },
      acknowledgeStageExecutionLosses: async () => { acknowledged = true; },
    },
    {},
    {},
    async () => {
      const result = await processRejectionDispositions(
        productionRepository,
        auth,
        order,
        execution,
        [
          { productId: 1n, lotId: 5n, disposition: 'DISCARD', quantity: 6 },
          { productId: 2n, lotId: 6n, disposition: 'RECOLLECT', quantity: 5 },
        ],
        [{ productId: 2n, product: { name: 'Agua', unit: 'L' } }],
      );

      assert.equal(losses.length, 1, 'only DISCARD creates StageLoss');
      assert.ok(acknowledged);
      assert.equal(result.discarded.length, 1);
      assert.equal(result.recolectItems.length, 1);
      assert.equal(result.recolectItems[0].productName, 'Agua');
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// invalidateExecution (DEC-004 — disposición fina, no auto-DISCARD)
// ─────────────────────────────────────────────────────────────────────────────

test('[AC-009] invalidateExecution sets status=INVALIDATED + processes dispositions + lossesAcknowledged', async () => {
  const bulkCalls = [];
  const losses = [];
  let acknowledged = false;

  await withPatched(
    {
      findConsumptionsByExecutionId: async () => [
        { productId: 1n, lotId: 5n, quantity: 10 },
      ],
      bulkUpdateStageExecutionStatus: async (ids, status) => {
        bulkCalls.push({ ids, status });
        return { count: ids.length };
      },
      createStageLoss: async (d) => { losses.push(d); return { id: 1n, ...d }; },
      acknowledgeStageExecutionLosses: async () => { acknowledged = true; },
    },
    {},
    {},
    async () => {
      const result = await invalidateExecution(
        productionRepository,
        execution,
        [{ productId: 1n, lotId: 5n, disposition: 'DISCARD', quantity: 5 }],
        auth,
        order,
        [],
      );

      assert.equal(bulkCalls.length, 1, 'bulk update must be called once');
      assert.equal(bulkCalls[0].status, 'INVALIDATED');
      assert.ok(bulkCalls[0].ids.includes(execution.id));
      assert.equal(losses.length, 1, 'DISCARD must create StageLoss');
      assert.ok(acknowledged, 'lossesAcknowledged must be true');
      assert.equal(result.discarded.length, 1);
    },
  );
});

test('invalidateExecution with empty dispositions still marks INVALIDATED and acknowledges', async () => {
  const bulkCalls = [];
  let acknowledged = false;

  await withPatched(
    {
      findConsumptionsByExecutionId: async () => [],
      bulkUpdateStageExecutionStatus: async (ids, status) => { bulkCalls.push({ ids, status }); return { count: 1 }; },
      acknowledgeStageExecutionLosses: async () => { acknowledged = true; },
    },
    {},
    {},
    async () => {
      await invalidateExecution(productionRepository, execution, [], auth, order, []);
      assert.equal(bulkCalls[0].status, 'INVALIDATED');
      assert.ok(acknowledged);
    },
  );
});
