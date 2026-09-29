'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const {
  BillingApiClient,
  BillingClientError,
} = require('../src/services/billing-api-client.service');
const { createBillingCredentialResolver } = require('../src/services/billing-credential-resolver.service');

const SECRET_REFERENCE = 'env:BILLING_TEST_KEY';
const FAKE_API_KEY = 'fake-billing-api-key-do-not-leak';
const BILLING_COMPANY_ID = 'billing-company-1';
const CORRELATION_ID = 'corr-wave-1';

function buildActivity(overrides = {}) {
  return {
    id: 'activity-id-1',
    code: '620200',
    description: 'Consultoría informática',
    haciendaStatus: 'A',
    haciendaKind: 'PRIMARY',
    billingEnabled: true,
    verifiedAt: '2026-09-27T10:00:00.000Z',
    lastSeenAt: '2026-09-27T10:00:00.000Z',
    verificationSource: 'HACIENDA',
    ...overrides,
  };
}

function buildStatus(overrides = {}) {
  return {
    companyId: BILLING_COMPANY_ID,
    haciendaVerificationStatus: 'VERIFIED',
    haciendaVerifiedAt: '2026-09-27T10:00:00.000Z',
    haciendaTaxSituation: 'AL_DIA',
    moroso: false,
    omiso: false,
    defaultEconomicActivityId: 'activity-id-1',
    activities: [buildActivity()],
    ...overrides,
  };
}

function buildVerifyResponse(overrides = {}) {
  return {
    companyId: BILLING_COMPANY_ID,
    haciendaName: 'EMPRESA DEMO SOCIEDAD ANONIMA',
    haciendaVerificationStatus: 'VERIFIED',
    haciendaVerifiedAt: '2026-09-27T10:00:00.000Z',
    haciendaTaxSituation: 'AL_DIA',
    moroso: false,
    omiso: false,
    autoSelectedDefaultActivityId: null,
    activities: [buildActivity()],
    ...overrides,
  };
}

function buildSetDefaultResponse(overrides = {}) {
  return {
    companyId: BILLING_COMPANY_ID,
    defaultEconomicActivityId: 'activity-id-1',
    code: '620200',
    ...overrides,
  };
}

function jsonResponse(body, options = {}) {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    text: async () => JSON.stringify(body),
  };
}

function createClientWithFetch(responseFactory) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return responseFactory({ url, options, callIndex: calls.length - 1 });
  };
  const client = new BillingApiClient({
    baseUrl: 'https://billing.example.test',
    credentialResolver: createBillingCredentialResolver({ BILLING_TEST_KEY: FAKE_API_KEY }),
    fetchImpl,
    timeoutMs: 1000,
  });
  return { client, calls };
}

function assertSingleRequest(calls, { method, path, body }) {
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `https://billing.example.test${path}`);
  assert.equal(calls[0].options.method, method);
  assert.equal(calls[0].options.headers['X-API-Key'], FAKE_API_KEY);
  assert.equal(calls[0].options.headers['X-Correlation-Id'], CORRELATION_ID);
  assert.equal(calls[0].options.headers.Authorization, undefined);
  if (body === undefined) {
    assert.equal(calls[0].options.body, undefined);
    return;
  }
  assert.deepEqual(JSON.parse(calls[0].options.body), body);
}

async function assertBillingErrorCode(methodUnderTest, responseBody, expectedCode) {
  const { client } = createClientWithFetch(() => jsonResponse(responseBody, { ok: false, status: 404 }));
  await assert.rejects(
    () => methodUnderTest(client),
    (error) => error instanceof BillingClientError && error.code === expectedCode,
  );
}

describe('BillingApiClient fiscal-onboarding Wave 1 adapter', () => {
  test('getFiscalOnboardingStatus sends read request and validates response', async () => {
    const { client, calls } = createClientWithFetch(() => jsonResponse(buildStatus()));

    const response = await client.getFiscalOnboardingStatus({
      billingCompanyId: BILLING_COMPANY_ID,
      secretReference: SECRET_REFERENCE,
      correlationId: CORRELATION_ID,
    });

    assert.equal(response.companyId, BILLING_COMPANY_ID);
    assert.equal(response.activities[0].code, '620200');
    assertSingleRequest(calls, {
      method: 'GET',
      path: `/api/v1/companies/${BILLING_COMPANY_ID}/fiscal-onboarding/status`,
    });
  });

  test('getFiscalOnboardingActivities sends read request and validates response', async () => {
    const { client, calls } = createClientWithFetch(() => jsonResponse([buildActivity()]));

    const response = await client.getFiscalOnboardingActivities({
      billingCompanyId: BILLING_COMPANY_ID,
      secretReference: SECRET_REFERENCE,
      correlationId: CORRELATION_ID,
    });

    assert.equal(response[0].id, 'activity-id-1');
    assertSingleRequest(calls, {
      method: 'GET',
      path: `/api/v1/companies/${BILLING_COMPANY_ID}/fiscal-onboarding/activities`,
    });
  });

  test('verifyFiscalOnboarding sends POST with no taxpayer identity and no body', async () => {
    const { client, calls } = createClientWithFetch(() => jsonResponse(buildVerifyResponse()));

    const response = await client.verifyFiscalOnboarding({
      billingCompanyId: BILLING_COMPANY_ID,
      secretReference: SECRET_REFERENCE,
      correlationId: CORRELATION_ID,
    });

    assert.equal(response.haciendaVerificationStatus, 'VERIFIED');
    assertSingleRequest(calls, {
      method: 'POST',
      path: `/api/v1/companies/${BILLING_COMPANY_ID}/fiscal-onboarding/verify`,
    });
  });

  test('updateFiscalOnboardingActivity enables an encoded activity code', async () => {
    const { client, calls } = createClientWithFetch(() => jsonResponse(buildActivity({ billingEnabled: true })));

    const response = await client.updateFiscalOnboardingActivity({
      billingCompanyId: BILLING_COMPANY_ID,
      code: '6202/00 + services',
      billingEnabled: true,
      secretReference: SECRET_REFERENCE,
      correlationId: CORRELATION_ID,
    });

    assert.equal(response.billingEnabled, true);
    assertSingleRequest(calls, {
      method: 'PATCH',
      path: `/api/v1/companies/${BILLING_COMPANY_ID}/fiscal-onboarding/activities/6202%2F00%20%2B%20services`,
      body: { billingEnabled: true },
    });
  });

  test('updateFiscalOnboardingActivity disables an activity', async () => {
    const { client, calls } = createClientWithFetch(() => jsonResponse(buildActivity({ billingEnabled: false })));

    const response = await client.updateFiscalOnboardingActivity({
      billingCompanyId: BILLING_COMPANY_ID,
      code: '620200',
      billingEnabled: false,
      secretReference: SECRET_REFERENCE,
      correlationId: CORRELATION_ID,
    });

    assert.equal(response.billingEnabled, false);
    assertSingleRequest(calls, {
      method: 'PATCH',
      path: `/api/v1/companies/${BILLING_COMPANY_ID}/fiscal-onboarding/activities/620200`,
      body: { billingEnabled: false },
    });
  });

  test('setDefaultFiscalOnboardingActivity sends activity code, not activity id', async () => {
    const { client, calls } = createClientWithFetch(() => jsonResponse(buildSetDefaultResponse()));

    const response = await client.setDefaultFiscalOnboardingActivity({
      billingCompanyId: BILLING_COMPANY_ID,
      code: '620200',
      secretReference: SECRET_REFERENCE,
      correlationId: CORRELATION_ID,
    });

    assert.equal(response.defaultEconomicActivityId, 'activity-id-1');
    assertSingleRequest(calls, {
      method: 'PUT',
      path: `/api/v1/companies/${BILLING_COMPANY_ID}/fiscal-onboarding/default-activity`,
      body: { code: '620200' },
    });
  });

  test('propagates COMPANY_NOT_FOUND through existing error normalization', async () => {
    await assertBillingErrorCode(
      (client) => client.getFiscalOnboardingStatus({
        billingCompanyId: BILLING_COMPANY_ID,
        secretReference: SECRET_REFERENCE,
      }),
      { error: { code: 'COMPANY_NOT_FOUND', message: 'Company not found' } },
      'COMPANY_NOT_FOUND',
    );
  });

  test('propagates ECONOMIC_ACTIVITY_NOT_FOUND through existing error normalization', async () => {
    await assertBillingErrorCode(
      (client) => client.updateFiscalOnboardingActivity({
        billingCompanyId: BILLING_COMPANY_ID,
        code: '999999',
        billingEnabled: true,
        secretReference: SECRET_REFERENCE,
      }),
      { error: { code: 'ECONOMIC_ACTIVITY_NOT_FOUND', message: 'Not found' } },
      'ECONOMIC_ACTIVITY_NOT_FOUND',
    );
  });

  test('propagates DEFAULT_ACTIVITY_INVALID through existing error normalization', async () => {
    await assertBillingErrorCode(
      (client) => client.setDefaultFiscalOnboardingActivity({
        billingCompanyId: BILLING_COMPANY_ID,
        code: '620200',
        secretReference: SECRET_REFERENCE,
      }),
      { error: { code: 'DEFAULT_ACTIVITY_INVALID', message: 'Invalid default' } },
      'DEFAULT_ACTIVITY_INVALID',
    );
  });

  test('normalizes auth and throttle Billing errors', async () => {
    const cases = ['API_KEY_INVALID', 'INSUFFICIENT_SCOPE', 'TOO_MANY_REQUESTS'];
    for (const code of cases) {
      await assertBillingErrorCode(
        (client) => client.getFiscalOnboardingActivities({
          billingCompanyId: BILLING_COMPANY_ID,
          secretReference: SECRET_REFERENCE,
        }),
        { error: { code, message: `${code} message` } },
        code,
      );
    }
  });

  test('malformed status response fails safely', async () => {
    const { client } = createClientWithFetch(() => jsonResponse({ companyId: BILLING_COMPANY_ID }));

    await assert.rejects(
      () => client.getFiscalOnboardingStatus({ billingCompanyId: BILLING_COMPANY_ID, secretReference: SECRET_REFERENCE }),
      /malformed fiscal onboarding status/,
    );
  });

  test('malformed activities response fails safely', async () => {
    const { client } = createClientWithFetch(() => jsonResponse([{ id: 'missing-required-fields' }]));

    await assert.rejects(
      () => client.getFiscalOnboardingActivities({
        billingCompanyId: BILLING_COMPANY_ID,
        secretReference: SECRET_REFERENCE,
      }),
      /malformed fiscal onboarding activity/,
    );
  });

  test('malformed verify response fails safely', async () => {
    const { client } = createClientWithFetch(() => jsonResponse({ activities: [buildActivity()] }));

    await assert.rejects(
      () => client.verifyFiscalOnboarding({ billingCompanyId: BILLING_COMPANY_ID, secretReference: SECRET_REFERENCE }),
      /malformed fiscal onboarding verification/,
    );
  });

  test('malformed set-default response fails safely', async () => {
    const { client } = createClientWithFetch(() => jsonResponse({ companyId: BILLING_COMPANY_ID }));

    await assert.rejects(
      () => client.setDefaultFiscalOnboardingActivity({
        billingCompanyId: BILLING_COMPANY_ID,
        code: '620200',
        secretReference: SECRET_REFERENCE,
      }),
      /malformed fiscal onboarding default activity response/,
    );
  });

  test('raw API key is not present in thrown error representation', async () => {
    const { client } = createClientWithFetch(() => jsonResponse({
      error: {
        code: 'API_KEY_INVALID',
        message: `Invalid key ${FAKE_API_KEY}`,
      },
    }, { ok: false, status: 401 }));

    await assert.rejects(
      () => client.getFiscalOnboardingStatus({ billingCompanyId: BILLING_COMPANY_ID, secretReference: SECRET_REFERENCE }),
      (error) => {
        const serialized = JSON.stringify(error);
        return error instanceof BillingClientError && !serialized.includes(FAKE_API_KEY);
      },
    );
  });

  test('existing Billing fiscal document method remains unchanged', async () => {
    const { client, calls } = createClientWithFetch(() => jsonResponse({ id: 'doc-1' }));

    await client.createFiscalDocument({
      billingCompanyId: BILLING_COMPANY_ID,
      environment: 'SANDBOX',
      idempotencyKey: 'idem-1',
      secretReference: SECRET_REFERENCE,
      correlationId: CORRELATION_ID,
      payload: { document: 'payload' },
    });

    assertSingleRequest(calls, {
      method: 'POST',
      path: `/api/v1/companies/${BILLING_COMPANY_ID}/fiscal-documents/SANDBOX/invoices`,
      body: { document: 'payload' },
    });
    assert.equal(calls[0].options.headers['Idempotency-Key'], 'idem-1');
  });

  test('tests use mocked HTTP only and do not contact real Billing or Hacienda', async () => {
    const { client, calls } = createClientWithFetch(() => jsonResponse(buildStatus()));

    await client.getFiscalOnboardingStatus({
      billingCompanyId: BILLING_COMPANY_ID,
      secretReference: SECRET_REFERENCE,
    });

    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /^https:\/\/billing\.example\.test\//);
  });
});
