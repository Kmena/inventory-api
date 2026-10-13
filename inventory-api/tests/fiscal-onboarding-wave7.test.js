'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appRoot = path.join(__dirname, '..');
const { BillingApiClient } = require(path.join(appRoot, 'src/services/billing-api-client.service'));
const fiscalSettingsService = require(path.join(appRoot, 'src/services/fiscal-settings.service'));
const { validateOrderFiscalReadiness } = require(path.join(appRoot, 'src/services/fiscal-readiness.service'));

function dimension(state = 'READY', blockers = [], metadata = {}) {
  return { state, blockers, metadata };
}

function readiness(overrides = {}) {
  return {
    contractVersion: '1.0', profileVersion: 'inventori-fiscal-v1',
    companyId: '20000000-0000-4000-8000-000000000001', environment: 'SANDBOX',
    status: 'READY', readyToIssue: true, checkedAt: '2026-10-12T12:00:00.000Z',
    blockers: [], warnings: [],
    dimensions: {
      issuer: dimension('READY', [], { companyActive: true, verificationStatus: 'VERIFIED' }),
      profile: dimension('READY', [], { configured: true }),
      activity: dimension('READY', [], { count: 2, defaultActivityId: '30000000-0000-4000-8000-000000000001' }),
      hacienda: dimension('READY', [], { status: 'CONNECTED', lastValidatedAt: '2026-10-12T11:00:00.000Z' }),
      certificate: dimension('READY', [], { status: 'ACTIVE', validFrom: '2026-01-01T00:00:00.000Z', validTo: '2027-01-01T00:00:00.000Z' }),
      issuancePoint: dimension('READY', [], { branchCode: '001', terminalCode: '00001', active: true, isDefault: true }),
      sequence: dimension('READY', [], { configuredTypes: 2, automaticInitialization: true }),
      operational: dimension('READY', [], { database: 'AVAILABLE' }),
    },
    ...overrides,
  };
}

test('Wave 7 client uses the exact versioned read-only readiness path and preserves all dimensions', async () => {
  const calls = [];
  const client = new BillingApiClient({
    baseUrl: 'https://billing.example.test',
    credentialResolver: { resolveApiKey: () => 'synthetic-key' },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new globalThis.Response(JSON.stringify(readiness()), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  const result = await client.getFiscalReadinessV1({
    billingCompanyId: '20000000-0000-4000-8000-000000000001', environment: 'SANDBOX',
    secretReference: 'secret/ref', correlationId: 'wave7-test',
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.body, undefined);
  assert.equal(calls[0].url, 'https://billing.example.test/api/v1/companies/20000000-0000-4000-8000-000000000001/fiscal-onboarding/v1/SANDBOX/readiness');
  assert.deepEqual(Object.keys(result.dimensions), ['issuer', 'profile', 'activity', 'hacienda', 'certificate', 'issuancePoint', 'sequence', 'operational']);
});

test('Wave 7 client fails closed on cross-environment, incomplete, inconsistent or secret-bearing readiness', async (t) => {
  const cases = [
    readiness({ environment: 'PRODUCTION' }),
    readiness({ dimensions: { ...readiness().dimensions, certificate: undefined } }),
    readiness({ status: 'NOT_READY', readyToIssue: true }),
    readiness({ dimensions: { ...readiness().dimensions, certificate: dimension('READY', [], { passwordSecretReference: 'secret/x' }) } }),
  ];
  for (const [index, body] of cases.entries()) {
    await t.test(`malformed-${index + 1}`, async () => {
      const client = new BillingApiClient({
        baseUrl: 'https://billing.example.test', credentialResolver: { resolveApiKey: () => 'key' },
        fetchImpl: async () => new globalThis.Response(JSON.stringify(body), { status: 200 }),
      });
      await assert.rejects(() => client.getFiscalReadinessV1({
        billingCompanyId: '20000000-0000-4000-8000-000000000001', environment: 'SANDBOX', secretReference: 'ref',
      }), (error) => error.code === 'BILLING_MALFORMED_FISCAL_READINESS');
    });
  }
});

test('Wave 7 service derives company/environment server-side, strips provider company id and performs no mutation', async () => {
  const observed = [];
  const result = await fiscalSettingsService.getFiscalReadiness({ companyId: '77' }, {}, {
    billingIntegrationConfigRepository: {
      async findByCompanyId(companyId) {
        assert.equal(String(companyId), '77');
        return { enabled: true, billingTenantId: 'tenant', billingCompanyId: readiness().companyId, billingEnvironment: 'SANDBOX', billingCredentialSecretRef: 'secret/ref' };
      },
    },
    billingClient: {
      async getFiscalReadiness(args) { observed.push(args); return readiness(); },
    },
  });
  assert.equal(observed.length, 1);
  assert.equal(observed[0].billingCompanyId, readiness().companyId);
  assert.equal(observed[0].environment, 'SANDBOX');
  assert.equal(observed[0].contractVersion, '1.0');
  assert.equal(result.companyId, undefined);
  assert.equal(result.authority, 'BILLING');
  assert.equal(result.sources.transaction, 'INVENTORI_AT_TRANSACTION_HANDOFF');
  assert.equal(result.status, 'READY');
  assert.equal(result.dimensions.operational.metadata.database, 'AVAILABLE');
});

function fiscalTestResult(overrides = {}) {
  return {
    contractVersion: '1.0', profileVersion: 'inventori-fiscal-v1',
    executionId: '30000000-0000-4000-8000-000000000001',
    documentId: '30000000-0000-4000-8000-000000000001',
    environment: 'SANDBOX', mode: 'HACIENDA_SANDBOX_SUBMISSION',
    disclosure: { consumesSandboxConsecutive: true, billingRequestAcceptedIsNotHaciendaAcceptance: true },
    document: { status: 'READY_TO_SUBMIT', consecutive: '00100001010000000001' },
    submission: { status: 'QUEUED', haciendaAccepted: false },
    artifacts: [], deliveries: [], ...overrides,
  };
}

test('Wave 7 test-invoice client publishes one stable idempotency key and validates safe status', async () => {
  const calls = [];
  const client = new BillingApiClient({
    baseUrl: 'https://billing.example.test', credentialResolver: { resolveApiKey: () => 'synthetic-key' },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new globalThis.Response(JSON.stringify(fiscalTestResult()), { status: 202 });
    },
  });
  const idempotencyKey = '90000000-0000-4000-8000-000000000001';
  const result = await client.initiateFiscalTestInvoiceV1({
    billingCompanyId: readiness().companyId, environment: 'SANDBOX', secretReference: 'secret/ref',
    correlationId: 'wave7-test', idempotencyKey,
    payload: { mode: 'HACIENDA_SANDBOX_SUBMISSION', confirmation: 'CONSUME_SANDBOX_CONSECUTIVE' },
  });
  assert.equal(calls[0].options.headers['Idempotency-Key'], idempotencyKey);
  assert.match(calls[0].url, /fiscal-onboarding\/v1\/SANDBOX\/test-invoices$/);
  assert.equal(result.submission.haciendaAccepted, false);
});

test('Wave 7 service hard-denies production and derives Billing authority server-side', async () => {
  const repository = { async findByCompanyId() { return { enabled: true, billingCompanyId: readiness().companyId, billingEnvironment: 'PRODUCTION', billingCredentialSecretRef: 'secret/ref' }; } };
  await assert.rejects(
    () => fiscalSettingsService.initiateFiscalTestInvoice({ companyId: '77' }, { idempotencyKey: '90000000-0000-4000-8000-000000000001' }, {}, { billingIntegrationConfigRepository: repository }),
    (error) => error.code === 'FISCAL_TEST_INVOICE_PRODUCTION_FORBIDDEN',
  );
});

function validOrder() {
  return {
    companyId: 77n, paymentCondition: 'CASH', clientStore: null,
    client: { id: 1n, name: 'Cliente', documentType: '02', legalId: '3101234567', emailBilling: 'cliente@example.test' },
    items: [{ productId: 2n, quantity: 1, unitPrice: 100, product: { name: 'Producto', unit: 'UN', cabysCode: '1234567890123', currency: 'CRC', taxRate: 13 } }],
  };
}
const validConfig = { enabled: true, billingTenantId: 'tenant', billingCompanyId: 'company', billingEnvironment: 'SANDBOX', billingCredentialSecretRef: 'secret/ref' };

test('Wave 7 transaction preflight aligns receiver, email, type, CAByS, unit, tax and invoice type before handoff', () => {
  const ready = validateOrderFiscalReadiness(validOrder(), validConfig);
  assert.equal(ready.ok, true);
  assert.equal(ready.documentType, 'INVOICE');
  const invalid = validOrder();
  invalid.client.documentType = '05';
  invalid.client.legalId = 'ABC';
  invalid.client.emailBilling = 'not-an-email';
  invalid.items[0].product.cabysCode = '123';
  invalid.items[0].product.unit = 'BOX';
  invalid.items[0].product.taxRate = 101;
  const codes = validateOrderFiscalReadiness(invalid, validConfig).failures.map(({ code }) => code);
  assert.deepEqual(codes, [
    'UNSUPPORTED_RECEIVER_IDENTIFICATION_TYPE', 'INVALID_RECEIVER_IDENTIFICATION_NUMBER',
    'INVALID_RECEIVER_EMAIL', 'INVALID_CABYS_CODE', 'UNSUPPORTED_FISCAL_UNIT', 'INVALID_TAX_METADATA',
  ]);
});

function browserHarness(api) {
  const publicRoot = path.join(appRoot, 'src', 'public', 'root');
  const browserWindow = {};
  const context = vm.createContext({ window: browserWindow, Map, Set, Date, encodeURIComponent, FormData: class { get() { return null; } } });
  browserWindow.crypto = { randomUUID: () => '90000000-0000-4000-8000-000000000001' };
  browserWindow.window = browserWindow;
  for (const file of ['registry.js', 'ui.js']) vm.runInContext(fs.readFileSync(path.join(publicRoot, file), 'utf8'), context);
  browserWindow.RootShell.register('fiscalSettingsApi', api);
  vm.runInContext(fs.readFileSync(path.join(publicRoot, 'views', 'fiscal-settings-admin.js'), 'utf8'), context);
  const element = () => ({ innerHTML: '', hidden: false, addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } });
  const elements = { status: element(), content: element(), refresh: element(), readiness: element(), testInvoice: element(), issuer: element(), security: element(), issuance: element() };
  const map = {
    '[data-fiscal-settings-status]': elements.status, '[data-fiscal-settings-content]': elements.content,
    '[data-fiscal-refresh-btn]': elements.refresh, '[data-fiscal-readiness-content]': elements.readiness,
    '[data-fiscal-test-content]': elements.testInvoice,
    '[data-fiscal-issuer-content]': elements.issuer, '[data-fiscal-security-content]': elements.security,
    '[data-fiscal-issuance-content]': elements.issuance,
  };
  return { view: browserWindow.RootShell.require('views.fiscalSettingsAdmin'), elements, container: { querySelector: (selector) => map[selector] || null } };
}

test('Wave 7 UI renders canonical dimensions, actionable and unknown blockers without exposing secrets', async () => {
  const data = readiness({
    status: 'NOT_READY', readyToIssue: false,
    blockers: ['ACTIVE_CERTIFICATE_MISSING', 'FUTURE_PROVIDER_BLOCKER'],
    dimensions: { ...readiness().dimensions, certificate: dimension('NOT_READY', ['ACTIVE_CERTIFICATE_MISSING'], { status: 'MISSING' }) },
  });
  const harness = browserHarness({
    async getIssuerAdministration() { return { association: { status: 'ASSOCIATED', environment: 'SANDBOX' }, issuer: {}, profile: {} }; },
    async getFiscalSecurityConfiguration() { return { environment: 'SANDBOX', connection: null, certificate: null }; },
    async getIssuanceAdministration() { return { environment: 'SANDBOX', branches: [], defaultIssuancePoint: null }; },
    async getFiscalSettings() { return { taxpayer: {}, activities: [], configuration: {} }; },
    async getFiscalReadiness() { return data; },
  });
  await harness.view.mount(harness.container, { user: { permissions: ['fiscal.settings.view', 'fiscal.readiness.view'] } }, {});
  const html = harness.elements.readiness.innerHTML;
  assert.match(html, /Configuración fiscal incompleta/);
  assert.match(html, /Identidad del emisor/);
  assert.match(html, /Configurar certificado/);
  assert.match(html, /FUTURE_PROVIDER_BLOCKER/);
  assert.match(html, /significado aún no está mapeado/);
  assert.doesNotMatch(html, /secretReference|apiKey|password|privateKey/i);
});

test('Wave 7 UI discloses SANDBOX sequence consumption and separates Billing from Hacienda status', async () => {
  const harness = browserHarness({
    async getIssuerAdministration() { return { association: { status: 'ASSOCIATED', environment: 'SANDBOX' }, issuer: {}, profile: {} }; },
    async getFiscalSecurityConfiguration() { return { environment: 'SANDBOX', connection: {}, certificate: {} }; },
    async getIssuanceAdministration() { return { environment: 'SANDBOX', branches: [], defaultIssuancePoint: null }; },
    async getFiscalSettings() { return { taxpayer: {}, activities: [], configuration: {} }; },
    async getFiscalReadiness() { return readiness(); },
  });
  await harness.view.mount(harness.container, { user: { permissions: ['fiscal.settings.view', 'fiscal.readiness.view', 'fiscal.credentials.manage'] } }, {});
  assert.match(harness.elements.testInvoice.innerHTML, /consume un consecutivo SANDBOX/i);
  assert.match(harness.elements.testInvoice.innerHTML, /Billing acepte la solicitud no significa que Hacienda/i);
  assert.match(harness.elements.testInvoice.innerHTML, /Probar facturación en SANDBOX/);
  assert.doesNotMatch(harness.elements.testInvoice.innerHTML, /secretReference|apiKey|privateKey/i);
});

test('Wave 7 UI treats Billing outage as unavailable and never fabricates missing issuer or certificate', async () => {
  const harness = browserHarness({
    async getIssuerAdministration() { throw new Error('offline'); },
    async getFiscalSettings() { return { taxpayer: {}, activities: [], configuration: {} }; },
    async getFiscalReadiness() { throw new Error('offline'); },
  });
  await harness.view.mount(harness.container, { user: { permissions: ['fiscal.settings.view', 'fiscal.readiness.view'] } }, {});
  assert.match(harness.elements.readiness.innerHTML, /Billing no disponible/);
  assert.match(harness.elements.readiness.innerHTML, /no se infiere/i);
  assert.doesNotMatch(harness.elements.readiness.innerHTML, /Falta configurar|Sin certificado/);
  assert.match(harness.elements.issuer.innerHTML, /Estado actual desconocido/);
  assert.match(harness.elements.security.innerHTML, /no se infiere que falten credenciales o certificado/);
});

test('Wave 7 source includes stale-state, duplicate-refresh, environment invalidation and responsive accessibility safeguards', () => {
  const view = fs.readFileSync(path.join(appRoot, 'src', 'public', 'root', 'views', 'fiscal-settings-admin.js'), 'utf8');
  const css = fs.readFileSync(path.join(appRoot, 'src', 'public', 'styles.css'), 'utf8');
  assert.match(view, /if \(!readinessElement \|\| readinessPending\) return/);
  assert.match(view, /lastVerifiedReadiness\.environment !== expectedEnvironment/);
  assert.match(view, /canUseHistorical \? 'STALE' : 'UNAVAILABLE'/);
  assert.match(view, /no confirma preparación actual/);
  assert.match(view, /aria-busy=/);
  assert.match(css, /\.fiscal-readiness-action[\s\S]*min-height:\s*44px/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.fiscal-readiness-dimensions/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.fiscal-test-evidence-grid/);
});
