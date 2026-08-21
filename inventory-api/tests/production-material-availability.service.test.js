const test = require('node:test');
const assert = require('node:assert/strict');

const productionRepository = require('../src/repositories/production.repository');
const inventoryRepository = require('../src/repositories/inventory.repository');
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
