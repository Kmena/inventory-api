const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migrationPath = path.join(
  __dirname,
  '..',
  'prisma',
  'migrations',
  '20260915001000_production_order_material_requirements',
  'migration.sql',
);

const prismaSchemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('production order material requirements migration creates the planning table with tenant and audit fields', () => {
  const migration = read(migrationPath);

  assert.match(migration, /CREATE TABLE "production_order_material_requirements"/);
  assert.match(migration, /"company_id" BIGINT NOT NULL/);
  assert.match(migration, /"production_order_id" BIGINT NOT NULL/);
  assert.match(migration, /"product_id" BIGINT NOT NULL/);
  assert.match(migration, /"required_quantity" DECIMAL\(14,3\) NOT NULL/);
  assert.match(migration, /"available_at_creation" DECIMAL\(14,3\)/);
  assert.match(migration, /"shortage_at_creation" DECIMAL\(14,3\)/);
  assert.match(migration, /production_order_material_requirements_production_order_id_product_id_key/);
  assert.match(migration, /production_order_material_requirements_company_id_production_order_id_idx/);
  assert.match(migration, /CONSTRAINT "production_order_material_requirements_company_id_fkey"/);
  assert.match(migration, /CONSTRAINT "production_order_material_requirements_production_order_id_fkey"/);
  assert.match(migration, /CONSTRAINT "production_order_material_requirements_product_id_fkey"/);
});

test('prisma schema exposes ProductionOrderMaterialRequirement relations from company, product, and production order', () => {
  const schema = read(prismaSchemaPath);

  assert.match(schema, /model Company \{[\s\S]*productionOrderMaterialRequirements ProductionOrderMaterialRequirement\[\]/);
  assert.match(schema, /model Product \{[\s\S]*productionOrderMaterialRequirements ProductionOrderMaterialRequirement\[\]/);
  assert.match(schema, /model ProductionOrder \{[\s\S]*materialRequirements\s+ProductionOrderMaterialRequirement\[\]/);
  assert.match(schema, /model ProductionOrderMaterialRequirement \{[\s\S]*requiredQuantity\s+Decimal\s+@db\.Decimal\(14, 3\) @map\("required_quantity"\)/);
  assert.match(schema, /model ProductionOrderMaterialRequirement \{[\s\S]*availableAtCreation\s+Decimal\?\s+@db\.Decimal\(14, 3\) @map\("available_at_creation"\)/);
  assert.match(schema, /model ProductionOrderMaterialRequirement \{[\s\S]*shortageAtCreation\s+Decimal\?\s+@db\.Decimal\(14, 3\) @map\("shortage_at_creation"\)/);
  assert.match(schema, /@@unique\(\[productionOrderId, productId\]\)/);
  assert.match(schema, /@@index\(\[companyId, productionOrderId\]\)/);
});
