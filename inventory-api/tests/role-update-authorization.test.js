const test = require('node:test');
const assert = require('node:assert/strict');

const roleRoutes = require('../src/routes/role.routes');

function getRouteGuard(router, path, method) {
  const layer = router.stack.find((entry) => entry.route && entry.route.path === path && entry.route.methods[method]);
  assert.ok(layer, `${method.toUpperCase()} route for ${path} should exist`);
  assert.ok(layer.route.stack.length >= 2, `${method.toUpperCase()} route for ${path} should include guard and handler`);
  return layer.route.stack[0].handle;
}

async function runGuard(guard, auth) {
  let nextError = 'not-called';
  await guard({ auth, requestContext: { requestId: 'req-role-update-auth-1' } }, {}, (error) => {
    nextError = error;
  });
  return nextError;
}

test('PUT /company/:roleId route requires roles.manage regardless of role code', async () => {
  const guard = getRouteGuard(roleRoutes, '/company/:roleId', 'put');

  const deniedAdmin = await runGuard(guard, {
    role: 'admin',
    companyId: '7',
    permissions: [],
  });
  assert.equal(deniedAdmin?.statusCode, 403);

  const allowedCustom = await runGuard(guard, {
    role: 'custom-operator',
    companyId: '7',
    permissions: ['roles.manage'],
  });
  assert.equal(allowedCustom, undefined);
});

test('GET and POST role routes use roles.view and roles.manage respectively', async () => {
  const listGuard = getRouteGuard(roleRoutes, '/company', 'get');
  const createGuard = getRouteGuard(roleRoutes, '/company', 'post');

  const listAllowed = await runGuard(listGuard, { role: 'custom', companyId: '7', permissions: ['roles.view'] });
  assert.equal(listAllowed, undefined);

  const createAllowed = await runGuard(createGuard, { role: 'custom', companyId: '7', permissions: ['roles.manage'] });
  assert.equal(createAllowed, undefined);

  const listDenied = await runGuard(listGuard, { role: 'admin', companyId: '7', permissions: [] });
  assert.equal(listDenied?.statusCode, 403);
});
