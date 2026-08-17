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

test('PUT /company/:roleId route exists and requires settings.manage permission', async () => {
  const guard = getRouteGuard(roleRoutes, '/company/:roleId', 'put');

  const deniedNoPermission = await runGuard(guard, {
    role: 'admin',
    companyId: '7',
    permissions: ['inventory.manage'],
  });
  assert.equal(deniedNoPermission?.statusCode, 403);

  const allowedWithSettingsManage = await runGuard(guard, {
    role: 'admin',
    companyId: '7',
    permissions: ['settings.manage'],
  });
  assert.equal(allowedWithSettingsManage, undefined);
});

test('PUT /company/:roleId denies actors without settings.manage even if they have users.manage', async () => {
  const guard = getRouteGuard(roleRoutes, '/company/:roleId', 'put');

  const denied = await runGuard(guard, {
    role: 'admin',
    companyId: '7',
    permissions: ['users.manage'],
  });
  assert.equal(denied?.statusCode, 403);
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
