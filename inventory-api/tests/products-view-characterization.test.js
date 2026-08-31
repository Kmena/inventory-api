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

  // Formulario con checkbox inCatalog marcado
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
    ['inCatalog', 'on'],
  ]));

  assert.equal(payload.name, 'Producto demo');
  assert.equal(payload.code, 'PT-99');
  assert.equal(payload.subcategoryId, 7);
  assert.equal(payload.price, 1250.5);
  assert.equal(payload.minStock, 5);
  assert.equal(payload.maxStock, 15);
  assert.equal(payload.inCatalog, true, 'inCatalog debe ser true cuando el checkbox esta marcado');

  // Checkbox desmarcado: FormData omite el campo => get() devuelve null o undefined
  const payloadUnchecked = helpers.buildProductPayload(new Map([
    ['name', 'Producto oculto'],
    ['price', '500'],
  ]));
  assert.equal(payloadUnchecked.inCatalog, false, 'inCatalog debe ser false cuando el checkbox no esta en FormData');
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

  // renderDetail: Contenido neto replaces Categoria; order is Contenido neto → Unidad → Precio.
  const detailWithPresentation = renderers.renderDetail(
    { id: 1, name: 'Shampoo', code: 'SH-01', netContent: 325, netContentUnit: 'ML', unit: 'ML', price: 1500, currency: 'CRC', isActive: true },
    { canManageProducts: false, detailState: 'ready' },
  );
  assert.match(detailWithPresentation, /Contenido neto/, 'detail must show Contenido neto instead of Categoria');
  assert.match(detailWithPresentation, /325/, 'detail must display netContent value');
  assert.match(detailWithPresentation, /ML/, 'detail must display netContentUnit');
  assert.doesNotMatch(detailWithPresentation, /<span>Categoria<\/span>/, 'Categoria label must not appear in detail');

  // Without netContent the field shows "Sin definir".
  const detailLegacy = renderers.renderDetail(
    { id: 2, name: 'Producto legado', code: 'PL-01', unit: 'UN', price: 500, currency: 'CRC', isActive: true },
    { canManageProducts: false, detailState: 'ready' },
  );
  assert.match(detailLegacy, /Sin definir/, 'detail must show "Sin definir" when netContent is absent');
});

// ─── TASK-006: product size presentation fields in buildProductPayload ────────

test('buildProductPayload includes presentationType null for legacy products (TASK-006)', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.productsAdminHelpers');

  // No presentationType in FormData — should produce presentationType: null.
  // netContentUnit is now the unit field; when absent/empty, unit is not sent.
  const payload = helpers.buildProductPayload(new Map([
    ['name', 'Producto legado'],
    ['presentationType', ''],
    ['netContentUnit', 'KG'],
  ]));

  assert.equal(payload.presentationType, null,
    'presentationType must be null when not selected');
  assert.equal(payload.netContentUnit, 'KG',
    'netContentUnit must always be sent when present in form');
  assert.equal(payload.unit, 'KG',
    'unit must be derived from netContentUnit for backward compat');
  assert.equal('netContent' in payload, false,
    'netContent must not be sent when presentationType is absent');
});

test('buildProductPayload includes all VOLUME size fields correctly (TASK-006)', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.productsAdminHelpers');

  const payload = helpers.buildProductPayload(new Map([
    ['name', 'Shampoo 325 mL'],
    ['presentationType', 'VOLUME'],
    ['netContent', '325'],
    ['netContentUnit', 'ML'],
    ['density', '1.02'],
  ]));

  assert.equal(payload.presentationType, 'VOLUME');
  assert.equal(payload.netContent, 325);
  assert.equal(payload.netContentUnit, 'ML');
  assert.equal(payload.unit, 'ML', 'unit must be derived from netContentUnit');
  assert.equal(payload.density, 1.02);
  assert.equal('kgConversionFactor' in payload, false,
    'kgConversionFactor must not be included for VOLUME presentation');
});

test('buildProductPayload includes MASS size fields without density (TASK-006)', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.productsAdminHelpers');

  const payload = helpers.buildProductPayload(new Map([
    ['name', 'Crema 500 g'],
    ['presentationType', 'MASS'],
    ['netContent', '500'],
    ['netContentUnit', 'G'],
  ]));

  assert.equal(payload.presentationType, 'MASS');
  assert.equal(payload.netContent, 500);
  assert.equal(payload.netContentUnit, 'G');
  assert.equal('density' in payload, false,
    'density must not be included for MASS presentation');
});

test('buildProductPayload includes LENGTH size fields with kgConversionFactor (TASK-006)', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.productsAdminHelpers');

  const payload = helpers.buildProductPayload(new Map([
    ['name', 'Cable por metro'],
    ['presentationType', 'LENGTH'],
    ['netContent', '1.5'],
    ['netContentUnit', 'M'],
    ['kgConversionFactor', '0.35'],
  ]));

  assert.equal(payload.presentationType, 'LENGTH');
  assert.equal(payload.netContent, 1.5);
  assert.equal(payload.netContentUnit, 'M');
  assert.equal(payload.kgConversionFactor, 0.35);
});

test('products-admin.js form HTML includes the presentation fieldset with all conditional elements (TASK-006)', () => {
  const source = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'src', 'public', 'root', 'views', 'products-admin.js'),
    'utf8',
  );

  // Fieldset exists
  assert.match(source, /id="products-size-fieldset"/, 'presentation fieldset must be present');
  // presentationType select
  assert.match(source, /id="products-form-presentation-type"/, 'presentationType select must be present');
  assert.match(source, /VOLUME/, 'must include VOLUME option');
  assert.match(source, /MASS/, 'must include MASS option');
  assert.match(source, /LENGTH/, 'must include LENGTH option');
  assert.match(source, /COUNT/, 'must include COUNT option');
  // netContentUnit is always visible (no style display none) and required
  assert.match(source, /id="products-form-net-content-unit-group"/, 'net content unit group must be present');
  assert.doesNotMatch(
    source.slice(source.indexOf('id="products-form-net-content-unit-group"'), 80),
    /style="display:none"/,
    'netContentUnit group must NOT be hidden by default',
  );
  assert.match(source, /id="products-form-net-content-unit".*required|required.*id="products-form-net-content-unit"/s,
    'netContentUnit select must carry required attribute');
  // unit text input must NOT appear in datos principales
  const datosSection = source.slice(
    source.indexOf('<legend>Datos principales</legend>'),
    source.indexOf('<fieldset', source.indexOf('<legend>Datos principales</legend>') + 1),
  );
  assert.doesNotMatch(datosSection, /name="unit"/, '"unit" text input must be removed from Datos principales');
  // Conditional groups
  assert.match(source, /id="products-form-net-content-group"/, 'net content group must be present');
  assert.match(source, /id="products-form-density-group"/, 'density group must be present');
  assert.match(source, /id="products-form-kg-factor-group"/, 'kgConversionFactor group must be present');
  // syncSizeFields JS
  assert.match(source, /function syncSizeFields/, 'syncSizeFields function must be declared');
  // All units option set must be present for no-type case
  assert.match(source, /'UN'.*Unidades|Unidades.*'UN'/, 'must include UN option for count/no-type case');
});
