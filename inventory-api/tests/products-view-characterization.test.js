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
  });
  browserWindow.window = browserWindow;

  executeRootScript('registry.js', context);
  executeRootScript('ui.js', context);
  executeRootScript('views/products-admin.helpers.js', context);
  executeRootScript('views/products-admin.state.js', context);
  executeRootScript('views/products-admin.renderers.js', context);

  return browserWindow.RootShell;
}

test('products helpers normalize pagination, local filtering and payload shaping', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.productsAdminHelpers');

  const normalized = helpers.normalizeProductsResponse({
    items: [
      { id: 1, code: 'PT-01', name: 'Producto 1', description: 'Venta principal', categoryId: 5, category: { name: 'Bebidas' }, price: 1000, currency: 'CRC' },
      { id: 2, code: 'PT-02', name: 'Empaque 1', description: 'Material', categoryId: 9, category: { name: 'Empaques' }, price: 2000, currency: 'CRC' },
    ],
    pagination: { page: 2, pageSize: 10, totalItems: 22, totalPages: 3 },
  });

  assert.equal(normalized.pagination.page, 2);
  assert.equal(normalized.pagination.totalItems, 22);

  const visible = helpers.filterProducts(normalized.items, {
    searchTerm: 'bebidas',
    categoryId: '5',
  });

  assert.equal(visible.length, 1);
  assert.equal(visible[0].code, 'PT-01');
  assert.equal(helpers.hasActiveFilters({ searchTerm: '', categoryId: '' }), false);
  assert.equal(helpers.hasActiveFilters({ searchTerm: 'pt', categoryId: '' }), true);

  const payload = helpers.buildProductPayload(new Map([
    ['name', ' Producto demo '],
    ['code', ' PT-99 '],
    ['description', ' Catalogo '],
    ['subcategoryId', '7'],
    ['unit', ' UN '],
    ['currency', ' CRC '],
    ['price', '1250.50'],
    ['minStock', '5'],
    ['maxStock', '15'],
  ]));

  assert.equal(payload.name, 'Producto demo');
  assert.equal(payload.code, 'PT-99');
  assert.equal(payload.subcategoryId, 7);
  assert.equal(payload.price, 1250.5);
  assert.equal(payload.minStock, 5);
  assert.equal(payload.maxStock, 15);
});

test('products state/renderers expose summary, responsive markup and category list', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.productsAdminRenderers');
  const state = rootShell.require('views.productsAdminState');

  const metricsMarkup = renderers.renderMetrics([
    { id: 1, name: 'Producto demo', price: 100, currency: 'CRC', isActive: true, quantity: 2, minStock: 5 },
  ], [{ id: 3, name: 'Bebidas', categoryType: 'PT', subcategories: [{ id: 10, name: 'Shampoo' }] }]);
  assert.match(metricsMarkup, /Bajo stock en pagina/);

  const tableMarkup = renderers.renderProductsTable([
    { id: 1, code: 'PT-01', name: 'Producto demo', category: { name: 'Bebidas' }, price: 1000, currency: 'CRC', isActive: true, quantity: 4, reservedQuantity: 1 },
  ], '1');
  assert.match(tableMarkup, /data-label="Producto"/);
  assert.match(tableMarkup, /Detalle abierto/);

  const categoryMarkup = renderers.renderCategoriesList([{ id: 3, name: 'Bebidas', categoryType: 'PT' }]);
  assert.match(categoryMarkup, /Bebidas/);
  assert.equal(state.resolveSelectedProductId([{ id: 10 }, { id: 11 }], '11'), 11);
  assert.match(state.buildDetailSubtitle({ code: 'PT-01', category: { name: 'Bebidas' } }), /Codigo PT-01/);
});
