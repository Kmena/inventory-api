const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ADD_PRICING_MIGRATION_FILE = path.join(__dirname, '../prisma/migrations/20260821000000_add_supplier_product_pricing/migration.sql');
const CONVERGENCE_MIGRATION_FILE = path.join(__dirname, '../prisma/migrations/20260822001000_backfill_supplier_product_pricing_convergence/migration.sql');
const SCHEMA_FILE = path.join(__dirname, '../prisma/schema.prisma');

test('supplier product pricing base migration adds unit_price and currency columns', () => {
  const sql = fs.readFileSync(ADD_PRICING_MIGRATION_FILE, 'utf8');

  assert.ok(sql.includes('"product_suppliers"'), 'migration must target product_suppliers table');
  assert.ok(sql.includes('"unit_price"'), 'migration must add unit_price column');
  assert.ok(sql.includes('DECIMAL(14, 2)'), 'unit_price must be DECIMAL(14, 2)');
  assert.ok(sql.includes('"currency"'), 'migration must add currency column');
  assert.ok(sql.includes("DEFAULT 'CRC'"), 'currency must default to CRC');
});

test('supplier product pricing convergence migration is legacy-safe and normalizes currency', () => {
  const sql = fs.readFileSync(CONVERGENCE_MIGRATION_FILE, 'utf8');

  assert.match(sql, /information_schema\.columns/);
  assert.match(sql, /table_name = 'product_suppliers'/);
  assert.match(sql, /column_name = 'unit_price'/);
  assert.match(sql, /column_name = 'currency'/);
  assert.match(sql, /ADD COLUMN "unit_price" DECIMAL\(14, 2\)/);
  assert.match(sql, /ADD COLUMN "currency" TEXT/);
  assert.match(sql, /UPDATE "product_suppliers"/);
  assert.match(sql, /SET "currency" = 'CRC'/);
  assert.match(sql, /WHERE "currency" IS NULL/);
  assert.match(sql, /ALTER COLUMN "currency" SET DEFAULT 'CRC'/);
});

test('prisma schema includes unitPrice and currency in ProductSupplier model', () => {
  const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');

  assert.ok(schema.includes('unitPrice'), 'schema must include unitPrice field');
  assert.ok(schema.includes('@map("unit_price")'), 'unitPrice must map to unit_price column');
  assert.ok(schema.includes('@db.Decimal(14, 2)'), 'unitPrice must be Decimal(14, 2)');
  assert.ok(schema.includes('currency              String?'), 'currency field must exist in ProductSupplier');
  assert.ok(schema.includes('@default("CRC")'), 'currency must default to CRC');
});
