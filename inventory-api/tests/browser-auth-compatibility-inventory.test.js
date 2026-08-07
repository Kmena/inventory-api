const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

test('browser auth token-bridge removal is enforced across the reduced supported public runtime seam', () => {
  const sharedSessionSource = read('src/public/shared/session.js');
  const sharedAuthSource = read('src/public/shared/auth.js');
  const loginSource = read('src/public/login.js');
  const migrationSource = read('src/public/migration.js');
  const noAccessSource = read('src/public/no-access.js');
  const authenticateSource = read('src/middlewares/authenticate.js');

  assert.doesNotMatch(sharedSessionSource, /BROWSER_SESSION_COMPATIBILITY_TOKEN/);
  assert.doesNotMatch(sharedSessionSource, /token:\s*/);
  assert.match(sharedSessionSource, /clearAndRedirectToLogin/);
  assert.match(sharedAuthSource, /const shouldAttachBearer = typeof session\?\.token === 'string' && session\.token\.trim\(\)\.length > 0/);
  assert.match(sharedAuthSource, /Authorization: `Bearer \$\{session\.token\}`/);
  assert.match(sharedAuthSource, /credentials: options\.credentials \|\| 'same-origin'/);
  assert.match(sharedAuthSource, /fetch\('\/api\/auth\/logout'/);
  assert.match(loginSource, /inventorySession\.read\(\)/);
  assert.match(migrationSource, /inventorySession\.clearAndRedirectToLogin\(\)/);
  assert.match(noAccessSource, /inventorySession\.clearAndRedirectToLogin\(\)/);
  assert.doesNotMatch(authenticateSource, /token === BROWSER_SESSION_COMPATIBILITY_TOKEN && browserSessionId/);

  assert.equal(require('node:fs').existsSync(path.join(__dirname, '..', 'src/public/root')), true, 'src/public/root should remain part of the supported public runtime');

  // warehouse sigue retirado; agent fue promovido como SPA moderna (agent-spa spec)
  assert.equal(require('node:fs').existsSync(path.join(__dirname, '..', 'src/public/warehouse')), false, 'src/public/warehouse should remain retired from the active public runtime');
  assert.equal(require('node:fs').existsSync(path.join(__dirname, '..', 'src/public/agent')), true, 'src/public/agent should exist as the implemented modern agent SPA');
});
