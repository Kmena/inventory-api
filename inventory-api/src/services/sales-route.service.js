const regionRepository = require('../repositories/region.repository');
const salesRouteRepository = require('../repositories/sales-route.repository');
const { createHttpError } = require('../lib/errors');

function assertCompanyUser(auth) {
  if (!auth.companyId) {
    throw createHttpError(403, 'El usuario debe pertenecer a una empresa', 'forbidden');
  }
}

function permissionCodes(user) {
  return (user.role?.rolePermissions || [])
    .filter((rolePermission) => rolePermission.isEnabled !== false)
    .map((rolePermission) => rolePermission.permission?.code)
    .filter(Boolean);
}

function hasPermission(user, permissionCode) {
  return permissionCodes(user).includes(permissionCode);
}

function isAgentWorkspaceUser(user) {
  if (['admin', 'root', 'warehouse', 'sales_supervisor'].includes(user?.role?.code)) {
    return false;
  }

  if (user?.role?.code === 'sales_agent') {
    return true;
  }

  // Explicit landing permission is the canonical signal — mirrors resolveLanding().
  // A role with agent.access is always an agent workspace user regardless of
  // which other operational permissions it carries.
  if (hasPermission(user, 'agent.access')) {
    return true;
  }

  // Legacy heuristic for roles created before the landing-permission system.
  return Boolean(
    hasPermission(user, 'sales.routes.view.own')
    && hasPermission(user, 'sales.orders.create')
    && hasPermission(user, 'customer.activities.manage')
    && !hasPermission(user, 'sales.routes.assign')
    && !hasPermission(user, 'sales.routes.view.all')
  );
}

function isCommercialAgent(user) {
  const codes = new Set(permissionCodes(user));
  if (['admin', 'root', 'warehouse'].includes(user?.role?.code)) {
    return false;
  }
  return Boolean(
    isAgentWorkspaceUser(user)
    || user?.role?.code === 'sales'
    || user?.role?.code === 'sales_supervisor'
    || codes.has('sales.routes.view.own')
    || codes.has('sales.routes.view.all')
    || (codes.has('sales.orders.create') && !codes.has('sales.routes.assign'))
  );
}

function serializeAgent(user) {
  const assignments = user.salesRouteAssignments || [];
  const goals = user.salesGoals || [];

  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    phone: user.phone,
    status: user.status,
    role: user.role ? { id: user.role.id, code: user.role.code, name: user.role.name } : null,
    permissionCodes: permissionCodes(user),
    assignmentsCount: assignments.length,
    goalsCount: goals.length,
    goals: goals.map(serializeGoal),
  };
}

function serializeGoal(goal) {
  const targetAmount = Number(goal.targetAmount || 0);
  const currentAmount = Number(goal.currentAmount || 0);
  const progressPercent = targetAmount > 0 ? Math.min(100, Math.max(0, (currentAmount / targetAmount) * 100)) : 0;

  return {
    id: goal.id,
    title: goal.title,
    periodLabel: goal.periodLabel,
    targetAmount,
    currentAmount,
    progressPercent: Number(progressPercent.toFixed(1)),
    notes: goal.notes,
    isActive: goal.isActive,
  };
}

function serializeStore(store) {
  return {
    id: store.id,
    clientId: store.clientId,
    clientName: store.client?.name,
    code: store.code,
    name: store.name,
    phone: store.phone,
    address: store.address,
    isPrimary: store.isPrimary,
    latitude: store.latitude === null || store.latitude === undefined ? null : Number(store.latitude),
    longitude: store.longitude === null || store.longitude === undefined ? null : Number(store.longitude),
    subregionId: store.subregionId,
    subregionName: store.subregion?.name || null,
    regionName: store.subregion?.region?.name || null,
    representativesCount: store.representatives?.length || 0,
  };
}

function serializeRoute(route) {
  const subzones = route.subzones || [];
  const stores = subzones.flatMap((subzone) => subzone.subregion?.stores || []);
  const uniqueStoreIds = new Set(stores.map((store) => store.id.toString()));
  const mappedStoresCount = stores.filter((store) => store.latitude !== null && store.longitude !== null).length;
  const agents = (route.assignments || []).map((assignment) => serializeAgent(assignment.user));

  return {
    id: route.id,
    code: route.code,
    name: route.name,
    visitFrequencyDays: route.visitFrequencyDays,
    isActive: route.isActive,
    subzonesCount: subzones.length,
    storesCount: uniqueStoreIds.size,
    mappedStoresCount,
    assignmentsCount: agents.length,
    subzoneIds: subzones.map((item) => item.subregionId),
    agentIds: (route.assignments || []).map((item) => item.userId),
    subzones: subzones.map((item) => ({
      id: item.id,
      subregionId: item.subregionId,
      name: item.subregion?.name || null,
      routeCode: item.subregion?.routeCode || null,
      regionId: item.subregion?.regionId || null,
      regionName: item.subregion?.region?.name || null,
      storesCount: item.subregion?.stores?.length || 0,
    })),
    agents,
    stores: stores.map(serializeStore),
  };
}

function serializeZones(regions) {
  return regions.map((region) => ({
    id: region.id,
    name: region.name,
    routeCode: region.routeCode,
    subregions: (region.subregions || []).map((subregion) => ({
      id: subregion.id,
      name: subregion.name,
      routeCode: subregion.routeCode,
      regionId: region.id,
      regionName: region.name,
    })),
  }));
}

const MIN_VISIT_FREQUENCY_DAYS = 5;

function normalizeRoutePayload(payload) {
  const code = payload.code?.trim();
  const name = payload.name?.trim();
  const visitFrequencyDays = Number(payload.visitFrequencyDays || 0);

  if (!code || !name) {
    throw createHttpError(400, 'La ruta debe incluir codigo y nombre', 'validation_error');
  }
  if (!Number.isInteger(visitFrequencyDays) || visitFrequencyDays < MIN_VISIT_FREQUENCY_DAYS) {
    throw createHttpError(
      400,
      `La frecuencia de visita debe ser minimo ${MIN_VISIT_FREQUENCY_DAYS} dias`,
      'validation_error',
    );
  }

  const normalized = {
    code,
    name,
    visitFrequencyDays,
    isActive: payload.isActive !== false,
  };

  if (payload.nearLimitDays !== undefined && payload.nearLimitDays !== null) {
    const nearLimitDays = Number(payload.nearLimitDays);
    if (Number.isInteger(nearLimitDays) && nearLimitDays >= 1) {
      normalized.nearLimitDays = nearLimitDays;
    }
  }

  return normalized;
}

async function listCompanyRoutes(auth) {
  assertCompanyUser(auth);
  const companyId = BigInt(auth.companyId);
  const [routes, regions, users] = await Promise.all([
    salesRouteRepository.findCompanyRoutes(companyId),
    regionRepository.findCompanyRegions(companyId),
    salesRouteRepository.findCompanyUsersWithRoles(companyId),
  ]);

  const normalizedRoutes = routes.map(serializeRoute);
  const agents = users.filter(isAgentWorkspaceUser).map(serializeAgent);

  return {
    routes: normalizedRoutes,
    zones: serializeZones(regions),
    agents,
    summary: {
      routesCount: normalizedRoutes.length,
      subzonesCount: normalizedRoutes.reduce((total, route) => total + route.subzonesCount, 0),
      storesCount: normalizedRoutes.reduce((total, route) => total + route.storesCount, 0),
      assignedAgentsCount: new Set(normalizedRoutes.flatMap((route) => route.agentIds.map(String))).size,
    },
  };
}

async function getCompanyRouteDetail(routeId, auth) {
  assertCompanyUser(auth);
  const companyId = BigInt(auth.companyId);
  const route = await salesRouteRepository.findCompanyRouteById(routeId, companyId);
  if (!route) {
    throw createHttpError(404, 'Ruta no encontrada', 'not_found');
  }
  return serializeRoute(route);
}

async function createCompanyRoute(payload, auth) {
  assertCompanyUser(auth);
  const companyId = BigInt(auth.companyId);
  const data = normalizeRoutePayload(payload);

  try {
    const route = await salesRouteRepository.createCompanyRoute({
      companyId,
      ...data,
    });
    return serializeRoute(route);
  } catch (error) {
    if (error.code === 'P2002') {
      throw createHttpError(409, 'Ya existe una ruta con ese codigo en la empresa', 'conflict');
    }
    throw error;
  }
}

async function updateCompanyRoute(routeId, payload, auth) {
  assertCompanyUser(auth);
  const companyId = BigInt(auth.companyId);
  await getCompanyRouteDetail(routeId, auth);
  const data = normalizeRoutePayload(payload);

  try {
    const route = await salesRouteRepository.updateCompanyRoute(routeId, companyId, data);
    if (!route) {
      throw createHttpError(404, 'Ruta no encontrada', 'not_found');
    }
    return serializeRoute(route);
  } catch (error) {
    if (error.code === 'P2002') {
      throw createHttpError(409, 'Ya existe otra ruta con ese codigo en la empresa', 'conflict');
    }
    throw error;
  }
}

async function saveCompanyRouteSubzones(routeId, payload, auth) {
  assertCompanyUser(auth);
  const companyId = BigInt(auth.companyId);
  await getCompanyRouteDetail(routeId, auth);

  const subregionIds = [...new Set((payload.subregionIds || []).map((subregionId) => BigInt(subregionId)))];
  if (subregionIds.length) {
    const validSubregions = await salesRouteRepository.findCompanySubregionsByIds(companyId, subregionIds);
    if (validSubregions.length !== subregionIds.length) {
      throw createHttpError(400, 'Una o mas subzonas no pertenecen a la empresa', 'validation_error');
    }

    const conflictingAssignments = await salesRouteRepository.findCompanyRoutesBySubregionIds(companyId, subregionIds, routeId);
    if (conflictingAssignments.length) {
      const conflict = conflictingAssignments[0];
      throw createHttpError(
        409,
        `La subzona ${conflict.subregion?.name || 'seleccionada'} ya pertenece a la ruta ${conflict.salesRoute?.code || ''}`.trim(),
        'conflict',
      );
    }
  }

  const route = await salesRouteRepository.replaceRouteSubzones(companyId, routeId, subregionIds);
  return serializeRoute(route);
}

async function removeCompanyRouteSubzone(routeId, subregionId, auth) {
  assertCompanyUser(auth);
  const companyId = BigInt(auth.companyId);
  await getCompanyRouteDetail(routeId, auth);

  const subregions = await salesRouteRepository.findCompanySubregionsByIds(companyId, [subregionId]);
  if (!subregions.length) {
    throw createHttpError(404, 'Subzona no encontrada para la empresa', 'not_found');
  }

  const result = await salesRouteRepository.removeRouteSubzone(companyId, routeId, subregionId);
  if (!result.removedCount) {
    throw createHttpError(404, 'La subzona no pertenece a la ruta', 'not_found');
  }
  return serializeRoute(result.route);
}

async function saveCompanyRouteAssignments(routeId, payload, auth) {
  assertCompanyUser(auth);
  const companyId = BigInt(auth.companyId);
  await getCompanyRouteDetail(routeId, auth);

  const userIds = [...new Set((payload.userIds || []).map((userId) => BigInt(userId)))];
  if (userIds.length) {
    const users = await Promise.all(userIds.map((userId) => salesRouteRepository.findCompanyUserById(userId, companyId)));
    if (users.some((user) => !user)) {
      throw createHttpError(400, 'Uno o mas agentes no pertenecen a la empresa', 'validation_error');
    }
    if (users.some((user) => !isAgentWorkspaceUser(user))) {
      throw createHttpError(400, 'Solo se pueden asignar rutas a usuarios elegibles para el workspace del agente', 'validation_error');
    }
  }

  const route = await salesRouteRepository.replaceRouteAssignments(companyId, routeId, userIds);
  return serializeRoute(route);
}

async function saveCompanyRouteAgentGoals(userId, payload, auth) {
  assertCompanyUser(auth);
  const companyId = BigInt(auth.companyId);

  const user = await salesRouteRepository.findCompanyUserById(userId, companyId);
  if (!user) {
    throw createHttpError(404, 'Agente no encontrado', 'not_found');
  }
  if (!isCommercialAgent(user)) {
    throw createHttpError(400, 'El usuario seleccionado no tiene perfil comercial de agente', 'validation_error');
  }

  const normalizedGoals = (payload.goals || []).map((goal) => ({
    title: goal.title.trim(),
    periodLabel: goal.periodLabel?.trim() || null,
    targetAmount: Number(goal.targetAmount || 0),
    currentAmount: Number(goal.currentAmount || 0),
    notes: goal.notes?.trim() || null,
    isActive: goal.isActive !== false,
  }));

  const updatedUser = await salesRouteRepository.replaceCompanyUserGoals(companyId, userId, normalizedGoals);
  return {
    agent: serializeAgent(updatedUser),
    goals: (updatedUser.salesGoals || []).map(serializeGoal),
  };
}

module.exports = {
  listCompanyRoutes,
  getCompanyRouteDetail,
  createCompanyRoute,
  updateCompanyRoute,
  saveCompanyRouteSubzones,
  removeCompanyRouteSubzone,
  saveCompanyRouteAssignments,
  saveCompanyRouteAgentGoals,
  isCommercialAgent,
  isAgentWorkspaceUser,
  permissionCodes,
  serializeAgent,
  serializeGoal,
  serializeStore,
};


