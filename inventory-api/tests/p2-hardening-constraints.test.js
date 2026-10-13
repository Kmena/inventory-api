const test = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient, Prisma } = require('@prisma/client');
const {
  assertDisposableDatabaseUrl,
  resolveFiscalDisposableDatabaseConfig,
  verifyFiscalDisposableDatabase,
} = require('./helpers/fiscal-disposable-database-guard');

const databaseUrl = process.env.P2_CONSTRAINTS_DATABASE_URL;

if (!databaseUrl) {
  test('P2 hardening constraints integration tests require P2_CONSTRAINTS_DATABASE_URL', { skip: true }, () => {});
  return;
}

const disposableDatabaseConfig = resolveFiscalDisposableDatabaseConfig(process.env);
assertDisposableDatabaseUrl(databaseUrl, 'P2_CONSTRAINTS_DATABASE_URL', disposableDatabaseConfig);

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
  categoryId: null,
  warehouseId: null,
  productId: null,
  invoiceId: null,
};

async function requireSingleRow(query) {
  const rows = await prisma.$queryRaw(query);

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

  const suffix = `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  const company = await prisma.company.create({ data: { name: `P2 Constraint ${suffix}` } });
  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      fullName: 'P2 Constraint Actor',
      username: `p2_constraint_${suffix}`,
      passwordHash: 'not-a-real-password',
      status: 'ACTIVE',
    },
  });
  const client = await prisma.client.create({
    data: { companyId: company.id, code: `P2-${suffix}`, name: 'P2 Constraint Client' },
  });
  const inventory = await prisma.inventory.create({ data: { companyId: company.id } });
  const category = await prisma.category.create({
    data: { inventoryId: inventory.id, name: `P2 Constraint ${suffix}` },
  });
  const warehouse = await prisma.warehouse.create({
    data: { companyId: company.id, code: `P2-${suffix}`, name: `P2 Constraint ${suffix}` },
  });
  const product = await prisma.product.create({
    data: {
      companyId: company.id,
      categoryId: category.id,
      createdByUserId: user.id,
      code: `P2-${suffix}`,
      name: 'P2 Constraint Product',
    },
  });
  const invoice = await prisma.invoice.create({
    data: { clientId: client.id, number: `P2-CONSTRAINT-${suffix}`, amount: 0 },
  });

  const companyId = company.id;
  const userId = user.id;
  const clientId = client.id;
  const inventoryId = inventory.id;
  const categoryId = category.id;
  const warehouseId = warehouse.id;
  const productId = product.id;
  const invoiceId = invoice.id;

  fixtureState.companyId = companyId;
  fixtureState.userId = userId;
  fixtureState.clientId = clientId;
  fixtureState.inventoryId = inventoryId;
  fixtureState.categoryId = categoryId;
  fixtureState.warehouseId = warehouseId;
  fixtureState.productId = productId;
  fixtureState.invoiceId = invoiceId;

  return fixtureState;
}

test.before(async () => {
  await prisma.$connect();
  await verifyFiscalDisposableDatabase(prisma, disposableDatabaseConfig);
  await ensureConstraintFixtures();
});

test.after(async () => {
  if (fixtureState.invoiceId) await prisma.invoice.deleteMany({ where: { id: fixtureState.invoiceId } });
  if (fixtureState.productId) await prisma.product.deleteMany({ where: { id: fixtureState.productId } });
  if (fixtureState.categoryId) await prisma.category.deleteMany({ where: { id: fixtureState.categoryId } });
  if (fixtureState.warehouseId) await prisma.warehouse.deleteMany({ where: { id: fixtureState.warehouseId } });
  if (fixtureState.clientId) await prisma.client.deleteMany({ where: { id: fixtureState.clientId } });
  if (fixtureState.inventoryId) await prisma.inventory.deleteMany({ where: { id: fixtureState.inventoryId } });
  if (fixtureState.userId) await prisma.user.deleteMany({ where: { id: fixtureState.userId } });
  if (fixtureState.companyId) await prisma.company.deleteMany({ where: { id: fixtureState.companyId } });
  await prisma.$disconnect();
});

test('allows a valid APPROVED payment with approval metadata (legacy ACTIVE alignment)', async () => {
  const { invoiceId } = await ensureConstraintFixtures();
  const { id: createdId } = await requireSingleRow(Prisma.sql`
    INSERT INTO payments (invoice_id, amount, payment_method, status, reference, approved_at, created_at, updated_at)
    VALUES (${invoiceId}, 1.00, 'CASH', 'APPROVED', 'constraint-valid-payment', NOW(), NOW(), NOW())
    RETURNING id
  `);

  await prisma.$executeRaw`DELETE FROM payments WHERE id = ${createdId}`;
});

test('rejects an APPROVED payment without approval metadata (legacy ACTIVE alignment)', async () => {
  const { invoiceId } = await ensureConstraintFixtures();

  await assertConstraintViolation(() => prisma.$executeRaw`
    INSERT INTO payments (
      invoice_id,
      amount,
      payment_method,
      status,
      created_at,
      updated_at
    )
    VALUES (${invoiceId}, 1.00, 'CASH', 'APPROVED', NOW(), NOW())
  `);
});

test('rejects a REVERSED payment without reversal metadata', async () => {
  const { invoiceId } = await ensureConstraintFixtures();

  await assertConstraintViolation(() => prisma.$executeRaw`
    INSERT INTO payments (invoice_id, amount, payment_method, status, created_at, updated_at)
    VALUES (${invoiceId}, 1.00, 'CASH', 'REVERSED', NOW(), NOW())
  `);
});

test('allows a valid approved order with approval metadata', async () => {
  const { companyId, userId } = await ensureConstraintFixtures();
  const { id: createdId } = await requireSingleRow(Prisma.sql`
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

  await prisma.$executeRaw`DELETE FROM orders WHERE id = ${createdId}`;
});

test('rejects an approved order without approval metadata', async () => {
  const { companyId, userId } = await ensureConstraintFixtures();

  await assertConstraintViolation(() => prisma.$executeRaw`
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
  `);
});

test('rejects an APPROVED order when approved = false', async () => {
  const { companyId, userId } = await ensureConstraintFixtures();

  await assertConstraintViolation(() => prisma.$executeRaw`
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
  `);
});

test('rejects negative product quantities', async () => {
  const { productId } = await ensureConstraintFixtures();

  await assertConstraintViolation(() => prisma.$executeRaw`
    UPDATE products
    SET quantity = -1
    WHERE id = ${productId}
  `);
});

test('rejects warehouse stock reservations above available quantity', async () => {
  const { inventoryId, productId } = await ensureConstraintFixtures();
  const { warehouseId } = fixtureState;

  await assertConstraintViolation(() => prisma.$executeRaw`
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
  `);
});
