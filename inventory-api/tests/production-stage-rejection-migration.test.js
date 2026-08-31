/**
 * TASK-001 — Migration test: production_stage_rejection_losses
 *
 * Verifies that:
 * - Column `status` exists in production_stage_executions (DEFAULT 'COMPLETED')
 * - Column `losses_acknowledged` exists in production_stage_executions (DEFAULT false)
 * - Column `losses_acknowledged_at` exists in production_stage_executions
 * - Table production_stage_losses exists with correct columns
 * - Prisma model ProductionStageLoss is accessible via prisma client
 * - CHECK constraint quantity > 0 is enforced
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const prisma = require('../src/lib/prisma');

test('production_stage_executions has status column with default COMPLETED', async () => {
  const result = await prisma.$queryRaw`
    SELECT column_name, column_default, is_nullable, character_maximum_length
    FROM information_schema.columns
    WHERE table_name = 'production_stage_executions'
      AND column_name = 'status'
  `;

  assert.equal(result.length, 1, 'Column status must exist in production_stage_executions');
  const col = result[0];
  assert.ok(
    col.column_default && col.column_default.includes('COMPLETED'),
    `Default must be 'COMPLETED', got: ${col.column_default}`,
  );
  assert.equal(col.is_nullable, 'NO', 'status column must be NOT NULL');
});

test('production_stage_executions has losses_acknowledged column with default false', async () => {
  const result = await prisma.$queryRaw`
    SELECT column_name, column_default, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_name = 'production_stage_executions'
      AND column_name = 'losses_acknowledged'
  `;

  assert.equal(result.length, 1, 'Column losses_acknowledged must exist in production_stage_executions');
  const col = result[0];
  assert.ok(
    col.column_default && col.column_default.includes('false'),
    `Default must be 'false', got: ${col.column_default}`,
  );
  assert.equal(col.is_nullable, 'NO', 'losses_acknowledged must be NOT NULL');
  assert.equal(col.data_type, 'boolean');
});

test('production_stage_executions has losses_acknowledged_at column (nullable timestamp)', async () => {
  const result = await prisma.$queryRaw`
    SELECT column_name, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_name = 'production_stage_executions'
      AND column_name = 'losses_acknowledged_at'
  `;

  assert.equal(result.length, 1, 'Column losses_acknowledged_at must exist');
  const col = result[0];
  assert.equal(col.is_nullable, 'YES', 'losses_acknowledged_at must be nullable');
  assert.ok(
    col.data_type === 'timestamp with time zone' || col.data_type === 'timestamp without time zone',
    `data_type must be timestamp, got: ${col.data_type}`,
  );
});

test('production_stage_losses table exists with required columns', async () => {
  const result = await prisma.$queryRaw`
    SELECT column_name, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_name = 'production_stage_losses'
    ORDER BY ordinal_position
  `;

  const colNames = result.map((r) => r.column_name);
  const required = [
    'id',
    'company_id',
    'production_order_id',
    'stage_execution_id',
    'product_id',
    'lot_id',
    'quantity',
    'reason_code',
    'note',
    'registered_by_user_id',
    'created_at',
  ];

  for (const name of required) {
    assert.ok(colNames.includes(name), `Column ${name} must exist in production_stage_losses`);
  }
});

test('production_stage_losses quantity CHECK constraint enforces quantity > 0', async () => {
  // PostgreSQL names the check constraint as production_stage_losses_quantity_check
  const result = await prisma.$queryRawUnsafe(`
    SELECT constraint_name, check_clause
    FROM information_schema.check_constraints
    WHERE constraint_schema = 'public'
      AND check_clause LIKE '%quantity%'
      AND check_clause LIKE '%0%'
  `);

  // Locate the check constraint for production_stage_losses (quantity > 0)
  const quantityCheck = result.find((r) =>
    r.constraint_name === 'production_stage_losses_quantity_check'
    || (r.check_clause && r.check_clause.includes('quantity') && r.check_clause.includes('> (0)')),
  );

  assert.ok(
    quantityCheck,
    `CHECK constraint (quantity > 0) must exist on production_stage_losses. Found constraints: ${JSON.stringify(result)}`,
  );
});

test('Prisma model ProductionStageLoss is accessible and typed', async () => {
  // Verify the model is accessible (not that it returns rows, since there are none yet)
  assert.ok(
    typeof prisma.productionStageLoss === 'object' && prisma.productionStageLoss !== null,
    'prisma.productionStageLoss must exist as a Prisma delegate',
  );
  assert.ok(
    typeof prisma.productionStageLoss.findMany === 'function',
    'prisma.productionStageLoss.findMany must be a function',
  );
  assert.ok(
    typeof prisma.productionStageLoss.create === 'function',
    'prisma.productionStageLoss.create must be a function',
  );
});

test('existing production_stage_executions rows have status=COMPLETED after migration', async () => {
  // If any rows exist, they must have the default status=COMPLETED
  const result = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
           COUNT(*) FILTER (WHERE status != 'COMPLETED')::int AS non_completed
    FROM production_stage_executions
  `;

  const stats = result[0];
  assert.equal(
    stats.non_completed,
    0,
    `All existing rows must have status='COMPLETED' after migration. Found ${stats.non_completed} rows with other status.`,
  );
});
