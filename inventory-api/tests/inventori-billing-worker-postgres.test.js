const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  configureFiscalDisposableDatabase,
  verifyFiscalDisposableDatabase,
} = require('./helpers/fiscal-disposable-database-guard');

const disposableDatabaseConfig = configureFiscalDisposableDatabase();
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const prisma = require('../src/lib/prisma');
const { BillingApiClient, BillingClientError } = require('../src/services/billing-api-client.service');
const { createBillingCredentialResolver } = require('../src/services/billing-credential-resolver.service');
const {
  classifyBillingFailure,
  processFiscalIntentById,
  processNextFiscalIntent,
  recoverStaleProcessingIntents,
} = require('../src/services/fiscal-billing-worker.service');

const runOptions = { skip: !disposableDatabaseConfig };
const createdCompanyIds = [];

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function stringifyPersisted(value) {
  return JSON.stringify(value, (_key, nestedValue) => (typeof nestedValue === 'bigint' ? nestedValue.toString() : nestedValue));
}

function buildSnapshotJson(fixture, overrides = {}) {
  const receiverName = overrides.receiverName || 'Snapshot Receiver SA';
  const lineDescription = overrides.lineDescription || 'Snapshot Product';
  return {
    headerSnapshot: {
      currency: 'CRC',
      exchangeRate: '1.00000',
      saleCondition: overrides.saleCondition || '01',
      paymentMethod: overrides.paymentMethod === undefined ? '01' : overrides.paymentMethod,
      creditTermDays: overrides.creditTermDays || null,
      billingTenantId: fixture.config.billingTenantId,
      billingCompanyId: fixture.config.billingCompanyId,
      billingEnvironment: fixture.config.billingEnvironment,
    },
    receiverSnapshot: {
      sourceType: 'CLIENT',
      sourceId: fixture.client.id.toString(),
      legalName: receiverName,
      commercialName: 'Snapshot Receiver',
      identificationType: '02',
      identificationNumber: '3101999999',
      email: 'snapshot@example.test',
      phone: '22222222',
      province: '1',
      canton: '01',
      district: '01',
      address: 'Snapshot address',
      economicActivityCode: '463001',
    },
    linesSnapshot: [{
      lineNumber: 1,
      productId: fixture.product?.id?.toString() || '9001',
      orderItemId: '8001',
      cabysCode: '1234567890123',
      description: lineDescription,
      commercialUnit: 'UN',
      fiscalUnit: 'Unid',
      quantity: 2,
      unitPrice: 1000,
      discountPercent: 10,
      discountAmount: 100,
      totalDiscount: 200,
      discountCode: '07',
      discountNature: 'Descuento Comercial',
      discountOther: null,
      taxCode: '01',
      taxRateCode: '08',
      taxRate: 13,
      taxAmount: 234,
      subtotal: 1800,
      total: 2034,
    }],
    totalsSnapshot: {
      subtotal: 1800,
      tax: 234,
      discount: 200,
      total: 2034,
    },
  };
}

async function createWorkerFixture(label, options = {}) {
  const suffix = uniqueSuffix();
  const company = await prisma.company.create({
    data: { name: `IBW ${label} ${suffix}`, legalId: `IBW-${suffix}`, email: `ibw-${suffix}@example.test` },
  });
  createdCompanyIds.push(company.id);

  const client = await prisma.client.create({
    data: {
      companyId: company.id,
      code: `IBW-C-${suffix}`,
      name: 'Mutable Client Current Name',
      legalId: '3101123456',
      documentType: '02',
      emailBilling: 'mutable-current@example.test',
    },
  });
  const product = await prisma.product.create({
    data: {
      companyId: company.id,
      code: `IBW-P-${suffix}`,
      name: 'Mutable Product Current Name',
      unit: 'UN',
      cabysCode: '1234567890123',
      currency: 'CRC',
      price: 1000,
      quantity: 0,
      controlsInventory: false,
      productNature: 'SERVICE',
      taxRate: 13,
    },
  });
  const config = await prisma.companyBillingIntegrationConfig.create({
    data: {
      companyId: company.id,
      billingTenantId: `tenant-${suffix}`,
      billingCompanyId: `billing-company-${suffix}`,
      billingEnvironment: 'SANDBOX',
      billingCredentialSecretRef: 'env:IBW_SENTINEL_KEY',
      enabled: options.configEnabled !== false,
    },
  });
  const invoice = await prisma.invoice.create({
    data: {
      clientId: client.id,
      number: `IBW-INV-${suffix}`,
      amount: 2034,
      status: options.invoiceStatus || 'PENDING',
    },
  });
  const snapshotParts = buildSnapshotJson({ company, client, product, config }, options.snapshot || {});
  await prisma.invoiceFiscalSnapshot.create({
    data: {
      companyId: company.id,
      orderId: BigInt(Date.now()),
      invoiceId: invoice.id,
      receiverSourceType: 'CLIENT',
      receiverSourceId: client.id,
      currency: options.snapshot?.currency || 'CRC',
      saleCondition: options.snapshot?.saleCondition || '01',
      paymentMethod: options.snapshot?.paymentMethod === undefined ? '01' : options.snapshot.paymentMethod,
      creditTermDays: options.snapshot?.creditTermDays || null,
      mappingVersion: 'worker-test-v1',
      ...snapshotParts,
    },
  });
  const intent = await prisma.invoiceFiscalIntent.create({
    data: {
      companyId: company.id,
      invoiceId: invoice.id,
      billingIntegrationConfigId: config.id,
      status: options.intentStatus || 'PENDING',
      idempotencyKey: `inventori:${company.id.toString()}:invoice:${invoice.id.toString()}`,
      nextAttemptAt: options.nextAttemptAt || null,
    },
  });

  return { company, client, product, config, invoice, intent };
}

async function cleanupCreatedCompanies() {
  for (const companyId of [...createdCompanyIds].reverse()) {
    await prisma.invoiceFiscalIntent.deleteMany({ where: { companyId } });
    await prisma.invoiceFiscalSnapshot.deleteMany({ where: { companyId } });
    await prisma.invoiceItem.deleteMany({ where: { companyId } });
    await prisma.invoice.deleteMany({ where: { client: { companyId } } });
    await prisma.product.deleteMany({ where: { companyId } });
    await prisma.companyBillingIntegrationConfig.deleteMany({ where: { companyId } });
    await prisma.client.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  }
  createdCompanyIds.length = 0;
}

class FakeBillingClient {
  constructor(options = {}) {
    this.options = options;
    this.createCalls = [];
    this.submitCalls = [];
    this.documentsByKey = new Map();
    this.failedOnce = false;
  }

  async createFiscalDocument(request) {
    this.createCalls.push(request);
    const existing = this.documentsByKey.get(request.idempotencyKey);
    const payloadHash = JSON.stringify(request.payload);
    if (existing) {
      if (existing.payloadHash !== payloadHash) {
        throw new BillingClientError('Idempotency payload conflict', {
          code: 'IDEMPOTENCY_CONFLICT',
          statusCode: 409,
          retryable: false,
          correlationId: request.correlationId,
        });
      }
      return existing.response;
    }

    if (this.options.throwOnCreate) throw this.options.throwOnCreate;

    const response = {
      id: `fake-doc-${this.documentsByKey.size + 1}`,
      clave: `clave-${this.documentsByKey.size + 1}`,
      consecutive: `consecutive-${this.documentsByKey.size + 1}`,
      status: 'CREATED',
    };
    this.documentsByKey.set(request.idempotencyKey, { payloadHash, response });

    if (this.options.timeoutAfterCreateOnce && !this.failedOnce) {
      this.failedOnce = true;
      throw new BillingClientError('Billing request timed out', {
        code: 'BILLING_TIMEOUT',
        retryable: true,
        correlationId: request.correlationId,
      });
    }
    return response;
  }

  async submitFiscalDocument(request) {
    this.submitCalls.push(request);
    if (this.options.throwOnSubmit) throw this.options.throwOnSubmit;
    return { id: request.billingFiscalDocumentId, status: 'PROCESSING' };
  }

  get documentCount() {
    return this.documentsByKey.size;
  }
}

before(async () => {
  if (!runOptions.skip) {
    await prisma.$connect();
    await verifyFiscalDisposableDatabase(prisma, disposableDatabaseConfig);
  }
});

after(async () => {
  if (!runOptions.skip) {
    await cleanupCreatedCompanies();
    await prisma.$disconnect();
  }
});

describe('Inventori Billing worker failure classification', () => {
  test('classifies fake Billing outcomes without exposing secrets', () => {
    const cases = [
      ['BILLING_TIMEOUT', null, true, 'AMBIGUOUS', 'ERROR_RETRYABLE'],
      ['BILLING_UNAVAILABLE', null, true, 'AMBIGUOUS', 'ERROR_RETRYABLE'],
      ['HTTP_400', 400, false, 'FINAL', 'ERROR_FINAL'],
      ['HTTP_401', 401, false, 'FINAL', 'ERROR_FINAL'],
      ['HTTP_403', 403, false, 'FINAL', 'ERROR_FINAL'],
      ['HTTP_409', 409, false, 'FINAL', 'ERROR_FINAL'],
      ['HTTP_422', 422, false, 'FINAL', 'ERROR_FINAL'],
      ['HTTP_429', 429, true, 'RETRYABLE', 'ERROR_RETRYABLE'],
      ['HTTP_500', 500, true, 'RETRYABLE', 'ERROR_RETRYABLE'],
      ['HTTP_503', 503, true, 'RETRYABLE', 'ERROR_RETRYABLE'],
    ];

    for (const [code, statusCode, retryable, expectedKind, expectedStatus] of cases) {
      const result = classifyBillingFailure(new BillingClientError('sanitized failure', { code, statusCode, retryable }));
      assert.equal(result.kind, expectedKind);
      assert.equal(result.status, expectedStatus);
      assert.doesNotMatch(JSON.stringify(result), /sentinel-secret/i);
    }
  });
});

describe('Inventori Billing worker PostgreSQL integration', runOptions, () => {
  test('builds Billing request from immutable snapshot and keeps secrets out of persisted state/logs', async () => {
    const sentinelSecret = 'sentinel-secret-worker-value';
    process.env.IBW_SENTINEL_KEY = sentinelSecret;
    const fixture = await createWorkerFixture('snapshot-secret', { invoiceStatus: 'PAID' });
    await prisma.client.update({ where: { id: fixture.client.id }, data: { name: 'Changed Mutable Client' } });
    await prisma.product.update({ where: { id: fixture.product.id }, data: { name: 'Changed Mutable Product', cabysCode: '0000000000000' } });

    const logLines = [];
    const originalInfo = console.info;
    console.info = (line) => logLines.push(String(line));
    const fetchCalls = [];
    const fetchImpl = async (url, options) => {
      fetchCalls.push({ url, options, body: JSON.parse(options.body || '{}') });
      if (url.endsWith('/submit')) return { ok: true, status: 202, text: async () => JSON.stringify({ id: 'doc-client-1', status: 'PROCESSING' }) };
      return { ok: true, status: 201, text: async () => JSON.stringify({ id: 'doc-client-1', clave: 'clave-1', consecutive: 'cons-1', status: 'CREATED' }) };
    };

    try {
      const billingClient = new BillingApiClient({
        baseUrl: 'https://fake-billing.local',
        credentialResolver: createBillingCredentialResolver(process.env),
        fetchImpl,
        timeoutMs: 1000,
      });
      const result = await processFiscalIntentById(fixture.intent.id, { billingClient });
      assert.equal(result.status, 'PROCESSING');
    } finally {
      console.info = originalInfo;
      delete process.env.IBW_SENTINEL_KEY;
    }

    assert.equal(fetchCalls.length, 3);
    assert.equal(fetchCalls[0].options.headers['X-API-Key'], sentinelSecret);
    assert.equal(fetchCalls[0].options.headers.Authorization, undefined);
    assert.equal(fetchCalls[0].options.headers['Idempotency-Key'], fixture.intent.idempotencyKey);
    assert.equal(fetchCalls[0].body.receiver.name, 'Snapshot Receiver SA');
    assert.equal(fetchCalls[0].body.lines[0].description, 'Snapshot Product');
    assert.equal(fetchCalls[0].body.lines[0].cabysCode, '1234567890123');
    assert.match(fetchCalls[1].url, /\/prepare-xml$/);
    assert.match(fetchCalls[2].url, /\/submit$/);

    const persistedIntent = await prisma.invoiceFiscalIntent.findUnique({ where: { id: fixture.intent.id }, include: { invoice: true } });
    const persistedSnapshot = await prisma.invoiceFiscalSnapshot.findUnique({ where: { invoiceId: fixture.invoice.id } });
    assert.equal(persistedIntent.invoice.status, 'PAID');
    assert.equal(persistedIntent.status, 'PROCESSING');
    assert.doesNotMatch(stringifyPersisted(persistedIntent), new RegExp(sentinelSecret));
    assert.doesNotMatch(stringifyPersisted(persistedSnapshot), new RegExp(sentinelSecret));
    assert.doesNotMatch(logLines.join('\n'), new RegExp(sentinelSecret));
  });

  test('two concurrent workers can claim one intent only once', async () => {
    const fixture = await createWorkerFixture('concurrent');
    const fakeBilling = new FakeBillingClient();
    const results = await Promise.all([
      processFiscalIntentById(fixture.intent.id, { billingClient: fakeBilling }),
      processFiscalIntentById(fixture.intent.id, { billingClient: fakeBilling }),
    ]);
    assert.equal(fakeBilling.createCalls.length, 1);
    assert.equal(results.filter((result) => result.processed).length, 1);
    assert.equal(results.filter((result) => result.reason === 'NOT_CLAIMED').length, 1);
  });

  test('timeout after Billing receives request retries same idempotency key without duplicate fiscal document', async () => {
    const fixture = await createWorkerFixture('idempotency-replay');
    const fakeBilling = new FakeBillingClient({ timeoutAfterCreateOnce: true });
    const firstNow = new Date('2026-09-24T12:00:00.000Z');
    const firstResult = await processFiscalIntentById(fixture.intent.id, { billingClient: fakeBilling }, { now: firstNow });
    assert.equal(firstResult.status, 'ERROR_RETRYABLE');
    assert.equal(fakeBilling.documentCount, 1);

    const retryResult = await processFiscalIntentById(fixture.intent.id, { billingClient: fakeBilling }, { now: addMinutes(firstNow, 6) });
    const persistedIntent = await prisma.invoiceFiscalIntent.findUnique({ where: { id: fixture.intent.id } });
    assert.equal(retryResult.status, 'PROCESSING');
    assert.equal(fakeBilling.documentCount, 1);
    assert.equal(fakeBilling.createCalls.length, 2);
    assert.equal(fakeBilling.createCalls[0].idempotencyKey, fixture.intent.idempotencyKey);
    assert.equal(fakeBilling.createCalls[1].idempotencyKey, fixture.intent.idempotencyKey);
    assert.equal(persistedIntent.billingFiscalDocumentId, 'fake-doc-1');
    assert.equal(persistedIntent.clave, 'clave-1');
    assert.equal(persistedIntent.consecutive, 'consecutive-1');
  });

  test('crash before Billing request leaves no Billing document and stale claim is recoverable', async () => {
    const fixture = await createWorkerFixture('crash-before');
    const fakeBilling = new FakeBillingClient();
    const claimTime = new Date('2026-09-24T12:00:00.000Z');
    await assert.rejects(
      processFiscalIntentById(fixture.intent.id, { billingClient: fakeBilling }, { now: claimTime, crashBeforeBillingRequest: true }),
      /Simulated crash before Billing request/,
    );
    assert.equal(fakeBilling.createCalls.length, 0);
    await recoverStaleProcessingIntents({ now: addMinutes(claimTime, 20), staleBefore: addMinutes(claimTime, 1) });
    const intent = await prisma.invoiceFiscalIntent.findUnique({ where: { id: fixture.intent.id } });
    assert.equal(intent.status, 'ERROR_RETRYABLE');
    assert.equal(intent.failureCode, 'PROCESSING_CLAIM_EXPIRED');
  });

  test('crash after Billing receives request but before result persistence replays same Billing document', async () => {
    const fixture = await createWorkerFixture('crash-after-billing');
    const fakeBilling = new FakeBillingClient();
    const claimTime = new Date('2026-09-24T12:00:00.000Z');
    await assert.rejects(
      processFiscalIntentById(fixture.intent.id, { billingClient: fakeBilling }, { now: claimTime, crashAfterBillingBeforePersist: true }),
      /Simulated crash after Billing before persistence/,
    );
    assert.equal(fakeBilling.documentCount, 1);
    await recoverStaleProcessingIntents({ now: addMinutes(claimTime, 20), staleBefore: addMinutes(claimTime, 1) });
    const retryResult = await processFiscalIntentById(fixture.intent.id, { billingClient: fakeBilling }, { now: addMinutes(claimTime, 21) });
    const intent = await prisma.invoiceFiscalIntent.findUnique({ where: { id: fixture.intent.id } });
    assert.equal(retryResult.status, 'PROCESSING');
    assert.equal(fakeBilling.documentCount, 1);
    assert.equal(intent.billingFiscalDocumentId, 'fake-doc-1');
    assert.equal(intent.clave, 'clave-1');
    assert.equal(intent.consecutive, 'consecutive-1');
  });

  test('crash after result persistence does not submit non-eligible processing intent again', async () => {
    const fixture = await createWorkerFixture('after-persist');
    const fakeBilling = new FakeBillingClient();
    await processFiscalIntentById(fixture.intent.id, { billingClient: fakeBilling });
    assert.equal(fakeBilling.createCalls.length, 1);
    const replayResult = await processFiscalIntentById(fixture.intent.id, { billingClient: fakeBilling });
    assert.equal(replayResult.processed, false);
    assert.equal(replayResult.reason, 'NOT_CLAIMED');
    assert.equal(fakeBilling.createCalls.length, 1);
  });

  test('application restart with ERROR_RETRYABLE rediscovers same intent and same idempotency key', async () => {
    const fixture = await createWorkerFixture('restart-retry', { intentStatus: 'ERROR_RETRYABLE' });
    const fakeBilling = new FakeBillingClient();
    await processNextFiscalIntent({ billingClient: fakeBilling }, { companyId: fixture.company.id });
    assert.equal(fakeBilling.createCalls.length, 1);
    assert.equal(fakeBilling.createCalls[0].idempotencyKey, fixture.intent.idempotencyKey);
    const intent = await prisma.invoiceFiscalIntent.findUnique({ where: { id: fixture.intent.id } });
    assert.equal(intent.billingFiscalDocumentId, 'fake-doc-1');
  });

  test('same idempotency key with different payload records final mismatch before outbound call', async () => {
    const fixture = await createWorkerFixture('payload-mismatch');
    await prisma.invoiceFiscalIntent.update({ where: { id: fixture.intent.id }, data: { metadata: { billingPayloadHash: 'previous-different-hash' } } });
    const fakeBilling = new FakeBillingClient();
    const result = await processFiscalIntentById(fixture.intent.id, { billingClient: fakeBilling });
    const intent = await prisma.invoiceFiscalIntent.findUnique({ where: { id: fixture.intent.id } });
    assert.equal(result.status, 'ERROR_FINAL');
    assert.equal(intent.failureCode, 'IDEMPOTENCY_PAYLOAD_MISMATCH');
    assert.equal(fakeBilling.createCalls.length, 0);
  });
});
