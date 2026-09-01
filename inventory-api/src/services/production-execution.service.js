const { randomUUID } = require('crypto');

const { createHttpError } = require('../lib/errors');
const productRepository = require('../repositories/product.repository');
const productionRepository = require('../repositories/production.repository');
const inventoryRepository = require('../repositories/inventory.repository');
const companyRepository = require('../repositories/company.repository');
const inventoryTransactionSupport = require('./inventory-transaction-support.service');
const qualityService = require('./quality.service');
const productionPlanningService = require('./production-planning.service');
const productionStageValidationService = require('./production-stage-validation.service');

const { __private__: productionPlanningPrivate } = productionPlanningService;
const { toSnapshotValue } = productionPlanningPrivate;
const {
  normalizeOptionalText,
  assertStagePrerequisites,
  assertRecolectionCoverageForConsumption,
  validateConsumptionAgainstRequirement,
  validateQaMeasurements,
  recordStageOverrideAuditEvent,
} = productionStageValidationService;

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

const QA_APPROVED_RESULTS = new Set(['APPROVED', 'CONDITIONALLY_ACCEPTED']);

function serializeStageExecution(execution) {
  const qualityInspections = Array.isArray(execution.qualityInspections)
    ? execution.qualityInspections.map((insp) => ({
        id: insp.id,
        result: insp.result,
        observations: insp.observations,
        correctiveAction: insp.correctiveAction,
        actualResults: insp.actualResults,
        expectedParameters: insp.expectedParameters,
        inspectedAt: insp.inspectedAt,
        inspectorUserId: insp.inspectorUserId,
      }))
    : [];
  const qaApproved = qualityInspections.some((insp) => QA_APPROVED_RESULTS.has(insp.result));

  return {
    id: execution.id,
    productionOrderId: execution.productionOrderId,
    recipeStageId: execution.recipeStageId,
    stageOrder: execution.stageOrder,
    stageName: execution.stageName,
    responsibleUserId: execution.responsibleUserId,
    startedAt: execution.startedAt,
    endedAt: execution.endedAt,
    status: execution.status ?? 'COMPLETED',
    lossesAcknowledged: execution.lossesAcknowledged ?? false,
    lossesAcknowledgedAt: execution.lossesAcknowledgedAt ?? null,
    actualParameters: execution.actualParameters,
    qaOutOfTolerance: execution.qaOutOfTolerance,
    overrideJustification: execution.overrideJustification,
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
    losses: execution.losses ?? [],
    qualityInspections,
    qaApproved,
  };
}

function assertTransition(order, allowedStatuses, operationLabel) {
  if (!allowedStatuses.includes(order.status)) {
    throw createHttpError(409, `La orden de producción no puede ${operationLabel} desde el estado ${order.status}`, 'conflict');
  }
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

async function executeProductionStage(id, stageId, payload, auth, req = null) {
  const scope = assertOperationalScope(auth);

  // DEC-002: read company tolerance before entering the advisory lock transaction.
  const companyTolerancePercent = await companyRepository.getProductionConsumptionTolerance(scope.companyId);

  const executionResult = await inventoryRepository.transaction(async (tx) => {
    await inventoryRepository.acquireCompanyInventoryAdvisoryLock(scope.companyId, tx);

    const order = await productionRepository.findProductionOrderById(id, scope.companyId, tx);
    if (!order) {
      throw createHttpError(404, 'Orden de producción no encontrada', 'not_found');
    }

    // QA_HOLD is also allowed: re-executing a QA-rejected stage brings the order
    // back to IN_PROGRESS so the normal stage-gate flow resumes.
    assertTransition(order, ['IN_PROGRESS', 'QA_HOLD'], 'ejecutar etapas');

    if (order.status === 'QA_HOLD') {
      await productionRepository.updateProductionOrder(order.id, scope.companyId, { status: 'IN_PROGRESS' }, tx);
    }

    if (!order.originWarehouseId) {
      throw createHttpError(409, 'La orden de producción debe tener bodega origen para registrar consumo y merma', 'conflict');
    }

    const snapshotStage = findStageSnapshot(order, stageId);
    if (!snapshotStage) {
      throw createHttpError(404, 'Etapa de receta no encontrada dentro del snapshot congelado de la orden', 'not_found');
    }

    assertStagePrerequisites(order, stageId);

    // FR-010/BR-004: if this stage was preceded by a completed recovery/recolection stage with lot-level entries,
    // proposed consumptions must stay within the recovered balance for the same product+lot pairs.
    const _orderAny = /** @type {any} */ (order);
    const relatedRecolectionStage = Array.isArray(_orderAny.recolectionStages)
      ? _orderAny.recolectionStages.find((stage) => String(stage.recipeStageId) === String(stageId) && stage.status === 'COMPLETED')
      : null;
    if (relatedRecolectionStage) {
      assertRecolectionCoverageForConsumption(
        Array.isArray(relatedRecolectionStage.recolectionEntries) ? relatedRecolectionStage.recolectionEntries : [],
        Array.isArray(order.stageExecutions)
          ? order.stageExecutions.flatMap((execution) => Array.isArray(execution.consumptions) ? execution.consumptions : [])
          : [],
        payload.consumptions ?? [],
      );
    }

    // DEC-002: El inspector de calidad registra QA por separado. El operador solo registra consumos.
    const consumptionValidation = validateConsumptionAgainstRequirement(
      order,
      payload.consumptions ?? [],
      auth,
      payload.overrideJustification,
      companyTolerancePercent,
    );
    const overrideJustification = consumptionValidation.overrideJustification ?? null;
    const movementGroupId = randomUUID();
    const createdStageExecution = await productionRepository.createProductionStageExecution({
      productionOrderId: order.id,
      recipeStageId: stageId,
      stageOrder: snapshotStage.stageOrder ?? 0,
      stageName: snapshotStage.name ?? `Etapa ${stageId.toString()}`,
      responsibleUserId: scope.userId,
      startedAt: payload.startedAt,
      endedAt: payload.endedAt,
      actualParameters: null,
      qaOutOfTolerance: false,
      overrideJustification,
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

    const persistedStageExecution = await productionRepository.findProductionStageExecutionById(createdStageExecution.id, tx);
    return {
      order,
      stageExecution: persistedStageExecution,
      overrideMetadata: {
        overrideJustification,
        violationCodes: [
          ...(consumptionValidation.exceededProducts.length > 0 ? ['consumption_exceeds_requirement'] : []),
        ],
        exceededProducts: consumptionValidation.exceededProducts,
        qaOutOfTolerance: false,
      },
    };
  });

  const normalizedExecutionResult = /** @type {{ order: any, stageExecution: any, overrideMetadata: any }} */ (
    /** @type {unknown} */ (executionResult)
  );

  await recordStageOverrideAuditEvent(
    req,
    auth,
    normalizedExecutionResult.order,
    normalizedExecutionResult.stageExecution,
    normalizedExecutionResult.overrideMetadata,
  );

  return serializeStageExecution(normalizedExecutionResult.stageExecution);
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
  const scope = { companyId: BigInt(auth.companyId) };

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

    // El payload puede sobreescribir la bodega destino definida en la orden.
    const effectiveDestinationWarehouseId = payload.destinationWarehouseId ?? order.destinationWarehouseId;

    const context = await inventoryTransactionSupport.getInventoryContext(
      tx,
      auth,
      effectiveDestinationWarehouseId,
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

    return productionRepository.updateProductionOrder(order.id, scope.companyId, {
      status: 'COMPLETED',
    }, tx);
  });

  return completedOrder;
}

module.exports = {
  executeProductionStage,
  recordProductionReturn,
  reconcileProductionOrderAggregates,
  completeProductionOrder,
  __private__: {
    assertOperationalScope,
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
  },
};
