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
        reject(new Error('Could not resolve billing views E2E server address.'));
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

async function stubBillingRuntime(page, baseUrl, user) {
  const state = {
    receivables: [
      {
        id: 1001,
        invoiceNumber: 'INV-501',
        amount: 15000,
        pendingAmount: 10000,
        status: 'PARTIAL',
        dueAt: new Date(Date.now() + 86400000 * 7).toISOString(),
        client: { name: 'Cliente Norte' },
      },
      {
        id: 1002,
        invoiceNumber: 'INV-502',
        amount: 5000,
        pendingAmount: 5000,
        status: 'PENDING',
        dueAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        client: { name: 'Cliente Sur' },
      },
    ],
    pendingPayments: [
      {
        id: 2001,
        invoiceId: 1001,
        amount: 5000,
        paymentMethod: 'TRANSFER',
        reference: 'REF-9876',
        status: 'PENDING_APPROVAL',
        submittedAt: new Date().toISOString(),
        invoice: { invoiceNumber: 'INV-501', client: { name: 'Cliente Norte' } },
      },
    ],
    clients: [
      { id: 301, name: 'Cliente Norte' },
      { id: 302, name: 'Cliente Sur' },
    ],
    ledger: {
      client: { id: 301, name: 'Cliente Norte', creditLimit: 50000, creditBalance: 15000 },
      invoices: [
        {
          id: 1001,
          invoiceNumber: 'INV-501',
          amount: 15000,
          pendingAmount: 10000,
          status: 'PARTIAL',
          dueAt: new Date(Date.now() + 86400000 * 7).toISOString(),
          payments: [
            { id: 2001, paymentMethod: 'TRANSFER', reference: 'REF-9876', amount: 5000, status: 'PENDING_APPROVAL', createdAt: new Date().toISOString() },
          ],
        },
      ],
    },
    counters: {
      fetchReceivables: 0,
      fetchPending: 0,
      fetchClientsForLedger: 0,
      fetchClientLedger: 0,
      createPayment: 0,
      approvePayment: 0,
      rejectPayment: 0,
    },
  };

  await stubAuthMe(page, baseUrl, user);

  // Invoices endpoint (receivables)
  await page.route((url) => url.pathname.startsWith('/api/invoices'), async (route) => {
    state.counters.fetchReceivables += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(cloneJson(state.receivables)),
    });
  });

  // Payments endpoints — specific actions first, then catch-all
  await page.route((url) => /\/api\/payments\/\d+\/approve$/.test(url.pathname), async (route) => {
    state.counters.approvePayment += 1;
    const paymentId = Number(route.request().url().split('/').slice(-2)[0]);
    const payment = state.pendingPayments.find((p) => Number(p.id) === paymentId);
    if (payment) {
      payment.status = 'APPROVED';
    }
    state.pendingPayments = state.pendingPayments.filter((p) => p.status === 'PENDING_APPROVAL');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: paymentId, status: 'APPROVED' }),
    });
  });

  await page.route((url) => /\/api\/payments\/\d+\/reject$/.test(url.pathname), async (route) => {
    state.counters.rejectPayment += 1;
    const paymentId = Number(route.request().url().split('/').slice(-2)[0]);
    state.pendingPayments = state.pendingPayments.filter((p) => Number(p.id) !== paymentId);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: paymentId, status: 'REJECTED' }),
    });
  });

  await page.route((url) => url.pathname === '/api/payments', async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      state.counters.createPayment += 1;
      const payload = JSON.parse(route.request().postData() || '{}');
      const created = {
        id: 2050,
        invoiceId: payload.invoiceId,
        amount: payload.amount,
        paymentMethod: payload.paymentMethod,
        reference: payload.reference || null,
        status: 'PENDING_APPROVAL',
      };
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(created) });
      return;
    }

    // GET — pending payments
    state.counters.fetchPending += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(cloneJson(state.pendingPayments)),
    });
  });

  // Client ledger endpoint
  await page.route((url) => /\/api\/clients\/\d+\/ledger$/.test(url.pathname), async (route) => {
    state.counters.fetchClientLedger += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(cloneJson(state.ledger)),
    });
  });

  // Clients for ledger selector
  await page.route((url) => url.pathname === '/api/clients/company', async (route) => {
    state.counters.fetchClientsForLedger += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(cloneJson(state.clients)),
    });
  });

  return state;
}

// ─── Test: billing view renders tabs, receivables, pending payments, and ledger ───

test('billing views E2E: renders receivables tab with invoices and supports tab navigation', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(() => stopServer(server, sockets));

  const page = await createBrowserPage(t);
  const adminUser = createBrowserSessionUser();
  const state = await stubBillingRuntime(page, baseUrl, adminUser);

  await seedBrowserSession(page, baseUrl, adminUser);
  await page.goto(`${baseUrl}/root/`);
  await page.waitForFunction(() => globalThis.location.hash === '#admin_home');

  // Navigate to billing view
  await page.getByRole('link', { name: 'Facturación', exact: true }).click();
  await page.waitForFunction(() => globalThis.location.hash === '#billing');
  await page.waitForFunction(() =>
    globalThis.document.getElementById('billing-view-title')?.textContent === 'Facturación y cobros',
  );

  // Receivables tab is active by default and shows invoice data
  await page.waitForFunction(() => {
    const panel = globalThis.document.getElementById('billing-panel-receivables');
    return panel && panel.textContent.includes('INV-501') && panel.textContent.includes('Cliente Norte');
  });
  assert.equal(state.counters.fetchReceivables, 1, 'receivables should be fetched on mount');

  // Verify overdue invoice is visible
  await page.waitForFunction(() => {
    const panel = globalThis.document.getElementById('billing-panel-receivables');
    return panel && panel.textContent.includes('INV-502') && panel.textContent.includes('Cliente Sur');
  });

  // Switch to pending payments tab
  await page.locator('#billing-tab-pending').click();
  await page.waitForFunction(() => {
    const panel = globalThis.document.getElementById('billing-panel-pending');
    return panel && !panel.classList.contains('hidden') && panel.textContent.includes('REF-9876');
  });
  assert.equal(state.counters.fetchPending, 1, 'pending payments should be fetched on first tab switch');

  // Verify pending payment details
  await page.waitForFunction(() => {
    const panel = globalThis.document.getElementById('billing-panel-pending');
    return panel && panel.textContent.includes('Cliente Norte') && panel.textContent.includes('INV-501');
  });

  // Switch to history tab and verify client selector
  await page.locator('#billing-tab-history').click();
  await page.waitForFunction(() => {
    const panel = globalThis.document.getElementById('billing-panel-history');
    return panel && !panel.classList.contains('hidden');
  });
  await page.waitForFunction(() => {
    const sel = globalThis.document.getElementById('billing-client-selector');
    return sel && sel.options.length > 1;
  });
  assert.equal(state.counters.fetchClientsForLedger, 1, 'clients should be fetched for ledger selector');

  // Select a client and verify ledger loads
  await page.locator('#billing-client-selector').selectOption('301');
  await page.waitForFunction(() => {
    const region = globalThis.document.getElementById('billing-ledger-region');
    return region && region.textContent.includes('INV-501');
  });
  assert.equal(state.counters.fetchClientLedger, 1, 'client ledger should be fetched on selection');

  // Verify credit balance bar is rendered
  await page.waitForFunction(() => {
    const region = globalThis.document.getElementById('billing-ledger-region');
    return region && region.textContent.includes('Crédito utilizado');
  });
});

test('billing views E2E: payment dialog opens from receivables and submits create+approve', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(() => stopServer(server, sockets));

  const page = await createBrowserPage(t);
  const adminUser = createBrowserSessionUser();
  const state = await stubBillingRuntime(page, baseUrl, adminUser);

  await seedBrowserSession(page, baseUrl, adminUser);
  await page.goto(`${baseUrl}/root/`);
  await page.waitForFunction(() => globalThis.location.hash === '#admin_home');

  // Navigate to billing
  await page.getByRole('link', { name: 'Facturación', exact: true }).click();
  await page.waitForFunction(() => globalThis.location.hash === '#billing');

  // Wait for receivables to load
  await page.waitForFunction(() => {
    const panel = globalThis.document.getElementById('billing-panel-receivables');
    return panel && panel.textContent.includes('INV-501');
  });

  // Click "Registrar pago" on the first invoice
  await page.locator('.billing-register-payment-btn').first().click();

  // Wait for dialog to open
  await page.waitForFunction(() => {
    const dialog = /** @type {HTMLDialogElement|null} */ (globalThis.document.getElementById('billing-pay-dialog'));
    return dialog && dialog.open;
  });

  // Verify dialog subtitle shows the invoice info
  await page.waitForFunction(() => {
    const sub = globalThis.document.getElementById('billing-pay-dialog-subtitle');
    return sub && sub.textContent.includes('INV-501');
  });

  // Fill in payment form
  await page.locator('#billing-pay-amount').fill('5000');

  // Submit the payment
  await page.locator('#billing-pay-submit').click();

  // Wait for dialog to close (create + approve cycle completes)
  await page.waitForFunction(() => {
    const dialog = /** @type {HTMLDialogElement|null} */ (globalThis.document.getElementById('billing-pay-dialog'));
    return dialog && !dialog.open;
  });

  assert.equal(state.counters.createPayment, 1, 'createPayment should be called once');
  assert.equal(state.counters.approvePayment, 1, 'approvePayment should be called immediately after create');
  assert.ok(state.counters.fetchReceivables >= 2, 'receivables should be reloaded after payment');
});

test('billing views E2E: pending payments tab supports reject flow with reason modal', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(() => stopServer(server, sockets));

  const page = await createBrowserPage(t);
  const adminUser = createBrowserSessionUser();
  const state = await stubBillingRuntime(page, baseUrl, adminUser);

  await seedBrowserSession(page, baseUrl, adminUser);
  await page.goto(`${baseUrl}/root/`);
  await page.waitForFunction(() => globalThis.location.hash === '#admin_home');

  // Navigate to billing
  await page.getByRole('link', { name: 'Facturación', exact: true }).click();
  await page.waitForFunction(() => globalThis.location.hash === '#billing');

  // Switch to pending tab
  await page.locator('#billing-tab-pending').click();
  await page.waitForFunction(() => {
    const panel = globalThis.document.getElementById('billing-panel-pending');
    return panel && panel.textContent.includes('REF-9876');
  });

  // Click reject on the pending payment
  await page.locator('.billing-reject-btn').first().click();

  // Reject reason modal should appear
  await page.waitForFunction(() => {
    const overlay = globalThis.document.querySelector('.billing-modal-overlay');
    return overlay !== null;
  });

  // Fill in the reason and confirm
  await page.locator('#billing-reject-reason').fill('Referencia incorrecta');
  await page.locator('.billing-modal-confirm').click();

  // Modal should close
  await page.waitForFunction(() => {
    const overlay = globalThis.document.querySelector('.billing-modal-overlay');
    return overlay === null;
  });

  // After rejection, pending list is reloaded (now empty)
  await page.waitForFunction(() => {
    const panel = globalThis.document.getElementById('billing-panel-pending');
    return panel && panel.textContent.includes('No hay cobros pendientes');
  });
  assert.equal(state.counters.rejectPayment, 1, 'rejectPayment should be called once');
});
