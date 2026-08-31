/**
 * Tests for quality-relevant-input-scope.service.js
 *
 * Feature: qa-rejection-material-reconciliation-amendment (TASK-002)
 *
 * Covers Option A relevant-input scope resolution:
 * - Includes all inputs from all prior executed stages through the failed stage
 * - Excludes INVALIDATED executions
 * - Excludes stages beyond the failed stage
 * - Reports hasDirectConsumptions correctly
 * - Handles failed stage with no direct consumptions (the trigger for this feature)
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveOptionARelevantInputs,
} = require('../src/services/quality-relevant-input-scope.service');

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeOrder(executions) {
  return { stageExecutions: executions };
}

function makeExecution(id, recipeStageId, status, consumptions) {
  return {
    id: BigInt(id),
    recipeStageId: BigInt(recipeStageId),
    status,
    consumptions: consumptions.map((c) => ({
      productId: BigInt(c.productId),
      lotId: BigInt(c.lotId),
      quantity: c.quantity,
      unit: c.unit ?? null,
    })),
  };
}

function makeSnapshotStages(stages) {
  return stages.map((s) => ({
    id: BigInt(s.id),
    stageOrder: s.stageOrder,
    name: s.name,
  }));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

// [AC-001] Option A: includes inputs from all prior executed stages through failed stage
test('[AC-001] resolveOptionARelevantInputs returns inputs from all stages up to failed stage (TASK-002)', () => {
  const snapshotStages = makeSnapshotStages([
    { id: 10, stageOrder: 0, name: 'Recoleccion' },
    { id: 20, stageOrder: 1, name: 'Mezcla' },
    { id: 30, stageOrder: 2, name: 'Calentamiento' },
  ]);

  // Stage 10 and 20 have consumptions; stage 30 is the rejected one (stageOrder=2)
  const order = makeOrder([
    makeExecution(100, 10, 'COMPLETED', [{ productId: 1, lotId: 50, quantity: 3 }]),
    makeExecution(101, 20, 'COMPLETED', [{ productId: 2, lotId: 51, quantity: 5 }]),
    makeExecution(102, 30, 'QA_REJECTED', []),
  ]);

  const result = resolveOptionARelevantInputs(order, BigInt(30), snapshotStages);

  assert.equal(result.scopeStrategy, 'OPTION_A');
  assert.equal(result.failedStageId, '30');
  assert.equal(result.hasDirectConsumptions, false);
  assert.equal(result.entries.length, 2);

  const entry1 = result.entries.find((e) => e.recipeStageId === '10');
  const entry2 = result.entries.find((e) => e.recipeStageId === '20');

  assert.ok(entry1, 'Should include consumption from stage 10');
  assert.equal(entry1.productId, '1');
  assert.equal(entry1.lotId, '50');
  assert.equal(entry1.quantity, 3);

  assert.ok(entry2, 'Should include consumption from stage 20');
  assert.equal(entry2.productId, '2');
  assert.equal(entry2.lotId, '51');
  assert.equal(entry2.quantity, 5);
});

// [AC-001] Failed stage has direct consumptions → hasDirectConsumptions = true
test('[AC-001] resolveOptionARelevantInputs sets hasDirectConsumptions=true when failed stage has consumptions (TASK-002)', () => {
  const snapshotStages = makeSnapshotStages([
    { id: 10, stageOrder: 0, name: 'Recoleccion' },
    { id: 20, stageOrder: 1, name: 'Mezcla' },
  ]);

  const order = makeOrder([
    makeExecution(100, 10, 'COMPLETED', [{ productId: 1, lotId: 50, quantity: 2 }]),
    makeExecution(101, 20, 'QA_REJECTED', [{ productId: 2, lotId: 51, quantity: 4 }]),
  ]);

  const result = resolveOptionARelevantInputs(order, BigInt(20), snapshotStages);

  assert.equal(result.hasDirectConsumptions, true);
  assert.equal(result.entries.length, 2);
});

// Excludes INVALIDATED executions (they are not part of the active material scope)
test('resolveOptionARelevantInputs excludes INVALIDATED executions (TASK-002)', () => {
  const snapshotStages = makeSnapshotStages([
    { id: 10, stageOrder: 0, name: 'Recoleccion' },
    { id: 20, stageOrder: 1, name: 'Mezcla' },
  ]);

  const order = makeOrder([
    makeExecution(100, 10, 'INVALIDATED', [{ productId: 1, lotId: 50, quantity: 3 }]),
    makeExecution(101, 10, 'COMPLETED', [{ productId: 1, lotId: 50, quantity: 3 }]),
    makeExecution(102, 20, 'QA_REJECTED', []),
  ]);

  const result = resolveOptionARelevantInputs(order, BigInt(20), snapshotStages);

  // Only the non-invalidated execution of stage 10 should appear
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].sourceStageExecutionId, '101');
});

// Excludes stages beyond the failed stage
test('resolveOptionARelevantInputs excludes stages after the failed stage (TASK-002)', () => {
  const snapshotStages = makeSnapshotStages([
    { id: 10, stageOrder: 0, name: 'Recoleccion' },
    { id: 20, stageOrder: 1, name: 'Mezcla' },
    { id: 30, stageOrder: 2, name: 'Calentamiento' },
  ]);

  // Stage 20 is rejected; stage 30 has consumptions but is AFTER the failed stage
  const order = makeOrder([
    makeExecution(100, 10, 'COMPLETED', [{ productId: 1, lotId: 50, quantity: 3 }]),
    makeExecution(101, 20, 'QA_REJECTED', []),
    makeExecution(102, 30, 'COMPLETED', [{ productId: 3, lotId: 52, quantity: 2 }]),
  ]);

  const result = resolveOptionARelevantInputs(order, BigInt(20), snapshotStages);

  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].recipeStageId, '10');
  // Stage 30 inputs should not appear
  assert.ok(!result.entries.some((e) => e.recipeStageId === '30'));
});

// Empty order — no executions
test('resolveOptionARelevantInputs returns empty entries when no executions (TASK-002)', () => {
  const snapshotStages = makeSnapshotStages([
    { id: 10, stageOrder: 0, name: 'Recoleccion' },
  ]);

  const result = resolveOptionARelevantInputs(makeOrder([]), BigInt(10), snapshotStages);

  assert.equal(result.scopeStrategy, 'OPTION_A');
  assert.equal(result.entries.length, 0);
  assert.equal(result.hasDirectConsumptions, false);
});

// Multiple consumptions per execution are all included
test('resolveOptionARelevantInputs includes all consumptions per execution (TASK-002)', () => {
  const snapshotStages = makeSnapshotStages([
    { id: 10, stageOrder: 0, name: 'Recoleccion' },
  ]);

  const order = makeOrder([
    makeExecution(100, 10, 'QA_REJECTED', [
      { productId: 1, lotId: 50, quantity: 2 },
      { productId: 2, lotId: 51, quantity: 4 },
    ]),
  ]);

  const result = resolveOptionARelevantInputs(order, BigInt(10), snapshotStages);

  assert.equal(result.entries.length, 2);
  assert.equal(result.hasDirectConsumptions, true);
});

// sourceStageExecutionId is properly set
test('resolveOptionARelevantInputs sets sourceStageExecutionId from the execution (TASK-002)', () => {
  const snapshotStages = makeSnapshotStages([
    { id: 10, stageOrder: 0, name: 'Recoleccion' },
  ]);

  const order = makeOrder([
    makeExecution(999, 10, 'QA_REJECTED', [{ productId: 1, lotId: 50, quantity: 1 }]),
  ]);

  const result = resolveOptionARelevantInputs(order, BigInt(10), snapshotStages);

  assert.equal(result.entries[0].sourceStageExecutionId, '999');
  assert.equal(result.entries[0].stageName, 'Recoleccion');
  assert.equal(result.entries[0].stageOrder, 0);
});
