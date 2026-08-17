/* global FormData */
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

function createHarness() {
  const browserWindow = {};
  const context = vm.createContext({
    URLSearchParams,
    window: browserWindow,
    confirm: () => true,
  });
  browserWindow.window = browserWindow;

  executeRootScript('registry.js', context);
  executeRootScript('ui.js', context);
  executeRootScript('views/suppliers-admin.helpers.js', context);
  executeRootScript('views/suppliers-admin.renderers.js', context);

  return browserWindow.RootShell;
}

function createViewHarness() {
  const browserWindow = {
    FormData,
    confirm: () => true,
  };
  const context = vm.createContext({
    Map,
    URLSearchParams,
    FormData,
    window: browserWindow,
    confirm: () => true,
  });
  browserWindow.window = browserWindow;

  executeRootScript('registry.js', context);
  executeRootScript('ui.js', context);
  executeRootScript('views/suppliers-admin.helpers.js', context);
  executeRootScript('views/suppliers-admin.renderers.js', context);

  browserWindow.RootShell.register('suppliersApi', {
    listCompanySuppliers: async () => [],
    createCompanySupplier: async () => ({}),
    getCompanySupplier: async () => ({ products: [] }),
    updateCompanySupplier: async () => ({}),
    deleteCompanySupplier: async () => undefined,
    addProductToSupplier: async () => ({}),
    removeProductFromSupplier: async () => undefined,
    listCompanyProducts: async () => [],
  });
  browserWindow.RootShell.register('sessionAdapter', {
    hasPermission(session, permission) {
      return Boolean(session?.user?.permissions?.includes(permission));
    },
  });

  executeRootScript('views/suppliers-admin.js', context);
  return browserWindow.RootShell;
}

test('suppliers helpers filter suppliers by name case-insensitive and keep alphabetical order', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.suppliersAdminHelpers');

  const suppliers = [
    { id: 1, name: 'Proveedor ABC', productCount: 3 },
    { id: 2, name: 'Distribuidor XYZ', productCount: 0 },
    { id: 3, name: 'ABC Materiales', productCount: 1 },
  ];

  const filtered = helpers.filterSuppliers(suppliers, 'abc');
  assert.equal(filtered.length, 2);
  assert.equal(filtered[0].name, 'ABC Materiales');
  assert.equal(filtered[1].name, 'Proveedor ABC');

  const noFilter = helpers.filterSuppliers(suppliers, '');
  assert.equal(noFilter.length, 3);
  assert.equal(noFilter[0].name, 'ABC Materiales');
  assert.equal(noFilter[1].name, 'Distribuidor XYZ');
  assert.equal(noFilter[2].name, 'Proveedor ABC');
});

test('suppliers helpers build metrics from supplier list', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.suppliersAdminHelpers');

  const metrics = helpers.buildSupplierMetrics([
    { id: 1, name: 'A', productCount: 3 },
    { id: 2, name: 'B', productCount: 0 },
    { id: 3, name: 'C', productCount: 1 },
  ]);

  assert.equal(metrics.total, 3);
  assert.equal(metrics.withProducts, 2);
  assert.equal(metrics.withoutProducts, 1);
});

test('suppliers helpers expose escapeHtml and sortSuppliersByName contracts', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.suppliersAdminHelpers');

  assert.equal(helpers.escapeHtml('<b>Proveedor</b>'), '&lt;b&gt;Proveedor&lt;/b&gt;');

  const ordered = helpers.sortSuppliersByName([
    { id: 3, name: 'Zulu' },
    { id: 1, name: 'alfa' },
    { id: 2, name: 'Beta' },
  ]);

  assert.equal(ordered.map((supplier) => supplier.name).join('|'), 'alfa|Beta|Zulu');
});

test('suppliers renderers render table with expected columns', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.suppliersAdminRenderers');

  const html = renderers.renderSuppliersTable([
    {
      id: '1',
      name: 'Proveedor ABC',
      email: 'abc@test.com',
      phone: '8888-8888',
      country: 'Costa Rica',
      productCount: 5,
      createdAt: '2025-01-20T00:00:00.000Z',
    },
  ]);

  assert.match(html, /data-label="Nombre"/);
  assert.match(html, /data-label="Email"/);
  assert.match(html, /data-label="Telefono"/);
  assert.match(html, /data-label="Pais"/);
  assert.match(html, /data-label="Productos"/);
  assert.match(html, /data-label="Creado"/);
  assert.match(html, /Proveedor ABC/);
  assert.match(html, /abc@test\.com/);
  assert.match(html, /data-supplier-id="1"/);
});

test('suppliers renderers render empty table as empty string', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.suppliersAdminRenderers');

  const html = renderers.renderSuppliersTable([]);
  assert.equal(html, '');
});

test('suppliers renderers render metrics with total and product counts', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.suppliersAdminRenderers');

  const html = renderers.renderMetrics({ total: 10, withProducts: 7, withoutProducts: 3 });
  assert.match(html, /Total/);
  assert.match(html, /Con productos/);
  assert.match(html, /Sin productos/);
  assert.match(html, /10/);
  assert.match(html, /7/);
});

test('suppliers renderers render product detail table with price columns', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.suppliersAdminRenderers');

  const html = renderers.renderSupplierDetailProducts([
    {
      productId: '123',
      productCode: 'MP-001',
      productName: 'Materia prima A',
      supplierSku: 'ABC-001',
      unitPrice: 1500,
      currency: 'CRC',
      isPreferred: true,
      leadTimeDays: 5,
      minimumOrderQuantity: 10,
      notes: 'Discount available',
    },
  ]);

  assert.match(html, /MP-001/);
  assert.match(html, /Materia prima A/);
  assert.match(html, /ABC-001/);
  assert.match(html, /1500/);
  assert.match(html, /CRC/);
  assert.match(html, /data-label="Precio"/);
  assert.match(html, /data-label="Moneda"/);
  assert.match(html, /Remover/);
});

test('suppliers renderers hide destructive product actions for read-only users', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.suppliersAdminRenderers');

  const html = renderers.renderSupplierDetailProducts([
    {
      productId: '123',
      productCode: 'MP-001',
      productName: 'Materia prima A',
    },
  ], { canManage: false });

  assert.doesNotMatch(html, /Remover/);
  assert.doesNotMatch(html, /Acciones/);
});

test('suppliers renderers render empty products state', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.suppliersAdminRenderers');

  const html = renderers.renderSupplierDetailProducts([]);
  assert.match(html, /no tiene productos asignados/);
});

test('suppliers renderers escape user-controlled content in table output', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.suppliersAdminRenderers');

  const html = renderers.renderSuppliersTable([
    {
      id: '1',
      name: '<script>alert("xss")</script>',
      email: null,
      phone: null,
      country: null,
      productCount: 0,
      createdAt: null,
    },
  ]);

  assert.ok(!html.includes('<script>'));
  assert.match(html, /&lt;script&gt;/);
});

test('suppliers view render exposes the dedicated suppliers workspace and dialogs', () => {
  const rootShell = createViewHarness();
  const view = rootShell.require('views.suppliersAdmin');
  const markup = view.render();

  assert.match(markup, /<h2 id="root-view-title">Proveedores<\/h2>/);
  assert.match(markup, /suppliers-metrics/);
  assert.match(markup, /suppliers-search-input/);
  assert.match(markup, /suppliers-list-region/);
  assert.match(markup, /suppliers-create-dialog/);
  assert.match(markup, /suppliers-detail-dialog/);
  assert.match(markup, /suppliers-add-product-dialog/);
  assert.match(markup, /Nuevo proveedor/);
  assert.match(markup, /Asignar producto al proveedor/);
  assert.doesNotMatch(markup, /Modulo en progreso/);
});

test('suppliers view render includes product search filter and summary in add-product dialog', () => {
  const rootShell = createViewHarness();
  const view = rootShell.require('views.suppliersAdmin');
  const markup = view.render();

  assert.match(markup, /id="suppliers-add-product-search"/);
  assert.match(markup, /type="search"/);
  assert.match(markup, /Buscar producto por nombre o SKU/);
  assert.match(markup, /id="suppliers-add-product-search-summary"/);
  assert.match(markup, /aria-live="polite"/);
  assert.match(markup, /id="suppliers-add-product-select"/);
});

test('suppliers helpers filterAvailableProducts filters by name and code and excludes assigned', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.suppliersAdminHelpers');

  const products = [
    { id: 1, code: 'MP-001', name: 'Materia Prima A' },
    { id: 2, code: 'MP-002', name: 'Materia Prima B' },
    { id: 3, code: 'SKU-AC-44', name: 'Acido Citrico' },
    { id: 4, code: 'BIC-77', name: 'Bicarbonato' },
  ];
  const assigned = [{ productId: 1 }];

  const noFilter = helpers.filterAvailableProducts(products, assigned, '');
  assert.equal(noFilter.length, 3);
  assert.ok(noFilter.every((p) => p.id !== 1));

  const byName = helpers.filterAvailableProducts(products, assigned, 'citrico');
  assert.equal(byName.length, 1);
  assert.equal(byName[0].id, 3);

  const bySku = helpers.filterAvailableProducts(products, assigned, 'BIC-77');
  assert.equal(bySku.length, 1);
  assert.equal(bySku[0].id, 4);

  const noMatch = helpers.filterAvailableProducts(products, assigned, 'xyz999');
  assert.equal(noMatch.length, 0);
});

test('suppliers renderers renderFilteredProductOptions shows correct states', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.suppliersAdminRenderers');

  const allAssigned = renderers.renderFilteredProductOptions([], 0);
  assert.match(allAssigned, /Todos los productos ya estan asignados/);

  const noResults = renderers.renderFilteredProductOptions([], 5);
  assert.match(noResults, /Sin resultados para el filtro actual/);

  const withProducts = renderers.renderFilteredProductOptions(
    [{ id: 1, code: 'MP-001', name: 'Materia Prima A' }],
    3,
  );
  assert.match(withProducts, /Seleccionar producto/);
  assert.match(withProducts, /MP-001/);
  assert.match(withProducts, /Materia Prima A/);
});
