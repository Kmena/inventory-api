const { createHttpError } = require('../lib/errors');
const { aggregateIngredientsFromStages } = require('./recipe.service');

function isPrismaDecimal(value) {
  return (
    typeof value === 'object'
    && value !== null
    && typeof value.toString === 'function'
    && Array.isArray(value.d)
    && typeof value.e === 'number'
    && typeof value.s === 'number'
  );
}

function toSnapshotValue(value) {
  if (value === null || value === undefined) {
    return value ?? null;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (isPrismaDecimal(value)) {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(toSnapshotValue);
  }

  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entryValue]) => [key, toSnapshotValue(entryValue)]));
  }

  return value;
}

function normalizeSnapshotQaParameterDefinition(parameter) {
  return {
    name: parameter?.name ?? null,
    unit: parameter?.unit ?? null,
    expectedValue: parameter?.expectedValue ?? null,
    minTolerance: parameter?.minTolerance ?? null,
    maxTolerance: parameter?.maxTolerance ?? null,
  };
}

function buildRecipeVersionSnapshot(recipeVersion, override) {
  return toSnapshotValue({
    capturedAt: new Date().toISOString(),
    recipe: recipeVersion.recipe ? {
      id: recipeVersion.recipe.id,
      code: recipeVersion.recipe.code,
      name: recipeVersion.recipe.name,
      recipeType: recipeVersion.recipe.recipeType,
      isActive: recipeVersion.recipe.isActive,
    } : null,
    recipeVersion: {
      id: recipeVersion.id,
      recipeId: recipeVersion.recipeId,
      versionNumber: recipeVersion.versionNumber,
      status: recipeVersion.status,
      // TASK-004 (production-size-conversion): freeze basis into snapshot so the order
      // always knows how it was calculated, even if the recipe is later updated.
      quantityBasis: recipeVersion.quantityBasis ?? 'PER_OUTPUT_KG',
      effectiveFrom: recipeVersion.effectiveFrom,
      effectiveTo: recipeVersion.effectiveTo,
      expectedYield: recipeVersion.expectedYield,
      expectedWaste: recipeVersion.expectedWaste,
      yieldTolerancePercent: recipeVersion.yieldTolerancePercent,
      wasteTolerancePercent: recipeVersion.wasteTolerancePercent,
      instructions: recipeVersion.instructions,
      notes: recipeVersion.notes,
      approvedAt: recipeVersion.approvedAt,
      ingredients: aggregateIngredientsFromStages(recipeVersion.stages).map((ingredient) => ({
        productId: ingredient.productId,
        quantity: ingredient.quantity,
        product: ingredient.product ? {
          id: ingredient.product.id,
          code: ingredient.product.code,
          name: ingredient.product.name,
          unit: ingredient.product.unit,
          isActive: ingredient.product.isActive,
        } : null,
      })),
      stages: (recipeVersion.stages || []).map((stage) => ({
        id: stage.id,
        stageOrder: stage.stageOrder,
        name: stage.name,
        instructions: stage.instructions,
        responsibleRoleCode: stage.responsibleRoleCode,
        expectedParameters: (stage.expectedParameters ?? []).map(normalizeSnapshotQaParameterDefinition),
        ...(Array.isArray(stage.parameterTolerances) && stage.parameterTolerances.length > 0
          ? { parameterTolerances: stage.parameterTolerances }
          : {}),
        requiredEvidence: stage.requiredEvidence ?? [],
        qaMandatory: stage.qaMandatory,
        stageInputs: (stage.stageInputs || []).map((stageInput) => ({
          id: stageInput.id,
          productId: stageInput.productId,
          name: stageInput.name,
          quantity: stageInput.quantity,
          unit: stageInput.unit,
          sortOrder: stageInput.sortOrder,
          notes: stageInput.notes,
          product: stageInput.product ? {
            id: stageInput.product.id,
            code: stageInput.product.code,
            name: stageInput.product.name,
            unit: stageInput.product.unit,
            isActive: stageInput.product.isActive,
          } : null,
        })),
      })),
    },
    override: override ? {
      permissionCode: 'production.override',
      justification: override.justification,
      violationCodes: override.violationCodes,
    } : null,
  });
}

function buildMaterialRequirements(recipeVersion, quantity) {
  const requirementsByProductId = new Map();
  const allStages = recipeVersion?.stages || [];

  // Mirror the same deduplication logic as aggregateIngredientsFromStages:
  // PROCESSING stages consume already-collected material — counting them again
  // would inflate warehouse requirements for products that also appear in a
  // RECOLLECTION stage. Only fall back to all stages for legacy recipes that
  // have no RECOLLECTION stage with productId inputs.
  const hasRecollectionInputs = allStages.some(
    (s) => s.stageType === 'RECOLLECTION'
      && s.stageInputs?.some((i) => i.productId),
  );
  const sourcingStages = hasRecollectionInputs
    ? allStages.filter((s) => s.stageType === 'RECOLLECTION')
    : allStages;

  for (const stage of sourcingStages) {
    for (const stageInput of stage?.stageInputs || []) {
      if (!stageInput?.productId) {
        continue;
      }

      const productIdKey = String(stageInput.productId);
      const requiredQuantity = Number(stageInput.quantity || 0) * Number(quantity || 0);
      const current = requirementsByProductId.get(productIdKey);

      if (current) {
        current.requiredQuantity += requiredQuantity;
        continue;
      }

      requirementsByProductId.set(productIdKey, {
        productId: stageInput.productId,
        requiredQuantity,
        unit: stageInput.unit ?? stageInput.product?.unit ?? null,
      });
    }
  }

  return [...requirementsByProductId.values()];
}

async function assertStockAvailability(tx, scope, requirements, warehouseId, override) {
  const productIds = [...new Set((requirements || []).map((requirement) => requirement.productId).filter(Boolean))];
  if (productIds.length === 0) {
    return [];
  }

  const warehouseStocks = await tx.warehouseStock.findMany({
    where: {
      warehouseId,
      productId: { in: productIds },
      warehouse: { companyId: scope.companyId },
    },
    select: {
      productId: true,
      quantity: true,
      reservedQuantity: true,
    },
  });

  const stockByProductId = new Map(
    warehouseStocks.map((stock) => [String(stock.productId), stock]),
  );

  const availability = requirements.map((requirement) => {
    const currentStock = stockByProductId.get(String(requirement.productId));
    const availableQuantity = Number(currentStock?.quantity || 0) - Number(currentStock?.reservedQuantity || 0);
    const missingQuantity = Math.max(0, Number(requirement.requiredQuantity || 0) - availableQuantity);

    return {
      productId: requirement.productId,
      requiredQuantity: Number(requirement.requiredQuantity || 0),
      availableQuantity,
      missingQuantity,
      unit: requirement.unit ?? null,
    };
  });

  const missing = availability.filter((entry) => entry.missingQuantity > 0.000001);
  if (missing.length > 0 && !override) {
    const error = /** @type {Error & { statusCode: number, code: string, subCode?: string, missing?: Array<any> }} */ (
      createHttpError(409, 'No hay stock suficiente para cubrir los requerimientos de materiales de la orden', 'conflict')
    );
    error.subCode = 'insufficient_stock';
    error.missing = missing;
    throw error;
  }

  return availability;
}

function buildEnrichedSnapshot(recipeVersion, requirements, override) {
  const snapshot = buildRecipeVersionSnapshot(recipeVersion, override);
  snapshot.recipeVersion.materialRequirements = toSnapshotValue(requirements || []);
  return snapshot;
}

module.exports = {
  buildRecipeVersionSnapshot,
  buildMaterialRequirements,
  assertStockAvailability,
  buildEnrichedSnapshot,
  __private__: {
    toSnapshotValue,
    isPrismaDecimal,
    normalizeSnapshotQaParameterDefinition,
  },
};
