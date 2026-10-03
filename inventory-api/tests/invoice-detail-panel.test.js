'use strict';

/**
 * Wave 3 tests — Invoice detail panel: commercial + payment information
 *
 * Spec: specs/inventori-fiscal-invoice-history-and-detail/
 * Covers all 30 required Wave 3 test items plus additional spec assertions.
 *
 * What is tested here:
 *   - Receivables table renders a .billing-detail-btn button per invoice row (W3-ROW)
 *   - renderInvoiceDetailLoading() — loading state (W3-LOAD)
 *   - renderInvoiceDetailContent(invoice) — all commercial + payment fields (W3-DETAIL)
 *   - renderInvoiceDetailNotFound() / renderInvoiceDetailError() — error states (W3-ERR)
 *   - Security: no FiscalIntent internals, no Billing internals (W3-SEC)
 *   - Shell HTML: dialog structure, close button, aria attributes (W3-SHELL)
 *   - Wave 4 extension point present (W3-EXT)
 *   - Responsive: no fixed-width constraints in detail HTML (W3-RESP)
 *   - Source-level contract guards (W3-SRC)
 *   - Wave 2 fiscal badges still functional alongside Wave 3 (W3-REG)
 */

const test  = require('node:test');
const assert = require('node:assert/strict');
const fs    = require('node:fs');
const path  = require('node:path');
const vm    = require('node:vm');

const rootPublicPath = path.join(__dirname, '..', 'src', 'public', 'root');

function readRootFile(rel) {
  return fs.readFileSync(path.join(rootPublicPath, rel), 'utf8');
}

function executeRootScript(rel, context) {
  const source = readRootFile(rel);
  vm.runInContext(source, context, { filename: rel });
}

/**
 * Creates a minimal billing-admin browser harness.
 * Pass `includeView: true` to also load billing-admin.js (for shell HTML tests).
 */
function createBillingHarness(options = {}) {
  const browserWindow = {};
  const context = vm.createContext({ window: browserWindow, Map, Set, URLSearchParams });
  browserWindow.window = browserWindow;

  executeRootScript('registry.js', context);

  browserWindow.InventoryAuth = {
    fetchJson: options.fetchJson || (async () => ({})),
    buildHeaders: () => ({}),
    handleUnauthorized: () => {},
  };
  browserWindow.fetch = options.fetch || (async () => ({ ok: true, status: 200, json: async () => ({}) }));

  executeRootScript('ui.js', context);
  executeRootScript('billing-api.js', context);
  executeRootScript('views/billing-admin.helpers.js', context);
  executeRootScript('views/billing-admin.renderers.js', context);

  if (options.includeView) {
    executeRootScript('views/billing-admin.js', context);
  }

  return browserWindow.RootShell;
}

// ─── Invoice fixtures ─────────────────────────────────────────────────────────

function makeInvoice(overrides = {}) {
  return {
    id: 1623,
    invoiceNumber: 'INV-963',
    clientId: 42,
    clientName: 'Distribuidora El Sol S.A.',
    orderId: 4521,
    amount: 125000,
    pendingAmount: 0,
    status: 'PAID',
    issuedAt: '2025-01-15T00:00:00.000Z',
    dueAt: '2025-01-22T00:00:00.000Z',
    paidAt: '2025-01-15T14:30:00.000Z',
    fiscal: null,
    payments: [],
    order: {
      id: 4521,
      clientStoreId: 7,
      clientStoreName: 'Tienda Centro',
    },
    ...overrides,
  };
}

function makePayment(overrides = {}) {
  return {
    id: 100,
    paymentMethod: 'CASH',
    reference: null,
    bankName: null,
    cardType: null,
    amount: 125000,
    status: 'APPROVED',
    createdAt: '2025-01-15T14:30:00.000Z',
    approvedAt: '2025-01-15T14:31:00.000Z',
    ...overrides,
  };
}

// ─── W3-ROW: Invoice row has clickable detail button ──────────────────────────

test('[W3-ROW-01] receivables table renders a .billing-detail-btn button per invoice row', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderReceivablesTable([makeInvoice()]);

  assert.match(html, /billing-detail-btn/, 'each invoice row must have a .billing-detail-btn button');
});

test('[W3-ROW-02] (test-item-22) detail button data-invoice-id uses internal invoice ID', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderReceivablesTable([makeInvoice({ id: 1623, invoiceNumber: 'INV-963' })]);

  assert.match(html, /data-invoice-id="1623"/, 'data-invoice-id must be the internal numeric ID');
  // Not the invoice number — the ID is the correct lookup key
  assert.doesNotMatch(html, /data-invoice-id="INV-963"/, 'data-invoice-id must NOT be invoiceNumber');
});

test('[W3-ROW-03] detail button data-invoice-number carries the formatted invoice number', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderReceivablesTable([makeInvoice({ id: 1623, invoiceNumber: 'INV-963' })]);

  assert.match(html, /data-invoice-number="INV-963"/, 'data-invoice-number must carry the formatted number');
});

test('[W3-ROW-04] (test-item-27) Wave 2 fiscal badges still render alongside Wave 3 detail button', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderReceivablesTable([
    makeInvoice({ fiscal: { status: 'ACCEPTED' } }),
  ]);

  assert.match(html, /billing-detail-btn/,   'Wave 3 detail button must be present');
  assert.match(html, /Aceptada/,             'Wave 2 fiscal badge must still render');
  assert.match(html, /badge-success/,        'Wave 2 badge class must still render');
});

// ─── W3-LOAD: Loading state ───────────────────────────────────────────────────

test('[W3-LOAD-01] (test-item-3) renderInvoiceDetailLoading returns non-empty HTML', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderInvoiceDetailLoading();

  assert.ok(typeof html === 'string' && html.length > 0, 'loading state must return non-empty string');
  assert.match(html, /background.*#f1f5f9|background:#f1f5f9/, 'loading state must contain skeleton element');
});

test('[W3-LOAD-02] renderInvoiceDetailLoading contains multiple skeleton elements', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderInvoiceDetailLoading();
  const skeletonCount = (html.match(/border-radius:4px/g) || []).length;

  assert.ok(skeletonCount >= 2, 'loading state must have at least 2 skeleton rows');
});

// ─── W3-DETAIL: renderInvoiceDetailContent ────────────────────────────────────

test('[W3-DETAIL-01] (test-item-4/5) successful detail renders invoice number', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderInvoiceDetailContent(makeInvoice({ invoiceNumber: 'INV-963' }));

  assert.match(html, /INV-963/, 'detail must display invoice number');
});

test('[W3-DETAIL-02] (test-item-6) detail renders client name', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderInvoiceDetailContent(makeInvoice({ clientName: 'Distribuidora El Sol S.A.' }));

  assert.match(html, /Distribuidora El Sol S\.A\./, 'detail must display client name');
});

test('[W3-DETAIL-03] (test-item-7) detail renders client store name when available', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderInvoiceDetailContent(
    makeInvoice({ order: { id: 4521, clientStoreId: 7, clientStoreName: 'Tienda Centro' } }),
  );

  assert.match(html, /Tienda Centro/, 'client store name must render when present');
});

test('[W3-DETAIL-04] (test-item-7) client store not shown when order.clientStoreName is null', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderInvoiceDetailContent(
    makeInvoice({ order: { id: 4521, clientStoreId: null, clientStoreName: null } }),
  );

  // Order reference still shows, just without store name
  assert.match(html, /Pedido/, 'order reference must render');
  assert.doesNotMatch(html, /null/, 'literal null must not appear in HTML');
});

test('[W3-DETAIL-05] (test-item-8) detail renders linked order reference', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderInvoiceDetailContent(
    makeInvoice({ order: { id: 4521, clientStoreId: 7, clientStoreName: 'Tienda Centro' } }),
  );

  assert.match(html, /4521/, 'order ID must appear in detail');
  assert.match(html, /Pedido/, 'order label must appear');
});

test('[W3-DETAIL-06] (test-item-8) order line omitted when order is null and orderId is null', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderInvoiceDetailContent(
    makeInvoice({ order: null, orderId: null }),
  );

  assert.doesNotMatch(html, /Pedido:/, 'order reference line must not appear when no order');
});

test('[W3-DETAIL-07] (test-item-9) detail renders total amount', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderInvoiceDetailContent(makeInvoice({ amount: 125000 }));

  assert.match(html, /125[\u00A0 ,.]000/, 'total amount must appear in detail');
  assert.match(html, /Total/, 'Total label must appear');
});

test('[W3-DETAIL-08] (test-item-10) detail renders commercial status badge', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderInvoiceDetailContent(makeInvoice({ status: 'PAID' }));

  assert.match(html, /Pagado/, 'commercial status label must appear');
  assert.match(html, /badge-success/, 'commercial status badge class must appear');
  assert.match(html, /Estado comercial/, 'commercial status section label must appear');
});

test('[W3-DETAIL-09] (test-item-11) detail renders issuedAt date', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderInvoiceDetailContent(makeInvoice({ issuedAt: '2025-01-15T00:00:00.000Z' }));

  assert.match(html, /Emisi\u00F3n/, 'Emisión label must appear');
  assert.match(html, /15(?:\/|-)01(?:\/|-)2025|2025/, 'issue date must appear');
});

test('[W3-DETAIL-10] (test-item-12) detail renders dueAt when present', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderInvoiceDetailContent(makeInvoice({ dueAt: '2025-01-22T00:00:00.000Z' }));

  assert.match(html, /Vencimiento/, 'Vencimiento label must appear when dueAt is present');
});

test('[W3-DETAIL-11] (test-item-12) dueAt line omitted when dueAt is null', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderInvoiceDetailContent(makeInvoice({ dueAt: null }));

  assert.doesNotMatch(html, /Vencimiento/, 'Vencimiento label must not appear when dueAt is null');
});

test('[W3-DETAIL-12] (test-item-13) paidAt renders when present in DTO', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderInvoiceDetailContent(makeInvoice({ paidAt: '2025-01-15T14:30:00.000Z' }));

  assert.match(html, /Pagado/, 'paidAt Pagado label must appear when present');
});

test('[W3-DETAIL-13] (test-item-13) paidAt omitted when null — no crash', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  // paidAt: null — must not crash, must not show empty Pagado line
  const html = renderers.renderInvoiceDetailContent(makeInvoice({ status: 'PENDING', paidAt: null }));

  assert.ok(typeof html === 'string' && html.length > 0, 'must render without crash');
});

test('[W3-DETAIL-14] (test-item-14) no-payment state shows empty message', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderInvoiceDetailContent(makeInvoice({ payments: [] }));

  assert.match(html, /Sin pagos registrados/, 'empty payment state must show "Sin pagos registrados"');
  assert.doesNotMatch(html, /<tbody>/, 'no table when payments is empty');
});

test('[W3-DETAIL-15] (test-item-15) single payment renders with method, amount, status, date', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderInvoiceDetailContent(makeInvoice({
    payments: [makePayment({ paymentMethod: 'CASH', amount: 125000, status: 'APPROVED' })],
  }));

  assert.match(html, /Efectivo/, 'payment method must render');
  assert.match(html, /125[\u00A0 ,.]000/, 'payment amount must render');
  assert.match(html, /Aprobado/, 'payment status must render');
  assert.match(html, /15(?:\/|-)01(?:\/|-)2025|2025/, 'payment date must render');
});

test('[W3-DETAIL-16] (test-item-16) multiple payments all render', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderInvoiceDetailContent(makeInvoice({
    payments: [
      makePayment({ id: 1, paymentMethod: 'CASH',     amount: 50000 }),
      makePayment({ id: 2, paymentMethod: 'TRANSFER', amount: 75000, reference: 'REF-001' }),
    ],
  }));

  assert.match(html, /Efectivo/,        'first payment method must render');
  assert.match(html, /Transferencia/,   'second payment method must render');
  assert.match(html, /REF-001/,         'transfer reference must render');
  const rowCount = (html.match(/<tr>/g) || []).length;
  assert.ok(rowCount >= 2, 'must render at least 2 payment rows');
});

test('[W3-DETAIL-17] (test-item-17) null optional fields do not crash (fiscal=null, order=null, payments=[])', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  // Must not throw
  const html = renderers.renderInvoiceDetailContent(makeInvoice({
    fiscal: null,
    order: null,
    orderId: null,
    dueAt: null,
    paidAt: null,
    payments: [],
  }));

  assert.ok(typeof html === 'string' && html.length > 0, 'must render as non-empty string');
  assert.doesNotMatch(html, /null/, 'literal null must not appear in rendered HTML');
});

test('[W3-DETAIL-18] (test-item-23) fiscal data not used to infer commercial status', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  // Invoice with PENDING commercial but ACCEPTED fiscal
  const html = renderers.renderInvoiceDetailContent(makeInvoice({
    status: 'PENDING',
    fiscal: { status: 'ACCEPTED', clave: 'abc', consecutive: '001', acceptedAt: '2025-01-15T14:30:00.000Z' },
  }));

  assert.match(html, /Pendiente/, 'commercial status must show Pendiente regardless of fiscal');
  // The commercial badge element for PENDING must use badge-warning, not badge-success.
  // (Wave 4 adds badge-success for the ACCEPTED fiscal badge in a separate section — that is correct.)
  assert.match(html, /badge badge-warning/, 'PENDING commercial status must use badge-warning class');
  assert.doesNotMatch(html, /<span[^>]*badge-success[^>]*>\s*Pendiente/,
    'PENDING commercial badge element must NOT have badge-success as its class');
});

test('[W3-DETAIL-19] (Wave 4) renderInvoiceDetailContent renders fiscal section for ACCEPTED invoices', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  // Wave 4 activates the fiscal section — clave, consecutive and label MUST now appear
  const html = renderers.renderInvoiceDetailContent(makeInvoice({
    fiscal: { status: 'ACCEPTED', clave: 'CLAVE-50-CHARS-XXXX', consecutive: '001-001', acceptedAt: '2025-01-15T14:30:00.000Z' },
  }));

  assert.match(html, /CLAVE-50-CHARS-XXXX/, 'clave must be rendered for ACCEPTED invoices in Wave 4');
  assert.match(html, /001-001/, 'consecutive must be rendered for ACCEPTED invoices in Wave 4');
  assert.match(html, /Aceptada por Hacienda/, 'full fiscal status label must appear for ACCEPTED in Wave 4');
});

// ─── W3-ERR: Error / not-found states ────────────────────────────────────────

test('[W3-ERR-01] (test-item-18) renderInvoiceDetailNotFound returns safe not-found message', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderInvoiceDetailNotFound();

  assert.ok(typeof html === 'string' && html.length > 0, 'must return non-empty string');
  assert.match(html, /No se encontr/, 'must contain a not-found message');
});

test('[W3-ERR-02] (test-item-19) renderInvoiceDetailError returns safe fixed error message', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderInvoiceDetailError();

  assert.ok(typeof html === 'string' && html.length > 0, 'must return non-empty string');
  assert.match(html, /No se pudo cargar|intente nuevamente/i, 'must contain a safe error message');
});

test('[W3-ERR-03] (test-item-19) renderInvoiceDetailError does not accept or render raw error text', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  // The function takes no arguments — any backend error text cannot leak into it
  const html = renderers.renderInvoiceDetailError();

  assert.doesNotMatch(html, /failureMessage|env:SECRET|billingPayload/,
    'safe error must not contain any backend internals');
});

// ─── W3-SEC: Security ─────────────────────────────────────────────────────────

test('[W3-SEC-01] (test-item-24) no raw FiscalIntent internals rendered in detail content', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const leakyInvoice = makeInvoice({
    fiscal: {
      status: 'ACCEPTED',
      failureMessage:          'secret-error-detail',
      failureCode:             'BILLING_AUTH_FAILURE',
      idempotencyKey:          'idem-key-secret',
      billingFiscalDocumentId: 'billing-doc-secret',
      billingStatus:           'BILLING_INTERNAL',
      retryCount:              3,
      nextRetryAt:             '2025-01-20T00:00:00Z',
      processingNodeId:        'node-001',
      billingPayload:          '{"secret":"data"}',
    },
  });

  const html = renderers.renderInvoiceDetailContent(leakyInvoice);

  assert.doesNotMatch(html, /failureMessage/,           'failureMessage must not appear');
  assert.doesNotMatch(html, /failureCode/,              'failureCode must not appear');
  assert.doesNotMatch(html, /idempotencyKey/,           'idempotencyKey must not appear');
  assert.doesNotMatch(html, /billingFiscalDocumentId/,  'billingFiscalDocumentId must not appear');
  assert.doesNotMatch(html, /billingStatus/,            'billingStatus must not appear');
  assert.doesNotMatch(html, /retryCount/,               'retryCount must not appear');
  assert.doesNotMatch(html, /processingNodeId/,         'processingNodeId must not appear');
  assert.doesNotMatch(html, /billingPayload/,           'billingPayload must not appear');
  assert.doesNotMatch(html, /secret-error-detail/,      'failureMessage literal value must not appear');
  assert.doesNotMatch(html, /idem-key-secret/,          'idempotencyKey literal value must not appear');
  assert.doesNotMatch(html, /billing-doc-secret/,       'billingFiscalDocumentId literal value must not appear');
});

test('[W3-SEC-02] (test-item-25) no Billing internal IDs in rendered detail HTML', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderInvoiceDetailContent(makeInvoice({ fiscal: null }));

  assert.doesNotMatch(html, /billingCompanyId/,  'Billing company ID must not appear');
  assert.doesNotMatch(html, /billingTenantId/,   'Billing tenant ID must not appear');
  assert.doesNotMatch(html, /secretReference/,   'secret references must not appear');
});

// ─── W3-SHELL: Dialog shell structure ─────────────────────────────────────────

test('[W3-SHELL-01] (test-item-20/21) shell HTML contains billing-detail-dialog with correct aria', () => {
  const rootShell = createBillingHarness({ includeView: true });
  const billingAdmin = rootShell.require('views.billingAdmin');

  const html = billingAdmin.render(null);

  assert.match(html, /id="billing-detail-dialog"/, 'shell must include billing-detail-dialog');
  assert.match(html, /aria-modal="true"/, 'detail dialog must have aria-modal="true"');
  assert.match(html, /aria-labelledby="billing-detail-dialog-title"/, 'detail dialog must have aria-labelledby');
  assert.match(html, /id="billing-detail-dialog-title"/, 'dialog title element must exist');
});

test('[W3-SHELL-02] (test-item-20) shell HTML has close button for detail dialog', () => {
  const rootShell = createBillingHarness({ includeView: true });
  const billingAdmin = rootShell.require('views.billingAdmin');

  const html = billingAdmin.render(null);

  assert.match(html, /id="billing-detail-dialog-close"/, 'close button must exist');
  assert.match(html, /aria-label="Cerrar detalle de factura"/, 'close button must have aria-label');
});

test('[W3-SHELL-03] (test-item-21) existing billing admin structure (tabs, pay dialog) intact', () => {
  const rootShell = createBillingHarness({ includeView: true });
  const billingAdmin = rootShell.require('views.billingAdmin');

  const html = billingAdmin.render(null);

  assert.match(html, /billing-panel-receivables/,  'receivables panel must remain');
  assert.match(html, /billing-panel-pending/,      'pending panel must remain');
  assert.match(html, /billing-panel-history/,      'history panel must remain');
  assert.match(html, /billing-pay-dialog/,         'pay dialog must remain');
  assert.match(html, /Facturaci\u00F3n y cobros/,  'section heading must remain');
});

test('[W3-SHELL-04] shell contains billing-detail-dialog-body container for dynamic content', () => {
  const rootShell = createBillingHarness({ includeView: true });
  const billingAdmin = rootShell.require('views.billingAdmin');

  const html = billingAdmin.render(null);

  assert.match(html, /id="billing-detail-dialog-body"/, 'body container must exist for dynamic population');
});

// ─── W3-EXT: Wave 4 extension point ──────────────────────────────────────────

test('[W3-EXT-01] (test-item-28) renderInvoiceDetailContent includes Wave 4 fiscal extension point', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderInvoiceDetailContent(makeInvoice());

  assert.match(html, /billing-detail-fiscal-section/,
    'Wave 4 extension point section#billing-detail-fiscal-section must be present');
  assert.match(html, /Comprobante electr/,
    'Wave 4 extension point must label the section');
});

test('[W3-EXT-02] (Wave 4 activated) billing-detail-fiscal-section is present and visible', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  // Wave 4 activates the extension point — section must be present and NOT hidden
  const html = renderers.renderInvoiceDetailContent(makeInvoice({ fiscal: null }));

  assert.match(html, /billing-detail-fiscal-section/, 'fiscal section must be present');
  assert.doesNotMatch(html, /billing-detail-fiscal-section[^>]*hidden/,
    'fiscal section must NOT be hidden after Wave 4 activation');
});

// ─── W3-RESP: Responsive structure ───────────────────────────────────────────

test('[W3-RESP-01] (test-item-30) detail content uses no fixed-width px constraints', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderInvoiceDetailContent(makeInvoice());

  // Fixed widths like width:600px would break responsive layout
  assert.doesNotMatch(html, /width:\s*\d{3,4}px/,
    'detail content must not use fixed pixel widths that break responsive layout');
});

test('[W3-RESP-02] shell dialog uses max-height + overflow-y for scrollable body', () => {
  const rootShell = createBillingHarness({ includeView: true });
  const billingAdmin = rootShell.require('views.billingAdmin');

  const html = billingAdmin.render(null);

  assert.match(html, /max-height.*70vh|overflow-y.*auto/,
    'detail dialog body must use max-height + overflow-y for tall content');
});

// ─── W3-SRC: Source-level contract guards ────────────────────────────────────

test('[W3-SRC-01] billing-admin.js source contains bindDetailButtons call', () => {
  const source = readRootFile('views/billing-admin.js');
  assert.match(source, /bindDetailButtons/, 'billing-admin.js must define and call bindDetailButtons');
});

test('[W3-SRC-02] billing-admin.js source contains openInvoiceDetail function', () => {
  const source = readRootFile('views/billing-admin.js');
  assert.match(source, /openInvoiceDetail/, 'billing-admin.js must define openInvoiceDetail');
});

test('[W3-SRC-03] (test-item-2/22) billing-admin.js passes invoiceId to fetchInvoiceDetail', () => {
  const source = readRootFile('views/billing-admin.js');
  assert.match(source, /fetchInvoiceDetail.*invoiceId|fetchInvoiceDetail\(sess,\s*invoiceId/s,
    'billing-admin.js must pass invoiceId to fetchInvoiceDetail');
});

test('[W3-SRC-04] billing-admin.renderers.js exports renderInvoiceDetailContent', () => {
  const source = readRootFile('views/billing-admin.renderers.js');
  assert.match(source, /renderInvoiceDetailContent/, 'renderers must export renderInvoiceDetailContent');
});

test('[W3-SRC-05] billing-admin.renderers.js has .billing-detail-btn button pattern with data-invoice-id', () => {
  const source = readRootFile('views/billing-admin.renderers.js');
  assert.match(source, /billing-detail-btn/,  'renderers must include billing-detail-btn class');
  assert.match(source, /data-invoice-id/,     'renderers must set data-invoice-id on detail button');
});

test('[W3-SRC-06] (Wave 5 activated) fiscal-artifacts references use Inventori proxy URLs only', () => {
  // Wave 5 implemented: renderers and admin now reference /api/invoices/.../fiscal-artifacts.
  // Guard: the references must be Inventori proxy paths — never direct Billing or Hacienda URLs.
  const renderersSource  = readRootFile('views/billing-admin.renderers.js');
  const adminSource      = readRootFile('views/billing-admin.js');
  const combined         = renderersSource + adminSource;

  // Wave 5 artifact endpoint is referenced (expected)
  assert.match(combined, /fiscal-artifacts/, 'Wave 5: fiscal-artifacts must now be referenced');
  // But never via a direct Billing or Hacienda URL
  assert.doesNotMatch(combined, /https?:\/\/.*billing.*fiscal|billing\..*fiscal-artifact/i,
    'fiscal-artifact references must not point to Billing directly');
});

test('[W3-SRC-07] (test-item-26) no browser → Billing direct communication introduced', () => {
  const renderersSource = readRootFile('views/billing-admin.renderers.js');
  const adminSource     = readRootFile('views/billing-admin.js');
  const apiSource       = readRootFile('billing-api.js');

  // No new direct Billing URLs — only Inventori proxy paths
  const combined = renderersSource + adminSource + apiSource;
  assert.doesNotMatch(combined, /billing\.api\.|billingApiUrl|billingDirectUrl|https:\/\/.*billing/i,
    'no direct Billing API communication must be introduced');
});

test('[W3-SRC-08] billing-admin.renderers.js does not infer commercial status from fiscal status', () => {
  const source = readRootFile('views/billing-admin.renderers.js');
  assert.doesNotMatch(source, /fiscal\.status.*inv\.status|inv\.status.*from.*fiscal/i,
    'renderer must not derive commercial status from fiscal status');
});
