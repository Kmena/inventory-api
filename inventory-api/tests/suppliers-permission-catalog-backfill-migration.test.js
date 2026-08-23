const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migrationPath = path.join(
  __dirname,
  '..',
  'prisma',
  'migrations',
  '20260822000000_backfill_suppliers_permission_catalog',
  'migration.sql',
);

const migrationSql = fs.readFileSync(migrationPath, 'utf8');

const REQUIRED_PERMISSION_CODES = [
  'suppliers.view',
  'suppliers.manage',
];

test('suppliers permission catalog backfill migration upserts approved supplier permission codes', () => {
  for (const code of REQUIRED_PERMISSION_CODES) {
    assert.ok(migrationSql.includes(`'${code}'`), `Expected migration to include permission code ${code}`);
  }

  assert.match(migrationSql, /INSERT INTO "permissions"/);
  assert.match(migrationSql, /ON CONFLICT \("code"\) DO UPDATE/);
  assert.match(migrationSql, /"is_active" = true/);
});

test('suppliers permission catalog backfill migration assigns approved permissions to root and admin roles idempotently', () => {
  assert.match(migrationSql, /INSERT INTO "role_permissions"/);
  assert.match(migrationSql, /WHERE r\."code" IN \('root', 'admin'\)/);
  assert.match(migrationSql, /p\."code" IN \('suppliers\.view', 'suppliers\.manage'\)/);
  assert.match(migrationSql, /ON CONFLICT \("role_id", "permission_id"\) DO UPDATE/);
  assert.match(migrationSql, /"is_enabled" = true/);
});
