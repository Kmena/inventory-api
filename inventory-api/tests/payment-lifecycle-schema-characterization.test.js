const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const migrationPath = path.join(
  __dirname,
  '..',
  'prisma',
  'migrations',
  '20260720000000_expand_payment_lifecycle_and_receipts',
  'migration.sql',
);
const paymentRepositoryPath = path.join(__dirname, '..', 'src', 'repositories', 'payment.repository.js');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('payment lifecycle schema includes the approved runtime states and metadata fields', () => {
  const schema = read(schemaPath);

  assert.match(schema, /enum PaymentLifecycleStatus \{[\s\S]*DRAFT[\s\S]*PENDING_APPROVAL[\s\S]*UNDER_REVIEW[\s\S]*APPROVED[\s\S]*REJECTED[\s\S]*REVERSED[\s\S]*CANCELLED[\s\S]*\}/);
  assert.match(schema, /model Payment \{[\s\S]*submittedAt[\s\S]*underReviewAt[\s\S]*approvedAt[\s\S]*rejectedAt[\s\S]*reversedAt[\s\S]*cancelledAt[\s\S]*\}/);
  assert.match(schema, /model PaymentReceipt \{/);
  assert.match(schema, /storageRef/);
  assert.match(schema, /isCurrent/);
});

test('payment lifecycle migration documents backfill from legacy ACTIVE payments and adds private receipts storage', () => {
  const migration = read(migrationPath);

  assert.match(migration, /WHEN 'ACTIVE' THEN 'APPROVED'/);
  assert.match(migration, /CREATE TABLE "payment_receipts"/);
  assert.match(migration, /"storage_ref" TEXT NOT NULL/);
  assert.match(migration, /"submitted_at" TIMESTAMP\(3\) NOT NULL DEFAULT CURRENT_TIMESTAMP/);
  assert.match(migration, /"payments_lifecycle_metadata_consistency_chk"/);
});

test('payment repository exposes receipts together with tenant-scoped payment reads', () => {
  const repositorySource = read(paymentRepositoryPath);

  assert.match(repositorySource, /buildReceiptsOrderBy/);
  assert.match(repositorySource, /uploadedAt: 'desc'/);
  assert.match(repositorySource, /id: 'desc'/);
  assert.match(repositorySource, /invoice: true/);
});
