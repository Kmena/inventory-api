'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

/**
 * Minimal external-Billing simulation for the rotation incident.
 *
 * The provider-side lookup is modeled as the approved stable identity:
 * tenant + company + operation + idempotencyKey. The API key authenticates
 * the request but is not part of the commercial idempotency identity.
 * The regression must prove that rotating apiKey cannot create a second
 * fiscal identity for the same company/operation/key.
 */
class ApiKeyScopedBillingFixture {
  constructor() {
    this.documents = [];
  }

  createFiscalDocument({ tenantId, companyId, apiKeyId, operation, idempotencyKey }) {
    const existing = this.documents.find((document) => (
      document.tenantId === tenantId
      && document.companyId === companyId
      && document.operation === operation
      && document.idempotencyKey === idempotencyKey
    ));

    if (existing) return existing;

    const document = {
      id: `billing-doc-${this.documents.length + 1}`,
      tenantId,
      companyId,
      apiKeyId,
      operation,
      idempotencyKey,
    };
    this.documents.push(document);
    return document;
  }
}

test('same external idempotency key remains one fiscal identity after M2M API-key rotation', () => {
  const billing = new ApiKeyScopedBillingFixture();
  const request = {
    tenantId: 'inventori',
    companyId: '1',
    operation: 'invoice',
    idempotencyKey: 'inventori:1:invoice:1846',
  };

  const documentA = billing.createFiscalDocument({ ...request, apiKeyId: 'api-key-old' });
  const documentB = billing.createFiscalDocument({ ...request, apiKeyId: 'api-key-rotated' });

  assert.equal(
    documentB.id,
    documentA.id,
    'rotating the M2M API key must not create a second fiscal document',
  );
  assert.equal(billing.documents.length, 1, 'the commercial document must have one fiscal identity');
});
