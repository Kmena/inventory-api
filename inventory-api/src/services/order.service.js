const orderRepository = require('../repositories/order.repository');
const inventoryService = require('./inventory.service');
const { createHttpError } = require('../lib/errors');

function toOrderItemsCreate(items) {
  return items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice ?? 0,
    discountPercent: item.discountPercent ?? 0,
    discountAmount: item.discountAmount ?? 0,
    totalDiscount: item.totalDiscount ?? 0,
    approved: item.approved ?? false,
  }));
}

function assertEditableStatus(payload) {
  const forbiddenStatuses = ['APPROVED', 'DELIVERED', 'CANCELLED'];
  if (payload.status && forbiddenStatuses.includes(payload.status)) {
    throw createHttpError(
      409,
      'Use los endpoints dedicados para aprobar, cancelar o despachar pedidos',
      'conflict'
    );
  }
}

function toOrderCreateData(payload) {
  const { items, status, approved, approvedAt, approvedById, ...rest } = payload;
  return {
    ...rest,
    status: 'DRAFT',
    approved: false,
    approvedAt: null,
    approvedById: null,
    items: {
      create: toOrderItemsCreate(items),
    },
  };
}

async function listOrders() {
  return orderRepository.findAllOrders();
}

async function getOrder(id) {
  const order = await orderRepository.findOrderById(id);
  if (!order) throw createHttpError(404, 'Pedido no encontrado', 'not_found');
  return order;
}

async function createOrder(payload) {
  return orderRepository.createOrder(toOrderCreateData(payload));
}

async function updateOrder(id, payload) {
  const currentOrder = await getOrder(id);
  if (currentOrder.status !== 'DRAFT') {
    throw createHttpError(409, 'Solo se pueden editar pedidos en borrador', 'conflict');
  }

  assertEditableStatus(payload);

  const data = { ...payload };
  delete data.approved;
  delete data.approvedAt;
  delete data.approvedById;

  if (payload.items) {
    data.items = {
      deleteMany: {},
      create: toOrderItemsCreate(payload.items),
    };
  }

  return orderRepository.updateOrder(id, data);
}

async function approveOrder(id, approvedById) {
  await getOrder(id);
  return inventoryService.reserveStockForOrder(id, approvedById);
}

async function cancelOrder(id) {
  const order = await getOrder(id);
  if (order.status === 'DELIVERED') {
    throw createHttpError(409, 'No se puede cancelar un pedido ya despachado', 'conflict');
  }
  if (order.status === 'CANCELLED') {
    throw createHttpError(409, 'El pedido ya está cancelado', 'conflict');
  }
  if (order.status === 'APPROVED') {
    return inventoryService.releaseStockReservation(id, true);
  }
  return orderRepository.updateOrder(id, { status: 'CANCELLED' });
}

async function dispatchOrder(id) {
  await getOrder(id);
  return inventoryService.dispatchOrder(id);
}

async function removeOrder(id) {
  const order = await getOrder(id);
  if (order.status === 'APPROVED') {
    throw createHttpError(409, 'Cancele el pedido antes de eliminarlo para liberar reservas', 'conflict');
  }
  if (order.status === 'DELIVERED') {
    throw createHttpError(409, 'No se puede eliminar un pedido ya despachado', 'conflict');
  }
  return orderRepository.deleteOrder(id);
}

module.exports = {
  listOrders,
  getOrder,
  createOrder,
  updateOrder,
  approveOrder,
  cancelOrder,
  dispatchOrder,
  removeOrder,
};
