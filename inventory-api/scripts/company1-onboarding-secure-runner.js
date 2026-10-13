'use strict';

/* global Blob, FormData */

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const {
  EncryptedFileSecretProvider,
} = require('/app/dist/src/infrastructure/secrets/adapters/encrypted-file-secret-provider.adapter.js');

const required = (name) => {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const inventoryOrigin = required('INVENTORI_TEST_ORIGIN');
const inventoryPassword = required('INVENTORI_TEST_PASSWORD');
const sourceBillingCompanyId = required('SOURCE_BILLING_COMPANY_ID');
const testTenantId = required('TEST_BILLING_TENANT_ID');
const prisma = new PrismaClient();

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function parseResponse(response, label) {
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.arrayBuffer();
  if (!response.ok) {
    const code = body?.error?.code || body?.code || body?.error || 'HTTP_ERROR';
    throw new Error(`${label} failed: HTTP ${response.status} ${code}`);
  }
  return body;
}

async function login() {
  const response = await fetch(`${inventoryOrigin}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-inventory-browser-session': 'cookie',
      origin: inventoryOrigin,
    },
    body: JSON.stringify({ username: 'admin', password: inventoryPassword }),
  });
  await parseResponse(response, 'Inventori login');
  const values = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  const cookie = values.map((entry) => entry.split(';')[0]).join('; ');
  if (!cookie.includes('inventory_browser_session=')) throw new Error('Browser session cookie missing');
  return cookie;
}

function client(cookie) {
  return async function request(method, route, body, options = {}) {
    const headers = { cookie, origin: inventoryOrigin };
    let payload;
    if (body instanceof FormData) {
      payload = body;
    } else if (body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const response = await fetch(`${inventoryOrigin}${route}`, { method, headers, body: payload });
    if (options.bytes) {
      if (!response.ok) await parseResponse(response, `${method} ${route}`);
      return {
        contentType: response.headers.get('content-type'),
        bytes: Buffer.from(await response.arrayBuffer()),
      };
    }
    return parseResponse(response, `${method} ${route}`);
  };
}

function generateCompany1Certificate() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'company1-pkcs12-'));
  const key = path.join(root, 'key.pem');
  const certificate = path.join(root, 'certificate.pem');
  const bundle = path.join(root, 'company1.p12');
  const pin = crypto.randomBytes(24).toString('base64url');
  const commands = [
    ['req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-days', '3650',
      '-subj', '/C=CR/O=Inventori Demo/serialNumber=CPJ-3101000000/CN=Inventori Demo',
      '-keyout', key, '-out', certificate],
    ['pkcs12', '-export', '-out', bundle, '-inkey', key, '-in', certificate, '-passout', `pass:${pin}`],
  ];
  for (const args of commands) {
    const result = spawnSync('openssl', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    if (result.status !== 0) throw new Error('Disposable PKCS#12 generation failed');
  }
  return { root, pin, bytes: fs.readFileSync(bundle) };
}

async function main() {
  const provider = new EncryptedFileSecretProvider({
    rootPath: required('LOCAL_SECRET_STORE_PATH'),
    masterKeyPath: required('LOCAL_SECRET_STORE_MASTER_KEY_PATH'),
    requiredMarker: process.env.LOCAL_SECRET_STORE_REQUIRED_MARKER,
  });
  await provider.ensureReady();
  const sourceConnection = await prisma.haciendaConnection.findFirst({
    where: { companyId: sourceBillingCompanyId, environment: 'SANDBOX' },
    select: { secretReference: true },
  });
  if (!sourceConnection) throw new Error('Source SANDBOX Hacienda connection is missing in the isolated clone');
  const recoveredCredentials = JSON.parse(await provider.getSecret(sourceConnection.secretReference));
  if (!recoveredCredentials?.username || !recoveredCredentials?.password) {
    throw new Error('Recovered Hacienda credential payload is invalid');
  }

  const cookie = await login();
  const request = client(cookie);
  const existingExecutionId = String(process.env.EXISTING_EXECUTION_ID || '').trim();
  let activity;
  let readiness;
  if (!existingExecutionId) {
  let administration = await request('GET', '/api/company/fiscal-settings/issuer');
  if (administration?.association?.status === 'NOT_ASSOCIATED') {
    administration = await request('POST', '/api/company/fiscal-settings/issuer/provision', {});
  }
  if (administration?.association?.status !== 'ASSOCIATED') {
    throw new Error(`Unexpected association status ${administration?.association?.status || 'UNKNOWN'}`);
  }

  await request('PUT', '/api/company/fiscal-settings/issuer', {
    profile: {
      economicActivityCode: '620210',
      proveedorSistemas: '3101000000',
      province: '1',
      canton: '01',
      district: '01',
      barrio: 'Carmen',
      otrasSenas: 'Entorno desechable de validación local',
      email: 'fiscal-company1@example.invalid',
      phoneCountryCode: '506',
      phoneNumber: '22223333',
    },
  });

  const settings = await request('POST', '/api/company/fiscal-settings/activities/refresh');
  activity = (settings.activities || []).find((item) => item.code === '620210');
  if (!activity) throw new Error('Mock Hacienda did not return company 1 activity 620210');
  if (!activity.billingEnabled) {
    await request('PATCH', `/api/company/fiscal-settings/activities/${encodeURIComponent(activity.code)}`, {
      billingEnabled: true,
    });
  }
  await request('PUT', '/api/company/fiscal-settings/activities/default', { code: activity.code });

  await request('PUT', '/api/company/fiscal-settings/hacienda-credentials', {
    username: recoveredCredentials.username,
    password: recoveredCredentials.password,
  });
  const connection = await request('POST', '/api/company/fiscal-settings/hacienda-credentials/validate');
  if (connection?.connection?.status !== 'CONNECTED') throw new Error('Mock Hacienda validation did not connect');

  const generated = generateCompany1Certificate();
  try {
    const form = new FormData();
    form.append('certificate', new Blob([generated.bytes], { type: 'application/x-pkcs12' }), 'company1.p12');
    form.append('pin', generated.pin);
    const certificate = await request('POST', '/api/company/fiscal-settings/certificate', form);
    if (certificate?.certificate?.status !== 'ACTIVE') throw new Error('Synthetic certificate did not activate');
    if (certificate?.certificate?.extractedIdentityNumber !== '3101000000') {
      throw new Error('Synthetic certificate identity does not match company 1');
    }
  } finally {
    generated.bytes.fill(0);
    fs.rmSync(generated.root, { recursive: true, force: true });
  }

  const branchResult = await request('POST', '/api/company/fiscal-settings/branches', {
    code: '001', name: 'Sucursal principal',
  });
  const branch = (branchResult.branches || []).find((item) => item.code === '001');
  if (!branch) throw new Error('Branch 001 was not created');
  const terminalResult = await request(
    'POST',
    `/api/company/fiscal-settings/branches/${encodeURIComponent(branch.branchId)}/terminals`,
    { code: '00001', name: 'Caja principal' },
  );
  const terminal = (terminalResult.branches || [])
    .flatMap((item) => item.terminals || [])
    .find((item) => item.code === '00001');
  if (!terminal) throw new Error('Terminal 00001 was not created');
  await request('PUT', '/api/company/fiscal-settings/issuance-points/default', {
    terminalId: terminal.terminalId,
  });
  await request('PUT', '/api/company/fiscal-settings/sequences/initial', {
    terminalId: terminal.terminalId,
    documentType: 'INVOICE',
    nextValue: 1,
    confirmed: true,
  });

  readiness = await request('GET', '/api/company/fiscal-settings/readiness');
  if (readiness?.readyToIssue !== true || readiness?.status !== 'READY') {
    throw new Error(`Readiness failed: ${(readiness?.blockers || []).join(',')}`);
  }
  }

  const initiated = existingExecutionId ? { executionId: existingExecutionId } : await request('POST', '/api/company/fiscal-settings/test-invoices', {
    idempotencyKey: crypto.randomUUID(),
    confirmed: true,
    receiver: {
      name: 'Receptor sintético Company 1',
      identificationType: 'JURIDICA',
      identificationNumber: '3101000001',
      email: 'receiver-company1@example.invalid',
    },
    currency: 'CRC',
    saleCondition: '01',
    paymentMethod: '01',
    lines: [{
      lineNumber: 1,
      cabysCode: '1234567890123',
      description: 'Prueba de onboarding fiscal Company 1',
      unitMeasure: 'Sp',
      quantity: '1.00000',
      unitPrice: '1000.00000',
      taxAmount: '130.00000',
      taxCode: '01',
      taxRateCode: '08',
      taxRate: '13.00000',
    }],
  });
  if (existingExecutionId) {
    const settings = await request('GET', '/api/company/fiscal-settings');
    activity = (settings.activities || []).find((item) => item.code === '620210');
    readiness = await request('GET', '/api/company/fiscal-settings/readiness');
    if (!activity || readiness?.readyToIssue !== true) throw new Error('Recovered onboarding state is not ready');
  }

  let status;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      status = await request('GET', `/api/company/fiscal-settings/test-invoices/${encodeURIComponent(initiated.executionId)}`);
    } catch (error) {
      if (!/HTTP 429\b/.test(String(error?.message || error))) throw error;
      await wait(3000);
      continue;
    }
    if (status?.submission?.status === 'ACCEPTED' && (status.artifacts || []).length >= 3) break;
    await wait(2000);
  }
  if (status?.submission?.status !== 'ACCEPTED') throw new Error('Mock Hacienda did not accept the test invoice');
  if (!status?.xmlProcessing?.signedXmlAvailable) throw new Error('Signed XML is unavailable');

  const artifactEvidence = [];
  for (const artifact of status.artifacts || []) {
    const downloaded = await request(
      'GET',
      `/api/company/fiscal-settings/test-invoices/${encodeURIComponent(initiated.executionId)}/artifacts/${encodeURIComponent(artifact.type)}`,
      undefined,
      { bytes: true },
    );
    if (downloaded.bytes.length === 0) throw new Error(`Artifact ${artifact.type} is empty`);
    artifactEvidence.push({
      type: artifact.type,
      contentType: downloaded.contentType,
      sizeBytes: downloaded.bytes.length,
      sha256: crypto.createHash('sha256').update(downloaded.bytes).digest('hex'),
    });
  }

  const association = await prisma.fiscalIntegrationAssociation.findUnique({
    where: {
      tenantId_provider_externalCompanyKey: {
        tenantId: testTenantId,
        provider: 'INVENTORI',
        externalCompanyKey: 'inventori:company:1',
      },
    },
  });
  if (!association) throw new Error('Disposable Billing association is missing');
  let deliveries = [];
  for (let attempt = 0; attempt < 40; attempt += 1) {
    deliveries = await prisma.documentDelivery.findMany({
      where: { tenantId: testTenantId, companyId: association.companyId },
      select: { kind: true, channel: true, status: true, attemptCount: true },
      orderBy: { createdAt: 'asc' },
    });
    if (deliveries.length > 0 && deliveries.every((item) => item.status === 'DELIVERED')) break;
    await wait(500);
  }

  const finalAdministration = await request('GET', '/api/company/fiscal-settings/issuer');
  const finalSecurity = await request('GET', '/api/company/fiscal-settings/security');
  const issuance = await request('GET', '/api/company/fiscal-settings/issuance-points');
  process.stdout.write(`${JSON.stringify({
    companyId: '1',
    association: finalAdministration.association,
    issuer: {
      identificationType: finalAdministration.issuer?.identificationType,
      identificationNumber: finalAdministration.issuer?.identificationNumber,
      identityLockPolicy: finalAdministration.issuer?.identityLockPolicy,
    },
    economicActivity: activity.code,
    haciendaConnection: finalSecurity.connection?.status,
    certificate: {
      status: finalSecurity.certificate?.status,
      extractedIdentityNumber: finalSecurity.certificate?.extractedIdentityNumber,
      fingerprintSha256: finalSecurity.certificate?.fingerprintSha256,
    },
    issuance: {
      branches: issuance.branches?.length || 0,
      terminals: (issuance.branches || []).reduce((sum, item) => sum + (item.terminals?.length || 0), 0),
      defaultConfigured: Boolean(issuance.defaultIssuancePoint),
    },
    readiness: { status: readiness.status, readyToIssue: readiness.readyToIssue, blockers: readiness.blockers || [] },
    testInvoice: {
      executionId: initiated.executionId,
      submissionStatus: status.submission?.status,
      haciendaAccepted: status.submission?.haciendaAccepted === true,
      signedXmlAvailable: status.xmlProcessing?.signedXmlAvailable === true,
    },
    artifacts: artifactEvidence,
    deliveries,
    recoveredCredentialValuesPrinted: false,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
