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

  assert.equal(packageJson.scripts['lint:public-runtime'], 'node scripts/run-eslint.js src/public --max-warnings 0');
  assert.equal(packageJson.scripts.typecheck, 'node scripts/run-tsc.js --project tsconfig.typecheck.json');
  assert.equal(packageJson.scripts['validate:public-runtime'], 'node scripts/validate-public-runtime.js');
  assert.match(packageJson.scripts.verify, /lint:public-runtime/);
  assert.match(packageJson.scripts.verify, /validate:public-runtime/);
  assert.match(validateScriptSource, /validatePublicRuntimeInventory/);
  assert.match(validateScriptSource, /validateLoginRuntimeContracts/);
  assert.match(validateScriptSource, /validateRootShellLoaderContract/);
  assert.match(validateScriptSource, /validateMigrationRuntimeContracts/);
});

test('local lint and typecheck scripts resolve package CLI entrypoints without relying on shell bin shims', () => {
  const eslintWrapperSource = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'run-eslint.js'), 'utf8');
  const tscWrapperSource = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'run-tsc.js'), 'utf8');

  assert.match(eslintWrapperSource, /require\.resolve\(`\$\{packageName\}\/package\.json`/);
  assert.match(eslintWrapperSource, /spawnSync\(process\.execPath/);
  assert.match(tscWrapperSource, /require\.resolve\('typescript\/package\.json'/);
  assert.match(tscWrapperSource, /lib', 'tsc\.js'/);
  assert.match(tscWrapperSource, /spawnSync\(process\.execPath/);
});

test('supported public runtime assets now include the minimal root shell plus the supported warehouse and agent SPAs', () => {
  const supportedFiles = [
    'index.html',
    'login.js',
    'migration.html',
    'migration.js',
    'no-access.html',
    'no-access.js',
    'root/index.html',
    'root/agents-api.js',
    'root/app.js',
    'root/clients-api.js',
    'root/companies-api.js',
    'root/guards.js',
    'root/registry.js',
    'root/runtime-contract.js',
    'root/manifest.js',
    'root/roles-api.js',
    'root/router.js',
    'root/routes-api.js',
    'root/zones-api.js',
    'root/quotations-api.js',
    'root/session-adapter.js',
    'root/ui.js',
    'root/views/agents-admin.helpers.js',
    'root/views/agents-admin.renderers.js',
    'root/views/agents-admin.js',
    'root/billing-api.js',
    'root/views/billing-admin.helpers.js',
    'root/views/billing-admin.renderers.js',
    'root/views/billing-admin.js',
    'root/views/clients-admin-store-dialog.js',
    'root/views/clients-admin.helpers.js',
    'root/views/clients-admin.renderers.js',
    'root/views/clients-admin.state.js',
    'root/views/clients-admin.js',
    'root/views/companies-admin.js',
    'root/views/home.js',
    'root/views/in-process.js',
    'root/views/lots-admin.helpers.js',
    'root/views/lots-admin.js',
    'root/views/lots-admin.renderers.js',
    'root/views/lots-admin.state.js',
    'root/views/products-admin.helpers.js',
    'root/views/products-admin.renderers.js',
    'root/views/products-admin.state.js',
    'root/views/roles-admin.js',
    'root/views/quotations-admin.helpers.js',
    'root/views/quotations-admin.renderers.js',
    'root/views/quotations-admin.js',
    'root/views/routes-admin.helpers.js',
    'root/views/routes-admin.renderers.js',
    'root/views/routes-admin.state.js',
    'root/views/routes-admin.js',
    'root/views/zones-admin.helpers.js',
    'root/views/zones-admin.js',
    'shared/auth.js',
    'shared/session.js',
    'styles.css',
    'warehouse/index.html',
    'warehouse/api/warehouse-api.js',
    'warehouse/app.js',
    'warehouse/bootstrap.js',
    'warehouse/captures.js',
    'warehouse/state.js',
    'warehouse/views/inspections.js',
    'warehouse/views/production.js',
    'warehouse/views/receipts.js',
    'warehouse/views/recipe-consultation.js',
  ];

  for (const relativePath of supportedFiles) {
    assert.equal(fs.existsSync(path.join(publicRoot, relativePath)), true, `${relativePath} should remain in the supported public runtime`);
  }

  assert.equal(fs.existsSync(path.join(publicRoot, 'root')), true, 'root shell should now exist under src/public');

  // TASK-017: warehouse SPA ahora existe en src/public/warehouse/ como SPA soportada
  assert.equal(fs.existsSync(path.join(publicRoot, 'warehouse')), true, 'warehouse SPA should now exist under src/public/warehouse/');
  assert.equal(fs.existsSync(path.join(legacyRuntimeRoot, 'warehouse')), true, 'warehouse legacy should remain preserved in legacy-public-runtime');

  // agent SPA moderna existe en src/public/agent/ (implementada en agent-spa spec)
  assert.equal(fs.existsSync(path.join(publicRoot, 'agent')), true, 'agent SPA should now exist under src/public/agent/');
  // el legacy del agente sigue preservado como referencia en legacy-public-runtime
  assert.equal(fs.existsSync(path.join(legacyRuntimeRoot, 'agent')), true, 'legacy agent should remain preserved in legacy-public-runtime for reference');

  assert.equal(fs.existsSync(path.join(legacyRuntimeRoot, 'root', 'dashboard.html')), true, 'legacy root inventory should remain preserved for future transition work');
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
  const stylesSource = readPublicFile('styles.css');

  const rootShellHtmlSource = readPublicFile('root/index.html');
  const rootShellAppSource = readPublicFile('root/app.js');
  const rootShellManifestSource = readPublicFile('root/manifest.js');

  assert.match(loginSource, /inventorySession\.read\(\)/);
  assert.match(loginSource, /inventorySession\.write\(session\)/);
  assert.match(loginSource, /const ROOT_SHELL_PATH = '\/root\/'/);
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
  assert.match(rootShellHtmlSource, /Saltar al contenido principal/);
  assert.match(rootShellHtmlSource, /Panel root/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/registry\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/runtime-contract\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/companies-api\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/roles-api\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/zones-api\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/agents-api\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/clients-api\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/routes-api\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/quotations-api\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/ui\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/views\/companies-admin\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/views\/roles-admin\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/views\/quotations-admin\.helpers\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/views\/quotations-admin\.renderers\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/views\/quotations-admin\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/views\/zones-admin\.helpers\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/views\/zones-admin\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/views\/agents-admin\.helpers\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/views\/agents-admin\.renderers\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/views\/agents-admin\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/views\/clients-admin\.helpers\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/views\/clients-admin\.renderers\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/views\/clients-admin\.state\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/views\/clients-admin\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/views\/routes-admin\.helpers\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/views\/routes-admin\.renderers\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/views\/products-admin\.helpers\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/views\/products-admin\.state\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/views\/products-admin\.renderers\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/views\/products-admin\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/views\/lots-admin\.helpers\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/views\/lots-admin\.state\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/views\/lots-admin\.renderers\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/views\/lots-admin\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/views\/routes-admin\.state\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/views\/routes-admin\.js"><\/script>/);
  assert.match(rootShellHtmlSource, /<script src="\/root\/app\.js"><\/script>/);
  assert.match(rootShellManifestSource, /routeKey: 'companies'/);
  assert.match(rootShellManifestSource, /routeKey: 'agents'/);
  assert.match(rootShellManifestSource, /routeKey: 'clients'/);
  assert.match(rootShellManifestSource, /routeKey: 'routes'/);
  assert.match(rootShellManifestSource, /routeKey: 'roles_permissions'/);
  assert.match(rootShellManifestSource, /routeKey: 'zones'/);
  assert.match(rootShellManifestSource, /routeKey: 'cotizaciones'/);
  assert.match(stylesSource, /\.root-sidebar,\s*\n\.root-sidebar \*/);
  assert.match(stylesSource, /\.root-sidebar__scroll \{[\s\S]*overflow-y: auto;[\s\S]*scrollbar-width: thin;[\s\S]*scrollbar-color: rgba\(203, 213, 225, 0\.28\) transparent;/);
  assert.match(stylesSource, /\.root-sidebar__nav,[\s\S]*\.root-sidebar__section-body,[\s\S]*\.root-sidebar__subnav \{[\s\S]*overflow-x: clip;/);
  assert.match(stylesSource, /\.root-sidebar__label \{[\s\S]*text-overflow: ellipsis;[\s\S]*white-space: nowrap;/);
  assert.match(stylesSource, /\.root-sidebar__tooltip \{[\s\S]*display: none;/);
  assert.match(stylesSource, /\.commercial-list-item \{[\s\S]*background: #fff;[\s\S]*color: var\(--text\);/);
  assert.match(stylesSource, /\.commercial-list-item:hover,[\s\S]*\.commercial-list-item:focus-visible \{[\s\S]*background: #f8fafc;[\s\S]*color: var\(--text\);/);
  assert.match(rootShellAppSource, /rootShell\.require\('runtimeContract'\)/);
  assert.match(rootShellAppSource, /runtimeContract\.requireModules\(runtimeContract\.bootstrapModuleNames\)/);
  assert.match(rootShellAppSource, /function configureShellForActor\(session\)/);
  assert.match(rootShellAppSource, /renderNavigation\(session\)/);
  assert.match(rootShellAppSource, /rootShellSessionAdapter\.bootstrap\(\)/);
  assert.match(rootShellAppSource, /inventoryAuth\.logout\(activeSession/);
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
  assert.match(migrationSource, /Iniciaste sesion correctamente/);
  assert.match(migrationSource, /modulo de destino aun no esta implementado/);
  assert.match(migrationSource, /Volver al inicio de sesion/);
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
