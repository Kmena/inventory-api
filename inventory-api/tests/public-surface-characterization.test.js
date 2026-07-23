const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicRoot = path.join(__dirname, '..', 'src', 'public');
const appPath = path.join(__dirname, '..', 'src', 'app.js');
const companyRoutesPath = path.join(__dirname, '..', 'src', 'routes', 'company.routes.js');
const packageJsonPath = path.join(__dirname, '..', 'package.json');

function readPublicFile(relativePath) {
  return fs.readFileSync(path.join(publicRoot, relativePath), 'utf8');
}

test('Express app serves src/public as part of the runtime surface', () => {
  const appSource = fs.readFileSync(appPath, 'utf8');
  assert.match(appSource, /express\.static\(path\.join\(__dirname, 'public'\)\)/);
});

test('embedded UI has explicit browser-first public-runtime quality gates', () => {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const validateScriptSource = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'validate-public-runtime.js'), 'utf8');

  assert.equal(packageJson.scripts['lint:public-runtime'], 'eslint src/public --max-warnings 0');
  assert.equal(packageJson.scripts['validate:public-runtime'], 'node scripts/validate-public-runtime.js');
  assert.match(packageJson.scripts.verify, /lint:public-runtime/);
  assert.match(packageJson.scripts.verify, /validate:public-runtime/);
  assert.equal(fs.existsSync(path.join(__dirname, '..', 'scripts', 'validate-public-runtime.js')), true);
  assert.match(validateScriptSource, /listHtmlFiles/);
  assert.match(validateScriptSource, /collectLocalAssetReferences/);
  assert.match(validateScriptSource, /validateCriticalJavaScriptContracts/);
  assert.match(validateScriptSource, /validateLoginRuntimeContracts/);
  assert.match(validateScriptSource, /validateRootDashboardRuntimeContracts/);
  assert.match(validateScriptSource, /validateWarehouseProductsRuntimeContracts/);
  assert.match(validateScriptSource, /validateAgentWorkspaceRuntimeContracts/);
  assert.match(validateScriptSource, /CRITICAL_JAVASCRIPT_RULES/);
});

test('critical embedded UI assets exist for login, root admin, warehouse and agent flows', () => {
  const criticalFiles = [
    'index.html',
    'login.js',
    'no-access.html',
    'root/index.html',
    'root/index.js',
    'root/dashboard.html',
    'root/dashboard.js',
    'root/clients.js',
    'warehouse/products.html',
    'warehouse/products.js',
    'agent/workspace.html',
    'agent/workspace.js',
    'agent/visit.html',
    'agent/visit.js',
    'agent/order-entry.html',
    'agent/order-entry.js',
  ];

  for (const relativePath of criticalFiles) {
    assert.equal(fs.existsSync(path.join(publicRoot, relativePath)), true, `${relativePath} should exist`);
  }
});

test('public login and administrative screens keep their current API contracts', () => {
  const loginSource = readPublicFile('login.js');
  const loginHtmlSource = readPublicFile('index.html');
  const rootIndexSource = readPublicFile('root/index.js');
  const rootDashboardSource = readPublicFile('root/dashboard.js');
  const rootClientsSource = readPublicFile('root/clients.js');

  assert.match(loginSource, /STORAGE_KEY = 'inventory-api-auth'/);
  assert.match(loginSource, /fetch\(LOGIN_ENDPOINT/);
  assert.match(loginSource, /LOGIN_ENDPOINT = '\/api\/auth\/login'/);
  assert.match(loginSource, /clearStoredSession\(\)/);
  assert.match(loginSource, /localStorage\.removeItem\(STORAGE_KEY\)/);
  assert.match(loginSource, /'\/root\/dashboard\.html'/);
  assert.match(loginSource, /'\/root\/routes\.html'/);
  assert.match(loginSource, /'\/warehouse\/products\.html'/);
  assert.match(loginSource, /'\/agent\/workspace\.html'/);
  assert.match(loginHtmlSource, /Acceso seguro:/);
  assert.match(loginHtmlSource, /Controla cada movimiento de tu inventario\./);
  assert.match(loginHtmlSource, /Bienvenido de nuevo/);
  assert.match(loginHtmlSource, /Iniciar sesión/);
  assert.match(loginHtmlSource, /¿Tienes problemas para ingresar\? Contacta al administrador de tu empresa\./);
  assert.doesNotMatch(loginHtmlSource, /Acceso inicial:/);
  assert.doesNotMatch(loginHtmlSource, /Acceso inicial:/);
  assert.match(rootIndexSource, /fetch\('\/api\/companies\/root\/companies'/);
  assert.match(rootIndexSource, /fetch\(`\/api\/companies\/root\/companies\/\$\{companyId\}\/status`/);
  assert.match(rootDashboardSource, /fetch\('\/api\/companies\/company\/dashboard'/);
  assert.doesNotMatch(rootDashboardSource, /fetch\('\/api\/companies\/root\/dashboard'/);
  assert.match(rootClientsSource, /fetch\(`\/api\/geocoding\/search\?q=\$\{encodeURIComponent\(query\)\}`/);
  assert.match(rootClientsSource, /fetch\(`\/api\/taxpayers\/lookup\?\$\{params\.toString\(\)\}`/);
});

test('company routes preserve legacy dashboard path and add the approved semantic alias', () => {
  const companyRoutesSource = fs.readFileSync(companyRoutesPath, 'utf8');

  assert.match(companyRoutesSource, /router\.get\('\/root\/dashboard', authorizeAccessPolicy\('company\.dashboard'\), handleExecutiveDashboard\);/);
  assert.match(companyRoutesSource, /router\.get\('\/company\/dashboard', authorizeAccessPolicy\('company\.dashboard'\), handleExecutiveDashboard\);/);
});

test('agent public screens keep their current API fetch paths', () => {
  const workspaceSource = readPublicFile('agent/workspace.js');
  const visitSource = readPublicFile('agent/visit.js');
  const orderEntrySource = readPublicFile('agent/order-entry.js');

  assert.match(workspaceSource, /fetch\('\/api\/agent\/dashboard'/);
  assert.match(workspaceSource, /fetch\(`\/api\/agent\/stores\?\$\{params\.toString\(\)\}`/);
  assert.match(workspaceSource, /fetch\(`\/api\/agent\/stores\/\$\{selectedStoreId\}`/);
  assert.match(workspaceSource, /fetch\('\/api\/agent\/goals'/);
  assert.match(workspaceSource, /fetch\('\/api\/agent\/visits'/);
  assert.match(visitSource, /fetch\(`\/api\/agent\/stores\/\$\{storeId\}`/);
  assert.match(visitSource, /fetch\('\/api\/agent\/visits'/);
  assert.match(orderEntrySource, /fetch\(`\/api\/agent\/stores\/\$\{storeId\}\/order-context`/);
  assert.match(orderEntrySource, /fetch\(`\/api\/agent\/stores\/\$\{storeId\}\/orders`/);
});

test('root administrative public screens keep their current API fetch paths', () => {
  const rootProductsSource = readPublicFile('root/products.js');
  const rootRolesSource = readPublicFile('root/roles.js');
  const rootRoutesSource = readPublicFile('root/routes.js');
  const rootUsersSource = readPublicFile('root/users.js');
  const rootWarehousesSource = readPublicFile('root/warehouses.js');
  const rootZonesSource = readPublicFile('root/zones.js');
  const rootInvoiceInconsistenciesSource = readPublicFile('root/invoice-inconsistencies.js');
  const rootClientDetailSource = readPublicFile('root/client-detail.js');
  const rootClientDetailReferencesSource = readPublicFile('root/client-detail.references.js');
  const rootClientsSource = readPublicFile('root/clients.js');

  assert.match(rootProductsSource, /apiFetch\('\/api\/products'/);
  assert.match(rootProductsSource, /apiFetch\('\/api\/inventory\/entries'/);
  assert.match(rootProductsSource, /apiFetch\('\/api\/warehouses\/company'/);
  assert.match(rootRolesSource, /fetch\('\/api\/roles\/permissions'/);
  assert.match(rootRolesSource, /fetch\('\/api\/roles\/company'/);
  assert.match(rootRoutesSource, /fetch\('\/api\/sales-routes\/company'/);
  assert.match(rootRoutesSource, /fetch\(`\/api\/sales-routes\/company\/\$\{selectedRouteId\}`/);
  assert.match(rootRoutesSource, /fetch\(`\/api\/sales-routes\/company\/\$\{selectedRouteId\}\/subzones`/);
  assert.match(rootRoutesSource, /fetch\(`\/api\/sales-routes\/company\/\$\{selectedRouteId\}\/assignments`/);
  assert.match(rootRoutesSource, /fetch\(`\/api\/sales-routes\/company\/agents\/\$\{selectedGoalsAgentId\}\/goals`/);
  assert.match(rootUsersSource, /fetch\('\/api\/roles\/company'/);
  assert.match(rootUsersSource, /fetch\('\/api\/users\/company'/);
  assert.match(rootWarehousesSource, /fetch\('\/api\/warehouses\/company'/);
  assert.match(rootZonesSource, /fetch\('\/api\/regions\/company'/);
  assert.match(rootZonesSource, /fetch\(`\/api\/regions\/company\/\$\{regionId\}\/subregions`/);
  assert.match(rootInvoiceInconsistenciesSource, /fetch\('\/api\/invoices\/inconsistencies'/);
  assert.match(rootClientDetailSource, /fetch\(`\/api\/clients\/\$\{clientId\}`/);
  assert.match(rootClientDetailReferencesSource, /fetch\(`\/api\/clients\/\$\{client\.id\}\/references`/);
  assert.match(rootClientsSource, /fetch\(`\/api\/economic-activities\?q=\$\{encodeURIComponent\(query\)\}`/);
  assert.match(rootClientsSource, /fetch\('\/api\/regions\/company'/);
  assert.match(rootClientsSource, /fetch\('\/api\/clients\/classifications\/company'/);
  assert.match(rootClientsSource, /fetch\('\/api\/clients\/document-types'/);
  assert.match(rootClientsSource, /fetch\('\/api\/clients\/company'/);
  assert.match(rootClientsSource, /fetch\(`\/api\/clients\/company\/\$\{targetClientId\}\/stores`/);
  assert.match(rootClientsSource, /fetch\(`\/api\/clients\/\$\{targetClientId\}\/references`/);
  assert.match(rootClientsSource, /fetch\(`\/api\/clients\/\$\{targetClientId\}\/documents`/);
});

test('public shared helpers preserve protected download and file-reading contracts', () => {
  const rootClientDetailSharedSource = readPublicFile('root/client-detail.shared.js');
  const rootClientsSharedSource = readPublicFile('root/clients.shared.js');

  assert.match(rootClientDetailSharedSource, /fetch\(fileUrl, \{/);
  assert.match(rootClientDetailSharedSource, /Authorization: `Bearer \$\{session\.token\}`/);
  assert.match(rootClientDetailSharedSource, /URL\.createObjectURL\(blob\)/);
  assert.match(rootClientDetailSharedSource, /URL\.revokeObjectURL\(downloadUrl\)/);
  assert.match(rootClientsSharedSource, /fetch\(fileUrl, \{/);
  assert.match(rootClientsSharedSource, /Authorization: `Bearer \$\{session\.token\}`/);
  assert.match(rootClientsSharedSource, /URL\.createObjectURL\(blob\)/);
  assert.match(rootClientsSharedSource, /reader\.readAsDataURL\(file\)/);
});

test('warehouse public screen keeps current warehouse, product, import and alerts API contracts', () => {
  const warehouseProductsSource = readPublicFile('warehouse/products.js');

  assert.match(warehouseProductsSource, /apiFetch\('\/api\/warehouses\/company'/);
  assert.match(warehouseProductsSource, /apiFetch\('\/api\/products'/);
  assert.match(warehouseProductsSource, /apiFetch\('\/api\/products\/import'/);
  assert.match(warehouseProductsSource, /apiFetch\('\/api\/inventory\/alerts\?page=1&pageSize=20'/);
  assert.match(warehouseProductsSource, /apiFetch\(`\/api\/inventory\/alerts\/\$\{alertId\}`/);
  assert.match(warehouseProductsSource, /apiFetch\(`\/api\/inventory\/alerts\/\$\{alertId\}\/status`/);
  assert.match(warehouseProductsSource, /localStorage\.removeItem\(STORAGE_KEY\)/);
  assert.match(warehouseProductsSource, /window\.location\.href = '\/'/);
});
