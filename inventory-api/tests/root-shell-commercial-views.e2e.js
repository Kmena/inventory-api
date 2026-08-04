const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.BROWSER_SESSION_STORE_MODE = 'memory';

const { chromium } = require('playwright');
const app = require('../src/app');
const { enableDbFreeAuditSeams } = require('./helpers/db-free-audit');
const browserSessionService = require('../src/services/browser-session.service');
const {
  BROWSER_SESSION_COOKIE_NAME,
  BROWSER_SESSION_STATE_COOKIE_NAME,
  buildBrowserStateCookieValue,
} = require('../src/lib/browser-session');

const restoreDbFreeAuditSeams = enableDbFreeAuditSeams();
process.on('exit', restoreDbFreeAuditSeams);

function createBrowserSessionUser({
  id = '77',
  roleCode = 'admin',
  companyId = '77',
  permissions = [],
  fullName = 'Admin Demo',
  username = 'admin-demo',
} = {}) {
  return {
    id,
    fullName,
    username,
    companyId,
    role: { code: roleCode },
    permissions,
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

async function startServer() {
  return new Promise((resolve, reject) => {
    const sockets = new Set();
    const server = app.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Could not resolve root-shell commercial views E2E server address.'));
        return;
      }

      resolve({ server, sockets, baseUrl: `http://127.0.0.1:${address.port}` });
    });

    server.on('connection', (socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    });
    server.on('error', reject);
  });
}

async function stopServer(server, sockets = new Set()) {
  for (const socket of sockets) {
    socket.destroy();
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function resolveBrowserLaunchOptions() {
  const configuredExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (configuredExecutablePath) {
    return { headless: true, executablePath: configuredExecutablePath };
  }

  const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files';
  const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
  const candidateExecutablePaths = [
    path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ];

  const discoveredExecutablePath = candidateExecutablePaths.find((candidatePath) => fs.existsSync(candidatePath));
  return discoveredExecutablePath ? { headless: true, executablePath: discoveredExecutablePath } : { headless: true };
}

async function createBrowserPage(t, viewport = { width: 1366, height: 900 }) {
  const browser = await chromium.launch(resolveBrowserLaunchOptions());
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  t.after(async () => {
    await context.close();
    await browser.close();
  });

  return page;
}

async function seedBrowserSession(page, baseUrl, user) {
  const browserSession = await browserSessionService.createBrowserSession(BigInt(user.id));
  await page.context().addCookies([
    {
      name: BROWSER_SESSION_COOKIE_NAME,
      value: browserSession.sessionId,
      url: baseUrl,
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: BROWSER_SESSION_STATE_COOKIE_NAME,
      value: buildBrowserStateCookieValue(user),
      url: baseUrl,
      sameSite: 'Lax',
    },
  ]);
}

async function stubAuthMe(page, baseUrl, user) {
  await page.route(`${baseUrl}/api/auth/me`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(user),
    });
  });
}

async function openCompanyAdminView(page, baseUrl, linkName, expectedHash, expectedTitle) {
  await page.goto(`${baseUrl}/root/`);
  await page.waitForFunction(() => globalThis.location.hash === '#admin_home');
  await page.getByRole('link', { name: linkName, exact: true }).click();
  await page.waitForFunction((hash) => globalThis.location.hash === hash, expectedHash);
  await page.waitForFunction((title) => globalThis.document.getElementById('root-view-title')?.textContent === title, expectedTitle);
}

async function stubAgentsRuntime(page, baseUrl, user) {
  const state = {
    users: [
      { id: 10, fullName: 'Ana Perez', username: 'ana', email: 'ana@test.dev', phone: '555-0101', status: 'ACTIVE', role: { id: 1, code: 'sales_agent', name: 'Agente comercial' } },
      { id: 11, fullName: 'Luis Mora', username: 'luis', email: 'luis@test.dev', phone: '555-0102', status: 'ACTIVE', role: { id: 2, code: 'sales_supervisor', name: 'Supervisor comercial' } },
    ],
    roles: [
      { id: 1, code: 'sales_agent', name: 'Agente comercial' },
      { id: 2, code: 'sales_supervisor', name: 'Supervisor comercial' },
    ],
    routesOverview: {
      routes: [
        { id: 201, code: 'RN-01', name: 'Ruta Norte', agentIds: [10] },
        { id: 202, code: 'RS-02', name: 'Ruta Sur', agentIds: [] },
      ],
      agents: [
        { id: 10, goalsCount: 1, goals: [{ title: 'Meta Norte', periodLabel: 'Mensual', targetAmount: 20, currentAmount: 6 }] },
        { id: 11, goalsCount: 0, goals: [] },
      ],
    },
    counters: {
      listUsers: 0,
      listRoles: 0,
      listRoutesOverview: 0,
      createUser: 0,
      saveAssignments: 0,
    },
  };

  await stubAuthMe(page, baseUrl, user);

  await page.route('**/api/users/company', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      state.counters.listUsers += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cloneJson(state.users)) });
      return;
    }

    if (method === 'POST') {
      state.counters.createUser += 1;
      const payload = JSON.parse(route.request().postData() || '{}');
      const role = state.roles.find((item) => Number(item.id) === Number(payload.roleId));
      const createdUser = {
        id: 12,
        fullName: payload.fullName,
        username: payload.username,
        email: payload.email || null,
        phone: payload.phone || null,
        status: 'ACTIVE',
        role,
      };
      state.users.push(createdUser);
      state.routesOverview.agents.push({ id: 12, goalsCount: 0, goals: [] });
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(createdUser) });
      return;
    }

    await route.fallback();
  });

  await page.route('**/api/roles/company', async (route) => {
    state.counters.listRoles += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cloneJson(state.roles)) });
  });

  await page.route('**/api/sales-routes/company', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    state.counters.listRoutesOverview += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cloneJson(state.routesOverview)) });
  });

  await page.route('**/api/sales-routes/company/*/assignments', async (route) => {
    state.counters.saveAssignments += 1;
    const payload = JSON.parse(route.request().postData() || '{}');
    const routeId = Number(route.request().url().split('/').slice(-2)[0]);
    const currentRoute = state.routesOverview.routes.find((item) => Number(item.id) === routeId);
    if (currentRoute) {
      currentRoute.agentIds = (payload.userIds || []).map(Number);
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: routeId, userIds: payload.userIds || [] }),
    });
  });

  return state;
}

async function stubClientsRuntime(page, baseUrl, user) {
  const classifications = [
    { id: 1, name: 'Preferente' },
    { id: 2, name: 'Mayorista' },
  ];
  const documentTypes = [
    { value: 'DPI', label: 'DPI' },
    { value: 'NIT', label: 'NIT' },
  ];
  const zones = [
    {
      id: 1,
      name: 'Zona Norte',
      subregions: [
        { id: 101, name: 'Subzona Norte 1' },
        { id: 102, name: 'Subzona Norte 2' },
      ],
    },
  ];
  const detailByClientId = {
    301: {
      id: 301,
      name: 'Cliente Norte',
      code: 'CN-01',
      clientClassificationId: 1,
      classification: { id: 1, name: 'Preferente' },
      phone: '555-0201',
      legalId: '1234567-8',
      documentType: 'NIT',
      emailBilling: 'clientes@norte.test',
      paymentType: 'CREDIT',
      paymentDays: 15,
      creditLimit: 1000,
      address: 'Zona Norte',
      isActive: true,
      stores: [],
      documents: [],
      references: [],
    },
  };

  const state = {
    clients: [
      { id: 301, name: 'Cliente Norte', code: 'CN-01', clientClassificationId: 1, classification: { id: 1, name: 'Preferente' }, phone: '555-0201', isActive: true, storesCount: 0, documents: [] },
      { id: 302, name: 'Cliente Sur', code: 'CS-02', clientClassificationId: 2, classification: { id: 2, name: 'Mayorista' }, phone: '555-0202', isActive: true, storesCount: 1, documents: [{ id: 1 }] },
    ],
    detailByClientId,
    counters: {
      listClients: 0,
      loadDetail: 0,
      updateClient: 0,
      createStore: 0,
      lookupTaxpayer: 0,
    },
  };

  await stubAuthMe(page, baseUrl, user);

  await page.route('**/api/clients/company', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    state.counters.listClients += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: cloneJson(state.clients) }) });
  });

  await page.route('**/api/clients/classifications/company', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cloneJson(classifications)) });
  });

  await page.route('**/api/clients/document-types', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cloneJson(documentTypes)) });
  });

  await page.route('**/api/regions/company', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cloneJson(zones)) });
  });

  await page.route('**/api/taxpayers/lookup*', async (route) => {
    state.counters.lookupTaxpayer += 1;
    const url = new URL(route.request().url());
    assert.equal(url.searchParams.get('identification'), '3-101-123456');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        name: 'Cliente Norte Hacienda',
        economicActivityCode: '6201',
        economicActivityName: 'Servicios administrados',
      }),
    });
  });

  await page.route('**/api/clients/*', async (route) => {
    const url = new URL(route.request().url());
    const segments = url.pathname.split('/').filter(Boolean);
    const method = route.request().method();
    const clientId = Number(segments[segments.indexOf('clients') + 1]);

    if (!Number.isFinite(clientId)
      || segments.at(-1) === 'references'
      || segments.at(-1) === 'documents'
      || segments.at(-1) === 'download') {
      await route.fallback();
      return;
    }

    if (method === 'GET') {
      state.counters.loadDetail += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cloneJson(state.detailByClientId[clientId])) });
      return;
    }

    if (method === 'PUT') {
      state.counters.updateClient += 1;
      const payload = JSON.parse(route.request().postData() || '{}');
      const detail = state.detailByClientId[clientId];
      Object.assign(detail, payload, {
        classification: classifications.find((item) => Number(item.id) === Number(payload.clientClassificationId)) || detail.classification,
      });
      const listItem = state.clients.find((item) => Number(item.id) === clientId);
      Object.assign(listItem, payload, {
        classification: detail.classification,
      });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cloneJson(detail)) });
      return;
    }

    await route.fallback();
  });

  await page.route('**/api/clients/company/*/stores', async (route) => {
    state.counters.createStore += 1;
    const payload = JSON.parse(route.request().postData() || '{}');
    const clientId = Number(route.request().url().split('/').slice(-2)[0]);
    const detail = state.detailByClientId[clientId];
    const createdStore = {
      id: 401,
      name: payload.name,
      code: payload.code || null,
      phone: payload.phone || null,
      subregion: { id: payload.subregionId, name: 'Subzona Norte 2' },
    };
    detail.stores.push(createdStore);
    const listItem = state.clients.find((item) => Number(item.id) === clientId);
    listItem.storesCount = detail.stores.length;
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(cloneJson(createdStore)) });
  });

  return state;
}

async function stubRoutesRuntime(page, baseUrl, user) {
  const detailByRouteId = {
    501: {
      id: 501,
      code: 'RN-01',
      name: 'Ruta Norte',
      visitFrequencyDays: 7,
      nearLimitDays: 2,
      isActive: true,
      subzoneIds: [101],
      agentIds: [10],
      agents: [
        {
          id: 10,
          fullName: 'Ana Perez',
          username: 'ana',
          role: { code: 'sales_agent', name: 'Agente comercial' },
          goals: [{ title: 'Meta Norte', periodLabel: 'Mensual', targetAmount: 20, currentAmount: 5, isActive: true }],
        },
      ],
      stores: [
        { id: 801, code: 'T-1', name: 'Tienda Norte 1', clientName: 'Cliente Norte', subregionName: 'Subzona Norte 1', latitude: 14.6349, longitude: -90.5069 },
        { id: 802, code: 'T-2', name: 'Tienda Norte 2', clientName: 'Cliente Norte', subregionName: 'Subzona Norte 1', latitude: 14.6249, longitude: -90.4969 },
      ],
    },
  };

  const state = {
    overview: {
      summary: { routesCount: 1, subzonesCount: 1, storesCount: 2, assignedAgentsCount: 1 },
      routes: [{ id: 501, code: 'RN-01', name: 'Ruta Norte', isActive: true, subzonesCount: 1, assignmentsCount: 1, agentIds: [10] }],
      zones: [{ id: 1, name: 'Zona Norte', subregions: [{ id: 101, name: 'Subzona Norte 1' }, { id: 102, name: 'Subzona Norte 2' }] }],
      agents: [
        { id: 10, fullName: 'Ana Perez', username: 'ana', role: { code: 'sales_agent', name: 'Agente comercial' }, goals: detailByRouteId[501].agents[0].goals },
        { id: 11, fullName: 'Luis Mora', username: 'luis', role: { code: 'sales_supervisor', name: 'Supervisor comercial' }, goals: [] },
      ],
    },
    detailByRouteId,
    counters: {
      listOverview: 0,
      loadDetail: 0,
      saveAssignments: 0,
      saveGoals: 0,
    },
  };

  await stubAuthMe(page, baseUrl, user);

  await page.route('**/api/sales-routes/company', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    state.counters.listOverview += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cloneJson(state.overview)) });
  });

  await page.route('**/api/sales-routes/company/agents/*/goals', async (route) => {
    state.counters.saveGoals += 1;
    const payload = JSON.parse(route.request().postData() || '{}');
    const userId = Number(route.request().url().split('/').slice(-2)[0]);
    const routeDetail = state.detailByRouteId[501];
    const routeAgent = routeDetail.agents.find((item) => Number(item.id) === userId);
    if (routeAgent) {
      routeAgent.goals = cloneJson(payload.goals || []);
    }
    const overviewAgent = state.overview.agents.find((item) => Number(item.id) === userId);
    if (overviewAgent) {
      overviewAgent.goals = cloneJson(payload.goals || []);
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ goals: payload.goals || [] }) });
  });

  await page.route('**/api/sales-routes/company/*', async (route) => {
    const url = new URL(route.request().url());
    const segments = url.pathname.split('/').filter(Boolean);
    const method = route.request().method();
    const routeId = Number(segments[segments.indexOf('company') + 1]);
    const lastSegment = segments.at(-1);

    if (lastSegment === 'assignments' || lastSegment === 'subzones') {
      await route.fallback();
      return;
    }

    if (method === 'GET') {
      state.counters.loadDetail += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cloneJson(state.detailByRouteId[routeId])) });
      return;
    }

    await route.fallback();
  });

  await page.route('**/api/sales-routes/company/*/assignments', async (route) => {
    state.counters.saveAssignments += 1;
    const payload = JSON.parse(route.request().postData() || '{}');
    const routeId = Number(route.request().url().split('/').slice(-2)[0]);
    const detail = state.detailByRouteId[routeId];
    detail.agentIds = (payload.userIds || []).map(Number);
    detail.agents = state.overview.agents
      .filter((agent) => detail.agentIds.includes(Number(agent.id)))
      .map((agent) => ({ ...cloneJson(agent), goals: cloneJson(agent.goals || []) }));
    const overviewRoute = state.overview.routes.find((item) => Number(item.id) === routeId);
    overviewRoute.agentIds = detail.agentIds.slice();
    overviewRoute.assignmentsCount = detail.agentIds.length;
    state.overview.summary.assignedAgentsCount = detail.agentIds.length;

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ userIds: payload.userIds || [] }) });
  });

  return state;
}

test('commercial views E2E: agents supports local filtering, agent creation, and route assignment saves', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(() => stopServer(server, sockets));

  const page = await createBrowserPage(t);
  const adminUser = createBrowserSessionUser();
  const state = await stubAgentsRuntime(page, baseUrl, adminUser);
  await seedBrowserSession(page, baseUrl, adminUser);
  await openCompanyAdminView(page, baseUrl, 'Agentes', '#agents', 'Agentes comerciales');

  assert.equal(await page.getByRole('heading', { name: 'Agentes comerciales' }).isVisible(), true);
  assert.equal(await page.getByText('Equipo comercial').isVisible(), true);
  await page.waitForFunction(() => globalThis.document.getElementById('agents-metric-total')?.textContent === '2');
  await page.waitForFunction(() => globalThis.document.querySelector('[data-agent-select]')?.classList.contains('active'));
  assert.equal(state.counters.listUsers, 1);
  assert.equal(state.counters.listRoutesOverview, 1);

  await page.locator('#agents-search-input').fill('luis');
  await page.waitForFunction(() => globalThis.document.querySelectorAll('[data-agent-select]').length === 1);
  assert.equal(state.counters.listUsers, 1, 'agents search should stay local');

  await page.locator('#agents-search-input').fill('');
  await page.getByRole('button', { name: 'Nuevo agente' }).click();
  await page.waitForFunction(() => globalThis.document.getElementById('agents-create-dialog')?.open === true);
  await page.locator('input[name="fullName"]').fill('Carla Soto');
  await page.locator('input[name="username"]').fill('carla');
  await page.locator('input[name="password"]').fill('ContrasenaSegura1');
  await page.locator('#agents-role-select').selectOption('1');
  await page.getByRole('button', { name: 'Crear agente' }).click();
  await page.waitForFunction(() => globalThis.document.getElementById('agents-page-message')?.textContent?.includes('Agente creado correctamente.'));
  await page.waitForFunction(() => globalThis.document.getElementById('agents-create-dialog')?.open === false);
  await page.waitForFunction(() => globalThis.document.getElementById('agents-metric-total')?.textContent === '3');
  assert.equal(state.counters.createUser, 1);

  await page.locator('[data-agent-select="10"]').click();
  await page.waitForFunction(() => globalThis.document.getElementById('agents-detail-title')?.textContent?.includes('Ana Perez'));
  await page.waitForFunction(() => globalThis.document.querySelector('[data-agent-select="10"]')?.classList.contains('active'));
  assert.equal(await page.getByRole('link', { name: 'Gestionar en rutas' }).isVisible(), true);
  await page.locator('input[name="routeIds"][value="202"]').check();
  await page.getByRole('button', { name: 'Guardar rutas asignadas' }).click();
  await page.waitForFunction(() => globalThis.document.getElementById('agents-detail-message')?.textContent?.includes('Rutas asignadas correctamente.'));
  assert.equal(state.counters.saveAssignments, 1);
  assert.deepEqual(state.routesOverview.routes.find((route) => route.id === 202)?.agentIds, [10]);
});

test('commercial views E2E: clients supports local filtering and update plus store append flows', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(() => stopServer(server, sockets));

  const page = await createBrowserPage(t);
  const adminUser = createBrowserSessionUser();
  const state = await stubClientsRuntime(page, baseUrl, adminUser);
  await seedBrowserSession(page, baseUrl, adminUser);
  await openCompanyAdminView(page, baseUrl, 'Clientes', '#clients', 'Clientes');

  assert.equal(await page.getByRole('heading', { name: 'Clientes', exact: true }).isVisible(), true);
  assert.equal(await page.getByText('Base de clientes').isVisible(), true);
  await page.waitForFunction(() => globalThis.document.querySelectorAll('[data-client-select]').length === 2);
  await page.waitForFunction(() => globalThis.document.getElementById('clients-detail-title')?.textContent?.includes('Cliente Norte'));
  assert.equal(state.counters.listClients, 1);

  await page.locator('#clients-search-input').fill('norte');
  await page.waitForFunction(() => globalThis.document.querySelectorAll('[data-client-select]').length === 1);
  assert.equal(state.counters.listClients, 1, 'clients search should stay local');

  await page.locator('[data-client-select="301"]').click();
  await page.waitForFunction(() => globalThis.document.getElementById('clients-detail-title')?.textContent?.includes('Cliente Norte'));
  await page.waitForFunction(() => globalThis.document.querySelector('[data-client-select="301"]')?.classList.contains('active'));
  assert.equal(await page.getByText('Detalle contextual').isVisible(), true);
  assert.equal(await page.getByRole('button', { name: 'Desactivar cliente' }).isVisible(), true);
  assert.equal(state.counters.loadDetail, 1);

  await page.locator('#clients-update-form input[name="legalId"]').fill('3-101-123456');
  await page.getByRole('button', { name: 'Consultar identificacion' }).click();
  await page.waitForFunction(() => globalThis.document.getElementById('clients-detail-message')?.textContent?.includes('Consulta completada.'));
  await page.waitForFunction(() => globalThis.document.querySelector('#clients-update-form input[name="name"]')?.value === 'Cliente Norte Hacienda');
  assert.equal(state.counters.lookupTaxpayer, 1);

  await page.locator('#clients-update-form input[name="phone"]').fill('555-9999');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await page.waitForFunction(() => globalThis.document.getElementById('clients-detail-message')?.textContent?.includes('Cliente actualizado correctamente.'));
  assert.equal(state.counters.updateClient, 1);
  assert.equal(state.detailByClientId[301].phone, '555-9999');

  await page.getByRole('button', { name: 'Nuevo cliente' }).click();
  await page.waitForFunction(() => globalThis.document.getElementById('clients-create-dialog')?.open === true);
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.waitForFunction(() => globalThis.document.getElementById('clients-create-dialog')?.open === false);

  await page.locator('#clients-detail-region #clients-store-form input[name="name"]').fill('Sucursal Norte 2');
  await page.locator('#clients-detail-region #clients-store-form select[name="subregionId"]').selectOption('102');
  await page.locator('#clients-detail-region #clients-store-form input[name="code"]').fill('SN-02');
  await page.getByRole('button', { name: 'Agregar tienda' }).click();
  await page.waitForFunction(() => globalThis.document.getElementById('clients-detail-message')?.textContent?.includes('Tienda creada correctamente.'));
  await page.waitForFunction(() => globalThis.document.getElementById('clients-detail-region')?.textContent?.includes('Sucursal Norte 2'));
  assert.equal(state.counters.createStore, 1);
});

test('commercial views E2E: routes shows map coverage and persists assignment plus goals updates', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(() => stopServer(server, sockets));

  const page = await createBrowserPage(t);
  const adminUser = createBrowserSessionUser();
  const state = await stubRoutesRuntime(page, baseUrl, adminUser);
  await seedBrowserSession(page, baseUrl, adminUser);
  await openCompanyAdminView(page, baseUrl, 'Rutas', '#routes', 'Rutas comerciales');

  assert.equal(await page.getByRole('heading', { name: 'Rutas comerciales' }).isVisible(), true);
  assert.equal(await page.getByText('Rutas de la empresa').isVisible(), true);
  await page.waitForFunction(() => globalThis.document.getElementById('routes-metric-total')?.textContent === '1');
  assert.equal(state.counters.listOverview, 1);

  await page.locator('#routes-search-input').fill('norte');
  await page.waitForFunction(() => globalThis.document.querySelectorAll('[data-route-select]').length === 1);
  assert.equal(state.counters.listOverview, 1, 'routes search should stay local');

  await page.getByRole('button', { name: 'Nueva ruta' }).click();
  await page.waitForFunction(() => globalThis.document.getElementById('routes-create-dialog')?.open === true);
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.waitForFunction(() => globalThis.document.getElementById('routes-create-dialog')?.open === false);

  await page.locator('[data-route-select="501"]').click();
  await page.waitForFunction(() => globalThis.document.getElementById('routes-detail-title')?.textContent?.includes('Ruta Norte'));
  await page.waitForFunction(() => globalThis.document.querySelector('[data-route-select="501"]')?.classList.contains('active'));
  await page.waitForFunction(() => globalThis.document.querySelectorAll('[data-map-point]').length === 2);
  assert.equal(await page.locator('[data-route-map]').isVisible(), true);
  assert.equal(await page.getByText('Mapa de cobertura').isVisible(), true);
  assert.equal(state.counters.loadDetail, 1);

  await page.locator('#routes-detail-region input[name="userIds"][value="11"]').check();
  await page.getByRole('button', { name: 'Guardar agentes' }).click();
  await page.waitForFunction(() => globalThis.document.getElementById('routes-detail-message')?.textContent?.includes('Agentes asignados correctamente.'));
  assert.equal(state.counters.saveAssignments, 1);
  assert.deepEqual(state.detailByRouteId[501].agentIds, [10, 11]);

  await page.getByRole('button', { name: 'Agregar meta' }).click();
  await page.locator('#routes-detail-region input[data-goal-field="title"][data-goal-index="1"]').fill('Meta Extra');
  await page.locator('#routes-detail-region input[data-goal-field="periodLabel"][data-goal-index="1"]').fill('Semanal');
  await page.locator('#routes-detail-region input[data-goal-field="targetAmount"][data-goal-index="1"]').fill('12');
  await page.locator('#routes-detail-region input[data-goal-field="currentAmount"][data-goal-index="1"]').fill('3');
  await page.getByRole('button', { name: 'Guardar metas' }).click();
  await page.waitForFunction(() => globalThis.document.getElementById('routes-detail-message')?.textContent?.includes('Metas guardadas correctamente.'));
  assert.equal(state.counters.saveGoals, 1);
  assert.equal(state.detailByRouteId[501].agents[0].goals[1].title, 'Meta Extra');
});
