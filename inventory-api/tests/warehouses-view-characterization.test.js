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
  executeRootScript('views/warehouses-admin.helpers.js', context);
  executeRootScript('views/warehouses-admin.renderers.js', context);

  return browserWindow.RootShell;
}

test('warehouses helpers normalize summary fallback and local filtering', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.warehousesAdminHelpers');

  const dataset = helpers.normalizeWarehouseDataset({
    items: [
      { id: 1, code: 'BOD-01', name: 'Central', warehouseType: 'GENERAL', isActive: true, isVirtual: false, isSellableSource: false },
      { id: 2, code: 'BOD-02', name: 'Virtual cursos', warehouseType: 'COURSES_VIRTUAL', isActive: true, isVirtual: true, isSellableSource: false },
      { id: 3, code: 'BOD-03', name: 'Despacho', warehouseType: 'FINISHED_GOODS', isActive: false, isVirtual: false, isSellableSource: true },
    ],
    warehouseTypes: [{ value: 'GENERAL', label: 'General' }],
  });

  assert.equal(dataset.summaryEstimated, true);
  assert.equal(JSON.stringify(dataset.summary), JSON.stringify({ total: 3, active: 2, virtual: 1, sellable: 1 }));

  const visible = helpers.filterWarehouses(dataset.items, {
    searchTerm: 'des',
    type: 'FINISHED_GOODS',
    status: 'inactive',
    nature: 'physical',
    sellable: 'yes',
  });

  assert.equal(visible.length, 1);
  assert.equal(visible[0].code, 'BOD-03');
  assert.equal(helpers.hasActiveFilters({ searchTerm: '', type: '', status: 'all', nature: 'all', sellable: 'all' }), false);
  assert.equal(helpers.hasActiveFilters({ searchTerm: 'central', type: '', status: 'all', nature: 'all', sellable: 'all' }), true);
});

test('warehouses helpers derive payload and sellable adjustment from selected type', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.warehousesAdminHelpers');

  const warehouseTypes = [
    { value: 'GENERAL', label: 'General', isVirtual: false, defaultSellableSource: false, description: 'General' },
    { value: 'FINISHED_GOODS', label: 'Producto terminado', isVirtual: false, defaultSellableSource: true, description: 'PT' },
    { value: 'COURSES_VIRTUAL', label: 'Virtual', isVirtual: true, defaultSellableSource: false, description: 'Virtual' },
  ];

  const payload = helpers.buildCreateWarehousePayload(new Map([
    ['code', ' bode 01 '],
    ['name', ' Bodega central '],
    ['warehouseType', 'COURSES_VIRTUAL'],
    ['isSellableSource', 'on'],
    ['isActive', 'on'],
  ]), warehouseTypes);

  assert.equal(payload.code, 'bode 01');
  assert.equal(payload.name, 'Bodega central');
  assert.equal(payload.warehouseType, 'COURSES_VIRTUAL');
  assert.equal(payload.isSellableSource, false);
  assert.equal(payload.isActive, true);
  assert.equal(
    helpers.getTypeAdjustmentMessage('GENERAL', 'COURSES_VIRTUAL', warehouseTypes),
    'La fuente vendible se ajusto segun el tipo de bodega seleccionado.'
  );
});

test('warehouses renderers expose metrics, empty state and responsive table markup', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.warehousesAdminRenderers');

  const metricsMarkup = renderers.renderMetrics({ total: 7, active: 6, virtual: 2, sellable: 3 }, true);
  assert.match(metricsMarkup, /Fuentes vendibles/);
  assert.match(metricsMarkup, /Estimado/);

  const stateMarkup = renderers.renderWarehouseState('No hay resultados con los filtros actuales', 'Prueba con otro termino');
  assert.match(stateMarkup, /No hay resultados con los filtros actuales/);

  const tableMarkup = renderers.renderWarehousesTable([
    {
      code: 'BOD-01',
      name: 'Central',
      warehouseType: 'GENERAL',
      warehouseTypeLabel: 'General',
      warehouseTypeDescription: 'Bodega comodin',
      isVirtual: false,
      isSellableSource: false,
      isActive: true,
      updatedAt: '2026-08-05T00:00:00.000Z',
    },
  ]);
  assert.match(tableMarkup, /data-label="Codigo"/);
  assert.match(tableMarkup, /Central/);
  assert.match(tableMarkup, /Vendible|No vendible/);
});
