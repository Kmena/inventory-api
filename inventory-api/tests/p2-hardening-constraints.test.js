const test = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');

const databaseUrl = process.env.P2_CONSTRAINTS_DATABASE_URL;

if (!databaseUrl) {
  test('P2 hardening constraints integration tests require P2_CONSTRAINTS_DATABASE_URL', { skip: true }, () => {});
  return;
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

const fixtureState = {
  companyId: null,
  userId: null,
  clientId: null,
  inventoryId: null,
  productId: null,
  invoiceId: null,
};

async function requireSingleRow(query) {
  const rows = await prisma.$queryRawUnsafe(query);

  assert.equal(Array.isArray(rows), true, `Expected array result for query: ${query}`);
  assert.equal(rows.length > 0, true, `Missing seeded row for query: ${query}`);

  return rows[0];
}

async function assertConstraintViolation(run) {
  await assert.rejects(run, (error) => {
    assert.equal(error?.code, 'P2010');
    assert.match(String(error?.message || ''), /violates check constraint/i);
    return true;
  });
}

async function ensureConstraintFixtures() {
  if (fixtureState.invoiceId && fixtureState.productId) {
    return fixtureState;
  }

  const { id: companyId } = await requireSingleRow('SELECT id FROM companies ORDER BY id LIMIT 1');
  const { id: userId } = await requireSingleRow('SELECT id FROM users WHERE company_id IS NOT NULL ORDER BY id LIMIT 1');
  const { id: clientId } = await requireSingleRow('SELECT id FROM clients ORDER BY id LIMIT 1');
  const { id: inventoryId } = await requireSingleRow('SELECT id FROM inventories ORDER BY id LIMIT 1');
  const { id: categoryId } = await requireSingleRow('SELECT id FROM categories ORDER BY id LIMIT 1');

  const { id: productId } = await requireSingleRow(`
    INSERT INTO products (
      company_id,
      category_id,
      created_by_user_id,
      code,
      name,
      quantity,
      reserved_quantity,
      created_at,
      updated_at
    )
    VALUES (${companyId}, ${categoryId}, ${userId}, 'P2-CONSTRAINT-FIXTURE', 'P2 Constraint Fixture Product', 0, 0, NOW(), NOW())
    ON CONFLICT (company_id, code)
    DO UPDATE SET
      category_id = EXCLUDED.category_id,
      created_by_user_id = EXCLUDED.created_by_user_id,
      name = EXCLUDED.name,
      updated_at = NOW()
    RETURNING id
  `);

  const { id: invoiceId } = await requireSingleRow(`
    INSERT INTO invoices (client_id, number, amount, created_at, updated_at)
    VALUES (${clientId}, 'P2-CONSTRAINT-FIXTURE-INVOICE', 0, NOW(), NOW())
    ON CONFLICT (number)
    DO UPDATE SET
      client_id = EXCLUDED.client_id,
      amount = EXCLUDED.amount,
      updated_at = NOW()
    RETURNING id
  `);

  fixtureState.companyId = companyId;
  fixtureState.userId = userId;
  fixtureState.clientId = clientId;
  fixtureState.inventoryId = inventoryId;
  fixtureState.productId = productId;
  fixtureState.invoiceId = invoiceId;

  return fixtureState;
}

test.before(async () => {
  await ensureConstraintFixtures();
});

test.after(async () => {
  await prisma.$disconnect();
});

test('allows a valid ACTIVE payment without reversal metadata', async () => {
  const { invoiceId } = await ensureConstraintFixtures();
  const { id: createdId } = await requireSingleRow(`
    INSERT INTO payments (invoice_id, amount, payment_method, status, reference, created_at, updated_at)
    VALUES (${invoiceId}, 1.00, 'CASH', 'ACTIVE', 'constraint-valid-payment', NOW(), NOW())
    RETURNING id
  `);

  await prisma.$executeRawUnsafe(`DELETE FROM payments WHERE id = ${createdId}`);
});

test('rejects an ACTIVE payment with reversal metadata', async () => {
  const { invoiceId, userId } = await ensureConstraintFixtures();

  await assertConstraintViolation(() => prisma.$executeRawUnsafe(`
    INSERT INTO payments (
      invoice_id,
      amount,
      payment_method,
      status,
      reversal_reason,
      reversed_at,
      reversed_by_user_id,
      created_at,
      updated_at
    )
    VALUES (${invoiceId}, 1.00, 'CASH', 'ACTIVE', 'should fail', NOW(), ${userId}, NOW(), NOW())
  `));
});

test('rejects a REVERSED payment without reversal metadata', async () => {
  const { invoiceId } = await ensureConstraintFixtures();

  await assertConstraintViolation(() => prisma.$executeRawUnsafe(`
    INSERT INTO payments (invoice_id, amount, payment_method, status, created_at, updated_at)
    VALUES (${invoiceId}, 1.00, 'CASH', 'REVERSED', NOW(), NOW())
  `));
});

test('allows a valid approved order with approval metadata', async () => {
  const { companyId, userId } = await ensureConstraintFixtures();
  const { id: createdId } = await requireSingleRow(`
    INSERT INTO orders (
      company_id,
      user_id,
      approved_by_id,
      approved,
      approved_at,
      down_payment,
      total,
      other_costs,
      status,
      created_at,
      updated_at
    )
    VALUES (${companyId}, ${userId}, ${userId}, true, NOW(), 0, 0, 0, 'APPROVED', NOW(), NOW())
    RETURNING id
  `);

  await prisma.$executeRawUnsafe(`DELETE FROM orders WHERE id = ${createdId}`);
});

test('rejects an approved order without approval metadata', async () => {
  const { companyId, userId } = await ensureConstraintFixtures();

  await assertConstraintViolation(() => prisma.$executeRawUnsafe(`
    INSERT INTO orders (
      company_id,
      user_id,
      approved,
      down_payment,
      total,
      other_costs,
      status,
      created_at,
      updated_at
    )
    VALUES (${companyId}, ${userId}, true, 0, 0, 0, 'APPROVED', NOW(), NOW())
  `));
});

test('rejects an APPROVED order when approved = false', async () => {
  const { companyId, userId } = await ensureConstraintFixtures();

  await assertConstraintViolation(() => prisma.$executeRawUnsafe(`
    INSERT INTO orders (
      company_id,
      user_id,
      approved,
      down_payment,
      total,
      other_costs,
      status,
      created_at,
      updated_at
    )
    VALUES (${companyId}, ${userId}, false, 0, 0, 0, 'APPROVED', NOW(), NOW())
  `));
});

test('rejects negative product quantities', async () => {
  const { productId } = await ensureConstraintFixtures();

  await assertConstraintViolation(() => prisma.$executeRawUnsafe(`
    UPDATE products
    SET quantity = -1
    WHERE id = ${productId}
  `));
});

test('rejects warehouse stock reservations above available quantity', async () => {
  const { inventoryId, productId } = await ensureConstraintFixtures();
  const { id: warehouseId } = await requireSingleRow('SELECT id FROM warehouses ORDER BY id LIMIT 1');

  await assertConstraintViolation(() => prisma.$executeRawUnsafe(`
    INSERT INTO warehouse_stocks (
      inventory_id,
      warehouse_id,
      product_id,
      quantity,
      reserved_quantity,
      created_at,
      updated_at
    )
    VALUES (${inventoryId}, ${warehouseId}, ${productId}, 1.000, 2.000, NOW(), NOW())
  `));
});
