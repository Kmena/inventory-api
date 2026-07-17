const test = require('node:test');
const assert = require('node:assert/strict');

const { createStockEntrySchema } = require('../src/schemas/inventory.schema');
const inventoryService = require('../src/services/inventory.service');

function createInventoryTransactionStub() {
  return {
    $executeRawUnsafe: async () => {},
    inventory: {
      findUnique: async () => ({ id: 1n }),
    },
    warehouse: {
      findFirst: async () => ({
        id: 2n,
        companyId: 10n,
        isActive: true,
        warehouseType: 'GENERAL',
        isSellableSource: true,
        isVirtual: false,
      }),
    },
    product: {
      findFirst: async () => ({
        id: 3n,
        companyId: 10n,
        name: 'Producto de prueba',
      }),
      update: async () => ({ id: 3n, quantity: 1 }),
    },
    lot: {
      findFirst: async () => null,
      create: async (payload) => ({
        id: 4n,
        ...payload.data,
      }),
    },
    warehouseLotStock: {
      findUnique: async () => null,
      create: async () => ({ id: 5n, quantity: 1, reservedQuantity: 0, productId: 3n }),
    },
    warehouseStock: {
      findUnique: async () => null,
      create: async () => ({ id: 6n, quantity: 1, reservedQuantity: 0 }),
    },
    stockMovement: {
      create: async () => ({ id: 7n }),
    },
    inventoryAlert: {
      create: async () => ({ id: 8n }),
    },
  };
}

function buildStockEntryPayload(overrides = {}) {
  return {
    warehouseId: 2n,
    productId: 3n,
    quantity: 1,
    reasonCode: 'MANUAL_ENTRY',
    internalLotNumber: 'LOT-001',
    productionDate: null,
    expirationDate: '2026-07-16',
    entryDate: '2026-07-15',
    ...overrides,
  };
}

const auth = { companyId: '10', sub: '99', permissions: ['inventory.manage'] };

test('inventory stock entry schema accepts both date-only and ISO datetime lot inputs', () => {
  const dateOnly = createStockEntrySchema.safeParse(buildStockEntryPayload());
  assert.equal(dateOnly.success, true);

  const isoDateTime = createStockEntrySchema.safeParse(buildStockEntryPayload({
    expirationDate: '2026-07-16T00:00:00.000Z',
  }));
  assert.equal(isoDateTime.success, true);
});

test('registerStockEntryInTransaction normalizes ISO datetime lot inputs consistently with date-only inputs', async () => {
  const tx = createInventoryTransactionStub();

  const acceptedDateOnlyResult = await inventoryService.registerStockEntryInTransaction(
    tx,
    buildStockEntryPayload({ expirationDate: '2026-07-16' }),
    auth,
  );

  const acceptedIsoDateTimeResult = await inventoryService.registerStockEntryInTransaction(
    tx,
    buildStockEntryPayload({ expirationDate: '2026-07-16T00:00:00.000Z' }),
    auth,
  );

  assert.equal(acceptedDateOnlyResult.lot.expirationDate instanceof Date, true);
  assert.equal(acceptedIsoDateTimeResult.lot.expirationDate instanceof Date, true);
  assert.equal(
    inventoryService.lotDateKey(acceptedDateOnlyResult.lot.expirationDate),
    '2026-07-16',
  );
  assert.equal(
    inventoryService.lotDateKey(acceptedIsoDateTimeResult.lot.expirationDate),
    '2026-07-16',
  );
});

test('inventory stock entry schema rejects unsupported lot date formats predictably', () => {
  const invalidFormat = createStockEntrySchema.safeParse(buildStockEntryPayload({
    expirationDate: '16/07/2026',
  }));

  assert.equal(invalidFormat.success, false);
});

test('registerStockEntryInTransaction keeps the expiration boundary rule after normalization', async () => {
  const tx = createInventoryTransactionStub();

  await assert.rejects(
    () => inventoryService.registerStockEntryInTransaction(
      tx,
      buildStockEntryPayload({
        entryDate: '2026-07-16',
        expirationDate: '2026-07-16T23:59:59.000Z',
      }),
      auth,
    ),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, 'validation_error');
      assert.match(error.message, /fecha de ingreso debe ser anterior a la fecha de vencimiento/i);
      return true;
    },
  );
});
