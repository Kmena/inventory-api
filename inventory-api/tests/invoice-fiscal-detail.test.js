'use strict';

/**
 * Wave 4 tests — Fiscal detail section: all six fiscal states
 *
 * Spec: specs/inventori-fiscal-invoice-history-and-detail/
 * Covers all 36 required Wave 4 test items plus additional canonical assertions.
 *
 * What is tested here:
 *   - W4-HELPERS: fiscalStatusLabel / fiscalStatusBadgeClass / fiscalStatusDescription helpers
 *   - W4-NULL: fiscal=null renders neutral no-emission message
 *   - W4-PENDING: PENDING state badge + description, no clave/consecutive
 *   - W4-PROC: PROCESSING state badge + description, no clave
 *   - W4-ACCEPTED: badge + clave (opaque) + consecutive (leading zeros) + acceptedAt
 *   - W4-REJECTED: badge + description, no clave, no failureMessage
 *   - W4-RETRY: ERROR_RETRYABLE badge + auto-retry description
 *   - W4-FINAL: ERROR_FINAL badge + contact-support description
 *   - W4-UNKNOWN: unknown status degrades safely, never classified as ACCEPTED
 *   - W4-INDEP: commercial and fiscal status are fully independent
 *   - W4-SEC: no FiscalIntent internals / Billing internals in rendered HTML
 *   - W4-A11Y: section heading, textual badge meaning, aria-labelledby
 *   - W4-RESP: word-break:break-all on clave/consecutive, no fixed-width
 *   - W4-SRC: source-level contract guards (no artifacts, no Billing, no retry controls)
 *   - W4-REG: Wave 2 list badges and Wave 3 commercial detail remain unchanged
 */

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');

const rootPublicPath = path.join(__dirname, '..', 'src', 'public', 'root');

function readRootFile(rel) {
  return fs.readFileSync(path.join(rootPublicPath, rel), 'utf8');
}

function executeRootScript(rel, context) {
  const source = readRootFile(rel);
  vm.runInContext(source, context, { filename: rel });
}

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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeFiscal(overrides = {}) {
  return {
    status:      'ACCEPTED',
    clave:       '50601012500312345678901234567890123456789012345678',
    consecutive: '00100001010000000001',
    acceptedAt:  '2025-01-15T14:30:00.000Z',
    ...overrides,
  };
}

/** Base invoice fixture — commercial PAID, fiscal ACCEPTED by default. */
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
    fiscal: makeFiscal(),
    payments: [],
    order: { id: 4521, clientStoreId: 7, clientStoreName: 'Tienda Centro' },
    ...overrides,
  };
}

// ─── W4-HELPERS: helper functions exported from billingAdminHelpers ───────────

test('[W4-HELPERS-01] (test-item-1) fiscalStatusLabel exported from helpers', () => {
  const rootShell = createBillingHarness();
  const helpers   = rootShell.require('views.billingAdminHelpers');

  assert.equal(typeof helpers.fiscalStatusLabel, 'function', 'fiscalStatusLabel must be a function');
  assert.equal(helpers.fiscalStatusLabel('ACCEPTED'), 'Aceptada por Hacienda');
});

test('[W4-HELPERS-02] fiscalStatusBadgeClass exported from helpers', () => {
  const rootShell = createBillingHarness();
  const helpers   = rootShell.require('views.billingAdminHelpers');

  assert.equal(typeof helpers.fiscalStatusBadgeClass, 'function', 'fiscalStatusBadgeClass must be a function');
  assert.equal(helpers.fiscalStatusBadgeClass('ACCEPTED'), 'badge badge-success');
  assert.equal(helpers.fiscalStatusBadgeClass('REJECTED'), 'badge badge-danger');
});

test('[W4-HELPERS-03] fiscalStatusDescription exported from helpers', () => {
  const rootShell = createBillingHarness();
  const helpers   = rootShell.require('views.billingAdminHelpers');

  assert.equal(typeof helpers.fiscalStatusDescription, 'function', 'fiscalStatusDescription must be a function');
  assert.ok(helpers.fiscalStatusDescription('PENDING').length > 0, 'description must be non-empty');
});

test('[W4-HELPERS-04] all six statuses have distinct non-empty labels', () => {
  const rootShell  = createBillingHarness();
  const helpers    = rootShell.require('views.billingAdminHelpers');
  const statuses   = ['PENDING', 'PROCESSING', 'ACCEPTED', 'REJECTED', 'ERROR_RETRYABLE', 'ERROR_FINAL'];
  const labels     = statuses.map((s) => helpers.fiscalStatusLabel(s));
  const unique     = new Set(labels);

  assert.equal(unique.size, 6, 'all six statuses must have distinct labels');
  labels.forEach((l) => assert.ok(l && l.length > 0, `label must be non-empty: ${l}`));
});

test('[W4-HELPERS-05] all six statuses have non-empty descriptions', () => {
  const rootShell = createBillingHarness();
  const helpers   = rootShell.require('views.billingAdminHelpers');
  const statuses  = ['PENDING', 'PROCESSING', 'ACCEPTED', 'REJECTED', 'ERROR_RETRYABLE', 'ERROR_FINAL'];

  statuses.forEach((s) => {
    const desc = helpers.fiscalStatusDescription(s);
    assert.ok(desc && desc.length > 0, `description for ${s} must be non-empty`);
  });
});

test('[W4-HELPERS-06] unknown status gets a safe fallback description, not an error', () => {
  const rootShell = createBillingHarness();
  const helpers   = rootShell.require('views.billingAdminHelpers');

  const desc = helpers.fiscalStatusDescription('TOTALLY_UNKNOWN_XYZ');
  assert.ok(typeof desc === 'string' && desc.length > 0, 'must return a safe fallback string');
  assert.doesNotMatch(desc, /Error|error/, 'fallback description must be neutral, not an error message');
});

// ─── W4-NULL: fiscal=null state ───────────────────────────────────────────────

test('[W4-NULL-01] (test-item-1) fiscal=null renders neutral no-emission message', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(null);

  assert.match(html, /Este comprobante no tiene factura electr/,
    'null fiscal must show neutral no-emission message');
});

test('[W4-NULL-02] fiscal=null section still has accessible heading', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(null);

  assert.match(html, /billing-detail-fiscal-section/, 'section ID must be present even for null fiscal');
  assert.match(html, /Comprobante electr/, 'heading must be present even for null fiscal');
});

test('[W4-NULL-03] fiscal=null does NOT show ACCEPTED content (clave, consecutive, acceptedAt)', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(null);

  assert.doesNotMatch(html, /Clave:/, 'clave label must not appear for null fiscal');
  assert.doesNotMatch(html, /Consecutivo:/, 'consecutivo label must not appear for null fiscal');
  assert.doesNotMatch(html, /Aceptada:/, 'acceptedAt label must not appear for null fiscal');
});

// ─── W4-PENDING: PENDING state ────────────────────────────────────────────────

test('[W4-PENDING-01] (test-item-2) PENDING renders correct badge label', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(makeFiscal({ status: 'PENDING', clave: null, consecutive: null, acceptedAt: null }));

  assert.match(html, /Pendiente de emisi/, 'PENDING must show "Pendiente de emisión" label');
});

test('[W4-PENDING-02] (test-item-3) PENDING renders safe description', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(makeFiscal({ status: 'PENDING', clave: null, consecutive: null, acceptedAt: null }));

  assert.match(html, /cola de emisi/, 'PENDING description must mention queue/cola');
});

test('[W4-PENDING-03] PENDING does NOT render clave, consecutive or acceptedAt', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(makeFiscal({ status: 'PENDING', clave: null, consecutive: null, acceptedAt: null }));

  assert.doesNotMatch(html, /Clave:/, 'clave label must not appear for PENDING');
  assert.doesNotMatch(html, /Consecutivo:/, 'consecutivo must not appear for PENDING');
});

// ─── W4-PROC: PROCESSING state ────────────────────────────────────────────────

test('[W4-PROC-01] (test-item-4) PROCESSING renders correct badge label', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(makeFiscal({ status: 'PROCESSING', clave: null, consecutive: null, acceptedAt: null }));

  assert.match(html, /Enviando a Hacienda/, 'PROCESSING must show "Enviando a Hacienda" label');
  assert.match(html, /badge-info/, 'PROCESSING must use badge-info class');
});

test('[W4-PROC-02] (test-item-5) PROCESSING renders safe description', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(makeFiscal({ status: 'PROCESSING', clave: null, consecutive: null, acceptedAt: null }));

  assert.match(html, /Hacienda|respuesta/i, 'PROCESSING description must mention Hacienda/response');
});

test('[W4-PROC-03] PROCESSING does NOT render clave', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(makeFiscal({ status: 'PROCESSING', clave: null, consecutive: null, acceptedAt: null }));

  assert.doesNotMatch(html, /Clave:/, 'clave label must not appear for PROCESSING');
});

// ─── W4-ACCEPTED: ACCEPTED state ─────────────────────────────────────────────

test('[W4-ACCEPTED-01] (test-item-6) ACCEPTED renders accepted badge', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(makeFiscal());

  assert.match(html, /Aceptada por Hacienda/, 'ACCEPTED must show "Aceptada por Hacienda" label');
  assert.match(html, /badge-success/, 'ACCEPTED must use badge-success class');
});

test('[W4-ACCEPTED-02] (test-item-7) ACCEPTED renders clave field', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(makeFiscal({ clave: '50601012500312345678901234567890123456789012345678' }));

  assert.match(html, /Clave:/, 'Clave label must appear for ACCEPTED');
  assert.match(html, /50601012500312345678/, 'clave value must appear');
});

test('[W4-ACCEPTED-03] (test-item-8) ACCEPTED preserves complete clave string — no truncation or Number conversion', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const fullClave = '50601012500312345678901234567890123456789012345678';
  const html = renderers.renderFiscalStatusSection(makeFiscal({ clave: fullClave }));

  assert.match(html, new RegExp(fullClave), 'complete clave string must be preserved as-is');
  assert.doesNotMatch(html, /e\+|E\+/, 'clave must NOT be rendered in scientific notation');
});

test('[W4-ACCEPTED-04] (test-item-9) ACCEPTED renders consecutive field', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(makeFiscal({ consecutive: '00100001010000000001' }));

  assert.match(html, /Consecutivo:/, 'Consecutivo label must appear for ACCEPTED');
  assert.match(html, /00100001010000000001/, 'consecutive value must appear');
});

test('[W4-ACCEPTED-05] (test-item-10) consecutive preserves leading zeros exactly', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(makeFiscal({ consecutive: '00100001010000000001' }));

  // Must appear exactly with leading zeros, not as a number (1000010000001 or similar)
  assert.match(html, /00100001010000000001/, 'leading zeros in consecutive must be preserved exactly');
  assert.doesNotMatch(html, /^1000010/, 'consecutive must not lose leading zeros by numeric conversion');
});

test('[W4-ACCEPTED-06] (test-item-11) ACCEPTED renders acceptedAt date/time', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(makeFiscal({ acceptedAt: '2025-01-15T14:30:00.000Z' }));

  assert.match(html, /Aceptada:/, 'Aceptada label must appear');
  assert.match(html, /15(?:\/|-)01(?:\/|-)2025|2025/, 'formatted acceptedAt date must appear');
});

test('[W4-ACCEPTED-07] (test-item-12) ACCEPTED with acceptedAt=null renders safe placeholder', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(makeFiscal({ acceptedAt: null }));

  // Must not crash, must show placeholder dash
  assert.match(html, /Aceptada:/, 'Aceptada label must still appear');
  assert.match(html, /\u2014|\u2015|-/, 'placeholder dash must appear when acceptedAt is null');
  assert.doesNotMatch(html, /undefined|NaN/, 'undefined/NaN must not appear');
});

// ─── W4-REJECTED: REJECTED state ─────────────────────────────────────────────

test('[W4-REJECTED-01] (test-item-13) REJECTED renders correct badge label', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(makeFiscal({ status: 'REJECTED', clave: null, consecutive: null, acceptedAt: null }));

  assert.match(html, /Rechazada por Hacienda/, 'REJECTED must show "Rechazada por Hacienda"');
  assert.match(html, /badge-danger/, 'REJECTED must use badge-danger class');
});

test('[W4-REJECTED-02] (test-item-14) REJECTED renders safe description', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(makeFiscal({ status: 'REJECTED', clave: null, consecutive: null, acceptedAt: null }));

  assert.match(html, /soporte|Hacienda/i, 'REJECTED description must mention soporte or Hacienda');
});

test('[W4-REJECTED-03] REJECTED does NOT render clave or consecutive', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(makeFiscal({ status: 'REJECTED', clave: null, consecutive: null, acceptedAt: null }));

  assert.doesNotMatch(html, /Clave:/, 'clave must not appear for REJECTED');
  assert.doesNotMatch(html, /Consecutivo:/, 'consecutivo must not appear for REJECTED');
});

test('[W4-REJECTED-04] REJECTED description does NOT contain raw failureMessage', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  // Even if fiscal object has extra fields, they must not appear
  const fiscalWithInternals = {
    status: 'REJECTED',
    clave: null,
    consecutive: null,
    acceptedAt: null,
    failureMessage: 'env:SECRET_KEY_REJECTED',
    failureCode: 'BILLING_REJECTED',
  };

  const html = renderers.renderFiscalStatusSection(fiscalWithInternals);

  assert.doesNotMatch(html, /env:SECRET_KEY_REJECTED/, 'raw failureMessage value must not appear');
  assert.doesNotMatch(html, /BILLING_REJECTED/, 'raw failureCode must not appear');
});

// ─── W4-RETRY: ERROR_RETRYABLE state ─────────────────────────────────────────

test('[W4-RETRY-01] (test-item-15) ERROR_RETRYABLE renders correct badge label', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(makeFiscal({ status: 'ERROR_RETRYABLE', clave: null, consecutive: null, acceptedAt: null }));

  assert.match(html, /Error temporal/, 'ERROR_RETRYABLE must show "Error temporal" label');
  assert.match(html, /badge-warning/, 'ERROR_RETRYABLE must use badge-warning class');
});

test('[W4-RETRY-02] (test-item-16) ERROR_RETRYABLE renders safe description', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(makeFiscal({ status: 'ERROR_RETRYABLE', clave: null, consecutive: null, acceptedAt: null }));

  assert.ok(html.length > 0, 'must render a non-empty description');
});

test('[W4-RETRY-03] (test-item-24 AC-024) ERROR_RETRYABLE description mentions auto-retry', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(makeFiscal({ status: 'ERROR_RETRYABLE', clave: null, consecutive: null, acceptedAt: null }));

  assert.match(html, /reintentar|autom/i, 'ERROR_RETRYABLE description must mention retry or auto');
});

// ─── W4-FINAL: ERROR_FINAL state ─────────────────────────────────────────────

test('[W4-FINAL-01] (test-item-17) ERROR_FINAL renders correct badge label', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(makeFiscal({ status: 'ERROR_FINAL', clave: null, consecutive: null, acceptedAt: null }));

  assert.match(html, /Error de emisi/, 'ERROR_FINAL must show "Error de emisión" label');
  assert.match(html, /badge-danger/, 'ERROR_FINAL must use badge-danger class');
});

test('[W4-FINAL-02] (test-item-18) ERROR_FINAL renders safe description', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(makeFiscal({ status: 'ERROR_FINAL', clave: null, consecutive: null, acceptedAt: null }));

  assert.ok(html.length > 0, 'must render a non-empty description');
});

test('[W4-FINAL-03] (test-item-25 AC-025) ERROR_FINAL description mentions contact support', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(makeFiscal({ status: 'ERROR_FINAL', clave: null, consecutive: null, acceptedAt: null }));

  assert.match(html, /soporte|permanente/i, 'ERROR_FINAL description must mention support or permanent error');
});

// ─── W4-UNKNOWN: unknown status graceful degradation ─────────────────────────

test('[W4-UNKNOWN-01] (test-item-19) unknown status does not crash', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  // Must not throw
  let html;
  assert.doesNotThrow(() => {
    html = renderers.renderFiscalStatusSection(makeFiscal({ status: 'FUTURE_STATUS_V99', clave: null, consecutive: null, acceptedAt: null }));
  }, 'unknown fiscal status must not throw');
  assert.ok(typeof html === 'string' && html.length > 0, 'must return non-empty HTML for unknown status');
});

test('[W4-UNKNOWN-02] (test-item-20) unknown status is NOT presented as ACCEPTED', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(makeFiscal({
    status: 'FUTURE_STATUS_V99',
    clave: 'SOME_CLAVE_VALUE',
    consecutive: '001',
    acceptedAt: '2025-01-15T14:30:00.000Z',
  }));

  assert.doesNotMatch(html, /Aceptada por Hacienda/, 'unknown status must NOT show ACCEPTED label');
  assert.doesNotMatch(html, /badge-success/, 'unknown status must NOT use badge-success (ACCEPTED style)');
  // clave and consecutive must not be rendered because status !== 'ACCEPTED'
  assert.doesNotMatch(html, /SOME_CLAVE_VALUE/, 'clave must not render for unknown status');
  assert.doesNotMatch(html, /Clave:/, 'Clave label must not appear for unknown status');
});

test('[W4-UNKNOWN-03] unknown status renders safe description fallback', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(makeFiscal({ status: 'FUTURE_STATUS_V99', clave: null, consecutive: null, acceptedAt: null }));

  assert.match(html, /Estado fiscal no reconocido|desconocido/i,
    'unknown status must render the safe fallback description');
});

// ─── W4-INDEP: commercial/fiscal independence ─────────────────────────────────

test('[W4-INDEP-01] (test-item-21) commercial PENDING + fiscal ACCEPTED show both independently', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderInvoiceDetailContent(makeInvoice({
    status: 'PENDING',
    fiscal: makeFiscal({ status: 'ACCEPTED' }),
  }));

  // Commercial: PENDING
  assert.match(html, /Estado comercial/, 'commercial status section must be present');
  assert.match(html, /Pendiente/, 'commercial PENDING label must appear');
  // Fiscal: ACCEPTED
  assert.match(html, /Comprobante electr/, 'fiscal section must be present');
  assert.match(html, /Aceptada por Hacienda/, 'fiscal ACCEPTED label must appear');
  // The two must not overwrite each other
  assert.match(html, /Pendiente[\s\S]*Aceptada por Hacienda|Aceptada por Hacienda[\s\S]*Pendiente/,
    'both commercial and fiscal statuses must coexist in the HTML');
});

test('[W4-INDEP-02] (test-item-22) commercial PAID + fiscal PROCESSING show both independently', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderInvoiceDetailContent(makeInvoice({
    status: 'PAID',
    fiscal: makeFiscal({ status: 'PROCESSING', clave: null, consecutive: null, acceptedAt: null }),
  }));

  assert.match(html, /Pagado/, 'commercial PAID must appear');
  assert.match(html, /Enviando a Hacienda/, 'fiscal PROCESSING must appear');
});

test('[W4-INDEP-03] fiscal status is not inferred from commercial status or payment data', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  // Paid invoice with null fiscal — must NOT show any ACCEPTED fiscal badge
  const html = renderers.renderInvoiceDetailContent(makeInvoice({
    status: 'PAID',
    fiscal: null,
    payments: [{ id: 1, paymentMethod: 'CASH', amount: 125000, status: 'APPROVED', createdAt: '2025-01-15T14:30:00.000Z', approvedAt: null, reference: null, bankName: null, cardType: null }],
  }));

  assert.doesNotMatch(html, /Aceptada por Hacienda/, 'fiscal ACCEPTED must not appear when fiscal is null, even if invoice is PAID');
  assert.match(html, /Este comprobante no tiene factura electr/, 'null fiscal neutral message must appear');
});

// ─── W4-SEC: security — no FiscalIntent internals ────────────────────────────

test('[W4-SEC-01] (test-item-23) raw failureMessage not rendered', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const fiscalWithInternals = {
    status: 'REJECTED',
    clave: null,
    consecutive: null,
    acceptedAt: null,
    failureMessage: 'env:BILLING_SECRET_KEY_EXPOSED',
  };

  const html = renderers.renderFiscalStatusSection(fiscalWithInternals);

  assert.doesNotMatch(html, /failureMessage/, 'field name failureMessage must not appear');
  assert.doesNotMatch(html, /env:BILLING_SECRET_KEY_EXPOSED/, 'failureMessage value must not appear');
});

test('[W4-SEC-02] (test-item-24) failureCode not rendered', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection({ status: 'ERROR_FINAL', clave: null, consecutive: null, acceptedAt: null, failureCode: 'BILLING_AUTH_FAILURE' });

  assert.doesNotMatch(html, /failureCode/, 'failureCode field name must not appear');
  assert.doesNotMatch(html, /BILLING_AUTH_FAILURE/, 'failureCode value must not appear');
});

test('[W4-SEC-03] (test-item-25) retryCount not rendered', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection({ status: 'ERROR_RETRYABLE', clave: null, consecutive: null, acceptedAt: null, retryCount: 7 });

  assert.doesNotMatch(html, /retryCount/, 'retryCount field name must not appear');
  assert.doesNotMatch(html, /\b7\b.*retry|\bretry.*\b7\b/i, 'retryCount value must not appear');
});

test('[W4-SEC-04] (test-item-26) billingFiscalDocumentId not rendered', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection({ status: 'ACCEPTED', clave: 'abc', consecutive: '001', acceptedAt: null, billingFiscalDocumentId: 'billing-secret-doc-id' });

  assert.doesNotMatch(html, /billingFiscalDocumentId/, 'billingFiscalDocumentId field name must not appear');
  assert.doesNotMatch(html, /billing-secret-doc-id/, 'billingFiscalDocumentId value must not appear');
});

test('[W4-SEC-05] (test-item-27) Billing IDs and secrets not rendered', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const fiscalLeaky = {
    status:              'ACCEPTED',
    clave:               'clave-ok',
    consecutive:         '001',
    acceptedAt:          '2025-01-15T14:30:00.000Z',
    idempotencyKey:      'idem-key-secret-value',
    billingStatus:       'BILLING_INTERNAL_STATUS',
    processingNodeId:    'node-billing-001',
    billingPayload:      '{"secret":"payload"}',
    nextRetryAt:         '2025-01-20T00:00:00Z',
    lastAttemptAt:       '2025-01-15T00:00:00Z',
    billingCompanyId:    'billing-tenant-abc',
  };

  const html = renderers.renderFiscalStatusSection(fiscalLeaky);

  assert.doesNotMatch(html, /idempotencyKey/,      'idempotencyKey must not appear');
  assert.doesNotMatch(html, /billingStatus/,       'billingStatus must not appear');
  assert.doesNotMatch(html, /processingNodeId/,    'processingNodeId must not appear');
  assert.doesNotMatch(html, /billingPayload/,      'billingPayload must not appear');
  assert.doesNotMatch(html, /idem-key-secret/,     'idempotencyKey value must not appear');
  assert.doesNotMatch(html, /BILLING_INTERNAL/,    'Billing internal status must not appear');
  assert.doesNotMatch(html, /node-billing-001/,    'billing node ID must not appear');
  assert.doesNotMatch(html, /billing-tenant-abc/,  'billing company ID must not appear');
});

test('[W4-SEC-06] (Wave 5 activated) fiscal-artifacts in renderers use Inventori proxy path only', () => {
  // Wave 5 implemented: renderers now contain fiscal-artifacts references.
  // Guard: references must be Inventori-relative paths, never direct Billing URLs.
  const renderersSource = readRootFile('views/billing-admin.renderers.js');

  assert.match(renderersSource, /fiscal-artifacts/,
    'Wave 5: fiscal-artifacts must be referenced in renderers');
  assert.doesNotMatch(renderersSource, /https?:\/\/.*fiscal-artifact|billing\..*artifact/i,
    'fiscal-artifact path in renderers must be Inventori-relative, not a Billing URL');
});

// ─── W4-A11Y: accessibility ───────────────────────────────────────────────────

test('[W4-A11Y-01] (test-item-33) fiscal section has accessible heading via aria-labelledby', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(makeFiscal());

  assert.match(html, /aria-labelledby="billing-detail-fiscal-heading"/, 'section must have aria-labelledby');
  assert.match(html, /id="billing-detail-fiscal-heading"/, 'heading element must have matching ID');
});

test('[W4-A11Y-02] (test-item-34) fiscal status has textual meaning independent of CSS color', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');
  const statuses  = ['PENDING', 'PROCESSING', 'ACCEPTED', 'REJECTED', 'ERROR_RETRYABLE', 'ERROR_FINAL'];

  statuses.forEach((s) => {
    const html = renderers.renderFiscalStatusSection(makeFiscal({ status: s, clave: null, consecutive: null, acceptedAt: null }));
    // The badge must contain visible text (not just rely on color via CSS class)
    const helpers = rootShell.require('views.billingAdminHelpers');
    const labelText = helpers.fiscalStatusLabel(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(html, new RegExp(labelText), `badge for ${s} must contain visible text "${helpers.fiscalStatusLabel(s)}"`);
  });
});

test('[W4-A11Y-03] fiscal section heading text is "Comprobante electrónico"', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(null);

  assert.match(html, /Comprobante electr\u00F3nico|Comprobante electr\\u00F3nico/,
    'section heading must be "Comprobante electrónico"');
});

// ─── W4-RESP: responsive markup ───────────────────────────────────────────────

test('[W4-RESP-01] (test-item-31) ACCEPTED clave uses word-break:break-all for responsive display', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(makeFiscal());

  assert.match(html, /word-break:break-all/, 'clave must use word-break:break-all');
});

test('[W4-RESP-02] (test-item-32) ACCEPTED consecutive uses overflow-wrap or word-break for responsive display', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(makeFiscal());

  assert.match(html, /overflow-wrap:break-word|word-break:break-all/,
    'consecutive must use responsive overflow-wrap or word-break');
});

test('[W4-RESP-03] ACCEPTED fiscal section uses no fixed pixel width constraints', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(makeFiscal());

  assert.doesNotMatch(html, /width:\s*\d{3,4}px/,
    'fiscal section must not use fixed pixel widths that break responsive layout');
});

// ─── W4-SRC: source-level contract guards ────────────────────────────────────

test('[W4-SRC-01] (test-item-36 reg) renderFiscalStatusSection is exported from renderers', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  assert.equal(typeof renderers.renderFiscalStatusSection, 'function',
    'renderFiscalStatusSection must be exported from views.billingAdminRenderers');
});

test('[W4-SRC-02] (Wave 5 updated) no fiscal submission or re-emission controls in renderer source', () => {
  const source = readRootFile('views/billing-admin.renderers.js');

  // Fiscal re-emission/re-send controls are forbidden.
  // Note: "Reintentar" is allowed in Wave 5+ as an artifact-load retry (not a fiscal mutation).
  assert.doesNotMatch(source, /Reenviar|Emitir|Reemitir|Reiniciar.*fiscal/i,
    'no fiscal re-emit or re-send action buttons must appear in renderer');
  assert.doesNotMatch(source, /Enviar a Hacienda.*button|button.*Enviar a Hacienda/i,
    'no "send to Hacienda" action button must appear in renderer');
});

test('[W4-SRC-03] (test-item-29) no direct Billing communication introduced in Wave 4', () => {
  const renderersSource = readRootFile('views/billing-admin.renderers.js');
  const helpersSource   = readRootFile('views/billing-admin.helpers.js');
  const apiSource       = readRootFile('billing-api.js');
  const combined        = renderersSource + helpersSource + apiSource;

  assert.doesNotMatch(combined, /billing\.api\.|billingApiUrl|billingDirectUrl|https:\/\/.*billing/i,
    'no direct Billing API URL must appear in Wave 4 source');
});

test('[W4-SRC-04] (Wave 5 activated) fiscal-artifacts in admin source uses listFiscalArtifacts only', () => {
  // Wave 5 implemented: billing-admin.js now calls listFiscalArtifacts for ACCEPTED invoices.
  // Guard: the artifact call must be gated on ACCEPTED status and use the API function.
  const adminSource = readRootFile('views/billing-admin.js');

  assert.match(adminSource, /fiscal-artifacts|listFiscalArtifacts/,
    'Wave 5: billing-admin.js must now reference fiscal artifact loading');
  assert.doesNotMatch(adminSource, /https?:\/\/.*fiscal-artifact|billing\..*artifact/i,
    'billing-admin.js artifact reference must not point to Billing directly');
});

// ─── W4-REG: Wave 2/3 regression ─────────────────────────────────────────────

test('[W4-REG-01] (test-item-35) Wave 3 commercial detail sections remain unchanged after Wave 4', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderInvoiceDetailContent(makeInvoice({
    status: 'PAID',
    fiscal: null,
    clientName: 'TestClient SA',
    amount: 99000,
  }));

  // All Wave 3 sections must still be present
  assert.match(html, /Informaci\u00F3n general|Informaci&#x2F;on general|Informaci/,
    'Información general section must remain');
  assert.match(html, /Estado comercial/, 'Estado comercial section must remain');
  assert.match(html, /Pagos registrados/, 'Pagos registrados section must remain');
  assert.match(html, /TestClient SA/, 'client name must still render');
  assert.match(html, /Pagado/, 'commercial PAID status must still render');
});

test('[W4-REG-02] (test-item-36) Wave 2 receivables list fiscal badges still render correctly', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const invoices = [
    { id: 1, invoiceNumber: 'INV-001', amount: 1000, pendingAmount: 1000, status: 'PENDING', dueAt: null, fiscal: { status: 'ACCEPTED' }, payments: [], client: { name: 'A' } },
    { id: 2, invoiceNumber: 'INV-002', amount: 2000, pendingAmount: 2000, status: 'PENDING', dueAt: null, fiscal: { status: 'PENDING'  }, payments: [], client: { name: 'B' } },
    { id: 3, invoiceNumber: 'INV-003', amount: 3000, pendingAmount: 3000, status: 'PENDING', dueAt: null, fiscal: null, payments: [], client: { name: 'C' } },
  ];

  const html = renderers.renderReceivablesTable(invoices);

  assert.match(html, /Aceptada/,   'Wave 2 ACCEPTED fiscal badge must still render in list');
  assert.match(html, /En cola/,    'Wave 2 PENDING fiscal badge must still render in list');
  assert.match(html, /badge-success/, 'Wave 2 ACCEPTED badge class must still render');
  // The detail button must also still be there
  assert.match(html, /billing-detail-btn/, 'Wave 3 detail button must still render in receivables table');
});
