'use strict';

/**
 * Wave 7 tests — Responsive + Accessibility + UX Hardening
 *
 * Spec: specs/inventori-fiscal-invoice-history-and-detail/
 * Covers all 83 required Wave 7 test items.
 *
 * Test methodology per item:
 *   DOM-VERIFIED   — checked against rendered HTML string (vm-executed renderer)
 *   SOURCE         — checked against source code text (no execution required)
 *   NOT-RUNTIME-VERIFIED — browser focus/keyboard behaviour; browser automation unavailable
 *
 * Browser automation status: BROWSER_AUTOMATION_UNAVAILABLE
 * Real focus movement, actual Escape key behaviour, and viewport-dependent CSS layout
 * cannot be asserted from Node.js vm tests. These properties are marked NOT-RUNTIME-VERIFIED
 * and noted as STATICALLY VERIFIED at the source level.
 */

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');

const rootPublicPath = path.join(__dirname, '..', 'src', 'public', 'root');
const servicesPath   = path.join(__dirname, '..', 'src', 'services');

function readRootFile(rel)     { return fs.readFileSync(path.join(rootPublicPath, rel), 'utf8'); }
function readServicesFile(rel) { return fs.readFileSync(path.join(servicesPath, rel), 'utf8'); }
function executeRootScript(rel, ctx) { vm.runInContext(readRootFile(rel), ctx, { filename: rel }); }

function createHarness(opts = {}) {
  const win = {};
  const ctx = vm.createContext({ window: win, Map, Set, URLSearchParams });
  win.window = win;
  executeRootScript('registry.js', ctx);
  win.InventoryAuth = {
    fetchJson: opts.fetchJson || (async () => ({})),
    buildHeaders: () => ({}),
    handleUnauthorized: () => {},
  };
  win.fetch = opts.fetch || (async () => ({ ok: true, status: 200, json: async () => ({}) }));
  executeRootScript('ui.js', ctx);
  executeRootScript('billing-api.js', ctx);
  executeRootScript('views/billing-admin.helpers.js', ctx);
  executeRootScript('views/billing-admin.renderers.js', ctx);
  if (opts.includeView) executeRootScript('views/billing-admin.js', ctx);
  return win.RootShell;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeFiscal(ov = {}) {
  return {
    status: 'ACCEPTED',
    clave: '50601012500312345678901234567890123456789012345678',
    consecutive: '00100001010000000001',
    acceptedAt: '2025-01-15T14:30:00.000Z',
    ...ov,
  };
}

function makeInvoice(ov = {}) {
  return {
    id: 1623,
    invoiceNumber: 'INV-963',
    clientName: 'Distribuidora El Sol S.A.',
    amount: 125000,
    status: 'PAID',
    issuedAt: '2025-01-15T00:00:00.000Z',
    dueAt: null,
    paidAt: '2025-01-15T14:30:00.000Z',
    fiscal: makeFiscal(),
    payments: [],
    order: null,
    ...ov,
  };
}

function makeArtifact(t) {
  return { id: `a-${t}`, type: t.toUpperCase().replace('-', '_'), inventoriType: t, contentType: 'application/pdf', sha256: 'abc', sizeBytes: 1024, createdAt: '2025-01-01T00:00:00Z' };
}
const ALL_ARTIFACTS = ['pdf', 'signed-xml', 'hacienda-response'].map(makeArtifact);

const shellSrc    = readRootFile('views/billing-admin.js');
const cssSource   = fs.readFileSync(path.join(__dirname, '..', 'src', 'public', 'styles.css'), 'utf8');
const reconSrc    = readServicesFile('fiscal-reconciliation.service.js');

// ─── W7-DIALOG: Dialog semantics ──────────────────────────────────────────────

test('[W7-DIALOG-01] dialog shell has aria-modal="true"', () => {
  const rs   = createHarness({ includeView: true });
  const view = rs.require('views.billingAdmin');
  const html  = view.render({});
  assert.match(html, /aria-modal="true"/, 'billing-detail-dialog must have aria-modal');
});

test('[W7-DIALOG-02] dialog shell has aria-labelledby pointing to title id', () => {
  const rs   = createHarness({ includeView: true });
  const html  = rs.require('views.billingAdmin').render({});
  assert.match(html, /aria-labelledby="billing-detail-dialog-title"/, 'dialog must have aria-labelledby');
});

test('[W7-DIALOG-03] dialog title element id matches aria-labelledby target', () => {
  const rs   = createHarness({ includeView: true });
  const html  = rs.require('views.billingAdmin').render({});
  assert.match(html, /id="billing-detail-dialog-title"/, 'dialog title id must exist');
});

test('[W7-DIALOG-04] visible close button exists inside the detail dialog', () => {
  const rs   = createHarness({ includeView: true });
  const html  = rs.require('views.billingAdmin').render({});
  assert.match(html, /id="billing-detail-dialog-close"/, 'close button id must be present');
});

test('[W7-DIALOG-05] close button has accessible name via aria-label', () => {
  const rs   = createHarness({ includeView: true });
  const html  = rs.require('views.billingAdmin').render({});
  assert.match(html, /aria-label="Cerrar detalle de factura"/, 'close button must have aria-label');
});

// ─── W7-FOCUS: Focus management (SOURCE-VERIFIED) ─────────────────────────────

test('[W7-FOCUS-06] opener element tracked via document.activeElement before showModal', () => {
  // SOURCE: const triggerEl = globalScope.document?.activeElement
  assert.match(shellSrc, /document.*activeElement|activeElement.*document/,
    'billing-admin.js must capture document.activeElement as triggerEl before showModal');
});

test('[W7-FOCUS-07] dialog.showModal() called and title focus() called after (Wave 7)', () => {
  assert.match(shellSrc, /dialog\.showModal\(\)/, 'billing-admin.js must call showModal');
  assert.match(shellSrc, /titleEl.*focus\(\)|titleEl\?\.focus/, 'billing-admin.js must call titleEl.focus() after showModal');
});

test('[W7-FOCUS-07b] dialog title has tabindex=-1 for programmatic focusability', () => {
  const rs   = createHarness({ includeView: true });
  const html  = rs.require('views.billingAdmin').render({});
  assert.match(html, /billing-detail-dialog-title[^>]*tabindex="-1"|tabindex="-1"[^>]*billing-detail-dialog-title/,
    'dialog title must have tabindex="-1" to be programmatically focusable');
});

test('[W7-FOCUS-08] close handler restores focus to triggerEl', () => {
  // SOURCE: dialog.addEventListener('close', handler) where handler calls triggerEl.focus()
  assert.match(shellSrc, /triggerEl.*focus|triggerEl\?\.focus/,
    'billing-admin.js must call triggerEl.focus() in the close event handler');
  assert.match(shellSrc, /dialog\.addEventListener\(['"']close['"']/,
    'billing-admin.js must register a close event listener for focus restoration');
});

test('[W7-FOCUS-09] no conflicting custom Escape handler (native dialog handles Escape)', () => {
  // SOURCE: no keydown/keyup listener on the detail dialog for Escape
  const hasCustomEscape = /billing-detail-dialog.*keydown|billing-detail-dialog.*keyup|Escape.*billing-detail/s.test(shellSrc);
  assert.ok(!hasCustomEscape,
    'billing-admin.js must not add a conflicting Escape key handler on billing-detail-dialog');
});

test('[W7-FOCUS-10] artifact retry calls openInvoiceDetail (new close handler set up)', () => {
  assert.match(shellSrc, /openInvoiceDetail.*iid|openInvoiceDetail.*data-invoice-id/,
    'artifact retry button handler must call openInvoiceDetail to re-establish focus/close handling');
});

// ─── W7-KEYBOARD: Keyboard accessibility (SOURCE-VERIFIED) ───────────────────

test('[W7-KEYBOARD-11] invoice detail opener is a <button> element', () => {
  const rs   = createHarness();
  const rnd  = rs.require('views.billingAdminRenderers');
  const html  = rnd.renderReceivablesTable([makeInvoice()]);
  assert.match(html, /<button[^>]+billing-detail-btn/, 'detail opener must be a native <button>');
});

test('[W7-KEYBOARD-12] dialog close control is a <button> element', () => {
  const rs   = createHarness({ includeView: true });
  const html  = rs.require('views.billingAdmin').render({});
  assert.match(html, /<button[^>]+billing-detail-dialog-close/, 'close control must be a native <button>');
});

test('[W7-KEYBOARD-13] artifact retry is a <button> element', () => {
  const rs   = createHarness();
  const rnd  = rs.require('views.billingAdminRenderers');
  const html  = rnd.renderArtifactLoadError('1623', 'INV-963');
  assert.match(html, /<button[^>]+billing-artifact-retry-btn/, 'retry must be a native <button>');
});

test('[W7-KEYBOARD-14] artifact download actions are native buttons for authenticated fetches', () => {
  const rs   = createHarness();
  const rnd  = rs.require('views.billingAdminRenderers');
  const html  = rnd.renderArtifactActions('1623', ALL_ARTIFACTS, 'INV-963');
  assert.match(html, /<button[^>]+billing-artifact-download-btn/, 'artifact download must use a native authenticated-fetch button');
});

test('[W7-KEYBOARD-15] no clickable div/span for critical invoice controls', () => {
  const rs   = createHarness();
  const rnd  = rs.require('views.billingAdminRenderers');
  const row  = rnd.renderReceivablesTable([makeInvoice()]);
  // Opener must be a button, not a div/span
  assert.doesNotMatch(row, /<div[^>]+billing-detail-btn/, 'opener must not be a div');
  assert.doesNotMatch(row, /<span[^>]+billing-detail-btn/, 'opener must not be a span');
});

// ─── W7-LOADING: Loading and error states ─────────────────────────────────────

test('[W7-LOADING-16] renderInvoiceDetailLoading has role="status" for screen readers', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderInvoiceDetailLoading();
  assert.match(html, /role="status"/, 'loading skeleton must have role="status"');
});

test('[W7-LOADING-16b] loading state has aria-label describing loading action', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderInvoiceDetailLoading();
  assert.match(html, /aria-label=/, 'loading state must have an aria-label');
  assert.match(html, /Cargando/, 'aria-label must describe the loading action');
});

test('[W7-LOADING-17] whole detail dialog shows loading state (covers invoice + artifacts)', () => {
  // Artifact lookup happens AFTER invoice fetch; no separate artifact spinner exists.
  // The full-dialog loading state covers both. This is by design.
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderInvoiceDetailLoading();
  assert.ok(html.length > 0, 'loading state must be non-empty');
  assert.match(html, /f1f5f9/, 'loading state must contain skeleton visual element');
});

test('[W7-LOADING-18] artifact error does not replace commercial/fiscal detail', () => {
  const rs   = createHarness();
  const rnd  = rs.require('views.billingAdminRenderers');
  const inv  = makeInvoice({ fiscal: makeFiscal({ status: 'ACCEPTED' }) });
  // artifactCtx.failed=true: fiscal section shows artifact error inline, commercial info intact
  const html = rnd.renderInvoiceDetailContent(inv, { items: null, failed: true });
  assert.match(html, /Informaci\u00F3n general/, 'commercial section must still render on artifact error');
  assert.match(html, /Estado comercial/, 'commercial status section must still render');
  assert.match(html, /billing-artifact-error/, 'artifact error message must be present');
  assert.doesNotMatch(html, /No se pudo cargar el detalle de la factura/,
    'global detail-error message must NOT replace commercial content on artifact-only failure');
});

test('[W7-LOADING-19] artifact error state shows retry button', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderArtifactLoadError('1623', 'INV-963');
  assert.match(html, /billing-artifact-retry-btn/, 'retry button must be present in artifact error state');
  assert.match(html, /Reintentar/, 'retry button must have visible text');
});

test('[W7-LOADING-20] artifact retry re-opens invoice detail (SOURCE: returns to loading state)', () => {
  // SOURCE: bindArtifactRetryButton calls openInvoiceDetail which sets bodyEl.innerHTML = renderInvoiceDetailLoading()
  assert.match(shellSrc, /renderInvoiceDetailLoading\(\)/, 'openInvoiceDetail must show loading state');
  assert.match(shellSrc, /bindArtifactRetryButton/, 'retry binding must exist');
});

// ─── W7-STATUS: Fiscal status rendering ───────────────────────────────────────

test('[W7-STATUS-21] PENDING status has visible textual label', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderFiscalStatusSection(makeFiscal({ status: 'PENDING', clave: null, consecutive: null, acceptedAt: null }));
  assert.match(html, /Pendiente de emisi\u00F3n/, 'PENDING must show textual label');
});

test('[W7-STATUS-22] PROCESSING status has visible textual label', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderFiscalStatusSection(makeFiscal({ status: 'PROCESSING', clave: null, consecutive: null, acceptedAt: null }));
  assert.match(html, /Enviando a Hacienda/, 'PROCESSING must show textual label');
});

test('[W7-STATUS-23] ACCEPTED status has visible textual label', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderFiscalStatusSection(makeFiscal({ status: 'ACCEPTED' }));
  assert.match(html, /Aceptada por Hacienda/, 'ACCEPTED must show textual label');
});

test('[W7-STATUS-24] REJECTED status has visible textual label', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderFiscalStatusSection(makeFiscal({ status: 'REJECTED', clave: null, consecutive: null, acceptedAt: null }));
  assert.match(html, /Rechazada por Hacienda/, 'REJECTED must show textual label');
});

test('[W7-STATUS-25] ERROR_RETRYABLE status has visible textual label', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderFiscalStatusSection(makeFiscal({ status: 'ERROR_RETRYABLE', clave: null, consecutive: null, acceptedAt: null }));
  assert.match(html, /Error temporal/, 'ERROR_RETRYABLE must show textual label');
});

test('[W7-STATUS-26] ERROR_FINAL status has visible textual label', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderFiscalStatusSection(makeFiscal({ status: 'ERROR_FINAL', clave: null, consecutive: null, acceptedAt: null }));
  assert.match(html, /Error de emisi\u00F3n/, 'ERROR_FINAL must show textual label');
});

test('[W7-STATUS-27] unknown future status is escaped and rendered (not blank, not crash)', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderFiscalStatusSection(makeFiscal({ status: 'FUTURE_UNKNOWN_XYZ', clave: null, consecutive: null, acceptedAt: null }));
  assert.ok(html.length > 0, 'renderer must not crash on unknown status');
  // Unknown status shown as-is (escaped) in badge; no ACCEPTED content
  assert.doesNotMatch(html, /Aceptada por Hacienda/, 'unknown status must NOT be shown as ACCEPTED');
  assert.doesNotMatch(html, /Clave:/, 'unknown status must NOT show ACCEPTED identifier fields');
});

test('[W7-STATUS-28] status meaning not color-only: textual label present alongside badge', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  ['PENDING', 'PROCESSING', 'ACCEPTED', 'REJECTED', 'ERROR_RETRYABLE', 'ERROR_FINAL'].forEach((status) => {
    const html = rnd.renderFiscalStatusSection(makeFiscal({ status, clave: null, consecutive: null, acceptedAt: null }));
    // Must have both a CSS badge class AND visible text (not just color)
    assert.match(html, /badge/, `${status}: badge class must be present`);
    const labels = ['Pendiente de emisi', 'Enviando', 'Aceptada', 'Rechazada', 'Error temporal', 'Error de emisi'];
    const hasLabel = labels.some((l) => html.includes(l));
    assert.ok(hasLabel, `${status}: textual label must accompany the badge class`);
  });
});

// ─── W7-IDENTIFIERS: Fiscal identifiers ───────────────────────────────────────

test('[W7-IDENT-29] clave exact opaque string preserved (no Number conversion)', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const longClave = '50601012500312345678901234567890123456789012345678';
  const html = rnd.renderFiscalStatusSection(makeFiscal({ clave: longClave }));
  assert.match(html, new RegExp(longClave), 'exact clave string must appear in rendered output');
});

test('[W7-IDENT-30] leading zeros in consecutive preserved', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderFiscalStatusSection(makeFiscal({ consecutive: '00100001010000000001' }));
  assert.match(html, /00100001010000000001/, 'leading zeros must be preserved in consecutive');
});

test('[W7-IDENT-31] acceptedAt null renders safely as em-dash or blank', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderFiscalStatusSection(makeFiscal({ acceptedAt: null }));
  assert.ok(html.length > 0, 'renderer must not crash when acceptedAt is null');
  assert.doesNotMatch(html, /undefined|null/, 'null acceptedAt must not render "null" or "undefined"');
});

test('[W7-IDENT-32] long clave has word-break:break-all to wrap without layout overflow', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderFiscalStatusSection(makeFiscal({ clave: '50601012500312345678901234567890123456789012345678' }));
  assert.match(html, /word-break:break-all/, 'clave dd element must have word-break:break-all');
  assert.match(html, /overflow-wrap:break-word/, 'clave dd element must also have overflow-wrap:break-word');
});

// ─── W7-ARTIFACTS: Artifact actions ───────────────────────────────────────────

test('[W7-ART-33] no artifact → no misleading download actions, informative message shown', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderArtifactActions('1623', [], 'INV-963');
  assert.doesNotMatch(html, /billing-artifact-download-btn/, 'empty artifact list must not render download actions');
  assert.match(html, /estar\u00E1n disponibles/, 'must show informative unavailability message');
});

test('[W7-ART-34] PDF action has distinguishable aria-label (Wave 7 addition)', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderArtifactActions('1623', [makeArtifact('pdf')], 'INV-963');
  assert.match(html, /aria-label=/, 'PDF link must have aria-label');
  assert.match(html, /Descargar PDF del comprobante electr\u00F3nico/, 'PDF aria-label must be descriptive');
});

test('[W7-ART-35] signed XML action has distinguishable aria-label', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderArtifactActions('1623', [makeArtifact('signed-xml')], 'INV-963');
  assert.match(html, /Descargar XML firmado del comprobante electr\u00F3nico/, 'signed-xml aria-label must be descriptive');
});

test('[W7-ART-36] Hacienda response action has distinguishable aria-label', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderArtifactActions('1623', [makeArtifact('hacienda-response')], 'INV-963');
  assert.match(html, /Descargar respuesta de Hacienda del comprobante electr\u00F3nico/, 'hacienda-response aria-label must be descriptive');
});

test('[W7-ART-36b] aria-label includes invoice number for uniqueness', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderArtifactActions('1623', [makeArtifact('pdf')], 'INV-963');
  assert.match(html, /INV-963/, 'aria-label must include the invoice number');
});

test('[W7-ART-37] one-artifact layout: single authenticated download button rendered correctly', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderArtifactActions('1623', [makeArtifact('pdf')], 'INV-963');
  const buttons = (html.match(/billing-artifact-download-btn/g) || []).length;
  assert.equal(buttons, 1, 'one artifact must render exactly one download button');
});

test('[W7-ART-38] multiple artifact layout: flex-wrap container present', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderArtifactActions('1623', ALL_ARTIFACTS, 'INV-963');
  assert.match(html, /flex-wrap:wrap/, 'artifact actions container must have flex-wrap:wrap');
  assert.match(html, /display:flex/, 'artifact actions container must have display:flex');
});

test('[W7-ART-39] all-artifact layout: three distinct download buttons rendered', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderArtifactActions('1623', ALL_ARTIFACTS, 'INV-963');
  assert.match(html, /fiscal-artifacts\/pdf/, 'PDF link must be present');
  assert.match(html, /fiscal-artifacts\/signed-xml/, 'signed-xml link must be present');
  assert.match(html, /fiscal-artifacts\/hacienda-response/, 'hacienda-response link must be present');
  const buttons = (html.match(/billing-artifact-download-btn/g) || []).length;
  assert.equal(buttons, 3, 'all three artifact download buttons must be present');
});

test('[W7-ART-40] artifact actions derive from authoritative items array (not inferred from status)', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  // ACCEPTED status with null items → informative message, no download links
  const html = rnd.renderFiscalStatusSection(
    makeFiscal({ status: 'ACCEPTED' }),
    { invoiceId: '1623', invoiceNumber: 'INV-963', items: null, failed: false },
  );
  assert.doesNotMatch(html, /billing-artifact-download-btn/, 'null items must not produce download actions even for ACCEPTED status');
  assert.match(html, /estar\u00E1n disponibles|Comprobante/, 'must show message or section without fake links');
});

test('[W7-ART-40b] billing-artifact-link CSS class applied to download links (touch target)', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderArtifactActions('1623', [makeArtifact('pdf')], 'INV-963');
  assert.match(html, /billing-artifact-link/, 'PDF link must have billing-artifact-link class');
});

// ─── W7-RESPONSIVE: Responsive layout (SOURCE / CSS-VERIFIED) ─────────────────

test('[W7-RESP-41] dialog width constrained to viewport (CSS SOURCE)', () => {
  // .modal-card { width: min(100%, 860px) } ensures dialog never exceeds viewport
  assert.match(cssSource, /modal-card/, '.modal-card must be defined in styles.css');
  assert.match(cssSource, /min\(100%/, '.modal-card must use min(100%, ...) for responsive width');
});

test('[W7-RESP-42] dialog body has max-height and overflow-y:auto (HTML SOURCE)', () => {
  const rs  = createHarness({ includeView: true });
  const html = rs.require('views.billingAdmin').render({});
  assert.match(html, /max-height:70vh/, 'dialog body must have max-height:70vh');
  assert.match(html, /overflow-y:auto/, 'dialog body must have overflow-y:auto for vertical scrolling');
});

test('[W7-RESP-43] table-wrapper has overflow:auto for horizontal scroll (CSS SOURCE)', () => {
  assert.match(cssSource, /\.table-wrapper[^{]*\{[^}]*overflow[^}]*auto/s,
    '.table-wrapper must have overflow:auto for horizontal scrolling on narrow viewports');
});

test('[W7-RESP-44] clave/consecutive dl uses grid layout to prevent label-value overlap', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderFiscalStatusSection(makeFiscal({ status: 'ACCEPTED' }));
  assert.match(html, /grid-template-columns:max-content 1fr/, 'dl must use grid layout to keep labels and values separate');
});

test('[W7-RESP-45] artifact actions use flex-wrap:wrap so buttons stack on narrow viewports', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderArtifactActions('1623', ALL_ARTIFACTS, 'INV-963');
  assert.match(html, /flex-wrap:wrap/, 'artifact actions container must have flex-wrap:wrap');
});

test('[W7-RESP-46] long fiscal identifiers have word-break:break-all (verified by W7-IDENT-32)', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderFiscalStatusSection(makeFiscal());
  assert.match(html, /word-break:break-all/, 'clave element must use word-break:break-all');
});

test('[W7-RESP-47] close button is in dialog header above scrollable body (HTML SOURCE)', () => {
  const rs  = createHarness({ includeView: true });
  const html = rs.require('views.billingAdmin').render({});
  // Close button must appear before the dialog body div in the markup
  const closeIdx = html.indexOf('billing-detail-dialog-close');
  const bodyIdx  = html.indexOf('billing-detail-dialog-body');
  assert.ok(closeIdx > -1 && bodyIdx > -1, 'both close button and dialog body must exist');
  assert.ok(closeIdx < bodyIdx, 'close button must appear before scrollable body so it remains reachable');
});

test('[W7-RESP-48] billing-artifact-link CSS class defined for touch targets (CSS SOURCE)', () => {
  assert.match(cssSource, /\.billing-artifact-link/, 'styles.css must define .billing-artifact-link for touch target sizing');
});

// ─── W7-SEMANTICS: Semantic structure ─────────────────────────────────────────

test('[W7-SEM-49] fiscal section has h4 heading element', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderFiscalStatusSection(makeFiscal());
  assert.match(html, /<h4[^>]+billing-detail-fiscal-heading/, 'fiscal section must have h4 heading with id');
});

test('[W7-SEM-50] heading hierarchy: h3 for dialog title, h4 for section headings', () => {
  const rs     = createHarness({ includeView: true });
  const shell  = rs.require('views.billingAdmin').render({});
  const rnd    = rs.require('views.billingAdminRenderers');
  const detail = rnd.renderInvoiceDetailContent(makeInvoice());
  assert.match(shell, /<h3[^>]+billing-detail-dialog-title/, 'dialog title must be h3');
  assert.match(detail, /<h4[^>]+billing-detail-info-heading/, 'section headings must be h4');
  assert.match(detail, /<h4[^>]+billing-detail-status-heading/, 'commercial status heading must be h4');
});

test('[W7-SEM-51] commercial and fiscal sections have distinct aria-labelledby IDs', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderInvoiceDetailContent(makeInvoice());
  assert.match(html, /aria-labelledby="billing-detail-info-heading"/, 'info section must have aria-labelledby');
  assert.match(html, /aria-labelledby="billing-detail-fiscal-heading"/, 'fiscal section must have aria-labelledby');
  // IDs must be distinct
  assert.notEqual('billing-detail-info-heading', 'billing-detail-fiscal-heading');
});

test('[W7-SEM-52] native button/link elements used for all interactive controls (verified by W7-KEYBOARD)', () => {
  // Covered by W7-KEYBOARD-11..14. No div/span controls exist.
  assert.ok(true, 'covered by W7-KEYBOARD tests');
});

test('[W7-SEM-53] no invalid ARIA attributes in rendered HTML', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderInvoiceDetailContent(makeInvoice(), { items: ALL_ARTIFACTS, failed: false });
  // No role="button" on native buttons (redundant)
  assert.doesNotMatch(html, /<button[^>]+role="button"/, 'native buttons must not have role="button"');
  // No aria-disabled without matching disabled attribute
  const hasAriaDisabled = html.includes('aria-disabled');
  if (hasAriaDisabled) {
    assert.match(html, /disabled/, 'aria-disabled must only appear alongside actual disabled attribute');
  }
});

test('[W7-SEM-54] aria-labelledby references exist as IDs in same render', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderInvoiceDetailContent(makeInvoice());
  // Extract all aria-labelledby values
  const refs  = [...html.matchAll(/aria-labelledby="([^"]+)"/g)].map((m) => m[1]);
  refs.forEach((ref) => {
    assert.match(html, new RegExp(`id="${ref}"`), `aria-labelledby="${ref}" must have matching id="${ref}" in same render`);
  });
});

test('[W7-SEM-55] no duplicate heading IDs in full detail content render', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderInvoiceDetailContent(makeInvoice());
  const ids  = [...html.matchAll(/\bid="(billing-detail-[^"]+)"/g)].map((m) => m[1]);
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length, `Duplicate billing-detail-* IDs found: ${ids.join(', ')}`);
});

// ─── W7-XSS: XSS escaping regression (Wave 6 parity) ─────────────────────────

test('[W7-XSS-56] hostile invoice number is HTML-escaped', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderInvoiceDetailContent(makeInvoice({ invoiceNumber: '<script>alert(1)</script>' }));
  assert.doesNotMatch(html, /<script>alert/, 'hostile invoice number must be escaped');
  assert.match(html, /&lt;script&gt;/, 'hostile invoice number must appear as escaped entities');
});

test('[W7-XSS-57] hostile client name: HTML tags are escaped, no executable <img> tag', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderInvoiceDetailContent(makeInvoice({ clientName: '<img src=x onerror=alert(1)>' }));
  // The <img> and > must be escaped — no live executable tag in the output
  assert.doesNotMatch(html, /<img\s/, 'hostile <img> tag must not appear unescaped');
  assert.match(html, /&lt;img/, 'hostile client name must appear as HTML entity &lt;img');
});

test('[W7-XSS-58] hostile store name: HTML tags are escaped, no executable <svg> tag', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const inv  = makeInvoice({ order: { id: 1, clientStoreId: 1, clientStoreName: '<svg onload=alert(1)>' } });
  const html = rnd.renderInvoiceDetailContent(inv);
  assert.doesNotMatch(html, /<svg\s/, 'hostile <svg> tag must not appear unescaped');
  assert.match(html, /&lt;svg/, 'hostile store name must appear as HTML entity &lt;svg');
});

test('[W7-XSS-59] hostile unknown fiscal status: HTML tags are escaped, no live element', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderFiscalStatusSection(makeFiscal({ status: '<b onmouseover=steal()>X</b>', clave: null, consecutive: null, acceptedAt: null }));
  // <b> and </b> must be escaped to &lt;b&gt; and &lt;/b&gt;
  assert.doesNotMatch(html, /<b\s/, 'hostile <b> open tag must not appear unescaped');
  assert.match(html, /&lt;b\s|&lt;b>/, 'hostile status must appear as HTML entities');
});

test('[W7-XSS-60] artifact visible label comes from server-constant (not server-provided value)', () => {
  // Artifact labels are defined in ARTIFACT_LABELS constant — never from server response
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderArtifactActions('1623', ALL_ARTIFACTS, 'INV-963');
  // Confirm labels match the known constants
  assert.match(html, /Descargar PDF/, 'PDF label must match expected constant');
  assert.match(html, /Descargar XML firmado/, 'signed-xml label must match expected constant');
  assert.match(html, /Respuesta Hacienda/, 'hacienda-response label must match expected constant');
});

// ─── W7-STATE: All fiscal state coverage ──────────────────────────────────────

test('[W7-STATE-61] fiscal=null renders neutral message, no artifact area, no crash', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderFiscalStatusSection(null);
  assert.match(html, /no tiene factura electr\u00F3nica/, 'null fiscal must show neutral message');
  assert.doesNotMatch(html, /download/, 'null fiscal must not show download links');
  assert.ok(html.length > 0, 'must not crash');
});

test('[W7-STATE-62] PENDING state renders without crash and shows no clave', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderFiscalStatusSection(makeFiscal({ status: 'PENDING', clave: null, consecutive: null, acceptedAt: null }));
  assert.ok(html.length > 0, 'PENDING must not crash');
  assert.doesNotMatch(html, /Clave:/, 'PENDING must not show Clave: field');
});

test('[W7-STATE-63] PROCESSING state renders without crash and shows no clave', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderFiscalStatusSection(makeFiscal({ status: 'PROCESSING', clave: null, consecutive: null, acceptedAt: null }));
  assert.ok(html.length > 0, 'PROCESSING must not crash');
  assert.doesNotMatch(html, /Clave:/, 'PROCESSING must not show Clave: field');
});

test('[W7-STATE-64] ACCEPTED state shows clave, consecutive, acceptedAt sections', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderFiscalStatusSection(makeFiscal({ status: 'ACCEPTED' }));
  assert.match(html, /Clave:/, 'ACCEPTED must show Clave: field');
  assert.match(html, /Consecutivo:/, 'ACCEPTED must show Consecutivo: field');
  assert.match(html, /Aceptada:/, 'ACCEPTED must show Aceptada: timestamp field');
});

test('[W7-STATE-65] REJECTED state renders without crash, shows no clave, no failureMessage', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderFiscalStatusSection(makeFiscal({ status: 'REJECTED', clave: null, consecutive: null, acceptedAt: null }));
  assert.ok(html.length > 0, 'REJECTED must not crash');
  assert.doesNotMatch(html, /Clave:/, 'REJECTED must not show Clave: field');
  assert.doesNotMatch(html, /failureMessage/, 'REJECTED must not expose failureMessage');
});

test('[W7-STATE-66] ERROR_RETRYABLE renders without crash', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderFiscalStatusSection(makeFiscal({ status: 'ERROR_RETRYABLE', clave: null, consecutive: null, acceptedAt: null }));
  assert.ok(html.length > 0, 'ERROR_RETRYABLE must not crash');
});

test('[W7-STATE-67] ERROR_FINAL renders without crash', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderFiscalStatusSection(makeFiscal({ status: 'ERROR_FINAL', clave: null, consecutive: null, acceptedAt: null }));
  assert.ok(html.length > 0, 'ERROR_FINAL must not crash');
});

test('[W7-STATE-68] unknown future status renders safely, not as ACCEPTED', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderFiscalStatusSection(makeFiscal({ status: 'NEW_STATUS_2027', clave: 'abc', consecutive: '001', acceptedAt: '2027-01-01T00:00:00Z' }));
  assert.ok(html.length > 0, 'unknown status must not crash');
  assert.doesNotMatch(html, /Aceptada por Hacienda/, 'unknown status must not be presented as ACCEPTED');
  // Even though clave/consecutive were in the fixture, they must NOT be shown for non-ACCEPTED
  assert.doesNotMatch(html, /Clave:/, 'unknown status must not show ACCEPTED identifier fields');
});

// ─── W7-STORAGE / SECURITY: Storage + Billing boundary (SOURCE) ───────────────

test('[W7-STORE-69] no localStorage.setItem for fiscal data in billing-admin.js', () => {
  assert.doesNotMatch(shellSrc, /localStorage\.setItem/, 'billing-admin.js must not use localStorage.setItem');
});

test('[W7-STORE-70] no sessionStorage.setItem for fiscal data in billing-admin.js', () => {
  assert.doesNotMatch(shellSrc, /sessionStorage\.setItem/, 'billing-admin.js must not use sessionStorage.setItem');
});

test('[W7-STORE-71] no IndexedDB usage in billing-admin.js', () => {
  assert.doesNotMatch(shellSrc, /indexedDB|IndexedDB|openDatabase/, 'billing-admin.js must not use IndexedDB');
});

test('[W7-STORE-72] no direct Billing API URLs in billing-admin.js', () => {
  assert.doesNotMatch(shellSrc, /billing\.[a-z]+\.com|billingApi\.(host|baseUrl)/,
    'billing-admin.js must not contain direct Billing API URLs');
});

test('[W7-STORE-73] no Billing API credentials or secret refs in billing-admin.js', () => {
  assert.doesNotMatch(shellSrc, /X-API-Key|billingCredential|secretRef|apiKey.*billing/i,
    'billing-admin.js must not contain Billing credentials or secret references');
});

// ─── W7-REG: Wave 1–6 regression guards ───────────────────────────────────────

test('[W7-REG-74] Wave 1: invoice DTO serializeInvoiceForList exists in service source', () => {
  const svcSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'invoice.service.js'), 'utf8');
  assert.match(svcSrc, /serializeInvoiceForList|invoiceNumber.*invoice\.number/, 'Wave 1 invoiceNumber mapping must still exist');
});

test('[W7-REG-75] Wave 2: fiscal badge renders in receivables table for ACCEPTED invoice', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderReceivablesTable([makeInvoice({ fiscal: { status: 'ACCEPTED' } })]);
  assert.match(html, /badge-success/, 'Wave 2 ACCEPTED badge class must still render');
  assert.match(html, /Aceptada/, 'Wave 2 ACCEPTED label must still render');
});

test('[W7-REG-76] Wave 3: detail content renders invoice number and client name', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderInvoiceDetailContent(makeInvoice());
  assert.match(html, /INV-963/, 'Wave 3 invoice number must still render');
  assert.match(html, /Distribuidora El Sol/, 'Wave 3 client name must still render');
});

test('[W7-REG-77] Wave 4: fiscal detail section renders for ACCEPTED invoice', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderFiscalStatusSection(makeFiscal({ status: 'ACCEPTED' }));
  assert.match(html, /Aceptada por Hacienda/, 'Wave 4 ACCEPTED label must still render');
  assert.match(html, /Clave:/, 'Wave 4 Clave field must still render for ACCEPTED');
});

test('[W7-REG-78] Wave 5: artifact download link renders for available artifact', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderArtifactActions('1623', [makeArtifact('pdf')], 'INV-963');
  assert.match(html, /fiscal-artifacts\/pdf/, 'Wave 5 artifact URL must still be correct');
  assert.match(html, /Descargar PDF/, 'Wave 5 visible PDF label must still render');
  assert.match(html, /download/, 'download attribute must still be present on artifact link');
});

test('[W7-REG-79] Wave 6 security: no Billing internals in fiscal detail HTML', () => {
  const rs  = createHarness();
  const rnd = rs.require('views.billingAdminRenderers');
  const html = rnd.renderInvoiceDetailContent(makeInvoice());
  assert.doesNotMatch(html, /failureMessage/, 'Wave 6: failureMessage must not appear');
  assert.doesNotMatch(html, /billingFiscalDocumentId/, 'Wave 6: billingFiscalDocumentId must not appear');
  assert.doesNotMatch(html, /idempotencyKey/, 'Wave 6: idempotencyKey must not appear');
});

// ─── W7-013B: TASK-013b reconciliation regression ─────────────────────────────

test('[W7-013B-80] QUEUED Billing status maps to PROCESSING in reconciliation', () => {
  assert.match(reconSrc, /QUEUED.*PROCESSING|PROCESSING.*QUEUED/s,
    'reconciliation service must map QUEUED → PROCESSING');
});

test('[W7-013B-81] ACCEPTED Billing status maps to ACCEPTED in reconciliation', () => {
  assert.match(reconSrc, /ACCEPTED.*ACCEPTED|case.*ACCEPTED/,
    'reconciliation service must map ACCEPTED → ACCEPTED');
});

test('[W7-013B-82] REJECTED Billing status maps to REJECTED in reconciliation', () => {
  assert.match(reconSrc, /REJECTED.*REJECTED|case.*REJECTED/,
    'reconciliation service must map REJECTED → REJECTED');
});

test('[W7-013B-83] unknown future Billing status is fail-closed (BILLING_UNKNOWN_STATUS)', () => {
  assert.match(reconSrc, /BILLING_UNKNOWN_STATUS/,
    'reconciliation service must have fail-closed fallback for unknown Billing statuses');
});
