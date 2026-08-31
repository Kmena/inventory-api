/**
 * Tests for qa-rejection-material-reconciliation-amendment migrations (TASK-001, TASK-003)
 *
 * Covers:
 * - TASK-001: recipe_stages gains stage_type, process_code, process_label columns
 * - TASK-003: production_recolection_stages gains recovery_type column
 *             production_recolection_entries table created
 *             production_recolection_reconciliations table created
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'prisma', 'migrations');
const SCHEMA_PATH = path.join(__dirname, '..', 'prisma', 'schema.prisma');

function readMigration(dirName) {
  const migPath = path.join(MIGRATIONS_DIR, dirName, 'migration.sql');
  if (!fs.existsSync(migPath)) return null;
  return fs.readFileSync(migPath, 'utf8');
}

function readSchema() {
  return fs.readFileSync(SCHEMA_PATH, 'utf8');
}

// ─── TASK-001 migration ───────────────────────────────────────────────────────

test('TASK-001 migration SQL file exists (TASK-001)', () => {
  const sql = readMigration('20260923000000_recipe_stage_typing_and_process_code');
  assert.ok(sql, 'Migration file should exist');
});

test('TASK-001 migration adds stage_type to recipe_stages (TASK-001)', () => {
  const sql = readMigration('20260923000000_recipe_stage_typing_and_process_code');
  assert.ok(sql.includes('stage_type'), 'Should add stage_type column');
  assert.ok(sql.includes("DEFAULT 'PROCESSING'"), 'stage_type should default to PROCESSING');
});

test('TASK-001 migration adds process_code to recipe_stages (TASK-001)', () => {
  const sql = readMigration('20260923000000_recipe_stage_typing_and_process_code');
  assert.ok(sql.includes('process_code'), 'Should add process_code column');
});

test('TASK-001 migration adds process_label to recipe_stages (TASK-001)', () => {
  const sql = readMigration('20260923000000_recipe_stage_typing_and_process_code');
  assert.ok(sql.includes('process_label'), 'Should add process_label column');
});

// ─── TASK-001 Prisma schema ───────────────────────────────────────────────────

test('Prisma schema has stageType on RecipeStage (TASK-001)', () => {
  const schema = readSchema();
  assert.ok(schema.includes('stageType'), 'RecipeStage should have stageType field');
});

test('Prisma schema has processCode on RecipeStage (TASK-001)', () => {
  const schema = readSchema();
  assert.ok(schema.includes('processCode'), 'RecipeStage should have processCode field');
});

test('Prisma schema has processLabel on RecipeStage (TASK-001)', () => {
  const schema = readSchema();
  assert.ok(schema.includes('processLabel'), 'RecipeStage should have processLabel field');
});

test('Prisma schema: RecipeStage stageType defaults to PROCESSING (TASK-001)', () => {
  const schema = readSchema();
  assert.ok(
    schema.includes('"PROCESSING"'),
    'stageType should have default PROCESSING',
  );
});

// ─── TASK-003 migration ───────────────────────────────────────────────────────

test('TASK-003 migration SQL file exists (TASK-003)', () => {
  const sql = readMigration('20260923001000_recolection_entry_and_reconciliation');
  assert.ok(sql, 'Migration file should exist');
});

test('TASK-003 migration adds recovery_type to production_recolection_stages (TASK-003)', () => {
  const sql = readMigration('20260923001000_recolection_entry_and_reconciliation');
  assert.ok(sql.includes('recovery_type'), 'Should add recovery_type column');
  assert.ok(sql.includes("DEFAULT 'VIRTUAL_RECOLECTION'"), 'Should default to VIRTUAL_RECOLECTION');
});

test('TASK-003 migration creates production_recolection_entries table (TASK-003)', () => {
  const sql = readMigration('20260923001000_recolection_entry_and_reconciliation');
  assert.ok(
    sql.includes('production_recolection_entries'),
    'Should create production_recolection_entries table',
  );
});

test('TASK-003 migration creates production_recolection_reconciliations table (TASK-003)', () => {
  const sql = readMigration('20260923001000_recolection_entry_and_reconciliation');
  assert.ok(
    sql.includes('production_recolection_reconciliations'),
    'Should create production_recolection_reconciliations table',
  );
});

test('TASK-003 production_recolection_entries has required columns (TASK-003)', () => {
  const sql = readMigration('20260923001000_recolection_entry_and_reconciliation');
  assert.ok(sql.includes('"recolection_stage_id"'), 'Should have recolection_stage_id');
  assert.ok(sql.includes('"product_id"'), 'Should have product_id');
  assert.ok(sql.includes('"lot_id"'), 'Should have lot_id');
  assert.ok(sql.includes('"quantity"'), 'Should have quantity');
});

test('TASK-003 production_recolection_reconciliations has outcome column (TASK-003)', () => {
  const sql = readMigration('20260923001000_recolection_entry_and_reconciliation');
  assert.ok(sql.includes('"outcome"'), 'Should have outcome column');
});

// ─── TASK-003 Prisma schema ───────────────────────────────────────────────────

test('Prisma schema has ProductionRecolectionEntry model (TASK-003)', () => {
  const schema = readSchema();
  assert.ok(schema.includes('model ProductionRecolectionEntry'), 'Should have ProductionRecolectionEntry model');
});

test('Prisma schema has ProductionRecolectionReconciliation model (TASK-003)', () => {
  const schema = readSchema();
  assert.ok(schema.includes('model ProductionRecolectionReconciliation'), 'Should have ProductionRecolectionReconciliation model');
});

test('Prisma schema: ProductionRecolectionStage has recoveryType field (TASK-003)', () => {
  const schema = readSchema();
  assert.ok(schema.includes('recoveryType'), 'ProductionRecolectionStage should have recoveryType');
});

test('Prisma schema: ProductionRecolectionStage has recolectionEntries relation (TASK-003)', () => {
  const schema = readSchema();
  assert.ok(schema.includes('recolectionEntries'), 'Should have recolectionEntries relation');
});

test('Prisma schema: ProductionRecolectionStage has reconciliations relation (TASK-003)', () => {
  const schema = readSchema();
  assert.ok(schema.includes('reconciliations     ProductionRecolectionReconciliation'), 'Should have reconciliations relation');
});
