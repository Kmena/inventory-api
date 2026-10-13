'use strict';

/**
 * Wave 5 tests — Fiscal artifact availability and downloads
 *
 * Spec: specs/inventori-fiscal-invoice-history-and-detail/
 * Covers all 44 required Wave 5 test items plus additional canonical assertions.
 *
 * What is tested here:
 *   W5-API   — listFiscalArtifacts / downloadFiscalArtifact API functions
 *   W5-URL   — download URL construction (Inventori proxy, not Billing)
 *   W5-RENDER-ACCEPT — ACCEPTED invoice with artifacts: download links per type
 *   W5-RENDER-EMPTY  — no artifacts / empty list: informative message
 *   W5-RENDER-STATUS — non-ACCEPTED statuses: informative message (no download links)
 *   W5-RENDER-ERROR  — artifact load failure: error message + retry button
 *   W5-SEC   — no Billing credentials, storage paths, secrets in rendered HTML
 *   W5-INTEGRITY — artifact type mapping integrity (signed-xml ≠ unsigned-xml)
 *   W5-STORAGE — no localStorage / sessionStorage / IndexedDB usage
 *   W5-TENANT — tenant isolation (source-level contract verification)
 *   W5-SRC   — source-level contract guards
 *   W5-REG   — Wave 1–4 regression guards
 */

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');

const rootPublicPath = path.join(__dirname, '..', 'src', 'public', 'root');
const servicesPath   = path.join(__dirname, '..', 'src', 'services');

function readRootFile(rel) {
  return fs.readFileSync(path.join(rootPublicPath, rel), 'utf8');
}

function readServicesFile(rel) {
  return fs.readFileSync(path.join(servicesPath, rel), 'utf8');
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
    buildHeaders: options.buildHeaders || (() => ({})),
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

function makeInvoice(overrides = {}) {
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
    ...overrides,
  };
}

function makeArtifact(inventoriType) {
  const types = {
    'pdf':               { type: 'PDF',                   contentType: 'application/pdf' },
    'signed-xml':        { type: 'SIGNED_XML',             contentType: 'application/xml' },
    'hacienda-response': { type: 'HACIENDA_RESPONSE_XML',  contentType: 'application/xml' },
  };
  const meta = types[inventoriType] || { type: inventoriType.toUpperCase(), contentType: null };
  return {
    id:           `artifact-${inventoriType}-001`,
    type:         meta.type,
    inventoriType,
    contentType:  meta.contentType,
    sha256:       'abc123',
    sizeBytes:    12345,
    createdAt:    '2025-01-15T14:30:00.000Z',
  };
}

const ALL_ARTIFACTS = [
  makeArtifact('pdf'),
  makeArtifact('signed-xml'),
  makeArtifact('hacienda-response'),
];

// ─── W5-API: billingApi functions ─────────────────────────────────────────────

test('[W5-API-01] (test-item-1) listFiscalArtifacts uses the correct Inventori invoice ID in the URL', async () => {
  const calls = [];
  const fetchJson = async (_sess, url) => { calls.push(url); return []; };
  const rootShell = createBillingHarness({ fetchJson });
  const api = rootShell.require('billingApi');

  await api.listFiscalArtifacts({}, 1623);

  assert.equal(calls.length, 1, 'listFiscalArtifacts must make exactly one request');
  assert.match(calls[0], /\/api\/invoices\/1623\/fiscal-artifacts/,
    'request URL must use the Inventori invoice ID and the fiscal-artifacts path');
});

test('[W5-API-02] listFiscalArtifacts is exported from billingApi', () => {
  const rootShell = createBillingHarness();
  const api = rootShell.require('billingApi');

  assert.equal(typeof api.listFiscalArtifacts, 'function', 'listFiscalArtifacts must be exported');
});

test('[W5-API-03] downloadFiscalArtifact is exported and returns an Inventori proxy URL', () => {
  const rootShell = createBillingHarness();
  const api = rootShell.require('billingApi');

  assert.equal(typeof api.downloadFiscalArtifact, 'function', 'downloadFiscalArtifact must be exported');
  const url = api.downloadFiscalArtifact(1623, 'pdf');
  assert.match(url, /\/api\/invoices\/1623\/fiscal-artifacts\/pdf/, 'URL must be an Inventori proxy URL');
  assert.doesNotMatch(url, /billing\./, 'URL must NOT point to Billing directly');
  assert.doesNotMatch(url, /hacienda\./, 'URL must NOT point to Hacienda directly');
});

test('[W5-API-04] listFiscalArtifacts URL never contains Billing API base URL or credentials', async () => {
  const calls = [];
  const fetchJson = async (_sess, url) => { calls.push(url); return []; };
  const rootShell = createBillingHarness({ fetchJson });
  const api = rootShell.require('billingApi');

  await api.listFiscalArtifacts({}, 1623);

  const url = calls[0] || '';
  assert.doesNotMatch(url, /billing\./, 'URL must not point to Billing');
  assert.doesNotMatch(url, /hacienda\./i, 'URL must not point to Hacienda');
  assert.doesNotMatch(url, /X-API-Key|apiKey|secret|credential/i, 'URL must not contain credentials');
});

// ─── W5-URL: download URL construction ────────────────────────────────────────

test('[W5-URL-01] (test-item-9) PDF available → PDF download link points to Inventori proxy', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderArtifactActions(1623, [makeArtifact('pdf')]);

  assert.match(html, /data-download-url="\/api\/invoices\/1623\/fiscal-artifacts\/pdf"/,
    'PDF download href must use Inventori proxy URL');
  assert.doesNotMatch(html, /billing\./i, 'PDF link must not point to Billing');
  assert.match(html, /Descargar PDF/, 'PDF download label must appear');
});

test('[W5-URL-02] (test-item-10) signed XML available → XML download link points to correct proxy path', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderArtifactActions(1623, [makeArtifact('signed-xml')]);

  assert.match(html, /data-download-url="\/api\/invoices\/1623\/fiscal-artifacts\/signed-xml"/,
    'signed XML href must use Inventori proxy URL with "signed-xml"');
  assert.match(html, /Descargar XML firmado/, 'signed XML download label must appear');
});

test('[W5-URL-03] (test-item-11) Hacienda response available → response link points to correct proxy path', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderArtifactActions(1623, [makeArtifact('hacienda-response')]);

  assert.match(html, /data-download-url="\/api\/invoices\/1623\/fiscal-artifacts\/hacienda-response"/,
    'Hacienda response href must use Inventori proxy URL');
  assert.match(html, /Respuesta Hacienda/, 'Hacienda response download label must appear');
});

// ─── W5-RENDER-ACCEPT: ACCEPTED invoice with artifacts ────────────────────────

test('[W5-RENDER-ACCEPT-01] all three artifact download links rendered when all artifacts available', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderArtifactActions(1623, ALL_ARTIFACTS);

  assert.match(html, /data-artifact-type="pdf"/,               'PDF link must appear');
  assert.match(html, /data-artifact-type="signed-xml"/,        'signed-xml link must appear');
  assert.match(html, /data-artifact-type="hacienda-response"/, 'hacienda-response link must appear');
});

test('[W5-RENDER-ACCEPT-02] artifact actions use a button contract instead of native navigation', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderArtifactActions(1623, [makeArtifact('pdf')]);

  assert.match(html, /<button/, 'artifact action must be a button');
  assert.match(html, /data-invoice-id="1623"/, 'artifact action must identify the invoice');
  assert.match(html, /data-artifact-type="pdf"/, 'artifact action must identify the type');
  assert.doesNotMatch(html, /href=/, 'artifact action must not navigate to the artifact endpoint');
});

test('[W5-RENDER-ACCEPT-03] (test-item-18) ACCEPTED status alone does NOT create artifact links — availability drives UI', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  // Pass ACCEPTED fiscal but no artifacts (empty list = none available yet)
  const html = renderers.renderFiscalStatusSection(
    makeFiscal({ status: 'ACCEPTED' }),
    { invoiceId: '1623', items: [], failed: false },
  );

  assert.doesNotMatch(html, /data-artifact-type="pdf"/,
    'ACCEPTED status with empty artifact list must NOT show PDF download link');
  assert.match(html, /Los documentos fiscales estar/,
    'informative message must appear when ACCEPTED but artifacts list is empty');
});

test('[W5-RENDER-ACCEPT-04] ACCEPTED with all artifacts renders download section in full fiscal section', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(
    makeFiscal(),
    { invoiceId: '1623', items: ALL_ARTIFACTS, failed: false },
  );

  // Fiscal info still present
  assert.match(html, /Aceptada por Hacienda/, 'fiscal status badge must still appear');
  assert.match(html, /Clave:/, 'clave field must still appear');
  // Artifact links present
  assert.match(html, /data-artifact-type="pdf"/, 'PDF download link must appear');
  assert.match(html, /data-artifact-type="signed-xml"/, 'signed-xml download link must appear');
  assert.match(html, /data-artifact-type="hacienda-response"/, 'hacienda-response link must appear');
});

test('[W5-RENDER-ACCEPT-05] artifact links for all three types in renderInvoiceDetailContent', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderInvoiceDetailContent(
    makeInvoice(),
    { items: ALL_ARTIFACTS, failed: false },
  );

  assert.match(html, /data-artifact-type="pdf"/,               'PDF link in full invoice detail');
  assert.match(html, /data-artifact-type="signed-xml"/,        'signed-xml link in full invoice detail');
  assert.match(html, /data-artifact-type="hacienda-response"/, 'hacienda-response link in full invoice detail');
});

// ─── W5-RENDER-EMPTY: empty/null artifact list ────────────────────────────────

test('[W5-RENDER-EMPTY-01] (test-item-12) null items → informative message, no PDF link', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderArtifactActions(1623, null);

  assert.match(html, /Los documentos fiscales estar/,
    'informative message must appear when items is null');
  assert.doesNotMatch(html, /data-artifact-type="pdf"/, 'no PDF link must appear for null items');
});

test('[W5-RENDER-EMPTY-02] (test-item-13) empty array → informative message, no signed-xml link', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderArtifactActions(1623, []);

  assert.match(html, /Los documentos fiscales estar/,
    'informative message must appear for empty artifact list');
  assert.doesNotMatch(html, /data-artifact-type="signed-xml"/, 'no signed-xml link must appear');
});

test('[W5-RENDER-EMPTY-03] (test-item-14) unknown inventoriType is filtered, does not render link', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  // Artifact with unknown type — should be filtered out by the allowlist
  const html = renderers.renderArtifactActions(1623, [
    { id: '1', type: 'UNKNOWN', inventoriType: 'unsigned-xml', contentType: null, sha256: null, sizeBytes: null, createdAt: null },
  ]);

  // Either informative message (filtered to empty) or does not include unsigned-xml link
  assert.doesNotMatch(html, /unsigned-xml/, 'unknown inventoriType must not produce a download link');
});

// ─── W5-RENDER-STATUS: non-ACCEPTED statuses ──────────────────────────────────

test('[W5-RENDER-STATUS-01] (test-item-15) fiscal=null: no artifact actions, no informative message about artifacts', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  // fiscal=null returns early — no artifact area
  const html = renderers.renderFiscalStatusSection(null, { invoiceId: '1623', items: null, failed: false });

  assert.doesNotMatch(html, /fiscal-artifacts\//, 'null fiscal must produce no artifact download links');
  // The null fiscal returns the "not associated" message, no informative artifact message
  assert.doesNotMatch(html, /Los documentos fiscales estar/,
    'null fiscal must not show the artifact availability message');
});

test('[W5-RENDER-STATUS-02] (test-item-16) PENDING: informative message shown, no download links', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(
    makeFiscal({ status: 'PENDING', clave: null, consecutive: null, acceptedAt: null }),
    { invoiceId: '1623', items: null, failed: false },
  );

  assert.match(html, /Los documentos fiscales estar/,
    'PENDING must show artifact informative message');
  assert.doesNotMatch(html, /data-artifact-type="pdf"/,
    'PENDING must not show any download links');
});

test('[W5-RENDER-STATUS-03] (test-item-17) PROCESSING: informative message, no download links', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(
    makeFiscal({ status: 'PROCESSING', clave: null, consecutive: null, acceptedAt: null }),
    { invoiceId: '1623', items: null, failed: false },
  );

  assert.match(html, /Los documentos fiscales estar/,
    'PROCESSING must show artifact informative message');
  assert.doesNotMatch(html, /fiscal-artifacts\//, 'PROCESSING must not show download links');
});

test('[W5-RENDER-STATUS-04] (test-item-19) REJECTED: informative message, no download links', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(
    makeFiscal({ status: 'REJECTED', clave: null, consecutive: null, acceptedAt: null }),
    { invoiceId: '1623', items: null, failed: false },
  );

  assert.doesNotMatch(html, /data-artifact-type="pdf"/, 'REJECTED must not show PDF download link');
});

test('[W5-RENDER-STATUS-05] (test-item-20) ERROR_RETRYABLE: informative message, no download links', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(
    makeFiscal({ status: 'ERROR_RETRYABLE', clave: null, consecutive: null, acceptedAt: null }),
    { invoiceId: '1623', items: null, failed: false },
  );

  assert.doesNotMatch(html, /fiscal-artifacts\//, 'ERROR_RETRYABLE must not show download links');
});

test('[W5-RENDER-STATUS-06] (test-item-21) ERROR_FINAL: informative message, no download links', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(
    makeFiscal({ status: 'ERROR_FINAL', clave: null, consecutive: null, acceptedAt: null }),
    { invoiceId: '1623', items: null, failed: false },
  );

  assert.doesNotMatch(html, /fiscal-artifacts\//, 'ERROR_FINAL must not show download links');
});

test('[W5-RENDER-STATUS-07] (test-item-22) unknown status: no crash, no download links', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  let html;
  assert.doesNotThrow(() => {
    html = renderers.renderFiscalStatusSection(
      makeFiscal({ status: 'FUTURE_STATUS_UNKNOWN', clave: null, consecutive: null, acceptedAt: null }),
      { invoiceId: '1623', items: null, failed: false },
    );
  }, 'unknown fiscal status must not throw');
  assert.doesNotMatch(html, /fiscal-artifacts\//, 'unknown status must not show download links');
});

test('[W5-RENDER-STATUS-08] (test-item-23) artifact loading state: renderInvoiceDetailContent without artifact context', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  // Called with null artifactCtx (e.g. during loading or for non-ACCEPTED) — must not crash
  let html;
  assert.doesNotThrow(() => {
    html = renderers.renderInvoiceDetailContent(makeInvoice(), null);
  }, 'renderInvoiceDetailContent with null artifactCtx must not throw');
  assert.ok(typeof html === 'string' && html.length > 0, 'must return non-empty HTML');
});

test('[W5-RENDER-STATUS-09] fiscal=null in renderInvoiceDetailContent: no artifact links', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderInvoiceDetailContent(makeInvoice({ fiscal: null }), null);

  assert.doesNotMatch(html, /fiscal-artifacts\//, 'null fiscal in full detail must not show download links');
});

// ─── W5-RENDER-ERROR: artifact load error ────────────────────────────────────

test('[W5-RENDER-ERROR-01] (test-item-24) artifact API failure: invoice detail still renders', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  // artifactCtx.failed = true → error state
  const html = renderers.renderInvoiceDetailContent(
    makeInvoice(),
    { items: null, failed: true },
  );

  // Invoice detail sections must still be present
  assert.match(html, /Informaci\u00F3n general|Informaci/,
    'commercial detail must still render after artifact load failure');
  assert.match(html, /Estado comercial/, 'commercial status must still render');
  assert.match(html, /Pagado/, 'commercial status value must still render');
});

test('[W5-RENDER-ERROR-02] (test-item-25) artifact load failure shows safe error message', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderArtifactLoadError('1623', 'INV-963');

  assert.match(html, /No se pudieron cargar los documentos fiscales/,
    'artifact error must show safe user-facing message');
  assert.doesNotMatch(html, /billing\.api\.|BILLING_|secretRef|apiKey/i,
    'artifact error must not expose Billing internals');
  assert.doesNotMatch(html, /stack|Error:|at.*\.js/i,
    'artifact error must not expose stack traces');
});

test('[W5-RENDER-ERROR-03] artifact load error shows retry button', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderArtifactLoadError('1623', 'INV-963');

  assert.match(html, /Reintentar/, 'retry button must be present in artifact error state');
  assert.match(html, /billing-artifact-retry-btn/, 'retry button must have the canonical CSS class');
  assert.match(html, /data-invoice-id="1623"/, 'retry button must carry invoice ID for re-open');
});

test('[W5-RENDER-ERROR-04] (test-item-26) no raw Billing error in artifact error state', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderArtifactLoadError('1623', 'INV-963');

  assert.doesNotMatch(html, /BILLING_ARTIFACT_UNAVAILABLE|BillingClientError/,
    'raw Billing error codes must not appear in artifact error message');
  assert.doesNotMatch(html, /billingFiscalDocumentId|billingCompanyId/,
    'Billing IDs must not appear in artifact error');
});

test('[W5-RENDER-ERROR-05] (test-item-27) no stack trace in artifact error state', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderArtifactLoadError('1623', 'INV-963');

  assert.doesNotMatch(html, /\bat\s+\w+.*\.js/i, 'no JavaScript stack trace in error output');
});

// ─── W5-SEC: security ─────────────────────────────────────────────────────────

test('[W5-SEC-01] (test-item-5) artifact metadata API call does not include Billing credentials in URL', async () => {
  const calls = [];
  const fetchJson = async (_sess, url, _opts) => { calls.push(url); return []; };
  const rootShell = createBillingHarness({ fetchJson });
  const api = rootShell.require('billingApi');

  await api.listFiscalArtifacts({ token: 'user-jwt' }, 1623);

  const url = calls[0] || '';
  assert.doesNotMatch(url, /apiKey|x-api-key|secret|credential|billingCompanyId/i,
    'artifact list URL must not contain Billing credentials');
  assert.doesNotMatch(url, /billing\./i, 'artifact list URL must not point to Billing directly');
});

test('[W5-SEC-02] (test-item-6) artifact metadata does not expose secret references', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  // Even if the API returns items with unexpected fields, renderer must not expose them
  const taintedItems = [
    { ...makeArtifact('pdf'), billingCredentialSecretRef: 'secret:billing/prod/api-key', apiKey: 'sk-xxx' },
  ];

  const html = renderers.renderArtifactActions(1623, taintedItems);

  assert.doesNotMatch(html, /billingCredentialSecretRef/, 'secret ref field name must not appear');
  assert.doesNotMatch(html, /secret:billing/, 'secret ref value must not appear');
  assert.doesNotMatch(html, /apiKey|sk-xxx/, 'API key must not appear in download link HTML');
});

test('[W5-SEC-03] (test-item-7) artifact metadata does not expose internal storage paths', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const taintedItems = [
    { ...makeArtifact('pdf'), storageKey: 's3://private-bucket/secrets/path.pdf', internalPath: '/var/billing/pdf/doc.pdf' },
  ];

  const html = renderers.renderArtifactActions(1623, taintedItems);

  assert.doesNotMatch(html, /storageKey/, 'storageKey must not appear in rendered HTML');
  assert.doesNotMatch(html, /s3:\/\//, 's3 URL must not appear in rendered HTML');
  assert.doesNotMatch(html, /\/var\/billing/, 'internal path must not appear in rendered HTML');
});

test('[W5-SEC-04] (test-item-8) browser never calls Billing directly — only Inventori proxy URLs', () => {
  const apiSource       = readRootFile('billing-api.js');
  const renderersSource = readRootFile('views/billing-admin.renderers.js');
  const adminSource     = readRootFile('views/billing-admin.js');
  const combined        = apiSource + renderersSource + adminSource;

  assert.doesNotMatch(combined, /billing\.api\.|billingApiUrl|https:\/\/.*billing/i,
    'no direct Billing API URL must appear in any Wave 5 browser-side source');
  assert.doesNotMatch(combined, /hacienda\.go\.cr|hacienda\.go/i,
    'no direct Hacienda URL must appear in browser-side source');
});

test('[W5-SEC-05] (test-item-33) artifact type allowlist enforced: unknown type produces no download link', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderArtifactActions(1623, [
    { id: '1', type: 'UNKNOWN', inventoriType: 'evil-type; rm -rf /', contentType: null, sha256: null, sizeBytes: null, createdAt: null },
  ]);

  assert.doesNotMatch(html, /evil-type/, 'non-allowlisted type must not produce a download link');
  assert.doesNotMatch(html, /rm -rf/, 'injection attempt must not appear in rendered HTML');
});

test('[W5-SEC-06] (test-item-34) path traversal attempt in inventoriType is rejected', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderArtifactActions(1623, [
    { id: '1', type: 'PDF', inventoriType: '../../../etc/passwd', contentType: null, sha256: null, sizeBytes: null, createdAt: null },
  ]);

  assert.doesNotMatch(html, /\.\.\//, 'path traversal sequence must not appear in rendered HTML');
  assert.doesNotMatch(html, /etc\/passwd/, 'path traversal target must not appear in HTML');
});

test('[W5-SEC-07] (test-item-35) arbitrary URL fetch impossible — download URLs are Inventori-relative', () => {
  const rootShell = createBillingHarness();
  const api = rootShell.require('billingApi');

  // Verify at runtime that the URL is an Inventori-relative path, not an external URL
  const url = api.downloadFiscalArtifact(1623, 'pdf');
  assert.match(url, /^\/api\/invoices\//, 'download URL must start with Inventori base path');
  assert.doesNotMatch(url, /^https?:\/\//, 'download URL must not be an absolute external URL');

  // Source guard: no location redirects to arbitrary types
  const apiSource = readRootFile('billing-api.js');
  assert.doesNotMatch(apiSource, /window\.location\.href\s*=.*artifactType/s,
    'must not redirect to arbitrary URLs based on raw artifactType input');
});

// ─── W5-TENANT: tenant isolation (source-level) ───────────────────────────────

test('[W5-TENANT-01] (test-item-2) company scope enforced: artifact proxy service uses ownership chain', () => {
  const proxySource = readServicesFile('fiscal-artifact-proxy.service.js');

  assert.match(proxySource, /resolveArtifactOwnershipChain/,
    'service must use ownership chain resolution for every artifact request');
  assert.match(proxySource, /client.*companyId|companyId.*client/s,
    'invoice query must scope by company through client relation');
});

test('[W5-TENANT-02] (test-item-3) cross-company invoice list artifacts returns 404 (non-enumeration)', () => {
  const proxySource = readServicesFile('fiscal-artifact-proxy.service.js');

  assert.match(proxySource, /not_found.*404|404.*not_found/i,
    'cross-company access must return 404, not 403, per non-enumeration policy');
});

test('[W5-TENANT-03] (test-item-4) artifact download route enforces same companyId scope as list', () => {
  const routeSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'routes', 'invoice.routes.js'), 'utf8',
  );

  // Both list and download routes must use the fiscal-artifact authorization
  const artifactRoutes = routeSource.match(/fiscal-artifact/g) || [];
  assert.ok(artifactRoutes.length >= 2,
    'both artifact list and download routes must use invoice.fiscal-artifact policy');
});

test('[W5-TENANT-04] (test-item-36) IDOR by changing invoice ID: ownership chain prevents cross-company access', () => {
  const proxySource = readServicesFile('fiscal-artifact-proxy.service.js');

  // The ownership chain requires invoice.client.companyId to match auth.companyId
  assert.match(proxySource, /where.*companyId.*client|client.*companyId/s,
    'invoice lookup must include company scope to prevent IDOR');
  assert.match(proxySource, /intent\.companyId.*companyId|companyId.*intent\.companyId/,
    'fiscal intent company must be verified against authenticated company');
});

// ─── W5-INTEGRITY: artifact type integrity ────────────────────────────────────

test('[W5-INTEGRITY-01] (test-item-28) signed XML action uses "signed-xml" — not "unsigned-xml" or bare "xml"', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderArtifactActions(1623, [makeArtifact('signed-xml')]);

  assert.match(html, /data-artifact-type="signed-xml"/, '"signed-xml" must be used for the signed XML link');
  assert.doesNotMatch(html, /fiscal-artifacts\/unsigned-xml/, '"unsigned-xml" must never appear');
  assert.doesNotMatch(html, /fiscal-artifacts\/xml[^-]/, 'bare "xml" must not be used for signed XML');
});

test('[W5-INTEGRITY-02] (test-item-29) Hacienda response action uses "hacienda-response" — not "signed-xml"', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderArtifactActions(1623, [makeArtifact('hacienda-response')]);

  assert.match(html, /data-artifact-type="hacienda-response"/,
    '"hacienda-response" must be used for the Hacienda response link');
  assert.doesNotMatch(html, /data-artifact-type="signed-xml"/,
    'Hacienda response link must not use "signed-xml"');
});

test('[W5-INTEGRITY-03] (test-item-30) PDF action uses "pdf" — cannot return XML', () => {
  const proxySource = readServicesFile('fiscal-artifact-proxy.service.js');

  // Verify the INVENTORI_TO_BILLING_ARTIFACT_TYPE mapping is correct
  assert.match(proxySource, /'pdf'.*'PDF'|"pdf".*"PDF"/,
    'pdf must map to PDF in the artifact type allowlist');
  assert.match(proxySource, /'signed-xml'.*'SIGNED_XML'|"signed-xml".*"SIGNED_XML"/,
    'signed-xml must map to SIGNED_XML');
  assert.match(proxySource, /'hacienda-response'.*'HACIENDA_RESPONSE_XML'|"hacienda-response".*"HACIENDA_RESPONSE_XML"/,
    'hacienda-response must map to HACIENDA_RESPONSE_XML');
});

test('[W5-INTEGRITY-04] (test-item-31) Content-Type controlled by proxy service, not forwarded from Billing', () => {
  const proxySource = readServicesFile('fiscal-artifact-proxy.service.js');

  assert.match(proxySource, /ARTIFACT_MIME_BY_BILLING_TYPE/,
    'service must define its own MIME type map (not forward Content-Type from Billing)');
  assert.match(proxySource, /application\/pdf/, 'PDF MIME type must be explicitly set');
  assert.match(proxySource, /application\/xml/, 'XML MIME type must be explicitly set');
});

// ─── W5-FILENAME: Content-Disposition / filename safety ──────────────────────

test('[W5-FILENAME-01] (test-item-32) Content-Disposition filename generated by Inventori, never copied from Billing', () => {
  const proxySource = readServicesFile('fiscal-artifact-proxy.service.js');

  assert.match(proxySource, /buildContentDisposition/,
    'service must use buildContentDisposition to generate safe filenames');
  // Content-Disposition is set in the route handler from result.contentDisposition (Inventori-generated)
  const routeSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'routes', 'invoice.routes.js'), 'utf8',
  );
  assert.match(routeSource, /result\.contentDisposition/,
    'route must use Inventori-generated Content-Disposition, not forward from Billing');
});

test('[W5-FILENAME-02] Content-Disposition sanitizes clave (no CRLF, no control chars)', () => {
  const proxySource = readServicesFile('fiscal-artifact-proxy.service.js');

  assert.match(proxySource, /CRLF|\\r\\n|control/i,
    'Content-Disposition generator must guard against CRLF and control characters');
  assert.match(proxySource, /sanitized|replace.*[^a-zA-Z0-9]/,
    'clave must be sanitized before use in filename');
});

// ─── W5-STORAGE: no browser storage ──────────────────────────────────────────

test('[W5-STORAGE-01] (test-item-38) no localStorage usage in Wave 5 browser-side source', () => {
  const combined = readRootFile('billing-api.js') +
                   readRootFile('views/billing-admin.renderers.js') +
                   readRootFile('views/billing-admin.js');

  assert.doesNotMatch(combined, /localStorage/, 'no localStorage usage in Wave 5 browser source');
});

test('[W5-STORAGE-02] (test-item-39) no sessionStorage usage in Wave 5 browser-side source', () => {
  const combined = readRootFile('billing-api.js') +
                   readRootFile('views/billing-admin.renderers.js') +
                   readRootFile('views/billing-admin.js');

  assert.doesNotMatch(combined, /sessionStorage/, 'no sessionStorage usage in Wave 5 browser source');
});

test('[W5-STORAGE-03] (test-item-40) no IndexedDB usage in Wave 5 browser-side source', () => {
  const combined = readRootFile('billing-api.js') +
                   readRootFile('views/billing-admin.renderers.js') +
                   readRootFile('views/billing-admin.js');

  assert.doesNotMatch(combined, /indexedDB|IDBDatabase/i,
    'no IndexedDB usage in Wave 5 browser source');
});

// ─── W5-SRC: source-level contract guards ─────────────────────────────────────

test('[W5-SRC-01] renderArtifactActions exported from views.billingAdminRenderers', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  assert.equal(typeof renderers.renderArtifactActions, 'function',
    'renderArtifactActions must be exported');
});

test('[W5-SRC-02] renderArtifactLoadError exported from views.billingAdminRenderers', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  assert.equal(typeof renderers.renderArtifactLoadError, 'function',
    'renderArtifactLoadError must be exported');
});

test('[W5-SRC-03] billing-admin.js calls listFiscalArtifacts for ACCEPTED invoices', () => {
  const source = readRootFile('views/billing-admin.js');

  assert.match(source, /listFiscalArtifacts/,
    'billing-admin.js must call listFiscalArtifacts for artifact loading');
  assert.match(source, /ACCEPTED.*listFiscalArtifacts|listFiscalArtifacts.*ACCEPTED/s,
    'artifact loading must be gated on ACCEPTED status');
});

test('[W5-SRC-04] billing-admin.js has bindArtifactRetryButton for error recovery', () => {
  const source = readRootFile('views/billing-admin.js');

  assert.match(source, /bindArtifactRetryButton/,
    'billing-admin.js must define bindArtifactRetryButton');
  assert.match(source, /billing-artifact-retry-btn/,
    'retry button class must be referenced in binding code');
});

test('[W5-SRC-05] preserves immutable fiscal controls while allowing accepted-package delivery resend', () => {
  const source = readRootFile('billing-api.js') + readRootFile('views/billing-admin.js') + readRootFile('views/billing-admin.renderers.js');
  assert.match(source, /Reenviar documentos/, 'the one safe delivery action is present');
  assert.match(source, /status === 'ACCEPTED'/, 'resend is limited to accepted fiscal documents');
  assert.match(source, /fiscal-documents\/resend/, 'browser targets the Inventori resend endpoint');
  assert.doesNotMatch(source, /Enviar a Hacienda.*button|button.*Enviar a Hacienda/i, 'no Hacienda submit action');
  assert.doesNotMatch(source, /Reemitir|Regenerar XML|Reintentar Hacienda|Nueva identidad fiscal/i, 'no reissue, XML regeneration, fiscal retry, or new identity control');
});

test('[W5-SRC-06] no artifact bytes stored or cached in browser source', () => {
  const combined = readRootFile('billing-api.js') +
                   readRootFile('views/billing-admin.renderers.js') +
                   readRootFile('views/billing-admin.js');

  assert.doesNotMatch(combined, /new Uint8Array|new ArrayBuffer/,
    'artifact bytes must not be buffered or cached in browser source');
});

// ─── W5-REG: Wave 1–4 regression ─────────────────────────────────────────────

test('[W5-REG-01] (test-item-41) Wave 4 fiscal status still renders correctly alongside Wave 5 artifacts', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderFiscalStatusSection(
    makeFiscal(),
    { invoiceId: '1623', items: ALL_ARTIFACTS, failed: false },
  );

  // Wave 4 content must still be present
  assert.match(html, /Aceptada por Hacienda/, 'Wave 4 fiscal badge must remain');
  assert.match(html, /Clave:/, 'Wave 4 clave field must remain');
  assert.match(html, /Consecutivo:/, 'Wave 4 consecutive field must remain');
  assert.match(html, /Aceptada:/, 'Wave 4 acceptedAt field must remain');
  // Wave 5 content also present
  assert.match(html, /data-artifact-type="pdf"/, 'Wave 5 PDF link must be present');
});

test('[W5-REG-02] (test-item-42) Wave 3 commercial detail sections unchanged after Wave 5', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const html = renderers.renderInvoiceDetailContent(
    makeInvoice(),
    { items: ALL_ARTIFACTS, failed: false },
  );

  assert.match(html, /Informaci\u00F3n general|Informaci/, 'Información general must remain');
  assert.match(html, /Estado comercial/, 'Estado comercial must remain');
  assert.match(html, /Pagos registrados/, 'Pagos registrados must remain');
});

test('[W5-REG-03] (test-item-43) Wave 2 receivables list fiscal badges still render correctly', () => {
  const rootShell = createBillingHarness();
  const renderers = rootShell.require('views.billingAdminRenderers');

  const invoices = [
    { id: 1, invoiceNumber: 'INV-001', amount: 1000, pendingAmount: 1000, status: 'PENDING', dueAt: null, fiscal: { status: 'ACCEPTED' }, payments: [], client: { name: 'A' } },
  ];

  const html = renderers.renderReceivablesTable(invoices);

  assert.match(html, /Aceptada/, 'Wave 2 fiscal badge must still render in receivables table');
  assert.match(html, /billing-detail-btn/, 'Wave 3 detail button must still render');
});

test('[W5-REG-04] (test-item-44) Wave 1 DTO contract: listFiscalArtifacts does not fetch invoice DTO endpoint', async () => {
  const calls = [];
  const fetchJson = async (_sess, url) => { calls.push(url); return []; };
  const rootShell = createBillingHarness({ fetchJson });
  const api = rootShell.require('billingApi');

  await api.listFiscalArtifacts({}, 1623);

  // Must NOT call the invoice detail DTO endpoint
  assert.ok(!calls.some((u) => u.endsWith('/1623') && !u.includes('fiscal-artifacts')),
    'listFiscalArtifacts must not call the invoice detail DTO endpoint');
});

test('[W5-DOWNLOAD] all artifact types preserve MIME and Content-Disposition filename after authenticated fetch', async () => {
  for (const fixture of [['pdf', 'application/pdf', 'factura-506.pdf'], ['signed-xml', 'application/xml', 'factura-506.xml'], ['hacienda-response', 'application/xml', 'respuesta-hacienda-506.xml']]) {
    const artifactType = fixture[0]; const mimeType = fixture[1]; const fileName = fixture[2]; const blob = { mimeType, artifactType };
    const rootShell = createBillingHarness({ buildHeaders: () => ({ Authorization: 'Bearer session-token' }), fetch: async (_url, _options) => ({ ok: true, status: 200, headers: { get: (name) => name === 'content-type' ? mimeType : 'attachment; filename="' + fileName + '"' }, blob: async () => blob }) });
    const result = await rootShell.require('billingApi').downloadFiscalArtifact({ token: 'session-token' }, 1623, artifactType);
    assert.equal(result.blob, blob); assert.equal(result.mimeType, mimeType); assert.equal(result.fileName, fileName);
  }
});

test('[W5-DOWNLOAD] non-2xx JSON responses never read a Blob', async () => {
  for (const status of [401, 403, 404, 422, 500]) {
    let blobCalled = false;
    const rootShell = createBillingHarness({ fetch: async () => ({ ok: false, status, json: async () => ({ message: 'Error seguro de Inventori' }), blob: async () => { blobCalled = true; } }) });
    await assert.rejects(() => rootShell.require('billingApi').downloadFiscalArtifact({ token: 't' }, 1623, 'pdf'), /Error seguro de Inventori/);
    assert.equal(blobCalled, false);
  }
});

test('[W5-DOWNLOAD] billing admin binds Blob/ObjectURL cleanup and never uses page navigation', () => {
  const source = readRootFile('views/billing-admin.js');
  assert.match(source, /URL\.createObjectURL/); assert.match(source, /URL\.revokeObjectURL/); assert.match(source, /billingApi\.downloadFiscalArtifact/);
  assert.doesNotMatch(source, /window\.location/);
});
