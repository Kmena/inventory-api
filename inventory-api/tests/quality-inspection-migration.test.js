const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const MIGRATION_DIR = path.join(__dirname, '../prisma/migrations/20260818000000_add_quality_inspection_foundation');
const MIGRATION_FILE = path.join(MIGRATION_DIR, 'migration.sql');
const SCHEMA_FILE = path.join(__dirname, '../prisma/schema.prisma');

test('quality inspection foundation migration creates the QualityInspectionResult enum and quality_inspections table', () => {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');

  assert.ok(sql.includes("CREATE TYPE \"QualityInspectionResult\""), 'Must create QualityInspectionResult enum');
  assert.ok(sql.includes("'APPROVED'"), 'Enum must include APPROVED');
  assert.ok(sql.includes("'CONDITIONALLY_ACCEPTED'"), 'Enum must include CONDITIONALLY_ACCEPTED');
  assert.ok(sql.includes("'REJECTED'"), 'Enum must include REJECTED');
  assert.ok(sql.includes('CREATE TABLE "quality_inspections"'), 'Must create quality_inspections table');
  assert.ok(sql.includes('"production_order_id" BIGINT NOT NULL'), 'Must include production_order_id');
  assert.ok(sql.includes('"stage_execution_id" BIGINT NOT NULL'), 'Must include stage_execution_id');
  assert.ok(sql.includes('"inspector_user_id" BIGINT NOT NULL'), 'Must include inspector_user_id');
  assert.ok(sql.includes('"lot_id" BIGINT'), 'Must include lot_id (nullable)');
  assert.ok(sql.includes('"result" "QualityInspectionResult" NOT NULL'), 'Must include result column with enum type');
  assert.ok(sql.includes('"inspected_at" TIMESTAMP'), 'Must include inspected_at');
  assert.ok(sql.includes('"corrective_action" TEXT'), 'Must include corrective_action');
  assert.ok(sql.includes('"expected_parameters" JSONB'), 'Must include expected_parameters');
  assert.ok(sql.includes('"actual_results" JSONB'), 'Must include actual_results');
  assert.ok(sql.includes('"evidence" JSONB'), 'Must include evidence');
  assert.ok(sql.includes('"observations" TEXT'), 'Must include observations');
});

test('quality inspection migration includes referential integrity constraints for production_orders, stage_executions and lots', () => {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');

  assert.ok(sql.includes('"production_orders"("id")'), 'Must reference production_orders');
  assert.ok(sql.includes('"production_stage_executions"("id")'), 'Must reference production_stage_executions');
  assert.ok(sql.includes('"lots"("id")'), 'Must reference lots');
  assert.ok(sql.includes('ON DELETE CASCADE'), 'Must cascade on parent deletion (order, execution)');
  assert.ok(sql.includes('ON DELETE RESTRICT'), 'Must restrict lot deletion');
});

test('quality inspection migration includes indexes for performance', () => {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');

  assert.ok(sql.includes('CREATE INDEX'), 'Must include at least one index');
  assert.ok(sql.includes('"production_order_id"'), 'Must index by production_order_id');
  assert.ok(sql.includes('"lot_id"'), 'Must index by lot_id');
});

test('prisma schema exposes QualityInspection model with correct relations', () => {
  const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');

  assert.ok(schema.includes('model QualityInspection'), 'Must declare QualityInspection model');
  assert.ok(schema.includes('enum QualityInspectionResult'), 'Must declare QualityInspectionResult enum');
  assert.ok(schema.includes('result             QualityInspectionResult'), 'Must use the enum type');
  assert.ok(schema.includes('productionOrder    ProductionOrder'), 'Must relate to ProductionOrder');
  assert.ok(schema.includes('stageExecution     ProductionStageExecution'), 'Must relate to ProductionStageExecution');
  assert.ok(schema.includes('@@map("quality_inspections")'), 'Must map to quality_inspections table');
});
