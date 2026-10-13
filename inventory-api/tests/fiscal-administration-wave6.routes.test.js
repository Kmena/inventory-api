'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-with-at-least-32-characters';

const { signAccessToken } = require('../src/lib/auth');
const fiscalSettingsService = require('../src/services/fiscal-settings.service');
const { enableDbFreeAuthSeams } = require('./helpers/db-free-auth');
const { enableDbFreeAuditSeams } = require('./helpers/db-free-audit');

const restoreAuth = enableDbFreeAuthSeams([
  { id: '651', companyId: '77', role: { code: 'admin' }, permissions: ['fiscal.settings.view', 'fiscal.credentials.manage'] },
  { id: '652', companyId: '88', role: { code: 'admin' }, permissions: ['fiscal.settings.view', 'fiscal.credentials.manage'] },
  { id: '653', companyId: '77', role: { code: 'viewer' }, permissions: ['fiscal.settings.view'] },
]);
const restoreAudit = enableDbFreeAuditSeams();
process.on('exit', () => { restoreAudit(); restoreAuth(); });

const app = require('../src/app');
const branchId = '40000000-0000-4000-8000-000000000001';
const terminalId = '40000000-0000-4000-8000-000000000002';

function token(userId) {
  return signAccessToken({
    id: BigInt(userId),
    username: `wave6-${userId}`,
    companyId: userId === 652 ? 88n : 77n,
    role: { code: userId === 653 ? 'viewer' : 'admin', rolePermissions: [] },
  });
}

function state(companyId = '77') {
  return {
    environment: 'SANDBOX',
    branches: [{ branchId, code: companyId === '77' ? '001' : '088', name: `Sucursal ${companyId}`, active: true, terminals: [{ terminalId, code: '00001', name: 'Caja principal', active: true }] }],
    defaultIssuancePoint: { environment: 'SANDBOX', branchId, terminalId, branchCode: '001', terminalCode: '00001', name: 'Principal', active: true, isDefault: true },
  };
}

async function withHttpServer(run) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try { return await run(baseUrl); } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function withServiceStubs(stubs, run) {
  const originals = Object.entries(stubs).map(([name]) => [name, fiscalSettingsService[name]]);
  Object.assign(fiscalSettingsService, stubs);
  try { return await run(); } finally {
    for (const [name, value] of originals) fiscalSettingsService[name] = value;
  }
}

function request(baseUrl, path, userId, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token(userId)}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
}

test('Wave 6 routes enforce authentication and existing fiscal administration permissions', async () => {
  await withServiceStubs({
    getFiscalIssuanceAdministration: async () => state(),
    upsertFiscalBranch: async () => state(),
    configureInitialFiscalSequence: async () => ({ environment: 'SANDBOX', terminalId, sequence: null }),
  }, () => withHttpServer(async (baseUrl) => {
    const unauthenticated = await fetch(`${baseUrl}/api/company/fiscal-settings/issuance-points`);
    const viewerRead = await request(baseUrl, '/api/company/fiscal-settings/issuance-points', 653);
    const viewerWrite = await request(baseUrl, '/api/company/fiscal-settings/branches', 653, { method: 'POST', body: JSON.stringify({ code: '001', name: 'Sucursal' }) });
    const viewerSequenceWrite = await request(baseUrl, '/api/company/fiscal-settings/sequences/initial', 653, { method: 'PUT', body: JSON.stringify({ terminalId, documentType: 'INVOICE', nextValue: 1, confirmed: true }) });
    assert.equal(unauthenticated.status, 401);
    assert.equal(viewerRead.status, 200);
    assert.equal(viewerWrite.status, 403);
    assert.equal(viewerSequenceWrite.status, 403);
  }));
});

test('authorized routes derive company from authentication and ignore hostile company/environment query values', async () => {
  const seen = [];
  await withServiceStubs({
    getFiscalIssuanceAdministration: async (auth) => { seen.push(['read', auth.companyId]); return state(auth.companyId); },
    upsertFiscalBranch: async (auth, payload) => { seen.push(['branch', auth.companyId, payload]); return state(auth.companyId); },
    selectDefaultIssuancePoint: async (auth, selectedTerminalId) => { seen.push(['default', auth.companyId, selectedTerminalId]); return state(auth.companyId); },
    readFiscalSequence: async (auth, selectedTerminalId, documentType) => {
      seen.push(['sequence', auth.companyId, selectedTerminalId, documentType]);
      return { environment: 'SANDBOX', terminalId: selectedTerminalId, sequence: null };
    },
  }, () => withHttpServer(async (baseUrl) => {
    const hostile = '?companyId=999&environment=PRODUCTION&billingCompanyId=other';
    const responses = await Promise.all([
      request(baseUrl, `/api/company/fiscal-settings/issuance-points${hostile}`, 651),
      request(baseUrl, `/api/company/fiscal-settings/branches${hostile}`, 651, { method: 'POST', body: JSON.stringify({ code: '001', name: 'Sucursal segura' }) }),
      request(baseUrl, `/api/company/fiscal-settings/issuance-points/default${hostile}`, 651, { method: 'PUT', body: JSON.stringify({ terminalId }) }),
      request(baseUrl, `/api/company/fiscal-settings/sequences/read${hostile}`, 651, { method: 'POST', body: JSON.stringify({ terminalId, documentType: 'INVOICE' }) }),
    ]);
    assert.deepEqual(responses.map((response) => response.status), [200, 200, 200, 200]);
    const bodies = await Promise.all(responses.map((response) => response.json()));
    assert.doesNotMatch(JSON.stringify(bodies), /billingCompanyId|billingTenantId|secretReference|apiKey|password/i);
  }));
  assert.ok(seen.every((entry) => entry[1] === '77'));
});

test('Wave 6 request validation rejects malformed codes, arbitrary sequence reset fields and missing confirmation', async () => {
  let calls = 0;
  await withServiceStubs({
    upsertFiscalBranch: async () => { calls += 1; return state(); },
    upsertFiscalTerminal: async () => { calls += 1; return state(); },
    configureInitialFiscalSequence: async () => { calls += 1; return {}; },
  }, () => withHttpServer(async (baseUrl) => {
    const invalidBranch = await request(baseUrl, '/api/company/fiscal-settings/branches', 651, { method: 'POST', body: JSON.stringify({ code: '1', name: 'Sucursal' }) });
    const invalidTerminal = await request(baseUrl, `/api/company/fiscal-settings/branches/${branchId}/terminals`, 651, { method: 'POST', body: JSON.stringify({ code: '1', name: 'Caja' }) });
    const resetAttempt = await request(baseUrl, '/api/company/fiscal-settings/sequences/initial', 651, { method: 'PUT', body: JSON.stringify({ terminalId, documentType: 'INVOICE', nextValue: 0, reset: true }) });
    const missingConfirmation = await request(baseUrl, '/api/company/fiscal-settings/sequences/initial', 651, { method: 'PUT', body: JSON.stringify({ terminalId, documentType: 'INVOICE', nextValue: 1 }) });
    assert.deepEqual([invalidBranch.status, invalidTerminal.status, resetAttempt.status, missingConfirmation.status], [400, 400, 400, 400]);
    assert.equal(calls, 0);
  }));
});
