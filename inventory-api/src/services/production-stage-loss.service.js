/**
 * production-stage-loss.service.js
 *
 * Feature: production-stage-rejection-and-reexecution (TASK-004)
 *
 * Handles declarative registration of post-rejection material losses.
 * IMPORTANT: No stock movement is generated. The stock already decreased
 * during executeProductionStage. This service is audit/traceability only.
 *
 * BR-001: losses only allowed when stageExecution.status === 'QA_REJECTED'
 * BR-002: sum of losses per (productId, lotId) cannot exceed consumed quantity
 * BR-006: no call to changeWarehouseStock or any inventory-transaction-support function
 */

'use strict';

const { createHttpError } = require('../lib/errors');
const productionRepository = require('../repositories/production.repository');

// ─────────────────────────────────────────────────────────────────────────────
// Scope helpers
// ─────────────────────────────────────────────────────────────────────────────

function assertCompanyScope(auth) {
  if (!auth?.companyId) {
    throw createHttpError(403, 'El usuario debe pertenecer a una empresa', 'forbidden');
  }
  return {
    companyId: BigInt(auth.companyId),
    userId: auth.sub ? BigInt(auth.sub) : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Business rule guards
// ─────────────────────────────────────────────────────────────────────────────

/**
 * BR-001: losses can only be registered on a QA_REJECTED execution.
 * @param {object} execution - ProductionStageExecution
 */
function assertStageExecutionRejected(execution) {
  if (!execution || execution.status !== 'QA_REJECTED') {
    const actualStatus = execution?.status ?? 'UNKNOWN';
    throw Object.assign(
      createHttpError(
        409,
        `Solo se pueden registrar pérdidas en ejecuciones con estado QA_REJECTED. Estado actual: ${actualStatus}`,
        'conflict',
      ),
      { subCode: 'stage_not_rejected' },
    );
  }
}

/**
 * BR-002: sum of declared losses per (productId, lotId) cannot exceed
 * the quantity consumed in that execution for the same pair.
 *
 * @param {bigint} stageExecutionId
 * @param {{ productId: bigint, lotId: bigint, quantity: number }[]} losses
 */
async function assertLossQuantityWithinConsumed(stageExecutionId, losses) {
  if (!losses || losses.length === 0) {
    return; // empty losses declaration is always valid
  }

  const consumptions = await productionRepository.findConsumptionsByExecutionId(stageExecutionId);

  // Build a map: `${productId}:${lotId}` → sum of consumed quantity
  const consumedMap = new Map();
  for (const c of consumptions) {
    const key = `${c.productId}:${c.lotId}`;
    const prev = consumedMap.get(key) || 0;
    consumedMap.set(key, prev + Number(c.quantity));
  }

  // Group losses by (productId, lotId) and sum
  const lossMap = new Map();
  for (const loss of losses) {
    const key = `${loss.productId}:${loss.lotId}`;
    const prev = lossMap.get(key) || 0;
    lossMap.set(key, prev + Number(loss.quantity));
  }

  const violations = [];
  for (const [key, lossQty] of lossMap.entries()) {
    const consumed = consumedMap.get(key) || 0;
    if (lossQty > consumed + 0.0001) {
      const [productId, lotId] = key.split(':');
      violations.push({
        productId,
        lotId,
        declared: lossQty,
        consumed,
      });
    }
  }

  if (violations.length > 0) {
    const detail = violations
      .map((v) => `producto ${v.productId}/lote ${v.lotId}: declarado ${v.declared}, consumido ${v.consumed}`)
      .join('; ');
    throw createHttpError(
      400,
      `La cantidad de pérdida declarada supera la cantidad consumida en la ejecución: ${detail}`,
      'validation_error',
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Serializers
// ─────────────────────────────────────────────────────────────────────────────

function serializeStageLoss(loss) {
  return {
    id: loss.id,
    companyId: loss.companyId,
    productionOrderId: loss.productionOrderId,
    stageExecutionId: loss.stageExecutionId,
    productId: loss.productId,
    lotId: loss.lotId,
    quantity: loss.quantity,
    reasonCode: loss.reasonCode,
    note: loss.note ?? null,
    registeredByUserId: loss.registeredByUserId ?? null,
    createdAt: loss.createdAt,
  };
}

function serializeExecutionGroup(execution, losses) {
  return {
    executionId: execution.id,
    status: execution.status,
    startedAt: execution.startedAt,
    endedAt: execution.endedAt,
    createdAt: execution.createdAt,
    lossesAcknowledged: execution.lossesAcknowledged,
    lossesAcknowledgedAt: execution.lossesAcknowledgedAt ?? null,
    losses: losses.map(serializeStageLoss),
  };
}

function buildAlreadyDeclaredLossesDetail(execution) {
  const latestRejectedInspection = (execution?.qualityInspections || []).find(
    (inspection) => inspection?.result === 'REJECTED' && inspection?.materialDispositions !== null,
  );

  return {
    declaredAt: latestRejectedInspection?.inspectedAt ?? null,
    declaredByUserId: latestRejectedInspection?.inspectorUserId ?? null,
    materialDispositions: latestRejectedInspection?.materialDispositions ?? [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main service functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registers post-rejection losses for a stage execution.
 *
 * POST /api/production/orders/:id/stages/:stageId/losses
 * Permission: production.manage
 *
 * Accepts losses:[] (empty) — serves as an explicit "no losses" declaration.
 * DOES NOT move stock. Stock already decreased during executeProductionStage.
 *
 * @param {bigint} orderId
 * @param {bigint} stageId - recipeStageId
 * @param {{ losses: Array<{productId, lotId, quantity, reasonCode, note?}> }} body
 * @param {object} auth
 */
async function registerStageLosses(orderId, stageId, body, auth) {
  const scope = assertCompanyScope(auth);
  const { losses = [] } = body;

  // 1. Find order (multi-tenant)
  const order = await productionRepository.findProductionOrderById(orderId, scope.companyId);
  if (!order) {
    throw createHttpError(404, 'Orden de producción no encontrada', 'not_found');
  }

  // 2. Find latest execution for this stage
  const latestExecution = await productionRepository.findLatestStageExecutionForOrderStage(
    order.id,
    stageId,
  );
  if (!latestExecution) {
    throw createHttpError(
      404,
      'No existe una ejecución registrada para esta etapa de la orden',
      'not_found',
    );
  }

  // 3. DEC-005 / NFR-008: if losses were already acknowledged inline during QA rejection,
  // block duplicate legacy declarations and return the original snapshot detail.
  if (latestExecution.lossesAcknowledged) {
    throw Object.assign(
      createHttpError(
        409,
        'Las disposiciones ya fueron declaradas por el inspector QA al momento del rechazo.',
        'losses_already_declared',
      ),
      { detail: buildAlreadyDeclaredLossesDetail(latestExecution) },
    );
  }

  // 4. BR-001: must be QA_REJECTED
  assertStageExecutionRejected(latestExecution);

  // 5. BR-002: sum of losses cannot exceed consumed (skip if empty)
  await assertLossQuantityWithinConsumed(latestExecution.id, losses);

  // 6. Persist in a transaction: create each loss + acknowledge
  const prisma = require('../lib/prisma');
  const created = await prisma.$transaction(async (transactionClient) => {
    const tx = /** @type {any} */ (transactionClient);
    const lossRecords = [];

    for (const loss of losses) {
      const record = await productionRepository.createStageLoss(
        {
          companyId: scope.companyId,
          productionOrderId: order.id,
          stageExecutionId: latestExecution.id,
          productId: BigInt(loss.productId),
          lotId: BigInt(loss.lotId),
          quantity: loss.quantity,
          reasonCode: loss.reasonCode.trim(),
          note: loss.note ? String(loss.note).trim() || null : null,
          registeredByUserId: scope.userId,
        },
        tx,
      );
      lossRecords.push(record);
    }

    // DEC-003: always mark lossesAcknowledged=true, even for losses:[]
    await productionRepository.acknowledgeStageExecutionLosses(latestExecution.id, tx);

    return lossRecords;
  });

  return {
    orderId: order.id,
    stageId,
    stageExecutionId: latestExecution.id,
    lossesAcknowledged: true,
    losses: created.map(serializeStageLoss),
  };
}

/**
 * Returns all loss records for all executions of a given stage in an order.
 *
 * GET /api/production/orders/:id/stages/:stageId/losses
 * Permission: production.view
 *
 * @param {bigint} orderId
 * @param {bigint} stageId - recipeStageId
 * @param {object} auth
 */
async function listStageLosses(orderId, stageId, auth) {
  const scope = assertCompanyScope(auth);

  const order = await productionRepository.findProductionOrderById(orderId, scope.companyId);
  if (!order) {
    throw createHttpError(404, 'Orden de producción no encontrada', 'not_found');
  }

  const allLosses = await productionRepository.findStageLossesByOrderAndStage(
    order.id,
    stageId,
    scope.companyId,
  );

  // Group by executionId
  const byExecution = new Map();
  for (const loss of allLosses) {
    const execId = String(loss.stageExecutionId);
    if (!byExecution.has(execId)) {
      byExecution.set(execId, { execution: loss.stageExecution, losses: [] });
    }
    byExecution.get(execId).losses.push(loss);
  }

  const executions = Array.from(byExecution.values()).map(({ execution, losses: execLosses }) =>
    serializeExecutionGroup(execution, execLosses),
  );

  return {
    orderId: order.id,
    stageId,
    executions,
  };
}

module.exports = {
  registerStageLosses,
  listStageLosses,
  __private__: {
    assertStageExecutionRejected,
    assertLossQuantityWithinConsumed,
    serializeStageLoss,
  },
};
