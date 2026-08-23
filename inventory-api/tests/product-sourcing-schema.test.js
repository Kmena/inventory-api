const test = require('node:test');
const assert = require('node:assert/strict');

const productRepository = require('../src/repositories/product.repository');
const productService = require('../src/services/product.service');
const { createProductSchema, updateProductSchema } = require('../src/schemas/product.schema');

function withRepositoryStubs(stubs, run) {
  const originals = new Map();

  for (const [key, value] of Object.entries(stubs)) {
    originals.set(key, productRepository[key]);
    productRepository[key] = value;
  }

  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [key, value] of originals.entries()) {
        productRepository[key] = value;
      }
    });
}

test('createProductSchema accepts the approved sourcing and inventory classification values', () => {
  const result = createProductSchema.safeParse({
    name: 'Gel antibacterial',
    sourcingMethod: 'PURCHASE_ONLY',
    inventoryType: 'RAW_MATERIAL',
    requiresLot: true,
    requiresExpiration: false,
    allowedWarehouseIds: ['15', '16'],
    authorizedSuppliers: [{
      supplierId: '9',
      isPreferred: true,
      supplierSku: 'SUP-9-ABC',
      leadTimeDays: 3,
      minimumOrderQuantity: 5,
      notes: 'Proveedor principal',
    }],
  });

  assert.equal(result.success, true);
  assert.equal(result.data.sourcingMethod, 'PURCHASE_ONLY');
  assert.equal(result.data.inventoryType, 'RAW_MATERIAL');
  assert.deepEqual(result.data.allowedWarehouseIds, [15n, 16n]);
  assert.equal(result.data.authorizedSuppliers[0].supplierId, 9n);
});

test('createProductSchema rejects invalid sourcing values and duplicated authorizations', () => {
  assert.equal(createProductSchema.safeParse({ name: 'Producto X', sourcingMethod: 'INVALID' }).success, false);
  assert.equal(createProductSchema.safeParse({
    name: 'Producto duplicado',
    authorizedSuppliers: [{ supplierId: '7' }, { supplierId: '7' }],
  }).success, false);
  assert.equal(createProductSchema.safeParse({
    name: 'Producto bodegas duplicadas',
    allowedWarehouseIds: ['3', '3'],
  }).success, false);
});

test('updateProductSchema accepts partial sourcing updates with additive metadata', () => {
  const result = updateProductSchema.safeParse({
    sku: 'SKU-22',
    barcode: '750000001',
    sourcingMethod: 'PRODUCTION_OR_PURCHASE',
    inventoryType: 'FINISHED_GOOD',
    standardCost: 1250.5,
    realCost: 1199.99,
  });

  assert.equal(result.success, true);
  assert.equal(result.data.sourcingMethod, 'PRODUCTION_OR_PURCHASE');
  assert.equal(result.data.inventoryType, 'FINISHED_GOOD');
});

test('createProduct persists allowed warehouses and authorized supplier metadata after tenant-scoped validation', async () => {
  const tx = {
    product: {},
    productPrice: {},
  };
  const observed = {
    createData: null,
    warehouseLookup: null,
    supplierLookup: null,
  };

  tx.product.create = async ({ data }) => {
    observed.createData = data;
    return { id: 55n, ...data };
  };
  tx.product.findUnique = async () => ({
    id: 55n,
    companyId: 7n,
    name: 'Producto con autorizaciones',
    warehouseLotStocks: [],
    allowedWarehouses: [],
    supplierLinks: [],
  });
  tx.productPrice.updateMany = async () => {};
  tx.productPrice.create = async () => {};

  await withRepositoryStubs(
    {
      transaction: async (work) => work(tx),
      findCompanyWarehousesByIds: async (companyId, warehouseIds) => {
        observed.warehouseLookup = { companyId, warehouseIds };
        return [{ id: 11n }, { id: 12n }];
      },
      findCompanySuppliersByIds: async (companyId, supplierIds) => {
        observed.supplierLookup = { companyId, supplierIds };
        return [{ id: 21n }];
      },
    },
    () => productService.createProduct({
      name: 'Producto con autorizaciones',
      allowedWarehouseIds: [11n, 12n],
      authorizedSuppliers: [{
        supplierId: 21n,
        isPreferred: true,
        supplierSku: 'SUP-21',
        leadTimeDays: 4,
        minimumOrderQuantity: 2,
        notes: 'Entrega semanal',
      }],
    }, {
      companyId: '7',
      sub: '15',
      permissions: ['products.manage'],
    }),
  );

  assert.deepEqual(observed.warehouseLookup, { companyId: 7n, warehouseIds: [11n, 12n] });
  assert.deepEqual(observed.supplierLookup, { companyId: 7n, supplierIds: [21n] });
  assert.deepEqual(observed.createData.allowedWarehouses, {
    create: [{ warehouseId: 11n }, { warehouseId: 12n }],
  });
  assert.deepEqual(observed.createData.supplierLinks, {
    create: [{
      supplierId: 21n,
      isPreferred: true,
      supplierSku: 'SUP-21',
      leadTimeDays: 4,
      minimumOrderQuantity: 2,
      notes: 'Entrega semanal',
    }],
  });
});
