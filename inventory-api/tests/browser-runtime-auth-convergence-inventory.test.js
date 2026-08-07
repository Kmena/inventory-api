const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicRoot = path.join(__dirname, '..', 'src', 'public');
const legacyRuntimeRoot = path.join(__dirname, '..', 'legacy-public-runtime');
const appPath = path.join(__dirname, '..', 'src', 'app.js');

function readPublicFile(relativePath) {
  return fs.readFileSync(path.join(publicRoot, relativePath), 'utf8');
}

test('shared browser helpers remain the supported convergence seam for the reduced public runtime', () => {
  const sessionSource = readPublicFile('shared/session.js');
  const authSource = readPublicFile('shared/auth.js');
  const loginSource = readPublicFile('login.js');
  const migrationSource = readPublicFile('migration.js');

  assert.match(sessionSource, /clearAndRedirectToLogin/);
  assert.match(authSource, /async function fetchJson\(session, url, options = \{\}\)/);
  assert.match(loginSource, /inventorySession\.read\(\)/);
  assert.match(migrationSource, /inventorySession\.clearAndRedirectToLogin\(\)/);
});

test('legacy warehouse runtime remains retired while agent SPA and root shell coexist under src/public', () => {
  assert.equal(fs.existsSync(path.join(publicRoot, 'root')), true, 'supported root shell should exist under src/public');
  assert.equal(fs.existsSync(path.join(legacyRuntimeRoot, 'root')), true, 'legacy root inventory should remain preserved for transition work');

  // warehouse sigue retirado de src/public; legacy permanece en legacy-public-runtime
  assert.equal(fs.existsSync(path.join(publicRoot, 'warehouse')), false, 'warehouse should not remain under src/public');
  assert.equal(fs.existsSync(path.join(legacyRuntimeRoot, 'warehouse')), true, 'warehouse should remain preserved for SPA transition work');

  // agent fue implementado como SPA moderna (agent-spa spec); legacy del agente preservado como referencia
  assert.equal(fs.existsSync(path.join(publicRoot, 'agent')), true, 'agent SPA should exist under src/public after agent-spa implementation');
  assert.equal(fs.existsSync(path.join(legacyRuntimeRoot, 'agent')), true, 'legacy agent should remain preserved in legacy-public-runtime for reference');

  assert.equal(fs.existsSync(path.join(legacyRuntimeRoot, 'shared', 'lot-dates.js')), true);
});

test('login now routes wave-one root roles to the supported root shell while app.js keeps deprecated legacy html routes on 410 responses', () => {
  const loginSource = readPublicFile('login.js');
  const appSource = fs.readFileSync(appPath, 'utf8');

  assert.match(loginSource, /const ROOT_SHELL_PATH = '\/root\/'/);
  assert.match(loginSource, /'\/migration\.html\?mode=post-login-transition'/);
  assert.doesNotMatch(loginSource, /'\/root\/dashboard\.html'/);
  assert.doesNotMatch(loginSource, /'\/warehouse\/products\.html'/);
  assert.doesNotMatch(loginSource, /'\/agent\/workspace\.html'/);
  assert.match(appSource, /deprecatedLegacyHtmlPathPattern/);
  assert.match(appSource, /res\.status\(410\)\.sendFile\(migrationDocumentPath\)/);
});
