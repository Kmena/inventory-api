'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { BillingClientError } = require('../src/services/billing-api-client.service');
const {
  AMBIGUOUS_CREATE_FAILURE_CODES,
  findEligibleAutomaticRecoveryIds,
  recoverAmbiguousFiscalIntent,
  validateAutomaticRecoveryOptions,
} = require('../src/services/fiscal-identity-recovery-worker.service');

const NOW = new Date('2026-10-12T18:00:00.000Z');
const START_AT = new Date('2026-10-12T00:00:00.000Z');

function row(overrides = {}) {
  return {
    id: 46n,
    status: 'ERROR_RETRYABLE',
    failureCode: 'BILLING_TIMEOUT',
    billingFiscalDocumentId: null,
    idempotencyKey: 'inventori:1:invoice:46',
    metadata: { billingPayloadHash: 'a'.repeat(64) },
    integrationConfig: {
      enabled: true,
      billingCompanyId: 'billing-company-1',
      billingEnvironment: 'SANDBOX',
      billingCredentialSecretRef: 'opaque-reference',
    },
    invoice: { fiscalSnapshot: null },
    ...overrides,
  };
}

function db(record) {
  return {
    invoiceFiscalIntent: {
      findMany: async () => [{ id: record.id }],
      findUnique: async ({ select }) => select
        ? { metadata: record.metadata, failureCode: record.failureCode }
        : record,
      findFirst: async () => null,
      updateMany: async ({ where, data }) => {
        if (!['ERROR_RETRYABLE', 'ERROR_FINAL'].includes(record.status) || record.billingFiscalDocumentId) return { count: 0 };
        if (where.failureCode?.in && !where.failureCode.in.includes(record.failureCode)) return { count: 0 };
        Object.assign(record, data);
        return { count: 1 };
      },
    },
  };
}

function options(database, overrides = {}) {
  return { db: database, now: NOW, startAt: START_AT, maxAgeMs: 72 * 60 * 60 * 1000, batchSize: 5, backoffMs: 60_000, ...overrides };
}

test('FO-TASK-046 fails closed without an activation watermark', () => {
  assert.throws(() => validateAutomaticRecoveryOptions({ now: NOW }), /activation watermark/);
});

test('FO-TASK-046 discovery is bounded by status, ambiguity codes, time window and batch', async () => {
  let query;
  const database = { invoiceFiscalIntent: { findMany: async (input) => { query = input; return [{ id: 1n }, { id: 2n }]; } } };
  const ids = await findEligibleAutomaticRecoveryIds(options(database, { companyIds: [7n, 8n] }));
  assert.deepEqual(ids, [1n, 2n]);
  assert.equal(query.where.status, 'ERROR_RETRYABLE');
  assert.deepEqual(query.where.failureCode.in, AMBIGUOUS_CREATE_FAILURE_CODES);
  assert.deepEqual(query.where.companyId.in, [7n, 8n]);
  assert.equal(query.where.createdAt.gte.toISOString(), START_AT.toISOString());
  assert.equal(query.take, 5);
});

test('FO-TASK-046 associates only a verified completed Billing identity', async () => {
  const record = row();
  const database = db(record);
  const result = await recoverAmbiguousFiscalIntent(record.id, {
    billingClient: {
      lookupFiscalIdentityByIdempotency: async () => ({
        fiscalDocumentId: 'billing-document-46',
        companyId: 'billing-company-1',
        environment: 'SANDBOX',
        documentType: 'INVOICE',
        status: 'ACCEPTED',
        clave: '50612102600020753025100100001010000000046181741622',
        consecutive: '00100001010000000046',
        idempotencyKey: record.idempotencyKey,
        operation: 'fiscal-document.create.invoice',
        reservationStatus: 'COMPLETED',
        requestHashVerified: true,
      }),
    },
  }, options(database));
  assert.equal(result.recovered, true);
  assert.equal(record.status, 'ACCEPTED');
  assert.equal(record.billingFiscalDocumentId, 'billing-document-46');
});

test('FO-TASK-046 applies bounded backoff when verified lookup is unavailable', async () => {
  const record = row();
  const database = db(record);
  const result = await recoverAmbiguousFiscalIntent(record.id, {
    billingClient: {
      lookupFiscalIdentityByIdempotency: async () => {
        throw new BillingClientError('unavailable', { statusCode: 503, code: 'BILLING_UNAVAILABLE', retryable: true });
      },
    },
  }, options(database));
  assert.equal(result.retryable, true);
  assert.equal(record.status, 'ERROR_RETRYABLE');
  assert.equal(record.nextAttemptAt.toISOString(), '2026-10-12T18:01:00.000Z');
  assert.equal(record.metadata.automaticIdentityRecovery.outcome, 'BACKOFF');
});

test('FO-TASK-046 fails to operator review on unverified identity without replaying CREATE', async () => {
  const record = row();
  const database = db(record);
  let createCalls = 0;
  const result = await recoverAmbiguousFiscalIntent(record.id, {
    billingClient: {
      lookupFiscalIdentityByIdempotency: async () => ({ requestHashVerified: false }),
      createFiscalDocument: async () => { createCalls++; },
    },
  }, options(database));
  assert.equal(result.outcome, 'OPERATOR_REVIEW');
  assert.equal(record.status, 'ERROR_FINAL');
  assert.equal(createCalls, 0);
});
