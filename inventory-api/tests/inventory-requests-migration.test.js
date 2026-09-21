'use strict';

/**
 * Characterization tests for the add_inventory_requests migration.
 *
 * Verifies:
 *  - Migration file exists
 *  - Contains CREATE TABLE inventory_requests with expected columns
 *  - Contains all required FK constraints (idempotent DO-block pattern)
 *  - Contains required indexes
 *  - Contains inventory.requests.execute permission backfill
 *  - Uses ON CONFLICT DO NOTHING for permission and ON CONFLICT DO UPDATE for role_permissions
 *  - Table uses "Role" (capital R) for the role_permissions backfill (pattern match)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migrationDir = path.join(
  __dirname, '..', 'prisma', 'migrations', '20261029000000_add_inventory_requests',
);

const migrationFile = path.join(migrationDir, 'migration.sql');

function readMigration() {
  return fs.readFileSync(migrationFile, 'utf-8');
}

test('add_inventory_requests migration file exists', () => {
  assert.ok(fs.existsSync(migrationFile), `Migration file must exist at ${migrationFile}`);
});

test('migration creates inventory_requests table', () => {
  const sql = readMigration();
  assert.match(sql, /CREATE TABLE.*inventory_requests/, 'Must create inventory_requests table');
});

test('migration includes company_id column', () => {
  const sql = readMigration();
  assert.match(sql, /"company_id"/, 'Must include company_id column');
});

test('migration includes type and status columns', () => {
  const sql = readMigration();
  assert.match(sql, /"type"\s+TEXT/, 'Must include type TEXT column');
  assert.match(sql, /"status"\s+TEXT/, 'Must include status TEXT column');
});

test('migration includes lot_id, product_id, source_warehouse_id columns', () => {
  const sql = readMigration();
  assert.match(sql, /"lot_id"/, 'Must include lot_id column');
  assert.match(sql, /"product_id"/, 'Must include product_id column');
  assert.match(sql, /"source_warehouse_id"/, 'Must include source_warehouse_id column');
});

test('migration includes optional destination_warehouse_id', () => {
  const sql = readMigration();
  assert.match(sql, /"destination_warehouse_id"/, 'Must include destination_warehouse_id column');
  assert.match(sql, /NULL/, 'destination_warehouse_id must be nullable');
});

test('migration includes requested_by_user_id and assigned_to_user_id', () => {
  const sql = readMigration();
  assert.match(sql, /"requested_by_user_id"/, 'Must include requested_by_user_id column');
  assert.match(sql, /"assigned_to_user_id"/, 'Must include assigned_to_user_id column');
});

test('migration includes lifecycle columns (picked_up_at, completed_at, cancelled_at)', () => {
  const sql = readMigration();
  assert.match(sql, /"picked_up_at"/, 'Must include picked_up_at for transfer pickup');
  assert.match(sql, /"completed_at"/, 'Must include completed_at');
  assert.match(sql, /"cancelled_at"/, 'Must include cancelled_at');
});

test('migration includes idempotent FK constraints via DO-blocks', () => {
  const sql = readMigration();
  assert.match(sql, /DO \$\$/, 'Must use DO-blocks for idempotent FK creation');
  assert.match(sql, /inventory_requests_company_id_fkey/, 'Must define company FK');
  assert.match(sql, /inventory_requests_lot_id_fkey/, 'Must define lot FK');
  assert.match(sql, /inventory_requests_product_id_fkey/, 'Must define product FK');
});

test('migration creates required indexes', () => {
  const sql = readMigration();
  assert.match(sql, /CREATE INDEX IF NOT EXISTS.*inventory_requests/, 'Must create indexes');
  assert.match(sql, /inventory_requests_company_status_created_idx/, 'Must create company+status+created index');
});

test('migration inserts inventory.requests.execute permission', () => {
  const sql = readMigration();
  assert.match(sql, /inventory\.requests\.execute/, 'Must backfill inventory.requests.execute permission');
  assert.match(sql, /ON CONFLICT.*DO NOTHING/, 'Permission insert must be idempotent');
});

test('migration assigns permission to roles using "Role" table (uppercase R)', () => {
  const sql = readMigration();
  assert.match(sql, /FROM "Role"/, 'Role_permissions backfill must use "Role" table with capital R');
});

test('migration role_permissions backfill uses ON CONFLICT DO UPDATE', () => {
  const sql = readMigration();
  assert.match(sql, /ON CONFLICT.*DO UPDATE/, 'Role_permissions must use DO UPDATE for idempotency');
});

test('Prisma schema defines InventoryRequest model with correct mapping', () => {
  const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  assert.match(schema, /model InventoryRequest/, 'Prisma schema must define InventoryRequest model');
  assert.match(schema, /@@map\("inventory_requests"\)/, 'Model must map to inventory_requests table');
});
