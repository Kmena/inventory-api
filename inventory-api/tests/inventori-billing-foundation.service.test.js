const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

function expect(value) {
  return {
    toBe(expected) { assert.strictEqual(value, expected); },
    toBeNull() { assert.strictEqual(value, null); },
    toBeUndefined() { assert.strictEqual(value, undefined); },
    toContain(expected) { assert.ok(value.includes(expected)); },
    toHaveBeenCalledTimes(expected) { assert.strictEqual(value.calls.length, expected); },
  };
}

const { resolveFiscalReceiver } = require('../src/services/fiscal-receiver-resolver.service');
const { mapInventoriUnitToBillingUnit } = require('../src/services/fiscal-unit-mapping.service');
const { validateOrderFiscalReadiness } = require('../src/services/fiscal-readiness.service');
const { buildFiscalSnapshotData, buildIdempotencyKey } = require('../src/services/fiscal-snapshot.service');
const { serializeBillingIntegrationConfig } = require('../src/services/billing-integration-config.service');
const { createBillingCredentialResolver } = require('../src/services/billing-credential-resolver.service');
const { BillingApiClient } = require('../src/services/billing-api-client.service');

const enabledConfig = Object.freeze({
  id: 501n,
  billingTenantId: 'tenant-1',
  billingCompanyId: 'billing-company-1',
  billingEnvironment: 'SANDBOX',
  billingCredentialSecretRef: 'env:BILLING_TEST_KEY',
  enabled: true,
});

function buildOrder(overrides = {}) {
  return {
    id: 10n,
    companyId: 1n,
    paymentCondition: 'CASH',
    client: {
      id: 2n,
      legalName: 'Cliente SA',
      identificationType: '02',
      identificationNumber: '3101123456',
      email: 'client@example.test',
      paymentDays: 30,
      ...overrides.client,
    },
    clientStore: {
      id: 3n,
      legalName: 'Tienda SA',
      identificationType: '02',
      identificationNumber: '3101654321',
      email: 'store@example.test',
      currency: 'CRC',
      ...overrides.clientStore,
    },
    items: overrides.items || [{
      id: 20n,
      productId: 30n,
      quantity: 2,
      unitPrice: 1000,
      discountPercent: 10,
      discountAmount: 100,
      totalDiscount: 200,
      product: {
        id: 30n,
        name: 'Producto Fiscal',
        code: 'P-1',
        cabysCode: '1234567890123',
        unit: 'UN',
        taxRate: 13,
        taxExempt: false,
        currency: 'CRC',
        controlsInventory: true,
        ...overrides.product,
      },
    }],
    ...overrides.order,
  };
}

describe('Inventori Billing foundation receiver resolver', () => {
  test('uses store legal entity before client legal entity', () => {
    const result = resolveFiscalReceiver(buildOrder({
      clientStore: { legalEntity: { id: 4n, legalName: 'Store Legal', identificationType: '02', identificationNumber: '3101000001', email: 'store-legal@example.test' } },
      client: { legalEntity: { id: 5n, legalName: 'Client Legal', identificationType: '02', identificationNumber: '3101000002', email: 'client-legal@example.test' } },
    }));

    expect(result.ok).toBe(true);
    expect(result.receiver.sourceType).toBe('CLIENT_STORE_LEGAL_ENTITY');
    expect(result.receiver.legalName).toBe('Store Legal');
  });

  test('uses client legal entity when store legal entity is absent', () => {
    const result = resolveFiscalReceiver(buildOrder({
      clientStore: { legalEntity: null },
      client: { legalEntity: { id: 5n, legalName: 'Client Legal', identificationType: '02', identificationNumber: '3101000002', email: 'client-legal@example.test' } },
    }));

    expect(result.ok).toBe(true);
    expect(result.receiver.sourceType).toBe('CLIENT_LEGAL_ENTITY');
  });

  test('uses complete store fiscal identity before matching client fallback', () => {
    const result = resolveFiscalReceiver(buildOrder({
      client: { legalName: 'Tienda SA', identificationNumber: '3101654321', email: 'client@example.test' },
    }));

    expect(result.ok).toBe(true);
    expect(result.receiver.sourceType).toBe('CLIENT_STORE');
  });

  test('uses client fallback when store is incomplete', () => {
    const result = resolveFiscalReceiver(buildOrder({ clientStore: { legalName: null, identificationNumber: null, email: null } }));

    expect(result.ok).toBe(true);
    expect(result.receiver.sourceType).toBe('CLIENT');
  });

  test('fails when receiver is missing', () => {
    const result = resolveFiscalReceiver(buildOrder({
      clientStore: { legalName: null, identificationNumber: null, email: null },
      client: { legalName: null, identificationNumber: null, email: null },
    }));

    expect(result.ok).toBe(false);
    expect(result.code).toBe('FISCAL_RECEIVER_MISSING');
  });

  test('fails deterministically on conflicting complete store/client identities', () => {
    const result = resolveFiscalReceiver(buildOrder());

    expect(result.ok).toBe(false);
    expect(result.code).toBe('FISCAL_RECEIVER_IDENTITY_CONFLICT');
  });
});

describe('Inventori Billing foundation readiness and snapshot', () => {
  test('maps supported units and rejects unknown free-text units', () => {
    expect(mapInventoriUnitToBillingUnit('UN')).toBe('Unid');
    expect(mapInventoriUnitToBillingUnit('kg')).toBe('Kg');
    expect(mapInventoriUnitToBillingUnit('service', { controlsInventory: false })).toBe('Sp');
    expect(mapInventoriUnitToBillingUnit('box')).toBeNull();
  });

  test('disabled Billing integration does not block dispatch readiness', () => {
    const readiness = validateOrderFiscalReadiness(buildOrder(), { enabled: false });

    expect(readiness.ok).toBe(true);
    expect(readiness.enabled).toBe(false);
  });

  test('enabled integration without mapping fails readiness', () => {
    const readiness = validateOrderFiscalReadiness(buildOrder({ client: { legalName: 'Tienda SA', identificationNumber: '3101654321' } }), { enabled: true });

    expect(readiness.ok).toBe(false);
    expect(readiness.failures.map((failure) => failure.code)).toContain('BILLING_MAPPING_MISSING');
  });

  test('missing CAByS, unsupported unit and non-CRC currency fail readiness', () => {
    const readiness = validateOrderFiscalReadiness(buildOrder({
      client: { legalName: 'Tienda SA', identificationNumber: '3101654321' },
      clientStore: { currency: 'USD' },
      product: { cabysCode: null, unit: 'box' },
    }), enabledConfig);

    const codes = readiness.failures.map((failure) => failure.code);
    expect(codes).toContain('CABYS_MISSING');
    expect(codes).toContain('UNSUPPORTED_FISCAL_UNIT');
    expect(codes).toContain('UNSUPPORTED_CURRENCY');
  });

  test('valid snapshot preserves discount, credit term, receiver and immutable product/client data', () => {
    const order = buildOrder({
      order: { paymentCondition: 'CREDIT' },
      client: { legalName: 'Tienda SA', identificationNumber: '3101654321', paymentDays: 45 },
    });
    const receiver = resolveFiscalReceiver(order).receiver;
    const snapshot = buildFiscalSnapshotData({ order, invoice: { id: 99n }, receiver, config: enabledConfig });

    order.client.legalName = 'Changed after dispatch';
    order.items[0].product.name = 'Changed product';

    expect(snapshot.saleCondition).toBe('02');
    expect(snapshot.paymentMethod).toBeNull();
    expect(snapshot.creditTermDays).toBe(45);
    expect(snapshot.receiverSnapshot.legalName).toBe('Tienda SA');
    expect(snapshot.linesSnapshot[0].description).toBe('Producto Fiscal');
    expect(snapshot.linesSnapshot[0].discountCode).toBe('07');
    expect(snapshot.linesSnapshot[0].discountNature).toBe('Descuento Comercial');
    expect(snapshot.linesSnapshot[0].fiscalUnit).toBe('Unid');
  });

  test('stable idempotency key has no attempt-specific randomness', () => {
    expect(buildIdempotencyKey(1n, 99n)).toBe('inventori:1:invoice:99');
    expect(buildIdempotencyKey(1n, 99n)).toBe('inventori:1:invoice:99');
  });
});

describe('Inventori Billing foundation safety boundaries', () => {
  test('safe config serialization does not expose secret reference', () => {
    const serialized = serializeBillingIntegrationConfig({
      id: 1n,
      companyId: 2n,
      billingTenantId: 'tenant',
      billingCompanyId: 'company',
      billingEnvironment: 'SANDBOX',
      billingCredentialSecretRef: 'env:VERY_SECRET_KEY',
      enabled: true,
    });

    expect(serialized.hasCredentialSecret).toBe(true);
    expect(serialized.billingCredentialSecretRef).toBeUndefined();
    expect(serialized.credentialSecretReference).toBeUndefined();
  });

  test('Billing API client injects machine key but does not require human JWT', async () => {
    const fetchImpl = async (...args) => {
      fetchImpl.calls.push(args);
      return { ok: true, status: 200, text: async () => '{"id":"doc-1"}' };
    };
    fetchImpl.calls = [];
    const client = new BillingApiClient({
      baseUrl: 'https://billing.example.test',
      credentialResolver: createBillingCredentialResolver({ BILLING_TEST_KEY: 'machine-key' }),
      fetchImpl,
      timeoutMs: 1000,
    });

    await client.getFiscalStatus({
      billingCompanyId: 'company',
      environment: 'SANDBOX',
      billingFiscalDocumentId: 'doc-1',
      secretReference: 'env:BILLING_TEST_KEY',
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    for (const call of fetchImpl.calls) {
      expect(call[1].headers['X-API-Key']).toBe('machine-key');
      expect(call[1].headers.Authorization).toBeUndefined();
    }
  });
});
