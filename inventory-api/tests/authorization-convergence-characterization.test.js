const test = require('node:test');
const assert = require('node:assert/strict');

process.env.BROWSER_SESSION_STORE_MODE = 'memory';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-authorization-convergence';

const roleRoutes = require('../src/routes/role.routes');
const regionRoutes = require('../src/routes/region.routes');
const warehouseRoutes = require('../src/routes/warehouse.routes');
const salesRouteRoutes = require('../src/routes/sales-route.routes');
const economicActivityRoutes = require('../src/routes/economic-activity.routes');
const productRoutes = require('../src/routes/product.routes');
const inventoryRoutes = require('../src/routes/inventory.routes');
const agentRoutes = require('../src/routes/agent.routes');
const orderRoutes = require('../src/routes/order.routes');

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
  const subzonesUpdateGuard = getRouteGuard(salesRouteRoutes, '/company/:routeId/subzones', 'put');
  const subzoneDeleteGuard = getRouteGuard(salesRouteRoutes, '/company/:routeId/subzones/:subzoneId', 'delete');
  const goalsGuard = getRouteGuard(salesRouteRoutes, '/company/agents/:userId/goals', 'put');

  const deniedList = await runGuard(listGuard, { role: 'sales', companyId: '7' });
  assert.equal(deniedList?.statusCode, 403);

  const allowedSupervisorList = await runGuard(listGuard, { role: 'sales_supervisor', companyId: '7' });
  assert.equal(allowedSupervisorList, undefined);

  const deniedSubzonesUpdate = await runGuard(subzonesUpdateGuard, { role: 'warehouse', companyId: '7' });
  assert.equal(deniedSubzonesUpdate?.statusCode, 403);

  const allowedAdminSubzonesUpdate = await runGuard(subzonesUpdateGuard, { role: 'admin', companyId: '7' });
  assert.equal(allowedAdminSubzonesUpdate, undefined);

  const deniedSubzoneDelete = await runGuard(subzoneDeleteGuard, { role: 'sales', companyId: '7' });
  assert.equal(deniedSubzoneDelete?.statusCode, 403);

  const allowedSupervisorSubzoneDelete = await runGuard(subzoneDeleteGuard, { role: 'sales_supervisor', companyId: '7' });
  assert.equal(allowedSupervisorSubzoneDelete, undefined);

  const deniedGoals = await runGuard(goalsGuard, { role: 'warehouse', companyId: '7' });
  assert.equal(deniedGoals?.statusCode, 403);

  const allowedAdminGoals = await runGuard(goalsGuard, { role: 'admin', companyId: '7' });
  assert.equal(allowedAdminGoals, undefined);
});

test('product routes stay permission-governed through centralized access policies', async () => {
  const listGuard = getRouteGuard(productRoutes, '/', 'get');
  const createGuard = getRouteGuard(productRoutes, '/', 'post');
  const deleteGuard = getRouteGuard(productRoutes, '/:id', 'delete');

  const deniedList = await runGuard(listGuard, { role: 'sales', companyId: '7', permissions: ['inventory.view'] });
  assert.equal(deniedList?.statusCode, 403);

  const allowedList = await runGuard(listGuard, { role: 'catalog-viewer', companyId: '7', permissions: ['products.view'] });
  assert.equal(allowedList, undefined);

  const deniedCreate = await runGuard(createGuard, { role: 'catalog-viewer', companyId: '7', permissions: ['products.view'] });
  assert.equal(deniedCreate?.statusCode, 403);

  const allowedCreate = await runGuard(createGuard, { role: 'catalog-manager', companyId: '7', permissions: ['products.manage'] });
  assert.equal(allowedCreate, undefined);

  const deniedDelete = await runGuard(deleteGuard, { role: 'catalog-import', companyId: '7', permissions: ['products.import'] });
  assert.equal(deniedDelete?.statusCode, 403);

  const allowedDelete = await runGuard(deleteGuard, { role: 'catalog-manager', companyId: '7', permissions: ['products.manage'] });
  assert.equal(allowedDelete, undefined);
});

test('inventory routes keep explicit permission boundaries for view, status update, and QA actions', async () => {
  const alertsGuard = getRouteGuard(inventoryRoutes, '/alerts', 'get');
  const alertStatusGuard = getRouteGuard(inventoryRoutes, '/alerts/:id/status', 'patch');
  const lotQaGuard = getRouteGuard(inventoryRoutes, '/lots/:id/qa', 'patch');

  const deniedAlerts = await runGuard(alertsGuard, { role: 'warehouse', companyId: '7', permissions: ['sales.manage'] });
  assert.equal(deniedAlerts?.statusCode, 403);

  const allowedAlerts = await runGuard(alertsGuard, { role: 'warehouse', companyId: '7', permissions: ['inventory.view'] });
  assert.equal(allowedAlerts, undefined);

  const deniedAlertStatus = await runGuard(alertStatusGuard, { role: 'warehouse', companyId: '7', permissions: ['inventory.view'] });
  assert.equal(deniedAlertStatus?.statusCode, 403);

  const allowedAlertStatus = await runGuard(alertStatusGuard, { role: 'warehouse', companyId: '7', permissions: ['inventory.manage'] });
  assert.equal(allowedAlertStatus, undefined);

  const deniedLotQa = await runGuard(lotQaGuard, { role: 'warehouse', companyId: '7', permissions: ['inventory.manage'] });
  assert.equal(deniedLotQa?.statusCode, 403);

  const allowedLotQa = await runGuard(lotQaGuard, { role: 'quality', companyId: '7', permissions: ['inventory.qa.manage'] });
  assert.equal(allowedLotQa, undefined);
});

test('agent workspace routes stay explicit through centralized access policies without changing the commercial-agent token contract', async () => {
  const dashboardGuard = getRouteGuard(agentRoutes, '/dashboard', 'get');
  const visitCreateGuard = getRouteGuard(agentRoutes, '/visits', 'post');
  const orderCreateGuard = getRouteGuard(agentRoutes, '/stores/:storeId/orders', 'post');

  const deniedSupervisor = await runGuard(dashboardGuard, {
    role: 'sales_supervisor',
    companyId: '7',
    sub: '15',
    permissions: ['sales.orders.create', 'sales.routes.view.all', 'customer.activities.manage'],
  });
  assert.equal(deniedSupervisor?.statusCode, 403);

  const deniedMissingActivityPermission = await runGuard(visitCreateGuard, {
    role: 'sales',
    companyId: '7',
    sub: '15',
    permissions: ['sales.orders.create', 'sales.routes.view.own'],
  });
  assert.equal(deniedMissingActivityPermission?.statusCode, 403);

  const allowedSalesAgent = await runGuard(orderCreateGuard, {
    role: 'sales_agent',
    companyId: '7',
    sub: '15',
    permissions: ['sales.orders.create', 'sales.routes.view.own', 'customer.activities.manage'],
  });
  assert.equal(allowedSalesAgent, undefined);

  const allowedCustomAgent = await runGuard(dashboardGuard, {
    role: 'sales',
    companyId: '7',
    sub: '15',
    permissions: ['sales.orders.create', 'sales.routes.view.own', 'customer.activities.manage'],
  });
  assert.equal(allowedCustomAgent, undefined);
});

test('order routes keep their documented access-policy split between role-governed legacy operations and permission-governed draft mutations', async () => {
  const listGuard = getRouteGuard(orderRoutes, '/', 'get');
  const createGuard = getRouteGuard(orderRoutes, '/', 'post');
  const approveGuard = getRouteGuard(orderRoutes, '/:id/approve', 'post');
  const dispatchGuard = getRouteGuard(orderRoutes, '/:id/dispatch', 'post');

  const deniedList = await runGuard(listGuard, { role: 'sales_agent', companyId: '7', permissions: ['sales.orders.create'] });
  assert.equal(deniedList?.statusCode, 403);

  const allowedLegacySalesList = await runGuard(listGuard, { role: 'sales', companyId: '7' });
  assert.equal(allowedLegacySalesList, undefined);

  const deniedCreate = await runGuard(createGuard, { role: 'sales', companyId: '7', permissions: ['clients.view'] });
  assert.equal(deniedCreate?.statusCode, 403);

  const allowedCreate = await runGuard(createGuard, { role: 'sales', companyId: '7', permissions: ['sales.orders.create'] });
  assert.equal(allowedCreate, undefined);

  const deniedApprove = await runGuard(approveGuard, { role: 'warehouse', companyId: '7' });
  assert.equal(deniedApprove?.statusCode, 403);

  const allowedApprove = await runGuard(approveGuard, { role: 'sales', companyId: '7' });
  assert.equal(allowedApprove, undefined);

  const deniedDispatch = await runGuard(dispatchGuard, { role: 'sales', companyId: '7' });
  assert.equal(deniedDispatch?.statusCode, 403);

  const allowedDispatch = await runGuard(dispatchGuard, { role: 'warehouse', companyId: '7' });
  assert.equal(allowedDispatch, undefined);
});

test('economic activity lookup keeps admin and sales restrictions through centralized access policies', async () => {
  const guard = getRouteGuard(economicActivityRoutes, '/', 'get');

  const denied = await runGuard(guard, { role: 'warehouse', companyId: '7' });
  assert.equal(denied?.statusCode, 403);

  const allowedSales = await runGuard(guard, { role: 'sales', companyId: '7' });
  assert.equal(allowedSales, undefined);
});
