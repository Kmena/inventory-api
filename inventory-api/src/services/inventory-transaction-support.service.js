const { createHttpError } = require('../lib/errors');
const { deriveLotUsability, lotDateKey } = require('./inventory-lot-policy.service');

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

module.exports = {
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
};
