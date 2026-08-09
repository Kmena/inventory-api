const { createHttpError } = require('../lib/errors');
const { isAgentWorkspaceUser } = require('./sales-route.service');
const agentWorkspaceRepository = require('../repositories/agent-workspace.repository');
const orderRepository = require('../repositories/order.repository');

function scope(auth) {
  if (!auth?.companyId || !auth?.sub) {
    throw createHttpError(403, 'Se requiere un usuario asociado a una empresa', 'forbidden');
  }
  return { companyId: BigInt(auth.companyId), userId: BigInt(auth.sub) };
}

function buildWorkspaceCandidate(auth) {
  const permissions = auth?.permissions || [];
  return {
    role: {
      code: auth?.role,
      rolePermissions: permissions.map((code) => ({
        isEnabled: true,
        permission: { code },
      })),
    },
  };
}

function hasGlobalSalesAccess(auth) {
  const roleCode = auth?.role;
  const permissions = new Set(auth?.permissions || []);
  return Boolean(
    roleCode === 'admin'
    || roleCode === 'sales'
    || roleCode === 'sales_supervisor'
    || permissions.has('sales.manage'),
  );
}

async function getAssignedRouteIds(authScope, auth) {
  if (!isAgentWorkspaceUser(buildWorkspaceCandidate(auth))) {
    return [];
  }

  const user = await agentWorkspaceRepository.findAgentUser(authScope.userId, authScope.companyId);
  return (user?.salesRouteAssignments || [])
    .filter((assignment) => assignment.isActive !== false && assignment.salesRoute)
    .map((assignment) => assignment.salesRoute.id);
}

async function assertAgentStoreInCoverage(clientStoreId, authScope, auth) {
  const assignedRouteIds = await getAssignedRouteIds(authScope, auth);
  if (!assignedRouteIds.length) {
    throw createHttpError(403, 'El agente no tiene cobertura activa para crear pedidos', 'forbidden');
  }

  const store = await agentWorkspaceRepository.findStoreByIdForAgent(authScope.companyId, assignedRouteIds, BigInt(clientStoreId));
  if (!store) {
    throw createHttpError(403, 'La tienda no pertenece a la cobertura del agente', 'forbidden');
  }
  return store;
}

async function validateOrderScope(payload, authScope, auth) {
  if (hasGlobalSalesAccess(auth)) {
    return null;
  }

  if (!payload.clientStoreId) {
    throw createHttpError(403, 'Los agentes solo pueden crear o editar pedidos desde una tienda dentro de su cobertura', 'forbidden');
  }

  const store = await assertAgentStoreInCoverage(payload.clientStoreId, authScope, auth);
  if (payload.clientId && store.clientId !== payload.clientId) {
    throw createHttpError(409, 'La tienda origen no corresponde al cliente seleccionado', 'conflict');
  }
  return store;
}

function assertDraftEditAccess(order, authScope, auth) {
  if (hasGlobalSalesAccess(auth)) {
    return;
  }

  if (order.userId !== authScope.userId) {
    throw createHttpError(403, 'El agente solo puede editar sus propios pedidos en borrador', 'forbidden');
  }
}

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
  if (payload.status && payload.status !== 'DRAFT') {
    throw createHttpError(409, 'El endpoint de edicion no permite cambiar el estado del pedido.', 'conflict');
  }
}

async function validateOrderReferences(payload, companyId) {
  if (payload.warehouseId) {
    const warehouse = await orderRepository.findWarehouse(payload.warehouseId, companyId);
    if (!warehouse) throw createHttpError(404, 'Bodega no encontrada para la empresa', 'not_found');
    if (!warehouse.isSellableSource || warehouse.isVirtual) {
      throw createHttpError(409, 'La bodega no esta habilitada como fuente de venta', 'conflict');
    }
  }

  if (payload.clientStoreId) {
    const clientStore = await orderRepository.findCompanyClientStore(payload.clientStoreId, companyId);
    if (!clientStore) {
      throw createHttpError(404, 'La tienda origen no pertenece a la empresa', 'not_found');
    }
    if (payload.clientId && clientStore.clientId !== payload.clientId) {
      throw createHttpError(409, 'La tienda origen no corresponde al cliente seleccionado', 'conflict');
    }
  }

  if (payload.items?.length) {
    const productIds = [...new Set(payload.items.map((item) => item.productId.toString()))].map(BigInt);
    const count = await orderRepository.countCompanyProducts(productIds, companyId);
    if (count !== productIds.length) {
      throw createHttpError(404, 'Uno o mas productos no pertenecen a la empresa', 'not_found');
    }
  }
}

function toOrderCreateData(payload, authScope) {
  const {
    items,
    status: _status,
    approved: _approved,
    approvedAt: _approvedAt,
    approvedById: _approvedById,
    companyId: _companyId,
    userId: _userId,
    warehouseId,
    ...rest
  } = payload;
  const isCashOverride = rest.paymentCondition === 'CASH' ? { isCash: true } : {};
  return {
    ...rest,
    ...(warehouseId === null || warehouseId === undefined ? {} : { warehouseId }),
    ...isCashOverride,
    companyId: authScope.companyId,
    userId: authScope.userId,
    status: 'DRAFT',
    approved: false,
    approvedAt: null,
    approvedById: null,
    items: { create: toOrderItemsCreate(items) },
  };
}

module.exports = {
  scope,
  hasGlobalSalesAccess,
  validateOrderScope,
  assertDraftEditAccess,
  assertEditableStatus,
  validateOrderReferences,
  toOrderCreateData,
  toOrderItemsCreate,
};
