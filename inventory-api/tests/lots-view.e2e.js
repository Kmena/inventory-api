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

function createBrowserSessionUser({ permissions }) {
  return {
    id: '77',
    fullName: 'Admin Demo',
    username: 'admin-demo',
    companyId: '77',
    role: { code: 'admin' },
    permissions,
  };
}

async function startServer() {
  return new Promise((resolve, reject) => {
    const sockets = new Set();
    const server = app.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Could not resolve lots view E2E server address.'));
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

async function createBrowserPage(t) {
  const browser = await chromium.launch(resolveBrowserLaunchOptions());
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
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

  await page.route(`${baseUrl}/api/auth/logout`, async (route) => {
    await route.fulfill({ status: 204, body: '' });
  });
}

function buildLotStocksBody(expirationDate = null) {
  const now = new Date();
  const expiry = expirationDate || new Date(now.getTime() + 60 * 24 * 3600 * 1000).toISOString();
  return JSON.stringify({
    items: [],
    lots: [
      {
        id: 1,
        lotId: '100',
        warehouseId: '10',
        productId: '50',
        quantity: '200',
        reservedQuantity: '20',
        lot: {
          id: '100',
          internalLotNumber: 'LOT-001',
          lotNumber: 'MFG-001',
          expirationDate: expiry,
          status: 'AVAILABLE',
          qaStatus: 'APPROVED',
        },
        product: { id: '50', name: 'Envase 500ml', code: 'ENV-500' },
        warehouse: { id: '10', name: 'Central' },
      },
    ],
  });
}

async function expectText(page, selector, expectedText) {
  await page.waitForFunction(({ selector: currentSelector, text }) => {
    const node = globalThis.document.querySelector(currentSelector);
    return Boolean(node && node.textContent && node.textContent.includes(text));
  }, { selector, text: expectedText });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('lots view renders listing and KPIs with sufficient lot data', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(async () => {
    await stopServer(server, sockets);
  });

  const page = await createBrowserPage(t);
  const user = createBrowserSessionUser({ permissions: ['inventory.view'] });
  await seedBrowserSession(page, baseUrl, user);
  await stubAuthMe(page, baseUrl, user);

  await page.route('**/api/inventory/stocks*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: buildLotStocksBody(),
    });
  });

  await page.route('**/api/inventory/alerts*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/warehouses/company*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [{ id: 10, name: 'Central', code: 'BOD-01' }] }),
    });
  });

  await page.goto(`${baseUrl}/root/`);
  await page.waitForFunction(() => globalThis.location.hash === '#admin_home');
  await page.getByRole('link', { name: 'Lotes', exact: true }).click();
  await page.waitForFunction(() => globalThis.location.hash === '#lots');
  await page.waitForFunction(() => globalThis.document.getElementById('root-view-title')?.textContent === 'Lotes');

  // KPIs should be visible
  await expectText(page, '#lots-kpis-region', 'Total lotes');

  // The lot should appear in the table
  await expectText(page, '#lots-list-region', 'LOT-001');
  await expectText(page, '#lots-list-region', 'Envase 500ml');
  await expectText(page, '#lots-list-region', 'Central');
});

test('lots view renders degraded state when stocks has no lot data', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(async () => {
    await stopServer(server, sockets);
  });

  const page = await createBrowserPage(t);
  const user = createBrowserSessionUser({ permissions: ['inventory.view'] });
  await seedBrowserSession(page, baseUrl, user);
  await stubAuthMe(page, baseUrl, user);

  await page.route('**/api/inventory/stocks*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], lots: [] }),
    });
  });

  await page.route('**/api/inventory/alerts*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/warehouses/company*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    });
  });

  await page.goto(`${baseUrl}/root/`);
  await page.waitForFunction(() => globalThis.location.hash === '#admin_home');
  await page.getByRole('link', { name: 'Lotes', exact: true }).click();
  await page.waitForFunction(() => globalThis.location.hash === '#lots');

  await expectText(page, '#lots-list-region', 'Datos de lote insuficientes');
});

test('lots view renders forbidden state for users without inventory permissions', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(async () => {
    await stopServer(server, sockets);
  });

  const page = await createBrowserPage(t);
  const user = createBrowserSessionUser({ permissions: [] });
  await seedBrowserSession(page, baseUrl, user);
  await stubAuthMe(page, baseUrl, user);

  await page.goto(`${baseUrl}/root/`);
  await page.waitForFunction(() => globalThis.location.hash === '#admin_home');
  await page.goto(`${baseUrl}/root/#lots`);
  await page.waitForFunction(() => globalThis.location.hash === '#lots');
  await page.waitForFunction(() => globalThis.document.getElementById('root-view-title')?.textContent === 'Lotes');

  await expectText(page, '#lots-list-region', 'No tienes acceso a esta vista');
});

test('lots view opens and closes detail drawer when a lot row is clicked', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(async () => {
    await stopServer(server, sockets);
  });

  const page = await createBrowserPage(t);
  const user = createBrowserSessionUser({ permissions: ['inventory.view'] });
  await seedBrowserSession(page, baseUrl, user);
  await stubAuthMe(page, baseUrl, user);

  await page.route('**/api/inventory/stocks*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: buildLotStocksBody(),
    });
  });

  await page.route('**/api/inventory/alerts*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/api/warehouses/company*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [{ id: 10, name: 'Central', code: 'BOD-01' }] }),
    });
  });

  await page.goto(`${baseUrl}/root/`);
  await page.waitForFunction(() => globalThis.location.hash === '#admin_home');
  await page.getByRole('link', { name: 'Lotes', exact: true }).click();
  await page.waitForFunction(() => globalThis.location.hash === '#lots');

  await expectText(page, '#lots-list-region', 'LOT-001');

  // Click the detail button
  await page.getByRole('button', { name: /Ver detalle/i }).first().click();

  // Drawer should be visible
  await page.waitForFunction(() => !globalThis.document.getElementById('lots-detail-drawer')?.classList.contains('hidden'));
  await expectText(page, '#lots-detail-title', 'LOT-001');
  await expectText(page, '#lots-detail-region', 'Envase 500ml');
  await expectText(page, '#lots-detail-region', 'Central');

  // QA button should NOT appear (user lacks inventory.qa.manage)
  const qaButton = page.locator('#lots-register-qa-button');
  await assert.equal(await qaButton.count(), 0, 'QA button should not appear for users without inventory.qa.manage');

  // Close drawer
  await page.locator('#lots-close-detail-button').click();
  await page.waitForFunction(() => globalThis.document.getElementById('lots-detail-drawer')?.classList.contains('hidden'));
});

test('lots view shows QA action for inventory.qa.manage users with a valid lot', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(async () => {
    await stopServer(server, sockets);
  });

  const page = await createBrowserPage(t);
  const user = createBrowserSessionUser({ permissions: ['inventory.view', 'inventory.qa.manage'] });
  await seedBrowserSession(page, baseUrl, user);
  await stubAuthMe(page, baseUrl, user);

  await page.route('**/api/inventory/stocks*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: buildLotStocksBody(),
    });
  });

  await page.route('**/api/inventory/alerts*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/api/warehouses/company*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [{ id: 10, name: 'Central', code: 'BOD-01' }] }),
    });
  });

  await page.route('**/api/inventory/lots/*/qa*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: '100', status: 'AVAILABLE', qaStatus: 'APPROVED' }),
    });
  });

  await page.goto(`${baseUrl}/root/`);
  await page.waitForFunction(() => globalThis.location.hash === '#admin_home');
  await page.getByRole('link', { name: 'Lotes', exact: true }).click();
  await page.waitForFunction(() => globalThis.location.hash === '#lots');

  await expectText(page, '#lots-list-region', 'LOT-001');

  // Open drawer
  await page.getByRole('button', { name: /Ver detalle/i }).first().click();
  await page.waitForFunction(() => !globalThis.document.getElementById('lots-detail-drawer')?.classList.contains('hidden'));

  // QA button should be visible
  await page.waitForSelector('#lots-register-qa-button');
  await page.locator('#lots-register-qa-button').click();

  // QA form should be visible
  await page.waitForSelector('#lots-qa-form');
  await page.locator('select[name="qaAction"]').selectOption('APPROVE');
  await page.locator('textarea[name="qaReason"]').fill('Inspeccion completada correctamente.');
  await page.getByRole('button', { name: 'Confirmar QA' }).click();

  // Success message should appear
  await expectText(page, '#lots-page-message', 'QA del lote actualizado correctamente.');
});

test('lots view filters lots locally using search input', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(async () => {
    await stopServer(server, sockets);
  });

  const page = await createBrowserPage(t);
  const user = createBrowserSessionUser({ permissions: ['inventory.view'] });
  await seedBrowserSession(page, baseUrl, user);
  await stubAuthMe(page, baseUrl, user);

  await page.route('**/api/inventory/stocks*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [],
        lots: [
          {
            lotId: '100', warehouseId: '10', productId: '50', quantity: '200', reservedQuantity: '0',
            lot: { id: '100', internalLotNumber: 'LOT-ENVASE', expirationDate: null, status: 'AVAILABLE', qaStatus: 'APPROVED' },
            product: { id: '50', name: 'Envase 500ml', code: 'ENV-500' },
            warehouse: { id: '10', name: 'Central' },
          },
          {
            lotId: '200', warehouseId: '10', productId: '51', quantity: '50', reservedQuantity: '0',
            lot: { id: '200', internalLotNumber: 'LOT-TAPA', expirationDate: null, status: 'AVAILABLE', qaStatus: 'PENDING' },
            product: { id: '51', name: 'Tapa azul', code: 'TAP' },
            warehouse: { id: '10', name: 'Central' },
          },
        ],
      }),
    });
  });

  await page.route('**/api/inventory/alerts*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/api/warehouses/company*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [{ id: 10, name: 'Central', code: 'BOD-01' }] }),
    });
  });

  await page.goto(`${baseUrl}/root/`);
  await page.waitForFunction(() => globalThis.location.hash === '#admin_home');
  await page.getByRole('link', { name: 'Lotes', exact: true }).click();
  await page.waitForFunction(() => globalThis.location.hash === '#lots');

  await expectText(page, '#lots-list-region', 'LOT-ENVASE');
  await expectText(page, '#lots-list-region', 'LOT-TAPA');

  // Search for "tapa"
  await page.locator('#lots-search-input').fill('tapa');
  await page.waitForFunction(() => {
    const region = globalThis.document.getElementById('lots-list-region');
    return Boolean(region && !region.textContent?.includes('LOT-ENVASE'));
  });
  await expectText(page, '#lots-list-region', 'LOT-TAPA');

  // Clear search
  await page.locator('#lots-search-input').fill('');
  await page.waitForFunction(() => {
    const region = globalThis.document.getElementById('lots-list-region');
    return Boolean(region && region.textContent?.includes('LOT-ENVASE'));
  });
  await expectText(page, '#lots-list-region', 'LOT-ENVASE');
  await expectText(page, '#lots-list-region', 'LOT-TAPA');
});
