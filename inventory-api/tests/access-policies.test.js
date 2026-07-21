const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getAccessPolicy,
  listAccessPolicies,
  authorizeAccessPolicy,
} = require('../src/security/access-policies');

async function runGuard(guard, auth) {
  let nextError = 'not-called';
  await guard({ auth, requestContext: { requestId: 'req-access-policy-1' } }, {}, (error) => {
    nextError = error;
  });
  return nextError;
}

test('access policies centralize stable role and permission boundaries', () => {
  const rootCompanyPolicy = getAccessPolicy('company.list-global');
  assert.equal(rootCompanyPolicy.mode, 'role');
  assert.deepEqual(rootCompanyPolicy.roles, ['root']);
  assert.equal(rootCompanyPolicy.boundary, 'platform-global');

  const paymentApprovePolicy = getAccessPolicy('payment.approve');
  assert.equal(paymentApprovePolicy.mode, 'permission');
  assert.deepEqual(paymentApprovePolicy.permissions, ['collections.payments.approve']);
  assert.equal(paymentApprovePolicy.transition, 'permission-governed');

  const clientUploadPolicy = getAccessPolicy('client.document.upload');
  assert.equal(clientUploadPolicy.mode, 'role');
  assert.deepEqual(clientUploadPolicy.roles, ['admin', 'sales']);

  const geocodingPolicy = getAccessPolicy('integration.geocoding.search');
  assert.equal(geocodingPolicy.mode, 'role');
  assert.deepEqual(geocodingPolicy.roles, ['admin', 'sales']);
});

test('access policies identify operational endpoints still in progressive role-to-permission transition', () => {
  const policies = Object.entries(listAccessPolicies())
    .filter(([, policy]) => policy.transition === 'candidate-for-permissions')
    .map(([policyId]) => policyId)
    .sort();

  assert.deepEqual(policies, [
    'order.approve',
    'order.cancel',
    'order.detail',
    'order.dispatch',
    'order.list',
  ]);
});

test('authorizeAccessPolicy preserves root-only company listing semantics', async () => {
  const guard = authorizeAccessPolicy('company.list-global');

  const deniedError = await runGuard(guard, { role: 'admin', companyId: '7' });
  assert.equal(deniedError?.statusCode, 403);
  assert.equal(deniedError?.code, 'forbidden');

  const allowedError = await runGuard(guard, { role: 'root', companyId: null });
  assert.equal(allowedError, undefined);
});

test('authorizeAccessPolicy preserves payment approval permission semantics', async () => {
  const guard = authorizeAccessPolicy('payment.approve');

  const deniedError = await runGuard(guard, { role: 'admin', companyId: '7', permissions: ['sales.manage'] });
  assert.equal(deniedError?.statusCode, 403);
  assert.equal(deniedError?.code, 'forbidden');

  const allowedError = await runGuard(guard, { role: 'custom-office', companyId: '7', permissions: ['collections.payments.approve'] });
  assert.equal(allowedError, undefined);
});

test('authorizeAccessPolicy preserves admin/sales semantics for integration and client upload guards', async () => {
  const geocodingGuard = authorizeAccessPolicy('integration.geocoding.search');
  const clientUploadGuard = authorizeAccessPolicy('client.document.upload');

  const deniedGeocodingError = await runGuard(geocodingGuard, { role: 'warehouse', companyId: '7' });
  assert.equal(deniedGeocodingError?.statusCode, 403);

  const allowedGeocodingError = await runGuard(geocodingGuard, { role: 'sales', companyId: '7' });
  assert.equal(allowedGeocodingError, undefined);

  const deniedClientUploadError = await runGuard(clientUploadGuard, { role: 'warehouse', companyId: '7' });
  assert.equal(deniedClientUploadError?.statusCode, 403);

  const allowedClientUploadError = await runGuard(clientUploadGuard, { role: 'admin', companyId: '7' });
  assert.equal(allowedClientUploadError, undefined);
});
