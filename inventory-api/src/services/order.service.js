const orderRepository = require('../repositories/order.repository');
const inventoryService = require('./inventory.service');
const { createHttpError } = require('../lib/errors');
const { buildPaginatedResponse } = require('../lib/pagination');
const audit = require('../lib/audit');
const { assertLifecycleStatusAllowed } = require('./approval-baseline.service');
const {
  scope,
  validateOrderScope,
  assertDraftEditAccess,
  assertEditableStatus,
  validateOrderReferences,
  toOrderCreateData,
  toOrderItemsCreate,
} = require('./order-access-policy.service');

async function listOrders(auth, pagination = null) {
  const { companyId } = scope(auth);
  const orders = await orderRepository.findAllOrders(companyId, pagination);
  if (!pagination) {
    return orders;
  }

  const paginatedOrders = /** @type {{ items: Array<any>, totalItems: number }} */ (orders);
  return buildPaginatedResponse(paginatedOrders.items, pagination, paginatedOrders.totalItems);
}

async function getOrder(id, auth) {
  const { companyId } = scope(auth);
  const order = await orderRepository.findOrderById(id, companyId);
  if (!order) throw createHttpError(404, 'Pedido no encontrado', 'not_found');
  return order;
}

async function createOrder(payload, auth, req = null) {
  const authScope = scope(auth);
  await validateOrderScope(payload, authScope, auth);
  await validateOrderReferences(payload, authScope.companyId);
  const order = await orderRepository.createOrder(toOrderCreateData(payload, authScope));
  await audit.recordAuditEventIfAvailable({
    req,
    action: 'orders.create',
    resourceType: 'order',
    resourceId: order.id,
    outcome: 'SUCCESS',
    afterState: {
      id: order.id,
      clientId: order.clientId,
      clientStoreId: order.clientStoreId,
      warehouseId: order.warehouseId,
      status: order.status,
      approved: order.approved,
      itemsCount: order.items?.length || 0,
    },
  });
  return order;
}

async function updateOrder(id, payload, auth, req = null) {
  const authScope = scope(auth);
  const currentOrder = await getOrder(id, auth);
  assertDraftEditAccess(currentOrder, authScope, auth);
  if (currentOrder.status !== 'DRAFT') {
    throw createHttpError(409, 'Solo se pueden editar pedidos en borrador', 'conflict');
  }

  assertEditableStatus(payload);

  const hasWarehouseId = Object.prototype.hasOwnProperty.call(payload, 'warehouseId');
  const effectivePayload = {
    clientId: payload.clientId ?? currentOrder.clientId,
    clientStoreId: payload.clientStoreId ?? currentOrder.clientStoreId,
    warehouseId: hasWarehouseId ? payload.warehouseId : currentOrder.warehouseId,
    items: payload.items ?? currentOrder.items,
  };

  await validateOrderScope(effectivePayload, authScope, auth);
  await validateOrderReferences(effectivePayload, authScope.companyId);

  const data = { ...payload };
  delete data.companyId;
  delete data.userId;
  delete data.approved;
  delete data.approvedAt;
  delete data.approvedById;

  if (payload.items) {
    data.items = { deleteMany: {}, create: toOrderItemsCreate(payload.items) };
  }

  const updatedOrder = await orderRepository.updateOrder(id, authScope.companyId, data);
  if (!updatedOrder) {
    throw createHttpError(404, 'Pedido no encontrado', 'not_found');
  }
  await audit.recordAuditEventIfAvailable({
    req,
    action: 'orders.update',
    resourceType: 'order',
    resourceId: id,
    outcome: 'SUCCESS',
    beforeState: {
      id: currentOrder.id,
      clientId: currentOrder.clientId,
      clientStoreId: currentOrder.clientStoreId,
      warehouseId: currentOrder.warehouseId,
      status: currentOrder.status,
      approved: currentOrder.approved,
      itemsCount: currentOrder.items?.length || 0,
    },
    afterState: {
      id: updatedOrder.id,
      clientId: updatedOrder.clientId,
      clientStoreId: updatedOrder.clientStoreId,
      warehouseId: updatedOrder.warehouseId,
      status: updatedOrder.status,
      approved: updatedOrder.approved,
      itemsCount: updatedOrder.items?.length || 0,
    },
  });
  return updatedOrder;
}

async function approveOrder(id, auth, req = null) {
  const order = await getOrder(id, auth);
  assertLifecycleStatusAllowed(order.status, ['DRAFT'], 'Solo se pueden aprobar pedidos en borrador');
  return inventoryService.reserveStockForOrder(id, auth, req);
}

async function cancelOrder(id, auth, req = null) {
  const order = await getOrder(id, auth);
  if (order.status === 'DELIVERED') {
    throw createHttpError(409, 'No se puede cancelar un pedido ya despachado', 'conflict');
  }
  if (order.status === 'CANCELLED') {
    throw createHttpError(409, 'El pedido ya esta cancelado', 'conflict');
  }
  if (order.status === 'APPROVED') {
    return inventoryService.releaseStockReservation(id, true, auth, req);
  }
  const { companyId } = scope(auth);
  const cancelledOrder = await orderRepository.updateOrder(id, companyId, { status: 'CANCELLED' });
  if (!cancelledOrder) {
    throw createHttpError(404, 'Pedido no encontrado', 'not_found');
  }
  await audit.recordAuditEventIfAvailable({
    req,
    action: 'orders.cancel',
    resourceType: 'order',
    resourceId: id,
    outcome: 'SUCCESS',
    beforeState: {
      id: order.id,
      status: order.status,
      approved: order.approved,
    },
    afterState: {
      id: cancelledOrder.id,
      status: cancelledOrder.status,
      approved: cancelledOrder.approved,
    },
  });
  return cancelledOrder;
}

async function dispatchOrder(id, auth, req = null) {
  await getOrder(id, auth);
  return inventoryService.dispatchOrder(id, auth, req);
}

async function removeOrder(id, auth, req = null) {
  const order = await getOrder(id, auth);
  if (order.status === 'APPROVED') {
    throw createHttpError(409, 'Cancele el pedido antes de eliminarlo para liberar reservas', 'conflict');
  }
  if (order.status === 'DELIVERED') {
    throw createHttpError(409, 'No se puede eliminar un pedido ya despachado', 'conflict');
  }
  const { companyId } = scope(auth);
  const deletedOrder = await orderRepository.deleteOrder(id, companyId);
  if (!deletedOrder) {
    throw createHttpError(404, 'Pedido no encontrado', 'not_found');
  }
  await audit.recordAuditEventIfAvailable({
    req,
    action: 'orders.delete',
    resourceType: 'order',
    resourceId: id,
    outcome: 'SUCCESS',
    beforeState: {
      id: order.id,
      status: order.status,
      approved: order.approved,
      clientId: order.clientId,
      warehouseId: order.warehouseId,
    },
    afterState: {
      id: deletedOrder.id,
      deleted: true,
    },
  });
  return deletedOrder;
}

/**
 * For warehouse SPA: returns only APPROVED orders with full item + lot allocation detail.
 * @param {any} auth
 */
async function listOrdersForDispatch(auth) {
  const { companyId } = scope(auth);
  return orderRepository.findApprovedOrdersForDispatch(companyId);
}

/**
 * Single order for warehouse dispatch view — includes allocations (lot movements).
 * @param {bigint} id
 * @param {any} auth
 */
async function getOrderForDispatch(id, auth) {
  const { companyId } = scope(auth);
  const order = await orderRepository.findOrderWithAllocations(id, companyId);
  if (!order) throw createHttpError(404, 'Pedido no encontrado', 'not_found');
  return order;
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
  listOrdersForDispatch,
  getOrderForDispatch,
};

