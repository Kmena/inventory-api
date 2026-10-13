'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const fiscalSettingsService = require('../src/services/fiscal-settings.service');
const { BillingApiClient } = require('../src/services/billing-api-client.service');
const { haciendaCredentialsSchema } = require('../src/schemas/fiscal-settings.schema');

const auth = { companyId: '100', userId: '7' };
const config = {
  enabled: true,
  billingCompanyId: 'billing-company-a',
  billingEnvironment: 'SANDBOX',
  billingCredentialSecretRef: 'env:BILLING_SANDBOX_M2M_API_KEY',
};
const repo = { findByCompanyId: async () => config };

test('hacienda credentials DTO requires username/password and rejects browser overrides', () => {
  assert.equal(haciendaCredentialsSchema.safeParse({ username: ' u ', password: 'p# = $' }).success, true);
  assert.equal(haciendaCredentialsSchema.safeParse({ username: '', password: 'p' }).success, false);
  assert.equal(haciendaCredentialsSchema.safeParse({ username: 'u', password: '' }).success, false);
  assert.equal(haciendaCredentialsSchema.safeParse({ username: 'u', password: 'p', companyId: 'evil' }).success, false);
  assert.equal(haciendaCredentialsSchema.safeParse({ username: 'u', password: 'p', billingCompanyId: 'evil' }).success, false);
  assert.equal(haciendaCredentialsSchema.safeParse({ username: 'u', password: 'p', tenantId: 'evil' }).success, false);
  assert.equal(haciendaCredentialsSchema.safeParse({ username: 'u', password: 'p', secretReference: 'evil' }).success, false);
  assert.equal(haciendaCredentialsSchema.safeParse({ username: 'u', password: 'p', environment: 'PRODUCTION' }).success, false);
  assert.equal(haciendaCredentialsSchema.safeParse({ username: 'bad\n', password: 'p' }).success, false);
  assert.equal(haciendaCredentialsSchema.safeParse({ username: 'u', password: 'bad\n' }).success, false);
});

test('configureHaciendaCredentials derives company mapping and returns safe validation metadata only', async () => {
  const calls = [];
  const billingClient = {
    configureHaciendaCredentials: async (payload) => { calls.push(['put', payload]); return { companyId: payload.billingCompanyId, environment: payload.environment, status: 'CONFIGURED' }; },
    validateHaciendaCredentials: async (payload) => { calls.push(['post', payload]); return { companyId: payload.billingCompanyId, environment: payload.environment, status: 'CONNECTED', lastValidatedAt: '2026-01-01T00:00:00.000Z' }; },
  };

  const result = await fiscalSettingsService.configureHaciendaCredentials(
    auth,
    { username: 'cpf-user', password: 'secret#= $' },
    { correlationId: 'corr-1' },
    { billingIntegrationConfigRepository: repo, billingClient },
  );

  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], 'put');
  assert.equal(calls[0][1].billingCompanyId, 'billing-company-a');
  assert.equal(calls[0][1].environment, 'SANDBOX');
  assert.equal(calls[0][1].secretReference, 'env:BILLING_SANDBOX_M2M_API_KEY');
  assert.equal(calls[0][1].username, 'cpf-user');
  assert.equal(calls[0][1].password, 'secret#= $');
  assert.deepEqual(result, { connection: { environment: 'SANDBOX', status: 'CONNECTED', configured: true, lastValidatedAt: '2026-01-01T00:00:00.000Z', lastSuccessfulAuthAt: null, lastValidationErrorCode: null } });
  assert.equal(JSON.stringify(result).includes('secret#= $'), false);
  assert.equal(JSON.stringify(result).includes('cpf-user'), false);
  assert.equal(JSON.stringify(result).includes('env:BILLING'), false);
});

test('validateHaciendaCredentials uses server-side Billing company and secret reference only', async () => {
  let observed;
  const billingClient = {
    validateHaciendaCredentials: async (payload) => { observed = payload; return { companyId: payload.billingCompanyId, environment: payload.environment, status: 'INVALID_CREDENTIALS', lastValidationErrorCode: 'INVALID_CREDENTIALS' }; },
  };
  const result = await fiscalSettingsService.validateHaciendaCredentials(auth, {}, { billingIntegrationConfigRepository: repo, billingClient });
  assert.equal(observed.billingCompanyId, 'billing-company-a');
  assert.equal(observed.environment, 'SANDBOX');
  assert.equal(observed.secretReference, 'env:BILLING_SANDBOX_M2M_API_KEY');
  assert.equal(result.connection.status, 'INVALID_CREDENTIALS');
});

test('BillingApiClient uses focused M2M Hacienda credential endpoints with X-API-Key', async () => {
  const requests = [];
  const client = new BillingApiClient({
    baseUrl: 'http://billing.test',
    credentialResolver: { resolveApiKey: () => 'server-side-key' },
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, text: async () => JSON.stringify({ companyId: 'billing-company-a', environment: 'SANDBOX', status: 'CONNECTED' }) };
    },
  });
  await client.configureHaciendaCredentials({ billingCompanyId: 'billing-company-a', environment: 'SANDBOX', username: 'u', password: 'p', secretReference: 'env:X', correlationId: 'c' });
  await client.validateHaciendaCredentials({ billingCompanyId: 'billing-company-a', environment: 'SANDBOX', secretReference: 'env:X', correlationId: 'c' });
  assert.equal(requests[0].options.method, 'PUT');
  assert.match(requests[0].url, /\/api\/v1\/companies\/billing-company-a\/fiscal-onboarding\/SANDBOX\/hacienda-credentials$/);
  assert.equal(requests[1].options.method, 'POST');
  assert.match(requests[1].url, /\/api\/v1\/companies\/billing-company-a\/fiscal-onboarding\/SANDBOX\/hacienda-credentials\/validate$/);
  assert.equal(requests[0].options.headers['X-API-Key'], 'server-side-key');
  assert.equal(JSON.stringify(requests).includes('server-side-key'), true);
});
