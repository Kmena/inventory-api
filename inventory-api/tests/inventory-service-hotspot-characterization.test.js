const test = require('node:test');
const assert = require('node:assert/strict');

const inventoryRepository = require('../src/repositories/inventory.repository');
const inventoryService = require('../src/services/inventory.service');

function withRepositoryStubs(stubs, run) {
  const originals = new Map();

  for (const [key, value] of Object.entries(stubs)) {
    originals.set(key, inventoryRepository[key]);
    inventoryRepository[key] = value;
  }

  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [key, value] of originals.entries()) {
        inventoryRepository[key] = value;
      }
    });
}

function buildAlert(overrides = {}) {
  return {
    id: 25n,
    companyId: 7n,
    productId: 5n,
    lotId: 9n,
    warehouseId: 3n,
    alertType: 'QA_FAILURE',
    severity: 'CRITICAL',
    status: 'OPEN',
    message: 'Lote bloqueado por QA',
    metadata: { source: 'lot-qa' },
    createdAt: new Date('2026-07-20T10:00:00Z'),
    resolvedAt: null,
    product: { id: 5n, code: 'P-5', name: 'Producto 5' },
    lot: {
      id: 9n,
      internalLotNumber: 'LOT-9',
      manufacturerLotNumber: 'FAB-9',
      expirationDate: new Date('2026-12-31T00:00:00Z'),
      status: 'BLOCKED',
      qaStatus: 'FAILED',
    },
    warehouse: { id: 3n, name: 'Bodega QA', warehouseType: 'QUARANTINE' },
    ...overrides,
  };
}

function buildLot(overrides = {}) {
  return {
    id: 81n,
    companyId: 7n,
    productId: 5n,
    status: 'QUARANTINED',
    qaStatus: 'PENDING',
    expirationDate: new Date('2026-12-31T00:00:00Z'),
    warehouseLotStocks: [{ warehouseId: 3n }],
    ...overrides,
  };
}

test('updateProductById scopes inventory-linked product writes by company when the helper is used from supported flows', async () => {
  const product = await inventoryRepository.updateProductById(
    41n,
    7n,
    { quantity: { increment: 2 } },
    {
      product: {
        updateMany: async ({ where, data }) => {
          assert.deepEqual(where, { id: 41n, companyId: 7n, isActive: true });
          assert.deepEqual(data, { quantity: { increment: 2 } });
          return { count: 1 };
        },
        findFirst: async ({ where }) => {
          assert.deepEqual(where, { id: 41n, companyId: 7n, isActive: true });
          return { id: 41n, companyId: 7n, quantity: 12 };
        },
      },
    },
  );

  assert.deepEqual(product, { id: 41n, companyId: 7n, quantity: 12 });
});

test('listMovements preserves company scope and paginated response shape', async () => {
  let receivedArguments = null;

  const response = await withRepositoryStubs(
    {
      findAllMovements: async (companyId, filters, pagination) => {
        receivedArguments = { companyId, filters, pagination };
        return {
          items: [{ id: 41n, movementType: 'IN' }, { id: 40n, movementType: 'OUT' }],
          totalItems: 6,
        };
      },
    },
    () => inventoryService.listMovements(
      { companyId: '7', sub: '10' },
      { warehouseId: 3n, productId: 5n },
      { page: 2, pageSize: 2, skip: 2, take: 2 },
    ),
  );

  assert.deepEqual(receivedArguments, {
    companyId: 7n,
    filters: { warehouseId: 3n, productId: 5n },
    pagination: { page: 2, pageSize: 2, skip: 2, take: 2 },
  });
  assert.deepEqual(response.items, [{ id: 41n, movementType: 'IN' }, { id: 40n, movementType: 'OUT' }]);
  assert.deepEqual(response.pagination, {
    page: 2,
    pageSize: 2,
    totalItems: 6,
    totalPages: 3,
  });
});

test('listInventoryAlerts preserves serialized actions inside paginated responses', async () => {
  const response = await withRepositoryStubs(
    {
      findInventoryAlerts: async () => ({
        items: [
          buildAlert({ status: 'OPEN' }),
          buildAlert({ id: 26n, status: 'ACKNOWLEDGED' }),
        ],
        totalItems: 2,
      }),
    },
    () => inventoryService.listInventoryAlerts(
      { companyId: '7', sub: '10', permissions: ['inventory.view'] },
      { severity: 'CRITICAL' },
      { page: 1, pageSize: 2, skip: 0, take: 2 },
    ),
  );

  assert.deepEqual(response.items.map((item) => ({ id: item.id, availableActions: item.availableActions })), [
    { id: 25n, availableActions: ['ACKNOWLEDGED', 'RESOLVED'] },
    { id: 26n, availableActions: ['RESOLVED'] },
  ]);
  assert.deepEqual(response.pagination, {
    page: 1,
    pageSize: 2,
    totalItems: 2,
    totalPages: 1,
  });
});

test('updateInventoryAlertStatus reports conflict when the alert disappears before update', async () => {
  await withRepositoryStubs(
    {
      findInventoryAlertById: async () => buildAlert({ status: 'OPEN' }),
      updateInventoryAlert: async () => null,
    },
    async () => {
      await assert.rejects(
        () => inventoryService.updateInventoryAlertStatus(
          25n,
          { status: 'ACKNOWLEDGED', note: 'Tomada por QA' },
          { companyId: '7', sub: '10', permissions: ['inventory.manage'] },
        ),
        (error) => {
          assert.equal(error.statusCode, 409);
          assert.equal(error.code, 'conflict');
          return true;
        },
      );
    },
  );
});

test('updateLotQa keeps reject transition side effects inside the repository transaction boundary', async () => {
  const tx = { name: 'tx-update-lot-qa-reject' };
  const observedTxs = [];
  let createdAlert = null;
  let statusHistory = null;

  const updatedLot = await withRepositoryStubs(
    {
      transaction: async (work) => work(tx),
      findLotForCompanyWithActiveWarehouseStocks: async (lotId, companyId, receivedTx) => {
        observedTxs.push(receivedTx);
        assert.equal(lotId, 81n);
        assert.equal(companyId, 7n);
        return buildLot();
      },
      updateLotByIdWithWarehouseStocks: async (_lotId, payload, receivedTx) => {
        observedTxs.push(receivedTx);
        return { id: 81n, status: payload.status, qaStatus: payload.qaStatus };
      },
      createLotStatusHistory: async (payload, receivedTx) => {
        observedTxs.push(receivedTx);
        statusHistory = payload;
      },
      createInventoryAlert: async (payload, receivedTx) => {
        observedTxs.push(receivedTx);
        createdAlert = payload;
      },
    },
    () => inventoryService.updateLotQa(
      81n,
      { action: 'REJECT', reason: 'Contaminacion detectada' },
      { companyId: '7', sub: '10' },
    ),
  );

  assert.deepEqual(observedTxs, [tx, tx, tx, tx]);
  assert.equal(updatedLot.status, 'BLOCKED');
  assert.equal(updatedLot.qaStatus, 'REJECTED');
  assert.equal(statusHistory.action, 'REJECT');
  assert.equal(statusHistory.previousStatus, 'QUARANTINED');
  assert.equal(statusHistory.newStatus, 'BLOCKED');
  assert.equal(createdAlert.alertType, 'LOT_BLOCKED');
  assert.equal(createdAlert.status, 'OPEN');
  assert.equal(createdAlert.message, 'Contaminacion detectada');
});

test('updateLotQa keeps reactivation resolution inside the repository transaction boundary', async () => {
  const tx = { name: 'tx-update-lot-qa-reactivate' };
  const observedTxs = [];
  let resolvedArguments = null;

  const updatedLot = await withRepositoryStubs(
    {
      transaction: async (work) => work(tx),
      findLotForCompanyWithActiveWarehouseStocks: async (_lotId, _companyId, receivedTx) => {
        observedTxs.push(receivedTx);
        return buildLot({ status: 'BLOCKED', qaStatus: 'REJECTED' });
      },
      updateLotByIdWithWarehouseStocks: async (_lotId, payload, receivedTx) => {
        observedTxs.push(receivedTx);
        return { id: 81n, status: payload.status, qaStatus: payload.qaStatus };
      },
      createLotStatusHistory: async (_payload, receivedTx) => {
        observedTxs.push(receivedTx);
      },
      resolveOpenLotAlerts: async (companyId, lotId, resolvedAt, receivedTx) => {
        observedTxs.push(receivedTx);
        resolvedArguments = { companyId, lotId, resolvedAt };
      },
    },
    () => inventoryService.updateLotQa(
      81n,
      { action: 'REACTIVATE', reason: 'Lote rehabilitado' },
      { companyId: '7', sub: '10' },
    ),
  );

  assert.deepEqual(observedTxs, [tx, tx, tx, tx]);
  assert.equal(updatedLot.status, 'AVAILABLE');
  assert.equal(updatedLot.qaStatus, 'APPROVED');
  assert.equal(resolvedArguments.companyId, 7n);
  assert.equal(resolvedArguments.lotId, 81n);
  assert.ok(resolvedArguments.resolvedAt instanceof Date);
});

test('registerStockEntry keeps context loading, advisory lock, and persistence operations inside the transaction boundary', async () => {
  const tx = { name: 'tx-register-stock-entry' };
  const observedTxs = [];
  let advisoryLockCompanyId = null;
  let movementPayload = null;

  const result = await withRepositoryStubs(
    {
      transaction: async (work) => work(tx),
      loadInventoryContext: async (companyId, warehouseId, productId, receivedTx) => {
        observedTxs.push(receivedTx);
        assert.equal(companyId, 7n);
        assert.equal(warehouseId, 3n);
        assert.equal(productId, 5n);
        return {
          inventory: { id: 91n },
          warehouse: { id: 3n, warehouseType: 'MAIN', isActive: true, isSellableSource: true, isVirtual: false },
          product: { id: 5n, name: 'Producto 5', lotStrategy: 'FEFO' },
        };
      },
      acquireCompanyInventoryAdvisoryLock: async (companyId, receivedTx) => {
        observedTxs.push(receivedTx);
        advisoryLockCompanyId = companyId;
      },
      findLotByInternalNumber: async (_companyId, _internalLotNumber, receivedTx) => {
        observedTxs.push(receivedTx);
        return null;
      },
      createLot: async (payload, receivedTx) => {
        observedTxs.push(receivedTx);
        return {
          id: 101n,
          productId: payload.productId,
          quantity: payload.quantity,
          status: payload.status,
          qaStatus: payload.qaStatus,
        };
      },
      findWarehouseLotStockRecord: async (_warehouseId, _lotId, receivedTx) => {
        observedTxs.push(receivedTx);
        return null;
      },
      createWarehouseLotStockRecord: async (payload, receivedTx) => {
        observedTxs.push(receivedTx);
        return { id: 102n, warehouseId: payload.warehouseId, lotId: payload.lotId, quantity: payload.quantity, reservedQuantity: 0 };
      },
      findWarehouseStockRecord: async (_warehouseId, _productId, receivedTx) => {
        observedTxs.push(receivedTx);
        return null;
      },
      createWarehouseStockRecord: async (payload, receivedTx) => {
        observedTxs.push(receivedTx);
        return { id: 103n, warehouseId: payload.warehouseId, productId: payload.productId, quantity: payload.quantity, reservedQuantity: 0 };
      },
      updateProductById: async (_productId, companyId, _payload, receivedTx) => {
        observedTxs.push(receivedTx);
        assert.equal(companyId, 7n);
        return { id: 5n, quantity: 8 };
      },
      createStockMovementRecord: async (payload, receivedTx) => {
        observedTxs.push(receivedTx);
        movementPayload = payload;
        return { id: 104n, ...payload };
      },
    },
    () => inventoryService.registerStockEntry(
      {
        warehouseId: 3n,
        productId: 5n,
        quantity: 8,
        lotNumber: 'LOT-100',
        invoiceNumber: 'INV-100',
        reasonCode: 'PURCHASE_RECEIPT',
        entryDate: '2026-07-20',
        expirationDate: '2026-12-31',
        note: 'Entrada inicial',
      },
      { companyId: '7', sub: '10' },
    ),
  );

  assert.ok(observedTxs.length >= 9);
  assert.ok(observedTxs.every((receivedTx) => receivedTx === tx));
  assert.equal(advisoryLockCompanyId, 7n);
  assert.equal(movementPayload.movementType, 'IN');
  assert.equal(movementPayload.sourceType, 'lot_entry');
  assert.equal(result.lot.id, 101n);
  assert.equal(result.movement.id, 104n);
  assert.equal(result.lotNumberCollision, null);
});
