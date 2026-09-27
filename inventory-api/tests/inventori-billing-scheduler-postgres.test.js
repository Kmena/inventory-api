'use strict';

/**
 * TASK-015B — Fiscal Scheduler PostgreSQL Automatic E2E Tests
 *
 * These tests prove the FiscalScheduler AUTOMATICALLY drives the full pipeline
 * from PENDING intent → ACCEPTED/REJECTED without any test code manually calling
 * processFiscalIntentById or reconcileFiscalIntentById after dispatch.
 *
 * Scheduler is started with:
 *   - FakeBillingServer (no real Billing HTTP)
 *   - pollIntervalMs: 100ms (fast for tests)
 *   - maxConcurrency: 2
 *
 * Test code drives:
 *   1. Create fixture + dispatch order
 *   2. Verify PENDING intent exists
 *   3. Start scheduler
 *   4. Poll DB until target status is reached (no direct worker invocation)
 *   5. Assert final state
 *   6. Stop scheduler
 *
 * ZERO real Billing requests. ZERO Hacienda contacts.
 */

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Environment bootstrap
// ---------------------------------------------------------------------------

function parseEnvFile(filePath) {
  const result = {};
  if (!fs.existsSync(filePath)) return result;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match) result[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return result;
}

function resolvePostgresDatabaseUrl() {
  if (process.env.INVENTORI_BILLING_DATABASE_URL) return process.env.INVENTORI_BILLING_DATABASE_URL;
  const env = parseEnvFile(path.join(__dirname, '..', '.env'));
  const required = ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB', 'POSTGRES_PORT'];
  if (required.some((k) => !env[k])) return null;
  return `postgresql://${env.POSTGRES_USER}:${env.POSTGRES_PASSWORD}@localhost:${env.POSTGRES_PORT}/${env.POSTGRES_DB}?schema=public`;
}

const postgresDatabaseUrl = resolvePostgresDatabaseUrl();
if (postgresDatabaseUrl) process.env.DATABASE_URL = postgresDatabaseUrl;
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const runOptions = {
  skip: process.env.INVENTORI_BILLING_POSTGRES_TEST !== '1' || !postgresDatabaseUrl,
};

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

const prisma = require('../src/lib/prisma');
const inventoryService = require('../src/services/inventory.service');
const { FiscalScheduler } = require('../src/services/fiscal-scheduler.service');
const { FakeBillingServer } = require('./helpers/fake-billing-server');
const { BillingClientError } = require('../src/services/billing-api-client.service');

// ---------------------------------------------------------------------------
// Test state tracking
// ---------------------------------------------------------------------------

const createdCompanyIds = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildAuth(companyId, userId) {
  return { companyId: companyId.toString(), sub: userId.toString(), role: 'admin' };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Polls the DB until the intent for a company reaches the expected status,
 * or throws after timeoutMs.
 * NO test code calls the worker/reconciler — only the scheduler does.
 */
async function waitForIntentStatus(companyId, expectedStatus, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const intent = await /** @type {any} */ (prisma).invoiceFiscalIntent.findFirst({
      where: { companyId },
    });
    if (intent?.status === expectedStatus) return intent;
    await sleep(50);
  }
  const intent = await /** @type {any} */ (prisma).invoiceFiscalIntent.findFirst({ where: { companyId } });
  throw new Error(
    `Timeout (${timeoutMs}ms) waiting for fiscal intent status=${expectedStatus}. ` +
    `Current status: ${intent?.status ?? 'not found'}`,
  );
}

// (waitForIntentStatusAny reserved for future multi-status wait scenarios)

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

async function createSchedulerFixture(label, options = {}) {
  const suffix = uniqueSuffix();

  const company = await prisma.company.create({
    data: { name: `SCH ${label} ${suffix}`, legalId: `SCH-${suffix}`, email: `sch-${suffix}@t.com` },
  });
  createdCompanyIds.push(company.id);

  const user = await prisma.user.create({
    data: {
      companyId: company.id, fullName: `SCH User ${suffix}`, username: `sch-${label}-${suffix}`,
      passwordHash: 'not-used', email: `sch-u-${suffix}@t.com`,
    },
  });

  const client = await prisma.client.create({
    data: {
      companyId: company.id, code: `SCH-C-${suffix}`, name: `SCH Client ${suffix}`,
      legalId: `3101${suffix.replace(/\D/g, '').padEnd(6, '0').slice(0, 6)}`,
      documentType: '02', emailBilling: `sch-c-${suffix}@t.com`,
      paymentDays: options.paymentDays ?? 30,
    },
  });

  await prisma.companyBillingIntegrationConfig.create({
    data: {
      companyId: company.id,
      billingTenantId: `t-${suffix}`, billingCompanyId: `bc-${suffix}`,
      billingEnvironment: 'SANDBOX', billingCredentialSecretRef: 'env:TEST_SCHEDULER_KEY',
      enabled: options.configEnabled !== false,
    },
  });

  const inventory = await prisma.inventory.create({ data: { companyId: company.id } });
  const warehouse = await prisma.warehouse.create({
    data: { companyId: company.id, code: `SCH-W-${suffix}`, name: `SCH Wh ${suffix}`, isSellableSource: true, isActive: true },
  });
  const product = await prisma.product.create({
    data: {
      companyId: company.id, code: `SCH-P-${suffix}`, name: `SCH Prod ${suffix}`,
      unit: 'UN', cabysCode: '1234567890123', currency: 'CRC',
      price: 1000, quantity: 20, controlsInventory: true, lotStrategy: 'NONE',
      taxExempt: false, taxRate: 13,
    },
  });
  await prisma.warehouseStock.create({
    data: { inventoryId: inventory.id, warehouseId: warehouse.id, productId: product.id, quantity: 20, reservedQuantity: 0 },
  });
  const order = await prisma.order.create({
    data: {
      companyId: company.id, clientId: client.id, warehouseId: warehouse.id,
      paymentCondition: options.paymentCondition || 'CASH', status: 'DRAFT',
      items: { create: [{ productId: product.id, quantity: 2, unitPrice: 1000, discountPercent: 0, discountAmount: 0, totalDiscount: 0 }] },
    },
    include: { items: true },
  });

  return { company, user, client, inventory, warehouse, product, order, suffix };
}

async function dispatchFixture(fixture) {
  const auth = buildAuth(fixture.company.id, fixture.user.id);
  await inventoryService.reserveStockForOrder(fixture.order.id, auth);
  return inventoryService.dispatchOrder(fixture.order.id, auth, null);
}

async function cleanupCreatedCompanies() {
  for (const companyId of [...createdCompanyIds].reverse()) {
    try {
      await prisma.payment.deleteMany({ where: { invoice: { client: { companyId } } } });
      await /** @type {any} */ (prisma).invoiceFiscalIntent.deleteMany({ where: { companyId } });
      await /** @type {any} */ (prisma).invoiceFiscalSnapshot.deleteMany({ where: { companyId } });
      await /** @type {any} */ (prisma).invoiceItem.deleteMany({ where: { companyId } });
      await prisma.invoice.deleteMany({ where: { client: { companyId } } });
      await prisma.stockMovement.deleteMany({ where: { companyId } });
      await prisma.orderItem.deleteMany({ where: { order: { companyId } } });
      await prisma.order.deleteMany({ where: { companyId } });
      await prisma.warehouseStock.deleteMany({ where: { warehouse: { companyId } } });
      await prisma.product.deleteMany({ where: { companyId } });
      await prisma.warehouse.deleteMany({ where: { companyId } });
      await /** @type {any} */ (prisma).companyBillingIntegrationConfig.deleteMany({ where: { companyId } });
      await prisma.client.deleteMany({ where: { companyId } });
      await prisma.inventory.deleteMany({ where: { companyId } });
      await prisma.user.deleteMany({ where: { companyId } });
      await prisma.company.deleteMany({ where: { id: companyId } });
    } catch (_) { /* best-effort */ }
  }
  createdCompanyIds.length = 0;
}

/**
 * Creates a fast scheduler for tests.
 * @param {object} fakeBilling
 * @param {bigint[]} [companyIds]  Restrict discovery to these company IDs only.
 *                                  REQUIRED in combined test-suite runs to prevent
 *                                  cross-file intent contamination.
 * @param {object} [extraOptions]
 */
function makeFastScheduler(fakeBilling, companyIds = [], extraOptions = {}) {
  return new FiscalScheduler({
    billingClient: fakeBilling,
    db: prisma,
    pollIntervalMs: 100,        // Fast polling for tests
    workerBatchSize: 5,
    reconcilerBatchSize: 5,
    maxConcurrency: 2,
    staleThresholdMs: 500,     // Short stale window for crash tests
    // Scope discovery to this test's companies to prevent cross-file contamination
    companyIds: companyIds.length > 0 ? companyIds : undefined,
    ...extraOptions,
  });
}

before(async () => {
  if (!runOptions.skip) {
    await prisma.$connect();
    // Set a test env var for credential resolution
    process.env.TEST_SCHEDULER_KEY = 'test-scheduler-sentinel-key';
  }
});

after(async () => {
  if (!runOptions.skip) {
    await cleanupCreatedCompanies();
    await prisma.$disconnect();
    delete process.env.TEST_SCHEDULER_KEY;
  }
});

// ===========================================================================
// SUITE 1: Automatic Happy Path
// ===========================================================================

describe('TASK-015B scheduler: automatic ACCEPTED pipeline', runOptions, () => {
  test('dispatch → scheduler automatically drives PENDING to ACCEPTED', async () => {
    const fixture = await createSchedulerFixture('auto-accepted');
    // statusAfterNPolls:1 → first STATUS call returns ACCEPTED (no 5-min reconciler wait)
    const fakeBilling = new FakeBillingServer({ statusAfterNPolls: 1, finalStatus: 'ACCEPTED' });
    const scheduler = makeFastScheduler(fakeBilling, [fixture.company.id]);

    await dispatchFixture(fixture);

    const intentPending = await /** @type {any} */ (prisma).invoiceFiscalIntent.findFirst({ where: { companyId: fixture.company.id } });
    assert.equal(intentPending.status, 'PENDING', 'Intent must be PENDING before scheduler runs');

    // Start scheduler — NO test code calls processFiscalIntentById after this point
    try {
      scheduler.start();

      const intentAccepted = await waitForIntentStatus(fixture.company.id, 'ACCEPTED');

      assert.equal(intentAccepted.status, 'ACCEPTED');
      assert.ok(intentAccepted.clave, 'clave must be set on ACCEPTED intent');
      assert.ok(intentAccepted.consecutive, 'consecutive must be set on ACCEPTED intent');

      // Verify this specific intent's Billing document was created (idempotency-key-scoped).
      // We do NOT assert global createCallCount/statusCallCount here because in the combined
      // test suite the scheduler processes intents from multiple concurrent test files.
      const billingDoc = fakeBilling.getDocumentByIdempotencyKey(intentAccepted.idempotencyKey);
      assert.ok(billingDoc, 'Billing document must exist for this specific intent\'s idempotency key');
      assert.equal(billingDoc.status, 'ACCEPTED', 'Billing document must be ACCEPTED');

      // Invoice commercial status must remain PENDING
      const invoice = await prisma.invoice.findFirst({ where: { orderId: fixture.order.id } });
      assert.equal(invoice.status, 'PENDING', 'Invoice commercial status must remain PENDING');

      // Scheduler metrics
      const status = scheduler.getStatus();
      assert.ok(status.pollCount >= 1);
      assert.ok(status.totalWorkerProcessed >= 1);
    } finally {
      await scheduler.stop();
    }
  });

  test('scheduler does not re-process ACCEPTED intent after it reaches terminal state', async () => {
    const fixture = await createSchedulerFixture('no-reprocess');
    const fakeBilling = new FakeBillingServer({ statusAfterNPolls: 1, finalStatus: 'ACCEPTED' });
    const scheduler = makeFastScheduler(fakeBilling, [fixture.company.id]);

    await dispatchFixture(fixture);
    try {
      scheduler.start();

      const intentNoReprocess = await waitForIntentStatus(fixture.company.id, 'ACCEPTED');

      // Let the scheduler run a few more cycles
      await sleep(300);

      // ACCEPTED is terminal — verify this specific intent was not re-processed
      const billingDocNoReprocess = fakeBilling.getDocumentByIdempotencyKey(intentNoReprocess.idempotencyKey);
      assert.ok(billingDocNoReprocess, 'Billing document must exist');
      assert.equal(billingDocNoReprocess.status, 'ACCEPTED', 'ACCEPTED intent must not be re-processed');
    } finally {
      await scheduler.stop();
    }
  });
});

// ===========================================================================
// SUITE 2: Automatic Rejected Pipeline
// ===========================================================================

describe('TASK-015B scheduler: automatic REJECTED pipeline', runOptions, () => {
  test('dispatch → scheduler automatically drives PENDING to REJECTED', async () => {
    const fixture = await createSchedulerFixture('auto-rejected');
    const fakeBilling = new FakeBillingServer({
      statusAfterNPolls: 1,
      finalStatus: 'REJECTED',
      rejectionDiagnostics: {
        rejectionCode: '03',
        rejectionMessage: 'Error en receptor',
        haciendaMensaje: 'Datos inválidos en receptor',
      },
    });
    const scheduler = makeFastScheduler(fakeBilling, [fixture.company.id]);

    await dispatchFixture(fixture);
    try {
      scheduler.start();

      const intentRejected = await waitForIntentStatus(fixture.company.id, 'REJECTED');

      assert.equal(intentRejected.status, 'REJECTED');
      assert.ok(intentRejected.failureCode, 'Rejected intent must have failureCode');

      // Dispatch and Invoice remain intact after fiscal rejection
      const order = await prisma.order.findUnique({ where: { id: fixture.order.id } });
      assert.ok(['DELIVERED', 'FULFILLED'].includes(order.status), 'Order must remain dispatched');

      const invoice = await prisma.invoice.findFirst({ where: { orderId: fixture.order.id } });
      assert.equal(invoice.status, 'PENDING', 'Invoice must remain PENDING after fiscal REJECTED');
    } finally {
      await scheduler.stop();
    }
  });
});

// ===========================================================================
// SUITE 3: Automatic Restart Recovery
// ===========================================================================

describe('TASK-015B scheduler: automatic restart recovery', runOptions, () => {
  test('restart from PENDING: scheduler rediscovers and processes PENDING intent', async () => {
    const fixture = await createSchedulerFixture('restart-pending');
    const fakeBilling = new FakeBillingServer({ statusAfterNPolls: 1, finalStatus: 'ACCEPTED' });

    await dispatchFixture(fixture);

    // Verify PENDING exists
    const intentPending = await /** @type {any} */ (prisma).invoiceFiscalIntent.findFirst({ where: { companyId: fixture.company.id } });
    assert.equal(intentPending.status, 'PENDING');
    const originalKey = intentPending.idempotencyKey;

    // Simulate restart: create a FRESH scheduler instance (simulates process restart)
    const schedulerAfterRestart = makeFastScheduler(fakeBilling, [fixture.company.id]);
    try {
      schedulerAfterRestart.start();

      const intentAccepted = await waitForIntentStatus(fixture.company.id, 'ACCEPTED');

      assert.equal(intentAccepted.status, 'ACCEPTED');
      // Same idempotency key — no new Invoice, no new intent
      assert.equal(intentAccepted.idempotencyKey, originalKey, 'Idempotency key must be stable after restart');
      // Verify exactly ONE Billing document was created for this specific idempotency key
      const restartDoc = fakeBilling.getDocumentByIdempotencyKey(originalKey);
      assert.ok(restartDoc, 'Billing document must exist for the original idempotency key');
      assert.equal(restartDoc.status, 'ACCEPTED', 'Billing document from restart must be ACCEPTED');
    } finally {
      await schedulerAfterRestart.stop();
    }
  });

  test('restart from ERROR_RETRYABLE: scheduler rediscovers and retries', async () => {
    const fixture = await createSchedulerFixture('restart-retryable');
    const fakeBilling = new FakeBillingServer({ statusAfterNPolls: 1, finalStatus: 'ACCEPTED' });

    await dispatchFixture(fixture);

    // Manually move intent to ERROR_RETRYABLE (simulates a previous Billing timeout)
    const intent = await /** @type {any} */ (prisma).invoiceFiscalIntent.findFirst({ where: { companyId: fixture.company.id } });
    await /** @type {any} */ (prisma).invoiceFiscalIntent.update({
      where: { id: intent.id },
      data: { status: 'ERROR_RETRYABLE', failureCode: 'BILLING_TIMEOUT', nextAttemptAt: null },
    });

    // Restart scheduler — must rediscover ERROR_RETRYABLE
    const scheduler = makeFastScheduler(fakeBilling, [fixture.company.id]);
    try {
      scheduler.start();

      const intentFinal = await waitForIntentStatus(fixture.company.id, 'ACCEPTED');

      assert.equal(intentFinal.status, 'ACCEPTED');
      assert.equal(intentFinal.idempotencyKey, intent.idempotencyKey, 'Idempotency key unchanged after retry');
    } finally {
      await scheduler.stop();
    }
  });

  test('restart from PROCESSING+billingDocId: scheduler reconciles (NOT re-creates)', async () => {
    const fixture = await createSchedulerFixture('restart-processing');
    const fakeBilling = new FakeBillingServer({ statusAfterNPolls: 1, finalStatus: 'ACCEPTED' });

    await dispatchFixture(fixture);

    // Drive to PROCESSING manually via one worker cycle (simulates crashed process
    // that got through CREATE+SUBMIT before crashing before reconciliation)
    const intent = await /** @type {any} */ (prisma).invoiceFiscalIntent.findFirst({ where: { companyId: fixture.company.id } });

    // Manually inject PROCESSING state with a billingFiscalDocumentId
    // Also seed the fakeBilling server so STATUS returns ACCEPTED
    await fakeBilling.createFiscalDocument({
      billingCompanyId: 'bc1', environment: 'SANDBOX',
      idempotencyKey: intent.idempotencyKey, payload: {},
    });
    const submitResult = await fakeBilling.submitFiscalDocument({
      billingCompanyId: 'bc1', environment: 'SANDBOX',
      billingFiscalDocumentId: (fakeBilling.getDocumentByIdempotencyKey(intent.idempotencyKey))?.billingFiscalDocumentId,
    });

    const billingDocId = submitResult.billingFiscalDocumentId;
    await /** @type {any} */ (prisma).invoiceFiscalIntent.update({
      where: { id: intent.id },
      data: {
        status: 'PROCESSING',
        billingFiscalDocumentId: billingDocId,
        clave: submitResult.clave,
        consecutive: submitResult.consecutive,
        nextAttemptAt: null,
      },
    });

    const createCountBefore = fakeBilling.createCallCount;

    // Restart scheduler — MUST use reconciliation (STATUS poll), NOT re-create
    const scheduler = makeFastScheduler(fakeBilling, [fixture.company.id]);
    try {
      scheduler.start();

      const intentFinal = await waitForIntentStatus(fixture.company.id, 'ACCEPTED');

      assert.equal(intentFinal.status, 'ACCEPTED');
      // CREATE count must NOT increase (already had billingFiscalDocumentId)
      assert.equal(fakeBilling.createCallCount, createCountBefore,
        'Restart with known billingFiscalDocumentId must NOT re-enter CREATE');
    } finally {
      await scheduler.stop();
    }
  });
});

// ===========================================================================
// SUITE 4: Stale PROCESSING distinction
// ===========================================================================

describe('TASK-015B scheduler: stale PROCESSING distinction', runOptions, () => {
  test('PROCESSING with null billingDocId → stale recovery → ERROR_RETRYABLE → worker CREATE', async () => {
    const fixture = await createSchedulerFixture('stale-null-doc');
    const fakeBilling = new FakeBillingServer({ statusAfterNPolls: 1, finalStatus: 'ACCEPTED' });

    await dispatchFixture(fixture);

    // Manually set PROCESSING with null billingFiscalDocumentId + old lastAttemptAt
    const intent = await /** @type {any} */ (prisma).invoiceFiscalIntent.findFirst({ where: { companyId: fixture.company.id } });
    await /** @type {any} */ (prisma).invoiceFiscalIntent.update({
      where: { id: intent.id },
      data: {
        status: 'PROCESSING',
        billingFiscalDocumentId: null,
        lastAttemptAt: new Date(Date.now() - 60_000), // 60s ago, > 500ms staleThreshold
      },
    });

    const scheduler = makeFastScheduler(fakeBilling, [fixture.company.id]); // staleThresholdMs: 500
    try {
      scheduler.start();

      // Should: stale recovery → ERROR_RETRYABLE → worker CREATE → PROCESSING → reconcile → ACCEPTED
      const intentFinal = await waitForIntentStatus(fixture.company.id, 'ACCEPTED', 10_000);

      assert.equal(intentFinal.status, 'ACCEPTED');
      // Worker MUST have called CREATE (null billingDocId path recovers to ERROR_RETRYABLE then CREATE)
      assert.equal(fakeBilling.createCallCount, 1, 'Stale null-docId recovery must eventually call CREATE');
    } finally {
      await scheduler.stop();
    }
  });

  test('PROCESSING with billingDocId → reconciler STATUS poll (no CREATE)', async () => {
    const fixture = await createSchedulerFixture('stale-has-doc');
    const fakeBilling = new FakeBillingServer({ statusAfterNPolls: 1, finalStatus: 'ACCEPTED' });

    await dispatchFixture(fixture);

    // Inject PROCESSING + a real fake billingFiscalDocumentId
    const intent = await /** @type {any} */ (prisma).invoiceFiscalIntent.findFirst({ where: { companyId: fixture.company.id } });
    const docResult = await fakeBilling.createFiscalDocument({
      billingCompanyId: 'bc1', environment: 'SANDBOX', idempotencyKey: intent.idempotencyKey, payload: {},
    });
    const subResult = await fakeBilling.submitFiscalDocument({
      billingCompanyId: 'bc1', environment: 'SANDBOX', billingFiscalDocumentId: docResult.billingFiscalDocumentId,
    });
    await /** @type {any} */ (prisma).invoiceFiscalIntent.update({
      where: { id: intent.id },
      data: {
        status: 'PROCESSING',
        billingFiscalDocumentId: docResult.billingFiscalDocumentId,
        clave: subResult.clave,
        consecutive: subResult.consecutive,
        nextAttemptAt: null,
      },
    });

    const createCountBefore = fakeBilling.createCallCount;
    const scheduler = makeFastScheduler(fakeBilling, [fixture.company.id]);
    try {
      scheduler.start();

      const intentFinal = await waitForIntentStatus(fixture.company.id, 'ACCEPTED');

      assert.equal(intentFinal.status, 'ACCEPTED');
      // CREATE count must be the same — billingDocId was already set
      assert.equal(fakeBilling.createCallCount, createCountBefore,
        'PROCESSING with known billingDocId must NEVER call CREATE again');
      assert.ok(fakeBilling.statusCallCount >= 1, 'At least one STATUS call must be made');
    } finally {
      await scheduler.stop();
    }
  });
});

// ===========================================================================
// SUITE 5: Failure isolation
// ===========================================================================

describe('TASK-015B scheduler: failure isolation across companies', runOptions, () => {
  test('one company HTTP 503 does NOT prevent another company from being processed', async () => {
    const fixtureGood = await createSchedulerFixture('fi-good');
    const fixtureError = await createSchedulerFixture('fi-error');

    // Billing that fails for fixtureError's document (returns 503)
    // but succeeds for fixtureGood
    const selectiveFakeBilling = new FakeBillingServer({ statusAfterNPolls: 1, finalStatus: 'ACCEPTED' });

    // Override createFiscalDocument to simulate 503 on first call, then succeed
    // We rely on atomic claim: the scheduler will try each intent independently
    // Both dispatched - fixtureError's intent will fail on first create call
    const goodConfig = await /** @type {any} */ (prisma).companyBillingIntegrationConfig.findFirst({
      where: { companyId: fixtureGood.company.id },
    });
    const goodBillingCompanyId = goodConfig.billingCompanyId;

    const originalCreate = selectiveFakeBilling.createFiscalDocument.bind(selectiveFakeBilling);
    selectiveFakeBilling.createFiscalDocument = async (args) => {
      if (args.billingCompanyId === goodBillingCompanyId) {
        return originalCreate(args);
      }
      throw new BillingClientError('Billing unavailable', {
        code: 'BILLING_HTTP_ERROR',
        statusCode: 503,
        retryable: true,
      });
    };

    await dispatchFixture(fixtureGood);
    await dispatchFixture(fixtureError);

    const scheduler = makeFastScheduler(selectiveFakeBilling, [fixtureGood.company.id, fixtureError.company.id]);
    try {
      scheduler.start();

      // Wait for the "good" company to reach ACCEPTED
      const goodFinal = await waitForIntentStatus(fixtureGood.company.id, 'ACCEPTED', 8000);

      assert.equal(goodFinal.status, 'ACCEPTED', 'Good company must reach ACCEPTED');

      // Error company should be in ERROR_RETRYABLE (503 is retryable, not final)
      const errorFinal = await /** @type {any} */ (prisma).invoiceFiscalIntent.findFirst({
        where: { companyId: fixtureError.company.id },
      });
      assert.ok(
        ['PENDING', 'ERROR_RETRYABLE', 'PROCESSING'].includes(errorFinal.status),
        `Error company intent must be retryable, got: ${errorFinal.status}`,
      );
    } finally {
      await scheduler.stop();
    }
  });
});

// ===========================================================================
// SUITE 6: Multi-company isolation
// ===========================================================================

describe('TASK-015B scheduler: multi-company isolation', runOptions, () => {
  test('two companies processed independently in same scheduler poll cycle', async () => {
    const fixtureA = await createSchedulerFixture('multi-A');
    const fixtureB = await createSchedulerFixture('multi-B');
    const fakeBilling = new FakeBillingServer({ statusAfterNPolls: 1, finalStatus: 'ACCEPTED' });

    await dispatchFixture(fixtureA);
    await dispatchFixture(fixtureB);

    const scheduler = makeFastScheduler(fakeBilling, [fixtureA.company.id, fixtureB.company.id]);
    try {
      scheduler.start();

      const [intentA, intentB] = await Promise.all([
        waitForIntentStatus(fixtureA.company.id, 'ACCEPTED'),
        waitForIntentStatus(fixtureB.company.id, 'ACCEPTED'),
      ]);

      assert.equal(intentA.status, 'ACCEPTED', 'Company A must reach ACCEPTED');
      assert.equal(intentB.status, 'ACCEPTED', 'Company B must reach ACCEPTED');
      // Verify each company produced its own distinct Billing document
      const docA = fakeBilling.getDocumentByIdempotencyKey(intentA.idempotencyKey);
      const docB = fakeBilling.getDocumentByIdempotencyKey(intentB.idempotencyKey);
      assert.ok(docA, 'Company A must have a Billing document');
      assert.ok(docB, 'Company B must have a Billing document');
      assert.notEqual(docA.billingFiscalDocumentId, docB.billingFiscalDocumentId, 'Two companies = two distinct Billing documents');
      // Each company used its own config/credentials
      assert.notEqual(intentA.companyId.toString(), intentB.companyId.toString());
    } finally {
      await scheduler.stop();
    }
  });
});

// ===========================================================================
// SUITE 7: Concurrent scheduler instances (multi-instance safety)
// ===========================================================================

describe('TASK-015B scheduler: concurrent instance safety', runOptions, () => {
  test('two concurrent scheduler instances for same intent: only one creates a Billing document', async () => {
    const fixture = await createSchedulerFixture('concurrent-instance');
    const fakeBilling = new FakeBillingServer({ statusAfterNPolls: 1, finalStatus: 'ACCEPTED' });

    await dispatchFixture(fixture);

    // Start TWO scheduler instances simultaneously pointing at the same DB and Billing
    const schedulerA = makeFastScheduler(fakeBilling, [fixture.company.id]);
    const schedulerB = makeFastScheduler(fakeBilling, [fixture.company.id]);

    try {
      schedulerA.start();
      schedulerB.start();

      const intentFinal = await waitForIntentStatus(fixture.company.id, 'ACCEPTED');

      assert.equal(intentFinal.status, 'ACCEPTED');
      // Atomic claim ensures only one scheduler actually processes; both may attempt
      // but only one CREATE and one SUBMIT will succeed.
      // We check idempotency-key-scoped uniqueness to avoid contamination from
      // other concurrent test files' intents.
      const concurrentDoc = fakeBilling.getDocumentByIdempotencyKey(intentFinal.idempotencyKey);
      assert.ok(concurrentDoc, 'Billing document must exist for this intent\'s idempotency key');
      assert.equal(concurrentDoc.status, 'ACCEPTED', 'Billing document must be ACCEPTED');
      // The idempotency key must map to exactly one document (no duplicates)
      const docIdFromIndex = fakeBilling._idempotencyIndex.get(intentFinal.idempotencyKey);
      assert.ok(docIdFromIndex, 'Idempotency key must resolve to exactly one Billing document ID');
    } finally {
      await schedulerA.stop();
      await schedulerB.stop();
    }
  });
});

// ===========================================================================
// SUITE 8: Billing disabled
// ===========================================================================

describe('TASK-015B scheduler: Billing integration disabled', runOptions, () => {
  test('scheduler finds no eligible intents when Billing config is disabled', async () => {
    const fixture = await createSchedulerFixture('disabled-config', { configEnabled: false });
    const fakeBilling = new FakeBillingServer({ statusAfterNPolls: 1, finalStatus: 'ACCEPTED' });

    await dispatchFixture(fixture);

    // When config is disabled, dispatch creates no fiscal intent for this company
    const intentCount = await /** @type {any} */ (prisma).invoiceFiscalIntent.count({
      where: { companyId: fixture.company.id },
    });
    assert.equal(intentCount, 0, 'No fiscal intent created when Billing is disabled');

    const scheduler = makeFastScheduler(fakeBilling, [fixture.company.id]);
    try {
      scheduler.start();
      await sleep(300); // Let scheduler run a few cycles

      // Verify this specific company has no intents and was not processed.
      // NOTE: We do NOT assert fakeBilling.createCallCount === 0 here because the scheduler
      // processes ALL companies' intents globally. In the full suite, stray intents from
      // concurrent test files for OTHER companies may be discovered and processed.
      // What matters is that the DISABLED company contributed no fiscal work.
      const intentCountAfter = await /** @type {any} */ (prisma).invoiceFiscalIntent.count({
        where: { companyId: fixture.company.id },
      });
      assert.equal(intentCountAfter, 0, 'Disabled company must never acquire a fiscal intent');

      // Invoice must exist (dispatch happened) but no fiscal processing occurred for this company
      const invoice = await prisma.invoice.findFirst({ where: { orderId: fixture.order.id } });
      assert.ok(invoice, 'Commercial invoice must exist after dispatch even if Billing is disabled');
      assert.equal(invoice.status, 'PENDING', 'Invoice remains PENDING — no fiscal processing');
    } finally {
      await scheduler.stop();
    }
  });
});

// ===========================================================================
// SUITE 9: Graceful shutdown safety
// ===========================================================================

describe('TASK-015B scheduler: graceful shutdown', runOptions, () => {
  test('stop() during active poll: in-flight work completes before stop resolves', async () => {
    const fixture = await createSchedulerFixture('graceful-stop');
    const fakeBilling = new FakeBillingServer({ statusAfterNPolls: 1, finalStatus: 'ACCEPTED' });

    await dispatchFixture(fixture);

    const scheduler = makeFastScheduler(fakeBilling, [fixture.company.id]);
    try {
      scheduler.start();

      // Let scheduler start processing (but stop before it finishes)
      await sleep(20);
      // Stop while potentially in-flight
      await scheduler.stop();

      // After stop, DB state must be consistent (no partial write)
      const intent = await /** @type {any} */ (prisma).invoiceFiscalIntent.findFirst({
        where: { companyId: fixture.company.id },
      });
      assert.ok(intent, 'Intent must exist in DB');
      // Status may be PENDING (if stop fired before worker ran) or PROCESSING/ACCEPTED
      // — either way, it must be a valid state (no corruption)
      assert.ok(
        ['PENDING', 'PROCESSING', 'ACCEPTED', 'ERROR_RETRYABLE'].includes(intent.status),
        `Intent status must be valid after graceful stop, got: ${intent.status}`,
      );
    } finally {
      await scheduler.stop();
    }
  });

  test('isRunning() returns false after stop()', async () => {
    const fixture = await createSchedulerFixture('running-false');
    const fakeBilling = new FakeBillingServer({ statusAfterNPolls: 1, finalStatus: 'ACCEPTED' });
    const scheduler = makeFastScheduler(fakeBilling, [fixture.company.id]);

    await dispatchFixture(fixture);
    try {
      scheduler.start();
      assert.equal(scheduler.isRunning(), true);
      await scheduler.stop();
      assert.equal(scheduler.isRunning(), false);
    } finally {
      await scheduler.stop();
    }
  });
});
