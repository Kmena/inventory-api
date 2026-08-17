const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migrationPath = path.join(
  __dirname,
  '..',
  'prisma',
  'migrations',
  '20260817000000_add_production_return_foundation',
  'migration.sql',
);

const prismaSchemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('production return migration adds explicit stage/product/lot return persistence with lot integrity indexes', () => {
  const migration = read(migrationPath);

  assert.match(migration, /CREATE TABLE "production_returns"/);
  assert.match(migration, /"stage_execution_id" BIGINT NOT NULL/);
  assert.match(migration, /"production_order_id" BIGINT NOT NULL/);
  assert.match(migration, /"warehouse_id" BIGINT NOT NULL/);
  assert.match(migration, /"product_id" BIGINT NOT NULL/);
  assert.match(migration, /"lot_id" BIGINT NOT NULL/);
  assert.match(migration, /"reason_code" TEXT NOT NULL/);
  assert.match(migration, /"returned_at" TIMESTAMP\(3\) NOT NULL/);
  assert.match(migration, /CONSTRAINT "production_returns_stage_execution_id_fkey"/);
  assert.match(migration, /CONSTRAINT "production_returns_production_order_id_fkey"/);
  assert.match(migration, /CONSTRAINT "production_returns_lot_id_fkey"/);
  assert.match(migration, /CREATE INDEX "production_returns_production_order_id_stage_execution_id_product_id_lot_id_idx"/);
  assert.match(migration, /CREATE INDEX "production_returns_lot_id_idx"/);
});

test('prisma schema exposes ProductionReturn as explicit lot-bound stage detail', () => {
  const schema = read(prismaSchemaPath);

  assert.match(schema, /model ProductionStageExecution \{[\s\S]*returns\s+ProductionReturn\[\]/);
  assert.match(schema, /model ProductionReturn \{[\s\S]*lotId\s+BigInt\s+@map\("lot_id"\)/);
  assert.match(schema, /model ProductionReturn \{[\s\S]*reasonCode\s+String\s+@map\("reason_code"\)/);
  assert.match(schema, /model ProductionReturn \{[\s\S]*returnedAt\s+DateTime\s+@map\("returned_at"\)/);
  assert.match(schema, /model ProductionReturn \{[\s\S]*lot\s+Lot\s+@relation\(fields: \[lotId\], references: \[id\], onDelete: Restrict\)/);
  assert.match(schema, /model Lot \{[\s\S]*productionReturns\s+ProductionReturn\[\]/);
});
