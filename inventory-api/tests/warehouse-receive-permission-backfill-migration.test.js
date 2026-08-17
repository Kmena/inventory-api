const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migrationPath = path.join(
  __dirname,
  '..',
  'prisma',
  'migrations',
  '20260901001000_backfill_warehouse_receive_permission',
  'migration.sql',
);

const migrationSql = fs.readFileSync(migrationPath, 'utf8');

test('warehouse.receive backfill migration upserts the warehouse.receive permission', () => {
  assert.ok(migrationSql.includes("'warehouse.receive'"), "Migration must include 'warehouse.receive'");
  assert.match(migrationSql, /INSERT INTO "permissions"/);
  assert.match(migrationSql, /ON CONFLICT \("code"\) DO UPDATE/);
  assert.match(migrationSql, /"is_active"\s*=\s*true/);
});

test('warehouse.receive backfill migration assigns warehouse.receive to the warehouse role', () => {
  assert.match(migrationSql, /INSERT INTO "role_permissions"/);
  assert.ok(migrationSql.includes("r.\"code\" = 'warehouse'"), "Must target the warehouse role");
  assert.ok(migrationSql.includes("'warehouse.receive'"), "Must assign warehouse.receive");
  assert.match(migrationSql, /ON CONFLICT \("role_id", "permission_id"\) DO UPDATE/);
  assert.match(migrationSql, /"is_enabled" = true/);
});

test('warehouse.receive backfill migration assigns receipt workflow permissions to warehouse role', () => {
  // Without these the Recepciones tab API calls fail even when the tab is visible
  const required = ['receipts.view', 'receipts.inspect', 'receipts.confirm', 'recipes.operations.view'];
  for (const code of required) {
    assert.ok(migrationSql.includes(`'${code}'`), `Migration must assign '${code}' to warehouse role`);
  }
});

test('warehouse.receive permission exists in governance metadata', () => {
  const { PERMISSION_METADATA } = require('../src/security/permission-governance.config');
  const entry = PERMISSION_METADATA.find((p) => p.code === 'warehouse.receive');
  assert.ok(entry, 'warehouse.receive must be registered in PERMISSION_METADATA');
  assert.equal(entry.category, 'warehouse');
  assert.equal(entry.sensitivity, 'operational');
  assert.equal(entry.scope, 'tenant');
});

test('warehouse role in seed includes warehouse.receive and receipt workflow permissions', () => {
  // Read seed source and verify all expected permissions are present in the warehouse role block
  const seedSource = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'seed.js'), 'utf8');
  const required = ['warehouse.receive', 'receipts.view', 'receipts.inspect', 'receipts.confirm'];
  for (const code of required) {
    assert.ok(seedSource.includes(`'${code}'`), `seed.js must include '${code}' in warehouse role`);
  }
});
