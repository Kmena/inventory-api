const test = require('node:test');
const assert = require('node:assert/strict');

process.env.BROWSER_SESSION_STORE_MODE = 'memory';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-production-routes';

const productionRoutes = require('../src/routes/production.routes');

function getRouteLayer(path, method) {
  const layer = productionRoutes.stack.find((entry) => entry.route && entry.route.path === path && entry.route.methods[method]);
  assert.ok(layer, `${method.toUpperCase()} route for ${path} should exist`);
  return layer.route.stack;
}

async function runGuard(guard, auth) {
  let nextError = 'not-called';
  await guard({ auth, requestContext: { requestId: 'req-production-routes-1' } }, {}, (error) => {
    nextError = error;
  });
  return nextError;
}

test('production routes expose the approved foundational lifecycle endpoints', () => {
  assert.ok(getRouteLayer('/orders', 'get').length >= 2);
  assert.ok(getRouteLayer('/orders', 'post').length >= 3);
  assert.ok(getRouteLayer('/orders/:id', 'get').length >= 2);
  assert.ok(getRouteLayer('/orders/:id/material-requirements', 'get').length >= 2);
  assert.ok(getRouteLayer('/orders/:id/stages/:stageId/available-lots', 'get').length >= 2);
  assert.ok(getRouteLayer('/orders/:id/submit', 'post').length >= 2);
  assert.ok(getRouteLayer('/orders/:id/approve', 'post').length >= 3);
  assert.ok(getRouteLayer('/orders/:id/start', 'post').length >= 2);
  assert.ok(getRouteLayer('/orders/:id/stages/:stageId/execute', 'post').length >= 3);
  assert.ok(getRouteLayer('/orders/:id/stages/:stageId/returns', 'post').length >= 3);
  assert.ok(getRouteLayer('/orders/:id/cancel', 'post').length >= 2);
  // TASK-009: QA per-stage endpoint must exist
  assert.ok(getRouteLayer('/orders/:id/stages/:stageId/inspections', 'post').length >= 3,
    'POST /orders/:id/stages/:stageId/inspections must exist and be governed');
  assert.ok(getRouteLayer('/orders/:id/inspections', 'get').length >= 2,
    'GET /orders/:id/inspections must exist and be governed');
});

test('production routes stay permission-governed through centralized access policies', async () => {
  const createGuard = getRouteLayer('/orders', 'post')[0].handle;
  const materialRequirementsGuard = getRouteLayer('/orders/:id/material-requirements', 'get')[0].handle;
  const availableLotsGuard = getRouteLayer('/orders/:id/stages/:stageId/available-lots', 'get')[0].handle;
  const approveGuard = getRouteLayer('/orders/:id/approve', 'post')[0].handle;
  const startGuard = getRouteLayer('/orders/:id/start', 'post')[0].handle;
  const executeStageGuard = getRouteLayer('/orders/:id/stages/:stageId/execute', 'post')[0].handle;
  const returnsGuard = getRouteLayer('/orders/:id/stages/:stageId/returns', 'post')[0].handle;
  const cancelGuard = getRouteLayer('/orders/:id/cancel', 'post')[0].handle;

  const deniedCreate = await runGuard(createGuard, { role: 'warehouse', companyId: '7', permissions: ['production.view'] });
  assert.equal(deniedCreate?.statusCode, 403);

  const deniedMaterialRequirements = await runGuard(materialRequirementsGuard, { role: 'warehouse', companyId: '7', permissions: ['inventory.view'] });
  assert.equal(deniedMaterialRequirements?.statusCode, 403);

  const deniedAvailableLots = await runGuard(availableLotsGuard, { role: 'warehouse', companyId: '7', permissions: ['production.view'] });
  assert.equal(deniedAvailableLots?.statusCode, 403);

  const deniedApprove = await runGuard(approveGuard, { role: 'production-manager', companyId: '7', permissions: ['production.create'] });
  assert.equal(deniedApprove?.statusCode, 403);

  const deniedStart = await runGuard(startGuard, { role: 'production-manager', companyId: '7', permissions: ['production.approve'] });
  assert.equal(deniedStart?.statusCode, 403);

  const deniedExecuteStage = await runGuard(executeStageGuard, { role: 'production-manager', companyId: '7', permissions: ['production.approve'] });
  assert.equal(deniedExecuteStage?.statusCode, 403);

  const deniedReturns = await runGuard(returnsGuard, { role: 'production-manager', companyId: '7', permissions: ['production.approve'] });
  assert.equal(deniedReturns?.statusCode, 403);

  const deniedCancel = await runGuard(cancelGuard, { role: 'production-manager', companyId: '7', permissions: ['production.execute'] });
  assert.equal(deniedCancel?.statusCode, 403);

  const allowedCreate = await runGuard(createGuard, { role: 'production-manager', companyId: '7', permissions: ['production.create'] });
  assert.equal(allowedCreate, undefined);

  const allowedMaterialRequirements = await runGuard(materialRequirementsGuard, { role: 'production-manager', companyId: '7', permissions: ['production.view'] });
  assert.equal(allowedMaterialRequirements, undefined);

  const allowedAvailableLots = await runGuard(availableLotsGuard, { role: 'production-manager', companyId: '7', permissions: ['production.execute'] });
  assert.equal(allowedAvailableLots, undefined);

  const allowedApprove = await runGuard(approveGuard, { role: 'production-manager', companyId: '7', permissions: ['production.approve'] });
  assert.equal(allowedApprove, undefined);

  const allowedStart = await runGuard(startGuard, { role: 'production-manager', companyId: '7', permissions: ['production.execute'] });
  assert.equal(allowedStart, undefined);

  const allowedExecuteStage = await runGuard(executeStageGuard, { role: 'production-manager', companyId: '7', permissions: ['production.execute'] });
  assert.equal(allowedExecuteStage, undefined);

  const allowedReturns = await runGuard(returnsGuard, { role: 'production-manager', companyId: '7', permissions: ['production.execute'] });
  assert.equal(allowedReturns, undefined);

  const allowedCancel = await runGuard(cancelGuard, { role: 'production-manager', companyId: '7', permissions: ['production.cancel'] });
  assert.equal(allowedCancel, undefined);
});

// TASK-009 backend: QA per-stage endpoint restricted to quality.inspect
test('production routes restrict QA inspection endpoints to quality.inspect and quality.view (TASK-009)', async () => {
  const inspectionsPostGuard = getRouteLayer('/orders/:id/stages/:stageId/inspections', 'post')[0].handle;
  const inspectionsGetGuard = getRouteLayer('/orders/:id/inspections', 'get')[0].handle;

  // Deny: production.execute does NOT grant QA inspection access
  const deniedInspection = await runGuard(inspectionsPostGuard, { role: 'warehouse', companyId: '7', permissions: ['production.execute'] });
  assert.equal(deniedInspection?.statusCode, 403,
    'production.execute must not grant access to QA inspection endpoint');

  // Deny: quality.view does NOT grant write access
  const deniedInspectionGet = await runGuard(inspectionsGetGuard, { role: 'quality', companyId: '7', permissions: ['production.execute'] });
  assert.equal(deniedInspectionGet?.statusCode, 403,
    'production.execute must not grant access to GET inspections endpoint');

  // Allow: quality.inspect grants write access
  const allowedInspection = await runGuard(inspectionsPostGuard, { role: 'quality', companyId: '7', permissions: ['quality.inspect'] });
  assert.equal(allowedInspection, undefined,
    'quality.inspect must grant access to QA inspection endpoint');

  // Allow: quality.view grants read access
  const allowedInspectionGet = await runGuard(inspectionsGetGuard, { role: 'quality', companyId: '7', permissions: ['quality.view'] });
  assert.equal(allowedInspectionGet, undefined,
    'quality.view must grant read access to GET inspections endpoint');
});
