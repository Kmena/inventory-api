const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// MASTER-005 / INV-TASK-001 — Inventory UX DB foundation.
// Three additive migrations are validated as a group:
//   * 20261023000000_add_system_lot_fields
//   * 20261024000000_add_location_fields
//   * 20261025000000_add_inventory_operations
//
// Acceptance criteria enforced here (see
// specs/inventory-ux-mvp/tasks.md §TASK-001,
// specs/inventory-ux-mvp/data-model.md §1 §5,
// specs/inventori-product-inventory-master-plan/migration-order.md Migrations 5-7):
//
//   * Lots gain is_system_generated (default FALSE) and system_lot_key
//     (nullable), plus the [company_id, system_lot_key] unique constraint
//     and the (company_id, product_id, is_system_generated) index.
//   * No existing lot is converted to a system lot (no UPDATE runs).
//   * Warehouses table is NOT renamed. LocationType / LocationNature enums
//     exist, columns are added and backfilled per §1 mapping.
//   * inventory_operations table exists with the approved columns, FK to
//     companies(id) and the (companyId, operationType, idempotencyKey)
//     unique constraint.
//   * No historical StockMovement row is rewritten.
//   * Prisma schema matches the migrations.
//
// The tests operate on static SQL / schema text; no live database is required.

const MIGRATIONS_ROOT = path.join(__dirname, '../prisma/migrations');
const SYSTEM_LOT_SQL = path.join(
  MIGRATIONS_ROOT,
  '20261023000000_add_system_lot_fields/migration.sql',
);
const LOCATION_SQL = path.join(
  MIGRATIONS_ROOT,
  '20261024000000_add_location_fields/migration.sql',
);
const OPERATIONS_SQL = path.join(
  MIGRATIONS_ROOT,
  '20261025000000_add_inventory_operations/migration.sql',
);
const SCHEMA_FILE = path.join(__dirname, '../prisma/schema.prisma');

const read = (file) => fs.readFileSync(file, 'utf8');

// ---------------------------------------------------------------------------
// System lot classification
// ---------------------------------------------------------------------------

test('system-lot migration adds is_system_generated (default FALSE) and system_lot_key', () => {
  const sql = read(SYSTEM_LOT_SQL);
  assert.match(
    sql,
    /ALTER TABLE "lots" ADD COLUMN "is_system_generated" BOOLEAN NOT NULL DEFAULT FALSE/,
  );
  assert.match(
    sql,
    /ALTER TABLE "lots" ADD COLUMN "system_lot_key" TEXT NULL/,
  );
});

test('system-lot migration adds the [company_id, system_lot_key] unique constraint', () => {
  const sql = read(SYSTEM_LOT_SQL);
  assert.match(
    sql,
    /lots_company_system_lot_key_unique[\s\S]*UNIQUE\s*\("company_id",\s*"system_lot_key"\)/,
  );
});

test('system-lot migration adds the (company, product, is_system_generated) index', () => {
  const sql = read(SYSTEM_LOT_SQL);
  assert.match(
    sql,
    /CREATE INDEX IF NOT EXISTS "lots_company_id_product_id_is_system_generated_idx"[\s\S]*ON "lots"\s*\("company_id",\s*"product_id",\s*"is_system_generated"\)/,
  );
});

test('system-lot migration does NOT convert existing lots to system lots (no UPDATE)', () => {
  const sql = read(SYSTEM_LOT_SQL);
  assert.doesNotMatch(sql, /UPDATE\s+"?lots"?/i);
});

// ---------------------------------------------------------------------------
// Location fields (warehouses)
// ---------------------------------------------------------------------------

test('location migration creates LocationType and LocationNature enums', () => {
  const sql = read(LOCATION_SQL);
  assert.match(sql, /CREATE TYPE "LocationType" AS ENUM \('BODEGA', 'ALMACEN', 'CEDI', 'OTHER'\)/);
  assert.match(sql, /CREATE TYPE "LocationNature" AS ENUM \('PHYSICAL', 'VIRTUAL'\)/);
});

test('location migration adds columns to warehouses (no rename)', () => {
  const sql = read(LOCATION_SQL);
  // Preserve the warehouses table name — no destructive rename per §2.
  assert.doesNotMatch(sql, /ALTER TABLE\s+"?warehouses"?\s+RENAME/i);
  assert.doesNotMatch(sql, /RENAME TO\s+"?locations"?/i);
  assert.match(sql, /ALTER TABLE "warehouses" ADD COLUMN "location_type" "LocationType"/);
  assert.match(sql, /ALTER TABLE "warehouses" ADD COLUMN "location_nature" "LocationNature"/);
});

test('location migration backfills VIRTUAL for admin/courses/affiliations warehouseType or is_virtual=TRUE', () => {
  const sql = read(LOCATION_SQL);
  assert.match(
    sql,
    /SET "location_nature" = 'VIRTUAL'::"LocationNature"[\s\S]*ADMIN_VIRTUAL[\s\S]*COURSES_VIRTUAL[\s\S]*AFFILIATIONS_VIRTUAL[\s\S]*OR "is_virtual" = TRUE/,
  );
});

test('location migration backfills PHYSICAL/BODEGA for remaining warehouses', () => {
  const sql = read(LOCATION_SQL);
  assert.match(sql, /SET "location_nature" = 'PHYSICAL'::"LocationNature"\s+WHERE "location_nature" IS NULL/);
  assert.match(sql, /SET "location_type" = 'BODEGA'::"LocationType"\s+WHERE "location_type"\s+IS NULL/);
});

test('location migration enforces NOT NULL and safe defaults after backfill', () => {
  const sql = read(LOCATION_SQL);
  assert.match(sql, /ALTER TABLE "warehouses" ALTER COLUMN "location_type"\s+SET DEFAULT 'BODEGA'/);
  assert.match(sql, /ALTER TABLE "warehouses" ALTER COLUMN "location_type"\s+SET NOT NULL/);
  assert.match(sql, /ALTER TABLE "warehouses" ALTER COLUMN "location_nature"\s+SET DEFAULT 'PHYSICAL'/);
  assert.match(sql, /ALTER TABLE "warehouses" ALTER COLUMN "location_nature"\s+SET NOT NULL/);
});

test('location migration does NOT touch warehouse_type or is_virtual (backward compatibility §5)', () => {
  const sql = read(LOCATION_SQL);
  assert.doesNotMatch(sql, /DROP COLUMN\s+"?warehouse_type"?/i);
  assert.doesNotMatch(sql, /DROP COLUMN\s+"?is_virtual"?/i);
});

// ---------------------------------------------------------------------------
// InventoryOperation table
// ---------------------------------------------------------------------------

test('inventory_operations table has every approved column with the correct types', () => {
  const sql = read(OPERATIONS_SQL);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "inventory_operations"/);

  const required = [
    /"id"\s+BIGSERIAL\s+PRIMARY KEY/,
    /"company_id"\s+BIGINT\s+NOT NULL/,
    /"operation_type"\s+TEXT\s+NOT NULL/,
    /"idempotency_key"\s+TEXT\s+NULL/,
    /"status"\s+TEXT\s+NOT NULL DEFAULT 'COMPLETED'/,
    /"product_id"\s+BIGINT\s+NULL/,
    /"source_warehouse_id"\s+BIGINT\s+NULL/,
    /"destination_warehouse_id"\s+BIGINT\s+NULL/,
    /"movement_group_id"\s+TEXT\s+NULL/,
    /"reason_code"\s+TEXT\s+NULL/,
    /"note"\s+TEXT\s+NULL/,
    /"metadata"\s+JSONB\s+NULL/,
    /"created_by_user_id"\s+BIGINT\s+NULL/,
    /"created_at"\s+TIMESTAMP\(3\)/,
    /"updated_at"\s+TIMESTAMP\(3\)/,
  ];
  for (const shape of required) assert.match(sql, shape);
});

test('inventory_operations has FK to companies and (company, type, idempotency) unique constraint', () => {
  const sql = read(OPERATIONS_SQL);
  assert.match(
    sql,
    /inventory_operations_company_id_fkey[\s\S]*REFERENCES "companies"\s*\("id"\)/,
  );
  assert.match(
    sql,
    /inventory_operations_company_type_idempotency_unique[\s\S]*UNIQUE\s*\("company_id",\s*"operation_type",\s*"idempotency_key"\)/,
  );
});

test('inventory_operations has (company, operation_type, created_at) and (movement_group_id) indexes', () => {
  const sql = read(OPERATIONS_SQL);
  assert.match(
    sql,
    /CREATE INDEX IF NOT EXISTS "inventory_operations_company_operation_type_created_at_idx"/,
  );
  assert.match(sql, /CREATE INDEX IF NOT EXISTS "inventory_operations_movement_group_id_idx"/);
});

test('inventory_operations migration does not rewrite stock_movements or add StockMovement columns', () => {
  const sql = read(OPERATIONS_SQL);
  assert.doesNotMatch(sql, /ALTER TABLE\s+"?stock_movements"?/i);
  assert.doesNotMatch(sql, /UPDATE\s+"?stock_movements"?/i);
});

// ---------------------------------------------------------------------------
// Prisma schema alignment
// ---------------------------------------------------------------------------

test('Prisma Lot model gained isSystemGenerated + systemLotKey with unique + index', () => {
  const schema = read(SCHEMA_FILE);
  const modelBlock = schema.match(/model\s+Lot\s*{([\s\S]*?)\n}/)[1];
  assert.match(modelBlock, /isSystemGenerated\s+Boolean\s+@default\(false\)\s+@map\("is_system_generated"\)/);
  assert.match(modelBlock, /systemLotKey\s+String\?\s+@map\("system_lot_key"\)/);
  assert.match(modelBlock, /@@unique\(\[companyId, systemLotKey\]/);
  assert.match(
    modelBlock,
    /@@index\(\[companyId, productId, isSystemGenerated\]\)/,
  );
});

test('Prisma Warehouse model gained locationType + locationNature with safe defaults', () => {
  const schema = read(SCHEMA_FILE);
  const modelBlock = schema.match(/model\s+Warehouse\s*{([\s\S]*?)\n}/)[1];
  assert.match(modelBlock, /locationType\s+LocationType\s+@default\(BODEGA\)/);
  assert.match(modelBlock, /locationNature\s+LocationNature\s+@default\(PHYSICAL\)/);
});

test('Prisma InventoryOperation model matches the approved data-model.md §5 shape', () => {
  const schema = read(SCHEMA_FILE);
  const modelMatch = schema.match(/model\s+InventoryOperation\s*{([\s\S]*?)\n}/);
  assert.ok(modelMatch, 'InventoryOperation model must exist');
  const body = modelMatch[1];
  assert.match(body, /companyId\s+BigInt/);
  assert.match(body, /operationType\s+String/);
  assert.match(body, /idempotencyKey\s+String\?/);
  assert.match(body, /status\s+String\s+@default\("COMPLETED"\)/);
  assert.match(body, /productId\s+BigInt\?/);
  assert.match(body, /sourceWarehouseId\s+BigInt\?/);
  assert.match(body, /destinationWarehouseId\s+BigInt\?/);
  assert.match(body, /movementGroupId\s+String\?/);
  assert.match(body, /metadata\s+Json\?/);
  assert.match(body, /@@unique\(\[companyId, operationType, idempotencyKey\]/);
  assert.match(body, /@@index\(\[companyId, operationType, createdAt\]\)/);
  assert.match(body, /@@map\("inventory_operations"\)/);
});

test('Company model exposes inventoryOperations back-relation', () => {
  const schema = read(SCHEMA_FILE);
  const companyBlock = schema.match(/model\s+Company\s*{([\s\S]*?)\n}/)[1];
  assert.match(companyBlock, /inventoryOperations\s+InventoryOperation\[\]/);
});

test('LocationType and LocationNature Prisma enums match the approved SQL enum values', () => {
  const schema = read(SCHEMA_FILE);
  const locType = schema.match(/enum\s+LocationType\s*{([^}]*)}/);
  const locNat = schema.match(/enum\s+LocationNature\s*{([^}]*)}/);
  assert.ok(locType, 'LocationType Prisma enum must exist');
  assert.ok(locNat, 'LocationNature Prisma enum must exist');
  const typeValues = locType[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('//'));
  assert.deepEqual(typeValues, ['BODEGA', 'ALMACEN', 'CEDI', 'OTHER']);
  const natureValues = locNat[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('//'));
  assert.deepEqual(natureValues, ['PHYSICAL', 'VIRTUAL']);
});

// ---------------------------------------------------------------------------
// Idempotency across the three MASTER-005 migrations
// ---------------------------------------------------------------------------

test('MASTER-005 migrations are all idempotent', () => {
  const sysSql = read(SYSTEM_LOT_SQL);
  const locSql = read(LOCATION_SQL);
  const opsSql = read(OPERATIONS_SQL);

  // System-lot: information_schema guards on both column adds, pg_constraint guard on unique.
  const sysGuards = (sysSql.match(/information_schema\.columns/g) || []).length;
  assert.ok(sysGuards >= 2, 'system-lot migration must guard both column adds');
  assert.match(sysSql, /CREATE INDEX IF NOT EXISTS/);

  // Location: information_schema on column adds + pg_type on enum creation.
  const locColGuards = (locSql.match(/information_schema\.columns/g) || []).length;
  assert.ok(locColGuards >= 2, 'location migration must guard both column adds');
  const enumGuards = (locSql.match(/pg_type WHERE typname = 'Location(Type|Nature)'/g) || []).length;
  assert.equal(enumGuards, 2, 'location migration must guard both enum creations');

  // Operations: CREATE TABLE IF NOT EXISTS + guarded FK + guarded unique + IF NOT EXISTS indexes.
  assert.match(opsSql, /CREATE TABLE IF NOT EXISTS "inventory_operations"/);
  assert.match(opsSql, /IF NOT EXISTS \(\s*SELECT 1 FROM pg_constraint WHERE conname = 'inventory_operations_company_id_fkey'/);
  assert.match(opsSql, /IF NOT EXISTS \(\s*SELECT 1 FROM pg_constraint\s+WHERE conname = 'inventory_operations_company_type_idempotency_unique'/);
  assert.match(opsSql, /CREATE INDEX IF NOT EXISTS "inventory_operations_company_operation_type_created_at_idx"/);
  assert.match(opsSql, /CREATE INDEX IF NOT EXISTS "inventory_operations_movement_group_id_idx"/);
});
