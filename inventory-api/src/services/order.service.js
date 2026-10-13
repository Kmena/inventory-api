const orderRepository = require('../repositories/order.repository');
const inventoryService = require('./inventory.service');
const { createHttpError } = require('../lib/errors');
const { buildPaginatedResponse } = require('../lib/pagination');
const audit = require('../lib/audit');
const { assertLifecycleStatusAllowed } = require('./approval-baseline.service');
const { getBillingIntegrationConfig } = require('./fiscal-readiness.service');
const receiverFiscalReadiness = require('./receiver-fiscal-readiness.service');
const {
  scope,
  validateOrderScope,
  assertDraftEditAccess,
  assertEditableStatus,
  validateOrderReferences,
  toOrderCreateData,
  toOrderItemsCreate,
} = require('./order-access-policy.service');

function uniqueInventoryProductIds(orders) {
  const ids = new Map();
  for (const order of orders || []) {
    for (const item of order.items || []) {
      if (item.product?.controlsInventory === false || !item.productId) continue;
      ids.set(item.productId.toString(), item.productId);
    }
  }
  return [...ids.values()];
}

async function buildSellableInventoryByProductId(companyId, orders) {
  const rows = await orderRepository.findSellableLotStocksByProductIds(companyId, uniqueInventoryProductIds(orders));
  const totals = new Map();
  for (const row of rows) {
    if (!inventoryService.deriveLotUsability(row.lot).sellable) continue;
    const available = Math.max(0, Number(row.quantity || 0) - Number(row.reservedQuantity || 0));
    if (available <= 0.000001) continue;
    const key = row.productId.toString();
    totals.set(key, (totals.get(key) || 0) + available);
  }
  return totals;
}

async function attachSellableInventoryToOrders(companyId, orders) {
  const totals = await buildSellableInventoryByProductId(companyId, orders);
  return (orders || []).map((order) => ({
    ...order,
    items: (order.items || []).map((item) => ({
      ...item,
      product: item.product ? {
        ...item.product,
        sellableInventoryQuantity: item.product.controlsInventory === false
          ? null
          : Number((totals.get(item.productId.toString()) || 0).toFixed(3)),
      } : item.product,
    })),
  }));
}

async function listOrders(auth, pagination = null) {
  const { companyId } = scope(auth);
  const orders = await orderRepository.findAllOrders(companyId, pagination);
  if (!pagination) {
    return attachSellableInventoryToOrders(companyId, orders);
  }

  const paginatedOrders = /** @type {{ items: Array<any>, totalItems: number }} */ (orders);
  const items = await attachSellableInventoryToOrders(companyId, paginatedOrders.items);
  return buildPaginatedResponse(items, pagination, paginatedOrders.totalItems);
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
  // Agents can also edit REJECTED orders (they were sent back for correction).
  if (currentOrder.status !== 'DRAFT' && currentOrder.status !== 'REJECTED') {
    throw createHttpError(409, 'Solo se pueden editar pedidos en borrador o rechazados', 'conflict');
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

/**
 * Approve an order.
 * When Billing integration is enabled: validates receiver fiscal readiness,
 * selected economic activity, and atomically creates OrderFiscalApproval.
 * When Billing is disabled: preserves existing commercial approval behavior.
 *
 * @param {bigint} id — order ID
 * @param {object|null} body — { receiverEconomicActivityCode? } from request
 * @param {object} auth — authenticated actor
 * @param {object|null} req — for audit
 */
async function approveOrder(id, body, auth, req = null) {
  const order = await getOrder(id, auth);
  assertLifecycleStatusAllowed(order.status, ['DRAFT'], 'Solo se pueden aprobar pedidos en borrador');

  const { companyId, userId } = scope(auth);
  const config = await getBillingIntegrationConfig(companyId);

  if (config?.enabled) {
    // ── Fiscal path: Billing integration enabled ──────────────────────────
    // Load order with legal-entity context (separate query — avoid bloating standard order load)
    const orderWithFiscal = await receiverFiscalReadiness.loadOrderWithLegalEntities(id, companyId);
    if (!orderWithFiscal) throw createHttpError(404, 'Pedido no encontrado', 'not_found');

    const fiscalData = await receiverFiscalReadiness.resolveOrderReceiverFiscalData(orderWithFiscal, companyId);

    if (fiscalData.state !== 'READY') {
      const msgMap = {
        IDENTITY_INCOMPLETE: 'El receptor no tiene identidad fiscal completa para facturación',
        IDENTITY_INVALID:    'La identificación del receptor es inválida para facturación fiscal',
        UNVERIFIED:          'El receptor no ha sido verificado con Hacienda. Verifique los datos fiscales del cliente.',
        NOT_FOUND:           'El receptor no fue encontrado en Hacienda. Actualice los datos fiscales del cliente.',
        VERIFICATION_UNAVAILABLE: 'La verificación fiscal del receptor no está disponible. Vuelva a intentarlo.',
        ACTIVITIES_MISSING:  'El receptor no tiene actividades económicas vigentes. Verifique los datos fiscales del cliente.',
      };
      const msg = msgMap[fiscalData.state] || 'El receptor no está listo para facturación fiscal';
      throw createHttpError(409, msg, fiscalData.state);
    }

    // Activity selection validation (pre-tx check — will be re-validated inside tx)
    const { receiverEconomicActivityCode } = body || {};
    if (!receiverEconomicActivityCode) {
      throw createHttpError(400, 'Se requiere seleccionar una actividad económica del receptor', 'RECEIVER_ACTIVITY_REQUIRED');
    }

    const selectedActivity = fiscalData.eligibleActivities.find((a) => a.code === receiverEconomicActivityCode);
    if (!selectedActivity) {
      throw createHttpError(409, 'La actividad económica seleccionada no es válida para este receptor', 'RECEIVER_ACTIVITY_NOT_ELIGIBLE');
    }

    // Delegate to inventory service — creates OrderFiscalApproval atomically inside the DB transaction
    return inventoryService.reserveStockForOrder(id, auth, req, {
      fiscalApprovalData: {
        companyId,
        clientLegalEntityId: fiscalData.entity.id,
        receiverEconomicActivityCode,
        confirmedById: userId ? BigInt(userId) : null,
      },
    });
  }

  // ── Commercial path: Billing disabled — existing behavior unchanged ──────────
  // No fiscal check, no activity selection, no OrderFiscalApproval created.
  return inventoryService.reserveStockForOrder(id, auth, req);
}

/**
 * GET /api/orders/:id/fiscal-readiness-preview
 * Pure DB read — no Hacienda, no Billing, no mutations.
 */
async function getOrderFiscalReadinessPreview(id, auth) {
  await getOrder(id, auth); // 404-guard: throws if order not found or not in company scope
  const { companyId } = scope(auth);
  const config = await getBillingIntegrationConfig(companyId);

  if (!config?.enabled) {
    return receiverFiscalReadiness.buildBillingDisabledPreviewDto(id);
  }

  const orderWithFiscal = await receiverFiscalReadiness.loadOrderWithLegalEntities(id, companyId);
  // orderWithFiscal may be null only if order was deleted between the two queries (race) — safe fallback
  const fiscalData = orderWithFiscal
    ? await receiverFiscalReadiness.resolveOrderReceiverFiscalData(orderWithFiscal, companyId)
    : { state: 'IDENTITY_INCOMPLETE', entity: null, eligibleActivities: [], allActivities: [] };

  return receiverFiscalReadiness.buildFiscalReadinessPreviewDto(id, fiscalData);
}

async function rejectOrder(id, payload, auth, req = null) {
  const order = await getOrder(id, auth);
  assertLifecycleStatusAllowed(order.status, ['DRAFT'], 'Solo se pueden rechazar pedidos en borrador');
  const { companyId, userId } = scope(auth);
  const rejectedOrder = await orderRepository.updateOrder(id, companyId, {
    status: 'REJECTED',
    rejectionReason: payload.rejectionReason,
    rejectedById: userId,
    rejectedAt: new Date(),
  });
  if (!rejectedOrder) throw createHttpError(404, 'Pedido no encontrado', 'not_found');
  await audit.recordAuditEventIfAvailable({
    req,
    action: 'orders.reject',
    resourceType: 'order',
    resourceId: id,
    outcome: 'SUCCESS',
    beforeState: { id: order.id, status: order.status },
    afterState:  { id: rejectedOrder.id, status: rejectedOrder.status, rejectionReason: rejectedOrder.rejectionReason },
  });
  return rejectedOrder;
}

async function resubmitOrder(id, auth, req = null) {
  const order = await getOrder(id, auth);
  assertLifecycleStatusAllowed(order.status, ['REJECTED'], 'Solo se pueden reenviar pedidos rechazados');
  const authScope = scope(auth);
  // Only the agent who created the order can resubmit it.
  if (order.userId == null || String(order.userId) !== String(authScope.userId)) {
    throw createHttpError(403, 'Solo el agente que creó el pedido puede reenviarlo', 'forbidden');
  }
  const resubmitted = await orderRepository.updateOrder(id, authScope.companyId, {
    status: 'DRAFT',
    rejectionReason: null,
    rejectedById: null,
    rejectedAt: null,
  });
  if (!resubmitted) throw createHttpError(404, 'Pedido no encontrado', 'not_found');
  await audit.recordAuditEventIfAvailable({
    req,
    action: 'orders.resubmit',
    resourceType: 'order',
    resourceId: id,
    outcome: 'SUCCESS',
    beforeState: { id: order.id, status: order.status },
    afterState:  { id: resubmitted.id, status: resubmitted.status },
  });
  return resubmitted;
}

async function cancelOrder(id, auth, req = null) {
  const order = await getOrder(id, auth);
  if (order.status === 'DELIVERED') {
    throw createHttpError(409, 'No se puede cancelar un pedido ya despachado', 'conflict');
  }
  if (order.status === 'CANCELLED') {
    throw createHttpError(409, 'El pedido ya esta cancelado', 'conflict');
  }
  // REJECTED orders have no stock reservation — cancel directly.
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

async function dispatchOrder(id, auth, body = null, req = null) {
  await getOrder(id, auth);
  return inventoryService.dispatchOrder(id, auth, body, req);
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

async function listDeliveredOrders(auth) {
  const { companyId } = scope(auth);
  return orderRepository.findDeliveredOrders(companyId);
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

/**
 * Fetch a specific order scoped by companyId + userId (for agent self-service).
 * Throws 404 if not found or doesn't belong to this agent.
 */
async function getOrderForAgent(id, companyId, userId) {
  const order = await orderRepository.findOrderById(id, companyId);
  if (!order) throw createHttpError(404, 'Pedido no encontrado', 'not_found');
  if (String(order.userId) !== String(userId)) {
    throw createHttpError(403, 'No tenés acceso a este pedido', 'forbidden');
  }
  return order;
}

/**
 * Update order items without full auth policy check — used by agent correction flow.
 * Only updates items and basic fields; does not change status.
 */
async function updateOrderAsAgent(id, payload, companyId) {
  const data = {};
  if (payload.paymentCondition) data.paymentCondition = payload.paymentCondition;
  if (payload.notes !== undefined) data.notes = payload.notes;
  if (payload.responsible !== undefined) data.responsible = payload.responsible;
  if (payload.items) {
    // updateMany doesn't support nested relation writes — use update (singular) instead.
    data.items = { deleteMany: {}, create: toOrderItemsCreate(payload.items) };
  }
  const updated = await orderRepository.updateOrderWithRelations(id, data);
  if (!updated) throw createHttpError(404, 'Pedido no encontrado', 'not_found');
  // Verify the order belongs to this company (ownership check after update).
  if (String(updated.companyId) !== String(companyId)) {
    throw createHttpError(403, 'No tenés acceso a este pedido', 'forbidden');
  }
  return updated;
}

module.exports = {
  listOrders,
  getOrder,
  getOrderForAgent,
  createOrder,
  updateOrder,
  updateOrderAsAgent,
  approveOrder,
  getOrderFiscalReadinessPreview,
  rejectOrder,
  resubmitOrder,
  cancelOrder,
  dispatchOrder,
  removeOrder,
  listOrdersForDispatch,
  getOrderForDispatch,
  listDeliveredOrders,
};

