const test = require('node:test');
const assert = require('node:assert/strict');

const inventoryService = require('../src/services/inventory.service');
const productRepository = require('../src/repositories/product.repository');
const productService = require('../src/services/product.service');

function withStubs(moduleStubs, run) {
  const originals = [];

  for (const [moduleRef, stubs] of moduleStubs) {
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

test('updateProduct routes the final mutation through the company-scoped repository helper', async () => {
  const tx = {
    productPrice: {},
  };
  const observed = {
    updateCall: null,
    priceUpdates: [],
  };

  tx.productPrice.updateMany = async (payload) => {
    observed.priceUpdates.push({ type: 'updateMany', payload });
  };
  tx.productPrice.create = async (payload) => {
    observed.priceUpdates.push({ type: 'create', payload });
  };

  const result = await withStubs(
    [
      [productRepository, {
        transaction: async (work) => work(tx),
        findProductById: async (productId, companyId) => ({
          id: productId,
          companyId,
          createdByUserId: 15n,
          sku: null,
          barcode: null,
          sourcingMethod: 'PRODUCTION_OR_PURCHASE',
          inventoryType: 'FINISHED_GOOD',
          productType: 'FINISHED_PRODUCT',
          sellableKind: 'STANDARD',
          taxExempt: false,
          taxCategory: 'VAT_STANDARD',
          taxRate: 13,
          density: null,
          densityUnit: null,
          requiresLot: true,
          requiresExpiration: false,
          standardCost: null,
          realCost: null,
          isActive: true,
          lotStrategy: 'TRACKED',
          kgConversionFactor: 1,
          category: { categoryType: 'PT' },
          cabysCode: null,
          warehouseLotStocks: [],
        }),
        updateProduct: async (productId, companyId, data, receivedTx) => {
          observed.updateCall = { productId, companyId, data, receivedTx };
          return {
            id: productId,
            companyId,
            currency: 'USD',
            ...data,
            warehouseLotStocks: [],
          };
        },
      }],
      [inventoryService, {
        deriveLotUsability: () => ({ sellable: true, expired: false, reason: null }),
      }],
    ],
    () => productService.updateProduct(
      77n,
      {
        name: 'Producto actualizado',
        price: 21.25,
        currency: 'USD',
        companyId: 999n,
      },
      { companyId: '7', sub: '15', permissions: ['products.manage'] },
    ),
  );

  assert.deepEqual(observed.updateCall, {
    productId: 77n,
    companyId: 7n,
    data: {
      name: 'Producto actualizado',
      price: 21.25,
      currency: 'USD',
      companyId: 7n,
      createdByUserId: 15n,
      sku: null,
      barcode: null,
      sourcingMethod: 'PRODUCTION_OR_PURCHASE',
      inventoryType: 'FINISHED_GOOD',
      productType: 'FINISHED_PRODUCT',
      sellableKind: 'STANDARD',
      cabysCode: null,
      taxExempt: false,
      taxCategory: 'VAT_STANDARD',
      taxRate: 13,
      density: null,
      densityUnit: null,
      // TASK-003 (production-size-conversion): presentationType and netContentUnit are
      // now included in the write data; default to null for products without size metadata.
      presentationType: null,
      netContentUnit: null,
      requiresLot: true,
      requiresExpiration: false,
      standardCost: null,
      realCost: null,
      isActive: true,
      // inCatalog ahora siempre se incluye — fix para el bug donde
      // buildProductWriteData omitia el campo y Prisma usaba @default(false),
      // haciendo los productos invisibles para el agente de ventas
      inCatalog: true,
      lotStrategy: 'TRACKED',
      kgConversionFactor: 1,
    },
    receivedTx: tx,
  });
  assert.equal(result.id, 77n);
  assert.deepEqual(observed.priceUpdates.map((entry) => entry.type), ['updateMany', 'create']);
});

test('createProduct zeroes stock counters, syncs general price, and keeps initial-lot registration inside the repository transaction', async () => {
  const tx = {
    product: {},
    productPrice: {},
  };
  const observed = {
    createData: null,
    priceUpdates: [],
    stockEntryCalls: [],
  };

  tx.product.create = async ({ data }) => {
    observed.createData = data;
    return {
      id: 77n,
      ...data,
    };
  };
  tx.product.findUnique = async () => ({
    id: 77n,
    companyId: 7n,
    createdByUserId: 15n,
    code: 'P-77',
    name: 'Producto 77',
    price: 19.5,
    currency: 'USD',
    quantity: 0,
    reservedQuantity: 0,
    minStock: 2,
    warehouseLotStocks: [{
      warehouseId: 3n,
      lotId: 11n,
      lot: { id: 11n, status: 'AVAILABLE', qaStatus: 'APPROVED' },
    }],
  });
  tx.productPrice.updateMany = async (payload) => {
    observed.priceUpdates.push({ type: 'updateMany', payload });
  };
  tx.productPrice.create = async (payload) => {
    observed.priceUpdates.push({ type: 'create', payload });
  };

  const result = await withStubs(
    [
      [productRepository, {
        transaction: async (work) => work(tx),
      }],
      [inventoryService, {
        registerStockEntryInTransaction: async (receivedTx, payload, auth) => {
          observed.stockEntryCalls.push({ receivedTx, payload, auth });
        },
        deriveLotUsability: () => ({ sellable: true, expired: false, reason: null }),
      }],
    ],
    () => productService.createProduct(
      {
        code: 'P-77',
        name: 'Producto 77',
        categoryId: 12n,
        price: 19.5,
        currency: 'USD',
        quantity: 999,
        reservedQuantity: 999,
        minStock: 2,
        initialLots: [{
          warehouseId: 3n,
          quantity: 5,
          internalLotNumber: 'LOT-11',
        }],
      },
      { companyId: '7', sub: '15', permissions: ['inventory.manage'] },
    ),
  );

  assert.equal(observed.createData.companyId, 7n);
  assert.equal(observed.createData.createdByUserId, 15n);
  assert.equal(observed.createData.sourcingMethod, 'PRODUCTION_OR_PURCHASE');
  assert.equal(observed.createData.inventoryType, 'FINISHED_GOOD');
  assert.equal(observed.createData.requiresLot, true);
  assert.equal(observed.createData.requiresExpiration, false);
  assert.equal(observed.createData.quantity, 0);
  assert.equal(observed.createData.reservedQuantity, 0);
  assert.deepEqual(observed.priceUpdates, [
    {
      type: 'updateMany',
      payload: {
        where: {
          productId: 77n,
          priceType: 'GENERAL',
          isActive: true,
        },
        data: {
          isActive: false,
          validTo: observed.priceUpdates[0]?.payload?.data?.validTo,
        },
      },
    },
    {
      type: 'create',
      payload: {
        data: {
          productId: 77n,
          priceType: 'GENERAL',
          amount: 19.5,
          currency: 'USD',
          isActive: true,
        },
      },
    },
  ]);
  assert.ok(observed.priceUpdates[0].payload.data.validTo instanceof Date);
  assert.deepEqual(observed.stockEntryCalls, [{
    receivedTx: tx,
    payload: {
      warehouseId: 3n,
      quantity: 5,
      internalLotNumber: 'LOT-11',
      productId: 77n,
      reasonCode: 'INITIAL_PRODUCT_STOCK',
      note: 'Existencia inicial registrada con el producto',
      useLot: true,
    },
    auth: { companyId: '7', sub: '15', permissions: ['inventory.manage'] },
  }]);
  assert.equal(result.id, 77n);
  assert.equal(result.warehouseLotStocks[0].lot.derivedUsability.sellable, true);
});

test('importProducts reuses tenant inventory/category context and registers initial stock only for newly created imported rows', async () => {
  const tx = {
    inventory: {},
    category: {},
    product: {},
    productPrice: {},
  };
  const observed = {
    findProductsByIdsArgs: null,
    categoryFindFirstCalls: 0,
    categoryCreateCalls: 0,
    updatedProducts: [],
    createdProducts: [],
    stockEntryCalls: [],
  };

  tx.inventory.findUnique = async ({ where }) => {
    assert.equal(where.companyId, 7n);
    return { id: 91n };
  };
  tx.category.findFirst = async ({ where }) => {
    observed.categoryFindFirstCalls += 1;
    assert.equal(where.inventoryId, 91n);
    assert.equal(where.name.equals, 'Bebidas');
    return null;
  };
  tx.category.create = async ({ data }) => {
    observed.categoryCreateCalls += 1;
    assert.equal(data.inventoryId, 91n);
    return { id: 501n, ...data };
  };
  tx.category.findUnique = async ({ where }) => ({ id: where.id, categoryType: 'PT' });
  tx.product.update = async ({ where, data }) => {
    observed.updatedProducts.push({ where, data });
    return { id: where.id, name: data.name };
  };
  tx.product.create = async ({ data }) => {
    observed.createdProducts.push(data);
    return { id: data.id, name: data.name };
  };
  tx.productPrice.updateMany = async () => {};
  tx.productPrice.create = async () => {};

  const summary = await withStubs(
    [
      [productRepository, {
        findProductsByIds: async (ids, companyId) => {
          observed.findProductsByIdsArgs = { ids, companyId };
          return [{ id: 300n, companyId: 7n, name: 'Existente', category: { categoryType: 'PT' }, prices: [] }];
        },
        updateProduct: async (productId, companyId, data, receivedTx) => {
          observed.updatedProducts.push({ productId, companyId, data, receivedTx });
          return { id: productId, name: data.name };
        },
        transaction: async (work) => work(tx),
      }],
      [inventoryService, {
        registerStockEntryInTransaction: async (receivedTx, payload, auth) => {
          observed.stockEntryCalls.push({ receivedTx, payload, auth });
        },
      }],
    ],
    () => productService.importProducts(
      [
        {
          id: 300n,
          name: 'Existente Actualizado',
          categoryName: 'Bebidas',
          overwrite: true,
          quantity: 0,
          currency: 'CRC',
        },
        {
          id: 301n,
          name: 'Nuevo Importado',
          categoryName: 'Bebidas',
          quantity: 8,
          warehouseId: 3n,
          internalLotNumber: 'LOT-301',
          currency: 'USD',
        },
        {
          id: 302n,
          name: 'Sin Overwrite',
          overwrite: false,
          quantity: 0,
          categoryName: 'Bebidas',
        },
      ],
      { companyId: '7', sub: '15', permissions: ['inventory.manage'] },
    ),
  );

  assert.deepEqual(observed.findProductsByIdsArgs, {
    ids: [300n, 301n, 302n],
    companyId: 7n,
  });
  assert.equal(observed.categoryFindFirstCalls, 1);
  assert.equal(observed.categoryCreateCalls, 1);
  assert.equal(observed.updatedProducts.length, 1);
  assert.deepEqual(observed.updatedProducts[0], {
    productId: 300n,
    companyId: 7n,
    data: observed.updatedProducts[0].data,
    receivedTx: tx,
  });
  assert.equal(observed.createdProducts.length, 2);
  assert.equal(observed.createdProducts[0].quantity, 0);
  assert.equal(observed.createdProducts[0].reservedQuantity, 0);
  assert.deepEqual(observed.stockEntryCalls, [{
    receivedTx: tx,
    payload: {
      warehouseId: 3n,
      productId: 301n,
      quantity: 8,
      internalLotNumber: 'LOT-301',
      manufacturerLotNumber: undefined,
      expirationDate: undefined,
      reasonCode: 'INITIAL_IMPORT_STOCK',
      note: 'Existencia inicial importada desde Excel',
      useLot: true,
    },
    auth: { companyId: '7', sub: '15', permissions: ['inventory.manage'] },
  }]);
  assert.deepEqual(summary, {
    created: [
      { id: '301', name: 'Nuevo Importado' },
      { id: '302', name: 'Sin Overwrite' },
    ],
    updated: [
      { id: '300', name: 'Existente Actualizado' },
    ],
    skipped: [],
  });
});
