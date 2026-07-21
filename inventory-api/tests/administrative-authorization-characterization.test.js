const test = require('node:test');
const assert = require('node:assert/strict');

const userRoutes = require('../src/routes/user.routes');
const roleRoutes = require('../src/routes/role.routes');
const orderRoutes = require('../src/routes/order.routes');
const paymentRoutes = require('../src/routes/payment.routes');

function getRouteGuard(router, path, method) {
  const layer = router.stack.find((entry) => entry.route && entry.route.path === path && entry.route.methods[method]);
  assert.ok(layer, `${method.toUpperCase()} route for ${path} should exist`);
  assert.ok(layer.route.stack.length >= 2, `${method.toUpperCase()} route for ${path} should include guard and handler`);
  return layer.route.stack[0].handle;
}

async function runGuard(guard, auth) {
  let nextError = 'not-called';
  await guard({ auth, requestContext: { requestId: 'req-admin-auth-1' } }, {}, (error) => {
    nextError = error;
  });
  return nextError;
}

test('global user listing remains root-only', async () => {
  const guard = getRouteGuard(userRoutes, '/', 'get');

  const deniedError = await runGuard(guard, { role: 'admin', companyId: '7' });
  assert.equal(deniedError?.statusCode, 403);
  assert.equal(deniedError?.code, 'forbidden');

  const allowedError = await runGuard(guard, { role: 'root', companyId: null });
  assert.equal(allowedError, undefined);
});

test('company user creation remains company-admin-only', async () => {
  const guard = getRouteGuard(userRoutes, '/company', 'post');

  const deniedError = await runGuard(guard, { role: 'sales', companyId: '7' });
  assert.equal(deniedError?.statusCode, 403);
  assert.equal(deniedError?.code, 'forbidden');

  const allowedError = await runGuard(guard, { role: 'admin', companyId: '7' });
  assert.equal(allowedError, undefined);
});

test('role administration router keeps admin gate for company role listing', async () => {
  assert.ok(roleRoutes.stack.length >= 2, 'role router should include authenticate and admin gate middlewares');
  const adminGuard = roleRoutes.stack[1].handle;

  const deniedError = await runGuard(adminGuard, { role: 'sales', companyId: '7' });
  assert.equal(deniedError?.statusCode, 403);
  assert.equal(deniedError?.code, 'forbidden');

  const allowedError = await runGuard(adminGuard, { role: 'admin', companyId: '7' });
  assert.equal(allowedError, undefined);
});

test('order creation keeps sales permission requirements', async () => {
  const guard = getRouteGuard(orderRoutes, '/', 'post');

  const deniedError = await runGuard(guard, { role: 'sales', permissions: ['sales.orders.view'], companyId: '7' });
  assert.equal(deniedError?.statusCode, 403);
  assert.equal(deniedError?.code, 'forbidden');

  const allowedError = await runGuard(guard, { role: 'sales', permissions: ['sales.orders.create'], companyId: '7' });
  assert.equal(allowedError, undefined);
});

test('order dispatch remains limited to admin or warehouse roles', async () => {
  const guard = getRouteGuard(orderRoutes, '/:id/dispatch', 'post');

  const deniedError = await runGuard(guard, { role: 'sales', companyId: '7' });
  assert.equal(deniedError?.statusCode, 403);
  assert.equal(deniedError?.code, 'forbidden');

  const warehouseAllowedError = await runGuard(guard, { role: 'warehouse', companyId: '7' });
  assert.equal(warehouseAllowedError, undefined);
});

test('payment lifecycle approval endpoints require explicit effective permissions', async () => {
  const approveGuard = getRouteGuard(paymentRoutes, '/:id/approve', 'post');
  const reviewGuard = getRouteGuard(paymentRoutes, '/:id/under-review', 'post');
  const rejectGuard = getRouteGuard(paymentRoutes, '/:id/reject', 'post');
  const reverseGuard = getRouteGuard(paymentRoutes, '/:id/reverse', 'post');

  const deniedApprove = await runGuard(approveGuard, { role: 'admin', companyId: '7', permissions: ['sales.manage'] });
  assert.equal(deniedApprove?.statusCode, 403);
  assert.equal(deniedApprove?.code, 'forbidden');

  const allowedApprove = await runGuard(approveGuard, { role: 'custom-office', companyId: '7', permissions: ['collections.payments.approve'] });
  assert.equal(allowedApprove, undefined);

  const allowedReview = await runGuard(reviewGuard, { role: 'custom-office', companyId: '7', permissions: ['collections.payments.approve'] });
  assert.equal(allowedReview, undefined);

  const allowedReject = await runGuard(rejectGuard, { role: 'custom-office', companyId: '7', permissions: ['collections.payments.approve'] });
  assert.equal(allowedReject, undefined);

  const deniedReverse = await runGuard(reverseGuard, { role: 'custom-office', companyId: '7', permissions: ['collections.payments.approve'] });
  assert.equal(deniedReverse?.statusCode, 403);
  assert.equal(deniedReverse?.code, 'forbidden');

  const allowedReverse = await runGuard(reverseGuard, { role: 'custom-office', companyId: '7', permissions: ['collections.payments.reverse'] });
  assert.equal(allowedReverse, undefined);
});
