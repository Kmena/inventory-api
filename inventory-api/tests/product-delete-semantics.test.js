const test = require('node:test');
const assert = require('node:assert/strict');

const productRepository = require('../src/repositories/product.repository');
const productService = require('../src/services/product.service');

function withRepositoryStubs(stubs, run) {
  const originals = new Map();

  for (const [key, value] of Object.entries(stubs)) {
    originals.set(key, productRepository[key]);
    productRepository[key] = value;
  }

  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [key, value] of originals.entries()) {
        productRepository[key] = value;
      }
    });
}

test('removeProduct rejects deleting a product outside the authenticated company', async () => {
  let deactivateCalled = false;

  await withRepositoryStubs(
    {
      findProductById: async () => null,
      deactivateCompanyProduct: async () => {
        deactivateCalled = true;
      },
    },
    async () => {
      await assert.rejects(
        () => productService.removeProduct(15n, { companyId: '8', sub: '2', permissions: ['products.manage'] }),
        (error) => {
          assert.equal(error.statusCode, 404);
          assert.equal(error.code, 'not_found');
          return true;
        },
      );
    },
  );

  assert.equal(deactivateCalled, false);
});

test('removeProduct converts DELETE compatibility flow into soft deactivation', async () => {
  let receivedDeactivate = null;

  const result = await withRepositoryStubs(
    {
      findProductById: async () => ({ id: 15n, companyId: 8n, isActive: true, name: 'Producto A' }),
      deactivateCompanyProduct: async (productId, companyId) => {
        receivedDeactivate = { productId, companyId };
        return { count: 1 };
      },
    },
    () => productService.removeProduct(15n, { companyId: '8', sub: '2', permissions: ['products.manage'] }),
  );

  assert.deepEqual(receivedDeactivate, { productId: 15n, companyId: 8n });
  assert.deepEqual(result, { count: 1 });
});
