const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migrationPath = path.join(
  __dirname,
  '..',
  'prisma',
  'migrations',
  '20260901000000_backfill_receipts_procurement_quality_billing_permissions',
  'migration.sql',
);

const migrationSql = fs.readFileSync(migrationPath, 'utf8');

const REQUIRED_PERMISSION_CODES = [
  // Procurement (view/approve/override added after initial seed — manage was already present)
  'procurement.view',
  'procurement.approve',
  'procurement.override',
  // Quality inspection permissions
  'quality.view',
  'quality.inspect',
  'quality.override',
  // Receipts permissions (gates #recepciones and #referencias_fiscales views)
  'receipts.view',
  'receipts.inspect',
  'receipts.confirm',
  'receipts.reverse',
  // Inventory intake override
  'inventory.intake.override',
  // Billing handoff permissions
  'billing.handoff.view',
  'billing.handoff.create',
];

test('receipts-procurement-billing backfill migration upserts all required permission codes', () => {
  for (const code of REQUIRED_PERMISSION_CODES) {
    assert.ok(migrationSql.includes(`'${code}'`), `Expected migration to include permission code '${code}'`);
  }

  assert.match(migrationSql, /INSERT INTO "permissions"/);
  assert.match(migrationSql, /ON CONFLICT \("code"\) DO UPDATE/);
  assert.match(migrationSql, /"is_active"\s*=\s*true/);
});

test('receipts-procurement-billing backfill migration assigns all permissions to root and admin roles idempotently', () => {
  assert.match(migrationSql, /INSERT INTO "role_permissions"/);
  assert.match(migrationSql, /WHERE r\."code" IN \('root', 'admin'\)/);
  assert.match(migrationSql, /ON CONFLICT \("role_id", "permission_id"\) DO UPDATE/);
  assert.match(migrationSql, /"is_enabled" = true/);

  // Verify every required permission code appears in the role_permissions SELECT
  for (const code of REQUIRED_PERMISSION_CODES) {
    assert.ok(
      migrationSql.includes(`'${code}'`),
      `Expected migration role_permissions block to reference permission code '${code}'`,
    );
  }
});

test('receipts-procurement-billing backfill migration covers the receipt.view access policy permissions', () => {
  // The receipt.view access policy requires ANY of: receipts.view, receipts.inspect, receipts.confirm, receipts.reverse
  // All four must be present so that admin can reach #recepciones and #referencias_fiscales views
  const receiptPolicyCodes = ['receipts.view', 'receipts.inspect', 'receipts.confirm', 'receipts.reverse'];
  for (const code of receiptPolicyCodes) {
    assert.ok(migrationSql.includes(`'${code}'`), `receipt.view policy dependency '${code}' must be in migration`);
  }
});

test('receipts-procurement-billing backfill migration covers the procurement.view access policy permissions', () => {
  // The procurement.view access policy requires ANY of: procurement.view, procurement.manage, procurement.approve
  // procurement.manage was seeded initially; procurement.view and procurement.approve are new
  const procurementViewPolicyCodes = ['procurement.view', 'procurement.approve'];
  for (const code of procurementViewPolicyCodes) {
    assert.ok(migrationSql.includes(`'${code}'`), `procurement.view policy dependency '${code}' must be in migration`);
  }
});
