'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ELIGIBLE_INTENT_STATUSES,
  processFiscalIntentById,
} = require('../src/services/fiscal-billing-worker.service');
const {
  OPERATOR_RECOVERABLE_FAILURE_CODES,
  NON_RECOVERABLE_FAILURE_EXAMPLES,
  RECOVERY_TARGET_STATUS,
  recoverFinalIntentAfterOperatorRepair,
} = require('../src/services/fiscal-intent-operator-recovery.service');
const { getAccessPolicy } = require('../src/security/access-policies');

function bigintEq(a, b) {
  return BigInt(a) === BigInt(b);
}

function makeIntent(overrides = {}) {
  return {
    id: 1453n,
    companyId: 1698n,
    invoiceId: 1623n,
    billingIntegrationConfigId: 77n,
    status: 'ERROR_FINAL',
    idempotencyKey: 'inventori:1698:invoice:1623',
    billingFiscalDocumentId: null,
    clave: null,
    consecutive: null,
    billingStatus: null,
    failureCode: 'FISCAL_SIGNING_CERTIFICATE_INVALID_SECRET',
    failureMessage: 'Bad Request Exception',
    attemptCount: 10,
    lastAttemptAt: null,
    nextAttemptAt: null,
    lastSyncAt: null,
    metadata: { lastFailureCode: 'FISCAL_SIGNING_CERTIFICATE_INVALID_SECRET' },
    invoice: {
      id: 1623n,
      orderId: 963n,
      status: 'PENDING',
      fiscalSnapshot: makeSnapshot(),
    },
    integrationConfig: makeIntegrationConfig(),
    ...overrides,
  };
}

function makeSnapshot() {
  return {
    id: 905n,
    invoiceId: 1623n,
    companyId: 1698n,
    orderId: 963n,
    currency: 'CRC',
    saleCondition: '01',
    paymentMethod: '01',
    creditTermDays: null,
    headerSnapshot: { exchangeRate: '1.00000' },
    receiverSnapshot: {
      sourceType: 'CLIENT_LEGAL_ENTITY',
      sourceId: '4',
      legalName: 'COMERCIAL SANDBOX S.A.',
      identificationType: '02',
      identificationNumber: '3101999999',
      email: 'cliente-sandbox@test.local',
      phone: '2200-0002',
      address: 'San Jose, Costa Rica',
    },
    linesSnapshot: [{
      lineNumber: 1,
      cabysCode: '8512100000000',
      description: 'Servicio SANDBOX E2E',
      fiscalUnit: 'Unid',
      quantity: 1,
      unitPrice: 5000,
      totalDiscount: 0,
      taxCode: '01',
      taxRateCode: '08',
      taxRate: 13,
      taxAmount: 650,
    }],
    totalsSnapshot: { subtotal: 5000, tax: 650, total: 5650 },
  };
}

function makeIntegrationConfig() {
  return {
    id: 77n,
    companyId: 1698n,
    enabled: true,
    billingCompanyId: 'dde91f44-6ceb-4eb7-b322-0139919cc34d',
    billingEnvironment: 'SANDBOX',
    billingCredentialSecretRef: 'env:BILLING_SANDBOX_M2M_API_KEY',
  };
}

class InMemoryDb {
  constructor(intent = makeIntent(), options = {}) {
    this.intent = intent;
    this.invoiceCount = options.invoiceCount ?? 1;
    this.snapshotCount = options.snapshotCount ?? 1;
    this.intentCount = options.intentCount ?? 1;
    this.inventoryMutations = 0;
    this.invoiceCreates = 0;
    this.snapshotCreates = 0;
    this.intentCreates = 0;
    this.orderDispatches = 0;
    this.invoiceFiscalIntent = {
      findUnique: async ({ where }) => (bigintEq(where.id, this.intent.id) ? this._intentWithIncludes() : null),
      count: async ({ where }) => (bigintEq(where.invoiceId, this.intent.invoiceId) ? this.intentCount : 0),
      updateMany: async ({ where, data }) => this._updateIntentMany(where, data),
      update: async ({ where, data }) => this._updateIntent(where, data),
      findFirst: async ({ where }) => {
        if (!where.status.in.includes(this.intent.status)) return null;
        return { id: this.intent.id };
      },
    };
    this.invoice = { create: async () => { this.invoiceCreates += 1; } };
    this.invoiceFiscalSnapshot = { create: async () => { this.snapshotCreates += 1; } };
    this.stockMovement = { create: async () => { this.inventoryMutations += 1; } };
    this.order = { update: async () => { this.orderDispatches += 1; } };
  }

  async $transaction(fn) {
    return fn(this);
  }

  _intentWithIncludes() {
    return this.intent ? this.intent : null;
  }

  _matchesWhere(where) {
    if (where.id != null && !bigintEq(where.id, this.intent.id)) return false;
    if (where.status != null) {
      if (typeof where.status === 'string' && this.intent.status !== where.status) return false;
      if (where.status.in && !where.status.in.includes(this.intent.status)) return false;
    }
    if (where.failureCode != null && this.intent.failureCode !== where.failureCode) return false;
    if (where.idempotencyKey != null && this.intent.idempotencyKey !== where.idempotencyKey) return false;
    return true;
  }

  _applyData(data) {
    const next = { ...this.intent };
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && 'increment' in value) {
        next[key] = Number(next[key] || 0) + Number(value.increment);
      } else {
        next[key] = value;
      }
    }
    this.intent = next;
  }

  async _updateIntentMany(where, data) {
    if (!this.intent || !this._matchesWhere(where)) return { count: 0 };
    this._applyData(data);
    return { count: 1 };
  }

  async _updateIntent(where, data) {
    if (!this.intent || !bigintEq(where.id, this.intent.id)) throw new Error('not found');
    this._applyData(data);
    return this.intent;
  }
}

function makeAuth(companyId = 1698n) {
  return { userId: 42n, companyId, permissions: ['billing.handoff.create'], role: 'admin' };
}

async function assertRejectsWithCode(fn, code) {
  await assert.rejects(fn, (error) => error.code === code);
}

test('operator recovery policy is explicit and fail-closed', () => {
  assert.deepEqual(OPERATOR_RECOVERABLE_FAILURE_CODES, ['FISCAL_SIGNING_CERTIFICATE_INVALID_SECRET']);
  assert.ok(NON_RECOVERABLE_FAILURE_EXAMPLES.includes('FISCAL_RECEIVER_MISSING'));
  assert.ok(!OPERATOR_RECOVERABLE_FAILURE_CODES.includes('FISCAL_RECEIVER_MISSING'));
});

test('ERROR_FINAL + allowlisted certificate failure recovers to scheduler-eligible ERROR_RETRYABLE', async () => {
  const db = new InMemoryDb();
  const audits = [];
  const beforeKey = db.intent.idempotencyKey;
  const result = await recoverFinalIntentAfterOperatorRepair(1453n, {
    reason: 'Billing signing certificate repaired and readiness verified.',
    auth: makeAuth(),
  }, { db, recordAuditEvent: async (event) => audits.push(event), now: new Date('2026-09-27T18:00:00.000Z') });

  assert.equal(result.newStatus, RECOVERY_TARGET_STATUS);
  assert.equal(db.intent.status, 'ERROR_RETRYABLE');
  assert.ok(ELIGIBLE_INTENT_STATUSES.includes(db.intent.status));
  assert.equal(db.intent.idempotencyKey, beforeKey);
  assert.equal(db.intent.billingFiscalDocumentId, null);
  assert.equal(db.invoiceCreates, 0);
  assert.equal(db.snapshotCreates, 0);
  assert.equal(db.intentCreates, 0);
  assert.equal(db.inventoryMutations, 0);
  assert.equal(db.orderDispatches, 0);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].metadata.previousFailureCode, 'FISCAL_SIGNING_CERTIFICATE_INVALID_SECRET');
  assert.equal(audits[0].metadata.idempotencyKey, beforeKey);
  assert.equal(db.intent.metadata.operatorRecoveryHistory[0].previousFailureCode, 'FISCAL_SIGNING_CERTIFICATE_INVALID_SECRET');
});

test('recovery rejects unknown and non-allowlisted terminal failure codes', async () => {
  await assertRejectsWithCode(
    () => recoverFinalIntentAfterOperatorRepair(1453n, { reason: 'Operator repair was verified safely.', auth: makeAuth() }, { db: new InMemoryDb(makeIntent({ failureCode: 'WEIRD_FINAL' })) }),
    'fiscal_intent_failure_not_operator_recoverable',
  );
  await assertRejectsWithCode(
    () => recoverFinalIntentAfterOperatorRepair(1453n, { reason: 'Operator repair was verified safely.', auth: makeAuth() }, { db: new InMemoryDb(makeIntent({ failureCode: 'FISCAL_RECEIVER_MISSING' })) }),
    'fiscal_intent_failure_not_operator_recoverable',
  );
});

test('recovery rejects non-ERROR_FINAL statuses', async () => {
  for (const status of ['PENDING', 'PROCESSING', 'ERROR_RETRYABLE', 'ACCEPTED', 'REJECTED']) {
    await assertRejectsWithCode(
      () => recoverFinalIntentAfterOperatorRepair(1453n, { reason: 'Operator repair was verified safely.', auth: makeAuth() }, { db: new InMemoryDb(makeIntent({ status })) }),
      'fiscal_intent_not_error_final',
    );
  }
});

test('recovery rejects missing reason, wrong company and duplicate fiscal chain', async () => {
  await assertRejectsWithCode(
    () => recoverFinalIntentAfterOperatorRepair(1453n, { reason: 'too short', auth: makeAuth() }, { db: new InMemoryDb() }),
    'operator_recovery_reason_required',
  );
  await assertRejectsWithCode(
    () => recoverFinalIntentAfterOperatorRepair(1453n, { reason: 'Operator repair was verified safely.', auth: makeAuth(9999n) }, { db: new InMemoryDb() }),
    'fiscal_intent_not_found',
  );
  await assertRejectsWithCode(
    () => recoverFinalIntentAfterOperatorRepair(1453n, { reason: 'Operator repair was verified safely.', auth: makeAuth() }, { db: new InMemoryDb(makeIntent(), { intentCount: 2 }) }),
    'fiscal_intent_duplicate_chain_detected',
  );
});

test('concurrent recovery is deterministic: one transition, second rejected', async () => {
  const db = new InMemoryDb();
  const first = await recoverFinalIntentAfterOperatorRepair(1453n, { reason: 'Operator repair was verified safely.', auth: makeAuth() }, { db });
  assert.equal(first.newStatus, 'ERROR_RETRYABLE');
  await assertRejectsWithCode(
    () => recoverFinalIntentAfterOperatorRepair(1453n, { reason: 'Operator repair was verified safely.', auth: makeAuth() }, { db }),
    'fiscal_intent_not_error_final',
  );
});

test('recovery operation itself does not call Billing or Hacienda', async () => {
  const db = new InMemoryDb();
  const forbidden = () => { throw new Error('external call forbidden'); };
  await recoverFinalIntentAfterOperatorRepair(1453n, { reason: 'Operator repair was verified safely.', auth: makeAuth() }, {
    db,
    billingClient: { createFiscalDocument: forbidden, submitFiscalDocument: forbidden },
    haciendaClient: { submit: forbidden, query: forbidden },
  });
  assert.equal(db.intent.status, 'ERROR_RETRYABLE');
});

test('access policy requires operator/admin billing handoff permission', () => {
  const policy = getAccessPolicy('billing.handoff.create');
  assert.equal(policy.mode, 'permission');
  assert.deepEqual(policy.permissions, ['billing.handoff.create']);
});

test('worker after recovery uses same idempotency key and persists existing Billing FiscalDocument', async () => {
  const existingBillingDocumentId = '353a13aa-dd13-4382-8af3-9bb15280fff6';
  const db = new InMemoryDb(makeIntent({
    status: 'ERROR_RETRYABLE',
    failureCode: 'OPERATOR_RECOVERY_AFTER_REPAIR',
    failureMessage: 'Billing signing certificate repaired and readiness verified.',
  }));
  const seen = { createCalls: 0, submitCalls: 0, keys: [] };
  const billingClient = {
    async createFiscalDocument(request) {
      seen.createCalls += 1;
      seen.keys.push(request.idempotencyKey);
      return {
        id: existingBillingDocumentId,
        fiscalStatus: 'READY_TO_SUBMIT',
        clave: '50625092600020753025100100001010000000001101924748',
        consecutive: '00100001010000000001',
      };
    },
    async prepareFiscalDocumentXml() {
      return { status: 'READY_TO_SUBMIT' };
    },
    async submitFiscalDocument() {
      seen.submitCalls += 1;
      return {
        fiscalStatus: 'PROCESSING',
        clave: '50625092600020753025100100001010000000001101924748',
        consecutive: '00100001010000000001',
      };
    },
  };

  const result = await processFiscalIntentById(1453n, { billingClient }, { db, now: new Date('2026-09-27T18:05:00.000Z') });

  assert.equal(result.processed, true);
  assert.equal(seen.createCalls, 1);
  assert.equal(seen.submitCalls, 1);
  assert.deepEqual(seen.keys, ['inventori:1698:invoice:1623']);
  assert.equal(db.intent.billingFiscalDocumentId, existingBillingDocumentId);
  assert.equal(db.intent.idempotencyKey, 'inventori:1698:invoice:1623');
  assert.equal(db.intent.status, 'PROCESSING');
});
