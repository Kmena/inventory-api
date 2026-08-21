const { createHttpError } = require('../lib/errors');
const productionRepository = require('../repositories/production.repository');
const qualityRepository = require('../repositories/quality.repository');

function assertCompanyScope(auth) {
  if (!auth?.companyId) {
    throw createHttpError(403, 'El usuario debe pertenecer a una empresa', 'forbidden');
  }

  return {
    companyId: BigInt(auth.companyId),
  };
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
  if (value === null || value === undefined) {
    return null;
  }

  const normalizedValue = String(value).trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function toSnapshotValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  return JSON.parse(JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v)));
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
    inspectedAt: inspection.inspectedAt,
    createdAt: inspection.createdAt,
    updatedAt: inspection.updatedAt,
  };
}

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

  const inspection = await qualityRepository.createQualityInspection({
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
  });

  if (payload.result === 'REJECTED') {
    await productionRepository.updateProductionOrder(order.id, scope.companyId, {
      status: 'QA_HOLD',
    });
  }

  if (['APPROVED', 'CONDITIONALLY_ACCEPTED'].includes(payload.result) && order.status === 'QA_HOLD') {
    await productionRepository.updateProductionOrder(order.id, scope.companyId, {
      status: 'IN_PROGRESS',
    });
  }

  return serializeQualityInspection(inspection);
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

    // El gate QA se activa para toda etapa qaMandatory, no solo cuando hay
    // desviacion de tolerancia. El inspector de calidad debe registrar su
    // analisis y aprobarlo antes de que la orden pueda completarse.
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
  },
};
