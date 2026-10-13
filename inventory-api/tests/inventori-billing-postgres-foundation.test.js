const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  configureFiscalDisposableDatabase,
  verifyFiscalDisposableDatabase,
} = require('./helpers/fiscal-disposable-database-guard');

const disposableDatabaseConfig = configureFiscalDisposableDatabase();
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const prisma = require('../src/lib/prisma');
const inventoryService = require('../src/services/inventory.service');
const { listRecoverableFiscalIntents } = require('../src/services/fiscal-intent-recovery.service');

const runOptions = { skip: !disposableDatabaseConfig };
const createdCompanyIds = [];

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildAuth(companyId, userId) {
  return { companyId: companyId.toString(), sub: userId.toString(), role: 'admin' };
}

async function createBaseCompanyFixture(label) {
  const suffix = uniqueSuffix();
  const company = await prisma.company.create({
    data: {
      name: `IBF ${label} ${suffix}`,
      legalId: `IBF-${suffix}`,
      email: `ibf-${suffix}@example.test`,
    },
  });
  createdCompanyIds.push(company.id);

  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      fullName: `IBF User ${suffix}`,
      username: `ibf-${label}-${suffix}`,
      passwordHash: 'not-used-in-test',
      email: `ibf-user-${suffix}@example.test`,
    },
  });

  const client = await prisma.client.create({
    data: {
      companyId: company.id,
      code: `IBF-C-${suffix}`,
      name: `IBF Client ${suffix}`,
      legalId: `3101${suffix.replace(/\D/g, '').padEnd(6, '0').slice(0, 6)}`,
      documentType: '02',
      emailBilling: `client-${suffix}@example.test`,
      paymentDays: 30,
    },
  });

  await prisma.companyBillingIntegrationConfig.create({
    data: {
      companyId: company.id,
      billingTenantId: `tenant-${suffix}`,
      billingCompanyId: `billing-company-${suffix}`,
      billingEnvironment: 'SANDBOX',
      billingCredentialSecretRef: 'env:BILLING_TEST_KEY',
      enabled: true,
    },
  });

  return { company, user, client, suffix };
}

async function createDispatchFixture() {
  const fixture = await createBaseCompanyFixture('dispatch');
  const inventory = await prisma.inventory.create({ data: { companyId: fixture.company.id } });
  const warehouse = await prisma.warehouse.create({
    data: {
      companyId: fixture.company.id,
      code: `IBF-W-${fixture.suffix}`,
      name: `IBF Warehouse ${fixture.suffix}`,
      isSellableSource: true,
      isActive: true,
    },
  });
  const product = await prisma.product.create({
    data: {
      companyId: fixture.company.id,
      code: `IBF-P-${fixture.suffix}`,
      name: `IBF Product ${fixture.suffix}`,
      unit: 'UN',
      cabysCode: '1234567890123',
      currency: 'CRC',
      price: 1000,
      quantity: 10,
      controlsInventory: true,
      lotStrategy: 'NONE',
      taxExempt: false,
      taxRate: 13,
    },
  });
  await prisma.warehouseStock.create({
    data: {
      inventoryId: inventory.id,
      warehouseId: warehouse.id,
      productId: product.id,
      quantity: 10,
      reservedQuantity: 0,
    },
  });
  const order = await prisma.order.create({
    data: {
      companyId: fixture.company.id,
      clientId: fixture.client.id,
      warehouseId: warehouse.id,
      paymentCondition: 'CASH',
      status: 'DRAFT',
      items: {
        create: [{
          productId: product.id,
          quantity: 2,
          unitPrice: 1000,
          discountPercent: 0,
          discountAmount: 0,
          totalDiscount: 0,
        }],
      },
    },
    include: { items: true },
  });
  return { ...fixture, inventory, warehouse, product, order };
}

async function cleanupCreatedCompanies() {
  for (const companyId of [...createdCompanyIds].reverse()) {
    await prisma.payment.deleteMany({ where: { invoice: { client: { companyId } } } });
    await prisma.invoiceFiscalIntent.deleteMany({ where: { companyId } });
    await prisma.invoiceFiscalSnapshot.deleteMany({ where: { companyId } });
    await prisma.invoiceItem.deleteMany({ where: { companyId } });
    await prisma.invoice.deleteMany({ where: { client: { companyId } } });
    await prisma.stockMovement.deleteMany({ where: { companyId } });
    await prisma.orderItem.deleteMany({ where: { order: { companyId } } });
    await prisma.order.deleteMany({ where: { companyId } });
    await prisma.warehouseStock.deleteMany({ where: { warehouse: { companyId } } });
    await prisma.product.deleteMany({ where: { companyId } });
    await prisma.warehouse.deleteMany({ where: { companyId } });
    await prisma.companyBillingIntegrationConfig.deleteMany({ where: { companyId } });
    await prisma.client.deleteMany({ where: { companyId } });
    await prisma.inventory.deleteMany({ where: { companyId } });
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  }
  createdCompanyIds.length = 0;
}

before(async () => {
  if (!runOptions.skip) {
    await prisma.$connect();
    await verifyFiscalDisposableDatabase(prisma, disposableDatabaseConfig);
  }
});

after(async () => {
  if (!runOptions.skip) {
    await cleanupCreatedCompanies();
    await prisma.$disconnect();
  }
});

describe('Inventori Billing PostgreSQL foundation gate', runOptions, () => {
  test('actual database has non-null invoice.order_id uniqueness invariant', async () => {
    const indexes = await prisma.$queryRaw`
      SELECT i.relname AS index_name,
             ix.indisunique AS is_unique,
             pg_get_indexdef(ix.indexrelid) AS definition
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      WHERE t.relname = 'invoices'
        AND pg_get_indexdef(ix.indexrelid) ILIKE '%order_id%'
      ORDER BY i.relname
    `;

    const uniqueOrderIndex = indexes.find((index) => index.index_name === 'invoices_order_id_unique');
    assert.ok(uniqueOrderIndex, 'invoices_order_id_unique must exist in PostgreSQL metadata');
    assert.equal(uniqueOrderIndex.is_unique, true);
    assert.match(uniqueOrderIndex.definition, /CREATE UNIQUE INDEX/);
    assert.match(uniqueOrderIndex.definition, /\(order_id\)/);
  });

  test('two concurrent invoice creates for the same order persist one invoice only', async () => {
    const fixture = await createBaseCompanyFixture('concurrency');
    const order = await prisma.order.create({
      data: {
        companyId: fixture.company.id,
        clientId: fixture.client.id,
        paymentCondition: 'CASH',
        status: 'DRAFT',
        approved: false,
      },
    });

    const attempts = await Promise.allSettled([
      prisma.invoice.create({ data: { clientId: fixture.client.id, orderId: order.id, number: `IBF-CON-A-${fixture.suffix}`, amount: 1 } }),
      prisma.invoice.create({ data: { clientId: fixture.client.id, orderId: order.id, number: `IBF-CON-B-${fixture.suffix}`, amount: 1 } }),
    ]);

    const persistedCount = await prisma.invoice.count({ where: { orderId: order.id } });
    assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter((attempt) => attempt.status === 'rejected').length, 1);
    assert.equal(persistedCount, 1);
  });

  test('complete dispatch commits inventory movement, invoice, fiscal snapshot and fiscal intent atomically', async () => {
    const fixture = await createDispatchFixture();
    const auth = buildAuth(fixture.company.id, fixture.user.id);

    await inventoryService.reserveStockForOrder(fixture.order.id, auth);
    const dispatchedOrder = await inventoryService.dispatchOrder(fixture.order.id, auth);

    const [order, outMovements, invoiceCount, snapshotCount, intents] = await Promise.all([
      prisma.order.findUnique({ where: { id: fixture.order.id } }),
      prisma.stockMovement.findMany({ where: { companyId: fixture.company.id, sourceId: fixture.order.id, movementType: 'OUT' } }),
      prisma.invoice.count({ where: { orderId: fixture.order.id } }),
      prisma.invoiceFiscalSnapshot.count({ where: { orderId: fixture.order.id } }),
      prisma.invoiceFiscalIntent.findMany({ where: { companyId: fixture.company.id }, include: { invoice: true } }),
    ]);

    assert.equal(dispatchedOrder.status, 'DELIVERED');
    assert.equal(order.status, 'DELIVERED');
    assert.equal(outMovements.length, 1);
    assert.equal(invoiceCount, 1);
    assert.equal(snapshotCount, 1);
    assert.equal(intents.length, 1);
    assert.equal(intents[0].idempotencyKey, `inventori:${fixture.company.id.toString()}:invoice:${intents[0].invoiceId.toString()}`);
  });

  test('failure before transaction commit rolls back invoice, snapshot and fiscal intent', async () => {
    const fixture = await createBaseCompanyFixture('rollback');
    const order = await prisma.order.create({
      data: {
        companyId: fixture.company.id,
        clientId: fixture.client.id,
        paymentCondition: 'CASH',
        status: 'DRAFT',
        approved: false,
      },
    });

    await assert.rejects(
      prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.create({
          data: { clientId: fixture.client.id, orderId: order.id, number: `IBF-ROLLBACK-${fixture.suffix}`, amount: 1 },
        });
        await tx.invoiceFiscalSnapshot.create({
          data: {
            companyId: fixture.company.id,
            orderId: order.id,
            invoiceId: invoice.id,
            receiverSourceType: 'CLIENT',
            receiverSourceId: fixture.client.id,
            currency: 'CRC',
            saleCondition: '01',
            headerSnapshot: {},
            receiverSnapshot: {},
            linesSnapshot: [],
            totalsSnapshot: {},
            mappingVersion: 'rollback-test',
          },
        });
        await tx.invoiceFiscalIntent.create({
          data: {
            companyId: fixture.company.id,
            invoiceId: invoice.id,
            billingIntegrationConfigId: (await tx.companyBillingIntegrationConfig.findUnique({ where: { companyId: fixture.company.id } })).id,
            idempotencyKey: `inventori:${fixture.company.id.toString()}:invoice:${invoice.id.toString()}`,
          },
        });
        throw new Error('simulate failure before commit');
      }),
      /simulate failure before commit/,
    );

    assert.equal(await prisma.invoice.count({ where: { orderId: order.id } }), 0);
    assert.equal(await prisma.invoiceFiscalSnapshot.count({ where: { orderId: order.id } }), 0);
    assert.equal(await prisma.invoiceFiscalIntent.count({ where: { companyId: fixture.company.id } }), 0);
  });

  test('committed fiscal intent is rediscovered after recovery boundary with stable idempotency key', async () => {
    const fixture = await createDispatchFixture();
    const auth = buildAuth(fixture.company.id, fixture.user.id);

    await inventoryService.reserveStockForOrder(fixture.order.id, auth);
    await inventoryService.dispatchOrder(fixture.order.id, auth);

    const recoverableIntents = await listRecoverableFiscalIntents(fixture.company.id);
    assert.equal(recoverableIntents.length, 1);
    assert.equal(recoverableIntents[0].status, 'PENDING');
    assert.equal(
      recoverableIntents[0].idempotencyKey,
      `inventori:${fixture.company.id.toString()}:invoice:${recoverableIntents[0].invoiceId.toString()}`,
    );
    assert.ok(recoverableIntents[0].invoice.fiscalSnapshot, 'recovery query must include immutable snapshot');
  });
});
