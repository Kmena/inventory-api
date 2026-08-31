const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migrationPath = path.join(
  __dirname,
  '..',
  'prisma',
  'migrations',
  '20260922000000_production_size_conversion',
  'migration.sql',
);

const prismaSchemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('production size conversion migration adds presentation, recipe basis and planned kg fields', () => {
  const migration = read(migrationPath);

  assert.match(migration, /CREATE TYPE "ProductPresentationType" AS ENUM \('VOLUME', 'MASS', 'LENGTH', 'COUNT'\)/);
  assert.match(migration, /CREATE TYPE "ProductNetContentUnit" AS ENUM \('ML', 'L', 'G', 'KG', 'M', 'UN'\)/);
  assert.match(migration, /CREATE TYPE "RecipeQuantityBasis" AS ENUM \('PER_OUTPUT_KG', 'PER_FINISHED_UNIT'\)/);
  assert.match(migration, /ALTER TABLE "products"[\s\S]*ADD COLUMN "presentation_type" "ProductPresentationType"/);
  assert.match(migration, /ALTER TABLE "products"[\s\S]*ADD COLUMN "net_content_unit" "ProductNetContentUnit"/);
  assert.match(migration, /ALTER TABLE "recipe_versions"[\s\S]*ADD COLUMN "quantity_basis" "RecipeQuantityBasis" NOT NULL DEFAULT 'PER_OUTPUT_KG'/);
  assert.match(migration, /ALTER TABLE "production_orders"[\s\S]*ADD COLUMN "planned_output_kg" DECIMAL\(14,3\)/);
});

test('prisma schema exposes explicit product presentation metadata, recipe basis and planned output kg', () => {
  const schema = read(prismaSchemaPath);

  assert.match(schema, /enum ProductPresentationType \{[\s\S]*VOLUME[\s\S]*MASS[\s\S]*LENGTH[\s\S]*COUNT[\s\S]*\}/);
  assert.match(schema, /enum ProductNetContentUnit \{[\s\S]*ML[\s\S]*L[\s\S]*G[\s\S]*KG[\s\S]*M[\s\S]*UN[\s\S]*\}/);
  assert.match(schema, /enum RecipeQuantityBasis \{[\s\S]*PER_OUTPUT_KG[\s\S]*PER_FINISHED_UNIT[\s\S]*\}/);
  assert.match(schema, /model Product \{[\s\S]*presentationType ProductPresentationType\? @map\("presentation_type"\)/);
  assert.match(schema, /model Product \{[\s\S]*netContentUnit\s+ProductNetContentUnit\? @map\("net_content_unit"\)/);
  assert.match(schema, /model RecipeVersion \{[\s\S]*quantityBasis\s+RecipeQuantityBasis\s+@default\(PER_OUTPUT_KG\) @map\("quantity_basis"\)/);
  assert.match(schema, /model ProductionOrder \{[\s\S]*plannedOutputKg\s+Decimal\?\s+@db\.Decimal\(14, 3\) @map\("planned_output_kg"\)/);
});
