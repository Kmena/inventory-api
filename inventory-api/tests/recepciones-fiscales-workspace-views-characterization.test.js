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

function createViewHarness() {
  const calls = [];
  const { browserWindow, context } = createBrowserContext(async (session, url, options = {}) => {
    calls.push({ session, url, options });
    return [];
  });

  executeRootScript('registry.js', context);
  executeRootScript('ui.js', context);
  executeRootScript('receipts-api.js', context);
  executeRootScript('views/receipts-admin.renderers.js', context);
  executeRootScript('views/fiscal-refs-admin.renderers.js', context);

  return { browserWindow, context, calls };
}

// -----------------------------------------------------------------------
// receipts-api.js
// -----------------------------------------------------------------------

test('receipts-api.js registers receiptsApi with all 4 required functions using InventoryAuth.fetchJson', async () => {
  const calls = [];
  const { browserWindow, context } = createBrowserContext(async (session, url, options = {}) => {
    calls.push({ session, url, options });
    return [];
  });

  executeRootScript('registry.js', context);
  executeRootScript('receipts-api.js', context);

  const receiptsApi = browserWindow.RootShell.require('receiptsApi');
  const session = { user: { id: 5 } };

  await receiptsApi.listReceipts(session);
  await receiptsApi.getReceipt(session, 9001);
  await receiptsApi.listFiscalReferences(session);
  await receiptsApi.listFiscalReferencesForReceipt(session, 9001);

  assert.equal(calls.length, 4);
  assert.equal(calls[0].url, '/api/receipts');
  assert.equal(calls[1].url, '/api/receipts/9001');
  assert.equal(calls[2].url, '/api/fiscal-references');
  assert.equal(calls[3].url, '/api/receipts/9001/fiscal-references');
});

test('receipts-api.js provides Spanish fallbackMessage for every function', async () => {
  const collected = [];
  const { browserWindow, context } = createBrowserContext(async (_session, _url, options = {}) => {
    collected.push(options.fallbackMessage);
    return [];
  });

  executeRootScript('registry.js', context);
  executeRootScript('receipts-api.js', context);

  const receiptsApi = browserWindow.RootShell.require('receiptsApi');
  const session = {};

  await receiptsApi.listReceipts(session);
  await receiptsApi.getReceipt(session, 1);
  await receiptsApi.listFiscalReferences(session);
  await receiptsApi.listFiscalReferencesForReceipt(session, 1);

  assert.equal(collected.length, 4);
  for (const msg of collected) {
    assert.ok(typeof msg === 'string' && msg.length > 0, 'fallbackMessage must be a non-empty string');
  }
});

test('receipts-api.js source does not contain hardcoded credentials or direct fetch() calls', () => {
  const source = readRootFile('receipts-api.js');
  assert.doesNotMatch(source, /fetch\(/, 'must use InventoryAuth.fetchJson, not fetch()');
  assert.doesNotMatch(source, /Bearer /, 'must not hardcode Bearer tokens');
  assert.match(source, /InventoryAuth/, 'must use InventoryAuth adapter');
});

// -----------------------------------------------------------------------
// receipts-admin.renderers.js
// -----------------------------------------------------------------------

test('receipts-admin.renderers.js registers views.receiptsAdminRenderers with renderReceiptList and renderReceiptDetail', () => {
  const { browserWindow } = createViewHarness();
  const renderers = browserWindow.RootShell.require('views.receiptsAdminRenderers');
  assert.ok(typeof renderers.renderReceiptList === 'function', 'must expose renderReceiptList');
  assert.ok(typeof renderers.renderReceiptDetail === 'function', 'must expose renderReceiptDetail');
});

test('receipts renderers renderReceiptList returns empty state when no receipts', () => {
  const { browserWindow } = createViewHarness();
  const renderers = browserWindow.RootShell.require('views.receiptsAdminRenderers');
  const html = renderers.renderReceiptList([]);
  assert.match(html, /empty-state/, 'empty receipts must render empty-state class');
});

test('receipts renderers renderReceiptList renders a row with data-receipt-id', () => {
  const { browserWindow } = createViewHarness();
  const renderers = browserWindow.RootShell.require('views.receiptsAdminRenderers');
  const receipt = {
    id: 9001n,
    status: 'CONFIRMED',
    supplierId: 3001n,
    supplier: { name: 'Proveedor CR' },
    createdAt: new Date('2026-09-01'),
  };
  const html = renderers.renderReceiptList([receipt], null);
  assert.match(html, /data-receipt-id/, 'list item must include data-receipt-id attribute');
  assert.match(html, /Proveedor CR/, 'list item must include supplier name');
});

test('receipts renderers renderReceiptList marks selected receipt as active', () => {
  const { browserWindow } = createViewHarness();
  const renderers = browserWindow.RootShell.require('views.receiptsAdminRenderers');
  const receipt = {
    id: 9001n,
    status: 'ACCEPTED',
    supplier: { name: 'Proveedor' },
    createdAt: new Date(),
  };
  const html = renderers.renderReceiptList([receipt], '9001');
  assert.match(html, /--active/, 'selected receipt must have active class modifier');
});

test('receipts renderers renderReceiptDetail returns placeholder when receipt is null', () => {
  const { browserWindow } = createViewHarness();
  const renderers = browserWindow.RootShell.require('views.receiptsAdminRenderers');
  const html = renderers.renderReceiptDetail(null);
  assert.match(html, /empty-state|Selecciona/, 'null receipt must render placeholder');
});

test('receipts renderers renderReceiptDetail renders item table with product columns', () => {
  const { browserWindow } = createViewHarness();
  const renderers = browserWindow.RootShell.require('views.receiptsAdminRenderers');
  const receipt = {
    id: 9001n,
    status: 'CONFIRMED',
    receivedAt: new Date('2026-09-01'),
    notes: null,
    supplier: { name: 'Proveedor CR' },
    warehouse: { name: 'Bodega Central' },
    purchaseOrder: null,
    items: [
      {
        id: 8001n,
        product: { name: 'Azúcar', sku: 'AZ-001' },
        requestedQuantity: 10,
        receivedQuantity: 10,
        rejectedQuantity: 0,
        lotNumber: 'LOT-2026-01',
        unitCost: 500,
        observations: null,
        inspections: [],
      },
    ],
    inspections: [],
  };
  const html = renderers.renderReceiptDetail(receipt);
  assert.match(html, /Proveedor CR/, 'detail must include supplier name');
  assert.match(html, /Bodega Central/, 'detail must include warehouse name');
  assert.match(html, /AZ-001/, 'detail must include product SKU');
  assert.match(html, /LOT-2026-01/, 'detail must include lot number');
});

test('receipts renderers renderReceiptDetail uses correct badge classes for all statuses', () => {
  const { browserWindow } = createViewHarness();
  const renderers = browserWindow.RootShell.require('views.receiptsAdminRenderers');

  const makeReceipt = (status) => ({
    id: 9001n, status, supplier: { name: 'S' }, warehouse: { name: 'W' },
    receivedAt: new Date(), notes: null, purchaseOrder: null, items: [], inspections: [],
  });

  assert.match(renderers.renderReceiptDetail(makeReceipt('CONFIRMED')), /badge-success/);
  assert.match(renderers.renderReceiptDetail(makeReceipt('REJECTED')), /badge-danger/);
  assert.match(renderers.renderReceiptDetail(makeReceipt('PENDING_INSPECTION')), /badge-warning/);
  assert.match(renderers.renderReceiptDetail(makeReceipt('ACCEPTED')), /badge-success/);
  assert.match(renderers.renderReceiptDetail(makeReceipt('PARTIALLY_ACCEPTED')), /badge-warning/);
  assert.match(renderers.renderReceiptDetail(makeReceipt('REVERSED')), /badge/);
});

// -----------------------------------------------------------------------
// receipts-admin.js
// -----------------------------------------------------------------------

test('receipts-admin.renderers.js registers views.receiptsAdminRenderers with renderReceiptList and renderReceiptDetail', () => {
  const source = readRootFile('views/receipts-admin.renderers.js');
  assert.match(source, /views\.receiptsAdminRenderers/, 'must register views.receiptsAdminRenderers');
  assert.match(source, /renderReceiptList/, 'must expose renderReceiptList');
  assert.match(source, /renderReceiptDetail/, 'must expose renderReceiptDetail');
});

test('receipts-admin.js registers views.receiptsAdmin with render and mount', () => {
  const source = readRootFile('views/receipts-admin.js');
  assert.match(source, /views\.receiptsAdmin/, 'must register views.receiptsAdmin');
  assert.match(source, /render/, 'must expose render function');
  assert.match(source, /mount/, 'must expose mount function');
});

test('receipts-admin render produces hero section with compras eyebrow and two-column commercial layout', () => {
  const { browserWindow, context } = createBrowserContext();
  executeRootScript('registry.js', context);
  executeRootScript('ui.js', context);
  executeRootScript('receipts-api.js', context);
  executeRootScript('views/receipts-admin.renderers.js', context);
  executeRootScript('views/receipts-admin.js', context);

  const view = browserWindow.RootShell.require('views.receiptsAdmin');
  const html = view.render();

  assert.match(html, /root-hero/, 'must include root-hero section');
  assert.match(html, /Compras/, 'eyebrow must say Compras');
  assert.match(html, /Recepciones/, 'h2 must mention Recepciones');
  assert.match(html, /commercial-layout/, 'must use commercial two-column layout');
  assert.match(html, /receipts-sidebar/, 'must include receipts-sidebar element');
  assert.match(html, /receipts-detail-panel/, 'must include receipts-detail-panel element');
});

test('receipts-admin.js does not contain inline business rules or direct HTTP calls', () => {
  const source = readRootFile('views/receipts-admin.js');
  assert.doesNotMatch(source, /fetch\(/, 'view must not make direct fetch() calls');
  assert.doesNotMatch(source, /\/api\/receipts/, 'view must not hardcode API URLs');
  assert.match(source, /receiptsApi/, 'view must delegate to receiptsApi');
});

// -----------------------------------------------------------------------
// fiscal-refs-admin.renderers.js
// -----------------------------------------------------------------------

test('fiscal-refs-admin.renderers.js registers views.fiscalRefsAdminRenderers with renderFiscalRefList and renderFiscalRefDetail', () => {
  const { browserWindow } = createViewHarness();
  const renderers = browserWindow.RootShell.require('views.fiscalRefsAdminRenderers');
  assert.ok(typeof renderers.renderFiscalRefList === 'function', 'must expose renderFiscalRefList');
  assert.ok(typeof renderers.renderFiscalRefDetail === 'function', 'must expose renderFiscalRefDetail');
});

test('fiscal-refs renderers renderFiscalRefList returns empty state when no references', () => {
  const { browserWindow } = createViewHarness();
  const renderers = browserWindow.RootShell.require('views.fiscalRefsAdminRenderers');
  const html = renderers.renderFiscalRefList([]);
  assert.match(html, /empty-state/, 'empty refs must render empty-state class');
});

test('fiscal-refs renderers renderFiscalRefList renders a row with data-fiscal-ref-id', () => {
  const { browserWindow } = createViewHarness();
  const renderers = browserWindow.RootShell.require('views.fiscalRefsAdminRenderers');
  // PENDING is the only DB-valid status currently reachable (DEC-003: Hacienda API not implemented)
  const ref = {
    id: 5001n,
    documentType: '01',
    status: 'PENDING',
    createdAt: new Date('2026-09-01'),
    purchaseReceipt: { id: 9001n, supplier: { name: 'Proveedor CR S.A.' } },
  };
  const html = renderers.renderFiscalRefList([ref], null);
  assert.match(html, /data-fiscal-ref-id/, 'list item must include data-fiscal-ref-id attribute');
  assert.match(html, /Proveedor CR S.A./, 'list item must show supplier name from purchaseReceipt');
});

test('fiscal-refs renderers renderFiscalRefList marks selected reference as active', () => {
  const { browserWindow } = createViewHarness();
  const renderers = browserWindow.RootShell.require('views.fiscalRefsAdminRenderers');
  // PENDING is the only DB-valid status currently reachable (DEC-003: Hacienda API not implemented)
  const ref = {
    id: 5001n,
    documentType: '01',
    status: 'PENDING',
    createdAt: new Date(),
    purchaseReceipt: { id: 9001n, supplier: { name: 'S' } },
  };
  const html = renderers.renderFiscalRefList([ref], '5001');
  assert.match(html, /--active/, 'selected ref must have active class modifier');
});

test('fiscal-refs renderers renderFiscalRefDetail returns placeholder when ref is null', () => {
  const { browserWindow } = createViewHarness();
  const renderers = browserWindow.RootShell.require('views.fiscalRefsAdminRenderers');
  const html = renderers.renderFiscalRefDetail(null);
  assert.match(html, /empty-state|Selecciona/, 'null ref must render placeholder');
});

test('fiscal-refs renderers renderFiscalRefDetail includes human label for documentType 01', () => {
  const { browserWindow } = createViewHarness();
  const renderers = browserWindow.RootShell.require('views.fiscalRefsAdminRenderers');
  const ref = {
    id: 5001n,
    documentType: '01',
    status: 'PENDING',
    simplifiedRegime: false,
    externalReference: 'REF-001',
    notes: 'Nota de prueba',
    createdAt: new Date(),
    purchaseReceipt: {
      id: 9001n,
      status: 'CONFIRMED',
      supplier: { name: 'Proveedor CR S.A.' },
    },
  };
  const html = renderers.renderFiscalRefDetail(ref);
  assert.match(html, /Factura electrónica/, 'documentType 01 must show human label');
  assert.match(html, /REF-001/, 'must show externalReference');
  assert.match(html, /Nota de prueba/, 'must show notes');
});

test('fiscal-refs renderers renderFiscalRefDetail uses correct badge classes for all DB-valid FiscalReferenceStatus enum values', () => {
  const { browserWindow } = createViewHarness();
  const renderers = browserWindow.RootShell.require('views.fiscalRefsAdminRenderers');

  // FiscalReferenceStatus enum: PENDING | SUBMITTED | ACCEPTED | REJECTED
  const makeRef = (status) => ({
    id: 5001n, documentType: '01', status, simplifiedRegime: false,
    externalReference: null, notes: null, createdAt: new Date(),
    purchaseReceipt: { id: 9001n, status: 'CONFIRMED', supplier: { name: 'S' } },
  });

  // PENDING and SUBMITTED are in-progress states → badge-warning
  assert.match(renderers.renderFiscalRefDetail(makeRef('PENDING')), /badge-warning/);
  assert.match(renderers.renderFiscalRefDetail(makeRef('SUBMITTED')), /badge-warning/);
  // ACCEPTED is a successful terminal state → badge-success
  assert.match(renderers.renderFiscalRefDetail(makeRef('ACCEPTED')), /badge-success/);
  // REJECTED is a failure terminal state → badge-danger
  assert.match(renderers.renderFiscalRefDetail(makeRef('REJECTED')), /badge-danger/);
});

test('fiscal-refs renderers renderFiscalRefDetail includes hacienda-xml-upload placeholder', () => {
  const { browserWindow } = createViewHarness();
  const renderers = browserWindow.RootShell.require('views.fiscalRefsAdminRenderers');
  const ref = {
    id: 5001n, documentType: '01', status: 'PENDING', simplifiedRegime: false,
    externalReference: null, notes: null, createdAt: new Date(),
    purchaseReceipt: { id: 9001n, status: 'CONFIRMED', supplier: { name: 'S' } },
  };
  const html = renderers.renderFiscalRefDetail(ref);
  assert.match(html, /hacienda-xml-upload/, 'detail must include hacienda-xml-upload placeholder');
  assert.match(html, /Próximamente/, 'placeholder must say Próximamente');
});

// -----------------------------------------------------------------------
// fiscal-refs-admin.js
// -----------------------------------------------------------------------

test('fiscal-refs-admin.js registers views.fiscalRefsAdmin with render and mount', () => {
  const source = readRootFile('views/fiscal-refs-admin.js');
  assert.match(source, /views\.fiscalRefsAdmin/, 'must register views.fiscalRefsAdmin');
  assert.match(source, /render/, 'must expose render function');
  assert.match(source, /mount/, 'must expose mount function');
});

test('fiscal-refs-admin render produces hero section with compras eyebrow and two-column commercial layout', () => {
  const { browserWindow, context } = createBrowserContext();
  executeRootScript('registry.js', context);
  executeRootScript('ui.js', context);
  executeRootScript('receipts-api.js', context);
  executeRootScript('views/receipts-admin.renderers.js', context);
  executeRootScript('views/fiscal-refs-admin.renderers.js', context);
  executeRootScript('views/fiscal-refs-admin.js', context);

  const view = browserWindow.RootShell.require('views.fiscalRefsAdmin');
  const html = view.render();

  assert.match(html, /root-hero/, 'must include root-hero section');
  assert.match(html, /Compras/, 'eyebrow must say Compras');
  assert.match(html, /[Ff]iscal|[Rr]eferencias/, 'h2 must mention fiscal or referencias');
  assert.match(html, /commercial-layout/, 'must use commercial two-column layout');
  assert.match(html, /fiscal-refs-sidebar/, 'must include fiscal-refs-sidebar element');
  assert.match(html, /fiscal-refs-detail-panel/, 'must include fiscal-refs-detail-panel element');
});

test('fiscal-refs-admin.js does not contain inline business rules or direct HTTP calls', () => {
  const source = readRootFile('views/fiscal-refs-admin.js');
  assert.doesNotMatch(source, /fetch\(/, 'view must not make direct fetch() calls');
  assert.doesNotMatch(source, /\/api\/fiscal-references/, 'view must not hardcode API URLs');
  assert.match(source, /receiptsApi/, 'view must delegate to receiptsApi');
});

// -----------------------------------------------------------------------
// purchase-orders-api.js characterization (existing, ensure still valid)
// -----------------------------------------------------------------------

test('purchase-orders-api.js calls /api/procurement/orders endpoint', async () => {
  const calls = [];
  const { browserWindow, context } = createBrowserContext(async (_session, url, options = {}) => {
    calls.push({ url, options });
    return [];
  });
  executeRootScript('registry.js', context);
  executeRootScript('purchase-orders-api.js', context);

  const purchaseOrdersApi = browserWindow.RootShell.require('purchaseOrdersApi');
  await purchaseOrdersApi.listOrders({});
  assert.equal(calls[0].url, '/api/procurement/orders');
});
