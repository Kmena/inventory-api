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
  fullName = 'Admin Demo',
  username = 'admin-demo',
} = {}) {
  return {
    id,
    fullName,
    username,
    companyId,
    role: { code: roleCode },
    permissions: [],
  };
}

function cloneZones(zones) {
  return JSON.parse(JSON.stringify(zones));
}

async function startServer() {
  return new Promise((resolve, reject) => {
    const sockets = new Set();
    const server = app.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Could not resolve zones-view E2E server address.'));
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

async function createBrowserPage(t, viewport) {
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

async function stubZonesRuntime(page, baseUrl, user, zonesState, counters) {
  await page.route(`${baseUrl}/api/auth/me`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(user),
    });
  });

  await page.route('**/api/regions/company', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      counters.listRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(cloneZones(zonesState)),
      });
      return;
    }

    if (method === 'POST') {
      counters.createZoneRequests += 1;
      const payload = JSON.parse(route.request().postData() || '{}');
      const normalizedName = String(payload.name || '').trim();

      if (normalizedName.toLowerCase() === 'zona norte') {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Ya existe una zona con ese nombre' }),
        });
        return;
      }

      const createdZone = {
        id: zonesState.length + 1,
        companyId: user.companyId,
        name: normalizedName,
        routeCode: payload.routeCode || null,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
        subregions: [],
      };
      zonesState.push(createdZone);
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(createdZone) });
      return;
    }

    await route.fallback();
  });

  await page.route('**/api/regions/company/*/subregions', async (route) => {
    counters.createSubzoneRequests += 1;
    const payload = JSON.parse(route.request().postData() || '{}');
    const regionId = Number(route.request().url().split('/').slice(-2)[0]);
    const zone = zonesState.find((item) => Number(item.id) === regionId);

    if (!zone) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Zona no encontrada' }),
      });
      return;
    }

    if (String(payload.name || '').trim().toLowerCase() === 'subzona norte 1') {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Ya existe una subzona con ese nombre en esta zona' }),
      });
      return;
    }

    const createdSubzone = {
      id: zone.subregions.length + 100,
      regionId,
      name: String(payload.name || '').trim(),
      routeCode: payload.routeCode || null,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    };
    zone.subregions.push(createdSubzone);
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(createdSubzone) });
  });
}

async function openZonesView(page, baseUrl) {
  await page.goto(`${baseUrl}/root/`);
  await page.waitForFunction(() => globalThis.location.hash === '#admin_home');

  if (page.viewportSize() && page.viewportSize().width < 768) {
    await page.locator('#root-sidebar-drawer-button').click();
    await page.waitForFunction(() => globalThis.document.querySelector('.root-shell')?.getAttribute('data-drawer-open') === 'true');
  }

  await page.getByRole('link', { name: 'Zonas', exact: true }).click();
  await page.waitForFunction(() => globalThis.location.hash === '#zones');
  await page.waitForFunction(() => globalThis.document.getElementById('root-view-title')?.textContent === 'Zonas y subzonas');
}

test('zones view E2E: desktop supports local search, zone creation, duplicate feedback and subzone creation with preserved selection', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(() => stopServer(server, sockets));

  const page = await createBrowserPage(t, { width: 1366, height: 900 });
  const adminUser = createBrowserSessionUser();
  const zonesState = [
    {
      id: 1,
      companyId: '77',
      name: 'Zona Norte',
      routeCode: 'ZN-01',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
      subregions: [
        { id: 101, regionId: 1, name: 'Subzona Norte 1', routeCode: 'SZ-01' },
        { id: 102, regionId: 1, name: 'Subzona Norte 2', routeCode: 'SZ-02' },
      ],
    },
    {
      id: 2,
      companyId: '77',
      name: 'Zona Sur',
      routeCode: 'ZS-02',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
      subregions: [
        { id: 201, regionId: 2, name: 'Subzona Sur 1', routeCode: 'SS-01' },
      ],
    },
  ];
  const counters = { listRequests: 0, createZoneRequests: 0, createSubzoneRequests: 0 };

  await stubZonesRuntime(page, baseUrl, adminUser, zonesState, counters);
  await seedBrowserSession(page, baseUrl, adminUser);
  await openZonesView(page, baseUrl);

  await page.waitForFunction(() => globalThis.document.getElementById('zones-total-count')?.textContent === '2');
  await page.waitForFunction(() => globalThis.document.getElementById('zones-subregion-count')?.textContent === '3');
  assert.equal(counters.listRequests, 1);

  await page.locator('#zones-search-input').fill('sur');
  await page.waitForFunction(() => globalThis.document.querySelectorAll('[data-zone-select]').length === 1);
  await page.waitForFunction(() => globalThis.document.getElementById('zones-detail-title')?.textContent === 'Zona Sur');
  assert.equal(counters.listRequests, 1, 'zone search should stay local');

  await page.locator('#zones-search-input').fill('');
  await page.locator('#zones-open-zone-dialog-button').click();
  await page.getByRole('button', { name: 'Guardar zona' }).click();
  await page.waitForFunction(() => globalThis.document.getElementById('zones-zone-name-error')?.textContent?.includes('Ingresa un nombre'));
  assert.equal(counters.createZoneRequests, 0, 'client validation should prevent create request');

  await page.locator('#zones-zone-name').fill('Zona Norte');
  await page.getByRole('button', { name: 'Guardar zona' }).click();
  await page.waitForFunction(() => globalThis.document.getElementById('zones-zone-form-message')?.textContent?.includes('Ya existe una zona con ese nombre'));
  assert.equal(counters.createZoneRequests, 1);

  await page.locator('#zones-zone-name').fill('Zona Centro');
  await page.locator('#zones-zone-route-code').fill('ZC-03');
  await page.getByRole('button', { name: 'Guardar zona' }).click();
  await page.waitForFunction(() => globalThis.document.getElementById('zones-toast-region')?.textContent?.includes('Zona creada correctamente.'));
  await page.waitForFunction(() => globalThis.document.getElementById('zones-detail-title')?.textContent === 'Zona Centro');
  await page.waitForFunction(() => globalThis.document.getElementById('zones-total-count')?.textContent === '3');
  assert.equal(counters.listRequests, 2);

  await page.locator('#zones-open-subzone-dialog-button').click();
  await page.locator('#zones-subzone-name').fill('Subzona Centro 1');
  await page.locator('#zones-subzone-route-code').fill('SC-01');
  await page.getByRole('button', { name: 'Guardar subzona' }).click();
  await page.waitForFunction(() => globalThis.document.getElementById('zones-toast-region')?.textContent?.includes('Subzona creada correctamente.'));
  await page.waitForFunction(() => globalThis.document.getElementById('zones-detail-title')?.textContent === 'Zona Centro');
  await page.waitForFunction(() => globalThis.document.querySelector('.zones-detail__subregion--highlighted')?.textContent?.includes('Subzona Centro 1'));
  assert.equal(counters.createSubzoneRequests, 1);
  assert.equal(counters.listRequests, 3);

  await page.locator('#zones-subregion-search-input').fill('SC-01');
  await page.waitForFunction(() => globalThis.document.querySelectorAll('.zones-detail__subregion').length === 1);
  assert.equal(counters.listRequests, 3, 'subzone search should stay local');
});

test('zones view E2E: mobile uses consecutive list-detail flow with back navigation', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(() => stopServer(server, sockets));

  const page = await createBrowserPage(t, { width: 390, height: 844 });
  const adminUser = createBrowserSessionUser();
  const zonesState = [
    {
      id: 1,
      companyId: '77',
      name: 'Zona Norte',
      routeCode: 'ZN-01',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
      subregions: [{ id: 101, regionId: 1, name: 'Subzona Norte 1', routeCode: 'SZ-01' }],
    },
  ];
  const counters = { listRequests: 0, createZoneRequests: 0, createSubzoneRequests: 0 };

  await stubZonesRuntime(page, baseUrl, adminUser, zonesState, counters);
  await seedBrowserSession(page, baseUrl, adminUser);
  await openZonesView(page, baseUrl);

  await page.waitForFunction(() => globalThis.document.getElementById('zones-layout')?.classList.contains('zones-page--mobile-list'));
  assert.equal(await page.locator('.zones-list').isVisible(), true);
  assert.equal(await page.locator('.zones-detail').isVisible(), false);

  await page.getByRole('button', { name: /Zona Norte/ }).click();
  await page.waitForFunction(() => globalThis.document.getElementById('zones-layout')?.classList.contains('zones-page--mobile-detail'));
  assert.equal(await page.locator('.zones-detail').isVisible(), true);
  await page.waitForFunction(() => globalThis.document.getElementById('zones-detail-title')?.textContent === 'Zona Norte');

  await page.getByRole('button', { name: '← Volver a zonas' }).click();
  await page.waitForFunction(() => globalThis.document.getElementById('zones-layout')?.classList.contains('zones-page--mobile-list'));
  assert.equal(await page.locator('.zones-list').isVisible(), true);
});
