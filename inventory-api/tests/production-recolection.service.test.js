/**
 * TASK-006 — Tests for production-recolection.service.js
 *
 * AC-011: confirmation sets status=COMPLETED, completedByUserId, completedAt
 * AC-011b: 409 when already COMPLETED
 * AC-011c: 404 when recolection not found
 * AC-011d: 409 when order not IN_PROGRESS or QA_HOLD
 * AC-011e: cross-tenant guard — recolection from different order → 409
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const productionRepository = require('../src/repositories/production.repository');
const recolectionService = require('../src/services/production-recolection.service');

// ─────────────────────────────────────────────────────────────────────────────
// Harness
// ─────────────────────────────────────────────────────────────────────────────

const originals = {
  findProductionOrderById: productionRepository.findProductionOrderById,
  findRecolectionStageById: productionRepository.findRecolectionStageById,
  updateRecolectionStage: productionRepository.updateRecolectionStage,
};

function patch(overrides = {}) {
  Object.assign(productionRepository, { ...originals, ...overrides });
}
function restore() {
  Object.assign(productionRepository, originals);
}
async function withPatched(overrides, fn) {
  patch(overrides);
  try { return await fn(); } finally { restore(); }
}

const auth = { sub: 42, companyId: 7, permissions: ['production.execute'] };

const validOrder = {
  id: 100n, companyId: 7n, status: 'QA_HOLD',
};
const pendingRecolection = {
  id: 55n, companyId: 7n, productionOrderId: 100n,
  rejectedExecutionId: 901n, recipeStageId: 101n,
  status: 'PENDING', requiredItems: [{ productId: '1', quantity: 5 }],
  createdAt: new Date(),
};

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

test('[AC-011] confirmRecolection sets status=COMPLETED with completedByUserId and completedAt', async () => {
  const updates = [];

  await withPatched({
    findProductionOrderById: async () => validOrder,
    findRecolectionStageById: async () => pendingRecolection,
    updateRecolectionStage: async (id, data) => {
      updates.push({ id, data });
      return { ...pendingRecolection, ...data };
    },
  }, async () => {
    const result = await recolectionService.confirmRecolection(100n, 55n, { notes: 'Material recogido' }, auth);

    assert.equal(updates.length, 1, 'updateRecolectionStage must be called once');
    assert.equal(updates[0].data.status, 'COMPLETED');
    assert.equal(String(updates[0].data.completedByUserId), '42');
    assert.ok(updates[0].data.completedAt instanceof Date, 'completedAt must be a Date');
    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.notes, 'Material recogido');
  });
});

test('[AC-011b] confirmRecolection returns 409 when already COMPLETED', async () => {
  const completedRecolection = { ...pendingRecolection, status: 'COMPLETED' };

  await withPatched({
    findProductionOrderById: async () => validOrder,
    findRecolectionStageById: async () => completedRecolection,
  }, async () => {
    await assert.rejects(
      () => recolectionService.confirmRecolection(100n, 55n, {}, auth),
      (err) => err?.statusCode === 409,
    );
  });
});

test('[AC-011c] confirmRecolection returns 404 when recolection not found', async () => {
  await withPatched({
    findProductionOrderById: async () => validOrder,
    findRecolectionStageById: async () => null,
  }, async () => {
    await assert.rejects(
      () => recolectionService.confirmRecolection(100n, 99n, {}, auth),
      (err) => err?.statusCode === 404,
    );
  });
});

test('[AC-011d] confirmRecolection returns 404 when order not found', async () => {
  await withPatched({
    findProductionOrderById: async () => null,
  }, async () => {
    await assert.rejects(
      () => recolectionService.confirmRecolection(999n, 55n, {}, auth),
      (err) => err?.statusCode === 404,
    );
  });
});

test('[AC-011d] confirmRecolection returns 409 when order not IN_PROGRESS or QA_HOLD', async () => {
  const cancelledOrder = { ...validOrder, status: 'CANCELLED' };

  await withPatched({
    findProductionOrderById: async () => cancelledOrder,
  }, async () => {
    await assert.rejects(
      () => recolectionService.confirmRecolection(100n, 55n, {}, auth),
      (err) => err?.statusCode === 409,
    );
  });
});

test('[AC-011e] confirmRecolection returns 409 when recolection belongs to different order', async () => {
  const otherOrderRecolection = { ...pendingRecolection, productionOrderId: 999n };

  await withPatched({
    findProductionOrderById: async () => validOrder,
    findRecolectionStageById: async () => otherOrderRecolection,
  }, async () => {
    await assert.rejects(
      () => recolectionService.confirmRecolection(100n, 55n, {}, auth),
      (err) => err?.statusCode === 409,
    );
  });
});

test('confirmRecolection trims notes and stores null for empty string', async () => {
  const updates = [];

  await withPatched({
    findProductionOrderById: async () => validOrder,
    findRecolectionStageById: async () => pendingRecolection,
    updateRecolectionStage: async (id, data) => {
      updates.push({ id, data });
      return { ...pendingRecolection, ...data };
    },
  }, async () => {
    await recolectionService.confirmRecolection(100n, 55n, { notes: '   ' }, auth);
    assert.equal(updates[0].data.notes, null, 'Blank notes must be stored as null');
  });
});

test('confirmRecolection accepts missing notes gracefully', async () => {
  const updates = [];

  await withPatched({
    findProductionOrderById: async () => validOrder,
    findRecolectionStageById: async () => pendingRecolection,
    updateRecolectionStage: async (id, data) => {
      updates.push({ id, data });
      return { ...pendingRecolection, ...data };
    },
  }, async () => {
    await recolectionService.confirmRecolection(100n, 55n, {}, auth);
    assert.equal(updates[0].data.notes, null, 'Missing notes must be stored as null');
  });
});
