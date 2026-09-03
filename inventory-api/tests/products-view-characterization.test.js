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

// ─── TASK-004: checkSubcategoryNameDuplicate ────────────────────────────────

test('checkSubcategoryNameDuplicate detecta duplicados y degrada graciosamente', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.productsAdminHelpers');

  const categories = [
    {
      id: 1, name: 'Producto Terminado', categoryType: 'PT',
      subcategories: [
        { id: 10, name: 'Shampoo' },
        { id: 11, name: 'Aceite' },
      ],
    },
    {
      id: 2, name: 'Materia Prima', categoryType: 'MP',
      subcategories: [
        { id: 20, name: 'Aceite' },
      ],
    },
    {
      id: 3, name: 'Empaques', categoryType: 'EM',
      subcategories: [],
    },
  ];

  // Caso: nombre duplicado (case-insensitive) en la misma categoría padre
  const dupMsg = helpers.checkSubcategoryNameDuplicate(categories, '1', 'shampoo');
  assert.ok(dupMsg !== null, 'Debe retornar mensaje cuando el nombre existe en la misma categoría padre');
  assert.ok(dupMsg.includes('Producto Terminado'), 'El mensaje debe incluir el nombre de la categoría padre');

  // Caso: nombre disponible en la categoría
  const okMsg = helpers.checkSubcategoryNameDuplicate(categories, '1', 'Gel de Baño');
  assert.equal(okMsg, null, 'Debe retornar null cuando el nombre no existe en esa categoría padre');

  // CASO CLAVE (D-007, BR-002): mismo nombre en DIFERENTE categoría padre → NO es duplicado
  // 'Aceite' existe en PT (id=1) y MP (id=2). Crearlo en EM (id=3) es válido.
  const crossCatMsg = helpers.checkSubcategoryNameDuplicate(categories, '3', 'Aceite');
  assert.equal(crossCatMsg, null, 'Aceite en Empaques no es duplicado porque no existe allí');

  // Duplicado en MP: 'Aceite' ya existe en MP
  const dupInMP = helpers.checkSubcategoryNameDuplicate(categories, '2', 'aceite');
  assert.ok(dupInMP !== null, 'Aceite en MP sí es duplicado (case-insensitive)');
  assert.ok(dupInMP.includes('Materia Prima'), 'El mensaje menciona Materia Prima como categoría padre');

  // Caso: categoría padre no encontrada (degradación graciosa)
  const unknownCat = helpers.checkSubcategoryNameDuplicate(categories, '99', 'Shampoo');
  assert.equal(unknownCat, null, 'Debe retornar null cuando la categoría padre no se encuentra');

  // Casos: datos vacíos (degradación graciosa)
  assert.equal(helpers.checkSubcategoryNameDuplicate([], '1', 'Shampoo'), null, 'Array vacío → null');
  assert.equal(helpers.checkSubcategoryNameDuplicate(null, '1', 'Shampoo'), null, 'null categories → null');
  assert.equal(helpers.checkSubcategoryNameDuplicate(categories, null, 'Shampoo'), null, 'null categoryId → null');
  assert.equal(helpers.checkSubcategoryNameDuplicate(categories, '1', ''), null, 'nombre vacío → null');
});

// ─── Helper para cargar products-admin.js en el harness ──────────────────────

function createHarnessWithView() {
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

  // Stubs para las dependencias que products-admin.js necesita al cargarse
  const rootShell = browserWindow.RootShell;
  rootShell.register('productsApi', {
    listProducts: () => {},
    getProduct: () => {},
    createProduct: () => {},
    updateProduct: () => {},
    deactivateProduct: () => {},
  });
  rootShell.register('categoriesApi', {
    listCategories: () => {},
    createCategory: () => {},
  });
  rootShell.register('sessionAdapter', { hasPermission: () => false });

  executeRootScript('views/products-admin.js', context);
  return rootShell;
}

// ─── TASK-001/002/003/006: render() HTML assertions ──────────────────────────

test('products-admin render() contiene las correcciones UX de labels, botón y fieldset', () => {
  const rootShell = createHarnessWithView();
  const productsAdmin = rootShell.require('views.productsAdmin');
  const html = productsAdmin.render();

  // TASK-002: label del filtro debe decir 'Subcategoria'
  assert.ok(html.includes('<span>Subcategoria</span>'), 'El label del filtro debe decir Subcategoria');

  // TASK-001: el botón de submit del form de categorías debe decir 'Crear subcategoria'
  assert.ok(html.includes('Crear subcategoria'), 'El botón de submit debe decir Crear subcategoria');

  // TASK-003: el fieldset de nueva subcategoría debe tener su id
  assert.ok(
    html.includes('id="products-create-subcategory-fieldset"'),
    'El fieldset de nueva subcategoría debe tener id products-create-subcategory-fieldset',
  );

  // TASK-006: el formulario de producto debe incluir el botón de nueva subcategoría
  assert.ok(
    html.includes('id="products-form-add-subcategory-button"'),
    'El formulario debe incluir id="products-form-add-subcategory-button"',
  );

  // TASK-006: el botón de nueva subcategoría debe ser type="button" para no disparar el submit del form
  // Verificar que el botón específico tiene type="button" buscando su id en el contexto del atributo
  const addBtnIdx = html.indexOf('id="products-form-add-subcategory-button"');
  assert.ok(addBtnIdx !== -1, 'El botón products-form-add-subcategory-button debe existir en el HTML');
  // El type="button" debe aparecer antes del cierre del tag del botón (dentro del mismo elemento)
  const btnContext = html.slice(Math.max(0, addBtnIdx - 60), addBtnIdx + 100);
  assert.ok(
    btnContext.includes('type="button"'),
    'El botón #products-form-add-subcategory-button debe tener type="button" para no disparar el form submit',
  );
});

// ─── Regressions: existing tests must still pass ──────────────────────────────

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
