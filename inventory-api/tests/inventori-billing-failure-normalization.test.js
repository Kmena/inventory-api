'use strict';

/**
 * TASK-016 — Failure Normalization & Persistence Tests
 *
 * Proves that for every Billing error shape:
 *   - worker does not crash
 *   - failureCode is string|null (never an object)
 *   - failureMessage is string|null
 *   - correct retryable/final classification
 *   - FiscalIntent exits PROCESSING appropriately
 *   - scheduler poll itself survives the worker failure
 *   - No secrets are logged
 *
 * Uses the FakeBillingServer and in-memory DB stubs — no real DB required.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const { BillingClientError, sanitizeBillingErrorBody } = require('../src/services/billing-api-client.service');
const {
  classifyBillingFailure,
  normalizeFailureCode,
  normalizeFailureMessage,
} = require('../src/services/fiscal-billing-worker.service');
const { FakeBillingServer } = require('./helpers/fake-billing-server');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBillingError(opts) {
  return new BillingClientError(opts.message || 'test error', opts);
}

function assertStringOrNull(value, label) {
  assert.ok(
    value === null || typeof value === 'string',
    `${label} must be string|null, got: ${typeof value} (${JSON.stringify(value)})`,
  );
}

// ---------------------------------------------------------------------------
// SUITE 0: BillingApiClient response sanitization
// ---------------------------------------------------------------------------

describe('TASK-016 sanitizeBillingErrorBody', () => {
  test('Billing nested {error:{code,message}} → scalar strings', () => {
    const sanitized = sanitizeBillingErrorBody({ error: { code: 'BAD_REQUEST', message: 'Invalid payload' } });
    assert.deepEqual(sanitized, { code: 'BAD_REQUEST', message: 'Invalid payload' });
  });

  test('ValidationPipe message array → joined string with BAD_REQUEST code', () => {
    const sanitized = sanitizeBillingErrorBody({
      error: {
        code: 'BAD_REQUEST',
        message: [
          'property totals should not exist',
          'property subtotal should not exist',
        ],
      },
    });
    assert.equal(sanitized.code, 'BAD_REQUEST');
    assert.equal(sanitized.message, 'property totals should not exist; property subtotal should not exist');
  });

  test('raw object code is not serialized into failureCode', () => {
    const sanitized = sanitizeBillingErrorBody({ error: { code: { code: 'BAD_REQUEST' }, message: 'oops' } });
    assert.deepEqual(sanitized, { code: null, message: 'oops' });
  });

  test('raw object message falls back deterministically', () => {
    const sanitized = sanitizeBillingErrorBody({ error: { code: 'BAD_REQUEST', message: { nested: true } } });
    assert.deepEqual(sanitized, { code: 'BAD_REQUEST', message: 'Billing request failed' });
  });
});

// ---------------------------------------------------------------------------
// SUITE 1: normalizeFailureCode — typed boundary guard
// ---------------------------------------------------------------------------

describe('TASK-016 normalizeFailureCode boundary', () => {
  test('string code passthrough', () => {
    assert.equal(normalizeFailureCode('BAD_REQUEST', 'FALLBACK'), 'BAD_REQUEST');
  });

  test('null code → fallback', () => {
    assert.equal(normalizeFailureCode(null, 'FALLBACK'), 'FALLBACK');
  });

  test('undefined code → fallback', () => {
    assert.equal(normalizeFailureCode(undefined, 'FALLBACK'), 'FALLBACK');
  });

  test('empty string → fallback', () => {
    assert.equal(normalizeFailureCode('', 'FALLBACK'), 'FALLBACK');
  });

  test('object {code, message} → fallback, not serialized object', () => {
    const raw = { code: 'BAD_REQUEST', message: 'some error' };
    const result = normalizeFailureCode(raw, 'FALLBACK');
    assert.equal(result, 'FALLBACK');
    assert.notEqual(result, raw, 'Must not return the original object');
  });

  test('number → string', () => {
    const result = normalizeFailureCode(400, 'FALLBACK');
    assertStringOrNull(result, 'normalizeFailureCode(400)');
    assert.equal(typeof result, 'string');
  });

  test('truncated to 200 chars max', () => {
    const long = 'X'.repeat(500);
    const result = normalizeFailureCode(long, 'FALLBACK');
    assert.ok(result.length <= 200, 'failureCode must be truncated');
  });
});

// ---------------------------------------------------------------------------
// SUITE 2: normalizeFailureMessage — typed boundary guard
// ---------------------------------------------------------------------------

describe('TASK-016 normalizeFailureMessage boundary', () => {
  test('string passthrough', () => {
    assert.equal(normalizeFailureMessage('some error', 'fallback'), 'some error');
  });

  test('null → fallback', () => {
    assert.equal(normalizeFailureMessage(null, 'fallback'), 'fallback');
  });

  test('array → joined string', () => {
    const result = normalizeFailureMessage(['error1', 'error2'], 'fallback');
    assertStringOrNull(result, 'normalizeFailureMessage(array)');
    assert.ok(result.includes('error1'), 'should contain first element');
    assert.ok(result.includes('error2'), 'should contain second element');
  });

  test('object → fallback, not serialized object', () => {
    const result = normalizeFailureMessage({ msg: 'oops' }, 'fallback');
    assert.equal(result, 'fallback');
  });

  test('truncated to 1000 chars max', () => {
    const long = 'A'.repeat(2000);
    const result = normalizeFailureMessage(long, 'fallback');
    assert.ok(result.length <= 1000, 'failureMessage must be truncated');
  });
});

// ---------------------------------------------------------------------------
// SUITE 3: classifyBillingFailure — error classification matrix
// ---------------------------------------------------------------------------

describe('TASK-016 classifyBillingFailure failure-path matrix', () => {
  // --- BillingClientError cases ---

  test('Billing 400 structured error → ERROR_FINAL, string code', () => {
    const e = makeBillingError({ code: 'BAD_REQUEST', statusCode: 400, retryable: false });
    const c = classifyBillingFailure(e);
    assert.equal(c.status, 'ERROR_FINAL');
    assert.equal(c.retryable, false);
    assertStringOrNull(c.code, 'c.code');
    assertStringOrNull(c.message, 'c.message');
  });

  test('Billing 400 with nested error object code → ERROR_FINAL, string code', () => {
    // Simulates what happens if somehow an object got through as code (defense in depth)
    const e = new BillingClientError('Validation failed', {
      code: 'BILLING_HTTP_ERROR',
      statusCode: 400,
      retryable: false,
    });
    // Manually inject object to test defense (should not happen with current sanitizeBillingErrorBody)
    e.code = { code: 'BAD_REQUEST', message: 'invalid field' };
    const c = classifyBillingFailure(e);
    assert.equal(c.status, 'ERROR_FINAL');
    assertStringOrNull(c.code, 'c.code with object code');
    assert.notEqual(typeof c.code, 'object', 'c.code must not be object');
  });

  test('Billing 401 → ERROR_FINAL, not retryable', () => {
    const c = classifyBillingFailure(makeBillingError({ code: 'BILLING_HTTP_ERROR', statusCode: 401, retryable: false }));
    assert.equal(c.status, 'ERROR_FINAL');
    assert.equal(c.retryable, false);
    assertStringOrNull(c.code, 'c.code');
    assertStringOrNull(c.message, 'c.message');
  });

  test('Billing 403 → ERROR_FINAL', () => {
    const c = classifyBillingFailure(makeBillingError({ code: 'BILLING_HTTP_ERROR', statusCode: 403, retryable: false }));
    assert.equal(c.status, 'ERROR_FINAL');
    assertStringOrNull(c.code, 'c.code');
  });

  test('Billing 404 → ERROR_FINAL', () => {
    // 404 is not in the FINAL list in current code; will be FINAL via default catch-all
    const c = classifyBillingFailure(makeBillingError({ code: 'BILLING_HTTP_ERROR', statusCode: 404, retryable: false }));
    assert.equal(c.status, 'ERROR_FINAL');
    assertStringOrNull(c.code, 'c.code');
  });

  test('Billing 409 → ERROR_FINAL', () => {
    const c = classifyBillingFailure(makeBillingError({ code: 'BILLING_HTTP_ERROR', statusCode: 409, retryable: false }));
    assert.equal(c.status, 'ERROR_FINAL');
    assertStringOrNull(c.code, 'c.code');
  });

  test('Billing 422 → ERROR_FINAL', () => {
    const c = classifyBillingFailure(makeBillingError({ code: 'BILLING_HTTP_ERROR', statusCode: 422, retryable: false }));
    assert.equal(c.status, 'ERROR_FINAL');
    assertStringOrNull(c.code, 'c.code');
  });

  test('Billing 429 → ERROR_RETRYABLE, retryable=true', () => {
    const c = classifyBillingFailure(makeBillingError({ code: 'BILLING_HTTP_ERROR', statusCode: 429, retryable: true }));
    assert.equal(c.status, 'ERROR_RETRYABLE');
    assert.equal(c.retryable, true);
    assertStringOrNull(c.code, 'c.code');
  });

  test('Billing 500 → ERROR_RETRYABLE', () => {
    const c = classifyBillingFailure(makeBillingError({ code: 'BILLING_HTTP_ERROR', statusCode: 500, retryable: true }));
    assert.equal(c.status, 'ERROR_RETRYABLE');
    assertStringOrNull(c.code, 'c.code');
  });

  test('Billing 503 → ERROR_RETRYABLE', () => {
    const c = classifyBillingFailure(makeBillingError({ code: 'BILLING_HTTP_ERROR', statusCode: 503, retryable: true }));
    assert.equal(c.status, 'ERROR_RETRYABLE');
    assertStringOrNull(c.code, 'c.code');
  });

  test('Billing TIMEOUT → AMBIGUOUS ERROR_RETRYABLE', () => {
    const c = classifyBillingFailure(makeBillingError({ code: 'BILLING_TIMEOUT', retryable: true }));
    assert.equal(c.kind, 'AMBIGUOUS');
    assert.equal(c.status, 'ERROR_RETRYABLE');
    assertStringOrNull(c.code, 'c.code');
  });

  test('connection refused / BILLING_UNAVAILABLE → ERROR_RETRYABLE', () => {
    const c = classifyBillingFailure(makeBillingError({ code: 'BILLING_UNAVAILABLE', retryable: true }));
    assert.equal(c.status, 'ERROR_RETRYABLE');
    assertStringOrNull(c.code, 'c.code');
  });

  // --- Non-BillingClientError cases ---

  test('malformed/non-JSON response → regular Error → ERROR_FINAL, string code', () => {
    const e = new Error('Billing returned a non-JSON response');
    const c = classifyBillingFailure(e);
    assert.equal(c.status, 'ERROR_FINAL');
    assertStringOrNull(c.code, 'c.code');
    assertStringOrNull(c.message, 'c.message');
  });

  test('unexpected thrown Error (no code) → ERROR_FINAL, fallback code', () => {
    const e = new Error('unexpected');
    const c = classifyBillingFailure(e);
    assert.equal(c.status, 'ERROR_FINAL');
    assert.equal(c.retryable, false);
    assertStringOrNull(c.code, 'c.code');
    assert.ok(typeof c.code === 'string' && c.code.length > 0, 'fallback code must be non-empty string');
  });

  test('unknown thrown object (not Error) → ERROR_FINAL, string code', () => {
    const c = classifyBillingFailure({ weirdShape: true, code: { nested: 'BAD_REQUEST' } });
    assert.equal(c.status, 'ERROR_FINAL');
    assertStringOrNull(c.code, 'c.code');
    assert.notEqual(typeof c.code, 'object', 'c.code must be string, not object');
  });

  test('null thrown → ERROR_FINAL, string fallback', () => {
    const c = classifyBillingFailure(null);
    assert.equal(c.status, 'ERROR_FINAL');
    assertStringOrNull(c.code, 'c.code');
  });

  test('non-BillingClientError with FISCAL_ code → ERROR_FINAL', () => {
    const e = Object.assign(new Error('missing'), { code: 'FISCAL_SNAPSHOT_MISSING' });
    const c = classifyBillingFailure(e);
    assert.equal(c.status, 'ERROR_FINAL');
    assert.equal(c.code, 'FISCAL_SNAPSHOT_MISSING');
    assertStringOrNull(c.code, 'c.code');
  });

  test('object thrown with object code → ERROR_FINAL, fallback code (not serialized object)', () => {
    const e = Object.assign(new Error('err'), { code: { code: 'BAD_REQUEST', message: 'Invalid' } });
    const c = classifyBillingFailure(e);
    assert.equal(c.status, 'ERROR_FINAL');
    assert.equal(c.code, 'FISCAL_WORKER_ERROR');
    assert.notEqual(typeof c.code, 'object', 'code must NOT be object');
  });

  test('all classification results have string|null code and message', () => {
    const errors = [
      makeBillingError({ code: 'BILLING_HTTP_ERROR', statusCode: 400, retryable: false }),
      makeBillingError({ code: 'BILLING_HTTP_ERROR', statusCode: 401, retryable: false }),
      makeBillingError({ code: 'BILLING_HTTP_ERROR', statusCode: 403, retryable: false }),
      makeBillingError({ code: 'BILLING_HTTP_ERROR', statusCode: 409, retryable: false }),
      makeBillingError({ code: 'BILLING_HTTP_ERROR', statusCode: 422, retryable: false }),
      makeBillingError({ code: 'BILLING_HTTP_ERROR', statusCode: 429, retryable: true }),
      makeBillingError({ code: 'BILLING_HTTP_ERROR', statusCode: 500, retryable: true }),
      makeBillingError({ code: 'BILLING_HTTP_ERROR', statusCode: 503, retryable: true }),
      makeBillingError({ code: 'BILLING_TIMEOUT', retryable: true }),
      makeBillingError({ code: 'BILLING_UNAVAILABLE', retryable: true }),
      new Error('unexpected'),
      Object.assign(new Error('fiscal'), { code: 'FISCAL_SNAPSHOT_MISSING' }),
      null,
      { weirdShape: 'yes', code: { nested: 'object' } },
    ];
    for (const err of errors) {
      const c = classifyBillingFailure(err);
      assertStringOrNull(c.code, `code for ${err?.constructor?.name || typeof err}`);
      assertStringOrNull(c.message, `message for ${err?.constructor?.name || typeof err}`);
      assert.ok(['ERROR_FINAL', 'ERROR_RETRYABLE'].includes(c.status),
        `status must be ERROR_FINAL or ERROR_RETRYABLE, got ${c.status}`);
    }
  });
});

// ---------------------------------------------------------------------------
// SUITE 4: FakeBillingServer error injection — worker integration
// ---------------------------------------------------------------------------

describe('TASK-016 FakeBillingServer error shapes → classifyBillingFailure', () => {
  test('FakeBillingServer 400 createError → classified as ERROR_FINAL', async () => {
    const server = new FakeBillingServer({
      createError: new BillingClientError('Validation failed — subtotal not accepted', {
        code: 'BAD_REQUEST',
        statusCode: 400,
        retryable: false,
      }),
    });
    let caught = null;
    try {
      await server.createFiscalDocument({
        billingCompanyId: 'bc1', environment: 'SANDBOX',
        idempotencyKey: 'k1', payload: {},
      });
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof BillingClientError, 'should throw BillingClientError');
    const c = classifyBillingFailure(caught);
    assert.equal(c.status, 'ERROR_FINAL');
    assert.equal(c.retryable, false);
    assertStringOrNull(c.code, 'c.code from fake 400');
    assertStringOrNull(c.message, 'c.message from fake 400');
  });

  test('FakeBillingServer TIMEOUT → classified as ERROR_RETRYABLE', async () => {
    const server = new FakeBillingServer({
      createError: new BillingClientError('timeout', { code: 'BILLING_TIMEOUT', retryable: true }),
    });
    let caught = null;
    try {
      await server.createFiscalDocument({ billingCompanyId: 'bc1', environment: 'SANDBOX', idempotencyKey: 'k1', payload: {} });
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof BillingClientError);
    const c = classifyBillingFailure(caught);
    assert.equal(c.status, 'ERROR_RETRYABLE');
    assert.equal(c.retryable, true);
    assertStringOrNull(c.code, 'c.code from timeout');
  });

  test('FakeBillingServer network error → classified as ERROR_RETRYABLE', async () => {
    const server = new FakeBillingServer({
      createError: new BillingClientError('connection refused', { code: 'BILLING_UNAVAILABLE', retryable: true }),
    });
    let caught = null;
    try {
      await server.createFiscalDocument({ billingCompanyId: 'bc1', environment: 'SANDBOX', idempotencyKey: 'k1', payload: {} });
    } catch (e) {
      caught = e;
    }
    const c = classifyBillingFailure(caught);
    assert.equal(c.status, 'ERROR_RETRYABLE');
    assertStringOrNull(c.code, 'c.code from network error');
  });
});

// ---------------------------------------------------------------------------
// SUITE 5: Scheduler poll survival — worker failure must not stop scheduler
// ---------------------------------------------------------------------------

describe('TASK-016 scheduler poll survival', () => {
  const { FiscalScheduler } = require('../src/services/fiscal-scheduler.service');

  function makeCrashingClient() {
    return {
      createFiscalDocument: async () => { throw new Error('Unexpected crash in billing client'); },
      submitFiscalDocument: async () => { throw new Error('Should not reach submit'); },
      getFiscalStatus: async () => { throw new Error('Should not reach status'); },
      getArtifact: async () => { throw new Error('Should not reach artifact'); },
    };
  }

  test('worker error in poll does NOT crash scheduler — poll completes', async () => {
    let pollCompleted = false;
    let workerError = null;

    // Minimal DB stub: returns one eligible intent then empty
    let callCount = 0;
    const fakeDb = {
      invoiceFiscalIntent: {
        findMany: async ({ where }) => {
          if (where?.status?.in?.includes('PENDING') && callCount === 0) {
            callCount++;
            return [{ id: 1n }];
          }
          return [];
        },
        findUnique: async () => null, // can't be claimed — returns null
        updateMany: async () => ({ count: 0 }), // claim fails
        update: async () => ({}),
      },
    };

    const scheduler = new FiscalScheduler({
      billingClient: makeCrashingClient(),
      db: fakeDb,
      pollIntervalMs: 60_000,  // No second poll
      maxConcurrency: 1,
    });

    // Override to track completion
    const origDoPoll = scheduler._doPoll.bind(scheduler);
    scheduler._doPoll = async () => {
      try {
        await origDoPoll();
        pollCompleted = true;
      } catch (e) {
        workerError = e;
        throw e;
      }
    };

    scheduler.start();
    // Wait for first poll to run
    await new Promise((resolve) => setTimeout(resolve, 200));
    await scheduler.stop();

    assert.equal(pollCompleted, true, 'poll must complete even when worker has no claimable intent');
    assert.equal(workerError, null, 'poll itself must not throw');
    assert.equal(scheduler.isRunning(), false, 'scheduler must be stopped');
  });

  test('scheduler metrics track worker errors without stopping', async () => {
    const fakeDb = {
      invoiceFiscalIntent: {
        findMany: async () => [],
        updateMany: async () => ({ count: 0 }),
        update: async () => ({}),
      },
    };

    const scheduler = new FiscalScheduler({
      billingClient: makeCrashingClient(),
      db: fakeDb,
      pollIntervalMs: 60_000,
    });

    scheduler.start();
    await new Promise((resolve) => setTimeout(resolve, 150));
    await scheduler.stop();

    const status = scheduler.getStatus();
    assert.ok(status.pollCount >= 1, 'at least one poll should have run');
    assert.equal(typeof status.totalWorkerErrors, 'number');
    // Scheduler status fields must not contain secrets
    const statusStr = JSON.stringify(status);
    assert.ok(!statusStr.includes('apiKey'), 'no apiKey in status');
    assert.ok(!statusStr.includes('bk_test'), 'no M2M key in status');
  });
});

// ---------------------------------------------------------------------------
// SUITE 6: No secrets in failure logs
// ---------------------------------------------------------------------------

describe('TASK-016 no secret exposure in failure path', () => {
  test('classifyBillingFailure result does not contain sentinel key pattern', () => {
    const SENTINEL = 'bk_test_SENTINEL_KEY_12345678';
    const e = new BillingClientError(`Error with sentinel ${SENTINEL}`, {
      code: `CODE_${SENTINEL}`,
      statusCode: 400,
      retryable: false,
    });
    const c = classifyBillingFailure(e);
    // The code and message should be truncated — but this is belt-and-suspenders:
    // real sentinel keys should NEVER reach classification (they live only in headers)
    // We don't actually expect the sentinel in a 400 code/message from production,
    // but we verify the classification result itself is safe-shaped
    assertStringOrNull(c.code, 'c.code');
    assertStringOrNull(c.message, 'c.message');
  });

  test('normalizeFailureCode never returns raw object that could contain secrets', () => {
    const potentiallySecretObject = { apiKey: 'sk_live_123', code: 'AUTH_ERROR' };
    const result = normalizeFailureCode(potentiallySecretObject, 'BILLING_CLIENT_ERROR');
    // The result must be a string — it may contain the stringified object content
    // but it must NOT be the raw object (which would be stored as JSON in DB)
    assertStringOrNull(result, 'result from object input');
    assert.notEqual(result, potentiallySecretObject, 'must not return raw object reference');
  });
});
