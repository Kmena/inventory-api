const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.BROWSER_SESSION_STORE_MODE = 'memory';

const roleRoutes = require('../src/routes/role.routes');
const roleService = require('../src/services/role.service');

function getPermissionsHandler() {
  const layer = roleRoutes.stack.find((entry) => entry.route && entry.route.path === '/permissions' && entry.route.methods.get);
  assert.ok(layer, 'GET /permissions route should exist');
  assert.ok(layer.route.stack.length >= 2, 'GET /permissions should include guard and handler');
  return layer.route.stack[1].handle;
}

test('GET /api/roles/permissions returns the production permission catalog exposed by the service', async () => {
  const handler = getPermissionsHandler();
  const originalListPermissions = roleService.listPermissions;

  const expectedPayload = [
    { code: 'recipes.view', moduleCategory: 'production', displayLabel: 'Ver recetas y versiones' },
    { code: 'production.view', moduleCategory: 'production', displayLabel: 'Ver órdenes de producción' },
    { code: 'production.execute', moduleCategory: 'production', displayLabel: 'Ejecutar producción' },
  ];

  roleService.listPermissions = async () => expectedPayload;

  const res = {
    body: undefined,
    json(payload) {
      this.body = payload;
      return payload;
    },
  };

  try {
    await handler({ auth: { companyId: '7' } }, res, (error) => { throw error; });
    assert.deepEqual(res.body, expectedPayload);
  } finally {
    roleService.listPermissions = originalListPermissions;
  }
});
