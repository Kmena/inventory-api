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

test('legacy public runtime has been retired from src/public and preserved under the SPA transition inventory', () => {
  for (const retiredDirectory of ['root', 'warehouse', 'agent']) {
    assert.equal(fs.existsSync(path.join(publicRoot, retiredDirectory)), false, `${retiredDirectory} should not remain under src/public`);
    assert.equal(fs.existsSync(path.join(legacyRuntimeRoot, retiredDirectory)), true, `${retiredDirectory} should remain preserved for SPA transition work`);
  }

  assert.equal(fs.existsSync(path.join(legacyRuntimeRoot, 'shared', 'lot-dates.js')), true);
});

test('login now routes retired-runtime roles to the supported transition page while app.js keeps deprecated html routes on 410 responses', () => {
  const loginSource = readPublicFile('login.js');
  const appSource = fs.readFileSync(appPath, 'utf8');

  assert.match(loginSource, /'\/migration\.html\?mode=post-login-transition'/);
  assert.doesNotMatch(loginSource, /'\/root\/dashboard\.html'/);
  assert.doesNotMatch(loginSource, /'\/warehouse\/products\.html'/);
  assert.doesNotMatch(loginSource, /'\/agent\/workspace\.html'/);
  assert.match(appSource, /deprecatedLegacyHtmlPathPattern/);
  assert.match(appSource, /res\.status\(410\)\.sendFile\(migrationDocumentPath\)/);
});
