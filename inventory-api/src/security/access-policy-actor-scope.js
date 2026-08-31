const { createHttpError } = require('../lib/errors');

function hasPermission(auth, permissionCode) {
  return Boolean((auth?.permissions || []).includes(permissionCode));
}

function isAgentWorkspaceActor(auth) {
  if (!auth?.companyId || !auth?.sub) {
    return false;
  }

  if (['admin', 'root', 'warehouse', 'sales_supervisor'].includes(auth?.role)) {
    return false;
  }

  // Canonical check: explicit landing permission (mirrors resolveLanding + isAgentWorkspaceUser)
  if (auth?.role === 'sales_agent' || hasPermission(auth, 'agent.access')) {
    return true;
  }

  // Legacy heuristic for roles predating the landing-permission system.
  return Boolean(
    hasPermission(auth, 'sales.routes.view.own')
    && hasPermission(auth, 'sales.orders.create')
    && hasPermission(auth, 'customer.activities.manage')
    && !hasPermission(auth, 'sales.routes.assign')
    && !hasPermission(auth, 'sales.routes.view.all')
  );
}

function buildActorScopeDeniedError(policy) {
  if (policy.actorScope === 'global-root') {
    return createHttpError(403, 'Solo el root global puede ejecutar esta acción', 'forbidden');
  }

  if (policy.actorScope === 'company-admin') {
    return createHttpError(403, 'El administrador debe pertenecer a una empresa', 'forbidden');
  }

  if (policy.actorScope === 'agent-workspace-user') {
    return createHttpError(403, 'El usuario autenticado no tiene perfil comercial de agente', 'forbidden');
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

  if (policy.actorScope === 'agent-workspace-user') {
    return isAgentWorkspaceActor(auth);
  }

  return true;
}

module.exports = {
  buildActorScopeDeniedError,
  isActorScopeAllowed,
  isAgentWorkspaceActor,
};
