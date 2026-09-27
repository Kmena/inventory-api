/**
 * TASK-013 — Billing fiscal status projection and reconciliation tests.
 *
 * Suite 1: Pure unit tests (always run, no database required).
 *   - Status mapping rules including HTTP 202 invariant.
 *   - Query failure classification.
 *   - Rejection diagnostics sanitization.
 *   - Identifier conflict detection.
 *
 * Suite 2: PostgreSQL-backed integration tests (requires
 *   INVENTORI_BILLING_POSTGRES_TEST=1 and a reachable Inventori PostgreSQL).
 *   - Atomic reconciliation claim / concurrent reconcilers.
 *   - ACCEPTED / REJECTED / PROCESSING persistence.
 *   - Crash / restart scenarios A–D.
 *   - Commercial/fiscal independence.
 *   - Identifier conflict protection.
 *   - Sentinel secret non-exposure.
 *   - Proof that Inventori never calls a direct Hacienda endpoint.
 */

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Environment bootstrap
// ---------------------------------------------------------------------------

function parseEnvFile(filePath) {
  const result = {};
  if (!fs.existsSync(filePath)) return result;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match) result[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return result;
}

function resolvePostgresDatabaseUrl() {
  if (process.env.INVENTORI_BILLING_DATABASE_URL) return process.env.INVENTORI_BILLING_DATABASE_URL;
  const env = parseEnvFile(path.join(__dirname, '..', '.env'));
  const requiredKeys = ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB', 'POSTGRES_PORT'];
  if (requiredKeys.some((k) => !env[k])) return null;
  return `postgresql://${env.POSTGRES_USER}:${env.POSTGRES_PASSWORD}@localhost:${env.POSTGRES_PORT}/${env.POSTGRES_DB}?schema=public`;
}

const postgresDatabaseUrl = resolvePostgresDatabaseUrl();
if (postgresDatabaseUrl) process.env.DATABASE_URL = postgresDatabaseUrl;
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

const { BillingApiClient: UnitBillingApiClient, BillingClientError } = require('../src/services/billing-api-client.service');
const {
  resolveCanonicalFiscalStatus,
  classifyBillingReconciliationResult,
  sanitizeRejectionDiagnostics,
  classifyReconciliationQueryFailure,
  checkIdentifierConflicts,
  checkBillingChainConsistency,
  BILLING_RECONCILIATION_CONTRACT,
  reconcileFiscalIntentById,
  reconcileNextFiscalIntent,
  RECONCILIATION_POLL_INTERVAL_MS,
} = require('../src/services/fiscal-reconciliation.service');

const runOptions = {
  skip: process.env.INVENTORI_BILLING_POSTGRES_TEST !== '1' || !postgresDatabaseUrl,
};

// ---------------------------------------------------------------------------
// Fake Billing client for reconciliation
// ---------------------------------------------------------------------------

class FakeReconciliationBillingClient {
  constructor(options = {}) {
    this.options = options;
    this.statusCalls = [];
    this.statusByDocumentId = new Map();
  }

  /** Track calls but never expose the secret reference value */
  async getFiscalStatus({ billingFiscalDocumentId, billingCompanyId, environment, correlationId }) {
    this.statusCalls.push({ billingFiscalDocumentId, billingCompanyId, environment, correlationId });
    if (this.options.throwOnStatus) throw this.options.throwOnStatus;
    const response = this.statusByDocumentId.get(billingFiscalDocumentId);
    return response ?? { id: billingFiscalDocumentId, fiscalStatus: 'PROCESSING' };
  }

  setStatus(documentId, response) {
    this.statusByDocumentId.set(documentId, response);
  }

  get callCount() { return this.statusCalls.length; }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function stringifyPersisted(value) {
  return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
}

// ---------------------------------------------------------------------------
// SUITE 1: Pure unit tests — no PostgreSQL required
// ---------------------------------------------------------------------------

describe('TASK-013 Billing reconciliation — status mapping (no database)', () => {

  // ── HTTP 202 invariant ─────────────────────────────────────────────────
  test('HTTP 202 transport alone does NOT produce ACCEPTED', () => {
    // Simulates a Billing response where the body only carries transport/submission
    // status like "202" or "PROCESSING" but NOT an explicit ACCEPTED fiscal status.
    const processingResponses = [
      { id: 'doc-1', fiscalStatus: 'PROCESSING' },
      { id: 'doc-1', fiscalStatus: 'PROCESSING', httpStatusNote: '202 accepted for processing' },
      { id: 'doc-1', billingStatus: '202', fiscalStatus: null },
      { id: 'doc-1', billingStatus: 'SUBMITTED' },
      { id: 'doc-1', status: 'IN_PROCESS' },
      { id: 'doc-1', haciendaStatus: 'EN_PROCESO' },
    ];
    for (const response of processingResponses) {
      const result = classifyBillingReconciliationResult(response);
      assert.notEqual(result.intentStatus, 'ACCEPTED',
        `Expected NOT ACCEPTED for response: ${JSON.stringify(response)}`);
    }
  });

  // ── Accepted status mapping ───────────────────────────────────────────
  test('fiscalStatus=ACCEPTED produces intentStatus=ACCEPTED', () => {
    const result = classifyBillingReconciliationResult({ id: 'doc-1', fiscalStatus: 'ACCEPTED' });
    assert.equal(result.intentStatus, 'ACCEPTED');
  });

  test('fiscalStatus=HACIENDA_ACCEPTED maps to ACCEPTED', () => {
    const result = classifyBillingReconciliationResult({ id: 'doc-1', fiscalStatus: 'HACIENDA_ACCEPTED' });
    assert.equal(result.intentStatus, 'ACCEPTED');
  });

  test('haciendaStatus=ACEPTADO maps to ACCEPTED (Spanish canonical)', () => {
    const result = classifyBillingReconciliationResult({ id: 'doc-1', haciendaStatus: 'ACEPTADO' });
    assert.equal(result.intentStatus, 'ACCEPTED');
  });

  test('resolveCanonicalFiscalStatus uses fiscalStatus priority over haciendaStatus', () => {
    // If fiscalStatus says PROCESSING but haciendaStatus says ACCEPTED, use fiscalStatus
    const status = resolveCanonicalFiscalStatus({
      fiscalStatus: 'PROCESSING',
      haciendaStatus: 'ACEPTADO',
    });
    assert.equal(status, 'PROCESSING');
  });

  // ── Rejected status mapping ───────────────────────────────────────────
  test('fiscalStatus=REJECTED produces intentStatus=REJECTED with diagnostics', () => {
    const response = {
      id: 'doc-1',
      fiscalStatus: 'REJECTED',
      rejectionCode: 'COD-001',
      rejectionMessage: 'Campo inválido',
      haciendaMensaje: 'AX-005',
      haciendaDetalleMensaje: 'El campo identificación del receptor no es válido.',
    };
    const result = classifyBillingReconciliationResult(response);
    assert.equal(result.intentStatus, 'REJECTED');
    assert.equal(result.code, 'BILLING_REJECTED');
    assert.ok(result.message);
    assert.ok(result.diagnostics);
    assert.equal(result.diagnostics.rejectionCode, 'COD-001');
    assert.equal(result.diagnostics.haciendaMensaje, 'AX-005');
  });

  test('haciendaStatus=RECHAZADO maps to REJECTED (Spanish canonical)', () => {
    const result = classifyBillingReconciliationResult({ id: 'doc-1', haciendaStatus: 'RECHAZADO' });
    assert.equal(result.intentStatus, 'REJECTED');
  });

  test('fiscalStatus=HACIENDA_REJECTED maps to REJECTED', () => {
    const result = classifyBillingReconciliationResult({ id: 'doc-1', fiscalStatus: 'HACIENDA_REJECTED' });
    assert.equal(result.intentStatus, 'REJECTED');
  });

  // ── Processing status ─────────────────────────────────────────────────
  test('fiscalStatus=PROCESSING stays PROCESSING', () => {
    const result = classifyBillingReconciliationResult({ id: 'doc-1', fiscalStatus: 'PROCESSING' });
    assert.equal(result.intentStatus, 'PROCESSING');
  });

  test('fiscalStatus=SUBMITTED maps to PROCESSING', () => {
    const result = classifyBillingReconciliationResult({ id: 'doc-1', fiscalStatus: 'SUBMITTED' });
    assert.equal(result.intentStatus, 'PROCESSING');
  });

  // ── Fail closed on unknown status ─────────────────────────────────────
  test('unknown/unrecognised Billing status fails closed to null (caller schedules retry)', () => {
    const unknownResponses = [
      { id: 'doc-1', fiscalStatus: 'WEIRD_CUSTOM_STATUS' },
      { id: 'doc-1', fiscalStatus: 'UNKNOWN' },
      { id: 'doc-1', fiscalStatus: null },
      { id: 'doc-1' }, // missing fiscal status entirely
    ];
    for (const response of unknownResponses) {
      const result = classifyBillingReconciliationResult(response);
      assert.equal(result.intentStatus, null,
        `Expected null (fail closed) for: ${JSON.stringify(response)}`);
      assert.equal(result.code, 'BILLING_UNKNOWN_STATUS');
    }
  });

  test('null/empty response fails closed with BILLING_MALFORMED_RESPONSE', () => {
    for (const invalid of [null, undefined, 'string', 42]) {
      const result = classifyBillingReconciliationResult(invalid);
      assert.equal(result.intentStatus, null);
      assert.equal(result.code, 'BILLING_MALFORMED_RESPONSE');
    }
  });

  // ── Rejection diagnostics sanitization ───────────────────────────────
  test('sanitizeRejectionDiagnostics truncates long strings and excludes secrets', () => {
    const longString = 'A'.repeat(2000);
    const response = {
      rejectionCode: 'CODE-1',
      rejectionMessage: longString,
      haciendaMensaje: 'AX-001',
      haciendaDetalleMensaje: longString,
      apiKey: 'secret-key-must-not-appear',
      authorization: 'Bearer token-must-not-appear',
    };
    const diag = sanitizeRejectionDiagnostics(response);
    assert.ok(diag.rejectionMessage.endsWith('[truncated]'));
    assert.ok(diag.haciendaDetalleMensaje.endsWith('[truncated]'));
    assert.equal(diag.rejectionCode, 'CODE-1');
    // Only defined safe fields are included
    assert.equal(diag.apiKey, undefined);
    assert.equal(diag.authorization, undefined);
  });

  test('sanitizeRejectionDiagnostics handles null response', () => {
    assert.equal(sanitizeRejectionDiagnostics(null), null);
  });

  // ── Query failure classification ──────────────────────────────────────
  test('401 status query failure is ERROR_FINAL (auth config broken)', () => {
    const error = new BillingClientError('Unauthorized', { code: 'BILLING_401', statusCode: 401 });
    const result = classifyReconciliationQueryFailure(error, 0);
    assert.equal(result.isFinal, true);
    assert.equal(result.code, 'RECONCILIATION_AUTH_FAILURE');
    assert.equal(result.nextAttemptDelayMs, null);
  });

  test('403 status query failure is ERROR_FINAL (permissions config broken)', () => {
    const error = new BillingClientError('Forbidden', { code: 'BILLING_403', statusCode: 403 });
    const result = classifyReconciliationQueryFailure(error, 0);
    assert.equal(result.isFinal, true);
    assert.equal(result.code, 'RECONCILIATION_PERMISSIONS_FAILURE');
  });

  test('timeout, 404, 429, 500, 503 keep PROCESSING with retry delay', () => {
    const retryableCases = [
      new BillingClientError('timeout', { code: 'BILLING_TIMEOUT', retryable: true }),
      new BillingClientError('not found', { code: 'BILLING_404', statusCode: 404 }),
      new BillingClientError('rate limited', { code: 'BILLING_429', statusCode: 429 }),
      new BillingClientError('server error', { code: 'BILLING_500', statusCode: 500 }),
      new BillingClientError('unavailable', { code: 'BILLING_503', statusCode: 503 }),
    ];
    for (const error of retryableCases) {
      const result = classifyReconciliationQueryFailure(error, 0);
      assert.equal(result.isFinal, false, `Expected non-final for ${error.code}`);
      assert.ok(result.nextAttemptDelayMs > 0, `Expected positive delay for ${error.code}`);
    }
  });

  test('non-BillingClientError keeps PROCESSING with retry delay', () => {
    const result = classifyReconciliationQueryFailure(new Error('network blip'), 0);
    assert.equal(result.isFinal, false);
    assert.ok(result.nextAttemptDelayMs > 0);
  });

  test('failure classification result never contains secret-like content', () => {
    const error = new BillingClientError('failure with sentinel-secret-reconcile in message', { code: 'BILLING_500', statusCode: 500 });
    const result = classifyReconciliationQueryFailure(error, 0);
    // The sanitized message may contain the text (it came from the error message here)
    // but the classification object itself must not add any secret-looking fields
    const serialized = JSON.stringify(result);
    assert.doesNotMatch(serialized, /apiKey|authorization|secretRef|rawKey/i);
  });

  // ── Identifier conflict detection ─────────────────────────────────────
  test('same clave in Billing response does not trigger conflict', () => {
    const intent = { clave: 'clave-123', consecutive: null };
    const response = { clave: 'clave-123', consecutive: '001' };
    assert.equal(checkIdentifierConflicts(intent, response), null);
  });

  test('different clave in Billing response triggers IDENTIFIER_CLAVE_CONFLICT', () => {
    const intent = { clave: 'clave-A', consecutive: null };
    const response = { clave: 'clave-B' };
    const conflict = checkIdentifierConflicts(intent, response);
    assert.ok(conflict, 'Expected conflict to be detected');
    assert.equal(conflict.code, 'IDENTIFIER_CLAVE_CONFLICT');
  });

  test('different consecutive in Billing response triggers IDENTIFIER_CONSECUTIVE_CONFLICT', () => {
    const intent = { clave: null, consecutive: '001-first' };
    const response = { consecutive: '002-different' };
    const conflict = checkIdentifierConflicts(intent, response);
    assert.ok(conflict, 'Expected conflict to be detected');
    assert.equal(conflict.code, 'IDENTIFIER_CONSECUTIVE_CONFLICT');
  });

  test('intent without clave does not conflict when Billing provides one', () => {
    const intent = { clave: null, consecutive: null };
    const response = { clave: 'new-clave', consecutive: 'new-consecutive' };
    assert.equal(checkIdentifierConflicts(intent, response), null);
  });

  test('null response does not trigger conflict', () => {
    const intent = { clave: 'clave-A', consecutive: '001' };
    assert.equal(checkIdentifierConflicts(intent, null), null);
  });

  // ── TASK-016 official Billing read contract ───────────────────────────
  test('BillingApiClient.getFiscalStatus uses official document + submission READ contract', async () => {
    const requests = [];
    const credentialResolver = { resolveApiKey: () => 'sentinel-unit-api-key' };
    const fetchImpl = async (url, options) => {
      requests.push({ url, method: options.method, headers: options.headers });
      assert.equal(options.method, 'GET', 'reconciliation must use READ-only requests');
      assert.equal(options.headers['X-API-Key'], 'sentinel-unit-api-key');
      assert.equal(options.headers['X-Correlation-Id'], 'corr-1');
      assert.equal(options.body, undefined, 'READ request must not carry CREATE/SUBMIT body');

      if (String(url).endsWith('/api/v1/fiscal-documents/doc-123')) {
        return new globalThis.Response(JSON.stringify({
          id: 'doc-123',
          companyId: 'billing-company-1',
          environment: 'SANDBOX',
          idempotencyKey: 'inventori:1698:invoice:1623',
          clave: 'clave-doc',
          consecutive: '00100001010000000001',
          status: 'READY_TO_SUBMIT',
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }

      if (String(url).endsWith('/api/v1/companies/billing-company-1/fiscal-documents/SANDBOX/invoices/doc-123/submission')) {
        return new globalThis.Response(JSON.stringify({
          documentId: 'doc-123',
          submissionId: 'sub-123',
          clave: 'clave-doc',
          environment: 'SANDBOX',
          status: 'ACCEPTED',
          lastProviderStatus: 'aceptado',
          responseSha256: 'sha256-value',
          responseReceivedAt: '2026-09-27T18:00:00.000Z',
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }

      return new globalThis.Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'nope' } }), { status: 404 });
    };

    const client = new UnitBillingApiClient({ baseUrl: 'https://billing.example.test', credentialResolver, fetchImpl });
    const result = await client.getFiscalStatus({
      billingCompanyId: 'billing-company-1',
      environment: 'SANDBOX',
      billingFiscalDocumentId: 'doc-123',
      secretReference: 'env:BILLING_KEY',
      correlationId: 'corr-1',
    });

    assert.equal(requests.length, 2);
    assert.ok(requests[0].url.endsWith('/api/v1/fiscal-documents/doc-123'));
    assert.ok(requests[1].url.endsWith('/submission'));
    assert.equal(result.billingFiscalDocumentId, 'doc-123');
    assert.equal(result.submissionId, 'sub-123');
    assert.equal(result.fiscalStatus, 'ACCEPTED');
    assert.equal(result.haciendaStatus, 'aceptado');
    assert.equal(result.clave, 'clave-doc');
    assert.equal(result.consecutive, '00100001010000000001');
    assert.equal(result.companyId, 'billing-company-1');
    assert.equal(result.idempotencyKey, 'inventori:1698:invoice:1623');
  });

  test('BillingApiClient.getArtifact uses official list + download READ contract', async () => {
    const requests = [];
    const credentialResolver = { resolveApiKey: () => 'sentinel-unit-api-key' };
    const fetchImpl = async (url, options) => {
      const pathname = new URL(String(url)).pathname;
      requests.push({ pathname, method: options.method });
      assert.equal(options.method, 'GET');

      if (pathname.endsWith('/artifacts')) {
        return new globalThis.Response(JSON.stringify([
          { id: 'artifact-pdf-1', type: 'PDF', contentType: 'application/pdf', sizeBytes: 12 },
        ]), { status: 200, headers: { 'content-type': 'application/json' } });
      }

      if (pathname.endsWith('/artifacts/artifact-pdf-1/download')) {
        return new globalThis.Response(Buffer.from('%PDF fake'), {
          status: 200,
          headers: { 'content-type': 'application/pdf', 'content-length': '9' },
        });
      }

      return new globalThis.Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'nope' } }), { status: 404 });
    };

    const client = new UnitBillingApiClient({ baseUrl: 'https://billing.example.test', credentialResolver, fetchImpl });
    const artifact = await client.getArtifact({
      billingCompanyId: 'billing-company-1',
      environment: 'SANDBOX',
      billingFiscalDocumentId: 'doc-123',
      artifactType: 'PDF',
      secretReference: 'env:BILLING_KEY',
      correlationId: 'corr-artifact',
    });

    assert.equal(requests.length, 2);
    assert.ok(requests[0].pathname.endsWith('/artifacts'));
    assert.ok(requests[1].pathname.endsWith('/artifacts/artifact-pdf-1/download'));
    assert.equal(artifact.contentType, 'application/pdf');
    assert.equal(artifact.bytes.toString(), '%PDF fake');
  });

  test('Billing reconciliation contract constant documents the actual official endpoints', () => {
    assert.equal(BILLING_RECONCILIATION_CONTRACT.documentRead, 'GET /api/v1/fiscal-documents/{id}');
    assert.equal(
      BILLING_RECONCILIATION_CONTRACT.submissionRead,
      'GET /api/v1/companies/{companyId}/fiscal-documents/{environment}/invoices/{id}/submission',
    );
  });

  test('Billing ACCEPTED submission response maps to Inventori ACCEPTED projection', () => {
    const result = classifyBillingReconciliationResult({
      documentId: 'doc-123',
      submissionId: 'sub-123',
      status: 'ACCEPTED',
      lastProviderStatus: 'aceptado',
      clave: 'clave-doc',
    });
    assert.equal(result.intentStatus, 'ACCEPTED');
    assert.equal(result.code, 'BILLING_ACCEPTED');
  });

  test('Billing malformed submission response fails closed', () => {
    const result = classifyBillingReconciliationResult({ documentId: 'doc-123', status: 'WAT_IS_THIS' });
    assert.equal(result.intentStatus, null);
    assert.equal(result.code, 'BILLING_UNKNOWN_STATUS');
  });

  test('Billing document/company/environment/idempotency mismatches are rejected before projection', () => {
    const intent = {
      billingFiscalDocumentId: 'doc-123',
      idempotencyKey: 'inventori:1698:invoice:1623',
    };
    const config = { billingCompanyId: 'billing-company-1', billingEnvironment: 'SANDBOX' };

    assert.equal(checkBillingChainConsistency(intent, {
      billingFiscalDocumentId: 'doc-123',
      companyId: 'billing-company-1',
      environment: 'SANDBOX',
      idempotencyKey: 'inventori:1698:invoice:1623',
    }, config), null);

    assert.equal(checkBillingChainConsistency(intent, { billingFiscalDocumentId: 'other-doc' }, config).code, 'BILLING_DOCUMENT_ID_MISMATCH');
    assert.equal(checkBillingChainConsistency(intent, { companyId: 'other-company' }, config).code, 'BILLING_COMPANY_MISMATCH');
    assert.equal(checkBillingChainConsistency(intent, { environment: 'PRODUCTION' }, config).code, 'BILLING_ENVIRONMENT_MISMATCH');
    assert.equal(checkBillingChainConsistency(intent, { idempotencyKey: 'inventori:1698:invoice:9999' }, config).code, 'BILLING_IDEMPOTENCY_KEY_MISMATCH');
  });
});

// ---------------------------------------------------------------------------
// SUITE 2: PostgreSQL-backed integration tests
// ---------------------------------------------------------------------------

// Lazy-require so non-PostgreSQL runs never fail on missing env
let prisma;
let BillingApiClient;
let createBillingCredentialResolver;

const createdCompanyIds = [];

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Creates a fixture representing an intent already in PROCESSING state with
 * a known billingFiscalDocumentId — simulating what TASK-012 leaves behind
 * after create+submit succeeds but Hacienda hasn't responded yet.
 */
async function createReconciliationFixture(label, options = {}) {
  const suffix = uniqueSuffix();
  const company = await prisma.company.create({
    data: { name: `IBRC ${label} ${suffix}`, legalId: `IBRC-${suffix}`, email: `ibrc-${suffix}@example.test` },
  });
  createdCompanyIds.push(company.id);

  const client = await prisma.client.create({
    data: {
      companyId: company.id,
      code: `IBRC-C-${suffix}`,
      name: 'Reconciliation Client',
      legalId: '3101800001',
      documentType: '02',
      emailBilling: `ibrc-client-${suffix}@example.test`,
    },
  });

  const config = await prisma.companyBillingIntegrationConfig.create({
    data: {
      companyId: company.id,
      billingTenantId: `tenant-rc-${suffix}`,
      billingCompanyId: `billing-rc-${suffix}`,
      billingEnvironment: 'SANDBOX',
      billingCredentialSecretRef: options.secretRef || 'env:IBRC_SENTINEL_KEY',
      enabled: options.configEnabled !== false,
    },
  });

  const invoice = await prisma.invoice.create({
    data: {
      clientId: client.id,
      number: `IBRC-INV-${suffix}`,
      amount: 1130,
      status: options.invoiceStatus || 'PENDING',
    },
  });

  const billingFiscalDocumentId = options.billingFiscalDocumentId || `billing-doc-rc-${suffix}`;
  const idempotencyKey = `inventori:${company.id.toString()}:invoice:${invoice.id.toString()}`;

  const intent = await prisma.invoiceFiscalIntent.create({
    data: {
      companyId: company.id,
      invoiceId: invoice.id,
      billingIntegrationConfigId: config.id,
      status: options.intentStatus || 'PROCESSING',
      idempotencyKey,
      billingFiscalDocumentId,
      clave: options.clave || null,
      consecutive: options.consecutive || null,
      billingStatus: 'PROCESSING',
      nextAttemptAt: options.nextAttemptAt || null,
      metadata: options.metadata || null,
    },
  });

  return { company, client, config, invoice, intent, billingFiscalDocumentId, idempotencyKey };
}

async function cleanupCreatedCompanies() {
  for (const companyId of [...createdCompanyIds].reverse()) {
    await prisma.invoiceFiscalIntent.deleteMany({ where: { companyId } });
    await prisma.invoiceFiscalSnapshot.deleteMany({ where: { companyId } });
    await prisma.invoice.deleteMany({ where: { client: { companyId } } });
    await prisma.companyBillingIntegrationConfig.deleteMany({ where: { companyId } });
    await prisma.client.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  }
  createdCompanyIds.length = 0;
}

before(async () => {
  if (!runOptions.skip) {
    prisma = require('../src/lib/prisma');
    ({ BillingApiClient } = require('../src/services/billing-api-client.service'));
    ({ createBillingCredentialResolver } = require('../src/services/billing-credential-resolver.service'));
    await prisma.$connect();
  }
});

after(async () => {
  if (!runOptions.skip) {
    await cleanupCreatedCompanies();
    await prisma.$disconnect();
  }
});

describe('TASK-013 Billing reconciliation — PostgreSQL integration', runOptions, () => {

  // ── Atomic claim / concurrent reconcilers ────────────────────────────
  test('concurrent reconcilers for same intent: only one outbound status request', async () => {
    const fixture = await createReconciliationFixture('concurrent');
    const fakeBilling = new FakeReconciliationBillingClient();
    fakeBilling.setStatus(fixture.billingFiscalDocumentId, { id: fixture.billingFiscalDocumentId, fiscalStatus: 'PROCESSING' });

    const results = await Promise.all([
      reconcileFiscalIntentById(fixture.intent.id, fakeBilling),
      reconcileFiscalIntentById(fixture.intent.id, fakeBilling),
    ]);

    // Exactly one outbound status request
    assert.equal(fakeBilling.callCount, 1);
    // One succeeded, one returned NOT_CLAIMED
    const claimed = results.filter((r) => r.processed);
    const skipped = results.filter((r) => !r.processed && r.reason === 'NOT_CLAIMED');
    assert.equal(claimed.length, 1);
    assert.equal(skipped.length, 1);
  });

  // ── ACCEPTED persistence ──────────────────────────────────────────────
  test('Billing ACCEPTED: intent becomes ACCEPTED with clave and consecutive persisted', async () => {
    const fixture = await createReconciliationFixture('accepted');
    const fakeBilling = new FakeReconciliationBillingClient();
    fakeBilling.setStatus(fixture.billingFiscalDocumentId, {
      id: fixture.billingFiscalDocumentId,
      fiscalStatus: 'ACCEPTED',
      haciendaStatus: 'ACEPTADO',
      clave: 'clave-hacienda-accepted-001',
      consecutive: '00100001010000000001',
      acceptedAt: '2026-10-10T12:00:00.000Z',
    });

    const result = await reconcileFiscalIntentById(fixture.intent.id, fakeBilling);
    assert.equal(result.status, 'ACCEPTED');

    const persisted = await prisma.invoiceFiscalIntent.findUnique({ where: { id: fixture.intent.id } });
    assert.equal(persisted.status, 'ACCEPTED');
    assert.equal(persisted.clave, 'clave-hacienda-accepted-001');
    assert.equal(persisted.consecutive, '00100001010000000001');
    assert.equal(persisted.billingFiscalDocumentId, fixture.billingFiscalDocumentId);
    assert.ok(persisted.lastSyncAt);
    assert.equal(persisted.nextAttemptAt, null); // terminal — no more polling

    // Idempotency key must remain stable
    assert.equal(persisted.idempotencyKey, fixture.idempotencyKey);
  });

  // ── ACCEPTED does not mutate Invoice.status ───────────────────────────
  test('ACCEPTED fiscal state does not mutate commercial Invoice.status', async () => {
    const fixture = await createReconciliationFixture('accepted-invoice-independence', { invoiceStatus: 'PAID' });
    const fakeBilling = new FakeReconciliationBillingClient();
    fakeBilling.setStatus(fixture.billingFiscalDocumentId, {
      id: fixture.billingFiscalDocumentId,
      fiscalStatus: 'ACCEPTED',
      clave: 'clave-fiscal-independence',
      consecutive: 'cons-fiscal-independence',
    });

    await reconcileFiscalIntentById(fixture.intent.id, fakeBilling);

    const intent = await prisma.invoiceFiscalIntent.findUnique({ where: { id: fixture.intent.id } });
    const invoice = await prisma.invoice.findUnique({ where: { id: fixture.invoice.id } });
    assert.equal(intent.status, 'ACCEPTED');
    assert.equal(invoice.status, 'PAID'); // must remain PAID, not changed to ACCEPTED
  });

  // ── REJECTED persistence ──────────────────────────────────────────────
  test('Billing REJECTED: intent becomes REJECTED with safe diagnostics persisted', async () => {
    const fixture = await createReconciliationFixture('rejected');
    const fakeBilling = new FakeReconciliationBillingClient();
    fakeBilling.setStatus(fixture.billingFiscalDocumentId, {
      id: fixture.billingFiscalDocumentId,
      fiscalStatus: 'REJECTED',
      haciendaStatus: 'RECHAZADO',
      rejectionCode: 'COD-005',
      rejectionMessage: 'El número de identificación del receptor no es válido',
      haciendaMensaje: 'AX-012',
      haciendaDetalleMensaje: 'Cédula jurídica inexistente en el padrón del Ministerio de Hacienda.',
    });

    const result = await reconcileFiscalIntentById(fixture.intent.id, fakeBilling);
    assert.equal(result.status, 'REJECTED');

    const persisted = await prisma.invoiceFiscalIntent.findUnique({ where: { id: fixture.intent.id } });
    assert.equal(persisted.status, 'REJECTED');
    assert.equal(persisted.failureCode, 'COD-005');
    assert.ok(persisted.failureMessage);
    assert.ok(persisted.nextAttemptAt === null); // terminal
    const metadata = persisted.metadata && typeof persisted.metadata === 'object' ? persisted.metadata : {};
    assert.ok(metadata.rejectionDiagnostics, 'rejection diagnostics must be persisted');
    assert.equal(metadata.rejectionDiagnostics.rejectionCode, 'COD-005');
    assert.equal(metadata.rejectionDiagnostics.haciendaMensaje, 'AX-012');
  });

  // ── REJECTED does not mutate Invoice.status ───────────────────────────
  test('REJECTED fiscal state does not mutate commercial Invoice.status', async () => {
    const fixture = await createReconciliationFixture('rejected-invoice-independence', { invoiceStatus: 'PENDING' });
    const fakeBilling = new FakeReconciliationBillingClient();
    fakeBilling.setStatus(fixture.billingFiscalDocumentId, {
      id: fixture.billingFiscalDocumentId,
      fiscalStatus: 'REJECTED',
      rejectionCode: 'COD-999',
      rejectionMessage: 'Test rejection',
    });

    await reconcileFiscalIntentById(fixture.intent.id, fakeBilling);

    const invoice = await prisma.invoice.findUnique({ where: { id: fixture.invoice.id } });
    assert.equal(invoice.status, 'PENDING'); // must not have changed
  });

  // ── Invoice.status = PAID + fiscal ACCEPTED is a valid combination ────
  test('Invoice PAID + fiscal ACCEPTED is a valid composite state', async () => {
    const paidFixture = await createReconciliationFixture('paid-accepted', { invoiceStatus: 'PAID' });
    const fakeBilling = new FakeReconciliationBillingClient();
    fakeBilling.setStatus(paidFixture.billingFiscalDocumentId, {
      id: paidFixture.billingFiscalDocumentId,
      fiscalStatus: 'ACCEPTED',
      clave: 'clave-paid-accepted',
      consecutive: 'cons-paid-accepted',
    });
    await reconcileFiscalIntentById(paidFixture.intent.id, fakeBilling);

    const intent = await prisma.invoiceFiscalIntent.findUnique({ where: { id: paidFixture.intent.id } });
    const invoice = await prisma.invoice.findUnique({ where: { id: paidFixture.invoice.id } });
    assert.equal(intent.status, 'ACCEPTED');
    assert.equal(invoice.status, 'PAID');
  });

  // ── Invoice.status = PENDING + fiscal ACCEPTED is also valid ─────────
  test('Invoice PENDING + fiscal ACCEPTED is a valid composite state', async () => {
    const pendingFixture = await createReconciliationFixture('pending-accepted', { invoiceStatus: 'PENDING' });
    const fakeBilling = new FakeReconciliationBillingClient();
    fakeBilling.setStatus(pendingFixture.billingFiscalDocumentId, {
      id: pendingFixture.billingFiscalDocumentId,
      fiscalStatus: 'ACCEPTED',
      clave: 'clave-pending-accepted',
      consecutive: 'cons-pending-accepted',
    });
    await reconcileFiscalIntentById(pendingFixture.intent.id, fakeBilling);

    const intent = await prisma.invoiceFiscalIntent.findUnique({ where: { id: pendingFixture.intent.id } });
    const invoice = await prisma.invoice.findUnique({ where: { id: pendingFixture.invoice.id } });
    assert.equal(intent.status, 'ACCEPTED');
    assert.equal(invoice.status, 'PENDING');
  });

  // ── PROCESSING retry scheduling ───────────────────────────────────────
  test('Billing still PROCESSING: intent stays PROCESSING with next poll scheduled', async () => {
    const fixture = await createReconciliationFixture('still-processing');
    const fakeBilling = new FakeReconciliationBillingClient();
    fakeBilling.setStatus(fixture.billingFiscalDocumentId, {
      id: fixture.billingFiscalDocumentId,
      fiscalStatus: 'PROCESSING',
    });

    const reconcileNow = new Date('2026-10-10T12:00:00.000Z');
    await reconcileFiscalIntentById(fixture.intent.id, fakeBilling, { now: reconcileNow });

    const persisted = await prisma.invoiceFiscalIntent.findUnique({ where: { id: fixture.intent.id } });
    assert.equal(persisted.status, 'PROCESSING');
    assert.ok(persisted.nextAttemptAt, 'must have a scheduled next attempt');
    // Next attempt should be at reconcileNow + POLL_INTERVAL
    const expectedNext = new Date(reconcileNow.getTime() + RECONCILIATION_POLL_INTERVAL_MS);
    assert.equal(persisted.nextAttemptAt.getTime(), expectedNext.getTime());
    // Idempotency key unchanged
    assert.equal(persisted.idempotencyKey, fixture.idempotencyKey);
    // Billing document ID unchanged
    assert.equal(persisted.billingFiscalDocumentId, fixture.billingFiscalDocumentId);
  });

  // ── Unknown Billing status fails closed ───────────────────────────────
  test('unknown Billing status fails closed: intent stays PROCESSING with retry', async () => {
    const fixture = await createReconciliationFixture('unknown-status');
    const fakeBilling = new FakeReconciliationBillingClient();
    fakeBilling.setStatus(fixture.billingFiscalDocumentId, {
      id: fixture.billingFiscalDocumentId,
      fiscalStatus: 'COMPLETELY_UNKNOWN_VALUE',
    });

    await reconcileFiscalIntentById(fixture.intent.id, fakeBilling);

    const persisted = await prisma.invoiceFiscalIntent.findUnique({ where: { id: fixture.intent.id } });
    assert.equal(persisted.status, 'PROCESSING');
    assert.ok(persisted.nextAttemptAt, 'must have a scheduled next attempt after unknown status');
  });

  // ── 401 query failure → ERROR_FINAL ──────────────────────────────────
  test('401 status query failure becomes ERROR_FINAL (auth config broken)', async () => {
    const fixture = await createReconciliationFixture('auth-failure');
    const fakeBilling = new FakeReconciliationBillingClient({
      throwOnStatus: new BillingClientError('Unauthorized', { code: 'BILLING_401', statusCode: 401 }),
    });

    const result = await reconcileFiscalIntentById(fixture.intent.id, fakeBilling);
    const persisted = await prisma.invoiceFiscalIntent.findUnique({ where: { id: fixture.intent.id } });
    assert.equal(result.status, 'ERROR_FINAL');
    assert.equal(persisted.status, 'ERROR_FINAL');
    assert.equal(persisted.failureCode, 'RECONCILIATION_AUTH_FAILURE');
    assert.equal(persisted.nextAttemptAt, null);
  });

  // ── 403 query failure → ERROR_FINAL ──────────────────────────────────
  test('403 status query failure becomes ERROR_FINAL (permissions broken)', async () => {
    const fixture = await createReconciliationFixture('permissions-failure');
    const fakeBilling = new FakeReconciliationBillingClient({
      throwOnStatus: new BillingClientError('Forbidden', { code: 'BILLING_403', statusCode: 403 }),
    });

    const result = await reconcileFiscalIntentById(fixture.intent.id, fakeBilling);
    const persisted = await prisma.invoiceFiscalIntent.findUnique({ where: { id: fixture.intent.id } });
    assert.equal(result.status, 'ERROR_FINAL');
    assert.equal(persisted.status, 'ERROR_FINAL');
    assert.equal(persisted.failureCode, 'RECONCILIATION_PERMISSIONS_FAILURE');
  });

  // ── Timeout keeps PROCESSING ──────────────────────────────────────────
  test('TIMEOUT keeps PROCESSING with backoff retry scheduled', async () => {
    const fixture = await createReconciliationFixture('timeout-keeps-processing');
    const fakeBilling = new FakeReconciliationBillingClient({
      throwOnStatus: new BillingClientError('Billing request timed out', {
        code: 'BILLING_TIMEOUT',
        retryable: true,
      }),
    });

    const reconcileNow = new Date('2026-10-10T14:00:00.000Z');
    const result = await reconcileFiscalIntentById(fixture.intent.id, fakeBilling, { now: reconcileNow });

    const persisted = await prisma.invoiceFiscalIntent.findUnique({ where: { id: fixture.intent.id } });
    assert.equal(result.status, 'PROCESSING');
    assert.equal(persisted.status, 'PROCESSING'); // must NOT become ERROR_RETRYABLE
    assert.ok(persisted.nextAttemptAt, 'must have backoff retry scheduled');
    assert.ok(persisted.nextAttemptAt.getTime() > reconcileNow.getTime());
    // Billing document ID unchanged — do not re-create
    assert.equal(persisted.billingFiscalDocumentId, fixture.billingFiscalDocumentId);
    assert.equal(persisted.idempotencyKey, fixture.idempotencyKey);
  });

  // ── 503 keeps PROCESSING ──────────────────────────────────────────────
  test('503 status query failure keeps PROCESSING with backoff retry scheduled', async () => {
    const fixture = await createReconciliationFixture('503-keeps-processing');
    const fakeBilling = new FakeReconciliationBillingClient({
      throwOnStatus: new BillingClientError('Service Unavailable', { code: 'BILLING_503', statusCode: 503 }),
    });

    await reconcileFiscalIntentById(fixture.intent.id, fakeBilling);

    const persisted = await prisma.invoiceFiscalIntent.findUnique({ where: { id: fixture.intent.id } });
    assert.equal(persisted.status, 'PROCESSING'); // never ERROR_RETRYABLE
    assert.ok(persisted.nextAttemptAt);
  });

  // ── Identifier clave conflict → ERROR_FINAL ───────────────────────────
  test('identifier clave conflict: intent becomes ERROR_FINAL without overwriting clave', async () => {
    const existingClave = 'existing-clave-aaa';
    const conflictingClave = 'conflicting-clave-bbb';
    const fixture = await createReconciliationFixture('clave-conflict', { clave: existingClave });
    const fakeBilling = new FakeReconciliationBillingClient();
    fakeBilling.setStatus(fixture.billingFiscalDocumentId, {
      id: fixture.billingFiscalDocumentId,
      fiscalStatus: 'ACCEPTED',
      clave: conflictingClave,
      consecutive: 'cons-001',
    });

    const result = await reconcileFiscalIntentById(fixture.intent.id, fakeBilling);
    const persisted = await prisma.invoiceFiscalIntent.findUnique({ where: { id: fixture.intent.id } });
    assert.equal(result.status, 'ERROR_FINAL');
    assert.equal(persisted.status, 'ERROR_FINAL');
    assert.equal(persisted.failureCode, 'IDENTIFIER_CLAVE_CONFLICT');
    assert.equal(persisted.clave, existingClave); // existing clave preserved, not overwritten
  });

  // ── Identifier consecutive conflict → ERROR_FINAL ────────────────────
  test('identifier consecutive conflict: ERROR_FINAL without overwriting consecutive', async () => {
    const existingConsecutive = 'existing-cons-001';
    const conflictingConsecutive = 'conflicting-cons-002';
    const fixture = await createReconciliationFixture('consecutive-conflict', { consecutive: existingConsecutive });
    const fakeBilling = new FakeReconciliationBillingClient();
    fakeBilling.setStatus(fixture.billingFiscalDocumentId, {
      id: fixture.billingFiscalDocumentId,
      fiscalStatus: 'ACCEPTED',
      clave: 'clave-ok',
      consecutive: conflictingConsecutive,
    });

    const result = await reconcileFiscalIntentById(fixture.intent.id, fakeBilling);
    const persisted = await prisma.invoiceFiscalIntent.findUnique({ where: { id: fixture.intent.id } });
    assert.equal(result.status, 'ERROR_FINAL');
    assert.equal(persisted.failureCode, 'IDENTIFIER_CONSECUTIVE_CONFLICT');
    assert.equal(persisted.consecutive, existingConsecutive); // preserved
  });

  // ── HTTP 202 invariant — PostgreSQL proof ─────────────────────────────
  test('HTTP 202 in billing status body does not produce ACCEPTED projection', async () => {
    const fixture = await createReconciliationFixture('202-not-accepted');
    const fakeBilling = new FakeReconciliationBillingClient();
    // Simulate Billing response where only billingStatus=202 or similar transport field is present
    fakeBilling.setStatus(fixture.billingFiscalDocumentId, {
      id: fixture.billingFiscalDocumentId,
      billingStatus: '202',
      fiscalStatus: 'PROCESSING', // explicitly still processing
      httpNote: '202 accepted for transport processing only',
    });

    await reconcileFiscalIntentById(fixture.intent.id, fakeBilling);

    const persisted = await prisma.invoiceFiscalIntent.findUnique({ where: { id: fixture.intent.id } });
    assert.notEqual(persisted.status, 'ACCEPTED');
    assert.equal(persisted.status, 'PROCESSING');
  });

  // ── Crash scenario A: crash before status query ───────────────────────
  test('crash-A: crash before status query — intent remains eligible after lock expiry', async () => {
    const fixture = await createReconciliationFixture('crash-a');
    const fakeBilling = new FakeReconciliationBillingClient();
    fakeBilling.setStatus(fixture.billingFiscalDocumentId, {
      id: fixture.billingFiscalDocumentId,
      fiscalStatus: 'ACCEPTED',
      clave: 'clave-crash-a',
      consecutive: 'cons-crash-a',
    });

    const claimTime = new Date('2026-10-11T10:00:00.000Z');
    const postLockTime = addMinutes(claimTime, 11); // past RECONCILIATION_LOCK_MS (10 min)

    // First attempt: crash before status query
    await assert.rejects(
      reconcileFiscalIntentById(fixture.intent.id, fakeBilling, { now: claimTime, crashBeforeStatusQuery: true }),
      /Simulated crash before status query/,
    );
    assert.equal(fakeBilling.callCount, 0); // no status query made

    // Lock expires → intent eligible again
    const retryResult = await reconcileFiscalIntentById(fixture.intent.id, fakeBilling, { now: postLockTime });
    assert.equal(retryResult.status, 'ACCEPTED');
    assert.equal(fakeBilling.callCount, 1);

    const persisted = await prisma.invoiceFiscalIntent.findUnique({ where: { id: fixture.intent.id } });
    assert.equal(persisted.status, 'ACCEPTED');
    assert.equal(persisted.clave, 'clave-crash-a');
    assert.equal(persisted.idempotencyKey, fixture.idempotencyKey);
    assert.equal(persisted.billingFiscalDocumentId, fixture.billingFiscalDocumentId);
  });

  // ── Crash scenario B: crash after ACCEPTED response before persist ────
  test('crash-B: crash after ACCEPTED before persist — replay reconciles same document', async () => {
    const fixture = await createReconciliationFixture('crash-b');
    const fakeBilling = new FakeReconciliationBillingClient();
    fakeBilling.setStatus(fixture.billingFiscalDocumentId, {
      id: fixture.billingFiscalDocumentId,
      fiscalStatus: 'ACCEPTED',
      clave: 'clave-crash-b',
      consecutive: 'cons-crash-b',
    });

    const claimTime = new Date('2026-10-11T11:00:00.000Z');
    const postLockTime = addMinutes(claimTime, 11);

    // First attempt: crashes after Billing returns ACCEPTED, before DB persistence
    await assert.rejects(
      reconcileFiscalIntentById(fixture.intent.id, fakeBilling, {
        now: claimTime,
        crashAfterStatusResponseBeforePersist: true,
      }),
      /Simulated crash after status response before persistence/,
    );
    assert.equal(fakeBilling.callCount, 1); // one status query was made

    // Intent remains PROCESSING (nextAttemptAt = claimTime + LOCK_MS, now expired)
    const afterCrash = await prisma.invoiceFiscalIntent.findUnique({ where: { id: fixture.intent.id } });
    assert.equal(afterCrash.status, 'PROCESSING');

    // Lock expires → replay reconciliation with same fake Billing document
    const retryResult = await reconcileFiscalIntentById(fixture.intent.id, fakeBilling, { now: postLockTime });
    assert.equal(retryResult.status, 'ACCEPTED');
    assert.equal(fakeBilling.callCount, 2); // second query for same document

    const persisted = await prisma.invoiceFiscalIntent.findUnique({ where: { id: fixture.intent.id } });
    assert.equal(persisted.status, 'ACCEPTED');
    assert.equal(persisted.clave, 'clave-crash-b');
    assert.equal(persisted.consecutive, 'cons-crash-b');
    assert.equal(persisted.billingFiscalDocumentId, fixture.billingFiscalDocumentId);
    assert.equal(persisted.idempotencyKey, fixture.idempotencyKey);
  });

  // ── Crash scenario C: crash after ACCEPTED persistence ───────────────
  test('crash-C: ACCEPTED terminal state not re-reconciled', async () => {
    const fixture = await createReconciliationFixture('crash-c');
    const fakeBilling = new FakeReconciliationBillingClient();
    fakeBilling.setStatus(fixture.billingFiscalDocumentId, {
      id: fixture.billingFiscalDocumentId,
      fiscalStatus: 'ACCEPTED',
      clave: 'clave-crash-c',
      consecutive: 'cons-crash-c',
    });

    // First reconciliation succeeds
    await reconcileFiscalIntentById(fixture.intent.id, fakeBilling);
    assert.equal(fakeBilling.callCount, 1);

    // Second attempt on an ACCEPTED terminal intent → NOT_CLAIMED (not PROCESSING)
    const replayResult = await reconcileFiscalIntentById(fixture.intent.id, fakeBilling);
    assert.equal(replayResult.processed, false);
    assert.equal(replayResult.reason, 'NOT_CLAIMED');
    assert.equal(fakeBilling.callCount, 1); // no additional query made
  });

  // ── Crash scenario D: PROCESSING survives restart ─────────────────────
  test('crash-D: PROCESSING with known doc ID survives restart unchanged', async () => {
    const fixture = await createReconciliationFixture('crash-d', {
      clave: 'partial-clave-d',
      consecutive: null,
    });
    const fakeBilling = new FakeReconciliationBillingClient();
    fakeBilling.setStatus(fixture.billingFiscalDocumentId, {
      id: fixture.billingFiscalDocumentId,
      fiscalStatus: 'PROCESSING',
    });

    const t0 = new Date('2026-10-11T12:00:00.000Z');
    // First reconciliation: Billing still PROCESSING → schedule next poll
    await reconcileFiscalIntentById(fixture.intent.id, fakeBilling, { now: t0 });

    // Simulate restart: intents with past nextAttemptAt are rediscovered
    const afterPollInterval = addMinutes(t0, 6); // past POLL_INTERVAL (5 min)
    const nextResult = await reconcileNextFiscalIntent(fakeBilling, {
      companyId: fixture.company.id,
      now: afterPollInterval,
    });

    assert.equal(nextResult.processed, true);
    assert.equal(nextResult.status, 'PROCESSING');
    assert.equal(fakeBilling.callCount, 2);

    const persisted = await prisma.invoiceFiscalIntent.findUnique({ where: { id: fixture.intent.id } });
    assert.equal(persisted.status, 'PROCESSING');
    assert.equal(persisted.billingFiscalDocumentId, fixture.billingFiscalDocumentId);
    assert.equal(persisted.clave, 'partial-clave-d'); // unchanged from fixture
    assert.equal(persisted.idempotencyKey, fixture.idempotencyKey);
  });

  // ── Sentinel API key non-exposure ─────────────────────────────────────
  test('sentinel API key is never persisted in intent metadata or emitted in logs', async () => {
    const sentinelKey = 'sentinel-secret-reconcile-value';
    process.env.IBRC_SENTINEL_KEY = sentinelKey;

    const fixture = await createReconciliationFixture('sentinel-secret', {
      secretRef: 'env:IBRC_SENTINEL_KEY',
    });

    const logLines = [];
    const originalInfo = console.info;
    const originalWarn = console.warn;
    console.info = (line) => logLines.push(String(line));
    console.warn = (line) => logLines.push(String(line));

    const fetchCalls = [];
    const fetchImpl = async (url, opts) => {
      fetchCalls.push({ url, headers: opts.headers });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          id: fixture.billingFiscalDocumentId,
          fiscalStatus: 'ACCEPTED',
          clave: 'clave-sentinel-test',
          consecutive: 'cons-sentinel-test',
        }),
      };
    };

    try {
      const billingClient = new BillingApiClient({
        baseUrl: 'https://fake-billing-reconcile.local',
        credentialResolver: createBillingCredentialResolver(process.env),
        fetchImpl,
        timeoutMs: 1000,
      });

      await reconcileFiscalIntentById(fixture.intent.id, billingClient);
    } finally {
      console.info = originalInfo;
      console.warn = originalWarn;
      delete process.env.IBRC_SENTINEL_KEY;
    }

    // Verify the key was injected into the HTTP header (correct behavior)
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].headers['X-API-Key'], sentinelKey);
    assert.equal(fetchCalls[0].headers.Authorization, undefined); // no JWT

    // Verify the key does NOT appear in persisted state
    const persisted = await prisma.invoiceFiscalIntent.findUnique({ where: { id: fixture.intent.id } });
    assert.doesNotMatch(stringifyPersisted(persisted), new RegExp(sentinelKey));

    // Verify the key does NOT appear in logs
    assert.doesNotMatch(logLines.join('\n'), new RegExp(sentinelKey));
  });

  // ── Reconciliation does not call createFiscalDocument ─────────────────
  test('reconciliation service never calls createFiscalDocument', async () => {
    const fixture = await createReconciliationFixture('no-create-call');
    const trackedFakeBilling = {
      createCalls: [],
      statusCalls: [],
      async createFiscalDocument(req) {
        this.createCalls.push(req);
        return { id: 'should-not-be-called' };
      },
      async getFiscalStatus(req) {
        this.statusCalls.push(req);
        return { id: fixture.billingFiscalDocumentId, fiscalStatus: 'ACCEPTED', clave: 'clave-nc', consecutive: 'cons-nc' };
      },
    };

    await reconcileFiscalIntentById(fixture.intent.id, trackedFakeBilling);
    assert.equal(trackedFakeBilling.createCalls.length, 0);
    assert.equal(trackedFakeBilling.statusCalls.length, 1);
  });

  // ── No direct Hacienda fiscal access in TASK-013 service files ─────────
  test('TASK-013 fiscal service files contain no direct Hacienda fiscal API endpoints', () => {
    // Scope: only the fiscal/billing integration services introduced by this
    // implementation wave. The pre-existing src/config.js contains a taxpayer
    // lookup URL (api.hacienda.go.cr/fe/ae) which is a separate long-standing
    // Inventori feature — not a new TASK-013 fiscal submission endpoint.
    const fiscalServiceFiles = [
      'fiscal-reconciliation.service.js',
      'fiscal-billing-worker.service.js',
      'billing-api-client.service.js',
      'billing-credential-resolver.service.js',
      'billing-integration-config.service.js',
      'fiscal-intent-recovery.service.js',
      'fiscal-readiness.service.js',
      'fiscal-receiver-resolver.service.js',
      'fiscal-snapshot.service.js',
      'fiscal-unit-mapping.service.js',
    ];

    // Direct Hacienda fiscal-submission/reconciliation patterns that Inventori
    // must never call directly (Billing owns these).
    const haciendaFiscalPatterns = [
      /api\.comprobantes\.go\.cr/i,   // Hacienda comprobantes API
      /api\.hacienda\.go\.cr\/fe\//i, // Hacienda FE submission endpoint
      /mh\.hacienda/i,
      /etax\.hacienda/i,
    ];

    const servicesDir = path.join(__dirname, '..', 'src', 'services');
    for (const filename of fiscalServiceFiles) {
      const filePath = path.join(servicesDir, filename);
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, 'utf8');
      for (const pattern of haciendaFiscalPatterns) {
        assert.doesNotMatch(
          content,
          pattern,
          `Fiscal service file ${filename} must not contain a direct Hacienda fiscal API reference matching ${pattern}`,
        );
      }
    }
  });
});
