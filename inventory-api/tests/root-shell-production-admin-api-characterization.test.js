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

function createBrowserContext(fetchJsonImplementation = async () => null) {
  const browserWindow = {
    InventoryAuth: {
      fetchJson: fetchJsonImplementation,
    },
  };

  const context = vm.createContext({
    Map,
    URLSearchParams,
    window: browserWindow,
  });

  browserWindow.window = browserWindow;
  return { browserWindow, context };
}

test('productionAdminApi calls only approved read-oriented production endpoints', async () => {
  const calls = [];
  const { browserWindow, context } = createBrowserContext(async (session, url, options = {}) => {
    calls.push({ session, url, options });
    return { ok: true };
  });

  executeRootScript('registry.js', context);
  executeRootScript('production-admin-api.js', context);

  const productionAdminApi = browserWindow.RootShell.require('productionAdminApi');
  const session = { user: { id: 1 } };

  await productionAdminApi.listProductionOrders(session, {
    page: 2,
    pageSize: 50,
    status: 'APPROVED',
    productId: 8,
    searchTerm: 'ORD-22',
  });
  await productionAdminApi.getProductionOrder(session, 99);

  assert.equal(calls[0].url, '/api/production/orders?page=2&pageSize=50');
  assert.equal(calls[0].options.fallbackMessage, 'No se pudieron cargar las ordenes de produccion.');
  assert.equal(calls[1].url, '/api/production/orders/99');
  assert.equal(calls[1].options.fallbackMessage, 'No se pudo cargar el detalle de la orden de produccion.');
});

test('productionAdminApi.approveProductionOrder calls POST /api/production/orders/:id/approve', async () => {
  const calls = [];
  const { browserWindow, context } = createBrowserContext(async (session, url, options = {}) => {
    calls.push({ session, url, options });
    return { ok: true };
  });

  executeRootScript('registry.js', context);
  executeRootScript('production-admin-api.js', context);

  const productionAdminApi = browserWindow.RootShell.require('productionAdminApi');
  const session = { user: { id: 1 } };

  await productionAdminApi.approveProductionOrder(session, 42, {});

  assert.equal(calls[0].url, '/api/production/orders/42/approve');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.fallbackMessage, 'No se pudo aprobar la orden de produccion.');
});

test('productionAdminApi.submitProductionOrder calls POST /api/production/orders/:id/submit', async () => {
  const calls = [];
  const { browserWindow, context } = createBrowserContext(async (session, url, options = {}) => {
    calls.push({ session, url, options });
    return { ok: true };
  });

  executeRootScript('registry.js', context);
  executeRootScript('production-admin-api.js', context);

  const productionAdminApi = browserWindow.RootShell.require('productionAdminApi');
  const session = { user: { id: 1 } };

  await productionAdminApi.submitProductionOrder(session, 7);

  assert.equal(calls[0].url, '/api/production/orders/7/submit');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.fallbackMessage, 'No se pudo enviar la orden a aprobacion.');
});

test('production-orders-admin helpers expose canApproveProductionOrders', () => {
  const { browserWindow, context } = createBrowserContext();

  executeRootScript('registry.js', context);
  executeRootScript(path.join('views', 'production-orders-admin.helpers.js'), context);

  const helpers = browserWindow.RootShell.require('views.productionOrdersAdminHelpers');
  const sessionAdapter = {
    hasPermission(session, permission) {
      return session.user.permissions.includes(permission);
    },
  };

  const withApprove = { user: { permissions: ['production.approve'] } };
  const withoutApprove = { user: { permissions: ['production.view'] } };

  assert.equal(helpers.canApproveProductionOrders(withApprove, sessionAdapter), true);
  assert.equal(helpers.canApproveProductionOrders(withoutApprove, sessionAdapter), false);
});

test('production-orders-admin helpers expose canSubmitProductionOrders', () => {
  const { browserWindow, context } = createBrowserContext();
  executeRootScript('registry.js', context);
  executeRootScript(path.join('views', 'production-orders-admin.helpers.js'), context);

  const helpers = browserWindow.RootShell.require('views.productionOrdersAdminHelpers');
  const sessionAdapter = {
    hasPermission(session, permission) {
      return session.user.permissions.includes(permission);
    },
  };

  const withCreate = { user: { permissions: ['production.create'] } };
  const withoutCreate = { user: { permissions: ['production.view'] } };

  assert.equal(helpers.canSubmitProductionOrders(withCreate, sessionAdapter), true);
  assert.equal(helpers.canSubmitProductionOrders(withoutCreate, sessionAdapter), false);
});

test('production orders helpers keep unsupported filters explicitly client-side', () => {
  const { browserWindow, context } = createBrowserContext();

  executeRootScript('registry.js', context);
  executeRootScript(path.join('views', 'production-orders-admin.helpers.js'), context);

  const helpers = browserWindow.RootShell.require('views.productionOrdersAdminHelpers');
  const sessionAdapter = {
    hasPermission(session, permission) {
      return session.user.permissions.includes(permission);
    },
  };

  const session = { user: { permissions: ['production.view'] } };
  assert.equal(helpers.canViewProductionOrders(session, sessionAdapter), true);
  assert.equal(helpers.FILTER_SUPPORT.page, 'server');
  assert.equal(helpers.FILTER_SUPPORT.status, 'client');
  assert.equal(helpers.FILTER_SUPPORT.searchTerm, 'client');

  const response = helpers.normalizeProductionOrdersResponse({
    items: [{ id: 1 }],
    pagination: { page: 3, pageSize: 5, totalItems: 12, totalPages: 3 },
  });
  assert.equal(response.pagination.page, 3);
  assert.equal(response.pagination.totalItems, 12);

  const listQuery = helpers.buildListQuery({ status: 'IN_PROGRESS', searchTerm: 'ord-2' }, 4, 25);
  assert.equal(listQuery.serverQuery.page, 4);
  assert.equal(listQuery.serverQuery.pageSize, 25);
  assert.equal(listQuery.clientFilters.status, 'IN_PROGRESS');

  const filtered = helpers.applyClientSideFilters([
    {
      id: 1,
      orderId: 'ORD-22',
      productionLotCode: 'LOT-01',
      status: 'IN_PROGRESS',
      productId: 8,
      recipeId: 5,
      recipeVersionId: 13,
      plannedDate: '2026-09-13T00:00:00.000Z',
      createdAt: '2026-09-10T00:00:00.000Z',
      responsibleUserId: 44,
      product: { id: 8, code: 'PT-8', name: 'Shampoo B' },
      recipe: { id: 5, code: 'RC-5', name: 'Base A' },
      recipeVersion: { id: 13, versionNumber: 3 },
    },
    {
      id: 2,
      orderId: 'ORD-30',
      productionLotCode: 'LOT-02',
      status: 'DRAFT',
      productId: 9,
      recipeId: 6,
      recipeVersionId: 15,
      plannedDate: '2026-10-01T00:00:00.000Z',
      createdAt: '2026-10-01T00:00:00.000Z',
      responsibleUserId: 45,
      product: { id: 9, code: 'PT-9', name: 'Jabon C' },
      recipe: { id: 6, code: 'RC-6', name: 'Base C' },
      recipeVersion: { id: 15, versionNumber: 1 },
    },
  ], {
    searchTerm: 'ord-22',
    status: 'IN_PROGRESS',
    productId: '8',
    recipeId: '5',
    versionId: '13',
    plannedDateFrom: '2026-09-01T00:00:00.000Z',
    plannedDateTo: '2026-09-30T23:59:59.999Z',
    createdDateFrom: '2026-09-01T00:00:00.000Z',
    createdDateTo: '2026-09-30T23:59:59.999Z',
    responsibleUserId: '44',
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 1);
  assert.match(helpers.buildProductionOrdersListSummary(filtered, { page: 1, totalItems: 2 }, { searchTerm: 'ord-22' }), /filtros client-side/);
});
