const { createHttpError } = require('../lib/errors');
const audit = require('../lib/audit');
const { permissionRequiresJustification } = require('../security/permission-governance.service');

const OVERRIDE_PERMISSION_CODE = 'production.override';
/**
 * Fallback tolerance used when the company-level value cannot be read.
 * Expressed as a raw percentage (5.00 = 5%). The actual fractional multiplier
 * is computed inside validateConsumptionAgainstRequirement.
 * DEC-002: Authoritative value lives in companies.production_consumption_tolerance_percent.
 */
const CONSUMPTION_TOLERANCE_PERCENT_FALLBACK = 5.00;
const STAGE_OVERRIDE_AUDIT_ACTION = 'PRODUCTION_STAGE_EXECUTION_OVERRIDE';

function normalizeOptionalText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalizedValue = String(value).trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function actorHasPermission(auth, permissionCode) {
  return Array.isArray(auth?.permissions) && auth.permissions.includes(permissionCode);
}

function createSubcodedHttpError(statusCode, message, code, subCode) {
  return Object.assign(createHttpError(statusCode, message, code), subCode ? { subCode } : {});
}

function assertStageOverrideAllowed(auth, overrideJustification, violationSubCode, errorStatusCode = 409) {
  const justification = normalizeOptionalText(overrideJustification);

  if (!actorHasPermission(auth, OVERRIDE_PERMISSION_CODE)) {
    throw createSubcodedHttpError(
      errorStatusCode,
      'La desviación detectada requiere un usuario con permiso production.override',
      errorStatusCode === 400 ? 'validation_error' : 'conflict',
      violationSubCode,
    );
  }

  if (permissionRequiresJustification(OVERRIDE_PERMISSION_CODE) && !justification) {
    throw createSubcodedHttpError(
      errorStatusCode,
      'El override de producción requiere una justificación explícita',
      errorStatusCode === 400 ? 'validation_error' : 'conflict',
      violationSubCode,
    );
  }

  return justification;
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK-005: Multi-execution support for stage rejection + re-execution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the most recent finished execution (endedAt != null) for a stage,
 * regardless of status. Ordered by createdAt DESC.
 * @param {object} order
 * @param {bigint} stageId
 */
function findLatestExecutionForStage(order, stageId) {
  const all = (order.stageExecutions || [])
    .filter((ex) =>
      String(ex.recipeStageId) === stageId.toString() && ex.endedAt,
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return all[0] || null;
}

/**
 * Returns the most recent execution with status=COMPLETED (not QA_REJECTED).
 * Used for the gate of subsequent stages.
 * @param {object} order
 * @param {bigint} stageId
 */
function findLatestCompletedExecutionForStage(order, stageId) {
  const latest = findLatestExecutionForStage(order, stageId);
  return latest && latest.status === 'COMPLETED' ? latest : null;
}

/**
 * @deprecated Use findLatestExecutionForStage / findLatestCompletedExecutionForStage.
 * Kept for backward compat with any direct callers outside this module.
 */

function executionHasApprovedQa(execution) {
  const inspections = Array.isArray(execution?.qualityInspections) ? execution.qualityInspections : [];
  return inspections.some((insp) => insp.result === 'APPROVED' || insp.result === 'CONDITIONALLY_ACCEPTED');
}

/**
 * Returns the pending recolection stage linked to a given rejected execution, if any.
 * The order object must have recolectionStages included (TASK-002).
 * @param {object} order
 * @param {bigint} rejectedExecutionId
 * @returns {object|null}
 */
function findPendingRecolectionForExecution(order, rejectedExecutionId) {
  const recol = (order.recolectionStages || []).find(
    (r) =>
      String(r.rejectedExecutionId) === String(rejectedExecutionId) &&
      r.status === 'PENDING',
  );
  return recol || null;
}

function assertStagePrerequisites(order, stageId) {
  const stages = [...(order?.recipeVersionSnapshot?.recipeVersion?.stages || [])]
    .sort((left, right) => Number(left?.stageOrder || 0) - Number(right?.stageOrder || 0));
  const currentStage = stages.find((stage) => String(stage?.id) === stageId.toString());

  if (!currentStage) {
    return;
  }

  // TASK-005: Support multi-execution (rejection + re-execution)
  // DEC-016 guard is updated: only block re-execution if the latest execution is COMPLETED.
  // If QA_REJECTED: allow re-execution provided losses have been acknowledged (DEC-003).
  const latestExecution = findLatestExecutionForStage(order, BigInt(stageId));
  if (latestExecution) {
    if (latestExecution.status === 'QA_REJECTED') {
      // BR-003: re-execution allowed only when losses have been declared
      if (!latestExecution.lossesAcknowledged) {
        throw createSubcodedHttpError(
          409,
          'Debe registrar las pérdidas del intento fallido antes de re-ejecutar la etapa',
          'conflict',
          'stage_losses_required',
        );
      }
      // TASK-005 / DEC-003: block re-execution if there is a PENDING recolection/recovery stage.
      // TASK-006 (qa-rejection-material-reconciliation-amendment): includes REPLACEMENT_RECOVERY
      const pendingRecolection = findPendingRecolectionForExecution(order, latestExecution.id);
      if (pendingRecolection) {
        const isReplacement = pendingRecolection.recoveryType === 'REPLACEMENT_RECOVERY';
        throw createSubcodedHttpError(
          409,
          isReplacement
            ? 'Debe completar la etapa de reposicion de materiales antes de re-ejecutar la etapa'
            : 'Debe confirmar la recoleccion de materiales antes de re-ejecutar la etapa',
          'conflict',
          isReplacement ? 'replacement_recovery_pending' : 'recolection_pending',
        );
      }
      // lossesAcknowledged === true AND no pending recolection → allow re-execution
    } else {
      // status === 'COMPLETED' — DEC-016 preserved for successful executions
      throw createSubcodedHttpError(
        409,
        `La etapa ya fue ejecutada (ejecucion ${latestExecution.id}). No se puede ejecutar dos veces la misma etapa.`,
        'conflict',
        'stage_execution_in_progress',
      );
    }
  }

  for (const priorStage of stages) {
    if (Number(priorStage?.stageOrder || 0) >= Number(currentStage.stageOrder || 0)) {
      break;
    }

    // BR-005: gate uses the latest COMPLETED execution (not QA_REJECTED)
    const priorExecution = findLatestCompletedExecutionForStage(order, BigInt(priorStage.id));
    if (!priorExecution) {
      throw createSubcodedHttpError(
        409,
        `Debe completar la etapa previa "${priorStage.name}" antes de ejecutar "${currentStage.name}"`,
        'conflict',
        'stage_out_of_sequence',
      );
    }

    // Gate QA: si la etapa anterior requiere analisis QA, este debe estar aprobado.
    if (priorStage.qaMandatory && !executionHasApprovedQa(priorExecution)) {
      throw createSubcodedHttpError(
        409,
        `La etapa "${priorStage.name}" requiere analisis QA aprobado antes de iniciar "${currentStage.name}"`,
        'conflict',
        'stage_qa_pending',
      );
    }
  }
}

function getOrderMaterialRequirements(order) {
  const persistedRequirements = Array.isArray(order?.materialRequirements) ? order.materialRequirements : [];
  if (persistedRequirements.length > 0) {
    return persistedRequirements;
  }

  const snapshotRequirements = order?.recipeVersionSnapshot?.recipeVersion?.materialRequirements;
  return Array.isArray(snapshotRequirements) ? snapshotRequirements : [];
}

function sumEntriesByProductId(entries) {
  return (entries || []).reduce((result, entry) => {
    const productIdKey = entry?.productId?.toString();
    if (!productIdKey) {
      return result;
    }

    result.set(productIdKey, (result.get(productIdKey) || 0) + Number(entry.quantity || 0));
    return result;
  }, new Map());
}

/**
 * Validates that stage consumptions do not exceed the allowed tolerance.
 *
 * @param {any} order
 * @param {any[]} entries
 * @param {any} auth
 * @param {string|null|undefined} overrideJustification
 * @param {number} [tolerancePercent] - Percentage from DB (e.g. 5.00 = 5%).
 *   When omitted, falls back to CONSUMPTION_TOLERANCE_PERCENT_FALLBACK.
 *   DEC-002: authoritative value comes from companies.production_consumption_tolerance_percent.
 */
function validateConsumptionAgainstRequirement(order, entries, auth, overrideJustification, tolerancePercent) {
  // Convert percentage to fractional multiplier (5.00 → 0.05)
  const effectiveTolerancePct = (typeof tolerancePercent === 'number' && Number.isFinite(tolerancePercent) && tolerancePercent >= 0)
    ? tolerancePercent
    : CONSUMPTION_TOLERANCE_PERCENT_FALLBACK;
  const toleranceFraction = effectiveTolerancePct / 100;

  const requirements = getOrderMaterialRequirements(order);
  if (requirements.length === 0 || !Array.isArray(entries) || entries.length === 0) {
    return {
      tolerancePercent: effectiveTolerancePct,
      exceededProducts: [],
      overrideJustification: null,
    };
  }

  const consumedByProductId = sumEntriesByProductId(entries);
  const exceededProducts = [];

  for (const requirement of requirements) {
    const productIdKey = requirement?.productId?.toString();
    if (!productIdKey || !consumedByProductId.has(productIdKey)) {
      continue;
    }

    const requiredQuantity = Number(requirement.requiredQuantity || 0);
    const consumedQuantity = consumedByProductId.get(productIdKey) || 0;
    const allowedQuantity = requiredQuantity * (1 + toleranceFraction);

    if (consumedQuantity > allowedQuantity + 0.000001) {
      exceededProducts.push({
        productId: requirement.productId,
        requiredQuantity,
        consumedQuantity,
        allowedQuantity,
        unit: requirement.unit ?? null,
      });
    }
  }

  if (exceededProducts.length === 0) {
    return {
      tolerancePercent: effectiveTolerancePct,
      exceededProducts: [],
      overrideJustification: null,
    };
  }

  const justification = assertStageOverrideAllowed(
    auth,
    overrideJustification,
    'consumption_exceeds_requirement',
    409,
  );

  return {
    tolerancePercent: effectiveTolerancePct,
    exceededProducts,
    overrideJustification: justification,
  };
}

function normalizeStageActualParameter(parameter) {
  return {
    name: String(parameter?.name || '').trim(),
    actualValue: Number(parameter?.actualValue),
    unit: parameter?.unit ?? null,
  };
}

function validateQaMeasurements(snapshotStage, actualParameters, auth, overrideJustification) {
  const expectedParameters = Array.isArray(snapshotStage?.expectedParameters) ? snapshotStage.expectedParameters : [];
  const normalizedActualParameters = (actualParameters || []).map(normalizeStageActualParameter);

  if (expectedParameters.length === 0) {
    return {
      qaOutOfTolerance: false,
      overrideJustification: null,
      actualParameters: normalizedActualParameters.map((parameter) => ({
        name: parameter.name,
        expectedValue: null,
        actualValue: parameter.actualValue,
        unit: parameter.unit,
        minTolerance: null,
        maxTolerance: null,
        withinTolerance: null,
      })),
    };
  }

  const actualByName = new Map(normalizedActualParameters.map((parameter) => [parameter.name, parameter]));
  const enrichedParameters = [];
  let hasOutOfTolerance = false;

  for (const expectedParameter of expectedParameters) {
    const actualParameter = actualByName.get(String(expectedParameter?.name || '').trim());
    if (!actualParameter) {
      throw createHttpError(400, `Falta capturar el parámetro QA ${expectedParameter.name}`, 'validation_error');
    }

    if (Number.isNaN(actualParameter.actualValue)) {
      throw createHttpError(400, `El parámetro QA ${expectedParameter.name} debe ser numérico`, 'validation_error');
    }

    const expectedValue = Number(expectedParameter.expectedValue);
    const minTolerance = Number(expectedParameter.minTolerance ?? 0);
    const maxTolerance = Number(expectedParameter.maxTolerance ?? 0);
    const lowerBound = expectedValue - minTolerance;
    const upperBound = expectedValue + maxTolerance;
    const withinTolerance = actualParameter.actualValue >= lowerBound
      && actualParameter.actualValue <= upperBound;

    if (!withinTolerance) {
      hasOutOfTolerance = true;
    }

    enrichedParameters.push({
      name: expectedParameter.name,
      expectedValue,
      actualValue: actualParameter.actualValue,
      unit: actualParameter.unit ?? expectedParameter.unit ?? null,
      minTolerance,
      maxTolerance,
      withinTolerance,
    });
  }

  if (!hasOutOfTolerance) {
    return {
      qaOutOfTolerance: false,
      overrideJustification: null,
      actualParameters: enrichedParameters,
    };
  }

  const justification = assertStageOverrideAllowed(
    auth,
    overrideJustification,
    'qa_out_of_tolerance_without_override',
    400,
  );

  return {
    qaOutOfTolerance: true,
    overrideJustification: justification,
    actualParameters: enrichedParameters,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK-005: Same-lot recolection-before-use validation
// (qa-rejection-material-reconciliation-amendment)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a balance map for recolected vs used quantities per (productId:lotId).
 * Input is an array of ProductionRecolectionEntry records.
 *
 * @param {Array<{productId:bigint|string, lotId:bigint|string, quantity:any}>} entries
 * @returns {Map<string, number>}  key = "productId:lotId"
 */
function buildRecolectionBalanceMap(entries) {
  const balanceMap = new Map();
  for (const entry of entries || []) {
    const key = `${entry.productId}:${entry.lotId}`;
    balanceMap.set(key, (balanceMap.get(key) || 0) + Number(entry.quantity));
  }
  return balanceMap;
}

/**
 * Validates that a proposed set of new consumption records do not violate
 * same-lot recolection coverage rules (TASK-005, FR-010, FR-011, BR-004, BR-006).
 *
 * Only enforced when the stage/recovery context has explicit recolection entries.
 * Legacy flows without entries are allowed to proceed (backward compat).
 *
 * @param {Array<{productId:bigint|string, lotId:bigint|string, quantity:any}>} recolectionEntries
 * @param {Array<{productId:bigint|string, lotId:bigint|string, quantity:any}>} existingConsumptions
 * @param {Array<{productId:bigint|string, lotId:bigint|string, quantity:number}>} proposedConsumptions
 */
function assertRecolectionCoverageForConsumption(recolectionEntries, existingConsumptions, proposedConsumptions) {
  // If no recolection entries exist, this is a legacy flow — skip validation (backward compat)
  if (!recolectionEntries || recolectionEntries.length === 0) {
    return;
  }

  const recolectedMap = buildRecolectionBalanceMap(recolectionEntries);
  const existingUsedMap = buildRecolectionBalanceMap(existingConsumptions);

  for (const proposed of proposedConsumptions || []) {
    if (!proposed.lotId) {
      continue;
    }

    const key = `${proposed.productId}:${proposed.lotId}`;
    const recolected = recolectedMap.get(key);

    // FR-010: usage must reference a previously recolected lot (BR-004)
    if (recolected === undefined) {
      throw createSubcodedHttpError(
        400,
        `El lote ${proposed.lotId} del producto ${proposed.productId} no fue recolectado para esta etapa/recuperación. Registre primero la recolección del lote antes de usarlo.`,
        'validation_error',
        'lot_not_recolected_for_stage',
      );
    }

    // FR-011: usage cannot exceed recolected quantity (BR-006)
    const alreadyUsed = existingUsedMap.get(key) || 0;
    const totalAfterProposed = alreadyUsed + Number(proposed.quantity);
    if (totalAfterProposed > recolected + 0.0001) {
      throw createSubcodedHttpError(
        400,
        `La cantidad a usar (${totalAfterProposed}) supera la cantidad recolectada (${recolected}) para el lote ${proposed.lotId} del producto ${proposed.productId}.`,
        'validation_error',
        'recolection_overuse',
      );
    }
  }
}

async function recordStageOverrideAuditEvent(req, auth, order, stageExecution, overrideMetadata) {
  if (!overrideMetadata || overrideMetadata.violationCodes.length === 0) {
    return null;
  }

  return audit.recordAuditEventSafelyIfAvailable({
    req,
    action: STAGE_OVERRIDE_AUDIT_ACTION,
    resourceType: 'production_stage_execution',
    resourceId: stageExecution.id,
    outcome: 'success',
    reasonCode: overrideMetadata.violationCodes.join(','),
    metadata: {
      permissionCode: OVERRIDE_PERMISSION_CODE,
      actorUserId: auth?.sub ?? null,
      companyId: auth?.companyId ?? null,
      productionOrderId: order.id,
      stageExecutionId: stageExecution.id,
      recipeStageId: stageExecution.recipeStageId,
      justification: overrideMetadata.overrideJustification,
      violationCodes: overrideMetadata.violationCodes,
      exceededProducts: overrideMetadata.exceededProducts,
      qaOutOfTolerance: overrideMetadata.qaOutOfTolerance,
    },
  });
}

module.exports = {
  normalizeOptionalText,
  assertStagePrerequisites,
  validateConsumptionAgainstRequirement,
  validateQaMeasurements,
  recordStageOverrideAuditEvent,
  // TASK-005: exported for use in production.state.js (warehouse SPA)
  findLatestExecutionForStage,
  findLatestCompletedExecutionForStage,
  // TASK-005: recolection gate check
  findPendingRecolectionForExecution,
  // TASK-005 (qa-rejection-material-reconciliation-amendment): same-lot validation
  buildRecolectionBalanceMap,
  assertRecolectionCoverageForConsumption,
  /** @deprecated Use companies.production_consumption_tolerance_percent via company.repository */
  CONSUMPTION_TOLERANCE_PERCENT: CONSUMPTION_TOLERANCE_PERCENT_FALLBACK,
  CONSUMPTION_TOLERANCE_PERCENT_FALLBACK,
};
