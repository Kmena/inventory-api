'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const fiscalSettingsService = require('../src/services/fiscal-settings.service');
const { BillingManagedCredentialStore } = require('../src/services/billing-managed-credential-store.service');

const auth = { companyId: '77', role: 'admin' };
const localCompany = {
  id: 77n,
  fiscalConfig: {
    legalName: 'Inventori Sociedad Anonima',
    commercialName: 'Inventori',
    identificationType: '02',
    identificationNumber: '3101999999',
    haciendaEnvironment: 'STAGING',
  },
};

function canonicalIssuer(tenantId = 'tenant-1') {
  return {
    associationId: 'association-1',
    externalCompanyKey: 'inventori:company:77',
    profileVersion: 'inventori-fiscal-v1',
    company: {
      id: 'billing-company-1',
      tenantId,
      legalName: 'Inventori Sociedad Anonima',
      tradeName: 'Inventori',
      identificationType: 'JURIDICA',
      identificationNumber: '3101999999',
      status: 'ACTIVE',
      updatedAt: '2026-10-11T00:00:00.000Z',
    },
  };
}

function profile() {
  return {
    id: 'profile-1', companyId: 'billing-company-1', economicActivityCode: '620100',
    province: '1', canton: '01', district: '01', otrasSenas: 'San Jose',
    email: 'fiscal@example.test', phoneCountryCode: '506', phoneNumber: '22000000',
  };
}

function dependencies() {
  let config = null;
  const calls = [];
  const repository = {
    async findByCompanyId() { return config; },
    async upsertForCompany(companyId, value) {
      calls.push(['upsert', companyId, value]);
      config = { companyId, ...value, updatedAt: '2026-10-11T00:00:00.000Z' };
      return config;
    },
  };
  const billingClient = {
    async bootstrapFiscalIssuer(args) {
      calls.push(['bootstrap', args]);
      return {
        association: canonicalIssuer(),
        credential: {
          apiKeyId: 'key-1', keyPrefix: 'bk_test_', secret: 'bk_test_returned_once',
          profileVersion: 'inventori-fiscal-v1', environment: 'TEST', returnedOnce: true,
        },
      };
    },
    async getFiscalIssuerV1(args) { calls.push(['issuer', args]); return canonicalIssuer(); },
    async getFiscalProfileV1(args) { calls.push(['profile', args]); return profile(); },
  };
  const credentialStore = {
    store(secret) { calls.push(['store', secret]); return 'managed:file:11111111-1111-4111-8111-111111111111'; },
    remove(reference) { calls.push(['remove', reference]); },
  };
  return {
    calls,
    options: {
      billingIntegrationConfigRepository: repository,
      billingClient,
      credentialStore,
      bootstrapSecretReference: 'env:BILLING_BOOTSTRAP_API_KEY',
      prisma: { company: { async findUnique() { return localCompany; } } },
    },
  };
}

test('provisions once, persists only a managed reference and returns canonical data without secrets', async () => {
  const deps = dependencies();
  const first = await fiscalSettingsService.provisionFiscalAdministration(auth, { correlationId: 'wave4-1' }, deps.options);
  const second = await fiscalSettingsService.provisionFiscalAdministration(auth, { correlationId: 'wave4-2' }, deps.options);

  assert.equal(deps.calls.filter(([name]) => name === 'bootstrap').length, 1);
  assert.equal(deps.calls.filter(([name]) => name === 'store').length, 1);
  const upsert = deps.calls.find(([name]) => name === 'upsert')[2];
  assert.equal(upsert.billingCredentialSecretRef, 'managed:file:11111111-1111-4111-8111-111111111111');
  assert.equal(upsert.billingTenantId, 'tenant-1');
  assert.equal(upsert.billingCompanyId, 'billing-company-1');
  assert.equal(first.association.status, 'ASSOCIATED');
  assert.equal(first.issuer.identityLockPolicy, 'BILLING_ENFORCED');
  assert.equal(second.profile.economicActivityCode, '620100');
  assert.doesNotMatch(JSON.stringify(first), /bk_test_|credential|billing-company-1|tenant-1/i);
});

test('normalizes the formatted company fiscal identity before Billing bootstrap', async () => {
  const deps = dependencies();
  deps.options.prisma.company.findUnique = async () => ({
    ...localCompany,
    fiscalConfig: {
      ...localCompany.fiscalConfig,
      identificationNumber: '3-101-000000',
    },
  });

  await fiscalSettingsService.provisionFiscalAdministration(auth, {}, deps.options);

  const bootstrap = deps.calls.find(([name]) => name === 'bootstrap')[1];
  assert.equal(bootstrap.payload.identificationType, 'JURIDICA');
  assert.equal(bootstrap.payload.identificationNumber, '3101000000');
});

test('rejects malformed local fiscal identities before contacting Billing', async () => {
  const deps = dependencies();
  deps.options.prisma.company.findUnique = async () => ({
    ...localCompany,
    fiscalConfig: {
      ...localCompany.fiscalConfig,
      identificationNumber: 'juridica-demo',
    },
  });

  await assert.rejects(
    () => fiscalSettingsService.provisionFiscalAdministration(auth, {}, deps.options),
    (error) => error.code === 'FISCAL_IDENTIFICATION_INVALID' && error.statusCode === 409,
  );
  assert.equal(deps.calls.some(([name]) => name === 'bootstrap'), false);
});

test('rejects a canonical read-back that crosses the persisted tenant binding', async () => {
  const deps = dependencies();
  await fiscalSettingsService.provisionFiscalAdministration(auth, {}, deps.options);
  deps.options.billingClient.getFiscalIssuerV1 = async () => canonicalIssuer('tenant-other');

  await assert.rejects(
    () => fiscalSettingsService.getFiscalAdministration(auth, {}, deps.options),
    (error) => error.code === 'BILLING_ASSOCIATION_MISMATCH' && error.statusCode === 409,
  );
});

test('returns a safe historical-only association without calling Billing or offering reactivation data', async () => {
  let billingCalls = 0;
  const result = await fiscalSettingsService.getFiscalAdministration(auth, {}, {
    billingIntegrationConfigRepository: {
      async findByCompanyId() {
        return {
          companyId: 77n,
          enabled: false,
          associationStatus: 'HISTORICAL_ONLY',
          billingEnvironment: 'SANDBOX',
          updatedAt: '2026-10-13T00:00:00.000Z',
        };
      },
    },
    billingClient: {
      async getFiscalIssuerV1() { billingCalls += 1; throw new Error('not expected'); },
    },
    prisma: { company: { async findUnique() { return localCompany; } } },
  });

  assert.equal(result.association.status, 'HISTORICAL_ONLY');
  assert.equal(result.association.enabled, false);
  assert.equal(result.association.environment, 'SANDBOX');
  assert.equal(result.issuer, null);
  assert.equal(billingCalls, 0);
  assert.doesNotMatch(JSON.stringify(result), /billingCompanyId|billingTenantId|credential/i);
});

test('managed credential storage encrypts the returned-once handoff and detects tampering', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'inventori-wave4-'));
  const store = new BillingManagedCredentialStore({ directory, masterKey: crypto.randomBytes(32) });
  try {
    const reference = store.store('bk_test_disposable_secret');
    const file = path.join(directory, `${reference.slice('managed:file:'.length)}.json`);
    assert.equal(store.resolve(reference), 'bk_test_disposable_secret');
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /bk_test_disposable_secret/);
    const document = JSON.parse(fs.readFileSync(file, 'utf8'));
    document.ciphertext = Buffer.from('tampered').toString('base64');
    fs.writeFileSync(file, JSON.stringify(document));
    assert.throws(() => store.resolve(reference));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
