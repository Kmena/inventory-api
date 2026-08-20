const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootPublicPath = path.join(__dirname, '..', 'src', 'public', 'root');

function readRootFile(relativePath) {
  return fs.readFileSync(path.join(rootPublicPath, relativePath), 'utf8');
}

function executeRootScript(relativePath, context) {
  const source = readRootFile(relativePath);
  vm.runInContext(source, context, { filename: relativePath });
}

function createBrowserContext() {
  const browserWindow = {};
  const context = vm.createContext({ Map, window: browserWindow });
  browserWindow.window = browserWindow;
  return { browserWindow, context };
}

function buildHelpersModule() {
  const { browserWindow, context } = createBrowserContext();
  executeRootScript('registry.js', context);
  executeRootScript('views/users-admin.helpers.js', context);
  return browserWindow.RootShell.require('views.usersAdminHelpers');
}

function buildManifest() {
  const { browserWindow, context } = createBrowserContext();
  executeRootScript('registry.js', context);
  executeRootScript('guards.js', context);
  executeRootScript('manifest.js', context);
  return browserWindow.RootShell.require('manifest');
}

// ── inferDashboard ────────────────────────────────────────────────────────────

test('inferDashboard devuelve /root/ con note null para roleCode root', () => {
  const { inferDashboard } = buildHelpersModule();
  const result = inferDashboard({ code: 'root' });
  assert.equal(result.path, '/root/');
  assert.equal(result.label, 'Root');
  assert.equal(result.note, null);
});

test('inferDashboard devuelve /root/ con note administrador para roleCode admin', () => {
  const { inferDashboard } = buildHelpersModule();
  const result = inferDashboard({ code: 'admin' });
  assert.equal(result.path, '/root/');
  assert.equal(result.note, 'administrador');
});

test('inferDashboard devuelve /agent/ para roleCode sales_agent', () => {
  const { inferDashboard } = buildHelpersModule();
  const result = inferDashboard({ code: 'sales_agent' });
  assert.equal(result.path, '/agent/');
  assert.equal(result.note, null);
});

test('inferDashboard devuelve /root/ con note acceso comercial para roleCode sales_supervisor', () => {
  const { inferDashboard } = buildHelpersModule();
  const result = inferDashboard({ code: 'sales_supervisor' });
  assert.equal(result.path, '/root/');
  assert.equal(result.note, 'acceso comercial');
});

test('inferDashboard devuelve /agent/ para permisos operativos exactos sin assign ni all', () => {
  const { inferDashboard } = buildHelpersModule();
  const role = {
    code: 'custom',
    permissions: [
      { code: 'sales.routes.view.own' },
      { code: 'sales.orders.create' },
      { code: 'customer.activities.manage' },
    ],
  };
  const result = inferDashboard(role);
  assert.equal(result.path, '/agent/');
});

test('inferDashboard NO devuelve /agent/ cuando permissions incluye sales.routes.assign', () => {
  const { inferDashboard } = buildHelpersModule();
  const role = {
    code: 'custom',
    permissions: [
      { code: 'sales.routes.view.own' },
      { code: 'sales.orders.create' },
      { code: 'customer.activities.manage' },
      { code: 'sales.routes.assign' },
    ],
  };
  const result = inferDashboard(role);
  assert.notEqual(result.path, '/agent/');
});

test('inferDashboard NO devuelve /agent/ cuando permissions incluye sales.routes.view.all', () => {
  const { inferDashboard } = buildHelpersModule();
  const role = {
    code: 'custom',
    permissions: [
      { code: 'sales.routes.view.own' },
      { code: 'sales.orders.create' },
      { code: 'customer.activities.manage' },
      { code: 'sales.routes.view.all' },
    ],
  };
  const result = inferDashboard(role);
  assert.notEqual(result.path, '/agent/');
});

test('inferDashboard devuelve /warehouse/ cuando permissions incluye warehouse.access', () => {
  const { inferDashboard } = buildHelpersModule();
  const role = { code: 'warehouse_op', permissions: [{ code: 'warehouse.access' }] };
  const result = inferDashboard(role);
  assert.equal(result.path, '/warehouse/');
});

test('inferDashboard devuelve /warehouse/ cuando rolePermissions contiene warehouse.access (formato Prisma)', () => {
  const { inferDashboard } = buildHelpersModule();
  const role = {
    code: 'qa_inspector',
    rolePermissions: [{ permission: { code: 'warehouse.access' } }],
  };
  const result = inferDashboard(role);
  assert.equal(result.path, '/warehouse/');
});

test('inferDashboard devuelve /no-access.html para rol sin permisos especiales', () => {
  const { inferDashboard } = buildHelpersModule();
  const result = inferDashboard({ code: 'viewer', permissions: [] });
  assert.equal(result.path, '/no-access.html');
  assert.equal(result.label, 'Sin acceso');
});

test('inferDashboard no lanza para null', () => {
  const { inferDashboard } = buildHelpersModule();
  assert.doesNotThrow(() => inferDashboard(null));
  const result = inferDashboard(null);
  assert.equal(result.path, '/no-access.html');
});

test('inferDashboard prioriza code sales_agent sobre warehouse.access en permisos', () => {
  const { inferDashboard } = buildHelpersModule();
  const role = {
    code: 'sales_agent',
    permissions: [{ code: 'warehouse.access' }],
  };
  const result = inferDashboard(role);
  assert.equal(result.path, '/agent/');
});

// ── filterUsers ───────────────────────────────────────────────────────────────

function makeComposedUser(overrides = {}) {
  return {
    id: '1',
    fullName: 'Carlos Perez',
    username: 'cperez',
    role: { code: 'admin', name: 'Administrador', permissions: [] },
    dashboardDescriptor: { path: '/root/', label: 'Root', note: null },
    ...overrides,
  };
}

test('filterUsers retorna todos si searchTerm y dashboardFilter estan vacios', () => {
  const { filterUsers } = buildHelpersModule();
  const users = [makeComposedUser(), makeComposedUser({ id: '2', fullName: 'Ana Lopez' })];
  assert.equal(filterUsers(users, '', 'all').length, 2);
  assert.equal(filterUsers(users, '', '').length, 2);
});

test('filterUsers filtra por texto en fullName case insensitive', () => {
  const { filterUsers } = buildHelpersModule();
  const users = [
    makeComposedUser({ fullName: 'Carlos Perez' }),
    makeComposedUser({ id: '2', fullName: 'Ana Lopez' }),
  ];
  const result = filterUsers(users, 'carlos', 'all');
  assert.equal(result.length, 1);
  assert.equal(result[0].fullName, 'Carlos Perez');
});

test('filterUsers filtra por dashboardFilter path exacto', () => {
  const { filterUsers } = buildHelpersModule();
  const users = [
    makeComposedUser({ dashboardDescriptor: { path: '/root/', label: 'Root', note: null } }),
    makeComposedUser({ id: '2', dashboardDescriptor: { path: '/agent/', label: 'Agent', note: null } }),
  ];
  const result = filterUsers(users, '', '/agent/');
  assert.equal(result.length, 1);
  assert.equal(result[0].id, '2');
});

test('filterUsers combina texto y dashboard', () => {
  const { filterUsers } = buildHelpersModule();
  const users = [
    makeComposedUser({ fullName: 'Carlos Agente', dashboardDescriptor: { path: '/agent/', label: 'Agent', note: null } }),
    makeComposedUser({ id: '2', fullName: 'Carlos Root', dashboardDescriptor: { path: '/root/', label: 'Root', note: null } }),
    makeComposedUser({ id: '3', fullName: 'Ana Agente', dashboardDescriptor: { path: '/agent/', label: 'Agent', note: null } }),
  ];
  const result = filterUsers(users, 'carlos', '/agent/');
  assert.equal(result.length, 1);
  assert.equal(result[0].fullName, 'Carlos Agente');
});

// ── summarizeUsers ────────────────────────────────────────────────────────────

test('summarizeUsers retorna ceros para array vacio', () => {
  const { summarizeUsers } = buildHelpersModule();
  const result = summarizeUsers([]);
  assert.equal(result.total, 0);
  assert.equal(result.root, 0);
  assert.equal(result.agent, 0);
  assert.equal(result.warehouse, 0);
  assert.equal(result.noAccess, 0);
});

// ── Manifest: users promovido a implemented ───────────────────────────────────

test('manifest item users tiene implemented true tras el cambio', () => {
  const manifest = buildManifest();
  const item = manifest.items.find((i) => i.routeKey === 'users');
  assert.ok(item, 'users item debe existir en manifest');
  assert.equal(item.implemented, true);
  assert.equal(item.destination, 'implemented');
  assert.equal(item.actorScope, 'company-admin');
  assert.equal(item.dependencyTag, 'users-admin-view');
});

// ── Source-level: estructura de modulos ───────────────────────────────────────

test('users-api.js registra usersApi con las tres funciones requeridas', () => {
  const source = readRootFile('users-api.js');
  assert.match(source, /rootShell\.register\('usersApi'/);
  assert.match(source, /listCompanyUsers/);
  assert.match(source, /listCompanyRoles/);
  assert.match(source, /createCompanyUser/);
  assert.match(source, /inventoryAuth\.fetchJson/);
  assert.match(source, /inventoryAuth\.buildHeaders/);
});

test('users-admin.helpers.js registra views.usersAdminHelpers con inferDashboard', () => {
  const source = readRootFile('views/users-admin.helpers.js');
  assert.match(source, /rootShell\.register\('views\.usersAdminHelpers'/);
  assert.match(source, /function inferDashboard\(/);
  assert.match(source, /composeUsersDataset/);
  assert.match(source, /filterUsers/);
  assert.match(source, /summarizeUsers/);
});

test('users-admin.renderers.js registra views.usersAdminRenderers y usa escapeHtml', () => {
  const source = readRootFile('views/users-admin.renderers.js');
  assert.match(source, /rootShell\.register\('views\.usersAdminRenderers'/);
  assert.match(source, /ui\.escapeHtml/);
  assert.match(source, /data-user-select/);
  assert.match(source, /<details/);
  assert.match(source, /<optgroup/);
  assert.match(source, /\.code !== 'root'/);
});

test('users-admin.js registra views.usersAdmin con render y mount', () => {
  const source = readRootFile('views/users-admin.js');
  assert.match(source, /rootShell\.register\('views\.usersAdmin'/);
  assert.match(source, /async function mount\(/);
  assert.match(source, /function render\(/);
  assert.match(source, /rootShell\.require\('usersApi'\)/);
  assert.match(source, /rootShell\.require\('views\.usersAdminHelpers'\)/);
  assert.match(source, /rootShell\.require\('views\.usersAdminRenderers'\)/);
  assert.match(source, /rootShell\.require\('ui'\)/);
  assert.match(source, /Promise\.allSettled/);
  assert.match(source, /dialog\.showModal\(\)/);
  assert.match(source, /createForm\.reportValidity\(\)/);
  assert.match(source, /data-user-select/);
});
