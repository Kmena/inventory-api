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
        reject(new Error('Could not resolve products view E2E server address.'));
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

function createProductsResponse(items, page = 1, totalItems = items.length, totalPages = 1) {
  return {
    items,
    pagination: { page, pageSize: 10, totalItems, totalPages },
  };
}

test('products view supports read-only paginated listing, local filtering and detail loading', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(async () => {
    await stopServer(server, sockets);
  });

  const page = await createBrowserPage(t);
  const user = createBrowserSessionUser({ permissions: ['products.view', 'inventory.view'] });
  await seedBrowserSession(page, baseUrl, user);
  await stubAuthMe(page, baseUrl, user);

  const productPages = {
    1: createProductsResponse([
      { id: 11, categoryId: 7, code: 'PT-11', name: 'Cafe molido', description: 'Bebida', category: { name: 'Bebidas' }, price: 1200, currency: 'CRC', isActive: true, quantity: 9, reservedQuantity: 1, minStock: 4, maxStock: 20, unit: 'UN' },
      { id: 12, categoryId: 8, code: 'PT-12', name: 'Caja kraft', description: 'Empaque', category: { name: 'Empaques' }, price: 900, currency: 'CRC', isActive: true, quantity: 40, reservedQuantity: 0, minStock: 10, maxStock: 80, unit: 'UN' },
    ], 1, 11, 2),
    2: createProductsResponse([
      { id: 21, categoryId: 7, code: 'PT-21', name: 'Te frio', description: 'Bebida fria', category: { name: 'Bebidas' }, price: 1400, currency: 'CRC', isActive: true, quantity: 6, reservedQuantity: 0, minStock: 2, maxStock: 15, unit: 'UN' },
    ], 2, 11, 2),
  };

  await page.route('**/api/products/categories/company', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 7, name: 'Bebidas', categoryType: 'PT' },
        { id: 8, name: 'Empaques', categoryType: 'EM' },
      ]),
    });
  });

  await page.route('**/api/products/*', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname.endsWith('/categories/company')) {
      await route.fallback();
      return;
    }
    const productId = Number(requestUrl.pathname.split('/').pop());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(productPages[1].items.find((item) => item.id === productId) || productPages[2].items.find((item) => item.id === productId)),
    });
  });

  await page.route('**/api/products/?*', async (route) => {
    const requestUrl = new URL(route.request().url());
    const pageNumber = Number(requestUrl.searchParams.get('page') || '1');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(productPages[pageNumber]),
    });
  });

  await page.goto(`${baseUrl}/root/`);
  await page.waitForFunction(() => globalThis.location.hash === '#admin_home');
  await page.getByRole('link', { name: 'Productos', exact: true }).click();
  await page.waitForFunction(() => globalThis.location.hash === '#products');
  await page.waitForFunction(() => globalThis.document.getElementById('root-view-title')?.textContent === 'Productos');

  await expectText(page, '#products-list-region', 'Cafe molido');
  assert.equal(await page.getByRole('button', { name: 'Nuevo producto' }).isHidden(), true);

  await page.locator('#products-search-input').fill('kraft');
  await expectText(page, '#products-list-summary', 'Mostrando 1 de 2 productos de esta pagina.');
  await expectText(page, '#products-list-region', 'Caja kraft');

  await page.locator('#products-search-input').fill('');
  await page.locator('#products-category-filter').selectOption('7');
  await expectText(page, '#products-list-region', 'Cafe molido');

  await page.getByRole('button', { name: /Ver detalle|Detalle abierto/ }).first().click();
  await expectText(page, '#products-detail-region', 'Cafe molido');

  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expectText(page, '#products-list-region', 'Te frio');
  await expectText(page, '#products-pagination-region', 'Pagina 2 de 2');
});

test('products view creates categories, creates products, edits and deactivates with manage permissions', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(async () => {
    await stopServer(server, sockets);
  });

  const page = await createBrowserPage(t);
  const user = createBrowserSessionUser({ permissions: ['products.manage', 'inventory.manage'] });
  await seedBrowserSession(page, baseUrl, user);
  await stubAuthMe(page, baseUrl, user);

  const state = {
    categories: [{ id: 7, name: 'Bebidas', categoryType: 'PT' }],
    items: [{ id: 11, categoryId: 7, code: 'PT-11', name: 'Cafe molido', description: 'Bebida', category: { name: 'Bebidas' }, price: 1200, currency: 'CRC', isActive: true, quantity: 9, reservedQuantity: 1, minStock: 4, maxStock: 20, unit: 'UN' }],
    nextCategoryId: 8,
    nextProductId: 12,
  };

  await page.route('**/api/products/categories/company', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.categories),
      });
      return;
    }

    if (method === 'POST') {
      const payload = JSON.parse(route.request().postData() || '{}');
      const createdCategory = {
        id: state.nextCategoryId,
        name: payload.name,
        categoryType: payload.categoryType,
      };
      state.nextCategoryId += 1;
      state.categories.push(createdCategory);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(createdCategory),
      });
      return;
    }

    await route.fallback();
  });

  await page.route('**/api/products/*', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname.endsWith('/categories/company')) {
      await route.fallback();
      return;
    }
    const productId = Number(requestUrl.pathname.split('/').pop());
    const productIndex = state.items.findIndex((item) => item.id === productId);
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.items[productIndex]),
      });
      return;
    }

    if (method === 'PUT') {
      const payload = JSON.parse(route.request().postData() || '{}');
      const category = state.categories.find((item) => item.id === payload.categoryId) || state.categories.find((item) => item.id === state.items[productIndex].categoryId) || null;
      state.items[productIndex] = {
        ...state.items[productIndex],
        ...payload,
        id: productId,
        categoryId: payload.categoryId ?? state.items[productIndex].categoryId,
        category: category ? { name: category.name } : null,
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.items[productIndex]),
      });
      return;
    }

    if (method === 'DELETE') {
      state.items.splice(productIndex, 1);
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    await route.fallback();
  });

  await page.route('**/api/products/?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(createProductsResponse(state.items, 1, state.items.length, 1)),
    });
  });

  await page.route('**/api/products/', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    const payload = JSON.parse(route.request().postData() || '{}');
    const category = state.categories.find((item) => item.id === payload.categoryId) || null;
    const createdProduct = {
      id: state.nextProductId,
      ...payload,
      isActive: true,
      quantity: 0,
      reservedQuantity: 0,
      category: category ? { name: category.name } : null,
    };
    state.nextProductId += 1;
    state.items.push(createdProduct);
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(createdProduct),
    });
  });

  await page.goto(`${baseUrl}/root/`);
  await page.waitForFunction(() => globalThis.location.hash === '#admin_home');
  await page.getByRole('link', { name: 'Productos', exact: true }).click();
  await page.waitForFunction(() => globalThis.location.hash === '#products');

  await page.getByRole('button', { name: 'Categorias' }).click();
  await page.locator('#products-category-name').fill('Snacks');
  await page.getByRole('button', { name: 'Crear categoria' }).click();
  await expectText(page, '#products-categories-message', 'Categoria creada correctamente.');
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();

  await page.getByRole('button', { name: 'Nuevo producto' }).click();
  await page.locator('#products-form-name').fill('Producto nuevo');
  await page.locator('input[name="code"]').fill('PT-12');
  await page.locator('#products-form-category').selectOption('8');
  await page.locator('select[name="currency"]').selectOption('CRC');
  await page.locator('input[name="price"]').fill('1550');
  await page.getByRole('button', { name: 'Guardar producto' }).click();

  await expectText(page, '#products-page-message', 'Producto creado correctamente.');
  await expectText(page, '#products-list-region', 'Producto nuevo');

  await page.getByRole('button', { name: /Ver detalle|Detalle abierto/ }).last().click();
  await page.getByRole('button', { name: 'Editar producto' }).click();
  await page.locator('#products-form-name').fill('Producto ajustado');
  await page.getByRole('button', { name: 'Actualizar producto' }).click();

  await expectText(page, '#products-page-message', 'Producto actualizado correctamente.');
  await expectText(page, '#products-list-region', 'Producto ajustado');

  await page.getByRole('button', { name: /Ver detalle|Detalle abierto/ }).last().click();
  await page.getByRole('button', { name: 'Desactivar' }).click();
  await page.getByRole('button', { name: 'Desactivar producto' }).click();

  await expectText(page, '#products-page-message', 'Producto desactivado correctamente.');
  await page.waitForFunction(() => !globalThis.document.querySelector('#products-list-region')?.textContent?.includes('Producto ajustado'));
});

async function expectText(page, selector, expectedText) {
  await page.waitForFunction(({ selector: currentSelector, text }) => {
    const node = globalThis.document.querySelector(currentSelector);
    return Boolean(node && node.textContent && node.textContent.includes(text));
  }, { selector, text: expectedText });
}
