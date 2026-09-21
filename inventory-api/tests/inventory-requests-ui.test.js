'use strict';

/**
 * Characterization tests for inventory-requests UI artifacts:
 *   - inventory-admin.renderers.js (renderTabs with Solicitudes tab, renderLotsTable buttons,
 *     renderRequestAdjustmentModal, renderRequestTransferModal, renderRequestsTable,
 *     renderStockTable → Ver lotes link)
 *   - inventory-admin.helpers.js (normalizeTab handles 'requests')
 *   - inventory-api.js (createInventoryRequest, listInventoryRequests, cancelInventoryRequest, listWarehouses)
 *   - inventory-admin.js (sessionAdapter required, canManage-gated tabs)
 *   - warehouse-api.js (pickupInventoryRequest, executeInventoryRequest, listInventoryRequests)
 *   - inventory-requests.js (views.inventoryRequests registered, render function exists)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootPublicDir = path.join(__dirname, '..', 'src', 'public', 'root');
const warehousePublicDir = path.join(__dirname, '..', 'src', 'public', 'warehouse');

function readRootFile(relPath) {
  return fs.readFileSync(path.join(rootPublicDir, relPath), 'utf-8');
}

function readWarehouseFile(relPath) {
  return fs.readFileSync(path.join(warehousePublicDir, relPath), 'utf-8');
}

// ── Test harness for root SPA modules ─────────────────────────────────────────

function createRootHarness() {
  const modules = new Map();

  const rootShellUi = {
    escapeHtml: (str) => String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    renderInlineMessage: (msg, type) => `<span class="inline-msg ${type || 'info'}">${msg}</span>`,
    formatDate: (v) => v ? new Date(v).toLocaleDateString('es-CR') : '—',
  };

  const helpers = {
    formatNumber: (v) => String(Number(v ?? 0)),
    getProductName: (r) => r?.product?.name || r?.name || 'Sin nombre',
    getProductCode: (r) => r?.product?.code || r?.code || '',
    getWarehouseName: (r) => r?.warehouse?.name || r?.sourceWarehouse?.name || '',
    getLotLabel: (r) => r?.internalLotNumber || r?.lot?.internalLotNumber || String(r?.id || ''),
  };

  const sessionAdapter = {
    hasPermission: (session, permission) => Array.isArray(session?.permissions) && session.permissions.includes(permission),
  };

  modules.set('ui', rootShellUi);
  modules.set('views.inventoryAdminHelpers', helpers);
  modules.set('sessionAdapter', sessionAdapter);

  const rootShell = {
    register: (name, mod) => modules.set(name, mod),
    require: (name) => {
      if (!modules.has(name)) throw new Error(`Module not registered: ${name}`);
      return modules.get(name);
    },
  };

  // Evaluate renderers and helpers
  const evalScope = { window: { RootShell: rootShell } };
  function evalFile(relPath) {
    const src = readRootFile(relPath);
    const fn = new Function('window', 'RootShell', src); // eslint-disable-line no-new-func
    fn.call(evalScope, evalScope.window, rootShell);
  }

  evalFile('views/inventory-admin.helpers.js');
  evalFile('views/inventory-admin.renderers.js');

  return rootShell;
}

// ── inventory-admin.helpers.js ────────────────────────────────────────────────

test('normalizeTab handles requests tab', () => {
  const rootShell = createRootHarness();
  const helpers = rootShell.require('views.inventoryAdminHelpers');
  assert.equal(helpers.normalizeTab('requests'), 'requests');
  assert.equal(helpers.normalizeTab('stock'), 'stock');
  assert.equal(helpers.normalizeTab('lots'), 'lots');
  assert.equal(helpers.normalizeTab('history'), 'history');
  assert.equal(helpers.normalizeTab('unknown'), 'stock', 'unknown values default to stock');
  assert.equal(helpers.normalizeTab(null), 'stock');
});

// ── inventory-admin.renderers.js — renderTabs ─────────────────────────────────

test('renderTabs includes Solicitudes tab when canManage is true', () => {
  const rootShell = createRootHarness();
  const renderers = rootShell.require('views.inventoryAdminRenderers');

  const html = renderers.renderTabs('stock', { canManage: true });
  assert.match(html, /Solicitudes/, 'Solicitudes tab must be rendered when canManage=true');
  assert.match(html, /data-inventory-tab="requests"/, 'requests data attribute must be present');
});

test('renderTabs omits Solicitudes tab when canManage is false or not set', () => {
  const rootShell = createRootHarness();
  const renderers = rootShell.require('views.inventoryAdminRenderers');

  const htmlFalse = renderers.renderTabs('stock', { canManage: false });
  assert.doesNotMatch(htmlFalse, /Solicitudes/, 'Solicitudes tab must not appear when canManage=false');

  const htmlDefault = renderers.renderTabs('stock');
  assert.doesNotMatch(htmlDefault, /Solicitudes/, 'Solicitudes tab must not appear when options not passed');
});

test('renderTabs marks active tab with active class', () => {
  const rootShell = createRootHarness();
  const renderers = rootShell.require('views.inventoryAdminRenderers');

  const html = renderers.renderTabs('requests', { canManage: true });
  assert.match(html, /class="[^"]*active[^"]*"[^>]*data-inventory-tab="requests"|data-inventory-tab="requests"[^>]*class="[^"]*active/, 'requests tab must be marked active');
});

// ── inventory-admin.renderers.js — renderStockTable ──────────────────────────

test('renderStockTable replaces direct Ajustar/Trasladar with → Ver lotes link', () => {
  const rootShell = createRootHarness();
  const renderers = rootShell.require('views.inventoryAdminRenderers');

  const items = [
    { productId: '5', product: { name: 'Prod A', code: 'PA' }, warehouseId: '3', warehouse: { name: 'Bodega 1' }, quantity: 100, reservedQuantity: 0 },
  ];
  const html = renderers.renderStockTable(items);

  // Must NOT have direct adjust/transfer form buttons
  assert.doesNotMatch(html, /data-inventory-adjust/, 'Direct adjust button must not be in stock table');
  assert.doesNotMatch(html, /data-inventory-transfer/, 'Direct transfer button must not be in stock table');
  // Must have the Ver lotes link
  assert.match(html, /Ver lotes/, 'Stock table must have "→ Ver lotes" link');
  assert.match(html, /tab=lots/, 'Ver lotes link must point to lots tab');
});

// ── inventory-admin.renderers.js — renderLotsTable ───────────────────────────

test('renderLotsTable includes Acciones column with data-request-adjust and data-request-transfer buttons', () => {
  const rootShell = createRootHarness();
  const renderers = rootShell.require('views.inventoryAdminRenderers');

  const lots = [
    {
      id: '9', internalLotNumber: 'LOT-9',
      product: { name: 'Producto A', id: '5' },
      productId: '5',
      warehouse: { name: 'Bodega 1', id: '3' },
      warehouseId: '3',
      quantity: 50,
    },
  ];
  const html = renderers.renderLotsTable(lots);

  assert.match(html, /Acciones/, 'Acciones column header must exist in lots table');
  assert.match(html, /data-request-adjust/, 'Solicitar ajuste button must have data-request-adjust attribute');
  assert.match(html, /data-request-transfer/, 'Solicitar traslado button must have data-request-transfer attribute');
  assert.match(html, /data-lot-id/, 'Buttons must have data-lot-id attribute');
  assert.match(html, /data-product-id/, 'Buttons must have data-product-id attribute');
  assert.match(html, /data-warehouse-id/, 'Buttons must have data-warehouse-id attribute');
  assert.match(html, /Solicitar ajuste/, 'Button must have "Solicitar ajuste" label');
  assert.match(html, /Solicitar traslado/, 'Button must have "Solicitar traslado" label');
});

test('renderLotsTable escapes lot code to prevent XSS', () => {
  const rootShell = createRootHarness();
  const renderers = rootShell.require('views.inventoryAdminRenderers');

  const lots = [
    {
      id: '9', internalLotNumber: '<script>xss</script>',
      product: { name: 'Producto A', id: '5' },
      productId: '5', quantity: 0,
    },
  ];
  const html = renderers.renderLotsTable(lots);
  assert.doesNotMatch(html, /<script>xss/, 'Lot label must be escaped in output');
});

// ── inventory-admin.renderers.js — renderRequestAdjustmentModal ──────────────

test('renderRequestAdjustmentModal renders form with hidden fields', () => {
  const rootShell = createRootHarness();
  const renderers = rootShell.require('views.inventoryAdminRenderers');

  const html = renderers.renderRequestAdjustmentModal({
    lotId: '9', lotLabel: 'LOT-9', productId: '5', productName: 'Prod A', warehouseId: '3',
  });

  assert.match(html, /id="inventory-request-adjustment-form"/, 'Form must have correct id');
  assert.match(html, /name="lotId"/, 'Must include lotId hidden input');
  assert.match(html, /name="productId"/, 'Must include productId hidden input');
  assert.match(html, /name="sourceWarehouseId"/, 'Must include sourceWarehouseId hidden input');
  assert.match(html, /Crear solicitud de ajuste/, 'Submit button must have correct label');
  assert.match(html, /LOT-9/, 'Lot label must appear in modal');
  assert.match(html, /Prod A/, 'Product name must appear in modal');
});

test('renderRequestAdjustmentModal escapes malicious input', () => {
  const rootShell = createRootHarness();
  const renderers = rootShell.require('views.inventoryAdminRenderers');

  const html = renderers.renderRequestAdjustmentModal({
    lotId: '9', lotLabel: '<script>xss</script>', productId: '5', productName: 'P', warehouseId: '3',
  });
  assert.doesNotMatch(html, /<script>/, 'lotLabel must be HTML-escaped');
});

// ── inventory-admin.renderers.js — renderRequestTransferModal ────────────────

test('renderRequestTransferModal renders transfer form with warehouse select', () => {
  const rootShell = createRootHarness();
  const renderers = rootShell.require('views.inventoryAdminRenderers');

  const warehouses = [
    { id: '3', name: 'Bodega Central' },
    { id: '5', name: 'Bodega Secundaria' },
  ];
  const html = renderers.renderRequestTransferModal({
    lotId: '9', lotLabel: 'LOT-9', productId: '5', productName: 'Prod A',
    warehouseId: '3', availableQuantity: '50', warehouses,
  });

  assert.match(html, /id="inventory-request-transfer-form"/, 'Form must have correct id');
  assert.match(html, /name="destinationWarehouseId"/, 'Must include destination warehouse select');
  assert.match(html, /name="quantity"/, 'Must include quantity input');
  assert.match(html, /Bodega Secundaria/, 'Non-source warehouse must appear in options');
  // Source warehouse should be excluded from options
  assert.doesNotMatch(
    html.replace(/.*name="destinationWarehouseId"[^>]*>([\s\S]*?)<\/select>.*/s, '$1'),
    /value="3"/,
    'Source warehouse must NOT appear in destination options',
  );
  assert.match(html, /Crear solicitud de traslado/, 'Submit button must have correct label');
});

// ── inventory-admin.renderers.js — renderRequestsTable ───────────────────────

test('renderRequestsTable renders pending and in-progress requests', () => {
  const rootShell = createRootHarness();
  const renderers = rootShell.require('views.inventoryAdminRenderers');

  const requests = [
    {
      type: 'ADJUSTMENT', status: 'PENDING',
      lot: { lotNumber: 'LOT-9' },
      product: { name: 'Prod A' },
      sourceWarehouse: { name: 'Bodega 1' },
      destinationWarehouse: null,
      lotId: '9', productId: '5', sourceWarehouseId: '3',
    },
    {
      type: 'TRANSFER', status: 'IN_PROGRESS',
      lot: { internalLotNumber: 'LOT-10' },
      product: { name: 'Prod B' },
      sourceWarehouse: { name: 'Bodega 2' },
      destinationWarehouse: { name: 'Bodega 3' },
      lotId: '10', productId: '6', sourceWarehouseId: '4', destinationWarehouseId: '5',
    },
  ];
  const html = renderers.renderRequestsTable(requests);

  assert.match(html, /Ajuste/, 'ADJUSTMENT must render as "Ajuste"');
  assert.match(html, /Traslado/, 'TRANSFER must render as "Traslado"');
  assert.match(html, /Pendiente/, 'PENDING must render as "Pendiente"');
  assert.match(html, /En tránsito/, 'IN_PROGRESS must render as "En tránsito"');
  assert.match(html, /LOT-9/, 'Lot number must appear');
  assert.match(html, /Bodega 3/, 'Destination warehouse must appear');
});

test('renderRequestsTable returns empty state when no items', () => {
  const rootShell = createRootHarness();
  const renderers = rootShell.require('views.inventoryAdminRenderers');

  const html = renderers.renderRequestsTable([]);
  assert.match(html, /No hay solicitudes activas/, 'Empty state message must appear');
});

// ── inventory-api.js (root) ───────────────────────────────────────────────────

test('inventory-api.js registers createInventoryRequest function', () => {
  const source = readRootFile('inventory-api.js');
  assert.match(source, /createInventoryRequest/, 'createInventoryRequest must be defined');
  assert.match(source, /\/api\/inventory\/requests/, 'Must target /api/inventory/requests');
});

test('inventory-api.js registers listInventoryRequests function', () => {
  const source = readRootFile('inventory-api.js');
  assert.match(source, /listInventoryRequests/, 'listInventoryRequests must be defined');
});

test('inventory-api.js registers cancelInventoryRequest function', () => {
  const source = readRootFile('inventory-api.js');
  assert.match(source, /cancelInventoryRequest/, 'cancelInventoryRequest must be defined');
  assert.match(source, /\/cancel/, 'cancelInventoryRequest must call /cancel endpoint');
});

test('inventory-api.js registers listWarehouses function', () => {
  const source = readRootFile('inventory-api.js');
  assert.match(source, /listWarehouses/, 'listWarehouses must be defined');
  assert.match(source, /\/api\/warehouses\/company/, 'listWarehouses must target company warehouses endpoint');
});

// ── inventory-admin.js ────────────────────────────────────────────────────────

test('inventory-admin.js requires sessionAdapter module', () => {
  const source = readRootFile('views/inventory-admin.js');
  assert.match(source, /rootShell\.require\('sessionAdapter'\)/, 'Must require sessionAdapter');
});

test('inventory-admin.js uses canManage to gate Solicitudes tab', () => {
  const source = readRootFile('views/inventory-admin.js');
  assert.match(source, /canManage/, 'Must use canManage flag');
  assert.match(source, /inventory\.manage/, 'Must check inventory.manage permission');
  assert.match(source, /renderTabs.*canManage|canManage.*renderTabs/, 'Must pass canManage to renderTabs');
});

test('inventory-admin.js handles data-request-adjust button click', () => {
  const source = readRootFile('views/inventory-admin.js');
  assert.match(source, /data-request-adjust/, 'Must handle data-request-adjust click');
  assert.match(source, /renderRequestAdjustmentModal/, 'Must call renderRequestAdjustmentModal');
});

test('inventory-admin.js handles data-request-transfer button click', () => {
  const source = readRootFile('views/inventory-admin.js');
  assert.match(source, /data-request-transfer/, 'Must handle data-request-transfer click');
  assert.match(source, /renderRequestTransferModal/, 'Must call renderRequestTransferModal');
});

test('inventory-admin.js handles inventory-request-adjustment-form submit', () => {
  const source = readRootFile('views/inventory-admin.js');
  assert.match(source, /inventory-request-adjustment-form/, 'Must handle adjustment form submit');
  assert.match(source, /createInventoryRequest/, 'Must call createInventoryRequest');
});

test('inventory-admin.js handles inventory-request-transfer-form submit', () => {
  const source = readRootFile('views/inventory-admin.js');
  assert.match(source, /inventory-request-transfer-form/, 'Must handle transfer form submit');
});

test('inventory-admin.js loads requests tab data via listInventoryRequests', () => {
  const source = readRootFile('views/inventory-admin.js');
  assert.match(source, /listInventoryRequests/, 'Must call listInventoryRequests for requests tab');
  assert.match(source, /renderRequestsTable/, 'Must render requests table');
});

// ── warehouse-api.js ──────────────────────────────────────────────────────────

test('warehouse-api.js registers pickupInventoryRequest', () => {
  const source = readWarehouseFile('api/warehouse-api.js');
  assert.match(source, /pickupInventoryRequest/, 'pickupInventoryRequest must be exported');
  assert.match(source, /\/pickup/, 'Must call /pickup endpoint');
});

test('warehouse-api.js registers executeInventoryRequest', () => {
  const source = readWarehouseFile('api/warehouse-api.js');
  assert.match(source, /executeInventoryRequest/, 'executeInventoryRequest must be exported');
  assert.match(source, /\/execute/, 'Must call /execute endpoint');
});

test('warehouse-api.js registers listInventoryRequests', () => {
  const source = readWarehouseFile('api/warehouse-api.js');
  assert.match(source, /listInventoryRequests/, 'listInventoryRequests must be exported');
  assert.match(source, /\/api\/inventory\/requests/, 'Must target correct endpoint');
});

test('warehouse-api.js registers getInventoryRequest', () => {
  const source = readWarehouseFile('api/warehouse-api.js');
  assert.match(source, /getInventoryRequest/, 'getInventoryRequest must be exported');
});

// ── inventory-requests.js (warehouse SPA) ────────────────────────────────────

test('views/inventory-requests.js exists and registers views.inventoryRequests module', () => {
  const source = readWarehouseFile('views/inventory-requests.js');
  assert.match(source, /views\.inventoryRequests/, 'Must register views.inventoryRequests');
  assert.match(source, /render/, 'Must expose render function');
});

test('views/inventory-requests.js uses warehouseApi methods for pickup and execute', () => {
  const source = readWarehouseFile('views/inventory-requests.js');
  assert.match(source, /pickupInventoryRequest/, 'Must call pickupInventoryRequest');
  assert.match(source, /executeInventoryRequest/, 'Must call executeInventoryRequest');
  assert.match(source, /listInventoryRequests/, 'Must call listInventoryRequests');
});

test('views/inventory-requests.js includes pickup and execute modal rendering', () => {
  const source = readWarehouseFile('views/inventory-requests.js');
  assert.match(source, /ir-pickup-form/, 'Must render pickup form');
  assert.match(source, /ir-execute-form/, 'Must render execute form');
});

test('views/inventory-requests.js escapes user content (XSS prevention)', () => {
  const source = readWarehouseFile('views/inventory-requests.js');
  // Must have esc() function
  assert.match(source, /function esc/, 'Must define esc() helper for HTML escaping');
  // Must use esc() for user-derived content
  assert.match(source, /esc\(/, 'Must use esc() for HTML encoding');
});

test('warehouse index.html loads inventory-requests.js before bootstrap.js', () => {
  const html = readWarehouseFile('index.html');
  const requestsIdx = html.indexOf('views/inventory-requests.js');
  const bootstrapIdx = html.indexOf('bootstrap.js');
  assert.ok(requestsIdx !== -1, 'inventory-requests.js must be in index.html');
  assert.ok(requestsIdx < bootstrapIdx, 'inventory-requests.js must load before bootstrap.js');
});

test('warehouse app.js routes inventory-requests tab to views.inventoryRequests', () => {
  const source = readWarehouseFile('app.js');
  assert.match(source, /'inventory-requests'\s*:\s*'views\.inventoryRequests'/, 'VIEW_MODULE_KEYS must map inventory-requests to views.inventoryRequests');
});

test('warehouse app.js includes inventory-requests tab with inventory.requests.execute permission guard', () => {
  const source = readWarehouseFile('app.js');
  assert.match(source, /inventory-requests/, 'Must have inventory-requests view');
  assert.match(source, /inventory\.requests\.execute/, 'Must guard with inventory.requests.execute');
});
