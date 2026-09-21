const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

const REPO_PATH = path.resolve(__dirname, '../src/repositories/entitlement.repository.js');
const AUDIT_PATH = path.resolve(__dirname, '../src/lib/audit.js');
const SERVICE_PATH = path.resolve(__dirname, '../src/services/entitlement.service.js');

function entitlement(overrides = {}) {
  return {
    id: 900n,
    companyId: 42n,
    clientId: 7n,
    productId: 8n,
    sourceOrderId: 11n,
    sourceOrderItemId: 12n,
    sourceInvoiceId: 13n,
    sourceInvoiceItemId: 14n,
    previousEntitlementId: null,
    status: 'ACTIVE',
    entitlementKind: 'SUBSCRIPTION',
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: null,
    activatedAt: new Date('2026-01-01T00:00:00.000Z'),
    activatedByUserId: 10n,
    activationSource: 'PAYMENT_APPROVAL',
    manualActivationReason: null,
    cancelledAt: null,
    cancelledByUserId: null,
    cancellationReason: null,
    priceSnapshot: { toString: () => '100.00' },
    currencySnapshot: 'CRC',
    validityCountSnapshot: 1,
    validityUnitSnapshot: 'MONTH',
    billingIntervalSnapshot: 'MONTHLY',
    metadata: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function entitlementInvoiceItem(overrides = {}) {
  return {
    id: 14n,
    invoiceId: 13n,
    orderItemId: 12n,
    productId: 8n,
    total: { toString: () => '100.00' },
    invoice: { id: 13n, clientId: 7n, orderId: 11n },
    ...overrides,
  };
}

function entitlementProduct() {
  return {
    id: 8n,
    companyId: 42n,
    productNature: 'SERVICE',
    controlsInventory: false,
    commercialBehavior: 'ENTITLEMENT',
    entitlementKind: 'SUBSCRIPTION',
    defaultValidityCount: 1,
    defaultValidityUnit: 'MONTH',
    billingInterval: 'MONTHLY',
    price: { toString: () => '100.00' },
    currency: 'CRC',
  };
}

async function withService(stub, run) {
  const originalLoad = Module._load;
  const auditCalls = [];
  const repoStub = {
    transaction: stub.transaction || ((work) => work({ tx: true })),
    findExistingByCommercialSource: stub.findExistingByCommercialSource || (async () => null),
    listEntitlementInvoiceItemsForInvoice: stub.listEntitlementInvoiceItemsForInvoice || (async () => [entitlementInvoiceItem()]),
    getCreationContext: stub.getCreationContext || (async () => ({
      client: { id: 7n, companyId: 42n },
      product: entitlementProduct(),
      sourceOrder: { id: 11n, clientId: 7n },
      sourceOrderItem: { id: 12n, productId: 8n, order: { clientId: 7n } },
      sourceInvoice: { id: 13n, clientId: 7n },
      sourceInvoiceItem: { id: 14n, productId: 8n, total: { toString: () => '100.00' }, invoice: { clientId: 7n } },
    })),
    createEntitlement: stub.createEntitlement || (async (data) => entitlement(data)),
    listByCompany: async () => ({ items: [], total: 0 }),
    getByIdForCompany: async () => null,
    updateEntitlementForCompany: async () => null,
  };

  Module._load = function patchedLoad(request, parent, ...rest) {
    const resolved = (() => {
      try { return Module._resolveFilename(request, parent); } catch { return null; }
    })();
    if (resolved === REPO_PATH) return repoStub;
    if (resolved === AUDIT_PATH) {
      return {
        recordAuditEventSafelyIfAvailable: async (payload) => {
          auditCalls.push(payload);
          return null;
        },
      };
    }
    return originalLoad.call(this, request, parent, ...rest);
  };

  delete require.cache[SERVICE_PATH];
  try {
    return await run(require(SERVICE_PATH), auditCalls);
  } finally {
    Module._load = originalLoad;
    delete require.cache[SERVICE_PATH];
  }
}

test('approved CASH/TRANSFER payment activates entitlement invoice lines only after APPROVED state', async () => {
  let createCalls = 0;
  await withService(
    {
      createEntitlement: async (data) => {
        createCalls += 1;
        return entitlement(data);
      },
    },
    async (service, auditCalls) => {
      const pendingResult = await service.activateEntitlementsForApprovedPayment(
        { id: 70n, invoiceId: 13n, status: 'PENDING_APPROVAL' },
        { companyId: '42', sub: '10' },
      );
      assert.deepEqual(pendingResult, []);
      assert.equal(createCalls, 0);

      const approvedResult = await service.activateEntitlementsForApprovedPayment(
        { id: 70n, invoiceId: 13n, status: 'APPROVED' },
        { companyId: '42', sub: '10' },
      );
      assert.equal(approvedResult.length, 1);
      assert.equal(approvedResult[0].activationSource, 'PAYMENT_APPROVAL');
      assert.equal(createCalls, 1);
      assert.equal(auditCalls[0].action, 'entitlements.activate');
      assert.equal(auditCalls[0].metadata.activationSource, 'PAYMENT_APPROVAL');
    },
  );
});

test('credit invoice approval activates entitlement lines without requiring a PAID invoice', async () => {
  let seenData = null;
  await withService(
    {
      createEntitlement: async (data) => {
        seenData = data;
        return entitlement(data);
      },
    },
    async (service, auditCalls) => {
      const result = await service.activateEntitlementsForApprovedCreditInvoice(
        { id: 13n, orderId: 11n, status: 'PENDING' },
        { companyId: '42', sub: '10' },
      );
      assert.equal(result.length, 1);
      assert.equal(seenData.activationSource, 'CREDIT_APPROVAL');
      assert.equal(seenData.sourceInvoiceItemId, 14n);
      assert.equal(auditCalls[0].metadata.activationSource, 'CREDIT_APPROVAL');
    },
  );
});

test('automatic activation is idempotent on retry and duplicate payment approval', async () => {
  let createCalls = 0;
  await withService(
    {
      findExistingByCommercialSource: async () => entitlement({ id: 901n, sourceInvoiceItemId: 14n }),
      createEntitlement: async () => {
        createCalls += 1;
        return entitlement();
      },
    },
    async (service) => {
      const first = await service.activateEntitlementsForApprovedPayment(
        { id: 70n, invoiceId: 13n, status: 'APPROVED' },
        { companyId: '42', sub: '10' },
      );
      const second = await service.activateEntitlementsForApprovedPayment(
        { id: 70n, invoiceId: 13n, status: 'APPROVED' },
        { companyId: '42', sub: '10' },
      );
      assert.equal(first[0].id, '901');
      assert.equal(second[0].id, '901');
      assert.equal(createCalls, 0);
    },
  );
});

test('automatic activation recovers from concurrent unique-source conflicts', async () => {
  let createCalls = 0;
  let lookupCalls = 0;
  await withService(
    {
      findExistingByCommercialSource: async () => {
        lookupCalls += 1;
        return lookupCalls === 1 ? null : entitlement({ id: 902n, sourceInvoiceItemId: 14n });
      },
      createEntitlement: async () => {
        createCalls += 1;
        const error = new Error('unique constraint');
        error.code = 'P2002';
        error.meta = { target: ['company_id', 'source_invoice_item_id'] };
        throw error;
      },
    },
    async (service) => {
      const result = await service.activateEntitlementsForApprovedPayment(
        { id: 70n, invoiceId: 13n, status: 'APPROVED' },
        { companyId: '42', sub: '10' },
      );
      assert.equal(result[0].id, '902');
      assert.equal(createCalls, 1);
    },
  );
});

test('automatic activation rejects cross-company invoice line references before creation', async () => {
  let createCalls = 0;
  await withService(
    {
      getCreationContext: async () => ({
        client: { id: 7n, companyId: 42n },
        product: entitlementProduct(),
        sourceOrder: { id: 11n, clientId: 7n },
        sourceOrderItem: { id: 12n, productId: 8n, order: { clientId: 7n } },
        sourceInvoice: { id: 13n, clientId: 999n },
        sourceInvoiceItem: { id: 14n, productId: 8n, total: 100, invoice: { clientId: 999n } },
      }),
      createEntitlement: async () => {
        createCalls += 1;
        return entitlement();
      },
    },
    async (service) => {
      await assert.rejects(
        () => service.activateEntitlementsForApprovedPayment(
          { id: 70n, invoiceId: 13n, status: 'APPROVED' },
          { companyId: '42', sub: '10' },
        ),
        (error) => {
          assert.equal(error.code, 'cross_company_reference');
          return true;
        },
      );
      assert.equal(createCalls, 0);
    },
  );
});

test('standard service lines are ignored by the automatic activation query boundary', async () => {
  let createCalls = 0;
  await withService(
    {
      listEntitlementInvoiceItemsForInvoice: async () => [],
      createEntitlement: async () => {
        createCalls += 1;
        return entitlement();
      },
    },
    async (service) => {
      const result = await service.activateEntitlementsForApprovedCreditInvoice(
        { id: 13n, orderId: 11n, status: 'PENDING' },
        { companyId: '42', sub: '10' },
      );
      assert.deepEqual(result, []);
      assert.equal(createCalls, 0);
    },
  );
});
