const test = require('node:test');
const assert = require('node:assert/strict');

const receiptRepository = require('../src/repositories/receipt.repository');
const receiptService = require('../src/services/receipt.service');
const { createPurchaseReceiptSchema, createReceiptInspectionSchema } = require('../src/schemas/receipt.schema');

const auth = { sub: 99, companyId: 7, permissions: ['receipts.inspect', 'receipts.view'] };

const originals = {
  findPurchaseOrderByIdForCompany: receiptRepository.findPurchaseOrderByIdForCompany,
  findSupplierByIdForCompany: receiptRepository.findSupplierByIdForCompany,
  findWarehouseByIdForCompany: receiptRepository.findWarehouseByIdForCompany,
  findProductByIdForCompany: receiptRepository.findProductByIdForCompany,
  createPurchaseReceipt: receiptRepository.createPurchaseReceipt,
  listPurchaseReceipts: receiptRepository.listPurchaseReceipts,
  findPurchaseReceiptByIdForCompany: receiptRepository.findPurchaseReceiptByIdForCompany,
  createReceiptInspection: receiptRepository.createReceiptInspection,
  updatePurchaseReceipt: receiptRepository.updatePurchaseReceipt,
};

function patch(overrides) {
  Object.assign(receiptRepository, {
    findPurchaseOrderByIdForCompany: overrides.findPurchaseOrderByIdForCompany || originals.findPurchaseOrderByIdForCompany,
    findSupplierByIdForCompany: overrides.findSupplierByIdForCompany || originals.findSupplierByIdForCompany,
    findWarehouseByIdForCompany: overrides.findWarehouseByIdForCompany || originals.findWarehouseByIdForCompany,
    findProductByIdForCompany: overrides.findProductByIdForCompany || originals.findProductByIdForCompany,
    createPurchaseReceipt: overrides.createPurchaseReceipt || originals.createPurchaseReceipt,
    listPurchaseReceipts: overrides.listPurchaseReceipts || originals.listPurchaseReceipts,
    findPurchaseReceiptByIdForCompany: overrides.findPurchaseReceiptByIdForCompany || originals.findPurchaseReceiptByIdForCompany,
    createReceiptInspection: overrides.createReceiptInspection || originals.createReceiptInspection,
    updatePurchaseReceipt: overrides.updatePurchaseReceipt || originals.updatePurchaseReceipt,
  });
}
function restore() { Object.assign(receiptRepository, originals); }
async function withPatched(overrides, work) { patch(overrides); try { await work(); } finally { restore(); } }

function buildReceipt(overrides = {}) {
  return {
    id: 6001n,
    companyId: 7n,
    purchaseOrderId: 5001n,
    supplierId: 3001n,
    warehouseId: 6n,
    status: 'PENDING_INSPECTION',
    receivedAt: new Date(),
    notes: null,
    evidence: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    supplier: { id: 3001n, name: 'Proveedor Uno' },
    warehouse: { id: 6n, name: 'Bodega Central' },
    purchaseOrder: { id: 5001n },
    items: [{ id: 1n, receiptId: 6001n, productId: 11n, substituteProductId: null, requestedQuantity: 10, receivedQuantity: 8, rejectedQuantity: 2, lotNumber: 'LOT-1', expirationDate: new Date('2027-01-01'), unitCost: 5, observations: null, product: { id: 11n, requiresLot: true, requiresExpiration: true }, substituteProduct: null, inspections: [] }],
    inspections: [],
    ...overrides,
  };
}

test('receipt schemas accept valid payloads', () => {
  assert.ok(createPurchaseReceiptSchema.safeParse({ supplierId: 3001, warehouseId: 6, items: [{ productId: 11, requestedQuantity: 10, receivedQuantity: 8, rejectedQuantity: 2, lotNumber: 'LOT-1', expirationDate: '2027-01-01', unitCost: 5 }] }).success);
  assert.ok(createReceiptInspectionSchema.safeParse({ result: 'PARTIALLY_ACCEPTED', quantityAccepted: 8, quantityRejected: 2 }).success);
});

test('createPurchaseReceipt captures actual arrival document with differences and lot/expiration data', async () => {
  await withPatched({
    findPurchaseOrderByIdForCompany: async () => ({ id: 5001n, companyId: 7n }),
    findSupplierByIdForCompany: async () => ({ id: 3001n, companyId: 7n }),
    findWarehouseByIdForCompany: async () => ({ id: 6n, companyId: 7n, isActive: true }),
    findProductByIdForCompany: async () => ({ id: 11n, companyId: 7n, isActive: true, requiresLot: true, requiresExpiration: true }),
    createPurchaseReceipt: async () => buildReceipt(),
  }, async () => {
    const result = await receiptService.createPurchaseReceipt({
      purchaseOrderId: 5001n,
      supplierId: 3001n,
      warehouseId: 6n,
      items: [{ productId: 11n, requestedQuantity: 10, receivedQuantity: 8, rejectedQuantity: 2, lotNumber: 'LOT-1', expirationDate: new Date('2027-01-01'), unitCost: 5 }],
    }, auth);
    assert.equal(result.status, 'PENDING_INSPECTION');
    assert.equal(result.items[0].receivedQuantity, 8);
    assert.equal(result.items[0].rejectedQuantity, 2);
  });
});

test('createPurchaseReceipt rejects lot-controlled arrivals without lotNumber', async () => {
  await withPatched({
    findSupplierByIdForCompany: async () => ({ id: 3001n, companyId: 7n }),
    findWarehouseByIdForCompany: async () => ({ id: 6n, companyId: 7n, isActive: true }),
    findProductByIdForCompany: async () => ({ id: 11n, companyId: 7n, isActive: true, requiresLot: true, requiresExpiration: false }),
  }, async () => {
    await assert.rejects(
      () => receiptService.createPurchaseReceipt({ supplierId: 3001n, warehouseId: 6n, items: [{ productId: 11n, requestedQuantity: 5, receivedQuantity: 5 }] }, auth),
      (error) => error?.statusCode === 400,
    );
  });
});

test('inspectPurchaseReceiptItem records inspection and updates receipt status', async () => {
  await withPatched({
    findPurchaseReceiptByIdForCompany: async () => buildReceipt(),
    createReceiptInspection: async (data) => ({ id: 7001n, ...data, createdAt: new Date(), updatedAt: new Date() }),
    updatePurchaseReceipt: async () => buildReceipt({ status: 'PARTIALLY_ACCEPTED' }),
  }, async () => {
    const result = await receiptService.inspectPurchaseReceiptItem(6001n, 1n, { result: 'PARTIALLY_ACCEPTED', quantityAccepted: 8, quantityRejected: 2 }, auth);
    assert.equal(result.result, 'PARTIALLY_ACCEPTED');
  });
});
