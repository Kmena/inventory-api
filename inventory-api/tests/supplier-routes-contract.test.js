const test = require('node:test');
const assert = require('node:assert/strict');

process.env.BROWSER_SESSION_STORE_MODE = 'memory';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-supplier-routes';

const supplierRoutes = require('../src/routes/supplier.routes');

function getRouteLayer(path, method) {
  const layer = supplierRoutes.stack.find((entry) => entry.route && entry.route.path === path && entry.route.methods[method]);
  assert.ok(layer, `${method.toUpperCase()} route for ${path} should exist`);
  return layer.route.stack;
}

async function runGuard(guard, auth) {
  let nextError = 'not-called';
  await guard({ auth, requestContext: { requestId: 'req-supplier-routes-1' } }, {}, (error) => {
    nextError = error;
  });
  return nextError;
}

test('supplier routes expose all 7 approved CRUD and product-link endpoints', () => {
  assert.ok(getRouteLayer('/company', 'get').length >= 2);
  assert.ok(getRouteLayer('/company', 'post').length >= 3);
  assert.ok(getRouteLayer('/company/:id', 'get').length >= 2);
  assert.ok(getRouteLayer('/company/:id', 'put').length >= 3);
  assert.ok(getRouteLayer('/company/:id', 'delete').length >= 2);
  assert.ok(getRouteLayer('/company/:id/products', 'post').length >= 3);
  assert.ok(getRouteLayer('/company/:id/products/:productId', 'delete').length >= 2);
});

test('supplier routes enforce correct permission policies', async () => {
  const listGuard = getRouteLayer('/company', 'get')[0].handle;
  const createGuard = getRouteLayer('/company', 'post')[0].handle;
  const getGuard = getRouteLayer('/company/:id', 'get')[0].handle;
  const updateGuard = getRouteLayer('/company/:id', 'put')[0].handle;
  const deleteGuard = getRouteLayer('/company/:id', 'delete')[0].handle;
  const addProductGuard = getRouteLayer('/company/:id/products', 'post')[0].handle;
  const removeProductGuard = getRouteLayer('/company/:id/products/:productId', 'delete')[0].handle;

  // Deny with unrelated permissions
  assert.equal((await runGuard(listGuard, { companyId: '7', permissions: ['production.view'] }))?.statusCode, 403);
  assert.equal((await runGuard(createGuard, { companyId: '7', permissions: ['suppliers.view'] }))?.statusCode, 403);
  assert.equal((await runGuard(updateGuard, { companyId: '7', permissions: ['suppliers.view'] }))?.statusCode, 403);
  assert.equal((await runGuard(deleteGuard, { companyId: '7', permissions: ['suppliers.view'] }))?.statusCode, 403);
  assert.equal((await runGuard(addProductGuard, { companyId: '7', permissions: ['suppliers.view'] }))?.statusCode, 403);
  assert.equal((await runGuard(removeProductGuard, { companyId: '7', permissions: ['suppliers.view'] }))?.statusCode, 403);

  // Allow with correct permissions (supplier.view policy accepts suppliers.view or suppliers.manage)
  assert.equal(await runGuard(listGuard, { companyId: '7', permissions: ['suppliers.view'] }), undefined);
  assert.equal(await runGuard(getGuard, { companyId: '7', permissions: ['suppliers.view'] }), undefined);
  // supplier.manage policy requires suppliers.manage permission
  assert.equal(await runGuard(createGuard, { companyId: '7', permissions: ['suppliers.manage'] }), undefined);
  assert.equal(await runGuard(updateGuard, { companyId: '7', permissions: ['suppliers.manage'] }), undefined);
  assert.equal(await runGuard(deleteGuard, { companyId: '7', permissions: ['suppliers.manage'] }), undefined);
  assert.equal(await runGuard(addProductGuard, { companyId: '7', permissions: ['suppliers.manage'] }), undefined);
  assert.equal(await runGuard(removeProductGuard, { companyId: '7', permissions: ['suppliers.manage'] }), undefined);
});
