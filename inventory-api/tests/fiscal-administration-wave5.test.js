'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { BillingApiClient, BillingClientError } = require('../src/services/billing-api-client.service');
const fiscalSettingsService = require('../src/services/fiscal-settings.service');
const {
  MAX_CERTIFICATE_BYTES,
  parseFiscalCertificateMultipartBuffer,
} = require('../src/middlewares/fiscal-certificate-upload');

const auth = { companyId: '77', role: 'admin' };
const config = {
  companyId: 77n,
  billingCompanyId: 'billing-company-77',
  billingTenantId: 'tenant-1',
  billingEnvironment: 'SANDBOX',
  billingCredentialSecretRef: 'managed:file:test-reference',
  enabled: true,
};

function connection(status = 'CONNECTED') {
  return {
    companyId: 'billing-company-77', environment: 'SANDBOX', status, usernameMasked: 'ha***@example.test',
    configuredAt: '2026-10-12T01:00:00.000Z', lastValidatedAt: '2026-10-12T01:05:00.000Z',
    lastSuccessfulAuthAt: status === 'CONNECTED' ? '2026-10-12T01:05:00.000Z' : null,
  };
}

function certificate(overrides = {}) {
  return {
    id: 'certificate-1', companyId: 'billing-company-77', environment: 'SANDBOX', status: 'ACTIVE',
    fingerprintSha256: 'a'.repeat(64), serialNumber: '01AB', subjectName: 'CN=Inventori SA',
    issuerName: 'CN=Test CA', validFrom: '2026-01-01T00:00:00.000Z', validTo: '2026-10-25T00:00:00.000Z',
    extractedIdentityNumber: '3101999999', extractedIdentityType: 'JURIDICA',
    activeFrom: '2026-10-12T01:00:00.000Z', createdAt: '2026-10-12T01:00:00.000Z',
    updatedAt: '2026-10-12T01:00:00.000Z', ...overrides,
  };
}

function serviceOptions(billingClient, extra = {}) {
  return {
    billingClient,
    billingIntegrationConfigRepository: { async findByCompanyId(companyId) { assert.equal(companyId, 77n); return config; } },
    now: new Date('2026-10-12T00:00:00.000Z'),
    ...extra,
  };
}

async function multipartBody(entries) {
  const form = new globalThis.FormData();
  for (const [name, value, filename] of entries) {
    if (filename === undefined) form.append(name, value);
    else form.append(name, value, filename);
  }
  const request = new globalThis.Request('http://test.invalid', { method: 'POST', body: form });
  return {
    contentType: request.headers.get('content-type'),
    body: Buffer.from(await request.arrayBuffer()),
  };
}

test('bounded PKCS#12 parser accepts exactly one certificate and write-only PIN', async () => {
  const fixture = Buffer.from('synthetic-pkcs12-fixture');
  const { body, contentType } = await multipartBody([
    ['certificate', new globalThis.Blob([fixture], { type: 'application/x-pkcs12' }), 'synthetic.p12'],
    ['pin', 'synthetic-pin'],
  ]);
  const parsed = await parseFiscalCertificateMultipartBuffer(body, contentType);
  assert.deepEqual(parsed.certificateBytes, fixture);
  assert.equal(parsed.pin, 'synthetic-pin');
  parsed.certificateBytes.fill(0);
  body.fill(0);
});

test('PKCS#12 parser rejects oversized, duplicate and missing fields', async () => {
  const oversized = await multipartBody([
    ['certificate', new globalThis.Blob([Buffer.alloc(MAX_CERTIFICATE_BYTES + 1)]), 'large.p12'],
    ['pin', 'pin'],
  ]);
  await assert.rejects(
    () => parseFiscalCertificateMultipartBuffer(oversized.body, oversized.contentType),
    (error) => error.statusCode === 413 && error.code === 'FISCAL_CERTIFICATE_TOO_LARGE',
  );
  oversized.body.fill(0);

  const duplicate = await multipartBody([
    ['certificate', new globalThis.Blob(['a']), 'a.p12'], ['certificate', new globalThis.Blob(['b']), 'b.p12'], ['pin', 'pin'],
  ]);
  await assert.rejects(
    () => parseFiscalCertificateMultipartBuffer(duplicate.body, duplicate.contentType),
    (error) => error.code === 'FISCAL_CERTIFICATE_FILE_REQUIRED',
  );
  duplicate.body.fill(0);

  const missingPin = await multipartBody([['certificate', new globalThis.Blob(['a']), 'a.p12']]);
  await assert.rejects(
    () => parseFiscalCertificateMultipartBuffer(missingPin.body, missingPin.contentType),
    (error) => error.code === 'FISCAL_CERTIFICATE_PIN_REQUIRED',
  );
  missingPin.body.fill(0);
});

test('Billing client uses exact Wave 3 versioned paths and multipart semantics', async () => {
  const calls = [];
  const client = new BillingApiClient({
    baseUrl: 'https://billing.invalid',
    credentialResolver: { resolveApiKey() { return 'bk_synthetic'; } },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      const responseBody = url.endsWith('/certificate')
        ? certificate()
        : connection(url.endsWith('/disable') ? 'DISABLED' : (options.method === 'POST' ? 'CONNECTED' : 'PENDING_VALIDATION'));
      return new globalThis.Response(JSON.stringify(responseBody), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });

  await client.replaceHaciendaCredentialsV1({
    billingCompanyId: 'billing-company-77', environment: 'SANDBOX', username: 'synthetic-user',
    password: 'synthetic-password', secretReference: 'managed:file:test-reference', correlationId: 'wave5-contract',
  });
  await client.validateHaciendaConnectionV1({
    billingCompanyId: 'billing-company-77', environment: 'SANDBOX',
    secretReference: 'managed:file:test-reference', correlationId: 'wave5-contract',
  });
  await client.disableHaciendaConnectionV1({
    billingCompanyId: 'billing-company-77', environment: 'SANDBOX',
    secretReference: 'managed:file:test-reference', correlationId: 'wave5-contract',
  });
  const bytes = Buffer.from('synthetic-certificate');
  await client.writeSigningCertificate({
    billingCompanyId: 'billing-company-77', environment: 'SANDBOX', certificateBytes: bytes,
    pin: 'synthetic-pin', replace: true, secretReference: 'managed:file:test-reference', correlationId: 'wave5-contract',
  });

  assert.equal(calls[0].url, 'https://billing.invalid/api/v1/companies/billing-company-77/fiscal-onboarding/v1/SANDBOX/hacienda-connection');
  assert.equal(calls[0].options.method, 'PUT');
  assert.deepEqual(JSON.parse(calls[0].options.body), { username: 'synthetic-user', password: 'synthetic-password' });
  assert.match(calls[1].url, /\/hacienda-connection\/validate$/);
  assert.equal(calls[1].options.method, 'POST');
  assert.match(calls[2].url, /\/hacienda-connection\/disable$/);
  assert.equal(calls[2].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[2].options.body), {});
  assert.match(calls[3].url, /\/certificate$/);
  assert.equal(calls[3].options.method, 'PUT');
  assert.ok(calls[3].options.body instanceof globalThis.FormData);
  assert.equal(calls[3].options.headers['Content-Type'], undefined);
  assert.equal(calls[3].options.body.get('pin'), 'synthetic-pin');
  assert.equal(calls[3].options.body.get('certificate').name, 'certificate.p12');
});

test('Hacienda disable performs one mutation followed by canonical read-back and exposes no binding', async () => {
  const calls = [];
  const billingClient = {
    async disableHaciendaConnectionV1(args) { calls.push(['disable', args]); return connection('DISABLED'); },
    async getHaciendaConnectionV1(args) { calls.push(['read', args]); return connection('DISABLED'); },
  };
  const result = await fiscalSettingsService.disableHaciendaConnection(
    auth, { correlationId: 'wave5-disable' }, serviceOptions(billingClient),
  );
  assert.deepEqual(calls.map(([name]) => name), ['disable', 'read']);
  assert.equal(result.connection.status, 'DISABLED');
  assert.equal(result.connection.configured, true);
  assert.doesNotMatch(JSON.stringify(result), /billing-company-77|managed:file|secretReference|password|token/i);
});

test('security read-back returns only canonical safe metadata and authoritative expiry timestamps', async () => {
  const billingClient = {
    async getHaciendaConnectionV1(args) { assert.equal(args.billingCompanyId, config.billingCompanyId); return connection(); },
    async getSigningCertificateMetadata(args) { assert.equal(args.environment, 'SANDBOX'); return certificate(); },
  };
  const result = await fiscalSettingsService.getFiscalSecurityConfiguration(auth, {}, serviceOptions(billingClient));
  assert.equal(result.environment, 'SANDBOX');
  assert.equal(result.connection.configured, true);
  assert.equal(result.connection.usernameMasked, undefined);
  assert.equal(result.certificate.expiryState, 'EXPIRING_SOON');
  assert.equal(result.certificate.daysRemaining, 13);
  assert.doesNotMatch(JSON.stringify(result), /managed:file|billing-company-77|certificateSecretReference|passwordSecretReference|privateKey|synthetic-pin/i);
});

test('certificate replacement is canonical, zeroes request bytes and never exposes PIN', async () => {
  const calls = [];
  const billingClient = {
    async writeSigningCertificate(args) { calls.push(['write', args.replace, Buffer.from(args.certificateBytes)]); return certificate({ status: 'INACTIVE' }); },
    async getSigningCertificateMetadata() { calls.push(['read']); return certificate(); },
  };
  const bytes = Buffer.from('sensitive-synthetic-bytes');
  const result = await fiscalSettingsService.writeFiscalCertificate(
    auth, { certificateBytes: bytes, pin: 'one-time-pin' }, true, { correlationId: 'wave5-replace' }, serviceOptions(billingClient),
  );
  assert.deepEqual(calls.map(([name]) => name), ['write', 'read']);
  assert.equal(calls[0][1], true);
  assert.ok(bytes.every((value) => value === 0));
  assert.equal(result.certificate.status, 'ACTIVE');
  assert.doesNotMatch(JSON.stringify(result), /one-time-pin|sensitive-synthetic-bytes|managed:file/i);
});

test('failed certificate replacement is not retried, redacts secrets and zeroes bytes', async () => {
  let writes = 0;
  const pin = 'pin-that-must-not-leak';
  const billingClient = {
    async writeSigningCertificate() {
      writes += 1;
      throw new BillingClientError(`SecretProvider rejected ${pin} managed:file:test-reference`, {
        code: 'FISCAL_SIGNING_CERTIFICATE_SECRET_UNAVAILABLE', statusCode: 503, retryable: true,
      });
    },
  };
  const bytes = Buffer.from('failure-fixture');
  await assert.rejects(
    () => fiscalSettingsService.writeFiscalCertificate(auth, { certificateBytes: bytes, pin }, true, {}, serviceOptions(billingClient)),
    (error) => error.statusCode === 503
      && !error.message.includes(pin)
      && !error.message.includes('managed:file:test-reference'),
  );
  assert.equal(writes, 1);
  assert.ok(bytes.every((value) => value === 0));
});

test('credential replacement validates once, reads canonical state and redacts submitted values on failure', async () => {
  const calls = [];
  const billingClient = {
    async replaceHaciendaCredentialsV1(args) { calls.push(['replace', args.username]); return connection('PENDING_VALIDATION'); },
    async validateHaciendaConnectionV1() { calls.push(['validate']); return connection('CONNECTED'); },
    async getHaciendaConnectionV1() { calls.push(['read']); return connection('CONNECTED'); },
  };
  const result = await fiscalSettingsService.configureHaciendaCredentials(
    auth, { username: 'synthetic-user', password: 'synthetic-password' }, {}, serviceOptions(billingClient),
  );
  assert.deepEqual(calls.map(([name]) => name), ['replace', 'validate', 'read']);
  assert.equal(result.connection.status, 'CONNECTED');
  assert.doesNotMatch(JSON.stringify(result), /synthetic-password|managed:file/i);

  const failedClient = {
    async replaceHaciendaCredentialsV1() {
      throw new BillingClientError('synthetic-user synthetic-password managed:file:test-reference', {
        code: 'HACIENDA_INVALID_CREDENTIALS', statusCode: 422, retryable: false,
      });
    },
  };
  await assert.rejects(
    () => fiscalSettingsService.configureHaciendaCredentials(
      auth, { username: 'synthetic-user', password: 'synthetic-password' }, {}, serviceOptions(failedClient),
    ),
    (error) => !/synthetic-user|synthetic-password|managed:file/.test(error.message),
  );
});
