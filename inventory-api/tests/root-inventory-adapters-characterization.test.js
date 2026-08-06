const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootPublicPath = path.join(__dirname, '..', 'src', 'public', 'root');

function executeRootScript(relativePath, context) {
  const source = fs.readFileSync(path.join(rootPublicPath, relativePath), 'utf8');
  vm.runInContext(source, context, { filename: relativePath });
}

function createAdapterHarness() {
  const calls = [];
  const browserWindow = {
    InventoryAuth: {
      async fetchJson(session, url, options) {
        calls.push({ session, url, options });
        return { ok: true };
      },
    },
    URLSearchParams,
  };
  const context = vm.createContext({
    URLSearchParams,
    window: browserWindow,
  });
  browserWindow.window = browserWindow;

  executeRootScript('registry.js', context);
  executeRootScript('products-api.js', context);
  executeRootScript('categories-api.js', context);
  executeRootScript('inventory-api.js', context);
  executeRootScript('warehouses-api.js', context);

  return {
    calls,
    rootShell: browserWindow.RootShell,
  };
}

test('root inventory adapters register supported modules and keep same-origin product/category contracts', async () => {
  const harness = createAdapterHarness();
  const session = { token: 't' };

  const productsApi = harness.rootShell.require('productsApi');
  const categoriesApi = harness.rootShell.require('categoriesApi');

  await productsApi.listProducts(session, { page: 2, pageSize: 20, categoryId: '15' });
  await productsApi.createProduct(session, { name: 'Producto 1' });
  await productsApi.updateProduct(session, '44', { name: 'Producto 2' });
  await productsApi.deactivateProduct(session, '44');
  await categoriesApi.listCategories(session);
  await categoriesApi.createCategory(session, { name: 'Materia prima', categoryType: 'MP' });

  assert.equal(harness.calls[0].url, '/api/products/?page=2&pageSize=20&categoryId=15');
  assert.equal(harness.calls[1].url, '/api/products/');
  assert.equal(harness.calls[1].options.method, 'POST');
  assert.equal(harness.calls[2].url, '/api/products/44');
  assert.equal(harness.calls[2].options.method, 'PUT');
  assert.equal(harness.calls[3].url, '/api/products/44');
  assert.equal(harness.calls[3].options.method, 'DELETE');
  assert.equal(harness.calls[4].url, '/api/products/categories/company');
  assert.equal(harness.calls[5].url, '/api/products/categories/company');
  assert.equal(harness.calls[5].options.method, 'POST');
});

test('root inventory adapters keep warehouse and inventory endpoint boundaries', async () => {
  const harness = createAdapterHarness();
  const session = { token: 't' };

  const inventoryApi = harness.rootShell.require('inventoryApi');
  const warehousesApi = harness.rootShell.require('warehousesApi');

  await inventoryApi.listStocks(session);
  await inventoryApi.listAlerts(session);
  await inventoryApi.listMovements(session, { page: 1, pageSize: 10, warehouseId: '3', lotId: '9' });
  await inventoryApi.updateLotQa(session, '9', { action: 'APPROVE', note: 'ok' });
  await inventoryApi.createStockEntry(session, { warehouseId: 1, productId: 2, quantity: 100, internalLotNumber: 'LOT-001', reasonCode: 'PURCHASE' });
  await warehousesApi.listCompanyWarehouses(session);
  await warehousesApi.createCompanyWarehouse(session, { code: 'B1', name: 'Principal' });

  assert.equal(harness.calls[0].url, '/api/inventory/stocks');
  assert.equal(harness.calls[1].url, '/api/inventory/alerts');
  assert.equal(harness.calls[2].url, '/api/inventory/movements?page=1&pageSize=10&warehouseId=3&lotId=9');
  assert.equal(harness.calls[3].url, '/api/inventory/lots/9/qa');
  assert.equal(harness.calls[3].options.method, 'PATCH');
  assert.equal(harness.calls[4].url, '/api/inventory/entries');
  assert.equal(harness.calls[4].options.method, 'POST');
  assert.equal(harness.calls[5].url, '/api/warehouses/company');
  assert.equal(harness.calls[6].url, '/api/warehouses/company');
  assert.equal(harness.calls[6].options.method, 'POST');
});
