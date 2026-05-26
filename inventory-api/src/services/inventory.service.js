const inventoryRepository = require('../repositories/inventory.repository');
const { createHttpError } = require('../lib/errors');

function toDateOrNull(value) {
  return value ? new Date(value) : null;
}

async function listMovements() {
  return inventoryRepository.findAllMovements();
}

async function registerStockEntry(payload) {
  return inventoryRepository.transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: payload.productId } });
    if (!product) throw createHttpError(404, 'Producto no encontrado', 'not_found');

    const updatedProduct = await tx.product.update({
      where: { id: payload.productId },
      data: {
        quantity: Number(product.quantity) + payload.quantity,
      },
    });

    let lot = null;
    if (payload.useLot) {
      lot = await tx.lot.create({
        data: {
          productId: payload.productId,
          supplierId: payload.supplierId ?? null,
          invoiceNumber: payload.invoiceNumber,
          lotNumber: payload.lotNumber,
          productionDate: toDateOrNull(payload.productionDate),
          expirationDate: toDateOrNull(payload.expirationDate),
          entryDate: toDateOrNull(payload.entryDate) || new Date(),
          quantity: payload.quantity,
          casNumber: payload.casNumber,
        },
      });
    }

    const movement = await tx.stockMovement.create({
      data: {
        productId: payload.productId,
        lotId: lot?.id ?? null,
        movementType: 'IN',
        quantity: payload.quantity,
        sourceType: payload.useLot ? 'lot_entry' : 'manual_entry',
        sourceId: lot?.id ?? null,
        note: payload.note ?? 'Entrada manual de inventario',
      },
      include: { product: true, lot: true },
    });

    return {
      product: updatedProduct,
      lot,
      movement,
    };
  });
}

async function adjustStock(payload) {
  return inventoryRepository.transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: payload.productId } });
    if (!product) throw createHttpError(404, 'Producto no encontrado', 'not_found');

    const currentQuantity = Number(product.quantity);
    const currentReserved = Number(product.reservedQuantity);
    const available = currentQuantity - currentReserved;

    if (payload.direction === 'OUT' && available < payload.quantity) {
      throw createHttpError(409, 'No hay stock disponible suficiente para el ajuste', 'conflict');
    }

    const nextQuantity = payload.direction === 'IN'
      ? currentQuantity + payload.quantity
      : currentQuantity - payload.quantity;

    const updatedProduct = await tx.product.update({
      where: { id: payload.productId },
      data: { quantity: nextQuantity },
    });

    let updatedLot = null;
    if (payload.lotId) {
      const lot = await tx.lot.findUnique({ where: { id: payload.lotId } });
      if (!lot) throw createHttpError(404, 'Lote no encontrado', 'not_found');
      const nextLotQuantity = payload.direction === 'IN'
        ? Number(lot.quantity) + payload.quantity
        : Number(lot.quantity) - payload.quantity;

      if (nextLotQuantity < 0) {
        throw createHttpError(409, 'El lote no tiene cantidad suficiente para el ajuste', 'conflict');
      }

      updatedLot = await tx.lot.update({
        where: { id: payload.lotId },
        data: { quantity: nextLotQuantity },
      });
    }

    const movement = await tx.stockMovement.create({
      data: {
        productId: payload.productId,
        lotId: payload.lotId ?? null,
        movementType: 'ADJUSTMENT',
        quantity: payload.quantity,
        sourceType: 'manual_adjustment',
        sourceId: payload.lotId ?? null,
        note: `${payload.direction}: ${payload.note}`,
      },
      include: { product: true, lot: true },
    });

    return {
      product: updatedProduct,
      lot: updatedLot,
      movement,
    };
  });
}

async function reserveStockForOrder(orderId, approvedById = null) {
  return inventoryRepository.transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) throw createHttpError(404, 'Pedido no encontrado', 'not_found');
    if (order.status === 'APPROVED' || order.approved) {
      throw createHttpError(409, 'El pedido ya fue aprobado', 'conflict');
    }
    if (order.status === 'CANCELLED' || order.status === 'DELIVERED') {
      throw createHttpError(409, 'El pedido no se puede aprobar en su estado actual', 'conflict');
    }

    for (const item of order.items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) throw createHttpError(404, 'Producto no encontrado en el pedido', 'not_found');

      const available = Number(product.quantity) - Number(product.reservedQuantity);
      if (available < Number(item.quantity)) {
        throw createHttpError(409, `Stock insuficiente para ${product.name}`, 'conflict');
      }
    }

    for (const item of order.items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      await tx.product.update({
        where: { id: item.productId },
        data: {
          reservedQuantity: Number(product.reservedQuantity) + Number(item.quantity),
        },
      });

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          movementType: 'RESERVE',
          quantity: item.quantity,
          sourceType: 'order',
          sourceId: order.id,
          note: `Reserva por aprobación de pedido ${order.id.toString()}`,
        },
      });
    }

    return tx.order.update({
      where: { id: orderId },
      data: {
        approved: true,
        approvedAt: new Date(),
        approvedById,
        status: 'APPROVED',
      },
      include: { client: true, user: true, approvedBy: true, items: { include: { product: true } } },
    });
  });
}

async function releaseStockReservation(orderId, cancel = false) {
  return inventoryRepository.transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) throw createHttpError(404, 'Pedido no encontrado', 'not_found');
    if (!order.approved || order.status !== 'APPROVED') {
      throw createHttpError(409, 'El pedido no tiene reservas activas para liberar', 'conflict');
    }

    for (const item of order.items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) throw createHttpError(404, 'Producto no encontrado en el pedido', 'not_found');

      const nextReserved = Number(product.reservedQuantity) - Number(item.quantity);
      await tx.product.update({
        where: { id: item.productId },
        data: {
          reservedQuantity: nextReserved < 0 ? 0 : nextReserved,
        },
      });

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          movementType: 'RELEASE',
          quantity: item.quantity,
          sourceType: 'order',
          sourceId: order.id,
          note: cancel
            ? `Liberación por cancelación de pedido ${order.id.toString()}`
            : `Liberación de reserva de pedido ${order.id.toString()}`,
        },
      });
    }

    const nextStatus = cancel ? 'CANCELLED' : 'DRAFT';
    return tx.order.update({
      where: { id: orderId },
      data: {
        approved: false,
        approvedAt: null,
        approvedById: null,
        status: nextStatus,
      },
      include: { client: true, user: true, approvedBy: true, items: { include: { product: true } } },
    });
  });
}

async function dispatchOrder(orderId) {
  return inventoryRepository.transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) throw createHttpError(404, 'Pedido no encontrado', 'not_found');
    if (!order.approved || order.status !== 'APPROVED') {
      throw createHttpError(409, 'El pedido debe estar aprobado antes de despacharse', 'conflict');
    }

    for (const item of order.items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) throw createHttpError(404, 'Producto no encontrado en el pedido', 'not_found');
      if (Number(product.quantity) < Number(item.quantity)) {
        throw createHttpError(409, `Stock insuficiente para despachar ${product.name}`, 'conflict');
      }
    }

    for (const item of order.items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      const nextQuantity = Number(product.quantity) - Number(item.quantity);
      const nextReserved = Number(product.reservedQuantity) - Number(item.quantity);

      await tx.product.update({
        where: { id: item.productId },
        data: {
          quantity: nextQuantity,
          reservedQuantity: nextReserved < 0 ? 0 : nextReserved,
        },
      });

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          movementType: 'OUT',
          quantity: item.quantity,
          sourceType: 'order_dispatch',
          sourceId: order.id,
          note: `Despacho de pedido ${order.id.toString()}`,
        },
      });
    }

    return tx.order.update({
      where: { id: orderId },
      data: {
        status: 'DELIVERED',
      },
      include: { client: true, user: true, approvedBy: true, items: { include: { product: true } } },
    });
  });
}

module.exports = {
  listMovements,
  registerStockEntry,
  adjustStock,
  reserveStockForOrder,
  releaseStockReservation,
  dispatchOrder,
};
