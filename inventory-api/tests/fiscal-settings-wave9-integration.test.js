'use strict';

// ── Wave 9 — Fiscal Settings Integration / Regression / Release Readiness ────
// This file covers the cross-cutting integration gaps not addressed by
// dedicated Wave 1-8 test files:
//   A. Integration contract completeness (all 6 endpoints, policies, methods)
//   B. Billing HTTP error-code → Inventori HTTP-code mapping
//   C. BillingApiClient malformed-payload rejection
//   D. BillingApiClient timeout handling end-to-end
//   E. SecretRef non-exposure in error HTTP responses
//   F. Environment normalisation (lowercase config → uppercase to Billing)
//   G. GET-only endpoints do not generate mutation audit events
//   H. No automatic activity refresh triggered by page load / readiness load
//   I. No free-text activity injection (activity code comes from Billing only)
//   J. Frontend API module uses InventoryAuth (no direct Billing calls)
//   K. Runtime contract manifest completeness
//   L. No readiness synthesis regression (cross-layer)
//
// Does NOT re-test behaviour proven in Waves 1-8.

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-with-at-least-32-characters';

const { signAccessToken } = require('../src/lib/auth');
const { BillingApiClient, BillingClientError } = require('../src/services/billing-api-client.service');
const fiscalSettingsService = require('../src/services/fiscal-settings.service');
const { listAccessPolicies } = require('../src/security/access-policies');
const audit = require('../src/lib/audit');
const { enableDbFreeAuthSeams } = require('./helpers/db-free-auth');

const ALL_FISCAL_PERMS = [
  'fiscal.settings.view',
  'fiscal.activities.refresh',
  'fiscal.activities.manage',
  'fiscal.activities.default.update',
  'fiscal.readiness.view',
];

const restoreAuth = enableDbFreeAuthSeams([
  { id: '901', companyId: '77', role: { code: 'admin' }, permissions: ALL_FISCAL_PERMS },
  { id: '902', companyId: '88', role: { code: 'admin' }, permissions: ALL_FISCAL_PERMS },
  { id: '903', companyId: '77', role: { code: 'admin' }, permissions: ['fiscal.settings.view'] },
  { id: '904', companyId: '77', role: { code: 'admin' }, permissions: ['fiscal.readiness.view'] },
  { id: '905', companyId: '77', role: { code: 'admin' }, permissions: [] },
]);
process.on('exit', restoreAuth);

const app = require('../src/app');

function buildToken(userId, companyId = 77) {
  return signAccessToken({
    id: BigInt(userId),
    username: `user-${userId}`,
    companyId: BigInt(companyId),
    role: { code: 'admin', rolePermissions: [] },
  });
}

async function withHttpServer(run) {
  const server = http.createServer(app);
  await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function authHeader(userId) {
  return { Authorization: `Bearer ${buildToken(userId)}` };
}

async function req(baseUrl, urlPath, { method = 'GET', userId = 901, body } = {}) {
  return fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: {
      ...authHeader(userId),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function withStubs(stubsByModule, run) {
  const originals = [];
  for (const [mod, stubs] of stubsByModule) {
    for (const [key, value] of Object.entries(stubs)) {
      originals.push([mod, key, mod[key]]);
      mod[key] = value;
    }
  }
  return run().finally(() => {
    for (const [mod, key, value] of originals) { mod[key] = value; }
  });
}

function canonicalResponse() {
  return {
    taxpayer: { verificationStatus: 'VERIFIED', verifiedAt: null, taxSituation: 'AL_DIA', moroso: false, omiso: false },
    activities: [{ code: '620100', description: 'Software', haciendaStatus: 'A', haciendaKind: 'PRINCIPAL', billingEnabled: true, isDefault: true, verifiedAt: null, lastSeenAt: null, verificationSource: 'HACIENDA' }],
    defaultActivityCode: '620100',
    configuration: { hasBillingIntegration: true },
  };
}

// ── PART A — Integration contract matrix ─────────────────────────────────────

test('Wave 9 #A1: all 6 fiscal-settings access-policy names match route guards', () => {
  const policies = listAccessPolicies();
  assert.ok(policies['fiscal-settings.view'], 'fiscal-settings.view policy must exist');
  assert.ok(policies['fiscal-settings.readiness'], 'fiscal-settings.readiness policy must exist');
  assert.ok(policies['fiscal-settings.activities.refresh'], 'activities.refresh policy must exist');
  assert.ok(policies['fiscal-settings.activities.manage'], 'activities.manage policy must exist');
  assert.ok(policies['fiscal-settings.activities.default.update'], 'activities.default.update policy must exist');
  assert.deepEqual(policies['fiscal-settings.readiness'].permissions, ['fiscal.readiness.view']);
  assert.deepEqual(policies['fiscal-settings.view'].permissions, ['fiscal.settings.view']);
});

test('Wave 9 #A2: GET fiscal-settings returns 200, POST refresh returns 200, readiness returns 200', async () => {
  await withStubs([[fiscalSettingsService, {
    getFiscalSettings: async () => canonicalResponse(),
    refreshFiscalActivities: async () => canonicalResponse(),
    getFiscalReadiness: async () => ({ environment: 'SANDBOX', readyToIssue: true, reasonCodes: [], warnings: [], checkedAt: new Date().toISOString() }),
  }]], () => withHttpServer(async (base) => {
    const [get, refresh, readiness] = await Promise.all([
      req(base, '/api/company/fiscal-settings'),
      req(base, '/api/company/fiscal-settings/activities/refresh', { method: 'POST', body: {} }),
      req(base, '/api/company/fiscal-settings/readiness', { userId: 904 }),
    ]);
    assert.equal(get.status, 200);
    assert.equal(refresh.status, 200);
    assert.equal(readiness.status, 200);
  }));
});

test('Wave 9 #A3: PATCH activities/:code and PUT activities/default return 200 with correct service calls', async () => {
  const calls = [];
  await withStubs([[fiscalSettingsService, {
    updateFiscalActivity: async (auth, code, enabled) => { calls.push(['patch', code, enabled]); return canonicalResponse(); },
    setDefaultFiscalActivity: async (auth, code) => { calls.push(['put', code]); return canonicalResponse(); },
  }]], () => withHttpServer(async (base) => {
    const patch = await req(base, '/api/company/fiscal-settings/activities/620100', { method: 'PATCH', body: { billingEnabled: true } });
    const put = await req(base, '/api/company/fiscal-settings/activities/default', { method: 'PUT', body: { code: '620100' } });
    assert.equal(patch.status, 200);
    assert.equal(put.status, 200);
    assert.deepEqual(calls, [['patch', '620100', true], ['put', '620100']]);
  }));
});

// ── PART B — Billing HTTP error-code → Inventori HTTP-code mapping ────────────

function makeBillingError(code, statusCode, retryable = false) {
  return Object.assign(new BillingClientError(`Billing error ${statusCode}`, { code, statusCode, retryable }), {});
}

test('Wave 9 #B1: Billing 401 → Inventori 401 passthrough from service sanitizeBillingFailure', async () => {
  await withStubs([[fiscalSettingsService, {
    getFiscalSettings: async () => { throw makeBillingError('BILLING_UNAUTHORIZED', 401); },
  }]], () => withHttpServer(async (base) => {
    const r = await req(base, '/api/company/fiscal-settings');
    assert.equal(r.status, 401);
  }));
});

test('Wave 9 #B2: Billing 403 → Inventori 403', async () => {
  await withStubs([[fiscalSettingsService, {
    getFiscalSettings: async () => { throw makeBillingError('BILLING_FORBIDDEN', 403); },
  }]], () => withHttpServer(async (base) => {
    const r = await req(base, '/api/company/fiscal-settings');
    assert.equal(r.status, 403);
  }));
});

test('Wave 9 #B3: Billing 404 → Inventori 404', async () => {
  await withStubs([[fiscalSettingsService, {
    getFiscalSettings: async () => { throw makeBillingError('COMPANY_NOT_FOUND', 404); },
  }]], () => withHttpServer(async (base) => {
    const r = await req(base, '/api/company/fiscal-settings');
    assert.equal(r.status, 404);
  }));
});

test('Wave 9 #B4: Billing 409 → Inventori 409', async () => {
  await withStubs([[fiscalSettingsService, {
    getFiscalSettings: async () => { throw makeBillingError('CONFLICT', 409); },
  }]], () => withHttpServer(async (base) => {
    const r = await req(base, '/api/company/fiscal-settings');
    assert.equal(r.status, 409);
  }));
});

test('Wave 9 #B5: Billing 503 retryable → Inventori 503', async () => {
  await withStubs([[fiscalSettingsService, {
    getFiscalReadiness: async () => { throw makeBillingError('BILLING_UNAVAILABLE', 503, true); },
  }]], () => withHttpServer(async (base) => {
    const r = await req(base, '/api/company/fiscal-settings/readiness', { userId: 904 });
    assert.equal(r.status, 503);
  }));
});

test('Wave 9 #B6: sanitizeBillingFailure converts non-BillingClientError to 502 createHttpError', async () => {
  // The sanitisation happens inside the service layer (loadCanonicalSettings), not in the route.
  // We verify the service's own catch path, not a route stub.
  const billingIntegrationConfigRepository = require('../src/repositories/billing-integration-config.repository');
  const fakeConfig = { enabled: true, billingCompanyId: 'co', billingTenantId: 't', billingEnvironment: 'SANDBOX', billingCredentialSecretRef: 'ref' };
  const origFind = billingIntegrationConfigRepository.findByCompanyId;
  billingIntegrationConfigRepository.findByCompanyId = async () => fakeConfig;
  const origMethod = BillingApiClient.prototype.getFiscalOnboardingStatus;
  BillingApiClient.prototype.getFiscalOnboardingStatus = async () => { throw new Error('network blew up'); };
  try {
    await assert.rejects(
      () => fiscalSettingsService.getFiscalSettings({ companyId: '77' }, {}),
      (e) => { assert.equal(e.statusCode, 502); assert.equal(e.code, 'BILLING_UNAVAILABLE'); return true; },
    );
  } finally {
    billingIntegrationConfigRepository.findByCompanyId = origFind;
    BillingApiClient.prototype.getFiscalOnboardingStatus = origMethod;
  }
});

test('Wave 9 #B7: sanitizeBillingFailure maps BillingClientError retryable=true, no statusCode → 503', async () => {
  const billingIntegrationConfigRepository = require('../src/repositories/billing-integration-config.repository');
  const fakeConfig = { enabled: true, billingCompanyId: 'co', billingTenantId: 't', billingEnvironment: 'SANDBOX', billingCredentialSecretRef: 'ref' };
  const origFind = billingIntegrationConfigRepository.findByCompanyId;
  billingIntegrationConfigRepository.findByCompanyId = async () => fakeConfig;
  const origMethod = BillingApiClient.prototype.getFiscalOnboardingStatus;
  BillingApiClient.prototype.getFiscalOnboardingStatus = async () => {
    throw new BillingClientError('Billing request timed out', { code: 'BILLING_TIMEOUT', retryable: true });
  };
  try {
    await assert.rejects(
      () => fiscalSettingsService.getFiscalSettings({ companyId: '77' }, {}),
      (e) => { assert.equal(e.statusCode, 503); assert.equal(e.code, 'BILLING_TIMEOUT'); return true; },
    );
  } finally {
    billingIntegrationConfigRepository.findByCompanyId = origFind;
    BillingApiClient.prototype.getFiscalOnboardingStatus = origMethod;
  }
});

// ── PART C — BillingApiClient malformed-payload rejection ─────────────────────

function makeFetch(body, status = 200) {
  return async () => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });
}

function makeClient(fetchImpl) {
  return new BillingApiClient({
    baseUrl: 'https://billing.test',
    credentialResolver: { resolveApiKey: () => 'test-key' },
    timeoutMs: 5000,
    fetchImpl,
  });
}

test('Wave 9 #C1: getFiscalReadiness rejects missing readyToIssue field', async () => {
  const client = makeClient(makeFetch({ companyId: 'co', environment: 'SANDBOX', reasonCodes: [], warnings: [], checkedAt: new Date().toISOString() }));
  await assert.rejects(
    () => client.getFiscalReadiness({ billingCompanyId: 'co', environment: 'SANDBOX', secretReference: 'ref', correlationId: null }),
    (e) => { assert.equal(e.code, 'BILLING_MALFORMED_FISCAL_READINESS'); return true; },
  );
});

test('Wave 9 #C2: getFiscalReadiness rejects non-boolean readyToIssue', async () => {
  const client = makeClient(makeFetch({ companyId: 'co', environment: 'SANDBOX', readyToIssue: 'yes', reasonCodes: [], warnings: [], checkedAt: new Date().toISOString() }));
  await assert.rejects(
    () => client.getFiscalReadiness({ billingCompanyId: 'co', environment: 'SANDBOX', secretReference: 'ref', correlationId: null }),
    (e) => { assert.equal(e.code, 'BILLING_MALFORMED_FISCAL_READINESS'); return true; },
  );
});

test('Wave 9 #C3: getFiscalReadiness rejects non-array reasonCodes', async () => {
  const client = makeClient(makeFetch({ companyId: 'co', environment: 'SANDBOX', readyToIssue: false, reasonCodes: 'MISSING', warnings: [], checkedAt: new Date().toISOString() }));
  await assert.rejects(
    () => client.getFiscalReadiness({ billingCompanyId: 'co', environment: 'SANDBOX', secretReference: 'ref', correlationId: null }),
    (e) => { assert.equal(e.code, 'BILLING_MALFORMED_FISCAL_READINESS'); return true; },
  );
});

test('Wave 9 #C4: getFiscalOnboardingStatus rejects missing companyId field', async () => {
  const body = { defaultEconomicActivityId: null, activities: [] };
  const client = makeClient(makeFetch(body));
  await assert.rejects(
    () => client.getFiscalOnboardingStatus({ billingCompanyId: 'co', secretReference: 'ref', correlationId: null }),
    (e) => { assert.equal(e.code, 'BILLING_MALFORMED_FISCAL_ONBOARDING_STATUS'); return true; },
  );
});

test('Wave 9 #C5: getFiscalOnboardingStatus rejects malformed activity in array', async () => {
  const body = { companyId: 'co', defaultEconomicActivityId: null, activities: [{ id: 'a1', code: '620100' }] };
  const client = makeClient(makeFetch(body));
  await assert.rejects(
    () => client.getFiscalOnboardingStatus({ billingCompanyId: 'co', secretReference: 'ref', correlationId: null }),
    (e) => { assert.equal(e.code, 'BILLING_MALFORMED_FISCAL_ONBOARDING_ACTIVITY'); return true; },
  );
});

// ── PART D — BillingApiClient timeout handling ────────────────────────────────

test('Wave 9 #D1: BillingApiClient maps AbortError to BILLING_TIMEOUT with retryable=true', async () => {
  const fetchImpl = () => { const e = new Error('aborted'); e.name = 'AbortError'; return Promise.reject(e); };
  const client = makeClient(fetchImpl);
  await assert.rejects(
    () => client.getFiscalOnboardingStatus({ billingCompanyId: 'co', secretReference: 'ref', correlationId: null }),
    (e) => {
      assert.equal(e instanceof BillingClientError, true);
      assert.equal(e.code, 'BILLING_TIMEOUT');
      assert.equal(e.retryable, true);
      return true;
    },
  );
});

// ── PART E — SecretRef non-exposure in HTTP error responses ───────────────────

test('Wave 9 #E1: sanitizeBillingFailure strips secretRef from BillingClientError message before re-throw', async () => {
  // The secret stripping happens inside the service (sanitizeBillingFailure), not the route.
  // This verifies the service layer sanitises before any error propagates.
  const SECRET = 'env:BILLING_SUPER_SECRET_REF_9X7';
  const billingIntegrationConfigRepository = require('../src/repositories/billing-integration-config.repository');
  const fakeConfig = { enabled: true, billingCompanyId: 'co', billingTenantId: 't', billingEnvironment: 'SANDBOX', billingCredentialSecretRef: SECRET };
  const origFind = billingIntegrationConfigRepository.findByCompanyId;
  billingIntegrationConfigRepository.findByCompanyId = async () => fakeConfig;
  const origMethod = BillingApiClient.prototype.getFiscalOnboardingStatus;
  BillingApiClient.prototype.getFiscalOnboardingStatus = async () => {
    throw new BillingClientError(`Remote failure with embedded ${SECRET} in message`, { code: `REF_${SECRET}`, statusCode: 502 });
  };
  try {
    await assert.rejects(
      () => fiscalSettingsService.getFiscalSettings({ companyId: '77' }, {}),
      (e) => {
        const serialized = JSON.stringify({ message: e.message, code: e.code });
        assert.equal(serialized.includes(SECRET), false, `secretRef must be stripped from re-thrown error`);
        return true;
      },
    );
  } finally {
    billingIntegrationConfigRepository.findByCompanyId = origFind;
    BillingApiClient.prototype.getFiscalOnboardingStatus = origMethod;
  }
});

test('Wave 9 #E2: billingCredentialSecretRef not in fiscal-settings JSON response', async () => {
  await withStubs([[fiscalSettingsService, {
    getFiscalSettings: async () => canonicalResponse(),
  }]], () => withHttpServer(async (base) => {
    const r = await req(base, '/api/company/fiscal-settings');
    const body = await r.text();
    assert.equal(body.includes('billingCredentialSecretRef'), false);
    assert.equal(body.includes('secretRef'), false);
    assert.equal(body.includes('billingTenantId'), false);
    assert.equal(body.includes('billingCompanyId'), false);
  }));
});

// ── PART F — Environment normalisation ───────────────────────────────────────

test('Wave 9 #F1: service normalises billingEnvironment to uppercase before passing to BillingApiClient', async () => {
  const billingIntegrationConfigRepository = require('../src/repositories/billing-integration-config.repository');
  const fakeConfig = {
    enabled: true, billingCompanyId: 'co', billingTenantId: 't',
    billingEnvironment: 'sandbox', billingCredentialSecretRef: 'ref',
  };
  const origFind = billingIntegrationConfigRepository.findByCompanyId;
  billingIntegrationConfigRepository.findByCompanyId = async () => fakeConfig;
  const origMethod = BillingApiClient.prototype.getFiscalReadiness;
  let capturedEnv;
  BillingApiClient.prototype.getFiscalReadiness = async ({ environment }) => {
    capturedEnv = environment;
    return { companyId: 'co', environment: 'SANDBOX', readyToIssue: true, reasonCodes: [], warnings: [], checkedAt: new Date().toISOString() };
  };
  try {
    await fiscalSettingsService.getFiscalReadiness({ companyId: '77' }, {});
    assert.equal(capturedEnv, 'SANDBOX', 'service must uppercase the billingEnvironment config value');
  } finally {
    billingIntegrationConfigRepository.findByCompanyId = origFind;
    BillingApiClient.prototype.getFiscalReadiness = origMethod;
  }
});

test('Wave 9 #F2: unsupported environment value is rejected before reaching BillingApiClient', async () => {
  const billingIntegrationConfigRepository = require('../src/repositories/billing-integration-config.repository');
  const origFind = billingIntegrationConfigRepository.findByCompanyId;
  billingIntegrationConfigRepository.findByCompanyId = async () => ({
    enabled: true, billingCompanyId: 'co', billingTenantId: 't',
    billingEnvironment: 'STAGING', billingCredentialSecretRef: 'ref',
  });
  try {
    await assert.rejects(
      () => fiscalSettingsService.getFiscalReadiness({ companyId: '77' }, {}),
      (e) => { assert.equal(e.code, 'BILLING_ENVIRONMENT_UNSUPPORTED'); return true; },
    );
  } finally {
    billingIntegrationConfigRepository.findByCompanyId = origFind;
  }
});

// ── PART G — GET-only endpoints do not generate mutation audit events ──────────

test('Wave 9 #G1: GET fiscal-settings and GET readiness do not emit any audit event', async () => {
  const auditEvents = [];
  await withStubs([
    [audit, { recordAuditEventSafelyIfAvailable: async (e) => { auditEvents.push(e); } }],
    [fiscalSettingsService, {
      getFiscalSettings: async () => canonicalResponse(),
      getFiscalReadiness: async () => ({ environment: 'SANDBOX', readyToIssue: true, reasonCodes: [], warnings: [], checkedAt: new Date().toISOString() }),
    }],
  ], () => withHttpServer(async (base) => {
    await req(base, '/api/company/fiscal-settings', { userId: 903 });
    await req(base, '/api/company/fiscal-settings/readiness', { userId: 904 });
  }));
  assert.equal(auditEvents.length, 0, 'read-only GETs must not emit audit events');
});

// ── PART H — No automatic refresh on page load / readiness load ───────────────

test('Wave 9 #H1: fiscalSettingsApi does not export an auto-refresh function', () => {
  const rootPublicPath = path.join(__dirname, '..', 'src', 'public', 'root');
  const source = fs.readFileSync(path.join(rootPublicPath, 'fiscal-settings-api.js'), 'utf8');
  assert.equal(source.includes('setInterval'), false, 'no polling/auto-refresh interval');
  assert.equal(source.includes('setTimeout'), false, 'no auto-refresh timeout');
});

test('Wave 9 #H2: fiscal-settings-admin.js view does not call refreshActivities on initial mount', () => {
  const rootPublicPath = path.join(__dirname, '..', 'src', 'public', 'root');
  const source = fs.readFileSync(path.join(rootPublicPath, 'views', 'fiscal-settings-admin.js'), 'utf8');
  // mount must not unconditionally call refreshActivities – only triggered by explicit user action
  const mountFnMatch = source.match(/mount\s*\([^)]*\)\s*\{([\s\S]*?)^\s*\}/m);
  if (mountFnMatch) {
    assert.equal(mountFnMatch[1].includes('refreshActivities'), false, 'refreshActivities must not be called inside mount()');
  }
  // refreshActivities is only reachable via the refresh button event listener
  assert.equal(source.includes('refreshActivities'), true, 'refreshActivities must still exist as a function reference');
});

test('Wave 9 #H3: getFiscalReadiness is independent from refreshActivities — readiness load does not trigger activity refresh', () => {
  const rootPublicPath = path.join(__dirname, '..', 'src', 'public', 'root');
  const source = fs.readFileSync(path.join(rootPublicPath, 'views', 'fiscal-settings-admin.js'), 'utf8');
  // Find the block that calls getFiscalReadiness and ensure refreshActivities is not adjacent
  const readinessCallIndex = source.indexOf('getFiscalReadiness');
  assert.notEqual(readinessCallIndex, -1, 'getFiscalReadiness must exist in view');
  const surroundingContext = source.slice(Math.max(0, readinessCallIndex - 200), readinessCallIndex + 200);
  assert.equal(surroundingContext.includes('refreshActivities'), false, 'refreshActivities must not be co-located with getFiscalReadiness call');
});

// ── PART I — No free-text activity injection ──────────────────────────────────

test('Wave 9 #I1: there is no POST /fiscal-settings/activities route that creates new activities', async () => {
  await withHttpServer(async (base) => {
    // POST /activities (without /refresh) must not be a valid endpoint
    const r = await req(base, '/api/company/fiscal-settings/activities', { method: 'POST', body: { code: '999999', description: 'Invented' } });
    // Should be 404 (no such route) or 405
    assert.equal(r.status >= 404, true, 'No free-text activity creation route must exist');
  });
});

// ── PART J — Frontend API module uses InventoryAuth, not direct Billing ────────

test('Wave 9 #J1: fiscal-settings-api.js uses InventoryAuth.fetchJson for every call — no direct Billing URLs', () => {
  const rootPublicPath = path.join(__dirname, '..', 'src', 'public', 'root');
  const source = fs.readFileSync(path.join(rootPublicPath, 'fiscal-settings-api.js'), 'utf8');
  assert.equal(source.includes('inventoryAuth.fetchJson'), true, 'must use InventoryAuth.fetchJson');
  assert.equal(source.includes('billing.'), false, 'must not reference billing domain in URLs');
  assert.equal(source.includes('localhost:3000'), false, 'must not hardcode Billing host');
  assert.equal(source.includes('X-API-Key'), false, 'must not include M2M API key in frontend');
  assert.equal(source.includes('bk_test'), false, 'must not include hardcoded Billing API key');
});

test('Wave 9 #J2: fiscal-settings-api.js registers exactly the 5 approved API functions in RootShell', () => {
  const rootPublicPath = path.join(__dirname, '..', 'src', 'public', 'root');
  const { browserWindow, context } = (() => {
    const bw = {};
    const ctx = vm.createContext({ Map, Set, window: bw });
    bw.window = bw;
    return { browserWindow: bw, context: ctx };
  })();
  function run(relPath) {
    vm.runInContext(fs.readFileSync(path.join(rootPublicPath, relPath), 'utf8'), context, { filename: relPath });
  }
  browserWindow.InventoryAuth = { fetchJson: async () => ({}) };
  run('registry.js');
  run('fiscal-settings-api.js');
  const api = browserWindow.RootShell.require('fiscalSettingsApi');
  assert.equal(typeof api.getFiscalSettings, 'function');
  assert.equal(typeof api.refreshActivities, 'function');
  assert.equal(typeof api.setDefaultActivity, 'function');
  assert.equal(typeof api.updateActivityBillingEnabled, 'function');
  assert.equal(typeof api.getFiscalReadiness, 'function');
  assert.equal(Object.keys(api).length, 5, 'exactly 5 API functions, no extras');
});

// ── PART K — Runtime contract manifest completeness ───────────────────────────

test('Wave 9 #K1: runtime contract manifest registers all 5 fiscal-settings routes', () => {
  const manifestPath = path.join(__dirname, '..', 'docs', 'runtime-contract-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Manifest uses flat excludedOperations array (not nested intentionallyExcludedRoutes)
  const allExcluded = Array.isArray(manifest.excludedOperations) ? manifest.excludedOperations : [];
  const fiscalPaths = allExcluded
    .filter((r) => r.routeFile === 'src/routes/fiscal-settings.routes.js')
    .map((r) => r.expressPath);

  const expectedPaths = [
    '/fiscal-settings/readiness',
    '/fiscal-settings',
    '/fiscal-settings/activities/refresh',
    '/fiscal-settings/activities/:code',
    '/fiscal-settings/activities/default',
  ];
  for (const p of expectedPaths) {
    assert.equal(fiscalPaths.includes(p), true, `manifest must include ${p}`);
  }
});

// ── PART L — No readiness synthesis regression (cross-layer) ──────────────────

test('Wave 9 #L1: getFiscalReadiness service function never calculates readyToIssue locally', () => {
  const serviceSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'fiscal-settings.service.js'),
    'utf8',
  );
  // readyToIssue must not be assigned anywhere in the service
  const assignmentPattern = /readyToIssue\s*=/;
  assert.equal(assignmentPattern.test(serviceSource), false, 'fiscal-settings.service.js must not assign readyToIssue');
  // reasonCodes must not be constructed locally
  assert.equal(serviceSource.includes('reasonCodes.push'), false, 'service must not build reasonCodes array');
  assert.equal(serviceSource.includes('reasonCodes = ['), false, 'service must not initialise reasonCodes');
});

test('Wave 9 #L2: fiscal-settings-admin.js frontend never assigns readyToIssue', () => {
  const frontendSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'public', 'root', 'views', 'fiscal-settings-admin.js'),
    'utf8',
  );
  assert.equal(/readyToIssue\s*=/.test(frontendSource), false, 'frontend must not assign readyToIssue');
  assert.equal(frontendSource.includes('reasonCodes.push'), false, 'frontend must not build reasonCodes');
});

test('Wave 9 #L3: readiness route passes auth to service without injecting Billing-internal values', async () => {
  let capturedArgs;
  await withStubs([[fiscalSettingsService, {
    getFiscalReadiness: async (auth, context) => {
      capturedArgs = { auth, context };
      return { environment: 'SANDBOX', readyToIssue: true, reasonCodes: [], warnings: [], checkedAt: new Date().toISOString() };
    },
  }]], () => withHttpServer(async (base) => {
    await req(base, '/api/company/fiscal-settings/readiness', { userId: 904 });
  }));
  // Route must pass auth from JWT only — no billingCompanyId/billingTenantId injected
  assert.equal(capturedArgs.auth.companyId, '77');
  assert.equal(capturedArgs.auth.billingCompanyId, undefined, 'route must not inject billingCompanyId into auth');
  assert.equal(capturedArgs.auth.billingTenantId, undefined, 'route must not inject billingTenantId into auth');
  assert.equal(capturedArgs.auth.secretReference, undefined, 'route must not inject secretReference');
});
