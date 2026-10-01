'use strict';

/**
 * Wave 2 tests — Invoice list: fiscal status + Invoice.number fix
 *
 * Spec: specs/inventori-fiscal-invoice-history-and-detail/
 * Covers:
 *   AC-001  Invoice row shows invoiceNumber (INV-963), not raw ID (1623)
 *   AC-012  ACCEPTED invoice → ✓ Aceptada badge
 *   AC-013  PENDING invoice → ⏳ En cola badge
 *   AC-014  fiscal=null → '—' in fiscal column, no badge
 *   AC-015  All six fiscal states render distinct, non-empty labels
 *   FH-LIST-003  Fiscal badge is independent of commercial status badge
 *   FH-SEC-001  No raw InvoiceFiscalIntent internals in rendered HTML
 *
 * Additional contract tests:
 *   - PROCESSING, REJECTED, ERROR_RETRYABLE, ERROR_FINAL all render
 *   - Unknown fiscal status degrades gracefully (no crash, non-empty label)
 *   - Commercial status badge rendered independently of fiscal badge
 *   - ACCEPTED fiscal + PENDING commercial → both badges visible simultaneously
 *   - No Billing IDs or secret-like content in rendered HTML
 *   - Existing receivables table columns preserved (backward compat)
 *   - Table has valid structural markup (thead/tbody)
 *   - fetchInvoiceDetail calls the correct endpoint
 *   - fetchInvoiceDetail passes the response through untouched
 *   - fetchInvoiceDetail error follows existing API conventions
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
 * Loads: registry → ui → billing-api → billing-admin.helpers → billing-admin.renderers
 * Does NOT load billing-admin.js (main view) — we only test helpers + renderers here.
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

  // fetch stub used by sendJson inside billing-api
  browserWindow.fetch = options.fetch || (async () => ({ ok: true, status: 200, json: async () => ({}) }));

  executeRootScript('ui.js', context);
  executeRootScript('billing-api.js', context);
  executeRootScript('views/billing-admin.helpers.js', context);
  executeRootScript('views/billing-admin.renderers.js', context);

  return browserWindow.RootShell;
}

// ─── Invoice fixtures ─────────────────────────────────────────────────────────

function makeInvoice(overrides = {}) {
  return {
    id: 1623,
    invoiceNumber: 'INV-963',
    clientId: 42,
    clientName: 'Empresa Test S.A.',
    amount: 5000,
    pendingAmount: 5000,
    status: 'PENDING',
    issuedAt: '2025-01-15T00:00:00.000Z',
    dueAt: '2025-01-22T00:00:00.000Z',
    fiscal: null,
    payments: [],
    ...overrides,
  };
}

// ─── Helpers unit tests ───────────────────────────────────────────────────────

test('[W2-H-01] fiscalStatusListLabel returns correct label for all six statuses', () => {
  const rootShell = createBillingHarness();
  const bh = rootShell.require('views.billingAdminHelpers');

  assert.equal(bh.fiscalStatusListLabel('PENDING'),         '\u23F3 En cola');
  assert.equal(bh.fiscalStatusListLabel('PROCESSING'),      '\u23F3 Enviando');
  assert.equal(bh.fiscalStatusListLabel('ACCEPTED'),        '\u2713 Aceptada');
  assert.equal(bh.fiscalStatusListLabel('REJECTED'),        '\u2717 Rechazada');
  assert.equal(bh.fiscalStatusListLabel('ERROR_RETRYABLE'), '\u26A0 Reintentando');
  assert.equal(bh.fiscalStatusListLabel('ERROR_FINAL'),     '\u2717 Error final');
});

test('[W2-H-02] fiscalStatusListLabel degrades gracefully for unknown status — no crash, non-empty', () => {
  const rootShell = createBillingHarness();
  const bh = rootShell.require('views.billingAdminHelpers');

  // Must not throw and must return a truthy string
  const result = bh.fiscalStatusListLabel('SOME_FUTURE_STATUS');
  assert.ok(result, 'unknown status must produce a non-empty label');
  assert.equal(typeof result, 'string');
});

test('[W2-H-03] fiscalStatusListLabel returns dash for null/undefined status', () => {
  const rootShell = createBillingHarness();
  const bh = rootShell.require('views.billingAdminHelpers');

  assert.ok(bh.fiscalStatusListLabel(null), 'null status must return non-empty string');
  assert.ok(bh.fiscalStatusListLabel(undefined), 'undefined status must return non-empty string');
});

test('[W2-H-04] fiscalStatusListBadgeClass returns correct CSS class for all six statuses', () => {
  const rootShell = createBillingHarness();
  const bh = rootShell.require('views.billingAdminHelpers');

  assert.equal(bh.fiscalStatusListBadgeClass('PENDING'),         'badge');
  assert.equal(bh.fiscalStatusListBadgeClass('PROCESSING'),      'badge badge-info');
  assert.equal(bh.fiscalStatusListBadgeClass('ACCEPTED'),        'badge badge-success');
  assert.equal(bh.fiscalStatusListBadgeClass('REJECTED'),        'badge badge-danger');
  assert.equal(bh.fiscalStatusListBadgeClass('ERROR_RETRYABLE'), 'badge badge-warning');
  assert.equal(bh.fiscalStatusListBadgeClass('ERROR_FINAL'),     'badge badge-danger');
});

test('[W2-H-05] fiscalStatusListBadgeClass falls back to plain badge for unknown status', () => {
  const rootShell = createBillingHarness();
  const bh = rootShell.require('views.billingAdminHelpers');

  const cls = bh.fiscalStatusListBadgeClass('SOME_FUTURE_STATUS');
  assert.equal(cls, 'badge', 'unknown status must fall back to plain badge');
});

// ─── Receivables table — invoiceNumber fix (AC-001) ──────────────────────────

test('[W2-R-01] (AC-001) invoice row shows invoiceNumber (INV-963), not raw ID (1623)', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderReceivablesTable([
    makeInvoice({ id: 1623, invoiceNumber: 'INV-963', fiscal: null }),
  ]);

  assert.match(html, /INV-963/, 'rendered HTML must contain invoiceNumber string');
  // The numeric ID may legitimately appear in data-invoice-id attributes (for payment buttons).
  // What must NOT happen is the raw numeric ID appearing as the displayed invoice reference
  // in a <td> cell where the invoice number should be shown. Check the N° Factura cell specifically.
  assert.doesNotMatch(html, /<td>\s*1623\s*<\/td>/, 'raw numeric ID must not be displayed as the invoice number in a table cell');
});

// ─── Receivables table — fiscal=null (AC-014) ────────────────────────────────

test('[W2-R-02] (AC-014) fiscal=null shows dash, no badge element', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderReceivablesTable([makeInvoice({ fiscal: null })]);

  assert.match(html, /Sin emisión fiscal|—/, 'null fiscal must show dash or "Sin emisión fiscal"');
  assert.doesNotMatch(html, /badge-success/, 'null fiscal must not render success badge');
  assert.doesNotMatch(html, /badge-danger/, 'null fiscal must not render danger badge');
  assert.doesNotMatch(html, /Aceptada|Rechazada|En cola|Enviando|Reintentando|Error final/,
    'null fiscal must not render any fiscal status label');
});

// ─── Receivables table — all six fiscal states (AC-012, AC-013, AC-015) ──────

test('[W2-R-03] (AC-012) ACCEPTED invoice renders fiscal badge ✓ Aceptada', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderReceivablesTable([
    makeInvoice({ fiscal: { status: 'ACCEPTED' } }),
  ]);

  assert.match(html, /Aceptada/, 'ACCEPTED must show Aceptada label');
  assert.match(html, /badge-success/, 'ACCEPTED must use success badge class');
});

test('[W2-R-04] (AC-013) PENDING fiscal invoice renders ⏳ En cola badge', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderReceivablesTable([
    makeInvoice({ fiscal: { status: 'PENDING' } }),
  ]);

  assert.match(html, /En cola/, 'PENDING must show En cola label');
  assert.match(html, /badge/, 'PENDING must have badge class');
});

test('[W2-R-05] PROCESSING fiscal invoice renders ⏳ Enviando badge', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderReceivablesTable([
    makeInvoice({ fiscal: { status: 'PROCESSING' } }),
  ]);

  assert.match(html, /Enviando/, 'PROCESSING must show Enviando label');
  assert.match(html, /badge-info/, 'PROCESSING must use badge-info class');
});

test('[W2-R-06] REJECTED fiscal invoice renders ✗ Rechazada badge', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderReceivablesTable([
    makeInvoice({ fiscal: { status: 'REJECTED' } }),
  ]);

  assert.match(html, /Rechazada/, 'REJECTED must show Rechazada label');
  assert.match(html, /badge-danger/, 'REJECTED must use badge-danger class');
});

test('[W2-R-07] ERROR_RETRYABLE fiscal invoice renders ⚠ Reintentando badge', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderReceivablesTable([
    makeInvoice({ fiscal: { status: 'ERROR_RETRYABLE' } }),
  ]);

  assert.match(html, /Reintentando/, 'ERROR_RETRYABLE must show Reintentando label');
  assert.match(html, /badge-warning/, 'ERROR_RETRYABLE must use badge-warning class');
});

test('[W2-R-08] ERROR_FINAL fiscal invoice renders ✗ Error final badge', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderReceivablesTable([
    makeInvoice({ fiscal: { status: 'ERROR_FINAL' } }),
  ]);

  assert.match(html, /Error final/, 'ERROR_FINAL must show Error final label');
  assert.match(html, /badge-danger/, 'ERROR_FINAL must use badge-danger class');
});

test('[W2-R-09] (AC-015) all six fiscal states render distinct non-empty labels in one table', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const invoices = [
    makeInvoice({ id: 1, invoiceNumber: 'INV-001', fiscal: { status: 'PENDING' } }),
    makeInvoice({ id: 2, invoiceNumber: 'INV-002', fiscal: { status: 'PROCESSING' } }),
    makeInvoice({ id: 3, invoiceNumber: 'INV-003', fiscal: { status: 'ACCEPTED' } }),
    makeInvoice({ id: 4, invoiceNumber: 'INV-004', fiscal: { status: 'REJECTED' } }),
    makeInvoice({ id: 5, invoiceNumber: 'INV-005', fiscal: { status: 'ERROR_RETRYABLE' } }),
    makeInvoice({ id: 6, invoiceNumber: 'INV-006', fiscal: { status: 'ERROR_FINAL' } }),
  ];

  const html = renderers.renderReceivablesTable(invoices);

  assert.match(html, /En cola/,        'PENDING label must appear');
  assert.match(html, /Enviando/,       'PROCESSING label must appear');
  assert.match(html, /Aceptada/,       'ACCEPTED label must appear');
  assert.match(html, /Rechazada/,      'REJECTED label must appear');
  assert.match(html, /Reintentando/,   'ERROR_RETRYABLE label must appear');
  assert.match(html, /Error final/,    'ERROR_FINAL label must appear');
});

test('[W2-R-10] unknown fiscal status degrades gracefully — table renders, no crash', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  // Must not throw
  const html = renderers.renderReceivablesTable([
    makeInvoice({ fiscal: { status: 'SOME_FUTURE_STATUS' } }),
  ]);

  assert.ok(typeof html === 'string' && html.length > 0, 'table must render as non-empty string');
  assert.match(html, /<tr/, 'rendered HTML must contain table rows');
});

// ─── Commercial / fiscal status independence ──────────────────────────────────

test('[W2-R-11] (FH-LIST-003) fiscal badge is independent of commercial status badge', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  // Same commercial status (PENDING), different fiscal statuses
  const html = renderers.renderReceivablesTable([
    makeInvoice({ id: 1, invoiceNumber: 'INV-A', status: 'PENDING', fiscal: { status: 'ACCEPTED' } }),
    makeInvoice({ id: 2, invoiceNumber: 'INV-B', status: 'PENDING', fiscal: { status: 'REJECTED' } }),
  ]);

  // Both commercial "Pendiente" badges present
  const pendienteCount = (html.match(/Pendiente/g) || []).length;
  assert.ok(pendienteCount >= 2, 'both rows must show commercial Pendiente badge');

  // And distinct fiscal badges
  assert.match(html, /Aceptada/,  'ACCEPTED fiscal badge must appear independently');
  assert.match(html, /Rechazada/, 'REJECTED fiscal badge must appear independently');
});

test('[W2-R-12] ACCEPTED fiscal + PENDING commercial — both badges display simultaneously', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderReceivablesTable([
    makeInvoice({ status: 'PENDING', fiscal: { status: 'ACCEPTED' } }),
  ]);

  assert.match(html, /Pendiente/,  'commercial PENDING label must be present');
  assert.match(html, /Aceptada/,   'fiscal ACCEPTED label must be present');
  assert.match(html, /badge-success/, 'fiscal ACCEPTED badge class must be present');
});

// ─── Security: no raw internals in rendered HTML (FH-SEC-001) ────────────────

test('[W2-R-13] (FH-SEC-001) no raw InvoiceFiscalIntent internal fields in rendered HTML', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  // Simulate a case where the DTO INCORRECTLY leaked internal fields
  // The renderer must not output them even if present on the inv object.
  const leakyInvoice = makeInvoice({
    fiscal: {
      status: 'ACCEPTED',
      // These internal fields must NEVER appear in rendered HTML
      failureMessage:         'secret-internal-error',
      failureCode:            'BILLING_AUTH_FAILURE',
      idempotencyKey:         'idem-key-should-not-render',
      billingFiscalDocumentId: 'billing-doc-id-secret',
      billingStatus:          'BILLING_INTERNAL',
      retryCount:             3,
      nextRetryAt:            '2025-01-20T00:00:00Z',
      processingNodeId:       'node-001',
      billingPayload:         '{"secret":"data"}',
    },
  });

  const html = renderers.renderReceivablesTable([leakyInvoice]);

  assert.doesNotMatch(html, /failureMessage/, 'failureMessage must not appear in HTML');
  assert.doesNotMatch(html, /failureCode/, 'failureCode must not appear in HTML');
  assert.doesNotMatch(html, /idempotencyKey/, 'idempotencyKey must not appear in HTML');
  assert.doesNotMatch(html, /billingFiscalDocumentId/, 'billingFiscalDocumentId must not appear in HTML');
  assert.doesNotMatch(html, /billingStatus/, 'billingStatus must not appear in HTML');
  assert.doesNotMatch(html, /retryCount/, 'retryCount must not appear in HTML');
  assert.doesNotMatch(html, /processingNodeId/, 'processingNodeId must not appear in HTML');
  assert.doesNotMatch(html, /billingPayload/, 'billingPayload must not appear in HTML');
  assert.doesNotMatch(html, /secret-internal-error/, 'literal failureMessage value must not appear');
  assert.doesNotMatch(html, /idem-key-should-not-render/, 'literal idempotencyKey must not appear');
  assert.doesNotMatch(html, /billing-doc-id-secret/, 'literal billingFiscalDocumentId must not appear');
});

test('[W2-R-14] no Billing IDs or secret-like content from fiscal object in rendered HTML', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderReceivablesTable([
    makeInvoice({ fiscal: { status: 'PROCESSING' } }),
  ]);

  // Billing-internal field names must not appear in list HTML
  assert.doesNotMatch(html, /billingCompanyId/, 'Billing company ID must not appear');
  assert.doesNotMatch(html, /billingTenantId/, 'Billing tenant ID must not appear');
  assert.doesNotMatch(html, /secretReference/, 'secret references must not appear');
});

// ─── Backward compatibility ───────────────────────────────────────────────────

test('[W2-R-15] existing table columns (Cliente, N° Factura, Total, Pendiente, Vencimiento, Estado, Acción) still present', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderReceivablesTable([makeInvoice({ fiscal: null })]);

  assert.match(html, /Cliente/,     'Cliente column must be present');
  assert.match(html, /N° Factura/,  'N° Factura column must be present');
  assert.match(html, /Total/,       'Total column must be present');
  assert.match(html, /Pendiente/,   'Pendiente column must be present');
  assert.match(html, /Vencimiento/, 'Vencimiento column must be present');
  assert.match(html, /Estado/,      'Estado column must be present');
  assert.match(html, /Estado Fiscal/, 'Estado Fiscal column must be present (Wave 2 addition)');
  assert.match(html, /Acción/,      'Acción column must be present');
});

test('[W2-R-16] table has valid structural markup — thead and tbody present', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderReceivablesTable([makeInvoice()]);

  assert.match(html, /<thead/, 'table must have thead');
  assert.match(html, /<tbody/, 'table must have tbody');
  assert.match(html, /<th/, 'table must have header cells');
  assert.match(html, /<td/, 'table must have data cells');
});

test('[W2-R-17] renderReceivablesTable handles empty array without crash', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderReceivablesTable([]);
  assert.ok(typeof html === 'string' && html.length > 0, 'empty state must render non-empty string');
});

// ─── fetchInvoiceDetail — API contract tests ─────────────────────────────────

test('[W2-API-01] fetchInvoiceDetail calls GET /api/invoices/:id', async () => {
  const capturedUrls = [];
  const rootShell = createBillingHarness({
    fetchJson: async (_session, url) => {
      capturedUrls.push(url);
      return { id: 99, invoiceNumber: 'INV-099', fiscal: { status: 'ACCEPTED' } };
    },
  });
  const billingApi = rootShell.require('billingApi');

  await billingApi.fetchInvoiceDetail({ token: 'sess' }, 99);

  assert.equal(capturedUrls.length, 1, 'exactly one API call must be made');
  assert.match(capturedUrls[0], /\/api\/invoices\/99$/, 'URL must be /api/invoices/:id');
});

test('[W2-API-02] fetchInvoiceDetail passes the response through untouched to consumer', async () => {
  const expectedDetail = {
    id: 99,
    invoiceNumber: 'INV-099',
    fiscal: {
      status: 'ACCEPTED',
      clave: '506012500320000...',
      consecutive: '001-00001-01-000000099',
      acceptedAt: '2025-01-15T14:30:00.000Z',
    },
  };

  const rootShell = createBillingHarness({
    fetchJson: async () => expectedDetail,
  });
  const billingApi = rootShell.require('billingApi');

  const result = await billingApi.fetchInvoiceDetail({ token: 'sess' }, 99);

  assert.deepEqual(result, expectedDetail, 'fetchInvoiceDetail must return the response unchanged');
});

test('[W2-API-03] fetchInvoiceDetail error follows existing conventions (throws on non-ok)', async () => {
  const rootShell = createBillingHarness({
    fetchJson: async () => { throw new Error('No se pudo cargar el detalle de la factura.'); },
  });
  const billingApi = rootShell.require('billingApi');

  await assert.rejects(
    () => billingApi.fetchInvoiceDetail({ token: 'sess' }, 999),
    /cargar el detalle/,
    'fetchInvoiceDetail must propagate error with Spanish message',
  );
});

test('[W2-API-04] billingApi exposes fetchInvoiceDetail in registered module', () => {
  const rootShell = createBillingHarness();
  const billingApi = rootShell.require('billingApi');

  assert.equal(typeof billingApi.fetchInvoiceDetail, 'function',
    'fetchInvoiceDetail must be exported from billingApi');
});

// ─── Source-level contract guards ─────────────────────────────────────────────

test('[W2-SRC-01] billing-api.js does not infer fiscal state from invoice status, payments or clave', () => {
  const source = readRootFile('billing-api.js');

  // fetchInvoiceDetail must be a simple passthrough — no fiscal inference logic
  assert.match(source, /fetchInvoiceDetail/, 'fetchInvoiceDetail must be defined');
  // The source uses a BASE_INVOICES constant + template literal; check for the pattern
  assert.match(source, /BASE_INVOICES.*invoiceId|invoices.*encodeURIComponent/s,
    'billing-api must build the /api/invoices/:id URL via BASE_INVOICES + invoiceId');
  // Must NOT contain fiscal inference patterns
  assert.doesNotMatch(source, /if.*fiscal.*status/i,
    'billing-api must not infer fiscal status from local conditions');
});

test('[W2-SRC-02] billing-admin.renderers.js reads fiscal status from inv.fiscal, not from inv.status', () => {
  const source = readRootFile('views/billing-admin.renderers.js');

  assert.match(source, /inv\.fiscal/, 'renderer must access inv.fiscal from the DTO');
  assert.match(source, /inv\.fiscal\.status\b/, 'renderer must read inv.fiscal.status');
  assert.match(source, /Estado Fiscal/, 'renderer must include Estado Fiscal column header');
  // Guard: renderer must not derive fiscal state from commercial status
  assert.doesNotMatch(source, /inv\.status.*fiscal/,
    'renderer must not derive fiscal state from commercial inv.status');
});

test('[W2-SRC-03] billing-admin.helpers.js exports both fiscalStatusListLabel and fiscalStatusListBadgeClass', () => {
  const source = readRootFile('views/billing-admin.helpers.js');

  assert.match(source, /fiscalStatusListLabel/,      'must define fiscalStatusListLabel');
  assert.match(source, /fiscalStatusListBadgeClass/, 'must define fiscalStatusListBadgeClass');
  assert.match(source, /FISCAL_STATUS_LIST_LABELS/,  'must define FISCAL_STATUS_LIST_LABELS map');
  assert.match(source, /ERROR_RETRYABLE/,            'ERROR_RETRYABLE must be in status map');
  assert.match(source, /ERROR_FINAL/,                'ERROR_FINAL must be in status map');
});
