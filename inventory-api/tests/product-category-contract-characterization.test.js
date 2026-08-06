const test = require('node:test');
const assert = require('node:assert/strict');

const productRoutes = require('../src/routes/product.routes');
const productService = require('../src/services/product.service');
const productRepository = require('../src/repositories/product.repository');
const { createCategorySchema } = require('../src/schemas/product.schema');

function getRouteGuard(router, path, method) {
  const layer = router.stack.find((entry) => entry.route && entry.route.path === path && entry.route.methods[method]);
  assert.ok(layer, `${method.toUpperCase()} route for ${path} should exist`);
  assert.ok(layer.route.stack.length >= 2, `${method.toUpperCase()} route for ${path} should include guard and handler`);
  return layer.route.stack[0].handle;
}

async function runGuard(guard, auth) {
  let nextError = 'not-called';
  await guard({ auth, requestContext: { requestId: 'req-product-category-auth-1' } }, {}, (error) => {
    nextError = error;
  });
  return nextError;
}

test('product category routes keep tenant-scoped permission guards', async () => {
  const listGuard = getRouteGuard(productRoutes, '/categories/company', 'get');
  const createGuard = getRouteGuard(productRoutes, '/categories/company', 'post');

  const allowedListError = await runGuard(listGuard, { role: 'admin', companyId: '7', permissions: ['products.view'] });
  assert.equal(allowedListError, undefined);

  const deniedCreateError = await runGuard(createGuard, { role: 'admin', companyId: '7', permissions: ['products.view'] });
  assert.equal(deniedCreateError?.statusCode, 403);

  const allowedCreateError = await runGuard(createGuard, { role: 'admin', companyId: '7', permissions: ['inventory.manage'] });
  assert.equal(allowedCreateError, undefined);
});

test('createCategorySchema only accepts approved category types', () => {
  assert.equal(createCategorySchema.safeParse({ name: 'Materia prima', categoryType: 'MP' }).success, true);
  assert.equal(createCategorySchema.safeParse({ name: 'Producto terminado', categoryType: 'PT' }).success, true);
  assert.equal(createCategorySchema.safeParse({ name: 'Empaque', categoryType: 'EM' }).success, true);
  assert.equal(createCategorySchema.safeParse({ name: 'Otro', categoryType: 'XX' }).success, false);
});

test('productService.listCategories rejects actors without company scope', async () => {
  await assert.rejects(
    () => productService.listCategories({ companyId: null, sub: '9' }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'forbidden');
      return true;
    },
  );
});

test('productService.listCategories returns empty list when company inventory is missing', async () => {
  const originalFindInventoryByCompanyId = productRepository.findInventoryByCompanyId;
  productRepository.findInventoryByCompanyId = async () => null;

  try {
    const categories = await productService.listCategories({ companyId: '77', sub: '9' });
    assert.deepEqual(categories, []);
  } finally {
    productRepository.findInventoryByCompanyId = originalFindInventoryByCompanyId;
  }
});

test('productService.createCategory creates a tenant category with normalized name', async () => {
  const originalFindInventoryByCompanyId = productRepository.findInventoryByCompanyId;
  const originalFindCategoryByName = productRepository.findCategoryByName;
  const originalCreateCategory = productRepository.createCategory;

  productRepository.findInventoryByCompanyId = async () => ({ id: 15n, companyId: 77n });
  productRepository.findCategoryByName = async () => null;
  productRepository.createCategory = async (data) => ({
    id: 88n,
    inventoryId: data.inventoryId,
    name: data.name,
    categoryType: data.categoryType,
    isActive: data.isActive,
    sortOrder: data.sortOrder,
    createdAt: new Date('2026-08-05T00:00:00.000Z'),
    updatedAt: new Date('2026-08-05T00:00:00.000Z'),
  });

  try {
    const category = await productService.createCategory({
      name: '  Materia   prima  ',
      categoryType: 'MP',
      sortOrder: 3,
    }, {
      companyId: '77',
      sub: '9',
    });

    assert.equal(category.inventoryId, 15n);
    assert.equal(category.name, 'Materia prima');
    assert.equal(category.categoryType, 'MP');
    assert.equal(category.sortOrder, 3);
    assert.equal(category.isActive, true);
  } finally {
    productRepository.findInventoryByCompanyId = originalFindInventoryByCompanyId;
    productRepository.findCategoryByName = originalFindCategoryByName;
    productRepository.createCategory = originalCreateCategory;
  }
});

test('productService.createCategory rejects duplicate tenant category names', async () => {
  const originalFindInventoryByCompanyId = productRepository.findInventoryByCompanyId;
  const originalFindCategoryByName = productRepository.findCategoryByName;

  productRepository.findInventoryByCompanyId = async () => ({ id: 15n, companyId: 77n });
  productRepository.findCategoryByName = async () => ({ id: 22n, inventoryId: 15n, name: 'Materia prima' });

  try {
    await assert.rejects(
      () => productService.createCategory({ name: ' materia prima ', categoryType: 'MP' }, { companyId: '77', sub: '9' }),
      (error) => {
        assert.equal(error.statusCode, 409);
        assert.equal(error.code, 'conflict');
        return true;
      },
    );
  } finally {
    productRepository.findInventoryByCompanyId = originalFindInventoryByCompanyId;
    productRepository.findCategoryByName = originalFindCategoryByName;
  }
});
