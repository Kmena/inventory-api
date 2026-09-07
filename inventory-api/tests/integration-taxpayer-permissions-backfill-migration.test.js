const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migrationPath = path.join(
  __dirname,
  '..',
  'prisma',
  'migrations',
  '20261010000000_backfill_integration_taxpayer_permissions',
  'migration.sql',
);

const migrationSql = fs.readFileSync(migrationPath, 'utf8');

test('integration taxpayer backfill migration upserts integration.taxpayer.lookup permission', () => {
  assert.ok(migrationSql.includes("'integration.taxpayer.lookup'"), "must include 'integration.taxpayer.lookup'");
  assert.match(migrationSql, /INSERT INTO "permissions"/);
  assert.match(migrationSql, /ON CONFLICT \("code"\) DO UPDATE/);
  assert.match(migrationSql, /"is_active"\s*=\s*true/);
});

test('integration taxpayer backfill migration upserts integration.economic-activities.list permission', () => {
  assert.ok(migrationSql.includes("'integration.economic-activities.list'"), "must include 'integration.economic-activities.list'");
});

test('integration taxpayer backfill assigns both permissions to root and admin roles', () => {
  assert.match(migrationSql, /INSERT INTO "role_permissions"/);
  assert.ok(migrationSql.includes("'root', 'admin'"), "must target root and admin roles");
  assert.match(migrationSql, /ON CONFLICT \("role_id", "permission_id"\) DO UPDATE/);
  assert.match(migrationSql, /"is_enabled" = true/);
});

test('integration taxpayer backfill assigns both permissions to sales role', () => {
  assert.ok(migrationSql.includes("r.\"code\" = 'sales'"), "must also target sales role");
});

test('integration.taxpayer.lookup and integration.economic-activities.list exist in seed.js', () => {
  const seedSource = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'seed.js'), 'utf8');
  assert.ok(
    seedSource.includes("'integration.taxpayer.lookup'"),
    "seed.js must declare integration.taxpayer.lookup in permissionDefinitions",
  );
  assert.ok(
    seedSource.includes("'integration.economic-activities.list'"),
    "seed.js must declare integration.economic-activities.list in permissionDefinitions",
  );
});
