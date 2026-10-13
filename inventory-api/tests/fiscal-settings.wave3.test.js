'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-with-at-least-32-characters';

const { signAccessToken } = require('../src/lib/auth');
const audit = require('../src/lib/audit');
const fiscalSettingsService = require('../src/services/fiscal-settings.service');
const { listAccessPolicies } = require('../src/security/access-policies');
const { PERMISSION_METADATA } = require('../src/security/permission-governance.config');
const { ROLE_BUNDLES } = require('../src/security/role-bundles.config');
const { enableDbFreeAuthSeams } = require('./helpers/db-free-auth');

const ALL_FISCAL_PERMISSIONS = [
  'fiscal.settings.view',
  'fiscal.activities.refresh',
  'fiscal.activities.manage',
  'fiscal.activities.default.update',
];

const restoreAuth = enableDbFreeAuthSeams([
  { id: '101', companyId: '77', role: { code: 'admin' }, permissions: ALL_FISCAL_PERMISSIONS },
  { id: '202', companyId: '88', role: { code: 'admin' }, permissions: ALL_FISCAL_PERMISSIONS },
  { id: '301', companyId: '77', role: { code: 'admin' }, permissions: ['fiscal.settings.view'] },
  { id: '302', companyId: '77', role: { code: 'admin' }, permissions: ['fiscal.activities.refresh'] },
  { id: '303', companyId: '77', role: { code: 'admin' }, permissions: ['fiscal.activities.manage'] },
  { id: '304', companyId: '77', role: { code: 'admin' }, permissions: ['fiscal.activities.default.update'] },
  { id: '305', companyId: '77', role: { code: 'admin' }, permissions: ['fiscal.settings.view', 'fiscal.activities.manage'] },
  { id: '401', companyId: '77', role: { code: 'admin' }, permissions: [] },
  { id: '402', companyId: '77', role: { code: 'admin' }, permissions: ['company.dashboard'] },
  { id: '403', companyId: '77', role: { code: 'admin' }, permissions: ['settings.manage', 'users.view'] },
]);
process.on('exit', restoreAuth);

const app = require('../src/app');

function buildToken(userId) {
  return signAccessToken({
    id: BigInt(userId),
    username: `user-${userId}`,
    companyId: userId === 202 ? 88n : 77n,
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
    await new Promise((resolve, reject) => { server.close((error) => (error ? reject(error) : resolve())); });
  }
}

async function withStubs(stubsByModule, run) {
  const originals = [];
  for (const [moduleRef, stubs] of stubsByModule) {
    for (const [key, value] of Object.entries(stubs)) {
      originals.push([moduleRef, key, moduleRef[key]]);
      moduleRef[key] = value;
    }
  }
  try {
    return await run();
  } finally {
    for (const [moduleRef, key, value] of originals) {
      moduleRef[key] = value;
    }
  }
}

function canonicalResponse() {
  return {
    taxpayer: { verificationStatus: 'VERIFIED', verifiedAt: null, taxSituation: null, moroso: false, omiso: false },
    activities: [{ code: '620100', description: 'Software', haciendaStatus: 'A', haciendaKind: 'PRINCIPAL', billingEnabled: true, isDefault: true, verifiedAt: null, lastSeenAt: null, verificationSource: 'HACIENDA' }],
    defaultActivityCode: '620100',
    configuration: { hasBillingIntegration: true },
  };
}

function authHeader(userId) {
  return { Authorization: `Bearer ${buildToken(userId)}` };
}

async function requestJson(baseUrl, path, { method = 'GET', userId = 101, body = undefined } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...authHeader(userId), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test('Fiscal Settings route access policies use final granular permission identifiers', () => {
  const policies = listAccessPolicies();
  assert.deepEqual(policies['fiscal-settings.view'].permissions, ['fiscal.settings.view']);
  assert.deepEqual(policies['fiscal-settings.activities.refresh'].permissions, ['fiscal.activities.refresh']);
  assert.deepEqual(policies['fiscal-settings.activities.manage'].permissions, ['fiscal.activities.manage']);
  assert.deepEqual(policies['fiscal-settings.activities.default.update'].permissions, ['fiscal.activities.default.update']);
  assert.equal(PERMISSION_METADATA.some((permission) => permission.code === 'fiscal.readiness.view'), true);

  const companyAdminBundle = ROLE_BUNDLES.find((bundle) => bundle.id === 'company_admin');
  for (const permission of [...ALL_FISCAL_PERMISSIONS, 'fiscal.readiness.view']) {
    assert.equal(PERMISSION_METADATA.some((item) => item.code === permission), true);
    assert.equal(companyAdminBundle.basePermissionCodes.includes(permission), true);
  }
});

test('granular permission matrix protects Fiscal Settings endpoints and prevents unauthorized Billing calls', async () => {
  const calls = [];
  const serviceStubs = {
    getFiscalSettings: async (auth) => { calls.push(['get', auth.companyId]); return canonicalResponse(); },
    refreshFiscalActivities: async (auth) => { calls.push(['refresh', auth.companyId]); return canonicalResponse(); },
    updateFiscalActivity: async (auth, code, enabled) => { calls.push(['patch', auth.companyId, code, enabled]); return canonicalResponse(); },
    setDefaultFiscalActivity: async (auth, code) => { calls.push(['default', auth.companyId, code]); return canonicalResponse(); },
  };

  await withStubs([[fiscalSettingsService, serviceStubs]], () => withHttpServer(async (baseUrl) => {
    assert.equal((await requestJson(baseUrl, '/api/company/fiscal-settings', { userId: 301 })).status, 200);
    assert.equal((await requestJson(baseUrl, '/api/company/fiscal-settings', { userId: 401 })).status, 403);
    assert.equal((await requestJson(baseUrl, '/api/company/fiscal-settings/activities/refresh', { method: 'POST', userId: 301, body: {} })).status, 403);
    assert.equal((await requestJson(baseUrl, '/api/company/fiscal-settings/activities/refresh', { method: 'POST', userId: 302, body: {} })).status, 200);
    assert.equal((await requestJson(baseUrl, '/api/company/fiscal-settings/activities/refresh', { method: 'POST', userId: 401, body: {} })).status, 403);
    assert.equal((await requestJson(baseUrl, '/api/company/fiscal-settings/activities/620100', { method: 'PATCH', userId: 301, body: { billingEnabled: true } })).status, 403);
    assert.equal((await requestJson(baseUrl, '/api/company/fiscal-settings/activities/620100', { method: 'PATCH', userId: 303, body: { billingEnabled: true } })).status, 200);
    assert.equal((await requestJson(baseUrl, '/api/company/fiscal-settings/activities/620100', { method: 'PATCH', userId: 303, body: { billingEnabled: false } })).status, 200);
    assert.equal((await requestJson(baseUrl, '/api/company/fiscal-settings/activities/620100', { method: 'PATCH', userId: 401, body: { billingEnabled: true } })).status, 403);
    assert.equal((await requestJson(baseUrl, '/api/company/fiscal-settings/activities/default', { method: 'PUT', userId: 305, body: { code: '620100' } })).status, 403);
    assert.equal((await requestJson(baseUrl, '/api/company/fiscal-settings/activities/default', { method: 'PUT', userId: 304, body: { code: '620100' } })).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/company/fiscal-settings`)).status, 401);
    assert.equal((await requestJson(baseUrl, '/api/company/fiscal-settings/activities/refresh', { method: 'POST', userId: 403, body: {} })).status, 403);
    assert.equal((await requestJson(baseUrl, '/api/company/fiscal-settings/activities/refresh', { method: 'POST', userId: 402, body: {} })).status, 403);
  }));

  assert.deepEqual(calls.map((call) => call[0]), ['get', 'refresh', 'patch', 'patch', 'default']);
});

test('Fiscal Settings company scoping ignores frontend overrides for every route', async () => {
  const calls = [];
  await withStubs([[fiscalSettingsService, {
    getFiscalSettings: async (auth) => { calls.push(['get', auth.companyId]); return canonicalResponse(); },
    refreshFiscalActivities: async (auth) => { calls.push(['refresh', auth.companyId]); return canonicalResponse(); },
    updateFiscalActivity: async (auth, code, enabled) => { calls.push(['patch', auth.companyId, code, enabled]); return canonicalResponse(); },
    setDefaultFiscalActivity: async (auth, code) => { calls.push(['default', auth.companyId, code]); return canonicalResponse(); },
  }]], () => withHttpServer(async (baseUrl) => {
    await requestJson(baseUrl, '/api/company/fiscal-settings?companyId=88&billingCompanyId=evil&billingTenantId=evil&secretReference=env:EVIL&billingEnvironment=PRODUCTION', { userId: 101 });
    await requestJson(baseUrl, '/api/company/fiscal-settings/activities/refresh?companyId=88&billingEnvironment=PRODUCTION', {
      method: 'POST',
      userId: 101,
      body: { companyId: '88', billingCompanyId: 'evil', billingTenantId: 'evil', secretReference: 'env:EVIL', billingCredentialSecretRef: 'env:EVIL', billingEnvironment: 'PRODUCTION' },
    });
    await requestJson(baseUrl, '/api/company/fiscal-settings/activities/620100?billingTenantId=evil', {
      method: 'PATCH',
      userId: 101,
      body: { billingEnabled: true },
    });
    await requestJson(baseUrl, '/api/company/fiscal-settings/activities/default?billingCompanyId=evil', {
      method: 'PUT',
      userId: 101,
      body: { code: '620100' },
    });
    await requestJson(baseUrl, '/api/company/fiscal-settings?companyId=77', { userId: 202 });
  }));

  assert.deepEqual(calls, [
    ['get', '77'],
    ['refresh', '77'],
    ['patch', '77', '620100', true],
    ['default', '77', '620100'],
    ['get', '88'],
  ]);
});

test('successful fiscal mutations record explicit safe audit events', async () => {
  const auditEvents = [];
  const serviceCalls = [];
  await withStubs([
    [audit, { recordAuditEventSafelyIfAvailable: async (payload) => { auditEvents.push(payload); } }],
    [fiscalSettingsService, {
      refreshFiscalActivities: async (auth) => { serviceCalls.push(['refresh', auth.companyId]); return canonicalResponse(); },
      updateFiscalActivity: async (auth, code, enabled) => { serviceCalls.push(['patch', auth.companyId, code, enabled]); return canonicalResponse(); },
      setDefaultFiscalActivity: async (auth, code) => { serviceCalls.push(['default', auth.companyId, code]); return canonicalResponse(); },
    }],
  ], () => withHttpServer(async (baseUrl) => {
    await requestJson(baseUrl, '/api/company/fiscal-settings/activities/refresh', { method: 'POST', body: {} });
    await requestJson(baseUrl, '/api/company/fiscal-settings/activities/620100', { method: 'PATCH', body: { billingEnabled: true } });
    await requestJson(baseUrl, '/api/company/fiscal-settings/activities/620100', { method: 'PATCH', body: { billingEnabled: false } });
    await requestJson(baseUrl, '/api/company/fiscal-settings/activities/default', { method: 'PUT', body: { code: '620100' } });
  }));

  assert.deepEqual(auditEvents.map((event) => event.action), [
    'fiscal.activities.refresh.requested',
    'fiscal.activity.enabled',
    'fiscal.activity.disabled',
    'fiscal.activity.default_changed',
  ]);
  assert.deepEqual(auditEvents.map((event) => event.outcome), ['SUCCESS', 'SUCCESS', 'SUCCESS', 'SUCCESS']);
  assert.deepEqual(auditEvents.map((event) => event.resourceType), ['fiscal-settings', 'fiscal-settings', 'fiscal-settings', 'fiscal-settings']);
  assert.equal(auditEvents[1].metadata.activityCode, '620100');
  assert.equal(auditEvents[2].metadata.activityCode, '620100');
  assert.equal(auditEvents[3].metadata.activityCode, '620100');
  assert.equal(auditEvents.every((event) => event.req.auth.sub === '101'), true);
  assert.equal(auditEvents.every((event) => event.req.auth.companyId === '77'), true);
  const safeAuditProjection = auditEvents.map((event) => ({
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    outcome: event.outcome,
    metadata: event.metadata,
  }));
  assert.equal(JSON.stringify(safeAuditProjection).includes('fake-api-key'), false);
  assert.equal(JSON.stringify(safeAuditProjection).includes('env:BILLING_TEST_API_KEY'), false);
  assert.equal(JSON.stringify(safeAuditProjection).includes('haciendaPassword'), false);
  assert.equal(JSON.stringify(safeAuditProjection).includes('certificatePin'), false);
  assert.deepEqual(serviceCalls.map((call) => call[0]), ['refresh', 'patch', 'patch', 'default']);
});

test('unauthorized and failed fiscal mutations do not record false successful audit events or duplicate Billing calls', async () => {
  const auditEvents = [];
  const serviceCalls = [];
  await withStubs([
    [audit, { recordAuditEventSafelyIfAvailable: async (payload) => { auditEvents.push(payload); } }],
    [fiscalSettingsService, {
      refreshFiscalActivities: async () => { serviceCalls.push('refresh'); throw Object.assign(new Error('Billing failed'), { statusCode: 502, code: 'BILLING_UNAVAILABLE' }); },
      updateFiscalActivity: async () => { serviceCalls.push('patch'); return canonicalResponse(); },
    }],
  ], () => withHttpServer(async (baseUrl) => {
    const denied = await requestJson(baseUrl, '/api/company/fiscal-settings/activities/620100', { method: 'PATCH', userId: 401, body: { billingEnabled: true } });
    const failed = await requestJson(baseUrl, '/api/company/fiscal-settings/activities/refresh', { method: 'POST', userId: 302, body: {} });
    assert.equal(denied.status, 403);
    assert.equal(failed.status, 502);
  }));

  assert.deepEqual(serviceCalls, ['refresh']);
  assert.equal(auditEvents.some((event) => event.action?.startsWith('fiscal.') && event.outcome === 'SUCCESS'), false);
});
