const test = require('node:test');
const assert = require('node:assert/strict');

const clientRoutes = require('../src/routes/client.routes');
const paymentRoutes = require('../src/routes/payment.routes');
const productRoutes = require('../src/routes/product.routes');
const invoiceRoutes = require('../src/routes/invoice.routes');

function getDeleteRouteGuard(router, path) {
  const layer = router.stack.find((entry) => entry.route && entry.route.path === path && entry.route.methods.delete);
  assert.ok(layer, `DELETE route for ${path} should exist`);
  assert.ok(layer.route.stack.length >= 2, `DELETE route for ${path} should include guard and handler`);
  return layer.route.stack[0].handle;
}

test('client DELETE route keeps admin-only authorization', async () => {
  const guard = getDeleteRouteGuard(clientRoutes, '/:id');
  let nextError = null;

  await guard({ auth: { role: 'sales' } }, {}, (error) => {
    nextError = error;
  });

  assert.equal(nextError?.statusCode, 403);
  assert.equal(nextError?.code, 'forbidden');

  let allowedError = 'not-called';
  await guard({ auth: { role: 'admin' } }, {}, (error) => {
    allowedError = error;
  });
  assert.equal(allowedError, undefined);
});

test('payment DELETE route keeps admin-only authorization', async () => {
  const guard = getDeleteRouteGuard(paymentRoutes, '/:id');
  let nextError = null;

  await guard({ auth: { role: 'sales' } }, {}, (error) => {
    nextError = error;
  });

  assert.equal(nextError?.statusCode, 403);
  assert.equal(nextError?.code, 'forbidden');

  let allowedError = 'not-called';
  await guard({ auth: { role: 'admin' } }, {}, (error) => {
    allowedError = error;
  });
  assert.equal(allowedError, undefined);
});

test('product DELETE route keeps products.manage permission requirement', async () => {
  const guard = getDeleteRouteGuard(productRoutes, '/:id');
  let nextError = null;

  await guard({ auth: { permissions: ['products.view'] } }, {}, (error) => {
    nextError = error;
  });

  assert.equal(nextError?.statusCode, 403);
  assert.equal(nextError?.code, 'forbidden');

  let allowedError = 'not-called';
  await guard({ auth: { permissions: ['products.manage'] } }, {}, (error) => {
    allowedError = error;
  });
  assert.equal(allowedError, undefined);
});

test('invoice DELETE route keeps admin-only authorization', async () => {
  const guard = getDeleteRouteGuard(invoiceRoutes, '/:id');
  let nextError = null;

  await guard({ auth: { role: 'sales' } }, {}, (error) => {
    nextError = error;
  });

  assert.equal(nextError?.statusCode, 403);
  assert.equal(nextError?.code, 'forbidden');

  let allowedError = 'not-called';
  await guard({ auth: { role: 'admin' } }, {}, (error) => {
    allowedError = error;
  });
  assert.equal(allowedError, undefined);
});
