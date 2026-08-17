const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migrationPath = path.join(
  __dirname,
  '..',
  'prisma',
  'migrations',
  '20260819000000_backfill_production_permission_catalog',
  'migration.sql',
);

const migrationSql = fs.readFileSync(migrationPath, 'utf8');

const REQUIRED_PERMISSION_CODES = [
  'recipes.view',
  'recipes.operations.view',
  'recipes.manage',
  'recipes.approve',
  'production.view',
  'production.create',
  'production.approve',
  'production.execute',
  'production.complete',
  'production.cancel',
  'production.override',
];

test('production permission catalog backfill migration upserts every approved recipes and production permission code', () => {
  for (const code of REQUIRED_PERMISSION_CODES) {
    assert.ok(migrationSql.includes(`'${code}'`), `Expected migration to include permission code ${code}`);
  }

  assert.match(migrationSql, /INSERT INTO "permissions"/);
  assert.match(migrationSql, /ON CONFLICT \("code"\) DO UPDATE/);
  assert.match(migrationSql, /"is_active" = true/);
});
