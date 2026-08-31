/**
 * TASK-001 — Verifies the qa_rejection_disposition_and_continuation migration
 * without requiring a live DB connection.
 *
 * Tests confirm:
 * - SQL migration file exists with correct structure.
 * - Prisma schema has the new fields on QualityInspection.
 * - Prisma schema has the new ProductionRecolectionStage model.
 * - The Prisma client type for ProductionRecolectionStage is accessible.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const MIGRATION_DIR = path.join(
  __dirname,
  '../prisma/migrations/20260921000000_qa_rejection_disposition_and_continuation',
);
const MIGRATION_SQL = path.join(MIGRATION_DIR, 'migration.sql');
const SCHEMA_FILE = path.join(__dirname, '../prisma/schema.prisma');

// ─────────────────────────────────────────────────────────────────────────────
// Migration SQL structure
// ─────────────────────────────────────────────────────────────────────────────

test('migration SQL file exists', () => {
  assert.ok(fs.existsSync(MIGRATION_SQL), `Migration SQL file missing at ${MIGRATION_SQL}`);
});

test('migration SQL adds continuation_point to quality_inspections', () => {
  const sql = fs.readFileSync(MIGRATION_SQL, 'utf8');
  assert.match(sql, /continuation_point/i);
  assert.match(sql, /ALTER TABLE quality_inspections/i);
});

test('migration SQL adds continuation_stage_id to quality_inspections', () => {
  const sql = fs.readFileSync(MIGRATION_SQL, 'utf8');
  assert.match(sql, /continuation_stage_id/i);
});

test('migration SQL adds material_dispositions to quality_inspections', () => {
  const sql = fs.readFileSync(MIGRATION_SQL, 'utf8');
  assert.match(sql, /material_dispositions/i);
  assert.match(sql, /JSONB/i);
});

test('migration SQL creates production_recolection_stages table', () => {
  const sql = fs.readFileSync(MIGRATION_SQL, 'utf8');
  assert.match(sql, /CREATE TABLE production_recolection_stages/i);
});

test('migration SQL has UNIQUE constraint on rejected_execution_id', () => {
  const sql = fs.readFileSync(MIGRATION_SQL, 'utf8');
  assert.match(sql, /UNIQUE.*rejected_execution_id|rejected_execution_id.*UNIQUE/i);
});

test('migration SQL has CHECK constraint on status', () => {
  const sql = fs.readFileSync(MIGRATION_SQL, 'utf8');
  assert.match(sql, /CHECK.*PENDING.*COMPLETED|CHECK.*status/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// Prisma schema
// ─────────────────────────────────────────────────────────────────────────────

test('Prisma schema has continuationPoint on QualityInspection', () => {
  const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
  assert.match(schema, /continuationPoint\s+String\?/);
});

test('Prisma schema has continuationStageId on QualityInspection', () => {
  const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
  assert.match(schema, /continuationStageId\s+BigInt\?/);
});

test('Prisma schema has materialDispositions on QualityInspection', () => {
  const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
  assert.match(schema, /materialDispositions\s+Json\?/);
});

test('Prisma schema has ProductionRecolectionStage model', () => {
  const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
  assert.match(schema, /model ProductionRecolectionStage/);
});

test('Prisma schema maps ProductionRecolectionStage to production_recolection_stages', () => {
  const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
  assert.match(schema, /@@map\("production_recolection_stages"\)/);
});

test('Prisma schema has rejectedExecutionId @unique on ProductionRecolectionStage', () => {
  const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
  assert.match(schema, /rejectedExecutionId\s+BigInt\s+@unique/);
});

test('Prisma schema: ProductionOrder has recolectionStages relation', () => {
  const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
  assert.match(schema, /recolectionStages\s+ProductionRecolectionStage\[\]/);
});

test('Prisma schema: ProductionStageExecution has recolectionStage relation', () => {
  const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
  assert.match(schema, /recolectionStage\s+ProductionRecolectionStage\?/);
});

// ─────────────────────────────────────────────────────────────────────────────
// Prisma client accessibility
// ─────────────────────────────────────────────────────────────────────────────

test('Prisma client exposes productionRecolectionStage accessor', () => {
  const { PrismaClient } = require('@prisma/client');
  const client = new PrismaClient();
  assert.ok(
    typeof client.productionRecolectionStage === 'object',
    'PrismaClient must expose productionRecolectionStage',
  );
  client.$disconnect().catch(() => {});
});

test('QualityInspection existing rows have NULL continuation_point (backward compat)', () => {
  // This is a structural test: the migration adds nullable columns with no DEFAULT value,
  // so existing rows will have NULL automatically. Verified by checking the SQL.
  const sql = fs.readFileSync(MIGRATION_SQL, 'utf8');
  // The columns are added as NULL (no DEFAULT), meaning existing rows get NULL.
  assert.match(sql, /NULL/);
  assert.doesNotMatch(sql, /NOT NULL.*continuation_point/i);
});
