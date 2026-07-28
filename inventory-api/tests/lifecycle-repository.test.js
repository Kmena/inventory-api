const test = require('node:test');
const assert = require('node:assert/strict');

const prisma = require('../src/lib/prisma');
const clientRepository = require('../src/repositories/client.repository');
const orderRepository = require('../src/repositories/order.repository');
const paymentRepository = require('../src/repositories/payment.repository');
const productRepository = require('../src/repositories/product.repository');
const salesRouteRepository = require('../src/repositories/sales-route.repository');

function withPrismaClientStubs(stubs, run) {
  const originals = [];

  for (const [scopeKey, scopeStubs] of Object.entries(stubs)) {
    const scope = prisma[scopeKey];
    for (const [methodName, methodImpl] of Object.entries(scopeStubs)) {
      originals.push([scope, methodName, scope[methodName]]);
      scope[methodName] = methodImpl;
    }
  }

  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [scope, methodName, original] of originals) {
        scope[methodName] = original;
      }
    });
}

test('findCompanyClients excludes soft-deleted clients from default reads', async () => {
  let receivedQuery = null;

  await withPrismaClientStubs(
    {
      client: {
        findMany: async (query) => {
          receivedQuery = query;
          return [];
        },
      },
    },
    () => clientRepository.findCompanyClients(42n),
  );

  assert.deepEqual(receivedQuery.where, { companyId: 42n, deletedAt: null });
});

test('findCompanyClientById excludes soft-deleted clients from detail reads', async () => {
  let receivedQuery = null;

  await withPrismaClientStubs(
    {
      client: {
        findFirst: async (query) => {
          receivedQuery = query;
          return null;
        },
      },
    },
    () => clientRepository.findCompanyClientById(9n, 42n),
  );

  assert.deepEqual(receivedQuery.where, { id: 9n, companyId: 42n, deletedAt: null });
});

test('findAllProducts excludes inactive products from default reads', async () => {
  let receivedQuery = null;

  await withPrismaClientStubs(
    {
      product: {
        findMany: async (query) => {
          receivedQuery = query;
          return [];
        },
      },
    },
    () => productRepository.findAllProducts(7n),
  );

  assert.deepEqual(receivedQuery.where, { companyId: 7n, isActive: true });
});

test('findProductById excludes inactive products from detail reads', async () => {
  let receivedQuery = null;

  await withPrismaClientStubs(
    {
      product: {
        findFirst: async (query) => {
          receivedQuery = query;
          return null;
        },
      },
    },
    () => productRepository.findProductById(5n, 7n),
  );

  assert.deepEqual(receivedQuery.where, { id: 5n, companyId: 7n, isActive: true });
});

test('updateClientDocument scopes the final mutation by document, client and tenant ownership', async () => {
  const operations = [];

  const updatedDocument = await withPrismaClientStubs(
    {
      clientDocument: {
        updateMany: async (query) => {
          operations.push({ step: 'updateMany', query });
          return { count: 1 };
        },
        findFirst: async (query) => {
          operations.push({ step: 'findFirst', query });
          return { id: 11n, clientId: 5n, status: 'ACTIVE' };
        },
      },
    },
    () => clientRepository.updateClientDocument(11n, 5n, 7n, { status: 'ARCHIVED' }),
  );

  assert.equal(updatedDocument.id, 11n);
  assert.deepEqual(operations[0].query.where, {
    id: 11n,
    clientId: 5n,
    client: { companyId: 7n },
  });
  assert.deepEqual(operations[1].query.where, {
    id: 11n,
    clientId: 5n,
    client: { companyId: 7n },
  });
});

test('deleteClientDocument scopes cleanup deletion by document, client and tenant ownership', async () => {
  const operations = [];
  const originalTransaction = prisma.$transaction;

  prisma.$transaction = async (callback) => callback({
    clientDocument: {
      findFirst: async (query) => {
        operations.push({ step: 'findFirst', query });
        return { id: 12n, clientId: 5n };
      },
      deleteMany: async (query) => {
        operations.push({ step: 'deleteMany', query });
        return { count: 1 };
      },
    },
  });

  try {
    const deletedDocument = await clientRepository.deleteClientDocument(12n, 5n, 7n);
    assert.equal(deletedDocument.id, 12n);
  } finally {
    prisma.$transaction = originalTransaction;
  }

  assert.deepEqual(operations[0].query.where, {
    id: 12n,
    clientId: 5n,
    client: { companyId: 7n },
  });
  assert.deepEqual(operations[1].query.where, {
    id: 12n,
    clientId: 5n,
    client: { companyId: 7n },
  });
});

test('updateOrder scopes the final mutation by order id and company id', async () => {
  const operations = [];

  const updatedOrder = await withPrismaClientStubs(
    {
      order: {
        updateMany: async (query) => {
          operations.push({ step: 'updateMany', query });
          return { count: 1 };
        },
        findFirst: async (query) => {
          operations.push({ step: 'findFirst', query });
          return { id: 30n, companyId: 7n, status: 'CANCELLED' };
        },
      },
    },
    () => orderRepository.updateOrder(30n, 7n, { status: 'CANCELLED' }),
  );

  assert.equal(updatedOrder.companyId, 7n);
  assert.deepEqual(operations[0].query.where, { id: 30n, companyId: 7n });
  assert.deepEqual(operations[1].query.where, { id: 30n, companyId: 7n });
});

test('deleteOrder scopes the final deletion by order id and company id', async () => {
  const operations = [];
  const originalTransaction = prisma.$transaction;

  prisma.$transaction = async (callback) => callback({
    order: {
      findFirst: async (query) => {
        operations.push({ step: 'findFirst', query });
        return { id: 31n, companyId: 7n };
      },
      deleteMany: async (query) => {
        operations.push({ step: 'deleteMany', query });
        return { count: 1 };
      },
    },
  });

  try {
    const deletedOrder = await orderRepository.deleteOrder(31n, 7n);
    assert.equal(deletedOrder.id, 31n);
  } finally {
    prisma.$transaction = originalTransaction;
  }

  assert.deepEqual(operations[0].query.where, { id: 31n, companyId: 7n });
  assert.deepEqual(operations[1].query.where, { id: 31n, companyId: 7n });
});

test('updateCompanyRoute scopes the final mutation by route id and company id', async () => {
  const operations = [];

  const updatedRoute = await withPrismaClientStubs(
    {
      salesRoute: {
        updateMany: async (query) => {
          operations.push({ step: 'updateMany', query });
          return { count: 1 };
        },
        findFirst: async (query) => {
          operations.push({ step: 'findFirst', query });
          return { id: 40n, companyId: 7n, code: 'R-40' };
        },
      },
    },
    () => salesRouteRepository.updateCompanyRoute(40n, 7n, { code: 'R-40' }),
  );

  assert.equal(updatedRoute.companyId, 7n);
  assert.deepEqual(operations[0].query.where, { id: 40n, companyId: 7n });
  assert.deepEqual(operations[1].query.where, { id: 40n, companyId: 7n });
});

test('findOrCreateLegalEntity keeps the update scoped to the tenant company', async () => {
  const operations = [];

  const legalEntity = await withPrismaClientStubs(
    {
      clientLegalEntity: {
        findFirst: async (query) => {
          operations.push({ step: 'findFirst', query });
          if (operations.length === 1) {
            return { id: 50n, companyId: 7n, legalName: 'Actual', identificationNumber: '1-01-0001' };
          }
          return { id: 50n, companyId: 7n, legalName: 'Actualizada' };
        },
        updateMany: async (query) => {
          operations.push({ step: 'updateMany', query });
          return { count: 1 };
        },
      },
    },
    () => clientRepository.findOrCreateLegalEntity(7n, {
      legalName: 'Actualizada',
      identificationNumber: '1-01-0001',
    }),
  );

  assert.equal(legalEntity.companyId, 7n);
  assert.deepEqual(operations[1].query.where, { id: 50n, companyId: 7n });
  assert.deepEqual(operations[2].query.where, { id: 50n, companyId: 7n });
});

test('markPaymentReceiptsAsReplaced scopes replacement to the payment tenant ownership', async () => {
  let receivedQuery = null;

  await withPrismaClientStubs(
    {
      paymentReceipt: {
        updateMany: async (query) => {
          receivedQuery = query;
          return { count: 1 };
        },
      },
    },
    () => paymentRepository.markPaymentReceiptsAsReplaced(60n, 7n, new Date('2026-07-27T12:00:00.000Z')),
  );

  assert.deepEqual(receivedQuery.where, {
    paymentId: 60n,
    isCurrent: true,
    payment: {
      invoice: {
        client: { companyId: 7n },
      },
    },
  });
});

test('updateProduct keeps the helper scoped to the tenant company', async () => {
  const operations = [];

  const updatedProduct = await withPrismaClientStubs(
    {
      product: {
        updateMany: async (query) => {
          operations.push({ step: 'updateMany', query });
          return { count: 1 };
        },
        findFirst: async (query) => {
          operations.push({ step: 'findFirst', query });
          return { id: 70n, companyId: 7n, isActive: true };
        },
      },
    },
    () => productRepository.updateProduct(70n, 7n, { name: 'Producto actualizado' }),
  );

  assert.equal(updatedProduct.companyId, 7n);
  assert.deepEqual(operations[0].query.where, { id: 70n, companyId: 7n, isActive: true });
  assert.deepEqual(operations[1].query.where, { id: 70n, companyId: 7n, isActive: true });
});
