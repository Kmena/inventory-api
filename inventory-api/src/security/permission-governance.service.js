const {
  PERMISSION_GOVERNANCE_POLICY,
  WARNING_CONTRACT_FIELDS,
  GOVERNED_OPERATIONS,
} = require('./permission-governance.config');

function isGlobalRootActor(auth) {
  return auth?.role === 'root' && !auth?.companyId;
}

function createGovernanceWarning({ code, ruleId, message, severity = 'warn', affectedPermissions = [], status = 'proposed' }) {
  return Object.freeze({
    code,
    ruleId,
    message,
    severity,
    affectedPermissions: Object.freeze([...affectedPermissions]),
    status,
  });
}

function getGovernedOperation(operation) {
  return GOVERNED_OPERATIONS.find((item) => item.operation === operation) || null;
}

function getPermissionMetadata(permissionCode) {
  return PERMISSION_GOVERNANCE_POLICY.permissionMetadata.find((permission) => permission.code === permissionCode) || null;
}

function listPlatformScopedPermissionCodes(permissionCodes = []) {
  return [...new Set(permissionCodes)].filter((permissionCode) => getPermissionMetadata(permissionCode)?.scope === 'platform');
}

function permissionRequiresJustification(permissionCode) {
  return /** @type {{ requiresJustification?: boolean } | null} */ (getPermissionMetadata(permissionCode))?.requiresJustification === true;
}

function listJustificationRequiredPermissionCodes(permissionCodes = []) {
  return [...new Set(permissionCodes)].filter((permissionCode) => permissionRequiresJustification(permissionCode));
}

function evaluateGovernanceOperation(operation, context = {}) {
  if (operation === 'company.create') {
    if (isGlobalRootActor(context.auth)) {
      return {
        operation,
        decision: 'allow',
        warnings: Object.freeze([]),
      };
    }

    return {
      operation,
      decision: 'deny',
      warnings: Object.freeze([]),
      denial: {
        code: 'platform_global_required',
        ruleId: 'platform-root-only-company-create',
        message: 'Solo un root global puede crear compañías nuevas',
        severity: 'deny',
        status: 'approved',
      },
    };
  }

  if (operation === 'role.company.create' || operation === 'role.company.update') {
    const platformScopedPermissionCodes = listPlatformScopedPermissionCodes(context.permissionCodes);
    if (platformScopedPermissionCodes.length > 0) {
      return {
        operation,
        decision: 'deny',
        warnings: Object.freeze([]),
        denial: {
          code: 'platform_permission_not_assignable',
          ruleId: 'tenant-role-platform-permission-denied',
          message: `Los roles de empresa no pueden incluir permisos de plataforma: ${platformScopedPermissionCodes.join(', ')}`,
          severity: 'deny',
          status: 'approved',
          affectedPermissions: Object.freeze(platformScopedPermissionCodes),
        },
      };
    }
  }

  const governedOperation = getGovernedOperation(operation);
  if (!governedOperation || governedOperation.enforcement !== 'warn') {
    return {
      operation,
      decision: 'allow',
      warnings: Object.freeze([]),
    };
  }

  return {
    operation,
    decision: 'allow',
    warnings: Object.freeze([
      createGovernanceWarning({
        code: `${operation}.policy_pending`,
        ruleId: `${operation}.policy_pending`,
        message: 'La política definitiva de esta operación sigue pendiente de aprobación',
      }),
    ]),
  };
}

module.exports = {
  PERMISSION_GOVERNANCE_POLICY,
  WARNING_CONTRACT_FIELDS,
  isGlobalRootActor,
  createGovernanceWarning,
  getGovernedOperation,
  getPermissionMetadata,
  listPlatformScopedPermissionCodes,
  permissionRequiresJustification,
  listJustificationRequiredPermissionCodes,
  evaluateGovernanceOperation,
};
