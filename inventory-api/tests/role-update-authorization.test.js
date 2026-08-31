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

// La politica role.company.update usa mode:'role', roles:['admin'] — igual que list y create.
// Solo el rol global 'admin' puede editar roles de empresa.

test('PUT /company/:roleId route allows the admin role regardless of permissions', async () => {
  const guard = getRouteGuard(roleRoutes, '/company/:roleId', 'put');

  const allowedAdmin = await runGuard(guard, {
    role: 'admin',
    companyId: '7',
    permissions: [],
  });
  assert.equal(allowedAdmin, undefined);
});

test('PUT /company/:roleId denies actors whose role is not admin (e.g. sales, warehouse)', async () => {
  const guard = getRouteGuard(roleRoutes, '/company/:roleId', 'put');

  const deniedSales = await runGuard(guard, {
    role: 'sales',
    companyId: '7',
    permissions: ['settings.manage'],
  });
  assert.equal(deniedSales?.statusCode, 403);

  const deniedWarehouse = await runGuard(guard, {
    role: 'warehouse',
    companyId: '7',
    permissions: ['settings.manage', 'users.manage'],
  });
  assert.equal(deniedWarehouse?.statusCode, 403);
});

test('existing GET and POST role routes remain unchanged', async () => {
  const listGuard = getRouteGuard(roleRoutes, '/company', 'get');
  const createGuard = getRouteGuard(roleRoutes, '/company', 'post');

  const listAllowed = await runGuard(listGuard, { role: 'admin', companyId: '7' });
  assert.equal(listAllowed, undefined);

  const createAllowed = await runGuard(createGuard, { role: 'admin', companyId: '7' });
  assert.equal(createAllowed, undefined);

  const listDenied = await runGuard(listGuard, { role: 'sales', companyId: '7' });
  assert.equal(listDenied?.statusCode, 403);
});
