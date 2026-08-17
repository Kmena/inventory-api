const { randomUUID } = require('crypto');

const { createHttpError } = require('../lib/errors');
const { buildPaginatedResponse } = require('../lib/pagination');
const productRepository = require('../repositories/product.repository');
const productionRepository = require('../repositories/production.repository');
const recipeRepository = require('../repositories/recipe.repository');
const inventoryRepository = require('../repositories/inventory.repository');
const { aggregateIngredientsFromStages } = require('./recipe.service');
const inventoryTransactionSupport = require('./inventory-transaction-support.service');
const qualityService = require('./quality.service');
const { permissionRequiresJustification } = require('../security/permission-governance.service');

const ALLOWED_PRODUCTION_SOURCING_METHODS = new Set(['PRODUCTION_ONLY', 'PRODUCTION_OR_PURCHASE']);
const OVERRIDE_PERMISSION_CODE = 'production.override';

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

  if (Array.isArray(value)) {
    return value.map(toSnapshotValue);
  }

  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entryValue]) => [key, toSnapshotValue(entryValue)]));
  }

  return value;
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
        expectedParameters: stage.expectedParameters ?? [],
        parameterTolerances: stage.parameterTolerances ?? [],
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
      permissionCode: OVERRIDE_PERMISSION_CODE,
      justification: override.justification,
      violationCodes: override.violationCodes,
    } : null,
  });
}

function serializeProductionReturn(record) {
  return {
    id: record.id,
    stageExecutionId: record.stageExecutionId,
    productionOrderId: record.productionOrderId,
    warehouseId: record.warehouseId,
    productId: record.productId,
    lotId: record.lotId,
    responsibleUserId: record.responsibleUserId,
    quantity: record.quantity,
    reasonCode: record.reasonCode,
    note: record.note,
    movementGroupId: record.movementGroupId,
    returnedAt: record.returnedAt,
    createdAt: record.createdAt,
  };
}

function serializeStageExecution(execution) {
  return {
    id: execution.id,
    productionOrderId: execution.productionOrderId,
    recipeStageId: execution.recipeStageId,
    stageOrder: execution.stageOrder,
    stageName: execution.stageName,
    responsibleUserId: execution.responsibleUserId,
    startedAt: execution.startedAt,
    endedAt: execution.endedAt,
    actualParameters: execution.actualParameters,
    evidence: execution.evidence,
    notes: execution.notes,
    movementGroupId: execution.movementGroupId,
    createdAt: execution.createdAt,
    updatedAt: execution.updatedAt,
    consumptions: execution.consumptions ?? [],
    wastes: execution.wastes ?? [],
    returns: Array.isArray(execution.returns)
      ? execution.returns.map(serializeProductionReturn)
      : [],
  };
}

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

function assertOperationalScope(auth) {
  if (!auth?.companyId || !auth?.sub) {
    throw createHttpError(403, 'Se requiere un usuario asociado a una empresa', 'forbidden');
  }

  return {
    companyId: BigInt(auth.companyId),
    userId: BigInt(auth.sub),
  };
}

function findStageSnapshot(order, stageId) {
  const stages = order?.recipeVersionSnapshot?.recipeVersion?.stages;
  if (!Array.isArray(stages)) {
    return null;
  }

  return stages.find((stage) => String(stage.id) === stageId.toString()) || null;
}

function assertLotIdPresentForProductionConsumption(entry) {
  if (entry?.lotId !== null && entry?.lotId !== undefined) {
    return;
  }

  throw createHttpError(400, 'El consumo de materia prima en producción requiere lote', 'validation_error');
}

function assertLotIdPresentForProductionWaste(entry) {
  if (entry?.lotId !== null && entry?.lotId !== undefined) {
    return;
  }

  throw createHttpError(400, 'La merma de materia prima en producción requiere lote', 'validation_error');
}

function assertLotIdPresentForProductionReturn(entry) {
  if (entry?.lotId !== null && entry?.lotId !== undefined) {
    return;
  }

  throw createHttpError(400, 'La devolución de materia prima en producción requiere lote', 'validation_error');
}

function assertLotIdPresentForProductionInventoryEntry(entry, reasonCode) {
  if (reasonCode === 'PRODUCTION_CONSUMPTION') {
    assertLotIdPresentForProductionConsumption(entry);
    return;
  }

  if (reasonCode === 'PRODUCTION_WASTE') {
    assertLotIdPresentForProductionWaste(entry);
    return;
  }

  if (reasonCode === 'PRODUCTION_RETURN') {
    assertLotIdPresentForProductionReturn(entry);
  }
}

function buildMissingProductionLotMessage(reasonCode) {
  if (reasonCode === 'PRODUCTION_WASTE') {
    return 'Lote no encontrado para la merma registrada en producción';
  }

  if (reasonCode === 'PRODUCTION_RETURN') {
    return 'Lote no encontrado para la devolución registrada en producción';
  }

  return 'Lote no encontrado para el producto consumido en producción';
}

async function resolveProductionLotContext(tx, auth, order, entry, reasonCode) {
  assertLotIdPresentForProductionInventoryEntry(entry, reasonCode);

  const context = await inventoryTransactionSupport.getInventoryContext(tx, auth, order.originWarehouseId, entry.productId);
  const lot = await inventoryRepository.findLotForProduct(entry.lotId, context.product.id, tx);

  if (!lot) {
    throw createHttpError(404, buildMissingProductionLotMessage(reasonCode), 'not_found');
  }

  return { context, lot };
}

async function reduceStageInventory(tx, auth, order, stageExecution, stageName, entries, reasonCode) {
  const records = [];

  for (const entry of entries) {
    const { context, lot } = await resolveProductionLotContext(tx, auth, order, entry, reasonCode);

    const warehouseStock = await inventoryTransactionSupport.changeWarehouseStock(tx, context, -entry.quantity, 0);
    await inventoryRepository.updateProductById(
      context.product.id,
      context.companyId,
      { quantity: { decrement: entry.quantity } },
      tx,
    );

    await inventoryTransactionSupport.changeLotStock(tx, context, lot, -entry.quantity, 0);
    await inventoryRepository.updateLotById(
      lot.id,
      { quantity: { decrement: entry.quantity } },
      tx,
    );

    await inventoryTransactionSupport.createMovement(tx, context, {
      lotId: lot.id,
      movementType: 'OUT',
      quantity: entry.quantity,
      quantityBefore: warehouseStock.before,
      quantityAfter: warehouseStock.after,
      reasonCode,
      movementGroupId: stageExecution.movementGroupId,
      sourceType: 'production_stage_execution',
      sourceId: stageExecution.id,
      note: normalizeOptionalText(entry.note) ?? `${reasonCode} ${stageName}`,
    });

    records.push({
      productionOrderId: order.id,
      warehouseId: context.warehouse.id,
      productId: context.product.id,
      lotId: lot.id,
      quantity: entry.quantity,
      note: normalizeOptionalText(entry.note),
    });
  }

  return records;
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

async function createProductionOrder(payload, auth) {
  const { scope, product, recipeVersion, override } = await getValidatedProductionContext(payload, auth);

  const productionOrder = await productionRepository.createProductionOrder({
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
    overrideJustification: override?.justification ?? null,
    recipeVersionSnapshot: buildRecipeVersionSnapshot(recipeVersion, override),
    items: {
      create: [{
        productId: product.id,
        recipeId: recipeVersion.recipeId,
        plannedQuantity: payload.quantity,
      }],
    },
  });

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

async function approveProductionOrder(id, payload, auth) {
  const scope = assertCompanyScope(auth);
  const order = await productionRepository.findProductionOrderById(id, scope.companyId);
  if (!order) {
    throw createHttpError(404, 'Orden de producción no encontrada', 'not_found');
  }

  assertTransition(order, ['PENDING_APPROVAL'], 'aprobarse');

  const product = order.productId ? await productRepository.findProductById(order.productId, scope.companyId) : null;
  const recipeVersion = order.recipeVersionId ? await recipeRepository.findRecipeVersionById(order.recipeVersionId, scope.companyId) : null;
  const violations = buildGuardrailViolations(product, recipeVersion);
  const override = assertOverrideAllowed(auth, payload?.overrideJustification, violations);

  if (!order.recipeVersionSnapshot && recipeVersion) {
    order.recipeVersionSnapshot = buildRecipeVersionSnapshot(recipeVersion, override);
  }

  const updatedOrder = await productionRepository.updateProductionOrder(id, scope.companyId, {
    status: 'APPROVED',
    approvedAt: new Date(),
    overrideJustification: override?.justification ?? order.overrideJustification ?? null,
    recipeVersionSnapshot: order.recipeVersionSnapshot,
  });

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

async function executeProductionStage(id, stageId, payload, auth) {
  const scope = assertOperationalScope(auth);

  const stageExecution = await inventoryRepository.transaction(async (tx) => {
    await inventoryRepository.acquireCompanyInventoryAdvisoryLock(scope.companyId, tx);

    const order = await productionRepository.findProductionOrderById(id, scope.companyId, tx);
    if (!order) {
      throw createHttpError(404, 'Orden de producción no encontrada', 'not_found');
    }

    assertTransition(order, ['IN_PROGRESS'], 'ejecutar etapas');

    if (!order.originWarehouseId) {
      throw createHttpError(409, 'La orden de producción debe tener bodega origen para registrar consumo y merma', 'conflict');
    }

    const snapshotStage = findStageSnapshot(order, stageId);
    if (!snapshotStage) {
      throw createHttpError(404, 'Etapa de receta no encontrada dentro del snapshot congelado de la orden', 'not_found');
    }

    const movementGroupId = randomUUID();
    const createdStageExecution = await productionRepository.createProductionStageExecution({
      productionOrderId: order.id,
      recipeStageId: stageId,
      stageOrder: snapshotStage.stageOrder ?? 0,
      stageName: snapshotStage.name ?? `Etapa ${stageId.toString()}`,
      responsibleUserId: scope.userId,
      startedAt: payload.startedAt,
      endedAt: payload.endedAt,
      actualParameters: toSnapshotValue(payload.actualParameters ?? []),
      evidence: toSnapshotValue(payload.evidence ?? []),
      notes: normalizeOptionalText(payload.notes),
      movementGroupId,
    }, tx);

    const consumptions = await reduceStageInventory(
      tx,
      auth,
      order,
      createdStageExecution,
      createdStageExecution.stageName,
      payload.consumptions ?? [],
      'PRODUCTION_CONSUMPTION',
    );

    for (const consumption of consumptions) {
      await productionRepository.createProductionConsumption({
        stageExecutionId: createdStageExecution.id,
        ...consumption,
      }, tx);
    }

    const wastes = await reduceStageInventory(
      tx,
      auth,
      order,
      createdStageExecution,
      createdStageExecution.stageName,
      payload.waste ?? [],
      'PRODUCTION_WASTE',
    );

    for (const waste of wastes) {
      await productionRepository.createProductionWaste({
        stageExecutionId: createdStageExecution.id,
        ...waste,
      }, tx);
    }

    if (consumptions.length > 0) {
      await productionRepository.syncProductionItemConsumedQuantity(order.id, tx);
    }

    return productionRepository.findProductionStageExecutionById(createdStageExecution.id, tx);
  });

  return serializeStageExecution(stageExecution);
}

async function recordProductionReturn(id, stageId, payload, auth) {
  const scope = assertOperationalScope(auth);

  const productionReturn = await inventoryRepository.transaction(async (tx) => {
    await inventoryRepository.acquireCompanyInventoryAdvisoryLock(scope.companyId, tx);

    const order = await productionRepository.findProductionOrderById(id, scope.companyId, tx);
    if (!order) {
      throw createHttpError(404, 'Orden de producción no encontrada', 'not_found');
    }

    assertTransition(order, ['IN_PROGRESS'], 'registrar devoluciones');

    if (!order.originWarehouseId) {
      throw createHttpError(409, 'La orden de producción debe tener bodega origen para registrar devoluciones', 'conflict');
    }

    const snapshotStage = findStageSnapshot(order, stageId);
    if (!snapshotStage) {
      throw createHttpError(404, 'Etapa de receta no encontrada dentro del snapshot congelado de la orden', 'not_found');
    }

    const stageExecution = await productionRepository.findLatestProductionStageExecutionForOrderStage(order.id, stageId, tx);
    if (!stageExecution) {
      throw createHttpError(409, 'Debe existir una ejecución registrada para la etapa antes de devolver materia prima', 'conflict');
    }

    const movementGroupId = randomUUID();
    const { context, lot } = await resolveProductionLotContext(tx, auth, order, payload, 'PRODUCTION_RETURN');
    const returnedAt = payload.returnedAt ?? new Date();
    const normalizedReasonCode = payload.reasonCode.trim();
    const normalizedNote = normalizeOptionalText(payload.note);

    const warehouseStock = await inventoryTransactionSupport.changeWarehouseStock(tx, context, payload.quantity, 0);
    await inventoryRepository.updateProductById(
      context.product.id,
      context.companyId,
      { quantity: { increment: payload.quantity } },
      tx,
    );

    await inventoryTransactionSupport.changeLotStock(tx, context, lot, payload.quantity, 0);
    await inventoryRepository.updateLotById(
      lot.id,
      { quantity: { increment: payload.quantity } },
      tx,
    );

    const createdReturn = await productionRepository.createProductionReturn({
      stageExecutionId: stageExecution.id,
      productionOrderId: order.id,
      warehouseId: context.warehouse.id,
      productId: context.product.id,
      lotId: lot.id,
      responsibleUserId: scope.userId,
      quantity: payload.quantity,
      reasonCode: normalizedReasonCode,
      note: normalizedNote,
      movementGroupId,
      returnedAt,
    }, tx);

    await inventoryTransactionSupport.createMovement(tx, context, {
      lotId: lot.id,
      movementType: 'IN',
      quantity: payload.quantity,
      quantityBefore: warehouseStock.before,
      quantityAfter: warehouseStock.after,
      reasonCode: normalizedReasonCode,
      movementGroupId,
      sourceType: 'production_return',
      sourceId: createdReturn.id,
      note: normalizedNote ?? `${normalizedReasonCode} ${stageExecution.stageName}`,
    });

    return createdReturn;
  });

  return serializeProductionReturn(productionReturn);
}

async function reconcileProductionOrderAggregates(id, auth) {
  const scope = assertCompanyScope(auth);

  const order = await productionRepository.findProductionOrderById(id, scope.companyId);
  if (!order) {
    throw createHttpError(404, 'Orden de producción no encontrada', 'not_found');
  }

  const stateBefore = await productionRepository.getProductionItemAggregateState(order.id);

  if (stateBefore.isSynchronized) {
    return {
      productionOrderId: order.id,
      action: 'none',
      reason: 'aggregate_already_synchronized',
      authoritativeTotal: stateBefore.authoritativeTotal,
      itemAggregateTotal: stateBefore.itemAggregateTotal,
    };
  }

  const syncResult = await productionRepository.syncProductionItemConsumedQuantity(order.id);

  return {
    productionOrderId: order.id,
    action: 'repaired',
    reason: 'aggregate_mismatch_detected_and_repaired',
    authoritativeTotalBefore: stateBefore.authoritativeTotal,
    itemAggregateTotalBefore: stateBefore.itemAggregateTotal,
    authoritativeTotalAfter: Number(syncResult.totalConsumed),
    updatedItemCount: syncResult.updatedItemCount,
  };
}

async function completeProductionOrder(id, payload, auth) {
  const scope = assertOperationalScope(auth);

  const completedOrder = await inventoryRepository.transaction(async (tx) => {
    await inventoryRepository.acquireCompanyInventoryAdvisoryLock(scope.companyId, tx);

    const order = await productionRepository.findProductionOrderById(id, scope.companyId, tx);
    if (!order) {
      throw createHttpError(404, 'Orden de producción no encontrada', 'not_found');
    }

    assertTransition(order, ['IN_PROGRESS'], 'completarse');

    const qaGates = await qualityService.checkMandatoryQaGatesForOrder(order.id, scope.companyId);
    if (!qaGates.allMandatoryGatesPassed) {
      const pendingNames = [...qaGates.pendingStages, ...qaGates.rejectedStages]
        .map((stage) => `${stage.stageName} (${stage.reason})`)
        .join(', ');
      throw createHttpError(
        409,
        `No se puede completar la orden: etapas QA pendientes o rechazadas: ${pendingNames}`,
        'conflict',
      );
    }

    const product = await productRepository.findProductById(order.productId, scope.companyId, tx);
    if (!product) {
      throw createHttpError(404, 'Producto de la orden no encontrado', 'not_found');
    }

    if (product.requiresExpiration) {
      const effectiveExpiration = payload.expirationDate ?? order.expirationDate;
      if (!effectiveExpiration) {
        throw createHttpError(400, 'El producto requiere fecha de vencimiento para liberar el producto terminado', 'validation_error');
      }
    }

    const lotCode = payload.lotCode || order.productionLotCode || `PROD-${order.id}`;
    const productionDate = payload.productionDate ?? order.productionDate ?? new Date();
    const expirationDate = payload.expirationDate ?? order.expirationDate ?? null;

    const lotNumberResolution = await inventoryTransactionSupport.resolveUniqueInternalLotNumber(
      tx,
      scope.companyId,
      lotCode,
    );

    const lot = await inventoryRepository.createLot({
      companyId: scope.companyId,
      productId: product.id,
      lotNumber: lotCode,
      internalLotNumber: lotNumberResolution.assigned,
      productionDate,
      expirationDate,
      entryDate: new Date(),
      quantity: payload.producedQuantity,
      originalQuantity: payload.producedQuantity,
      status: 'AVAILABLE',
      qaStatus: 'APPROVED',
    }, tx);

    const destinationWarehouseId = order.destinationWarehouseId;
    const context = await inventoryTransactionSupport.getInventoryContext(
      tx,
      auth,
      destinationWarehouseId,
      product.id,
    );

    const warehouseStock = await inventoryTransactionSupport.changeWarehouseStock(
      tx,
      context,
      payload.producedQuantity,
      0,
    );

    await inventoryTransactionSupport.changeLotStock(
      tx,
      context,
      lot,
      payload.producedQuantity,
      0,
    );

    await inventoryRepository.updateProductById(
      product.id,
      scope.companyId,
      { quantity: { increment: payload.producedQuantity } },
      tx,
    );

    const movementGroupId = randomUUID();

    await inventoryTransactionSupport.createMovement(tx, context, {
      lotId: lot.id,
      movementType: 'IN',
      quantity: payload.producedQuantity,
      quantityBefore: warehouseStock.before,
      quantityAfter: warehouseStock.after,
      reasonCode: 'PRODUCTION_RECEIPT',
      movementGroupId,
      sourceType: 'production_order',
      sourceId: order.id,
      note: normalizeOptionalText(payload.note) ?? `Recepción de producción orden #${order.id}`,
    });

    const updatedOrder = await productionRepository.updateProductionOrder(order.id, scope.companyId, {
      status: 'COMPLETED',
    }, tx);

    return updatedOrder;
  });

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
    assertOverrideAllowed,
    getValidatedProductionContext,
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
