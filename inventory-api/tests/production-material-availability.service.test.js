const test = require('node:test');
const assert = require('node:assert/strict');

const productionRepository = require('../src/repositories/production.repository');
const inventoryRepository = require('../src/repositories/inventory.repository');
const { __private__ } = require('../src/services/production-material-availability.service');
const productRepository = require('../src/repositories/product.repository');
const availabilityService = require('../src/services/production-material-availability.service');

function withPatchedDependencies(overrides, callback) {
  const originals = {
    findProductionOrderById: productionRepository.findProductionOrderById,
    findMaterialRequirementsByOrderIdForCompany: productionRepository.findMaterialRequirementsByOrderIdForCompany,
    findWarehouseStocksByProductIds: inventoryRepository.findWarehouseStocksByProductIds,
    findReservableLotStocks: inventoryRepository.findReservableLotStocks,
    findProductsByIds: productRepository.findProductsByIds,
  };

  Object.assign(productionRepository, {
    findProductionOrderById: overrides.findProductionOrderById || originals.findProductionOrderById,
    findMaterialRequirementsByOrderIdForCompany: overrides.findMaterialRequirementsByOrderIdForCompany || originals.findMaterialRequirementsByOrderIdForCompany,
  });
  Object.assign(inventoryRepository, {
    findWarehouseStocksByProductIds: overrides.findWarehouseStocksByProductIds || originals.findWarehouseStocksByProductIds,
    findReservableLotStocks: overrides.findReservableLotStocks || originals.findReservableLotStocks,
  });
  Object.assign(productRepository, {
    findProductsByIds: overrides.findProductsByIds || originals.findProductsByIds,
  });

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      Object.assign(productionRepository, {
        findProductionOrderById: originals.findProductionOrderById,
        findMaterialRequirementsByOrderIdForCompany: originals.findMaterialRequirementsByOrderIdForCompany,
      });
      Object.assign(inventoryRepository, {
        findWarehouseStocksByProductIds: originals.findWarehouseStocksByProductIds,
        findReservableLotStocks: originals.findReservableLotStocks,
      });
      Object.assign(productRepository, {
        findProductsByIds: originals.findProductsByIds,
      });
    });
}

function buildOrder(overrides = {}) {
  return {
    id: 17n,
    companyId: 7n,
    originWarehouseId: 5n,
    quantity: 10,
    recipeVersionSnapshot: {
      recipeVersion: {
        stages: [
          {
            id: '42',
            stageOrder: 0,
            stageInputs: [
              {
                id: '301',
                productId: '31',
                quantity: 2,
                unit: 'KG',
              },
              {
                id: '302',
                productId: '32',
                quantity: 1,
                unit: 'L',
              },
            ],
          },
        ],
      },
    },
    ...overrides,
  };
}

const auth = { companyId: '7', permissions: ['production.view', 'production.execute'] };

test('getMaterialRequirementsWithAvailability returns required, available, missing and shortage summary', async () => {
  await withPatchedDependencies({
    findProductionOrderById: async () => buildOrder(),
    findMaterialRequirementsByOrderIdForCompany: async () => ([
      { productId: 31n, requiredQuantity: 20, unit: 'KG' },
      { productId: 32n, requiredQuantity: 5, unit: 'L' },
    ]),
    findWarehouseStocksByProductIds: async () => ([
      { productId: 31n, quantity: 30, reservedQuantity: 5 },
      { productId: 32n, quantity: 4, reservedQuantity: 1 },
    ]),
  }, async () => {
    const result = await availabilityService.getMaterialRequirementsWithAvailability(17n, auth);

    assert.deepEqual(result, {
      orderId: 17n,
      originWarehouseId: 5n,
      quantity: 10,
      items: [
        { productId: 31n, unit: 'KG', required: 20, available: 25, missing: 0 },
        { productId: 32n, unit: 'L', required: 5, available: 3, missing: 2 },
      ],
      hasShortage: true,
    });
  });
});

test('getMaterialRequirementsWithAvailability returns 404 when the order does not belong to the authenticated company', async () => {
  await withPatchedDependencies({
    findProductionOrderById: async () => null,
  }, async () => {
    await assert.rejects(
      () => availabilityService.getMaterialRequirementsWithAvailability(17n, auth),
      (error) => error?.statusCode === 404 && error?.code === 'not_found',
    );
  });
});

test('getAvailableLotsForStage returns FEFO suggestions and does not expose internal lot numbers', async () => {
  await withPatchedDependencies({
    findProductionOrderById: async () => buildOrder(),
    findProductsByIds: async () => ([
      { id: 31n, code: 'RM-31', name: 'Base liquida', unit: 'KG', requiresLot: true, requiresExpiration: true },
      // requiresLot:false ya no excluye al producto — todos los insumos requieren lote en este sistema.
      // El mock devuelve lotes distintos segun productId para simular el comportamiento real.
      { id: 32n, code: 'RM-32', name: 'Fragancia', unit: 'L', requiresLot: false, requiresExpiration: false },
    ]),
    findReservableLotStocks: async (_warehouseId, productId) => {
      // Solo producto 31 tiene lotes; producto 32 no tiene stock en bodega.
      if (String(productId) !== '31') { return []; }
      return ([
      {
        id: 502n,
        lotId: 1002n,
        productId: 31n,
        quantity: 15,
        reservedQuantity: 0,
        lot: {
          id: 1002n,
          lotNumber: 'L-002',
          internalLotNumber: 'INT-002',
          manufacturerLotNumber: 'M-002',
          expirationDate: new Date('2099-02-10T00:00:00.000Z'),
          entryDate: new Date('2026-01-06T00:00:00.000Z'),
          status: 'AVAILABLE',
          qaStatus: 'APPROVED',
        },
      },
      {
        id: 501n,
        lotId: 1001n,
        productId: 31n,
        quantity: 10,
        reservedQuantity: 2,
        lot: {
          id: 1001n,
          lotNumber: 'L-001',
          internalLotNumber: 'INT-001',
          manufacturerLotNumber: 'M-001',
          expirationDate: new Date('2099-02-01T00:00:00.000Z'),
          entryDate: new Date('2026-01-05T00:00:00.000Z'),
          status: 'AVAILABLE',
          qaStatus: 'APPROVED',
        },
      },
      {
        id: 503n,
        lotId: 1003n,
        productId: 31n,
        quantity: 50,
        reservedQuantity: 0,
        lot: {
          id: 1003n,
          lotNumber: 'L-003',
          internalLotNumber: 'INT-003',
          manufacturerLotNumber: 'M-003',
          expirationDate: new Date('2099-01-20T00:00:00.000Z'),
          entryDate: new Date('2026-01-07T00:00:00.000Z'),
          status: 'BLOCKED',
          qaStatus: 'APPROVED',
        },
      },
      ]);
    },
  }, async () => {
    const result = await availabilityService.getAvailableLotsForStage(17n, 42n, auth);

    // Ambos insumos se incluyen porque la politica es: todo insumo requiere lote.
    assert.equal(result.products.length, 2);

    // Producto 31 (Base liquida) — tiene lotes disponibles, FEFO por vencimiento.
    const baseLiquida = result.products.find((p) => String(p.productId) === '31');
    assert.ok(baseLiquida, 'Base liquida debe estar en el resultado');
    assert.deepEqual(baseLiquida.suggested, [
      { lotId: 1001n, quantity: 8 },
      { lotId: 1002n, quantity: 12 },
    ]);
    assert.deepEqual(baseLiquida.lots.map((lot) => lot.lotId), [1001n, 1002n]);
    assert.equal(baseLiquida.lots[0].lotNumber, 'L-001');
    assert.equal('internalLotNumber' in baseLiquida.lots[0], false);
    assert.equal(baseLiquida.requiredQuantity, 20);
    assert.equal(baseLiquida.toleranceDefaultPercent, 5);

    // Producto 32 (Fragancia) — no tiene stock en bodega, lotes vacio.
    const fragancia = result.products.find((p) => String(p.productId) === '32');
    assert.ok(fragancia, 'Fragancia debe estar en el resultado aunque requiresLot sea false');
    assert.equal(fragancia.lots.length, 0);
    assert.equal(fragancia.requiredQuantity, 10); // quantity:1 * order.quantity:10
  });
});

test('getAvailableLotsForStage uses FIFO by entry date when the product does not require expiration ordering', async () => {
  await withPatchedDependencies({
    findProductionOrderById: async () => buildOrder({
      recipeVersionSnapshot: {
        recipeVersion: {
          stages: [{ id: '42', stageInputs: [{ productId: '31', quantity: 1, unit: 'KG' }] }],
        },
      },
    }),
    findProductsByIds: async () => ([
      { id: 31n, code: 'RM-31', name: 'Base liquida', unit: 'KG', requiresLot: true, requiresExpiration: false },
    ]),
    findReservableLotStocks: async () => ([
      {
        id: 502n,
        lotId: 1002n,
        productId: 31n,
        quantity: 10,
        reservedQuantity: 0,
        lot: {
          id: 1002n,
          lotNumber: 'L-002',
          manufacturerLotNumber: 'M-002',
          expirationDate: null,
          entryDate: new Date('2026-01-06T00:00:00.000Z'),
          status: 'AVAILABLE',
          qaStatus: 'APPROVED',
        },
      },
      {
        id: 501n,
        lotId: 1001n,
        productId: 31n,
        quantity: 10,
        reservedQuantity: 0,
        lot: {
          id: 1001n,
          lotNumber: 'L-001',
          manufacturerLotNumber: 'M-001',
          expirationDate: null,
          entryDate: new Date('2026-01-05T00:00:00.000Z'),
          status: 'AVAILABLE',
          qaStatus: 'APPROVED',
        },
      },
    ]),
  }, async () => {
    const result = await availabilityService.getAvailableLotsForStage(17n, 42n, auth);
    assert.deepEqual(result.products[0].lots.map((lot) => lot.lotId), [1001n, 1002n]);
    assert.deepEqual(result.products[0].suggested, [{ lotId: 1001n, quantity: 10 }]);
  });
});

test('getAvailableLotsForStage returns 404 when the stage is absent from the order snapshot', async () => {
  await withPatchedDependencies({
    findProductionOrderById: async () => buildOrder(),
    findProductsByIds: async () => ([]),
  }, async () => {
    await assert.rejects(
      () => availabilityService.getAvailableLotsForStage(17n, 999n, auth),
      (error) => error?.statusCode === 404 && error?.code === 'not_found',
    );
  });
});

// ─── TASK-006 / DEC-003: FEFO cuando hay vencimiento, FIFO cuando no ────────
// Tests directos sobre sortLotsForAvailability para verificar la política de lotes.

function makeLotStock(id, lotId, expirationDate, entryDate) {
  return {
    id: BigInt(id),
    lotId: BigInt(lotId),
    quantity: 10,
    reservedQuantity: 0,
    lot: {
      id: BigInt(lotId),
      expirationDate: expirationDate ? new Date(expirationDate) : null,
      entryDate: new Date(entryDate),
      status: 'AVAILABLE',
      qaStatus: 'APPROVED',
    },
  };
}

test('sortLotsForAvailability sorts lots with expirationDate by expirationDate ASC (FEFO) (TASK-006)', () => {
  const { sortLotsForAvailability } = __private__;

  const lots = [
    makeLotStock(3, 1003, '2026-12-01', '2026-01-03'), // expires last
    makeLotStock(1, 1001, '2026-06-01', '2026-01-01'), // expires first
    makeLotStock(2, 1002, '2026-09-15', '2026-01-02'), // expires middle
  ];

  const sorted = sortLotsForAvailability(lots);
  assert.deepEqual(
    sorted.map((s) => s.lotId),
    [1001n, 1002n, 1003n],
    'Lots with expiration dates must be sorted FEFO (expirationDate ASC)',
  );
});

test('sortLotsForAvailability sorts lots without expirationDate by entryDate ASC (FIFO) (TASK-006)', () => {
  const { sortLotsForAvailability } = __private__;

  const lots = [
    makeLotStock(3, 1003, null, '2026-01-20'), // entered last
    makeLotStock(1, 1001, null, '2026-01-05'), // entered first
    makeLotStock(2, 1002, null, '2026-01-10'), // entered middle
  ];

  const sorted = sortLotsForAvailability(lots);
  assert.deepEqual(
    sorted.map((s) => s.lotId),
    [1001n, 1002n, 1003n],
    'Lots without expiration dates must be sorted FIFO (entryDate ASC)',
  );
});

test('sortLotsForAvailability puts lots WITH expirationDate before lots WITHOUT (TASK-006)', () => {
  const { sortLotsForAvailability } = __private__;

  const lots = [
    makeLotStock(2, 1002, null, '2026-01-01'),         // no expiry — entered first
    makeLotStock(1, 1001, '2026-12-31', '2026-06-01'), // has expiry
  ];

  const sorted = sortLotsForAvailability(lots);
  // Lot with expiration date should come FIRST (more urgent)
  assert.equal(sorted[0].lotId, 1001n, 'Lot with expirationDate must come before lot without');
  assert.equal(sorted[1].lotId, 1002n);
});

test('sortLotsForAvailability does not mutate the input array (TASK-006)', () => {
  const { sortLotsForAvailability } = __private__;

  const lots = [
    makeLotStock(2, 1002, '2026-09-15', '2026-01-02'),
    makeLotStock(1, 1001, '2026-06-01', '2026-01-01'),
  ];
  const original = [...lots];

  sortLotsForAvailability(lots);
  assert.deepEqual(
    lots.map((l) => l.lotId),
    original.map((l) => l.lotId),
    'Input array must not be mutated',
  );
});

// ── TASK-005 (recipe-input-per-unit-basis): per-input effective basis in lot scaling ──

test('getAvailableLotsForStage scales PER_FINISHED_UNIT stageInput by plannedUnits in PER_OUTPUT_KG version (TASK-005)', async () => {
  // version PER_OUTPUT_KG, plannedOutputKg=5 kg, plannedUnits=10 units
  // stageInput A: 0.6 KG, inputQuantityBasis=null → required = 0.6 × 5 = 3 KG
  // stageInput B: 1 UN, inputQuantityBasis='PER_FINISHED_UNIT' → required = 1 × 10 = 10 UN
  const order = {
    id: 77n,
    companyId: 9n,
    originWarehouseId: 1n,
    quantity: 10,
    plannedOutputKg: 5,
    recipeVersionSnapshot: {
      recipeVersion: {
        quantityBasis: 'PER_OUTPUT_KG',
        stages: [{
          id: 101,
          stageInputs: [
            { productId: 201n, name: 'Harina', quantity: 0.6, unit: 'KG', inputQuantityBasis: null },
            { productId: 202n, name: 'Tapa', quantity: 1, unit: 'UN', inputQuantityBasis: 'PER_FINISHED_UNIT' },
          ],
        }],
      },
    },
  };

  const capturedRequiredQuantities = {};

  await withPatchedDependencies({
    findProductionOrderById: async () => order,
    findProductsByIds: async () => [
      { id: 201n, code: 'HAR-001', name: 'Harina', unit: 'KG' },
      { id: 202n, code: 'TAP-001', name: 'Tapa', unit: 'UN' },
    ],
    findReservableLotStocks: async (warehouseId, productId) => {
      // Return one lot per product
      return [{
        lotId: Number(productId),
        lot: { lotNumber: `L-${productId}`, expirationDate: null, entryDate: new Date() },
        quantity: 100,
        reservedQuantity: 0,
      }];
    },
  }, async () => {
    const auth = { companyId: '9', sub: '1', permissions: ['production.manage'] };
    const result = await availabilityService.getAvailableLotsForStage(77n, 101, auth);

    for (const p of result.products) {
      capturedRequiredQuantities[String(p.productId)] = p.requiredQuantity;
    }
  });

  assert.equal(capturedRequiredQuantities['201'], 3, 'gravimetric input must scale by plannedOutputKg');
  assert.equal(capturedRequiredQuantities['202'], 10, 'discrete input must scale by plannedUnits');
});

test('getAvailableLotsForStage backward compat: no inputQuantityBasis uses version basis (TASK-005)', async () => {
  // Legacy snapshot without inputQuantityBasis → falls back to version basis (PER_OUTPUT_KG)
  const order = {
    id: 78n,
    companyId: 9n,
    originWarehouseId: 1n,
    quantity: 10,
    plannedOutputKg: 4,
    recipeVersionSnapshot: {
      recipeVersion: {
        quantityBasis: 'PER_OUTPUT_KG',
        stages: [{
          id: 102,
          stageInputs: [
            { productId: 203n, name: 'Agua', quantity: 0.5, unit: 'KG' },
          ],
        }],
      },
    },
  };

  let capturedRequired = null;

  await withPatchedDependencies({
    findProductionOrderById: async () => order,
    findProductsByIds: async () => [{ id: 203n, code: 'AGU-001', name: 'Agua', unit: 'KG' }],
    findReservableLotStocks: async () => [{
      lotId: 203,
      lot: { lotNumber: 'L-203', expirationDate: null, entryDate: new Date() },
      quantity: 100,
      reservedQuantity: 0,
    }],
  }, async () => {
    const auth = { companyId: '9', sub: '1', permissions: ['production.manage'] };
    const result = await availabilityService.getAvailableLotsForStage(78n, 102, auth);
    capturedRequired = result.products[0].requiredQuantity;
  });

  // 0.5 × 4 kg = 2
  assert.equal(capturedRequired, 2, 'legacy input without inputQuantityBasis must scale by plannedOutputKg');
});
