const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootPublicPath = path.join(__dirname, '..', 'src', 'public', 'root');

function readRootFile(relativePath) {
  return fs.readFileSync(path.join(rootPublicPath, relativePath), 'utf8');
}

function executeRootScript(relativePath, context) {
  vm.runInContext(readRootFile(relativePath), context, { filename: relativePath });
}

function createBrowserContext(fetchJsonImplementation = async () => null) {
  const browserWindow = {
    InventoryAuth: {
      fetchJson: fetchJsonImplementation,
    },
  };

  const context = vm.createContext({
    Map,
    URLSearchParams,
    window: browserWindow,
  });

  browserWindow.window = browserWindow;
  return { browserWindow, context };
}

test('suppliersApi calls approved supplier endpoints with expected methods and fallback messages', async () => {
  const calls = [];
  const { browserWindow, context } = createBrowserContext(async (session, url, options = {}) => {
    calls.push({ session, url, options });
    return { ok: true };
  });

  executeRootScript('registry.js', context);
  executeRootScript('suppliers-api.js', context);

  const suppliersApi = browserWindow.RootShell.require('suppliersApi');
  const session = { user: { id: 12 } };

  await suppliersApi.listCompanySuppliers(session);
  await suppliersApi.createCompanySupplier(session, { name: 'Proveedor A' });
  await suppliersApi.getCompanySupplier(session, 25);
  await suppliersApi.updateCompanySupplier(session, 25, { phone: '7777-7777' });
  await suppliersApi.deleteCompanySupplier(session, 25);
  await suppliersApi.addProductToSupplier(session, 25, { productId: 8, unitPrice: 12.5, currency: 'USD' });
  await suppliersApi.removeProductFromSupplier(session, 25, 8);
  await suppliersApi.listCompanyProducts(session);

  assert.equal(calls.length, 8);

  assert.equal(calls[0].url, '/api/suppliers/company');
  assert.equal(calls[0].options.fallbackMessage, 'No se pudieron cargar los proveedores.');

  assert.equal(calls[1].url, '/api/suppliers/company');
  assert.equal(calls[1].options.method, 'POST');
  assert.equal(calls[1].options.body, JSON.stringify({ name: 'Proveedor A' }));
  assert.equal(calls[1].options.fallbackMessage, 'No se pudo crear el proveedor.');

  assert.equal(calls[2].url, '/api/suppliers/company/25');
  assert.equal(calls[2].options.fallbackMessage, 'No se pudo cargar el detalle del proveedor.');

  assert.equal(calls[3].url, '/api/suppliers/company/25');
  assert.equal(calls[3].options.method, 'PUT');
  assert.equal(calls[3].options.body, JSON.stringify({ phone: '7777-7777' }));
  assert.equal(calls[3].options.fallbackMessage, 'No se pudo actualizar el proveedor.');

  assert.equal(calls[4].url, '/api/suppliers/company/25');
  assert.equal(calls[4].options.method, 'DELETE');
  assert.equal(calls[4].options.fallbackMessage, 'No se pudo eliminar el proveedor.');

  assert.equal(calls[5].url, '/api/suppliers/company/25/products');
  assert.equal(calls[5].options.method, 'POST');
  assert.equal(calls[5].options.body, JSON.stringify({ productId: 8, unitPrice: 12.5, currency: 'USD' }));
  assert.equal(calls[5].options.fallbackMessage, 'No se pudo asignar el producto al proveedor.');

  assert.equal(calls[6].url, '/api/suppliers/company/25/products/8');
  assert.equal(calls[6].options.method, 'DELETE');
  assert.equal(calls[6].options.fallbackMessage, 'No se pudo remover el producto del proveedor.');

  assert.equal(calls[7].url, '/api/products');
  assert.equal(calls[7].options.fallbackMessage, 'No se pudieron cargar los productos.');
});
