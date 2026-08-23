const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migrationPath = path.join(
  __dirname,
  '..',
  'prisma',
  'migrations',
  '20260816000000_harden_production_waste_lot_fk',
  'migration.sql',
);

const prismaSchemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('production waste hardening migration rejects invalid legacy rows and enforces lot referential integrity', () => {
  const migration = read(migrationPath);

  assert.match(migration, /WHERE "lot_id" IS NULL/);
  assert.match(migration, /LEFT JOIN "lots" l ON l\."id" = pw\."lot_id"/);
  assert.match(migration, /ALTER COLUMN "lot_id" SET NOT NULL/);
  assert.match(migration, /ADD CONSTRAINT "production_wastes_lot_id_fkey"/);
  assert.match(migration, /REFERENCES "lots"\("id"\) ON DELETE RESTRICT ON UPDATE CASCADE/);
  assert.match(migration, /CREATE INDEX "production_wastes_production_order_id_stage_execution_id_product_id_lot_id_idx"/);
  assert.match(migration, /CREATE INDEX "production_wastes_lot_id_idx"/);
});

test('prisma schema keeps ProductionWaste lotId mandatory and related to Lot', () => {
  const schema = read(prismaSchemaPath);

  assert.match(schema, /model ProductionWaste \{[\s\S]*lotId\s+BigInt\s+@map\("lot_id"\)/);
  assert.match(schema, /model ProductionWaste \{[\s\S]*lot\s+Lot\s+@relation\(fields: \[lotId\], references: \[id\], onDelete: Restrict\)/);
  assert.match(schema, /model Lot \{[\s\S]*productionWastes\s+ProductionWaste\[\]/);
});
