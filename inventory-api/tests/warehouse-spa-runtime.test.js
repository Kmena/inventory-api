const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicRoot = path.join(__dirname, '..', 'src', 'public');
const warehousePath = path.join(publicRoot, 'warehouse');
const appPath = path.join(__dirname, '..', 'src', 'app.js');
const loginPath = path.join(publicRoot, 'login.js');

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readWarehouseFile(relPath) {
  return fs.readFileSync(path.join(warehousePath, relPath), 'utf8');
}

// -----------------------------------------------------------------------
// File existence
// -----------------------------------------------------------------------

test('warehouse SPA directory and required files exist', () => {
  const requiredFiles = [
    'index.html',
    'app.js',
    'state.js',
    'captures.js',
    'bootstrap.js',
    'api/warehouse-api.js',
    'views/receipts.js',
    'views/receive-from-po.js',
    'views/inspections.js',
    'views/production.js',
    'views/recipe-consultation.js',
  ];

  for (const relPath of requiredFiles) {
    assert.ok(
      fs.existsSync(path.join(warehousePath, relPath)),
      `warehouse/${relPath} must exist`,
    );
  }
});

// -----------------------------------------------------------------------
// index.html structure (WCAG and UX contract)
// -----------------------------------------------------------------------

test('warehouse index.html has required DOM structure for WCAG and SPA bootstrapping', () => {
  const html = readWarehouseFile('index.html');

  // WCAG skip link
  assert.match(html, /class="skip-link"/);
  assert.match(html, /href="#warehouse-main"/);

  // Shell structure
  assert.match(html, /id="warehouse-header"/);
  assert.match(html, /id="warehouse-main"/);
  assert.match(html, /id="warehouse-view"/);
  assert.match(html, /id="warehouse-tab-bar"/);
  assert.match(html, /id="warehouse-toast-container"/);
  assert.match(html, /aria-live="assertive"/);
  assert.match(html, /aria-live="polite"/);

  // Scripts
  assert.match(html, /<script src="\/shared\/session\.js"><\/script>/);
  assert.match(html, /<script src="\/shared\/auth\.js"><\/script>/);
  assert.match(html, /<script src="app\.js"><\/script>/);
  assert.match(html, /<script src="captures\.js"><\/script>/);
  assert.match(html, /<script src="api\/warehouse-api\.js"><\/script>/);
  assert.match(html, /<script src="views\/receipts\.js"><\/script>/);
  assert.match(html, /<script src="views\/receive-from-po\.js"><\/script>/);
  assert.match(html, /<script src="views\/production\.js"><\/script>/);
  assert.match(html, /<script src="views\/recipe-consultation\.js"><\/script>/);
  assert.match(html, /<script src="bootstrap\.js"><\/script>/);
});

// -----------------------------------------------------------------------
// app.js — Shell registry
// -----------------------------------------------------------------------

test('warehouse app.js registers WarehouseShell namespace with register/require/has API', () => {
  const source = readWarehouseFile('app.js');
  assert.match(source, /WarehouseShell\.register/);
  assert.match(source, /WarehouseShell\.require/);
  assert.match(source, /WarehouseShell\.has/);
  assert.match(source, /window.*WarehouseShell/);
});

test('warehouse app.js validates warehouse.access permission before bootstrapping', () => {
  const source = readWarehouseFile('app.js');
  assert.match(source, /warehouse\.access/);
  assert.match(source, /NO_ACCESS_PATH/);
  assert.match(source, /\/no-access\.html/);
  assert.match(source, /bootstrapSession\(\)/);
  assert.doesNotMatch(source, /bootstrapSession\(inventorySession\)/);
});

// DEC-009 / AC-004 / AC-006 — warehouse bootstrap uses landing.target as primary
test('warehouse app.js uses session.user.landing.target === warehouse as primary bootstrap gate (DEC-009)', () => {
  const source = readWarehouseFile('app.js');
  // Must check landing.target explicitly as PRIMARY gate
  assert.match(source, /landing\.target\s*===\s*['"]warehouse['"]/);
  // Must export hasWarehouseShellAccess or equivalent named check function
  assert.match(source, /hasWarehouseShellAccess/);
  // Legacy fallback to warehouse.access only for sessions without landing
  assert.match(source, /warehouse\.access/);
  // Must NOT use permissions.includes('warehouse.access') as the SOLE/outer bootstrap gate
  // (the old single-line check — now replaced by hasWarehouseShellAccess)
  assert.doesNotMatch(source, /if\s*\(!permissions\.includes\(['"]warehouse\.access['"]\)\)/);
});

test('warehouse app.js blocks users whose landing.target is not warehouse (admin with root landing)', () => {
  const source = readWarehouseFile('app.js');
  // The guard function must return the result of comparing landing.target to 'warehouse'
  // when landing IS present — admin with landing.target='root' is blocked.
  assert.match(source, /return landing\.target\s*===\s*['"]warehouse['"]/);
  // When landing is absent (null or undefined), falls back to warehouse.access permission
  assert.match(source, /landing\s*!==\s*null\s*&&\s*landing\s*!==\s*undefined/);
  // Fallback to warehouse.access permission only when landing is absent
  assert.match(source, /permissions\.includes\(['"]warehouse\.access['"]\)/);
});

test('warehouse app.js hasWarehouseShellAccess rejects non-warehouse landing even with warehouse.access in permissions', () => {
  const source = readWarehouseFile('app.js');
  // Must export or define hasWarehouseShellAccess — documented as the named gate
  assert.match(source, /function hasWarehouseShellAccess\(session\)/);
  // Must call it in bootstrap
  assert.match(source, /hasWarehouseShellAccess\(session\)/);
});

test('warehouse app.js implements hash-based routing with permission guard', () => {
  const source = readWarehouseFile('app.js');
  assert.match(source, /parseHashRoute/);
  assert.match(source, /handleRoute/);
  assert.match(source, /navigate/);
  assert.match(source, /window\.location\.hash/);
  assert.match(source, /hashchange/);
});

test('warehouse app.js tab bar definitions include all approved navigation tabs', () => {
  const source = readWarehouseFile('app.js');
  assert.match(source, /'receipts'/);
  assert.match(source, /'production'/);
  assert.match(source, /'recipe-consultation'/);
  assert.match(source, /'inventory'/);
  assert.match(source, /warehouse\.receive/);
  assert.match(source, /quality\.inspect/);
});

// -----------------------------------------------------------------------
// captures.js — Device capability detection
// -----------------------------------------------------------------------

test('captures.js exposes Capabilities, createScanInput and createPhotoCapture', () => {
  const source = readWarehouseFile('captures.js');
  assert.match(source, /Capabilities/);
  assert.match(source, /supportsCamera/);
  assert.match(source, /createScanInput/);
  assert.match(source, /createPhotoCapture/);
  assert.match(source, /WarehouseShell\.register\('captures'/);
});

test('captures.js uses capture="environment" for camera input (FR-037)', () => {
  const source = readWarehouseFile('captures.js');
  assert.match(source, /capture.*environment/);
});

test('captures.js handles manual fallback when BarcodeDetector is unavailable', () => {
  const source = readWarehouseFile('captures.js');
  assert.match(source, /supportsBarcodeDetector/);
  // Falls back to manual focus when BarcodeDetector not present
  assert.match(source, /inputEl\.focus\(\)/);
});

test('captures.js revokes ObjectURLs to prevent memory leaks', () => {
  const source = readWarehouseFile('captures.js');
  assert.match(source, /URL\.revokeObjectURL/);
  assert.match(source, /destroy/);
});

// -----------------------------------------------------------------------
// Recipe consultation — read-only enforcement (FR-038)
// -----------------------------------------------------------------------

// Production module now split into state/renderers/controllers/exec-helpers + orchestrator.
// Tests read from combined source to stay refactor-resilient.
function readProductionModules() {
  const files = [
    'views/production.state.js',
    'views/production.renderers.js',
    'views/production.exec-helpers.js',
    'views/production.controllers.js',
    'views/production.js',
  ];
  return files.map((f) => {
    const p = path.join(warehousePath, f);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  }).join('\n');
}

test('production modules expose real execute and complete functionality', () => {
  const source = readProductionModules();
  // Real execution form elements
  assert.match(source, /Ejecutar etapa/);
  assert.match(source, /Completar etapa/);
  assert.match(source, /executeProductionStage/);
  assert.match(source, /actualParameters/);
  assert.match(source, /overrideJustification/);
  assert.match(source, /QA de etapa/);
  assert.match(source, /Dentro de rango|Fuera de rango/);
  // Real completion form
  assert.match(source, /producedQuantity/);
  assert.match(source, /completeProductionOrder/);
  assert.match(source, /Completar orden/);
  // Real start production button (APPROVED status, not PENDING — see state machine)
  assert.match(source, /startProductionOrder/);
  assert.match(source, /Iniciar produccion/);
  assert.match(source, /status === 'APPROVED'/);
  // Stage badges in renderers
  assert.match(source, /STAGE_STATUS_BADGE/);
  assert.match(source, /renderStageBadge/);
  // Inline forms for accessibility
  assert.match(source, /aria-expanded/);
  assert.match(source, /aria-controls/);
});

test('production modules keep blocked-stage and waiting-QA messaging explicit', () => {
  const source = readProductionModules();
  assert.match(source, /Complete la etapa anterior primero/);
  assert.match(source, /fuera de tolerancia/i);
  assert.match(source, /QA debe aprobar/i);
});

test('warehouse QA rejection flow renders inline disposition and continuation controls, replacing the primary legacy losses CTA', () => {
  const renderersSource = readWarehouseFile('views/production.renderers.js');
  const rejectionSource = readWarehouseFile('views/production.renderers.rejection.js');
  const helpersSource = readWarehouseFile('views/production.exec-helpers.js');

  assert.match(rejectionSource, /Gestión del rechazo/i);
  assert.match(rejectionSource, /Disposición de material/i);
  assert.match(rejectionSource, /Punto de continuación/i);
  assert.match(rejectionSource, /Volver a una etapa previa/i);
  assert.match(rejectionSource, /qa-invalidated-stage-card/);
  assert.match(helpersSource, /continuationPoint/);
  assert.match(helpersSource, /invalidatedStagesDispositions/);
  assert.doesNotMatch(renderersSource, /wh-declare-losses-btn/);
});

test('production detail inserts the virtual recolection stage and uses the dedicated submit button path', () => {
  const renderersSource = readWarehouseFile('views/production.renderers.js');
  const controllersSource = readWarehouseFile('views/production.controllers.js');

  assert.match(renderersSource, /buildRecolectionStageViewModel/);
  assert.match(renderersSource, /renderRecolectionStageItem/);
  assert.match(renderersSource, /wh-confirm-recolection-submit-btn/);
  assert.doesNotMatch(renderersSource, /wh-confirm-recolection-btn/);
  assert.match(controllersSource, /wh-confirm-recolection-submit-btn/);
});

test('views/recipe-consultation.js renders frozen recipe as read-only (FR-038)', () => {
  const source = readWarehouseFile('views/recipe-consultation.js');
  assert.match(source, /solo lectura/i);
  assert.match(source, /Receta congelada/i);
  assert.match(source, /frozenRecipeSnapshot/);
  // No edit action buttons (form inputs, edit buttons — only informational text allowed)
  assert.doesNotMatch(source, /<input[^>]*type="text"[^>]*(?:edit|edicion)/i);
  assert.doesNotMatch(source, /warehouseApi\.(?:updateRecipe|approveRecipe|createRecipeVersion)/i);
  assert.doesNotMatch(source, /POST.*api.*recipes.*\$\{.*\}.*approve/i);
});

test('views/recipe-consultation.js implements accordion for stages', () => {
  const source = readWarehouseFile('views/recipe-consultation.js');
  assert.match(source, /aria-expanded/);
  assert.match(source, /aria-controls/);
  assert.match(source, /attachAccordionBehavior/);
});

// -----------------------------------------------------------------------
// Receipt confirmation workflow
// -----------------------------------------------------------------------

test('views/receipts.js implements 4-step workflow ending with confirmReceipt', () => {
  const source = readWarehouseFile('views/receipts.js');
  assert.match(source, /renderStepArrival/);
  assert.match(source, /renderStepInspection/);
  assert.match(source, /renderStepEvidence/);
  assert.match(source, /renderStepConfirm/);
  assert.match(source, /confirmReceipt/);
});

test('views/receipts.js disables confirm button during submission (no double-submit)', () => {
  const source = readWarehouseFile('views/receipts.js');
  assert.match(source, /confirmBtn\.disabled = true/);
  assert.match(source, /Confirmando\.\.\./);
});

test('views/receipts.js documents that photo evidence remains local-only in this cycle', () => {
  const source = readWarehouseFile('views/receipts.js');
  assert.match(source, /aun no se cargan al servidor/);
});

// -----------------------------------------------------------------------
// Step 2 — Inspection form (interactive)
// -----------------------------------------------------------------------

test('views/receipts.js Step 2 renders an interactive inspection form for pending items', () => {
  const source = readWarehouseFile('views/receipts.js');
  // Inputs per item
  assert.match(source, /inspect-qty-accepted-/);
  assert.match(source, /inspect-qty-rejected-/);
  assert.match(source, /inspect-result-/);
  assert.match(source, /inspect-observations-/);
  // Save button per item
  assert.match(source, /inspect-save-btn-/);
  // Three enum results in the select options
  assert.match(source, /value="ACCEPTED"/);
  assert.match(source, /value="PARTIALLY_ACCEPTED"/);
  assert.match(source, /value="REJECTED"/);
});

test('views/receipts.js Step 2 calls inspectReceiptItem with the expected payload shape', () => {
  const source = readWarehouseFile('views/receipts.js');
  assert.match(source, /api\.inspectReceiptItem\(/);
  // Payload must include the four required fields
  assert.match(source, /result:/);
  assert.match(source, /quantityAccepted:/);
  assert.match(source, /quantityRejected:/);
  assert.match(source, /observations:/);
});

test('views/receipts.js Step 2 shows already-inspected items as read-only', () => {
  const source = readWarehouseFile('views/receipts.js');
  // The renderer must branch on prior inspections
  assert.match(source, /item\.inspections/);
  // Read-only branch should not emit save buttons or inputs for those items
  assert.match(source, /hasInspection|isInspected|alreadyInspected/);
});

test('views/receipts.js Step 2 disables save button during submission (no double-submit)', () => {
  const source = readWarehouseFile('views/receipts.js');
  assert.match(source, /saveBtn\.disabled = true/);
  assert.match(source, /Guardando\.\.\./);
});

test('views/receipts.js Step 2 gates advancing to Evidence until every item has an inspection', () => {
  const source = readWarehouseFile('views/receipts.js');
  assert.match(source, /allInspected/);
});

test('views/receipts.js Step 4 derives product name and inspection result from serialized shape (not phantom fields)', () => {
  const source = readWarehouseFile('views/receipts.js');
  // Step 4 summary must not read the ghost fields that never existed in the API payload
  assert.doesNotMatch(source, /item\.acceptedQuantity/);
  assert.doesNotMatch(source, /item\.inspectionResult/);
  assert.doesNotMatch(source, /item\.productName \|\| item\.productId/);
});

// -----------------------------------------------------------------------
// Inventory view — product list + per-product detail (lots by warehouse)
// -----------------------------------------------------------------------

test('views/inventory.js file exists and registers the views.inventory module', () => {
  const inventoryPath = path.join(warehousePath, 'views', 'inventory.js');
  assert.ok(fs.existsSync(inventoryPath), 'views/inventory.js must exist');
  const source = fs.readFileSync(inventoryPath, 'utf8');
  assert.match(source, /WarehouseShell\.register\(\s*['"]views\.inventory['"]/);
  assert.match(source, /function render/);
});

test('warehouse index.html loads views/inventory.js before bootstrap.js', () => {
  const html = readWarehouseFile('index.html');
  assert.match(html, /<script src="views\/inventory\.js"><\/script>/);
  const inventoryIdx = html.indexOf('views/inventory.js');
  const bootstrapIdx = html.indexOf('bootstrap.js');
  assert.ok(inventoryIdx < bootstrapIdx, 'inventory.js must be declared before bootstrap.js');
});

test('warehouse app.js routes the inventory tab to the real views.inventory module (not the stub)', () => {
  const source = readWarehouseFile('app.js');
  assert.match(source, /'inventory'\s*:\s*'views\.inventory'/);
  assert.doesNotMatch(source, /views\.inventoryStub/);
});

test('warehouse recipe-consultation.js no longer registers the obsolete inventory stub (YAGNI cleanup)', () => {
  const source = readWarehouseFile('views/recipe-consultation.js');
  assert.doesNotMatch(source, /views\.inventoryStub/);
});

test('warehouse-api.js exposes listInventoryStocks that hits /api/inventory/stocks', () => {
  const source = readWarehouseFile('api/warehouse-api.js');
  assert.match(source, /listInventoryStocks/);
  assert.match(source, /\/api\/inventory\/stocks/);
});

test('views/inventory.js renders a product table with name, code and total quantity columns', () => {
  const source = readWarehouseFile('views/inventory.js');
  // Table structure
  assert.match(source, /<table/);
  assert.match(source, /<th[^>]*>[^<]*Nombre/i);
  assert.match(source, /<th[^>]*>[^<]*(Codigo|Código|C[oó]digo)/i);
  assert.match(source, /<th[^>]*>[^<]*Cantidad/i);
});

test('views/inventory.js aggregates warehouse stocks by product for the total quantity column', () => {
  const source = readWarehouseFile('views/inventory.js');
  // Must reduce/sum across warehouses per product
  assert.match(source, /productId/);
  assert.match(source, /(reduce|Map|forEach)/);
});

test('views/inventory.js supports a product-detail sub-view when params.productId is provided', () => {
  const source = readWarehouseFile('views/inventory.js');
  assert.match(source, /params\.productId|params\?\.productId/);
  // Detail must show lots grouped by warehouse
  assert.match(source, /lots/);
  assert.match(source, /warehouse/i);
});

test('views/inventory.js escapes user-facing strings (no XSS via product name/code)', () => {
  const source = readWarehouseFile('views/inventory.js');
  assert.match(source, /escapeHtml|WarehouseShell\.require\(['"]app['"]\)/);
});

// -----------------------------------------------------------------------
// Production & Recipe views — must read serialized shape (product?.name)
// -----------------------------------------------------------------------

test('views/production.js reads order.product?.name (no phantom productName field)', () => {
  const source = readWarehouseFile('views/production.js');
  assert.doesNotMatch(source, /order\.productName/);
});

test('views/recipe-consultation.js reads product?.name for ingredients and order (no phantom fields)', () => {
  const source = readWarehouseFile('views/recipe-consultation.js');
  assert.doesNotMatch(source, /ing\.productName/);
  assert.doesNotMatch(source, /order\.productName/);
});

// -----------------------------------------------------------------------
// Production creation — new order form in #production?action=new
// -----------------------------------------------------------------------

test('views/production-new.js file exists and registers views.productionNew module', () => {
  const p = path.join(warehousePath, 'views', 'production-new.js');
  assert.ok(fs.existsSync(p), 'views/production-new.js must exist');
  const source = fs.readFileSync(p, 'utf8');
  assert.match(source, /WarehouseShell\.register\(\s*['"]views\.productionNew['"]/);
  assert.match(source, /function render/);
});

test('warehouse index.html loads views/production-new.js before bootstrap.js', () => {
  const html = readWarehouseFile('index.html');
  assert.match(html, /<script src="views\/production-new\.js"><\/script>/);
  const idx = html.indexOf('views/production-new.js');
  const boot = html.indexOf('bootstrap.js');
  assert.ok(idx < boot, 'production-new.js must load before bootstrap.js');
});

test('warehouse-api.js exposes createProductionOrder + listRecipes + listProducts + listCompanyUsers', () => {
  const source = readWarehouseFile('api/warehouse-api.js');
  assert.match(source, /createProductionOrder/);
  assert.match(source, /listRecipes/);
  assert.match(source, /listProducts/);
  assert.match(source, /listCompanyUsers/);
  // Endpoints
  assert.match(source, /\/api\/production\/orders/);
  assert.match(source, /\/api\/recipes/);
  assert.match(source, /\/api\/products/);
  assert.match(source, /\/api\/users\/company/);
});

test('state.js derives canCreateProduction flag from production.create permission', () => {
  const source = readWarehouseFile('state.js');
  assert.match(source, /canCreateProduction/);
  assert.match(source, /production\.create/);
});

test('views/production.js delegates to views.productionNew when params.action === new', () => {
  const source = readWarehouseFile('views/production.js');
  assert.match(source, /params\.action\s*===\s*['"]new['"]/);
  assert.match(source, /views\.productionNew/);
});

test('views/production.js exposes "Nueva orden" CTA gated by canCreateProduction', () => {
  const source = readWarehouseFile('views/production.js');
  assert.match(source, /canCreateProduction/);
  assert.match(source, /Nueva orden/i);
});

test('views/production-new.js includes all required createProductionOrderSchema fields', () => {
  const source = readWarehouseFile('views/production-new.js');
  // Required per production.schema.js
  const required = [
    'productId', 'recipeVersionId', 'quantity',
    'originWarehouseId', 'destinationWarehouseId',
    'responsibleUserId', 'productionLotCode',
  ];
  for (const field of required) {
    assert.match(source, new RegExp(field), `payload must include ${field}`);
  }
  // Must POST via the wrapper
  assert.match(source, /createProductionOrder/);
});

test('views/production-new.js validates origin != destination warehouse before submit', () => {
  const source = readWarehouseFile('views/production-new.js');
  assert.match(source, /originWarehouseId/);
  assert.match(source, /destinationWarehouseId/);
  // some form of client-side comparison
  assert.match(source, /(origin.*===\s*destination|origin.*==\s*destination|distinta)/i);
});

// -----------------------------------------------------------------------
// API wrapper boundary
// -----------------------------------------------------------------------

test('api/warehouse-api.js uses InventoryAuth.fetchJson and not hardcoded credentials', () => {
  const source = readWarehouseFile('api/warehouse-api.js');
  assert.match(source, /inventoryAuth\.fetchJson/);
  assert.doesNotMatch(source, /Authorization.*Bearer/);
  assert.doesNotMatch(source, /localStorage\.getItem/);
});

test('api/warehouse-api.js exposes confirmReceipt endpoint', () => {
  const source = readWarehouseFile('api/warehouse-api.js');
  assert.match(source, /confirmReceipt/);
  assert.match(source, /\/api\/receipts\/\$\{id\}\/confirm/);
});

test('api/warehouse-api.js exposes getMaterialRequirements on the approved production endpoint', () => {
  const source = readWarehouseFile('api/warehouse-api.js');
  assert.match(source, /function getMaterialRequirements\(session, orderId\)/);
  assert.match(source, /\/api\/production\/orders\/\$\{orderId\}\/material-requirements/);
  assert.match(source, /WarehouseShell\.register\([\s\S]*getMaterialRequirements/);
});

test('api/warehouse-api.js exposes getAvailableLotsForStage on the approved production endpoint', () => {
  const source = readWarehouseFile('api/warehouse-api.js');
  assert.match(source, /function getAvailableLotsForStage\(session, orderId, stageId\)/);
  assert.match(source, /\/api\/production\/orders\/\$\{orderId\}\/stages\/\$\{stageId\}\/available-lots/);
  assert.match(source, /WarehouseShell\.register\([\s\S]*getAvailableLotsForStage/);
});

test('api/warehouse-api.js uses the approved receipt-inspection and production-QA routes', () => {
  const source = readWarehouseFile('api/warehouse-api.js');
  assert.match(source, /\/api\/receipts\/\$\{receiptId\}\/items\/\$\{itemId\}\/inspections/);
  assert.doesNotMatch(source, /\/api\/receipts\/\$\{receiptId\}\/items\/\$\{itemId\}\/inspect`/);
  assert.match(source, /function createProductionQAInspection\(session, orderId, stageId, payload\)/);
  assert.match(source, /\/api\/production\/orders\/\$\{orderId\}\/stages\/\$\{stageId\}\/inspections/);
  assert.doesNotMatch(source, /\/api\/production\/orders\/\$\{orderId\}\/inspections/);
});

// -----------------------------------------------------------------------
// Express app CSP
// -----------------------------------------------------------------------

test('Express app.js adds warehouse-specific CSP policy allowing blob: for photo thumbnails', () => {
  const source = readFile(appPath);
  assert.match(source, /pathName\.startsWith\('\/warehouse\/'\)/);
  assert.match(source, /img-src.*blob:/);
  assert.match(source, /media-src.*blob:/);
  assert.match(source, /style-src 'self'/);
  assert.doesNotMatch(source, /pathName\.startsWith\('\/warehouse\/'\)[\s\S]{0,260}style-src 'self' 'unsafe-inline'/);
});

// -----------------------------------------------------------------------
// login.js redirect
// -----------------------------------------------------------------------

test('login.js redirects warehouse.access users to /warehouse/ (not migration path)', () => {
  const source = readFile(loginPath);
  assert.match(source, /warehouse\.access/);
  assert.match(source, /return '\/warehouse\/'/);
  assert.doesNotMatch(source, /warehouse\.access[\s\S]{0,100}POST_LOGIN_TRANSITION_PATH/);
});

// -----------------------------------------------------------------------
// CSS tokens
// -----------------------------------------------------------------------

test('styles.css includes warehouse SPA design tokens and layout classes', () => {
  const source = readFile(path.join(publicRoot, 'styles.css'));
  assert.match(source, /--wh-accent:/);
  assert.match(source, /--wh-pending:/);
  assert.match(source, /\.warehouse-shell/);
  assert.match(source, /\.warehouse-header/);
  assert.match(source, /\.warehouse-tab-bar/);
  assert.match(source, /\.warehouse-tab/);
  assert.match(source, /\.wh-badge/);
  assert.match(source, /\.wh-stepper/);
  assert.match(source, /\.scan-input-wrapper/);
  assert.match(source, /\.photo-capture-wrapper/);
  // Navigation rail for tablet
  assert.match(source, /@media \(min-width: 768px\)[\s\S]*\.warehouse-tab-bar/);
});

// ─── TASK-007: warehouseApi loss functions registered ──────────────────────

test("warehouseApi.registerStageLosses is registered in WarehouseShell (TASK-007)", () => {
  const warehouseApiPath = path.join(publicRoot, "warehouse/api/warehouse-api.js");
  const source = fs.readFileSync(warehouseApiPath, "utf8");
  assert.match(
    source,
    /registerStageLosses/,
    "warehouse-api.js must define and register registerStageLosses",
  );
  assert.match(
    source,
    /getStageLosses/,
    "warehouse-api.js must define and register getStageLosses",
  );
});

test("production.renderers.rejection.js is registered in WarehouseShell (TASK-007)", () => {
  const rejectionRenderersPath = path.join(publicRoot, "warehouse/views/production.renderers.rejection.js");
  const source = fs.readFileSync(rejectionRenderersPath, "utf8");
  assert.match(
    source,
    /renderStageLossForm/,
    "production.renderers.rejection.js must export renderStageLossForm",
  );
  assert.match(
    source,
    /renderPostLossActions/,
    "production.renderers.rejection.js must export renderPostLossActions",
  );
  assert.match(
    source,
    /views.productionRenderersRejection/,
    "production.renderers.rejection.js must register with WarehouseShell",
  );
});

test("production.controllers.rejection.js is registered in WarehouseShell (TASK-007)", () => {
  const rejectionControllersPath = path.join(publicRoot, "warehouse/views/production.controllers.rejection.js");
  const source = fs.readFileSync(rejectionControllersPath, "utf8");
  assert.match(
    source,
    /attachStageLossHandlers/,
    "production.controllers.rejection.js must export attachStageLossHandlers",
  );
  assert.match(
    source,
    /attachReExecuteHandler/,
    "production.controllers.rejection.js must export attachReExecuteHandler",
  );
  assert.match(
    source,
    /attachTerminateProductionHandler/,
    "production.controllers.rejection.js must export attachTerminateProductionHandler",
  );
  assert.match(
    source,
    /views.productionControllersRejection/,
    "production.controllers.rejection.js must register with WarehouseShell",
  );
});

test("production.state.js exposes findLatestRejectedExecution and QA_REJECTED sub-states (TASK-007)", () => {
  const statePath = path.join(publicRoot, "warehouse/views/production.state.js");
  const source = fs.readFileSync(statePath, "utf8");
  assert.match(source, /findLatestRejectedExecution/);
  assert.match(source, /QA_REJECTED_PENDING_LOSSES/);
  assert.match(source, /QA_REJECTED_LOSSES_DONE/);
});

test("state.js derivePermissions includes canManageProduction (TASK-007)", () => {
  const statePath = path.join(publicRoot, "warehouse/state.js");
  const source = fs.readFileSync(statePath, "utf8");
  assert.match(
    source,
    /canManageProduction.*production\.manage/,
    "state.js must expose canManageProduction from production.manage permission",
  );
});

test("production.renderers.js renderStageItem handles QA rejection sub-states without the primary legacy losses CTA (TASK-007)", () => {
  const renderersPath = path.join(publicRoot, "warehouse/views/production.renderers.js");
  const source = fs.readFileSync(renderersPath, "utf8");
  assert.match(
    source,
    /QA_REJECTED_PENDING_LOSSES/,
    "production.renderers.js must handle QA_REJECTED_PENDING_LOSSES state",
  );
  assert.match(
    source,
    /QA_REJECTED_LOSSES_DONE/,
    "production.renderers.js must handle QA_REJECTED_LOSSES_DONE state",
  );
  assert.doesNotMatch(
    source,
    /wh-declare-losses-btn/,
    "production.renderers.js must not render the primary legacy declare-losses button",
  );
});

test('production-new.js includes ingredient preview helpers', () => {
  const source = readWarehouseFile('views/production-new.js');
  assert.match(source, /function formatQty/, 'must have formatQty helper');
  assert.match(source, /function renderIngredientsPreview/, 'must have renderIngredientsPreview');
  assert.match(source, /function wireIngredientsPreview/, 'must have wireIngredientsPreview');
  assert.match(source, /pn-ingredients-preview/, 'must include the preview container id');
  assert.match(source, /wireIngredientsPreview\(container/, 'must call wireIngredientsPreview in render()');
  assert.match(source, /aria-live/, 'preview panel must declare aria-live for screen readers');
});

test('production-new.js renderIngredientsPreview uses correct quantity formula', () => {
  const source = readWarehouseFile('views/production-new.js');
  // Required = ingredient.quantity (per-unit from recipe) × user quantity
  assert.match(
    source,
    /Number\(ing\.quantity\)\s*\*\s*qty/,
    'required quantity must be Number(ing.quantity) * qty',
  );
  // Must react to both recipe-select changes and quantity-input changes
  assert.match(source, /recipeSelect\.addEventListener\('change'/, 'must listen to recipe change');
  assert.match(source, /qtyInput\.addEventListener\('input'/, 'must listen to quantity input');
});

test('production-new.js shows version <select> (not hidden input) so users can choose any approved version', () => {
  const source = readWarehouseFile('views/production-new.js');
  assert.match(source, /select id="pn-recipe-version-id"/, 'version field must be a <select>');
  assert.doesNotMatch(source, /input type="hidden" id="pn-recipe-version-id"/, 'must not use hidden input for version');
  assert.match(source, /pn-version-field/, 'must have #pn-version-field wrapper');
  assert.match(source, /status.*APPROVED|APPROVED.*status/, 'must filter by APPROVED status');
  assert.match(source, /latestApprovedVersionId/, 'must pre-select the active version');
});

test('production-new.js wireIngredientsPreview reacts to version select changes', () => {
  const source = readWarehouseFile('views/production-new.js');
  assert.match(source, /versionSelect.*addEventListener|addEventListener.*versionSelect/, 'must listen to version select changes');
  assert.match(source, /selectedVersionId/, 'must pass selectedVersionId to renderIngredientsPreview');
});

// Regression: buildStagesViewModel used `stageId` (undefined in scope) causing
// a ReferenceError that blanked #production?id=X (statusEl hidden before the throw).
test('production.state.js buildStagesViewModel declares stageId from stage.id before using it (blank-page fix)', () => {
  const source = readWarehouseFile('views/production.state.js');
  assert.match(
    source,
    /const stageId = String\(stage/,
    'buildStagesViewModel must declare stageId from stage.id inside the map callback',
  );
});

test('production.js catch block restores statusEl.hidden before showing error (blank-page fix)', () => {
  const source = readWarehouseFile('views/production.js');
  assert.match(
    source,
    /statusEl\.hidden\s*=\s*false/,
    'catch block must un-hide statusEl before writing the error text',
  );
});

test('production.renderers.rejection.js exports renderCancelWithReturnsPanel and aggregateOrderConsumptions', () => {
  const source = readWarehouseFile('views/production.renderers.rejection.js');
  assert.match(source, /renderCancelWithReturnsPanel/, 'must export renderCancelWithReturnsPanel');
  assert.match(source, /aggregateOrderConsumptions/, 'must export aggregateOrderConsumptions');
  assert.match(source, /wh-cancel-return-row/, 'panel must use wh-cancel-return-row class');
  assert.match(source, /wh-cancel-lot-mode/, 'panel must include lot-mode radios');
  assert.match(source, /wh-cancel-new-lot-fields/, 'panel must include new-lot fields block');
  assert.match(source, /wh-cancel-with-returns-btn/, 'panel must have confirm-with-returns button');
  assert.match(source, /wh-cancel-no-returns-btn/, 'panel must have cancel-without-returns button');
});

test('production.controllers.rejection.js wires cancel-with-returns flow', () => {
  const source = readWarehouseFile('views/production.controllers.rejection.js');
  assert.match(source, /attachCancelWithReturnsHandlers/, 'must export attachCancelWithReturnsHandlers');
  assert.match(source, /collectCancelPayload/, 'must export collectCancelPayload');
  assert.match(source, /cancelProductionOrder/, 'must call cancelProductionOrder with payload');
  assert.match(source, /targetLotId/, 'must support returning to original lot via targetLotId');
  assert.match(source, /newLotCode/, 'must support creating a new lot via newLotCode');
});

test('state.js includes canCancelProduction derived from production.cancel permission', () => {
  const source = fs.readFileSync(path.join(warehousePath, 'state.js'), 'utf8');
  assert.match(source, /canCancelProduction/, 'state must include canCancelProduction flag');
  assert.match(source, /production\.cancel/, 'canCancelProduction must check production.cancel permission');
});

test('production.renderers.js shows cancel button for all cancellable states guarded by canCancelProduction', () => {
  const source = readWarehouseFile('views/production.renderers.js');
  assert.match(source, /canCancelProduction/, 'renderer must gate cancel on canCancelProduction');
  assert.match(source, /wh-terminate-production-btn/, 'renderer must render wh-terminate-production-btn');
});

test('warehouse-api.js cancelProductionOrder forwards payload with returns to backend', () => {
  const source = fs.readFileSync(path.join(warehousePath, 'api', 'warehouse-api.js'), 'utf8');
  assert.match(source, /function cancelProductionOrder/, 'must define cancelProductionOrder');
  assert.match(source, /JSON\.stringify\(payload\)/, 'must stringify payload including returns');
});
