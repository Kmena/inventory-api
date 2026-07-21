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
    id: 15n,
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

test('listInventoryAlerts rejects authenticated users without company scope', async () => {
  await assert.rejects(
    () => inventoryService.listInventoryAlerts({ companyId: null, sub: '10', permissions: ['inventory.view'] }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'forbidden');
      return true;
    },
  );
});

test('listInventoryAlerts rejects users without inventory alert permissions', async () => {
  await assert.rejects(
    () => inventoryService.listInventoryAlerts({ companyId: '7', sub: '10', permissions: ['sales.manage'] }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'forbidden');
      return true;
    },
  );
});

test('listInventoryAlerts scopes repository access to the authenticated company', async () => {
  let receivedArguments = null;

  const result = await withRepositoryStubs(
    {
      findInventoryAlerts: async (companyId, filters, pagination) => {
        receivedArguments = { companyId, filters, pagination };
        return [buildAlert()];
      },
    },
    () => inventoryService.listInventoryAlerts(
      { companyId: '7', sub: '10', permissions: ['inventory.view'] },
      { status: 'OPEN', severity: 'CRITICAL' },
    ),
  );

  assert.deepEqual(receivedArguments, {
    companyId: 7n,
    filters: { status: 'OPEN', severity: 'CRITICAL' },
    pagination: null,
  });
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].availableActions, ['ACKNOWLEDGED', 'RESOLVED']);
});

test('getInventoryAlert returns not found when the alert belongs to another tenant', async () => {
  await withRepositoryStubs(
    {
      findInventoryAlertById: async () => null,
    },
    async () => {
      await assert.rejects(
        () => inventoryService.getInventoryAlert(20n, { companyId: '9', sub: '40', permissions: ['inventory.manage'] }),
        (error) => {
          assert.equal(error.statusCode, 404);
          assert.equal(error.code, 'not_found');
          return true;
        },
      );
    },
  );
});

test('updateInventoryAlertStatus rejects users without alert management permissions', async () => {
  await assert.rejects(
    () => inventoryService.updateInventoryAlertStatus(
      15n,
      { status: 'ACKNOWLEDGED', note: 'Revisando el lote' },
      { companyId: '7', sub: '10', permissions: ['inventory.view'] },
    ),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'forbidden');
      return true;
    },
  );
});

test('updateInventoryAlertStatus records tenant-scoped acknowledgement traceability in metadata', async () => {
  let receivedUpdate = null;

  const updatedAlert = await withRepositoryStubs(
    {
      findInventoryAlertById: async () => buildAlert(),
      updateInventoryAlert: async (alertId, companyId, payload) => {
        receivedUpdate = { alertId, companyId, payload };
        return buildAlert({
          id: alertId,
          companyId,
          status: payload.status,
          metadata: payload.metadata,
          resolvedAt: payload.resolvedAt,
        });
      },
    },
    () => inventoryService.updateInventoryAlertStatus(
      15n,
      { status: 'ACKNOWLEDGED', note: 'QA validando causas' },
      { companyId: '7', sub: '10', permissions: ['inventory.qa.manage'] },
    ),
  );

  assert.equal(receivedUpdate.alertId, 15n);
  assert.equal(receivedUpdate.companyId, 7n);
  assert.equal(receivedUpdate.payload.status, 'ACKNOWLEDGED');
  assert.equal(receivedUpdate.payload.resolvedAt, null);
  assert.equal(receivedUpdate.payload.metadata.lastStatusChange.fromStatus, 'OPEN');
  assert.equal(receivedUpdate.payload.metadata.lastStatusChange.toStatus, 'ACKNOWLEDGED');
  assert.equal(receivedUpdate.payload.metadata.lastStatusChange.changedByUserId, '10');
  assert.equal(receivedUpdate.payload.metadata.lastStatusChange.note, 'QA validando causas');
  assert.equal(receivedUpdate.payload.metadata.statusHistory.length, 1);
  assert.equal(updatedAlert.status, 'ACKNOWLEDGED');
  assert.deepEqual(updatedAlert.availableActions, ['RESOLVED']);
});

test('updateInventoryAlertStatus sets resolvedAt when resolving an acknowledged alert', async () => {
  let receivedUpdate = null;

  const updatedAlert = await withRepositoryStubs(
    {
      findInventoryAlertById: async () => buildAlert({
        status: 'ACKNOWLEDGED',
        metadata: {
          source: 'lot-qa',
          statusHistory: [{ fromStatus: 'OPEN', toStatus: 'ACKNOWLEDGED', changedByUserId: '10' }],
        },
      }),
      updateInventoryAlert: async (_alertId, _companyId, payload) => {
        receivedUpdate = payload;
        return buildAlert({
          status: payload.status,
          resolvedAt: payload.resolvedAt,
          metadata: payload.metadata,
        });
      },
    },
    () => inventoryService.updateInventoryAlertStatus(
      15n,
      { status: 'RESOLVED', note: 'Incidencia atendida' },
      { companyId: '7', sub: '10', permissions: ['inventory.manage'] },
    ),
  );

  assert.ok(receivedUpdate.resolvedAt instanceof Date);
  assert.equal(updatedAlert.status, 'RESOLVED');
  assert.ok(updatedAlert.resolvedAt instanceof Date);
  assert.deepEqual(updatedAlert.availableActions, []);
  assert.equal(updatedAlert.metadata.statusHistory.length, 2);
});

test('updateInventoryAlertStatus rejects invalid transitions from a resolved alert', async () => {
  await withRepositoryStubs(
    {
      findInventoryAlertById: async () => buildAlert({ status: 'RESOLVED', resolvedAt: new Date('2026-07-20T11:00:00Z') }),
    },
    async () => {
      await assert.rejects(
        () => inventoryService.updateInventoryAlertStatus(
          15n,
          { status: 'ACKNOWLEDGED', note: 'No deberia reabrirse' },
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
