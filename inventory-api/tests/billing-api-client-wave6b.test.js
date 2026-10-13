'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { BillingApiClient, BillingClientError } = require('../src/services/billing-api-client.service');

function makeReadiness(overrides = {}) {
  return {
    companyId: 'billing-co-1',
    environment: 'SANDBOX',
    readyToIssue: false,
    reasonCodes: ['FISCAL_PROFILE_MISSING'],
    warnings: [],
    checkedAt: '2026-09-29T10:00:00.000Z',
    ...overrides,
  };
}

function makeFakeCredentialResolver(apiKey = 'test-api-key') {
  return { resolveApiKey: () => apiKey };
}

function makeFetchThatReturns(body, status = 200) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  });
}

function makeClient(fetchImpl, apiKey = 'test-api-key') {
  return new BillingApiClient({
    baseUrl: 'https://billing.test',
    credentialResolver: makeFakeCredentialResolver(apiKey),
    timeoutMs: 5000,
    fetchImpl,
  });
}

// ── Test 1: correct URL ──────────────────────────────────────────────────────

test('Wave 6B BillingApiClient.getFiscalReadiness uses correct URL with billingCompanyId and environment', async () => {
  let capturedUrl;
  const fetchImpl = async (url, _options) => {
    capturedUrl = url;
    return { ok: true, status: 200, text: async () => JSON.stringify(makeReadiness()) };
  };
  const client = makeClient(fetchImpl);
  await client.getFiscalReadiness({ billingCompanyId: 'co-1', environment: 'SANDBOX', secretReference: 'ref', correlationId: null });
  assert.equal(capturedUrl, 'https://billing.test/api/v1/companies/co-1/fiscal-onboarding/SANDBOX/readiness');
});

// ── Test 2: GET method ───────────────────────────────────────────────────────

test('Wave 6B BillingApiClient.getFiscalReadiness uses GET method', async () => {
  let capturedMethod;
  const fetchImpl = async (_url, options) => {
    capturedMethod = options.method;
    return { ok: true, status: 200, text: async () => JSON.stringify(makeReadiness()) };
  };
  const client = makeClient(fetchImpl);
  await client.getFiscalReadiness({ billingCompanyId: 'co-1', environment: 'SANDBOX', secretReference: 'ref', correlationId: null });
  assert.equal(capturedMethod, 'GET');
});

// ── Test 3: API-key mechanism reused ─────────────────────────────────────────

test('Wave 6B BillingApiClient.getFiscalReadiness sends X-API-Key header from credentialResolver', async () => {
  let capturedHeaders;
  const fetchImpl = async (_url, options) => {
    capturedHeaders = options.headers;
    return { ok: true, status: 200, text: async () => JSON.stringify(makeReadiness()) };
  };
  const client = makeClient(fetchImpl, 'secret-key-123');
  await client.getFiscalReadiness({ billingCompanyId: 'co-1', environment: 'SANDBOX', secretReference: 'ref', correlationId: null });
  assert.equal(capturedHeaders['X-API-Key'], 'secret-key-123');
});

// ── Test 4: secretReference resolved server-side (no raw value in URL) ───────

test('Wave 6B BillingApiClient.getFiscalReadiness does not put secretReference in the URL', async () => {
  let capturedUrl;
  const fetchImpl = async (url, _options) => {
    capturedUrl = url;
    return { ok: true, status: 200, text: async () => JSON.stringify(makeReadiness()) };
  };
  const client = makeClient(fetchImpl);
  await client.getFiscalReadiness({ billingCompanyId: 'co-1', environment: 'SANDBOX', secretReference: 'my-secret/ref', correlationId: null });
  assert.doesNotMatch(capturedUrl, /my-secret/);
});

// ── Test 5: correlationId preserved ─────────────────────────────────────────

test('Wave 6B BillingApiClient.getFiscalReadiness forwards X-Correlation-Id header', async () => {
  let capturedHeaders;
  const fetchImpl = async (_url, options) => {
    capturedHeaders = options.headers;
    return { ok: true, status: 200, text: async () => JSON.stringify(makeReadiness()) };
  };
  const client = makeClient(fetchImpl);
  await client.getFiscalReadiness({ billingCompanyId: 'co-1', environment: 'SANDBOX', secretReference: 'ref', correlationId: 'corr-abc' });
  assert.equal(capturedHeaders['X-Correlation-Id'], 'corr-abc');
});

// ── Test 6: SANDBOX environment preserved ────────────────────────────────────

test('Wave 6B BillingApiClient.getFiscalReadiness passes SANDBOX as path segment', async () => {
  let capturedUrl;
  const fetchImpl = async (url, _options) => {
    capturedUrl = url;
    return { ok: true, status: 200, text: async () => JSON.stringify(makeReadiness({ environment: 'SANDBOX' })) };
  };
  const client = makeClient(fetchImpl);
  await client.getFiscalReadiness({ billingCompanyId: 'co-1', environment: 'SANDBOX', secretReference: 'ref', correlationId: null });
  assert.match(capturedUrl, /\/SANDBOX\/readiness$/);
});

// ── Test 7: PRODUCTION environment preserved ─────────────────────────────────

test('Wave 6B BillingApiClient.getFiscalReadiness passes PRODUCTION as path segment', async () => {
  let capturedUrl;
  const fetchImpl = async (url, _options) => {
    capturedUrl = url;
    return { ok: true, status: 200, text: async () => JSON.stringify(makeReadiness({ environment: 'PRODUCTION', readyToIssue: true })) };
  };
  const client = makeClient(fetchImpl);
  await client.getFiscalReadiness({ billingCompanyId: 'co-1', environment: 'PRODUCTION', secretReference: 'ref', correlationId: null });
  assert.match(capturedUrl, /\/PRODUCTION\/readiness$/);
});

// ── Test 8: readyToIssue boolean validated ───────────────────────────────────

test('Wave 6B BillingApiClient.getFiscalReadiness returns readyToIssue boolean from response', async () => {
  const client = makeClient(makeFetchThatReturns(makeReadiness({ readyToIssue: true })));
  const result = await client.getFiscalReadiness({ billingCompanyId: 'co-1', environment: 'SANDBOX', secretReference: 'ref', correlationId: null });
  assert.equal(result.readyToIssue, true);
});

// ── Test 9: malformed readyToIssue rejected ──────────────────────────────────

test('Wave 6B BillingApiClient.getFiscalReadiness rejects non-boolean readyToIssue', async () => {
  const client = makeClient(makeFetchThatReturns(makeReadiness({ readyToIssue: 'yes' })));
  await assert.rejects(
    () => client.getFiscalReadiness({ billingCompanyId: 'co-1', environment: 'SANDBOX', secretReference: 'ref', correlationId: null }),
    (err) => err instanceof BillingClientError && err.code === 'BILLING_MALFORMED_FISCAL_READINESS',
  );
});

// ── Test 10: reasonCodes array validated ─────────────────────────────────────

test('Wave 6B BillingApiClient.getFiscalReadiness returns reasonCodes string array', async () => {
  const codes = ['FISCAL_PROFILE_MISSING', 'ISSUANCE_POINT_MISSING'];
  const client = makeClient(makeFetchThatReturns(makeReadiness({ reasonCodes: codes })));
  const result = await client.getFiscalReadiness({ billingCompanyId: 'co-1', environment: 'SANDBOX', secretReference: 'ref', correlationId: null });
  assert.deepEqual(result.reasonCodes, codes);
});

// ── Test 11: malformed reasonCodes rejected ──────────────────────────────────

test('Wave 6B BillingApiClient.getFiscalReadiness rejects reasonCodes containing non-strings', async () => {
  const client = makeClient(makeFetchThatReturns(makeReadiness({ reasonCodes: [123, 'OK'] })));
  await assert.rejects(
    () => client.getFiscalReadiness({ billingCompanyId: 'co-1', environment: 'SANDBOX', secretReference: 'ref', correlationId: null }),
    (err) => err instanceof BillingClientError && err.code === 'BILLING_MALFORMED_FISCAL_READINESS',
  );
});

// ── Test 12: warnings array validated ───────────────────────────────────────

test('Wave 6B BillingApiClient.getFiscalReadiness returns warnings string array', async () => {
  const warns = ['TAXPAYER_MOROSO'];
  const client = makeClient(makeFetchThatReturns(makeReadiness({ readyToIssue: true, reasonCodes: [], warnings: warns })));
  const result = await client.getFiscalReadiness({ billingCompanyId: 'co-1', environment: 'SANDBOX', secretReference: 'ref', correlationId: null });
  assert.deepEqual(result.warnings, warns);
});

// ── Test 13: malformed warnings rejected ────────────────────────────────────

test('Wave 6B BillingApiClient.getFiscalReadiness rejects warnings containing non-strings', async () => {
  const client = makeClient(makeFetchThatReturns(makeReadiness({ warnings: [null] })));
  await assert.rejects(
    () => client.getFiscalReadiness({ billingCompanyId: 'co-1', environment: 'SANDBOX', secretReference: 'ref', correlationId: null }),
    (err) => err instanceof BillingClientError && err.code === 'BILLING_MALFORMED_FISCAL_READINESS',
  );
});

// ── Test 14: checkedAt validated ─────────────────────────────────────────────

test('Wave 6B BillingApiClient.getFiscalReadiness returns valid checkedAt string', async () => {
  const client = makeClient(makeFetchThatReturns(makeReadiness({ checkedAt: '2026-09-29T10:00:00.000Z' })));
  const result = await client.getFiscalReadiness({ billingCompanyId: 'co-1', environment: 'SANDBOX', secretReference: 'ref', correlationId: null });
  assert.equal(result.checkedAt, '2026-09-29T10:00:00.000Z');
});

// ── Test 15: malformed checkedAt rejected ────────────────────────────────────

test('Wave 6B BillingApiClient.getFiscalReadiness rejects non-date checkedAt', async () => {
  const client = makeClient(makeFetchThatReturns(makeReadiness({ checkedAt: 'not-a-date' })));
  await assert.rejects(
    () => client.getFiscalReadiness({ billingCompanyId: 'co-1', environment: 'SANDBOX', secretReference: 'ref', correlationId: null }),
    (err) => err instanceof BillingClientError && err.code === 'BILLING_MALFORMED_FISCAL_READINESS',
  );
});

// ── Test 16: Billing errors sanitized ───────────────────────────────────────

test('Wave 6B BillingApiClient.getFiscalReadiness wraps HTTP errors as BillingClientError', async () => {
  const fetchImpl = makeFetchThatReturns({ code: 'BILLING_ERR', message: 'downstream error' }, 503);
  const client = makeClient(fetchImpl);
  await assert.rejects(
    () => client.getFiscalReadiness({ billingCompanyId: 'co-1', environment: 'SANDBOX', secretReference: 'ref', correlationId: null }),
    BillingClientError,
  );
});

// ── Test 17: API key never appears in thrown errors ──────────────────────────

test('Wave 6B BillingApiClient.getFiscalReadiness does not expose API key in thrown BillingClientError message', async () => {
  const secretApiKey = 'MY-SECRET-API-KEY';
  const fetchImpl = makeFetchThatReturns({ code: 'ERR', message: `key: ${secretApiKey}` }, 500);
  const client = makeClient(fetchImpl, secretApiKey);
  let caughtError;
  try {
    await client.getFiscalReadiness({ billingCompanyId: 'co-1', environment: 'SANDBOX', secretReference: 'ref', correlationId: null });
  } catch (err) {
    caughtError = err;
  }
  assert.ok(caughtError instanceof BillingClientError);
  assert.doesNotMatch(caughtError.message, /MY-SECRET-API-KEY/);
});

// ── Test 18: secretReference never appears in browser-facing errors ──────────

test('Wave 6B BillingApiClient.getFiscalReadiness does not expose secretReference in response output', async () => {
  // secretReference is passed to request() for credential resolution but not
  // forwarded to the browser — the URL and headers must not contain it.
  let capturedUrl;
  let capturedHeaders;
  const fetchImpl = async (url, options) => {
    capturedUrl = url;
    capturedHeaders = options.headers;
    return { ok: true, status: 200, text: async () => JSON.stringify(makeReadiness()) };
  };
  const client = makeClient(fetchImpl);
  await client.getFiscalReadiness({ billingCompanyId: 'co-1', environment: 'SANDBOX', secretReference: 'secret/path/to/cred', correlationId: null });
  assert.doesNotMatch(capturedUrl, /secret\/path\/to\/cred/);
  const headersStr = JSON.stringify(capturedHeaders);
  assert.doesNotMatch(headersStr, /secret\/path\/to\/cred/);
});
