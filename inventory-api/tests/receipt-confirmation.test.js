const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const receiptRepository = require('../src/repositories/receipt.repository');
const receiptService = require('../src/services/receipt.service');
const inventoryRepository = require('../src/repositories/inventory.repository');
const inventoryTxSupport = require('../src/services/inventory-transaction-support.service');

// --- auth fixtures ---
const authWithSub = { sub: 10, companyId: 7, permissions: ['receipts.confirm', 'receipts.reverse'] };

// --- mocking helpers ---
const origReceipt = {
  findPurchaseReceiptByIdForCompany: receiptRepository.findPurchaseReceiptByIdForCompany,
  findPurchaseReceiptByIdForCompanyInTransaction: receiptRepository.findPurchaseReceiptByIdForCompanyInTransaction,
  updatePurchaseReceiptInTransaction: receiptRepository.updatePurchaseReceiptInTransaction,
  updatePurchaseReceiptItemConfirmedLot: receiptRepository.updatePurchaseReceiptItemConfirmedLot,
};

const origInventory = {
  transaction: inventoryRepository.transaction,
  acquireCompanyInventoryAdvisoryLock: inventoryRepository.acquireCompanyInventoryAdvisoryLock,
  createLot: inventoryRepository.createLot,
  updateProductById: inventoryRepository.updateProductById,
};

const origTxSupport = {
  getInventoryContext: inventoryTxSupport.getInventoryContext,
  changeWarehouseStock: inventoryTxSupport.changeWarehouseStock,
  changeLotStock: inventoryTxSupport.changeLotStock,
  createMovement: inventoryTxSupport.createMovement,
  resolveUniqueInternalLotNumber: inventoryTxSupport.resolveUniqueInternalLotNumber,
};

function patchReceipt(overrides) {
  Object.assign(receiptRepository, { ...origReceipt, ...overrides });
}

function patchInventory(overrides) {
  Object.assign(inventoryRepository, { ...origInventory, ...overrides });
}

function patchTxSupport(overrides) {
  Object.assign(inventoryTxSupport, { ...origTxSupport, ...overrides });
}

function restore() {
  Object.assign(receiptRepository, origReceipt);
  Object.assign(inventoryRepository, origInventory);
  Object.assign(inventoryTxSupport, origTxSupport);
}

async function withPatched(receiptOverrides, inventoryOverrides, txSupportOverrides, work) {
  patchReceipt(receiptOverrides);
  patchInventory(inventoryOverrides);
  patchTxSupport(txSupportOverrides);
  try {
    await work();
  } finally {
    restore();
  }
}

function buildFullReceipt(overrides = {}) {
  return {
    id: 9001n,
    companyId: 7n,
    purchaseOrderId: null,
    supplierId: 3001n,
    warehouseId: 6n,
    status: 'ACCEPTED',
    receivedAt: new Date(),
    notes: null,
    evidence: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    supplier: { id: 3001n, name: 'Proveedor S.A.' },
    warehouse: { id: 6n, name: 'Bodega Central', warehouseType: 'GENERAL', isActive: true },
    purchaseOrder: null,
    items: [
      {
        id: 2001n,
        receiptId: 9001n,
        productId: 11n,
        substituteProductId: null,
        confirmedLotId: null,
        confirmedLot: null,
        requestedQuantity: 10,
        receivedQuantity: 8,
        rejectedQuantity: 2,
        lotNumber: 'LOT-ABC',
        expirationDate: new Date('2027-06-01'),
        unitCost: 5.0,
        observations: null,
        product: { id: 11n, companyId: 7n, isActive: true, requiresLot: true, requiresExpiration: true },
        substituteProduct: null,
        inspections: [],
      },
    ],
    inspections: [],
    ...overrides,
  };
}

function buildConfirmedReceipt() {
  return buildFullReceipt({
    status: 'CONFIRMED',
    items: [
      {
        ...buildFullReceipt().items[0],
        confirmedLotId: 5555n,
        confirmedLot: { id: 5555n, quantity: 6 },
      },
    ],
  });
}

const fakeContext = {
  companyId: 7n,
  userId: 10n,
  inventory: { id: 1n },
  warehouse: { id: 6n, warehouseType: 'GENERAL', isActive: true },
  product: { id: 11n },
};

const fakeLot = { id: 5555n, quantity: 6 };

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

test('confirmPurchaseReceipt rejects when receipt is not in ACCEPTED or PARTIALLY_ACCEPTED', async () => {
  await withPatched(
    { findPurchaseReceiptByIdForCompany: async () => buildFullReceipt({ status: 'DRAFT' }) },
    {},
    {},
    async () => {
      await assert.rejects(
        () => receiptService.confirmPurchaseReceipt(9001n, authWithSub),
        (err) => err?.statusCode === 409,
      );
    },
  );
});

test('confirmPurchaseReceipt rejects when receipt not found', async () => {
  await withPatched(
    { findPurchaseReceiptByIdForCompany: async () => null },
    {},
    {},
    async () => {
      await assert.rejects(
        () => receiptService.confirmPurchaseReceipt(9999n, authWithSub),
        (err) => err?.statusCode === 404,
      );
    },
  );
});

test('confirmPurchaseReceipt rejects when all items have zero accepted quantity', async () => {
  await withPatched(
    {
      findPurchaseReceiptByIdForCompany: async () => buildFullReceipt({
        status: 'ACCEPTED',
        items: [{ ...buildFullReceipt().items[0], receivedQuantity: 5, rejectedQuantity: 5 }],
      }),
    },
    {},
    {},
    async () => {
      await assert.rejects(
        () => receiptService.confirmPurchaseReceipt(9001n, authWithSub),
        (err) => err?.statusCode === 409,
      );
    },
  );
});

test('confirmPurchaseReceipt creates PURCHASE_RECEIPT movement and updates receipt to CONFIRMED', async () => {
  let capturedMovement = null;
  let lotCreated = null;
  let confirmedLotPatched = false;
  let warehouseStockUpdated = false;
  let lotStockUpdated = false;

  const confirmedReceiptResult = buildFullReceipt({
    status: 'CONFIRMED',
    items: [{ ...buildFullReceipt().items[0], confirmedLotId: 5555n, confirmedLot: fakeLot }],
  });

  await withPatched(
    {
      findPurchaseReceiptByIdForCompany: async () => buildFullReceipt(),
      updatePurchaseReceiptInTransaction: async () => confirmedReceiptResult,
      updatePurchaseReceiptItemConfirmedLot: async () => { confirmedLotPatched = true; },
    },
    {
      transaction: async (work) => work({}),
      acquireCompanyInventoryAdvisoryLock: async () => {},
      createLot: async (data) => { lotCreated = data; return fakeLot; },
      updateProductById: async () => {},
    },
    {
      getInventoryContext: async () => fakeContext,
      changeLotStock: async () => { lotStockUpdated = true; return { before: 0, after: 6 }; },
      changeWarehouseStock: async () => { warehouseStockUpdated = true; return { before: 0, after: 6, record: {} }; },
      createMovement: async (_tx, _ctx, data) => { capturedMovement = data; return { id: 1n }; },
      resolveUniqueInternalLotNumber: async () => ({ requested: 'LOT-ABC', assigned: 'LOT-ABC', collision: false }),
    },
    async () => {
      const result = await receiptService.confirmPurchaseReceipt(9001n, authWithSub);

      assert.equal(result.status, 'CONFIRMED');
      assert.equal(capturedMovement?.reasonCode, 'PURCHASE_RECEIPT');
      assert.equal(capturedMovement?.movementType, 'IN');
      assert.equal(capturedMovement?.quantity, 6); // 8 received - 2 rejected
      assert.equal(capturedMovement?.sourceType, 'purchase_receipt');
      assert.ok(lotCreated);
      assert.equal(lotCreated.manufacturerLotNumber, 'LOT-ABC');
      assert.ok(confirmedLotPatched, 'confirmedLotId should be set on receipt item');
      assert.ok(warehouseStockUpdated);
      assert.ok(lotStockUpdated);
    },
  );
});

test('reversePurchaseReceipt rejects when receipt is not CONFIRMED', async () => {
  await withPatched(
    { findPurchaseReceiptByIdForCompany: async () => buildFullReceipt({ status: 'ACCEPTED' }) },
    {},
    {},
    async () => {
      await assert.rejects(
        () => receiptService.reversePurchaseReceipt(9001n, authWithSub),
        (err) => err?.statusCode === 409,
      );
    },
  );
});

test('reversePurchaseReceipt rejects when receipt not found', async () => {
  await withPatched(
    { findPurchaseReceiptByIdForCompany: async () => null },
    {},
    {},
    async () => {
      await assert.rejects(
        () => receiptService.reversePurchaseReceipt(9999n, authWithSub),
        (err) => err?.statusCode === 404,
      );
    },
  );
});

test('reversePurchaseReceipt creates RECEIPT_REVERSAL movement and updates receipt to REVERSED', async () => {
  let capturedMovement = null;
  let warehouseStockUpdated = false;
  let lotStockUpdated = false;

  const reversedReceiptResult = buildConfirmedReceipt();
  reversedReceiptResult.status = 'REVERSED';

  await withPatched(
    {
      findPurchaseReceiptByIdForCompany: async () => buildConfirmedReceipt(),
      updatePurchaseReceiptInTransaction: async () => reversedReceiptResult,
    },
    {
      transaction: async (work) => work({}),
      acquireCompanyInventoryAdvisoryLock: async () => {},
      updateProductById: async () => {},
    },
    {
      getInventoryContext: async () => fakeContext,
      changeLotStock: async () => { lotStockUpdated = true; return { before: 6, after: 0 }; },
      changeWarehouseStock: async () => { warehouseStockUpdated = true; return { before: 6, after: 0, record: {} }; },
      createMovement: async (_tx, _ctx, data) => { capturedMovement = data; return { id: 2n }; },
    },
    async () => {
      const result = await receiptService.reversePurchaseReceipt(9001n, authWithSub);

      assert.equal(result.status, 'REVERSED');
      assert.equal(capturedMovement?.reasonCode, 'RECEIPT_REVERSAL');
      assert.equal(capturedMovement?.movementType, 'OUT');
      assert.equal(capturedMovement?.sourceType, 'purchase_receipt_reversal');
      assert.equal(capturedMovement?.quantity, 6); // 8 received - 2 rejected
      assert.ok(warehouseStockUpdated);
      assert.ok(lotStockUpdated);
    },
  );
});

test('reversePurchaseReceipt skips items without confirmedLotId (history preserved)', async () => {
  let movementsCreated = 0;

  const receiptWithoutLot = buildFullReceipt({
    status: 'CONFIRMED',
    items: [{ ...buildFullReceipt().items[0], confirmedLotId: null, confirmedLot: null }],
  });
  const reversedReceipt = { ...receiptWithoutLot, status: 'REVERSED' };

  await withPatched(
    {
      findPurchaseReceiptByIdForCompany: async () => receiptWithoutLot,
      updatePurchaseReceiptInTransaction: async () => reversedReceipt,
    },
    {
      transaction: async (work) => work({}),
      acquireCompanyInventoryAdvisoryLock: async () => {},
      updateProductById: async () => {},
    },
    {
      getInventoryContext: async () => fakeContext,
      changeLotStock: async () => ({ before: 0, after: 0 }),
      changeWarehouseStock: async () => ({ before: 0, after: 0, record: {} }),
      createMovement: async () => { movementsCreated++; return { id: 3n }; },
    },
    async () => {
      const result = await receiptService.reversePurchaseReceipt(9001n, authWithSub);
      assert.equal(result.status, 'REVERSED');
      assert.equal(movementsCreated, 0, 'No movement should be created for items without confirmedLotId');
    },
  );
});

// --- Migration test ---
test('receipt confirmation migration adds confirmed_lot_id to purchase_receipt_items', () => {
  const MIGRATION_FILE = path.join(__dirname, '../prisma/migrations/20260818030000_add_receipt_confirmation_lot_link/migration.sql');
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  assert.ok(sql.includes('confirmed_lot_id'));
  assert.ok(sql.includes('REFERENCES "lots"("id")'));
});

// --- Route contract ---
test('receipt routes expose confirm and reverse lifecycle endpoints', () => {
  process.env.BROWSER_SESSION_STORE_MODE = 'memory';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-receipt-confirm';

  const receiptRoutes = require('../src/routes/receipt.routes');

  const confirmLayer = receiptRoutes.stack.find((l) => l.route && l.route.path === '/:id/confirm' && l.route.methods.post);
  const reverseLayer = receiptRoutes.stack.find((l) => l.route && l.route.path === '/:id/reverse' && l.route.methods.post);

  assert.ok(confirmLayer, 'POST /:id/confirm route should exist');
  assert.ok(reverseLayer, 'POST /:id/reverse route should exist');
  assert.ok(confirmLayer.route.stack.length >= 2, 'confirm route should have auth guard');
  assert.ok(reverseLayer.route.stack.length >= 2, 'reverse route should have auth guard');
});
