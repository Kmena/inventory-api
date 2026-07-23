const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const authService = require('../src/services/auth.service');
const agentWorkspaceService = require('../src/services/agent-workspace.service');

const prisma = new PrismaClient();
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createCleanupState() {
  return {
    orderIds: [],
    visitIds: [],
    storeIds: [],
    userIds: [],
  };
}

function createDiagnosticState() {
  return {
    phases: [],
    currentPhase: null,
  };
}

function startPhase(diagnosticState, name) {
  const phase = {
    name,
    startedAt: Date.now(),
    status: 'RUNNING',
  };
  diagnosticState.currentPhase = phase;
  diagnosticState.phases.push(phase);
  console.log(`[phase:start] ${name}`);
  return phase;
}

function completePhase(diagnosticState, phase) {
  phase.status = 'PASSED';
  phase.durationMs = Date.now() - phase.startedAt;
  diagnosticState.currentPhase = null;
  console.log(`[phase:pass] ${phase.name} (${phase.durationMs} ms)`);
}

function failPhase(diagnosticState, phase, error) {
  phase.status = 'FAILED';
  phase.durationMs = Date.now() - phase.startedAt;
  phase.errorMessage = error.message;
  diagnosticState.currentPhase = phase;
  console.error(`[phase:fail] ${phase.name} (${phase.durationMs} ms)`);
}

async function runPhase(diagnosticState, name, action) {
  const phase = startPhase(diagnosticState, name);
  try {
    const result = await action();
    completePhase(diagnosticState, phase);
    return result;
  } catch (error) {
    failPhase(diagnosticState, phase, error);
    throw error;
  }
}

function summarizePrismaError(error) {
  if (!error || !error.code) {
    return null;
  }

  if (error.code === 'P2022') {
    return `Compatibilidad de esquema rota: falta la columna ${error.meta?.column || 'desconocida'} para el modelo ${error.meta?.modelName || 'desconocido'}.`;
  }

  if (error.code === 'P2021') {
    return `Compatibilidad de esquema rota: falta la tabla ${error.meta?.table || 'desconocida'}.`;
  }

  return `Fallo Prisma ${error.code}.`;
}

function printSuccessSummary(diagnosticState) {
  console.log('Validacion agent workspace: OK');
  console.log('Resumen de fases:');
  for (const phase of diagnosticState.phases) {
    console.log(`- PASS ${phase.name} (${phase.durationMs} ms)`);
  }
  console.log('- Cobertura del agente validada');
  console.log('- Restriccion de visitas fuera de cobertura validada');
  console.log('- Estados AL_DIA, PROXIMA_A_VENCER y NUEVA validados');
  console.log('- Filtros por nombre y zona validados');
  console.log('- Historial por tienda y productos vendibles validados');
  console.log('- Caso sin cobertura y sin metas validado');
  console.log('- Conservacion de tienda origen en pedidos validada');
  console.log('- Sincronizacion lista-mapa validada por ruta de codigo compartida');
}

function printFailureSummary(error, diagnosticState) {
  console.error('Validacion agent workspace: FAILED');
  if (diagnosticState.currentPhase?.name) {
    console.error(`Fase con error: ${diagnosticState.currentPhase.name}`);
  }

  const prismaSummary = summarizePrismaError(error);
  if (prismaSummary) {
    console.error(`Diagnostico: ${prismaSummary}`);
  }

  console.error('Resumen de fases:');
  for (const phase of diagnosticState.phases) {
    const label = phase.status === 'PASSED' ? 'PASS' : phase.status === 'FAILED' ? 'FAIL' : phase.status;
    const detail = phase.errorMessage ? ` -> ${phase.errorMessage}` : '';
    const duration = phase.durationMs !== undefined ? ` (${phase.durationMs} ms)` : '';
    console.error(`- ${label} ${phase.name}${duration}${detail}`);
  }

  console.error(error);
}

async function buildAuth(username, password) {
  const { user } = await authService.login({ username, password });
  return {
    sub: user.id.toString(),
    companyId: user.companyId.toString(),
    role: user.role?.code || null,
    permissions: user.permissions || [],
  };
}

async function expectCoverageError(action, expectedMessage) {
  let error = null;
  try {
    await action();
  } catch (caught) {
    error = caught;
  }

  assert(error, 'Se esperaba un error de cobertura y la operacion no fallo');
  assert(error.statusCode === 404, `Se esperaba 404 para cobertura fuera de alcance y se obtuvo ${error.statusCode || 'sin codigo'}`);
  if (expectedMessage) {
    assert(String(error.message || '').includes(expectedMessage), `El error no incluyo el mensaje esperado: ${expectedMessage}`);
  }
}

async function verifyDatabaseConnectivity() {
  await prisma.$queryRaw`SELECT 1`;
}

async function verifyClientSchemaCompatibility() {
  await prisma.client.findFirst({
    select: {
      id: true,
      companyId: true,
      isActive: true,
    },
  });
}

function readAgentWorkspaceValidationPassword() {
  const privatePassword = process.env.AGENT_WORKSPACE_VALIDATION_PASSWORD?.trim() || process.env.SEED_SALES_AGENT_PASSWORD?.trim();
  assert(privatePassword, 'Configure AGENT_WORKSPACE_VALIDATION_PASSWORD o SEED_SALES_AGENT_PASSWORD fuera de Git antes de ejecutar validate-agent-workspace.');
  return privatePassword;
}

async function loadAgentContext() {
  const agentAuth = await buildAuth('agente', readAgentWorkspaceValidationPassword());
  const agentUser = await prisma.user.findUnique({
    where: { username: 'agente' },
    include: {
      salesRouteAssignments: {
        where: { isActive: true },
        include: { salesRoute: true },
        orderBy: { id: 'asc' },
      },
    },
  });

  assert(agentUser, 'No se encontro el usuario agente sembrado');
  const coveredRouteIds = agentUser.salesRouteAssignments.map((assignment) => assignment.salesRouteId);
  assert(coveredRouteIds.length > 0, 'El agente sembrado no tiene rutas asignadas');

  return { agentAuth, agentUser, coveredRouteIds };
}

async function loadCoverageFixtures(agentUser, coveredRouteIds) {
  const coveredSubzone = await prisma.salesRouteSubzone.findFirst({
    where: { companyId: agentUser.companyId, salesRouteId: { in: coveredRouteIds } },
    orderBy: { id: 'asc' },
  });
  const uncoveredSubzone = await prisma.salesRouteSubzone.findFirst({
    where: { companyId: agentUser.companyId, salesRouteId: { notIn: coveredRouteIds } },
    orderBy: { id: 'asc' },
  });

  assert(coveredSubzone, 'No se encontro una subzona cubierta para validar estados del workspace');
  assert(uncoveredSubzone, 'No se encontro una subzona fuera de cobertura para validar restricciones del agente');

  const demoClient = await prisma.client.findFirst({
    where: { companyId: agentUser.companyId },
    orderBy: { id: 'asc' },
  });
  assert(demoClient, 'No se encontro un cliente para crear fixtures de validacion');

  return { coveredSubzone, uncoveredSubzone, demoClient };
}

async function refreshSeededStoreBaselineVisit({ cleanup, seededStore, agentAuth, agentUser, coveredRouteIds }) {
  if (seededStore.status === 'AL_DIA') {
    return seededStore;
  }

  const storeRecord = await prisma.clientStore.findUnique({
    where: { id: BigInt(seededStore.id) },
    select: {
      id: true,
      clientId: true,
      subregionId: true,
    },
  });
  assert(storeRecord, 'No se encontro la tienda sembrada para refrescar el baseline del workspace');

  const salesRouteId = seededStore.routeId ? BigInt(seededStore.routeId) : coveredRouteIds[0];
  assert(salesRouteId, 'No se encontro una ruta para refrescar la visita baseline del workspace');

  console.log(`[fixture] Refrescando baseline de ${seededStore.name} porque llego como ${seededStore.status}`);
  const baselineVisit = await prisma.routeVisitLog.create({
    data: {
      companyId: agentUser.companyId,
      salesRouteId,
      subregionId: storeRecord.subregionId,
      clientId: storeRecord.clientId,
      clientStoreId: storeRecord.id,
      userId: agentUser.id,
      motive: 'SEGUIMIENTO',
      result: 'EXITOSA',
      comment: 'Visita baseline refrescada por validate-agent-workspace',
      visitedAt: new Date(),
    },
  });
  cleanup.visitIds.push(baselineVisit.id);

  const refreshedStoreList = await agentWorkspaceService.listAgentStores({}, agentAuth);
  const refreshedSeededStore = refreshedStoreList.stores.find((store) => String(store.id) === String(seededStore.id));
  assert(refreshedSeededStore, 'No se encontro la tienda sembrada luego de refrescar la visita baseline');
  return refreshedSeededStore;
}

async function validateBaselineWorkspace({ cleanup, agentAuth, agentUser, coveredRouteIds }) {
  const storeList = await agentWorkspaceService.listAgentStores({}, agentAuth);
  assert(storeList.summary.total >= 1, 'El agente deberia ver al menos una tienda en cobertura');
  const visibleSeededStore = storeList.stores[0];
  const seededStore = await refreshSeededStoreBaselineVisit({
    cleanup,
    seededStore: visibleSeededStore,
    agentAuth,
    agentUser,
    coveredRouteIds,
  });
  assert(seededStore.status === 'AL_DIA', `La tienda sembrada deberia estar AL_DIA y se obtuvo ${seededStore.status}`);

  const detail = await agentWorkspaceService.getAgentStoreDetail(BigInt(seededStore.id), agentAuth);
  assert(Array.isArray(detail.purchaseHistory.orders), 'La ficha de tienda debe incluir historial de compras por tienda');
  assert(Array.isArray(detail.sellableProducts.products), 'La ficha de tienda debe incluir productos vendibles');

  return { seededStore, detail };
}

async function validateWorkspaceFilters(agentAuth) {
  const byName = await agentWorkspaceService.listAgentStores({ name: 'Tienda Demo' }, agentAuth);
  assert(byName.summary.total >= 1, 'El filtro por nombre debe devolver la tienda visible');
  const byZone = await agentWorkspaceService.listAgentStores({ zone: 'Escazu' }, agentAuth);
  assert(byZone.summary.total >= 1, 'El filtro por zona debe devolver la tienda visible');
  const noMatch = await agentWorkspaceService.listAgentStores({ name: 'sin-coincidencia-smoke' }, agentAuth);
  assert(noMatch.summary.total === 0, 'El filtro por nombre debe permitir resultados vacios');
}

async function createStatusFixtures({ cleanup, agentUser, demoClient, coveredSubzone, coveredRouteIds }) {
  const nearStore = await prisma.clientStore.create({
    data: {
      clientId: demoClient.id,
      legalEntityId: demoClient.legalEntityId,
      subregionId: coveredSubzone.subregionId,
      code: 'SMK-NEAR',
      name: 'Smoke Proxima',
      storeType: 'Retail',
      isPrimary: false,
      isActive: true,
      phone: '7000-1001',
      address: 'Subzona cubierta',
    },
  });
  cleanup.storeIds.push(nearStore.id);

  const newStore = await prisma.clientStore.create({
    data: {
      clientId: demoClient.id,
      legalEntityId: demoClient.legalEntityId,
      subregionId: coveredSubzone.subregionId,
      code: 'SMK-NEW',
      name: 'Smoke Nueva',
      storeType: 'Retail',
      isPrimary: false,
      isActive: true,
      phone: '7000-1002',
      address: 'Subzona cubierta',
    },
  });
  cleanup.storeIds.push(newStore.id);

  const nearVisit = await prisma.routeVisitLog.create({
    data: {
      companyId: agentUser.companyId,
      salesRouteId: coveredRouteIds[0],
      subregionId: nearStore.subregionId,
      clientId: demoClient.id,
      clientStoreId: nearStore.id,
      userId: agentUser.id,
      motive: 'SEGUIMIENTO',
      result: 'PENDIENTE',
      comment: 'Visita de humo para estado proximo a vencer',
      visitedAt: new Date(Date.now() - (13 * DAY_IN_MS)),
    },
  });
  cleanup.visitIds.push(nearVisit.id);

  return { nearStore, newStore };
}

async function validateStoreStatuses(agentAuth, seededStore, nearStore, newStore) {
  const refreshedStores = await agentWorkspaceService.listAgentStores({}, agentAuth);
  const nearCard = refreshedStores.stores.find((store) => String(store.id) === String(nearStore.id));
  const newCard = refreshedStores.stores.find((store) => String(store.id) === String(newStore.id));

  assert(nearCard?.status === 'PROXIMA_A_VENCER', `La tienda con visita a 13 dias deberia quedar PROXIMA_A_VENCER y se obtuvo ${nearCard?.status}`);
  assert(newCard?.status === 'NUEVA', `La tienda sin visitas deberia quedar NUEVA y se obtuvo ${newCard?.status}`);
  assert(refreshedStores.stores.findIndex((store) => String(store.id) === String(nearStore.id)) < refreshedStores.stores.findIndex((store) => String(store.id) === String(seededStore.id)), 'La tienda PROXIMA_A_VENCER debe priorizarse antes que una AL_DIA');
  assert(refreshedStores.stores.findIndex((store) => String(store.id) === String(newStore.id)) < refreshedStores.stores.findIndex((store) => String(store.id) === String(seededStore.id)), 'La tienda NUEVA debe priorizarse antes que una AL_DIA');
}

async function createOutsideCoverageStore(cleanup, demoClient, uncoveredSubzone) {
  const outsideStore = await prisma.clientStore.create({
    data: {
      clientId: demoClient.id,
      legalEntityId: demoClient.legalEntityId,
      subregionId: uncoveredSubzone.subregionId,
      code: 'SMK-OUT',
      name: 'Smoke Fuera Cobertura',
      storeType: 'Retail',
      isPrimary: false,
      isActive: true,
      phone: '7000-1003',
      address: 'Subzona no asignada al agente',
    },
  });
  cleanup.storeIds.push(outsideStore.id);
  return outsideStore;
}

async function validateOutsideCoverageRestrictions(agentAuth, outsideStore) {
  await expectCoverageError(
    () => agentWorkspaceService.getAgentStoreDetail(outsideStore.id, agentAuth),
    'La tienda no pertenece a la cobertura del agente',
  );
  await expectCoverageError(
    () => agentWorkspaceService.createAgentVisit({
      clientStoreId: outsideStore.id,
      motive: 'SEGUIMIENTO',
      result: 'PENDIENTE',
      comment: 'Intento fuera de cobertura',
    }, agentAuth),
    'La tienda no pertenece a la cobertura del agente',
  );
}

async function validateOrderOrigin(agentAuth, seededStore, detail, cleanup) {
  const firstProduct = detail.sellableProducts.products[0];
  assert(firstProduct, 'Se requiere al menos un producto vendible para validar el pedido del agente');

  const createdOrder = await agentWorkspaceService.createAgentStoreOrder(BigInt(seededStore.id), {
    responsible: 'Smoke Validation',
    notes: 'Validacion de tienda origen',
    items: [{
      productId: BigInt(firstProduct.id),
      quantity: 1,
      unitPrice: Number(firstProduct.price || 0),
      discountPercent: 0,
      discountAmount: 0,
      totalDiscount: 0,
    }],
  }, agentAuth);
  cleanup.orderIds.push(createdOrder.id);
  assert(String(createdOrder.clientStoreId) === String(seededStore.id), 'El pedido creado por el agente debe conservar la tienda origen');
}

async function validateNoCoverageScenario(agentUser, cleanup) {
  const salesAgentRole = await prisma.role.findUnique({ where: { code: 'sales_agent' } });
  assert(salesAgentRole, 'No se encontro el rol sales_agent para validar el caso sin cobertura');

  const noCoverageUser = await prisma.user.create({
    data: {
      fullName: 'Agente Sin Cobertura Smoke',
      email: 'smoke-no-coverage@inventori.local',
      username: 'smoke_no_coverage',
      passwordHash: agentUser.passwordHash,
      phone: '7000-2001',
      companyId: agentUser.companyId,
      roleId: salesAgentRole.id,
      status: 'ACTIVE',
    },
  });
  cleanup.userIds.push(noCoverageUser.id);

  const noCoverageAuth = {
    sub: noCoverageUser.id.toString(),
    companyId: noCoverageUser.companyId.toString(),
    role: 'sales_agent',
    permissions: ['clients.view', 'sales.orders.create', 'sales.routes.view.own', 'sales.goals.view.own', 'customer.activities.manage'],
  };

  const emptyDashboard = await agentWorkspaceService.listAgentDashboard(noCoverageAuth);
  const emptyGoals = await agentWorkspaceService.listAgentGoals(noCoverageAuth);
  const emptyStores = await agentWorkspaceService.listAgentStores({}, noCoverageAuth);
  assert(emptyDashboard.summary.routesAssignedCount === 0, 'Un agente sin cobertura no debe reportar rutas asignadas');
  assert(emptyStores.summary.total === 0, 'Un agente sin cobertura no debe ver tiendas');
  assert(Array.isArray(emptyGoals.goals) && emptyGoals.goals.length === 0, 'Un agente sin metas debe obtener una lista vacia de metas');
}

function validateFrontendSyncInvariant() {
  const workspaceJs = fs.readFileSync(path.join(__dirname, '../src/public/agent/workspace.js'), 'utf8');
  assert(workspaceJs.includes('function filteredStores()'), 'El workspace debe centralizar el filtro de lista');
  assert(workspaceJs.includes('function mapFilteredStores()'), 'El workspace debe centralizar el filtro del mapa');
  assert(workspaceJs.includes('const stores = filteredStores();'), 'El mapa debe partir del mismo conjunto filtrado que la lista para mantener sincronizacion');
}

async function cleanupFixtures(cleanup) {
  if (cleanup.orderIds.length) {
    await prisma.order.deleteMany({ where: { id: { in: cleanup.orderIds } } });
  }
  if (cleanup.visitIds.length) {
    await prisma.routeVisitLog.deleteMany({ where: { id: { in: cleanup.visitIds } } });
  }
  if (cleanup.storeIds.length) {
    await prisma.clientStore.deleteMany({ where: { id: { in: cleanup.storeIds } } });
  }
  if (cleanup.userIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: cleanup.userIds } } });
  }
}

async function main() {
  const cleanup = createCleanupState();
  const diagnosticState = createDiagnosticState();

  try {
    await runPhase(diagnosticState, 'Prerequisite checks', async () => {
      await verifyDatabaseConnectivity();
      await verifyClientSchemaCompatibility();
    });

    const { agentAuth, agentUser, coveredRouteIds } = await runPhase(diagnosticState, 'Load seeded agent context', async () => loadAgentContext());
    const { coveredSubzone, uncoveredSubzone, demoClient } = await runPhase(diagnosticState, 'Load route coverage fixtures', async () => loadCoverageFixtures(agentUser, coveredRouteIds));
    const { seededStore, detail } = await runPhase(diagnosticState, 'Validate baseline workspace visibility', async () => validateBaselineWorkspace({
      cleanup,
      agentAuth,
      agentUser,
      coveredRouteIds,
    }));

    await runPhase(diagnosticState, 'Validate workspace filters', async () => {
      await validateWorkspaceFilters(agentAuth);
    });

    const { nearStore, newStore } = await runPhase(diagnosticState, 'Create and validate store status fixtures', async () => {
      const fixtures = await createStatusFixtures({ cleanup, agentUser, demoClient, coveredSubzone, coveredRouteIds });
      await validateStoreStatuses(agentAuth, seededStore, fixtures.nearStore, fixtures.newStore);
      return fixtures;
    });

    await runPhase(diagnosticState, 'Validate outside-coverage restrictions', async () => {
      const outsideStore = await createOutsideCoverageStore(cleanup, demoClient, uncoveredSubzone);
      await validateOutsideCoverageRestrictions(agentAuth, outsideStore);
    });

    await runPhase(diagnosticState, 'Validate order keeps origin store', async () => {
      await validateOrderOrigin(agentAuth, seededStore, detail, cleanup);
    });

    await runPhase(diagnosticState, 'Validate no-coverage agent scenario', async () => {
      await validateNoCoverageScenario(agentUser, cleanup);
    });

    await runPhase(diagnosticState, 'Validate frontend list-map sync invariant', async () => {
      validateFrontendSyncInvariant();
    });

    void nearStore;
    void newStore;
    printSuccessSummary(diagnosticState);
  } catch (error) {
    printFailureSummary(error, diagnosticState);
    process.exitCode = 1;
  } finally {
    await cleanupFixtures(cleanup);
    await prisma.$disconnect();
  }
}

main();
