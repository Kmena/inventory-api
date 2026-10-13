'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { BillingClientError } = require('../src/services/billing-api-client.service');
const fiscalSettingsService = require('../src/services/fiscal-settings.service');

const activeDefaultStatus = Object.freeze({
  companyId: 'billing-company-1',
  haciendaVerificationStatus: 'VERIFIED',
  haciendaVerifiedAt: '2026-09-28T00:00:00.000Z',
  haciendaTaxSituation: 'AL_DIA',
  moroso: false,
  omiso: false,
  defaultEconomicActivityId: 'activity-1',
  activities: [
    {
      id: 'activity-1',
      code: '620100',
      description: 'Software',
      haciendaStatus: 'A',
      haciendaKind: 'PRINCIPAL',
      billingEnabled: true,
      verifiedAt: '2026-09-28T00:00:00.000Z',
      lastSeenAt: '2026-09-28T00:00:00.000Z',
      verificationSource: 'HACIENDA',
    },
    {
      id: 'activity-2',
      code: '631100',
      description: 'Data',
      haciendaStatus: 'A',
      haciendaKind: null,
      billingEnabled: true,
      verifiedAt: '2026-09-28T00:00:00.000Z',
      lastSeenAt: '2026-09-28T00:00:00.000Z',
      verificationSource: 'HACIENDA',
    },
  ],
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildConfig(overrides = {}) {
  return {
    companyId: 77n,
    billingTenantId: 'tenant-1',
    billingCompanyId: 'billing-company-1',
    billingEnvironment: 'SANDBOX',
    billingCredentialSecretRef: 'env:BILLING_TEST_API_KEY',
    enabled: true,
    ...overrides,
  };
}

function buildRepository(config = buildConfig()) {
  return {
    calls: [],
    async findByCompanyId(companyId) {
      this.calls.push(companyId);
      return config;
    },
  };
}

function buildBillingClient(status = clone(activeDefaultStatus)) {
  return {
    calls: [],
    async getFiscalOnboardingStatus(args) {
      this.calls.push(['getFiscalOnboardingStatus', args]);
      return clone(status);
    },
    async verifyFiscalOnboarding(args) {
      this.calls.push(['verifyFiscalOnboarding', args]);
      return {
        companyId: args.billingCompanyId,
        haciendaVerificationStatus: 'VERIFIED',
        activities: clone(status.activities),
      };
    },
    async updateFiscalOnboardingActivity(args) {
      this.calls.push(['updateFiscalOnboardingActivity', args]);
      return clone(status.activities[0]);
    },
    async setDefaultFiscalOnboardingActivity(args) {
      this.calls.push(['setDefaultFiscalOnboardingActivity', args]);
      return { companyId: args.billingCompanyId, defaultEconomicActivityId: 'activity-1', code: args.code };
    },
  };
}

function options({ config = buildConfig(), billingClient = buildBillingClient() } = {}) {
  return {
    billingClient,
    billingIntegrationConfigRepository: buildRepository(config),
  };
}

const auth = { companyId: '77', role: 'admin' };

test('getFiscalSettings maps Billing status to canonical Fiscal Settings DTO', async () => {
  const deps = options();
  const result = await fiscalSettingsService.getFiscalSettings(auth, { correlationId: 'corr-1' }, deps);

  assert.deepEqual(result.taxpayer, {
    verificationStatus: 'VERIFIED',
    verifiedAt: '2026-09-28T00:00:00.000Z',
    taxSituation: 'AL_DIA',
    moroso: false,
    omiso: false,
  });
  assert.equal(result.configuration.hasBillingIntegration, true);
  assert.equal(result.activities[0].code, '620100');
  assert.equal(result.activities[0].isDefault, true);
  assert.equal(result.defaultActivityCode, '620100');
  assert.equal(result.activities[0].id, undefined);
});

test('getFiscalSettings prefers granular v1 reads and never requires the legacy fiscal-onboarding scope', async () => {
  const calls = [];
  const billingClient = {
    async getFiscalOnboardingStatus() {
      throw new Error('legacy fiscal-onboarding/status must not be called');
    },
    async getFiscalProfileV1(args) {
      calls.push(['profile', args]);
      return { defaultEconomicActivityId: 'activity-1' };
    },
    async getFiscalOnboardingActivities(args) {
      calls.push(['activities', args]);
      return clone(activeDefaultStatus.activities);
    },
    async getFiscalReadinessV1(args) {
      calls.push(['readiness', args]);
      return {
        readyToIssue: true,
        dimensions: {
          issuer: { metadata: { verificationStatus: 'VERIFIED' } },
          activity: { metadata: { defaultActivityId: 'activity-1' } },
        },
      };
    },
  };

  const result = await fiscalSettingsService.getFiscalSettings(
    auth,
    { correlationId: 'corr-v1-scope' },
    options({ billingClient }),
  );

  assert.deepEqual(calls.map(([name]) => name).sort(), ['activities', 'profile', 'readiness']);
  assert.equal(calls.every(([, args]) => args.environment === 'SANDBOX'), true);
  assert.equal(calls.every(([, args]) => args.correlationId === 'corr-v1-scope'), true);
  assert.equal(result.defaultActivityCode, '620100');
  assert.equal(result.taxpayer.verificationStatus, 'VERIFIED');
});

test('default derivation handles no default and unresolved default ID without inventing a code', async () => {
  const noDefault = clone(activeDefaultStatus);
  noDefault.defaultEconomicActivityId = null;
  const noDefaultResult = fiscalSettingsService.mapFiscalSettingsFromStatus(noDefault);
  assert.equal(noDefaultResult.defaultActivityCode, null);
  assert.equal(noDefaultResult.activities.some((activity) => activity.isDefault), false);

  const unresolved = clone(activeDefaultStatus);
  unresolved.defaultEconomicActivityId = 'missing-activity-id';
  const unresolvedResult = fiscalSettingsService.mapFiscalSettingsFromStatus(unresolved);
  assert.equal(unresolvedResult.defaultActivityCode, null);
  assert.equal(unresolvedResult.activities.some((activity) => activity.isDefault), false);
});

test('disabled current default remains represented as default', async () => {
  const status = clone(activeDefaultStatus);
  status.activities[0].billingEnabled = false;
  const result = fiscalSettingsService.mapFiscalSettingsFromStatus(status);

  assert.equal(result.activities[0].billingEnabled, false);
  assert.equal(result.activities[0].isDefault, true);
  assert.equal(result.defaultActivityCode, '620100');
});

test('single enabled activity without explicit default does not trigger set-default', async () => {
  const status = clone(activeDefaultStatus);
  status.defaultEconomicActivityId = null;
  status.activities = [status.activities[0]];
  const billingClient = buildBillingClient(status);

  const result = await fiscalSettingsService.getFiscalSettings(auth, {}, options({ billingClient }));

  assert.equal(result.defaultActivityCode, null);
  assert.equal(result.activities[0].isDefault, false);
  assert.equal(billingClient.calls.some(([method]) => method === 'setDefaultFiscalOnboardingActivity'), false);
});

test('Billing upstream 401 does not invalidate browser session semantics', async () => {
  const secretReference = 'env:BILLING_TEST_API_KEY';
  const billingClient = {
    async getFiscalOnboardingStatus() {
      throw new BillingClientError('Billing API key rejected for env:BILLING_TEST_API_KEY', {
        code: 'BILLING_UNAUTHORIZED',
        statusCode: 401,
      });
    },
  };

  await assert.rejects(
    () => fiscalSettingsService.getFiscalSettings(
      auth,
      {},
      options({ config: buildConfig({ billingCredentialSecretRef: secretReference }), billingClient }),
    ),
    (error) => {
      assert.equal(error.statusCode, 502);
      assert.equal(error.code, 'BILLING_UNAUTHORIZED');
      assert.doesNotMatch(error.message, /BILLING_TEST_API_KEY/);
      return true;
    },
  );
});

test('Billing upstream 403 does not invalidate browser session semantics', async () => {
  const billingClient = {
    async getFiscalOnboardingStatus() {
      throw new BillingClientError('Missing fiscal-onboarding:read scope', {
        code: 'BILLING_FORBIDDEN',
        statusCode: 403,
      });
    },
  };

  await assert.rejects(
    () => fiscalSettingsService.getFiscalSettings(auth, {}, options({ billingClient })),
    (error) => {
      assert.equal(error.statusCode, 502);
      assert.equal(error.code, 'BILLING_FORBIDDEN');
      return true;
    },
  );
});

test('refresh calls verifyFiscalOnboarding and returns canonical refreshed state', async () => {
  const billingClient = buildBillingClient();
  const result = await fiscalSettingsService.refreshFiscalActivities(auth, { correlationId: 'refresh-1' }, options({ billingClient }));

  assert.equal(billingClient.calls[0][0], 'verifyFiscalOnboarding');
  assert.equal(billingClient.calls[1][0], 'getFiscalOnboardingStatus');
  assert.equal(result.defaultActivityCode, '620100');
});

test('enable and disable call updateFiscalOnboardingActivity without changing default automatically', async () => {
  const billingClient = buildBillingClient();

  await fiscalSettingsService.updateFiscalActivity(auth, '620100', true, {}, options({ billingClient }));
  await fiscalSettingsService.updateFiscalActivity(auth, '620100', false, {}, options({ billingClient }));

  const updateCalls = billingClient.calls.filter(([method]) => method === 'updateFiscalOnboardingActivity');
  assert.equal(updateCalls.length, 2);
  assert.equal(updateCalls[0][1].billingEnabled, true);
  assert.equal(updateCalls[1][1].billingEnabled, false);
  assert.equal(updateCalls.some(([, args]) => args.code === '620100'), true);
  assert.equal(billingClient.calls.some(([method]) => method === 'setDefaultFiscalOnboardingActivity'), false);
});

test('set-default uses activity code', async () => {
  const billingClient = buildBillingClient();

  await fiscalSettingsService.setDefaultFiscalActivity(auth, '620100', {}, options({ billingClient }));

  const call = billingClient.calls.find(([method]) => method === 'setDefaultFiscalOnboardingActivity');
  assert.equal(call[1].code, '620100');
  assert.equal(call[1].billingCompanyId, 'billing-company-1');
});

test('integration configuration failures fail safely', async () => {
  const cases = [
    [null, 'BILLING_INTEGRATION_MISSING'],
    [buildConfig({ enabled: false }), 'BILLING_INTEGRATION_DISABLED'],
    [buildConfig({ billingCompanyId: '' }), 'BILLING_COMPANY_ID_MISSING'],
    [buildConfig({ billingCredentialSecretRef: '' }), 'BILLING_CREDENTIAL_REFERENCE_MISSING'],
  ];

  for (const [config, expectedCode] of cases) {
    await assert.rejects(
      () => fiscalSettingsService.getFiscalSettings(auth, {}, options({ config })),
      (error) => {
        assert.equal(error.code, expectedCode);
        assert.doesNotMatch(`${error.message} ${error.code}`, /env:BILLING_TEST_API_KEY/);
        return true;
      },
    );
  }
});

test('Billing errors are normalized without exposing secret references', async () => {
  const billingClient = buildBillingClient();
  billingClient.getFiscalOnboardingStatus = async () => {
    throw new BillingClientError('Remote failure env:BILLING_TEST_API_KEY should stay sanitized by upstream client', {
      code: 'COMPANY_NOT_FOUND',
      statusCode: 404,
    });
  };

  await assert.rejects(
    () => fiscalSettingsService.getFiscalSettings(auth, {}, options({ billingClient })),
    (error) => {
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, 'COMPANY_NOT_FOUND');
      assert.match(error.message, /Remote failure/);
      assert.doesNotMatch(JSON.stringify(error), /env:BILLING_TEST_API_KEY|fake-api-key|sk_test_secret/);
      return true;
    },
  );
});
