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
        reject(new Error('Could not resolve warehouses view E2E server address.'));
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
}

function createWarehouseListResponse(items, summary = null) {
  return {
    items,
    summary,
    warehouseTypes: [
      { value: 'GENERAL', label: 'General', description: 'General', isVirtual: false, defaultSellableSource: false },
      { value: 'FINISHED_GOODS', label: 'Producto terminado', description: 'Venta y despacho', isVirtual: false, defaultSellableSource: true },
      { value: 'COURSES_VIRTUAL', label: 'Virtual', description: 'Sin inventario fisico', isVirtual: true, defaultSellableSource: false },
    ],
  };
}

test('warehouses view supports read-only listing without create CTA', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(async () => {
    await stopServer(server, sockets);
  });

  const page = await createBrowserPage(t);
  const user = createBrowserSessionUser({ permissions: ['inventory.view'] });
  await seedBrowserSession(page, baseUrl, user);
  await stubAuthMe(page, baseUrl, user);

  await page.route('**/api/warehouses/company', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(createWarehouseListResponse([
        { id: 1, code: 'BOD-01', name: 'Central', warehouseType: 'GENERAL', warehouseTypeLabel: 'General', warehouseTypeDescription: 'General', isVirtual: false, isSellableSource: false, isActive: true, createdAt: '2026-08-05T00:00:00.000Z', updatedAt: '2026-08-05T00:00:00.000Z' },
      ], { total: 1, active: 1, virtual: 0, sellable: 0 })),
    });
  });

  await page.goto(`${baseUrl}/root/`);
  await page.waitForFunction(() => globalThis.location.hash === '#admin_home');
  await page.getByRole('link', { name: 'Bodegas', exact: true }).click();
  await page.waitForFunction(() => globalThis.location.hash === '#warehouses');
  await page.waitForFunction(() => globalThis.document.getElementById('root-view-title')?.textContent === 'Bodegas');

  await expectText(page, '#warehouses-list-region', 'Central');
  assert.equal(await page.getByRole('button', { name: 'Nueva bodega' }).isHidden(), true);
});

test('warehouses view creates a warehouse and keeps modal open on conflict', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(async () => {
    await stopServer(server, sockets);
  });

  const page = await createBrowserPage(t);
  const user = createBrowserSessionUser({ permissions: ['inventory.manage'] });
  await seedBrowserSession(page, baseUrl, user);
  await stubAuthMe(page, baseUrl, user);

  const state = {
    items: [
      { id: 1, code: 'BOD-01', name: 'Central', warehouseType: 'GENERAL', warehouseTypeLabel: 'General', warehouseTypeDescription: 'General', isVirtual: false, isSellableSource: false, isActive: true, createdAt: '2026-08-05T00:00:00.000Z', updatedAt: '2026-08-05T00:00:00.000Z' },
    ],
    postCalls: 0,
  };

  await page.route('**/api/warehouses/company', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createWarehouseListResponse(state.items, {
          total: state.items.length,
          active: state.items.filter((item) => item.isActive).length,
          virtual: state.items.filter((item) => item.isVirtual).length,
          sellable: state.items.filter((item) => item.isSellableSource).length,
        })),
      });
      return;
    }

    if (method === 'POST') {
      state.postCalls += 1;
      if (state.postCalls === 1) {
        const payload = JSON.parse(route.request().postData() || '{}');
        state.items.push({
          id: 2,
          code: 'BOD-02',
          name: payload.name,
          warehouseType: payload.warehouseType,
          warehouseTypeLabel: payload.warehouseType === 'FINISHED_GOODS' ? 'Producto terminado' : payload.warehouseType,
          warehouseTypeDescription: 'Venta y despacho',
          isVirtual: false,
          isSellableSource: true,
          isActive: payload.isActive !== false,
          createdAt: '2026-08-05T00:00:00.000Z',
          updatedAt: '2026-08-05T00:00:00.000Z',
        });
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(state.items[state.items.length - 1]),
        });
        return;
      }

      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Ya existe una bodega con ese codigo o nombre' }),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(`${baseUrl}/root/`);
  await page.waitForFunction(() => globalThis.location.hash === '#admin_home');
  await page.getByRole('link', { name: 'Bodegas', exact: true }).click();
  await page.waitForFunction(() => globalThis.location.hash === '#warehouses');

  await page.getByRole('button', { name: 'Nueva bodega' }).click();
  await page.locator('#warehouses-create-code').fill('bod 02');
  await page.locator('input[name="name"]').fill('Despacho Norte');
  await page.locator('#warehouses-create-type').selectOption('FINISHED_GOODS');
  await page.getByRole('button', { name: 'Crear bodega' }).click();

  await expectText(page, '#warehouses-list-region', 'Despacho Norte');
  await expectText(page, '#warehouses-page-message', 'Bodega creada correctamente.');

  await page.getByRole('button', { name: 'Nueva bodega' }).click();
  await page.locator('#warehouses-create-code').fill('bod 02');
  await page.locator('input[name="name"]').fill('Despacho Norte');
  await page.locator('#warehouses-create-type').selectOption('FINISHED_GOODS');
  await page.getByRole('button', { name: 'Crear bodega' }).click();

  await expectText(page, '#warehouses-create-message', 'Ya existe una bodega con ese codigo o nombre');
  assert.equal(await page.locator('#warehouses-create-dialog').evaluate((dialog) => dialog.hasAttribute('open')), true);
});

async function expectText(page, selector, expectedText) {
  await page.waitForFunction(({ selector: currentSelector, text }) => {
    const node = globalThis.document.querySelector(currentSelector);
    return Boolean(node && node.textContent && node.textContent.includes(text));
  }, { selector, text: expectedText });
}
