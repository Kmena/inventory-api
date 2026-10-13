'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootPublicPath = path.join(__dirname, '..', 'src', 'public', 'root');

function run(relativePath, context) {
  vm.runInContext(fs.readFileSync(path.join(rootPublicPath, relativePath), 'utf8'), context, { filename: relativePath });
}

function issuer(status = 'ASSOCIATED') {
  return {
    association: { status, environment: 'SANDBOX', profileVersion: status === 'ASSOCIATED' ? 'inventori-fiscal-v1' : null },
    issuer: status === 'ASSOCIATED' ? {
      legalName: 'Inventori SA', tradeName: 'Inventori', identificationType: 'JURIDICA',
      identificationNumber: '3101999999', status: 'ACTIVE', identityLockPolicy: 'BILLING_ENFORCED',
    } : null,
    profile: status === 'ASSOCIATED' ? {
      economicActivityCode: '620100', province: '1', canton: '01', district: '01',
      otrasSenas: 'San José', email: 'fiscal@example.test', phoneCountryCode: '506', phoneNumber: '22000000',
    } : null,
  };
}

function settings() {
  return { taxpayer: {}, activities: [], configuration: { hasBillingIntegration: true } };
}

function createHarness(api, formValues = {}) {
  const browserWindow = {};
  class FormDataStub { get(name) { return formValues[name] ?? null; } }
  const context = vm.createContext({ Map, Set, FormData: FormDataStub, window: browserWindow });
  browserWindow.window = browserWindow;
  run('registry.js', context);
  run('ui.js', context);
  browserWindow.RootShell.register('fiscalSettingsApi', api);
  run('views/fiscal-settings-admin.js', context);

  const handlers = {};
  const provisionButton = { addEventListener(_event, handler) { handlers.provision = handler; } };
  const issuerForm = {
    addEventListener(_event, handler) { handlers.submit = handler; },
    reportValidity() { return true; },
  };
  const issuerElement = {
    innerHTML: '',
    querySelector(selector) {
      if (selector === '[data-fiscal-issuer-provision]' && this.innerHTML.includes('data-fiscal-issuer-provision')) return provisionButton;
      if (selector === '[data-fiscal-issuer-form]' && this.innerHTML.includes('data-fiscal-issuer-form')) return issuerForm;
      return null;
    },
  };
  const statusElement = { innerHTML: '' };
  const readinessElement = { innerHTML: '', querySelector() { return null; } };
  const contentElement = { innerHTML: '', querySelectorAll() { return []; }, querySelector() { return null; } };
  const container = {
    querySelector(selector) {
      if (selector === '[data-fiscal-settings-status]') return statusElement;
      if (selector === '[data-fiscal-settings-content]') return contentElement;
      if (selector === '[data-fiscal-issuer-content]') return issuerElement;
      if (selector === '[data-fiscal-readiness-content]') return readinessElement;
      return null;
    },
  };
  const session = { user: { permissions: ['fiscal.settings.view', 'fiscal.credentials.manage'] } };
  return { view: browserWindow.RootShell.require('views.fiscalSettingsAdmin'), container, session, issuerElement, readinessElement, statusElement, handlers, issuerForm };
}

test('Wave 4 UI provisions once from the server and switches to the canonical issuer form', async () => {
  let provisionCalls = 0;
  const harness = createHarness({
    async getIssuerAdministration() { return issuer('NOT_ASSOCIATED'); },
    async provisionIssuer() { provisionCalls += 1; return issuer(); },
    async getFiscalSettings() { return settings(); },
  });
  await harness.view.mount(harness.container, harness.session, {});
  assert.match(harness.issuerElement.innerHTML, /Pendiente de asociación/);
  await harness.handlers.provision();
  assert.equal(provisionCalls, 1);
  assert.match(harness.issuerElement.innerHTML, /Sincronizado/);
  assert.match(harness.issuerElement.innerHTML, /Billing bloquea tipo y número/);
  assert.doesNotMatch(harness.issuerElement.innerHTML, /bk_test_|apiKeyId|tenantId|billingCompanyId/);
});

test('Wave 4 UI validates and submits issuer/profile fields, then renders canonical read-back', async () => {
  let submitted = null;
  const formValues = {
    legalName: 'Inventori SA', tradeName: 'Inventori', identificationType: 'JURIDICA',
    identificationNumber: '3101999999', economicActivityCode: '620100', email: 'fiscal@example.test',
    province: '1', canton: '01', district: '01', barrio: '', otrasSenas: 'San José',
    phoneCountryCode: '506', phoneNumber: '22000000',
  };
  const harness = createHarness({
    async getIssuerAdministration() { return issuer(); },
    async updateIssuerAdministration(_session, payload) { submitted = payload; return issuer(); },
    async getFiscalSettings() { return settings(); },
  }, formValues);
  await harness.view.mount(harness.container, harness.session, {});
  await harness.handlers.submit({ preventDefault() {}, currentTarget: harness.issuerForm });
  assert.equal(submitted.issuer.identificationNumber, '3101999999');
  assert.equal(submitted.profile.economicActivityCode, '620100');
  assert.equal(submitted.profile.barrio, undefined);
  assert.match(harness.statusElement.innerHTML, /Configuración confirmada por Billing/);
});

test('post-deployment UI renders historical association and a terminal readiness state without a provision action', async () => {
  const harness = createHarness({
    async getIssuerAdministration() { return issuer('HISTORICAL_ONLY'); },
    async getFiscalSettings() {
      throw Object.assign(new Error('La integracion Billing esta deshabilitada para esta empresa'), {
        code: 'BILLING_INTEGRATION_DISABLED',
        statusCode: 409,
      });
    },
  });
  harness.session.user.companyId = '1';

  await harness.view.mount(harness.container, harness.session, {});

  assert.match(harness.issuerElement.innerHTML, /Solo histórica/);
  assert.match(harness.issuerElement.innerHTML, /Empresa de la sesión actual:\s*<strong>1<\/strong>/);
  assert.doesNotMatch(harness.issuerElement.innerHTML, /data-fiscal-issuer-provision/);
  assert.match(harness.readinessElement.innerHTML, /Asociación solo histórica/);
  assert.doesNotMatch(harness.readinessElement.innerHTML, /Comprobando preparación fiscal/);
});

test('Wave 4 frontend API never references Billing hosts or credentials', () => {
  const source = fs.readFileSync(path.join(rootPublicPath, 'fiscal-settings-api.js'), 'utf8');
  assert.match(source, /\/issuer\/provision/);
  assert.doesNotMatch(source, /X-API-Key|bk_(?:test|live)_|localhost:4000|billingCredentialSecretRef/);
});
