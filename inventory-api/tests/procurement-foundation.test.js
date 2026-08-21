const test = require('node:test');
const assert = require('node:assert/strict');

const procurementRepository = require('../src/repositories/procurement.repository');
const procurementService = require('../src/services/procurement.service');
const {
  createPurchaseRequestSchema,
  createSupplierQuotationSchema,
  selectSupplierQuotationSchema,
  approveSupplierSelectionSchema,
  createPurchaseOrderSchema,
} = require('../src/schemas/procurement.schema');

const auth = {
  sub: 99,
  companyId: 7,
  permissions: ['procurement.manage', 'procurement.approve', 'procurement.view'],
};

const originals = {
  transaction: procurementRepository.transaction,
  findCompanyConfigByCompanyId: procurementRepository.findCompanyConfigByCompanyId,
  findSupplierByIdForCompany: procurementRepository.findSupplierByIdForCompany,
  findProductByIdForCompany: procurementRepository.findProductByIdForCompany,
  listQuotableProductsForCompany: procurementRepository.listQuotableProductsForCompany,
  findProductSupplierPricingByProductIdForCompany: procurementRepository.findProductSupplierPricingByProductIdForCompany,
  createPurchaseRequest: procurementRepository.createPurchaseRequest,
  createAssistedPurchaseRequest: procurementRepository.createAssistedPurchaseRequest,
  listPurchaseRequests: procurementRepository.listPurchaseRequests,
  findPurchaseRequestByIdForCompany: procurementRepository.findPurchaseRequestByIdForCompany,
  updatePurchaseRequest: procurementRepository.updatePurchaseRequest,
  createSupplierQuotation: procurementRepository.createSupplierQuotation,
  findSupplierQuotationByIdForCompany: procurementRepository.findSupplierQuotationByIdForCompany,
  updateSupplierQuotation: procurementRepository.updateSupplierQuotation,
  createSupplierSelection: procurementRepository.createSupplierSelection,
  findSupplierSelectionByIdForCompany: procurementRepository.findSupplierSelectionByIdForCompany,
  updateSupplierSelection: procurementRepository.updateSupplierSelection,
  createPurchaseOrder: procurementRepository.createPurchaseOrder,
  findPurchaseOrderByIdForCompany: procurementRepository.findPurchaseOrderByIdForCompany,
  listPurchaseOrders: procurementRepository.listPurchaseOrders,
};

function patch(overrides) {
  Object.assign(procurementRepository, {
    transaction: overrides.transaction || originals.transaction,
    findCompanyConfigByCompanyId: overrides.findCompanyConfigByCompanyId || originals.findCompanyConfigByCompanyId,
    findSupplierByIdForCompany: overrides.findSupplierByIdForCompany || originals.findSupplierByIdForCompany,
    findProductByIdForCompany: overrides.findProductByIdForCompany || originals.findProductByIdForCompany,
    listQuotableProductsForCompany: overrides.listQuotableProductsForCompany || originals.listQuotableProductsForCompany,
    findProductSupplierPricingByProductIdForCompany: overrides.findProductSupplierPricingByProductIdForCompany || originals.findProductSupplierPricingByProductIdForCompany,
    createPurchaseRequest: overrides.createPurchaseRequest || originals.createPurchaseRequest,
    createAssistedPurchaseRequest: overrides.createAssistedPurchaseRequest || originals.createAssistedPurchaseRequest,
    listPurchaseRequests: overrides.listPurchaseRequests || originals.listPurchaseRequests,
    findPurchaseRequestByIdForCompany: overrides.findPurchaseRequestByIdForCompany || originals.findPurchaseRequestByIdForCompany,
    updatePurchaseRequest: overrides.updatePurchaseRequest || originals.updatePurchaseRequest,
    createSupplierQuotation: overrides.createSupplierQuotation || originals.createSupplierQuotation,
    findSupplierQuotationByIdForCompany: overrides.findSupplierQuotationByIdForCompany || originals.findSupplierQuotationByIdForCompany,
    updateSupplierQuotation: overrides.updateSupplierQuotation || originals.updateSupplierQuotation,
    createSupplierSelection: overrides.createSupplierSelection || originals.createSupplierSelection,
    findSupplierSelectionByIdForCompany: overrides.findSupplierSelectionByIdForCompany || originals.findSupplierSelectionByIdForCompany,
    updateSupplierSelection: overrides.updateSupplierSelection || originals.updateSupplierSelection,
    createPurchaseOrder: overrides.createPurchaseOrder || originals.createPurchaseOrder,
    findPurchaseOrderByIdForCompany: overrides.findPurchaseOrderByIdForCompany || originals.findPurchaseOrderByIdForCompany,
  });
}

function restore() {
  Object.assign(procurementRepository, originals);
}

async function withPatched(overrides, work) {
  patch(overrides);
  try {
    await work();
  } finally {
    restore();
  }
}

function buildRequest(overrides = {}) {
  return {
    id: 1001n,
    companyId: 7n,
    requestedByUserId: 99n,
    title: 'Reposición de materia prima',
    notes: null,
    status: 'OPEN',
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      { id: 1n, productId: 11n, quantity: 10, notes: null, product: { id: 11n, companyId: 7n, name: 'Ácido cítrico' } },
    ],
    quotations: [],
    selections: [],
    purchaseOrders: [],
    ...overrides,
  };
}

function buildQuotation(overrides = {}) {
  return {
    id: 2001n,
    companyId: 7n,
    purchaseRequestId: 1001n,
    supplierId: 3001n,
    createdByUserId: 99n,
    reference: 'Q-1',
    currency: 'CRC',
    notes: null,
    evidence: null,
    status: 'SUBMITTED',
    submittedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    supplier: { id: 3001n, companyId: 7n, name: 'Proveedor Uno' },
    items: [
      { id: 1n, productId: 11n, quantity: 10, unitPrice: 5, leadTimeDays: 2, availabilityNotes: null, notes: null, product: { id: 11n, name: 'Ácido cítrico' } },
    ],
    ...overrides,
  };
}

function buildSelection(overrides = {}) {
  return {
    id: 4001n,
    companyId: 7n,
    purchaseRequestId: 1001n,
    quotationId: 2001n,
    selectedByUserId: 99n,
    approvedByUserId: 99n,
    approvalStatus: 'APPROVED',
    approvalRequired: false,
    totalAmount: 50,
    currency: 'CRC',
    justification: null,
    approvedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    quotation: buildQuotation(),
    purchaseRequest: buildRequest(),
    ...overrides,
  };
}

test('procurement schemas accept valid foundation payloads', () => {
  assert.ok(createPurchaseRequestSchema.safeParse({
    title: 'Compra',
    items: [{ productId: 11, quantity: 5 }],
  }).success);

  assert.ok(createSupplierQuotationSchema.safeParse({
    supplierId: 3001,
    items: [{ productId: 11, quantity: 5, unitPrice: 12.5 }],
  }).success);

  const { createAssistedQuotationRequestSchema } = require('../src/schemas/procurement.schema');
  assert.ok(createAssistedQuotationRequestSchema.safeParse({
    products: [{
      productId: 11,
      quantity: 5,
      suppliers: [{ supplierId: 3001, unitPrice: 12.5 }],
    }],
  }).success);

  assert.ok(selectSupplierQuotationSchema.safeParse({ quotationId: 2001 }).success);
  assert.ok(approveSupplierSelectionSchema.safeParse({ justification: 'Aprobado' }).success);
  assert.ok(createPurchaseOrderSchema.safeParse({ selectionId: 4001 }).success);
});

test('listQuotableProducts returns only products with supplier links ordered by shortage descending', async () => {
  await withPatched({
    listQuotableProductsForCompany: async (companyId) => {
      assert.equal(companyId, 7n);
      return [
        {
          id: 11n,
          companyId: 7n,
          sku: 'MP-001',
          name: 'Ácido cítrico',
          inventoryType: 'RAW_MATERIAL',
          sourcingMethod: 'PURCHASE_ONLY',
          quantity: 2,
          minStock: 10,
          supplierLinks: [{ supplierId: 301n }],
        },
        {
          id: 12n,
          companyId: 7n,
          sku: 'MP-002',
          name: 'Bicarbonato',
          inventoryType: 'RAW_MATERIAL',
          sourcingMethod: 'PURCHASE_ONLY',
          quantity: 6,
          minStock: 6,
          supplierLinks: [{ supplierId: 302n }, { supplierId: 303n }],
        },
        {
          id: 13n,
          companyId: 7n,
          sku: 'MP-003',
          name: 'Alcohol',
          inventoryType: 'RAW_MATERIAL',
          sourcingMethod: 'PURCHASE_ONLY',
          quantity: 1,
          minStock: 5,
          supplierLinks: [{ supplierId: 304n }],
        },
      ];
    },
  }, async () => {
    const result = await procurementService.listQuotableProducts(auth);
    assert.equal(result.length, 3);
    assert.deepEqual(result.map((item) => item.id), [11n, 13n, 12n]);
    assert.equal(result[0].shortage, 8);
    assert.equal(result[1].shortage, 4);
    assert.equal(result[2].shortage, 0);
    assert.equal(result[1].supplierCount, 1);
    assert.deepEqual(result[2].supplierIds, [302n, 303n]);
  });
});

test('listQuotableProducts rejects access without company scope', async () => {
  await assert.rejects(
    () => procurementService.listQuotableProducts({ permissions: ['procurement.view'] }),
    (error) => error?.statusCode === 403 && error?.code === 'forbidden',
  );
});

test('getProductSuppliersPricing returns only tenant-scoped supplier pricing for a product', async () => {
  await withPatched({
    findProductSupplierPricingByProductIdForCompany: async (productId, companyId) => {
      assert.equal(productId, 11n);
      assert.equal(companyId, 7n);
      return {
        id: 11n,
        companyId: 7n,
        sku: 'MP-001',
        name: 'Ácido cítrico',
        quantity: 2,
        minStock: 10,
        supplierLinks: [
          {
            productId: 11n,
            supplierId: 301n,
            isPreferred: true,
            supplierSku: 'AC-301',
            unitPrice: '25.50',
            currency: 'USD',
            leadTimeDays: 4,
            minimumOrderQuantity: '3.000',
            notes: 'Entrega semanal',
            createdAt: new Date(),
            supplier: {
              id: 301n,
              companyId: 7n,
              name: 'Proveedor Uno',
              email: 'uno@example.com',
              phone: '555-1000',
              country: 'CR',
            },
          },
          {
            productId: 11n,
            supplierId: 302n,
            isPreferred: false,
            supplierSku: null,
            unitPrice: null,
            currency: null,
            leadTimeDays: null,
            minimumOrderQuantity: null,
            notes: null,
            createdAt: new Date(),
            supplier: {
              id: 302n,
              companyId: 7n,
              name: 'Proveedor Dos',
              email: null,
              phone: null,
              country: null,
            },
          },
        ],
      };
    },
  }, async () => {
    const result = await procurementService.getProductSuppliersPricing(11n, auth);
    assert.equal(result.productId, 11n);
    assert.equal(result.shortage, 8);
    assert.equal(result.suppliers.length, 2);
    assert.equal(result.suppliers[0].supplierId, 301n);
    assert.equal(result.suppliers[0].unitPrice, 25.5);
    assert.equal(result.suppliers[0].currency, 'USD');
    assert.equal(result.suppliers[0].minimumOrderQuantity, 3);
    assert.equal(result.suppliers[1].currency, 'CRC');
  });
});

test('getProductSuppliersPricing returns 404 when product is outside tenant scope or has no suppliers', async () => {
  await withPatched({
    findProductSupplierPricingByProductIdForCompany: async () => null,
  }, async () => {
    await assert.rejects(
      () => procurementService.getProductSuppliersPricing(11n, auth),
      (error) => error?.statusCode === 404 && error?.code === 'not_found',
    );
  });
});

test('createAssistedQuotationRequest creates one grouped purchase request and quotations grouped by supplier', async () => {
  const transactionCalls = [];
  await withPatched({
    transaction: async (work) => work({ tx: true }),
    findProductSupplierPricingByProductIdForCompany: async (productId, companyId) => {
      assert.equal(companyId, 7n);
      const commonSupplier = { id: 301n, companyId: 7n, name: 'Proveedor Uno' };
      if (productId === 11n) {
        return {
          id: 11n,
          companyId: 7n,
          name: 'Ácido cítrico',
          supplierLinks: [{ supplierId: 301n, currency: 'CRC', leadTimeDays: 2, supplier: commonSupplier }],
        };
      }
      if (productId === 12n) {
        return {
          id: 12n,
          companyId: 7n,
          name: 'Bicarbonato',
          supplierLinks: [{ supplierId: 301n, currency: 'CRC', leadTimeDays: 3, supplier: commonSupplier }],
        };
      }
      return null;
    },
    createAssistedPurchaseRequest: async (data) => {
      transactionCalls.push({ kind: 'request', data });
      return buildRequest({
        id: 9001n,
        title: data.title,
        notes: data.notes,
        items: data.items.create.map((item, index) => ({ id: BigInt(index + 1), ...item, product: { id: item.productId } })),
      });
    },
    createSupplierQuotation: async (data) => {
      transactionCalls.push({ kind: 'quotation', data });
      return buildQuotation({
        id: BigInt(9100 + transactionCalls.length),
        purchaseRequestId: data.purchaseRequestId,
        supplierId: data.supplierId,
        currency: data.currency,
        items: data.items.create.map((item, index) => ({ id: BigInt(index + 1), ...item, product: { id: item.productId } })),
        supplier: { id: data.supplierId, companyId: 7n, name: 'Proveedor Uno' },
      });
    },
  }, async () => {
    const result = await procurementService.createAssistedQuotationRequest({
      title: 'Cotización semanal',
      notes: 'Generada desde workspace',
      products: [
        { productId: 11n, quantity: 5, suppliers: [{ supplierId: 301n, unitPrice: 12.5 }] },
        { productId: 12n, quantity: 8, suppliers: [{ supplierId: 301n, unitPrice: 18.75, leadTimeDays: 4 }] },
      ],
    }, auth);

    assert.equal(result.purchaseRequest.id, 9001n);
    assert.equal(result.purchaseRequest.items.length, 2);
    assert.equal(result.quotations.length, 1);
    assert.equal(result.quotations[0].supplierId, 301n);
    assert.equal(result.quotations[0].items.length, 2);
    assert.equal(transactionCalls.filter((entry) => entry.kind === 'request').length, 1);
  });
});

test('createAssistedQuotationRequest rejects supplier selections not linked to the product', async () => {
  await withPatched({
    findProductSupplierPricingByProductIdForCompany: async () => ({
      id: 11n,
      companyId: 7n,
      name: 'Ácido cítrico',
      supplierLinks: [{ supplierId: 301n, currency: 'CRC', leadTimeDays: 2, supplier: { id: 301n, companyId: 7n, name: 'Proveedor Uno' } }],
    }),
  }, async () => {
    await assert.rejects(
      () => procurementService.createAssistedQuotationRequest({
        products: [{ productId: 11n, quantity: 5, suppliers: [{ supplierId: 999n, unitPrice: 12.5 }] }],
      }, auth),
      (error) => error?.statusCode === 400 && error?.code === 'validation_error',
    );
  });
});

test('createPurchaseRequest stores request items without inventory effects', async () => {
  await withPatched({
    findProductByIdForCompany: async () => ({ id: 11n, companyId: 7n, isActive: true }),
    createPurchaseRequest: async (data) => buildRequest({ title: data.title, notes: data.notes }),
  }, async () => {
    const result = await procurementService.createPurchaseRequest({
      title: 'Reposición de materia prima',
      items: [{ productId: 11n, quantity: 10 }],
    }, auth);

    assert.equal(result.status, 'OPEN');
    assert.equal(result.items.length, 1);
  });
});

test('createSupplierQuotation rejects products not present in request', async () => {
  await withPatched({
    findPurchaseRequestByIdForCompany: async () => buildRequest(),
    findSupplierByIdForCompany: async () => ({ id: 3001n, companyId: 7n }),
    findProductByIdForCompany: async () => ({ id: 22n, companyId: 7n, isActive: true }),
  }, async () => {
    await assert.rejects(
      () => procurementService.createSupplierQuotation(1001n, {
        supplierId: 3001n,
        items: [{ productId: 22n, quantity: 5, unitPrice: 4 }],
      }, auth),
      (error) => error?.statusCode === 400 && error?.code === 'validation_error',
    );
  });
});

test('compareSupplierQuotations sorts quotations by total amount', async () => {
  await withPatched({
    findPurchaseRequestByIdForCompany: async () => buildRequest({
      quotations: [
        buildQuotation({ id: 1n, items: [{ id: 1n, productId: 11n, quantity: 10, unitPrice: 20, leadTimeDays: 5, product: { id: 11n } }] }),
        buildQuotation({ id: 2n, items: [{ id: 2n, productId: 11n, quantity: 10, unitPrice: 10, leadTimeDays: 3, product: { id: 11n } }] }),
      ],
    }),
  }, async () => {
    const result = await procurementService.compareSupplierQuotations(1001n, auth);
    assert.equal(result.quotations.length, 2);
    assert.equal(result.quotations[0].id, 2n);
    assert.equal(result.quotations[0].totalAmount, 100);
  });
});

test('selectSupplierQuotation marks selection pending approval when total exceeds threshold', async () => {
  await withPatched({
    findPurchaseRequestByIdForCompany: async () => buildRequest(),
    findSupplierQuotationByIdForCompany: async () => buildQuotation({ items: [{ id: 1n, productId: 11n, quantity: 10, unitPrice: 15, leadTimeDays: 2, product: { id: 11n } }] }),
    findCompanyConfigByCompanyId: async () => ({ companyId: 7n, settingsJson: { procurementApprovalThreshold: 100 } }),
    createSupplierSelection: async (data) => buildSelection({
      quotationId: data.quotationId,
      approvalStatus: data.approvalStatus,
      approvalRequired: data.approvalRequired,
      totalAmount: data.totalAmount,
      approvedByUserId: data.approvedByUserId,
      approvedAt: data.approvedAt,
    }),
    updateSupplierQuotation: async () => buildQuotation({ status: 'SELECTED' }),
  }, async () => {
    const result = await procurementService.selectSupplierQuotation(1001n, { quotationId: 2001n }, auth);
    assert.equal(result.approvalRequired, true);
    assert.equal(result.approvalStatus, 'PENDING');
  });
});

test('selectSupplierQuotation auto-approves when no threshold is configured', async () => {
  await withPatched({
    findPurchaseRequestByIdForCompany: async () => buildRequest(),
    findSupplierQuotationByIdForCompany: async () => buildQuotation(),
    findCompanyConfigByCompanyId: async () => ({ companyId: 7n, settingsJson: {} }),
    createSupplierSelection: async (data) => buildSelection({
      approvalStatus: data.approvalStatus,
      approvalRequired: data.approvalRequired,
      approvedByUserId: data.approvedByUserId,
      approvedAt: data.approvedAt,
    }),
    updateSupplierQuotation: async () => buildQuotation({ status: 'SELECTED' }),
  }, async () => {
    const result = await procurementService.selectSupplierQuotation(1001n, { quotationId: 2001n }, auth);
    assert.equal(result.approvalRequired, false);
    assert.equal(result.approvalStatus, 'APPROVED');
  });
});

test('approveSupplierSelection approves pending selection', async () => {
  await withPatched({
    findSupplierSelectionByIdForCompany: async () => buildSelection({ approvalRequired: true, approvalStatus: 'PENDING', approvedByUserId: null, approvedAt: null }),
    updateSupplierSelection: async (_id, _companyId, data) => buildSelection({ approvalRequired: true, approvalStatus: data.approvalStatus, approvedByUserId: data.approvedByUserId, approvedAt: data.approvedAt }),
  }, async () => {
    const result = await procurementService.approveSupplierSelection(4001n, {}, auth);
    assert.equal(result.approvalStatus, 'APPROVED');
    assert.equal(result.approvedByUserId, 99n);
  });
});

test('createPurchaseOrderFromSelection requires approved selection when approval is required', async () => {
  await withPatched({
    findPurchaseRequestByIdForCompany: async () => buildRequest(),
    findSupplierSelectionByIdForCompany: async () => buildSelection({ approvalRequired: true, approvalStatus: 'PENDING' }),
  }, async () => {
    await assert.rejects(
      () => procurementService.createPurchaseOrderFromSelection(1001n, { selectionId: 4001n }, auth),
      (error) => error?.statusCode === 409 && error?.code === 'conflict',
    );
  });
});

test('createPurchaseOrderFromSelection creates PO and closes request when selection is approved', async () => {
  await withPatched({
    findPurchaseRequestByIdForCompany: async () => buildRequest(),
    findSupplierSelectionByIdForCompany: async () => buildSelection({ approvalRequired: true, approvalStatus: 'APPROVED' }),
    createPurchaseOrder: async (data) => ({
      id: 5001n,
      companyId: data.companyId,
      purchaseRequestId: data.purchaseRequestId,
      quotationId: data.quotationId,
      selectionId: data.selectionId,
      supplierId: data.supplierId,
      createdByUserId: data.createdByUserId,
      status: 'DRAFT',
      notes: data.notes,
      createdAt: new Date(),
      updatedAt: new Date(),
      supplier: { id: data.supplierId, name: 'Proveedor Uno' },
      items: data.items.create.map((item, index) => ({ id: BigInt(index + 1), ...item, product: { id: item.productId } })),
    }),
    updatePurchaseRequest: async () => buildRequest({ status: 'CLOSED' }),
  }, async () => {
    const result = await procurementService.createPurchaseOrderFromSelection(1001n, { selectionId: 4001n }, auth);
    assert.equal(result.status, 'DRAFT');
    assert.equal(result.items.length, 1);
    assert.equal(result.supplierId, 3001n);
  });
});

test('listPurchaseOrders returns tenant-scoped orders serialized by serializePurchaseOrder', async (t) => {
  const sampleOrders = [
    {
      id: 9001n,
      companyId: 7n,
      purchaseRequestId: 1001n,
      quotationId: 2001n,
      selectionId: 4001n,
      supplierId: 3001n,
      createdByUserId: 99n,
      status: 'PENDING',
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      supplier: { id: 3001n, name: 'Proveedor Uno' },
      items: [{
        id: 8001n, productId: 500n, quantity: 5, unitPrice: 1000, notes: null,
        product: { id: 500n, name: 'Azúcar', sku: 'AZ-001' },
      }],
    },
  ];

  await t.test('enforces company scope — returns empty list for company with no orders', async () => {
    const restore = procurementRepository.listPurchaseOrders;
    procurementRepository.listPurchaseOrders = async (companyId) => {
      assert.equal(Number(companyId), auth.companyId, 'listPurchaseOrders must be called with authenticated company scope');
      return [];
    };
    const result = await procurementService.listPurchaseOrders(auth);
    assert.deepEqual(result, []);
    procurementRepository.listPurchaseOrders = restore;
  });

  await t.test('serializes purchase orders with supplier and items', async () => {
    const restore = procurementRepository.listPurchaseOrders;
    procurementRepository.listPurchaseOrders = async () => sampleOrders;
    const result = await procurementService.listPurchaseOrders(auth);
    assert.equal(result.length, 1);
    assert.equal(result[0].status, 'PENDING');
    assert.ok(result[0].supplier, 'serialized order must include supplier');
    assert.equal(result[0].items.length, 1);
    assert.ok(result[0].items[0].product, 'serialized items must include product');
    procurementRepository.listPurchaseOrders = restore;
  });

  await t.test('rejects unauthenticated actors — throws when companyId is absent', async () => {
    const unauthAuth = { sub: 1, companyId: null, permissions: ['procurement.view'] };
    await assert.rejects(
      () => procurementService.listPurchaseOrders(unauthAuth),
      /empresa/,
    );
  });
});
