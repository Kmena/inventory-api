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

function findCompletedExecutionForStage(order, stageId) {
  return (order.stageExecutions || []).find((execution) => (
    String(execution.recipeStageId) === stageId.toString()
    && execution.endedAt
  )) || null;
}

function executionHasApprovedQa(execution) {
  const inspections = Array.isArray(execution?.qualityInspections) ? execution.qualityInspections : [];
  return inspections.some((insp) => insp.result === 'APPROVED' || insp.result === 'CONDITIONALLY_ACCEPTED');
}

function assertStagePrerequisites(order, stageId) {
  const stages = [...(order?.recipeVersionSnapshot?.recipeVersion?.stages || [])]
    .sort((left, right) => Number(left?.stageOrder || 0) - Number(right?.stageOrder || 0));
  const currentStage = stages.find((stage) => String(stage?.id) === stageId.toString());

  if (!currentStage) {
    return;
  }

  // DEC-016 / AC-016: guard against idempotent re-execution of the same stage.
  // Since ended_at is NOT NULL in current schema, any existing execution for this stage
  // represents a completed run. Reject to prevent double-consumption of materials.
  const existingExecution = findCompletedExecutionForStage(order, BigInt(stageId));
  if (existingExecution) {
    throw createSubcodedHttpError(
      409,
      `La etapa ya fue ejecutada (ejecucion ${existingExecution.id}). No se puede ejecutar dos veces la misma etapa.`,
      'conflict',
      'stage_execution_in_progress',
    );
  }

  for (const priorStage of stages) {
    if (Number(priorStage?.stageOrder || 0) >= Number(currentStage.stageOrder || 0)) {
      break;
    }

    const priorExecution = findCompletedExecutionForStage(order, BigInt(priorStage.id));
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
  /** @deprecated Use companies.production_consumption_tolerance_percent via company.repository */
  CONSUMPTION_TOLERANCE_PERCENT: CONSUMPTION_TOLERANCE_PERCENT_FALLBACK,
  CONSUMPTION_TOLERANCE_PERCENT_FALLBACK,
};
