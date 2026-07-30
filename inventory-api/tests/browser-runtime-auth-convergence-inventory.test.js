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

test('legacy warehouse and agent runtimes remain retired while the supported root shell coexists with preserved legacy inventory', () => {
  assert.equal(fs.existsSync(path.join(publicRoot, 'root')), true, 'supported root shell should exist under src/public');
  assert.equal(fs.existsSync(path.join(legacyRuntimeRoot, 'root')), true, 'legacy root inventory should remain preserved for transition work');

  for (const retiredDirectory of ['warehouse', 'agent']) {
    assert.equal(fs.existsSync(path.join(publicRoot, retiredDirectory)), false, `${retiredDirectory} should not remain under src/public`);
    assert.equal(fs.existsSync(path.join(legacyRuntimeRoot, retiredDirectory)), true, `${retiredDirectory} should remain preserved for SPA transition work`);
  }

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
