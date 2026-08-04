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

function createView(name) {
  return {
    name,
    render(session, item) {
      return `${name}:${session?.user?.role?.code || 'anonymous'}:${item?.routeKey || 'none'}`;
    },
  };
}

function createRouterHarness() {
  const browserWindow = {};
  const context = vm.createContext({
    Map,
    window: browserWindow,
  });
  browserWindow.window = browserWindow;

  executeRootScript('registry.js', context);
  executeRootScript('guards.js', context);
  executeRootScript('manifest.js', context);

  browserWindow.RootShell.register('views.home', createView('home-view'));
  browserWindow.RootShell.register('views.inProcess', createView('in-process-view'));
  browserWindow.RootShell.register('views.companiesAdmin', createView('companies-view'));
  browserWindow.RootShell.register('views.rolesAdmin', createView('roles-view'));
  browserWindow.RootShell.register('views.zonesAdmin', createView('zones-view'));
  browserWindow.RootShell.register('views.agentsAdmin', createView('agents-view'));
  browserWindow.RootShell.register('views.clientsAdmin', createView('clients-view'));
  browserWindow.RootShell.register('views.routesAdmin', createView('routes-view'));

  executeRootScript('router.js', context);

  return browserWindow.RootShell.require('router');
}

function createRootSession() {
  return {
    user: {
      id: '1',
      role: { code: 'root' },
      companyId: null,
    },
  };
}

function createCompanyAdminSession() {
  return {
    user: {
      id: '22',
      role: { code: 'admin' },
      companyId: '77',
    },
  };
}

test('router normalizes hashes and falls back to the first accessible route for each actor', () => {
  const router = createRouterHarness();

  assert.equal(router.normalizeHashRoute('#zones'), 'zones');
  assert.equal(router.normalizeHashRoute('#companies '), 'companies');
  assert.equal(router.normalizeHashRoute(' #companies '), '#companies');
  assert.equal(router.getFirstAccessibleRoute(createRootSession()), 'home');
  assert.equal(router.getFirstAccessibleRoute(createCompanyAdminSession()), 'admin_home');
});

test('router denies inaccessible requested routes and falls back to actor-scoped landing', () => {
  const router = createRouterHarness();

  const rootResolution = router.resolveRoute('#zones', createRootSession());
  assert.equal(rootResolution.allowed, false);
  assert.equal(rootResolution.requestedRouteKey, 'zones');
  assert.equal(rootResolution.routeKey, 'home');
  assert.equal(rootResolution.view.name, 'home-view');

  const adminResolution = router.resolveRoute('#companies', createCompanyAdminSession());
  assert.equal(adminResolution.allowed, false);
  assert.equal(adminResolution.requestedRouteKey, 'companies');
  assert.equal(adminResolution.routeKey, 'admin_home');
  assert.equal(adminResolution.view.name, 'in-process-view');
});

test('router resolves supported actor routes and unknown hashes without changing public fallback behavior', () => {
  const router = createRouterHarness();

  const rootCompaniesResolution = router.resolveRoute('#companies', createRootSession());
  assert.equal(rootCompaniesResolution.allowed, true);
  assert.equal(rootCompaniesResolution.routeKey, 'companies');
  assert.equal(rootCompaniesResolution.view.name, 'companies-view');

  const adminRolesResolution = router.resolveRoute('#roles_permissions', createCompanyAdminSession());
  assert.equal(adminRolesResolution.allowed, true);
  assert.equal(adminRolesResolution.routeKey, 'roles_permissions');
  assert.equal(adminRolesResolution.view.name, 'roles-view');

  const adminAgentsResolution = router.resolveRoute('#agents', createCompanyAdminSession());
  assert.equal(adminAgentsResolution.allowed, true);
  assert.equal(adminAgentsResolution.routeKey, 'agents');
  assert.equal(adminAgentsResolution.view.name, 'agents-view');

  const adminClientsResolution = router.resolveRoute('#clients', createCompanyAdminSession());
  assert.equal(adminClientsResolution.allowed, true);
  assert.equal(adminClientsResolution.routeKey, 'clients');
  assert.equal(adminClientsResolution.view.name, 'clients-view');

  const adminRoutesResolution = router.resolveRoute('#routes', createCompanyAdminSession());
  assert.equal(adminRoutesResolution.allowed, true);
  assert.equal(adminRoutesResolution.routeKey, 'routes');
  assert.equal(adminRoutesResolution.view.name, 'routes-view');

  const adminUnknownResolution = router.resolveRoute('#missing-route', createCompanyAdminSession());
  assert.equal(adminUnknownResolution.allowed, true);
  assert.equal(adminUnknownResolution.requestedRouteKey, 'missing-route');
  assert.equal(adminUnknownResolution.routeKey, 'admin_home');
  assert.equal(adminUnknownResolution.view.name, 'in-process-view');
});

test('router renderRoute delegates to the resolved view contract', () => {
  const router = createRouterHarness();
  const session = createCompanyAdminSession();
  const resolution = router.resolveRoute('#routes', session);

  assert.equal(router.renderRoute(resolution, session), 'routes-view:admin:routes');
});
