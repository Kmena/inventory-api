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

// ─── TASK-006: Loss endpoints route contract ───────────────────────────────

test("production routes expose the POST and GET /losses endpoints (TASK-006)", () => {
  assert.ok(
    getRouteLayer("/orders/:id/stages/:stageId/losses", "post").length >= 3,
    "POST /orders/:id/stages/:stageId/losses must exist and be governed",
  );
  assert.ok(
    getRouteLayer("/orders/:id/stages/:stageId/losses", "get").length >= 2,
    "GET /orders/:id/stages/:stageId/losses must exist and be governed",
  );
});

test("POST /losses requires production.manage permission (TASK-006)", async () => {
  const lossesPostRoute = productionRoutes.stack.find(
    (entry) => entry.route
      && entry.route.path === "/orders/:id/stages/:stageId/losses"
      && entry.route.methods.post,
  );
  const guard = lossesPostRoute.route.stack[0].handle;

  // Deny: production.execute does not grant production.manage
  const denied = await runGuard(guard, { companyId: "7", permissions: ["production.execute"] });
  assert.equal(denied?.statusCode, 403, "production.execute must not grant access to losses endpoint");

  // Allow: production.manage grants write access
  const allowed = await runGuard(guard, { companyId: "7", permissions: ["production.manage"] });
  assert.equal(allowed, undefined, "production.manage must grant access to POST losses endpoint");
});

test("GET /losses requires production.view permission (TASK-006)", async () => {
  const lossesGetRoute = productionRoutes.stack.find(
    (entry) => entry.route
      && entry.route.path === "/orders/:id/stages/:stageId/losses"
      && entry.route.methods.get,
  );
  const guard = lossesGetRoute.route.stack[0].handle;

  // Allow: production.view grants read access
  const allowed = await runGuard(guard, { companyId: "7", permissions: ["production.view"] });
  assert.equal(allowed, undefined, "production.view must grant access to GET losses endpoint");

  // Allow: production.execute also grants view access (production.view policy includes execute)
  const allowedExecute = await runGuard(guard, { companyId: "7", permissions: ["production.execute"] });
  assert.equal(allowedExecute, undefined, "production.execute is included in production.view policy");

  // Deny: no relevant permissions
  const denied = await runGuard(guard, { companyId: "7", permissions: ["supplier.view"] });
  assert.equal(denied?.statusCode, 403, "supplier.view must not grant access to GET losses");
});

test("production routes expose the recolection confirm endpoint (TASK-006)", () => {
  assert.ok(
    getRouteLayer("/orders/:id/recolections/:recolectionId/confirm", "post").length >= 3,
    "POST /orders/:id/recolections/:recolectionId/confirm must exist and be governed",
  );
});

test("POST /recolections/:recolectionId/confirm requires production.execute permission (TASK-006)", async () => {
  const recolectionPostRoute = productionRoutes.stack.find(
    (entry) => entry.route
      && entry.route.path === "/orders/:id/recolections/:recolectionId/confirm"
      && entry.route.methods.post,
  );
  const guard = recolectionPostRoute.route.stack[0].handle;

  const denied = await runGuard(guard, { companyId: "7", permissions: ["production.view"] });
  assert.equal(denied?.statusCode, 403, "production.view must not grant access to recolection confirm endpoint");

  const allowed = await runGuard(guard, { companyId: "7", permissions: ["production.execute"] });
  assert.equal(allowed, undefined, "production.execute must grant access to POST recolection confirm endpoint");
});

test("stageLossSchema from production.schema accepts losses:[] (TASK-006)", () => {
  const { stageLossSchema } = require("../src/schemas/production.schema");
  const result = stageLossSchema.safeParse({ losses: [] });
  assert.ok(result.success, "stageLossSchema must accept empty losses array");
  assert.equal(result.data.losses.length, 0);
});

test("stageLossSchema from production.schema validates loss items (TASK-006)", () => {
  const { stageLossSchema } = require("../src/schemas/production.schema");

  const valid = stageLossSchema.safeParse({
    losses: [
      { productId: "1", lotId: "5", quantity: 3.5, reasonCode: "CONTAMINATED" },
    ],
  });
  assert.ok(valid.success, "stageLossSchema must accept valid loss item");
  assert.equal(valid.data.losses[0].productId, 1n);
  assert.equal(valid.data.losses[0].lotId, 5n);

  // Reject negative quantity
  const invalid = stageLossSchema.safeParse({
    losses: [{ productId: "1", lotId: "5", quantity: -1, reasonCode: "BROKEN" }],
  });
  assert.ok(!invalid.success, "stageLossSchema must reject negative quantity");
});
