const { createHttpError } = require('../lib/errors');
const { buildPaginatedResponse } = require('../lib/pagination');
const productRepository = require('../repositories/product.repository');
const recipeRepository = require('../repositories/recipe.repository');

function assertCompanyScope(auth) {
  if (!auth?.companyId) {
    throw createHttpError(403, 'El usuario debe pertenecer a una empresa', 'forbidden');
  }

  return {
    companyId: BigInt(auth.companyId),
    actorUserId: auth.sub ? BigInt(auth.sub) : null,
  };
}

function normalizeCode(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return String(value)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-');
}

// stageOrder and sortOrder are derived from array position — no manual numbering.

// ── recipe-stage-lineage-validation: balance engine ──────────────────────────
// Validates that PROCESSING stages only consume products from prior RECOLLECTION
// stages, that cumulative usage never exceeds cumulative recollection per product,
// and (in 'approval' mode) that every recollected product is fully allocated.
//
// Supports two sources:
//   - Payload stages (array order, no stageOrder yet)
//   - DB stages (have stageOrder; sorted before passing in)
//
// mode: 'draft'    — lineage + overuse checked; under-allocation allowed
// mode: 'approval' — lineage + overuse + full-allocation per product required
//
// Descriptive stageInputs without productId are ignored (BR-009, FR-009).
function assertRecipeStageLineageAndAllocation(stages, mode) {
  // Sort by stageOrder when present (DB records); trust array order otherwise (payload).
  const orderedStages = (stages || []).slice().sort((a, b) => {
    if (a.stageOrder != null && b.stageOrder != null) {
      return Number(a.stageOrder) - Number(b.stageOrder);
    }
    return 0;
  });

  // Cumulative balance per productId: { recollected, used, name }
  const balance = new Map();

  for (const stage of orderedStages) {
    const inputs = stage.stageInputs || [];

    if (stage.stageType === 'RECOLLECTION') {
      for (const input of inputs) {
        if (!input.productId) continue;
        const key = String(input.productId);
        const qty = Number(input.quantity) || 0;
        const entry = balance.get(key);
        if (entry) {
          entry.recollected += qty;
        } else {
          balance.set(key, { recollected: qty, used: 0, name: input.name });
        }
      }
    } else if (stage.stageType === 'PROCESSING') {
      for (const input of inputs) {
        if (!input.productId) continue;
        const key = String(input.productId);
        const qty = Number(input.quantity) || 0;
        const entry = balance.get(key);

        if (!entry || entry.recollected === 0) {
          throw createHttpError(
            400,
            `La etapa "${stage.name}" usa el insumo "${input.name}" que no fue recolectado en ninguna etapa de recoleccion previa`,
            'validation_error',
          );
        }

        if (entry.used + qty > entry.recollected) {
          const disponible = entry.recollected - entry.used;
          throw createHttpError(
            400,
            `La etapa "${stage.name}" excede la cantidad disponible del insumo "${input.name}": disponible ${disponible}, requerido ${qty}`,
            'validation_error',
          );
        }

        entry.used += qty;
      }
    }
  }

  if (mode === 'approval') {
    for (const entry of balance.values()) {
      if (entry.used < entry.recollected) {
        const sinAsignar = entry.recollected - entry.used;
        throw createHttpError(
          400,
          `Para aprobar la receta, todos los materiales recolectados deben ser usados completamente. El insumo "${entry.name}" tiene ${sinAsignar} sin asignar`,
          'validation_error',
        );
      }
    }
  }
}

// ── Derived BOM: aggregate product-bearing stageInputs across all stages ──

function aggregateIngredientsFromStages(stages) {
  const aggregated = new Map();
  const allStages = stages || [];

  // RECOLLECTION stages define what gets pulled FROM the warehouse.
  // PROCESSING stages consume already-collected material and must NOT be
  // counted again as additional warehouse requirements — that would double
  // the demand for any product that appears in both stage types.
  // Fall back to all stages only when the recipe has no RECOLLECTION stage
  // with productId inputs (backward-compatible with legacy single-stage recipes).
  const hasRecollectionInputs = allStages.some(
    (s) => s.stageType === 'RECOLLECTION'
      && Array.isArray(s.stageInputs)
      && s.stageInputs.some((i) => i.productId),
  );
  const sourcingStages = hasRecollectionInputs
    ? allStages.filter((s) => s.stageType === 'RECOLLECTION')
    : allStages;

  for (const stage of sourcingStages) {
    for (const input of stage.stageInputs || []) {
      if (!input.productId || !input.quantity) {
        continue;
      }

      const key = String(input.productId);
      const existing = aggregated.get(key);

      if (existing) {
        existing.quantity += Number(input.quantity);
      } else {
        aggregated.set(key, {
          productId: input.productId,
          quantity: Number(input.quantity),
          product: input.product ?? null,
        });
      }
    }
  }

  return [...aggregated.values()]
    .sort((left, right) => String(left.productId).localeCompare(String(right.productId)));
}

function normalizeQaParameterDefinition(parameter) {
  return {
    name: parameter.name,
    unit: parameter.unit,
    expectedValue: parameter.expectedValue,
    minTolerance: parameter.minTolerance,
    maxTolerance: parameter.maxTolerance,
  };
}

function normalizeStageInputUnit(unit) {
  if (unit === null || unit === undefined) {
    return null;
  }

  const normalizedUnit = String(unit).trim();
  return normalizedUnit.length > 0 ? normalizedUnit : null;
}

async function assertStageInputsUnitConsistency(payload, companyId) {
  const referencedProductIds = new Set();

  for (const stage of payload.stages || []) {
    for (const stageInput of stage.stageInputs || []) {
      if (stageInput.productId) {
        referencedProductIds.add(String(stageInput.productId));
      }
    }
  }

  if (referencedProductIds.size === 0) {
    return;
  }

  const requestedProductIds = [...referencedProductIds].map((productId) => BigInt(productId));
  const products = await productRepository.findProductsByIds(requestedProductIds, companyId);
  const productsById = new Map(products.map((product) => [String(product.id), product]));

  for (const stage of payload.stages || []) {
    for (const stageInput of stage.stageInputs || []) {
      if (!stageInput.productId) {
        continue;
      }

      const product = productsById.get(String(stageInput.productId));
      if (!product) {
        continue;
      }

      const normalizedUnit = normalizeStageInputUnit(stageInput.unit);
      if (normalizedUnit === product.unit) {
        continue;
      }

      throw createHttpError(
        400,
        `La unidad del insumo "${stageInput.name}" debe coincidir con la unidad del producto "${product.name}" (esperada: ${product.unit})`,
        'validation_error',
      );
    }
  }
}

function toRecipeVersionCreateData(payload, scope, recipeId, versionNumber) {
  return {
    companyId: scope.companyId,
    recipeId,
    versionNumber,
    effectiveFrom: payload.effectiveFrom ?? null,
    effectiveTo: payload.effectiveTo ?? null,
    expectedYield: payload.expectedYield ?? null,
    expectedWaste: payload.expectedWaste ?? null,
    yieldTolerancePercent: payload.yieldTolerancePercent ?? null,
    wasteTolerancePercent: payload.wasteTolerancePercent ?? null,
    instructions: payload.instructions ?? null,
    notes: payload.notes ?? null,
    // TASK-004 (production-size-conversion): persist the recipe scaling basis.
    // Default is PER_OUTPUT_KG as the primary model for new records.
    quantityBasis: payload.quantityBasis ?? 'PER_OUTPUT_KG',
    createdByUserId: scope.actorUserId,
    stages: {
      create: payload.stages.map((stage, stageIndex) => buildRecipeStageCreateData(stage, stageIndex)),
    },
  };
}

// Build a single stage create payload including stage-type and process-code fields (TASK-001).
function buildRecipeStageCreateData(stage, stageIndex) {
  const stageType = stage.stageType ?? 'PROCESSING';
  return {
    stageOrder: stageIndex,
    name: stage.name,
    instructions: stage.instructions ?? null,
    responsibleRoleCode: stage.responsibleRoleCode ?? null,
    expectedParameters: (stage.expectedParameters ?? []).map(normalizeQaParameterDefinition),
    parameterTolerances: stage.parameterTolerances ?? [],
    requiredEvidence: stage.requiredEvidence ?? [],
    qaMandatory: stage.qaMandatory ?? false,
    stageType,
    processCode: stageType === 'PROCESSING' ? (stage.processCode ?? null) : null,
    processLabel: stage.processCode === 'OTHER' ? (stage.processLabel ?? null) : null,
    stageInputs: {
      create: (stage.stageInputs ?? []).map((stageInput, inputIndex) => ({
        productId: stageInput.productId ?? null,
        name: stageInput.name,
        quantity: stageInput.quantity ?? null,
        unit: normalizeStageInputUnit(stageInput.unit),
        sortOrder: inputIndex,
        notes: stageInput.notes ?? null,
      })),
    },
  };
}

function buildRecipeWriteData(payload) {
  const data = {};

  if (Object.prototype.hasOwnProperty.call(payload, 'code')) {
    data.code = normalizeCode(payload.code);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
    data.name = payload.name.trim();
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'recipeType')) {
    data.recipeType = payload.recipeType ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'isActive')) {
    data.isActive = payload.isActive;
  }

  return data;
}

async function validateCompanyProductReferences(payload, companyId) {
  const referencedProductIds = new Set();

  for (const stage of payload.stages || []) {
    for (const stageInput of stage.stageInputs || []) {
      if (stageInput.productId) {
        referencedProductIds.add(String(stageInput.productId));
      }
    }
  }

  if (referencedProductIds.size === 0) {
    return;
  }

  const requestedProductIds = [...referencedProductIds].map((productId) => BigInt(productId));
  const products = await productRepository.findProductsByIds(requestedProductIds, companyId);
  if (products.length !== requestedProductIds.length) {
    throw createHttpError(400, 'Todos los productos referenciados en la receta deben pertenecer a la empresa autenticada', 'validation_error');
  }
}

function buildRecipeVersionUpdateData(payload) {
  const data = {};

  for (const fieldName of [
    'effectiveFrom',
    'effectiveTo',
    'expectedYield',
    'expectedWaste',
    'yieldTolerancePercent',
    'wasteTolerancePercent',
    'instructions',
    'notes',
    // TASK-004 (production-size-conversion): allow updating the recipe scaling basis.
    'quantityBasis',
  ]) {
    if (Object.prototype.hasOwnProperty.call(payload, fieldName)) {
      data[fieldName] = payload[fieldName] ?? null;
    }
  }

  if (payload.stages) {
    data.stages = {
      deleteMany: {},
      create: payload.stages.map((stage, stageIndex) => buildRecipeStageCreateData(stage, stageIndex)),
    };
  }

  return data;
}

function serializeRecipeStageInput(stageInput) {
  return {
    id: stageInput.id,
    productId: stageInput.productId,
    name: stageInput.name,
    quantity: stageInput.quantity,
    unit: normalizeStageInputUnit(stageInput.unit),
    sortOrder: stageInput.sortOrder,
    notes: stageInput.notes,
    product: stageInput.product ? {
      id: stageInput.product.id,
      code: stageInput.product.code,
      name: stageInput.product.name,
      unit: stageInput.product.unit,
      isActive: stageInput.product.isActive,
    } : null,
  };
}

function serializeRecipeStage(stage) {
  // Legacy stages without stageType are treated as PROCESSING for backward compatibility (FR-018, DEC-legacy-compat).
  const stageType = stage.stageType ?? 'PROCESSING';
  return {
    id: stage.id,
    stageOrder: stage.stageOrder,
    name: stage.name,
    instructions: stage.instructions,
    responsibleRoleCode: stage.responsibleRoleCode,
    expectedParameters: (stage.expectedParameters ?? []).map(normalizeQaParameterDefinition),
    parameterTolerances: stage.parameterTolerances ?? [],
    requiredEvidence: stage.requiredEvidence ?? [],
    qaMandatory: stage.qaMandatory,
    // Stage typing and process definition (TASK-001, FR-003, FR-006)
    stageType,
    processCode: stage.processCode ?? null,
    processLabel: stage.processLabel ?? null,
    stageInputs: (stage.stageInputs || []).map(serializeRecipeStageInput),
  };
}

function serializeAggregatedIngredient(ingredient) {
  return {
    productId: ingredient.productId,
    quantity: ingredient.quantity,
    product: ingredient.product ? {
      id: ingredient.product.id,
      code: ingredient.product.code,
      name: ingredient.product.name,
      unit: ingredient.product.unit,
      isActive: ingredient.product.isActive,
    } : null,
  };
}

function serializeRecipeVersion(version) {
  const serializedStages = (version.stages || []).map(serializeRecipeStage);

  return {
    id: version.id,
    recipeId: version.recipeId,
    companyId: version.companyId,
    versionNumber: version.versionNumber,
    status: version.status,
    // TASK-004 (production-size-conversion): expose recipe scaling basis to consumers.
    quantityBasis: version.quantityBasis ?? 'PER_OUTPUT_KG',
    effectiveFrom: version.effectiveFrom,
    effectiveTo: version.effectiveTo,
    expectedYield: version.expectedYield,
    expectedWaste: version.expectedWaste,
    yieldTolerancePercent: version.yieldTolerancePercent,
    wasteTolerancePercent: version.wasteTolerancePercent,
    instructions: version.instructions,
    notes: version.notes,
    approvedAt: version.approvedAt,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
    createdByUser: version.createdByUser ? {
      id: version.createdByUser.id,
      fullName: version.createdByUser.fullName,
      username: version.createdByUser.username,
    } : null,
    approvedByUser: version.approvedByUser ? {
      id: version.approvedByUser.id,
      fullName: version.approvedByUser.fullName,
      username: version.approvedByUser.username,
    } : null,
    ingredients: aggregateIngredientsFromStages(version.stages).map(serializeAggregatedIngredient),
    stages: serializedStages,
  };
}

function serializeRecipe(recipe) {
  const approvedVersions = (recipe.versions || []).filter((version) => version.status === 'APPROVED');
  const latestApprovedVersion = approvedVersions[0] || null;

  return {
    id: recipe.id,
    companyId: recipe.companyId,
    code: recipe.code,
    name: recipe.name,
    recipeType: recipe.recipeType,
    isActive: recipe.isActive,
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
    latestApprovedVersionId: latestApprovedVersion?.id ?? null,
    latestApprovedVersionNumber: latestApprovedVersion?.versionNumber ?? null,
    versions: (recipe.versions || []).map(serializeRecipeVersion),
  };
}

async function listRecipes(auth, pagination = null) {
  const scope = assertCompanyScope(auth);
  const recipes = await recipeRepository.findRecipes(scope.companyId, pagination);
  if (!pagination) {
    return /** @type {Array<any>} */ (recipes).map(serializeRecipe);
  }

  const paginatedRecipes = /** @type {{ items: Array<any>, totalItems: number }} */ (recipes);
  return buildPaginatedResponse(paginatedRecipes.items.map(serializeRecipe), pagination, paginatedRecipes.totalItems);
}

async function getRecipe(recipeId, auth) {
  const scope = assertCompanyScope(auth);
  const recipe = await recipeRepository.findRecipeById(recipeId, scope.companyId);
  if (!recipe) {
    throw createHttpError(404, 'Receta no encontrada', 'not_found');
  }

  return serializeRecipe(recipe);
}

async function createRecipe(payload, auth) {
  const scope = assertCompanyScope(auth);

  try {
    const recipe = await recipeRepository.createRecipe({
      companyId: scope.companyId,
      ...buildRecipeWriteData(payload),
    });
    return serializeRecipe(recipe);
  } catch (error) {
    if (error.code === 'P2002') {
      throw createHttpError(409, 'Ya existe una receta con ese codigo', 'conflict');
    }
    throw error;
  }
}

async function updateRecipe(recipeId, payload, auth) {
  const scope = assertCompanyScope(auth);
  const recipe = await recipeRepository.updateRecipe(recipeId, scope.companyId, buildRecipeWriteData(payload));
  if (!recipe) {
    throw createHttpError(404, 'Receta no encontrada', 'not_found');
  }

  return serializeRecipe(recipe);
}

async function listRecipeVersions(recipeId, auth) {
  const scope = assertCompanyScope(auth);
  const recipe = await recipeRepository.findRecipeById(recipeId, scope.companyId);
  if (!recipe) {
    throw createHttpError(404, 'Receta no encontrada', 'not_found');
  }

  const versions = await recipeRepository.findRecipeVersionsByRecipeId(recipeId, scope.companyId);
  return versions.map(serializeRecipeVersion);
}

async function createRecipeVersion(recipeId, payload, auth) {
  const scope = assertCompanyScope(auth);
  const recipe = await recipeRepository.findRecipeById(recipeId, scope.companyId);
  if (!recipe) {
    throw createHttpError(404, 'Receta no encontrada', 'not_found');
  }

  await validateCompanyProductReferences(payload, scope.companyId);
  await assertStageInputsUnitConsistency(payload, scope.companyId);
  // recipe-stage-lineage-validation: draft mode — lineage + overuse only, under-allocation allowed
  assertRecipeStageLineageAndAllocation(payload.stages, 'draft');

  const latestVersion = await recipeRepository.findLatestRecipeVersion(recipeId, scope.companyId);
  const versionNumber = (latestVersion?.versionNumber || 0) + 1;

  const version = await recipeRepository.createRecipeVersion(
    toRecipeVersionCreateData(payload, scope, recipeId, versionNumber),
  );

  return serializeRecipeVersion(version);
}

async function updateRecipeVersion(recipeVersionId, payload, auth) {
  const scope = assertCompanyScope(auth);
  const currentVersion = await recipeRepository.findRecipeVersionById(recipeVersionId, scope.companyId);
  if (!currentVersion) {
    throw createHttpError(404, 'Version de receta no encontrada', 'not_found');
  }
  if (currentVersion.status === 'APPROVED') {
    throw createHttpError(409, 'Las versiones aprobadas son inmutables; cree una nueva version', 'conflict');
  }

  await validateCompanyProductReferences(payload, scope.companyId);
  await assertStageInputsUnitConsistency(payload, scope.companyId);
  // recipe-stage-lineage-validation: draft mode — validate only when stages are in the update payload
  if (payload.stages) {
    assertRecipeStageLineageAndAllocation(payload.stages, 'draft');
  }

  const updatedVersion = await recipeRepository.updateRecipeVersion(
    recipeVersionId,
    scope.companyId,
    buildRecipeVersionUpdateData(payload),
  );

  if (!updatedVersion) {
    throw createHttpError(404, 'Version de receta no encontrada', 'not_found');
  }

  return serializeRecipeVersion(updatedVersion);
}

/**
 * BR-011: a recipe version may only be approved when every stage input that
 * exists in the version has a productId bound to the company catalogue.
 * Descriptive stage inputs (no productId) are allowed in DRAFT but block approval.
 * Reference: er_mvp_prd.md:3196-3197 and decisions.md DEC-006.
 */
function assertAllStageInputsHaveProductId(version) {
  const stages = Array.isArray(version.stages) ? version.stages : [];
  let missingCount = 0;

  for (const stage of stages) {
    const inputs = Array.isArray(stage.stageInputs) ? stage.stageInputs : [];
    for (const input of inputs) {
      if (!input.productId) {
        missingCount += 1;
      }
    }
  }

  if (missingCount > 0) {
    throw createHttpError(
      400,
      `Toda materia prima debe estar registrada en el catalogo; hay ${missingCount} insumo${missingCount === 1 ? '' : 's'} sin producto asociado`,
      'validation_error',
    );
  }
}

async function approveRecipeVersion(recipeVersionId, payload, auth) {
  const scope = assertCompanyScope(auth);
  const currentVersion = await recipeRepository.findRecipeVersionById(recipeVersionId, scope.companyId);
  if (!currentVersion) {
    throw createHttpError(404, 'Version de receta no encontrada', 'not_found');
  }
  if (currentVersion.status === 'APPROVED') {
    throw createHttpError(409, 'La version ya fue aprobada', 'conflict');
  }

  // BR-011 / AC-015: reject if any stageInput lacks a productId.
  assertAllStageInputsHaveProductId(currentVersion);
  // recipe-stage-lineage-validation: approval mode — lineage + overuse + full allocation per product
  assertRecipeStageLineageAndAllocation(currentVersion.stages, 'approval');

  const approvalData = {
    status: 'APPROVED',
    approvedAt: new Date(),
    approvedByUserId: scope.actorUserId,
  };

  if (Object.prototype.hasOwnProperty.call(payload, 'effectiveFrom')) {
    approvalData.effectiveFrom = payload.effectiveFrom ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'effectiveTo')) {
    approvalData.effectiveTo = payload.effectiveTo ?? null;
  }

  const approvedVersion = await recipeRepository.updateRecipeVersion(recipeVersionId, scope.companyId, approvalData);
  if (!approvedVersion) {
    throw createHttpError(404, 'Version de receta no encontrada', 'not_found');
  }

  return serializeRecipeVersion(approvedVersion);
}

module.exports = {
  listRecipes,
  getRecipe,
  createRecipe,
  updateRecipe,
  listRecipeVersions,
  createRecipeVersion,
  updateRecipeVersion,
  approveRecipeVersion,
  aggregateIngredientsFromStages,
  assertStageInputsUnitConsistency,
  // TASK-004 (production-size-conversion): expose serializer so tests can verify
  // quantityBasis is included in the API representation.
  serializeRecipeVersion,
  __private__: {
    assertAllStageInputsHaveProductId,
    assertRecipeStageLineageAndAllocation,
  },
};
