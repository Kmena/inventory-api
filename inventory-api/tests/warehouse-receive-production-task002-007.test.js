/**
 * Characterization tests for TASK-002 through TASK-007
 * warehouse-receive-production spec — purchase-orders-workspace
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const warehousePath = path.join(__dirname, '..', 'src', 'public', 'warehouse');

function readWarehouseFile(relPath) {
  return fs.readFileSync(path.join(warehousePath, relPath), 'utf8');
}

// ─────────────────────────────────────────────────────────────────
// TASK-002 — state.js permission flags
// ─────────────────────────────────────────────────────────────────

test('state.js derives canReceive from receipts.inspect (not warehouse.receive)', () => {
  const src = readWarehouseFile('state.js');
  assert.match(src, /canReceive.*receipts\.inspect/);
  assert.doesNotMatch(src, /canReceive.*warehouse\.receive/);
});

test('state.js exposes canExecuteProduction, canCompleteProduction, canViewProduction, canConfirm', () => {
  const src = readWarehouseFile('state.js');
  assert.match(src, /canExecuteProduction/);
  assert.match(src, /canCompleteProduction/);
  assert.match(src, /canViewProduction/);
  assert.match(src, /canConfirm/);
});

test('state.js derives canExecuteProduction from production.execute', () => {
  const src = readWarehouseFile('state.js');
  assert.match(src, /canExecuteProduction.*production\.execute/);
});

test('state.js derives canCompleteProduction from production.complete', () => {
  const src = readWarehouseFile('state.js');
  assert.match(src, /canCompleteProduction.*production\.complete/);
});

// ─────────────────────────────────────────────────────────────────
// TASK-002 — app.js tab permission fixes
// ─────────────────────────────────────────────────────────────────

test('app.js Recepciones tab uses receipts.inspect not warehouse.receive', () => {
  const src = readWarehouseFile('app.js');
  // The receipts tab must use receipts.inspect
  assert.match(src, /receipts\.inspect/);
});

test('app.js Production tab uses production.execute and production.view', () => {
  const src = readWarehouseFile('app.js');
  assert.match(src, /production\.execute/);
  assert.match(src, /production\.view/);
});

test('app.js includes receive-from-po in VIEW_MODULE_KEYS and VIEW_LABELS', () => {
  const src = readWarehouseFile('app.js');
  assert.match(src, /'receive-from-po'.*'views\.receiveFromPo'/);
  assert.match(src, /receive-from-po.*Nueva recepcion/);
});

test('app.js receive-from-po has TAB_DEFINITIONS entry with hidden:true and receipts.inspect guard', () => {
  // Security: routes not in TAB_DEFINITIONS bypass permission checks (resolveView !tabDef branch).
  // receive-from-po must have a hidden entry so the permission gate applies.
  const src = readWarehouseFile('app.js');
  // Entry must exist in TAB_DEFINITIONS with hidden: true
  assert.match(src, /view:\s*'receive-from-po'/);
  assert.match(src, /hidden:\s*true/);
  // The permission guard must use receipts.inspect (same as Recepciones tab)
  const rfpoBlock = src.slice(
    src.indexOf("view:       'receive-from-po'"),
    src.indexOf("view:       'production'"),
  );
  assert.match(rfpoBlock, /receipts\.inspect/);
});

test('app.js renderTabBar skips hidden tab entries so receive-from-po is never a visible tab', () => {
  const src = readWarehouseFile('app.js');
  // The renderTabBar function must check tab.hidden and skip when true
  assert.match(src, /tab\.hidden.*continue/);
});

// ─────────────────────────────────────────────────────────────────
// TASK-003 — warehouse-api.js new functions
// ─────────────────────────────────────────────────────────────────

test('warehouse-api.js exposes listPurchaseOrdersForReceipt pointing to correct endpoint', () => {
  const src = readWarehouseFile('api/warehouse-api.js');
  assert.match(src, /function listPurchaseOrdersForReceipt/);
  assert.match(src, /\/api\/receipts\/purchase-orders/);
});

test('warehouse-api.js exposes createReceipt as POST to /api/receipts', () => {
  const src = readWarehouseFile('api/warehouse-api.js');
  assert.match(src, /function createReceipt/);
  assert.match(src, /\/api\/receipts/);
  assert.match(src, /method.*POST/);
});

test('warehouse-api.js exposes listWarehouses', () => {
  const src = readWarehouseFile('api/warehouse-api.js');
  assert.match(src, /function listWarehouses/);
  assert.match(src, /\/api\/warehouses/);
});

test('warehouse-api.js exposes startProductionOrder as POST', () => {
  const src = readWarehouseFile('api/warehouse-api.js');
  assert.match(src, /function startProductionOrder/);
  assert.match(src, /\/api\/production\/orders\/\$\{orderId\}\/start/);
});

test('warehouse-api.js exposes completeProductionOrder as POST', () => {
  const src = readWarehouseFile('api/warehouse-api.js');
  assert.match(src, /function completeProductionOrder/);
  assert.match(src, /\/api\/production\/orders\/\$\{orderId\}\/complete/);
});

test('warehouse-api.js registers all 5 new functions in the module', () => {
  const src = readWarehouseFile('api/warehouse-api.js');
  assert.match(src, /listPurchaseOrdersForReceipt,/);
  assert.match(src, /createReceipt,/);
  assert.match(src, /listWarehouses,/);
  assert.match(src, /startProductionOrder,/);
  assert.match(src, /completeProductionOrder,/);
});

// ─────────────────────────────────────────────────────────────────
// TASK-004 — receive-from-po.js view
// ─────────────────────────────────────────────────────────────────

test('receive-from-po.js registers as views.receiveFromPo', () => {
  const src = readWarehouseFile('views/receive-from-po.js');
  assert.match(src, /WarehouseShell\.register\('views\.receiveFromPo'/);
});

test('receive-from-po.js has two-phase structure: po-selection and form', () => {
  const src = readWarehouseFile('views/receive-from-po.js');
  assert.match(src, /rfpo-po-phase/);
  assert.match(src, /rfpo-form-phase/);
  assert.match(src, /renderPoSelectionPhase/);
  assert.match(src, /renderFormPhase/);
});

test('receive-from-po.js calls listPurchaseOrdersForReceipt', () => {
  const src = readWarehouseFile('views/receive-from-po.js');
  assert.match(src, /listPurchaseOrdersForReceipt/);
});

test('receive-from-po.js calls createReceipt and navigates to receipts on success', () => {
  const src = readWarehouseFile('views/receive-from-po.js');
  assert.match(src, /createReceipt/);
  assert.match(src, /navigate\('receipts'\)/);
});

test('receive-from-po.js calls listWarehouses and disables select during loading', () => {
  const src = readWarehouseFile('views/receive-from-po.js');
  assert.match(src, /listWarehouses/);
  assert.match(src, /warehouseSelectEl\.disabled/);
});

test('receive-from-po.js validates quantity sum before submit', () => {
  const src = readWarehouseFile('views/receive-from-po.js');
  assert.match(src, /validateForm/);
  // Uses item.quantity (the actual PurchaseOrderItem field from Prisma schema)
  assert.match(src, /recv \+ rej > item\.quantity/);
});

test('receive-from-po.js disables submit button and shows Creando... during submission', () => {
  const src = readWarehouseFile('views/receive-from-po.js');
  assert.match(src, /submitBtn\.disabled = true/);
  assert.match(src, /Creando\.\.\./);
});

test('receive-from-po.js has navigation back to receipts', () => {
  const src = readWarehouseFile('views/receive-from-po.js');
  assert.match(src, /wh-back-btn/);
  assert.match(src, /navigate\('receipts'\)/);
});

test('receive-from-po.js has WCAG attributes: role, aria-live, aria-required', () => {
  const src = readWarehouseFile('views/receive-from-po.js');
  assert.match(src, /role="status"/);
  assert.match(src, /aria-live="polite"/);
  assert.match(src, /aria-required="true"/);
  assert.match(src, /role="alert"/);
});

test('receive-from-po.js escapes user-controlled content', () => {
  const src = readWarehouseFile('views/receive-from-po.js');
  assert.match(src, /escapeHtml/);
  // Supplier name and OC id go through escapeHtml
  assert.match(src, /escapeHtml\(.*supplier/);
});

test('receive-from-po.js builds payload with purchaseOrderId, supplierId, warehouseId', () => {
  const src = readWarehouseFile('views/receive-from-po.js');
  assert.match(src, /purchaseOrderId/);
  assert.match(src, /supplierId/);
  assert.match(src, /warehouseId/);
  assert.match(src, /receivedAt/);
});

// ─────────────────────────────────────────────────────────────────
// TASK-005 — receipts.js "Nueva desde OC" button
// ─────────────────────────────────────────────────────────────────

test('receipts.js adds Nueva desde OC button in renderReceiptList', () => {
  const src = readWarehouseFile('views/receipts.js');
  assert.match(src, /Nueva desde OC/);
  assert.match(src, /receipts-new-from-po-btn/);
});

test('receipts.js navigates to receive-from-po on button click', () => {
  const src = readWarehouseFile('views/receipts.js');
  assert.match(src, /navigate\('receive-from-po'\)/);
});

test('receipts.js shows Nueva desde OC button only when canReceive', () => {
  const src = readWarehouseFile('views/receipts.js');
  assert.match(src, /permissions\.canReceive/);
});

test('receipts.js calls derivePermissions from state module', () => {
  const src = readWarehouseFile('views/receipts.js');
  assert.match(src, /state\.derivePermissions/);
});

// ─────────────────────────────────────────────────────────────────
// TASK-006 — production.js real functionality
// ─────────────────────────────────────────────────────────────────

test('production.js start button conditioned on PENDING status and canExecuteProduction', () => {
  const src = readWarehouseFile('views/production.js');
  assert.match(src, /order\.status === 'PENDING' && permissions\.canExecuteProduction/);
  assert.match(src, /startProductionOrder/);
});

test('production.js execute stage form is inline (not navigation-only)', () => {
  const src = readWarehouseFile('views/production.js');
  assert.match(src, /wh-execute-stage-btn/);
  // The form element's hidden attribute is set to false to show the inline form
  assert.match(src, /hidden = false/);
  assert.match(src, /exec-form/);
});

test('production.js complete section conditioned on canCompleteProduction and allStagesCompleted', () => {
  const src = readWarehouseFile('views/production.js');
  assert.match(src, /canCompleteProduction/);
  assert.match(src, /allStagesCompleted/);
  assert.match(src, /stages\.every/);
});

test('production.js stage badges use STAGE_STATUS_BADGE map', () => {
  const src = readWarehouseFile('views/production.js');
  assert.match(src, /STAGE_STATUS_BADGE/);
  assert.match(src, /STAGE_STATUS_LABELS/);
  assert.match(src, /renderStageBadge/);
});

test('production.js complete order button is disabled during submission', () => {
  const src = readWarehouseFile('views/production.js');
  assert.match(src, /completeBtn\.disabled = true/);
  assert.match(src, /Completando\.\.\./);
});

test('production.js warning alert before complete order action', () => {
  const src = readWarehouseFile('views/production.js');
  assert.match(src, /wh-alert--warning/);
  assert.match(src, /no puede revertirse/);
});

test('production.js start button disabled during API call', () => {
  const src = readWarehouseFile('views/production.js');
  assert.match(src, /startBtn\.disabled = true/);
  assert.match(src, /Iniciando\.\.\./);
});

test('production.js execute stage validates quantityProcessed > 0 before submit', () => {
  const src = readWarehouseFile('views/production.js');
  assert.match(src, /qty < 1/);
  assert.match(src, /cantidad procesada debe ser mayor/);
});

// ─────────────────────────────────────────────────────────────────
// TASK-007 — index.html script inclusion
// ─────────────────────────────────────────────────────────────────

test('index.html includes receive-from-po.js before inspections.js', () => {
  const src = readWarehouseFile('index.html');
  const rfpoIdx = src.indexOf('receive-from-po.js');
  const inspIdx = src.indexOf('inspections.js');
  assert.ok(rfpoIdx > -1, 'receive-from-po.js must be in index.html');
  assert.ok(inspIdx > -1, 'inspections.js must be in index.html');
  assert.ok(rfpoIdx < inspIdx, 'receive-from-po.js must come before inspections.js');
});
