const { createHttpError } = require('../lib/errors');
const audit = require('../lib/audit');
const { permissionRequiresJustification } = require('../security/permission-governance.service');

const OVERRIDE_PERMISSION_CODE = 'production.override';
const CONSUMPTION_TOLERANCE_PERCENT = 0.05;
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

function assertStagePrerequisites(order, stageId) {
  const stages = [...(order?.recipeVersionSnapshot?.recipeVersion?.stages || [])]
    .sort((left, right) => Number(left?.stageOrder || 0) - Number(right?.stageOrder || 0));
  const currentStage = stages.find((stage) => String(stage?.id) === stageId.toString());

  if (!currentStage) {
    return;
  }

  for (const priorStage of stages) {
    if (Number(priorStage?.stageOrder || 0) >= Number(currentStage.stageOrder || 0)) {
      break;
    }

    if (!findCompletedExecutionForStage(order, BigInt(priorStage.id))) {
      throw createSubcodedHttpError(
        409,
        `Debe completar la etapa previa ${priorStage.name} antes de ejecutar ${currentStage.name}`,
        'conflict',
        'stage_out_of_sequence',
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

function validateConsumptionAgainstRequirement(order, entries, auth, overrideJustification) {
  const requirements = getOrderMaterialRequirements(order);
  if (requirements.length === 0 || !Array.isArray(entries) || entries.length === 0) {
    return {
      tolerancePercent: CONSUMPTION_TOLERANCE_PERCENT,
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
    const allowedQuantity = requiredQuantity * (1 + CONSUMPTION_TOLERANCE_PERCENT);

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
      tolerancePercent: CONSUMPTION_TOLERANCE_PERCENT,
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
    tolerancePercent: CONSUMPTION_TOLERANCE_PERCENT,
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
  CONSUMPTION_TOLERANCE_PERCENT,
};
