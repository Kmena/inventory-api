const agentWorkspaceRepository = require('../repositories/agent-workspace.repository');
const { createHttpError } = require('../lib/errors');
const {
  isAgentWorkspaceUser,
  serializeGoal,
} = require('./sales-route.service');
const orderService = require('./order.service');
const inventoryService = require('./inventory.service');
const {
  normalizeRouteForStore,
  serializeRepresentative,
  serializeVisit,
  serializeStoreCard,
  sortStores,
  serializePurchaseHistory,
} = require('./agent-workspace-store-state.service');

function scope(auth) {
  if (!auth?.companyId || !auth?.sub) {
    throw createHttpError(403, 'Se requiere un usuario asociado a una empresa', 'forbidden');
  }
  return { companyId: BigInt(auth.companyId), userId: BigInt(auth.sub) };
}

async function getAgentContext(auth) {
  const authScope = scope(auth);
  const user = await agentWorkspaceRepository.findAgentUser(authScope.userId, authScope.companyId);
  if (!user) {
    throw createHttpError(404, 'Agente no encontrado', 'not_found');
  }
  if (!isAgentWorkspaceUser(user)) {
    throw createHttpError(403, 'El usuario autenticado no tiene perfil comercial de agente', 'forbidden');
  }

  const assignedRoutes = (user.salesRouteAssignments || []).map((assignment) => assignment.salesRoute).filter(Boolean);
  return {
    ...authScope,
    user,
    assignedRoutes,
    assignedRouteIds: assignedRoutes.map((route) => route.id),
  };
}

async function listAgentDashboard(auth) {
  const context = await getAgentContext(auth);
  const stores = await agentWorkspaceRepository.findVisibleStoresForAgent(context.companyId, context.assignedRouteIds);
  const cards = sortStores(stores.map((store) => serializeStoreCard(store, normalizeRouteForStore(store, context.assignedRoutes))));

  return {
    agent: {
      id: context.user.id,
      fullName: context.user.fullName,
      username: context.user.username,
      role: context.user.role ? { code: context.user.role.code, name: context.user.role.name } : null,
    },
    summary: {
      routesAssignedCount: context.assignedRoutes.length,
      storesToVisitCount: cards.filter((store) => store.status !== 'AL_DIA').length,
      nearLimitCount: cards.filter((store) => store.isNearLimit).length,
      overdueCount: cards.filter((store) => store.status === 'VENCIDA').length,
      newStoresCount: cards.filter((store) => store.status === 'NUEVA').length,
    },
    routes: context.assignedRoutes.map((route) => ({
      id: route.id,
      code: route.code,
      name: route.name,
      visitFrequencyDays: route.visitFrequencyDays,
      nearLimitDays: route.nearLimitDays,
    })),
  };
}

async function listAgentStores(filters, auth) {
  const context = await getAgentContext(auth);
  const stores = await agentWorkspaceRepository.findVisibleStoresForAgent(context.companyId, context.assignedRouteIds);
  const normalizedName = filters?.name?.trim().toLowerCase() || '';
  const normalizedZone = filters?.zone?.trim().toLowerCase() || '';

  const cards = stores
    .map((store) => serializeStoreCard(store, normalizeRouteForStore(store, context.assignedRoutes)))
    .filter((store) => {
      const matchesName = !normalizedName || `${store.name} ${store.clientName || ''}`.toLowerCase().includes(normalizedName);
      const matchesZone = !normalizedZone || `${store.regionName || ''} ${store.subregionName || ''}`.toLowerCase().includes(normalizedZone);
      return matchesName && matchesZone;
    });

  return {
    summary: {
      total: cards.length,
      byStatus: {
        VENCIDA: cards.filter((store) => store.status === 'VENCIDA').length,
        PROXIMA_A_VENCER: cards.filter((store) => store.status === 'PROXIMA_A_VENCER').length,
        NUEVA: cards.filter((store) => store.status === 'NUEVA').length,
        AL_DIA: cards.filter((store) => store.status === 'AL_DIA').length,
      },
    },
    stores: sortStores(cards),
  };
}

function serializeSellableProducts(stockRows, suggestions) {
  const suggestionMap = new Map();
  for (const suggestion of suggestions) {
    const key = suggestion.productId.toString();
    if (!suggestionMap.has(key)) {
      suggestionMap.set(key, {
        productId: suggestion.productId,
        productName: suggestion.product?.name || null,
        sourceStoreName: suggestion.order?.clientStore?.name || null,
        lastPurchasedAt: suggestion.order?.createdAt || null,
      });
    }
  }

  const productMap = new Map();
  for (const row of stockRows || []) {
    const availableQuantity = Math.max(0, Number(row.quantity || 0) - Number(row.reservedQuantity || 0));
    if (availableQuantity <= 0.000001) {
      continue;
    }

    if (!inventoryService.deriveLotUsability(row.lot).sellable) {
      continue;
    }

    const key = row.productId.toString();
    const current = productMap.get(key) || {
      id: row.product.id,
      code: row.product.code,
      name: row.product.name,
      price: Number(row.product.price || row.product.prices?.[0]?.amount || 0),
      categoryName: row.product.category?.name || null,
      subcategoryName: row.product.subcategory?.name || null,
      inCatalog: row.product.inCatalog,
      availableQuantity: 0,
      warehouseIds: new Set(),
      lotIds: new Set(),
    };

    current.availableQuantity += availableQuantity;
    current.warehouseIds.add(row.warehouseId.toString());
    current.lotIds.add(row.lotId.toString());
    productMap.set(key, current);
  }

  return {
    products: [...productMap.values()]
      .map((product) => ({
        id: product.id,
        code: product.code,
        name: product.name,
        price: product.price,
        categoryName: product.categoryName,
        subcategoryName: product.subcategoryName,
        inCatalog: product.inCatalog,
        availableQuantity: Number(product.availableQuantity.toFixed(3)),
        warehouseCount: product.warehouseIds.size,
        lotCount: product.lotIds.size,
      }))
      .filter((product) => product.availableQuantity > 0)
      .sort((left, right) => left.name.localeCompare(right.name, 'es') || left.id.toString().localeCompare(right.id.toString())),
    suggestions: [...suggestionMap.values()],
  };
}

async function getAgentSellableProductSnapshot(companyId, suggestions = [], options = {}) {
  const warehouses = await agentWorkspaceRepository.findSellableWarehouses(companyId);
  if (!warehouses.length) {
    if (options.requireWarehouse !== false) {
      throw createHttpError(409, 'No hay bodegas vendibles activas con las que se pueda preparar el pedido del agente', 'conflict');
    }
    return serializeSellableProducts([], suggestions);
  }

  const stockRows = await agentWorkspaceRepository.findSellableProductAvailabilityRows(companyId);
  return serializeSellableProducts(stockRows, suggestions);
}

function assertAgentOrderItemsAvailable(items, sellableProducts) {
  const productsById = new Map((sellableProducts?.products || []).map((product) => [product.id.toString(), product]));

  for (const item of items || []) {
    const product = productsById.get(String(item.productId));
    if (!product) {
      throw createHttpError(409, 'Uno de los productos del pedido ya no tiene stock vendible disponible', 'conflict');
    }

    const requestedQuantity = Number(item.quantity || 0);
    if (requestedQuantity - Number(product.availableQuantity || 0) > 0.000001) {
      throw createHttpError(409, `Solo hay ${product.availableQuantity} unidades vendibles disponibles para ${product.name}`, 'conflict');
    }
  }
}

async function getAgentStoreDetail(storeId, auth) {
  const context = await getAgentContext(auth);
  const store = await agentWorkspaceRepository.findStoreByIdForAgent(context.companyId, context.assignedRouteIds, storeId);
  if (!store) {
    throw createHttpError(404, 'La tienda no pertenece a la cobertura del agente', 'not_found');
  }

  const route = normalizeRouteForStore(store, context.assignedRoutes);
  const storeCard = serializeStoreCard(store, route);
  const suggestionRows = await agentWorkspaceRepository.findOtherStoreProductSuggestions(context.companyId, store.clientId, store.id);
  const sellableProducts = await getAgentSellableProductSnapshot(context.companyId, suggestionRows, { requireWarehouse: false });

  return {
    store: {
      ...storeCard,
      legalEntityName: store.legalEntity?.legalName || store.client?.legalEntity?.legalName || null,
      attentionSchedule: store.attentionSchedule,
      locationReference: store.locationReference,
      clientContacts: (store.client?.contacts || []).map((contact) => ({
        id: contact.id,
        name: contact.name,
        role: contact.role,
        email: contact.email,
        phone: contact.phone,
        mobile: contact.mobile,
      })),
      representatives: (store.representatives || []).map(serializeRepresentative),
    },
    latestVisit: store.routeVisitLogs?.[0] ? serializeVisit(store.routeVisitLogs[0]) : null,
    visitHistory: (store.routeVisitLogs || []).map(serializeVisit),
    purchaseHistory: serializePurchaseHistory(store),
    sellableProducts,
  };
}

async function listAgentGoals(auth) {
  const context = await getAgentContext(auth);
  return {
    goals: (context.user.salesGoals || []).map(serializeGoal),
  };
}

async function createAgentVisit(payload, auth) {
  const context = await getAgentContext(auth);
  const store = await agentWorkspaceRepository.findStoreByIdForAgent(context.companyId, context.assignedRouteIds, BigInt(payload.clientStoreId));
  if (!store) {
    throw createHttpError(404, 'La tienda no pertenece a la cobertura del agente', 'not_found');
  }

  const route = normalizeRouteForStore(store, context.assignedRoutes);
  if (!route) {
    throw createHttpError(409, 'No se encontro una ruta activa para registrar la visita', 'conflict');
  }

  const visit = await agentWorkspaceRepository.createRouteVisitLog({
    companyId: context.companyId,
    salesRouteId: route.id,
    subregionId: store.subregionId,
    clientId: store.clientId,
    clientStoreId: store.id,
    userId: context.userId,
    motive: payload.motive,
    result: payload.result,
    comment: payload.comment?.trim() || null,
    suggestedNextVisitAt: payload.suggestedNextVisitAt ? new Date(payload.suggestedNextVisitAt) : null,
    visitedAt: payload.visitedAt ? new Date(payload.visitedAt) : new Date(),
  });

  return {
    visit: serializeVisit(visit),
  };
}

async function listAgentVisits(auth) {
  const context = await getAgentContext(auth);
  const visits = await agentWorkspaceRepository.findAgentVisits(context.companyId, context.userId);
  return {
    visits: visits.map(serializeVisit),
  };
}

async function getAgentStorePurchaseHistory(storeId, auth) {
  const detail = await getAgentStoreDetail(storeId, auth);
  return detail.purchaseHistory;
}

async function getAgentStoreSellableProducts(storeId, auth) {
  const detail = await getAgentStoreDetail(storeId, auth);
  return detail.sellableProducts;
}


async function getAgentStoreOrderContext(storeId, auth) {
  const context = await getAgentContext(auth);
  const store = await agentWorkspaceRepository.findStoreByIdForAgent(context.companyId, context.assignedRouteIds, storeId);
  if (!store) {
    throw createHttpError(404, 'La tienda no pertenece a la cobertura del agente', 'not_found');
  }

  const route = normalizeRouteForStore(store, context.assignedRoutes);
  const sellableProducts = await getAgentSellableProductSnapshot(context.companyId, [], { requireWarehouse: true });

  return {
    store: serializeStoreCard(store, route),
    sellableProducts,
  };
}

async function createAgentStoreOrder(storeId, payload, auth) {
  const context = await getAgentContext(auth);
  const store = await agentWorkspaceRepository.findStoreByIdForAgent(context.companyId, context.assignedRouteIds, storeId);
  if (!store) {
    throw createHttpError(404, 'La tienda no pertenece a la cobertura del agente', 'not_found');
  }

  if (!payload.items?.length) {
    throw createHttpError(400, 'Debe incluir al menos un producto para crear el pedido', 'validation_error');
  }

  const sellableProducts = await getAgentSellableProductSnapshot(context.companyId, [], { requireWarehouse: true });
  assertAgentOrderItemsAvailable(payload.items, sellableProducts);

  return orderService.createOrder({
    clientId: store.clientId,
    clientStoreId: store.id,
    paymentCondition: payload.paymentCondition || null,
    transferMetadata: payload.transferMetadata || null,
    notes: payload.notes?.trim() || null,
    responsible: payload.responsible?.trim() || null,
    transport: null,
    items: payload.items.map((item) => ({
      productId: BigInt(item.productId),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      discountPercent: Number(item.discountPercent || 0),
      discountAmount: Number(item.discountAmount || 0),
      totalDiscount: Number(item.totalDiscount || 0),
    })),
  }, auth);
}

async function listAgentOrders(auth) {
  const context = await getAgentContext(auth);
  const orders = await agentWorkspaceRepository.findAgentOrders(context.companyId, context.userId);
  return {
    orders: orders.map((order) => ({
      id: order.id,
      orderNumber: order.id,
      status: order.status,
      total: Number(order.total || 0),
      createdAt: order.createdAt,
      paymentCondition: order.paymentCondition,
      storeName: order.clientStore?.name || null,
      clientName: order.client?.name || null,
      itemCount: (order.items || []).length,
    })),
  };
}

module.exports = {
  listAgentDashboard,
  listAgentStores,
  getAgentStoreDetail,
  listAgentGoals,
  createAgentVisit,
  listAgentVisits,
  getAgentStorePurchaseHistory,
  getAgentStoreSellableProducts,
  getAgentStoreOrderContext,
  createAgentStoreOrder,
  listAgentOrders,
};









