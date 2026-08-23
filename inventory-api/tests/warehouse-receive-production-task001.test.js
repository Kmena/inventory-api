const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ─────────────────────────────────────────────────────────────────
// TASK-001 — Verification: backend endpoint + cross-role perms
// ─────────────────────────────────────────────────────────────────

test('receipt.routes.js defines GET /purchase-orders BEFORE GET /:id', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'routes', 'receipt.routes.js'),
    'utf8',
  );
  const poIndex = src.indexOf("'/purchase-orders'");
  const idIndex = src.indexOf("'/:id'");
  assert.ok(poIndex > -1, "GET '/purchase-orders' route must be declared");
  assert.ok(idIndex > -1, "GET '/:id' route must be declared");
  assert.ok(
    poIndex < idIndex,
    `GET '/purchase-orders' (pos ${poIndex}) must come BEFORE GET '/:id' (pos ${idIndex})`,
  );
});

test('receipt.service.js exports listPurchaseOrdersForReceipt', () => {
  const service = require('../src/services/receipt.service');
  assert.equal(typeof service.listPurchaseOrdersForReceipt, 'function');
});

test('receipt.repository.js exports listPurchaseOrdersForReceipt', () => {
  const repo = require('../src/repositories/receipt.repository');
  assert.equal(typeof repo.listPurchaseOrdersForReceipt, 'function');
});

test('receipt.repository.js listPurchaseOrdersForReceipt filters by status ISSUED', () => {
  // Verify the implementation restricts to ISSUED orders only
  // (DRAFT = not finalized, CANCELLED = closed)
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'repositories', 'receipt.repository.js'),
    'utf8',
  );
  const fnStart = src.indexOf('function listPurchaseOrdersForReceipt');
  const fnEnd = src.indexOf('\n}', fnStart);
  const fnBody = src.slice(fnStart, fnEnd);
  assert.match(fnBody, /status.*ISSUED|ISSUED.*status/);
});

test('production_operator role bundle has warehouse.access in basePermissionCodes', () => {
  const { ROLE_BUNDLES } = require('../src/security/role-bundles.config');
  const op = ROLE_BUNDLES.find((b) => b.id === 'production_operator');
  assert.ok(op, 'production_operator bundle must exist');
  assert.ok(op.basePermissionCodes.includes('warehouse.access'), 'must include warehouse.access');
  assert.ok(op.basePermissionCodes.includes('receipts.view'), 'must include receipts.view');
  assert.ok(op.basePermissionCodes.includes('receipts.inspect'), 'must include receipts.inspect');
});

test('production_operator sensitiveAdditions includes receipts.confirm', () => {
  const { ROLE_BUNDLES } = require('../src/security/role-bundles.config');
  const op = ROLE_BUNDLES.find((b) => b.id === 'production_operator');
  assert.ok(op.sensitiveAdditions.includes('receipts.confirm'));
});

test('warehouse_operator allowedAdditions includes production.view and production.execute', () => {
  const { ROLE_BUNDLES } = require('../src/security/role-bundles.config');
  const wo = ROLE_BUNDLES.find((b) => b.id === 'warehouse_operator');
  assert.ok(wo.allowedAdditions.includes('production.view'), 'must include production.view');
  assert.ok(wo.allowedAdditions.includes('production.execute'), 'must include production.execute');
});

test('warehouse_operator sensitiveAdditions includes production.complete', () => {
  const { ROLE_BUNDLES } = require('../src/security/role-bundles.config');
  const wo = ROLE_BUNDLES.find((b) => b.id === 'warehouse_operator');
  assert.ok(wo.sensitiveAdditions.includes('production.complete'));
});

test('cross-role backfill migration targets the correct roles and permissions', () => {
  const sql = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'prisma',
      'migrations',
      '20260902000000_backfill_cross_role_permissions',
      'migration.sql',
    ),
    'utf8',
  );
  assert.ok(sql.includes("r.\"code\" = 'production_operator'"), 'must target production_operator');
  assert.ok(sql.includes("'warehouse.access'"), 'must add warehouse.access');
  assert.ok(sql.includes("'receipts.view'"), 'must add receipts.view');
  assert.ok(sql.includes("'receipts.inspect'"), 'must add receipts.inspect');
  assert.match(sql, /ON CONFLICT \("role_id", "permission_id"\) DO UPDATE/);
});

test('sales_agent bundle has no warehouse or production permissions', () => {
  const { ROLE_BUNDLES } = require('../src/security/role-bundles.config');
  const agent = ROLE_BUNDLES.find((b) => b.id === 'sales_agent');
  assert.ok(agent, 'sales_agent bundle must exist');
  const forbidden = ['warehouse.access', 'warehouse.receive', 'production.execute', 'production.view',
    'receipts.inspect', 'receipts.confirm', 'inventory.manage'];
  const all = [...agent.basePermissionCodes, ...agent.allowedAdditions, ...agent.sensitiveAdditions];
  for (const perm of forbidden) {
    assert.ok(!all.includes(perm), `sales_agent must NOT have ${perm}`);
  }
});
