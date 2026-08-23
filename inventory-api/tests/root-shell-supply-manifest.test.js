const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootPublicPath = path.join(__dirname, '..', 'src', 'public', 'root');

function readRootFile(relativePath) {
  return fs.readFileSync(path.join(rootPublicPath, relativePath), 'utf8');
}

function executeRootScript(relativePath, context) {
  const source = readRootFile(relativePath);
  vm.runInContext(source, context, { filename: relativePath });
}

function createBrowserContext() {
  const browserWindow = {};
  const context = vm.createContext({ Map, window: browserWindow });
  browserWindow.window = browserWindow;
  return { browserWindow, context };
}

function buildManifest() {
  const { browserWindow, context } = createBrowserContext();
  executeRootScript('registry.js', context);
  executeRootScript('runtime-contract.js', context);
  executeRootScript('ui.js', context);
  executeRootScript('session-adapter.js', context);
  executeRootScript('guards.js', context);
  executeRootScript('manifest.js', context);
  return browserWindow.RootShell.require('manifest');
}

// -----------------------------------------------------------------------
// Source-level governance tests (fast, no VM required)
// -----------------------------------------------------------------------

test('manifest.js declares all required TASK-016 supply module route entries', () => {
  const manifestSource = readRootFile('manifest.js');

  // Produccion group sub-entries
  assert.match(manifestSource, /id: 'recetas'/);
  assert.match(manifestSource, /routeKey: 'recetas'/);
  assert.match(manifestSource, /id: 'produccion-ordenes'/);
  assert.match(manifestSource, /routeKey: 'produccion_ordenes'/);

  // Compras group sub-entries
  assert.match(manifestSource, /id: 'proveedores'/);
  assert.match(manifestSource, /id: 'solicitudes-compra'/);
  assert.match(manifestSource, /routeKey: 'solicitudes_compra'/);
  assert.match(manifestSource, /href: '\/root\/#solicitudes_compra'/);
  assert.match(manifestSource, /id: 'cotizaciones'/);
  assert.match(manifestSource, /routeKey: 'cotizaciones'/);
  assert.match(manifestSource, /href: '\/root\/#cotizaciones'/);
  assert.match(manifestSource, /id: 'seguimiento-cotizaciones'/);
  assert.match(manifestSource, /routeKey: 'seguimiento_cotizaciones'/);
  assert.match(manifestSource, /href: '\/root\/#seguimiento_cotizaciones'/);
  assert.match(manifestSource, /id: 'ordenes-compra'/);
  assert.match(manifestSource, /routeKey: 'ordenes_compra'/);
  assert.match(manifestSource, /href: '\/root\/#ordenes_compra'/);
  // recepciones-fiscales-workspace: both promoted to implemented: true
  assert.match(manifestSource, /id: 'recepciones'/);
  assert.match(manifestSource, /id: 'referencias-fiscales'/);
  assert.match(manifestSource, /routeKey: 'referencias_fiscales'/);
});

test('manifest.js uses supply-inventory-entry dependencyTag for TASK-016 entries and purchase-orders-workspace for implemented procurement views', () => {
  const manifestSource = readRootFile('manifest.js');
  // supply-inventory-entry entries: recetas, produccion-ordenes, proveedores, cotizaciones (4 entries).
  // recepciones and referencias-fiscales now use recepciones-fiscales-workspace.
  // solicitudes-compra and ordenes-compra use purchase-orders-workspace.
  const supplyMatches = manifestSource.match(/dependencyTag: 'supply-inventory-entry'/g) || [];
  assert.ok(supplyMatches.length >= 4, `Expected at least 4 supply-inventory-entry tags, found ${supplyMatches.length}`);

  // purchase-orders-workspace must appear for solicitudes-compra and ordenes-compra
  const powMatches = manifestSource.match(/dependencyTag: 'purchase-orders-workspace'/g) || [];
  assert.ok(powMatches.length >= 2, `Expected at least 2 purchase-orders-workspace tags, found ${powMatches.length}`);

  // recepciones-fiscales-workspace must appear for recepciones and referencias-fiscales
  const rfwMatches = manifestSource.match(/dependencyTag: 'recepciones-fiscales-workspace'/g) || [];
  assert.ok(rfwMatches.length >= 2, `Expected at least 2 recepciones-fiscales-workspace tags, found ${rfwMatches.length}`);
});

test('manifest.js replaces standalone productionItem with produccion-group in sidebar', () => {
  const manifestSource = readRootFile('manifest.js');

  // produccion-group must appear in adminSidebarSections
  assert.match(manifestSource, /id: 'produccion-group'/);
  assert.match(manifestSource, /label: 'Produccion'/);
  assert.match(manifestSource, /icon: 'factory'/);

  // recipesAdminItem and productionOrdersAdminItem must be sub-items of produccion-group
  assert.match(manifestSource, /\{ type: 'item', \.\.\.recipesAdminItem \}/);
  assert.match(manifestSource, /\{ type: 'item', \.\.\.productionOrdersAdminItem \}/);
});

test('manifest.js replaces standalone purchasesItem with compras-group in sidebar', () => {
  const manifestSource = readRootFile('manifest.js');

  // compras-group must appear in adminSidebarSections
  assert.match(manifestSource, /id: 'compras-group'/);
  assert.match(manifestSource, /label: 'Compras'/);
  assert.match(manifestSource, /icon: 'shopping-bag'/);

  // All compras sub-entries must appear as group items
  assert.match(manifestSource, /\{ type: 'item', \.\.\.suppliersAdminItem \}/);
  assert.match(manifestSource, /\{ type: 'item', \.\.\.purchaseRequestsAdminItem \}/);
  assert.match(manifestSource, /\{ type: 'item', \.\.\.quotationsAdminItem \}/);
  assert.match(manifestSource, /\{ type: 'item', \.\.\.rfqTrackingAdminItem \}/);
  assert.match(manifestSource, /\{ type: 'item', \.\.\.purchaseOrdersAdminItem \}/);
  assert.match(manifestSource, /\{ type: 'item', \.\.\.receiptsAdminItem \}/);
  assert.match(manifestSource, /\{ type: 'item', \.\.\.fiscalRefsAdminItem \}/);
});

test('app.js openGroups includes produccion-group and compras-group', () => {
  const appSource = readRootFile('app.js');
  assert.match(appSource, /'produccion-group'/);
  assert.match(appSource, /'compras-group'/);
  assert.match(appSource, /openGroups: new Set\(\['inventory-group', 'sales-group', 'produccion-group', 'compras-group'\]\)/);
});

// -----------------------------------------------------------------------
// Runtime-level governance tests (VM execution)
// -----------------------------------------------------------------------

test('manifest items flat array contains all TASK-016 supply module route keys', () => {
  const manifest = buildManifest();
  const routeKeys = manifest.items.map((item) => item.routeKey);

  assert.ok(routeKeys.includes('recetas'), 'recetas routeKey must be in items');
  assert.ok(routeKeys.includes('produccion_ordenes'), 'produccion_ordenes routeKey must be in items');
  assert.ok(routeKeys.includes('proveedores'), 'proveedores routeKey must be in items');
  assert.ok(routeKeys.includes('solicitudes_compra'), 'solicitudes_compra routeKey must be in items');
  assert.ok(routeKeys.includes('cotizaciones'), 'cotizaciones routeKey must be in items');
  assert.ok(routeKeys.includes('seguimiento_cotizaciones'), 'seguimiento_cotizaciones routeKey must be in items');
  assert.ok(routeKeys.includes('ordenes_compra'), 'ordenes_compra routeKey must be in items');
  assert.ok(routeKeys.includes('recepciones'), 'recepciones routeKey must be in items');
  assert.ok(routeKeys.includes('referencias_fiscales'), 'referencias_fiscales routeKey must be in items');
});

test('supply module items keep approved implementation split between production admin routes and pending procurement routes', () => {
  const manifest = buildManifest();
  const implementedProductionRoutes = ['recetas', 'produccion_ordenes'];
  // recepciones-fiscales-workspace: recepciones and referencias_fiscales now implemented
  const implementedProcurementRoutes = [
    'proveedores', 'cotizaciones', 'seguimiento_cotizaciones',
    'solicitudes_compra', 'ordenes_compra',
    'recepciones', 'referencias_fiscales',
  ];
  const _pendingProcurementRoutes = [];   // compras-group completamente implementado

  for (const routeKey of implementedProductionRoutes) {
    const item = manifest.items.find((i) => i.routeKey === routeKey);
    assert.ok(item, `Item with routeKey '${routeKey}' must exist in manifest.items`);
    assert.equal(item.implemented, true, `'${routeKey}' must be implemented in root`);
    assert.equal(item.actorScope, 'company-admin', `'${routeKey}' must be company-admin scoped`);
    assert.equal(item.destination, 'implemented', `'${routeKey}' must resolve to an implemented root view`);
  }

  for (const routeKey of implementedProcurementRoutes) {
    const item = manifest.items.find((i) => i.routeKey === routeKey);
    assert.ok(item, `Item with routeKey '${routeKey}' must exist in manifest.items`);
    assert.equal(item.implemented, true, `'${routeKey}' must be implemented`);
    assert.equal(item.actorScope, 'company-admin', `'${routeKey}' must be company-admin scoped`);
    assert.equal(item.destination, 'implemented', `'${routeKey}' must resolve to an implemented root view`);
  }

  // pendingProcurementRoutes is now empty — no loop needed

  const supplyRoutes = manifest.items.filter((item) => [
    'recetas',
    'produccion_ordenes',
    'proveedores',
    'solicitudes_compra',
    'cotizaciones',
    'seguimiento_cotizaciones',
    'ordenes_compra',
    'recepciones',
    'referencias_fiscales',
  ].includes(item.routeKey));
  const implementedRoutes = Array.from(supplyRoutes.filter((item) => item.implemented === true).map((item) => item.routeKey)).sort();
  const pendingRoutes = Array.from(supplyRoutes.filter((item) => item.implemented === false).map((item) => item.routeKey)).sort();

  // recepciones-fiscales-workspace: recepciones and referencias_fiscales now in implementedRoutes
  assert.deepEqual(
    implementedRoutes,
    ['cotizaciones', 'ordenes_compra', 'produccion_ordenes', 'proveedores', 'recepciones', 'recetas', 'referencias_fiscales', 'seguimiento_cotizaciones', 'solicitudes_compra'],
  );
  assert.deepEqual(pendingRoutes, []);
});

test('produccion-group and compras-group appear in adminSidebarSections operations', () => {
  const manifest = buildManifest();
  const operationsSection = manifest.adminSidebarSections.find((s) => s.id === 'operations');
  assert.ok(operationsSection, 'operations section must exist');

  const groupIds = operationsSection.entries.filter((e) => e.type === 'group').map((e) => e.id);
  assert.ok(groupIds.includes('inventory-group'), 'inventory-group must remain in operations');
  assert.ok(groupIds.includes('sales-group'), 'sales-group must remain in operations');
  assert.ok(groupIds.includes('produccion-group'), 'produccion-group must appear in operations');
  assert.ok(groupIds.includes('compras-group'), 'compras-group must appear in operations');
});

test('produccion-group contains exactly recetas and produccion-ordenes sub-items', () => {
  const manifest = buildManifest();
  const operationsSection = manifest.adminSidebarSections.find((s) => s.id === 'operations');
  const produccionGroup = operationsSection.entries.find((e) => e.id === 'produccion-group');

  assert.ok(produccionGroup, 'produccion-group must exist in operations entries');
  assert.ok(Array.isArray(produccionGroup.items), 'produccion-group must have items array');
  const subRouteKeys = produccionGroup.items.map((i) => i.routeKey);
  assert.ok(subRouteKeys.includes('recetas'), 'produccion-group must include recetas');
  assert.ok(subRouteKeys.includes('produccion_ordenes'), 'produccion-group must include produccion_ordenes');
});

test('compras-group contains all 6 procurement/supply sub-items in flow order', () => {
  const manifest = buildManifest();
  const operationsSection = manifest.adminSidebarSections.find((s) => s.id === 'operations');
  const comprasGroup = operationsSection.entries.find((e) => e.id === 'compras-group');

  assert.ok(comprasGroup, 'compras-group must exist in operations entries');
  assert.ok(Array.isArray(comprasGroup.items), 'compras-group must have items array');

  const subRouteKeys = comprasGroup.items.map((i) => i.routeKey);
  for (const key of ['proveedores', 'solicitudes_compra', 'cotizaciones', 'seguimiento_cotizaciones', 'ordenes_compra', 'recepciones', 'referencias_fiscales']) {
    assert.ok(subRouteKeys.includes(key), `compras-group must include ${key}`);
  }

  // Verify order: proveedores first, referencias_fiscales last
  assert.equal(subRouteKeys[0], 'proveedores', 'proveedores must be first in compras-group');
  assert.equal(subRouteKeys[3], 'seguimiento_cotizaciones', 'seguimiento_cotizaciones must follow cotizaciones in compras-group');
  assert.equal(subRouteKeys[subRouteKeys.length - 1], 'referencias_fiscales', 'referencias_fiscales must be last in compras-group');
});

test('legacy standalone productionItem and purchasesItem remain in items array for routing backward-compat', () => {
  const manifest = buildManifest();
  const routeKeys = manifest.items.map((item) => item.routeKey);
  assert.ok(routeKeys.includes('production'), 'legacy production routeKey must remain for backward-compat');
  assert.ok(routeKeys.includes('purchases'), 'legacy purchases routeKey must remain for backward-compat');
});
