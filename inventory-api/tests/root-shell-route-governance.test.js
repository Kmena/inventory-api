const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootPublicPath = path.join(__dirname, '..', 'src', 'public', 'root');

function readRootFile(relativePath) {
  return fs.readFileSync(path.join(rootPublicPath, relativePath), 'utf8');
}

test('root shell manifest keeps actor-aware companies and roles routes', () => {
  const manifestSource = readRootFile('manifest.js');

  assert.match(manifestSource, /label: 'Empresas'/);
  assert.match(manifestSource, /routeKey: 'companies'/);
  assert.match(manifestSource, /visibilityRule: guards\.isRootUser/);
  assert.match(manifestSource, /label: 'Roles y permisos'/);
  assert.match(manifestSource, /routeKey: 'roles_permissions'/);
  assert.match(manifestSource, /visibilityRule: guards\.isCompanyAdmin/);
  assert.match(manifestSource, /routeKey: 'admin_home'/);
  assert.match(manifestSource, /createAdminPendingEntry\('admin-home', 'Inicio', 'house'/);
  assert.match(manifestSource, /label: 'Agentes'/);
  assert.match(manifestSource, /routeKey: 'agents'/);
  assert.match(manifestSource, /label: 'Clientes'/);
  assert.match(manifestSource, /routeKey: 'clients'/);
  assert.match(manifestSource, /label: 'Rutas'/);
  assert.match(manifestSource, /routeKey: 'routes'/);
  assert.match(manifestSource, /dependencyTag: 'root-shell-commercial-views'/);
  assert.match(manifestSource, /label: 'Zonas'/);
  assert.match(manifestSource, /routeKey: 'zones'/);
  assert.match(manifestSource, /dependencyTag: 'zones-view'/);
  assert.match(manifestSource, /includeInRootNav: false/);
  assert.doesNotMatch(manifestSource, /client-detail|client_detail/);
});

test('root shell guards and router keep actor-scoped route fallback behavior', () => {
  const guardsSource = readRootFile('guards.js');
  const routerSource = readRootFile('router.js');

  assert.match(guardsSource, /function isRootUser\(session\)/);
  assert.match(guardsSource, /function isCompanyAdmin\(session\)/);
  assert.match(guardsSource, /function canAccessRoute\(session, navigationItem\)/);
  assert.match(routerSource, /function getFirstAccessibleRoute\(session\)/);
  assert.match(routerSource, /item\.includeInLanding === false/);
  assert.match(routerSource, /guards\.canAccessRoute\(session, item\)/);
  assert.match(routerSource, /routeKey: fallbackRouteKey/);
  assert.match(routerSource, /requestedRouteKey/);
  assert.match(routerSource, /const zonesAdminView = rootShell\.require\('views\.zonesAdmin'\)/);
  assert.match(routerSource, /const agentsAdminView = rootShell\.require\('views\.agentsAdmin'\)/);
  assert.match(routerSource, /const clientsAdminView = rootShell\.require\('views\.clientsAdmin'\)/);
  assert.match(routerSource, /const routesAdminView = rootShell\.require\('views\.routesAdmin'\)/);
  assert.match(routerSource, /item\.routeKey === 'zones'/);
  assert.match(routerSource, /item\.routeKey === 'agents'/);
  assert.match(routerSource, /item\.routeKey === 'clients'/);
  assert.match(routerSource, /item\.routeKey === 'routes'/);
});
