'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BillingClientError } = require('../src/services/billing-api-client.service');
const { requestAcceptedPackageResend } = require('../src/services/fiscal-package-resend.service');
const acceptedIntent = (overrides = {}) => ({ id: 7n, companyId: 9n, status: 'ACCEPTED', billingFiscalDocumentId: 'doc-7', integrationConfig: { billingCompanyId: 'company-9', billingEnvironment: 'sandbox', billingCredentialSecretRef: 'env:AFPR_TEST_KEY' }, ...overrides });
const db = (invoice, intent) => ({ invoice: { findFirst: async () => invoice }, invoiceFiscalIntent: { findUnique: async () => intent } });
test('AFPR service resolves immutable Billing identifiers internally and preserves queued response', async () => {
  let call; const result = await requestAcceptedPackageResend(41n, 9n, { db: db({ id: 41n }, acceptedIntent()), correlationId: 'corr', billingClient: { requestAcceptedPackageResend: async (input) => { call = input; return { status: 'QUEUED', requestId: 'rq-7' }; } } });
  assert.deepEqual(result, { status: 'QUEUED', requestId: 'rq-7' });
  assert.deepEqual(call, { billingCompanyId: 'company-9', environment: 'SANDBOX', billingFiscalDocumentId: 'doc-7', secretReference: 'env:AFPR_TEST_KEY', correlationId: 'corr' });
});
for (const [name, invoice, intent, code] of [
  ['cross-company invoice', null, acceptedIntent(), 'not_found'],
  ['missing fiscal intent', { id: 41n }, null, 'FISCAL_INTENT_NOT_FOUND'],
  ['missing Billing document id', { id: 41n }, acceptedIntent({ billingFiscalDocumentId: null }), 'FISCAL_DOCUMENT_NOT_READY'],
  ['non-ACCEPTED document', { id: 41n }, acceptedIntent({ status: 'SUBMITTED' }), 'FISCAL_DOCUMENT_NOT_ACCEPTED'],
]) test('AFPR service rejects ' + name + ' before Billing', async () => {
  let called = false; await assert.rejects(() => requestAcceptedPackageResend(41n, 9n, { db: db(invoice, intent), billingClient: { requestAcceptedPackageResend: async () => { called = true; } } }), (error) => error.code === code); assert.equal(called, false);
});
test('AFPR service maps Billing conflict and timeout safely', async () => {
  for (const [error, status, code] of [[new BillingClientError('x', { statusCode: 409 }), 409, 'FISCAL_RESEND_CONFLICT'], [new BillingClientError('x', { code: 'BILLING_TIMEOUT' }), 504, 'BILLING_TIMEOUT'], [new BillingClientError('x', { code: 'BILLING_UNAVAILABLE' }), 503, 'BILLING_UNAVAILABLE']]) await assert.rejects(() => requestAcceptedPackageResend(41n, 9n, { db: db({ id: 41n }, acceptedIntent()), billingClient: { requestAcceptedPackageResend: async () => { throw error; } } }), (actual) => actual.statusCode === status && actual.code === code);
});
