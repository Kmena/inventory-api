'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-with-at-least-32-characters';

const { signAccessToken } = require('../src/lib/auth');
const fiscalSettingsService = require('../src/services/fiscal-settings.service');
const { enableDbFreeAuthSeams } = require('./helpers/db-free-auth');

const FISCAL_PERMISSIONS = [
  'fiscal.settings.view',
  'fiscal.activities.refresh',
  'fiscal.activities.manage',
  'fiscal.activities.default.update',
];

const restoreAuth = enableDbFreeAuthSeams([
  { id: '101', companyId: '77', role: { code: 'admin' }, permissions: FISCAL_PERMISSIONS },
  { id: '202', companyId: '88', role: { code: 'admin' }, permissions: FISCAL_PERMISSIONS },
  { id: '303', companyId: '77', role: { code: 'admin' }, permissions: ['fiscal.settings.view'] },
  { id: '404', companyId: '77', role: { code: 'admin' }, permissions: ['fiscal.activities.refresh'] },
  { id: '505', companyId: '77', role: { code: 'admin' }, permissions: ['fiscal.activities.manage'] },
  { id: '606', companyId: '77', role: { code: 'admin' }, permissions: ['fiscal.activities.default.update'] },
  { id: '707', companyId: '77', role: { code: 'admin' }, permissions: [] },
  { id: '808', companyId: '77', role: { code: 'admin' }, permissions: ['company.dashboard'] },
  { id: '909', companyId: '77', role: { code: 'admin' }, permissions: ['users.view', 'settings.manage'] },
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
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    return await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function withServiceStubs(stubs, run) {
  const originals = Object.entries(stubs).map(([name]) => [name, fiscalSettingsService[name]]);
  for (const [name, value] of Object.entries(stubs)) {
    fiscalSettingsService[name] = value;
  }
  try {
    return await run();
  } finally {
    for (const [name, value] of originals) {
      fiscalSettingsService[name] = value;
    }
  }
}

function canonicalResponse() {
  return {
    taxpayer: {
      verificationStatus: 'VERIFIED',
      verifiedAt: '2026-09-28T00:00:00.000Z',
      taxSituation: 'AL_DIA',
      moroso: false,
      omiso: false,
    },
    activities: [
      {
        code: '620100',
        description: 'Software',
        haciendaStatus: 'A',
        haciendaKind: 'PRINCIPAL',
        billingEnabled: true,
        isDefault: true,
        verifiedAt: '2026-09-28T00:00:00.000Z',
        lastSeenAt: '2026-09-28T00:00:00.000Z',
        verificationSource: 'HACIENDA',
      },
    ],
    defaultActivityCode: '620100',
    configuration: { hasBillingIntegration: true },
  };
}

async function parseJson(response) {
  return response.json();
}

test('GET /api/company/fiscal-settings requires authentication', async () => {
  await withHttpServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/company/fiscal-settings`);
    assert.equal(response.status, 401);
  });
});

test('GET /api/company/fiscal-settings returns authenticated safe response scoped to current company', async () => {
  const calls = [];
  await withServiceStubs({
    getFiscalSettings: async (auth) => {
      calls.push(auth);
      return canonicalResponse();
    },
  }, () => withHttpServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/company/fiscal-settings?billingCompanyId=evil&billingTenantId=evil`, {
      headers: { Authorization: `Bearer ${buildToken(101)}` },
    });
    const body = await parseJson(response);

    assert.equal(response.status, 200);
    assert.equal(calls[0].companyId, '77');
    assert.equal(body.defaultActivityCode, '620100');
    assert.equal(JSON.stringify(body).includes('billingCompanyId'), false);
    assert.equal(JSON.stringify(body).includes('billingTenantId'), false);
    assert.equal(JSON.stringify(body).includes('secretReference'), false);
  }));
});

test('Company A request cannot cause Company B mapping to be used', async () => {
  const seenCompanyIds = [];
  await withServiceStubs({
    getFiscalSettings: async (auth) => {
      seenCompanyIds.push(auth.companyId);
      return canonicalResponse();
    },
  }, () => withHttpServer(async (baseUrl) => Promise.all([
    fetch(`${baseUrl}/api/company/fiscal-settings?companyId=88`, {
      headers: { Authorization: `Bearer ${buildToken(101)}` },
    }),
    fetch(`${baseUrl}/api/company/fiscal-settings?companyId=77`, {
      headers: { Authorization: `Bearer ${buildToken(202)}` },
    }),
  ])));

  assert.deepEqual(seenCompanyIds.sort(), ['77', '88']);
});

test('POST refresh succeeds with mocked Billing service and does not accept Billing internals', async () => {
  const calls = [];
  await withServiceStubs({
    refreshFiscalActivities: async (auth) => {
      calls.push(auth);
      return canonicalResponse();
    },
  }, () => withHttpServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/company/fiscal-settings/activities/refresh`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${buildToken(101)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ billingCompanyId: 'evil', billingTenantId: 'evil', secretReference: 'env:EVIL' }),
    });
    const body = await parseJson(response);

    assert.equal(response.status, 200);
    assert.equal(calls[0].companyId, '77');
    assert.equal(JSON.stringify(body).includes('EVIL'), false);
  }));
});

test('PATCH activity accepts true and false and passes logical activity code', async () => {
  const calls = [];
  await withServiceStubs({
    updateFiscalActivity: async (auth, code, billingEnabled) => {
      calls.push({ auth, code, billingEnabled });
      return canonicalResponse();
    },
  }, () => withHttpServer(async (baseUrl) => Promise.all([
    fetch(`${baseUrl}/api/company/fiscal-settings/activities/620100`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${buildToken(101)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ billingEnabled: true }),
    }),
    fetch(`${baseUrl}/api/company/fiscal-settings/activities/code%2Fwith%20space`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${buildToken(101)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ billingEnabled: false }),
    }),
  ])));

  // Requests are concurrent — assert by code to avoid race-condition ordering assumption
  const call620 = calls.find((c) => c.code === '620100');
  const callSlash = calls.find((c) => c.code === 'code/with space');
  assert.ok(call620, 'call for 620100 must be present');
  assert.ok(callSlash, 'call for code/with space must be present');
  assert.equal(call620.billingEnabled, true);
  assert.equal(callSlash.billingEnabled, false);
});

test('PATCH activity rejects invalid, missing or integration-override body fields', async () => {
  await withServiceStubs({
    updateFiscalActivity: async () => canonicalResponse(),
  }, () => withHttpServer(async (baseUrl) => {
    const headers = { Authorization: `Bearer ${buildToken(101)}`, 'Content-Type': 'application/json' };
    const [stringBoolean, missingBoolean, override] = await Promise.all([
      fetch(`${baseUrl}/api/company/fiscal-settings/activities/620100`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ billingEnabled: 'true' }),
      }),
      fetch(`${baseUrl}/api/company/fiscal-settings/activities/620100`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({}),
      }),
      fetch(`${baseUrl}/api/company/fiscal-settings/activities/620100`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ billingEnabled: true, billingCompanyId: 'evil' }),
      }),
    ]);
    assert.equal(stringBoolean.status, 400);
    assert.equal(missingBoolean.status, 400);
    assert.equal(override.status, 400);
  }));
});

test('PUT default accepts valid code and rejects missing or invalid code', async () => {
  const calls = [];
  await withServiceStubs({
    setDefaultFiscalActivity: async (auth, code) => {
      calls.push({ auth, code });
      return canonicalResponse();
    },
  }, () => withHttpServer(async (baseUrl) => {
    const headers = { Authorization: `Bearer ${buildToken(101)}`, 'Content-Type': 'application/json' };
    const success = await fetch(`${baseUrl}/api/company/fiscal-settings/activities/default`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ code: '620100' }),
    });
    const missing = await fetch(`${baseUrl}/api/company/fiscal-settings/activities/default`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({}),
    });
    const blank = await fetch(`${baseUrl}/api/company/fiscal-settings/activities/default`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ code: '   ' }),
    });
    const override = await fetch(`${baseUrl}/api/company/fiscal-settings/activities/default`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ code: '620100', secretReference: 'env:EVIL' }),
    });

    assert.equal(success.status, 200);
    assert.equal(missing.status, 400);
    assert.equal(blank.status, 400);
    assert.equal(override.status, 400);
  }));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].code, '620100');
  assert.equal(calls[0].auth.companyId, '77');
});
