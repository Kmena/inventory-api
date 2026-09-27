'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test?schema=public';

const { BillingClientError } = require('../src/services/billing-api-client.service');
const {
  listFiscalArtifacts,
  getFiscalArtifact,
} = require('../src/services/fiscal-artifact-proxy.service');
const { getAccessPolicy } = require('../src/security/access-policies');

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function makeReadOnlyDb(overrides = {}) {
  const invoice = Object.prototype.hasOwnProperty.call(overrides, 'invoice')
    ? overrides.invoice
    : { id: 1623n, status: 'PENDING' };
  const intent = Object.prototype.hasOwnProperty.call(overrides, 'intent') ? overrides.intent : {
    id: 1453n,
    companyId: 1698n,
    invoiceId: 1623n,
    status: 'ACCEPTED',
    billingFiscalDocumentId: '353a13aa-dd13-4382-8af3-9bb15280fff6',
    clave: '50625092600020753025100100001010000000001101924748',
    consecutive: '00100001010000000001',
    idempotencyKey: 'inventori:1698:invoice:1623',
    integrationConfig: {
      billingCompanyId: 'dde91f44-6ceb-4eb7-b322-0139919cc34d',
      billingEnvironment: 'SANDBOX',
      billingCredentialSecretRef: 'env:BILLING_SANDBOX_M2M_API_KEY',
    },
  };
  return {
    invoice: {
      findFirst: async () => invoice,
    },
    invoiceFiscalIntent: {
      findUnique: async () => intent,
      create: async () => { throw new Error('artifact proxy must not create fiscal intents'); },
      update: async () => { throw new Error('artifact proxy must not mutate fiscal intents'); },
    },
  };
}

test('invoice.fiscal-artifact policy is role-scoped to admin and sales', () => {
  const policy = getAccessPolicy('invoice.fiscal-artifact');
  assert.equal(policy.mode, 'role');
  assert.deepEqual(policy.roles, ['admin', 'sales']);
});

test('listFiscalArtifacts maps Billing artifact metadata without fiscal mutation', async () => {
  const calls = [];
  const billingClient = {
    async listArtifacts(request) {
      calls.push(request);
      return [
        { id: 'signed-id', type: 'SIGNED_XML', contentType: 'application/xml', sha256: 'a'.repeat(64), sizeBytes: 123, createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'resp-id', type: 'HACIENDA_RESPONSE_XML', contentType: 'application/xml', sha256: 'b'.repeat(64), sizeBytes: 456, createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'pdf-id', type: 'PDF', contentType: 'application/pdf', sha256: 'c'.repeat(64), sizeBytes: 789, createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'ignored-id', type: 'UNKNOWN', contentType: 'application/octet-stream' },
      ];
    },
  };

  const artifacts = await listFiscalArtifacts(1623n, 1698n, {
    db: makeReadOnlyDb(),
    billingClient,
    correlationId: 'test-list',
  });

  assert.deepEqual(artifacts.map((artifact) => artifact.type), ['SIGNED_XML', 'HACIENDA_RESPONSE_XML', 'PDF']);
  assert.deepEqual(artifacts.map((artifact) => artifact.inventoriType), ['signed-xml', 'hacienda-response', 'pdf']);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].billingCompanyId, 'dde91f44-6ceb-4eb7-b322-0139919cc34d');
  assert.equal(calls[0].environment, 'SANDBOX');
  assert.equal(calls[0].billingFiscalDocumentId, '353a13aa-dd13-4382-8af3-9bb15280fff6');
});

test('getFiscalArtifact proxies XML and PDF bytes exactly with sane headers', async () => {
  const xml = Buffer.from('<?xml version="1.0" encoding="UTF-8"?><FacturaElectronica/>');
  const pdf = Buffer.from('%PDF-1.4\n%binary\x00\xff');
  const billingClient = {
    async getArtifact({ artifactType }) {
      if (artifactType === 'SIGNED_XML') return { contentType: 'application/xml', bytes: xml };
      if (artifactType === 'PDF') return { contentType: 'application/pdf', bytes: pdf };
      throw new Error('unexpected artifact type');
    },
  };

  const signed = await getFiscalArtifact(1623n, 'signed-xml', 1698n, {
    db: makeReadOnlyDb(),
    billingClient,
    correlationId: 'test-download-xml',
  });
  const renderedPdf = await getFiscalArtifact(1623n, 'pdf', 1698n, {
    db: makeReadOnlyDb(),
    billingClient,
    correlationId: 'test-download-pdf',
  });

  assert.equal(signed.contentType, 'application/xml');
  assert.match(signed.contentDisposition, /^attachment; filename="factura-50625092600020753025100100001010000000001101924748\.xml"$/);
  assert.equal(sha256(signed.bytes), sha256(xml));
  assert.equal(signed.bytes.toString('utf8').startsWith('<?xml'), true, 'XML must not be JSON stringified or base64 wrapped');

  assert.equal(renderedPdf.contentType, 'application/pdf');
  assert.match(renderedPdf.contentDisposition, /^attachment; filename="factura-50625092600020753025100100001010000000001101924748\.pdf"$/);
  assert.equal(sha256(renderedPdf.bytes), sha256(pdf));
  assert.equal(renderedPdf.bytes.subarray(0, 4).toString('ascii'), '%PDF', 'PDF bytes must not be UTF-8 transformed');
});

test('Billing artifact failures are mapped safely and do not call create/submit', async () => {
  let createCalled = false;
  let submitCalled = false;
  const billingClient = {
    async getArtifact() {
      throw new BillingClientError('not found', { code: 'BILLING_HTTP_ERROR', statusCode: 404 });
    },
    async createFiscalDocument() { createCalled = true; },
    async submitFiscalDocument() { submitCalled = true; },
  };

  await assert.rejects(
    () => getFiscalArtifact(1623n, 'pdf', 1698n, {
      db: makeReadOnlyDb(),
      billingClient,
      correlationId: 'test-404',
    }),
    (error) => {
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, 'FISCAL_ARTIFACT_NOT_FOUND');
      return true;
    },
  );
  assert.equal(createCalled, false);
  assert.equal(submitCalled, false);
});

test('cross-company artifact access fails before Billing is called', async () => {
  let billingCalled = false;
  const db = makeReadOnlyDb({ invoice: null });
  const billingClient = {
    async listArtifacts() { billingCalled = true; return []; },
  };

  await assert.rejects(
    () => listFiscalArtifacts(1623n, 9999n, { db, billingClient }),
    (error) => {
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, 'not_found');
      return true;
    },
  );
  assert.equal(billingCalled, false);
});
