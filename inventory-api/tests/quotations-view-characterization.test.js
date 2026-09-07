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
  // Sidebar layout: heading is now just "Solicitudes" inside the aside
  assert.match(markup, /rfq-tracking-section/);
  assert.match(markup, /rfq-section/);
  assert.match(markup, /rfq-response-details-dialog/);
  // Create panel and empty state are new split-view panels
  assert.match(markup, /quotations-create-panel/);
  assert.match(markup, /quotations-empty-state/);
  assert.match(markup, /quotations-request-detail/);
  assert.match(markup, /quotations-comparison-inline/);
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

  // responseSource drives which section a row appears in.
  // Rows with a responseSource → "Respuestas recibidas" (selectable).
  // Rows without → "Precio histórico de catálogo" (read-only reference).
  const quotations = [
    { id: 1, supplier: { name: 'Proveedor A' }, reference: 'QUOT-001', currency: 'CRC', totalAmount: 120000, averageLeadTimeDays: 7, responseSource: 'DIRECT_ENTRY', items: [] },
    { id: 2, supplier: { name: 'Proveedor B' }, reference: 'QUOT-002', currency: 'USD', totalAmount: 245, averageLeadTimeDays: 12, responseSource: null, items: [] },
  ];

  const tableHtml = renderers.renderComparisonTable(quotations);
  assert.match(tableHtml, /Proveedor A/, 'table must include supplier A');
  assert.match(tableHtml, /Proveedor B/, 'table must include supplier B in catalog section');
  assert.match(tableHtml, /QUOT-001/, 'table must include reference');
  assert.match(tableHtml, /Seleccionar este proveedor/, 'responded row must have action button');
  assert.match(tableHtml, /data-quotation-id/, 'button must carry quotation id data attribute');
  assert.match(tableHtml, /Registr/, 'catalog row must show prompt instead of select button');
  assert.match(tableHtml, /Respuestas recibidas/, 'table must have responded section heading');
  assert.match(tableHtml, /7 d/, 'lead time must be rendered');

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
  // Comparison is now mounted inline and refreshed on-demand when a request is selected
  assert.match(source, /quotations-comparison-inline/, 'comparison must mount into the inline detail panel');
  assert.match(source, /comparison\.refreshForRequest/, 'comparison must be refreshed when a request is selected');
  // respondedInvitationCount tracking lives in helpers/renderers, not in the admin orchestrator
  assert.match(source, /loadRfqTracking/, 'admin must load tracking list');
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

// ------------------------------------------------------------------
// TASK-002 (FR-003-FR-007): Persistent PO creation success state
// ------------------------------------------------------------------
test('comparison section renders persistent success state after PO creation instead of hiding section (FR-003-FR-007)', () => {
  const source = fs.readFileSync(path.join(rootPublicPath, 'views', 'quotations-comparison.js'), 'utf8');

  // FR-003: Success state persisted in UI
  assert.match(source, /renderCreatedPoSuccessState/, 'must call renderCreatedPoSuccessState after PO creation');
  // FR-004: PO identifiers visible (e.g. OC #)
  assert.match(source, /OC #/, 'success state must show PO identifiers');
  // FR-005: Actionable next steps (issue, view)
  assert.match(source, /data-action="issue"/, 'success state must have issue action');
  assert.match(source, /data-action="view"/, 'success state must have view action');
  // FR-006: Back to requests navigation
  assert.match(source, /data-action="back-to-requests"/, 'success state must have back-to-requests action');
  // FR-007: Permission-gated issue action
  assert.match(source, /procurement\.manage/, 'issue action must be permission-gated');
});

// ------------------------------------------------------------------
// TASK-003 (FR-008-FR-009): Mixed approval pending selections
// ------------------------------------------------------------------
test('comparison section renders all pending selections in approval banner (FR-008-FR-009)', () => {
  const source = fs.readFileSync(path.join(rootPublicPath, 'views', 'quotations-comparison.js'), 'utf8');

  // FR-008: Multiple selections listed
  assert.match(source, /pendingSelections/, 'approval banner must track pending selections');
  assert.match(source, /approve-individual-btn/, 'individual approve buttons must exist');
  // FR-009: Approve-all button
  assert.match(source, /approve-all-selections-button/, 'approve-all button must exist');
  assert.match(source, /submitApproveAllSelections/, 'approve-all handler must exist');
});

// ------------------------------------------------------------------
// TASK-004 (FR-010-FR-012): Comparison matrix context improvements
// ------------------------------------------------------------------
test('comparison renderers show subtotal and currency in matrix cells (FR-010-FR-012)', () => {
  const rendererSource = fs.readFileSync(
    path.join(rootPublicPath, 'views', 'quotations-comparison.renderers.js'),
    'utf8',
  );

  // FR-010: Subtotal per cell
  assert.match(rendererSource, /subtotalLabel/, 'matrix cells must compute subtotal');
  assert.match(rendererSource, /unitPrice.*\*.*quantity|quantity.*\*.*unitPrice/, 'subtotal must multiply price × quantity');
  // FR-011: Currency label
  assert.match(rendererSource, /currencyLabel/, 'matrix cells must display currency label');
  // FR-012: Notes/availability tooltip
  assert.match(rendererSource, /notesText/, 'matrix cells must handle item notes');
  assert.match(rendererSource, /availabilityNotes/, 'matrix cells must handle availability notes');
});

// ------------------------------------------------------------------
// TASK-012 (FR-030): Direct quotation — supplier eligibility filter
// ------------------------------------------------------------------
test('quotations renderers renderDirectQuotationForm renders all request items as rows (renderer contract)', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.quotationsAdminRenderers');

  const suppliers = [
    { id: 10, name: 'Proveedor Alpha' },
    { id: 20, name: 'Proveedor Beta' },
  ];
  const requestItems = [
    { productId: 100, quantity: 5, product: { name: 'Harina', unit: 'kg' } },
    { productId: 200, quantity: 3, product: { name: 'Azúcar', unit: 'kg' } },
  ];

  const html = renderers.renderDirectQuotationForm(suppliers, requestItems);

  assert.match(html, /direct-q-supplier/);
  assert.match(html, /Proveedor Alpha/);
  assert.match(html, /Proveedor Beta/);
  assert.match(html, /direct-q-items-body/);
  assert.match(html, /data-product-id="100"/);
  assert.match(html, /data-product-id="200"/);
  assert.match(html, /Harina/);
  assert.match(html, /Azúcar/);
});

test('quotations-admin source applies supplier eligibility filter to direct quotation items table', () => {
  const source = fs.readFileSync(path.join(rootPublicPath, 'views', 'quotations-admin.js'), 'utf8');

  assert.match(source, /applyDirectQuotationEligibilityFilter/, 'controller must define eligibility filter function');
  assert.match(source, /cachedQuotableProducts/, 'controller must cache quotable products for supplier-product eligibility');
  assert.match(source, /listQuotableProducts/, 'controller must load quotable products lazily for eligibility data');
  assert.match(source, /eligibleProductIds/, 'controller must compute eligible product ids set');
  assert.match(source, /row\.hidden/, 'controller must hide ineligible rows in the DOM');
  assert.match(source, /supplierSelect.*addEventListener.*change|addEventListener.*change.*supplierSelect/, 'controller must wire supplier change event to eligibility filter');
});

test('quotations-admin getEligibleProductIdsForSupplier falls back to all products when cachedQuotableProducts is unavailable', () => {
  const source = fs.readFileSync(path.join(rootPublicPath, 'views', 'quotations-admin.js'), 'utf8');

  // When cachedQuotableProducts is null/empty, all request items must be shown (graceful degradation)
  assert.match(source, /getEligibleProductIdsForSupplier/, 'helper function must exist');
  assert.match(source, /degrade gracefully|fall.*back|Falls back|Degrade/i, 'source must document graceful degradation');
});
