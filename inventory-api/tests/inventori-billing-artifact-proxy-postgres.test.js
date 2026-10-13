/**
 * TASK-014 — Billing fiscal artifact proxy PostgreSQL integration tests.
 *
 * Requires: INVENTORI_BILLING_POSTGRES_TEST=1 and a reachable Inventori PostgreSQL at localhost:5433.
 *
 * Tests:
 *   - Same-company artifact access (ACCEPTED, REJECTED)
 *   - Cross-company isolation (Company A user → Company B invoice → 404/denied)
 *   - Invoice without fiscal intent → 422
 *   - Intent without billingFiscalDocumentId → 422 ARTIFACT_NOT_READY
 *   - State remains unchanged after artifact retrieval (Invoice.status, intent.status, clave, consecutive)
 *   - Concurrent downloads: no duplicate entities created
 *   - No artifact bytes persisted in Inventori DB
 *   - Sentinel API key not in proxied result or intent metadata
 */

'use strict';

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  configureFiscalDisposableDatabase,
  verifyFiscalDisposableDatabase,
} = require('./helpers/fiscal-disposable-database-guard');

// ---------------------------------------------------------------------------
// Environment bootstrap (mirrors existing PostgreSQL test harness pattern)
// ---------------------------------------------------------------------------

const disposableDatabaseConfig = configureFiscalDisposableDatabase();
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const prisma = require('../src/lib/prisma');
const { BillingClientError } = require('../src/services/billing-api-client.service');
const { getFiscalArtifact } = require('../src/services/fiscal-artifact-proxy.service');

const runOptions = { skip: !disposableDatabaseConfig };

const createdCompanyIds = [];

before(async () => {
  if (!runOptions.skip) {
    await prisma.$connect();
    await verifyFiscalDisposableDatabase(prisma, disposableDatabaseConfig);
  }
});

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// ---------------------------------------------------------------------------
// Fake billing clients
// ---------------------------------------------------------------------------

class FakeArtifactBillingClient {
  constructor(artifactsByType = {}, options = {}) {
    this.artifactsByType = artifactsByType;
    this.options = options;
    this.calls = [];
  }

  async getArtifact({ billingFiscalDocumentId, artifactType, correlationId }) {
    this.calls.push({ billingFiscalDocumentId, artifactType, correlationId });
    if (this.options.throwOnGet) throw this.options.throwOnGet;
    const artifact = this.artifactsByType[artifactType];
    if (!artifact) {
      throw new BillingClientError('Artifact not found', { code: 'BILLING_HTTP_ERROR', statusCode: 404, retryable: false });
    }
    return { contentType: artifact.contentType, bytes: artifact.bytes };
  }

  get callCount() { return this.calls.length; }
}

// ---------------------------------------------------------------------------
// Fixture builder
// ---------------------------------------------------------------------------

async function createArtifactFixture(label, options = {}) {
  const suffix = uniqueSuffix();
  const company = await prisma.company.create({
    data: {
      name: `IBAPT ${label} ${suffix}`,
      legalId: `IBAPT-${suffix}`,
      email: `ibapt-${suffix}@example.test`,
    },
  });
  createdCompanyIds.push(company.id);

  const client = await prisma.client.create({
    data: {
      companyId: company.id,
      code: `IBAPT-C-${suffix}`,
      name: `Artifact Client ${label}`,
      legalId: `3101${suffix.slice(0, 6)}`,
      documentType: '02',
      emailBilling: `artifact-${suffix}@example.test`,
    },
  });

  const config = await prisma.companyBillingIntegrationConfig.create({
    data: {
      companyId: company.id,
      billingTenantId: `tenant-${suffix}`,
      billingCompanyId: `billing-company-${suffix}`,
      billingEnvironment: options.environment || 'SANDBOX',
      billingCredentialSecretRef: options.secretRef || `env:IBAPT_SENTINEL_KEY_${suffix.toUpperCase().replace(/-/g, '_')}`,
      enabled: options.configEnabled !== false,
    },
  });

  const invoice = await prisma.invoice.create({
    data: {
      clientId: client.id,
      number: `IBAPT-INV-${suffix}`,
      amount: 1000,
      status: options.invoiceStatus || 'PENDING',
    },
  });

  // Fiscal intent (with or without billingFiscalDocumentId)
  const intentData = {
    companyId: company.id,
    invoiceId: invoice.id,
    billingIntegrationConfigId: config.id,
    status: options.intentStatus || 'ACCEPTED',
    idempotencyKey: `inventori:${company.id.toString()}:invoice:${invoice.id.toString()}`,
    billingFiscalDocumentId: options.billingFiscalDocumentId !== undefined
      ? options.billingFiscalDocumentId
      : `billing-doc-artifact-${suffix}`,
    clave: options.clave !== undefined ? options.clave : `50601${suffix.slice(0, 10)}`.padEnd(50, '0'),
    consecutive: options.consecutive || '001',
    nextAttemptAt: null,
    metadata: options.metadata || null,
  };

  let intent = null;
  if (options.withIntent !== false) {
    intent = await prisma.invoiceFiscalIntent.create({ data: intentData });
  }

  return { company, client, config, invoice, intent };
}

async function cleanupCreatedCompanies() {
  for (const companyId of [...createdCompanyIds].reverse()) {
    await prisma.invoiceFiscalIntent.deleteMany({ where: { companyId } });
    await prisma.invoiceFiscalSnapshot.deleteMany({ where: { companyId } });
    await prisma.invoice.deleteMany({ where: { client: { companyId } } });
    await prisma.client.deleteMany({ where: { companyId } });
    await prisma.companyBillingIntegrationConfig.deleteMany({ where: { companyId } });
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  }
  createdCompanyIds.length = 0;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TASK-014 Billing artifact proxy — PostgreSQL integration', runOptions, () => {
  after(async () => { await cleanupCreatedCompanies(); });

  // ── Same-company ACCEPTED artifact access ─────────────────────────────

  test('same-company ACCEPTED invoice: PDF artifact retrieval succeeds', async () => {
    const fakePdfBytes = Buffer.from('%PDF-1.4 postgres-test-accepted-pdf');
    const fixture = await createArtifactFixture('same-company-pdf', {
      invoiceStatus: 'PAID', intentStatus: 'ACCEPTED',
    });

    const billingClient = new FakeArtifactBillingClient({ PDF: { contentType: 'application/pdf', bytes: fakePdfBytes } });
    const result = await getFiscalArtifact(fixture.invoice.id, 'pdf', fixture.company.id, { billingClient });

    assert.equal(result.contentType, 'application/pdf');
    assert.ok(result.contentDisposition.startsWith('attachment; filename="'));
    assert.ok(result.contentDisposition.endsWith('.pdf"'));
    assert.equal(sha256(result.bytes), sha256(fakePdfBytes), 'PDF bytes must be exact proxy');
    assert.equal(billingClient.callCount, 1);
  });

  test('same-company ACCEPTED invoice: signed-xml artifact retrieval succeeds', async () => {
    const xmlBytes = Buffer.from('<?xml version="1.0"?><FacturaElectronica><Clave>TEST</Clave></FacturaElectronica>');
    const fixture = await createArtifactFixture('same-company-xml', {
      invoiceStatus: 'PAID', intentStatus: 'ACCEPTED',
    });

    const billingClient = new FakeArtifactBillingClient({ SIGNED_XML: { contentType: 'application/xml', bytes: xmlBytes } });
    const result = await getFiscalArtifact(fixture.invoice.id, 'signed-xml', fixture.company.id, { billingClient });

    assert.equal(result.contentType, 'application/xml');
    assert.ok(result.contentDisposition.includes('.xml"'));
    assert.equal(sha256(result.bytes), sha256(xmlBytes));
  });

  // ── REJECTED: Hacienda response may still be available ─────────────────

  test('REJECTED intent: hacienda-response artifact is proxied if Billing serves it', async () => {
    const respXmlBytes = Buffer.from('<?xml version="1.0"?><MensajeReceptor><Mensaje>3</Mensaje></MensajeReceptor>');
    const fixture = await createArtifactFixture('rejected-hacienda-resp', {
      intentStatus: 'REJECTED', billingFiscalDocumentId: 'billing-doc-rejected-hr',
      clave: '50601010000001',
    });

    const billingClient = new FakeArtifactBillingClient({
      HACIENDA_RESPONSE_XML: { contentType: 'application/xml', bytes: respXmlBytes },
    });
    const result = await getFiscalArtifact(fixture.invoice.id, 'hacienda-response', fixture.company.id, { billingClient });

    assert.equal(billingClient.calls[0].artifactType, 'HACIENDA_RESPONSE_XML');
    assert.equal(sha256(result.bytes), sha256(respXmlBytes));
    assert.ok(result.contentDisposition.includes('respuesta-hacienda-'));
  });

  // ── Cross-company isolation ────────────────────────────────────────────

  test('cross-company: Company A user cannot access Company B invoice (404)', async () => {
    const fixtureA = await createArtifactFixture('cross-co-A', { intentStatus: 'ACCEPTED' });
    const fixtureB = await createArtifactFixture('cross-co-B', { intentStatus: 'ACCEPTED' });

    const billingClient = new FakeArtifactBillingClient({
      PDF: { contentType: 'application/pdf', bytes: Buffer.from('%PDF fake') },
    });

    // Company A user tries to access Company B's invoice
    await assert.rejects(
      () => getFiscalArtifact(fixtureB.invoice.id, 'pdf', fixtureA.company.id, { billingClient }),
      (err) => {
        assert.equal(err.statusCode, 404, 'Cross-company access must produce 404 (not-found semantics)');
        assert.equal(err.code, 'not_found');
        return true;
      },
    );
    assert.equal(billingClient.callCount, 0, 'No Billing request should be made for cross-company access');
  });

  test('cross-company: even with known billingFiscalDocumentId, access is denied', async () => {
    // Attacker knows everything about Company B's invoice
    const fixtureA = await createArtifactFixture('cross-co-A2', { intentStatus: 'ACCEPTED' });
    const fixtureB = await createArtifactFixture('cross-co-B2', { intentStatus: 'ACCEPTED' });

    const billingClient = new FakeArtifactBillingClient({
      PDF: { contentType: 'application/pdf', bytes: Buffer.from('%PDF') },
    });

    // Company A user requests Company B invoice with Company B's real invoice ID
    await assert.rejects(
      () => getFiscalArtifact(fixtureB.invoice.id, 'pdf', fixtureA.company.id, { billingClient }),
      (err) => { assert.equal(err.statusCode, 404); return true; },
    );
    assert.equal(billingClient.callCount, 0);
  });

  // ── Invoice without fiscal intent ──────────────────────────────────────

  test('invoice without fiscal intent → 422 FISCAL_INTENT_NOT_FOUND', async () => {
    const fixture = await createArtifactFixture('no-intent', { withIntent: false });

    const billingClient = new FakeArtifactBillingClient({});
    await assert.rejects(
      () => getFiscalArtifact(fixture.invoice.id, 'pdf', fixture.company.id, { billingClient }),
      (err) => { assert.equal(err.statusCode, 422); assert.equal(err.code, 'FISCAL_INTENT_NOT_FOUND'); return true; },
    );
    assert.equal(billingClient.callCount, 0);
  });

  // ── Intent without billingFiscalDocumentId ─────────────────────────────

  test('PENDING intent with no billingFiscalDocumentId → 422 ARTIFACT_NOT_READY', async () => {
    const fixture = await createArtifactFixture('no-doc-id', {
      intentStatus: 'PENDING', billingFiscalDocumentId: null, clave: null,
    });

    const billingClient = new FakeArtifactBillingClient({});
    await assert.rejects(
      () => getFiscalArtifact(fixture.invoice.id, 'pdf', fixture.company.id, { billingClient }),
      (err) => { assert.equal(err.statusCode, 422); assert.equal(err.code, 'ARTIFACT_NOT_READY'); return true; },
    );
    assert.equal(billingClient.callCount, 0);
  });

  // ── State immutability after artifact retrieval ────────────────────────

  test('Invoice.status and InvoiceFiscalIntent.status unchanged after successful retrieval', async () => {
    const fakePdfBytes = Buffer.from('%PDF-1.4 immutability-test');
    const fixture = await createArtifactFixture('immutability', {
      invoiceStatus: 'PAID', intentStatus: 'ACCEPTED',
    });

    const billingClient = new FakeArtifactBillingClient({ PDF: { contentType: 'application/pdf', bytes: fakePdfBytes } });
    await getFiscalArtifact(fixture.invoice.id, 'pdf', fixture.company.id, { billingClient });

    // Re-read from DB
    const invoiceAfter = await prisma.invoice.findUnique({ where: { id: fixture.invoice.id } });
    const intentAfter = await /** @type {any} */ (prisma).invoiceFiscalIntent.findUnique({
      where: { invoiceId: fixture.invoice.id },
    });

    assert.equal(invoiceAfter.status, 'PAID', 'Invoice.status must not change after artifact retrieval');
    assert.equal(intentAfter.status, 'ACCEPTED', 'InvoiceFiscalIntent.status must not change after artifact retrieval');
    assert.equal(intentAfter.billingFiscalDocumentId, fixture.intent.billingFiscalDocumentId, 'billingFiscalDocumentId must not change');
    assert.equal(intentAfter.clave, fixture.intent.clave, 'clave must not change');
    assert.equal(intentAfter.consecutive, fixture.intent.consecutive, 'consecutive must not change');
    assert.equal(intentAfter.idempotencyKey, fixture.intent.idempotencyKey, 'idempotencyKey must not change');
  });

  test('Invoice.status and InvoiceFiscalIntent.status unchanged after failed Billing retrieval', async () => {
    const fixture = await createArtifactFixture('immutability-fail', {
      invoiceStatus: 'PENDING', intentStatus: 'ACCEPTED',
    });

    const billingClient = new FakeArtifactBillingClient({}, {
      throwOnGet: new BillingClientError('503', { code: 'BILLING_HTTP_ERROR', statusCode: 503, retryable: true }),
    });

    await assert.rejects(() => getFiscalArtifact(fixture.invoice.id, 'pdf', fixture.company.id, { billingClient }));

    // States must remain unchanged
    const invoiceAfter = await prisma.invoice.findUnique({ where: { id: fixture.invoice.id } });
    const intentAfter = await /** @type {any} */ (prisma).invoiceFiscalIntent.findUnique({
      where: { invoiceId: fixture.invoice.id },
    });

    assert.equal(invoiceAfter.status, 'PENDING');
    assert.equal(intentAfter.status, 'ACCEPTED');
    assert.equal(intentAfter.clave, fixture.intent.clave);
  });

  // ── No artifact bytes persisted ────────────────────────────────────────

  test('no artifact bytes are persisted in Inventori after retrieval', async () => {
    const fakePdfBytes = Buffer.from('%PDF-1.4 no-persist-test');
    const fixture = await createArtifactFixture('no-persist', {
      intentStatus: 'ACCEPTED',
    });

    const billingClient = new FakeArtifactBillingClient({ PDF: { contentType: 'application/pdf', bytes: fakePdfBytes } });
    await getFiscalArtifact(fixture.invoice.id, 'pdf', fixture.company.id, { billingClient });

    // Verify no storage tables have new entries related to this company
    // (Inventori P0 has no artifact storage table — verify none was created)
    const intentAfter = await /** @type {any} */ (prisma).invoiceFiscalIntent.findUnique({
      where: { invoiceId: fixture.invoice.id },
    });

    // metadata should not contain artifact bytes
    const metadataStr = JSON.stringify(intentAfter?.metadata || {});
    assert.ok(!metadataStr.includes('%PDF'), 'PDF bytes must not be persisted in intent metadata');

    // No invoice item or other table should contain the artifact bytes
    const invoiceItems = await prisma.invoiceItem.findMany({ where: { invoiceId: fixture.invoice.id } });
    assert.equal(invoiceItems.length, 0, 'No invoice items created during artifact retrieval');
  });

  // ── Concurrent downloads ────────────────────────────────────────────────

  test('concurrent PDF downloads do not create duplicate entities or change state', async () => {
    const fakePdfBytes = Buffer.from('%PDF-1.4 concurrent-test');
    const fixture = await createArtifactFixture('concurrent', {
      invoiceStatus: 'PAID', intentStatus: 'ACCEPTED',
    });

    // Record intent state before concurrent downloads
    const intentBefore = await /** @type {any} */ (prisma).invoiceFiscalIntent.findUnique({
      where: { invoiceId: fixture.invoice.id },
    });

    // Two simultaneous downloads
    const billingClient1 = new FakeArtifactBillingClient({ PDF: { contentType: 'application/pdf', bytes: fakePdfBytes } });
    const billingClient2 = new FakeArtifactBillingClient({ PDF: { contentType: 'application/pdf', bytes: fakePdfBytes } });

    const [result1, result2] = await Promise.all([
      getFiscalArtifact(fixture.invoice.id, 'pdf', fixture.company.id, { billingClient: billingClient1 }),
      getFiscalArtifact(fixture.invoice.id, 'pdf', fixture.company.id, { billingClient: billingClient2 }),
    ]);

    // Both downloads succeed with same bytes
    assert.equal(sha256(result1.bytes), sha256(fakePdfBytes));
    assert.equal(sha256(result2.bytes), sha256(fakePdfBytes));
    assert.equal(billingClient1.callCount, 1);
    assert.equal(billingClient2.callCount, 1);

    // Intent state unchanged
    const intentAfter = await /** @type {any} */ (prisma).invoiceFiscalIntent.findUnique({
      where: { invoiceId: fixture.invoice.id },
    });
    assert.equal(intentAfter.status, intentBefore.status);
    assert.equal(intentAfter.attemptCount, intentBefore.attemptCount, 'attemptCount must not change on download');
    assert.equal(intentAfter.idempotencyKey, intentBefore.idempotencyKey);

    // Exactly one invoice still exists
    const invoices = await prisma.invoice.findMany({ where: { clientId: fixture.client.id } });
    assert.equal(invoices.length, 1, 'Concurrent downloads must not create duplicate invoices');
  });

  // ── Sentinel key non-exposure ──────────────────────────────────────────

  test('sentinel API key is not persisted in intent metadata after artifact access', async () => {
    const sentinelKey = 'sentinel-pg-artifact-key-must-not-persist';
    const envVarName = `IBAPT_SENTINEL_PG_${Date.now()}`;
    process.env[envVarName] = sentinelKey;

    const fakePdfBytes = Buffer.from('%PDF-1.4 sentinel-pg-test');
    const fixture = await createArtifactFixture('sentinel-key', {
      intentStatus: 'ACCEPTED',
      secretRef: `env:${envVarName}`,
    });

    let capturedSecretRef = null;
    const sentinelClient = {
      async getArtifact({ secretReference }) {
        capturedSecretRef = secretReference;
        return { contentType: 'application/pdf', bytes: fakePdfBytes };
      },
    };

    const result = await getFiscalArtifact(fixture.invoice.id, 'pdf', fixture.company.id, { billingClient: sentinelClient });

    // Correct: secretReference passed to billing client (it resolves it)
    assert.equal(capturedSecretRef, `env:${envVarName}`);
    // Correct: raw key NOT in result bytes
    assert.ok(!result.bytes.toString('utf8').includes(sentinelKey));

    // Verify intent metadata was not updated with sentinel key
    const intentAfter = await /** @type {any} */ (prisma).invoiceFiscalIntent.findUnique({
      where: { invoiceId: fixture.invoice.id },
    });
    const metadataStr = JSON.stringify(intentAfter?.metadata || {});
    assert.ok(!metadataStr.includes(sentinelKey), 'Sentinel key must not appear in intent metadata');
    assert.ok(!metadataStr.includes(envVarName), 'Env var name must not appear in intent metadata');

    delete process.env[envVarName];
  });

  // ── Billing 404: not found at Billing ─────────────────────────────────

  test('Billing 404 for artifact → Inventori 404; intent state unchanged', async () => {
    const fixture = await createArtifactFixture('billing-404', {
      intentStatus: 'ACCEPTED',
    });

    const billingClient = new FakeArtifactBillingClient({}); // no PDF → 404

    await assert.rejects(
      () => getFiscalArtifact(fixture.invoice.id, 'pdf', fixture.company.id, { billingClient }),
      (err) => { assert.equal(err.statusCode, 404); assert.equal(err.code, 'FISCAL_ARTIFACT_NOT_FOUND'); return true; },
    );

    const intentAfter = await /** @type {any} */ (prisma).invoiceFiscalIntent.findUnique({
      where: { invoiceId: fixture.invoice.id },
    });
    assert.equal(intentAfter.status, 'ACCEPTED', 'Billing 404 must not change fiscal intent status');
  });

  // ── PROCESSING intent: artifact access ────────────────────────────────

  test('PROCESSING intent with billingFiscalDocumentId: artifact access proxied (Billing is authoritative)', async () => {
    const fakePdfBytes = Buffer.from('%PDF-1.4 processing-intent-test');
    const fixture = await createArtifactFixture('processing-intent', {
      intentStatus: 'PROCESSING', billingFiscalDocumentId: 'billing-doc-proc-pg', clave: null,
    });

    const billingClient = new FakeArtifactBillingClient({ PDF: { contentType: 'application/pdf', bytes: fakePdfBytes } });
    const result = await getFiscalArtifact(fixture.invoice.id, 'pdf', fixture.company.id, { billingClient });

    assert.equal(sha256(result.bytes), sha256(fakePdfBytes));
    // State unchanged
    const intentAfter = await /** @type {any} */ (prisma).invoiceFiscalIntent.findUnique({
      where: { invoiceId: fixture.invoice.id },
    });
    assert.equal(intentAfter.status, 'PROCESSING');
  });

  // ── TASK-014 does not call createFiscalDocument ────────────────────────

  test('TASK-014 artifact proxy service never calls createFiscalDocument', async () => {
    const fakePdfBytes = Buffer.from('%PDF-1.4 no-create-test');
    const fixture = await createArtifactFixture('no-create-call', { intentStatus: 'ACCEPTED' });

    let createCalled = false;
    const trackingClient = {
      async getArtifact() { return { contentType: 'application/pdf', bytes: fakePdfBytes }; },
      async createFiscalDocument() { createCalled = true; return {}; },
      async submitFiscalDocument() { return {}; },
    };

    await getFiscalArtifact(fixture.invoice.id, 'pdf', fixture.company.id, { billingClient: trackingClient });
    assert.equal(createCalled, false, 'createFiscalDocument must never be called from artifact proxy');
  });

});
