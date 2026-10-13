'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { BillingApiClient, BillingClientError } = require('../src/services/billing-api-client.service');
const { createBillingCredentialResolver } = require('../src/services/billing-credential-resolver.service');
const { buildBillingFiscalDocumentPayload, hashBillingPayload } = require('../src/services/fiscal-billing-worker.service');
const { FISCAL_PAYLOAD_EQUIVALENCE_VERSION, recoverFiscalIntentIdentity } = require('../src/services/fiscal-identity-recovery.service');

function snapshot() {
  return {
    currency: 'CRC', saleCondition: '01', paymentMethod: '01',
    receiverSnapshot: { sourceType: 'CLIENT', sourceId: 1n, legalName: 'Fixture receiver', commercialName: null, identificationType: '01', identificationNumber: '101010101', email: null, phone: null, province: null, canton: null, district: null, address: null, selectedEconomicActivityCode: null },
    headerSnapshot: { exchangeRate: '1.00000' },
    linesSnapshot: [{ lineNumber: 1, cabysCode: '1111111111111', description: 'Fixture line', fiscalUnit: 'Sp', quantity: '1', unitPrice: '8000', taxCode: '01', taxRateCode: '08', taxRate: '13', taxAmount: '920' }],
  };
}

function intent(overrides = {}) {
  const fiscalSnapshot = snapshot();
  return {
    id: 1700n, companyId: 1n, invoiceId: 1890n, billingIntegrationConfigId: 10n, status: 'ERROR_FINAL', billingFiscalDocumentId: null, clave: null, consecutive: null, billingStatus: null, failureCode: 'BILLING_TIMEOUT', failureMessage: 'lost response', idempotencyKey: 'inventori:1:invoice:1890',
    metadata: { billingPayloadHash: hashBillingPayload(buildBillingFiscalDocumentPayload(fiscalSnapshot)), originalAuditId: 'audit-1' },
    integrationConfig: { enabled: true, billingCompanyId: 'company-1', billingEnvironment: 'SANDBOX', billingCredentialSecretRef: 'secret' },
    invoice: { fiscalSnapshot }, ...overrides,
  };
}

function evidenceIdentity(overrides = {}) {
  return {
    fiscalDocumentId: '3eb5ce42-be1a-4eaa-acb4-39cc7ae29659', companyId: 'company-1', environment: 'SANDBOX', documentType: 'INVOICE', status: 'ACCEPTED', clave: '50608102600020753025100100001010000000006181741622', consecutive: '00100001010000000006', idempotencyKey: 'inventori:1:invoice:1890', operation: 'fiscal-document.create.invoice', reservationStatus: 'COMPLETED', equivalenceContractVersion: FISCAL_PAYLOAD_EQUIVALENCE_VERSION, fiscalPayloadEquivalent: true, ...overrides,
  };
}

function db(row, hooks = {}) {
  return { invoiceFiscalIntent: {
    findUnique: async () => row,
    findFirst: async () => hooks.findFirst ? hooks.findFirst() : null,
    updateMany: async ({ data }) => {
      if (hooks.updateMany) return hooks.updateMany({ data });
      if (row.status !== 'ERROR_FINAL' || row.billingFiscalDocumentId !== null) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    },
  } };
}

function v1NotFound() {
  return new BillingClientError('not found', { statusCode: 404, code: 'FISCAL_IDENTITY_NOT_FOUND' });
}

test('INV-966 historical fixture recovers only through verified v2 fiscal evidence', async () => {
  const row = intent();
  let v2Input;
  const result = await recoverFiscalIntentIdentity(1700n, { billingClient: {
    lookupFiscalIdentityByIdempotency: async () => { throw v1NotFound(); },
    lookupFiscalIdentityByEvidence: async (input) => { v2Input = input; return evidenceIdentity(); },
    createFiscalDocument: () => { throw new Error('fiscal creation must never run'); },
  } }, { db: db(row), now: new Date('2026-10-09T12:00:00Z') });
  assert.equal(result.recovered, true);
  assert.equal(row.status, 'ACCEPTED');
  assert.equal(row.billingFiscalDocumentId, evidenceIdentity().fiscalDocumentId);
  assert.equal(row.metadata.originalAuditId, 'audit-1');
  assert.equal(row.metadata.recovery.contractVersion, FISCAL_PAYLOAD_EQUIVALENCE_VERSION);
  assert.equal(v2Input.idempotencyKey, row.idempotencyKey);
  assert.equal(v2Input.operation, 'fiscal-document.create.invoice');
  assert.equal(v2Input.equivalenceContractVersion, FISCAL_PAYLOAD_EQUIVALENCE_VERSION);
  assert.deepEqual(v2Input.fiscalPayload, buildBillingFiscalDocumentPayload(row.invoice.fiscalSnapshot));
});

test('v1 success remains the primary recovery path', async () => {
  const row = intent();
  let v2Called = false;
  const v1Identity = { ...evidenceIdentity(), requestHashVerified: true };
  delete v1Identity.equivalenceContractVersion;
  delete v1Identity.fiscalPayloadEquivalent;
  const result = await recoverFiscalIntentIdentity(1700n, { billingClient: {
    lookupFiscalIdentityByIdempotency: async () => v1Identity,
    lookupFiscalIdentityByEvidence: async () => { v2Called = true; },
  } }, { db: db(row) });
  assert.equal(result.recovered, true);
  assert.equal(v2Called, false);
  assert.equal(row.metadata.recovery.contractVersion, '1.0.0');
});

test('missing immutable evidence fails closed without a v2 request', async () => {
  const row = intent({ invoice: { fiscalSnapshot: null } });
  let v2Called = false;
  const result = await recoverFiscalIntentIdentity(1700n, { billingClient: {
    lookupFiscalIdentityByIdempotency: async () => { throw v1NotFound(); },
    lookupFiscalIdentityByEvidence: async () => { v2Called = true; },
  } }, { db: db(row) });
  assert.equal(result.recovered, false);
  assert.equal(result.code, 'FISCAL_RECOVERY_IDENTITY_NOT_FOUND');
  assert.equal(v2Called, false);
  assert.equal(row.billingFiscalDocumentId, null);
});

test('v2 binding and integrity errors preserve ERROR_FINAL', async () => {
  for (const response of [evidenceIdentity({ companyId: 'other-company' }), evidenceIdentity({ environment: 'PRODUCTION' })]) {
    const row = intent();
    const result = await recoverFiscalIntentIdentity(1700n, { billingClient: {
      lookupFiscalIdentityByIdempotency: async () => { throw v1NotFound(); },
      lookupFiscalIdentityByEvidence: async () => response,
    } }, { db: db(row) });
    assert.equal(result.recovered, false);
    assert.equal(row.status, 'ERROR_FINAL');
    assert.equal(row.billingFiscalDocumentId, null);
  }
});

test('v2 authorization, conflict, timeout, and CAS conflicts fail closed', async () => {
  for (const error of [
    new BillingClientError('unauthorized', { statusCode: 401, code: 'BILLING_UNAUTHORIZED' }),
    new BillingClientError('forbidden', { statusCode: 403, code: 'BILLING_FORBIDDEN' }),
    new BillingClientError('ambiguous', { statusCode: 409, code: 'FISCAL_IDENTITY_AMBIGUOUS' }),
    new BillingClientError('timeout', { statusCode: 408, code: 'BILLING_TIMEOUT', retryable: true }),
  ]) {
    const row = intent();
    const result = await recoverFiscalIntentIdentity(1700n, { billingClient: {
      lookupFiscalIdentityByIdempotency: async () => { throw v1NotFound(); },
      lookupFiscalIdentityByEvidence: async () => { throw error; },
    } }, { db: db(row) });
    assert.equal(result.recovered, false);
    assert.equal(row.status, 'ERROR_FINAL');
  }
  const row = intent();
  const result = await recoverFiscalIntentIdentity(1700n, { billingClient: {
    lookupFiscalIdentityByIdempotency: async () => { throw v1NotFound(); },
    lookupFiscalIdentityByEvidence: async () => evidenceIdentity(),
  } }, { db: db(row, { updateMany: async () => ({ count: 0 }) }) });
  assert.equal(result.recovered, false);
  assert.equal(result.reason, 'CONCURRENT_UPDATE');
  assert.equal(row.billingFiscalDocumentId, null);
});

test('Billing client posts fiscal evidence to the v2 contract', async () => {
  const calls = [];
  const api = new BillingApiClient({
    baseUrl: 'https://billing.test/',
    credentialResolver: createBillingCredentialResolver({ BILLING_KEY: 'server-only-key' }),
    timeoutMs: 20,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, text: async () => JSON.stringify(evidenceIdentity()) };
    },
  });
  const fiscalPayload = buildBillingFiscalDocumentPayload(snapshot());
  await api.lookupFiscalIdentityByEvidence({
    billingCompanyId: 'company 1', environment: 'SANDBOX', secretReference: 'env:BILLING_KEY',
    idempotencyKey: 'inventori:1:invoice:1890', operation: 'fiscal-document.create.invoice',
    equivalenceContractVersion: FISCAL_PAYLOAD_EQUIVALENCE_VERSION, fiscalPayload, correlationId: 'corr',
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://billing.test/api/v1/companies/company%201/fiscal-documents/SANDBOX/identity-by-fiscal-evidence');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['X-API-Key'], 'server-only-key');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    idempotencyKey: 'inventori:1:invoice:1890', operation: 'fiscal-document.create.invoice',
    equivalenceContractVersion: FISCAL_PAYLOAD_EQUIVALENCE_VERSION, fiscalPayload,
  });
});

test('repeated recovery is idempotent after the first association', async () => {
  const row = intent();
  let v1Calls = 0;
  const v1Identity = { ...evidenceIdentity(), requestHashVerified: true };
  delete v1Identity.equivalenceContractVersion;
  delete v1Identity.fiscalPayloadEquivalent;
  const dependencies = { billingClient: {
    lookupFiscalIdentityByIdempotency: async () => { v1Calls += 1; return v1Identity; },
    lookupFiscalIdentityByEvidence: async () => { throw new Error('v2 must not run'); },
  } };
  const first = await recoverFiscalIntentIdentity(1700n, dependencies, { db: db(row) });
  const second = await recoverFiscalIntentIdentity(1700n, dependencies, { db: db(row) });
  assert.equal(first.recovered, true);
  assert.deepEqual(second, { recovered: false, reason: 'NOT_ELIGIBLE' });
  assert.equal(v1Calls, 1);
});
