const { createHttpError } = require('../lib/errors');
const { buildPaginatedResponse } = require('../lib/pagination');
const productRepository = require('../repositories/product.repository');
const productionRepository = require('../repositories/production.repository');
const recipeRepository = require('../repositories/recipe.repository');
const inventoryRepository = require('../repositories/inventory.repository');
const productionPlanningService = require('./production-planning.service');
const productionExecutionService = require('./production-execution.service');
const audit = require('../lib/audit');
const { permissionRequiresJustification } = require('../security/permission-governance.service');

const ALLOWED_PRODUCTION_SOURCING_METHODS = new Set(['PRODUCTION_ONLY', 'PRODUCTION_OR_PURCHASE']);
const OVERRIDE_PERMISSION_CODE = 'production.override';
const STOCK_OVERRIDE_REASON_CODE = 'insufficient_stock';
const STOCK_OVERRIDE_AUDIT_ACTION = 'PRODUCTION_ORDER_OVERRIDE_STOCK';

function assertCompanyScope(auth) {
  if (!auth?.companyId) {
    throw createHttpError(403, 'El usuario debe pertenecer a una empresa', 'forbidden');
  }

  return {
    companyId: BigInt(auth.companyId),
  };
}

function actorHasPermission(auth, permissionCode) {
  return Array.isArray(auth?.permissions) && auth.permissions.includes(permissionCode);
}

function normalizeOptionalText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalizedValue = String(value).trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function buildGuardrailViolations(product, recipeVersion) {
  const violations = [];

  if (!product || !ALLOWED_PRODUCTION_SOURCING_METHODS.has(product.sourcingMethod)) {
    violations.push('sourcing_method_not_production_capable');
  }

  if (!recipeVersion) {
    violations.push('recipe_version_missing');
    return violations;
  }

  if (recipeVersion.status !== 'APPROVED') {
    violations.push('recipe_version_not_approved');
  }

  if (!recipeVersion.recipe || recipeVersion.recipe.isActive === false) {
    violations.push('recipe_inactive');
  }

  if (!product?.recipeId) {
    violations.push('product_active_recipe_missing');
  } else if (recipeVersion.recipeId !== product.recipeId) {
    violations.push('recipe_version_not_bound_to_product');
  }

  return violations;
}

function assertOverrideAllowed(auth, overrideJustification, violations) {
  if (violations.length === 0) {
    return null;
  }

  if (!actorHasPermission(auth, OVERRIDE_PERMISSION_CODE)) {
    throw createHttpError(
      400,
      'El producto solo puede producirse con sourcing valido y una receta aprobada activa; use un usuario con permiso de override para excepciones justificadas',
      'validation_error',
    );
  }

  if (permissionRequiresJustification(OVERRIDE_PERMISSION_CODE) && !normalizeOptionalText(overrideJustification)) {
    throw createHttpError(400, 'El override de producción requiere una justificación explícita', 'validation_error');
  }

  return {
    justification: normalizeOptionalText(overrideJustification),
    violationCodes: violations,
  };
}

function createStockCheckOverride(auth, overrideJustification, baseOverride) {
  if (baseOverride) {
    return {
      justification: baseOverride.justification,
      violationCodes: [...baseOverride.violationCodes],
    };
  }

  if (!actorHasPermission(auth, OVERRIDE_PERMISSION_CODE)) {
    return null;
  }

  const justification = normalizeOptionalText(overrideJustification);
  if (permissionRequiresJustification(OVERRIDE_PERMISSION_CODE) && !justification) {
    return null;
  }

  return {
    justification,
    violationCodes: [],
  };
}

function hasMaterialShortage(availability) {
  return Array.isArray(availability)
    && availability.some((entry) => Number(entry?.missingQuantity || 0) > 0.000001);
}

function mergeOverrideViolationCodes(override, extraViolationCodes) {
  if (!override) {
    return null;
  }

  const mergedViolationCodes = [...new Set([
    ...(override.violationCodes || []),
    ...(extraViolationCodes || []),
  ])];

  return {
    justification: override.justification,
    violationCodes: mergedViolationCodes,
  };
}

function mapAvailabilityToMaterialRequirementRows(companyId, orderId, availability) {
  return (availability || []).map((entry) => ({
    companyId,
    productionOrderId: orderId,
    productId: entry.productId,
    requiredQuantity: entry.requiredQuantity,
    unit: entry.unit,
    availableAtCreation: entry.availableQuantity,
    shortageAtCreation: entry.missingQuantity,
  }));
}

function buildOrderSnapshotWithMaterialRequirements(order, recipeVersion, availability, override) {
  if (!order?.recipeVersionSnapshot) {
    return buildEnrichedSnapshot(recipeVersion, availability, override);
  }

  const snapshot = toSnapshotValue(order.recipeVersionSnapshot);
  if (!snapshot.recipeVersion) {
    return buildEnrichedSnapshot(recipeVersion, availability, override);
  }

  snapshot.recipeVersion.materialRequirements = toSnapshotValue(availability || []);
  snapshot.override = override ? {
    permissionCode: OVERRIDE_PERMISSION_CODE,
    justification: override.justification,
    violationCodes: override.violationCodes,
  } : null;
  return snapshot;
}

async function recordStockOverrideAuditEvent(req, auth, order, override, availability) {
  if (!override?.violationCodes?.includes(STOCK_OVERRIDE_REASON_CODE)) {
    return null;
  }

  return audit.recordAuditEventSafelyIfAvailable({
    req,
    action: STOCK_OVERRIDE_AUDIT_ACTION,
    resourceType: 'production_order',
    resourceId: order.id,
    outcome: 'success',
    reasonCode: STOCK_OVERRIDE_REASON_CODE,
    metadata: {
      permissionCode: OVERRIDE_PERMISSION_CODE,
      actorUserId: auth?.sub ?? null,
      companyId: auth?.companyId ?? null,
      productId: order.productId ?? null,
      productionOrderId: order.id,
      justification: override.justification,
      violationCodes: override.violationCodes,
      materialRequirements: (availability || []).filter((entry) => Number(entry?.missingQuantity || 0) > 0.000001),
    },
  });
}

async function assertCompanyWarehouses(companyId, warehouseIds) {
  const uniqueWarehouseIds = [...new Set(warehouseIds.map((warehouseId) => warehouseId.toString()))].map((warehouseId) => BigInt(warehouseId));
  const warehouses = await productRepository.findCompanyWarehousesByIds(companyId, uniqueWarehouseIds);

  if (warehouses.length !== uniqueWarehouseIds.length) {
    throw createHttpError(400, 'Todas las bodegas de la orden de producción deben pertenecer a la empresa autenticada', 'validation_error');
  }
}

async function assertResponsibleUser(companyId, responsibleUserId) {
  const responsibleUser = await productionRepository.findActiveCompanyUserById(responsibleUserId, companyId);
  if (!responsibleUser) {
    throw createHttpError(400, 'El responsable de producción debe ser un usuario activo de la empresa autenticada', 'validation_error');
  }
}

const {
  buildRecipeVersionSnapshot,
  buildMaterialRequirements,
  assertStockAvailability,
  buildEnrichedSnapshot,
  __private__: productionPlanningPrivate,
} = productionPlanningService;
const {
  executeProductionStage,
  recordProductionReturn,
  reconcileProductionOrderAggregates,
  completeProductionOrder: completeProductionOrderExecution,
  __private__: productionExecutionPrivate,
} = productionExecutionService;
const { toSnapshotValue } = productionPlanningPrivate;
const {
  serializeProductionReturn,
  serializeStageExecution,
  assertStagePrerequisites,
  validateConsumptionAgainstRequirement,
  validateQaMeasurements,
  findStageSnapshot,
  assertLotIdPresentForProductionConsumption,
  assertLotIdPresentForProductionWaste,
  assertLotIdPresentForProductionReturn,
  assertLotIdPresentForProductionInventoryEntry,
  buildMissingProductionLotMessage,
  resolveProductionLotContext,
  reduceStageInventory,
} = productionExecutionPrivate;

function serializeProductionOrder(order) {
  return {
    id: order.id,
    companyId: order.companyId,
    orderId: order.orderId,
    productId: order.productId,
    recipeId: order.recipeId,
    recipeVersionId: order.recipeVersionId,
    originWarehouseId: order.originWarehouseId,
    destinationWarehouseId: order.destinationWarehouseId,
    responsibleUserId: order.responsibleUserId,
    quantity: order.quantity,
    status: order.status,
    priority: order.priority,
    responsible: order.responsible,
    productionLotCode: order.productionLotCode,
    plannedDate: order.plannedDate,
    productionDate: order.productionDate,
    expirationDate: order.expirationDate,
    submittedAt: order.submittedAt,
    approvedAt: order.approvedAt,
    startedAt: order.startedAt,
    cancelledAt: order.cancelledAt,
    overrideJustification: order.overrideJustification,
    recipeVersionSnapshot: order.recipeVersionSnapshot,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    product: order.product,
    recipe: order.recipe,
    recipeVersion: order.recipeVersion,
    originWarehouse: order.originWarehouse,
    destinationWarehouse: order.destinationWarehouse,
    responsibleUser: order.responsibleUser,
    items: order.items,
    stageExecutions: Array.isArray(order.stageExecutions)
      ? order.stageExecutions.map(serializeStageExecution)
      : undefined,
  };
}

async function getValidatedProductionContext(payload, auth) {
  const scope = assertCompanyScope(auth);
  const product = await productRepository.findProductById(payload.productId, scope.companyId);
  if (!product) {
    throw createHttpError(404, 'Producto no encontrado para la empresa autenticada', 'not_found');
  }

  const recipeVersion = await recipeRepository.findRecipeVersionById(payload.recipeVersionId, scope.companyId);
  if (!recipeVersion) {
    throw createHttpError(404, 'Versión de receta no encontrada para la empresa autenticada', 'not_found');
  }

  await assertCompanyWarehouses(scope.companyId, [payload.originWarehouseId, payload.destinationWarehouseId]);
  await assertResponsibleUser(scope.companyId, payload.responsibleUserId);

  if (product.requiresExpiration && !payload.expirationDate) {
    throw createHttpError(400, 'El producto requiere fecha de vencimiento para producción', 'validation_error');
  }

  const violations = buildGuardrailViolations(product, recipeVersion);
  const override = assertOverrideAllowed(auth, payload.overrideJustification, violations);

  return {
    scope,
    product,
    recipeVersion,
    override,
  };
}

function assertTransition(order, allowedStatuses, operationLabel) {
  if (!allowedStatuses.includes(order.status)) {
    throw createHttpError(409, `La orden de producción no puede ${operationLabel} desde el estado ${order.status}`, 'conflict');
  }
}

async function listProductionOrders(auth, pagination) {
  const scope = assertCompanyScope(auth);

  if (!pagination) {
    const items = /** @type {any[]} */ (await productionRepository.findProductionOrders(scope.companyId, null));
    return items.map(serializeProductionOrder);
  }

  const result = /** @type {{ totalItems: number, items: any[] }} */ (await productionRepository.findProductionOrders(scope.companyId, pagination));
  return buildPaginatedResponse(
    result.items.map(serializeProductionOrder),
    pagination,
    result.totalItems,
  );
}

async function getProductionOrder(id, auth) {
  const scope = assertCompanyScope(auth);
  const order = await productionRepository.findProductionOrderById(id, scope.companyId);
  if (!order) {
    throw createHttpError(404, 'Orden de producción no encontrada', 'not_found');
  }

  return serializeProductionOrder(order);
}

async function createProductionOrder(payload, auth, req = null) {
  const { scope, product, recipeVersion, override } = await getValidatedProductionContext(payload, auth);

  const createProductionOrderResult = await inventoryRepository.transaction(async (tx) => {
    await inventoryRepository.acquireCompanyInventoryAdvisoryLock(scope.companyId, tx);

    const requirements = buildMaterialRequirements(recipeVersion, payload.quantity);
    const stockCheckOverride = createStockCheckOverride(auth, payload.overrideJustification, override);
    const availabilityRows = await assertStockAvailability(
      tx,
      scope,
      requirements,
      payload.originWarehouseId,
      stockCheckOverride,
    );
    const finalOrderOverride = mergeOverrideViolationCodes(
      stockCheckOverride,
      hasMaterialShortage(availabilityRows) ? [STOCK_OVERRIDE_REASON_CODE] : [],
    );

    const createdOrder = await productionRepository.createProductionOrder({
      companyId: scope.companyId,
      productId: product.id,
      recipeId: recipeVersion.recipeId,
      recipeVersionId: recipeVersion.id,
      originWarehouseId: payload.originWarehouseId,
      destinationWarehouseId: payload.destinationWarehouseId,
      responsibleUserId: payload.responsibleUserId,
      quantity: payload.quantity,
      status: 'DRAFT',
      priority: payload.priority ?? 0,
      responsible: null,
      productionLotCode: payload.productionLotCode.trim(),
      plannedDate: payload.plannedDate ?? null,
      productionDate: payload.productionDate ?? null,
      expirationDate: payload.expirationDate ?? null,
      overrideJustification: finalOrderOverride?.justification ?? null,
      recipeVersionSnapshot: buildEnrichedSnapshot(recipeVersion, availabilityRows, finalOrderOverride),
      items: {
        create: [{
          productId: product.id,
          recipeId: recipeVersion.recipeId,
          plannedQuantity: payload.quantity,
        }],
      },
    }, tx);

    await productionRepository.createMaterialRequirements(
      createdOrder.id,
      mapAvailabilityToMaterialRequirementRows(scope.companyId, createdOrder.id, availabilityRows),
      tx,
    );

    return {
      productionOrder: createdOrder,
      finalOverride: finalOrderOverride,
      availability: availabilityRows,
    };
  });

  const {
    productionOrder,
    finalOverride,
    availability,
  } = /** @type {{ productionOrder: any, finalOverride: any, availability: Array<any> }} */ (
    /** @type {unknown} */ (createProductionOrderResult)
  );

  await recordStockOverrideAuditEvent(req, auth, productionOrder, finalOverride, availability);
  return serializeProductionOrder(productionOrder);
}

async function submitProductionOrder(id, auth) {
  const scope = assertCompanyScope(auth);
  const order = await productionRepository.findProductionOrderById(id, scope.companyId);
  if (!order) {
    throw createHttpError(404, 'Orden de producción no encontrada', 'not_found');
  }

  assertTransition(order, ['DRAFT'], 'enviarse a aprobación');

  const updatedOrder = await productionRepository.updateProductionOrder(id, scope.companyId, {
    status: 'PENDING_APPROVAL',
    submittedAt: new Date(),
  });

  return serializeProductionOrder(updatedOrder);
}

async function approveProductionOrder(id, payload, auth, req = null) {
  const scope = assertCompanyScope(auth);

  const approveProductionOrderResult = await inventoryRepository.transaction(async (tx) => {
    await inventoryRepository.acquireCompanyInventoryAdvisoryLock(scope.companyId, tx);

    const order = await productionRepository.findProductionOrderById(id, scope.companyId, tx);
    if (!order) {
      throw createHttpError(404, 'Orden de producción no encontrada', 'not_found');
    }

    assertTransition(order, ['PENDING_APPROVAL'], 'aprobarse');

    const product = order.productId ? await productRepository.findProductById(order.productId, scope.companyId, tx) : null;
    const recipeVersion = order.recipeVersionId ? await recipeRepository.findRecipeVersionById(order.recipeVersionId, scope.companyId, tx) : null;
    const violations = buildGuardrailViolations(product, recipeVersion);
    const baseOverride = assertOverrideAllowed(auth, payload?.overrideJustification, violations);

    const persistedRequirements = Array.isArray(order.materialRequirements) ? order.materialRequirements : [];
    let requirements = persistedRequirements.map((entry) => ({
      productId: entry.productId,
      requiredQuantity: Number(entry.requiredQuantity || 0),
      unit: entry.unit,
    }));

    if (requirements.length === 0 && recipeVersion) {
      requirements = buildMaterialRequirements(recipeVersion, order.quantity);
    }

    const stockCheckOverride = createStockCheckOverride(
      auth,
      payload?.overrideJustification ?? order.overrideJustification,
      baseOverride,
    );
    const availabilityRows = await assertStockAvailability(
      tx,
      scope,
      requirements,
      order.originWarehouseId,
      stockCheckOverride,
    );
    const finalOrderOverride = mergeOverrideViolationCodes(
      stockCheckOverride,
      hasMaterialShortage(availabilityRows) ? [STOCK_OVERRIDE_REASON_CODE] : [],
    );

    if (persistedRequirements.length === 0 && availabilityRows.length > 0) {
      await productionRepository.createMaterialRequirements(
        order.id,
        mapAvailabilityToMaterialRequirementRows(scope.companyId, order.id, availabilityRows),
        tx,
      );
    }

    const updated = await productionRepository.updateProductionOrder(id, scope.companyId, {
      status: 'APPROVED',
      approvedAt: new Date(),
      overrideJustification: finalOrderOverride?.justification ?? order.overrideJustification ?? null,
      recipeVersionSnapshot: buildOrderSnapshotWithMaterialRequirements(
        order,
        recipeVersion,
        availabilityRows,
        finalOrderOverride,
      ),
    }, tx);

    return {
      updatedOrder: updated,
      finalOverride: finalOrderOverride,
      availability: availabilityRows,
    };
  });

  const {
    updatedOrder,
    finalOverride,
    availability,
  } = /** @type {{ updatedOrder: any, finalOverride: any, availability: Array<any> }} */ (
    /** @type {unknown} */ (approveProductionOrderResult)
  );

  await recordStockOverrideAuditEvent(req, auth, updatedOrder, finalOverride, availability);
  return serializeProductionOrder(updatedOrder);
}

async function startProductionOrder(id, auth) {
  const scope = assertCompanyScope(auth);
  const order = await productionRepository.findProductionOrderById(id, scope.companyId);
  if (!order) {
    throw createHttpError(404, 'Orden de producción no encontrada', 'not_found');
  }

  assertTransition(order, ['APPROVED'], 'iniciarse');

  const updatedOrder = await productionRepository.updateProductionOrder(id, scope.companyId, {
    status: 'IN_PROGRESS',
    startedAt: new Date(),
    productionDate: order.productionDate ?? new Date(),
  });

  return serializeProductionOrder(updatedOrder);
}

async function completeProductionOrder(id, payload, auth) {
  const completedOrder = await completeProductionOrderExecution(id, payload, auth);
  return serializeProductionOrder(completedOrder);
}

async function cancelProductionOrder(id, auth) {
  const scope = assertCompanyScope(auth);
  const order = await productionRepository.findProductionOrderById(id, scope.companyId);
  if (!order) {
    throw createHttpError(404, 'Orden de producción no encontrada', 'not_found');
  }

  assertTransition(order, ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'QA_HOLD'], 'cancelarse');

  const updatedOrder = await productionRepository.updateProductionOrder(id, scope.companyId, {
    status: 'CANCELLED',
    cancelledAt: new Date(),
  });

  return serializeProductionOrder(updatedOrder);
}

module.exports = {
  listProductionOrders,
  getProductionOrder,
  createProductionOrder,
  submitProductionOrder,
  approveProductionOrder,
  startProductionOrder,
  executeProductionStage,
  recordProductionReturn,
  reconcileProductionOrderAggregates,
  completeProductionOrder,
  cancelProductionOrder,
  __private__: {
    buildGuardrailViolations,
    buildRecipeVersionSnapshot,
    assertStockAvailability,
    assertOverrideAllowed,
    getValidatedProductionContext,
    assertOperationalScope: productionExecutionPrivate.assertOperationalScope,
    assertStagePrerequisites,
    validateConsumptionAgainstRequirement,
    validateQaMeasurements,
    findStageSnapshot,
    assertLotIdPresentForProductionConsumption,
    assertLotIdPresentForProductionWaste,
    assertLotIdPresentForProductionReturn,
    assertLotIdPresentForProductionInventoryEntry,
    buildMissingProductionLotMessage,
    resolveProductionLotContext,
    reduceStageInventory,
    serializeProductionReturn,
    serializeStageExecution,
    reconcileProductionOrderAggregates,
    completeProductionOrder,
  },
};
