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
  assertOrderHasOperationalWarehouse,
  getActiveAllocations,
} = require('./inventory-transaction-support.service');
const billingTriggerService = require('./billing-trigger.service');
const { calculateInvoiceAmount } = require('./billing-trigger.service');

async function acquireCompanyInventoryAdvisoryLock(tx, companyId) {
  await inventoryRepository.acquireCompanyInventoryAdvisoryLock(companyId, tx);
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

async function registerStockEntryInTransaction(tx, payload, auth) {
  const context = await getInventoryContext(tx, auth, payload.warehouseId, payload.productId);
  await acquireCompanyInventoryAdvisoryLock(tx, context.companyId);
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

  const lot = await inventoryRepository.createLot({
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

  const lotStock = await changeLotStock(tx, context, lot, payload.quantity, 0);
  const warehouseStock = await changeWarehouseStock(tx, context, payload.quantity, 0);
  const product = await inventoryRepository.updateProductById(
    context.product.id,
    context.companyId,
    { quantity: { increment: payload.quantity } },
    tx,
  );
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

async function adjustStock(payload, auth, req = null) {
  const result = /** @type {any} */ (await inventoryRepository.transaction(async (tx) => {
    const context = await getInventoryContext(tx, auth, payload.warehouseId, payload.productId);
    if (!payload.lotId) {
      throw createHttpError(400, 'Todo ajuste de inventario requiere lote', 'validation_error');
    }

    let lot = null;
    if (payload.lotId) {
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
    const order = /** @type {any} */ (await inventoryRepository.findOrderForCompany(
      orderId,
      scope.companyId,
      { items: true, warehouse: true },
      tx,
    ));

    if (!order) throw createHttpError(404, 'Pedido no encontrado', 'not_found');
    if (order.status === 'APPROVED' || order.approved) {
      throw createHttpError(409, 'El pedido ya fue aprobado', 'conflict');
    }
    if (order.status === 'CANCELLED' || order.status === 'DELIVERED') {
      throw createHttpError(409, 'El pedido no se puede aprobar en su estado actual', 'conflict');
    }

    // Auto-assign sellable warehouse when the order was created without one (e.g. agent orders)
    if (!order.warehouseId) {
      const sellableWarehouse = await inventoryRepository.findFirstSellableWarehouse(scope.companyId, tx);
      if (!sellableWarehouse) {
        throw createHttpError(409, 'No hay bodegas vendibles activas para asignar al pedido. Cree o active una bodega como fuente vendible.', 'conflict');
      }
      order.warehouseId = sellableWarehouse.id;
      order.warehouse = sellableWarehouse;
      await inventoryRepository.updateOrderById(order.id, { warehouseId: sellableWarehouse.id }, {}, tx);
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

    // Increment client creditBalance for ALL orders on approval (CASH, TRANSFER, CREDIT).
    // creditBalance tracks the client's outstanding financial obligation regardless of payment condition.
    // Uses shared calculateInvoiceAmount for formula consistency (includes Math.max(0) clamp).
    const orderAmount = calculateInvoiceAmount(order.items);
    if (order.clientId && orderAmount > 0) {
      await tx.client.update({
        where: { id: order.clientId },
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
      { items: true },
      tx,
    ));

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

    // Reverse creditBalance increment when an approved order is cancelled.
    // Mirrors the increment in reserveStockForOrder; uses the same shared formula.
    if (cancel && order.clientId) {
      const orderAmount = calculateInvoiceAmount(order.items);
      if (orderAmount > 0) {
        await tx.client.update({
          where: { id: order.clientId },
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

async function dispatchOrder(orderId, auth, req = null) {
  const updatedOrder = /** @type {any} */ (await inventoryRepository.transaction(async (tx) => {
    const scope = authScope(auth);
    const order = /** @type {any} */ (await inventoryRepository.findOrderForCompany(
      orderId,
      scope.companyId,
      { items: true },
      tx,
    ));

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
      await inventoryRepository.updateProductById(
        context.product.id,
        context.companyId,
        {
          quantity: { decrement: quantity },
          reservedQuantity: { decrement: quantity },
        },
        tx,
      );

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

    return inventoryRepository.updateOrderById(
      orderId,
      { status: 'DELIVERED' },
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

