const test = require('node:test');
const assert = require('node:assert/strict');

process.env.BROWSER_SESSION_STORE_MODE = 'memory';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-receipt-routes';

const receiptRoutes = require('../src/routes/receipt.routes');

function getRouteLayer(path, method) {
  const layer = receiptRoutes.stack.find((entry) => entry.route && entry.route.path === path && entry.route.methods[method]);
  assert.ok(layer, `${method.toUpperCase()} route for ${path} should exist`);
  return layer.route.stack;
}

async function runGuard(guard, auth) {
  let nextError = 'not-called';
  await guard({ auth, requestContext: { requestId: 'req-receipt-routes-1' } }, {}, (error) => { nextError = error; });
  return nextError;
}

test('receipt routes expose the approved receipt foundation endpoints', () => {
  assert.ok(getRouteLayer('/', 'get').length >= 2);
  assert.ok(getRouteLayer('/', 'post').length >= 3);
  assert.ok(getRouteLayer('/:id', 'get').length >= 2);
  assert.ok(getRouteLayer('/:id/items/:itemId/inspections', 'post').length >= 3);
});

test('receipt routes stay permission-governed through centralized access policies', async () => {
  const listGuard = getRouteLayer('/', 'get')[0].handle;
  const createGuard = getRouteLayer('/', 'post')[0].handle;
  const inspectGuard = getRouteLayer('/:id/items/:itemId/inspections', 'post')[0].handle;

  assert.equal((await runGuard(listGuard, { companyId: '7', permissions: ['procurement.view'] }))?.statusCode, 403);
  assert.equal((await runGuard(createGuard, { companyId: '7', permissions: ['receipts.view'] }))?.statusCode, 403);
  assert.equal((await runGuard(inspectGuard, { companyId: '7', permissions: ['receipts.view'] }))?.statusCode, 403);

  assert.equal(await runGuard(listGuard, { companyId: '7', permissions: ['receipts.view'] }), undefined);
  assert.equal(await runGuard(createGuard, { companyId: '7', permissions: ['receipts.inspect'] }), undefined);
  assert.equal(await runGuard(inspectGuard, { companyId: '7', permissions: ['receipts.inspect'] }), undefined);
});
