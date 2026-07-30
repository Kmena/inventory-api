const { createHttpError } = require('../lib/errors');
const audit = require('../lib/audit');
const authorize = require('../middlewares/authorize');
const authorizePermission = require('../middlewares/authorizePermission');

const ACCESS_POLICIES = Object.freeze({
  'company.list-global': {
    mode: 'role',
    roles: ['root'],
    boundary: 'platform-global',
    transition: 'stable-role',
    actorScope: 'global-root',
  },
  'company.create-global': {
    mode: 'role',
    roles: ['root'],
    boundary: 'platform-global',
    transition: 'stable-role',
    actorScope: 'global-root',
  },
  'company.root-companies.list': {
    mode: 'role',
    roles: ['root'],
    boundary: 'platform-global',
    transition: 'stable-role',
    actorScope: 'global-root',
  },
  'company.root-companies.create': {
    mode: 'role',
    roles: ['root'],
    boundary: 'platform-global',
    transition: 'stable-role',
    actorScope: 'global-root',
  },
  'company.root-companies.update-status': {
    mode: 'role',
    roles: ['root'],
    boundary: 'platform-global',
    transition: 'stable-role',
  },
  'company.dashboard': {
    mode: 'role',
    roles: ['admin'],
    boundary: 'tenant-admin-legacy',
    transition: 'documented-legacy-role',
  },
  'user.list-global': {
    mode: 'role',
    roles: ['root'],
    boundary: 'platform-global',
    transition: 'stable-role',
  },
  'user.create-global': {
    mode: 'role',
    roles: ['root'],
    boundary: 'platform-global',
    transition: 'stable-role',
  },
  'user.list-company': {
    mode: 'role',
    roles: ['admin'],
    boundary: 'tenant-admin-legacy',
    transition: 'documented-legacy-role',
  },
  'user.create-company': {
    mode: 'role',
    roles: ['admin'],
    boundary: 'tenant-admin-legacy',
    transition: 'documented-legacy-role',
  },
  'role.permissions.list': {
    mode: 'role',
    roles: ['admin'],
    boundary: 'tenant-admin-legacy',
    transition: 'documented-legacy-role',
  },
  'role.company.list': {
    mode: 'role',
    roles: ['admin'],
    boundary: 'tenant-admin-legacy',
    transition: 'documented-legacy-role',
    actorScope: 'company-admin',
  },
  'role.company.create': {
    mode: 'role',
    roles: ['admin'],
    boundary: 'tenant-admin-legacy',
    transition: 'documented-legacy-role',
    actorScope: 'company-admin',
  },
  'region.company.list': {
    mode: 'role',
    roles: ['admin'],
    boundary: 'tenant-admin-legacy',
    transition: 'documented-legacy-role',
  },
  'region.company.create': {
    mode: 'role',
    roles: ['admin'],
    boundary: 'tenant-admin-legacy',
    transition: 'documented-legacy-role',
  },
  'region.company.subregion.create': {
    mode: 'role',
    roles: ['admin'],
    boundary: 'tenant-admin-legacy',
    transition: 'documented-legacy-role',
  },
  'order.list': {
    mode: 'role',
    roles: ['admin', 'sales', 'warehouse'],
    boundary: 'tenant-operational',
    transition: 'candidate-for-permissions',
  },
  'order.detail': {
    mode: 'role',
    roles: ['admin', 'sales', 'warehouse'],
    boundary: 'tenant-operational',
    transition: 'candidate-for-permissions',
  },
  'order.create': {
    mode: 'permission',
    permissions: ['sales.manage', 'sales.orders.create'],
    boundary: 'tenant-operational',
    transition: 'permission-governed',
  },
  'order.update': {
    mode: 'permission',
    permissions: ['sales.manage', 'sales.orders.create'],
    boundary: 'tenant-operational',
    transition: 'permission-governed',
  },
  'order.approve': {
    mode: 'role',
    roles: ['admin', 'sales'],
    boundary: 'tenant-operational',
    transition: 'candidate-for-permissions',
  },
  'order.cancel': {
    mode: 'role',
    roles: ['admin', 'sales'],
    boundary: 'tenant-operational',
    transition: 'candidate-for-permissions',
  },
  'order.dispatch': {
    mode: 'role',
    roles: ['admin', 'warehouse'],
    boundary: 'tenant-operational',
    transition: 'candidate-for-permissions',
  },
  'order.delete': {
    mode: 'role',
    roles: ['admin'],
    boundary: 'tenant-admin-legacy',
    transition: 'documented-legacy-role',
  },
  'payment.list': {
    mode: 'permission',
    permissions: ['sales.manage', 'collections.view.all', 'collections.manage.own', 'collections.payments.approve', 'collections.payments.reverse'],
    boundary: 'tenant-operational',
    transition: 'permission-governed',
  },
  'payment.detail': {
    mode: 'permission',
    permissions: ['sales.manage', 'collections.view.all', 'collections.manage.own', 'collections.payments.approve', 'collections.payments.reverse'],
    boundary: 'tenant-operational',
    transition: 'permission-governed',
  },
  'payment.create': {
    mode: 'permission',
    permissions: ['sales.manage', 'collections.manage.own'],
    boundary: 'tenant-operational',
    transition: 'permission-governed',
  },
  'payment.update': {
    mode: 'permission',
    permissions: ['sales.manage', 'collections.manage.own'],
    boundary: 'tenant-operational',
    transition: 'permission-governed',
  },
  'payment.review': {
    mode: 'permission',
    permissions: ['collections.payments.approve'],
    boundary: 'tenant-operational',
    transition: 'permission-governed',
  },
  'payment.approve': {
    mode: 'permission',
    permissions: ['collections.payments.approve'],
    boundary: 'tenant-operational',
    transition: 'permission-governed',
  },
  'payment.reject': {
    mode: 'permission',
    permissions: ['collections.payments.approve'],
    boundary: 'tenant-operational',
    transition: 'permission-governed',
  },
  'payment.reverse': {
    mode: 'permission',
    permissions: ['collections.payments.reverse'],
    boundary: 'tenant-operational',
    transition: 'permission-governed',
  },
  'payment.receipt-download': {
    mode: 'permission',
    permissions: ['sales.manage', 'collections.view.all', 'collections.manage.own', 'collections.payments.approve', 'collections.payments.reverse'],
    boundary: 'tenant-operational',
    transition: 'permission-governed',
  },
  'payment.delete': {
    mode: 'permission',
    permissions: ['collections.payments.reverse'],
    boundary: 'tenant-operational',
    transition: 'permission-governed',
  },
  'client.list': {
    mode: 'role',
    roles: ['admin', 'sales'],
    boundary: 'tenant-operational',
    transition: 'documented-legacy-role',
  },
  'client.list-company': {
    mode: 'role',
    roles: ['admin', 'sales'],
    boundary: 'tenant-operational',
    transition: 'documented-legacy-role',
  },
  'client.classifications.list-company': {
    mode: 'role',
    roles: ['admin', 'sales'],
    boundary: 'tenant-operational',
    transition: 'documented-legacy-role',
  },
  'client.document-types.list': {
    mode: 'role',
    roles: ['admin', 'sales'],
    boundary: 'tenant-operational',
    transition: 'documented-legacy-role',
  },
  'client.create-company': {
    mode: 'role',
    roles: ['admin', 'sales'],
    boundary: 'tenant-operational',
    transition: 'documented-legacy-role',
  },
  'client.store.create': {
    mode: 'role',
    roles: ['admin', 'sales'],
    boundary: 'tenant-operational',
    transition: 'documented-legacy-role',
  },
  'client.document.upload': {
    mode: 'role',
    roles: ['admin', 'sales'],
    boundary: 'tenant-operational',
    transition: 'documented-legacy-role',
  },
  'client.reference.create': {
    mode: 'role',
    roles: ['admin', 'sales'],
    boundary: 'tenant-operational',
    transition: 'documented-legacy-role',
  },
  'client.document.download': {
    mode: 'role',
    roles: ['admin', 'sales'],
    boundary: 'tenant-operational',
    transition: 'documented-legacy-role',
  },
  'client.detail': {
    mode: 'role',
    roles: ['admin', 'sales'],
    boundary: 'tenant-operational',
    transition: 'documented-legacy-role',
  },
  'client.create-legacy': {
    mode: 'role',
    roles: ['admin', 'sales'],
    boundary: 'tenant-operational',
    transition: 'documented-legacy-role',
  },
  'client.update': {
    mode: 'role',
    roles: ['admin', 'sales'],
    boundary: 'tenant-operational',
    transition: 'documented-legacy-role',
  },
  'client.delete': {
    mode: 'role',
    roles: ['admin'],
    boundary: 'tenant-admin-legacy',
    transition: 'documented-legacy-role',
  },
  'integration.geocoding.search': {
    mode: 'role',
    roles: ['admin', 'sales'],
    boundary: 'tenant-operational',
    transition: 'documented-legacy-role',
  },
  'integration.taxpayer.lookup': {
    mode: 'role',
    roles: ['admin', 'sales'],
    boundary: 'tenant-operational',
    transition: 'documented-legacy-role',
  },
  'integration.economic-activities.list': {
    mode: 'role',
    roles: ['admin', 'sales'],
    boundary: 'tenant-operational',
    transition: 'documented-legacy-role',
  },
  'product.list': {
    mode: 'permission',
    permissions: ['products.view', 'products.manage'],
    boundary: 'tenant-operational',
    transition: 'permission-governed',
  },
  'product.detail': {
    mode: 'permission',
    permissions: ['products.view', 'products.manage'],
    boundary: 'tenant-operational',
    transition: 'permission-governed',
  },
  'product.create': {
    mode: 'permission',
    permissions: ['products.manage'],
    boundary: 'tenant-operational',
    transition: 'permission-governed',
  },
  'product.import': {
    mode: 'permission',
    permissions: ['products.import', 'products.manage'],
    boundary: 'tenant-operational',
    transition: 'permission-governed',
  },
  'product.update': {
    mode: 'permission',
    permissions: ['products.manage'],
    boundary: 'tenant-operational',
    transition: 'permission-governed',
  },
  'product.delete': {
    mode: 'permission',
    permissions: ['products.manage'],
    boundary: 'tenant-operational',
    transition: 'permission-governed',
  },
  'inventory.alerts.list': {
    mode: 'permission',
    permissions: ['inventory.view', 'inventory.manage', 'inventory.qa.manage'],
    boundary: 'tenant-operational',
    transition: 'permission-governed',
  },
  'inventory.alerts.detail': {
    mode: 'permission',
    permissions: ['inventory.view', 'inventory.manage', 'inventory.qa.manage'],
    boundary: 'tenant-operational',
    transition: 'permission-governed',
  },
  'inventory.alerts.update-status': {
    mode: 'permission',
    permissions: ['inventory.manage', 'inventory.qa.manage'],
    boundary: 'tenant-operational',
    transition: 'permission-governed',
  },
  'inventory.stocks.list': {
    mode: 'permission',
    permissions: ['inventory.view', 'inventory.manage'],
    boundary: 'tenant-operational',
    transition: 'permission-governed',
  },
  'inventory.movements.list': {
    mode: 'permission',
    permissions: ['inventory.view', 'inventory.manage'],
    boundary: 'tenant-operational',
    transition: 'permission-governed',
  },
  'warehouse.company.list': {
    mode: 'permission',
    permissions: ['inventory.view', 'inventory.manage'],
    boundary: 'tenant-operational',
    transition: 'permission-governed',
  },
  'warehouse.company.create': {
    mode: 'permission',
    permissions: ['inventory.manage'],
    boundary: 'tenant-operational',
    transition: 'permission-governed',
  },
  'sales-route.company.list': {
    mode: 'role',
    roles: ['admin', 'sales_supervisor'],
    boundary: 'tenant-operational',
    transition: 'documented-legacy-role',
  },
  'sales-route.company.create': {
    mode: 'role',
    roles: ['admin', 'sales_supervisor'],
    boundary: 'tenant-operational',
    transition: 'documented-legacy-role',
  },
  'sales-route.company.detail': {
    mode: 'role',
    roles: ['admin', 'sales_supervisor'],
    boundary: 'tenant-operational',
    transition: 'documented-legacy-role',
  },
  'sales-route.company.update': {
    mode: 'role',
    roles: ['admin', 'sales_supervisor'],
    boundary: 'tenant-operational',
    transition: 'documented-legacy-role',
  },
  'sales-route.company.subzones.update': {
    mode: 'role',
    roles: ['admin', 'sales_supervisor'],
    boundary: 'tenant-operational',
    transition: 'documented-legacy-role',
  },
  'sales-route.company.subzones.delete': {
    mode: 'role',
    roles: ['admin', 'sales_supervisor'],
    boundary: 'tenant-operational',
    transition: 'documented-legacy-role',
  },
  'sales-route.company.assignments.update': {
    mode: 'role',
    roles: ['admin', 'sales_supervisor'],
    boundary: 'tenant-operational',
    transition: 'documented-legacy-role',
  },
  'sales-route.company.goals.update': {
    mode: 'role',
    roles: ['admin', 'sales_supervisor'],
    boundary: 'tenant-operational',
    transition: 'documented-legacy-role',
  },
  'inventory.entries.create': {
    mode: 'permission',
    permissions: ['inventory.manage'],
    boundary: 'tenant-operational',
    transition: 'permission-governed',
  },
  'inventory.lot-qa.update': {
    mode: 'permission',
    permissions: ['inventory.qa.manage'],
    boundary: 'tenant-operational',
    transition: 'permission-governed',
  },
  'inventory.adjustments.create': {
    mode: 'permission',
    permissions: ['inventory.manage'],
    boundary: 'tenant-operational',
    transition: 'permission-governed',
  },
});

function getAccessPolicy(policyId) {
  const policy = ACCESS_POLICIES[policyId];
  if (!policy) {
    throw new Error(`Unknown access policy: ${policyId}`);
  }
  return policy;
}

function listAccessPolicies() {
  return { ...ACCESS_POLICIES };
}

function createBaseAccessGuard(policyId, policy) {
  if (policy.mode === 'role') {
    return authorize(...policy.roles);
  }

  if (policy.mode === 'permission') {
    return authorizePermission(...policy.permissions);
  }

  throw new Error(`Unsupported access policy mode for ${policyId}: ${policy.mode}`);
}

function buildActorScopeDeniedError(policy) {
  if (policy.actorScope === 'global-root') {
    return createHttpError(403, 'Solo el root global puede ejecutar esta acción', 'forbidden');
  }

  if (policy.actorScope === 'company-admin') {
    return createHttpError(403, 'El administrador debe pertenecer a una empresa', 'forbidden');
  }

  return null;
}

function isActorScopeAllowed(policy, auth) {
  if (!policy.actorScope) {
    return true;
  }

  if (policy.actorScope === 'global-root') {
    return Boolean(auth?.role === 'root' && !auth?.companyId);
  }

  if (policy.actorScope === 'company-admin') {
    return Boolean(auth?.role === 'admin' && auth?.companyId);
  }

  return true;
}

async function recordAccessPolicyActorScopeDenial(policyId, policy, req) {
  await audit.recordAuditEventSafelyIfAvailable({
    req,
    action: 'security.authorization.access_policy',
    resourceType: 'request',
    outcome: 'REJECTED',
    reasonCode: 'actor_scope_denied',
    metadata: {
      policyId,
      boundary: policy.boundary,
      actorScope: policy.actorScope,
      role: req.auth?.role || null,
      companyId: req.auth?.companyId || null,
    },
  });
}

async function runAccessGuard(guard, req, res) {
  return new Promise((resolve) => {
    guard(req, res, (error) => {
      resolve(error || null);
    });
  });
}

function authorizeAccessPolicy(policyId) {
  const policy = getAccessPolicy(policyId);
  const baseGuard = createBaseAccessGuard(policyId, policy);

  return async (req, res, next) => {
    const baseError = await runAccessGuard(baseGuard, req, res);
    if (baseError) {
      return next(baseError);
    }

    if (isActorScopeAllowed(policy, req.auth)) {
      return next();
    }

    await recordAccessPolicyActorScopeDenial(policyId, policy, req);
    return next(buildActorScopeDeniedError(policy));
  };
}

module.exports = {
  getAccessPolicy,
  listAccessPolicies,
  authorizeAccessPolicy,
};
