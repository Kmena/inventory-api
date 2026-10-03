/**
 * Wave 6 tests — Client Fiscal Verification UX
 * Spec: specs/inventori-receiver-fiscal-readiness/ § RFR-TASK-601
 *
 * Groups:
 *   [A-xx] Source governance — registration, security invariants, load order
 *   [B-xx] Pure rendering — badge, activities list, full section
 *   [C-xx] API client — verifyClientLegalEntity, getClientLegalEntityActivities
 *   [D-xx] clients-admin wiring — placeholder, guard, mounting
 *   [E-xx] Security/accessibility — aria, responsive CSS, no credential leak
 *   [F-xx] Mount behaviour — double-submit, verification states, error handling
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootPublicPath = path.join(__dirname, '..', 'src', 'public', 'root');

function readSource(relativePath) {
  return fs.readFileSync(path.join(rootPublicPath, relativePath), 'utf8');
}

function executeScript(relativePath, context) {
  const source = readSource(relativePath);
  vm.runInContext(source, context, { filename: relativePath });
}

// ─── Test harness ─────────────────────────────────────────────────────────────

/**
 * Builds a minimal RootShell context with clientsApi and ui stubs.
 * @param {{ fetch?: Function }} [opts]
 */
function createHarness(opts = {}) {
  const browserWindow = {};
  const context = vm.createContext({ window: browserWindow, Map, Set, URLSearchParams, Date, isNaN });
  browserWindow.window = browserWindow;
  browserWindow.HTMLElement = class HTMLElement {};
  browserWindow.fetch = opts.fetch || (async () => ({ ok: true, status: 200, json: async () => ({}) }));

  executeScript('registry.js', context);

  browserWindow.InventoryAuth = {
    fetchJson: opts.fetchJson || (async () => ({})),
    buildHeaders: () => ({}),
    handleUnauthorized: () => {},
  };

  executeScript('ui.js', context);
  executeScript('clients-api.js', context);
  executeScript('views/client-fiscal-verification.js', context);

  return browserWindow.RootShell;
}

// ─── [A] Source governance ────────────────────────────────────────────────────

test('[A-01] client-fiscal-verification.js registers views.clientFiscalVerification', () => {
  const rootShell = createHarness();
  assert.ok(rootShell.has('views.clientFiscalVerification'), 'Module not registered');
});

test('[A-02] views.clientFiscalVerification exposes mountFiscalSection', () => {
  const rootShell = createHarness();
  const mod = rootShell.require('views.clientFiscalVerification');
  assert.equal(typeof mod.mountFiscalSection, 'function');
});

test('[A-03] views.clientFiscalVerification exposes renderFiscalSection', () => {
  const rootShell = createHarness();
  const mod = rootShell.require('views.clientFiscalVerification');
  assert.equal(typeof mod.renderFiscalSection, 'function');
});

test('[A-04] views.clientFiscalVerification exposes pure renderers for testing', () => {
  const rootShell = createHarness();
  const mod = rootShell.require('views.clientFiscalVerification');
  assert.equal(typeof mod._renderVerificationBadge, 'function');
  assert.equal(typeof mod._renderActivitiesList, 'function');
  assert.equal(typeof mod._renderFiscalSection, 'function');
  assert.equal(typeof mod._renderActivityItem, 'function');
  assert.equal(typeof mod._isStale, 'function');
});

test('[A-05] client-fiscal-verification.js contains ZERO direct Hacienda URL references', () => {
  const src = readSource('views/client-fiscal-verification.js');
  assert.doesNotMatch(src, /hacienda\.go\.cr/i);
  assert.doesNotMatch(src, /api\.hacienda/i);
  assert.doesNotMatch(src, /\/fe\/ae/);
});

test('[A-06] client-fiscal-verification.js contains ZERO direct Billing host references', () => {
  const src = readSource('views/client-fiscal-verification.js');
  assert.doesNotMatch(src, /billing-api\.inventori/i);
  assert.doesNotMatch(src, /billingApi\./);
});

test('[A-07] client-fiscal-verification.js does NOT call localStorage API', () => {
  // Strip block and line comments, then check for actual API usage
  const src = readSource('views/client-fiscal-verification.js')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');
  assert.doesNotMatch(src, /localStorage\./i);
});

test('[A-08] client-fiscal-verification.js does NOT call sessionStorage API', () => {
  const src = readSource('views/client-fiscal-verification.js')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');
  assert.doesNotMatch(src, /sessionStorage\./i);
});

test('[A-09] index.html loads client-fiscal-verification.js before clients-admin.js (script src order)', () => {
  const html = readSource('index.html');
  // Use line-based search to find the <script src=...> tags specifically, ignoring comments
  const lines = html.split('\n');
  const verLine = lines.findIndex((l) => l.includes('src="/root/views/client-fiscal-verification.js"'));
  const adminLine = lines.findIndex((l) => l.includes('src="/root/views/clients-admin.js"'));
  assert.ok(verLine >= 0, 'client-fiscal-verification.js script tag not found in index.html');
  assert.ok(adminLine >= 0, 'clients-admin.js script tag not found in index.html');
  assert.ok(verLine < adminLine, `client-fiscal-verification.js (line ${verLine}) must load before clients-admin.js (line ${adminLine})`);
});

// ─── [B] Pure rendering ────────────────────────────────────────────────────────

test('[B-01] _renderVerificationBadge: UNVERIFIED → "Sin verificar" (not raw enum)', () => {
  const rootShell = createHarness();
  const { _renderVerificationBadge } = rootShell.require('views.clientFiscalVerification');
  const html = _renderVerificationBadge('UNVERIFIED');
  assert.match(html, /Sin verificar/);
  assert.doesNotMatch(html, /^UNVERIFIED$/m);
});

test('[B-02] _renderVerificationBadge: VERIFIED → "Verificado con Hacienda"', () => {
  const rootShell = createHarness();
  const { _renderVerificationBadge } = rootShell.require('views.clientFiscalVerification');
  const html = _renderVerificationBadge('VERIFIED');
  assert.match(html, /Verificado con Hacienda/);
});

test('[B-03] _renderVerificationBadge: NOT_FOUND → "No encontrado en Hacienda"', () => {
  const rootShell = createHarness();
  const { _renderVerificationBadge } = rootShell.require('views.clientFiscalVerification');
  const html = _renderVerificationBadge('NOT_FOUND');
  assert.match(html, /No encontrado en Hacienda/);
});

test('[B-04] _renderVerificationBadge: INVALID → "Identificación inválida"', () => {
  const rootShell = createHarness();
  const { _renderVerificationBadge } = rootShell.require('views.clientFiscalVerification');
  const html = _renderVerificationBadge('INVALID');
  assert.match(html, /Identificaci.n inv.lida/);
});

test('[B-05] _renderVerificationBadge: VERIFICATION_UNAVAILABLE → "Verificación no disponible"', () => {
  const rootShell = createHarness();
  const { _renderVerificationBadge } = rootShell.require('views.clientFiscalVerification');
  const html = _renderVerificationBadge('VERIFICATION_UNAVAILABLE');
  assert.match(html, /Verificaci.n no disponible/);
});

test('[B-06] _renderVerificationBadge: has role=status for screen readers', () => {
  const rootShell = createHarness();
  const { _renderVerificationBadge } = rootShell.require('views.clientFiscalVerification');
  const html = _renderVerificationBadge('VERIFIED');
  assert.match(html, /role="status"/);
});

test('[B-07] _isStale: null → false', () => {
  const rootShell = createHarness();
  const { _isStale } = rootShell.require('views.clientFiscalVerification');
  assert.equal(_isStale(null), false);
  assert.equal(_isStale(undefined), false);
  assert.equal(_isStale(''), false);
});

test('[B-08] _isStale: date 10 days ago → false', () => {
  const rootShell = createHarness();
  const { _isStale } = rootShell.require('views.clientFiscalVerification');
  const recent = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(_isStale(recent), false);
});

test('[B-09] _isStale: date 100 days ago → true', () => {
  const rootShell = createHarness();
  const { _isStale } = rootShell.require('views.clientFiscalVerification');
  const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(_isStale(old), true);
});

test('[B-10] _renderActivitiesList: zero activities + UNVERIFIED → "Sin verificar" message', () => {
  const rootShell = createHarness();
  const { _renderActivitiesList } = rootShell.require('views.clientFiscalVerification');
  const html = _renderActivitiesList([], 'UNVERIFIED');
  assert.match(html, /Sin verificar/);
});

test('[B-11] _renderActivitiesList: zero activities + VERIFIED → empty-state message', () => {
  const rootShell = createHarness();
  const { _renderActivitiesList } = rootShell.require('views.clientFiscalVerification');
  const html = _renderActivitiesList([], 'VERIFIED');
  assert.match(html, /sin actividades/i);
});

test('[B-12] _renderActivitiesList: one activity → rendered in list', () => {
  const rootShell = createHarness();
  const { _renderActivitiesList } = rootShell.require('views.clientFiscalVerification');
  const html = _renderActivitiesList([{ code: '6201', description: 'Desarrollo de software', haciendaStatus: 'A', haciendaType: 'P', isCurrentlyReturned: true }], 'VERIFIED');
  assert.match(html, /6201/);
  assert.match(html, /Desarrollo de software/);
});

test('[B-13] _renderActivitiesList: code "9609.0" preserved exactly — not parsed as number', () => {
  const rootShell = createHarness();
  const { _renderActivitiesList } = rootShell.require('views.clientFiscalVerification');
  const html = _renderActivitiesList([{ code: '9609.0', description: 'Servicios personales ncp', haciendaStatus: 'A', haciendaType: 'S', isCurrentlyReturned: true }], 'VERIFIED');
  assert.match(html, /9609\.0/);
  assert.doesNotMatch(html, /9609(?!\.0)/); // must not appear as plain 9609 without .0
});

test('[B-14] _renderActivitiesList: description rendered', () => {
  const rootShell = createHarness();
  const { _renderActivitiesList } = rootShell.require('views.clientFiscalVerification');
  const html = _renderActivitiesList([{ code: '4711', description: 'Comercio al por menor', haciendaStatus: 'A', haciendaType: 'S', isCurrentlyReturned: true }], 'VERIFIED');
  assert.match(html, /Comercio al por menor/);
});

test('[B-15] _renderActivitiesList: haciendaType P → "Principal"', () => {
  const rootShell = createHarness();
  const { _renderActivitiesList } = rootShell.require('views.clientFiscalVerification');
  const html = _renderActivitiesList([{ code: '6201', description: 'Dev', haciendaStatus: 'A', haciendaType: 'P', isCurrentlyReturned: true }], 'VERIFIED');
  assert.match(html, /Principal/);
});

test('[B-16] _renderActivitiesList: haciendaStatus A → "Activa"', () => {
  const rootShell = createHarness();
  const { _renderActivitiesList } = rootShell.require('views.clientFiscalVerification');
  const html = _renderActivitiesList([{ code: '6201', description: 'Dev', haciendaStatus: 'A', haciendaType: 'P', isCurrentlyReturned: true }], 'VERIFIED');
  assert.match(html, /Activa/);
});

test('[B-17] _renderActivitiesList: haciendaStatus I → "Inactiva" badge', () => {
  const rootShell = createHarness();
  const { _renderActivitiesList } = rootShell.require('views.clientFiscalVerification');
  const html = _renderActivitiesList([{ code: '9999', description: 'Obsoleta', haciendaStatus: 'I', haciendaType: 'S', isCurrentlyReturned: true }], 'VERIFIED');
  assert.match(html, /Inactiva/);
});

test('[B-18] _renderActivitiesList: isCurrentlyReturned=false → "No retornada" warning', () => {
  const rootShell = createHarness();
  const { _renderActivitiesList } = rootShell.require('views.clientFiscalVerification');
  const html = _renderActivitiesList([{ code: '4711', description: 'Comercio', haciendaStatus: 'A', haciendaType: 'S', isCurrentlyReturned: false }], 'VERIFIED');
  assert.match(html, /No retornada/);
});

test('[B-19] _renderActivitiesList: multiple activities all rendered', () => {
  const rootShell = createHarness();
  const { _renderActivitiesList } = rootShell.require('views.clientFiscalVerification');
  const html = _renderActivitiesList([
    { code: '6201', description: 'Dev', haciendaStatus: 'A', haciendaType: 'P', isCurrentlyReturned: true },
    { code: '4711', description: 'Comercio', haciendaStatus: 'A', haciendaType: 'S', isCurrentlyReturned: true },
  ], 'VERIFIED');
  assert.match(html, /6201/);
  assert.match(html, /4711/);
});

test('[B-20] _renderActivitiesList: no legacy economicActivityCode presented as verified activity', () => {
  const rootShell = createHarness();
  const { _renderActivitiesList } = rootShell.require('views.clientFiscalVerification');
  // Calling with empty array — should NOT invent activities from legacy fields
  const html = _renderActivitiesList([], 'VERIFIED');
  assert.doesNotMatch(html, /economicActivityCode/);
});

test('[B-21] _renderFiscalSection: null entity → no-identity message', () => {
  const rootShell = createHarness();
  const { _renderFiscalSection } = rootShell.require('views.clientFiscalVerification');
  const html = _renderFiscalSection(null, [], true);
  assert.match(html, /No hay identidad fiscal/);
});

test('[B-22] _renderFiscalSection: VERIFIED entity → badge shows "Verificado con Hacienda"', () => {
  const rootShell = createHarness();
  const { _renderFiscalSection } = rootShell.require('views.clientFiscalVerification');
  const html = _renderFiscalSection({ id: '789', verificationStatus: 'VERIFIED', legalName: 'Demo SA' }, [], true);
  assert.match(html, /Verificado con Hacienda/);
});

test('[B-23] _renderFiscalSection: UNVERIFIED entity → badge shows "Sin verificar"', () => {
  const rootShell = createHarness();
  const { _renderFiscalSection } = rootShell.require('views.clientFiscalVerification');
  const html = _renderFiscalSection({ id: '789', verificationStatus: 'UNVERIFIED' }, [], false);
  assert.match(html, /Sin verificar/);
});

test('[B-24] _renderFiscalSection: lastVerifiedAt rendered when present', () => {
  const rootShell = createHarness();
  const { _renderFiscalSection } = rootShell.require('views.clientFiscalVerification');
  const html = _renderFiscalSection({ id: '789', verificationStatus: 'VERIFIED', lastVerifiedAt: '2025-06-01T00:00:00Z' }, [], true);
  assert.match(html, /Verificado:/);
});

test('[B-25] _renderFiscalSection: raw enum "VERIFIED" is NOT the primary visible text', () => {
  const rootShell = createHarness();
  const { _renderFiscalSection } = rootShell.require('views.clientFiscalVerification');
  const html = _renderFiscalSection({ id: '789', verificationStatus: 'VERIFIED' }, [], false);
  // The aria-label can contain it but the button/badge inner text must be the Spanish label
  // Strip aria-label attributes before checking
  const withoutAria = html.replace(/aria-label="[^"]*"/g, '');
  assert.doesNotMatch(withoutAria, /\bVERIFIED\b/);
});

test('[B-26] _renderFiscalSection: identificationNumber rendered', () => {
  const rootShell = createHarness();
  const { _renderFiscalSection } = rootShell.require('views.clientFiscalVerification');
  const html = _renderFiscalSection({ id: '789', verificationStatus: 'UNVERIFIED', identificationNumber: '3-101-123456' }, [], false);
  assert.match(html, /3-101-123456/);
});

test('[B-27] _renderFiscalSection: identificationType label — not raw code', () => {
  const rootShell = createHarness();
  const { _renderFiscalSection } = rootShell.require('views.clientFiscalVerification');
  const html = _renderFiscalSection({ id: '789', verificationStatus: 'UNVERIFIED', identificationType: 'JURIDICA' }, [], false);
  assert.match(html, /Cédula Jurídica/);
  // Raw enum must not be the only visible text for this field
  // (it may appear in attribute values, so we check display text section)
  assert.match(html, /Tipo de identificaci/);
});

test('[B-28] _renderFiscalSection: taxpayerName rendered when present', () => {
  const rootShell = createHarness();
  const { _renderFiscalSection } = rootShell.require('views.clientFiscalVerification');
  const html = _renderFiscalSection({ id: '789', verificationStatus: 'VERIFIED', taxpayerName: 'Demo Hacienda SA' }, [], false);
  assert.match(html, /Demo Hacienda SA/);
  assert.match(html, /Nombre según Hacienda/);
});

test('[B-29] _renderFiscalSection: taxpayerName absent → Hacienda label not shown', () => {
  const rootShell = createHarness();
  const { _renderFiscalSection } = rootShell.require('views.clientFiscalVerification');
  const html = _renderFiscalSection({ id: '789', verificationStatus: 'UNVERIFIED' }, [], false);
  assert.doesNotMatch(html, /Nombre según Hacienda/);
});

test('[B-30] _renderFiscalSection: canVerify=true → verify button shown', () => {
  const rootShell = createHarness();
  const { _renderFiscalSection } = rootShell.require('views.clientFiscalVerification');
  const html = _renderFiscalSection({ id: '789', verificationStatus: 'UNVERIFIED' }, [], true);
  assert.match(html, /rfr-verify-button/);
  assert.match(html, /data-rfr-verify/);
});

test('[B-31] _renderFiscalSection: canVerify=false → verify button NOT shown', () => {
  const rootShell = createHarness();
  const { _renderFiscalSection } = rootShell.require('views.clientFiscalVerification');
  const html = _renderFiscalSection({ id: '789', verificationStatus: 'UNVERIFIED' }, [], false);
  assert.doesNotMatch(html, /rfr-verify-button/);
  assert.doesNotMatch(html, /data-rfr-verify/);
});

test('[B-32] _renderFiscalSection: stale warning shown when lastVerifiedAt > 90 days', () => {
  const rootShell = createHarness();
  const { _renderFiscalSection } = rootShell.require('views.clientFiscalVerification');
  const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
  const html = _renderFiscalSection({ id: '789', verificationStatus: 'VERIFIED', lastVerifiedAt: old }, [], false);
  assert.match(html, /rfr-stale-badge/);
  assert.match(html, /90 días/);
});

test('[B-33] _renderFiscalSection: stale warning NOT shown when lastVerifiedAt < 90 days', () => {
  const rootShell = createHarness();
  const { _renderFiscalSection } = rootShell.require('views.clientFiscalVerification');
  const recent = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const html = _renderFiscalSection({ id: '789', verificationStatus: 'VERIFIED', lastVerifiedAt: recent }, [], false);
  assert.doesNotMatch(html, /rfr-stale-badge/);
});

test('[B-34] _renderFiscalSection: loading=true → verify button disabled', () => {
  const rootShell = createHarness();
  const { _renderFiscalSection } = rootShell.require('views.clientFiscalVerification');
  const html = _renderFiscalSection({ id: '789', verificationStatus: 'UNVERIFIED' }, [], true, { loading: true });
  assert.match(html, /disabled/);
  assert.match(html, /aria-disabled="true"/);
  assert.match(html, /Verificando/);
});

test('[B-35] _renderFiscalSection: errorMsg shown in error div', () => {
  const rootShell = createHarness();
  const { _renderFiscalSection } = rootShell.require('views.clientFiscalVerification');
  const html = _renderFiscalSection({ id: '789', verificationStatus: 'UNVERIFIED' }, [], true, { errorMsg: 'Error de red.' });
  assert.match(html, /rfr-fiscal-error/);
  assert.match(html, /Error de red/);
});

// ─── [C] API client ────────────────────────────────────────────────────────────

test('[C-01] clients-api.js exports verifyClientLegalEntity', () => {
  const rootShell = createHarness();
  const clientsApi = rootShell.require('clientsApi');
  assert.equal(typeof clientsApi.verifyClientLegalEntity, 'function');
});

test('[C-02] clients-api.js exports getClientLegalEntityActivities', () => {
  const rootShell = createHarness();
  const clientsApi = rootShell.require('clientsApi');
  assert.equal(typeof clientsApi.getClientLegalEntityActivities, 'function');
});

test('[C-03] verifyClientLegalEntity calls POST /api/client-legal-entities/:id/verify', async () => {
  const calls = [];
  const rootShell = createHarness({
    fetch: async (url, opts) => {
      calls.push({ url, method: opts.method });
      return { ok: true, status: 200, json: async () => ({ id: '789', verificationStatus: 'VERIFIED', activities: [] }) };
    },
  });
  const clientsApi = rootShell.require('clientsApi');
  await clientsApi.verifyClientLegalEntity({ token: 't' }, '789');
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.includes('/api/client-legal-entities/789/verify'));
  assert.equal(calls[0].method, 'POST');
});

test('[C-04] getClientLegalEntityActivities calls GET /api/client-legal-entities/:id/activities', async () => {
  const calls = [];
  const rootShell = createHarness({
    fetchJson: async (_session, url) => {
      calls.push(url);
      return { clientLegalEntityId: '789', activities: [] };
    },
  });
  const clientsApi = rootShell.require('clientsApi');
  await clientsApi.getClientLegalEntityActivities({ token: 't' }, '789');
  assert.equal(calls.length, 1);
  assert.ok(calls[0].includes('/api/client-legal-entities/789/activities'));
});

test('[C-05] verifyClientLegalEntity attaches responseBody on 502 error', async () => {
  const dto502 = { id: '789', verificationStatus: 'VERIFICATION_UNAVAILABLE', activities: [{ code: '6201' }] };
  const rootShell = createHarness({
    fetch: async () => ({
      ok: false,
      status: 502,
      json: async () => dto502,
    }),
  });
  const clientsApi = rootShell.require('clientsApi');
  let caught = null;
  try {
    await clientsApi.verifyClientLegalEntity({ token: 't' }, '789');
  } catch (e) {
    caught = e;
  }
  assert.ok(caught, 'should have thrown');
  assert.equal(caught.statusCode, 502);
  assert.deepEqual(caught.responseBody, dto502);
});

test('[C-06] verifyClientLegalEntity does NOT call Hacienda URL directly', () => {
  const src = readSource('clients-api.js');
  const fnStart = src.indexOf('async function verifyClientLegalEntity');
  const fnEnd = src.indexOf('\n  async function ', fnStart + 1);
  const fnSrc = fnEnd > 0 ? src.slice(fnStart, fnEnd) : src.slice(fnStart);
  assert.doesNotMatch(fnSrc, /hacienda\.go\.cr/i);
  assert.doesNotMatch(fnSrc, /\/fe\/ae/);
});

test('[C-07] verifyClientLegalEntity does NOT call Billing directly', () => {
  const src = readSource('clients-api.js');
  const fnStart = src.indexOf('async function verifyClientLegalEntity');
  const fnEnd = src.indexOf('\n  async function ', fnStart + 1);
  const fnSrc = fnEnd > 0 ? src.slice(fnStart, fnEnd) : src.slice(fnStart);
  assert.doesNotMatch(fnSrc, /billing/i);
});

// ─── [D] clients-admin wiring ─────────────────────────────────────────────────

test('[D-01] clients-admin.js references getClientLegalEntityActivities', () => {
  const src = readSource('views/clients-admin.js');
  assert.match(src, /getClientLegalEntityActivities/);
});

test('[D-02] clients-admin.js uses rootShell.has guard for views.clientFiscalVerification', () => {
  const src = readSource('views/clients-admin.js');
  assert.match(src, /rootShell\.has\(['"]views\.clientFiscalVerification['"]\)/);
});

test('[D-03] clients-admin.js calls mountFiscalSection', () => {
  const src = readSource('views/clients-admin.js');
  assert.match(src, /mountFiscalSection/);
});

test('[D-04] clients-admin.js does NOT call Hacienda URL directly in fiscal wiring', () => {
  const src = readSource('views/clients-admin.js');
  assert.doesNotMatch(src, /hacienda\.go\.cr/i);
  assert.doesNotMatch(src, /\/fe\/ae/);
});

test('[D-05] clients-admin.js does NOT call Billing from fiscal wiring', () => {
  const src = readSource('views/clients-admin.js');
  const fiscalSection = src.slice(src.indexOf('Wave 6'), src.indexOf('setShellStatus'));
  assert.doesNotMatch(fiscalSection, /billingApi/);
});

test('[D-06] clients-admin.renderers.js renders #client-fiscal-body placeholder', () => {
  const src = readSource('views/clients-admin.renderers.js');
  assert.match(src, /id="client-fiscal-body"/);
});

test('[D-07] fiscal section placeholder is conditional on client.legalEntity.id', () => {
  const src = readSource('views/clients-admin.renderers.js');
  assert.match(src, /client\.legalEntity.*client\.legalEntity\.id/s);
});

test('[D-08] fiscal section placeholder has data-rfr-entity-id attribute', () => {
  const src = readSource('views/clients-admin.renderers.js');
  assert.match(src, /data-rfr-entity-id/);
});

test('[D-09] renderClientDetail renders #client-fiscal-body when legalEntity.id present', () => {
  // Load renderers in isolation
  const bw = {};
  const ctx = vm.createContext({ window: bw, Map, Set });
  bw.window = bw;
  vm.runInContext(readSource('registry.js'), ctx);
  bw.InventoryAuth = { fetchJson: async () => ({}), buildHeaders: () => ({}), handleUnauthorized: () => {} };
  vm.runInContext(readSource('ui.js'), ctx);
  vm.runInContext(readSource('views/clients-admin.renderers.js'), ctx);
  const renderers = bw.RootShell.require('views.clientsAdminRenderers');
  const html = renderers.renderClientDetail(
    { id: 1, name: 'Cliente Test', legalEntity: { id: '42', verificationStatus: 'UNVERIFIED' }, stores: [], documents: [], references: [] },
    [], [], [], true,
  );
  assert.match(html, /id="client-fiscal-body"/);
  assert.match(html, /data-rfr-entity-id="42"/);
  assert.match(html, /Datos de facturaci/);
});

test('[D-10] renderClientDetail does NOT render #client-fiscal-body when no legalEntity', () => {
  const bw = {};
  const ctx = vm.createContext({ window: bw, Map, Set });
  bw.window = bw;
  vm.runInContext(readSource('registry.js'), ctx);
  bw.InventoryAuth = { fetchJson: async () => ({}), buildHeaders: () => ({}), handleUnauthorized: () => {} };
  vm.runInContext(readSource('ui.js'), ctx);
  vm.runInContext(readSource('views/clients-admin.renderers.js'), ctx);
  const renderers = bw.RootShell.require('views.clientsAdminRenderers');
  const html = renderers.renderClientDetail(
    { id: 1, name: 'Cliente Test', stores: [], documents: [], references: [] },
    [], [], [], true,
  );
  assert.doesNotMatch(html, /id="client-fiscal-body"/);
});

// ─── [E] Security / accessibility ─────────────────────────────────────────────

test('[E-01] _renderFiscalSection: data-rfr-entity-id set to entity id', () => {
  const rootShell = createHarness();
  const { _renderFiscalSection } = rootShell.require('views.clientFiscalVerification');
  const html = _renderFiscalSection({ id: '789', verificationStatus: 'UNVERIFIED' }, [], false);
  assert.match(html, /data-rfr-entity-id="789"/);
});

test('[E-02] _renderFiscalSection: verify button has aria-label', () => {
  const rootShell = createHarness();
  const { _renderFiscalSection } = rootShell.require('views.clientFiscalVerification');
  const html = _renderFiscalSection({ id: '789', verificationStatus: 'UNVERIFIED' }, [], true);
  const btnStart = html.indexOf('rfr-verify-button');
  assert.ok(btnStart > 0);
  const btnHtml = html.slice(btnStart - 50, html.indexOf('>', btnStart) + 1);
  assert.match(btnHtml, /aria-label/);
});

test('[E-03] _renderActivitiesList: activities list has aria-label', () => {
  const rootShell = createHarness();
  const { _renderActivitiesList } = rootShell.require('views.clientFiscalVerification');
  const html = _renderActivitiesList([{ code: '6201', description: 'Dev', haciendaStatus: 'A', haciendaType: 'P', isCurrentlyReturned: true }], 'VERIFIED');
  assert.match(html, /aria-label="Actividades econ/);
});

test('[E-04] verification badge has role=status', () => {
  const rootShell = createHarness();
  const { _renderVerificationBadge } = rootShell.require('views.clientFiscalVerification');
  assert.match(_renderVerificationBadge('UNVERIFIED'), /role="status"/);
});

test('[E-05] stale badge has role=alert', () => {
  const rootShell = createHarness();
  const { _renderFiscalSection } = rootShell.require('views.clientFiscalVerification');
  const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
  const html = _renderFiscalSection({ id: '789', verificationStatus: 'VERIFIED', lastVerifiedAt: old }, [], false);
  const staleIdx = html.indexOf('rfr-stale-badge');
  assert.ok(staleIdx > 0);
  const staleChunk = html.slice(staleIdx - 80, staleIdx + 150);
  assert.match(staleChunk, /role="alert"/);
});

test('[E-06] error div has role=alert', () => {
  const rootShell = createHarness();
  const { _renderFiscalSection } = rootShell.require('views.clientFiscalVerification');
  const html = _renderFiscalSection({ id: '789', verificationStatus: 'UNVERIFIED' }, [], false, { errorMsg: 'Error' });
  assert.match(html, /role="alert"/);
});

test('[E-07] _renderFiscalSection: word-break on long fields', () => {
  const rootShell = createHarness();
  const { _renderFiscalSection } = rootShell.require('views.clientFiscalVerification');
  const html = _renderFiscalSection({ id: '789', verificationStatus: 'UNVERIFIED', identificationNumber: '1-234-567890' }, [], false);
  assert.match(html, /word-break/);
});

test('[E-08] _renderFiscalSection: no Billing credentials or secret references in output', () => {
  const rootShell = createHarness();
  const { _renderFiscalSection } = rootShell.require('views.clientFiscalVerification');
  const html = _renderFiscalSection({ id: '789', verificationStatus: 'VERIFIED', taxpayerName: 'Demo' }, [{ code: '6201', description: 'Dev', haciendaStatus: 'A', haciendaType: 'P', isCurrentlyReturned: true }], true);
  assert.doesNotMatch(html, /secret/i);
  assert.doesNotMatch(html, /apiKey/i);
  assert.doesNotMatch(html, /credential/i);
});

// ─── [F] Mount behaviour ──────────────────────────────────────────────────────

function _createDomContainer(context) {
  // Minimal HTMLElement and Container for mounting tests
  const container = {
    _html: '',
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = v; },
    _listeners: [],
    addEventListener(event, fn) { this._listeners.push({ event, fn }); },
    async dispatchClick(target) {
      for (const l of this._listeners) {
        if (l.event === 'click') {
          await l.fn({ target });
        }
      }
    },
  };
  // HTMLElement stub for closest() support
  const closest = (selector) => {
    if (selector === '[data-rfr-verify]') return { getAttribute: () => '789', innerHTML: '' };
    return null;
  };
  context.window.HTMLElement = class HTMLElement { closest = closest; };
  return container;
}

test('[F-01] mountFiscalSection: double-click guard — second click during verify is no-op', async () => {
  const calls = [];
  let resolveVerify;
  const verifyPromise = new Promise((res) => { resolveVerify = res; });

  const rootShell = createHarness({
    fetch: async () => {
      calls.push('POST');
      await verifyPromise;
      return { ok: true, status: 200, json: async () => ({ id: '789', verificationStatus: 'VERIFIED', activities: [] }) };
    },
  });
  const mod = rootShell.require('views.clientFiscalVerification');
  const entity = { id: '789', verificationStatus: 'UNVERIFIED' };
  const container = {
    _html: '', get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; },
    _listeners: [],
    addEventListener(e, fn) { this._listeners.push(fn); },
    async click() {
      const mockTarget = { closest: (s) => s === '[data-rfr-verify]' ? { getAttribute: () => '789' } : null };
      for (const fn of this._listeners) await fn({ target: mockTarget });
    },
  };
  container.window = { HTMLElement: class { closest = () => null; } };

  mod.mountFiscalSection(container, {}, entity, [], true, null);

  // Fire two clicks nearly simultaneously
  const c1 = container.click();
  const c2 = container.click();
  await Promise.resolve();
  resolveVerify();
  await Promise.all([c1, c2]);

  // Only one POST should have been made (double-submit guard)
  assert.equal(calls.length, 1);
});

test('[F-02] mountFiscalSection: success → re-renders with updated entity', async () => {
  const updatedDto = { id: '789', verificationStatus: 'VERIFIED', lastVerifiedAt: '2025-06-01T00:00:00Z', activities: [{ code: '6201', description: 'Dev', haciendaStatus: 'A', haciendaType: 'P', isCurrentlyReturned: true }] };
  const rootShell = createHarness({
    fetch: async () => ({ ok: true, status: 200, json: async () => updatedDto }),
  });
  const mod = rootShell.require('views.clientFiscalVerification');
  const entity = { id: '789', verificationStatus: 'UNVERIFIED' };
  const renders = [];
  const container = {
    _html: '', get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; renders.push(v); },
    _listeners: [],
    addEventListener(e, fn) { this._listeners.push(fn); },
  };

  mod.mountFiscalSection(container, {}, entity, [], true, null);
  // Trigger click
  const fakeTarget = { closest: (s) => s === '[data-rfr-verify]' ? { getAttribute: () => '789' } : null };
  for (const fn of container._listeners) await fn({ target: fakeTarget });

  const finalHtml = renders[renders.length - 1];
  assert.match(finalHtml, /Verificado con Hacienda/);
  assert.match(finalHtml, /6201/);
});

test('[F-03] mountFiscalSection: 502 error preserves activities, shows VERIFICATION_UNAVAILABLE', async () => {
  const dto502 = { id: '789', verificationStatus: 'VERIFICATION_UNAVAILABLE', activities: [{ code: '6201', description: 'Dev', haciendaStatus: 'A', haciendaType: 'P', isCurrentlyReturned: true }] };
  const err502 = Object.assign(new Error('Hacienda no disponible.'), { statusCode: 502, responseBody: dto502 });
  const rootShell = createHarness({
    fetch: async () => { throw err502; },
  });
  const mod = rootShell.require('views.clientFiscalVerification');
  const entity = { id: '789', verificationStatus: 'UNVERIFIED' };
  const renders = [];
  const container = {
    _html: '', get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; renders.push(v); },
    _listeners: [],
    addEventListener(e, fn) { this._listeners.push(fn); },
  };
  mod.mountFiscalSection(container, {}, entity, [], true, null);
  const fakeTarget = { closest: (s) => s === '[data-rfr-verify]' ? { getAttribute: () => '789' } : null };
  for (const fn of container._listeners) await fn({ target: fakeTarget });

  const finalHtml = renders[renders.length - 1];
  assert.match(finalHtml, /Verificaci.n no disponible/);
  assert.match(finalHtml, /6201/); // activities preserved
  assert.match(finalHtml, /Hacienda no disponible/); // error message
});

test('[F-04] mountFiscalSection: 404 → entity status becomes NOT_FOUND', async () => {
  const err404 = Object.assign(new Error('No encontrado.'), { statusCode: 404 });
  const rootShell = createHarness({
    fetch: async () => { throw err404; },
  });
  const mod = rootShell.require('views.clientFiscalVerification');
  const entity = { id: '789', verificationStatus: 'UNVERIFIED' };
  const renders = [];
  const container = {
    _html: '', get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; renders.push(v); },
    _listeners: [],
    addEventListener(e, fn) { this._listeners.push(fn); },
  };
  mod.mountFiscalSection(container, {}, entity, [], true, null);
  const fakeTarget = { closest: (s) => s === '[data-rfr-verify]' ? { getAttribute: () => '789' } : null };
  for (const fn of container._listeners) await fn({ target: fakeTarget });

  const finalHtml = renders[renders.length - 1];
  assert.match(finalHtml, /No encontrado en Hacienda/);
});

test('[F-05] mountFiscalSection: generic error → shows error, verify button re-enabled (allows retry)', async () => {
  let _callCount = 0;
  const rootShell = createHarness({
    fetch: async () => {
      _callCount++;
      throw Object.assign(new Error('Red no disponible.'), { statusCode: 503 });
    },
  });
  const mod = rootShell.require('views.clientFiscalVerification');
  const entity = { id: '789', verificationStatus: 'UNVERIFIED' };
  const renders = [];
  const container = {
    _html: '', get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; renders.push(v); },
    _listeners: [],
    addEventListener(e, fn) { this._listeners.push(fn); },
  };
  mod.mountFiscalSection(container, {}, entity, [], true, null);
  const fakeTarget = { closest: (s) => s === '[data-rfr-verify]' ? { getAttribute: () => '789' } : null };
  for (const fn of container._listeners) await fn({ target: fakeTarget });

  const finalHtml = renders[renders.length - 1];
  assert.match(finalHtml, /Red no disponible/);
  // Button should be enabled again (no disabled attr) — retry is possible
  const btnIdx = finalHtml.indexOf('rfr-verify-button');
  const btnChunk = finalHtml.slice(btnIdx, finalHtml.indexOf('>', btnIdx) + 1);
  assert.doesNotMatch(btnChunk, /\bdisabled\b/);
});

test('[F-06] mountFiscalSection: onRefreshed called with updated entity on success', async () => {
  const updatedDto = { id: '789', verificationStatus: 'VERIFIED', activities: [] };
  const rootShell = createHarness({
    fetch: async () => ({ ok: true, status: 200, json: async () => updatedDto }),
  });
  const mod = rootShell.require('views.clientFiscalVerification');
  const entity = { id: '789', verificationStatus: 'UNVERIFIED' };
  const container = {
    _html: '', get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; },
    _listeners: [],
    addEventListener(e, fn) { this._listeners.push(fn); },
  };
  let refreshedEntity = null;
  mod.mountFiscalSection(container, {}, entity, [], true, (e) => { refreshedEntity = e; });
  const fakeTarget = { closest: (s) => s === '[data-rfr-verify]' ? { getAttribute: () => '789' } : null };
  for (const fn of container._listeners) await fn({ target: fakeTarget });

  assert.ok(refreshedEntity, 'onRefreshed should have been called');
  assert.equal(refreshedEntity.verificationStatus, 'VERIFIED');
});

test('[F-07] mountFiscalSection: null container → no crash', () => {
  const rootShell = createHarness();
  const mod = rootShell.require('views.clientFiscalVerification');
  assert.doesNotThrow(() => mod.mountFiscalSection(null, {}, null, [], true, null));
});
