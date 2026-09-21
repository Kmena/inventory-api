const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

const REPO_PATH = path.resolve(__dirname, '../src/repositories/entitlement.repository.js');
const AUDIT_PATH = path.resolve(__dirname, '../src/lib/audit.js');
const SERVICE_PATH = path.resolve(__dirname, '../src/services/entitlement.service.js');

function entitlement(overrides = {}) {
  return {
    id: 5n,
    companyId: 42n,
    clientId: 7n,
    productId: 8n,
    sourceOrderId: null,
    sourceOrderItemId: null,
    sourceInvoiceId: null,
    sourceInvoiceItemId: null,
    previousEntitlementId: null,
    status: 'ACTIVE',
    entitlementKind: 'SUBSCRIPTION',
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2026-12-31T00:00:00.000Z'),
    activatedAt: new Date('2026-01-01T00:00:00.000Z'),
    activatedByUserId: 10n,
    activationSource: 'MANUAL',
    manualActivationReason: 'customer migration',
    cancelledAt: null,
    cancelledByUserId: null,
    cancellationReason: null,
    priceSnapshot: { toString: () => '99.99' },
    currencySnapshot: 'CRC',
    validityCountSnapshot: 12,
    validityUnitSnapshot: 'MONTH',
    billingIntervalSnapshot: 'MONTHLY',
    metadata: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function product(overrides = {}) {
  return {
    id: 8n,
    companyId: 42n,
    productNature: 'SERVICE',
    controlsInventory: false,
    commercialBehavior: 'ENTITLEMENT',
    entitlementKind: 'SUBSCRIPTION',
    defaultValidityCount: 12,
    defaultValidityUnit: 'MONTH',
    billingInterval: 'MONTHLY',
    price: { toString: () => '99.99' },
    currency: 'CRC',
    ...overrides,
  };
}

async function withService(stub, run) {
  const originalLoad = Module._load;
  const auditCalls = [];
  const repoStub = {
    listByCompany: stub.listByCompany || (async () => ({ items: [], total: 0 })),
    getByIdForCompany: stub.getByIdForCompany || (async () => null),
    transaction: stub.transaction || ((work) => work({ tx: true })),
    findExistingByCommercialSource: stub.findExistingByCommercialSource || (async () => null),
    getCreationContext: stub.getCreationContext || (async () => ({
      client: { id: 7n, companyId: 42n },
      product: product(),
      sourceOrder: null,
      sourceOrderItem: null,
      sourceInvoice: null,
      sourceInvoiceItem: null,
    })),
    createEntitlement: stub.createEntitlement || (async (data) => entitlement({ ...data, id: 5n })),
    listEntitlementInvoiceItemsForInvoice: stub.listEntitlementInvoiceItemsForInvoice || (async () => []),
    updateEntitlementForCompany: stub.updateEntitlementForCompany || (async (_id, _companyId, data) => entitlement(data)),
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

test('serializeEntitlement derives EXPIRED without persisting an EXPIRED status', async () => {
  await withService(
    {
      getByIdForCompany: async () => entitlement({
        status: 'ACTIVE',
        endDate: new Date('2024-01-01T00:00:00.000Z'),
      }),
    },
    async (service) => {
      const result = await service.getCompanyEntitlement(5n, { companyId: '42' });
      assert.equal(result.status, 'EXPIRED');
      assert.equal(result.persistedStatus, 'ACTIVE');
    },
  );
});

test('manual activation creates an active entitlement only for entitlement products and records audit metadata', async () => {
  let seenData = null;
  await withService(
    {
      createEntitlement: async (data) => {
        seenData = data;
        return entitlement(data);
      },
    },
    async (service, auditCalls) => {
      const result = await service.manuallyActivateEntitlement(
        {
          clientId: '7',
          productId: '8',
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          reason: 'legacy contract migration',
        },
        { companyId: '42', sub: '10' },
        { requestContext: { requestId: 'req-1' } },
      );

      assert.equal(result.status, 'ACTIVE');
      assert.equal(seenData.companyId, 42n);
      assert.equal(seenData.activationSource, 'MANUAL');
      assert.equal(seenData.manualActivationReason, 'legacy contract migration');
      assert.equal(seenData.activatedByUserId, 10n);
      assert.equal(auditCalls[0].action, 'entitlements.activate.manual');
      assert.equal(auditCalls[0].metadata.reason, 'legacy contract migration');
    },
  );
});

test('manual activation rejects non-entitlement or inventory-controlled products', async () => {
  await withService(
    {
      getCreationContext: async () => ({
        client: { id: 7n, companyId: 42n },
        product: product({ commercialBehavior: 'STANDARD', controlsInventory: true, entitlementKind: null }),
        sourceOrder: null,
        sourceOrderItem: null,
        sourceInvoice: null,
        sourceInvoiceItem: null,
      }),
    },
    async (service) => {
      await assert.rejects(
        () => service.manuallyActivateEntitlement(
          { clientId: '7', productId: '8', reason: 'invalid product' },
          { companyId: '42', sub: '10' },
        ),
        (error) => {
          assert.equal(error.statusCode, 400);
          assert.equal(error.code, 'manual_activation_not_allowed');
          return true;
        },
      );
    },
  );
});

test('manual activation rejects cross-company source references before creating data', async () => {
  let created = false;
  await withService(
    {
      getCreationContext: async () => ({
        client: { id: 7n, companyId: 42n },
        product: product(),
        sourceOrder: null,
        sourceOrderItem: null,
        sourceInvoice: null,
        sourceInvoiceItem: null,
      }),
      createEntitlement: async () => {
        created = true;
        return entitlement();
      },
    },
    async (service) => {
      await assert.rejects(
        () => service.manuallyActivateEntitlement(
          { clientId: '7', productId: '8', sourceInvoiceId: '99', reason: 'foreign invoice' },
          { companyId: '42', sub: '10' },
        ),
        (error) => {
          assert.equal(error.statusCode, 400);
          assert.equal(error.code, 'cross_company_reference');
          return true;
        },
      );
      assert.equal(created, false);
    },
  );
});

test('cancelEntitlement marks only entitlement lifecycle fields and preserves source financial references', async () => {
  let updatePayload = null;
  await withService(
    {
      getByIdForCompany: async () => entitlement({ sourceInvoiceId: 33n, sourceOrderId: 22n }),
      updateEntitlementForCompany: async (_id, _companyId, data) => {
        updatePayload = data;
        return entitlement({ sourceInvoiceId: 33n, sourceOrderId: 22n, ...data });
      },
    },
    async (service, auditCalls) => {
      const result = await service.cancelEntitlement(
        5n,
        { reason: 'customer requested cancellation' },
        { companyId: '42', sub: '10' },
        { requestContext: { requestId: 'req-2' } },
      );
      assert.equal(result.status, 'CANCELLED');
      assert.deepEqual(Object.keys(updatePayload).sort(), [
        'cancellationReason',
        'cancelledAt',
        'cancelledByUserId',
        'status',
      ]);
      assert.equal(result.sourceInvoiceId, '33');
      assert.equal(result.sourceOrderId, '22');
      assert.equal(auditCalls[0].action, 'entitlements.cancel');
    },
  );
});

test('renewEntitlement creates a successor linked to the previous entitlement', async () => {
  let seenData = null;
  await withService(
    {
      getByIdForCompany: async () => entitlement({ id: 5n, clientId: 7n, productId: 8n }),
      getCreationContext: async () => ({
        client: { id: 7n, companyId: 42n },
        product: product(),
        sourceOrder: null,
        sourceOrderItem: null,
        sourceInvoice: { id: 44n, clientId: 7n },
        sourceInvoiceItem: null,
      }),
      createEntitlement: async (data) => {
        seenData = data;
        return entitlement({ ...data, id: 6n });
      },
    },
    async (service, auditCalls) => {
      const result = await service.renewEntitlement(
        5n,
        { startDate: new Date('2027-01-01T00:00:00.000Z'), sourceInvoiceId: '44' },
        { companyId: '42', sub: '10' },
        { requestContext: { requestId: 'req-3' } },
      );
      assert.equal(result.id, '6');
      assert.equal(result.previousEntitlementId, '5');
      assert.equal(seenData.activationSource, 'RENEWAL');
      assert.equal(auditCalls[0].action, 'entitlements.renew');
    },
  );
});

test('commercial-source retry returns the existing entitlement instead of creating a duplicate', async () => {
  let createCalls = 0;
  await withService(
    {
      findExistingByCommercialSource: async () => entitlement({ id: 77n, sourceInvoiceItemId: 55n }),
      createEntitlement: async () => {
        createCalls += 1;
        return entitlement();
      },
    },
    async (service) => {
      const result = await service.manuallyActivateEntitlement(
        { clientId: '7', productId: '8', sourceInvoiceItemId: '55', reason: 'retry' },
        { companyId: '42', sub: '10' },
      );
      assert.equal(result.id, '77');
      assert.equal(result.sourceInvoiceItemId, '55');
      assert.equal(createCalls, 0);
    },
  );
});
