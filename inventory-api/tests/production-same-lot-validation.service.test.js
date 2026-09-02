/**
 * Tests for same-lot recolection-before-use validation
 *
 * Feature: qa-rejection-material-reconciliation-amendment (TASK-005)
 *
 * Covers:
 * - assertRecolectionCoverageForConsumption enforces lot-level pre-recolection
 * - Cannot use more than recolected from same lot
 * - Skips validation when no recolection entries (backward compat)
 * - buildRecolectionBalanceMap aggregates correctly
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildRecolectionBalanceMap,
  assertRecolectionCoverageForConsumption,
} = require('../src/services/production-stage-validation.service');

// ─── buildRecolectionBalanceMap ───────────────────────────────────────────────

test('buildRecolectionBalanceMap aggregates quantities by productId:lotId (TASK-005)', () => {
  const entries = [
    { productId: 1n, lotId: 50n, quantity: 3 },
    { productId: 1n, lotId: 50n, quantity: 2 },
    { productId: 2n, lotId: 51n, quantity: 5 },
  ];

  const map = buildRecolectionBalanceMap(entries);

  assert.equal(map.get('1:50'), 5);
  assert.equal(map.get('2:51'), 5);
});

test('buildRecolectionBalanceMap returns empty map for empty entries (TASK-005)', () => {
  const map = buildRecolectionBalanceMap([]);
  assert.equal(map.size, 0);
});

// ─── assertRecolectionCoverageForConsumption ─────────────────────────────────

// [AC-002] Usage requires lotId tied to prior recolection
test('[AC-002] assertRecolectionCoverageForConsumption blocks usage of unrecolected lot (TASK-005)', () => {
  const recolectionEntries = [
    { productId: 1n, lotId: 50n, quantity: 3 },
  ];

  const proposedConsumptions = [
    { productId: 1n, lotId: 99n, quantity: 1 }, // lot 99 not recolected
  ];

  assert.throws(
    () => assertRecolectionCoverageForConsumption(recolectionEntries, [], proposedConsumptions),
    (err) => {
      assert.equal(err.statusCode ?? err.status, 400);
      assert.equal(err.subCode, 'lot_not_recolected_for_stage');
      return true;
    },
  );
});

// [AC-003] Usage cannot exceed recolected quantity
test('[AC-003] assertRecolectionCoverageForConsumption blocks overuse of recolected lot (TASK-005)', () => {
  const recolectionEntries = [
    { productId: 1n, lotId: 50n, quantity: 3 },
  ];

  const proposedConsumptions = [
    { productId: 1n, lotId: 50n, quantity: 4 }, // exceeds recolected 3
  ];

  assert.throws(
    () => assertRecolectionCoverageForConsumption(recolectionEntries, [], proposedConsumptions),
    (err) => {
      assert.equal(err.statusCode ?? err.status, 400);
      assert.equal(err.subCode, 'recolection_overuse');
      return true;
    },
  );
});

// Valid usage within recolected quantity
test('assertRecolectionCoverageForConsumption allows usage within recolected quantity (TASK-005)', () => {
  const recolectionEntries = [
    { productId: 1n, lotId: 50n, quantity: 5 },
  ];

  const proposedConsumptions = [
    { productId: 1n, lotId: 50n, quantity: 3 },
  ];

  // Should not throw
  assert.doesNotThrow(() =>
    assertRecolectionCoverageForConsumption(recolectionEntries, [], proposedConsumptions),
  );
});

// Considers already-recorded consumptions against recolected balance
test('assertRecolectionCoverageForConsumption accounts for existing consumptions (TASK-005)', () => {
  const recolectionEntries = [
    { productId: 1n, lotId: 50n, quantity: 5 },
  ];

  const existingConsumptions = [
    { productId: 1n, lotId: 50n, quantity: 3 }, // already used 3
  ];

  const proposedConsumptions = [
    { productId: 1n, lotId: 50n, quantity: 3 }, // total would be 6, exceeds 5
  ];

  assert.throws(
    () => assertRecolectionCoverageForConsumption(recolectionEntries, existingConsumptions, proposedConsumptions),
    (err) => {
      assert.equal(err.subCode, 'recolection_overuse');
      return true;
    },
  );
});

// Backward compat: no recolection entries → skip validation
test('assertRecolectionCoverageForConsumption skips validation for legacy flow without entries (TASK-005)', () => {
  const proposedConsumptions = [
    { productId: 1n, lotId: 50n, quantity: 100 }, // would fail if checked
  ];

  // No recolection entries → backward compat, no error
  assert.doesNotThrow(() =>
    assertRecolectionCoverageForConsumption([], [], proposedConsumptions),
  );

  assert.doesNotThrow(() =>
    assertRecolectionCoverageForConsumption(null, [], proposedConsumptions),
  );
});

// Consumption without lotId is skipped
test('assertRecolectionCoverageForConsumption ignores consumptions without lotId (TASK-005)', () => {
  const recolectionEntries = [
    { productId: 1n, lotId: 50n, quantity: 3 },
  ];

  const proposedConsumptions = [
    { productId: 2n, lotId: null, quantity: 100 }, // no lotId → skip
  ];

  assert.doesNotThrow(() =>
    assertRecolectionCoverageForConsumption(recolectionEntries, [], proposedConsumptions),
  );
});

// Boundary: usage exactly equals recolected
test('assertRecolectionCoverageForConsumption allows usage exactly equal to recolected (TASK-005)', () => {
  const recolectionEntries = [
    { productId: 1n, lotId: 50n, quantity: 5 },
  ];

  const proposedConsumptions = [
    { productId: 1n, lotId: 50n, quantity: 5 },
  ];

  assert.doesNotThrow(() =>
    assertRecolectionCoverageForConsumption(recolectionEntries, [], proposedConsumptions),
  );
});
