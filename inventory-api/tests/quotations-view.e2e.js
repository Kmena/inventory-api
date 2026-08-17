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

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function createQuotationsState() {
  return {
    quotableProducts: [
      {
        id: 501,
        name: 'Glicelana',
        sku: 'GLI-001',
        quantity: 0,
        minStock: 50,
        shortage: 50,
        supplierCount: 1,
      },
    ],
    pricingDetailByProductId: {
      501: {
        productId: 501,
        productName: 'Glicelana',
        sku: 'GLI-001',
        quantity: 0,
        minStock: 50,
        shortage: 50,
        suppliers: [
          {
            supplierId: 701,
            supplierName: 'Proveedor Norte',
            unitPrice: 1250,
            currency: 'CRC',
            leadTimeDays: 3,
            minimumOrderQuantity: 1,
            isPreferred: true,
            notes: 'Entrega semanal',
          },
        ],
      },
    },
    purchaseRequest: {
      id: 9901,
      items: [
        {
          productId: 501,
          quantity: 50,
          product: { id: 501, name: 'Glicelana' },
        },
      ],
    },
    rfqInvitations: [],
    rfqTracking: [],
    counters: {
      listQuotableProducts: 0,
      getProductSuppliersPricing: 0,
      requestGroupedQuotations: 0,
      listRfqInvitations: 0,
      createRfqInvitations: 0,
      getRfqTrackingSummary: 0,
    },
    lastGroupedPayload: null,
    lastRfqPayload: null,
  };
}

async function startServer() {
  return new Promise((resolve, reject) => {
    const sockets = new Set();
    const server = app.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Could not resolve quotations E2E server address.'));
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

async function stubQuotationsRoutes(page, state) {
  await page.route('**/api/procurement/quotable-products', async (route) => {
    state.counters.listQuotableProducts += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(cloneJson(state.quotableProducts)),
    });
  });

  await page.route(/\/api\/procurement\/products\/\d+\/suppliers-pricing$/, async (route) => {
    state.counters.getProductSuppliersPricing += 1;
    const productId = Number(route.request().url().match(/products\/(\d+)\/suppliers-pricing$/)?.[1]);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(cloneJson(state.pricingDetailByProductId[productId] || null)),
    });
  });

  await page.route(/\/api\/procurement\/products\/\d+\/request-quotations$/, async (route) => {
    state.counters.requestGroupedQuotations += 1;
    state.lastGroupedPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        purchaseRequest: cloneJson(state.purchaseRequest),
        quotations: [{ id: 8801, supplierId: 701 }],
      }),
    });
  });

  await page.route(/\/api\/procurement\/requests\/\d+\/rfq-invitations$/, async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      state.counters.listRfqInvitations += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(cloneJson(state.rfqInvitations)),
      });
      return;
    }

    state.counters.createRfqInvitations += 1;
    state.lastRfqPayload = route.request().postDataJSON();
    state.rfqInvitations = [
      {
        id: 6101,
        companyId: 77,
        purchaseRequestId: state.purchaseRequest.id,
        supplierId: 701,
        quotationId: null,
        status: 'PREPARED',
        emailTo: 'norte@test.dev',
        emailSubject: 'Solicitud de cotización: Cotización agrupada',
        emailBody: 'Estimado proveedor',
        expiresAt: '2026-12-31T00:00:00.000Z',
        supplier: {
          id: 701,
          name: 'Proveedor Norte',
          email: 'norte@test.dev',
        },
      },
    ];
    state.rfqTracking = [
      {
        id: state.purchaseRequest.id,
        title: 'Cotización agrupada (1 producto)',
        items: cloneJson(state.purchaseRequest.items),
        rfqInvitations: cloneJson(state.rfqInvitations),
      },
    ];

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          invitation: cloneJson(state.rfqInvitations[0]),
          secureLink: 'http://localhost:2500/supplier-quote/?token=test-token',
          emailSubject: state.rfqInvitations[0].emailSubject,
          emailBody: state.rfqInvitations[0].emailBody,
        },
      ]),
    });
  });

  await page.route('**/api/procurement/rfq-tracking', async (route) => {
    state.counters.getRfqTrackingSummary += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(cloneJson(state.rfqTracking)),
    });
  });
}

async function openQuotationsView(page, baseUrl) {
  await page.goto(`${baseUrl}/root/`);
  await page.waitForFunction(() => globalThis.location.hash === '#admin_home');
  await page.getByRole('link', { name: 'Cotizaciones', exact: true }).click();
  await page.waitForFunction(() => globalThis.location.hash === '#cotizaciones');
  await page.waitForFunction(
    () => globalThis.document.getElementById('root-view-title')?.textContent === 'Cotizaciones',
  );
}

test('quotations workspace creates RFQ invitations after grouped quotation confirmation', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(async () => {
    await stopServer(server, sockets);
  });

  const page = await createBrowserPage(t);
  const user = createBrowserSessionUser({ permissions: ['procurement.view', 'procurement.manage'] });
  const state = createQuotationsState();

  await seedBrowserSession(page, baseUrl, user);
  await stubAuthMe(page, baseUrl, user);
  await stubQuotationsRoutes(page, state);
  await openQuotationsView(page, baseUrl);

  await page.waitForSelector('#quotations-list-region .quotations-open-detail-button');
  await page.getByRole('button', { name: 'Ver proveedores', exact: true }).click();
  await page.waitForSelector('#quotations-detail-quantity');
  await page.locator('.quotations-supplier-checkbox').check();
  await page.locator('#quotations-detail-quantity').fill('50');
  await page.getByRole('button', { name: 'Guardar selección', exact: true }).click();

  await page.waitForSelector('#quotations-selection-summary .tag');
  await page.getByRole('button', { name: 'Generar cotizaciones', exact: true }).click();
  await page.waitForSelector('#quotations-confirm-dialog[open]');
  await page.getByRole('button', { name: 'Confirmar generación', exact: true }).click();

  await page.waitForSelector('#rfq-section:not([hidden])');
  await page.waitForFunction(() => {
    const summary = globalThis.document.querySelector('#rfq-section-summary');
    return summary && summary.textContent.includes('0 invitación(es) generadas.');
  });

  const createRfqResponsePromise = page.waitForResponse((response) => {
    return response.request().method() === 'POST'
      && /\/api\/procurement\/requests\/\d+\/rfq-invitations$/.test(response.url())
      && response.status() === 201;
  });
  const reloadRfqResponsePromise = page.waitForResponse((response) => {
    return response.request().method() === 'GET'
      && /\/api\/procurement\/requests\/\d+\/rfq-invitations$/.test(response.url())
      && response.status() === 200;
  });

  await page.locator('#rfq-generate-button').click();
  await createRfqResponsePromise;
  await reloadRfqResponsePromise;

  await page.waitForFunction(() => {
    const sectionSummary = globalThis.document.querySelector('#rfq-section-summary');
    const tableRegion = globalThis.document.querySelector('#rfq-invitations-region');
    const trackingSummary = globalThis.document.querySelector('#rfq-tracking-summary');
    return sectionSummary?.textContent.includes('1 invitación(es) generadas.')
      && tableRegion?.textContent.includes('Proveedor Norte')
      && tableRegion?.textContent.includes('Preparada')
      && trackingSummary?.textContent.includes('1 solicitud(es) con invitaciones.');
  }, { timeout: 10000 });

  assert.equal(state.counters.requestGroupedQuotations, 1);
  assert.equal(state.counters.createRfqInvitations, 1);
  assert.deepEqual(state.lastRfqPayload, { supplierIds: [701] });
  assert.ok(Array.isArray(state.lastGroupedPayload?.products));
  assert.equal(state.lastGroupedPayload.products.length, 1);
  assert.equal(state.lastGroupedPayload.products[0].productId, 501);
  assert.equal(state.lastGroupedPayload.products[0].suppliers.length, 1);
});
