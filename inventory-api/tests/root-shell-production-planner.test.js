/**
 * Root shell — Production Planner page.
 *
 * Contract-level tests to guarantee the new `/root/#produccion_planificador`
 * page is fully wired: manifest entry, router mapping, view registration,
 * API wrapper for POST /api/production/orders, and index.html script tag.
 *
 * Feature: production-planner (root)
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const rootPath = path.join(__dirname, '..', 'src', 'public', 'root');

function readRootFile(relative) {
  return fs.readFileSync(path.join(rootPath, relative), 'utf8');
}

// -----------------------------------------------------------------------
// Manifest wiring
// -----------------------------------------------------------------------

test('manifest.js declares productionPlannerItem with the expected route key and guard', () => {
  const source = readRootFile('manifest.js');
  assert.match(source, /const productionPlannerItem = createRouteItem\(/);
  assert.match(source, /routeKey: 'produccion_planificador'/);
  assert.match(source, /href: '\/root\/#produccion_planificador'/);
  assert.match(source, /Planificador de produccion/);
  // Must be visible to company admins
  assert.match(source, /productionPlannerItem[\s\S]{0,500}visibilityRule: guards\.isCompanyAdmin|visibilityRule: guards\.isCompanyAdmin[\s\S]{0,500}productionPlannerItem/);
});

test('manifest.js registers productionPlannerItem in the produccion-group sidebar', () => {
  const source = readRootFile('manifest.js');
  assert.match(source, /\{ type: 'item', \.\.\.productionPlannerItem \}/);
  // Also in the flat items array so the router can resolve it
  const itemsArrayMatches = source.match(/productionPlannerItem/g) || [];
  assert.ok(itemsArrayMatches.length >= 3, `productionPlannerItem must appear at least 3 times (declaration + items array + sidebar); found ${itemsArrayMatches.length}`);
});

// -----------------------------------------------------------------------
// Router mapping
// -----------------------------------------------------------------------

test('router.js maps produccion_planificador route to views.productionPlanner', () => {
  const source = readRootFile('router.js');
  assert.match(source, /rootShell\.require\('views\.productionPlanner'\)/);
  assert.match(source, /routeKey === 'produccion_planificador'/);
});

// -----------------------------------------------------------------------
// API wrapper
// -----------------------------------------------------------------------

test('production-admin-api.js exposes createProductionOrder wrapper', () => {
  const source = readRootFile('production-admin-api.js');
  assert.match(source, /createProductionOrder/);
  assert.match(source, /'\/api\/production\/orders'/);
  assert.match(source, /method: 'POST'/);
});

// -----------------------------------------------------------------------
// View file existence and shape
// -----------------------------------------------------------------------

test('views/production-planner.js exists and registers views.productionPlanner', () => {
  const filePath = path.join(rootPath, 'views', 'production-planner.js');
  assert.ok(fs.existsSync(filePath), 'views/production-planner.js must exist');
  const source = fs.readFileSync(filePath, 'utf8');
  assert.match(source, /rootShell\.register\('views\.productionPlanner'/);
  assert.match(source, /function render\(/);
  assert.match(source, /async function mount\(/);
});

test('views/production-planner.js consumes required root APIs', () => {
  const source = fs.readFileSync(path.join(rootPath, 'views', 'production-planner.js'), 'utf8');
  // Data sources for products with recipe, stock, dropdowns
  assert.match(source, /rootShell\.require\('productsApi'\)/);
  assert.match(source, /rootShell\.require\('productionAdminApi'\)/);
  assert.match(source, /rootShell\.require\('warehousesApi'\)/);
  assert.match(source, /rootShell\.require\('usersApi'\)/);
  assert.match(source, /rootShell\.require\('recipesApi'\)/);
});

test('views/production-planner.js filters products by recipeId and shows min/max/qty', () => {
  const source = fs.readFileSync(path.join(rootPath, 'views', 'production-planner.js'), 'utf8');
  // Must reference the fields we care about
  assert.match(source, /recipeId/);
  assert.match(source, /minStock/);
  assert.match(source, /maxStock/);
  assert.match(source, /quantity/);
});

test('views/production-planner.js includes a dialog to generate a production order', () => {
  const source = fs.readFileSync(path.join(rootPath, 'views', 'production-planner.js'), 'utf8');
  // Every required field of createProductionOrderSchema must appear in the form payload
  const required = [
    'productId', 'recipeVersionId', 'quantity',
    'originWarehouseId', 'destinationWarehouseId',
    'responsibleUserId', 'productionLotCode',
  ];
  for (const field of required) {
    assert.match(source, new RegExp(field), `payload must include ${field}`);
  }
  assert.match(source, /createProductionOrder/);
});

// -----------------------------------------------------------------------
// Ingredient availability preview
// -----------------------------------------------------------------------

test('views/production-planner.js has renderIngredientAvailability and productStockMap (availability feature)', () => {
  const source = fs.readFileSync(path.join(rootPath, 'views', 'production-planner.js'), 'utf8');
  assert.match(source, /function renderIngredientAvailability/, 'must declare renderIngredientAvailability');
  assert.match(source, /productStockMap/, 'must use productStockMap for stock lookups');
  assert.match(source, /planner-ingredients-preview/, 'dialog must include #planner-ingredients-preview container');
  assert.match(source, /currentQtyListener/, 'dialogState must track currentQtyListener to avoid duplicate listeners');
  assert.match(source, /updatePreview/, 'must call updatePreview to refresh availability on qty change');
});

test('views/production-planner.js ingredient availability uses correct formula (ingredient.quantity * qty)', () => {
  const source = fs.readFileSync(path.join(rootPath, 'views', 'production-planner.js'), 'utf8');
  assert.match(
    source,
    /Number\(ing\.quantity\)\s*\*\s*qty/,
    'required quantity must be Number(ing.quantity) * qty (per-unit from recipe)',
  );
  // Must listen to qty input changes for live update
  assert.match(source, /qtyInput.*addEventListener.*input/, 'must listen to quantity input events');
  // Preview must have aria-live for accessibility
  assert.match(source, /aria-live/, 'preview panel must declare aria-live');
});

test('views/production-planner.js loadPlannerData returns productStockMap alongside rows', () => {
  const source = fs.readFileSync(path.join(rootPath, 'views', 'production-planner.js'), 'utf8');
  assert.match(source, /return \{ rows, productStockMap \}/, 'loadPlannerData must return { rows, productStockMap }');
  assert.match(source, /result\.productStockMap/, 'mount must read productStockMap from loadPlannerData result');
});

test('views/production-planner.js caches approvedVersions array (not just a single versionId)', () => {
  const source = fs.readFileSync(path.join(rootPath, 'views', 'production-planner.js'), 'utf8');
  assert.match(source, /approvedVersions/, 'cache must store approvedVersions array');
  assert.match(source, /defaultVersionId/, 'cache must store defaultVersionId for pre-selection');
});

test('views/production-planner.js dialog has a version <select> so users can pick any approved version', () => {
  const source = fs.readFileSync(path.join(rootPath, 'views', 'production-planner.js'), 'utf8');
  assert.match(source, /planner-field-recipe-version/, 'dialog must have #planner-field-recipe-version select');
  assert.match(source, /planner-version-field/, 'dialog must have #planner-version-field label wrapper');
});

test('views/production-planner.js collectDialogPayload reads recipeVersionId from version select', () => {
  const source = fs.readFileSync(path.join(rootPath, 'views', 'production-planner.js'), 'utf8');
  assert.match(
    source,
    /value\('#planner-field-recipe-version'\)/,
    'collectDialogPayload must read recipeVersionId from the select element',
  );
});

// -----------------------------------------------------------------------
// index.html script tag
// -----------------------------------------------------------------------

test('root/index.html loads views/production-planner.js before router.js', () => {
  const html = readRootFile('index.html');
  assert.match(html, /<script src="\/root\/views\/production-planner\.js"><\/script>/);
  const idx = html.indexOf('/root/views/production-planner.js');
  const routerIdx = html.indexOf('/root/router.js');
  assert.ok(idx > 0 && routerIdx > 0 && idx < routerIdx, 'production-planner.js must load before router.js');
});

// -----------------------------------------------------------------------
// Regression: the shell bootstrap must not crash if this view is loaded
// before its API dependencies. The IIFE MUST NOT call rootShell.require()
// for sibling APIs at the top level; those calls must happen lazily inside
// mount() (or a helper invoked from mount()).
// -----------------------------------------------------------------------

// -----------------------------------------------------------------------
// TASK-006: kg preview in the planner dialog
// -----------------------------------------------------------------------

test('views/production-planner.js has deriveKgPerUnitClient for kg preview (TASK-006)', () => {
  const source = fs.readFileSync(path.join(rootPath, 'views', 'production-planner.js'), 'utf8');
  assert.match(source, /function deriveKgPerUnitClient/, 'must declare deriveKgPerUnitClient');
  // Must handle all four presentation types
  assert.match(source, /'VOLUME'/, 'must handle VOLUME presentation');
  assert.match(source, /'MASS'/, 'must handle MASS presentation');
  assert.match(source, /'LENGTH'/, 'must handle LENGTH presentation');
  assert.match(source, /'COUNT'/, 'must handle COUNT presentation');
  // Backward-compatible fallback
  assert.match(source, /kgConversionFactor != null/, 'must fall back to kgConversionFactor for legacy products');
});

test('views/production-planner.js dialog has #planner-kg-preview element for estimated kg display (TASK-006)', () => {
  const source = fs.readFileSync(path.join(rootPath, 'views', 'production-planner.js'), 'utf8');
  assert.match(source, /planner-kg-preview/, 'dialog must include #planner-kg-preview element');
  assert.match(source, /planner-kg-preview-value/, 'dialog must include #planner-kg-preview-value for the numeric display');
  assert.match(source, /Kg planeados/, 'dialog must label the preview as "Kg planeados"');
  // Must be hidden when no presentationType is available
  assert.match(source, /style\.display.*none|style.*display.*none/,
    'preview must be hidden by default when kg cannot be derived');
});

test('views/production-planner.js productStockMap includes presentationType and density fields (TASK-006)', () => {
  const source = fs.readFileSync(path.join(rootPath, 'views', 'production-planner.js'), 'utf8');
  // The product data stored in productStockMap must carry the size metadata
  // so deriveKgPerUnitClient can compute the conversion without a second API call.
  assert.match(source, /presentationType: p\.presentationType/, 'productStockMap must store presentationType');
  assert.match(source, /netContent: toNum\(p\.netContent\)/, 'productStockMap must store netContent');
  assert.match(source, /netContentUnit: p\.netContentUnit/, 'productStockMap must store netContentUnit');
  assert.match(source, /kgConversionFactor: toNum\(p\.kgConversionFactor\)/, 'productStockMap must store kgConversionFactor');
});

test('views/production-planner.js resolves API deps lazily inside mount (no top-level require of sibling APIs)', () => {
  const source = fs.readFileSync(path.join(rootPath, 'views', 'production-planner.js'), 'utf8');

  // Grab everything before the first `async function mount(` — that's the top level.
  const mountIndex = source.indexOf('async function mount(');
  assert.ok(mountIndex > 0, 'mount() must exist');
  const topLevel = source.slice(0, mountIndex);

  // These sibling APIs are declared AFTER this file in index.html, so
  // requiring them at load-time crashes the shell bootstrap.
  const forbiddenAtTopLevel = [
    /rootShell\.require\(['"]usersApi['"]\)/,
    /rootShell\.require\(['"]productsApi['"]\)/,
    /rootShell\.require\(['"]recipesApi['"]\)/,
    /rootShell\.require\(['"]warehousesApi['"]\)/,
    /rootShell\.require\(['"]productionAdminApi['"]\)/,
  ];
  for (const pattern of forbiddenAtTopLevel) {
    // They MAY appear inside function bodies (below mount), but NOT before it.
    // If a match exists in `topLevel`, it means the require ran at IIFE load time.
    const topLevelDeclaration = topLevel.match(pattern);
    if (topLevelDeclaration) {
      // Allow if it's inside a `function` body declared before mount (e.g. resolveDeps()).
      // Detect this by counting braces from the match position back to the nearest `function`.
      // Simpler heuristic: require the match to be inside a `function ... {` scope.
      const matchIdx = topLevel.indexOf(topLevelDeclaration[0]);
      const preceding = topLevel.slice(0, matchIdx);
      const lastFunctionKeyword = preceding.lastIndexOf('function');
      assert.ok(lastFunctionKeyword > 0, `Top-level require detected: ${topLevelDeclaration[0]}. Move it inside mount() or a helper called from mount().`);
    }
  }
});
