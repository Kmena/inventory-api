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

const DESKTOP_VIEWPORT = { width: 1366, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const GEOMETRY_TOLERANCE_PX = 2;
const OVERFLOW_TOLERANCE_PX = 8;
const EXPANDED_SIDEBAR_MIN_WIDTH_PX = 260;
const EXPANDED_SIDEBAR_MAX_WIDTH_PX = 320;
const COLLAPSED_SIDEBAR_MIN_WIDTH_PX = 72;
const COLLAPSED_SIDEBAR_MAX_WIDTH_PX = 104;

function createBrowserSessionUser({
  id = '77',
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
    role: { code: roleCode },
    permissions,
  };
}

async function startServer() {
  return new Promise((resolve, reject) => {
    const sockets = new Set();
    const server = app.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Could not resolve browser layout server address.'));
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

async function stubAuthMe(page, baseUrl, user) {
  await page.route(`${baseUrl}/api/auth/me`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(user),
    });
  });
}

async function openRootShell(page, baseUrl, expectedHash) {
  await page.goto(`${baseUrl}/root/`);
  await page.waitForFunction((hash) => globalThis.location.hash === hash, expectedHash);
  await page.waitForSelector('#root-view-title');
  await page.waitForFunction(() => {
    const browserDocument = globalThis.document;
    const shell = browserDocument.querySelector('.root-shell');
    const header = browserDocument.querySelector('.root-header');
    const main = browserDocument.getElementById('root-main');
    return !!shell
      && !!header
      && !!main
      && header.getBoundingClientRect().width > 0
      && main.getBoundingClientRect().width > 0;
  });
}

async function readShellGeometry(page) {
  return page.evaluate(() => {
    const browserDocument = globalThis.document;
    const shell = browserDocument.querySelector('.root-shell');
    const sidebar = browserDocument.getElementById('root-admin-sidebar');
    const scroll = browserDocument.querySelector('.root-sidebar__scroll');
    const nav = browserDocument.getElementById('root-admin-nav');
    const activeItem = browserDocument.querySelector('.root-sidebar__link.active');
    const header = browserDocument.querySelector('.root-header');
    const main = browserDocument.getElementById('root-main');
    const overlay = browserDocument.getElementById('root-sidebar-overlay');
    const drawerButton = browserDocument.getElementById('root-sidebar-drawer-button');
    const topNav = browserDocument.getElementById('root-nav');

    function rect(node) {
      if (!node) {
        return null;
      }

      const box = node.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
      };
    }

    function metrics(node) {
      if (!node) {
        return null;
      }

      return {
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
        offsetWidth: node.offsetWidth,
      };
    }

    return {
      shellActor: shell?.getAttribute('data-shell-actor') || null,
      sidebarState: shell?.getAttribute('data-sidebar-state') || null,
      drawerState: shell?.getAttribute('data-drawer-open') || null,
      sidebarHidden: sidebar?.hidden ?? null,
      overlayHidden: overlay?.hidden ?? null,
      drawerButtonHidden: drawerButton?.hidden ?? null,
      topNavHidden: topNav?.hidden ?? null,
      sidebarRect: rect(sidebar),
      scrollRect: rect(scroll),
      navRect: rect(nav),
      activeItemRect: rect(activeItem),
      headerRect: rect(header),
      mainRect: rect(main),
      scrollMetrics: metrics(scroll),
      navMetrics: metrics(nav),
      activeItemMetrics: metrics(activeItem),
    };
  });
}

function assertNoHorizontalOverflow(metrics, label) {
  assert.ok(metrics, `${label} metrics should exist.`);
  assert.ok(
    metrics.scrollWidth <= metrics.clientWidth + OVERFLOW_TOLERANCE_PX,
    `${label} should not overflow horizontally beyond tolerance (scrollWidth=${metrics.scrollWidth}, clientWidth=${metrics.clientWidth}).`,
  );
}

function assertWithinRange(value, min, max, label) {
  assert.ok(value >= min && value <= max, `${label} should stay within ${min}-${max}px, got ${value}.`);
}

test('root shell layout: company-admin expanded desktop preserves sidebar width, no overlap and no horizontal overflow', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(() => stopServer(server, sockets));

  const page = await createBrowserPage(t, DESKTOP_VIEWPORT);
  const adminUser = createBrowserSessionUser({ id: '77', roleCode: 'admin', companyId: '77', fullName: 'Admin Demo', username: 'admin-demo' });

  await stubAuthMe(page, baseUrl, adminUser);
  await seedBrowserSession(page, baseUrl, adminUser);
  await openRootShell(page, baseUrl, '#admin_home');

  const geometry = await readShellGeometry(page);

  assert.equal(geometry.shellActor, 'company-admin');
  assert.equal(geometry.sidebarState, 'expanded');
  assert.equal(geometry.sidebarHidden, false);
  assertWithinRange(geometry.sidebarRect.width, EXPANDED_SIDEBAR_MIN_WIDTH_PX, EXPANDED_SIDEBAR_MAX_WIDTH_PX, 'Expanded sidebar width');
  assert.ok(geometry.headerRect.left >= geometry.sidebarRect.right - GEOMETRY_TOLERANCE_PX, `Header should not invade sidebar lane (header.left=${geometry.headerRect.left}, sidebar.right=${geometry.sidebarRect.right}).`);
  assert.ok(geometry.mainRect.left >= geometry.sidebarRect.right - GEOMETRY_TOLERANCE_PX, `Main should not invade sidebar lane (main.left=${geometry.mainRect.left}, sidebar.right=${geometry.sidebarRect.right}).`);
  assertNoHorizontalOverflow(geometry.scrollMetrics, 'Sidebar scroll lane');
  assertNoHorizontalOverflow(geometry.navMetrics, 'Sidebar nav container');
});

test('root shell layout: company-admin collapsed desktop preserves rail alignment and active item fit', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(() => stopServer(server, sockets));

  const page = await createBrowserPage(t, DESKTOP_VIEWPORT);
  const adminUser = createBrowserSessionUser({ id: '77', roleCode: 'admin', companyId: '77', fullName: 'Admin Demo', username: 'admin-demo' });

  await stubAuthMe(page, baseUrl, adminUser);
  await seedBrowserSession(page, baseUrl, adminUser);
  await openRootShell(page, baseUrl, '#admin_home');
  await page.click('#root-sidebar-collapse-button');
  await page.waitForFunction(() => {
    const browserDocument = globalThis.document;
    const shell = browserDocument.querySelector('.root-shell');
    const sidebar = browserDocument.getElementById('root-admin-sidebar');
    return shell?.getAttribute('data-sidebar-state') === 'collapsed'
      && !!sidebar
      && sidebar.getBoundingClientRect().width > 0;
  });

  const geometry = await readShellGeometry(page);

  assert.equal(geometry.sidebarState, 'collapsed');
  assertWithinRange(geometry.sidebarRect.width, COLLAPSED_SIDEBAR_MIN_WIDTH_PX, COLLAPSED_SIDEBAR_MAX_WIDTH_PX, 'Collapsed sidebar width');
  assert.ok(geometry.headerRect.left >= geometry.sidebarRect.right - GEOMETRY_TOLERANCE_PX, `Header should stay outside collapsed rail (header.left=${geometry.headerRect.left}, sidebar.right=${geometry.sidebarRect.right}).`);
  assert.ok(geometry.mainRect.left >= geometry.sidebarRect.right - GEOMETRY_TOLERANCE_PX, `Main should stay outside collapsed rail (main.left=${geometry.mainRect.left}, sidebar.right=${geometry.sidebarRect.right}).`);
  assert.ok(geometry.activeItemRect.width <= geometry.sidebarRect.width + GEOMETRY_TOLERANCE_PX, `Active item should fit within collapsed rail (active.width=${geometry.activeItemRect.width}, sidebar.width=${geometry.sidebarRect.width}).`);
  assert.ok(geometry.activeItemRect.width <= geometry.scrollRect.width + OVERFLOW_TOLERANCE_PX, `Active item width should stay bounded by the scroll lane in collapsed mode (active.width=${geometry.activeItemRect.width}, scroll.width=${geometry.scrollRect.width}).`);
  assert.ok(geometry.activeItemRect.right <= geometry.sidebarRect.right + GEOMETRY_TOLERANCE_PX, `Active item should not exceed sidebar rail (active.right=${geometry.activeItemRect.right}, sidebar.right=${geometry.sidebarRect.right}).`);
  assertNoHorizontalOverflow(geometry.scrollMetrics, 'Collapsed sidebar scroll lane');
  assertNoHorizontalOverflow(geometry.navMetrics, 'Collapsed sidebar nav container');
  assertNoHorizontalOverflow(geometry.activeItemMetrics, 'Collapsed active item');
});

test('root shell layout: company-admin mobile drawer opens and closes with stable overlay/layout state', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(() => stopServer(server, sockets));

  const page = await createBrowserPage(t, MOBILE_VIEWPORT);
  const adminUser = createBrowserSessionUser({ id: '77', roleCode: 'admin', companyId: '77', fullName: 'Admin Demo', username: 'admin-demo' });

  await stubAuthMe(page, baseUrl, adminUser);
  await seedBrowserSession(page, baseUrl, adminUser);
  await openRootShell(page, baseUrl, '#admin_home');

  let geometry = await readShellGeometry(page);
  assert.equal(geometry.drawerState, 'false');
  assert.equal(geometry.overlayHidden, true);
  assert.equal(geometry.drawerButtonHidden, false);
  assert.ok(geometry.sidebarRect.right <= OVERFLOW_TOLERANCE_PX, `Closed drawer should stay off-canvas (sidebar.right=${geometry.sidebarRect.right}).`);

  await page.click('#root-sidebar-drawer-button');
  await page.waitForFunction(() => {
    const browserDocument = globalThis.document;
    const shell = browserDocument.querySelector('.root-shell');
    const sidebar = browserDocument.getElementById('root-admin-sidebar');
    return shell?.getAttribute('data-drawer-open') === 'true'
      && shell.getAttribute('data-shell-actor') === 'company-admin'
      && !!sidebar
      && sidebar.getBoundingClientRect().right > 220;
  });
  geometry = await readShellGeometry(page);

  assert.equal(geometry.drawerState, 'true');
  assert.equal(geometry.overlayHidden, false);
  assert.ok(geometry.sidebarRect.left <= GEOMETRY_TOLERANCE_PX, `Open drawer should align to the left edge (sidebar.left=${geometry.sidebarRect.left}).`);
  assert.ok(geometry.sidebarRect.right > 220, `Open drawer should be visibly wide on mobile (sidebar.right=${geometry.sidebarRect.right}).`);
  assertNoHorizontalOverflow(geometry.scrollMetrics, 'Mobile drawer scroll lane');
  assertNoHorizontalOverflow(geometry.navMetrics, 'Mobile drawer nav container');

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => {
    const browserDocument = globalThis.document;
    const shell = browserDocument.querySelector('.root-shell');
    const sidebar = browserDocument.getElementById('root-admin-sidebar');
    const overlay = browserDocument.getElementById('root-sidebar-overlay');
    return shell?.getAttribute('data-drawer-open') === 'false'
      && !!sidebar
      && !!overlay
      && overlay.hidden === true
      && sidebar.getBoundingClientRect().right <= 8;
  });
  geometry = await readShellGeometry(page);

  assert.equal(geometry.drawerState, 'false');
  assert.equal(geometry.overlayHidden, true);
  assert.ok(geometry.sidebarRect.right <= OVERFLOW_TOLERANCE_PX, `Closed drawer should return off-canvas (sidebar.right=${geometry.sidebarRect.right}).`);
});

test('root shell layout: root-global desktop keeps top navigation active without sidebar offset leakage', async (t) => {
  const { server, sockets, baseUrl } = await startServer();
  t.after(() => stopServer(server, sockets));

  const page = await createBrowserPage(t, DESKTOP_VIEWPORT);
  const rootUser = createBrowserSessionUser({ id: '91', roleCode: 'root', fullName: 'Root Demo', username: 'root-demo' });

  await stubAuthMe(page, baseUrl, rootUser);
  await seedBrowserSession(page, baseUrl, rootUser);
  await openRootShell(page, baseUrl, '#home');

  const geometry = await readShellGeometry(page);

  assert.equal(geometry.shellActor, 'root');
  assert.equal(geometry.sidebarHidden, true);
  assert.equal(geometry.topNavHidden, false);
  assert.equal(geometry.drawerButtonHidden, true);
  assert.ok(geometry.headerRect.left < 60, `Root-global header should not inherit sidebar offset (header.left=${geometry.headerRect.left}).`);
  assert.ok(geometry.mainRect.left < 60, `Root-global main should not inherit sidebar offset (main.left=${geometry.mainRect.left}).`);
});
