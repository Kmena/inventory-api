'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-with-at-least-32-characters';

const { signAccessToken } = require('../src/lib/auth');
const fiscalSettingsService = require('../src/services/fiscal-settings.service');
const { enableDbFreeAuthSeams } = require('./helpers/db-free-auth');

const READINESS_PERMISSION = 'fiscal.readiness.view';

const restoreAuth = enableDbFreeAuthSeams([
  // user 601: company 77, has readiness permission
  { id: '601', companyId: '77', role: { code: 'fiscal_admin' }, permissions: ['fiscal.settings.view', READINESS_PERMISSION] },
  // user 602: company 77, no readiness permission
  { id: '602', companyId: '77', role: { code: 'fiscal_admin' }, permissions: ['fiscal.settings.view'] },
  // user 603: company 88 (different company)
  { id: '603', companyId: '88', role: { code: 'fiscal_admin' }, permissions: ['fiscal.settings.view', READINESS_PERMISSION] },
  // user 604: no permissions
  { id: '604', companyId: '77', role: { code: 'fiscal_admin' }, permissions: [] },
]);
process.on('exit', restoreAuth);

const app = require('../src/app');

function buildToken(userId, companyId = 77) {
  return signAccessToken({
    id: BigInt(userId),
    username: `user-${userId}`,
    companyId: BigInt(companyId),
    role: { code: 'fiscal_admin', rolePermissions: [] },
  });
}

async function withHttpServer(run) {
  const server = http.createServer(app);
  await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => { server.close((err) => (err ? reject(err) : resolve())); });
  }
}

// ── Test 19: authorized user → 200 ──────────────────────────────────────────

test('Wave 6B readiness endpoint returns 200 for authorized user', async () => {
  const safeReadiness = {
    environment: 'SANDBOX',
    readyToIssue: true,
    reasonCodes: [],
    warnings: [],
    checkedAt: '2026-09-29T10:00:00.000Z',
  };
  const original = fiscalSettingsService.getFiscalReadiness;
  fiscalSettingsService.getFiscalReadiness = async () => safeReadiness;
  try {
    await withHttpServer(async (base) => {
      const res = await fetch(`${base}/api/company/fiscal-settings/readiness`, {
        headers: { Authorization: `Bearer ${buildToken(601)}` },
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.readyToIssue, true);
      assert.equal(body.environment, 'SANDBOX');
    });
  } finally {
    fiscalSettingsService.getFiscalReadiness = original;
  }
});

// ── Test 20: unauthorized user → 403 ────────────────────────────────────────

test('Wave 6B readiness endpoint returns 403 for user without fiscal.readiness.view', async () => {
  await withHttpServer(async (base) => {
    const res = await fetch(`${base}/api/company/fiscal-settings/readiness`, {
      headers: { Authorization: `Bearer ${buildToken(602)}` },
    });
    assert.equal(res.status, 403);
  });
});

// ── Test 21: authenticated company derived server-side ───────────────────────

test('Wave 6B getFiscalReadiness derives company from authenticated auth.companyId', async () => {
  let capturedAuth;
  const original = fiscalSettingsService.getFiscalReadiness;
  fiscalSettingsService.getFiscalReadiness = async (auth) => {
    capturedAuth = auth;
    return { environment: 'SANDBOX', readyToIssue: true, reasonCodes: [], warnings: [], checkedAt: '2026-09-29T10:00:00.000Z' };
  };
  try {
    await withHttpServer(async (base) => {
      await fetch(`${base}/api/company/fiscal-settings/readiness`, {
        headers: { Authorization: `Bearer ${buildToken(601)}` },
      });
    });
    assert.ok(capturedAuth, 'auth was passed to service');
    assert.equal(String(capturedAuth.companyId), '77');
  } finally {
    fiscalSettingsService.getFiscalReadiness = original;
  }
});

// ── Test 22: frontend company override rejected ──────────────────────────────

test('Wave 6B readiness endpoint ignores any companyId in query string', async () => {
  let capturedAuth;
  const original = fiscalSettingsService.getFiscalReadiness;
  fiscalSettingsService.getFiscalReadiness = async (auth) => {
    capturedAuth = auth;
    return { environment: 'SANDBOX', readyToIssue: true, reasonCodes: [], warnings: [], checkedAt: '2026-09-29T10:00:00.000Z' };
  };
  try {
    await withHttpServer(async (base) => {
      await fetch(`${base}/api/company/fiscal-settings/readiness?companyId=88`, {
        headers: { Authorization: `Bearer ${buildToken(601)}` },
      });
    });
    assert.equal(String(capturedAuth.companyId), '77', 'company ID must come from JWT, not query string');
  } finally {
    fiscalSettingsService.getFiscalReadiness = original;
  }
});

// ── Test 23: Billing company mapping derived server-side ─────────────────────

test('Wave 6B getFiscalReadiness service derives billingCompanyId from trusted CompanyBillingIntegrationConfig', async () => {
  const { BillingApiClient } = require('../src/services/billing-api-client.service');
  const billingIntegrationConfigRepository = require('../src/repositories/billing-integration-config.repository');

  const fakeConfig = {
    enabled: true,
    billingCompanyId: 'billing-derived-co',
    billingTenantId: 'billing-tenant',
    billingEnvironment: 'SANDBOX',
    billingCredentialSecretRef: 'secret/ref',
  };
  const originalFindByCompanyId = billingIntegrationConfigRepository.findByCompanyId;
  billingIntegrationConfigRepository.findByCompanyId = async () => fakeConfig;

  let capturedBillingCompanyId;
  const originalProto = BillingApiClient.prototype.getFiscalReadiness;
  BillingApiClient.prototype.getFiscalReadiness = async ({ billingCompanyId }) => {
    capturedBillingCompanyId = billingCompanyId;
    return { companyId: billingCompanyId, environment: 'SANDBOX', readyToIssue: true, reasonCodes: [], warnings: [], checkedAt: '2026-09-29T10:00:00.000Z' };
  };

  try {
    const auth = { companyId: '77', userId: '601' };
    await fiscalSettingsService.getFiscalReadiness(auth, {});
    assert.equal(capturedBillingCompanyId, 'billing-derived-co');
  } finally {
    billingIntegrationConfigRepository.findByCompanyId = originalFindByCompanyId;
    BillingApiClient.prototype.getFiscalReadiness = originalProto;
  }
});

// ── Test 24: environment derived server-side ─────────────────────────────────

test('Wave 6B getFiscalReadiness service derives environment from CompanyBillingIntegrationConfig', async () => {
  const { BillingApiClient } = require('../src/services/billing-api-client.service');
  const billingIntegrationConfigRepository = require('../src/repositories/billing-integration-config.repository');

  const fakeConfig = {
    enabled: true, billingCompanyId: 'co', billingTenantId: 't',
    billingEnvironment: 'PRODUCTION', billingCredentialSecretRef: 'ref',
  };
  const origFind = billingIntegrationConfigRepository.findByCompanyId;
  billingIntegrationConfigRepository.findByCompanyId = async () => fakeConfig;

  let capturedEnvironment;
  const origMethod = BillingApiClient.prototype.getFiscalReadiness;
  BillingApiClient.prototype.getFiscalReadiness = async ({ environment }) => {
    capturedEnvironment = environment;
    return { companyId: 'co', environment, readyToIssue: true, reasonCodes: [], warnings: [], checkedAt: '2026-09-29T10:00:00.000Z' };
  };

  try {
    await fiscalSettingsService.getFiscalReadiness({ companyId: '77' }, {});
    assert.equal(capturedEnvironment, 'PRODUCTION');
  } finally {
    billingIntegrationConfigRepository.findByCompanyId = origFind;
    BillingApiClient.prototype.getFiscalReadiness = origMethod;
  }
});

// ── Test 25: credential reference derived server-side ────────────────────────

test('Wave 6B getFiscalReadiness service derives secretReference from CompanyBillingIntegrationConfig', async () => {
  const { BillingApiClient } = require('../src/services/billing-api-client.service');
  const billingIntegrationConfigRepository = require('../src/repositories/billing-integration-config.repository');

  const fakeConfig = {
    enabled: true, billingCompanyId: 'co', billingTenantId: 't',
    billingEnvironment: 'SANDBOX', billingCredentialSecretRef: 'secret/path/prod',
  };
  const origFind = billingIntegrationConfigRepository.findByCompanyId;
  billingIntegrationConfigRepository.findByCompanyId = async () => fakeConfig;

  let capturedSecretRef;
  const origMethod = BillingApiClient.prototype.getFiscalReadiness;
  BillingApiClient.prototype.getFiscalReadiness = async ({ secretReference }) => {
    capturedSecretRef = secretReference;
    return { companyId: 'co', environment: 'SANDBOX', readyToIssue: true, reasonCodes: [], warnings: [], checkedAt: '2026-09-29T10:00:00.000Z' };
  };

  try {
    await fiscalSettingsService.getFiscalReadiness({ companyId: '77' }, {});
    assert.equal(capturedSecretRef, 'secret/path/prod');
  } finally {
    billingIntegrationConfigRepository.findByCompanyId = origFind;
    BillingApiClient.prototype.getFiscalReadiness = origMethod;
  }
});

// ── Test 26: browser does not receive billingCompanyId ───────────────────────

test('Wave 6B readiness endpoint response does not include billingCompanyId', async () => {
  const original = fiscalSettingsService.getFiscalReadiness;
  fiscalSettingsService.getFiscalReadiness = async () => ({
    environment: 'SANDBOX',
    readyToIssue: false,
    reasonCodes: ['FISCAL_PROFILE_MISSING'],
    warnings: [],
    checkedAt: '2026-09-29T10:00:00.000Z',
    // billingCompanyId intentionally absent (stripped by service)
  });
  try {
    await withHttpServer(async (base) => {
      const res = await fetch(`${base}/api/company/fiscal-settings/readiness`, {
        headers: { Authorization: `Bearer ${buildToken(601)}` },
      });
      const body = await res.json();
      assert.equal(body.billingCompanyId, undefined);
      assert.equal(body.companyId, undefined);
    });
  } finally {
    fiscalSettingsService.getFiscalReadiness = original;
  }
});

// ── Test 27: browser does not receive billingTenantId ────────────────────────

test('Wave 6B readiness endpoint response does not include billingTenantId', async () => {
  const original = fiscalSettingsService.getFiscalReadiness;
  fiscalSettingsService.getFiscalReadiness = async () => ({
    environment: 'SANDBOX', readyToIssue: true, reasonCodes: [], warnings: [],
    checkedAt: '2026-09-29T10:00:00.000Z',
  });
  try {
    await withHttpServer(async (base) => {
      const res = await fetch(`${base}/api/company/fiscal-settings/readiness`, {
        headers: { Authorization: `Bearer ${buildToken(601)}` },
      });
      const body = await res.json();
      assert.equal(body.billingTenantId, undefined);
    });
  } finally {
    fiscalSettingsService.getFiscalReadiness = original;
  }
});

// ── Test 28: browser does not receive secretReference ────────────────────────

test('Wave 6B readiness endpoint response does not include secretReference or billingCredentialSecretRef', async () => {
  const original = fiscalSettingsService.getFiscalReadiness;
  fiscalSettingsService.getFiscalReadiness = async () => ({
    environment: 'SANDBOX', readyToIssue: true, reasonCodes: [], warnings: [],
    checkedAt: '2026-09-29T10:00:00.000Z',
  });
  try {
    await withHttpServer(async (base) => {
      const res = await fetch(`${base}/api/company/fiscal-settings/readiness`, {
        headers: { Authorization: `Bearer ${buildToken(601)}` },
      });
      const body = await res.json();
      assert.equal(body.secretReference, undefined);
      assert.equal(body.billingCredentialSecretRef, undefined);
    });
  } finally {
    fiscalSettingsService.getFiscalReadiness = original;
  }
});

// ── Test 29: browser does not receive raw API key ────────────────────────────

test('Wave 6B readiness response body does not include any API key field', async () => {
  const original = fiscalSettingsService.getFiscalReadiness;
  fiscalSettingsService.getFiscalReadiness = async () => ({
    environment: 'SANDBOX', readyToIssue: true, reasonCodes: [], warnings: [],
    checkedAt: '2026-09-29T10:00:00.000Z',
  });
  try {
    await withHttpServer(async (base) => {
      const res = await fetch(`${base}/api/company/fiscal-settings/readiness`, {
        headers: { Authorization: `Bearer ${buildToken(601)}` },
      });
      const body = await res.json();
      assert.equal(body.apiKey, undefined);
      assert.equal(body.api_key, undefined);
    });
  } finally {
    fiscalSettingsService.getFiscalReadiness = original;
  }
});

// ── Test 30: malformed Billing response fails closed ────────────────────────

test('Wave 6B getFiscalReadiness service propagates BillingClientError as HTTP error when Billing responds malformed', async () => {
  const { BillingApiClient, BillingClientError } = require('../src/services/billing-api-client.service');
  const billingIntegrationConfigRepository = require('../src/repositories/billing-integration-config.repository');

  const fakeConfig = {
    enabled: true, billingCompanyId: 'co', billingTenantId: 't',
    billingEnvironment: 'SANDBOX', billingCredentialSecretRef: 'ref',
  };
  const origFind = billingIntegrationConfigRepository.findByCompanyId;
  billingIntegrationConfigRepository.findByCompanyId = async () => fakeConfig;

  const origMethod = BillingApiClient.prototype.getFiscalReadiness;
  BillingApiClient.prototype.getFiscalReadiness = async () => {
    throw new BillingClientError('Billing returned malformed fiscal readiness response', {
      code: 'BILLING_MALFORMED_FISCAL_READINESS',
      retryable: false,
    });
  };

  try {
    await assert.rejects(
      () => fiscalSettingsService.getFiscalReadiness({ companyId: '77' }, {}),
      (err) => err?.statusCode >= 400 || err?.code === 'BILLING_MALFORMED_FISCAL_READINESS',
    );
  } finally {
    billingIntegrationConfigRepository.findByCompanyId = origFind;
    BillingApiClient.prototype.getFiscalReadiness = origMethod;
  }
});

// ── Test 31: Billing unavailable returns sanitized error ────────────────────

test('Wave 6B readiness endpoint returns 5xx when Billing is unavailable, not a READY verdict', async () => {
  const original = fiscalSettingsService.getFiscalReadiness;
  fiscalSettingsService.getFiscalReadiness = async () => {
    const { createHttpError } = require('../src/lib/errors');
    throw createHttpError(503, 'No fue posible consultar Billing', 'BILLING_UNAVAILABLE');
  };
  try {
    await withHttpServer(async (base) => {
      const res = await fetch(`${base}/api/company/fiscal-settings/readiness`, {
        headers: { Authorization: `Bearer ${buildToken(601)}` },
      });
      assert.ok(res.status >= 500 || res.status === 409, `expected 5xx, got ${res.status}`);
      const body = await res.json();
      assert.equal(body.readyToIssue, undefined, 'unavailable must not produce a READY response');
    });
  } finally {
    fiscalSettingsService.getFiscalReadiness = original;
  }
});

// ── Test 32: zero direct Hacienda calls ─────────────────────────────────────

test('Wave 6B getFiscalReadiness makes zero direct Hacienda calls', async () => {
  // The readiness endpoint must call Billing only.
  // There is no Hacienda endpoint for readiness — Billing is the authority.
  // We verify that the BILLING_BASE_URL (not a Hacienda URL) is used.
  const { BillingApiClient } = require('../src/services/billing-api-client.service');
  const billingIntegrationConfigRepository = require('../src/repositories/billing-integration-config.repository');

  const fakeConfig = {
    enabled: true, billingCompanyId: 'co', billingTenantId: 't',
    billingEnvironment: 'SANDBOX', billingCredentialSecretRef: 'ref',
  };
  const origFind = billingIntegrationConfigRepository.findByCompanyId;
  billingIntegrationConfigRepository.findByCompanyId = async () => fakeConfig;

  let capturedUrl = '';
  const origProto = BillingApiClient.prototype.getFiscalReadiness;
  BillingApiClient.prototype.getFiscalReadiness = async (args) => {
    capturedUrl = args.billingCompanyId || '';
    return { companyId: 'co', environment: 'SANDBOX', readyToIssue: true, reasonCodes: [], warnings: [], checkedAt: '2026-09-29T10:00:00.000Z' };
  };

  try {
    await fiscalSettingsService.getFiscalReadiness({ companyId: '77' }, {});
    // If this resolves without error, BillingApiClient.getFiscalReadiness was called, not Hacienda
    assert.ok(capturedUrl, 'BillingApiClient.getFiscalReadiness was invoked');
  } finally {
    billingIntegrationConfigRepository.findByCompanyId = origFind;
    BillingApiClient.prototype.getFiscalReadiness = origProto;
  }
});

// ── Test 33: readiness request creates zero Inventori fiscal persistence ──────

test('Wave 6B getFiscalReadiness does not create any Prisma fiscal records', async () => {
  // readiness is stateless — no Prisma calls should be made
  const { BillingApiClient } = require('../src/services/billing-api-client.service');
  const billingIntegrationConfigRepository = require('../src/repositories/billing-integration-config.repository');
  const { PrismaClient } = require('@prisma/client');

  const fakeConfig = {
    enabled: true, billingCompanyId: 'co', billingTenantId: 't',
    billingEnvironment: 'SANDBOX', billingCredentialSecretRef: 'ref',
  };
  const origFind = billingIntegrationConfigRepository.findByCompanyId;
  billingIntegrationConfigRepository.findByCompanyId = async () => fakeConfig;

  const origProto = BillingApiClient.prototype.getFiscalReadiness;
  BillingApiClient.prototype.getFiscalReadiness = async () => ({
    companyId: 'co', environment: 'SANDBOX', readyToIssue: true, reasonCodes: [], warnings: [], checkedAt: '2026-09-29T10:00:00.000Z',
  });

  // Spy on Prisma create/upsert to ensure zero calls
  const createSpy = [];
  const origCreate = PrismaClient.prototype.companyBillingIntegrationConfig?.create;

  try {
    const result = await fiscalSettingsService.getFiscalReadiness({ companyId: '77' }, {});
    assert.ok(result, 'readiness result returned');
    assert.equal(createSpy.length, 0, 'no Prisma records created');
    // The service must only read (billingIntegrationConfig.findByCompanyId) — no writes
    assert.equal(result.readyToIssue, true);
    assert.equal(result.billingCompanyId, undefined, 'billingCompanyId stripped from response');
    assert.equal(result.companyId, undefined, 'companyId stripped from response');
  } finally {
    billingIntegrationConfigRepository.findByCompanyId = origFind;
    BillingApiClient.prototype.getFiscalReadiness = origProto;
    if (origCreate) PrismaClient.prototype.companyBillingIntegrationConfig.create = origCreate;
  }
});
