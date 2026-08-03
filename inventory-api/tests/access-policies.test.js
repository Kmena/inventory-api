const test = require('node:test');
const assert = require('node:assert/strict');

const audit = require('../src/lib/audit');
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

async function withAuditStub(stub, run) {
  const original = audit.recordAuditEventSafelyIfAvailable;
  audit.recordAuditEventSafelyIfAvailable = stub;
  try {
    return await run();
  } finally {
    audit.recordAuditEventSafelyIfAvailable = original;
  }
}

test('access policies centralize stable role and permission boundaries', () => {
  const rootCompanyPolicy = getAccessPolicy('company.list-global');
  assert.equal(rootCompanyPolicy.mode, 'role');
  assert.deepEqual(rootCompanyPolicy.roles, ['root']);
  assert.equal(rootCompanyPolicy.boundary, 'platform-global');
  assert.equal(rootCompanyPolicy.actorScope, 'global-root');

  const createCompanyPolicy = getAccessPolicy('company.create-global');
  assert.equal(createCompanyPolicy.mode, 'role');
  assert.deepEqual(createCompanyPolicy.roles, ['root']);
  assert.equal(createCompanyPolicy.actorScope, 'global-root');

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

test('access policies preserve strict registry lookups and explicit actor-scope metadata on key hotspots', () => {
  assert.throws(
    () => getAccessPolicy('missing.policy'),
    /Unknown access policy: missing.policy/,
  );

  const scopedPolicies = Object.entries(listAccessPolicies())
    .filter(([, policy]) => policy.actorScope)
    .map(([policyId, policy]) => [policyId, policy.actorScope])
    .sort((left, right) => left[0].localeCompare(right[0]));

  assert.deepEqual(scopedPolicies, [
    ['company.create-global', 'global-root'],
    ['company.list-global', 'global-root'],
    ['company.root-companies.create', 'global-root'],
    ['company.root-companies.list', 'global-root'],
    ['role.company.create', 'company-admin'],
    ['role.company.list', 'company-admin'],
  ]);

  assert.deepEqual(getAccessPolicy('product.import').permissions, ['products.import', 'products.manage']);
  assert.deepEqual(getAccessPolicy('inventory.lot-qa.update').permissions, ['inventory.qa.manage']);
  assert.deepEqual(getAccessPolicy('sales-route.company.goals.update').roles, ['admin', 'sales_supervisor']);
});

test('authorizeAccessPolicy preserves global-root company listing semantics', async () => {
  const guard = authorizeAccessPolicy('company.list-global');

  const deniedRoleError = await runGuard(guard, { role: 'admin', companyId: '7' });
  assert.equal(deniedRoleError?.statusCode, 403);
  assert.equal(deniedRoleError?.code, 'forbidden');

  const deniedScopeError = await runGuard(guard, { role: 'root', companyId: '7' });
  assert.equal(deniedScopeError?.statusCode, 403);
  assert.equal(deniedScopeError?.code, 'forbidden');

  const allowedError = await runGuard(guard, { role: 'root', companyId: null });
  assert.equal(allowedError, undefined);
});

test('authorizeAccessPolicy preserves company-admin role administration semantics', async () => {
  const listGuard = authorizeAccessPolicy('role.company.list');
  const createGuard = authorizeAccessPolicy('role.company.create');

  const deniedListScopeError = await runGuard(listGuard, { role: 'admin', companyId: null });
  assert.equal(deniedListScopeError?.statusCode, 403);
  assert.equal(deniedListScopeError?.code, 'forbidden');

  const deniedCreateScopeError = await runGuard(createGuard, { role: 'admin', companyId: null });
  assert.equal(deniedCreateScopeError?.statusCode, 403);
  assert.equal(deniedCreateScopeError?.code, 'forbidden');

  const allowedListError = await runGuard(listGuard, { role: 'admin', companyId: '7' });
  assert.equal(allowedListError, undefined);

  const allowedCreateError = await runGuard(createGuard, { role: 'admin', companyId: '7' });
  assert.equal(allowedCreateError, undefined);
});

test('authorizeAccessPolicy records actor-scope audit metadata when a base-allowed actor violates the policy scope', async () => {
  const recordedPayloads = [];

  await withAuditStub(async (payload) => {
    recordedPayloads.push(payload);
    return null;
  }, async () => {
    const roleCompanyCreateGuard = authorizeAccessPolicy('role.company.create');
    const rootListGuard = authorizeAccessPolicy('company.list-global');

    const deniedCompanyAdminScope = await runGuard(roleCompanyCreateGuard, { role: 'admin', companyId: null });
    assert.equal(deniedCompanyAdminScope?.statusCode, 403);
    assert.equal(deniedCompanyAdminScope?.code, 'forbidden');

    const deniedGlobalRootScope = await runGuard(rootListGuard, { role: 'root', companyId: '7' });
    assert.equal(deniedGlobalRootScope?.statusCode, 403);
    assert.equal(deniedGlobalRootScope?.code, 'forbidden');
  });

  assert.equal(recordedPayloads.length, 2);
  assert.deepEqual(recordedPayloads.map((payload) => ({
    action: payload.action,
    reasonCode: payload.reasonCode,
    policyId: payload.metadata.policyId,
    actorScope: payload.metadata.actorScope,
    role: payload.metadata.role,
    companyId: payload.metadata.companyId,
  })), [
    {
      action: 'security.authorization.access_policy',
      reasonCode: 'actor_scope_denied',
      policyId: 'role.company.create',
      actorScope: 'company-admin',
      role: 'admin',
      companyId: null,
    },
    {
      action: 'security.authorization.access_policy',
      reasonCode: 'actor_scope_denied',
      policyId: 'company.list-global',
      actorScope: 'global-root',
      role: 'root',
      companyId: '7',
    },
  ]);
});

test('authorizeAccessPolicy skips actor-scope denial auditing when the base guard already denies the request', async () => {
  const recordedActions = [];

  await withAuditStub(async (payload) => {
    recordedActions.push(payload.action);
    return null;
  }, async () => {
    const guard = authorizeAccessPolicy('payment.approve');
    const deniedError = await runGuard(guard, { role: 'admin', companyId: '7', permissions: ['sales.manage'] });
    assert.equal(deniedError?.statusCode, 403);
    assert.equal(deniedError?.code, 'forbidden');
  });

  assert.deepEqual(recordedActions, ['security.authorization.permission']);
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
