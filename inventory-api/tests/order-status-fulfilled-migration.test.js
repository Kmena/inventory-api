const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// MASTER-004 / NPP-TASK-005 — OrderStatus FULFILLED foundation.
// This suite characterizes the migration SQL and Prisma schema. It does not
// require a live database. The migration is a pure additive enum extension.
//
// Acceptance criteria enforced here (see
// specs/non-physical-products-mvp/tasks.md §TASK-005 and
// specs/inventori-product-inventory-master-plan/tasks.md §MASTER-004):
//   * Historical DELIVERED rows are not modified (no UPDATE on orders).
//   * FULFILLED enum value is added.
//   * Migration is idempotent (guarded by pg_enum lookup).
//   * Prisma OrderStatus enum contains FULFILLED after DELIVERED.
//   * DELIVERED is preserved.
//   * Wave 2 owns the first runtime writer for service-only/non-inventory fulfillment.

const MIGRATION_FILE = path.join(
  __dirname,
  '../prisma/migrations/20261021000000_add_order_status_fulfilled/migration.sql',
);
const SCHEMA_FILE = path.join(__dirname, '../prisma/schema.prisma');
const SRC_ROOT = path.join(__dirname, '../src');

test('OrderStatus.FULFILLED enum value is added by the Wave 1 migration', () => {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  assert.match(
    sql,
    /ALTER TYPE "OrderStatus" ADD VALUE 'FULFILLED'/,
    'migration must ALTER OrderStatus enum with the FULFILLED value',
  );
});

test('OrderStatus.FULFILLED migration is guarded to be idempotent', () => {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  assert.match(sql, /pg_enum/, 'migration must guard using pg_enum lookup');
  assert.match(sql, /IF NOT EXISTS/, 'guard must be IF NOT EXISTS-shaped');
  assert.match(sql, /'FULFILLED'/, 'guard must reference the FULFILLED label');
});

test('OrderStatus migration does NOT rewrite historical DELIVERED rows', () => {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  assert.doesNotMatch(
    sql,
    /UPDATE\s+"?orders"?/i,
    'migration must not UPDATE the orders table; historical DELIVERED must survive',
  );
  assert.doesNotMatch(
    sql,
    /DELIVERED\s*->\s*FULFILLED/,
    'migration must not backfill DELIVERED to FULFILLED',
  );
});

test('Prisma OrderStatus enum contains DRAFT..DELIVERED..FULFILLED..CANCELLED..REJECTED in that order', () => {
  const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
  const enumBlockMatch = schema.match(/enum\s+OrderStatus\s*{([^}]*)}/);
  assert.ok(enumBlockMatch, 'OrderStatus enum block must exist');
  const values = enumBlockMatch[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('//'));

  // Preserve every previously-existing value; add FULFILLED after DELIVERED.
  assert.deepEqual(values, [
    'DRAFT',
    'APPROVED',
    'IN_PRODUCTION',
    'DELIVERED',
    'FULFILLED',
    'CANCELLED',
    'REJECTED',
  ]);
});

test('Wave 2 runtime writes FULFILLED only through the approved inventory dispatch boundary', () => {
  const offenders = [];
  const allowedFile = path.join(SRC_ROOT, 'services', 'inventory.service.js');
  const skipDirs = new Set(['node_modules', 'dist', 'coverage']);

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) walk(path.join(dir, entry.name));
        continue;
      }
      if (!/\.(js|ts)$/.test(entry.name)) continue;
      const filePath = path.join(dir, entry.name);
      const content = fs.readFileSync(filePath, 'utf8');
      const codeMatches = content.match(/['"`]FULFILLED['"`]/g);
      if (codeMatches && codeMatches.length > 0 && filePath !== allowedFile) {
        offenders.push({ filePath, occurrences: codeMatches.length });
      }
    }
  }

  walk(SRC_ROOT);
  assert.deepEqual(offenders, []);
  const inventoryService = fs.readFileSync(allowedFile, 'utf8');
  assert.match(
    inventoryService,
    /inventoryItems\.length\s*>\s*0\s*\?\s*['"]DELIVERED['"]\s*:\s*['"]FULFILLED['"]/, 
    'FULFILLED must be limited to service-only/non-inventory dispatch completion',
  );
});
