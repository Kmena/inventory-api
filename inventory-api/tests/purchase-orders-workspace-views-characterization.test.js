const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootPublicPath = path.join(__dirname, '..', 'src', 'public', 'root');

function readRootFile(relativePath) {
  return fs.readFileSync(path.join(rootPublicPath, relativePath), 'utf8');
}

function createRequestsHarness() {
  const browserWindow = {
    InventoryAuth: { fetchJson: async () => null, bootstrapSession: async () => null },
    InventorySession: { read: () => null },
  };
  const context = vm.createContext({ window: browserWindow, Map, URLSearchParams });
  browserWindow.window = browserWindow;

  function run(relativePath) {
    vm.runInContext(readRootFile(relativePath), context, { filename: relativePath });
  }

  run('registry.js');
  run('ui.js');

  browserWindow.RootShell.register('sessionAdapter', {
    hasPermission: () => false,
    isAuthenticated: () => true,
    readSnapshot: () => null,
    bootstrap: async () => null,
    getActorType: () => 'admin',
  });
  browserWindow.RootShell.register('quotationsApi', {
    listPurchaseRequests: async () => [],
  });

  run('views/purchase-requests-admin.renderers.js');
  run('views/purchase-requests-admin.js');

  return browserWindow.RootShell;
}

function createOrdersHarness() {
  const browserWindow = {
    InventoryAuth: { fetchJson: async () => null, bootstrapSession: async () => null },
    InventorySession: { read: () => null },
  };
  const context = vm.createContext({ window: browserWindow, Map, URLSearchParams });
  browserWindow.window = browserWindow;

  function run(relativePath) {
    vm.runInContext(readRootFile(relativePath), context, { filename: relativePath });
  }

  run('registry.js');
  run('ui.js');

  browserWindow.RootShell.register('sessionAdapter', {
    hasPermission: () => false,
    isAuthenticated: () => true,
    readSnapshot: () => null,
    bootstrap: async () => null,
    getActorType: () => 'admin',
  });
  browserWindow.RootShell.register('purchaseOrdersApi', {
    listOrders: async () => [],
  });

  run('views/purchase-orders-admin.renderers.js');
  run('views/purchase-orders-admin.js');

  return browserWindow.RootShell;
}

// ─── Module registration ──────────────────────────────────────────────────────

test('purchase-requests-admin.renderers.js registers views.purchaseRequestsAdminRenderers with renderRequestList and renderRequestDetail', () => {
  const shell = createRequestsHarness();
  const renderers = shell.require('views.purchaseRequestsAdminRenderers');
  assert.equal(typeof renderers.renderRequestList, 'function');
  assert.equal(typeof renderers.renderRequestDetail, 'function');
});

test('purchase-requests-admin.js registers views.purchaseRequestsAdmin with render and mount', () => {
  const shell = createRequestsHarness();
  const view = shell.require('views.purchaseRequestsAdmin');
  assert.equal(typeof view.render, 'function');
  assert.equal(typeof view.mount, 'function');
});

test('purchase-orders-admin.renderers.js registers views.purchaseOrdersAdminRenderers with renderOrderList and renderOrderDetail', () => {
  const shell = createOrdersHarness();
  const renderers = shell.require('views.purchaseOrdersAdminRenderers');
  assert.equal(typeof renderers.renderOrderList, 'function');
  assert.equal(typeof renderers.renderOrderDetail, 'function');
});

test('purchase-orders-admin.js registers views.purchaseOrdersAdmin with render and mount', () => {
  const shell = createOrdersHarness();
  const view = shell.require('views.purchaseOrdersAdmin');
  assert.equal(typeof view.render, 'function');
  assert.equal(typeof view.mount, 'function');
});

// ─── Render HTML structure ────────────────────────────────────────────────────

test('purchase-requests-admin render produces hero section with compras eyebrow and two-column commercial layout', () => {
  const shell = createRequestsHarness();
  const view = shell.require('views.purchaseRequestsAdmin');
  const html = view.render();
  assert.match(html, /Compras/);
  assert.match(html, /Solicitudes de compra/);
  assert.match(html, /commercial-layout/);
  assert.match(html, /purchase-requests-list-region/);
  assert.match(html, /purchase-requests-detail-region/);
  assert.match(html, /purchase-requests-refresh-button/);
});

test('purchase-orders-admin render produces hero section with compras eyebrow and two-column commercial layout', () => {
  const shell = createOrdersHarness();
  const view = shell.require('views.purchaseOrdersAdmin');
  const html = view.render();
  assert.match(html, /Compras/);
  assert.match(html, /rdenes de compra/);
  assert.match(html, /commercial-layout/);
  assert.match(html, /purchase-orders-list-region/);
  assert.match(html, /purchase-orders-detail-region/);
  assert.match(html, /purchase-orders-refresh-button/);
});

// ─── Renderer: request list ───────────────────────────────────────────────────

test('purchase-requests renderers renderRequestList returns empty state when no requests', () => {
  const shell = createRequestsHarness();
  const renderers = shell.require('views.purchaseRequestsAdminRenderers');
  const html = renderers.renderRequestList([], null);
  assert.match(html, /empty-state/);
});

test('purchase-requests renderers renderRequestList renders a request row with data-request-id', () => {
  const shell = createRequestsHarness();
  const renderers = shell.require('views.purchaseRequestsAdminRenderers');
  const requests = [
    {
      id: 42, title: 'Compra inicial', status: 'OPEN',
      items: [{ productId: 1 }], respondedInvitationCount: 2,
      createdAt: '2026-08-01T00:00:00.000Z',
    },
  ];
  const html = renderers.renderRequestList(requests, null);
  assert.match(html, /data-request-id="42"/);
  assert.match(html, /Compra inicial/);
  assert.match(html, /Abierta/);
  assert.match(html, /badge-info/);
});

test('purchase-requests renderers renderRequestList marks selected request as active', () => {
  const shell = createRequestsHarness();
  const renderers = shell.require('views.purchaseRequestsAdminRenderers');
  const requests = [
    { id: 1, title: 'A', status: 'OPEN', items: [], respondedInvitationCount: 0, createdAt: '2026-08-01T00:00:00.000Z' },
    { id: 2, title: 'B', status: 'CLOSED', items: [], respondedInvitationCount: 0, createdAt: '2026-08-01T00:00:00.000Z' },
  ];
  const html = renderers.renderRequestList(requests, 2);
  assert.match(html, /rfq-tracking-sidebar-item--active/);
  assert.match(html, /data-request-id="2"/);
});

test('purchase-requests renderers renderRequestDetail returns default state when no request provided', () => {
  const shell = createRequestsHarness();
  const renderers = shell.require('views.purchaseRequestsAdminRenderers');
  const html = renderers.renderRequestDetail(null);
  assert.match(html, /empty-state/);
});

test('purchase-requests renderers renderRequestDetail renders request detail with product table', () => {
  const shell = createRequestsHarness();
  const renderers = shell.require('views.purchaseRequestsAdminRenderers');
  const request = {
    id: 5, title: 'Solicitud de prueba', status: 'OPEN',
    createdAt: '2026-08-01T00:00:00.000Z',
    respondedInvitationCount: 1,
    items: [
      { product: { name: 'Azúcar', sku: 'AZ-001' }, quantity: 10, notes: 'Urgente' },
    ],
  };
  const html = renderers.renderRequestDetail(request);
  assert.match(html, /Solicitud de prueba/);
  assert.match(html, /Abierta/);
  assert.match(html, /Az&#xFA;car|Azúcar/);
  assert.match(html, /AZ-001/);
  assert.match(html, /10/);
});

test('purchase-requests renderers renderRequestDetail shows "Ver en workspace de cotizaciones" button only for OPEN requests', () => {
  const shell = createRequestsHarness();
  const renderers = shell.require('views.purchaseRequestsAdminRenderers');

  const openRequest = { id: 1, title: 'A', status: 'OPEN', createdAt: '2026-08-01T00:00:00.000Z', respondedInvitationCount: 0, items: [] };
  const closedRequest = { id: 2, title: 'B', status: 'CLOSED', createdAt: '2026-08-01T00:00:00.000Z', respondedInvitationCount: 0, items: [] };

  const openHtml = renderers.renderRequestDetail(openRequest);
  const closedHtml = renderers.renderRequestDetail(closedRequest);

  assert.match(openHtml, /purchase-requests-go-to-quotations-button/);
  assert.doesNotMatch(closedHtml, /purchase-requests-go-to-quotations-button/);
});

// ─── Renderer: order list ─────────────────────────────────────────────────────

test('purchase-orders renderers renderOrderList returns empty state when no orders', () => {
  const shell = createOrdersHarness();
  const renderers = shell.require('views.purchaseOrdersAdminRenderers');
  const html = renderers.renderOrderList([], null);
  assert.match(html, /empty-state/);
});

test('purchase-orders renderers renderOrderList renders an order row with data-order-id', () => {
  const shell = createOrdersHarness();
  const renderers = shell.require('views.purchaseOrdersAdminRenderers');
  const orders = [
    {
      id: 77, status: 'PENDING',
      supplier: { name: 'Proveedor Alfa' },
      items: [{ quantity: 5, unitPrice: 1000, currency: 'CRC', product: { name: 'Sal', sku: 'S-001' } }],
      createdAt: '2026-08-01T00:00:00.000Z',
    },
  ];
  const html = renderers.renderOrderList(orders, null);
  assert.match(html, /data-order-id="77"/);
  assert.match(html, /OC #77/);
  assert.match(html, /Pendiente/);
  assert.match(html, /badge-warning/);
  assert.match(html, /Proveedor Alfa/);
});

test('purchase-orders renderers renderOrderList marks selected order as active', () => {
  const shell = createOrdersHarness();
  const renderers = shell.require('views.purchaseOrdersAdminRenderers');
  const orders = [
    { id: 1, status: 'PENDING', supplier: { name: 'A' }, items: [], createdAt: '2026-08-01T00:00:00.000Z' },
    { id: 2, status: 'CONFIRMED', supplier: { name: 'B' }, items: [], createdAt: '2026-08-01T00:00:00.000Z' },
  ];
  const html = renderers.renderOrderList(orders, 2);
  assert.match(html, /rfq-tracking-sidebar-item--active/);
  assert.match(html, /data-order-id="2"/);
});

test('purchase-orders renderers renderOrderDetail returns default state when no order provided', () => {
  const shell = createOrdersHarness();
  const renderers = shell.require('views.purchaseOrdersAdminRenderers');
  const html = renderers.renderOrderDetail(null);
  assert.match(html, /empty-state/);
});

test('purchase-orders renderers renderOrderDetail renders order detail with product table and hacienda placeholder', () => {
  const shell = createOrdersHarness();
  const renderers = shell.require('views.purchaseOrdersAdminRenderers');
  const order = {
    id: 88, status: 'CONFIRMED',
    supplier: { name: 'Proveedor Uno' },
    notes: 'Entrega rápida',
    createdAt: '2026-08-01T00:00:00.000Z',
    items: [
      { product: { name: 'Azúcar', sku: 'AZ-001' }, quantity: 10, unitPrice: 500, currency: 'CRC' },
    ],
  };
  const html = renderers.renderOrderDetail(order);
  assert.match(html, /Orden de compra #88/);
  assert.match(html, /Confirmada/);
  assert.match(html, /badge-info/);
  assert.match(html, /Proveedor Uno/);
  assert.match(html, /Az&#xFA;car|Azúcar/);
  assert.match(html, /AZ-001/);
  assert.match(html, /Entrega r&#xE1;pida|Entrega rápida/);
  assert.match(html, /hacienda-xml-upload/);
  assert.match(html, /Comprobante fiscal/);
});

test('purchase-orders renderers renderOrderDetail formats RECEIVED status correctly', () => {
  const shell = createOrdersHarness();
  const renderers = shell.require('views.purchaseOrdersAdminRenderers');
  const order = {
    id: 99, status: 'RECEIVED',
    supplier: { name: 'Proveedor Beta' },
    createdAt: '2026-08-01T00:00:00.000Z',
    items: [],
  };
  const html = renderers.renderOrderDetail(order);
  assert.match(html, /Recibida/);
  assert.match(html, /badge-success/);
});

// ─── Source structure guards ──────────────────────────────────────────────────

test('purchase-requests-admin.js does not contain inline business rules or direct HTTP calls', () => {
  const source = readRootFile('views/purchase-requests-admin.js');
  assert.doesNotMatch(source, /fetch\(/);
  assert.doesNotMatch(source, /XMLHttpRequest/);
  assert.match(source, /quotationsApi\.listPurchaseRequests/);
});

test('purchase-orders-admin.js does not contain inline business rules or direct HTTP calls', () => {
  const source = readRootFile('views/purchase-orders-admin.js');
  assert.doesNotMatch(source, /fetch\(/);
  assert.doesNotMatch(source, /XMLHttpRequest/);
  assert.match(source, /purchaseOrdersApi\.listOrders/);
});

test('purchase-orders-api.js registers purchaseOrdersApi with listOrders function using InventoryAuth.fetchJson', () => {
  const browserWindow = {
    InventoryAuth: { fetchJson: async () => null },
  };
  const context = vm.createContext({ window: browserWindow, Map });
  browserWindow.window = browserWindow;

  function run(relativePath) {
    const source = fs.readFileSync(path.join(rootPublicPath, relativePath), 'utf8');
    vm.runInContext(source, context, { filename: relativePath });
  }

  run('registry.js');
  run('purchase-orders-api.js');

  const api = browserWindow.RootShell.require('purchaseOrdersApi');
  assert.equal(typeof api.listOrders, 'function');
});

test('purchase-orders-api.js calls /api/procurement/orders endpoint', () => {
  const capturedCalls = [];
  const browserWindow = {
    InventoryAuth: {
      fetchJson: async (session, url, opts) => {
        capturedCalls.push({ url, opts });
        return [];
      },
    },
  };
  const context = vm.createContext({ window: browserWindow, Map });
  browserWindow.window = browserWindow;

  function run(relativePath) {
    const source = fs.readFileSync(path.join(rootPublicPath, relativePath), 'utf8');
    vm.runInContext(source, context, { filename: relativePath });
  }

  run('registry.js');
  run('purchase-orders-api.js');

  const api = browserWindow.RootShell.require('purchaseOrdersApi');
  const session = { user: { id: '1' } };

  return api.listOrders(session).then(() => {
    assert.equal(capturedCalls.length, 1);
    assert.equal(capturedCalls[0].url, '/api/procurement/orders');
  });
});
