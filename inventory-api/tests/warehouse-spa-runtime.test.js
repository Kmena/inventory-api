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

test('views/production.js shows explicit stub messaging for execute/inspect actions instead of silent no-op navigation', () => {
  const source = readWarehouseFile('views/production.js');
  assert.match(source, /ciclo posterior/);
  assert.match(source, /captura detallada de ejecucion por etapa/);
  assert.match(source, /captura guiada de inspeccion por etapa/);
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
