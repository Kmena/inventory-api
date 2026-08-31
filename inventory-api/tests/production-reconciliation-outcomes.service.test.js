/**
 * Tests for TASK-006: reconciliation outcomes and balance computation
 *
 * Feature: qa-rejection-material-reconciliation-amendment (TASK-006)
 *
 * Covers:
 * - computeReconciliationBalance aggregates correctly
 * - complete=true when all entries reconciled
 * - remainingBalances reports unreconciled lots
 * - recordReconciliationOutcomes validations (outcome values, quantity limits, closed stage)
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computeReconciliationBalance,
  recordReconciliationOutcomes,
  RECONCILIATION_OUTCOMES,
} = require('../src/services/production-recolection.service');

const productionRepository = require('../src/repositories/production.repository');

// ─── computeReconciliationBalance ─────────────────────────────────────────────

test('[AC-005] computeReconciliationBalance returns complete=true when fully reconciled (TASK-006)', () => {
  const entries = [
    { productId: 1n, lotId: 50n, quantity: 5 },
    { productId: 2n, lotId: 51n, quantity: 3 },
  ];

  const records = [
    { productId: 1n, lotId: 50n, quantity: 5, outcome: 'USED' },
    { productId: 2n, lotId: 51n, quantity: 3, outcome: 'DISCARDED' },
  ];

  const result = computeReconciliationBalance(entries, records);
  assert.equal(result.complete, true);
  assert.equal(result.remainingBalances.length, 0);
});

test('[AC-005] computeReconciliationBalance returns remaining balances when partial (TASK-006)', () => {
  const entries = [
    { productId: 1n, lotId: 50n, quantity: 5 },
  ];

  const records = [
    { productId: 1n, lotId: 50n, quantity: 2, outcome: 'USED' },
  ];

  const result = computeReconciliationBalance(entries, records);
  assert.equal(result.complete, false);
  assert.equal(result.remainingBalances.length, 1);
  assert.equal(result.remainingBalances[0].remaining, 3);
  assert.equal(result.remainingBalances[0].productId, '1');
  assert.equal(result.remainingBalances[0].lotId, '50');
});

test('computeReconciliationBalance returns complete=true for no entries (TASK-006)', () => {
  const result = computeReconciliationBalance([], []);
  assert.equal(result.complete, true);
  assert.equal(result.remainingBalances.length, 0);
});

test('computeReconciliationBalance handles multiple records for same lot (TASK-006)', () => {
  const entries = [
    { productId: 1n, lotId: 50n, quantity: 5 },
  ];

  const records = [
    { productId: 1n, lotId: 50n, quantity: 2, outcome: 'USED' },
    { productId: 1n, lotId: 50n, quantity: 3, outcome: 'RETURNED' },
  ];

  const result = computeReconciliationBalance(entries, records);
  assert.equal(result.complete, true);
});

// ─── RECONCILIATION_OUTCOMES ──────────────────────────────────────────────────

test('RECONCILIATION_OUTCOMES exports USED, RETURNED, DISCARDED (TASK-006)', () => {
  assert.ok(RECONCILIATION_OUTCOMES.includes('USED'));
  assert.ok(RECONCILIATION_OUTCOMES.includes('RETURNED'));
  assert.ok(RECONCILIATION_OUTCOMES.includes('DISCARDED'));
  assert.equal(RECONCILIATION_OUTCOMES.length, 3);
});

// ─── recordReconciliationOutcomes (validation path) ──────────────────────────

test('[AC-005] recordReconciliationOutcomes rejects invalid outcome value (TASK-006)', async () => {
  // Provide minimal mocks
  const originalFindOrder = productionRepository.findProductionOrderById;
  const originalFindRecol = productionRepository.findRecolectionStageById;

  productionRepository.findProductionOrderById = async () => ({ id: 1n, status: 'IN_PROGRESS', companyId: 10n });
  productionRepository.findRecolectionStageById = async () => ({
    id: 5n,
    productionOrderId: 1n,
    status: 'PENDING',
    recoveryType: 'REPLACEMENT_RECOVERY',
  });

  try {
    await assert.rejects(
      () => recordReconciliationOutcomes(
        1n,
        5n,
        [{ productId: 1n, lotId: 50n, quantity: 2, outcome: 'WASTED' }], // invalid
        { companyId: 10, sub: 99 },
      ),
      (err) => {
        assert.equal(err.statusCode ?? err.status, 400);
        assert.ok(err.message.includes('WASTED') || err.message.toLowerCase().includes('invalido'));
        return true;
      },
    );
  } finally {
    productionRepository.findProductionOrderById = originalFindOrder;
    productionRepository.findRecolectionStageById = originalFindRecol;
  }
});

test('[AC-005] recordReconciliationOutcomes rejects when stage is already COMPLETED (TASK-006)', async () => {
  const originalFindOrder = productionRepository.findProductionOrderById;
  const originalFindRecol = productionRepository.findRecolectionStageById;

  productionRepository.findProductionOrderById = async () => ({ id: 1n, status: 'IN_PROGRESS', companyId: 10n });
  productionRepository.findRecolectionStageById = async () => ({
    id: 5n,
    productionOrderId: 1n,
    status: 'COMPLETED', // already closed
    recoveryType: 'REPLACEMENT_RECOVERY',
  });

  try {
    await assert.rejects(
      () => recordReconciliationOutcomes(
        1n,
        5n,
        [{ productId: 1n, lotId: 50n, quantity: 2, outcome: 'USED' }],
        { companyId: 10, sub: 99 },
      ),
      (err) => {
        assert.equal(err.statusCode ?? err.status, 409);
        return true;
      },
    );
  } finally {
    productionRepository.findProductionOrderById = originalFindOrder;
    productionRepository.findRecolectionStageById = originalFindRecol;
  }
});

test('recordReconciliationOutcomes rejects when recolection belongs to different order (TASK-006)', async () => {
  const originalFindOrder = productionRepository.findProductionOrderById;
  const originalFindRecol = productionRepository.findRecolectionStageById;

  productionRepository.findProductionOrderById = async () => ({ id: 1n, status: 'IN_PROGRESS', companyId: 10n });
  productionRepository.findRecolectionStageById = async () => ({
    id: 5n,
    productionOrderId: 999n, // different order
    status: 'PENDING',
    recoveryType: 'REPLACEMENT_RECOVERY',
  });

  try {
    await assert.rejects(
      () => recordReconciliationOutcomes(
        1n,
        5n,
        [],
        { companyId: 10, sub: 99 },
      ),
      (err) => {
        assert.equal(err.statusCode ?? err.status, 409);
        return true;
      },
    );
  } finally {
    productionRepository.findProductionOrderById = originalFindOrder;
    productionRepository.findRecolectionStageById = originalFindRecol;
  }
});
