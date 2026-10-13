'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const publicPath = path.join(__dirname, '..', 'src', 'public');
const rootPublicPath = path.join(publicPath, 'root');

function run(relativePath, context) {
  vm.runInContext(fs.readFileSync(path.join(rootPublicPath, relativePath), 'utf8'), context, { filename: relativePath });
}

function securityData(overrides = {}) {
  return {
    environment: 'SANDBOX',
    connection: {
      environment: 'SANDBOX', status: 'CONNECTED', usernameMasked: 'ha***@example.test',
      lastValidatedAt: '2026-10-12T00:00:00.000Z', lastSuccessfulAuthAt: '2026-10-12T00:00:00.000Z',
    },
    certificate: {
      environment: 'SANDBOX', status: 'ACTIVE', serialNumber: '01AB',
      subjectName: 'CN=Inventori SA', issuerName: 'CN=Synthetic CA',
      extractedIdentityType: 'JURIDICA', extractedIdentityNumber: '3101999999',
      validFrom: '2026-01-01T00:00:00.000Z', validTo: '2026-10-24T00:00:00.000Z',
      expiryState: 'EXPIRING_SOON', daysRemaining: 12,
    },
    ...overrides,
  };
}

function issuerData() {
  return {
    association: { status: 'ASSOCIATED', environment: 'SANDBOX', profileVersion: 'inventori-fiscal-v1' },
    issuer: { legalName: 'Inventori SA', tradeName: 'Inventori', identificationType: 'JURIDICA', identificationNumber: '3101999999', status: 'ACTIVE', identityLockPolicy: 'BILLING_ENFORCED' },
    profile: { economicActivityCode: '620100', province: '1', canton: '01', district: '01', otrasSenas: 'San José', email: 'fiscal@example.test' },
  };
}

function settingsData() {
  return { taxpayer: {}, activities: [], configuration: { hasBillingIntegration: true } };
}

function createElement() {
  return { innerHTML: '', hidden: false, handlers: {}, addEventListener(event, handler) { this.handlers[event] = handler; }, querySelectorAll() { return []; }, querySelector() { return null; } };
}

function createViewHarness(api) {
  const browserWindow = {};
  class FormDataStub {
    constructor(form) { this.form = form; }
    get(name) { return this.form?.values?.[name] ?? null; }
  }
  const context = vm.createContext({ Map, Set, FormData: FormDataStub, window: browserWindow });
  browserWindow.window = browserWindow;
  run('registry.js', context);
  run('ui.js', context);
  browserWindow.RootShell.register('fiscalSettingsApi', api);
  run('views/fiscal-settings-admin.js', context);

  const status = createElement();
  const content = createElement();
  const readiness = createElement();
  const issuer = createElement();
  const refresh = createElement();
  const usernameInput = { value: 'synthetic-user' };
  const passwordInput = { value: 'synthetic-password' };
  const pinInput = { value: 'one-time-pin' };
  const certificateInput = { files: [{ name: 'synthetic.p12', size: 1024 }] };
  const replaceInput = { value: 'true' };
  const credentialForm = { elements: { username: usernameInput, password: passwordInput }, handlers: {}, addEventListener(event, handler) { this.handlers[event] = handler; } };
  const validateButton = { handlers: {}, addEventListener(event, handler) { this.handlers[event] = handler; } };
  const disableRequestButton = { handlers: {}, addEventListener(event, handler) { this.handlers[event] = handler; }, focus() {} };
  const disableCancelButton = { handlers: {}, addEventListener(event, handler) { this.handlers[event] = handler; }, focus() {} };
  const disableConfirmButton = { handlers: {}, addEventListener(event, handler) { this.handlers[event] = handler; }, focus() {} };
  const certificateForm = {
    elements: { certificate: certificateInput, pin: pinInput, replace: replaceInput }, handlers: {},
    reportValidity() { return true; }, addEventListener(event, handler) { this.handlers[event] = handler; },
  };
  const security = createElement();
  security.querySelector = (selector) => ({
    '[data-hacienda-credentials-form]': credentialForm,
    '[data-hacienda-validate]': validateButton,
    '[data-hacienda-disable-request]': disableRequestButton,
    '[data-hacienda-disable-cancel]': disableCancelButton,
    '[data-hacienda-disable-confirm]': disableConfirmButton,
    '[data-fiscal-certificate-form]': certificateForm,
  })[selector] || null;
  issuer.querySelector = () => null;

  const container = {
    querySelector(selector) {
      return ({
        '[data-fiscal-settings-status]': status,
        '[data-fiscal-settings-content]': content,
        '[data-fiscal-refresh-btn]': refresh,
        '[data-fiscal-readiness-content]': readiness,
        '[data-fiscal-issuer-content]': issuer,
        '[data-fiscal-security-content]': security,
      })[selector] || null;
    },
  };
  const session = { user: { permissions: ['fiscal.settings.view', 'fiscal.credentials.manage'] } };
  return {
    view: browserWindow.RootShell.require('views.fiscalSettingsAdmin'), container, session,
    status, security, credentialForm, certificateForm, usernameInput, passwordInput, pinInput, certificateInput, replaceInput,
    disableRequestButton, disableCancelButton, disableConfirmButton,
  };
}

test('Wave 5 UI renders masked connection, safe certificate metadata and expiry warning', async () => {
  const harness = createViewHarness({
    async getIssuerAdministration() { return issuerData(); },
    async getFiscalSecurityConfiguration() { return securityData(); },
    async getFiscalSettings() { return settingsData(); },
  });
  await harness.view.mount(harness.container, harness.session, {});
  assert.match(harness.security.innerHTML, /Conexión con Hacienda/);
  assert.match(harness.security.innerHTML, /Configuradas \(valor oculto\)/);
  assert.match(harness.security.innerHTML, /Vence pronto/);
  assert.match(harness.security.innerHTML, /vence en 12 días/);
  assert.match(harness.security.innerHTML, /Identidad verificada/);
  assert.match(harness.security.innerHTML, /aria-busy=/);
  assert.doesNotMatch(harness.security.innerHTML, /synthetic-password|one-time-pin|privateKey|secretReference|billingCompanyId|billingTenantId/i);
});

test('credential submit prevents duplicate writes and clears password after canonical response', async () => {
  let calls = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const harness = createViewHarness({
    async getIssuerAdministration() { return issuerData(); },
    async getFiscalSecurityConfiguration() { return securityData(); },
    async getFiscalSettings() { return settingsData(); },
    async configureHaciendaCredentials(_session, payload) {
      calls += 1;
      assert.equal(payload.username, 'synthetic-user');
      assert.equal(payload.password, 'synthetic-password');
      await pending;
      return { connection: securityData().connection };
    },
  });
  await harness.view.mount(harness.container, harness.session, {});
  const handler = harness.credentialForm.handlers.submit;
  const event = { preventDefault() {}, target: harness.credentialForm };
  const first = handler(event);
  const duplicate = handler(event);
  assert.equal(calls, 1);
  release();
  await Promise.all([first, duplicate]);
  assert.equal(harness.passwordInput.value, '');
  assert.match(harness.status.innerHTML, /Credenciales guardadas y validadas/);
});

test('certificate replacement clears PIN and re-reads preserved canonical certificate after mismatch', async () => {
  let securityReads = 0;
  let uploadCalls = 0;
  const harness = createViewHarness({
    async getIssuerAdministration() { return issuerData(); },
    async getFiscalSecurityConfiguration() { securityReads += 1; return securityData(); },
    async getFiscalSettings() { return settingsData(); },
    async uploadSigningCertificate(_session, payload) {
      uploadCalls += 1;
      assert.equal(payload.replace, true);
      assert.equal(payload.pin, 'one-time-pin');
      const error = new Error('unsafe provider detail');
      error.code = 'FISCAL_CERTIFICATE_IDENTITY_MISMATCH';
      throw error;
    },
  });
  await harness.view.mount(harness.container, harness.session, {});
  await harness.certificateForm.handlers.submit({ preventDefault() {}, currentTarget: harness.certificateForm });
  assert.equal(uploadCalls, 1);
  assert.equal(securityReads, 2);
  assert.equal(harness.pinInput.value, '');
  assert.match(harness.status.innerHTML, /identidad del certificado no coincide/i);
  assert.match(harness.security.innerHTML, /Vence pronto/);
  assert.doesNotMatch(harness.security.innerHTML, /one-time-pin|unsafe provider detail/i);
});

test('Hacienda disable requires inline confirmation, prevents duplicate requests and renders canonical disabled state', async () => {
  let calls = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const harness = createViewHarness({
    async getIssuerAdministration() { return issuerData(); },
    async getFiscalSecurityConfiguration() { return securityData(); },
    async getFiscalSettings() { return settingsData(); },
    async disableHaciendaConnection() {
      calls += 1;
      await pending;
      return { connection: { environment: 'SANDBOX', status: 'DISABLED' } };
    },
  });
  await harness.view.mount(harness.container, harness.session, {});

  harness.disableRequestButton.handlers.click();
  assert.match(harness.security.innerHTML, /¿Deshabilitar la conexión\?/);
  assert.match(harness.security.innerHTML, /No se borrarán credenciales, certificados ni historial/);
  const first = harness.disableConfirmButton.handlers.click();
  const duplicate = harness.disableConfirmButton.handlers.click();
  assert.equal(calls, 1);
  assert.match(harness.security.innerHTML, /Deshabilitando…/);
  release();
  await Promise.all([first, duplicate]);

  assert.match(harness.status.innerHTML, /emisión fiscal quedó bloqueada/);
  assert.match(harness.security.innerHTML, /La conexión está deshabilitada/);
  assert.doesNotMatch(harness.security.innerHTML, /data-hacienda-disable-request/);
});

test('frontend client sends FormData only to Inventori and selects POST versus PUT for replacement', async () => {
  const calls = [];
  class FormDataStub {
    constructor() { this.entries = []; }
    append(name, value) { this.entries.push([name, value]); }
  }
  const browserWindow = {};
  const context = vm.createContext({ window: browserWindow, FormData: FormDataStub });
  browserWindow.window = browserWindow;
  browserWindow.InventoryAuth = { async fetchJson(_session, url, options) { calls.push({ url, options }); return {}; } };
  run('registry.js', context);
  run('fiscal-settings-api.js', context);
  const api = browserWindow.RootShell.require('fiscalSettingsApi');
  await api.uploadSigningCertificate({}, { certificate: { name: 'synthetic.p12' }, pin: 'write-only', replace: false });
  await api.uploadSigningCertificate({}, { certificate: { name: 'synthetic.p12' }, pin: 'write-only', replace: true });
  await api.disableHaciendaConnection({});
  assert.deepEqual(calls.map((call) => call.options.method), ['POST', 'PUT', 'POST']);
  assert.ok(calls.slice(0, 2).every((call) => call.url === '/api/company/fiscal-settings/certificate'));
  assert.ok(calls.slice(0, 2).every((call) => call.options.body instanceof FormDataStub));
  assert.equal(calls[2].url, '/api/company/fiscal-settings/hacienda-credentials/disable');
  assert.deepEqual(JSON.parse(calls[2].options.body), {});

  const source = fs.readFileSync(path.join(rootPublicPath, 'fiscal-settings-api.js'), 'utf8');
  assert.doesNotMatch(source, /X-API-Key|bk_(?:test|live)_|billingCredentialSecretRef|localhost:4000|hacienda\.go\.cr/i);
});

test('Wave 5 responsive and accessibility safeguards remain encoded in source and CSS', () => {
  const viewSource = fs.readFileSync(path.join(rootPublicPath, 'views', 'fiscal-settings-admin.js'), 'utf8');
  const css = fs.readFileSync(path.join(publicPath, 'styles.css'), 'utf8');
  assert.match(viewSource, /type="password"[^>]*autocomplete="new-password"/);
  assert.match(viewSource, /accept="\.p12,\.pfx,application\/x-pkcs12,application\/pkcs12"/);
  assert.match(viewSource, /role="status"/);
  assert.match(viewSource, /aria-live="polite"/);
  assert.match(css, /\.fiscal-security-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s);
  assert.match(css, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.fiscal-security-grid\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /min-height:\s*44px/);
});
