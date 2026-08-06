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
  executeRootScript('views/movements-admin.helpers.js', context);
  executeRootScript('views/movements-admin.renderers.js', context);

  return browserWindow.RootShell;
}

test('movements helpers normalize paginated responses and derive list summary', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.movementsAdminHelpers');

  const dataset = helpers.normalizeMovementsResponse({
    items: [{ id: 11 }, { id: 12 }],
    pagination: { page: 2, pageSize: 10, totalItems: 12, totalPages: 2 },
  });

  assert.equal(JSON.stringify(dataset.pagination), JSON.stringify({ page: 2, pageSize: 10, totalItems: 12, totalPages: 2 }));
  assert.equal(helpers.hasActiveFilters({ warehouseId: '', productId: '', lotId: '' }), false);
  assert.equal(helpers.hasActiveFilters({ warehouseId: '7', productId: '', lotId: '' }), true);
  assert.equal(
    helpers.buildMovementsListSummary(dataset.items, dataset.pagination, { warehouseId: '7', productId: '', lotId: '' }),
    'Mostrando 2 resultado(s) en la pagina 2 para los filtros actuales.'
  );
});

test('movements helpers derive human-readable audit values', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.movementsAdminHelpers');

  const movement = {
    quantity: '5',
    quantityBefore: '10',
    quantityAfter: '15',
    reasonCode: 'MANUAL_ADJUSTMENT',
    sourceType: 'manual_adjustment',
    sourceId: '33',
    lot: { internalLotNumber: 'LOT-001' },
    user: { fullName: 'Ana Perez' },
  };

  assert.equal(helpers.buildMovementChangeLabel(movement), '10 -> 15');
  assert.equal(helpers.buildMovementReference(movement), 'MANUAL_ADJUSTMENT · manual_adjustment · Ref 33');
  assert.equal(helpers.resolveMovementLotLabel(movement), 'LOT-001');
  assert.equal(helpers.resolveMovementActor(movement), 'Ana Perez');
});

test('movements renderers expose table, detail and pagination markup', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.movementsAdminRenderers');

  const tableMarkup = renderers.renderMovementsTable([
    {
      id: 44,
      createdAt: '2026-08-05T10:15:00.000Z',
      movementType: 'ADJUSTMENT',
      quantity: '5',
      quantityBefore: '10',
      quantityAfter: '15',
      reasonCode: 'MANUAL_ADJUSTMENT',
      sourceType: 'manual_adjustment',
      sourceId: '22',
      movementGroupId: 'grp-1',
      note: 'Conteo fisico',
      product: { name: 'Envase 1L', code: 'ENV-1L' },
      warehouse: { name: 'Central' },
      lot: { internalLotNumber: 'LOT-1' },
      user: { username: 'aperez' },
    },
  ]);

  assert.match(tableMarkup, /data-movement-detail="44"/);
  assert.match(tableMarkup, /Envase 1L/);
  assert.match(tableMarkup, /Central/);

  const detailMarkup = renderers.renderDetail({
    id: 44,
    createdAt: '2026-08-05T10:15:00.000Z',
    movementType: 'ADJUSTMENT',
    quantity: '5',
    quantityBefore: '10',
    quantityAfter: '15',
    reasonCode: 'MANUAL_ADJUSTMENT',
    sourceType: 'manual_adjustment',
    sourceId: '22',
    movementGroupId: 'grp-1',
    note: 'Conteo fisico',
    product: { name: 'Envase 1L' },
    warehouse: { name: 'Central' },
    lot: { internalLotNumber: 'LOT-1' },
    user: { username: 'aperez' },
  });
  assert.match(detailMarkup, /Reason code/);
  assert.match(detailMarkup, /Conteo fisico/);

  const paginationMarkup = renderers.renderPagination({ page: 2, totalPages: 5, totalItems: 50 });
  assert.match(paginationMarkup, /Pagina 2 de 5/);
});
