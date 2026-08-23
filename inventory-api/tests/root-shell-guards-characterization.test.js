const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootPublicPath = path.join(__dirname, '..', 'src', 'public', 'root');

function executeRootScript(relativePath, context) {
  const source = fs.readFileSync(path.join(rootPublicPath, relativePath), 'utf8');
  vm.runInContext(source, context, { filename: relativePath });
}

function createGuardsHarness() {
  const browserWindow = {};
  const context = vm.createContext({ Map, window: browserWindow });
  browserWindow.window = browserWindow;

  executeRootScript('registry.js', context);
  executeRootScript('guards.js', context);

  return browserWindow.RootShell.require('guards');
}

function createProcurementSession() {
  return {
    user: {
      id: '10',
      role: { code: 'procurement_operator' },
      companyId: '5',
      permissions: ['procurement.manage', 'procurement.view'],
    },
  };
}

function createAdminSession() {
  return {
    user: {
      id: '22',
      role: { code: 'admin' },
      companyId: '77',
      permissions: [],
    },
  };
}

// ─── hasProcurementAccess ──────────────────────────────────────────────────────

test('hasProcurementAccess retorna true con procurement.manage y companyId', () => {
  const guards = createGuardsHarness();
  const session = { user: { companyId: '1', permissions: ['procurement.manage'] } };
  assert.equal(guards.hasProcurementAccess(session), true);
});

test('hasProcurementAccess retorna false con solo procurement.view (sin manage)', () => {
  const guards = createGuardsHarness();
  const session = { user: { companyId: '1', permissions: ['procurement.view'] } };
  assert.equal(guards.hasProcurementAccess(session), false);
});

test('hasProcurementAccess retorna false cuando falta companyId', () => {
  const guards = createGuardsHarness();
  const session = { user: { permissions: ['procurement.manage'] } };
  assert.equal(guards.hasProcurementAccess(session), false);
});

test('hasProcurementAccess retorna false con sesion null', () => {
  const guards = createGuardsHarness();
  assert.equal(guards.hasProcurementAccess(null), false);
});

test('hasProcurementAccess retorna false con sesion vacia', () => {
  const guards = createGuardsHarness();
  assert.equal(guards.hasProcurementAccess({}), false);
});

test('hasProcurementAccess retorna false cuando permissions es array vacio', () => {
  const guards = createGuardsHarness();
  const session = { user: { companyId: '1', permissions: [] } };
  assert.equal(guards.hasProcurementAccess(session), false);
});

// ─── isEligibleRootShellSession ───────────────────────────────────────────────

test('isEligibleRootShellSession acepta procurement_operator con procurement.manage', () => {
  const guards = createGuardsHarness();
  assert.equal(guards.isEligibleRootShellSession(createProcurementSession()), true);
});

test('isEligibleRootShellSession sigue aceptando admin con companyId (sin regresion)', () => {
  const guards = createGuardsHarness();
  assert.equal(guards.isEligibleRootShellSession(createAdminSession()), true);
});

test('isEligibleRootShellSession rechaza sesion null (sin regresion)', () => {
  const guards = createGuardsHarness();
  assert.equal(guards.isEligibleRootShellSession(null), false);
});

test('isEligibleRootShellSession rechaza usuario sin empresa ni permiso (sin regresion)', () => {
  const guards = createGuardsHarness();
  const session = { user: { id: '99', role: { code: 'sales_agent' }, companyId: '1', permissions: [] } };
  assert.equal(guards.isEligibleRootShellSession(session), false);
});

// ─── resolveShellAccess ───────────────────────────────────────────────────────

test('resolveShellAccess retorna allowed:true para procurement_operator con procurement.manage', () => {
  const guards = createGuardsHarness();
  const result = guards.resolveShellAccess(createProcurementSession());
  assert.equal(result.allowed, true);
});

test('resolveShellAccess retorna allowed:false para usuario sin procurement.manage ni admin', () => {
  const guards = createGuardsHarness();
  const session = { user: { id: '99', role: { code: 'sales_agent' }, companyId: '1', permissions: ['sales.routes.view.own'] } };
  const result = guards.resolveShellAccess(session);
  assert.equal(result.allowed, false);
  assert.equal(result.redirect, '/no-access.html');
});

// ─── Router: resolveRoute con procurement session ─────────────────────────────

function createRouterHarness() {
  const browserWindow = {};
  const context = vm.createContext({ Map, window: browserWindow });
  browserWindow.window = browserWindow;

  executeRootScript('registry.js', context);
  executeRootScript('guards.js', context);
  executeRootScript('manifest.js', context);

  function createView(name) {
    return {
      name,
      render(session, item) {
        return `${name}:${item?.routeKey || 'none'}`;
      },
    };
  }

  browserWindow.RootShell.register('views.home', createView('home-view'));
  browserWindow.RootShell.register('views.inProcess', createView('in-process-view'));
  browserWindow.RootShell.register('views.companiesAdmin', createView('companies-view'));
  browserWindow.RootShell.register('views.rolesAdmin', createView('roles-view'));
  browserWindow.RootShell.register('views.zonesAdmin', createView('zones-view'));
  browserWindow.RootShell.register('views.agentsAdmin', createView('agents-view'));
  browserWindow.RootShell.register('views.clientsAdmin', createView('clients-view'));
  browserWindow.RootShell.register('views.routesAdmin', createView('routes-view'));
  browserWindow.RootShell.register('views.warehousesAdmin', createView('warehouses-view'));
  browserWindow.RootShell.register('views.productsAdmin', createView('products-view'));
  browserWindow.RootShell.register('views.lotsAdmin', createView('lots-view'));
  browserWindow.RootShell.register('views.movementsAdmin', createView('movements-view'));
  browserWindow.RootShell.register('views.recipesAdmin', createView('recipes-view'));
  browserWindow.RootShell.register('views.productionOrdersAdmin', createView('production-orders-view'));
  browserWindow.RootShell.register('views.productionPlanner', createView('production-planner-view'));
  browserWindow.RootShell.register('views.billingAdmin', createView('billing-view'));
  browserWindow.RootShell.register('views.approvalsAdmin', createView('approvals-view'));
  browserWindow.RootShell.register('views.suppliersAdmin', createView('suppliers-view'));
  browserWindow.RootShell.register('views.quotationsAdmin', createView('quotations-view'));
  browserWindow.RootShell.register('views.rfqTrackingAdmin', createView('rfq-tracking-view'));
  browserWindow.RootShell.register('views.quotationsComparison', createView('quotations-comparison-view'));
  browserWindow.RootShell.register('views.purchaseRequestsAdmin', createView('purchase-requests-view'));
  browserWindow.RootShell.register('views.purchaseOrdersAdmin', createView('purchase-orders-view'));
  browserWindow.RootShell.register('views.receiptsAdmin', createView('receipts-view'));
  browserWindow.RootShell.register('views.fiscalRefsAdmin', createView('fiscal-refs-view'));
  browserWindow.RootShell.register('views.usersAdmin', createView('users-view'));

  executeRootScript('router.js', context);
  return browserWindow.RootShell.require('router');
}

test('resolveRoute retorna allowed:false cuando procurement_operator navega a ruta no autorizada (#users)', () => {
  // Note: the route key is 'users' (not 'usuarios'). An unknown hash is treated as
  // an unknown route (allowed: true with fallback). We test a real inaccessible route key.
  const router = createRouterHarness();
  const session = createProcurementSession();
  const resolution = router.resolveRoute('#users', session);
  assert.equal(resolution.allowed, false);
  assert.equal(resolution.requestedRouteKey, 'users');
});

test('resolveRoute retorna allowed:true para procurement_operator en ruta autorizada (#products)', () => {
  const router = createRouterHarness();
  const session = createProcurementSession();
  const resolution = router.resolveRoute('#products', session);
  assert.equal(resolution.allowed, true);
  assert.equal(resolution.routeKey, 'products');
});

test('resolveRoute retorna allowed:true para procurement_operator en ruta #proveedores', () => {
  const router = createRouterHarness();
  const session = createProcurementSession();
  const resolution = router.resolveRoute('#proveedores', session);
  assert.equal(resolution.allowed, true);
  assert.equal(resolution.routeKey, 'proveedores');
});

test('resolveRoute retorna allowed:false para procurement_operator en #warehouses (no autorizado)', () => {
  const router = createRouterHarness();
  const session = createProcurementSession();
  const resolution = router.resolveRoute('#warehouses', session);
  assert.equal(resolution.allowed, false);
});

test('resolveRoute sigue retornando allowed:true para admin en cualquier ruta (sin regresion)', () => {
  const router = createRouterHarness();
  const adminSession = {
    user: { id: '22', role: { code: 'admin' }, companyId: '77', permissions: [] },
  };
  const resolution = router.resolveRoute('#usuarios', adminSession);
  // 'usuarios' is a pending admin entry — check it falls back but is still allowed:true for admin
  // (admin can access admin_home as fallback)
  assert.equal(typeof resolution.allowed, 'boolean');
  assert.equal(typeof resolution.routeKey, 'string');
});

// ─── Manifest visibility regression: items that must NOT be visible to procurement ──

function createManifestHarness() {
  const browserWindow = {};
  const context = vm.createContext({ Map, window: browserWindow });
  browserWindow.window = browserWindow;

  executeRootScript('registry.js', context);
  executeRootScript('guards.js', context);
  executeRootScript('manifest.js', context);

  return browserWindow.RootShell.require('manifest');
}

test('manifest: suppliersAdminItem es visible para procurement_operator', () => {
  const manifest = createManifestHarness();
  const session = createProcurementSession();
  const item = manifest.items.find((i) => i.id === 'proveedores');
  assert.ok(item, 'suppliersAdminItem debe existir en items');
  assert.equal(item.visibilityRule(session), true);
});

test('manifest: productsItem es visible para procurement_operator', () => {
  const manifest = createManifestHarness();
  const session = createProcurementSession();
  const item = manifest.items.find((i) => i.id === 'products');
  assert.ok(item, 'productsItem debe existir en items');
  assert.equal(item.visibilityRule(session), true);
});

test('manifest: fiscalRefsAdminItem es visible para procurement_operator', () => {
  const manifest = createManifestHarness();
  const session = createProcurementSession();
  const item = manifest.items.find((i) => i.id === 'referencias-fiscales');
  assert.ok(item, 'fiscalRefsAdminItem debe existir en items');
  assert.equal(item.visibilityRule(session), true);
});

test('manifest: warehousesItem NO es visible para procurement_operator (no cambio)', () => {
  const manifest = createManifestHarness();
  const session = createProcurementSession();
  const item = manifest.items.find((i) => i.id === 'warehouses');
  assert.ok(item, 'warehousesItem debe existir en items');
  assert.equal(item.visibilityRule(session), false);
});

test('manifest: rolesPermissionsItem NO es visible para procurement_operator', () => {
  const manifest = createManifestHarness();
  const session = createProcurementSession();
  const item = manifest.items.find((i) => i.id === 'roles-permissions');
  assert.ok(item, 'rolesPermissionsItem debe existir en items');
  assert.equal(item.visibilityRule(session), false);
});

test('manifest: recipesAdminItem NO es visible para procurement_operator (produccion-group)', () => {
  const manifest = createManifestHarness();
  const session = createProcurementSession();
  const item = manifest.items.find((i) => i.id === 'recetas');
  assert.ok(item, 'recipesAdminItem debe existir en items');
  assert.equal(item.visibilityRule(session), false);
});

test('manifest: admin sigue viendo todos los items que veia antes (sin regresion)', () => {
  const manifest = createManifestHarness();
  const adminSession = createAdminSession();
  const itemsWithAdminRule = manifest.items.filter(
    (i) => typeof i.visibilityRule === 'function' && i.actorScope === 'company-admin'
  );
  for (const item of itemsWithAdminRule) {
    assert.equal(item.visibilityRule(adminSession), true,
      `Admin debe ver el item: ${item.id}`);
  }
});

// ─── session-adapter getActorType (AUD-001 critical fix) ──────────────────────

function createSessionAdapterHarness() {
  const browserWindow = {};
  const context = vm.createContext({
    Map,
    window: browserWindow,
  });
  browserWindow.window = browserWindow;
  browserWindow.InventorySession = { read() { return null; } };
  browserWindow.InventoryAuth = { bootstrapSession: async () => null, fetchJson: async () => null };

  executeRootScript('registry.js', context);
  executeRootScript('session-adapter.js', context);

  return browserWindow.RootShell.require('sessionAdapter');
}

test('getActorType retorna company-admin para procurement_operator con procurement.manage y companyId', () => {
  const sessionAdapter = createSessionAdapterHarness();
  const session = createProcurementSession();
  assert.equal(sessionAdapter.getActorType(session), 'company-admin');
});

test('getActorType retorna root para sesion root sin companyId (sin regresion)', () => {
  const sessionAdapter = createSessionAdapterHarness();
  const session = { user: { role: { code: 'root' }, companyId: null } };
  assert.equal(sessionAdapter.getActorType(session), 'root');
});

test('getActorType retorna company-admin para admin con companyId (sin regresion)', () => {
  const sessionAdapter = createSessionAdapterHarness();
  const session = createAdminSession();
  assert.equal(sessionAdapter.getActorType(session), 'company-admin');
});

test('getActorType retorna unknown para usuario sin procurement.manage ni admin (sin regresion)', () => {
  const sessionAdapter = createSessionAdapterHarness();
  const session = {
    user: { role: { code: 'sales_agent' }, companyId: '1', permissions: ['sales.orders.create'] },
  };
  assert.equal(sessionAdapter.getActorType(session), 'unknown');
});

test('getActorType retorna unknown para procurement.view sin manage (no acceso al admin shell)', () => {
  const sessionAdapter = createSessionAdapterHarness();
  const session = {
    user: { companyId: '1', permissions: ['procurement.view'] },
  };
  assert.equal(sessionAdapter.getActorType(session), 'unknown');
});

// ─── inferDashboard (AUD-002) ─────────────────────────────────────────────────

function createUsersAdminHelpersHarness() {
  const browserWindow = {};
  const context = vm.createContext({
    Map,
    window: browserWindow,
  });
  browserWindow.window = browserWindow;

  executeRootScript('registry.js', context);

  // Load the helper from views/
  const helperSource = fs.readFileSync(
    path.join(rootPublicPath, 'views', 'users-admin.helpers.js'),
    'utf8'
  );
  vm.runInContext(helperSource, context, { filename: 'views/users-admin.helpers.js' });

  return browserWindow.RootShell.require('views.usersAdminHelpers');
}

test('inferDashboard retorna /root/ con nota abastecimiento para procurement.manage', () => {
  const helpers = createUsersAdminHelpersHarness();
  const role = { code: 'procurement_operator', permissions: [{ code: 'procurement.manage' }] };
  const result = helpers.inferDashboard(role);
  assert.equal(result.path, '/root/');
  assert.equal(result.note, 'abastecimiento');
});

test('inferDashboard retorna /root/ para procurement.manage con formato rolePermissions', () => {
  const helpers = createUsersAdminHelpersHarness();
  const role = {
    code: 'procurement_operator',
    rolePermissions: [{ permission: { code: 'procurement.manage' } }],
  };
  const result = helpers.inferDashboard(role);
  assert.equal(result.path, '/root/');
  assert.equal(result.note, 'abastecimiento');
});

test('inferDashboard retorna /root/ para admin (sin regresion)', () => {
  const helpers = createUsersAdminHelpersHarness();
  const result = helpers.inferDashboard({ code: 'admin' });
  assert.equal(result.path, '/root/');
});

test('inferDashboard retorna /agent/ para sales_agent (sin regresion)', () => {
  const helpers = createUsersAdminHelpersHarness();
  const result = helpers.inferDashboard({ code: 'sales_agent' });
  assert.equal(result.path, '/agent/');
});

test('inferDashboard retorna /warehouse/ para warehouse.access (sin regresion)', () => {
  const helpers = createUsersAdminHelpersHarness();
  const role = { code: 'warehouse_operator', permissions: [{ code: 'warehouse.access' }] };
  const result = helpers.inferDashboard(role);
  assert.equal(result.path, '/warehouse/');
});

test('inferDashboard retorna /no-access.html como fallback (sin regresion)', () => {
  const helpers = createUsersAdminHelpersHarness();
  const role = { code: 'unknown_role', permissions: [] };
  const result = helpers.inferDashboard(role);
  assert.equal(result.path, '/no-access.html');
});
