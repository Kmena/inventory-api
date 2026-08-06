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
        reject(new Error('Could not resolve movements view E2E server address.'));
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

function createMovementResponse(pageNumber) {
  if (pageNumber === 2) {
    return {
      items: [
        {
          id: 203,
          createdAt: '2026-08-05T10:40:00.000Z',
          movementType: 'RELEASE',
          quantity: '3',
          quantityBefore: '13',
          quantityAfter: '10',
          reasonCode: 'ORDER_RELEASE',
          sourceType: 'order',
          sourceId: '900',
          movementGroupId: 'grp-203',
          note: 'Liberacion de reserva',
          product: { id: 15, name: 'Envase 500ml', code: 'ENV-500' },
          warehouse: { id: 7, name: 'Central' },
          lot: { id: 9, internalLotNumber: 'LOT-009' },
          user: { id: 44, fullName: 'Ana Perez', username: 'aperez' },
        },
      ],
      pagination: { page: 2, pageSize: 10, totalItems: 11, totalPages: 2 },
    };
  }

  return {
    items: [
      {
        id: 201,
        createdAt: '2026-08-05T10:15:00.000Z',
        movementType: 'ADJUSTMENT',
        quantity: '5',
        quantityBefore: '10',
        quantityAfter: '15',
        reasonCode: 'MANUAL_ADJUSTMENT',
        sourceType: 'manual_adjustment',
        sourceId: '888',
        movementGroupId: 'grp-201',
        note: 'Conteo fisico',
        product: { id: 15, name: 'Envase 500ml', code: 'ENV-500' },
        warehouse: { id: 7, name: 'Central' },
        lot: { id: 9, internalLotNumber: 'LOT-009' },
        user: { id: 44, fullName: 'Ana Perez', username: 'aperez' },
      },
    ],
    pagination: { page: 1, pageSize: 10, totalItems: 11, totalPages: 2 },
  };
}

test('movements view supports read-only filtering, pagination and detail drawer', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(async () => {
    await stopServer(server, sockets);
  });

  const page = await createBrowserPage(t);
  const user = createBrowserSessionUser({ permissions: ['inventory.view'] });
  await seedBrowserSession(page, baseUrl, user);
  await stubAuthMe(page, baseUrl, user);

  const movementQueries = [];
  await page.route('**/api/warehouses/company', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [{ id: 7, name: 'Central', code: 'BOD-01' }] }),
    });
  });

  await page.route('**/api/inventory/movements*', async (route) => {
    const requestUrl = new URL(route.request().url());
    movementQueries.push(requestUrl.search);
    const pageNumber = Number(requestUrl.searchParams.get('page') || '1');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(createMovementResponse(pageNumber)),
    });
  });

  await page.goto(`${baseUrl}/root/`);
  await page.waitForFunction(() => globalThis.location.hash === '#admin_home');
  await page.getByRole('link', { name: 'Movimientos', exact: true }).click();
  await page.waitForFunction(() => globalThis.location.hash === '#movements');
  await page.waitForFunction(() => globalThis.document.getElementById('root-view-title')?.textContent === 'Movimientos');

  await expectText(page, '#movements-list-region', 'Envase 500ml');
  await page.locator('#movements-warehouse-filter').selectOption('7');
  await page.locator('#movements-product-filter').fill('15');
  await page.locator('#movements-lot-filter').fill('9');
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();

  await page.waitForFunction(() => {
    const summary = globalThis.document.getElementById('movements-list-summary');
    return Boolean(summary && summary.textContent && summary.textContent.includes('filtros actuales'));
  });

  assert.equal(movementQueries.some((query) => query.includes('warehouseId=7') && query.includes('productId=15') && query.includes('lotId=9')), true);

  await page.getByRole('button', { name: 'Ver detalle' }).first().click();
  await expectText(page, '#movements-detail-region', 'Conteo fisico');
  assert.equal(await page.locator('#movements-detail-drawer').evaluate((node) => node.classList.contains('hidden')), false);
  await page.locator('#movements-close-detail-button').click();

  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expectText(page, '#movements-list-region', 'RELEASE');
  await expectText(page, '#movements-pagination-region', 'Pagina 2 de 2');
});

test('movements view renders forbidden state without inventory permissions', async (t) => {
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
  await page.goto(`${baseUrl}/root/#movements`);
  await page.waitForFunction(() => globalThis.location.hash === '#movements');

  await expectText(page, '#movements-list-region', 'No tienes acceso a movimientos');
});

async function expectText(page, selector, expectedText) {
  await page.waitForFunction(({ selector: currentSelector, text }) => {
    const node = globalThis.document.querySelector(currentSelector);
    return Boolean(node && node.textContent && node.textContent.includes(text));
  }, { selector, text: expectedText });
}
