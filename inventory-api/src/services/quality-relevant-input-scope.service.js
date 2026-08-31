/**
 * quality-relevant-input-scope.service.js
 *
 * Feature: qa-rejection-material-reconciliation-amendment (TASK-002)
 *
 * Implements Option A relevant-input scope resolution for QA rejection.
 *
 * Option A (BR-001, FR-001, AC-001):
 *   All inputs from ALL prior executed stages up to and including the failed stage
 *   are in scope for rejection analysis, recovery, and disposition decisions.
 *
 * This resolver collects ProductionConsumption records from all stage executions
 * that are not INVALIDATED and whose recipeStage stageOrder is <= the failed stage.
 *
 * The resolved scope is returned as an auditable snapshot so both the UI and
 * downstream services can work from a stable, consistent set of inputs regardless
 * of whether the failed stage itself has direct consumptions.
 */

'use strict';

/**
 * Resolves Option A relevant-input scope for a QA rejection event.
 *
 * @param {object} order - ProductionOrder (fully loaded, with stageExecutions and consumptions)
 * @param {bigint|string} failedStageId - recipeStageId of the rejected stage
 * @param {object[]} snapshotStages - stages from the frozen recipe snapshot on the order
 * @returns {RelevantInputScopeResult}
 *
 * @typedef {object} RelevantInputEntry
 * @property {string} sourceStageExecutionId
 * @property {string} recipeStageId
 * @property {string} stageName
 * @property {number} stageOrder
 * @property {string} productId
 * @property {string} lotId
 * @property {number} quantity
 * @property {string|null} unit
 *
 * @typedef {object} RelevantInputScopeResult
 * @property {'OPTION_A'} scopeStrategy
 * @property {string} failedStageId
 * @property {RelevantInputEntry[]} entries
 * @property {boolean} hasDirectConsumptions - true if the failed stage has at least one consumption
 */
function resolveOptionARelevantInputs(order, failedStageId, snapshotStages) {
  const failedStageIdStr = String(failedStageId);

  // Build a map from stageId → stageOrder and stageName from the frozen snapshot
  const stageOrderMap = new Map();
  for (const stage of snapshotStages || []) {
    stageOrderMap.set(String(stage.id), {
      stageOrder: Number(stage.stageOrder ?? 0),
      stageName: stage.name ?? '',
    });
  }

  const failedStageInfo = stageOrderMap.get(failedStageIdStr);
  const failedStageOrder = failedStageInfo ? failedStageInfo.stageOrder : Number.MAX_SAFE_INTEGER;

  const entries = [];
  let hasDirectConsumptions = false;

  for (const execution of order.stageExecutions || []) {
    // Skip invalidated executions — they are not part of the active material scope
    if (execution.status === 'INVALIDATED') {
      continue;
    }

    // Only include stages up to and including the failed stage (Option A)
    const executionStageIdStr = String(execution.recipeStageId);
    const stageInfo = stageOrderMap.get(executionStageIdStr);
    const executionStageOrder = stageInfo ? stageInfo.stageOrder : Number.MAX_SAFE_INTEGER;

    if (executionStageOrder > failedStageOrder) {
      continue;
    }

    const isFailedStage = executionStageIdStr === failedStageIdStr;

    for (const consumption of execution.consumptions || []) {
      if (isFailedStage) {
        hasDirectConsumptions = true;
      }

      entries.push({
        sourceStageExecutionId: String(execution.id),
        recipeStageId: executionStageIdStr,
        stageName: stageInfo ? stageInfo.stageName : '',
        stageOrder: executionStageOrder,
        productId: String(consumption.productId),
        lotId: String(consumption.lotId),
        quantity: Number(consumption.quantity),
        unit: consumption.unit ?? null,
      });
    }
  }

  return {
    scopeStrategy: 'OPTION_A',
    failedStageId: failedStageIdStr,
    entries,
    hasDirectConsumptions,
  };
}

module.exports = {
  resolveOptionARelevantInputs,
};
