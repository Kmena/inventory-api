const audit = require('../lib/audit');

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

module.exports = {
  recordAccessPolicyActorScopeDenial,
};
