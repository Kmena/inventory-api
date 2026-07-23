const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { chromium } = require('playwright');

const app = require('../src/app');

const STORAGE_KEY = 'inventory-api-auth';

function createSession({
  roleCode,
  companyId = null,
  permissions = [],
  fullName = 'Usuario Demo',
  username = 'demo',
} = {}) {
  return {
    token: 'browser-e2e-token',
    user: {
      id: 'user-browser-e2e',
      fullName,
      username,
      companyId,
      role: {
        code: roleCode,
      },
      permissions,
    },
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
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      for (const socket of sockets) {
        socket.destroy();
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

async function createBrowserPage(t) {
  const browser = await chromium.launch(resolveBrowserLaunchOptions());
  const context = await browser.newContext();
  const page = await context.newPage();

  t.after(async () => {
    await context.close();
    await browser.close();
  });

  return page;
}

async function seedSession(page, baseUrl, session) {
  await page.goto(`${baseUrl}/`);
  await page.evaluate(({ storageKey, serializedSession }) => {
    globalThis.localStorage.setItem(storageKey, serializedSession);
  }, {
    storageKey: STORAGE_KEY,
    serializedSession: JSON.stringify(session),
  });
}

async function stubWarehouseRuntimeDependencies(page) {
  await page.route('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'window.XLSX = { read() { return { SheetNames: [\'Sheet1\'], Sheets: { Sheet1: {} } }; }, utils: { sheet_to_json() { return []; } } };',
    });
  });
}

test('browser E2E: login redirects an authenticated company admin to the executive dashboard and renders live data', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(() => stopServer(server, sockets));

  const page = await createBrowserPage(t);
  let receivedLoginPayload = null;

  await page.route(`${baseUrl}/api/auth/login`, async (route) => {
    receivedLoginPayload = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(createSession({
        roleCode: 'admin',
        companyId: 'cmp-77',
        fullName: 'Admin Demo',
        username: 'admin-demo',
      })),
    });
  });

  await page.route(`${baseUrl}/api/companies/company/dashboard`, async (route) => {
    assert.equal(await route.request().headerValue('authorization'), 'Bearer browser-e2e-token');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        company: {
          name: 'Farmacia Central',
          isActive: true,
          legalId: '3-101-999999',
          description: 'Cobertura comercial prioritaria.',
          fiscalConfig: {
            identificationNumber: '3-101-999999',
          },
        },
        metrics: {
          employeesCount: 12,
        },
      }),
    });
  });

  await page.goto(`${baseUrl}/`);
  await page.getByLabel('Usuario').fill('admin-demo');
  await page.getByLabel('Contrasena').fill('secret-demo');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await page.waitForURL(`${baseUrl}/root/dashboard.html`);
  await page.waitForSelector('#company-name');

  assert.deepEqual(receivedLoginPayload, {
    username: 'admin-demo',
    password: 'secret-demo',
  });
  assert.equal(await page.locator('#company-name').textContent(), 'Farmacia Central');
  assert.equal(await page.locator('#employees-count').textContent(), '12');
  assert.match(await page.locator('#root-session').textContent(), /Admin Demo/);

  const storedSession = await page.evaluate((storageKey) => JSON.parse(globalThis.localStorage.getItem(storageKey)), STORAGE_KEY);
  assert.equal(storedSession?.user?.role?.code, 'admin');
  assert.equal(storedSession?.user?.companyId, 'cmp-77');
});

test('browser E2E: direct navigation to a protected executive screen redirects anonymous users to the public login', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(() => stopServer(server, sockets));

  const page = await createBrowserPage(t);

  await page.goto(`${baseUrl}/root/dashboard.html`);
  await page.waitForURL(`${baseUrl}/`);

  assert.equal(await page.locator('h1').textContent(), 'Login');
});

test('browser E2E: login shows a visible authentication error and restores the form state', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(() => stopServer(server, sockets));

  const page = await createBrowserPage(t);

  await page.route(`${baseUrl}/api/auth/login`, async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'invalid_credentials',
        message: 'Credenciales invalidas.',
      }),
    });
  });

  await page.goto(`${baseUrl}/`);
  await page.getByLabel('Usuario').fill('usuario-invalido');
  await page.getByLabel('Contrasena').fill('secreto-invalido');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await page.waitForFunction(() => {
    const message = globalThis.document.getElementById('login-message');
    const button = globalThis.document.getElementById('login-button');
    return message?.textContent?.includes('Usuario o contrasena incorrectos.') && button?.textContent === 'Entrar' && button?.disabled === false;
  });

  assert.equal(await page.locator('#login-message').textContent(), 'Usuario o contrasena incorrectos.');
  assert.equal(await page.locator('#login-button').textContent(), 'Entrar');
  assert.equal(await page.locator('#login-button').isDisabled(), false);
});

test('browser E2E: corrupt stored login session does not break bootstrap and is cleared before normal login continues', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(() => stopServer(server, sockets));

  const page = await createBrowserPage(t);
  let receivedLoginPayload = null;

  await page.route(`${baseUrl}/api/auth/login`, async (route) => {
    receivedLoginPayload = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(createSession({
        roleCode: 'admin',
        companyId: 'cmp-corrupt',
        fullName: 'Admin Recuperado',
        username: 'admin-recuperado',
      })),
    });
  });

  await page.route(`${baseUrl}/api/companies/company/dashboard`, async (route) => {
    assert.equal(await route.request().headerValue('authorization'), 'Bearer browser-e2e-token');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        company: {
          name: 'Empresa Recuperada',
          isActive: true,
          legalId: '3-101-123456',
          description: 'Validacion de storage corrupto.',
          fiscalConfig: {
            identificationNumber: '3-101-123456',
          },
        },
        metrics: {
          employeesCount: 4,
        },
      }),
    });
  });

  await page.goto(`${baseUrl}/`);
  await page.evaluate(({ storageKey }) => {
    globalThis.localStorage.setItem(storageKey, '{sesion-corrupta');
  }, { storageKey: STORAGE_KEY });

  await page.goto(`${baseUrl}/`);
  await page.waitForURL(`${baseUrl}/`);

  assert.equal(await page.locator('h1').textContent(), 'Login');
  assert.equal(await page.evaluate((storageKey) => globalThis.localStorage.getItem(storageKey), STORAGE_KEY), null);

  await page.getByLabel('Usuario').fill('admin-recuperado');
  await page.getByLabel('Contrasena').fill('secret-recuperado');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await page.waitForURL(`${baseUrl}/root/dashboard.html`);
  assert.deepEqual(receivedLoginPayload, {
    username: 'admin-recuperado',
    password: 'secret-recuperado',
  });
  assert.equal(await page.locator('#company-name').textContent(), 'Empresa Recuperada');
});

test('browser E2E: an existing warehouse session redirects immediately to the approved landing', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(() => stopServer(server, sockets));

  const page = await createBrowserPage(t);
  await stubWarehouseRuntimeDependencies(page);

  await page.route(`${baseUrl}/api/warehouses/company`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    });
  });

  await page.route(`${baseUrl}/api/products`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route(`${baseUrl}/api/inventory/alerts?page=1&pageSize=20`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    });
  });

  await seedSession(page, baseUrl, createSession({
    roleCode: 'warehouse',
    companyId: 'cmp-existing-warehouse',
    username: 'warehouse-existing',
    fullName: 'Warehouse Existing',
    permissions: ['warehouse.access'],
  }));

  await page.goto(`${baseUrl}/`);
  await page.waitForURL(`${baseUrl}/warehouse/products.html`);
  assert.match(await page.locator('#welcome-message').textContent(), /Warehouse Existing/);
});

test('browser E2E: warehouse users can inspect inventory alerts and are logged out on unauthorized API responses', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(() => stopServer(server, sockets));

  const warehouseSession = createSession({
    roleCode: 'warehouse',
    companyId: 'cmp-warehouse-1',
    username: 'warehouse-demo',
    fullName: 'Warehouse Demo',
    permissions: ['warehouse.access', 'inventory.view'],
  });

  const page = await createBrowserPage(t);
  await stubWarehouseRuntimeDependencies(page);
  await seedSession(page, baseUrl, warehouseSession);

  await page.route(`${baseUrl}/api/warehouses/company`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'wh-1',
            code: 'CENTRAL',
            name: 'Bodega Central',
            isActive: true,
          },
        ],
      }),
    });
  });

  await page.route(`${baseUrl}/api/products`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'prod-1',
          code: 'PT-001',
          name: 'Jarabe infantil',
          unit: 'UN',
          price: '1250.00',
          quantity: '24',
          reservedQuantity: '3',
          warehouseLotStocks: [],
        },
      ]),
    });
  });

  await page.route(`${baseUrl}/api/inventory/alerts?page=1&pageSize=20`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'alert-1',
            status: 'NEW',
            alertType: 'LOW_STOCK',
            severity: 'HIGH',
            message: 'Stock bajo detectado',
            availableActions: [],
            product: { name: 'Jarabe infantil' },
            lot: { internalLotNumber: 'LOT-01' },
            warehouse: { name: 'Bodega Central' },
          },
        ],
      }),
    });
  });

  await page.route(`${baseUrl}/api/inventory/alerts/alert-1`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'alert-1',
        status: 'NEW',
        alertType: 'LOW_STOCK',
        severity: 'HIGH',
        message: 'Stock bajo detectado',
        metadata: {
          threshold: 10,
          availableQuantity: 4,
        },
        product: { name: 'Jarabe infantil', code: 'PT-001' },
        lot: { internalLotNumber: 'LOT-01' },
        warehouse: { name: 'Bodega Central' },
      }),
    });
  });

  await page.goto(`${baseUrl}/warehouse/products.html`);
  await page.waitForSelector('#products-body tr');

  assert.match(await page.locator('#welcome-message').textContent(), /Warehouse Demo/);
  assert.match(await page.locator('#products-body').textContent(), /Jarabe infantil/);
  assert.match(await page.locator('#alerts-body').textContent(), /Stock bajo detectado/);

  await page.getByRole('button', { name: 'Ver detalle' }).click();
  await page.waitForSelector('#alert-detail-panel:not(.hidden)');
  assert.match(await page.locator('#alert-detail-content').textContent(), /availableQuantity/);

  await page.unroute(`${baseUrl}/api/products`);
  await page.route(`${baseUrl}/api/products`, async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'unauthorized',
        message: 'Token expirado.',
      }),
    });
  });

  await page.reload();
  await page.waitForURL(`${baseUrl}/`);
  await page.waitForLoadState('domcontentloaded');

  const storedSession = await page.evaluate((storageKey) => globalThis.localStorage.getItem(storageKey), STORAGE_KEY);
  assert.equal(storedSession, null);
});
