'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const billingTriggerService = require('../src/services/billing-trigger.service');
const inventorySupport = require('../src/services/inventory-transaction-support.service');
const inventoryRepository = require('../src/repositories/inventory.repository');
const agentWorkspaceService = require('../src/services/agent-workspace.service');
const agentWorkspaceRepository = require('../src/repositories/agent-workspace.repository');

function withStubs(stubsByModule, run) {
  const originals = [];
  for (const [moduleRef, stubs] of stubsByModule) {
    for (const [key, value] of Object.entries(stubs)) {
      originals.push([moduleRef, key, moduleRef[key]]);
      moduleRef[key] = value;
    }
  }
  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [moduleRef, key, value] of originals) {
        moduleRef[key] = value;
      }
    });
}

test('InvoiceItem snapshots classify physical, service, and entitlement lines without depending on later product changes', () => {
  const invoice = { id: 100n };
  const order = {
    id: 10n,
    companyId: 1n,
    items: [
      {
        id: 1n,
        productId: 11n,
        quantity: 2,
        unitPrice: 50,
        totalDiscount: 5,
        product: { id: 11n, name: 'Cafe', code: 'CAF', controlsInventory: true, taxCategory: 'VAT_STANDARD', taxRate: 13 },
      },
      {
        id: 2n,
        productId: 12n,
        quantity: 1,
        unitPrice: 25,
        totalDiscount: 0,
        product: { id: 12n, name: 'Servicio', code: 'SRV', controlsInventory: false, productNature: 'SERVICE' },
      },
      {
        id: 3n,
        productId: 13n,
        quantity: 1,
        unitPrice: 100,
        totalDiscount: 10,
        product: { id: 13n, name: 'Membresia', code: 'MEM', controlsInventory: false, commercialBehavior: 'ENTITLEMENT' },
      },
    ],
  };

  const snapshots = billingTriggerService.buildInvoiceItemSnapshots(invoice, order);

  assert.deepEqual(snapshots.map((item) => item.lineKind), ['PHYSICAL_GOOD', 'SERVICE', 'ENTITLEMENT']);
  assert.equal(snapshots[0].descriptionSnapshot, 'Cafe');
  assert.equal(snapshots[0].total, 95);
  assert.equal(snapshots[1].productCodeSnapshot, 'SRV');
  assert.equal(snapshots[2].total, 90);
});

test('system-lot helper reuses an existing transparent lot before creating a new one', async () => {
  const context = {
    companyId: 1n,
    warehouse: { id: 7n },
    product: { id: 9n, controlsInventory: true, lotStrategy: 'SYSTEM' },
  };
  const existingLot = { id: 99n, isSystemGenerated: true };
  let created = false;

  await withStubs(new Map([
    [inventoryRepository, {
      findSystemLot: async () => existingLot,
      createSystemLot: async () => { created = true; return { id: 100n }; },
    }],
  ]), async () => {
    const lot = await inventorySupport.getOrCreateSystemLot({}, context, 0);
    assert.equal(lot, existingLot);
    assert.equal(created, false);
  });
});

test('system-lot helper rejects non-inventory products', async () => {
  const context = {
    companyId: 1n,
    warehouse: { id: 7n },
    product: { id: 9n, controlsInventory: false, lotStrategy: 'SYSTEM' },
  };

  await assert.rejects(
    () => inventorySupport.getOrCreateSystemLot({}, context, 0),
    /producto no usa lote de sistema/i,
  );
});

test('agent catalog includes non-inventory products without requiring stock availability', async () => {
  const nonInventoryProduct = {
    id: 20n,
    code: 'SRV',
    name: 'Instalacion',
    price: 35,
    controlsInventory: false,
    inCatalog: true,
    category: { name: 'Servicios' },
    subcategory: null,
    prices: [],
  };

  await withStubs(new Map([
    [agentWorkspaceRepository, {
      findSellableWarehouses: async () => [],
      findSellableProducts: async () => [nonInventoryProduct],
      findSellableProductAvailabilityRows: async () => [],
    }],
  ]), async () => {
    const snapshot = await agentWorkspaceService.__getAgentSellableProductSnapshotForTest(1n, [], { requireWarehouse: true });
    assert.equal(snapshot.products.length, 1);
    assert.equal(snapshot.products[0].controlsInventory, false);
    assert.equal(snapshot.products[0].availableQuantity, null);
  });
});
