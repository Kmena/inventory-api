'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { recoverFiscalIntentIdentity } = require('../src/services/fiscal-identity-recovery.service');
const { BillingClientError } = require('../src/services/billing-api-client.service');

function intent(overrides = {}) { return { id: 1700n, companyId: 1n, invoiceId: 1890n, status: 'ERROR_FINAL', billingFiscalDocumentId: null, clave: null, consecutive: null, billingStatus: null, failureCode: 'FISCAL_XML_GENERATION_FAILED', failureMessage: 'Bad Request Exception', idempotencyKey: 'inventori:1:invoice:1890', metadata: { billingPayloadHash: 'a'.repeat(64) }, integrationConfig: { enabled: true, billingCompanyId: 'company-1', billingEnvironment: 'SANDBOX', billingCredentialSecretRef: 'secret-ref' }, ...overrides }; }
function identity(overrides = {}) { return { fiscalDocumentId: '3eb5ce42-be1a-4eaa-acb4-39cc7ae29659', companyId: 'company-1', environment: 'SANDBOX', documentType: 'INVOICE', status: 'ACCEPTED', clave: '50608102600020753025100100001010000000006181741622', consecutive: '00100001010000000006', idempotencyKey: 'inventori:1:invoice:1890', operation: 'fiscal-document.create.invoice', reservationStatus: 'COMPLETED', requestHashVerified: true, ...overrides }; }
function db(row) { return { invoiceFiscalIntent: { findUnique: async () => row, findFirst: async () => null, updateMany: async ({ data }) => { Object.assign(row, data); return { count: 1 }; } } }; }

test('INV-966 fixture associates an accepted verified identity without fiscal creation', async () => {
  const row = intent(); let calls = 0;
  const result = await recoverFiscalIntentIdentity(1700n, { billingClient: { lookupFiscalIdentityByIdempotency: async (input) => { calls++; assert.equal(input.requestHash, 'a'.repeat(64)); return identity(); } } }, { db: db(row), now: new Date('2026-10-08T16:00:00Z') });
  assert.equal(result.recovered, true); assert.equal(calls, 1); assert.equal(row.status, 'ACCEPTED'); assert.equal(row.billingFiscalDocumentId, identity().fiscalDocumentId); assert.equal(row.failureCode, null); assert.equal(row.metadata.recovery.originalFailureCode, 'FISCAL_XML_GENERATION_FAILED');
});
test('missing stored hash fails closed before Billing lookup', async () => {
  const row = intent({ metadata: {} }); let called = false;
  await assert.rejects(() => recoverFiscalIntentIdentity(1700n, { billingClient: { lookupFiscalIdentityByIdempotency: async () => { called = true; } } }, { db: db(row) }), { code: 'FISCAL_RECOVERY_HASH_UNAVAILABLE' }); assert.equal(called, false);
});
test('404 never authorizes creation or association', async () => {
  const row = intent(); const result = await recoverFiscalIntentIdentity(1700n, { billingClient: { lookupFiscalIdentityByIdempotency: async () => { throw new BillingClientError('not found', { statusCode: 404, code: 'FISCAL_IDENTITY_NOT_FOUND' }); } } }, { db: db(row) }); assert.equal(result.recovered, false); assert.equal(result.outcome, 'OPERATOR_REVIEW'); assert.equal(row.billingFiscalDocumentId, null);
});
