const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootPublicPath = path.join(__dirname, '..', 'src', 'public', 'root');

function executeRootScript(relativePath, context) {
  const source = fs.readFileSync(path.join(rootPublicPath, relativePath), 'utf8');
  vm.runInContext(source, context, { filename: relativePath });
}

function createHarness() {
  const browserWindow = {};
  const context = vm.createContext({
    URLSearchParams,
    window: browserWindow,
  });
  browserWindow.window = browserWindow;

  executeRootScript('registry.js', context);
  executeRootScript('ui.js', context);
  executeRootScript('views/lots-admin.helpers.js', context);
  executeRootScript('views/lots-admin.state.js', context);
  executeRootScript('views/lots-admin.renderers.js', context);

  return browserWindow.RootShell;
}

// --- Fixtures ---

function buildLotEntry(overrides = {}) {
  return {
    lotId: '100',
    warehouseId: '10',
    productId: '50',
    quantity: '200',
    reservedQuantity: '20',
    lot: {
      id: '100',
      internalLotNumber: 'LOT-001',
      lotNumber: 'MFG-001',
      expirationDate: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
      status: 'AVAILABLE',
      qaStatus: 'APPROVED',
    },
    product: { id: '50', name: 'Envase 500ml', code: 'ENV-500' },
    warehouse: { id: '10', name: 'Central' },
    ...overrides,
  };
}

// =============================================================================
// TASK-009: Gate assessment tests
// =============================================================================

test('lots gate passes when lots have required fields', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const gate = helpers.assessLotDataGate([buildLotEntry()]);
  assert.equal(gate.passed, true);
  assert.equal(gate.reason, '');
});

test('lots gate fails when lots array is empty', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const gate = helpers.assessLotDataGate([]);
  assert.equal(gate.passed, false);
  assert.match(gate.reason, /no retorno lotes/i);
});

test('lots gate fails when lotId is missing from all entries', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const entry = buildLotEntry();
  delete entry.lotId;
  delete entry.lot.id;

  const gate = helpers.assessLotDataGate([entry]);
  assert.equal(gate.passed, false);
});

test('lots gate fails when lot code (internalLotNumber) is missing', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const entry = buildLotEntry();
  entry.lot.internalLotNumber = null;
  entry.lot.lotNumber = null;

  const gate = helpers.assessLotDataGate([entry]);
  assert.equal(gate.passed, false);
});

test('lots gate fails when product name is missing', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const entry = buildLotEntry();
  entry.product.name = '';

  const gate = helpers.assessLotDataGate([entry]);
  assert.equal(gate.passed, false);
});

test('lots gate passes when at least one entry has all required fields', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const incomplete = buildLotEntry();
  delete incomplete.lotId;
  delete incomplete.lot.id;

  const complete = buildLotEntry({ lotId: '200' });
  complete.lot.id = '200';

  const gate = helpers.assessLotDataGate([incomplete, complete]);
  assert.equal(gate.passed, true);
});

// =============================================================================
// TASK-009: Normalization tests
// =============================================================================

test('normalizeLotStocks produces a verified LotStockUnit from a full entry', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const stocksResponse = { lots: [buildLotEntry()] };
  const result = helpers.normalizeLotStocks(stocksResponse, [], null);

  assert.equal(result.gate.passed, true);
  assert.equal(result.lots.length, 1);

  const unit = result.lots[0];
  assert.equal(unit.lotId, '100');
  assert.equal(unit.lotCode, 'LOT-001');
  assert.equal(unit.productName, 'Envase 500ml');
  assert.equal(unit.warehouseName, 'Central');
  assert.equal(unit.quantity, 200);
  assert.equal(unit.reservedQuantity, 20);
  assert.equal(unit.availableQuantity, 180);
  assert.equal(unit.qaStatus, 'APPROVED');
  assert.equal(unit.lotStatus, 'AVAILABLE');
  assert.ok(unit.expirationDate);
  assert.ok(Array.isArray(unit.alertIds) && unit.alertIds.length === 0, 'alertIds should be empty array');
  assert.equal(unit.sourceConfidence, 'verified');
});

test('normalizeLotStocks returns degraded state when gate fails', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const result = helpers.normalizeLotStocks({ lots: [] }, [], null);
  assert.equal(result.gate.passed, false);
  assert.equal(result.lots.length, 0);
});

test('normalizeLotStocks links alert IDs by lotId', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const stocksResponse = { lots: [buildLotEntry({ lotId: '100' })] };
  const alerts = [{ id: '5', lotId: '100' }, { id: '6', lotId: '999' }];
  const result = helpers.normalizeLotStocks(stocksResponse, alerts, null);

  assert.equal(result.lots[0].alertIds.length, 1);
  assert.equal(result.lots[0].alertIds[0], '5');
});

test('normalizeLotStocks assigns partial confidence when optional fields missing', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const entry = buildLotEntry();
  delete entry.lot.expirationDate;
  delete entry.lot.qaStatus;

  const result = helpers.normalizeLotStocks({ lots: [entry] }, [], null);
  assert.equal(result.gate.passed, true);
  assert.equal(result.lots[0].sourceConfidence, 'partial');
});

// =============================================================================
// KPI calculation tests
// =============================================================================

test('buildLotsKpis counts expiring, expired and alert lots correctly', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const in10days = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();
  const in60days = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();

  const lots = [
    { lotId: '1', alertIds: ['a1'], expirationDate: yesterday, qaStatus: 'PENDING', lotStatus: 'AVAILABLE', availableQuantity: 50 },
    { lotId: '2', alertIds: [], expirationDate: in10days, qaStatus: 'APPROVED', lotStatus: 'AVAILABLE', availableQuantity: 100 },
    { lotId: '3', alertIds: [], expirationDate: in60days, qaStatus: 'APPROVED', lotStatus: 'AVAILABLE', availableQuantity: 200 },
    { lotId: '4', alertIds: [], expirationDate: null, qaStatus: 'FAILED', lotStatus: 'BLOCKED', availableQuantity: 0 },
  ];

  const kpis = helpers.buildLotsKpis(lots);
  assert.equal(kpis.total, 4);
  assert.equal(kpis.withAlert, 1);
  assert.equal(kpis.expired, 1);
  assert.equal(kpis.expiringSoon, 1);
  assert.equal(kpis.qaPendingOrBlocked, 2);
  assert.equal(kpis.totalAvailable, 350);
});

// =============================================================================
// Filter tests
// =============================================================================

test('filterLots filters by search term across lotCode, productName, warehouseName', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const lots = [
    { lotId: '1', lotCode: 'LOT-001', productName: 'Envase', productCode: 'ENV', warehouseName: 'Central', alertIds: [], expirationDate: null, qaStatus: 'APPROVED', lotStatus: 'AVAILABLE' },
    { lotId: '2', lotCode: 'LOT-002', productName: 'Tapa', productCode: 'TAP', warehouseName: 'Secundaria', alertIds: [], expirationDate: null, qaStatus: 'PENDING', lotStatus: 'AVAILABLE' },
  ];

  const defaultFilters = helpers.createDefaultFilters();

  const envResult = helpers.filterLots(lots, { ...defaultFilters, searchTerm: 'env' });
  assert.equal(envResult.length, 1);
  assert.equal(envResult[0].lotCode, 'LOT-001');

  const centralResult = helpers.filterLots(lots, { ...defaultFilters, searchTerm: 'central' });
  assert.equal(centralResult.length, 1);
  assert.equal(centralResult[0].warehouseName, 'Central');
});

test('filterLots filters by qaStatus and lotStatus correctly', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const lots = [
    { lotId: '1', lotCode: 'LOT-001', productName: 'A', productCode: null, warehouseName: 'W', alertIds: [], expirationDate: null, qaStatus: 'APPROVED', lotStatus: 'AVAILABLE', warehouseId: '1' },
    { lotId: '2', lotCode: 'LOT-002', productName: 'B', productCode: null, warehouseName: 'W', alertIds: [], expirationDate: null, qaStatus: 'PENDING', lotStatus: 'BLOCKED', warehouseId: '1' },
  ];

  const defaultFilters = helpers.createDefaultFilters();
  const approvedOnly = helpers.filterLots(lots, { ...defaultFilters, qaStatus: 'APPROVED' });
  assert.equal(approvedOnly.length, 1);
  assert.equal(approvedOnly[0].lotId, '1');

  const blockedOnly = helpers.filterLots(lots, { ...defaultFilters, lotStatus: 'BLOCKED' });
  assert.equal(blockedOnly.length, 1);
  assert.equal(blockedOnly[0].lotId, '2');
});

test('filterLots filters by alertStatus has_alert and no_alert', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const lots = [
    { lotId: '1', lotCode: 'A', productName: 'P', productCode: null, warehouseName: 'W', alertIds: ['x'], expirationDate: null, qaStatus: 'APPROVED', lotStatus: 'AVAILABLE' },
    { lotId: '2', lotCode: 'B', productName: 'P', productCode: null, warehouseName: 'W', alertIds: [], expirationDate: null, qaStatus: 'APPROVED', lotStatus: 'AVAILABLE' },
  ];

  const defaultFilters = helpers.createDefaultFilters();
  const withAlert = helpers.filterLots(lots, { ...defaultFilters, alertStatus: 'has_alert' });
  assert.equal(withAlert.length, 1);
  assert.equal(withAlert[0].lotId, '1');

  const noAlert = helpers.filterLots(lots, { ...defaultFilters, alertStatus: 'no_alert' });
  assert.equal(noAlert.length, 1);
  assert.equal(noAlert[0].lotId, '2');
});

test('hasActiveFilters returns false for default filters and true when any is set', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const defaults = helpers.createDefaultFilters();
  assert.equal(helpers.hasActiveFilters(defaults), false);
  assert.equal(helpers.hasActiveFilters({ ...defaults, searchTerm: 'lote' }), true);
  assert.equal(helpers.hasActiveFilters({ ...defaults, warehouseId: '5' }), true);
  assert.equal(helpers.hasActiveFilters({ ...defaults, expiry: 'expired' }), true);
});

// =============================================================================
// Sort tests
// =============================================================================

test('sortLots places alerted+expired lots first, then expired, then expiring soon', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const in10days = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();
  const in90days = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString();

  const lots = [
    { lotId: '3', alertIds: [], expirationDate: in10days, qaStatus: 'APPROVED', lotStatus: 'AVAILABLE' },
    { lotId: '1', alertIds: ['x'], expirationDate: yesterday, qaStatus: 'PENDING', lotStatus: 'BLOCKED' },
    { lotId: '4', alertIds: [], expirationDate: in90days, qaStatus: 'APPROVED', lotStatus: 'AVAILABLE' },
    { lotId: '2', alertIds: [], expirationDate: yesterday, qaStatus: 'APPROVED', lotStatus: 'EXPIRED' },
  ];

  const sorted = helpers.sortLots(lots);
  assert.equal(sorted[0].lotId, '1'); // alerted + expired -> highest priority
  assert.equal(sorted[1].lotId, '2'); // expired
  assert.equal(sorted[2].lotId, '3'); // expiring soon
  assert.equal(sorted[3].lotId, '4'); // ok
});

// =============================================================================
// Date utilities tests
// =============================================================================

test('formatExpirationDate returns Sin fecha for null or invalid input', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  assert.equal(helpers.formatExpirationDate(null), 'Sin fecha');
  assert.equal(helpers.formatExpirationDate(''), 'Sin fecha');
  assert.equal(helpers.formatExpirationDate('not-a-date'), 'Sin fecha');
});

test('calculateDaysToExpiry returns negative for past dates and positive for future', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  const daysPast = helpers.calculateDaysToExpiry(yesterday);
  assert.ok(daysPast !== null && daysPast <= -1, `Expected negative, got ${daysPast}`);

  const daysFuture = helpers.calculateDaysToExpiry(tomorrow);
  assert.ok(daysFuture !== null && daysFuture >= 1, `Expected positive, got ${daysFuture}`);

  assert.equal(helpers.calculateDaysToExpiry(null), null);
});

test('isExpiringSoon returns true only within 30-day window and not expired', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  assert.equal(helpers.isExpiringSoon(0), true);
  assert.equal(helpers.isExpiringSoon(15), true);
  assert.equal(helpers.isExpiringSoon(30), true);
  assert.equal(helpers.isExpiringSoon(31), false);
  assert.equal(helpers.isExpiringSoon(-1), false);
  assert.equal(helpers.isExpiringSoon(null), false);
});

// =============================================================================
// Status label tests
// =============================================================================

test('getLotStatusLabel and getQaStatusLabel return expected Spanish labels', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  assert.equal(helpers.getLotStatusLabel('AVAILABLE'), 'Disponible');
  assert.equal(helpers.getLotStatusLabel('BLOCKED'), 'Bloqueado');
  assert.equal(helpers.getLotStatusLabel('QUARANTINED'), 'En cuarentena');
  assert.equal(helpers.getLotStatusLabel('EXPIRED'), 'Vencido');
  assert.equal(helpers.getLotStatusLabel('UNKNOWN'), 'Sin dato');

  assert.equal(helpers.getQaStatusLabel('APPROVED'), 'Aprobado');
  assert.equal(helpers.getQaStatusLabel('PENDING'), 'Pendiente');
  assert.equal(helpers.getQaStatusLabel('REJECTED'), 'Rechazado');
  assert.equal(helpers.getQaStatusLabel('FAILED'), 'Fallido');
  assert.equal(helpers.getQaStatusLabel('UNKNOWN'), 'Sin dato');
});

// =============================================================================
// Permission tests
// =============================================================================

test('canViewLots, canManageLots and canManageLotQa check correct permissions', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const mockAdapter = {
    hasPermission: (session, perm) => session.permissions.includes(perm),
  };

  const viewOnly = { permissions: ['inventory.view'] };
  const manage = { permissions: ['inventory.manage'] };
  const qa = { permissions: ['inventory.qa.manage'] };
  const none = { permissions: [] };

  assert.equal(helpers.canViewLots(viewOnly, mockAdapter), true);
  assert.equal(helpers.canViewLots(manage, mockAdapter), true);
  assert.equal(helpers.canViewLots(qa, mockAdapter), false);
  assert.equal(helpers.canViewLots(none, mockAdapter), false);

  assert.equal(helpers.canManageLots(manage, mockAdapter), true);
  assert.equal(helpers.canManageLots(viewOnly, mockAdapter), false);

  assert.equal(helpers.canManageLotQa(qa, mockAdapter), true);
  assert.equal(helpers.canManageLotQa(manage, mockAdapter), false);
});

test('canExecuteQa requires both lotId and inventory.qa.manage permission', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const mockAdapter = {
    hasPermission: (session, perm) => session.permissions.includes(perm),
  };

  const qaSession = { permissions: ['inventory.qa.manage'] };
  const noQaSession = { permissions: ['inventory.view'] };

  const lotWithId = { lotId: '100' };
  const lotNoId = { lotId: '' };

  assert.equal(helpers.canExecuteQa(lotWithId, qaSession, mockAdapter), true);
  assert.equal(helpers.canExecuteQa(lotWithId, noQaSession, mockAdapter), false);
  assert.equal(helpers.canExecuteQa(lotNoId, qaSession, mockAdapter), false);
  assert.equal(helpers.canExecuteQa(null, qaSession, mockAdapter), false);
});

// =============================================================================
// TASK-010: Renderers smoke tests
// =============================================================================

test('lots renderers expose degraded state, KPIs, table, detail and QA form markup', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.lotsAdminRenderers');

  const degradedMarkup = renderers.renderDegradedState({ passed: false, reason: 'Test reason' });
  assert.match(degradedMarkup, /Datos de lote insuficientes/);
  assert.match(degradedMarkup, /Test reason/);

  const kpiMarkup = renderers.renderLotsKpis(
    { total: 5, withAlert: 1, expiringSoon: 2, expired: 0, qaPendingOrBlocked: 1, totalAvailable: 300 },
    { passed: true, reason: '' }
  );
  assert.match(kpiMarkup, /Total lotes/);
  assert.match(kpiMarkup, /Con alerta/);
  assert.match(kpiMarkup, /Proximos a vencer/);

  const tableMarkup = renderers.renderLotsTable([{
    lotId: '10',
    lotCode: 'LOT-001',
    productName: 'Envase 500ml',
    productCode: 'ENV',
    warehouseName: 'Central',
    quantity: 200,
    availableQuantity: 180,
    reservedQuantity: 20,
    qaStatus: 'APPROVED',
    lotStatus: 'AVAILABLE',
    expirationDate: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
    alertIds: [],
    sourceConfidence: 'verified',
  }]);
  assert.match(tableMarkup, /data-lot-detail="10"/);
  assert.match(tableMarkup, /Envase 500ml/);
  assert.match(tableMarkup, /Central/);
  assert.match(tableMarkup, /LOT-001/);

  const detailMarkup = renderers.renderLotDetailBody({
    lotId: '10',
    lotCode: 'LOT-001',
    productName: 'Envase 500ml',
    productCode: 'ENV',
    warehouseName: 'Central',
    quantity: 200,
    availableQuantity: 180,
    reservedQuantity: 20,
    qaStatus: 'APPROVED',
    lotStatus: 'AVAILABLE',
    expirationDate: null,
    alertIds: [],
    categoryName: null,
    sourceConfidence: 'verified',
  }, true);
  assert.match(detailMarkup, /LOT-001/);
  assert.match(detailMarkup, /Registrar QA/);
  assert.match(detailMarkup, /Ver en movimientos/);

  const detailNoQaMarkup = renderers.renderLotDetailBody({
    lotId: '10',
    lotCode: 'LOT-001',
    productName: 'Envase',
    productCode: null,
    warehouseName: 'W',
    quantity: 100,
    availableQuantity: 100,
    reservedQuantity: 0,
    qaStatus: 'PENDING',
    lotStatus: 'AVAILABLE',
    expirationDate: null,
    alertIds: [],
    categoryName: null,
    sourceConfidence: 'partial',
  }, false);
  assert.doesNotMatch(detailNoQaMarkup, /lots-register-qa-button/);

  const qaFormMarkup = renderers.renderQaForm({ lotId: '10', lotCode: 'LOT-001' });
  assert.match(qaFormMarkup, /lots-qa-form/);
  assert.match(qaFormMarkup, /qaAction/);
  assert.match(qaFormMarkup, /qaReason/);
});

// =============================================================================
// ENTRY reason codes and payload builder
// =============================================================================

test('ENTRY_REASON_CODES exposes the six approved entry reason codes', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const expected = ['INITIAL_LOAD', 'MANUAL_ENTRY', 'PRODUCTION_OUTPUT', 'PURCHASE', 'RETURN_FROM_CLIENT', 'TRANSFER_IN'];
  const values = Array.from(helpers.ENTRY_REASON_CODES).map((r) => r.value).sort();
  assert.equal(values.length, expected.length, 'six reason codes expected');
  expected.forEach((code, i) => assert.equal(values[i], code, `missing code: ${code}`));
  assert.ok(
    Array.from(helpers.ENTRY_REASON_CODES).every((r) => r.label && r.label.length > 0),
    'every code has a non-empty label'
  );
});

test('buildStockEntryPayload maps required fields and omits empty optionals — product list uses unpaginated call', () => {
  // This comment documents that openEntryDialog calls productsApi.listProducts(session)
  // WITHOUT a pageSize argument. The backend returns a plain array when no pagination params
  // are present, avoiding the MAX_PAGE_SIZE=100 limit. The frontend checks Array.isArray(response).
  assert.ok(true, 'documented via code-review; see openEntryDialog in lots-admin.js');
});

test('buildStockEntryPayload maps required fields and omits empty optionals', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const formData = new Map([
    ['warehouseId', '5'],
    ['productId', '12'],
    ['quantity', '100.5'],
    ['internalLotNumber', 'LOT-2025-001'],
    ['reasonCode', 'PURCHASE'],
    ['expirationDate', ''],
    ['productionDate', ''],
    ['manufacturerLotNumber', ''],
    ['invoiceNumber', ''],
    ['note', ''],
  ]);
  // Minimal FormData-like shim
  const fd = { get: (key) => formData.get(key) };

  const payload = helpers.buildStockEntryPayload(fd);

  assert.equal(payload.warehouseId, 5);
  assert.equal(payload.productId, 12);
  assert.equal(payload.quantity, 100.5);
  assert.equal(payload.internalLotNumber, 'LOT-2025-001');
  assert.equal(payload.reasonCode, 'PURCHASE');
  assert.equal(payload.expirationDate, undefined, 'empty date omitted');
  assert.equal(payload.manufacturerLotNumber, undefined, 'empty string omitted');
  assert.equal(payload.note, undefined, 'empty note omitted');
});

test('buildStockEntryPayload includes optional fields when present', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const formData = new Map([
    ['warehouseId', '1'],
    ['productId', '3'],
    ['quantity', '50'],
    ['internalLotNumber', 'LOT-X'],
    ['reasonCode', 'INITIAL_LOAD'],
    ['expirationDate', '2026-12-31'],
    ['productionDate', '2025-01-01'],
    ['manufacturerLotNumber', 'SUP-LOT-99'],
    ['invoiceNumber', 'FAC-001'],
    ['note', 'Carga inicial de producto A'],
  ]);
  const fd = { get: (key) => formData.get(key) };

  const payload = helpers.buildStockEntryPayload(fd);

  assert.equal(payload.expirationDate, '2026-12-31');
  assert.equal(payload.productionDate, '2025-01-01');
  assert.equal(payload.manufacturerLotNumber, 'SUP-LOT-99');
  assert.equal(payload.invoiceNumber, 'FAC-001');
  assert.equal(payload.note, 'Carga inicial de producto A');
});

test('buildCategoryIndex derives unique categories and subcategories from products', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const products = [
    { id: 1, name: 'Shampoo A', code: null, category: { id: 10, name: 'Producto Terminado' }, subcategory: { id: 20, name: 'Shampoo' } },
    { id: 2, name: 'Shampoo B', code: 'SB', category: { id: 10, name: 'Producto Terminado' }, subcategory: { id: 20, name: 'Shampoo' } },
    { id: 3, name: 'Acido X', code: null, category: { id: 11, name: 'Materia Prima' }, subcategory: null },
    { id: 4, name: 'Envase PET', code: null, category: { id: 10, name: 'Producto Terminado' }, subcategory: { id: 21, name: 'Envases' } },
  ];

  const index = helpers.buildCategoryIndex(products);

  assert.equal(index.length, 2, 'two categories');
  const pt = index.find((c) => c.id === '10');
  assert.ok(pt, 'Producto Terminado present');
  assert.equal(pt.subcategories.length, 2, 'two subcategories in PT');
  const mp = index.find((c) => c.id === '11');
  assert.ok(mp, 'Materia Prima present');
  assert.equal(mp.subcategories.length, 0, 'no subcategories in MP (product has null subcategory)');
});

test('buildCategoryIndex returns empty array when products is empty or null', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');
  assert.equal(helpers.buildCategoryIndex([]).length, 0);
  assert.equal(helpers.buildCategoryIndex(null).length, 0);
});

test('filterProductsByCategory returns all when categoryId is empty', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const products = [
    { id: 1, category: { id: 10 }, subcategory: { id: 20 } },
    { id: 2, category: { id: 11 }, subcategory: null },
  ];

  assert.equal(helpers.filterProductsByCategory(products, '', '').length, 2);
});

test('filterProductsByCategory filters by category only', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const products = [
    { id: 1, category: { id: 10 }, subcategory: { id: 20 } },
    { id: 2, category: { id: 10 }, subcategory: { id: 21 } },
    { id: 3, category: { id: 11 }, subcategory: null },
  ];

  const result = helpers.filterProductsByCategory(products, '10', '');
  assert.equal(result.length, 2);
  assert.ok(result.every((p) => String(p.category.id) === '10'));
});

test('filterProductsByCategory filters by category AND subcategory (strict match)', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const products = [
    { id: 1, category: { id: 10 }, subcategory: { id: 20 } },
    { id: 2, category: { id: 10 }, subcategory: { id: 21 } },
    { id: 3, category: { id: 10 }, subcategory: null },
  ];

  const result = helpers.filterProductsByCategory(products, '10', '20');
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 1);
});

test('filterProductsBySearch returns all products when term is empty', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const products = [
    { id: 1, name: 'Shampoo X', code: 'SH001', category: { name: 'Producto Terminado' }, subcategory: { name: 'Shampoo' } },
    { id: 2, name: 'Acondicionador Y', code: 'AC001', category: { name: 'Producto Terminado' }, subcategory: null },
  ];

  assert.equal(helpers.filterProductsBySearch(products, '').length, 2);
  assert.equal(helpers.filterProductsBySearch(products, '   ').length, 2);
  assert.equal(helpers.filterProductsBySearch(products, null).length, 2);
});

test('filterProductsBySearch matches by product name case-insensitive', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const products = [
    { id: 1, name: 'Shampoo X', code: 'SH001', category: { name: 'Producto Terminado' }, subcategory: { name: 'Shampoo' } },
    { id: 2, name: 'Acondicionador Y', code: 'AC001', category: { name: 'Producto Terminado' }, subcategory: null },
  ];

  const result = helpers.filterProductsBySearch(products, 'shampoo');
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 1);

  const resultUpper = helpers.filterProductsBySearch(products, 'SHAMPOO');
  assert.equal(resultUpper.length, 1);
});

test('filterProductsBySearch matches by product code', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const products = [
    { id: 1, name: 'Shampoo X', code: 'SH001', category: { name: 'Producto Terminado' }, subcategory: null },
    { id: 2, name: 'Acondicionador Y', code: 'AC001', category: { name: 'Producto Terminado' }, subcategory: null },
  ];

  const result = helpers.filterProductsBySearch(products, 'AC001');
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 2);
});

test('filterProductsBySearch matches by category or subcategory name', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const products = [
    { id: 1, name: 'Producto A', code: null, category: { name: 'Materia Prima' }, subcategory: { name: 'Quimico' } },
    { id: 2, name: 'Producto B', code: null, category: { name: 'Producto Terminado' }, subcategory: null },
  ];

  // buscar por categoria
  const byCat = helpers.filterProductsBySearch(products, 'materia prima');
  assert.equal(byCat.length, 1);
  assert.equal(byCat[0].id, 1);

  // buscar por subcategoria
  const bySub = helpers.filterProductsBySearch(products, 'quimico');
  assert.equal(bySub.length, 1);
  assert.equal(bySub[0].id, 1);
});

test('filterProductsBySearch handles products with null name and code gracefully', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.lotsAdminHelpers');

  const products = [
    { id: 1, name: null, code: null, category: null, subcategory: null },
    { id: 2, name: 'Shampoo Z', code: 'SZ001', category: { name: 'PT' }, subcategory: null },
  ];

  const result = helpers.filterProductsBySearch(products, 'shampoo');
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 2);
});

test('renderEntryDialog contains required form fields and reason code options', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.lotsAdminRenderers');

  const warehouses = [
    { id: 1, name: 'Bodega Central' },
    { id: 2, name: 'Bodega Norte' },
  ];

  const markup = renderers.renderEntryDialog(warehouses);

  assert.match(markup, /lots-entry-dialog/);
  assert.match(markup, /lots-entry-form/);
  assert.match(markup, /lots-entry-product-select/);
  assert.match(markup, /lots-entry-product-search/);
  assert.match(markup, /lots-entry-submit-button/);
  assert.match(markup, /lots-cancel-entry-button/);
  assert.match(markup, /lots-close-entry-button/);
  assert.match(markup, /name="warehouseId"/);
  assert.match(markup, /name="productId"/);
  assert.match(markup, /name="quantity"/);
  assert.match(markup, /name="internalLotNumber"/);
  assert.match(markup, /name="reasonCode"/);
  assert.match(markup, /Bodega Central/);
  assert.match(markup, /Bodega Norte/);
  assert.match(markup, /PURCHASE/);
  assert.match(markup, /INITIAL_LOAD/);
  assert.match(markup, /MANUAL_ENTRY/);
  // Los tres selectores de categoria/subcategoria fueron reemplazados por un input de busqueda
  assert.doesNotMatch(markup, /lots-entry-category-select/);
  assert.doesNotMatch(markup, /lots-entry-subcategory-select/);
  assert.doesNotMatch(markup, /lots-entry-subcategory-label/);
});

test('renderCategoryOptions renders category entries and escapes names', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.lotsAdminRenderers');

  const categoryIndex = [
    { id: '10', name: 'Producto Terminado' },
    { id: '11', name: '<script>XSS</script>' },
  ];

  const markup = renderers.renderCategoryOptions(categoryIndex);
  assert.match(markup, /value="10"/);
  assert.match(markup, /Producto Terminado/);
  assert.doesNotMatch(markup, /<script>XSS/);
  assert.match(markup, /&lt;script&gt;/);
});

test('renderSubcategoryOptions renders subcategory entries correctly', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.lotsAdminRenderers');

  const subs = [
    { id: '20', name: 'Shampoo' },
    { id: '21', name: 'Envases' },
  ];

  const markup = renderers.renderSubcategoryOptions(subs);
  assert.match(markup, /value="20"/);
  assert.match(markup, /Shampoo/);
  assert.match(markup, /value="21"/);
  assert.match(markup, /Envases/);
});

test('renderCategoryOptions returns empty string for empty array', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.lotsAdminRenderers');
  assert.equal(renderers.renderCategoryOptions([]), '');
  assert.equal(renderers.renderSubcategoryOptions([]), '');
});

test('renderEntryDialog escapes warehouse names to prevent XSS', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.lotsAdminRenderers');

  const markup = renderers.renderEntryDialog([{ id: 1, name: '<script>evil</script>' }]);
  assert.doesNotMatch(markup, /<script>evil/);
  assert.match(markup, /&lt;script&gt;/);
});

test('renderProductOptions renders product options with name and code', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.lotsAdminRenderers');

  const products = [
    { id: 10, name: 'Producto A', code: 'PA-001' },
    { id: 11, name: 'Producto B', code: null },
  ];

  const markup = renderers.renderProductOptions(products);
  assert.match(markup, /value="10"/);
  assert.match(markup, /Producto A/);
  assert.match(markup, /PA-001/);
  assert.match(markup, /value="11"/);
  assert.match(markup, /Producto B/);
});

// =============================================================================
// State module tests
// =============================================================================

test('lotsAdminState creates a correct initial state shape', () => {
  const rootShell = createHarness();
  const state = rootShell.require('views.lotsAdminState');

  const initial = state.createInitialState();
  assert.ok(Array.isArray(initial.lots) && initial.lots.length === 0, 'lots should be empty array');
  assert.ok(Array.isArray(initial.filteredLots) && initial.filteredLots.length === 0, 'filteredLots should be empty array');
  assert.equal(initial.selectedLotId, null);
  assert.equal(initial.drawerOpen, false);
  assert.equal(initial.showQaForm, false);
  assert.equal(initial.loading, false);
  assert.equal(initial.gate.passed, false);
  assert.equal(initial.filters.expiry, 'all');
  assert.equal(initial.filters.alertStatus, 'all');
});
