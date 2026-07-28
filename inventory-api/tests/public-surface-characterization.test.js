const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicRoot = path.join(__dirname, '..', 'src', 'public');
const legacyRuntimeRoot = path.join(__dirname, '..', 'legacy-public-runtime');
const appPath = path.join(__dirname, '..', 'src', 'app.js');
const packageJsonPath = path.join(__dirname, '..', 'package.json');

function readPublicFile(relativePath) {
  return fs.readFileSync(path.join(publicRoot, relativePath), 'utf8');
}

test('Express app serves src/public as the reduced supported runtime surface', () => {
  const appSource = fs.readFileSync(appPath, 'utf8');
  assert.match(appSource, /express\.static\(publicRootDirectory\)/);
  assert.match(appSource, /serveDeprecatedLegacyHtml/);
  assert.match(appSource, /status\(410\)\.sendFile\(migrationDocumentPath\)/);
});

test('embedded UI keeps explicit browser-first quality gates for the reduced runtime baseline', () => {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const validateScriptSource = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'validate-public-runtime.js'), 'utf8');

  assert.equal(packageJson.scripts['lint:public-runtime'], 'eslint src/public --max-warnings 0');
  assert.equal(packageJson.scripts['validate:public-runtime'], 'node scripts/validate-public-runtime.js');
  assert.match(packageJson.scripts.verify, /lint:public-runtime/);
  assert.match(packageJson.scripts.verify, /validate:public-runtime/);
  assert.match(validateScriptSource, /validatePublicRuntimeInventory/);
  assert.match(validateScriptSource, /validateLoginRuntimeContracts/);
  assert.match(validateScriptSource, /validateMigrationRuntimeContracts/);
});

test('supported public runtime assets are now limited to login, no-access, migration and shared helpers', () => {
  const supportedFiles = [
    'index.html',
    'login.js',
    'migration.html',
    'migration.js',
    'no-access.html',
    'no-access.js',
    'shared/auth.js',
    'shared/session.js',
    'styles.css',
  ];

  for (const relativePath of supportedFiles) {
    assert.equal(fs.existsSync(path.join(publicRoot, relativePath)), true, `${relativePath} should remain in the reduced public runtime`);
  }

  for (const retiredDirectory of ['root', 'warehouse', 'agent']) {
    assert.equal(fs.existsSync(path.join(publicRoot, retiredDirectory)), false, `${retiredDirectory} should not remain exposed from src/public`);
    assert.equal(fs.existsSync(path.join(legacyRuntimeRoot, retiredDirectory)), true, `${retiredDirectory} should be relocated for SPA transition reuse`);
  }

  assert.equal(fs.existsSync(path.join(publicRoot, 'shared', 'lot-dates.js')), false, 'legacy warehouse helper should leave the reduced public runtime');
  assert.equal(fs.existsSync(path.join(legacyRuntimeRoot, 'shared', 'lot-dates.js')), true, 'legacy warehouse helper should be preserved in the relocation baseline');
});

test('public login, no-access and migration screens keep strict same-origin wiring', () => {
  const loginSource = readPublicFile('login.js');
  const loginHtmlSource = readPublicFile('index.html');
  const noAccessHtmlSource = readPublicFile('no-access.html');
  const noAccessSource = readPublicFile('no-access.js');
  const migrationHtmlSource = readPublicFile('migration.html');
  const migrationSource = readPublicFile('migration.js');
  const sessionHelperSource = readPublicFile('shared/session.js');
  const authHelperSource = readPublicFile('shared/auth.js');

  assert.match(loginSource, /inventorySession\.read\(\)/);
  assert.match(loginSource, /inventorySession\.write\(session\)/);
  assert.match(loginSource, /'\/migration\.html\?mode=post-login-transition'/);
  assert.doesNotMatch(loginSource, /'\/root\/dashboard\.html'/);
  assert.doesNotMatch(loginSource, /'\/warehouse\/products\.html'/);
  assert.doesNotMatch(loginSource, /'\/agent\/workspace\.html'/);
  assert.match(sessionHelperSource, /clearAndRedirectToLogin/);
  assert.match(authHelperSource, /async function fetchJson\(session, url, options = \{\}\)/);
  assert.match(loginHtmlSource, /<script src="\/shared\/session\.js"><\/script>/);
  assert.match(loginHtmlSource, /<script src="\/shared\/auth\.js"><\/script>/);
  assert.match(loginHtmlSource, /<script src="\/login\.js"><\/script>/);
  assert.match(noAccessHtmlSource, /<script src="\/shared\/session\.js"><\/script>/);
  assert.match(noAccessHtmlSource, /<script src="\/no-access\.js"><\/script>/);
  assert.match(noAccessSource, /inventorySession\.clearAndRedirectToLogin\(\)/);
  assert.match(migrationHtmlSource, /Actualizacion de acceso/);
  assert.match(migrationHtmlSource, /Esta ruta ya no se encuentra disponible/);
  assert.match(migrationHtmlSource, /Codigo de estado: 410/);
  assert.match(migrationHtmlSource, /migration-primary-message/);
  assert.match(migrationHtmlSource, /migration-secondary-message/);
  assert.match(migrationHtmlSource, /migration-status-note/);
  assert.match(migrationHtmlSource, /<script src="\/shared\/session\.js"><\/script>/);
  assert.match(migrationHtmlSource, /<script src="\/migration\.js"><\/script>/);
  assert.match(migrationSource, /const POST_LOGIN_TRANSITION_MODE = 'post-login-transition';/);
  assert.match(migrationSource, /new URLSearchParams\(window.location.search\)/);
  assert.match(migrationSource, /Tu acceso fue actualizado/);
  assert.match(migrationSource, /migrationStatusNote\.hidden = true/);
  assert.match(migrationSource, /inventorySession\.clearAndRedirectToLogin\(\)/);
});

test('legacy runtime remains preserved outside src/public as SPA transition input instead of active public UI', () => {
  const legacyHtmlFiles = [
    'root/dashboard.html',
    'root/clients.html',
    'warehouse/products.html',
    'agent/workspace.html',
    'agent/visit.html',
    'agent/order-entry.html',
  ];

  for (const relativePath of legacyHtmlFiles) {
    assert.equal(fs.existsSync(path.join(legacyRuntimeRoot, relativePath)), true, `${relativePath} should remain preserved for transition work`);
    assert.equal(fs.existsSync(path.join(publicRoot, relativePath)), false, `${relativePath} should not remain in the active public runtime`);
  }
});
