const test = require('node:test');
const assert = require('node:assert/strict');

process.env.BROWSER_SESSION_STORE_MODE = 'memory';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-procurement-routes';

const procurementRoutes = require('../src/routes/procurement.routes');

function getRouteLayer(path, method) {
  const layer = procurementRoutes.stack.find((entry) => entry.route && entry.route.path === path && entry.route.methods[method]);
  assert.ok(layer, `${method.toUpperCase()} route for ${path} should exist`);
  return layer.route.stack;
}

async function runGuard(guard, auth) {
  let nextError = 'not-called';
  await guard({ auth, requestContext: { requestId: 'req-procurement-routes-1' } }, {}, (error) => {
    nextError = error;
  });
  return nextError;
}

test('procurement routes expose the approved purchase workflow foundation endpoints', () => {
  assert.ok(getRouteLayer('/quotable-products', 'get').length >= 2);
  assert.ok(getRouteLayer('/products/:id/suppliers-pricing', 'get').length >= 2);
  assert.ok(getRouteLayer('/products/:id/request-quotations', 'post').length >= 3);
  assert.ok(getRouteLayer('/requests', 'get').length >= 2);
  assert.ok(getRouteLayer('/requests', 'post').length >= 3);
  assert.ok(getRouteLayer('/requests/:id', 'get').length >= 2);
  assert.ok(getRouteLayer('/requests/:id/quotations', 'post').length >= 3);
  assert.ok(getRouteLayer('/requests/:id/comparison', 'get').length >= 2);
  assert.ok(getRouteLayer('/requests/:id/select-quotation', 'post').length >= 3);
  assert.ok(getRouteLayer('/selections/:id/approve', 'post').length >= 3);
  assert.ok(getRouteLayer('/requests/:id/purchase-orders', 'post').length >= 3);
  assert.ok(getRouteLayer('/orders', 'get').length >= 2, 'GET /orders must exist (RF-04)');
});

test('procurement routes stay permission-governed through centralized access policies', async () => {
  const quotableProductsGuard = getRouteLayer('/quotable-products', 'get')[0].handle;
  const supplierPricingGuard = getRouteLayer('/products/:id/suppliers-pricing', 'get')[0].handle;
  const assistedQuotationGuard = getRouteLayer('/products/:id/request-quotations', 'post')[0].handle;
  const listGuard = getRouteLayer('/requests', 'get')[0].handle;
  const createRequestGuard = getRouteLayer('/requests', 'post')[0].handle;
  const createQuotationGuard = getRouteLayer('/requests/:id/quotations', 'post')[0].handle;
  const comparisonGuard = getRouteLayer('/requests/:id/comparison', 'get')[0].handle;
  const selectGuard = getRouteLayer('/requests/:id/select-quotation', 'post')[0].handle;
  const approveGuard = getRouteLayer('/selections/:id/approve', 'post')[0].handle;
  const createPoGuard = getRouteLayer('/requests/:id/purchase-orders', 'post')[0].handle;
  const listOrdersGuard = getRouteLayer('/orders', 'get')[0].handle;

  assert.equal((await runGuard(quotableProductsGuard, { companyId: '7', permissions: ['production.view'] }))?.statusCode, 403);
  assert.equal((await runGuard(supplierPricingGuard, { companyId: '7', permissions: ['production.view'] }))?.statusCode, 403);
  assert.equal((await runGuard(assistedQuotationGuard, { companyId: '7', permissions: ['procurement.view'] }))?.statusCode, 403);
  assert.equal((await runGuard(listGuard, { companyId: '7', permissions: ['production.view'] }))?.statusCode, 403);
  assert.equal((await runGuard(createRequestGuard, { companyId: '7', permissions: ['procurement.view'] }))?.statusCode, 403);
  assert.equal((await runGuard(createQuotationGuard, { companyId: '7', permissions: ['procurement.view'] }))?.statusCode, 403);
  assert.equal((await runGuard(comparisonGuard, { companyId: '7', permissions: ['procurement.manage'] })), undefined);
  assert.equal((await runGuard(selectGuard, { companyId: '7', permissions: ['procurement.view'] }))?.statusCode, 403);
  assert.equal((await runGuard(approveGuard, { companyId: '7', permissions: ['procurement.manage'] }))?.statusCode, 403);
  assert.equal((await runGuard(createPoGuard, { companyId: '7', permissions: ['procurement.view'] }))?.statusCode, 403);
  assert.equal((await runGuard(listOrdersGuard, { companyId: '7', permissions: ['production.view'] }))?.statusCode, 403);

  assert.equal(await runGuard(quotableProductsGuard, { companyId: '7', permissions: ['procurement.view'] }), undefined);
  assert.equal(await runGuard(supplierPricingGuard, { companyId: '7', permissions: ['procurement.view'] }), undefined);
  assert.equal(await runGuard(assistedQuotationGuard, { companyId: '7', permissions: ['procurement.manage'] }), undefined);
  assert.equal(await runGuard(listGuard, { companyId: '7', permissions: ['procurement.view'] }), undefined);
  assert.equal(await runGuard(createRequestGuard, { companyId: '7', permissions: ['procurement.manage'] }), undefined);
  assert.equal(await runGuard(createQuotationGuard, { companyId: '7', permissions: ['procurement.manage'] }), undefined);
  assert.equal(await runGuard(selectGuard, { companyId: '7', permissions: ['procurement.manage'] }), undefined);
  assert.equal(await runGuard(approveGuard, { companyId: '7', permissions: ['procurement.approve'] }), undefined);
  assert.equal(await runGuard(createPoGuard, { companyId: '7', permissions: ['procurement.manage'] }), undefined);
  assert.equal(await runGuard(listOrdersGuard, { companyId: '7', permissions: ['procurement.view'] }), undefined);
});
