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

test('quotationsApi calls approved procurement quotation workspace endpoints with expected methods and fallback messages', async () => {
  const calls = [];
  const { browserWindow, context } = createBrowserContext(async (session, url, options = {}) => {
    calls.push({ session, url, options });
    return { ok: true };
  });

  executeRootScript('registry.js', context);
  executeRootScript('quotations-api.js', context);

  const quotationsApi = browserWindow.RootShell.require('quotationsApi');
  const session = { user: { id: 12 } };

  await quotationsApi.listQuotableProducts(session);
  await quotationsApi.getProductSuppliersPricing(session, 25);
  await quotationsApi.requestGroupedQuotations(session, {
    products: [
      { productId: 25, quantity: 5, suppliers: [{ supplierId: 3001, unitPrice: 12.5 }] },
    ],
  });
  await quotationsApi.getRfqTrackingSummary(session);

  assert.equal(calls.length, 4);
  assert.equal(calls[0].url, '/api/procurement/quotable-products');
  assert.equal(calls[0].options.fallbackMessage, 'No se pudieron cargar los productos cotizables.');

  assert.equal(calls[1].url, '/api/procurement/products/25/suppliers-pricing');
  assert.equal(calls[1].options.fallbackMessage, 'No se pudo cargar el detalle de proveedores del producto.');

  assert.equal(calls[2].url, '/api/procurement/products/25/request-quotations');
  assert.equal(calls[2].options.method, 'POST');
  assert.equal(calls[2].options.body, JSON.stringify({
    products: [
      { productId: 25, quantity: 5, suppliers: [{ supplierId: 3001, unitPrice: 12.5 }] },
    ],
  }));
  assert.equal(calls[2].options.fallbackMessage, 'No se pudo generar la solicitud de cotización agrupada.');

  assert.equal(calls[3].url, '/api/procurement/rfq-tracking');
  assert.equal(calls[3].options.fallbackMessage, 'No se pudo cargar el resumen de seguimiento RFQ.');
});

test('quotationsApi rejects grouped quotation requests without selected products', async () => {
  const { browserWindow, context } = createBrowserContext();
  executeRootScript('registry.js', context);
  executeRootScript('quotations-api.js', context);

  const quotationsApi = browserWindow.RootShell.require('quotationsApi');
  await assert.rejects(
    () => quotationsApi.requestGroupedQuotations({}, { products: [] }),
    /Debes seleccionar al menos un producto/,
  );
});

test('quotationsApi exposes approveSelection and createPurchaseOrder with expected endpoint shape', async () => {
  const calls = [];
  const { browserWindow, context } = createBrowserContext(async (session, url, options = {}) => {
    calls.push({ session, url, options });
    return { id: 1, status: 'APPROVED' };
  });

  executeRootScript('registry.js', context);
  executeRootScript('quotations-api.js', context);

  const quotationsApi = browserWindow.RootShell.require('quotationsApi');
  const session = { user: { id: 12 } };

  await quotationsApi.approveSelection(session, 4001, { justification: 'Aprobado' });
  await quotationsApi.createPurchaseOrder(session, 1001, { selectionId: 4001, notes: 'Urgente' });

  assert.equal(calls.length, 2);

  assert.equal(calls[0].url, '/api/procurement/selections/4001/approve');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.body, JSON.stringify({ justification: 'Aprobado' }));

  assert.equal(calls[1].url, '/api/procurement/requests/1001/purchase-orders');
  assert.equal(calls[1].options.method, 'POST');
  assert.equal(calls[1].options.body, JSON.stringify({ selectionId: 4001, notes: 'Urgente' }));
});

test('quotationsApi exposes getComparisonData and selectQuotation with expected endpoint shape', async () => {
  const calls = [];
  const { browserWindow, context } = createBrowserContext(async (session, url, options = {}) => {
    calls.push({ session, url, options });
    return { quotations: [] };
  });

  executeRootScript('registry.js', context);
  executeRootScript('quotations-api.js', context);

  const quotationsApi = browserWindow.RootShell.require('quotationsApi');
  const session = { user: { id: 12 } };

  await quotationsApi.getComparisonData(session, 1001);
  await quotationsApi.selectQuotation(session, 1001, { quotationId: 2001, justification: null });

  assert.equal(calls.length, 2);

  assert.equal(calls[0].url, '/api/procurement/requests/1001/comparison');

  assert.equal(calls[1].url, '/api/procurement/requests/1001/select-quotation');
  assert.equal(calls[1].options.method, 'POST');
  assert.equal(calls[1].options.body, JSON.stringify({ quotationId: 2001, justification: null }));
});

test('quotationsApi exposes createDirectQuotation and listSuppliers with expected endpoint shape', async () => {
  const calls = [];
  const { browserWindow, context } = createBrowserContext(async (session, url, options = {}) => {
    calls.push({ session, url, options });
    return { id: 99 };
  });

  executeRootScript('registry.js', context);
  executeRootScript('quotations-api.js', context);

  const quotationsApi = browserWindow.RootShell.require('quotationsApi');
  const session = { user: { id: 12 } };

  const directPayload = {
    supplierId: 5,
    currency: 'CRC',
    reference: 'COT-001',
    notes: 'Precio valido 30 dias',
    items: [{ productId: 11, quantity: 10, unitPrice: 1500, leadTimeDays: 3 }],
  };

  await quotationsApi.createDirectQuotation(session, 1001, directPayload);
  await quotationsApi.listSuppliers(session);

  assert.equal(calls.length, 2);

  assert.equal(calls[0].url, '/api/procurement/requests/1001/quotations');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.body, JSON.stringify(directPayload));
  assert.ok(calls[0].options.fallbackMessage, 'createDirectQuotation debe tener fallbackMessage');

  assert.equal(calls[1].url, '/api/suppliers/company');
  assert.equal(calls[1].options?.method, undefined, 'listSuppliers es GET (sin method explicito)');
  assert.ok(calls[1].options.fallbackMessage, 'listSuppliers debe tener fallbackMessage');
});
