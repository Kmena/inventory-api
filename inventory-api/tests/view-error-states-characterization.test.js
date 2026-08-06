/**
 * TASK-012: Cubrir estados de error, permisos y regresiones por vista
 *
 * Cubre los gaps de cobertura identificados en las cuatro vistas de inventario:
 *   - Bodegas (#warehouses)
 *   - Productos (#products)
 *   - Movimientos (#movements)
 *   - Lotes (#lots) — permisos ya cubiertos en lots-view-characterization.test.js
 *
 * Categorías:
 *   A) Permission helpers — canView* / canCreate* / canManage*
 *   B) Summary / pagination helpers — buildVisibleSummary, buildPaginationQuery
 *   C) Read-only enforcement en renderers — detail sin acciones de escritura
 *   D) Estados de error, vacío y carga en renderers
 *   E) Superficie adicional de renderers no cubierta anteriormente
 */

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

function createBaseContext() {
  const browserWindow = {};
  const context = vm.createContext({ URLSearchParams, window: browserWindow });
  browserWindow.window = browserWindow;
  executeRootScript('registry.js', context);
  executeRootScript('ui.js', context);
  return { browserWindow, context };
}

function createWarehousesHarness() {
  const { browserWindow, context } = createBaseContext();
  executeRootScript('views/warehouses-admin.helpers.js', context);
  executeRootScript('views/warehouses-admin.renderers.js', context);
  return browserWindow.RootShell;
}

function createMovementsHarness() {
  const { browserWindow, context } = createBaseContext();
  executeRootScript('views/movements-admin.helpers.js', context);
  executeRootScript('views/movements-admin.renderers.js', context);
  return browserWindow.RootShell;
}

function createProductsHarness() {
  const { browserWindow, context } = createBaseContext();
  executeRootScript('views/products-admin.helpers.js', context);
  executeRootScript('views/products-admin.state.js', context);
  executeRootScript('views/products-admin.renderers.js', context);
  return browserWindow.RootShell;
}

// ---------------------------------------------------------------------------
// A) Permission helpers
// ---------------------------------------------------------------------------

const mockAdapter = {
  hasPermission: (session, perm) => Array.isArray(session.permissions) && session.permissions.includes(perm),
};

// --- Warehouses permissions ---

test('canViewWarehouses requires inventory.view or inventory.manage', () => {
  const rootShell = createWarehousesHarness();
  const helpers = rootShell.require('views.warehousesAdminHelpers');

  assert.equal(helpers.canViewWarehouses({ permissions: ['inventory.view'] }, mockAdapter), true);
  assert.equal(helpers.canViewWarehouses({ permissions: ['inventory.manage'] }, mockAdapter), true);
  assert.equal(helpers.canViewWarehouses({ permissions: ['products.view'] }, mockAdapter), false);
  assert.equal(helpers.canViewWarehouses({ permissions: [] }, mockAdapter), false);
});

test('canCreateWarehouses requires inventory.manage only', () => {
  const rootShell = createWarehousesHarness();
  const helpers = rootShell.require('views.warehousesAdminHelpers');

  assert.equal(helpers.canCreateWarehouses({ permissions: ['inventory.manage'] }, mockAdapter), true);
  assert.equal(helpers.canCreateWarehouses({ permissions: ['inventory.view'] }, mockAdapter), false);
  assert.equal(helpers.canCreateWarehouses({ permissions: [] }, mockAdapter), false);
});

// --- Products permissions ---

test('canViewProducts requires products.view or products.manage', () => {
  const rootShell = createProductsHarness();
  const helpers = rootShell.require('views.productsAdminHelpers');

  assert.equal(helpers.canViewProducts({ permissions: ['products.view'] }, mockAdapter), true);
  assert.equal(helpers.canViewProducts({ permissions: ['products.manage'] }, mockAdapter), true);
  assert.equal(helpers.canViewProducts({ permissions: ['inventory.view'] }, mockAdapter), false);
  assert.equal(helpers.canViewProducts({ permissions: [] }, mockAdapter), false);
});

test('canManageProducts requires products.manage only', () => {
  const rootShell = createProductsHarness();
  const helpers = rootShell.require('views.productsAdminHelpers');

  assert.equal(helpers.canManageProducts({ permissions: ['products.manage'] }, mockAdapter), true);
  assert.equal(helpers.canManageProducts({ permissions: ['products.view'] }, mockAdapter), false);
  assert.equal(helpers.canManageProducts({ permissions: [] }, mockAdapter), false);
});

test('canCreateCategories requires products.manage or inventory.manage', () => {
  const rootShell = createProductsHarness();
  const helpers = rootShell.require('views.productsAdminHelpers');

  assert.equal(helpers.canCreateCategories({ permissions: ['products.manage'] }, mockAdapter), true);
  assert.equal(helpers.canCreateCategories({ permissions: ['inventory.manage'] }, mockAdapter), true);
  assert.equal(helpers.canCreateCategories({ permissions: ['products.view'] }, mockAdapter), false);
  assert.equal(helpers.canCreateCategories({ permissions: [] }, mockAdapter), false);
});

// --- Movements permissions ---

test('canViewMovements requires inventory.view or inventory.manage', () => {
  const rootShell = createMovementsHarness();
  const helpers = rootShell.require('views.movementsAdminHelpers');

  assert.equal(helpers.canViewMovements({ permissions: ['inventory.view'] }, mockAdapter), true);
  assert.equal(helpers.canViewMovements({ permissions: ['inventory.manage'] }, mockAdapter), true);
  assert.equal(helpers.canViewMovements({ permissions: ['products.view'] }, mockAdapter), false);
  assert.equal(helpers.canViewMovements({ permissions: [] }, mockAdapter), false);
});

// ---------------------------------------------------------------------------
// B) Summary / pagination helpers
// ---------------------------------------------------------------------------

// --- Warehouses buildVisibleSummary ---

test('warehouses buildVisibleSummary describes items vs visible with and without filters', () => {
  const rootShell = createWarehousesHarness();
  const helpers = rootShell.require('views.warehousesAdminHelpers');
  const defaultFilters = helpers.createDefaultFilters();

  // No items at all — returns an empty-state message (not a count)
  const noItemsSummary = helpers.buildVisibleSummary(0, 0, defaultFilters);
  assert.ok(typeof noItemsSummary === 'string' && noItemsSummary.length > 0, 'Should return a non-empty string for 0 items');
  assert.doesNotMatch(noItemsSummary, /undefined|null/);

  // All items visible — returns a message with the total count
  const allVisibleSummary = helpers.buildVisibleSummary(5, 5, defaultFilters);
  assert.match(allVisibleSummary, /5/);

  // Filtered subset — returns both visible and total counts
  const filteredSummary = helpers.buildVisibleSummary(5, 2, { ...defaultFilters, searchTerm: 'bod' });
  assert.match(filteredSummary, /2/);
  assert.match(filteredSummary, /5/);
});

// --- Products buildVisibleSummary ---

test('products buildVisibleSummary includes page/total context and filter state', () => {
  const rootShell = createProductsHarness();
  const helpers = rootShell.require('views.productsAdminHelpers');

  const pagination = { page: 1, pageSize: 10, totalItems: 25, totalPages: 3 };
  const filters = { searchTerm: '', categoryId: '' };

  // All visible on this page
  const allVisibleSummary = helpers.buildVisibleSummary(10, 10, pagination, filters);
  assert.match(allVisibleSummary, /10/);

  // Filtered
  const filteredSummary = helpers.buildVisibleSummary(2, 10, pagination, { searchTerm: 'cafe', categoryId: '' });
  assert.match(filteredSummary, /2/);
});

// --- Movements buildPaginationQuery ---

test('movements buildPaginationQuery maps filters and page to correct query params', () => {
  const rootShell = createMovementsHarness();
  const helpers = rootShell.require('views.movementsAdminHelpers');

  const query = helpers.buildPaginationQuery(
    { warehouseId: '7', productId: '15', lotId: '9' },
    2,
    10
  );

  assert.equal(query.warehouseId, '7');
  assert.equal(query.productId, '15');
  assert.equal(query.lotId, '9');
  assert.equal(query.page, 2);
  assert.equal(query.pageSize, 10);
});

test('movements buildPaginationQuery omits empty filter values from query', () => {
  const rootShell = createMovementsHarness();
  const helpers = rootShell.require('views.movementsAdminHelpers');

  const defaultFilters = helpers.createDefaultFilters();
  const query = helpers.buildPaginationQuery(defaultFilters, 1, 10);

  // Empty filter values should not appear as populated strings
  assert.ok(!query.warehouseId, 'warehouseId should be falsy when empty');
  assert.ok(!query.productId, 'productId should be falsy when empty');
  assert.ok(!query.lotId, 'lotId should be falsy when empty');
  assert.equal(query.page, 1);
});

// ---------------------------------------------------------------------------
// C) Read-only enforcement in renderers
// ---------------------------------------------------------------------------

// --- Products detail: read-only vs manage mode ---

test('products renderDetail omits edit and deactivate buttons when canManageProducts is false', () => {
  const rootShell = createProductsHarness();
  const renderers = rootShell.require('views.productsAdminRenderers');

  const product = {
    id: 1,
    name: 'Cafe molido',
    code: 'PT-01',
    description: 'Bebida',
    category: { name: 'Bebidas' },
    price: 1200,
    currency: 'CRC',
    unit: 'UN',
    isActive: true,
    quantity: 10,
    reservedQuantity: 2,
    minStock: 5,
    maxStock: 20,
  };

  const readOnlyMarkup = renderers.renderDetail(product, { canManageProducts: false });
  assert.doesNotMatch(readOnlyMarkup, /products-open-edit-button/);
  assert.doesNotMatch(readOnlyMarkup, /products-open-deactivate-button/);
  assert.match(readOnlyMarkup, /Cafe molido/);
  assert.match(readOnlyMarkup, /PT-01/);
});

test('products renderDetail includes edit and deactivate buttons when canManageProducts is true', () => {
  const rootShell = createProductsHarness();
  const renderers = rootShell.require('views.productsAdminRenderers');

  const product = {
    id: 1,
    name: 'Cafe molido',
    code: 'PT-01',
    category: { name: 'Bebidas' },
    price: 1200,
    currency: 'CRC',
    unit: 'UN',
    isActive: true,
    quantity: 10,
    reservedQuantity: 2,
    minStock: 5,
    maxStock: 20,
  };

  const manageMarkup = renderers.renderDetail(product, { canManageProducts: true });
  assert.match(manageMarkup, /products-open-edit-button/);
  assert.match(manageMarkup, /products-open-deactivate-button/);
});

// --- Movements detail: no mutation actions ---

test('movements renderDetail contains no form, no edit, no delete markup', () => {
  const rootShell = createMovementsHarness();
  const renderers = rootShell.require('views.movementsAdminRenderers');

  const movement = {
    id: 44,
    createdAt: '2026-08-05T10:15:00.000Z',
    movementType: 'ADJUSTMENT',
    quantity: '5',
    quantityBefore: '10',
    quantityAfter: '15',
    reasonCode: 'MANUAL_ADJUSTMENT',
    sourceType: 'manual_adjustment',
    sourceId: '22',
    movementGroupId: 'grp-1',
    note: 'Conteo fisico',
    product: { name: 'Envase 1L', code: 'ENV-1L' },
    warehouse: { name: 'Central' },
    lot: { internalLotNumber: 'LOT-1' },
    user: { fullName: 'Ana Perez', username: 'aperez' },
  };

  const detailMarkup = renderers.renderDetail(movement);
  assert.doesNotMatch(detailMarkup, /<form/i);
  assert.doesNotMatch(detailMarkup, /type="submit"/i);
  assert.doesNotMatch(detailMarkup, /eliminar|editar|revertir|cancelar/i);
  assert.match(detailMarkup, /Conteo fisico/);
  assert.match(detailMarkup, /Envase 1L/);
  assert.match(detailMarkup, /MANUAL_ADJUSTMENT/);
});

// --- Warehouses: virtual type overrides isSellableSource in form payload ---

test('warehouses buildCreateWarehousePayload forces isSellableSource false for virtual type regardless of checkbox', () => {
  const rootShell = createWarehousesHarness();
  const helpers = rootShell.require('views.warehousesAdminHelpers');

  const warehouseTypes = [
    { value: 'COURSES_VIRTUAL', label: 'Virtual', isVirtual: true, defaultSellableSource: false },
    { value: 'GENERAL', label: 'General', isVirtual: false, defaultSellableSource: false },
  ];

  const payload = helpers.buildCreateWarehousePayload(new Map([
    ['code', 'BOD-V'],
    ['name', 'Bodega Virtual'],
    ['warehouseType', 'COURSES_VIRTUAL'],
    ['isSellableSource', 'on'],
    ['isActive', 'on'],
  ]), warehouseTypes);

  assert.equal(payload.isSellableSource, false, 'Virtual warehouse must not be sellable regardless of checkbox');
  assert.equal(payload.warehouseType, 'COURSES_VIRTUAL');
  assert.equal(payload.isActive, true);
});

// ---------------------------------------------------------------------------
// D) Error, empty and loading states in renderers
// ---------------------------------------------------------------------------

// --- Movements renderState ---

test('movements renderState renders title and description inside markup', () => {
  const rootShell = createMovementsHarness();
  const renderers = rootShell.require('views.movementsAdminRenderers');

  const errorMarkup = renderers.renderState(
    'No fue posible cargar los movimientos',
    'Intenta nuevamente. Si el problema continua, contacta al administrador.'
  );
  assert.match(errorMarkup, /No fue posible cargar los movimientos/);
  assert.match(errorMarkup, /Intenta nuevamente/);

  const emptyMarkup = renderers.renderState(
    'Todavia no hay movimientos registrados',
    'Cuando existan entradas o ajustes de inventario, apareceran aqui.'
  );
  assert.match(emptyMarkup, /Todavia no hay movimientos registrados/);
});

// --- Products renderState ---

test('products renderState renders title and description without any edit actions', () => {
  const rootShell = createProductsHarness();
  const renderers = rootShell.require('views.productsAdminRenderers');

  const errorMarkup = renderers.renderState(
    'No se pudieron cargar los productos',
    'Intenta nuevamente o contacta al administrador.'
  );
  assert.match(errorMarkup, /No se pudieron cargar los productos/);
  assert.doesNotMatch(errorMarkup, /<form/i);
  assert.doesNotMatch(errorMarkup, /type="submit"/i);
});

// --- Products renderDetail: loading and error states ---

test('products renderDetail in loading state returns loading markup without product data', () => {
  const rootShell = createProductsHarness();
  const renderers = rootShell.require('views.productsAdminRenderers');

  const loadingMarkup = renderers.renderDetail(null, { detailState: 'loading' });
  assert.match(loadingMarkup, /Cargando/i);
  assert.doesNotMatch(loadingMarkup, /products-open-edit-button/);
});

test('products renderDetail in error state shows recoverable error message', () => {
  const rootShell = createProductsHarness();
  const renderers = rootShell.require('views.productsAdminRenderers');

  const errorMarkup = renderers.renderDetail(null, { detailState: 'error' });
  assert.match(errorMarkup, /No se pudo cargar/i);
  assert.doesNotMatch(errorMarkup, /products-open-edit-button/);
});

test('products renderDetail with null product and ready state returns placeholder text', () => {
  const rootShell = createProductsHarness();
  const renderers = rootShell.require('views.productsAdminRenderers');

  const emptyMarkup = renderers.renderDetail(null, { detailState: 'ready' });
  assert.match(emptyMarkup, /Selecciona un producto/i);
});

// --- Products renderCategoriesList with empty list ---

test('products renderCategoriesList with empty array shows empty state message', () => {
  const rootShell = createProductsHarness();
  const renderers = rootShell.require('views.productsAdminRenderers');

  const emptyMarkup = renderers.renderCategoriesList([]);
  assert.match(emptyMarkup, /no hay categorias/i);
  assert.doesNotMatch(emptyMarkup, /<table/i);
});

// --- Warehouses renderWarehouseState: multiple message variants ---

test('warehouses renderWarehouseState displays distinct messages for empty vs error', () => {
  const rootShell = createWarehousesHarness();
  const renderers = rootShell.require('views.warehousesAdminRenderers');

  const emptyMarkup = renderers.renderWarehouseState(
    'Todavia no hay bodegas registradas',
    'Crea la primera bodega de la empresa.'
  );
  assert.match(emptyMarkup, /Todavia no hay bodegas registradas/);

  const errorMarkup = renderers.renderWarehouseState(
    'No se pudieron cargar las bodegas',
    'Intenta nuevamente.'
  );
  assert.match(errorMarkup, /No se pudieron cargar las bodegas/);
  assert.match(errorMarkup, /Intenta nuevamente/);
});

// ---------------------------------------------------------------------------
// E) Additional renderer surface not previously covered
// ---------------------------------------------------------------------------

// --- Movements renderMetrics ---

test('movements renderMetrics renders correct metric counts for empty and non-empty item lists', () => {
  const rootShell = createMovementsHarness();
  const renderers = rootShell.require('views.movementsAdminRenderers');

  const emptyMetrics = renderers.renderMetrics([]);
  assert.match(emptyMetrics, /Movimientos visibles/);
  assert.match(emptyMetrics, /0/);

  const fullMetrics = renderers.renderMetrics([
    {
      id: 1, movementType: 'IN', createdAt: '2026-08-05T10:00:00.000Z',
      product: { name: 'Envase' }, warehouse: { name: 'Central' },
    },
    {
      id: 2, movementType: 'ADJUSTMENT', createdAt: '2026-08-05T11:00:00.000Z',
      product: { name: 'Tapa' }, warehouse: { name: 'Central' },
    },
  ]);
  assert.match(fullMetrics, /Movimientos visibles/);
  assert.match(fullMetrics, /Entradas/);
  assert.match(fullMetrics, /Ajustes/);
});

// --- Movements renderWarehouseOptions ---

test('movements renderWarehouseOptions includes all-option and marks selected warehouse', () => {
  const rootShell = createMovementsHarness();
  const renderers = rootShell.require('views.movementsAdminRenderers');

  const optionsMarkup = renderers.renderWarehouseOptions([
    { id: '7', name: 'Central' },
    { id: '8', name: 'Secundaria' },
  ], '7');

  assert.match(optionsMarkup, /Todas/);
  assert.match(optionsMarkup, /Central/);
  assert.match(optionsMarkup, /selected/);
  assert.match(optionsMarkup, /Secundaria/);
  // 'Secundaria' (value 8) should appear without the selected attribute
  assert.match(optionsMarkup, /value="8" >/);
  assert.doesNotMatch(optionsMarkup, /value="8" selected/);
});

// --- Products renderPagination ---

test('products renderPagination returns empty string on single page and markup on multi-page', () => {
  const rootShell = createProductsHarness();
  const renderers = rootShell.require('views.productsAdminRenderers');

  const singlePage = renderers.renderPagination({ page: 1, totalPages: 1, totalItems: 5 });
  assert.equal(singlePage.trim(), '');

  const multiPage = renderers.renderPagination({ page: 2, totalPages: 4, totalItems: 40 });
  assert.match(multiPage, /Pagina 2 de 4/);
  assert.match(multiPage, /products-previous-page-button/);
  assert.match(multiPage, /products-next-page-button/);
});

test('products renderPagination disables previous on first page and next on last page', () => {
  const rootShell = createProductsHarness();
  const renderers = rootShell.require('views.productsAdminRenderers');

  const firstPage = renderers.renderPagination({ page: 1, totalPages: 3, totalItems: 30 });
  assert.match(firstPage, /products-previous-page-button.*disabled|disabled.*products-previous-page-button/s);

  const lastPage = renderers.renderPagination({ page: 3, totalPages: 3, totalItems: 30 });
  assert.match(lastPage, /products-next-page-button.*disabled|disabled.*products-next-page-button/s);
});

// --- Products renderCategoryOptions ---

test('products renderCategoryOptions renders optgroups per category and marks selected subcategory', () => {
  const rootShell = createProductsHarness();
  const renderers = rootShell.require('views.productsAdminRenderers');

  // New structure: categories with embedded subcategories
  const optionsMarkup = renderers.renderCategoryOptions([
    { id: 1, name: 'Producto Terminado', categoryType: 'PT', subcategories: [
      { id: 10, name: 'Shampoo' },
      { id: 11, name: 'Acondicionador' },
    ]},
    { id: 2, name: 'Materia Prima', categoryType: 'MP', subcategories: [] },
  ], '10');

  assert.match(optionsMarkup, /Todas/);
  assert.match(optionsMarkup, /Producto Terminado/);
  assert.match(optionsMarkup, /Shampoo/);
  assert.match(optionsMarkup, /selected/);
  assert.match(optionsMarkup, /Acondicionador/);
  assert.match(optionsMarkup, /Materia Prima/);
  // Categories with no subcategories show disabled optgroup
  assert.match(optionsMarkup, /sin subcategorias/);
});

// --- Warehouses getWarehouseTypeDefinition ---

test('warehouses getWarehouseTypeDefinition returns correct definition or undefined for unknown type', () => {
  const rootShell = createWarehousesHarness();
  const helpers = rootShell.require('views.warehousesAdminHelpers');

  const types = [
    { value: 'GENERAL', label: 'General', isVirtual: false, defaultSellableSource: false },
    { value: 'COURSES_VIRTUAL', label: 'Virtual', isVirtual: true, defaultSellableSource: false },
  ];

  const general = helpers.getWarehouseTypeDefinition(types, 'GENERAL');
  assert.ok(general, 'Definition should exist for GENERAL');
  assert.equal(general.isVirtual, false);
  assert.equal(general.label, 'General');

  const virtual = helpers.getWarehouseTypeDefinition(types, 'COURSES_VIRTUAL');
  assert.equal(virtual.isVirtual, true);

  // getWarehouseTypeDefinition falls back to the first type when not found.
  // With an empty types array, it returns null.
  const unknownInEmpty = helpers.getWarehouseTypeDefinition([], 'NONEXISTENT');
  assert.ok(!unknownInEmpty, 'Definition should be null/falsy when types array is empty');

  // With a non-empty array, fallback returns the first item (by design).
  const fallback = helpers.getWarehouseTypeDefinition(types, 'NONEXISTENT');
  assert.ok(fallback, 'With a non-empty types array, falls back to the first type definition');
  assert.equal(fallback.value, 'GENERAL');
});

// --- Movements: no movements returns empty table (renderMovementsTable safety) ---

test('movements renderMovementsTable returns empty string for empty items array', () => {
  const rootShell = createMovementsHarness();
  const renderers = rootShell.require('views.movementsAdminRenderers');

  const markup = renderers.renderMovementsTable([]);
  assert.equal(markup.trim(), '');
});

// --- Products: hasActiveFilters with categoryId only ---

test('products hasActiveFilters detects subcategoryId as active filter', () => {
  const rootShell = createProductsHarness();
  const helpers = rootShell.require('views.productsAdminHelpers');

  // The filter key is now subcategoryId (products are assigned to subcategories)
  assert.equal(helpers.hasActiveFilters({ searchTerm: '', subcategoryId: '' }), false);
  assert.equal(helpers.hasActiveFilters({ searchTerm: '', subcategoryId: '10' }), true);
  assert.equal(helpers.hasActiveFilters({ searchTerm: 'cafe', subcategoryId: '' }), true);
  assert.equal(helpers.hasActiveFilters({ searchTerm: 'cafe', subcategoryId: '10' }), true);
});

// --- Warehouses: filterWarehouses returns all with default (no-op) filters ---

test('warehouses filterWarehouses with default filters returns all items unchanged', () => {
  const rootShell = createWarehousesHarness();
  const helpers = rootShell.require('views.warehousesAdminHelpers');

  const items = [
    { id: 1, code: 'BOD-01', name: 'Central', warehouseType: 'GENERAL', isActive: true, isVirtual: false, isSellableSource: false },
    { id: 2, code: 'BOD-02', name: 'Virtual', warehouseType: 'COURSES_VIRTUAL', isActive: false, isVirtual: true, isSellableSource: false },
  ];

  const defaultFilters = helpers.createDefaultFilters();
  const visible = helpers.filterWarehouses(items, defaultFilters);
  assert.equal(visible.length, 2);
});

// --- Cross-view: XSS safety — escapeHtml applied in all renderer outputs ---

test('warehouses renderWarehousesTable escapes user-controlled content in output', () => {
  const rootShell = createWarehousesHarness();
  const renderers = rootShell.require('views.warehousesAdminRenderers');

  const tableMarkup = renderers.renderWarehousesTable([{
    code: '<script>alert(1)</script>',
    name: 'Bodega <b>peligrosa</b>',
    warehouseType: 'GENERAL',
    warehouseTypeLabel: 'General',
    warehouseTypeDescription: 'Tipo',
    isVirtual: false,
    isSellableSource: false,
    isActive: true,
    updatedAt: '2026-08-05T00:00:00.000Z',
  }]);

  assert.doesNotMatch(tableMarkup, /<script>/);
  assert.doesNotMatch(tableMarkup, /<b>/);
  assert.match(tableMarkup, /&lt;script&gt;/);
});

test('movements renderMovementsTable escapes product name and warehouse in output', () => {
  const rootShell = createMovementsHarness();
  const renderers = rootShell.require('views.movementsAdminRenderers');

  const tableMarkup = renderers.renderMovementsTable([{
    id: 1,
    createdAt: '2026-08-05T10:00:00.000Z',
    movementType: 'IN',
    quantity: '5',
    quantityBefore: '0',
    quantityAfter: '5',
    reasonCode: 'ENTRY',
    sourceType: 'manual',
    sourceId: '1',
    movementGroupId: 'g1',
    product: { name: '<script>xss</script>', code: 'PT-01' },
    warehouse: { name: 'Central' },
    lot: null,
    user: { username: 'admin' },
  }]);

  assert.doesNotMatch(tableMarkup, /<script>/);
  assert.match(tableMarkup, /&lt;script&gt;/);
});

test('lots renderLotsTable escapes lot code and product name in output', () => {
  const { browserWindow, context } = createBaseContext();
  executeRootScript('views/lots-admin.helpers.js', context);
  executeRootScript('views/lots-admin.renderers.js', context);
  const rootShell = browserWindow.RootShell;
  const renderers = rootShell.require('views.lotsAdminRenderers');

  const tableMarkup = renderers.renderLotsTable([{
    lotId: '10',
    lotCode: '<script>bad</script>',
    productName: 'Envase <em>500ml</em>',
    productCode: null,
    warehouseName: 'Central',
    quantity: 100,
    availableQuantity: 100,
    reservedQuantity: 0,
    qaStatus: 'APPROVED',
    lotStatus: 'AVAILABLE',
    expirationDate: null,
    alertIds: [],
    sourceConfidence: 'verified',
  }]);

  assert.doesNotMatch(tableMarkup, /<script>/);
  assert.doesNotMatch(tableMarkup, /<em>/);
  assert.match(tableMarkup, /&lt;script&gt;/);
});
