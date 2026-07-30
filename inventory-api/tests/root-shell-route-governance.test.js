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
});

test('root shell guards and router keep actor-scoped route fallback behavior', () => {
  const guardsSource = readRootFile('guards.js');
  const routerSource = readRootFile('router.js');

  assert.match(guardsSource, /function isRootUser\(session\)/);
  assert.match(guardsSource, /function isCompanyAdmin\(session\)/);
  assert.match(guardsSource, /function canAccessRoute\(session, navigationItem\)/);
  assert.match(routerSource, /function getFirstAccessibleRoute\(session\)/);
  assert.match(routerSource, /guards\.canAccessRoute\(session, item\)/);
  assert.match(routerSource, /routeKey: fallbackRouteKey/);
  assert.match(routerSource, /requestedRouteKey/);
});
