const test = require('node:test');
const assert = require('node:assert/strict');

const prisma = require('../src/lib/prisma');
const clientRepository = require('../src/repositories/client.repository');
const productRepository = require('../src/repositories/product.repository');

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
