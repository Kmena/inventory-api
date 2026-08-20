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
  const context = vm.createContext({ window: browserWindow, Map, Set, URLSearchParams });
  browserWindow.window = browserWindow;
  executeRootScript('registry.js', context);
  executeRootScript('ui.js', context);
  executeRootScript('views/quotations-admin.helpers.js', context);
  executeRootScript('views/quotations-admin.renderers.js', context);
  return browserWindow.RootShell;
}

function createViewHarness() {
  const browserWindow = {
    confirm: () => true,
  };
  const context = vm.createContext({
    Map,
    Set,
    URLSearchParams,
    window: browserWindow,
    confirm: () => true,
  });
  browserWindow.window = browserWindow;

  executeRootScript('registry.js', context);
  executeRootScript('ui.js', context);
  executeRootScript('views/quotations-admin.helpers.js', context);
  executeRootScript('views/quotations-admin.renderers.js', context);
  executeRootScript('views/quotations-comparison.renderers.js', context);

  browserWindow.RootShell.register('quotationsApi', {
    listQuotableProducts: async () => [],
    getProductSuppliersPricing: async () => ({ suppliers: [] }),
    requestGroupedQuotations: async () => ({}),
    getRfqTrackingSummary: async () => [],
    getComparisonData: async () => ({ quotations: [] }),
  });
  browserWindow.RootShell.register('sessionAdapter', {
    hasPermission(session, permission) {
      return Boolean(session?.user?.permissions?.includes(permission));
    },
  });

  executeRootScript('views/quotations-comparison.js', context);
  executeRootScript('views/quotations-admin.js', context);
  return browserWindow.RootShell;
}

test('quotations helpers filter products by name or sku and preserve shortage-first ordering', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.quotationsAdminHelpers');

  const products = [
    { id: 1, name: 'Bicarbonato', sku: 'MAT-002', shortage: 2, quantity: 5 },
    { id: 2, name: 'Ácido cítrico', sku: 'MAT-001', shortage: 8, quantity: 2 },
    { id: 3, name: 'Alcohol', sku: 'ALC-003', shortage: 8, quantity: 1 },
  ];

  const ordered = helpers.sortQuotableProducts(products);
  assert.equal(JSON.stringify(ordered.map((product) => product.id)), JSON.stringify([3, 2, 1]));

  const filtered = helpers.filterQuotableProducts(products, 'mat-00');
  assert.equal(JSON.stringify(filtered.map((product) => product.id)), JSON.stringify([2, 1]));
});

test('quotations helpers build metrics, summaries and grouped payload from ready selections', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.quotationsAdminHelpers');

  const products = [
    { id: 11, name: 'Ácido cítrico', shortage: 8 },
    { id: 12, name: 'Bicarbonato', shortage: 0 },
  ];
  const selectionByProductId = new Map([
    ['11', { productId: 11, quantity: 5, notes: 'Urgente', selectedSuppliers: [{ supplierId: 301, unitPrice: 12.5, currency: 'CRC', leadTimeDays: 2, availabilityNotes: null, notes: null }] }],
  ]);

  const metrics = helpers.buildQuotationsMetrics(products, selectionByProductId);
  assert.equal(metrics.total, 2);
  assert.equal(metrics.withShortage, 1);
  assert.equal(metrics.selectedProducts, 1);

  const summary = helpers.buildSelectionSummary(products, selectionByProductId);
  assert.equal(summary.length, 1);
  assert.equal(summary[0].productId, 11);

  const payload = helpers.buildGroupedQuotationPayload(products, selectionByProductId);
  assert.equal(payload.products.length, 1);
  assert.equal(payload.products[0].productId, 11);
  assert.equal(payload.products[0].suppliers.length, 1);
});

test('quotations renderers render products table, detail table and selection summary', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.quotationsAdminRenderers');

  const selectionByProductId = new Map([
    ['11', { productId: 11, quantity: 5, selectedSuppliers: [{ supplierId: 301 }] }],
  ]);
  const tableHtml = renderers.renderProductsTable([
    { id: 11, name: 'Ácido cítrico', sku: 'MAT-001', shortage: 8, quantity: 2, supplierCount: 2 },
  ], selectionByProductId);
  assert.match(tableHtml, /Ver proveedores/);
  assert.match(tableHtml, /MAT-001/);
  assert.match(tableHtml, /Listo/);

  const detailHtml = renderers.renderProductPricingDetail({
    productName: 'Ácido cítrico',
    sku: 'MAT-001',
    shortage: 8,
    quantity: 2,
    suppliers: [
      { supplierId: 301, supplierName: 'Proveedor Uno', unitPrice: 12.5, currency: 'CRC', leadTimeDays: 2, minimumOrderQuantity: 3, isPreferred: true },
    ],
  }, {
    quantity: 5,
    notes: 'Urgente',
    selectedSuppliers: [{ supplierId: 301 }],
  });
  assert.match(detailHtml, /Cantidad a cotizar/);
  assert.match(detailHtml, /Proveedor Uno/);
  assert.match(detailHtml, /CRC/);

  const summaryHtml = renderers.renderSelectionSummary([
    { productId: 11, productName: 'Ácido cítrico', supplierCount: 2, quantity: 5 },
  ]);
  assert.match(summaryHtml, /Ácido cítrico/);
  assert.match(summaryHtml, /2 proveedor/);
});

test('quotations view render exposes the dedicated quotations workspace and dialogs', () => {
  const rootShell = createViewHarness();
  const view = rootShell.require('views.quotationsAdmin');
  const markup = view.render();

  assert.match(markup, /<h2 id="root-view-title">Cotizaciones<\/h2>/);
  assert.match(markup, /quotations-metrics/);
  assert.match(markup, /quotations-search-input/);
  assert.match(markup, /quotations-selection-summary/);
  assert.match(markup, /quotations-list-region/);
  assert.match(markup, /quotations-detail-dialog/);
  assert.match(markup, /quotations-confirm-dialog/);
  assert.match(markup, /Solicitud activa/);
  assert.match(markup, /Respuestas recibidas/);
  assert.match(markup, /Solicitudes abiertas/);
  assert.match(markup, /rfq-response-details-dialog/);
  assert.match(markup, /Generar cotizaciones/);
  assert.doesNotMatch(markup, /Modulo en progreso/);
});

test('quotations renderers expose active request and response detail sections for workspace consultation', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.quotationsAdminRenderers');

  const activeHtml = renderers.renderActiveRequestSummary({
    purchaseRequestId: 77,
    title: 'Cotización semanal',
    status: 'OPEN',
    createdAt: '2026-08-13T00:00:00.000Z',
    itemCount: 2,
    hasInvitations: true,
    invitations: [{ id: 1 }, { id: 2 }],
    respondedInvitationCount: 1,
    manualResponseCount: 1,
    publicResponseCount: 0,
  });
  const responseSummaryHtml = renderers.renderResponseSummary({
    supplierResponseCount: 1,
    quotedProductCount: 2,
    manualResponseCount: 1,
    publicResponseCount: 0,
    responseGroups: [{ supplierName: 'Proveedor Uno' }],
  });
  const responseDetailsHtml = renderers.renderResponseDetails([{
    supplierName: 'Proveedor Uno',
    supplierEmail: 'uno@example.com',
    responseSource: 'MANUAL_OFFICE_EMAIL',
    currency: 'CRC',
    submittedAt: '2026-08-14T00:00:00.000Z',
    notes: 'Incluye transporte',
    totalAmount: 12500,
    items: [{ productName: 'Ácido cítrico', quantity: 5, unitPrice: 2500, leadTimeDays: 2, notes: 'Entrega parcial' }],
  }]);

  assert.match(activeHtml, /Sin salir del workspace|sin salir del workspace/i);
  assert.match(activeHtml, /Invitaciones: 2/);
  assert.match(responseSummaryHtml, /Productos cotizados: 2/);
  assert.match(responseDetailsHtml, /MANUAL_OFFICE_EMAIL/);
  assert.match(responseDetailsHtml, /Ácido cítrico/);
});

test('quotations helpers exclude initial quotations (responseSource null) from response detail groups', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.quotationsAdminHelpers');

  // Both quotations have status SUBMITTED (DB default), but only the one
  // with a responseSource came from an actual supplier RFQ response.
  const activeRequestWithMixedQuotations = {
    purchaseRequestId: 50,
    quotations: [
      { id: 100, status: 'SUBMITTED', responseSource: null, supplierId: 10, supplierName: 'Proveedor Inicial', currency: 'CRC', items: [{ productId: 1, productName: 'Harina', quantity: 5, unitPrice: 900, leadTimeDays: 7, notes: null }] },
      { id: 101, status: 'SUBMITTED', responseSource: 'PUBLIC_TOKEN', supplierId: 11, supplierName: 'Proveedor Respondido', currency: 'CRC', submittedAt: '2026-08-14T10:00:00.000Z', items: [{ productId: 1, productName: 'Harina', quantity: 5, unitPrice: 950, leadTimeDays: 2, notes: null }] },
    ],
    invitations: [],
    respondedInvitationCount: 1,
    manualResponseCount: 0,
    publicResponseCount: 1,
  };

  const groups = helpers.buildResponseDetailGroups(activeRequestWithMixedQuotations);
  const summary = helpers.buildActiveRequestResponseSummary(activeRequestWithMixedQuotations);

  assert.equal(groups.length, 1, 'only quotations with responseSource should appear in response groups');
  assert.equal(groups[0].supplierName, 'Proveedor Respondido');
  assert.equal(summary.supplierResponseCount, 1);
  assert.equal(summary.quotedProductCount, 1);
});

test('quotations helpers return empty response groups when all quotations have no responseSource so Ver respuestas button stays hidden', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.quotationsAdminHelpers');

  // Initial grouped-quotation creation produces SUBMITTED records with responseSource = null.
  const activeRequestAllInitial = {
    purchaseRequestId: 51,
    quotations: [
      { id: 200, status: 'SUBMITTED', responseSource: null, supplierId: 20, supplierName: 'Proveedor A', currency: 'CRC', items: [] },
      { id: 201, status: 'SUBMITTED', responseSource: null, supplierId: 21, supplierName: 'Proveedor B', currency: 'CRC', items: [] },
    ],
    invitations: [],
    respondedInvitationCount: 0,
    manualResponseCount: 0,
    publicResponseCount: 0,
  };

  const groups = helpers.buildResponseDetailGroups(activeRequestAllInitial);
  const summary = helpers.buildActiveRequestResponseSummary(activeRequestAllInitial);

  assert.equal(groups.length, 0, 'initial quotations without responseSource must not appear as response groups');
  assert.equal(summary.supplierResponseCount, 0);
  assert.equal(summary.responseGroups.length, 0);
});

test('quotations grouped generation reads purchaseRequest.id from the backend response to continue the RFQ flow', () => {
  const source = fs.readFileSync(path.join(rootPublicPath, 'views', 'quotations-admin.js'), 'utf8');

  assert.match(source, /response\?\.purchaseRequest\?\.id/);
  assert.match(source, /response\?\.purchaseRequest\?\.items \|\| response\?\.items \|\| \[\]/);
});

test('quotations grouped generation preserves selected supplier ids for the RFQ continuation step', () => {
  const source = fs.readFileSync(path.join(rootPublicPath, 'views', 'quotations-admin.js'), 'utf8');

  assert.match(source, /let currentRfqSupplierIds = \[\]/);
  assert.match(source, /function showRfqSection\(purchaseRequestId, items, supplierIds = \[\]\)/);
  assert.match(source, /currentRfqSupplierIds = Array\.isArray\(supplierIds\)/);
  assert.match(source, /payload\.products\.flatMap\(\(product\) => \(product\.suppliers \|\| \[\]\)\.map\(\(supplier\) => supplier\.supplierId\)\)\.filter\(Boolean\)/);
  assert.match(source, /showRfqSection\(purchaseRequestId, response\?\.purchaseRequest\?\.items \|\| response\?\.items \|\| \[\], supplierIds\)/);
  assert.match(source, /const supplierIds = currentRfqSupplierIds\.length/);
});

test('comparison section and dialogs are injected into DOM by mountComparisonSection', async () => {
  const comparisonSource = fs.readFileSync(
    path.join(rootPublicPath, 'views', 'quotations-comparison.js'),
    'utf8',
  );

  assert.match(comparisonSource, /id="quotations-comparison-section"/, 'comparison section id must be present');
  assert.match(comparisonSource, /id="quotations-select-confirm-dialog"/, 'select confirm dialog id must be present');
  assert.match(comparisonSource, /id="quotations-create-po-dialog"/, 'create PO dialog id must be present');
  assert.match(comparisonSource, /id="quotations-select-justification"/, 'justification textarea must be present');
  assert.match(comparisonSource, /id="quotations-create-po-notes"/, 'notes textarea must be present');
  assert.match(comparisonSource, /maxlength="2000"/, 'maxlength 2000 must be enforced on textareas');
  assert.match(comparisonSource, /getComparisonData/, 'comparison data API call must be present');
  assert.match(comparisonSource, /selectQuotation/, 'selectQuotation API call must be present');
  assert.match(comparisonSource, /approveSelection/, 'approveSelection API call must be present');
  assert.match(comparisonSource, /createPurchaseOrder/, 'createPurchaseOrder API call must be present');
  assert.match(comparisonSource, /approvalRequired/, 'approval required branching must be present');
  assert.match(comparisonSource, /renderApprovalBanner/, 'approval banner renderer must be present');
  assert.match(comparisonSource, /procurement\.approve/, 'procurement.approve permission check must be present');
});

test('comparison renderers produce scannable comparison table and PO summary', () => {
  const _rootShell = createHarness();
  const rootShellWithComparison = createViewHarness();
  const renderers = rootShellWithComparison.require('views.quotationsComparisonRenderers');

  const quotations = [
    { id: 1, supplier: { name: 'Proveedor A' }, reference: 'QUOT-001', currency: 'CRC', totalAmount: 120000, averageLeadTimeDays: 7, source: 'Manual' },
    { id: 2, supplier: { name: 'Proveedor B' }, reference: 'QUOT-002', currency: 'USD', totalAmount: 245, averageLeadTimeDays: 12, source: 'Portal' },
  ];

  const tableHtml = renderers.renderComparisonTable(quotations);
  assert.match(tableHtml, /Proveedor A/, 'table must include supplier A');
  assert.match(tableHtml, /Proveedor B/, 'table must include supplier B');
  assert.match(tableHtml, /QUOT-001/, 'table must include reference');
  assert.match(tableHtml, /Seleccionar este proveedor/, 'table must include action button');
  assert.match(tableHtml, /data-quotation-id/, 'button must carry quotation id data attribute');
  assert.doesNotMatch(tableHtml, /Origen/, 'Origen column is not rendered — responseSource is not in comparison serializer');
  assert.match(tableHtml, /7 días/, 'lead time must be rendered');

  const selection = {
    currency: 'CRC',
    totalAmount: 120000,
    quotation: {
      supplier: { name: 'Proveedor A' },
      items: [
        { product: { name: 'Ácido cítrico' }, quantity: 10, unitPrice: 12000 },
      ],
    },
  };
  const summaryHtml = renderers.renderCreatePoSummary(selection, selection.quotation.items);
  assert.match(summaryHtml, /Proveedor A/, 'PO summary must include supplier name');
  assert.match(summaryHtml, /Ácido cítrico/, 'PO summary must include product name');
  assert.match(summaryHtml, /10/, 'PO summary must include quantity');
});

test('quotations-admin mounts comparison section extension point after RFQ tracking load', () => {
  const source = fs.readFileSync(path.join(rootPublicPath, 'views', 'quotations-admin.js'), 'utf8');

  assert.match(source, /views\.quotationsComparison/, 'quotations-admin must require comparison module');
  assert.match(source, /comparison\.mountComparisonSection/, 'quotations-admin must call mountComparisonSection');
  assert.match(source, /requestWithResponses/, 'quotations-admin must find first request with responses');
  assert.match(source, /respondedInvitationCount/, 'quotations-admin must check respondedInvitationCount');
});

test('quotations-api exposes comparison and selection endpoints', () => {
  const source = fs.readFileSync(path.join(rootPublicPath, 'quotations-api.js'), 'utf8');

  assert.match(source, /getComparisonData/, 'quotations-api must expose getComparisonData');
  assert.match(source, /selectQuotation/, 'quotations-api must expose selectQuotation');
  assert.match(source, /approveSelection/, 'quotations-api must expose approveSelection');
  assert.match(source, /createPurchaseOrder/, 'quotations-api must expose createPurchaseOrder');
  assert.match(source, /listPurchaseRequests/, 'quotations-api must expose listPurchaseRequests');
  assert.match(source, /\/api\/procurement\/requests\/\$\{purchaseRequestId\}\/comparison/, 'comparison endpoint must be correct');
  assert.match(source, /\/api\/procurement\/requests\/\$\{purchaseRequestId\}\/select-quotation/, 'select endpoint must be correct');
  assert.match(source, /\/api\/procurement\/selections\/\$\{selectionId\}\/approve/, 'approve endpoint must be correct');
});
