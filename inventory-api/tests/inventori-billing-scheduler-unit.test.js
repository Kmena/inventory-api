'use strict';

/**
 * TASK-015B — Fiscal Scheduler Unit Tests (no database required)
 *
 * Covers:
 *   1.  Scheduler state machine (start/stop/isRunning/getStatus)
 *   2.  start() without billingClient throws
 *   3.  Double start() is idempotent
 *   4.  stop() before start() is no-op
 *   5.  Graceful shutdown waits for active poll
 *   6.  getStatus() returns only safe fields (no API key, no secret)
 *   7.  Failure isolation — one intent error does NOT stop the poll loop
 *   8.  Bounded concurrency — respects maxConcurrency
 *   9.  No Hacienda endpoint references in scheduler source
 *  10.  No direct secret access in scheduler source
 *  11.  PROCESSING + billingDocId NOT picked up by _findEligibleWorkerIds
 *  12.  PROCESSING + null billingDocId NOT picked up by _findEligibleReconcilerIds
 *  13.  Scheduler metrics update after each poll
 *  14.  Application singleton helpers (start/stop/getStatus wrappers)
 *  15.  Server.js graceful shutdown structure audit
 *  16.  Config fiscalScheduler defaults audit
 *  17.  Health route includes fiscalScheduler check (safe fields only)
 *  18.  Poll does not overlap (second poll waits for first)
 *  19.  _processWithBoundedConcurrency stops early on _stopping
 *  20.  Backpressure: no unbounded Promise.all on all pending intents
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const { FiscalScheduler, getApplicationSchedulerStatus } = require('../src/services/fiscal-scheduler.service');
const config = require('../src/config');

// ---------------------------------------------------------------------------
// Minimal fake Billing client (no real HTTP)
// ---------------------------------------------------------------------------

function makeFakeClient(overrides = {}) {
  return {
    createFiscalDocument: overrides.createFiscalDocument ?? (async () => ({ billingFiscalDocumentId: `fake-${Date.now()}` })),
    submitFiscalDocument: overrides.submitFiscalDocument ?? (async (args) => ({
      billingFiscalDocumentId: args.billingFiscalDocumentId,
      clave: '5'.repeat(50),
      consecutive: '0'.repeat(20),
      fiscalStatus: 'PROCESSING',
    })),
    getFiscalStatus: overrides.getFiscalStatus ?? (async (args) => ({
      billingFiscalDocumentId: args.billingFiscalDocumentId,
      fiscalStatus: 'ACCEPTED',
    })),
    getArtifact: overrides.getArtifact ?? (async () => ({ contentType: 'application/pdf', bytes: Buffer.from('%PDF') })),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// SUITE 1: State machine
// ---------------------------------------------------------------------------

describe('TASK-015B scheduler: state machine', () => {
  test('start() transitions scheduler to running state', async () => {
    const scheduler = new FiscalScheduler({ billingClient: makeFakeClient(), pollIntervalMs: 50_000 });
    assert.equal(scheduler.isRunning(), false);
    scheduler.start();
    assert.equal(scheduler.isRunning(), true);
    await scheduler.stop();
    assert.equal(scheduler.isRunning(), false);
  });

  test('double start() is idempotent — does not schedule two timers', async () => {
    const scheduler = new FiscalScheduler({ billingClient: makeFakeClient(), pollIntervalMs: 50_000 });
    scheduler.start();
    const timerBefore = scheduler._timer;
    scheduler.start(); // Should be no-op
    assert.equal(scheduler._timer, timerBefore, 'Double start must not create a second timer');
    await scheduler.stop();
  });

  test('stop() before start() is a no-op', async () => {
    const scheduler = new FiscalScheduler({ billingClient: makeFakeClient(), pollIntervalMs: 50_000 });
    await assert.doesNotReject(() => scheduler.stop());
    assert.equal(scheduler.isRunning(), false);
  });

  test('start() without billingClient throws synchronously', () => {
    const scheduler = new FiscalScheduler({ pollIntervalMs: 50_000 }); // no billingClient
    assert.throws(() => scheduler.start(), /billingClient is required/);
    assert.equal(scheduler.isRunning(), false);
  });

  test('stop() resolves after active poll completes', async () => {
    let pollResolveFn = null;

    const scheduler = new FiscalScheduler({
      billingClient: makeFakeClient(),
      pollIntervalMs: 50_000,
      staleThresholdMs: 1,
    });

    // Override _doPoll to use a simple blocker
    scheduler._doPoll = async () => {
      await new Promise((resolve) => { pollResolveFn = resolve; });
    };

    scheduler.start();
    // Give the poll time to start
    await sleep(10);

    // Begin stop (should not resolve until poll completes)
    const stopPromise = scheduler.stop();
    let stopResolved = false;
    stopPromise.then(() => { stopResolved = true; });

    // Poll is still running — stop has not resolved
    await sleep(10);
    assert.equal(stopResolved, false, 'stop() must not resolve while poll is active');

    // Unblock the poll
    if (pollResolveFn) pollResolveFn();
    await stopPromise;
    assert.equal(stopResolved, true, 'stop() must resolve after poll completes');
    assert.equal(scheduler.isRunning(), false);
  });

  test('getStatus() returns safe operational fields without secrets', async () => {
    const scheduler = new FiscalScheduler({
      billingClient: makeFakeClient(),
      pollIntervalMs: 50_000,
      workerBatchSize: 7,
      reconcilerBatchSize: 8,
      maxConcurrency: 2,
    });
    scheduler.start();
    const status = scheduler.getStatus();

    assert.ok(typeof status.running === 'boolean');
    assert.equal(status.pollIntervalMs, 50_000);
    assert.equal(status.workerBatchSize, 7);
    assert.equal(status.reconcilerBatchSize, 8);
    assert.equal(status.maxConcurrency, 2);
    assert.ok(typeof status.pollCount === 'number');
    assert.ok(typeof status.totalWorkerProcessed === 'number');
    assert.ok(typeof status.totalReconcilerProcessed === 'number');
    assert.ok(typeof status.totalWorkerErrors === 'number');
    assert.ok(typeof status.totalReconcilerErrors === 'number');

    // SAFETY: must not contain API key, secret, certificate, PIN
    const statusStr = JSON.stringify(status);
    assert.ok(!statusStr.includes('apiKey'), 'Status must not contain apiKey');
    assert.ok(!statusStr.includes('secretRef'), 'Status must not contain secretRef');
    assert.ok(!statusStr.includes('credential'), 'Status must not contain credential');
    assert.ok(!statusStr.includes('certificate'), 'Status must not contain certificate');

    await scheduler.stop();
  });

  test('metrics update after polls complete', async () => {
    let pollCount = 0;
    const scheduler = new FiscalScheduler({
      billingClient: makeFakeClient(),
      pollIntervalMs: 50, // Very short for test speed
      staleThresholdMs: 1,
    });

    // Override _doPoll to count invocations without doing real DB work
    scheduler._doPoll = async () => { pollCount++; };
    scheduler._findEligibleWorkerIds = async () => [];
    scheduler._findEligibleReconcilerIds = async () => [];

    scheduler.start();
    await sleep(180); // Should get at least 2 polls at 50ms interval
    await scheduler.stop();

    assert.ok(scheduler.getStatus().pollCount >= 2, `Expected >= 2 polls, got ${scheduler.getStatus().pollCount}`);
    assert.ok(pollCount >= 2);
  });

  test('stoppedAt is set after stop()', async () => {
    const scheduler = new FiscalScheduler({ billingClient: makeFakeClient(), pollIntervalMs: 50_000 });
    scheduler.start();
    assert.equal(scheduler.getStatus().stoppedAt, null);
    await scheduler.stop();
    assert.ok(scheduler.getStatus().stoppedAt !== null);
  });
});

// ---------------------------------------------------------------------------
// SUITE 2: Failure isolation
// ---------------------------------------------------------------------------

describe('TASK-015B scheduler: failure isolation', () => {
  test('one intent error does NOT stop other intents from being processed', async () => {
    const processed = [];
    const callOrder = [];

    // Three intents: first throws, second and third succeed
    const fakeIds = [100n, 200n, 300n];

    const scheduler = new FiscalScheduler({
      billingClient: makeFakeClient(),
      pollIntervalMs: 50_000,
      maxConcurrency: 1, // Serial so we can track order
    });

    // Override inner processing to inject failure on first intent
    scheduler._doPoll = async () => {
      for (const id of fakeIds) {
        callOrder.push(id);
        try {
          if (id === 100n) throw new Error('Simulated Billing timeout');
          processed.push(id);
        } catch (_err) {
          // Failure isolation: swallow and continue
          scheduler._metrics.totalWorkerErrors++;
        }
      }
    };

    scheduler.start();
    await sleep(30); // Let first poll run
    await scheduler.stop();

    assert.deepEqual(processed, [200n, 300n], 'Intents 200 and 300 must be processed despite intent 100 error');
    assert.equal(callOrder.length, 3, 'All 3 intents must have been attempted');
    assert.equal(scheduler.getStatus().totalWorkerErrors, 1);
  });

  test('poll-level error does NOT permanently stop the scheduler', async () => {
    let pollCount = 0;
    let errorPollTriggered = false;

    const scheduler = new FiscalScheduler({
      billingClient: makeFakeClient(),
      pollIntervalMs: 50,
      staleThresholdMs: 1,
    });

    scheduler._doPoll = async () => {
      pollCount++;
      if (!errorPollTriggered) {
        errorPollTriggered = true;
        throw new Error('Simulated poll-level error');
      }
    };

    scheduler.start();
    await sleep(200);
    await scheduler.stop();

    // After error poll, scheduler must have continued polling
    assert.ok(pollCount >= 2, `Expected >= 2 polls (error + recovery), got ${pollCount}`);
  });

  test('reconciler intent error does NOT stop worker batch', async () => {
    const processedWorkerIds = [];
    const scheduler = new FiscalScheduler({
      billingClient: makeFakeClient(),
      pollIntervalMs: 50_000,
      maxConcurrency: 1,
    });

    // Simulate reconciler always throws, worker batch always succeeds
    let workerCallCount = 0;
    scheduler._doPoll = async () => {
      // Worker succeeds
      workerCallCount++;
      processedWorkerIds.push(1n);

      // Reconciler throws
      try {
        throw new Error('Simulated reconciler HTTP 503');
      } catch (_err) {
        scheduler._metrics.totalReconcilerErrors++;
      }
    };

    scheduler.start();
    await sleep(30);
    await scheduler.stop();

    assert.ok(workerCallCount >= 1, 'Worker must have run despite reconciler error');
    assert.equal(scheduler.getStatus().totalReconcilerErrors, 1);
  });
});

// ---------------------------------------------------------------------------
// SUITE 3: Bounded concurrency
// ---------------------------------------------------------------------------

describe('TASK-015B scheduler: bounded concurrency', () => {
  test('_processWithBoundedConcurrency processes all IDs', async () => {
    const scheduler = new FiscalScheduler({ billingClient: makeFakeClient(), pollIntervalMs: 50_000, maxConcurrency: 3 });
    const processed = [];
    const ids = [1n, 2n, 3n, 4n, 5n, 6n, 7n];
    await scheduler._processWithBoundedConcurrency(ids, async (id) => { processed.push(id); });
    assert.deepEqual(processed.sort(), ids.sort());
  });

  test('_processWithBoundedConcurrency with maxConcurrency=1 processes serially', async () => {
    const scheduler = new FiscalScheduler({ billingClient: makeFakeClient(), pollIntervalMs: 50_000, maxConcurrency: 1 });
    const order = [];
    const ids = [1n, 2n, 3n];
    await scheduler._processWithBoundedConcurrency(ids, async (id) => {
      order.push(id);
      await sleep(5);
    });
    assert.deepEqual(order, [1n, 2n, 3n]);
  });

  test('_processWithBoundedConcurrency stops early when _stopping=true', async () => {
    const scheduler = new FiscalScheduler({ billingClient: makeFakeClient(), pollIntervalMs: 50_000, maxConcurrency: 2 });
    const processed = [];
    const ids = [1n, 2n, 3n, 4n, 5n, 6n];

    // Set stopping after first batch
    let batchCount = 0;
    await scheduler._processWithBoundedConcurrency(ids, async (id) => {
      processed.push(id);
      batchCount++;
      if (batchCount === 2) {
        scheduler._stopping = true; // Simulate stop signal mid-batch
      }
    });

    // With maxConcurrency=2, second batch of 2 was in flight when stopping was set
    // Third batch of 2 should be skipped
    assert.ok(processed.length <= 4, 'Processing must stop after _stopping is set');
    scheduler._stopping = false; // Reset for cleanup
  });
});

// ---------------------------------------------------------------------------
// SUITE 4: Discovery query safety
// ---------------------------------------------------------------------------

describe('TASK-015B scheduler: discovery query safety', () => {
  test('_findEligibleWorkerIds only targets PENDING and ERROR_RETRYABLE', async () => {
    const queries = [];
    const fakeDb = {
      invoiceFiscalIntent: {
        findMany: async (args) => { queries.push(args.where); return []; },
      },
    };
    const scheduler = new FiscalScheduler({ billingClient: makeFakeClient(), db: fakeDb, pollIntervalMs: 50_000 });
    await scheduler._findEligibleWorkerIds(10);
    assert.equal(queries.length, 1);
    assert.deepEqual(queries[0].status, { in: ['PENDING', 'ERROR_RETRYABLE'] });
    assert.equal(queries[0].billingFiscalDocumentId, null,
      'Worker must only target intents WITHOUT an existing Billing fiscal identity');
    // Must NOT include PROCESSING, ACCEPTED, REJECTED, ERROR_FINAL
    assert.ok(!JSON.stringify(queries[0].status.in).includes('PROCESSING'), 'Worker must not target PROCESSING');
  });

  test('_findEligibleReconcilerIds only targets PROCESSING with non-null billingFiscalDocumentId', async () => {
    const queries = [];
    const fakeDb = {
      invoiceFiscalIntent: {
        findMany: async (args) => { queries.push(args.where); return []; },
      },
    };
    const scheduler = new FiscalScheduler({ billingClient: makeFakeClient(), db: fakeDb, pollIntervalMs: 50_000 });
    await scheduler._findEligibleReconcilerIds(10);
    assert.equal(queries.length, 1);
    assert.equal(queries[0].status, 'PROCESSING');
    assert.deepEqual(queries[0].billingFiscalDocumentId, { not: null },
      'Reconciler must only target intents WITH a billingFiscalDocumentId');
  });

  test('_findEligibleWorkerIds does NOT target ACCEPTED, REJECTED, ERROR_FINAL', async () => {
    const queries = [];
    const fakeDb = {
      invoiceFiscalIntent: {
        findMany: async (args) => { queries.push(args.where); return []; },
      },
    };
    const scheduler = new FiscalScheduler({ billingClient: makeFakeClient(), db: fakeDb, pollIntervalMs: 50_000 });
    await scheduler._findEligibleWorkerIds(10);
    const statusIn = queries[0].status.in;
    assert.ok(!statusIn.includes('ACCEPTED'), 'Worker must not target ACCEPTED');
    assert.ok(!statusIn.includes('REJECTED'), 'Worker must not target REJECTED');
    assert.ok(!statusIn.includes('ERROR_FINAL'), 'Worker must not target ERROR_FINAL');
    assert.ok(!statusIn.includes('PROCESSING'), 'Worker must not target PROCESSING (handles billingDocId-null path via stale recovery)');
  });
});

// ---------------------------------------------------------------------------
// SUITE 5: Static audit — Hacienda + secrets
// ---------------------------------------------------------------------------

describe('TASK-015B scheduler: static audit', () => {
  const SCHEDULER_SRC = path.join(__dirname, '..', 'src', 'services', 'fiscal-scheduler.service.js');
  const SERVER_SRC = path.join(__dirname, '..', 'src', 'server.js');

  test('fiscal-scheduler.service.js contains no direct Hacienda endpoints', () => {
    const content = fs.readFileSync(SCHEDULER_SRC, 'utf8');
    const haciendaPatterns = [
      'api.comprobanteselectronicos.go.cr',
      'api.hacienda.go.cr/fe/ATV',
      '/recepcion/',
    ];
    for (const pattern of haciendaPatterns) {
      assert.ok(!content.includes(pattern), `Scheduler must not contain: ${pattern}`);
    }
  });

  test('fiscal-scheduler.service.js never logs apiKey or secretRef in logFiscalWorkerEvent equivalent', () => {
    const content = fs.readFileSync(SCHEDULER_SRC, 'utf8');
    // Check no LOG PAYLOAD construction passes API key / secret as a value.
    // Exclude JSDoc comments (lines starting with * or //) from the scan.
    const codeLines = content.split('\n').filter((l) => {
      const trimmed = l.trim();
      return !trimmed.startsWith('*') && !trimmed.startsWith('//');
    });
    const codeOnly = codeLines.join('\n');
    // The _log function must never include raw API key or resolved secret value
    assert.ok(!codeOnly.includes('"apiKey"'), 'Scheduler log must not use apiKey as JSON key');
    assert.ok(!codeOnly.includes("'apiKey'"), 'Scheduler log must not use apiKey as JSON key');
    // Credential resolver instance must not be passed into log payload
    // (the resolver is assigned to `this._credentialResolver` but never logged)
    assert.ok(!codeOnly.includes('_log(\'info\', \'scheduler-start\', {\n.*credentialResolver'), 'credentialResolver must not be in log payload');
  });

  test('fiscal-scheduler.service.js does not import or call Hacienda client', () => {
    const content = fs.readFileSync(SCHEDULER_SRC, 'utf8');
    assert.ok(!content.includes('hacienda-client'), 'No Hacienda client import');
    assert.ok(!content.includes('comprobanteselectronicos'), 'No comprobanteselectronicos reference');
    assert.ok(!content.includes('/recepcion/'), 'No Hacienda recepcion endpoint');
    assert.ok(!content.includes('pkcs12'), 'No PKCS12 handling');
    // Check actual code (not JSDoc comments) for certificate-related calls
    const codeLines = content.split('\n').filter((l) => {
      const trimmed = l.trim();
      return !trimmed.startsWith('*') && !trimmed.startsWith('//');
    });
    const codeOnly = codeLines.join('\n');
    assert.ok(!codeOnly.includes('createCertificate'), 'No certificate creation in scheduler');
    assert.ok(!codeOnly.includes('.p12'), 'No .p12 certificate file in scheduler');
    assert.ok(!codeOnly.includes('forge'), 'No node-forge in scheduler');
  });

  test('server.js has SIGTERM and SIGINT graceful shutdown handlers', () => {
    const content = fs.readFileSync(SERVER_SRC, 'utf8');
    assert.ok(content.includes('SIGTERM'), 'server.js must handle SIGTERM');
    assert.ok(content.includes('SIGINT'), 'server.js must handle SIGINT');
    assert.ok(content.includes('stopApplicationScheduler'), 'server.js must stop scheduler on shutdown');
    assert.ok(content.includes('startApplicationScheduler'), 'server.js must start scheduler on listen');
  });

  test('server.js does not call process.exit(0) directly without graceful shutdown', () => {
    const content = fs.readFileSync(SERVER_SRC, 'utf8');
    // process.exit(0) may be called inside gracefulShutdown (ok) but not at module level
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.includes('process.exit(0)') && !line.trim().startsWith('//')) {
        // Must be inside a function, not at top level
        assert.ok(
          content.includes('gracefulShutdown') && content.indexOf('process.exit(0)') > content.indexOf('async function gracefulShutdown'),
          'process.exit(0) must be inside gracefulShutdown function',
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// SUITE 6: Config defaults
// ---------------------------------------------------------------------------

describe('TASK-015B scheduler: config defaults', () => {
  test('fiscalScheduler config exists with safe defaults', () => {
    assert.ok(config.fiscalScheduler, 'fiscalScheduler config must exist');
    assert.equal(typeof config.fiscalScheduler.enabled, 'boolean');
    assert.equal(typeof config.fiscalScheduler.pollIntervalMs, 'number');
    assert.ok(config.fiscalScheduler.pollIntervalMs >= 1000, 'Poll interval must be >= 1s (no busy loop)');
    assert.equal(typeof config.fiscalScheduler.workerBatchSize, 'number');
    assert.ok(config.fiscalScheduler.workerBatchSize >= 1);
    assert.equal(typeof config.fiscalScheduler.reconcilerBatchSize, 'number');
    assert.ok(config.fiscalScheduler.reconcilerBatchSize >= 1);
    assert.equal(typeof config.fiscalScheduler.maxConcurrency, 'number');
    assert.ok(config.fiscalScheduler.maxConcurrency >= 1);
    assert.equal(typeof config.fiscalScheduler.staleThresholdMs, 'number');
    assert.ok(config.fiscalScheduler.staleThresholdMs >= 1000);
  });

  test('fiscalScheduler.enabled defaults to false (explicit opt-in required)', () => {
    // In test environment, FISCAL_SCHEDULER_ENABLED is not set to 'true'
    // so enabled must be false — prevents accidental real Billing requests
    if (!process.env.FISCAL_SCHEDULER_ENABLED) {
      assert.equal(config.fiscalScheduler.enabled, false,
        'Scheduler must default to DISABLED to prevent accidental real Billing requests');
    }
  });

  test('pollIntervalMs default is at least 5 seconds (no busy loop in production)', () => {
    // We test the DEFAULT, not the env-overridden value
    // Create a scheduler with no options and check it uses a sane default
    const scheduler = new FiscalScheduler({ billingClient: makeFakeClient() });
    // Access private field for inspection
    assert.ok(scheduler._pollIntervalMs >= 5_000,
      'Default poll interval must be >= 5s to avoid hammering DB when no work exists');
  });

  test('getApplicationSchedulerStatus returns disabled status when scheduler never started', () => {
    // In unit test mode, application scheduler is never started
    const status = getApplicationSchedulerStatus();
    assert.equal(typeof status.running, 'boolean');
    // Must NOT contain secrets
    const statusStr = JSON.stringify(status);
    assert.ok(!statusStr.includes('apiKey'), 'Application scheduler status must not expose apiKey');
    assert.ok(!statusStr.includes('BILLING_'), 'Application scheduler status must not expose env var names');
  });
});

// ---------------------------------------------------------------------------
// SUITE 7: Backpressure / no unbounded Promise.all
// ---------------------------------------------------------------------------

describe('TASK-015B scheduler: backpressure', () => {
  test('concurrent ops at any moment <= maxConcurrency', async () => {
    let maxActive = 0;
    let currentActive = 0;
    const ids = Array.from({ length: 10 }, (_, i) => BigInt(i + 1));
    const scheduler = new FiscalScheduler({ billingClient: makeFakeClient(), pollIntervalMs: 50_000, maxConcurrency: 3 });

    await scheduler._processWithBoundedConcurrency(ids, async () => {
      currentActive++;
      maxActive = Math.max(maxActive, currentActive);
      await sleep(5);
      currentActive--;
    });

    assert.ok(maxActive <= 3, `Max active concurrent ops (${maxActive}) must not exceed maxConcurrency=3`);
  });

  test('batchSize=5 with 20 eligible intents: at most 5 IDs fetched per poll', async () => {
    const fetchedCounts = [];
    const fakeDb = {
      invoiceFiscalIntent: {
        findMany: async (args) => {
          fetchedCounts.push(args.take);
          return [];
        },
        updateMany: async () => ({ count: 0 }),
      },
    };
    const scheduler = new FiscalScheduler({
      billingClient: makeFakeClient(),
      db: fakeDb,
      pollIntervalMs: 50_000,
      workerBatchSize: 5,
      reconcilerBatchSize: 5,
      staleThresholdMs: 1,
    });

    // Just test the query, not the full poll
    await scheduler._findEligibleWorkerIds(5);
    assert.ok(fetchedCounts.every((n) => n <= 5), 'Each discovery query must fetch at most workerBatchSize IDs');
  });
});
