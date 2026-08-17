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
  vm.runInContext(readRootFile(relativePath), context, { filename: relativePath });
}

function createBrowserContext() {
  const browserWindow = {};
  const context = vm.createContext({
    Map,
    window: browserWindow,
  });
  browserWindow.window = browserWindow;
  return { browserWindow, context };
}

test('productionOrdersAdmin render exposes administrative supervision workspace instead of introductory placeholder copy', () => {
  const { browserWindow, context } = createBrowserContext();

  executeRootScript('registry.js', context);
  browserWindow.RootShell.register('productionAdminApi', {});
  browserWindow.RootShell.register('ui', { escapeHtml: (v) => String(v || ''), formatDate: () => '01/01/2026', renderInlineMessage: () => '' });
  browserWindow.RootShell.register('sessionAdapter', {});
  browserWindow.RootShell.register('views.productionOrdersAdminHelpers', {});
  browserWindow.RootShell.register('views.productionOrdersAdminRenderers', {});
  browserWindow.RootShell.register('views.productionOrdersAdminState', {});

  executeRootScript(path.join('views', 'production-orders-admin.js'), context);

  const view = browserWindow.RootShell.require('views.productionOrdersAdmin');
  const markup = view.render();

  assert.match(markup, /Consulta administrativa de supervision/);
  assert.match(markup, /production-orders-search-input/);
  assert.match(markup, /production-orders-list-region/);
  assert.match(markup, /production-orders-detail-region/);
  assert.match(markup, /Actualizar/);
  assert.doesNotMatch(markup, /Siguiente incremento/);
  assert.doesNotMatch(markup, /Modulo en progreso/);
});

test('production orders state and renderers keep detail read-only and exclude warehouse/QA actions', () => {
  const { browserWindow, context } = createBrowserContext();

  executeRootScript('registry.js', context);
  browserWindow.RootShell.register('ui', {
    escapeHtml: (value) => String(value || ''),
    formatDate: () => '01/01/2026',
  });

  executeRootScript(path.join('views', 'production-orders-admin.state.js'), context);
  executeRootScript(path.join('views', 'production-orders-admin.renderers.js'), context);

  const state = browserWindow.RootShell.require('views.productionOrdersAdminState');
  const renderers = browserWindow.RootShell.require('views.productionOrdersAdminRenderers');

  const orders = [
    {
      id: 10,
      orderId: 'ORD-10',
      productionLotCode: 'LOT-10',
      status: 'IN_PROGRESS',
      plannedDate: '2026-09-13T00:00:00.000Z',
      product: { id: 7, name: 'Producto A' },
      recipe: { id: 5, name: 'Receta Base' },
      recipeVersion: { id: 12, versionNumber: 3 },
      responsibleUser: { id: 9, fullName: 'Ana Supervisor' },
      stageExecutions: [{ id: 1, stageName: 'Pesado', stageOrder: 1, consumptions: [], wastes: [], notes: 'OK' }],
      recipeVersionSnapshot: { recipeVersion: { versionNumber: 3 } },
    },
    {
      id: 11,
      orderId: 'ORD-11',
      productionLotCode: 'LOT-11',
      status: 'COMPLETED',
      product: { id: 8, name: 'Producto B' },
      recipe: { id: 6, name: 'Receta C' },
      recipeVersion: { id: 13, versionNumber: 1 },
    },
  ];

  const metrics = state.buildOrderMetrics(orders);
  assert.equal(metrics.inProgressCount, 1);
  assert.equal(metrics.completedCount, 1);

  const tableMarkup = renderers.renderOrdersTable(orders, 10);
  assert.match(tableMarkup, /Ver detalle/);
  assert.match(tableMarkup, /Producto A/);
  assert.match(tableMarkup, /Receta Base/);

  const detailMarkup = renderers.renderOrderDetail(orders[0], { detailState: 'ready' });
  assert.match(detailMarkup, /Vista read-only de supervision/);
  assert.match(detailMarkup, /Snapshot congelado/);
  assert.match(detailMarkup, /Pesado/);
  assert.doesNotMatch(detailMarkup, /Ejecutar etapa/);
  assert.doesNotMatch(detailMarkup, /Inspeccionar/);
  assert.doesNotMatch(detailMarkup, /Completar/);
  assert.doesNotMatch(detailMarkup, /Aprobar/);
  assert.doesNotMatch(detailMarkup, /Cancelar/);
});
