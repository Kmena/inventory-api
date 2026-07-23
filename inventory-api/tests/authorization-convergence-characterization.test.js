const test = require('node:test');
const assert = require('node:assert/strict');

const roleRoutes = require('../src/routes/role.routes');
const regionRoutes = require('../src/routes/region.routes');
const warehouseRoutes = require('../src/routes/warehouse.routes');
const salesRouteRoutes = require('../src/routes/sales-route.routes');
const economicActivityRoutes = require('../src/routes/economic-activity.routes');

function getRouteGuard(router, path, method) {
  const layer = router.stack.find((entry) => entry.route && entry.route.path === path && entry.route.methods[method]);
  assert.ok(layer, `${method.toUpperCase()} route for ${path} should exist`);
  assert.ok(layer.route.stack.length >= 2, `${method.toUpperCase()} route for ${path} should include guard and handler`);
  return layer.route.stack[0].handle;
}

async function runGuard(guard, auth) {
  let nextError = 'not-called';
  await guard({ auth, requestContext: { requestId: 'req-auth-convergence-1' } }, {}, (error) => {
    nextError = error;
  });
  return nextError;
}

test('role administration routes stay company-admin-only through centralized access policies', async () => {
  const permissionsGuard = getRouteGuard(roleRoutes, '/permissions', 'get');
  const createRoleGuard = getRouteGuard(roleRoutes, '/company', 'post');

  const deniedPermissions = await runGuard(permissionsGuard, { role: 'sales', companyId: '7' });
  assert.equal(deniedPermissions?.statusCode, 403);

  const allowedPermissions = await runGuard(permissionsGuard, { role: 'admin', companyId: '7' });
  assert.equal(allowedPermissions, undefined);

  const deniedCreateRole = await runGuard(createRoleGuard, { role: 'warehouse', companyId: '7' });
  assert.equal(deniedCreateRole?.statusCode, 403);

  const allowedCreateRole = await runGuard(createRoleGuard, { role: 'admin', companyId: '7' });
  assert.equal(allowedCreateRole, undefined);
});

test('region administration routes stay company-admin-only through centralized access policies', async () => {
  const listGuard = getRouteGuard(regionRoutes, '/company', 'get');
  const subregionCreateGuard = getRouteGuard(regionRoutes, '/company/:regionId/subregions', 'post');

  const deniedList = await runGuard(listGuard, { role: 'sales', companyId: '7' });
  assert.equal(deniedList?.statusCode, 403);

  const allowedList = await runGuard(listGuard, { role: 'admin', companyId: '7' });
  assert.equal(allowedList, undefined);

  const deniedSubregionCreate = await runGuard(subregionCreateGuard, { role: 'sales', companyId: '7' });
  assert.equal(deniedSubregionCreate?.statusCode, 403);

  const allowedSubregionCreate = await runGuard(subregionCreateGuard, { role: 'admin', companyId: '7' });
  assert.equal(allowedSubregionCreate, undefined);
});

test('warehouse routes stay permission-governed through centralized access policies', async () => {
  const listGuard = getRouteGuard(warehouseRoutes, '/company', 'get');
  const createGuard = getRouteGuard(warehouseRoutes, '/company', 'post');

  const deniedList = await runGuard(listGuard, { role: 'admin', companyId: '7', permissions: ['sales.manage'] });
  assert.equal(deniedList?.statusCode, 403);

  const allowedList = await runGuard(listGuard, { role: 'warehouse', companyId: '7', permissions: ['inventory.view'] });
  assert.equal(allowedList, undefined);

  const deniedCreate = await runGuard(createGuard, { role: 'warehouse', companyId: '7', permissions: ['inventory.view'] });
  assert.equal(deniedCreate?.statusCode, 403);

  const allowedCreate = await runGuard(createGuard, { role: 'warehouse', companyId: '7', permissions: ['inventory.manage'] });
  assert.equal(allowedCreate, undefined);
});

test('sales-route administration routes stay limited to admin and sales_supervisor through centralized access policies', async () => {
  const listGuard = getRouteGuard(salesRouteRoutes, '/company', 'get');
  const goalsGuard = getRouteGuard(salesRouteRoutes, '/company/agents/:userId/goals', 'put');

  const deniedList = await runGuard(listGuard, { role: 'sales', companyId: '7' });
  assert.equal(deniedList?.statusCode, 403);

  const allowedSupervisorList = await runGuard(listGuard, { role: 'sales_supervisor', companyId: '7' });
  assert.equal(allowedSupervisorList, undefined);

  const deniedGoals = await runGuard(goalsGuard, { role: 'warehouse', companyId: '7' });
  assert.equal(deniedGoals?.statusCode, 403);

  const allowedAdminGoals = await runGuard(goalsGuard, { role: 'admin', companyId: '7' });
  assert.equal(allowedAdminGoals, undefined);
});

test('economic activity lookup keeps admin and sales restrictions through centralized access policies', async () => {
  const guard = getRouteGuard(economicActivityRoutes, '/', 'get');

  const denied = await runGuard(guard, { role: 'warehouse', companyId: '7' });
  assert.equal(denied?.statusCode, 403);

  const allowedSales = await runGuard(guard, { role: 'sales', companyId: '7' });
  assert.equal(allowedSales, undefined);
});
