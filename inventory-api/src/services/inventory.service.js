const { randomUUID } = require('crypto');

const inventoryRepository = require('../repositories/inventory.repository');
const { createHttpError } = require('../lib/errors');
const { buildPaginatedResponse } = require('../lib/pagination');
const audit = require('../lib/audit');
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
  assertOrderHasOperationalWarehouse,
  getActiveAllocations,
} = require('./inventory-transaction-support.service');

const INVENTORY_ALERT_READ_PERMISSIONS = ['inventory.view', 'inventory.manage', 'inventory.qa.manage'];
const INVENTORY_ALERT_UPDATE_PERMISSIONS = ['inventory.manage', 'inventory.qa.manage'];

function hasAnyPermission(auth, permissions) {
  const userPermissions = auth?.permissions || [];
  return permissions.some((permission) => userPermissions.includes(permission));
}

function assertHasInventoryAlertPermission(auth, permissions, message) {
  if (!hasAnyPermission(auth, permissions)) {
    throw createHttpError(403, message, 'forbidden');
  }
}

function serializeInventoryAlert(alert) {
  return {
    id: alert.id,
    alertType: alert.alertType,
    severity: alert.severity,
    status: alert.status,
    message: alert.message,
    metadata: alert.metadata || null,
    createdAt: alert.createdAt,
    resolvedAt: alert.resolvedAt,
    product: alert.product || null,
    lot: alert.lot || null,
    warehouse: alert.warehouse || null,
    availableActions: alert.status === 'OPEN'
      ? ['ACKNOWLEDGED', 'RESOLVED']
      : alert.status === 'ACKNOWLEDGED'
        ? ['RESOLVED']
        : [],
  };
}

function mergeInventoryAlertMetadata(existingMetadata, statusTransition) {
  const baseMetadata = existingMetadata && typeof existingMetadata === 'object' && !Array.isArray(existingMetadata)
    ? existingMetadata
    : {};
  const statusHistory = Array.isArray(baseMetadata.statusHistory) ? [...baseMetadata.statusHistory] : [];
  statusHistory.push(statusTransition);

  return {
    ...baseMetadata,
    lastStatusChange: statusTransition,
    statusHistory,
  };
}

function assertInventoryAlertTransition(currentStatus, targetStatus) {
  const allowedTransitions = {
    OPEN: ['ACKNOWLEDGED', 'RESOLVED'],
    ACKNOWLEDGED: ['RESOLVED'],
    RESOLVED: [],
  };

  if (!allowedTransitions[currentStatus]?.includes(targetStatus)) {
    throw createHttpError(409, 'La alerta no permite la transicion solicitada', 'conflict');
  }
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

async function listStocks(auth, filters = {}) {
  const { companyId } = authScope(auth);
  const [items, lots] = await Promise.all([
    inventoryRepository.findWarehouseStocks(companyId, filters),
    inventoryRepository.findWarehouseLotStocks(companyId, filters),
  ]);
  return { items, lots };
}

async function listInventoryAlerts(auth, filters = {}, pagination = null) {
  const { companyId } = authScope(auth);
  assertHasInventoryAlertPermission(auth, INVENTORY_ALERT_READ_PERMISSIONS, 'No tiene permisos para revisar alertas de inventario');

  const alerts = await inventoryRepository.findInventoryAlerts(companyId, filters, pagination);
  if (Array.isArray(alerts)) {
    return alerts.map(serializeInventoryAlert);
  }

  return buildPaginatedResponse(
    alerts.items.map(serializeInventoryAlert),
    pagination,
    alerts.totalItems,
  );
}

async function getInventoryAlert(alertId, auth) {
  const { companyId } = authScope(auth);
  assertHasInventoryAlertPermission(auth, INVENTORY_ALERT_READ_PERMISSIONS, 'No tiene permisos para revisar alertas de inventario');

  const alert = await inventoryRepository.findInventoryAlertById(alertId, companyId);
  if (!alert) {
    throw createHttpError(404, 'Alerta de inventario no encontrada para la empresa', 'not_found');
  }

  return serializeInventoryAlert(alert);
}

async function updateInventoryAlertStatus(alertId, payload, auth, req = null) {
  const { companyId, userId } = authScope(auth);
  assertHasInventoryAlertPermission(auth, INVENTORY_ALERT_UPDATE_PERMISSIONS, 'No tiene permisos para gestionar alertas de inventario');

  const existingAlert = await inventoryRepository.findInventoryAlertById(alertId, companyId);
  if (!existingAlert) {
    throw createHttpError(404, 'Alerta de inventario no encontrada para la empresa', 'not_found');
  }

  assertInventoryAlertTransition(existingAlert.status, payload.status);

  const changedAt = new Date();
  const statusTransition = {
    fromStatus: existingAlert.status,
    toStatus: payload.status,
    changedAt: changedAt.toISOString(),
    changedByUserId: userId.toString(),
    note: payload.note || null,
  };

  const updatedAlert = await inventoryRepository.updateInventoryAlert(alertId, companyId, {
    status: payload.status,
    resolvedAt: payload.status === 'RESOLVED' ? changedAt : existingAlert.resolvedAt,
    metadata: mergeInventoryAlertMetadata(existingAlert.metadata, statusTransition),
  });

  if (!updatedAlert) {
    throw createHttpError(409, 'La alerta no pudo actualizarse', 'conflict');
  }

  await audit.recordAuditEventIfAvailable({
    req,
    action: 'inventory.alert.status.update',
    resourceType: 'inventory_alert',
    resourceId: alertId,
    outcome: 'SUCCESS',
    beforeState: {
      id: existingAlert.id,
      status: existingAlert.status,
      resolvedAt: existingAlert.resolvedAt,
    },
    afterState: {
      id: updatedAlert.id,
      status: updatedAlert.status,
      resolvedAt: updatedAlert.resolvedAt,
    },
    metadata: {
      note: payload.note || null,
      fromStatus: existingAlert.status,
      toStatus: payload.status,
    },
  });

  return serializeInventoryAlert(updatedAlert);
}


async function registerStockEntryInTransaction(tx, payload, auth) {
  const context = await getInventoryContext(tx, auth, payload.warehouseId, payload.productId);
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock($1)', context.companyId);
  const requestedInternalLotNumber = payload.internalLotNumber || payload.lotNumber;

  if (!requestedInternalLotNumber) {
    throw createHttpError(400, 'Toda existencia requiere numero de lote interno', 'validation_error');
  }

  const lotNumberResolution = await resolveUniqueInternalLotNumber(
    tx,
    context.companyId,
    requestedInternalLotNumber,
  );
  const internalLotNumber = lotNumberResolution.assigned;
  const isQuarantineEntry = context.warehouse.warehouseType === 'QUARANTINE';
  const lotStatus = isQuarantineEntry ? 'QUARANTINED' : 'AVAILABLE';
  const qaStatus = isQuarantineEntry ? 'PENDING' : 'APPROVED';
  const normalizedDates = normalizeLotDates(payload);

  const lot = await tx.lot.create({
    data: {
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
    },
  });

  const lotStock = await changeLotStock(tx, context, lot, payload.quantity, 0);
  const warehouseStock = await changeWarehouseStock(tx, context, payload.quantity, 0);
  const product = await tx.product.update({
    where: { id: context.product.id },
    data: { quantity: { increment: payload.quantity } },
  });
  const movement = await createMovement(tx, context, {
    lotId: lot.id,
    movementType: 'IN',
    quantity: payload.quantity,
    quantityBefore: warehouseStock.before,
    quantityAfter: warehouseStock.after,
    reasonCode: payload.reasonCode,
    sourceType: 'lot_entry',
    sourceId: lot.id,
    note: lotNumberResolution.collision
      ? `${payload.note ?? 'Entrada manual de inventario'} | Lote solicitado ${lotNumberResolution.requested}; asignado ${lotNumberResolution.assigned}`
      : payload.note ?? 'Entrada manual de inventario',
  });

  if (lotNumberResolution.collision) {
    await tx.inventoryAlert.create({
      data: {
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
      },
    });
  }

  return {
    product,
    warehouseStock: warehouseStock.record,
    lot,
    lotStock: lotStock.record,
    movement,
    lotNumberCollision: lotNumberResolution.collision ? lotNumberResolution : null,
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
    const lot = await tx.lot.findFirst({
      where: { id: lotId, companyId },
      include: {
        warehouseLotStocks: {
          where: { quantity: { gt: 0 } },
          include: { warehouse: true },
        },
      },
    });
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

    const updatedLot = await tx.lot.update({
      where: { id: lot.id },
      data: { status: newStatus, qaStatus: newQaStatus },
      include: { warehouseLotStocks: { include: { warehouse: true } } },
    });

    await tx.lotStatusHistory.create({
      data: {
        companyId,
        lotId: lot.id,
        userId,
        action: payload.action,
        previousStatus: lot.status,
        newStatus,
        previousQaStatus: lot.qaStatus,
        newQaStatus,
        reason: payload.reason,
      },
    });

    const warehouseId = lot.warehouseLotStocks[0]?.warehouseId ?? null;
    if (['REJECT', 'FAIL', 'BLOCK'].includes(payload.action)) {
      await tx.inventoryAlert.create({
        data: {
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
        },
      });
    } else {
      await tx.inventoryAlert.updateMany({
        where: {
          companyId,
          lotId: lot.id,
          status: 'OPEN',
          alertType: { in: ['QA_FAILURE', 'LOT_BLOCKED'] },
        },
        data: { status: 'RESOLVED', resolvedAt: new Date() },
      });
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

async function adjustStock(payload, auth, req = null) {
  const result = /** @type {any} */ (await inventoryRepository.transaction(async (tx) => {
    const context = await getInventoryContext(tx, auth, payload.warehouseId, payload.productId);
    if (!payload.lotId) {
      throw createHttpError(400, 'Todo ajuste de inventario requiere lote', 'validation_error');
    }

    let lot = null;
    if (payload.lotId) {
      lot = await tx.lot.findFirst({
        where: { id: payload.lotId, productId: context.product.id },
      });
      if (!lot) throw createHttpError(404, 'Lote no encontrado para el producto', 'not_found');
    }

    const quantityDelta = payload.direction === 'IN' ? payload.quantity : -payload.quantity;
    const warehouseStock = await changeWarehouseStock(tx, context, quantityDelta, 0);
    const lotStock = lot ? await changeLotStock(tx, context, lot, quantityDelta, 0) : null;

    const product = await tx.product.update({
      where: { id: context.product.id },
      data: payload.direction === 'IN'
        ? { quantity: { increment: payload.quantity } }
        : { quantity: { decrement: payload.quantity } },
    });

    if (lot) {
      lot = await tx.lot.update({
        where: { id: lot.id },
        data: payload.direction === 'IN'
          ? { quantity: { increment: payload.quantity } }
          : { quantity: { decrement: payload.quantity } },
      });
    }

    const movement = await createMovement(tx, context, {
      lotId: lot?.id,
      movementType: 'ADJUSTMENT',
      quantity: payload.quantity,
      quantityBefore: warehouseStock.before,
      quantityAfter: warehouseStock.after,
      reasonCode: payload.reasonCode,
      sourceType: 'manual_adjustment',
      sourceId: lot?.id,
      note: `${payload.direction}: ${payload.note}`,
    });

    return { product, warehouseStock: warehouseStock.record, lotStock: lotStock?.record ?? null, lot, movement };
  }));

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


async function reserveStockForOrder(orderId, auth, req = null) {
  const updatedOrder = /** @type {any} */ (await inventoryRepository.transaction(async (tx) => {
    const scope = authScope(auth);
    const order = await tx.order.findFirst({
      where: { id: orderId, companyId: scope.companyId },
      include: { items: true, warehouse: true },
    });

    if (!order) throw createHttpError(404, 'Pedido no encontrado', 'not_found');
    if (order.status === 'APPROVED' || order.approved) {
      throw createHttpError(409, 'El pedido ya fue aprobado', 'conflict');
    }
    if (order.status === 'CANCELLED' || order.status === 'DELIVERED') {
      throw createHttpError(409, 'El pedido no se puede aprobar en su estado actual', 'conflict');
    }

    assertOrderHasOperationalWarehouse(order);

    const movementGroupId = randomUUID();

    for (const item of order.items) {
      const context = await getInventoryContext(tx, auth, order.warehouseId, item.productId, { requireSellable: true });
      const quantity = number(item.quantity);
      const stock = await changeWarehouseStock(tx, context, 0, quantity);
      let allocations = [{ lot: null, quantity }];

      if (context.product.lotStrategy !== 'NONE') {
        allocations = await reserveLots(tx, context, quantity);
      }

      await tx.product.update({
        where: { id: context.product.id },
        data: { reservedQuantity: { increment: quantity } },
      });

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

    return tx.order.update({
      where: { id: orderId },
      data: {
        approved: true,
        approvedAt: new Date(),
        approvedById: scope.userId,
        status: 'APPROVED',
      },
      include: { client: true, user: true, approvedBy: true, warehouse: true, items: { include: { product: true } } },
    });
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

  return updatedOrder;
}


async function releaseStockReservation(orderId, cancel, auth, req = null) {
  const updatedOrder = /** @type {any} */ (await inventoryRepository.transaction(async (tx) => {
    const scope = authScope(auth);
    const order = await tx.order.findFirst({
      where: { id: orderId, companyId: scope.companyId },
      include: { items: true },
    });

    if (!order) throw createHttpError(404, 'Pedido no encontrado', 'not_found');
    if (!order.approved || order.status !== 'APPROVED') {
      throw createHttpError(409, 'El pedido no tiene reservas activas para liberar', 'conflict');
    }

    assertOrderHasOperationalWarehouse(order);

    const allocations = await getActiveAllocations(tx, order);
    const movementGroupId = randomUUID();

    for (const item of order.items) {
      const context = await getInventoryContext(tx, auth, order.warehouseId, item.productId);
      const itemAllocations = allocations.filter((allocation) => allocation.productId === item.productId);
      const reserved = itemAllocations.reduce((sum, allocation) => sum + allocation.quantity, 0);
      if (Math.abs(reserved - number(item.quantity)) > 0.000001) {
        throw createHttpError(409, 'La reserva del pedido no coincide con sus lineas', 'conflict');
      }

      const stock = await changeWarehouseStock(tx, context, 0, -reserved);
      await tx.product.update({
        where: { id: context.product.id },
        data: { reservedQuantity: { decrement: reserved } },
      });

      for (const allocation of itemAllocations) {
        let lot = null;
        if (allocation.lotId) {
          lot = await tx.lot.findUnique({ where: { id: allocation.lotId } });
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

    return tx.order.update({
      where: { id: orderId },
      data: {
        approved: false,
        approvedAt: null,
        approvedById: null,
        status: cancel ? 'CANCELLED' : 'DRAFT',
      },
      include: { client: true, user: true, approvedBy: true, warehouse: true, items: { include: { product: true } } },
    });
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

async function dispatchOrder(orderId, auth, req = null) {
  const updatedOrder = /** @type {any} */ (await inventoryRepository.transaction(async (tx) => {
    const scope = authScope(auth);
    const order = await tx.order.findFirst({
      where: { id: orderId, companyId: scope.companyId },
      include: { items: true },
    });

    if (!order) throw createHttpError(404, 'Pedido no encontrado', 'not_found');
    if (!order.approved || order.status !== 'APPROVED') {
      throw createHttpError(409, 'El pedido debe estar aprobado antes de despacharse', 'conflict');
    }

    assertOrderHasOperationalWarehouse(order);

    const allocations = await getActiveAllocations(tx, order);
    const movementGroupId = randomUUID();

    for (const item of order.items) {
      const context = await getInventoryContext(tx, auth, order.warehouseId, item.productId, { requireSellable: true });
      const itemAllocations = allocations.filter((allocation) => allocation.productId === item.productId);
      const reserved = itemAllocations.reduce((sum, allocation) => sum + allocation.quantity, 0);
      const quantity = number(item.quantity);

      if (Math.abs(reserved - quantity) > 0.000001) {
        throw createHttpError(409, 'La reserva del pedido no coincide con sus lineas', 'conflict');
      }

      const stock = await changeWarehouseStock(tx, context, -quantity, -quantity);
      await tx.product.update({
        where: { id: context.product.id },
        data: {
          quantity: { decrement: quantity },
          reservedQuantity: { decrement: quantity },
        },
      });

      for (const allocation of itemAllocations) {
        let lot = null;
        if (allocation.lotId) {
          lot = await tx.lot.findUnique({ where: { id: allocation.lotId } });
          await changeLotStock(tx, context, lot, -allocation.quantity, -allocation.quantity);
          await tx.lot.update({
            where: { id: lot.id },
            data: { quantity: { decrement: allocation.quantity } },
          });
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

    return tx.order.update({
      where: { id: orderId },
      data: { status: 'DELIVERED' },
      include: { client: true, user: true, approvedBy: true, warehouse: true, items: { include: { product: true } } },
    });
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

  return updatedOrder;
}

module.exports = {
  listMovements,
  listStocks,
  listInventoryAlerts,
  getInventoryAlert,
  updateInventoryAlertStatus,
  registerStockEntry,
  registerStockEntryInTransaction,
  updateLotQa,
  adjustStock,
  reserveStockForOrder,
  releaseStockReservation,
  dispatchOrder,
  deriveLotUsability,
  guatemalaDateKey,
  isLotExpired,
  lotDateKey,
};

