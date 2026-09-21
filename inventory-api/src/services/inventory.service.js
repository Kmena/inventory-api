const { randomUUID } = require('crypto');

const inventoryRepository = require('../repositories/inventory.repository');
const { createHttpError } = require('../lib/errors');
const { buildPaginatedResponse } = require('../lib/pagination');
const audit = require('../lib/audit');
const {
  listInventoryAlerts,
  getInventoryAlert,
  updateInventoryAlertStatus,
} = require('./inventory-alerts.service');
const {
  guatemalaDateKey,
  normalizeLotDates,
  lotDateKey,
  isLotExpired,
  deriveLotUsability,
} = require('./inventory-lot-policy.service');
const {
  authScope,
  number,
  getInventoryContext,
  changeWarehouseStock,
  changeLotStock,
  createMovement,
  resolveUniqueInternalLotNumber,
  reserveLots,
  isInventoryControlledProduct,
  usesSystemLotStrategy,
  getOrCreateSystemLot,
  assertOrderHasOperationalWarehouse,
  getActiveAllocations,
} = require('./inventory-transaction-support.service');
const billingTriggerService = require('./billing-trigger.service');
const { calculateInvoiceAmount } = require('./billing-trigger.service');

async function acquireCompanyInventoryAdvisoryLock(tx, companyId) {
  await inventoryRepository.acquireCompanyInventoryAdvisoryLock(companyId, tx);
}

function serializeStockRow(row, lotCount = 0) {
  const onHand = number(row.quantity);
  const reserved = number(row.reservedQuantity);
  const available = Math.max(0, onHand - reserved);
  return {
    ...row,
    product: row.product ? { id: row.product.id, code: row.product.code, sku: row.product.sku, name: row.product.name } : null,
    location: row.warehouse ? { id: row.warehouse.id, code: row.warehouse.code, name: row.warehouse.name } : null,
    warehouse: row.warehouse,
    onHand,
    reserved,
    available,
    lotCount,
    inventoryStatus: onHand <= 0 ? 'ZERO' : reserved > 0 && available <= 0 ? 'RESERVED' : 'AVAILABLE',
  };
}

function serializeLot(lot) {
  const isSystemGenerated = Boolean(lot.isSystemGenerated);
  return {
    ...lot,
    visibleLotLabel: isSystemGenerated ? 'Sin lote visible' : (lot.lotNumber || lot.internalLotNumber),
    internalLotNumber: isSystemGenerated ? null : lot.internalLotNumber,
    lotNumber: isSystemGenerated ? null : lot.lotNumber,
    manufacturerLotNumber: isSystemGenerated ? null : lot.manufacturerLotNumber,
  };
}

async function listMovements(auth, filters = {}, pagination = null) {
  const { companyId } = authScope(auth);
  const movements = await inventoryRepository.findAllMovements(companyId, filters, pagination);
  if (!pagination) {
    return movements;
  }
  const paginatedMovements = /** @type {{ items: Array<any>, totalItems: number }} */ (movements);
  return buildPaginatedResponse(paginatedMovements.items, pagination, paginatedMovements.totalItems);
}

async function listStocks(auth, filters = {}, pagination = null) {
  const { companyId } = authScope(auth);
  const [items, lots] = await Promise.all([
    inventoryRepository.findWarehouseStocks(companyId, filters),
    inventoryRepository.findWarehouseLotStocks(companyId, { ...filters, includeSystem: true }),
  ]);
  const lotCounts = new Map();
  for (const lotStock of /** @type {Array<any>} */ (lots)) {
    const key = `${lotStock.productId.toString()}:${lotStock.warehouseId.toString()}`;
    const current = lotCounts.get(key) || new Set();
    if (!lotStock.lot?.isSystemGenerated) {
      current.add(lotStock.lotId.toString());
    }
    lotCounts.set(key, current);
  }
  const serializedItems = items.map((item) => serializeStockRow(
    item,
    lotCounts.get(`${item.productId.toString()}:${item.warehouseId.toString()}`)?.size || 0,
  ));
  const response = { items: serializedItems, lots: /** @type {Array<any>} */ (lots).map((lotStock) => ({ ...lotStock, lot: serializeLot(lotStock.lot) })) };
  if (!pagination) {
    return response;
  }
  return buildPaginatedResponse(response.items, pagination, response.items.length);
}

async function listLots(auth, filters = {}, pagination = null) {
  const { companyId } = authScope(auth);
  const lots = await inventoryRepository.findLotsForCompany(companyId, filters, pagination);
  if (!pagination) {
    return /** @type {Array<any>} */ (lots).map(serializeLot);
  }
  const paginatedLots = /** @type {{ items: Array<any>, totalItems: number }} */ (lots);
  return buildPaginatedResponse(paginatedLots.items.map(serializeLot), pagination, paginatedLots.totalItems);
}

async function getLot(lotId, auth) {
  const { companyId } = authScope(auth);
  const lot = await inventoryRepository.findLotForCompanyById(lotId, companyId);
  if (!lot) throw createHttpError(404, 'Lote no encontrado para la empresa', 'not_found');
  return serializeLot(lot);
}

async function registerStockEntryInTransaction(tx, payload, auth) {
  const context = await getInventoryContext(tx, auth, payload.warehouseId, payload.productId);
  await acquireCompanyInventoryAdvisoryLock(tx, context.companyId);
  const requestedInternalLotNumber = payload.internalLotNumber || payload.lotNumber;
  const isQuarantineEntry = context.warehouse.warehouseType === 'QUARANTINE';
  const lotStatus = isQuarantineEntry ? 'QUARANTINED' : 'AVAILABLE';
  const qaStatus = isQuarantineEntry ? 'PENDING' : 'APPROVED';
  const normalizedDates = normalizeLotDates(payload);
  let lotNumberResolution = null;
  let lot = null;

  if (usesSystemLotStrategy(context.product)) {
    if (payload.internalLotNumber || payload.lotNumber || payload.manufacturerLotNumber) {
      throw createHttpError(400, 'Los productos con lote de sistema no aceptan numeros de lote visibles', 'lot_not_allowed');
    }
    lot = await getOrCreateSystemLot(tx, context, 0);
  } else {
    if (!requestedInternalLotNumber) {
      throw createHttpError(400, 'Toda existencia con lote de negocio requiere numero de lote interno', 'validation_error');
    }

    lotNumberResolution = await resolveUniqueInternalLotNumber(
      tx,
      context.companyId,
      requestedInternalLotNumber,
    );
    const internalLotNumber = lotNumberResolution.assigned;
    lot = await inventoryRepository.createLot({
      companyId: context.companyId,
      productId: context.product.id,
      supplierId: payload.supplierId ?? null,
      invoiceNumber: payload.invoiceNumber,
      lotNumber: internalLotNumber,
      internalLotNumber,
      manufacturerLotNumber: payload.manufacturerLotNumber ?? payload.lotNumber ?? null,
      productionDate: normalizedDates.productionDate,
      expirationDate: normalizedDates.expirationDate,
      entryDate: normalizedDates.entryDate,
      quantity: payload.quantity,
      originalQuantity: payload.quantity,
      status: lotStatus,
      qaStatus,
      casNumber: payload.casNumber,
    }, tx);
  }

  const lotStock = await changeLotStock(tx, context, lot, payload.quantity, 0);
  const warehouseStock = await changeWarehouseStock(tx, context, payload.quantity, 0);
  const product = await inventoryRepository.updateProductById(
    context.product.id,
    context.companyId,
    { quantity: { increment: payload.quantity } },
    tx,
  );
  if (lot.isSystemGenerated) {
    lot = await inventoryRepository.updateLotById(lot.id, { quantity: { increment: payload.quantity } }, tx);
  }
  const movement = await createMovement(tx, context, {
    lotId: lot.id,
    movementType: 'IN',
    quantity: payload.quantity,
    quantityBefore: warehouseStock.before,
    quantityAfter: warehouseStock.after,
    reasonCode: payload.reasonCode,
    sourceType: 'lot_entry',
    sourceId: lot.id,
    note: lotNumberResolution?.collision
      ? `${payload.note ?? 'Entrada manual de inventario'} | Lote solicitado ${lotNumberResolution.requested}; asignado ${lotNumberResolution.assigned}`
      : payload.note ?? 'Entrada manual de inventario',
  });

  if (lotNumberResolution?.collision) {
    await inventoryRepository.createInventoryAlert({
      companyId: context.companyId,
      productId: context.product.id,
      lotId: lot.id,
      warehouseId: context.warehouse.id,
      alertType: 'DUPLICATE_INTERNAL_LOT',
      severity: 'WARNING',
      status: 'OPEN',
      message: `El lote ${lotNumberResolution.requested} ya existia; se asigno ${lotNumberResolution.assigned}`,
      metadata: {
        requestedLotNumber: lotNumberResolution.requested,
        assignedLotNumber: lotNumberResolution.assigned,
        movementId: movement.id.toString(),
      },
    }, tx);
  }

  return {
    product,
    warehouseStock: warehouseStock.record,
    lot,
    lotStock: lotStock.record,
    movement,
    lotNumberCollision: lotNumberResolution?.collision ? lotNumberResolution : null,
  };
}

async function registerStockEntry(payload, auth, req = null) {
  const result = /** @type {any} */ (await inventoryRepository.transaction((tx) => registerStockEntryInTransaction(tx, payload, auth)));
  await audit.recordAuditEventIfAvailable({
    req,
    action: 'inventory.stock_entry.register',
    resourceType: 'lot',
    resourceId: result.lot.id,
    outcome: 'SUCCESS',
    afterState: {
      lotId: result.lot.id,
      productId: result.lot.productId,
      warehouseId: result.warehouseStock.warehouseId,
      quantity: result.lot.quantity,
      status: result.lot.status,
      qaStatus: result.lot.qaStatus,
      movementId: result.movement.id,
    },
    metadata: {
      reasonCode: payload.reasonCode,
      lotNumberCollision: result.lotNumberCollision,
    },
  });
  return result;
}

async function updateLotQa(lotId, payload, auth, req = null) {
  const { companyId, userId } = authScope(auth);

  const result = /** @type {any} */ (await inventoryRepository.transaction(async (tx) => {
    const lot = await inventoryRepository.findLotForCompanyWithActiveWarehouseStocks(lotId, companyId, tx);
    if (!lot) throw createHttpError(404, 'Lote no encontrado para la empresa', 'not_found');

    const { expired } = deriveLotUsability(lot);
    let newStatus = lot.status;
    let newQaStatus = lot.qaStatus;

    switch (payload.action) {
      case 'APPROVE':
        if (expired) throw createHttpError(409, 'Un lote vencido no puede aprobarse para venta', 'conflict');
        newStatus = 'AVAILABLE';
        newQaStatus = 'APPROVED';
        break;
      case 'REJECT':
        newStatus = 'BLOCKED';
        newQaStatus = 'REJECTED';
        break;
      case 'FAIL':
        newStatus = 'BLOCKED';
        newQaStatus = 'FAILED';
        break;
      case 'BLOCK':
        newStatus = 'BLOCKED';
        break;
      case 'REACTIVATE':
        newStatus = expired ? 'EXPIRED' : 'AVAILABLE';
        newQaStatus = 'APPROVED';
        break;
      default:
        throw createHttpError(400, 'Accion QA no soportada', 'validation_error');
    }

    const updatedLot = await inventoryRepository.updateLotByIdWithWarehouseStocks(
      lot.id,
      { status: newStatus, qaStatus: newQaStatus },
      tx,
    );

    await inventoryRepository.createLotStatusHistory({
      companyId,
      lotId: lot.id,
      userId,
      action: payload.action,
      previousStatus: lot.status,
      newStatus,
      previousQaStatus: lot.qaStatus,
      newQaStatus,
      reason: payload.reason,
    }, tx);

    const warehouseId = lot.warehouseLotStocks[0]?.warehouseId ?? null;
    if (['REJECT', 'FAIL', 'BLOCK'].includes(payload.action)) {
      await inventoryRepository.createInventoryAlert({
        companyId,
        productId: lot.productId,
        lotId: lot.id,
        warehouseId,
        alertType: payload.action === 'FAIL' ? 'QA_FAILURE' : 'LOT_BLOCKED',
        severity: 'CRITICAL',
        status: 'OPEN',
        message: payload.reason,
        metadata: {
          action: payload.action,
          previousStatus: lot.status,
          previousQaStatus: lot.qaStatus,
        },
      }, tx);
    } else {
      await inventoryRepository.resolveOpenLotAlerts(companyId, lot.id, new Date(), tx);
    }

    return { updatedLot, previousLot: lot };
  }));

  await audit.recordAuditEventIfAvailable({
    req,
    action: 'inventory.lot.qa.update',
    resourceType: 'lot',
    resourceId: lotId,
    outcome: 'SUCCESS',
    beforeState: {
      id: result.previousLot.id,
      status: result.previousLot.status,
      qaStatus: result.previousLot.qaStatus,
    },
    afterState: {
      id: result.updatedLot.id,
      status: result.updatedLot.status,
      qaStatus: result.updatedLot.qaStatus,
    },
    metadata: {
      action: payload.action,
      reason: payload.reason,
    },
  });

  return result.updatedLot;
}

function normalizeInitialLotNumber(row) {
  return row.internalLotNumber || row.lotNumber || row.manufacturerLotNumber;
}

function assertNoDuplicateInitialInventoryRows(rows, product) {
  const keys = new Set();
  for (const row of rows) {
    const lotKey = usesSystemLotStrategy(product) ? 'system' : normalizeInitialLotNumber(row);
    const key = `${row.warehouseId.toString()}:${lotKey || ''}`;
    if (keys.has(key)) {
      throw createHttpError(409, 'La carga inicial contiene filas duplicadas para la misma ubicacion/lote', 'duplicate_inventory_operation');
    }
    keys.add(key);
  }
}

async function createInitialInventory(payload, auth, req = null) {
  const result = /** @type {any} */ (await inventoryRepository.transaction(async (tx) => {
    const firstContext = await getInventoryContext(tx, auth, payload.rows[0].warehouseId, payload.productId);
    await acquireCompanyInventoryAdvisoryLock(tx, firstContext.companyId);

    const existingOperation = await inventoryRepository.findInventoryOperationByIdempotencyKey(
      firstContext.companyId,
      'INITIAL_INVENTORY',
      payload.idempotencyKey,
      tx,
    );
    if (existingOperation) {
      return { operation: existingOperation, movements: [], idempotentReplay: true };
    }

    const evidence = await inventoryRepository.countProductInventoryEvidence(firstContext.companyId, firstContext.product.id, tx);
    if (evidence.movementCount > 0 || evidence.stockCount > 0 || number(firstContext.product.quantity) !== 0 || number(firstContext.product.reservedQuantity) !== 0) {
      throw createHttpError(409, 'La carga inicial solo aplica a productos sin historial ni stock previo', 'initial_inventory_already_registered');
    }

    assertNoDuplicateInitialInventoryRows(payload.rows, firstContext.product);
    const movementGroupId = randomUUID();
    const operation = await inventoryRepository.createInventoryOperation({
      companyId: firstContext.companyId,
      operationType: 'INITIAL_INVENTORY',
      idempotencyKey: payload.idempotencyKey,
      status: 'COMPLETED',
      productId: firstContext.product.id,
      movementGroupId,
      reasonCode: 'INITIAL_INVENTORY',
      note: payload.note || null,
      metadata: { rowCount: payload.rows.length },
      createdByUserId: firstContext.userId,
    }, tx);
    const movements = [];
    let totalQuantity = 0;

    for (const row of payload.rows) {
      const context = row.warehouseId === firstContext.warehouse.id
        ? firstContext
        : await getInventoryContext(tx, auth, row.warehouseId, payload.productId);
      let lot = null;
      if (usesSystemLotStrategy(context.product)) {
        if (row.lotNumber || row.internalLotNumber || row.manufacturerLotNumber || row.expirationDate || row.productionDate) {
          throw createHttpError(400, 'La carga inicial con lote de sistema no acepta campos de lote visible', 'lot_not_allowed');
        }
        lot = await getOrCreateSystemLot(tx, context, 0);
      } else {
        const requestedInternalLotNumber = normalizeInitialLotNumber(row);
        if (!requestedInternalLotNumber) {
          throw createHttpError(400, 'La carga inicial requiere identificador de lote de negocio', 'lot_required');
        }
        if (context.product.requiresExpiration && !row.expirationDate) {
          throw createHttpError(400, 'El producto requiere fecha de vencimiento para el lote', 'validation_error');
        }
        const normalizedDates = normalizeLotDates(row);
        lot = await inventoryRepository.createLot({
          companyId: context.companyId,
          productId: context.product.id,
          supplierId: null,
          invoiceNumber: null,
          lotNumber: requestedInternalLotNumber,
          internalLotNumber: requestedInternalLotNumber,
          manufacturerLotNumber: row.manufacturerLotNumber ?? row.lotNumber ?? null,
          productionDate: normalizedDates.productionDate,
          expirationDate: normalizedDates.expirationDate,
          entryDate: new Date(),
          quantity: row.quantity,
          originalQuantity: row.quantity,
          status: 'AVAILABLE',
          qaStatus: 'APPROVED',
        }, tx);
      }

      await changeLotStock(tx, context, lot, row.quantity, 0);
      const warehouseStock = await changeWarehouseStock(tx, context, row.quantity, 0);
      if (lot.isSystemGenerated) {
        lot = await inventoryRepository.updateLotById(lot.id, { quantity: { increment: row.quantity }, originalQuantity: { increment: row.quantity } }, tx);
      }
      totalQuantity += Number(row.quantity);
      movements.push(await createMovement(tx, context, {
        lotId: lot.id,
        movementType: 'IN',
        quantity: row.quantity,
        quantityBefore: warehouseStock.before,
        quantityAfter: warehouseStock.after,
        reasonCode: 'INITIAL_INVENTORY',
        movementGroupId,
        sourceType: 'inventory_operation',
        sourceId: operation.id,
        note: payload.note || 'Carga inicial de inventario',
      }));
    }

    await inventoryRepository.updateProductById(firstContext.product.id, firstContext.companyId, { quantity: { increment: totalQuantity } }, tx);
    const completedOperation = await tx.inventoryOperation.update({
      where: { id: operation.id },
      data: { metadata: { rowCount: payload.rows.length, totalQuantity } },
    });

    return { operation: completedOperation, movements, idempotentReplay: false };
  }));

  if (!result.idempotentReplay) {
    await audit.recordAuditEventIfAvailable({
      req,
      action: 'inventory.initial_inventory.create',
      resourceType: 'inventory_operation',
      resourceId: result.operation.id,
      outcome: 'SUCCESS',
      afterState: { operationId: result.operation.id, movementGroupId: result.operation.movementGroupId },
      metadata: { idempotencyKey: payload.idempotencyKey, rowCount: payload.rows.length },
    });
  }

  return result;
}

async function adjustStock(payload, auth, req = null) {
  const result = /** @type {any} */ (await inventoryRepository.transaction(async (tx) => {
    const context = await getInventoryContext(tx, auth, payload.warehouseId, payload.productId);
    await acquireCompanyInventoryAdvisoryLock(tx, context.companyId);
    const existingOperation = await inventoryRepository.findInventoryOperationByIdempotencyKey(
      context.companyId,
      'ADJUSTMENT',
      payload.idempotencyKey,
      tx,
    );
    if (existingOperation) {
      return { operation: existingOperation, idempotentReplay: true };
    }
    const movementGroupId = randomUUID();
    const operation = await inventoryRepository.createInventoryOperation({
      companyId: context.companyId,
      operationType: 'ADJUSTMENT',
      idempotencyKey: payload.idempotencyKey || null,
      productId: context.product.id,
      sourceWarehouseId: context.warehouse.id,
      movementGroupId,
      reasonCode: payload.reasonCode,
      note: payload.note,
      createdByUserId: context.userId,
      metadata: { direction: payload.direction, quantity: payload.quantity },
    }, tx);
    let lot = null;
    if (usesSystemLotStrategy(context.product)) {
      if (payload.lotId) {
        throw createHttpError(400, 'Los productos con lote de sistema no aceptan lote visible', 'lot_not_allowed');
      }
      lot = await getOrCreateSystemLot(tx, context, 0);
    } else {
      if (!payload.lotId) {
        throw createHttpError(400, 'Todo ajuste de inventario con lote de negocio requiere lote', 'validation_error');
      }
      lot = await inventoryRepository.findLotForProduct(payload.lotId, context.product.id, tx);
      if (!lot) throw createHttpError(404, 'Lote no encontrado para el producto', 'not_found');
    }

    const quantityDelta = payload.direction === 'IN' ? payload.quantity : -payload.quantity;
    const warehouseStock = await changeWarehouseStock(tx, context, quantityDelta, 0);
    const lotStock = lot ? await changeLotStock(tx, context, lot, quantityDelta, 0) : null;

    const product = await inventoryRepository.updateProductById(
      context.product.id,
      context.companyId,
      payload.direction === 'IN'
        ? { quantity: { increment: payload.quantity } }
        : { quantity: { decrement: payload.quantity } },
      tx,
    );

    if (lot) {
      lot = await inventoryRepository.updateLotById(
        lot.id,
        payload.direction === 'IN'
          ? { quantity: { increment: payload.quantity } }
          : { quantity: { decrement: payload.quantity } },
        tx,
      );
    }

    const movement = await createMovement(tx, context, {
      lotId: lot?.id,
      movementType: 'ADJUSTMENT',
      quantity: payload.quantity,
      quantityBefore: warehouseStock.before,
      quantityAfter: warehouseStock.after,
      reasonCode: payload.reasonCode,
      movementGroupId,
      sourceType: 'inventory_operation',
      sourceId: operation.id,
      note: `${payload.direction}: ${payload.note}`,
    });

    return { operation, product, warehouseStock: warehouseStock.record, lotStock: lotStock?.record ?? null, lot, movement };
  }));

  if (result.idempotentReplay) {
    return result;
  }

  await audit.recordAuditEventIfAvailable({
    req,
    action: 'inventory.stock.adjust',
    resourceType: 'stock_movement',
    resourceId: result.movement.id,
    outcome: 'SUCCESS',
    afterState: {
      movementId: result.movement.id,
      productId: result.product.id,
      warehouseId: result.warehouseStock.warehouseId,
      lotId: result.lot?.id || null,
      quantity: result.movement.quantity,
      movementType: result.movement.movementType,
    },
    metadata: {
      direction: payload.direction,
      reasonCode: payload.reasonCode,
    },
  });

  return result;
}

async function transferInventory(payload, auth, req = null) {
  if (payload.sourceWarehouseId === payload.destinationWarehouseId) {
    throw createHttpError(400, 'La ubicacion origen y destino deben ser diferentes', 'validation_error');
  }

  const result = /** @type {any} */ (await inventoryRepository.transaction(async (tx) => {
    const sourceContext = await getInventoryContext(tx, auth, payload.sourceWarehouseId, payload.productId);
    await acquireCompanyInventoryAdvisoryLock(tx, sourceContext.companyId);
    const destinationContext = await getInventoryContext(tx, auth, payload.destinationWarehouseId, payload.productId);
    const existingOperation = await inventoryRepository.findInventoryOperationByIdempotencyKey(
      sourceContext.companyId,
      'TRANSFER',
      payload.idempotencyKey,
      tx,
    );
    if (existingOperation) {
      return { operation: existingOperation, idempotentReplay: true };
    }

    let sourceLot = null;
    let destinationLot = null;
    if (usesSystemLotStrategy(sourceContext.product)) {
      if (payload.lotId) {
        throw createHttpError(400, 'Los productos con lote de sistema no aceptan lote visible', 'lot_not_allowed');
      }
      sourceLot = await getOrCreateSystemLot(tx, sourceContext, 0);
      destinationLot = await getOrCreateSystemLot(tx, destinationContext, 0);
    } else {
      if (!payload.lotId) {
        throw createHttpError(400, 'Todo traslado con lote de negocio requiere lote', 'validation_error');
      }
      sourceLot = await inventoryRepository.findLotForProduct(payload.lotId, sourceContext.product.id, tx);
      if (!sourceLot) throw createHttpError(404, 'Lote no encontrado para el producto', 'not_found');
      destinationLot = sourceLot;
    }

    const movementGroupId = randomUUID();
    const operation = await inventoryRepository.createInventoryOperation({
      companyId: sourceContext.companyId,
      operationType: 'TRANSFER',
      idempotencyKey: payload.idempotencyKey,
      productId: sourceContext.product.id,
      sourceWarehouseId: sourceContext.warehouse.id,
      destinationWarehouseId: destinationContext.warehouse.id,
      movementGroupId,
      reasonCode: payload.reasonCode,
      note: payload.note || null,
      createdByUserId: sourceContext.userId,
      metadata: { quantity: payload.quantity, sourceLotId: sourceLot.id.toString(), destinationLotId: destinationLot.id.toString() },
    }, tx);

    const sourceWarehouseStock = await changeWarehouseStock(tx, sourceContext, -payload.quantity, 0);
    const sourceLotStock = await changeLotStock(tx, sourceContext, sourceLot, -payload.quantity, 0);
    const destinationWarehouseStock = await changeWarehouseStock(tx, destinationContext, payload.quantity, 0);
    const destinationLotStock = await changeLotStock(tx, destinationContext, destinationLot, payload.quantity, 0);

    if (sourceLot.id !== destinationLot.id) {
      await inventoryRepository.updateLotById(sourceLot.id, { quantity: { decrement: payload.quantity } }, tx);
      destinationLot = await inventoryRepository.updateLotById(destinationLot.id, { quantity: { increment: payload.quantity } }, tx);
    }

    const outMovement = await createMovement(tx, sourceContext, {
      lotId: sourceLot.id,
      movementType: 'TRANSFER_OUT',
      quantity: payload.quantity,
      quantityBefore: sourceWarehouseStock.before,
      quantityAfter: sourceWarehouseStock.after,
      reasonCode: payload.reasonCode,
      movementGroupId,
      sourceType: 'inventory_operation',
      sourceId: operation.id,
      note: payload.note || 'Traslado de inventario',
    });
    const inMovement = await createMovement(tx, destinationContext, {
      lotId: destinationLot.id,
      movementType: 'TRANSFER_IN',
      quantity: payload.quantity,
      quantityBefore: destinationWarehouseStock.before,
      quantityAfter: destinationWarehouseStock.after,
      reasonCode: payload.reasonCode,
      movementGroupId,
      sourceType: 'inventory_operation',
      sourceId: operation.id,
      note: payload.note || 'Traslado de inventario',
    });

    return {
      operation,
      sourceWarehouseStock: sourceWarehouseStock.record,
      destinationWarehouseStock: destinationWarehouseStock.record,
      sourceLotStock: sourceLotStock.record,
      destinationLotStock: destinationLotStock.record,
      sourceLot,
      destinationLot,
      movements: [outMovement, inMovement],
    };
  }));

  if (result.idempotentReplay) {
    return result;
  }

  await audit.recordAuditEventIfAvailable({
    req,
    action: 'inventory.transfer.create',
    resourceType: 'inventory_operation',
    resourceId: result.operation.id,
    outcome: 'SUCCESS',
    afterState: { operationId: result.operation.id, movementGroupId: result.operation.movementGroupId },
    metadata: {
      productId: payload.productId,
      sourceWarehouseId: payload.sourceWarehouseId,
      destinationWarehouseId: payload.destinationWarehouseId,
      quantity: payload.quantity,
    },
  });

  return result;
}

function splitOrderItemsByInventoryApplicability(order) {
  const inventoryItems = [];
  const nonInventoryItems = [];
  for (const item of order.items || []) {
    if (isInventoryControlledProduct(item.product)) {
      inventoryItems.push(item);
    } else {
      nonInventoryItems.push(item);
    }
  }
  return { inventoryItems, nonInventoryItems };
}

async function reserveStockForOrder(orderId, auth, req = null) {
  const updatedOrder = /** @type {any} */ (await inventoryRepository.transaction(async (tx) => {
    const scope = authScope(auth);
    const order = /** @type {any} */ (await inventoryRepository.findOrderForCompany(
      orderId,
      scope.companyId,
      { items: { include: { product: true } }, warehouse: true },
      tx,
    ));

    if (!order) throw createHttpError(404, 'Pedido no encontrado', 'not_found');
    if (order.status === 'APPROVED' || order.approved) {
      throw createHttpError(409, 'El pedido ya fue aprobado', 'conflict');
    }
    if (order.status === 'CANCELLED' || order.status === 'DELIVERED') {
      throw createHttpError(409, 'El pedido no se puede aprobar en su estado actual', 'conflict');
    }

    const { inventoryItems } = splitOrderItemsByInventoryApplicability(order);

    // Auto-assign sellable warehouse when inventory-controlled lines need one (e.g. agent orders).
    if (!order.warehouseId && inventoryItems.length > 0) {
      const sellableWarehouse = await inventoryRepository.findFirstSellableWarehouse(scope.companyId, tx);
      if (!sellableWarehouse) {
        throw createHttpError(409, 'No hay bodegas vendibles activas para asignar al pedido. Cree o active una bodega como fuente vendible.', 'conflict');
      }
      order.warehouseId = sellableWarehouse.id;
      order.warehouse = sellableWarehouse;
      await inventoryRepository.updateOrderById(order.id, { warehouseId: sellableWarehouse.id }, {}, tx);
    }

    if (inventoryItems.length > 0) {
      assertOrderHasOperationalWarehouse(order);
    }

    const movementGroupId = randomUUID();

    for (const item of inventoryItems) {
      const context = await getInventoryContext(tx, auth, order.warehouseId, item.productId, { requireSellable: true });
      const quantity = number(item.quantity);
      const stock = await changeWarehouseStock(tx, context, 0, quantity);
      let allocations = [{ lot: null, quantity }];

      if (context.product.lotStrategy !== 'NONE') {
        allocations = await reserveLots(tx, context, quantity);
      }

      await inventoryRepository.updateProductById(
        context.product.id,
        context.companyId,
        { reservedQuantity: { increment: quantity } },
        tx,
      );

      for (const allocation of allocations) {
        await createMovement(tx, context, {
          lotId: allocation.lot?.id,
          movementType: 'RESERVE',
          quantity: allocation.quantity,
          quantityBefore: stock.before,
          quantityAfter: stock.after,
          reasonCode: 'ORDER_RESERVATION',
          movementGroupId,
          sourceType: 'order',
          sourceId: order.id,
          note: `Reserva por aprobacion de pedido ${order.id.toString()}`,
        });
      }
    }

    // Increment store creditBalance on order approval (per-store credit tracking).
    // Uses shared calculateInvoiceAmount for formula consistency (includes Math.max(0) clamp).
    const orderAmount = calculateInvoiceAmount(order.items);
    if (order.clientStoreId && orderAmount > 0) {
      await tx.clientStore.update({
        where: { id: order.clientStoreId },
        data: { creditBalance: { increment: orderAmount } },
      });
    }

    return inventoryRepository.updateOrderById(orderId, {
      approved: true,
      approvedAt: new Date(),
      approvedById: scope.userId,
      status: 'APPROVED',
    }, { client: true, user: true, approvedBy: true, warehouse: true, items: { include: { product: true } } }, tx);
  }));

  await audit.recordAuditEventIfAvailable({
    req,
    action: 'orders.approve',
    resourceType: 'order',
    resourceId: orderId,
    outcome: 'SUCCESS',
    afterState: {
      id: updatedOrder.id,
      status: updatedOrder.status,
      approved: updatedOrder.approved,
      approvedById: updatedOrder.approvedById,
      warehouseId: updatedOrder.warehouseId,
    },
  });

  // Best-effort billing trigger on approval — creates invoice and pending payment
  // so the office can track and verify agent payments from the moment the order is approved.
  // Idempotent: generateBillingOnDispatch checks for existing invoices before creating.
  await billingTriggerService.generateBillingOnDispatch(updatedOrder, updatedOrder.client, auth);

  return updatedOrder;
}


async function releaseStockReservation(orderId, cancel, auth, req = null) {
  const updatedOrder = /** @type {any} */ (await inventoryRepository.transaction(async (tx) => {
    const scope = authScope(auth);
    const order = /** @type {any} */ (await inventoryRepository.findOrderForCompany(
      orderId,
      scope.companyId,
      { items: { include: { product: true } } },
      tx,
    ));

    if (!order) throw createHttpError(404, 'Pedido no encontrado', 'not_found');
    if (!order.approved || order.status !== 'APPROVED') {
      throw createHttpError(409, 'El pedido no tiene reservas activas para liberar', 'conflict');
    }

    const { inventoryItems } = splitOrderItemsByInventoryApplicability(order);
    if (inventoryItems.length > 0) {
      assertOrderHasOperationalWarehouse(order);
    }

    const allocations = inventoryItems.length > 0 ? await getActiveAllocations(tx, order) : [];
    const movementGroupId = randomUUID();

    for (const item of inventoryItems) {
      const context = await getInventoryContext(tx, auth, order.warehouseId, item.productId);
      const itemAllocations = allocations.filter((allocation) => allocation.productId === item.productId);
      const reserved = itemAllocations.reduce((sum, allocation) => sum + allocation.quantity, 0);
      if (Math.abs(reserved - number(item.quantity)) > 0.000001) {
        throw createHttpError(409, 'La reserva del pedido no coincide con sus lineas', 'conflict');
      }

      const stock = await changeWarehouseStock(tx, context, 0, -reserved);
      await inventoryRepository.updateProductById(
        context.product.id,
        context.companyId,
        { reservedQuantity: { decrement: reserved } },
        tx,
      );

      for (const allocation of itemAllocations) {
        let lot = null;
        if (allocation.lotId) {
          lot = await inventoryRepository.findLotById(allocation.lotId, tx);
          await changeLotStock(tx, context, lot, 0, -allocation.quantity);
        }
        await createMovement(tx, context, {
          lotId: allocation.lotId,
          movementType: 'RELEASE',
          quantity: allocation.quantity,
          quantityBefore: stock.before,
          quantityAfter: stock.after,
          reasonCode: cancel ? 'ORDER_CANCELLED' : 'ORDER_RELEASE',
          movementGroupId,
          sourceType: 'order',
          sourceId: order.id,
          note: cancel
            ? `Liberacion por cancelacion de pedido ${order.id.toString()}`
            : `Liberacion de pedido ${order.id.toString()}`,
        });
      }
    }

    // Reverse store creditBalance when an approved order is cancelled.
    // Mirrors the increment in reserveStockForOrder; uses the same shared formula.
    if (cancel && order.clientStoreId) {
      const orderAmount = calculateInvoiceAmount(order.items);
      if (orderAmount > 0) {
        await tx.clientStore.update({
          where: { id: order.clientStoreId },
          data: { creditBalance: { decrement: orderAmount } },
        });
      }
    }

    return inventoryRepository.updateOrderById(orderId, {
      approved: false,
      approvedAt: null,
      approvedById: null,
      status: cancel ? 'CANCELLED' : 'DRAFT',
    }, { client: true, user: true, approvedBy: true, warehouse: true, items: { include: { product: true } } }, tx);
  }));

  await audit.recordAuditEventIfAvailable({
    req,
    action: cancel ? 'orders.cancel' : 'orders.release',
    resourceType: 'order',
    resourceId: orderId,
    outcome: 'SUCCESS',
    afterState: {
      id: updatedOrder.id,
      status: updatedOrder.status,
      approved: updatedOrder.approved,
      warehouseId: updatedOrder.warehouseId,
    },
  });

  return updatedOrder;
}

/**
 * @param {bigint} orderId
 * @param {any} auth
 * @param {{ transportMethod?: string, trackingNumber?: string, transportResponsible?: string, lotSelections?: Array<{ productId: string|bigint, selections: Array<{ lotId: string|bigint, quantity: number }> }> } | null} [transportPayload]
 * @param {any} [req]
 */
async function dispatchOrder(orderId, auth, transportPayload = null, req = null) {
  // Lot overrides: bodega can choose different lots than the FIFO auto-allocation.
  // If provided for a product, the system releases the FIFO reserve and creates
  // OUT movements from the chosen lots instead.
  const lotSelectionsByProduct = new Map(
    (transportPayload?.lotSelections || []).map((s) => [BigInt(s.productId).toString(), s.selections || []]),
  );
  const updatedOrder = /** @type {any} */ (await inventoryRepository.transaction(async (tx) => {
    const scope = authScope(auth);
    const order = /** @type {any} */ (await inventoryRepository.findOrderForCompany(
      orderId,
      scope.companyId,
      { items: { include: { product: true } } },
      tx,
    ));

    if (!order) throw createHttpError(404, 'Pedido no encontrado', 'not_found');
    if (!order.approved || order.status !== 'APPROVED') {
      throw createHttpError(409, 'El pedido debe estar aprobado antes de despacharse', 'conflict');
    }

    const { inventoryItems } = splitOrderItemsByInventoryApplicability(order);
    if (inventoryItems.length > 0) {
      assertOrderHasOperationalWarehouse(order);
    }

    const allocations = inventoryItems.length > 0 ? await getActiveAllocations(tx, order) : [];
    const movementGroupId = randomUUID();

    for (const item of inventoryItems) {
      const context = await getInventoryContext(tx, auth, order.warehouseId, item.productId, { requireSellable: true });
      const itemAllocations = allocations.filter((allocation) => allocation.productId === item.productId);
      const reserved = itemAllocations.reduce((sum, allocation) => sum + allocation.quantity, 0);
      const quantity = number(item.quantity);

      if (Math.abs(reserved - quantity) > 0.000001) {
        throw createHttpError(409, 'La reserva del pedido no coincide con sus lineas', 'conflict');
      }

      const overrideSelections = context.product.lotStrategy !== 'NONE'
        ? (lotSelectionsByProduct.get(item.productId.toString()) || null)
        : null;

      if (overrideSelections && overrideSelections.length > 0) {
        const overrideTotal = overrideSelections.reduce((s, sel) => s + Number(sel.quantity), 0);
        if (Math.abs(overrideTotal - quantity) > 0.000001) {
          throw createHttpError(
            409,
            `La seleccion de lotes para "${context.product.name}" no coincide con la cantidad del pedido (esperado: ${quantity}, recibido: ${overrideTotal})`,
            'conflict',
          );
        }
      } else if (Math.abs(reserved - quantity) > 0.000001) {
        throw createHttpError(409, 'La reserva del pedido no coincide con sus lineas', 'conflict');
      }

      const stock = await changeWarehouseStock(tx, context, -quantity, -quantity);
      await inventoryRepository.updateProductById(
        context.product.id,
        context.companyId,
        {
          quantity: { decrement: quantity },
          reservedQuantity: { decrement: quantity },
        },
        tx,
      );

      if (overrideSelections && overrideSelections.length > 0) {
        // 1. Release the FIFO-reserved lots (unreserve only, no quantity change)
        for (const allocation of itemAllocations) {
          if (allocation.lotId) {
            const lot = await inventoryRepository.findLotById(allocation.lotId, tx);
            await changeLotStock(tx, context, lot, 0, -allocation.quantity);
          }
          await createMovement(tx, context, {
            lotId: allocation.lotId,
            movementType: 'RELEASE',
            quantity: allocation.quantity,
            quantityBefore: stock.before,
            quantityAfter: stock.after,
            reasonCode: 'ORDER_LOT_OVERRIDE',
            movementGroupId,
            sourceType: 'order',
            sourceId: order.id,
            note: `Liberacion por cambio de lote en despacho ${order.id.toString()}`,
          });
        }

        // 2. OUT from the bodega-selected lots
        for (const sel of overrideSelections) {
          const selQty = Number(sel.quantity);
          const lot = await inventoryRepository.findLotById(BigInt(sel.lotId), tx);
          if (!lot) throw createHttpError(404, `Lote ${sel.lotId} no encontrado`, 'not_found');

          await changeLotStock(tx, context, lot, -selQty, 0);
          await inventoryRepository.updateLotById(lot.id, { quantity: { decrement: selQty } }, tx);
          await createMovement(tx, context, {
            lotId: lot.id,
            movementType: 'OUT',
            quantity: selQty,
            quantityBefore: stock.before,
            quantityAfter: stock.after,
            reasonCode: 'ORDER_DISPATCH',
            movementGroupId,
            sourceType: 'order',
            sourceId: order.id,
            note: `Despacho de pedido ${order.id.toString()} (lote seleccionado manualmente)`,
          });
        }
      } else {
        // Normal FIFO flow using existing RESERVE allocations
        for (const allocation of itemAllocations) {
          let lot = null;
          if (allocation.lotId) {
            lot = await inventoryRepository.findLotById(allocation.lotId, tx);
            await changeLotStock(tx, context, lot, -allocation.quantity, -allocation.quantity);
            await inventoryRepository.updateLotById(
              lot.id,
              { quantity: { decrement: allocation.quantity } },
              tx,
            );
          }
          await createMovement(tx, context, {
            lotId: allocation.lotId,
            movementType: 'OUT',
            quantity: allocation.quantity,
            quantityBefore: stock.before,
            quantityAfter: stock.after,
            reasonCode: 'ORDER_DISPATCH',
            movementGroupId,
            sourceType: 'order',
            sourceId: order.id,
            note: `Despacho de pedido ${order.id.toString()}`,
          });
        }
      }
    }

    const dispatchUserId = auth?.sub ? BigInt(auth.sub) : null;
    return inventoryRepository.updateOrderById(
      orderId,
      {
        status: inventoryItems.length > 0 ? 'DELIVERED' : 'FULFILLED',
        dispatchedAt: new Date(),
        ...(dispatchUserId ? { dispatchedById: dispatchUserId } : {}),
        ...(transportPayload?.transportMethod    ? { transportMethod:      transportPayload.transportMethod }    : {}),
        ...(transportPayload?.trackingNumber     ? { trackingNumber:       transportPayload.trackingNumber }     : {}),
        ...(transportPayload?.transportResponsible ? { transportResponsible: transportPayload.transportResponsible } : {}),
      },
      { client: true, user: true, approvedBy: true, warehouse: true, items: { include: { product: true } } },
      tx,
    );
  }));

  await audit.recordAuditEventIfAvailable({
    req,
    action: 'orders.dispatch',
    resourceType: 'order',
    resourceId: orderId,
    outcome: 'SUCCESS',
    afterState: {
      id: updatedOrder.id,
      status: updatedOrder.status,
      approved: updatedOrder.approved,
      warehouseId: updatedOrder.warehouseId,
    },
  });

  // Best-effort billing trigger — OUTSIDE the dispatch transaction.
  // Errors are caught and logged inside generateBillingOnDispatch; the dispatch never fails due to billing.
  await billingTriggerService.generateBillingOnDispatch(updatedOrder, updatedOrder.client, auth);

  return updatedOrder;
}

module.exports = {
  listMovements,
  listStocks,
  listLots,
  getLot,
  listInventoryAlerts,
  getInventoryAlert,
  updateInventoryAlertStatus,
  registerStockEntry,
  registerStockEntryInTransaction,
  createInitialInventory,
  updateLotQa,
  adjustStock,
  transferInventory,
  reserveStockForOrder,
  releaseStockReservation,
  dispatchOrder,
  deriveLotUsability,
  guatemalaDateKey,
  isLotExpired,
  lotDateKey,
};

