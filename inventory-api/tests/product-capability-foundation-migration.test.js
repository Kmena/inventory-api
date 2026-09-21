const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// MASTER-001 / NPP-TASK-001 — Product capability foundation migration test.
// Verifies the migration SQL introduces the approved capability enums, columns,
// backfill defaults and indexes; and preserves the legacy productType strategy.

const MIGRATION_FILE = path.join(
  __dirname,
  '../prisma/migrations/20261020000000_add_product_capability_foundation/migration.sql',
);
const SCHEMA_FILE = path.join(__dirname, '../prisma/schema.prisma');

test('product capability migration creates the five approved enums', () => {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');

  for (const enumName of [
    'ProductNature',
    'ProductCommercialBehavior',
    'ProductEntitlementKind',
    'ProductValidityUnit',
    'ProductBillingInterval',
  ]) {
    assert.ok(
      sql.includes(`CREATE TYPE "${enumName}"`),
      `migration must create ${enumName} enum`,
    );
  }

  assert.match(sql, /'GOOD'.*'SERVICE'/s, 'ProductNature must include GOOD and SERVICE');
  assert.match(sql, /'STANDARD'.*'ENTITLEMENT'/s, 'ProductCommercialBehavior must include STANDARD and ENTITLEMENT');
  for (const kind of ['SUBSCRIPTION', 'MEMBERSHIP', 'AFFILIATION', 'COURSE', 'SERVICE_PERIOD']) {
    assert.ok(sql.includes(`'${kind}'`), `ProductEntitlementKind must include ${kind}`);
  }
  for (const unit of ['DAY', 'MONTH', 'YEAR']) {
    assert.ok(sql.includes(`'${unit}'`), `ProductValidityUnit must include ${unit}`);
  }
  for (const interval of ['MONTHLY', 'QUARTERLY', 'YEARLY']) {
    assert.ok(sql.includes(`'${interval}'`), `ProductBillingInterval must include ${interval}`);
  }
});

test('product capability migration adds all seven capability columns to products', () => {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');

  for (const column of [
    'product_nature',
    'controls_inventory',
    'commercial_behavior',
    'entitlement_kind',
    'default_validity_count',
    'default_validity_unit',
    'billing_interval',
  ]) {
    assert.ok(
      sql.includes(`ADD COLUMN "${column}"`),
      `migration must add ${column} column`,
    );
  }
});

test('product capability migration backfills conservative physical/inventory defaults', () => {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');

  assert.match(
    sql,
    /UPDATE "products" SET "product_nature"\s*=\s*'GOOD'\s+WHERE "product_nature"\s+IS NULL/,
    'existing products must backfill product_nature to GOOD',
  );
  assert.match(
    sql,
    /UPDATE "products" SET "controls_inventory"\s*=\s*TRUE\s+WHERE "controls_inventory"\s+IS NULL/,
    'existing products must backfill controls_inventory to TRUE',
  );
  assert.match(
    sql,
    /UPDATE "products" SET "commercial_behavior"\s*=\s*'STANDARD'\s+WHERE "commercial_behavior"\s+IS NULL/,
    'existing products must backfill commercial_behavior to STANDARD',
  );
});

test('product capability migration enforces NOT NULL + DEFAULT after backfill', () => {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');

  for (const column of ['product_nature', 'controls_inventory', 'commercial_behavior']) {
    assert.ok(
      sql.includes(`ALTER COLUMN "${column}"      SET NOT NULL`)
      || sql.includes(`ALTER COLUMN "${column}"  SET NOT NULL`)
      || sql.includes(`ALTER COLUMN "${column}" SET NOT NULL`),
      `migration must set ${column} NOT NULL`,
    );
  }

  assert.match(sql, /ALTER COLUMN "product_nature"\s+SET DEFAULT 'GOOD'/);
  assert.match(sql, /ALTER COLUMN "controls_inventory"\s+SET DEFAULT TRUE/);
  assert.match(sql, /ALTER COLUMN "commercial_behavior"\s+SET DEFAULT 'STANDARD'/);
});

test('product capability migration adds tenant-scoped capability indexes', () => {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');

  assert.ok(
    sql.includes('"products_company_id_controls_inventory_idx"'),
    'migration must add [companyId, controlsInventory] index',
  );
  assert.ok(
    sql.includes('"products_company_id_commercial_behavior_entitlement_kind_idx"'),
    'migration must add [companyId, commercialBehavior, entitlementKind] index',
  );
});

test('product capability migration is idempotent (guarded by information_schema / pg_type)', () => {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');

  assert.match(sql, /pg_type WHERE typname = 'ProductNature'/);
  assert.match(sql, /pg_type WHERE typname = 'ProductCommercialBehavior'/);
  assert.match(sql, /information_schema\.columns/);
  assert.match(sql, /pg_indexes/);
});

test('product capability migration does not touch legacy productType or historical rows', () => {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');

  assert.ok(!/UPDATE "products" SET "product_type"/i.test(sql), 'migration must not rewrite product_type');
  assert.ok(!/ALTER COLUMN "product_type"/i.test(sql), 'migration must not modify product_type column definition');
  assert.ok(!/DROP TABLE/i.test(sql), 'migration must not drop tables');
  assert.ok(!/DROP COLUMN/i.test(sql), 'migration must not drop columns');
  assert.ok(!/DELETE FROM "products"/i.test(sql), 'migration must not delete product rows');
  assert.ok(!/DELETE FROM "warehouses"/i.test(sql), 'migration must not delete warehouse rows');
});

test('prisma schema exposes the five capability enums and seven Product columns', () => {
  const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');

  assert.match(schema, /enum ProductNature\s*\{[^}]*GOOD[^}]*SERVICE[^}]*\}/, 'ProductNature enum block missing');
  assert.match(schema, /enum ProductCommercialBehavior\s*\{[^}]*STANDARD[^}]*ENTITLEMENT[^}]*\}/, 'ProductCommercialBehavior enum block missing');
  assert.match(schema, /enum ProductEntitlementKind\s*\{[\s\S]*SUBSCRIPTION[\s\S]*MEMBERSHIP[\s\S]*AFFILIATION[\s\S]*COURSE[\s\S]*SERVICE_PERIOD[\s\S]*\}/, 'ProductEntitlementKind enum block missing');
  assert.match(schema, /enum ProductValidityUnit\s*\{[\s\S]*DAY[\s\S]*MONTH[\s\S]*YEAR[\s\S]*\}/);
  assert.match(schema, /enum ProductBillingInterval\s*\{[\s\S]*MONTHLY[\s\S]*QUARTERLY[\s\S]*YEARLY[\s\S]*\}/);

  assert.match(schema, /productNature\s+ProductNature\s+@default\(GOOD\)\s+@map\("product_nature"\)/);
  assert.match(schema, /controlsInventory\s+Boolean\s+@default\(true\)\s+@map\("controls_inventory"\)/);
  assert.match(schema, /commercialBehavior\s+ProductCommercialBehavior\s+@default\(STANDARD\)\s+@map\("commercial_behavior"\)/);
  assert.match(schema, /entitlementKind\s+ProductEntitlementKind\?\s+@map\("entitlement_kind"\)/);
  assert.match(schema, /defaultValidityCount\s+Int\?\s+@map\("default_validity_count"\)/);
  assert.match(schema, /defaultValidityUnit\s+ProductValidityUnit\?\s+@map\("default_validity_unit"\)/);
  assert.match(schema, /billingInterval\s+ProductBillingInterval\?\s+@map\("billing_interval"\)/);
});

test('prisma schema keeps legacy productType field intact', () => {
  const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');

  assert.match(
    schema,
    /productType\s+String\s+@default\("FINISHED_PRODUCT"\)\s+@map\("product_type"\)/,
    'legacy Product.productType must be preserved',
  );
});

test('prisma schema declares the two capability indexes on Product', () => {
  const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');

  assert.match(schema, /@@index\(\[companyId,\s*controlsInventory\]\)/);
  assert.match(schema, /@@index\(\[companyId,\s*commercialBehavior,\s*entitlementKind\]\)/);
});
