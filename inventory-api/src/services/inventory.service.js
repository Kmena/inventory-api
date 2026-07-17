const { randomUUID } = require('crypto');

const inventoryRepository = require('../repositories/inventory.repository');
const { createHttpError } = require('../lib/errors');
const { buildPaginatedResponse } = require('../lib/pagination');
const audit = require('../lib/audit');

const BUSINESS_TIME_ZONE = 'America/Guatemala';
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function guatemalaDateKey(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function toGuatemalaStartOfDay(dateKey) {
  return new Date(`${dateKey}T00:00:00-06:00`);
}

function defaultLotDateValue(defaultToNow) {
  return defaultToNow ? new Date() : null;
}

function dateKeyFromAcceptedLotInput(value, fieldLabel) {
  const normalized = String(value).trim();
  if (DATE_ONLY_PATTERN.test(normalized)) {
    return normalized;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw createHttpError(400, `La fecha de ${fieldLabel} no tiene un formato valido. Use YYYY-MM-DD o un datetime ISO.`, 'validation_error');
  }

  const calendarDatePrefix = normalized.slice(0, 10);
  if (DATE_ONLY_PATTERN.test(calendarDatePrefix)) {
    return calendarDatePrefix;
  }

  return guatemalaDateKey(parsed);
}

function normalizeLotDateInput(value, fieldLabel, options = {}) {
  const { defaultToNow = false, normalizeToStartOfDay = true } = options;
  if (value === undefined || value === null || value === '') {
    return defaultLotDateValue(defaultToNow);
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return defaultLotDateValue(defaultToNow);
  }

  const dateKey = dateKeyFromAcceptedLotInput(normalized, fieldLabel);
  if (!normalizeToStartOfDay) {
    return new Date(normalized);
  }

  return toGuatemalaStartOfDay(dateKey);
}

function lotDateKey(value) {
  if (!value) return '';
  if (DATE_ONLY_PATTERN.test(String(value))) return String(value);
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return guatemalaDateKey(parsed);
}

function isLotExpired(expirationDate, referenceDate = new Date()) {
  const expirationKey = lotDateKey(expirationDate);
  return Boolean(expirationKey && expirationKey <= guatemalaDateKey(referenceDate));
}

function deriveLotUsability(lot, referenceDate = new Date()) {
  const expired = isLotExpired(lot?.expirationDate ?? lot, referenceDate);
  const sellable = !expired && lot?.status === 'AVAILABLE' && lot?.qaStatus === 'APPROVED';
  return {
    expired,
    sellable,
    expirationDateKey: lotDateKey(lot?.expirationDate ?? lot),
  };
}

function validateLotDateRelationships({ entryDate, productionDate, expirationDate }) {
  const entryKey = lotDateKey(entryDate);
  const productionKey = lotDateKey(productionDate);
  const expirationKey = lotDateKey(expirationDate);

  if (productionKey && expirationKey && productionKey > expirationKey) {
    throw createHttpError(400, 'La fecha de produccion no puede ser posterior a la fecha de vencimiento.', 'validation_error');
  }
  if (entryKey && expirationKey && entryKey >= expirationKey) {
    throw createHttpError(400, 'La fecha de ingreso debe ser anterior a la fecha de vencimiento.', 'validation_error');
  }
  if (productionKey && entryKey && productionKey > entryKey) {
    throw createHttpError(400, 'La fecha de produccion no puede ser posterior a la fecha de ingreso.', 'validation_error');
  }
}

function normalizeLotDates(payload) {
  const productionDate = normalizeLotDateInput(payload.productionDate, 'produccion');
  const expirationDate = normalizeLotDateInput(payload.expirationDate, 'vencimiento');
  const entryDate = normalizeLotDateInput(payload.entryDate, 'ingreso', { defaultToNow: true });

  validateLotDateRelationships({ entryDate, productionDate, expirationDate });

  if (isLotExpired(expirationDate, entryDate)) {
    throw createHttpError(400, 'No se puede registrar un lote cuya fecha de vencimiento ya inicio.', 'validation_error');
  }

  return { productionDate, expirationDate, entryDate };
}

function authScope(auth) {
  if (!auth?.companyId || !auth?.sub) {
    throw createHttpError(403, 'Se requiere un usuario asociado a una empresa', 'forbidden');
  }
  return {
    companyId: BigInt(auth.companyId),
    userId: BigInt(auth.sub),
  };
}

function number(value) {
  return Number(value || 0);
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

async function getInventoryContext(tx, auth, warehouseId, productId, options = {}) {
  const { companyId, userId } = authScope(auth);
  const [inventory, warehouse, product] = await Promise.all([
    tx.inventory.findUnique({ where: { companyId } }),
    tx.warehouse.findFirst({ where: { id: warehouseId, companyId } }),
    tx.product.findFirst({ where: { id: productId, companyId } }),
  ]);

  if (!inventory) throw createHttpError(409, 'La empresa no tiene inventario configurado', 'conflict');
  if (!warehouse) throw createHttpError(404, 'Bodega no encontrada para la empresa', 'not_found');
  if (!warehouse.isActive) throw createHttpError(409, 'La bodega esta inactiva', 'conflict');
  if (options.requireSellable && (!warehouse.isSellableSource || warehouse.isVirtual)) {
    throw createHttpError(409, 'La bodega no esta habilitada como fuente de venta', 'conflict');
  }
  if (!product) throw createHttpError(404, 'Producto no encontrado para la empresa', 'not_found');

  return { companyId, userId, inventory, warehouse, product };
}

async function changeWarehouseStock(tx, context, quantityDelta = 0, reservedDelta = 0) {
  const key = {
    warehouseId_productId: {
      warehouseId: context.warehouse.id,
      productId: context.product.id,
    },
  };
  let current = await tx.warehouseStock.findUnique({ where: key });

  if (!current) {
    if (quantityDelta < 0 || reservedDelta !== 0) {
      throw createHttpError(409, 'No existe stock del producto en la bodega', 'conflict');
    }
    current = await tx.warehouseStock.create({
      data: {
        inventoryId: context.inventory.id,
        warehouseId: context.warehouse.id,
        productId: context.product.id,
        quantity: quantityDelta,
      },
    });
    return { before: 0, after: number(current.quantity), record: current };
  }

  const before = number(current.quantity);
  const reservedBefore = number(current.reservedQuantity);
  const where = { id: current.id };

  if (quantityDelta < 0 && reservedDelta === 0) {
    where.quantity = { gte: reservedBefore + Math.abs(quantityDelta) };
    where.reservedQuantity = current.reservedQuantity;
  } else if (reservedDelta > 0) {
    where.quantity = { gte: reservedBefore + reservedDelta };
    where.reservedQuantity = current.reservedQuantity;
  } else {
    if (quantityDelta < 0) where.quantity = { gte: Math.abs(quantityDelta) };
    if (reservedDelta < 0) where.reservedQuantity = { gte: Math.abs(reservedDelta) };
  }

  const updated = await tx.warehouseStock.updateMany({
    where,
    data: {
      ...(quantityDelta > 0 ? { quantity: { increment: quantityDelta } } : {}),
      ...(quantityDelta < 0 ? { quantity: { decrement: Math.abs(quantityDelta) } } : {}),
      ...(reservedDelta > 0 ? { reservedQuantity: { increment: reservedDelta } } : {}),
      ...(reservedDelta < 0 ? { reservedQuantity: { decrement: Math.abs(reservedDelta) } } : {}),
    },
  });

  if (updated.count !== 1) {
    throw createHttpError(409, 'El stock cambio durante la operacion o no es suficiente', 'conflict');
  }

  current = await tx.warehouseStock.findUnique({ where: { id: current.id } });
  return { before, after: number(current.quantity), record: current };
}

async function changeLotStock(tx, context, lot, quantityDelta = 0, reservedDelta = 0) {
  const key = {
    warehouseId_lotId: {
      warehouseId: context.warehouse.id,
      lotId: lot.id,
    },
  };
  let current = await tx.warehouseLotStock.findUnique({ where: key });

  if (!current) {
    if (quantityDelta <= 0 || reservedDelta !== 0) {
      throw createHttpError(409, 'El lote no tiene stock en la bodega', 'conflict');
    }
    current = await tx.warehouseLotStock.create({
      data: {
        warehouseId: context.warehouse.id,
        lotId: lot.id,
        productId: context.product.id,
        quantity: quantityDelta,
      },
    });
    return { before: 0, after: number(current.quantity), record: current };
  }

  if (current.productId !== context.product.id) {
    throw createHttpError(409, 'El lote no corresponde al producto', 'conflict');
  }

  const before = number(current.quantity);
  const reservedBefore = number(current.reservedQuantity);
  const where = { id: current.id };

  if (quantityDelta < 0 && reservedDelta === 0) {
    where.quantity = { gte: reservedBefore + Math.abs(quantityDelta) };
    where.reservedQuantity = current.reservedQuantity;
  } else if (reservedDelta > 0) {
    where.quantity = { gte: reservedBefore + reservedDelta };
    where.reservedQuantity = current.reservedQuantity;
  } else {
    if (quantityDelta < 0) where.quantity = { gte: Math.abs(quantityDelta) };
    if (reservedDelta < 0) where.reservedQuantity = { gte: Math.abs(reservedDelta) };
  }

  const updated = await tx.warehouseLotStock.updateMany({
    where,
    data: {
      ...(quantityDelta > 0 ? { quantity: { increment: quantityDelta } } : {}),
      ...(quantityDelta < 0 ? { quantity: { decrement: Math.abs(quantityDelta) } } : {}),
      ...(reservedDelta > 0 ? { reservedQuantity: { increment: reservedDelta } } : {}),
      ...(reservedDelta < 0 ? { reservedQuantity: { decrement: Math.abs(reservedDelta) } } : {}),
    },
  });

  if (updated.count !== 1) {
    throw createHttpError(409, 'El saldo del lote cambio o no es suficiente', 'conflict');
  }

  current = await tx.warehouseLotStock.findUnique({ where: { id: current.id } });
  return { before, after: number(current.quantity), record: current };
}

async function createMovement(tx, context, data) {
  return tx.stockMovement.create({
    data: {
      companyId: context.companyId,
      warehouseId: context.warehouse.id,
      productId: context.product.id,
      userId: context.userId,
      lotId: data.lotId ?? null,
      movementType: data.movementType,
      quantity: data.quantity,
      quantityBefore: data.quantityBefore,
      quantityAfter: data.quantityAfter,
      reasonCode: data.reasonCode,
      movementGroupId: data.movementGroupId ?? null,
      sourceType: data.sourceType ?? null,
      sourceId: data.sourceId ?? null,
      note: data.note ?? null,
    },
    include: { product: true, lot: true, warehouse: true },
  });
}

async function resolveUniqueInternalLotNumber(tx, companyId, requestedNumber) {
  let candidate = requestedNumber;
  let suffix = 0;

  while (await tx.lot.findFirst({
    where: {
      internalLotNumber: candidate,
      product: { companyId },
    },
    select: { id: true },
  })) {
    suffix += 1;
    if (suffix > 999) {
      throw createHttpError(409, 'No fue posible generar un numero de lote interno unico', 'conflict');
    }
    candidate = `${requestedNumber}-R${String(suffix).padStart(2, '0')}`;
  }

  return {
    requested: requestedNumber,
    assigned: candidate,
    collision: suffix > 0,
  };
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

function sortFefo(items) {
  return items.sort((left, right) => {
    const a = lotDateKey(left.lot?.expirationDate) || '9999-12-31';
    const b = lotDateKey(right.lot?.expirationDate) || '9999-12-31';
    return a.localeCompare(b) || Number(left.id - right.id);
  });
}

async function reserveLots(tx, context, quantity) {
  const rawCandidates = await tx.warehouseLotStock.findMany({
    where: {
      warehouseId: context.warehouse.id,
      productId: context.product.id,
      quantity: { gt: 0 },
      lot: {
        status: 'AVAILABLE',
        qaStatus: 'APPROVED',
      },
    },
    include: { lot: true },
  });
  const candidates = sortFefo(rawCandidates.filter((candidate) => deriveLotUsability(candidate.lot).sellable));

  let remaining = quantity;
  const allocations = [];

  for (const candidate of candidates) {
    if (remaining <= 0) break;
    const available = number(candidate.quantity) - number(candidate.reservedQuantity);
    const take = Math.min(available, remaining);
    if (take <= 0) continue;

    const changed = await changeLotStock(tx, context, candidate.lot, 0, take);
    allocations.push({ lot: candidate.lot, quantity: take, lotStock: changed.record });
    remaining -= take;
  }

  if (remaining > 0.000001) {
    throw createHttpError(409, `No hay lotes disponibles suficientes para ${context.product.name}`, 'conflict');
  }

  return allocations;
}

function assertOrderHasOperationalWarehouse(order) {
  if (order?.warehouseId) {
    return;
  }

  throw createHttpError(409, 'El pedido aun no tiene una bodega operativa asignada. Defina la bodega y el lote durante la salida antes de aprobar o despachar.', 'conflict');
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

async function getActiveAllocations(tx, order) {
  const movements = await tx.stockMovement.findMany({
    where: {
      companyId: order.companyId,
      warehouseId: order.warehouseId,
      sourceType: 'order',
      sourceId: order.id,
      movementType: { in: ['RESERVE', 'RELEASE', 'OUT'] },
    },
    orderBy: { id: 'asc' },
  });

  const balances = new Map();
  for (const movement of movements) {
    const key = `${movement.productId.toString()}:${movement.lotId?.toString() || 'none'}`;
    const signed = movement.movementType === 'RESERVE' ? number(movement.quantity) : -number(movement.quantity);
    const current = balances.get(key) || {
      productId: movement.productId,
      lotId: movement.lotId,
      quantity: 0,
    };
    current.quantity += signed;
    balances.set(key, current);
  }
  return [...balances.values()].filter((item) => item.quantity > 0.000001);
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

