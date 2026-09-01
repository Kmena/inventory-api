/**
 * quality.service.js
 *
 * Extended by TASK-004 (qa-rejection-disposition-and-continuation):
 * - createInspectionForStage now accepts materialDispositions, continuationPoint,
 *   continuationStageId, invalidatedStagesDispositions.
 * - When result=REJECTED and materialDispositions is present, dispositions are
 *   processed inline and lossesAcknowledged is set to true.
 * - continuationPoint=PRIOR_STAGE invalidates intermediate executions with
 *   disposición fina (DEC-004).
 * - Backward compat: without new fields, behavior is identical to prior implementation.
 */
const { createHttpError } = require('../lib/errors');
const productionRepository = require('../repositories/production.repository');
const inventoryRepository = require('../repositories/inventory.repository');
const qualityRepository = require('../repositories/quality.repository');
const dispositionService = require('./quality-rejection-disposition.service');
const { resolveOptionARelevantInputs } = require('./quality-relevant-input-scope.service');
const recolectionService = require('./production-recolection.service');

const LOCK_RETRY_ATTEMPTS = 3;
const LOCK_RETRY_BACKOFF_MS = 200;

function assertCompanyScope(auth) {
  if (!auth?.companyId) {
    throw createHttpError(403, 'El usuario debe pertenecer a una empresa', 'forbidden');
  }

  return { companyId: BigInt(auth.companyId) };
}

function assertInspectorScope(auth) {
  if (!auth?.companyId || !auth?.sub) {
    throw createHttpError(403, 'Se requiere un usuario asociado a una empresa para registrar inspecciones', 'forbidden');
  }

  return {
    companyId: BigInt(auth.companyId),
    userId: BigInt(auth.sub),
  };
}

function normalizeOptionalText(value) {
  if (value === null || value === undefined) { return null; }
  const normalizedValue = String(value).trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function toSnapshotValue(value) {
  if (value === null || value === undefined) { return null; }
  return JSON.parse(JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v)));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireInventoryLockWithRetry(companyId, tx) {
  for (let attempt = 1; attempt <= LOCK_RETRY_ATTEMPTS; attempt += 1) {
    const acquired = await inventoryRepository.tryAcquireCompanyInventoryAdvisoryLock(companyId, tx);
    if (acquired) {
      return;
    }
    if (attempt < LOCK_RETRY_ATTEMPTS) {
      await wait(LOCK_RETRY_BACKOFF_MS);
    }
  }

  throw createHttpError(
    503,
    'No se pudo reservar el inventario para procesar devoluciones. Intente de nuevo en unos segundos.',
    'inventory_lock_unavailable',
  );
}

function serializeQualityInspection(inspection) {
  return {
    id: inspection.id,
    productionOrderId: inspection.productionOrderId,
    stageExecutionId: inspection.stageExecutionId,
    inspectorUserId: inspection.inspectorUserId,
    lotId: inspection.lotId,
    result: inspection.result,
    expectedParameters: inspection.expectedParameters,
    actualResults: inspection.actualResults,
    observations: inspection.observations,
    evidence: inspection.evidence,
    correctiveAction: inspection.correctiveAction,
    continuationPoint: inspection.continuationPoint ?? null,
    continuationStageId: inspection.continuationStageId ?? null,
    materialDispositions: inspection.materialDispositions ?? null,
    inspectedAt: inspection.inspectedAt,
    createdAt: inspection.createdAt,
    updatedAt: inspection.updatedAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIOR_STAGE helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates continuationStageId has stageOrder < rejected stage and has an execution (DEC-008).
 *
 * @param {object} order
 * @param {bigint} continuationStageId
 * @param {object} rejectedStageSnapshot
 * @returns {object} continuationStageSnapshot
 */
function validateContinuationStage(order, continuationStageId, rejectedStageSnapshot) {
  const stages = order?.recipeVersionSnapshot?.recipeVersion?.stages;
  if (!Array.isArray(stages)) {
    throw createHttpError(404, 'No se encontraron etapas en el snapshot de la orden', 'not_found');
  }

  const continuationStage = stages.find((s) => String(s.id) === String(continuationStageId));
  if (!continuationStage) {
    throw createHttpError(
      404,
      `La etapa de continuación (id=${continuationStageId}) no existe en el snapshot de la orden`,
      'not_found',
    );
  }

  const continuationOrder = Number(continuationStage.stageOrder ?? 0);
  const rejectedOrder = Number(rejectedStageSnapshot?.stageOrder ?? 0);

  if (continuationOrder >= rejectedOrder) {
    throw createHttpError(
      400,
      `La etapa de continuación debe tener stageOrder estrictamente menor al de la etapa rechazada (${rejectedOrder}). Recibido: ${continuationOrder}`,
      'validation_error',
    );
  }

  // DEC-008: continuationStage must have at least one finished execution
  const hasExecution = (order.stageExecutions || []).some(
    (ex) => String(ex.recipeStageId) === String(continuationStage.id) && ex.endedAt,
  );
  if (!hasExecution) {
    throw createHttpError(
      400,
      `La etapa de continuación "${continuationStage.name}" no tiene ninguna ejecución finalizada. Solo se puede retroceder a etapas ya ejecutadas.`,
      'validation_error',
    );
  }

  return continuationStage;
}

/**
 * Returns executions that will be marked INVALIDATED.
 * stageOrder >= continuationStage.stageOrder AND < rejectedStage.stageOrder
 * AND endedAt != null AND status != 'INVALIDATED'.
 */
function findExecutionsToInvalidate(order, continuationStageSnapshot, rejectedStageSnapshot) {
  const stages = order?.recipeVersionSnapshot?.recipeVersion?.stages || [];
  const continuationOrder = Number(continuationStageSnapshot.stageOrder ?? 0);
  const rejectedOrder = Number(rejectedStageSnapshot.stageOrder ?? 0);

  const stageIdsToInvalidate = new Set(
    stages
      .filter((s) => {
        const o = Number(s.stageOrder ?? 0);
        return o >= continuationOrder && o < rejectedOrder;
      })
      .map((s) => String(s.id)),
  );

  const latestByStage = new Map();
  for (const ex of (order.stageExecutions || [])) {
    if (!ex.endedAt || ex.status === 'INVALIDATED') { continue; }
    const sid = String(ex.recipeStageId);
    if (!stageIdsToInvalidate.has(sid)) { continue; }
    const existing = latestByStage.get(sid);
    if (!existing || new Date(ex.createdAt) > new Date(existing.createdAt)) {
      latestByStage.set(sid, ex);
    }
  }

  return Array.from(latestByStage.values());
}

/**
 * Validates every execution to INVALIDATE has a dispositions entry (DEC-004, BR-004).
 */
function assertInvalidatedDispositionsComplete(execsToInvalidate, invalidatedStagesDispositions) {
  if (execsToInvalidate.length === 0) { return; }

  const provided = new Set(
    (invalidatedStagesDispositions || []).map((e) => String(e.stageExecutionId)),
  );

  const missing = execsToInvalidate.filter((ex) => !provided.has(String(ex.id)));
  if (missing.length > 0) {
    const ids = missing.map((ex) => String(ex.id)).join(', ');
    throw createHttpError(
      400,
      `Se requiere declarar disposición de material para las ejecuciones que quedarán INVALIDATED: ${ids}`,
      'validation_error',
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main service function
// ─────────────────────────────────────────────────────────────────────────────

async function createInspectionForStage(orderId, stageId, payload, auth) {
  const scope = assertInspectorScope(auth);

  const order = await productionRepository.findProductionOrderById(orderId, scope.companyId);
  if (!order) {
    throw createHttpError(404, 'Orden de producción no encontrada', 'not_found');
  }

  if (!['IN_PROGRESS', 'QA_HOLD'].includes(order.status)) {
    throw createHttpError(409, 'La orden de producción debe estar en progreso o en espera de QA para registrar inspecciones', 'conflict');
  }

  const stageExecution = await productionRepository.findLatestProductionStageExecutionForOrderStage(order.id, stageId);
  if (!stageExecution) {
    throw createHttpError(409, 'Debe existir una ejecución registrada para la etapa antes de realizar una inspección', 'conflict');
  }

  const inspectedAt = payload.inspectedAt ?? new Date();
  const inspectionData = {
    productionOrderId: order.id,
    stageExecutionId: stageExecution.id,
    inspectorUserId: scope.userId,
    lotId: payload.lotId ?? null,
    result: payload.result,
    expectedParameters: toSnapshotValue(payload.expectedParameters),
    actualResults: toSnapshotValue(payload.actualResults),
    observations: normalizeOptionalText(payload.observations),
    evidence: toSnapshotValue(payload.evidence),
    correctiveAction: normalizeOptionalText(payload.correctiveAction),
    inspectedAt,
    continuationPoint: null,
    continuationStageId: null,
    materialDispositions: null,
  };

  // ─── Non-rejection path (APPROVED / CONDITIONALLY_ACCEPTED) ─────────────
  if (payload.result !== 'REJECTED') {
    const inspection = await qualityRepository.createQualityInspection(inspectionData);
    if (['APPROVED', 'CONDITIONALLY_ACCEPTED'].includes(payload.result) && order.status === 'QA_HOLD') {
      await productionRepository.updateProductionOrder(order.id, scope.companyId, { status: 'IN_PROGRESS' });
    }
    return { inspection: serializeQualityInspection(inspection), dispositionsSummary: null, relevantInputScope: null };
  }

  // ─── REJECTED path ───────────────────────────────────────────────────────
  const materialDispositions = payload.materialDispositions ?? null;
  const continuationPoint = payload.continuationPoint ?? 'CURRENT';
  const continuationStageId = payload.continuationStageId ?? null;
  const invalidatedStagesDispositions = payload.invalidatedStagesDispositions ?? null;
  const hasDispositions = materialDispositions !== null;
  // TASK-004: replacement recovery stage trigger
  const requiresReplacementStage = payload.requiresReplacementStage === true;
  const replacementItems = payload.replacementItems ?? [];

  const snapshotStages = /** @type {any} */ (order?.recipeVersionSnapshot)?.recipeVersion?.stages || [];
  const rejectedStageSnapshot = snapshotStages.find((s) => String(s.id) === String(stageId));

  // Option A: resolve relevant inputs from all prior executed stages through the failed stage (TASK-002, FR-001, BR-001)
  const relevantInputScope = resolveOptionARelevantInputs(order, stageId, snapshotStages);

  // Validate PRIOR_STAGE early (before tx) to return 400/404 quickly
  let continuationStageSnapshot = null;
  let execsToInvalidate = [];

  if (continuationPoint === 'PRIOR_STAGE') {
    if (!continuationStageId) {
      throw createHttpError(400, 'continuationStageId es requerido cuando continuationPoint es PRIOR_STAGE', 'validation_error');
    }
    continuationStageSnapshot = validateContinuationStage(order, continuationStageId, rejectedStageSnapshot);
    execsToInvalidate = findExecutionsToInvalidate(order, continuationStageSnapshot, rejectedStageSnapshot);
    assertInvalidatedDispositionsComplete(execsToInvalidate, invalidatedStagesDispositions);
  }

  // ─── Simple REJECTED (no dispositions, no PRIOR_STAGE) — backward compat ─
  // AUD-003: must NOT early-return when requiresReplacementStage=true; fall through to transactional path
  if (!hasDispositions && continuationPoint === 'CURRENT' && !requiresReplacementStage) {
    const inspection = await qualityRepository.createQualityInspection({
      ...inspectionData,
      continuationPoint: 'CURRENT',
    });
    await productionRepository.updateProductionOrder(order.id, scope.companyId, { status: 'QA_HOLD' });
    await productionRepository.updateStageExecutionStatus(stageExecution.id, 'QA_REJECTED');
    return { inspection: serializeQualityInspection(inspection), dispositionsSummary: null, relevantInputScope };
  }

  // ─── REJECTED with dispositions or PRIOR_STAGE (transactional) ──────────
  const hasReturnItems = (materialDispositions || []).some((d) => d.disposition === 'RETURN')
    || (invalidatedStagesDispositions || []).some(
      (e) => (e.dispositions || []).some((d) => d.disposition === 'RETURN'),
    );

  const txFn = async (tx) => {
    if (hasReturnItems) {
      await acquireInventoryLockWithRetry(scope.companyId, tx);
    }

    const inspection = await qualityRepository.createQualityInspection({
      ...inspectionData,
      continuationPoint: continuationPoint ?? null,
      continuationStageId: continuationStageId ? BigInt(continuationStageId) : null,
      materialDispositions: toSnapshotValue(materialDispositions),
    }, tx);

    await productionRepository.updateProductionOrder(order.id, scope.companyId, { status: 'QA_HOLD' }, tx);
    await productionRepository.updateStageExecutionStatus(stageExecution.id, 'QA_REJECTED', tx);

    const invalidatedExecutionIds = [];

    if (continuationPoint === 'PRIOR_STAGE' && execsToInvalidate.length > 0) {
      for (const execToInvalidate of execsToInvalidate) {
        const dispositionEntry = (invalidatedStagesDispositions || []).find(
          (e) => String(e.stageExecutionId) === String(execToInvalidate.id),
        );
        await dispositionService.invalidateExecution(
          tx,
          execToInvalidate,
          dispositionEntry?.dispositions || [],
          auth,
          order,
          order.materialRequirements,
        );
        invalidatedExecutionIds.push(execToInvalidate.id);
      }
    }

    let dispositionsSummary = null;
    if (hasDispositions) {
      // Pass Option A entries so validateDispositions can fall back to them
      // when the rejected execution has no direct consumptions (FR-001, Option A).
      const dispResult = await dispositionService.processRejectionDispositions(
        tx, auth, order, stageExecution, materialDispositions || [], order.materialRequirements,
        relevantInputScope.entries,
      );

      let recolection = null;
      if (dispResult.recolectItems.length > 0) {
        const existing = await productionRepository.findRecolectionStageByExecutionId(stageExecution.id, tx);
        if (!existing) {
          recolection = await productionRepository.createRecolectionStage({
            companyId: order.companyId,
            productionOrderId: order.id,
            rejectedExecutionId: stageExecution.id,
            recipeStageId: BigInt(stageExecution.recipeStageId),
            status: 'PENDING',
            requiredItems: dispResult.recolectItems,
          }, tx);
        } else {
          recolection = existing;
        }
      }

      dispositionsSummary = {
        lossesAcknowledged: true,
        invalidatedExecutions: invalidatedExecutionIds,
        returned: dispResult.returned,
        discarded: dispResult.discarded,
        recolection: recolection
          ? { id: recolection.id, status: recolection.status, requiredItems: recolection.requiredItems }
          : null,
      };
    } else {
      // PRIOR_STAGE without materialDispositions for the rejected execution itself
      dispositionsSummary = invalidatedExecutionIds.length > 0
        ? { lossesAcknowledged: false, invalidatedExecutions: invalidatedExecutionIds, returned: [], discarded: [], recolection: null }
        : null;
    }

    // TASK-004: create posterior replacement recovery stage when inspector flags damaged/missing inputs
    let recoveryStage = null;
    if (requiresReplacementStage) {
      recoveryStage = await recolectionService.createReplacementRecoveryStage(
        tx,
        order,
        stageExecution.id,
        BigInt(stageExecution.recipeStageId),
        (replacementItems || []).map((item) => ({
          productId: item.productId ? String(item.productId) : null,
          quantity: item.quantity,
          unit: item.unit ?? null,
          notes: item.notes ?? null,
        })),
      );
    }

    if (recoveryStage && dispositionsSummary) {
      /** @type {any} */ (dispositionsSummary).recoveryStage = recolectionService.serializeRecolectionStage(recoveryStage);
    } else if (recoveryStage) {
      dispositionsSummary = /** @type {any} */ ({ lossesAcknowledged: false, invalidatedExecutions: [], returned: [], discarded: [], recolection: null, recoveryStage: recolectionService.serializeRecolectionStage(recoveryStage) });
    }

    return { inspection: serializeQualityInspection(inspection), dispositionsSummary, relevantInputScope };
  };

  return inventoryRepository.transaction(txFn);
}

async function listInspectionsForOrder(orderId, auth) {
  const scope = assertCompanyScope(auth);

  const order = await productionRepository.findProductionOrderById(orderId, scope.companyId);
  if (!order) {
    throw createHttpError(404, 'Orden de producción no encontrada', 'not_found');
  }

  // TASK-007: pass companyId to repository for multi-tenant enforcement at DB level.
  const inspections = await qualityRepository.findQualityInspectionsForOrder(order.id, scope.companyId);
  return inspections.map(serializeQualityInspection);
}

async function checkMandatoryQaGatesForOrder(orderId, companyId) {
  const order = await productionRepository.findProductionOrderById(orderId, companyId);
  if (!order) {
    throw createHttpError(404, 'Orden de producción no encontrada', 'not_found');
  }

  const stages = /** @type {any} */ (order?.recipeVersionSnapshot)?.recipeVersion?.stages;
  if (!Array.isArray(stages)) {
    return { allMandatoryGatesPassed: true, pendingStages: [], rejectedStages: [] };
  }

  const mandatoryStages = stages.filter((stage) => stage.qaMandatory === true);
  if (mandatoryStages.length === 0) {
    return { allMandatoryGatesPassed: true, pendingStages: [], rejectedStages: [] };
  }

  const pendingStages = [];
  const rejectedStages = [];

  for (const stage of mandatoryStages) {
    const stageExecution = await productionRepository.findLatestProductionStageExecutionForOrderStage(
      order.id,
      BigInt(stage.id),
    );

    if (!stageExecution) {
      pendingStages.push({ stageId: stage.id, stageName: stage.name, reason: 'stage_not_executed' });
      continue;
    }

    const approvedInspection = await qualityRepository.findApprovedInspectionForStageExecution(stageExecution.id);
    if (!approvedInspection) {
      const allInspections = await qualityRepository.findQualityInspectionsForStageExecution(stageExecution.id);
      const hasRejection = allInspections.some((insp) => insp.result === 'REJECTED');

      if (hasRejection) {
        rejectedStages.push({ stageId: stage.id, stageName: stage.name, reason: 'qa_rejected' });
      } else {
        pendingStages.push({ stageId: stage.id, stageName: stage.name, reason: 'qa_analysis_required' });
      }
    }
  }

  return {
    allMandatoryGatesPassed: pendingStages.length === 0 && rejectedStages.length === 0,
    pendingStages,
    rejectedStages,
  };
}

module.exports = {
  createInspectionForStage,
  listInspectionsForOrder,
  checkMandatoryQaGatesForOrder,
  __private__: {
    serializeQualityInspection,
    assertInspectorScope,
    validateContinuationStage,
    findExecutionsToInvalidate,
    acquireInventoryLockWithRetry,
  },
};
