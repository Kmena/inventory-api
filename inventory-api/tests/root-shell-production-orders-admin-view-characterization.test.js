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
  // No approve button: status is IN_PROGRESS (not PENDING_APPROVAL)
  assert.doesNotMatch(detailMarkup, /production-approve-btn/);
  assert.doesNotMatch(detailMarkup, /Cancelar/);
});

test('production-orders-admin renderOrderDetail shows approve button for PENDING_APPROVAL + canApproveProduction', () => {
  const { browserWindow, context } = createBrowserContext();
  executeRootScript('registry.js', context);
  browserWindow.RootShell.register('ui', {
    escapeHtml: (value) => String(value || ''),
    formatDate: () => '01/01/2026',
  });
  executeRootScript(path.join('views', 'production-orders-admin.state.js'), context);
  executeRootScript(path.join('views', 'production-orders-admin.renderers.js'), context);

  const renderers = browserWindow.RootShell.require('views.productionOrdersAdminRenderers');

  const pendingOrder = {
    id: 20,
    orderId: 'ORD-20',
    productionLotCode: 'LOT-20',
    status: 'PENDING_APPROVAL',
    product: { id: 7, name: 'Producto A' },
    recipe: { id: 5, name: 'Receta Base' },
    recipeVersion: { id: 12, versionNumber: 2 },
    stageExecutions: [],
    recipeVersionSnapshot: { recipeVersion: { versionNumber: 2 } },
  };

  // Without canApproveProduction: no approve button
  const detailNoApprove = renderers.renderOrderDetail(pendingOrder, { detailState: 'ready', canApproveProduction: false });
  assert.doesNotMatch(detailNoApprove, /production-approve-btn/);

  // With canApproveProduction AND PENDING_APPROVAL: approve button appears
  const detailWithApprove = renderers.renderOrderDetail(pendingOrder, { detailState: 'ready', canApproveProduction: true });
  assert.match(detailWithApprove, /production-approve-btn/);
  assert.match(detailWithApprove, /Aprobar orden/);
  assert.match(detailWithApprove, /data-order-id="20"/);
  assert.doesNotMatch(detailWithApprove, /Vista read-only de supervision/);
});

test('production-orders-admin renderOrderDetail shows submit button for DRAFT + canSubmitProduction', () => {
  const { browserWindow, context } = createBrowserContext();
  executeRootScript('registry.js', context);
  browserWindow.RootShell.register('ui', {
    escapeHtml: (value) => String(value || ''),
    formatDate: () => '01/01/2026',
  });
  executeRootScript(path.join('views', 'production-orders-admin.state.js'), context);
  executeRootScript(path.join('views', 'production-orders-admin.renderers.js'), context);

  const renderers = browserWindow.RootShell.require('views.productionOrdersAdminRenderers');

  const draftOrder = {
    id: 30,
    orderId: 'ORD-30',
    productionLotCode: 'LOT-30',
    status: 'DRAFT',
    product: { id: 7, name: 'Producto A' },
    recipe: { id: 5, name: 'Receta Base' },
    recipeVersion: { id: 12, versionNumber: 1 },
    stageExecutions: [],
    recipeVersionSnapshot: { recipeVersion: { versionNumber: 1 } },
  };

  // Without canSubmitProduction: no submit button, shows read-only context
  const detailNoSubmit = renderers.renderOrderDetail(draftOrder, { detailState: 'ready', canSubmitProduction: false });
  assert.doesNotMatch(detailNoSubmit, /production-submit-btn/);

  // With canSubmitProduction AND DRAFT: submit button appears
  const detailWithSubmit = renderers.renderOrderDetail(draftOrder, { detailState: 'ready', canSubmitProduction: true });
  assert.match(detailWithSubmit, /production-submit-btn/);
  assert.match(detailWithSubmit, /Enviar a aprobacion/);
  assert.match(detailWithSubmit, /data-order-id="30"/);
  assert.doesNotMatch(detailWithSubmit, /Vista read-only de supervision/);
});

test('production-orders-admin state includes PENDING_APPROVAL in STATUS_LABELS and metrics', () => {
  const { browserWindow, context } = createBrowserContext();
  executeRootScript('registry.js', context);
  executeRootScript(path.join('views', 'production-orders-admin.state.js'), context);

  const state = browserWindow.RootShell.require('views.productionOrdersAdminState');

  const orders = [
    { id: 1, status: 'PENDING_APPROVAL' },
    { id: 2, status: 'PENDING_APPROVAL' },
    { id: 3, status: 'APPROVED' },
  ];

  const metrics = state.buildOrderMetrics(orders);
  assert.equal(metrics.pendingApprovalCount, 2);
  assert.equal(metrics.approvedCount, 1);

  // Badge for PENDING_APPROVAL should be a warning class
  const badgeHtml = state.renderStatusBadge({ status: 'PENDING_APPROVAL' }, { escapeHtml: (v) => String(v) });
  assert.match(badgeHtml, /badge-warning/);
  assert.match(badgeHtml, /Pendiente de aprobaci/);
});
