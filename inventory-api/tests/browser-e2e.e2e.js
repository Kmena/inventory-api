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

const restoreDbFreeAuditSeams = enableDbFreeAuditSeams();
process.on('exit', restoreDbFreeAuditSeams);
const {
  BROWSER_SESSION_COOKIE_NAME,
  BROWSER_SESSION_STATE_COOKIE_NAME,
  buildBrowserStateCookieValue,
} = require('../src/lib/browser-session');

function createBrowserSessionUser({
  id = '7',
  roleCode,
  companyId = null,
  permissions = [],
  fullName = 'Usuario Demo',
  username = 'demo',
} = {}) {
  return {
    id,
    fullName,
    username,
    companyId,
    role: {
      code: roleCode,
    },
    permissions,
  };
}

async function startServer() {
  return new Promise((resolve, reject) => {
    const sockets = new Set();
    const server = app.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Could not resolve browser E2E server address.'));
        return;
      }

      resolve({
        server,
        sockets,
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
    });

    server.on('connection', (socket) => {
      sockets.add(socket);
      socket.on('close', () => {
        sockets.delete(socket);
      });
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
    return {
      headless: true,
      executablePath: configuredExecutablePath,
    };
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
  if (discoveredExecutablePath) {
    return {
      headless: true,
      executablePath: discoveredExecutablePath,
    };
  }

  return { headless: true };
}

async function createBrowserPage(t, options = {}) {
  const browser = await chromium.launch(resolveBrowserLaunchOptions());
  const context = await browser.newContext(options);
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
  return browserSession;
}

test('browser E2E: a global root browser session sees Companies Admin only and can complete bounded company flows', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(() => stopServer(server, sockets));

  const page = await createBrowserPage(t);
  const rootUser = createBrowserSessionUser({
    id: '91',
    roleCode: 'root',
    fullName: 'Root Demo',
    username: 'root-demo',
  });
  const companies = [
    {
      id: 'cmp-1',
      name: 'Acme Demo',
      legalId: '3101123456',
      email: 'hola@acme.test',
      phone: '2222-0000',
      address: 'San Jose',
      isActive: true,
      createdAt: '2026-01-10T00:00:00.000Z',
      fiscalConfig: { identificationNumber: '3101123456' },
      users: [{ fullName: 'Ana Admin', username: 'ana-admin' }],
    },
  ];

  await page.route(`${baseUrl}/api/auth/me`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(rootUser),
    });
  });
  await page.route('**/api/companies/root/companies', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(companies) });
      return;
    }

    if (method === 'POST') {
      const payload = JSON.parse(route.request().postData() || '{}');
      const createdCompany = {
        id: 'cmp-2',
        name: payload.company.name,
        legalId: payload.company.legalId || payload.fiscalConfig.identificationNumber,
        email: payload.company.email || null,
        phone: payload.company.phone || null,
        address: payload.company.address || null,
        isActive: true,
        createdAt: '2026-07-30T00:00:00.000Z',
        fiscalConfig: { identificationNumber: payload.fiscalConfig.identificationNumber },
        users: [{ fullName: payload.rootUser.fullName, username: payload.rootUser.username }],
      };
      companies.push(createdCompany);
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(createdCompany) });
      return;
    }

    await route.fallback();
  });
  await page.route('**/api/companies/root/companies/*/status', async (route) => {
    const payload = JSON.parse(route.request().postData() || '{}');
    const companyId = route.request().url().split('/').slice(-2)[0];
    const company = companies.find((item) => item.id === companyId);
    if (company) {
      company.isActive = payload.isActive;
    }

    await route.fulfill({
      status: company ? 200 : 404,
      contentType: 'application/json',
      body: JSON.stringify(company || { message: 'Empresa no encontrada' }),
    });
  });
  await seedBrowserSession(page, baseUrl, rootUser);

  const response = await page.goto(`${baseUrl}/`);
  assert.equal(response.status(), 200);
  await page.waitForFunction(() => globalThis.location.pathname === '/root/' && globalThis.location.hash === '#home');
  await page.waitForSelector('#root-view-title');

  assert.match(await page.locator('#root-user-name').textContent(), /Root Demo/);
  assert.equal(await page.getByRole('link', { name: 'Empresas', exact: true }).count(), 1);
  assert.equal(await page.getByRole('link', { name: 'Roles y permisos', exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => globalThis.localStorage.getItem('inventory-api-auth')), null);

  await page.getByRole('link', { name: 'Empresas', exact: true }).click();
  await page.waitForFunction(() => globalThis.document.getElementById('root-view-title')?.textContent === 'Empresas');
  await page.waitForFunction(() => globalThis.document.getElementById('companies-list-region')?.textContent?.includes('Acme Demo'));

  await page.locator('input[name="company.name"]').fill('Beta Demo');
  await page.locator('input[name="fiscalConfig.legalName"]').fill('Beta Demo S.A.');
  await page.locator('input[name="fiscalConfig.identificationType"]').fill('JURIDICA');
  await page.locator('input[name="fiscalConfig.identificationNumber"]').fill('3102123456');
  await page.locator('input[name="rootUser.fullName"]').fill('Brenda Admin');
  await page.locator('input[name="rootUser.username"]').fill('brenda-admin');
  await page.locator('input[name="rootUser.password"]').fill('ContrasenaSegura1');
  await page.getByRole('button', { name: 'Crear empresa' }).click();

  await page.waitForFunction(() => globalThis.document.getElementById('companies-form-message')?.textContent?.includes('Empresa creada correctamente.'));
  await page.waitForFunction(() => globalThis.document.getElementById('companies-list-region')?.textContent?.includes('Beta Demo'));

  await page.getByRole('button', { name: 'Desactivar', exact: true }).first().click();
  await page.waitForFunction(() => globalThis.document.getElementById('companies-list-message')?.textContent?.includes('Estado de la empresa actualizado.'));
  await page.waitForFunction(() => globalThis.document.getElementById('companies-list-region')?.textContent?.includes('Activar'));
});

test('browser E2E: a company-admin browser session sees Roles y permisos only and can create a bounded company role', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(() => stopServer(server, sockets));

  const page = await createBrowserPage(t);
  const adminUser = createBrowserSessionUser({
    id: '77',
    roleCode: 'admin',
    companyId: '77',
    fullName: 'Admin Demo',
    username: 'admin-demo',
  });
  const permissions = [
    { code: 'orders.view', module: 'orders', action: 'view', isActive: true },
    { code: 'inventory.view', module: 'inventory', action: 'view', isActive: true },
  ];
  const roles = [
    { id: 'role-1', code: 'admin', name: 'Administrador', companyId: null, isActive: true, permissions },
  ];

  await page.route(`${baseUrl}/api/auth/me`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(adminUser),
    });
  });
  await page.route('**/api/roles/permissions', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(permissions) });
  });
  await page.route('**/api/roles/company', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(roles) });
      return;
    }

    if (method === 'POST') {
      const payload = JSON.parse(route.request().postData() || '{}');
      const createdRole = {
        id: 'role-2',
        code: 'company_77_visor',
        name: payload.name,
        companyId: '77',
        isActive: true,
        permissions: permissions.filter((permission) => payload.permissionCodes.includes(permission.code)),
      };
      roles.push(createdRole);
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(createdRole) });
      return;
    }

    await route.fallback();
  });
  await seedBrowserSession(page, baseUrl, adminUser);

  const response = await page.goto(`${baseUrl}/`);
  assert.equal(response.status(), 200);
  await page.waitForFunction(() => globalThis.location.pathname === '/root/' && globalThis.location.hash === '#home');
  await page.waitForSelector('#root-view-title');

  assert.match(await page.locator('#root-user-name').textContent(), /Admin Demo/);
  assert.equal(await page.getByRole('link', { name: 'Roles y permisos', exact: true }).count(), 1);
  assert.equal(await page.getByRole('link', { name: 'Empresas', exact: true }).count(), 0);

  await page.getByRole('link', { name: 'Roles y permisos', exact: true }).click();
  await page.waitForFunction(() => globalThis.document.getElementById('root-view-title')?.textContent === 'Roles y permisos');
  await page.waitForFunction(() => globalThis.document.getElementById('roles-list-region')?.textContent?.includes('Administrador'));
  await page.waitForFunction(() => globalThis.document.getElementById('roles-permissions-region')?.textContent?.includes('orders.view'));

  await page.locator('input[name="name"]').fill('Rol visor');
  await page.locator('input[name="permissionCodes"][value="orders.view"]').check();
  await page.getByRole('button', { name: 'Crear rol' }).click();

  await page.waitForFunction(() => globalThis.document.getElementById('roles-form-message')?.textContent?.includes('Rol creado correctamente.'));
  await page.waitForFunction(() => globalThis.document.getElementById('roles-list-region')?.textContent?.includes('Rol visor'));
  assert.equal(await page.getByRole('button', { name: /Editar|Eliminar/ }).count(), 0);
});

test('browser E2E: direct navigation to a retired legacy route returns the migration screen with 410 Gone instead of the old protected UI', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(() => stopServer(server, sockets));

  const page = await createBrowserPage(t);
  const response = await page.goto(`${baseUrl}/root/dashboard.html`);

  assert.equal(response.status(), 410);
  assert.match(await page.locator('#migration-title').textContent(), /Esta ruta ya no se encuentra disponible/);
  assert.match(await page.locator('#migration-home-link').textContent(), /Ir al inicio/);
});

test('browser E2E: login renders the form action above the fold at 1366x768', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(() => stopServer(server, sockets));

  const page = await createBrowserPage(t, { viewport: { width: 1366, height: 768 } });

  await page.goto(`${baseUrl}/`);
  const buttonBox = await page.locator('#login-button').boundingBox();

  assert.ok(buttonBox, 'login button should be rendered');
  assert.ok(buttonBox.y + buttonBox.height <= 768, 'login button should be visible without initial vertical scroll at 1366x768');
  assert.equal(await page.locator('#login-form-title').textContent(), 'Bienvenido de nuevo');
});

test('browser E2E: login shows a visible authentication error and restores the form state', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(() => stopServer(server, sockets));

  const page = await createBrowserPage(t);

  await page.route(`${baseUrl}/api/auth/me`, async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'unauthorized', message: 'Token no enviado' }),
    });
  });
  await page.route(`${baseUrl}/api/auth/login`, async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'unauthorized', message: 'Credenciales invalidas.' }),
    });
  });

  await page.goto(`${baseUrl}/`);
  await page.getByLabel('Usuario').fill('usuario-invalido');
  await page.getByLabel('Contrasena').fill('secreto-invalido');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await page.waitForFunction(() => {
    const loginMessage = globalThis.document.getElementById('login-message');
    const button = globalThis.document.getElementById('login-button');
    return loginMessage?.textContent?.includes('Usuario o contrasena incorrectos.') && button?.textContent === 'Iniciar sesión' && button?.disabled === false;
  });

  assert.match(await page.locator('#login-message').textContent(), /Usuario o contrasena incorrectos/);
});

test('browser E2E: root shell redirects invalid sessions back to login instead of trapping the user in the shell', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(() => stopServer(server, sockets));

  const page = await createBrowserPage(t);
  await page.route(`${baseUrl}/api/auth/me`, async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'unauthorized', message: 'Token no enviado' }),
    });
  });

  await page.goto(`${baseUrl}/root/`);
  await page.waitForURL(`${baseUrl}/?reason=session-expired`);
  assert.equal(await page.locator('#login-form-title').textContent(), 'Bienvenido de nuevo');
});

test('browser E2E: an existing warehouse browser session now lands on the supported transition page and can close the session from there', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(() => stopServer(server, sockets));

  const page = await createBrowserPage(t);
  await page.route(`${baseUrl}/api/auth/me`, async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'unauthorized', message: 'Token no enviado' }),
    });
  });
  await seedBrowserSession(page, baseUrl, createBrowserSessionUser({
    id: '21',
    roleCode: 'warehouse',
    companyId: 'cmp-21',
    permissions: ['warehouse.access'],
    fullName: 'Bodega Demo',
    username: 'warehouse-demo',
  }));

  await page.goto(`${baseUrl}/`);
  await page.waitForURL(`${baseUrl}/migration.html?mode=post-login-transition`);
  await page.waitForSelector('#migration-title');
  assert.match(await page.locator('#migration-title').textContent(), /Iniciaste sesion correctamente/);
  assert.equal(await page.locator('#migration-status-note').isHidden(), true);
  await page.getByRole('button', { name: 'Cerrar sesion' }).click();
  await page.waitForURL(`${baseUrl}/`);

  assert.equal(await page.locator('#login-form-title').textContent(), 'Bienvenido de nuevo');
});
