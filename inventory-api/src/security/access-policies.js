const authorize = require('../middlewares/authorize');
const authorizePermission = require('../middlewares/authorizePermission');
const { ACCESS_POLICIES } = require('./access-policy-registry');
const {
  buildActorScopeDeniedError,
  isActorScopeAllowed,
} = require('./access-policy-actor-scope');
const { recordAccessPolicyActorScopeDenial } = require('./access-policy-audit');

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
