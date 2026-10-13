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
  { id: '501', companyId: '77', role: { code: 'admin' }, permissions: ['fiscal.settings.view', 'fiscal.credentials.manage'] },
  { id: '502', companyId: '88', role: { code: 'admin' }, permissions: ['fiscal.settings.view', 'fiscal.credentials.manage'] },
  { id: '503', companyId: '77', role: { code: 'viewer' }, permissions: ['fiscal.settings.view'] },
  { id: '504', companyId: '77', role: { code: 'viewer' }, permissions: [] },
]);
const restoreAudit = enableDbFreeAuditSeams();
process.on('exit', () => { restoreAudit(); restoreAuth(); });

const app = require('../src/app');

function token(userId) {
  return signAccessToken({
    id: BigInt(userId), username: `wave5-${userId}`, companyId: userId === 502 ? 88n : 77n,
    role: { code: userId >= 503 ? 'viewer' : 'admin', rolePermissions: [] },
  });
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

function safeSecurity(companyId = '77') {
  return {
    environment: 'SANDBOX',
    connection: { environment: 'SANDBOX', status: 'CONNECTED', usernameMasked: `company-${companyId}-***`, lastValidatedAt: '2026-10-12T00:00:00.000Z' },
    certificate: { environment: 'SANDBOX', status: 'ACTIVE', serialNumber: '01AB', validTo: '2027-10-12T00:00:00.000Z', expiryState: 'VALID', daysRemaining: 365 },
  };
}

test('Wave 5 security routes require authentication and existing permissions', async () => {
  await withServiceStubs({
    getFiscalSecurityConfiguration: async () => safeSecurity(),
    writeFiscalCertificate: async () => safeSecurity(),
    disableHaciendaConnection: async () => ({ connection: { environment: 'SANDBOX', status: 'DISABLED' } }),
  }, () => withHttpServer(async (baseUrl) => {
    const unauthenticated = await fetch(`${baseUrl}/api/company/fiscal-settings/security`);
    const noView = await fetch(`${baseUrl}/api/company/fiscal-settings/security`, { headers: { Authorization: `Bearer ${token(504)}` } });

    const form = new globalThis.FormData();
    form.append('certificate', new globalThis.Blob(['synthetic']), 'synthetic.p12');
    form.append('pin', 'synthetic-pin');
    const viewOnlyWrite = await fetch(`${baseUrl}/api/company/fiscal-settings/certificate`, {
      method: 'POST', headers: { Authorization: `Bearer ${token(503)}` }, body: form,
    });
    const unauthenticatedDisable = await fetch(`${baseUrl}/api/company/fiscal-settings/hacienda-credentials/disable`, { method: 'POST' });
    const viewOnlyDisable = await fetch(`${baseUrl}/api/company/fiscal-settings/hacienda-credentials/disable`, {
      method: 'POST', headers: { Authorization: `Bearer ${token(503)}` },
    });

    assert.equal(unauthenticated.status, 401);
    assert.equal(noView.status, 403);
    assert.equal(viewOnlyWrite.status, 403);
    assert.equal(unauthenticatedDisable.status, 401);
    assert.equal(viewOnlyDisable.status, 403);
  }));
});

test('authorized Hacienda disable is company-scoped from auth and returns only canonical safe state', async () => {
  const seen = [];
  await withServiceStubs({
    disableHaciendaConnection: async (auth) => {
      seen.push(auth.companyId);
      return { connection: { environment: 'SANDBOX', status: 'DISABLED', configured: true } };
    },
  }, () => withHttpServer(async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/company/fiscal-settings/hacienda-credentials/disable?companyId=999&environment=PRODUCTION`,
      { method: 'POST', headers: { Authorization: `Bearer ${token(501)}` } },
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.connection.status, 'DISABLED');
    assert.doesNotMatch(JSON.stringify(body), /billingCompanyId|billingTenantId|secretReference|password|token|apiKey/i);
  }));
  assert.deepEqual(seen, ['77']);
});

test('security read derives company scope from auth and never returns Billing bindings or secrets', async () => {
  const seen = [];
  await withServiceStubs({
    getFiscalSecurityConfiguration: async (auth) => { seen.push(auth.companyId); return safeSecurity(auth.companyId); },
  }, () => withHttpServer(async (baseUrl) => Promise.all([
    fetch(`${baseUrl}/api/company/fiscal-settings/security?companyId=88&environment=PRODUCTION`, { headers: { Authorization: `Bearer ${token(501)}` } }),
    fetch(`${baseUrl}/api/company/fiscal-settings/security?companyId=77&environment=PRODUCTION`, { headers: { Authorization: `Bearer ${token(502)}` } }),
  ]).then(async (responses) => {
    const bodies = await Promise.all(responses.map((response) => response.json()));
    assert.deepEqual(responses.map((response) => response.status), [200, 200]);
    assert.equal(bodies[0].connection.usernameMasked, 'company-77-***');
    assert.equal(bodies[1].connection.usernameMasked, 'company-88-***');
    assert.doesNotMatch(JSON.stringify(bodies), /billingCompanyId|billingTenantId|secretReference|password|privateKey|pin/i);
  })));
  assert.deepEqual(seen.sort(), ['77', '88']);
});

test('authorized certificate upload is bounded, company-scoped and clears request material', async () => {
  const calls = [];
  await withServiceStubs({
    writeFiscalCertificate: async (auth, upload, replace) => {
      calls.push({ companyId: auth.companyId, replace, bytes: Buffer.from(upload.certificateBytes), pin: upload.pin });
      return { environment: 'SANDBOX', certificate: safeSecurity().certificate };
    },
  }, () => withHttpServer(async (baseUrl) => {
    const upload = async (method, userId) => {
      const form = new globalThis.FormData();
      form.append('certificate', new globalThis.Blob(['synthetic-pkcs12']), '../unsafe-name.p12');
      form.append('pin', 'write-only-pin');
      return fetch(`${baseUrl}/api/company/fiscal-settings/certificate?companyId=999&environment=PRODUCTION`, {
        method, headers: { Authorization: `Bearer ${token(userId)}` }, body: form,
      });
    };
    const created = await upload('POST', 501);
    const replaced = await upload('PUT', 502);
    const createdBody = await created.json();
    const replacedBody = await replaced.json();

    assert.equal(created.status, 201);
    assert.equal(replaced.status, 200);
    assert.deepEqual(calls.map((call) => [call.companyId, call.replace]), [['77', false], ['88', true]]);
    assert.equal(calls[0].bytes.toString(), 'synthetic-pkcs12');
    assert.equal(calls[0].pin, 'write-only-pin');
    assert.doesNotMatch(JSON.stringify([createdBody, replacedBody]), /write-only-pin|synthetic-pkcs12|unsafe-name|privateKey|secretReference/i);
  }));
});

test('certificate route rejects wrong content type, missing PIN and payload over 1 MiB before forwarding', async () => {
  let calls = 0;
  await withServiceStubs({
    writeFiscalCertificate: async () => { calls += 1; return { environment: 'SANDBOX', certificate: safeSecurity().certificate }; },
  }, () => withHttpServer(async (baseUrl) => {
    const headers = { Authorization: `Bearer ${token(501)}` };
    const wrongType = await fetch(`${baseUrl}/api/company/fiscal-settings/certificate`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}' });

    const missingPinForm = new globalThis.FormData();
    missingPinForm.append('certificate', new globalThis.Blob(['synthetic']), 'synthetic.p12');
    const missingPin = await fetch(`${baseUrl}/api/company/fiscal-settings/certificate`, { method: 'POST', headers, body: missingPinForm });

    const largeForm = new globalThis.FormData();
    largeForm.append('certificate', new globalThis.Blob([Buffer.alloc(1_048_577)]), 'large.p12');
    largeForm.append('pin', 'pin');
    const tooLarge = await fetch(`${baseUrl}/api/company/fiscal-settings/certificate`, { method: 'POST', headers, body: largeForm });

    assert.equal(wrongType.status, 415);
    assert.equal(missingPin.status, 400);
    assert.equal(tooLarge.status, 413);
    assert.equal(calls, 0);
  }));
});
