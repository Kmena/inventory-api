/* global Event */
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

// ---------------------------------------------------------------------------
// Stub data
// ---------------------------------------------------------------------------

function createSuppliersState() {
  return {
    suppliers: [
      {
        id: 901,
        name: 'Proveedor Norte',
        email: 'norte@test.dev',
        phone: '555-1001',
        country: 'Costa Rica',
        note: 'Proveedor inicial',
        productCount: 1,
        createdAt: '2025-02-01T10:00:00.000Z',
      },
    ],
    supplierDetails: {
      901: {
        id: 901,
        name: 'Proveedor Norte',
        email: 'norte@test.dev',
        phone: '555-1001',
        country: 'Costa Rica',
        note: 'Proveedor inicial',
        products: [
          {
            productId: 301,
            productCode: 'MP-001',
            productName: 'Materia Prima A',
            supplierSku: 'NORTE-A',
            unitPrice: 1250,
            currency: 'CRC',
            isPreferred: true,
            leadTimeDays: 3,
            minimumOrderQuantity: 2,
            notes: 'Entrega semanal',
          },
        ],
      },
    },
    products: [
      { id: 301, code: 'MP-001', name: 'Materia Prima A' },
      { id: 302, code: 'MP-002', name: 'Materia Prima B' },
      { id: 401, code: 'SKU-AC-44', name: 'Acido Citrico' },
      { id: 402, code: 'BIC-77', name: 'Bicarbonato' },
    ],
    counters: {
      listSuppliers: 0,
      createSupplier: 0,
      getSupplier: 0,
      updateSupplier: 0,
      addProduct: 0,
      listProducts: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Infrastructure helpers
// ---------------------------------------------------------------------------

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
        reject(new Error('Could not resolve suppliers E2E server address.'));
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

async function stubSuppliersRoutes(page, state) {
  await page.route(/\/api\/suppliers\/company/, async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    const supplierPath = url.split('/api/suppliers/company')[1] || '';

    // POST /company/:id/products
    if (method === 'POST' && /\/\d+\/products/.test(supplierPath)) {
      state.counters.addProduct++;
      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ productId: body.productId, supplierId: 901 }),
      });
      return;
    }

    // GET/PUT /company/:id (not /products)
    const detailMatch = supplierPath.match(/^\/([\d]+)$/);
    if (detailMatch) {
      const id = detailMatch[1];
      if (method === 'GET') {
        state.counters.getSupplier++;
        const detail = state.supplierDetails[id] || { id: Number(id), name: 'Proveedor', products: [] };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(detail),
        });
        return;
      }
      if (method === 'PUT') {
        state.counters.updateSupplier++;
        const body = route.request().postDataJSON();
        const updated = { ...(state.supplierDetails[id] || {}), ...body };
        state.supplierDetails[id] = updated;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(updated),
        });
        return;
      }
    }

    // GET /company (list)
    if (method === 'GET' && (supplierPath === '' || supplierPath === '/')) {
      state.counters.listSuppliers++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.suppliers),
      });
      return;
    }

    // POST /company (create)
    if (method === 'POST' && (supplierPath === '' || supplierPath === '/')) {
      state.counters.createSupplier++;
      const body = route.request().postDataJSON();
      const created = {
        id: 902,
        name: body.name,
        email: body.email || null,
        phone: body.phone || null,
        country: body.country || null,
        note: body.note || null,
        productCount: 0,
        createdAt: new Date().toISOString(),
      };
      state.suppliers.push(created);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
      return;
    }

    await route.continue();
  });

  await page.route(/\/api\/products/, async (route) => {
    state.counters.listProducts++;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.products),
    });
  });
}

async function expectText(page, selector, expectedText) {
  await page.waitForFunction(({ selector: sel, text }) => {
    const node = globalThis.document.querySelector(sel);
    return Boolean(node && node.textContent && node.textContent.includes(text));
  }, { selector, text: expectedText });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('Scenario A: company-admin can open #proveedores and see supplier list', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(async () => { await stopServer(server, sockets); });
  const state = createSuppliersState();

  const page = await createBrowserPage(t);
  const user = createBrowserSessionUser({ permissions: ['suppliers.view', 'suppliers.manage'] });
  await seedBrowserSession(page, baseUrl, user);
  await stubAuthMe(page, baseUrl, user);
  await stubSuppliersRoutes(page, state);

  await page.goto(`${baseUrl}/root/`);
  await page.waitForFunction(() => globalThis.location.hash === '#admin_home');
  await page.getByRole('link', { name: 'Proveedores' }).click();
  await page.waitForFunction(() => globalThis.location.hash === '#proveedores');
  await page.waitForFunction(() =>
    globalThis.document.getElementById('root-view-title')?.textContent === 'Proveedores',
  );

  await expectText(page, '#suppliers-list-region', 'Proveedor Norte');
  assert.ok(state.counters.listSuppliers >= 1, 'should have called GET /api/suppliers/company');
});

test('Scenario B: company-admin creates a new supplier', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(async () => { await stopServer(server, sockets); });
  const state = createSuppliersState();

  const page = await createBrowserPage(t);
  const user = createBrowserSessionUser({ permissions: ['suppliers.view', 'suppliers.manage'] });
  await seedBrowserSession(page, baseUrl, user);
  await stubAuthMe(page, baseUrl, user);
  await stubSuppliersRoutes(page, state);

  await page.goto(`${baseUrl}/root/#proveedores`);
  await page.waitForFunction(() =>
    globalThis.document.getElementById('root-view-title')?.textContent === 'Proveedores',
  );
  await expectText(page, '#suppliers-list-region', 'Proveedor Norte');

  await page.click('#suppliers-open-create-button');
  await page.waitForFunction(() => {
    const dialog = globalThis.document.getElementById('suppliers-create-dialog');
    return dialog && dialog.open;
  });

  await page.fill('#suppliers-create-name', 'Proveedor Sur');
  await page.click('#suppliers-create-submit-button');

  await expectText(page, '#suppliers-page-message', 'Proveedor creado correctamente');
  assert.ok(state.counters.createSupplier >= 1, 'should have called POST /api/suppliers/company');
});

test('Scenario C: company-admin edits an existing supplier', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(async () => { await stopServer(server, sockets); });
  const state = createSuppliersState();

  const page = await createBrowserPage(t);
  const user = createBrowserSessionUser({ permissions: ['suppliers.view', 'suppliers.manage'] });
  await seedBrowserSession(page, baseUrl, user);
  await stubAuthMe(page, baseUrl, user);
  await stubSuppliersRoutes(page, state);

  await page.goto(`${baseUrl}/root/#proveedores`);
  await page.waitForFunction(() =>
    globalThis.document.getElementById('root-view-title')?.textContent === 'Proveedores',
  );
  await expectText(page, '#suppliers-list-region', 'Proveedor Norte');

  // Open detail dialog
  await page.click('[data-supplier-id="901"]');
  await page.waitForFunction(() => {
    const dialog = globalThis.document.getElementById('suppliers-detail-dialog');
    return dialog && dialog.open;
  });

  // Wait for detail to fully load
  await page.waitForFunction(() => {
    const info = globalThis.document.getElementById('suppliers-detail-info');
    if (!info) { return false; }
    return !info.textContent.includes('Cargando');
  });

  // Click edit (use evaluate for reliable in-modal click)
  await page.evaluate(() => {
    globalThis.document.getElementById('suppliers-edit-button')?.click();
  });

  // Wait for create dialog to open in edit mode
  await page.waitForFunction(() => {
    const createDialog = globalThis.document.getElementById('suppliers-create-dialog');
    return createDialog && createDialog.open;
  });

  await expectText(page, '#suppliers-dialog-title', 'Editar proveedor');

  // Fill the name
  await page.evaluate(() => {
    const input = globalThis.document.getElementById('suppliers-create-name');
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
      if (setter) { setter.call(input, 'Proveedor Norte Actualizado'); }
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  // Submit the form
  await page.evaluate(() => {
    globalThis.document.getElementById('suppliers-create-submit-button')?.click();
  });

  await expectText(page, '#suppliers-page-message', 'Proveedor actualizado correctamente');
  assert.ok(state.counters.updateSupplier >= 1, 'should have called PUT /api/suppliers/company/:id');
});

test('Scenario D: company-admin assigns product with price using name/SKU filter', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(async () => { await stopServer(server, sockets); });
  const state = createSuppliersState();

  const page = await createBrowserPage(t);
  const user = createBrowserSessionUser({ permissions: ['suppliers.view', 'suppliers.manage'] });
  await seedBrowserSession(page, baseUrl, user);
  await stubAuthMe(page, baseUrl, user);
  await stubSuppliersRoutes(page, state);

  await page.goto(`${baseUrl}/root/#proveedores`);
  await page.waitForFunction(() =>
    globalThis.document.getElementById('root-view-title')?.textContent === 'Proveedores',
  );
  await expectText(page, '#suppliers-list-region', 'Proveedor Norte');

  // Open detail
  await page.click('[data-supplier-id="901"]');
  await page.waitForFunction(() => {
    const dialog = globalThis.document.getElementById('suppliers-detail-dialog');
    return dialog && dialog.open;
  });

  // Open add product dialog
  await page.click('#suppliers-open-add-product-button');
  await page.waitForFunction(() => {
    const dialog = globalThis.document.getElementById('suppliers-add-product-dialog');
    return dialog && dialog.open;
  });

  // The search input should exist and the summary should show available products
  await expectText(page, '#suppliers-add-product-search-summary', 'productos disponibles');

  // Filter by SKU
  await page.fill('#suppliers-add-product-search', 'BIC-77');
  await page.waitForFunction(() => {
    const summary = globalThis.document.getElementById('suppliers-add-product-search-summary');
    return summary && summary.textContent && summary.textContent.includes('1 de');
  });

  // Select the filtered product
  await page.selectOption('#suppliers-add-product-select', { index: 1 });
  await page.fill('[name="unitPrice"]', '500');
  await page.fill('[name="currency"]', 'CRC');
  await page.click('#suppliers-add-product-submit-button');

  await expectText(page, '#suppliers-detail-message', 'Producto asignado correctamente');
  assert.ok(state.counters.addProduct >= 1, 'should have called POST /api/suppliers/company/:id/products');
});

test('Scenario E: read-only user does not see manage actions', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(async () => { await stopServer(server, sockets); });
  const state = createSuppliersState();

  const page = await createBrowserPage(t);
  const user = createBrowserSessionUser({ permissions: ['suppliers.view'] });
  await seedBrowserSession(page, baseUrl, user);
  await stubAuthMe(page, baseUrl, user);
  await stubSuppliersRoutes(page, state);

  await page.goto(`${baseUrl}/root/#proveedores`);
  await page.waitForFunction(() =>
    globalThis.document.getElementById('root-view-title')?.textContent === 'Proveedores',
  );
  await expectText(page, '#suppliers-list-region', 'Proveedor Norte');

  const createButtonHidden = await page.evaluate(() => {
    const btn = globalThis.document.getElementById('suppliers-open-create-button');
    return btn ? btn.hidden : true;
  });
  assert.ok(createButtonHidden, 'Nuevo proveedor button should be hidden for read-only user');

  await page.click('[data-supplier-id="901"]');
  await page.waitForFunction(() => {
    const dialog = globalThis.document.getElementById('suppliers-detail-dialog');
    return dialog && dialog.open;
  });

  const editHidden = await page.evaluate(() => {
    const btn = globalThis.document.getElementById('suppliers-edit-button');
    return btn ? btn.hidden : true;
  });
  assert.ok(editHidden, 'Edit button should be hidden for read-only user');

  const deleteHidden = await page.evaluate(() => {
    const btn = globalThis.document.getElementById('suppliers-delete-button');
    return btn ? btn.hidden : true;
  });
  assert.ok(deleteHidden, 'Delete button should be hidden for read-only user');

  const addProductHidden = await page.evaluate(() => {
    const btn = globalThis.document.getElementById('suppliers-open-add-product-button');
    return btn ? btn.hidden : true;
  });
  assert.ok(addProductHidden, 'Asignar producto button should be hidden for read-only user');
});
