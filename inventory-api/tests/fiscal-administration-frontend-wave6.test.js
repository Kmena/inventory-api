'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const publicPath = path.join(__dirname, '..', 'src', 'public');
const rootPublicPath = path.join(publicPath, 'root');
const branchId = '40000000-0000-4000-8000-000000000001';
const terminalId = '40000000-0000-4000-8000-000000000002';

function run(relativePath, context) {
  vm.runInContext(fs.readFileSync(path.join(rootPublicPath, relativePath), 'utf8'), context, { filename: relativePath });
}

function element() {
  return {
    innerHTML: '', hidden: false, handlers: {},
    addEventListener(type, handler) { this.handlers[type] = handler; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
}

function issuanceData() {
  return {
    environment: 'SANDBOX',
    branches: [{
      branchId, code: '001', name: 'Sucursal central', active: true,
      terminals: [{ terminalId, code: '00001', name: 'Caja principal', active: true }],
    }],
    defaultIssuancePoint: {
      environment: 'SANDBOX', branchId, terminalId, branchCode: '001', terminalCode: '00001',
      name: 'Principal', active: true, isDefault: true,
    },
  };
}

function createHarness(api) {
  const browserWindow = {};
  class FormDataStub { constructor(form) { this.form = form; } get(name) { return this.form?.values?.[name] ?? null; } }
  const context = vm.createContext({ Map, Set, FormData: FormDataStub, window: browserWindow });
  browserWindow.window = browserWindow;
  run('registry.js', context);
  run('ui.js', context);
  browserWindow.RootShell.register('fiscalSettingsApi', api);
  run('views/fiscal-settings-admin.js', context);
  const elements = {
    status: element(), content: element(), refresh: element(), readiness: element(),
    issuer: element(), security: element(), issuance: element(),
  };
  const container = {
    querySelector(selector) {
      return ({
        '[data-fiscal-settings-status]': elements.status,
        '[data-fiscal-settings-content]': elements.content,
        '[data-fiscal-refresh-btn]': elements.refresh,
        '[data-fiscal-readiness-content]': elements.readiness,
        '[data-fiscal-issuer-content]': elements.issuer,
        '[data-fiscal-security-content]': elements.security,
        '[data-fiscal-issuance-content]': elements.issuance,
      })[selector] || null;
    },
  };
  return {
    view: browserWindow.RootShell.require('views.fiscalSettingsAdmin'),
    container,
    elements,
    session: { user: { permissions: ['fiscal.settings.view', 'fiscal.credentials.manage'] } },
  };
}

test('Wave 6 UI renders branches, grouped terminals, default state and immutable sequence guidance', async () => {
  const harness = createHarness({
    async getIssuerAdministration() { return { association: { status: 'ASSOCIATED', environment: 'SANDBOX' }, issuer: {}, profile: {} }; },
    async getFiscalSecurityConfiguration() { return { environment: 'SANDBOX', connection: null, certificate: null }; },
    async getIssuanceAdministration() { return issuanceData(); },
    async getFiscalSettings() { return { taxpayer: {}, activities: [], configuration: { hasBillingIntegration: true } }; },
  });
  await harness.view.mount(harness.container, harness.session, {});
  const markup = harness.elements.issuance.innerHTML;
  assert.match(markup, /Sucursales y puntos de emisión/);
  assert.match(markup, /001 · Sucursal central/);
  assert.match(markup, /00001 · Caja principal/);
  assert.match(markup, /Predeterminada/);
  assert.match(markup, /independientes de bodegas y locales comerciales/);
  assert.match(markup, /Billing asigna los consecutivos/);
  assert.match(markup, /Consultar secuencia/);
  assert.match(markup, /pattern="\\d\{3\}"/);
  assert.match(markup, /pattern="\\d\{5\}"/);
  assert.doesNotMatch(markup, /billingCompanyId|billingTenantId|tenantId|secretReference|apiKey|password/i);
});

test('frontend API sends exact same-origin Wave 6 requests and explicit sequence confirmation', async () => {
  const calls = [];
  const browserWindow = {};
  const context = vm.createContext({ window: browserWindow });
  browserWindow.window = browserWindow;
  browserWindow.InventoryAuth = { async fetchJson(_session, url, options = {}) { calls.push({ url, options }); return {}; } };
  run('registry.js', context);
  run('fiscal-settings-api.js', context);
  const api = browserWindow.RootShell.require('fiscalSettingsApi');
  await api.getIssuanceAdministration({});
  await api.upsertFiscalBranch({}, { code: '001', name: 'Sucursal' });
  await api.upsertFiscalTerminal({}, branchId, { code: '00001', name: 'Caja' });
  await api.selectDefaultIssuancePoint({}, terminalId);
  await api.readFiscalSequence({}, terminalId, 'INVOICE');
  await api.configureInitialFiscalSequence({}, { terminalId, documentType: 'INVOICE', nextValue: 10 });
  assert.deepEqual(calls.map(({ options }) => options.method || 'GET'), ['GET', 'POST', 'POST', 'PUT', 'POST', 'PUT']);
  assert.ok(calls.every(({ url }) => url.startsWith('/api/company/fiscal-settings/')));
  assert.deepEqual(JSON.parse(calls[5].options.body), { terminalId, documentType: 'INVOICE', nextValue: 10, confirmed: true });
  assert.doesNotMatch(JSON.stringify(calls), /warehouseId|fiscalBranchId/i);
  assert.doesNotMatch(fs.readFileSync(path.join(rootPublicPath, 'fiscal-settings-api.js'), 'utf8'), /X-API-Key|billingCredentialSecretRef|localhost:4000/i);
});

test('Wave 6 source encodes duplicate-submit, confirmation, keyboard and responsive safeguards', () => {
  const view = fs.readFileSync(path.join(rootPublicPath, 'views', 'fiscal-settings-admin.js'), 'utf8');
  const css = fs.readFileSync(path.join(publicPath, 'styles.css'), 'utf8');
  assert.match(view, /if \(issuancePending\) return/);
  assert.match(view, /if \(sequencePending \|\| !event\.currentTarget\.reportValidity\(\)\) return/);
  assert.match(view, /name="confirmed" type="checkbox" required/);
  assert.match(view, /<details class="fiscal-inline-editor">/);
  assert.match(view, /aria-live="polite"/);
  assert.match(css, /\.fiscal-compact-form[\s\S]*min-height:\s*44px/);
  assert.match(css, /@media \(max-width: 1023px\)[\s\S]*\.fiscal-compact-form--two-fields/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.fiscal-terminal-summary/);
});
