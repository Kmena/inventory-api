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

// ── Landing permission helpers ──────────────────────────────────────

const LANDING_TARGETS = Object.freeze({
  root: '/root/',
  warehouse: '/warehouse/',
  agent: '/agent/',
});

/**
 * Priority map for landing permissions when a user has more than one.
 * Lower number = higher priority. root.access wins over warehouse.access.
 * The admin seed role has all permissions (warehouse.access + root.access after backfill),
 * so this deterministic order is required to ensure admin always lands on /root/.
 */
const LANDING_PERMISSION_PRIORITY = Object.freeze({
  'root.access': 0,
  'agent.access': 1,
  'warehouse.access': 2,
});

/**
 * Returns true if `code` is a landing permission based on metadata.
 * @param {string} code
 * @returns {boolean}
 */
function isLandingPermission(code) {
  const meta = /** @type {{ permissionKind?: string } | null} */ (getPermissionMetadata(code));
  return meta?.permissionKind === 'landing';
}

/**
 * Filters the supplied permission codes to only those that are landing permissions.
 * @param {string[]} permissionCodes
 * @returns {string[]}
 */
function listLandingPermissionCodes(permissionCodes = []) {
  return [...new Set(permissionCodes)].filter(isLandingPermission);
}

/**
 * All landing permission codes defined in metadata.
 * @returns {string[]}
 */
function getAllLandingPermissionCodes() {
  return PERMISSION_GOVERNANCE_POLICY.permissionMetadata
    .filter((m) => /** @type {{ permissionKind?: string }} */ (m).permissionKind === 'landing')
    .map((m) => m.code);
}

/**
 * Resolves the canonical landing for a set of permissions + auth context.
 *
 * Priority:
 * 1. Root global (role.code='root', no companyId) → platform rule.
 * 2. Explicit landing permission from the set.
 * 3. Legacy fallback (temporary — removed after backfill).
 *
 * @param {string[]} permissionCodes
 * @param {{ role?: string, companyId?: string|null }} [authOrUser]
 * @returns {{ target: string, path: string, source: string, permissionCode: string|null, trace: string[] }}
 */
function resolveLanding(permissionCodes = [], authOrUser = {}) {
  const trace = [];

  // 1. Root global exception
  const roleCode = authOrUser?.role ?? null;
  if (roleCode === 'root' && !authOrUser?.companyId) {
    trace.push('platform-root-rule');
    return { target: 'root', path: '/root/', source: 'platform-root-rule', permissionCode: null, trace };
  }

  // 2. Explicit landing permission
  const landingCodes = listLandingPermissionCodes(permissionCodes);
  if (landingCodes.length === 1) {
    const code = landingCodes[0];
    const meta = /** @type {{ landingTarget?: string } | null} */ (getPermissionMetadata(code));
    const target = meta?.landingTarget || 'root';
    trace.push(`explicit-landing:${code}`);
    return { target, path: LANDING_TARGETS[target] || '/no-access.html', source: 'permission', permissionCode: code, trace };
  }

  if (landingCodes.length > 1) {
    // Sort by explicit priority so root.access always beats warehouse.access.
    // This is required for the admin role which legitimately holds all permissions
    // (warehouse.access from seed + root.access from backfill migration).
    const sorted = [...landingCodes].sort(
      (a, b) => (LANDING_PERMISSION_PRIORITY[a] ?? 99) - (LANDING_PERMISSION_PRIORITY[b] ?? 99),
    );
    const code = sorted[0];
    const meta = /** @type {{ landingTarget?: string } | null} */ (getPermissionMetadata(code));
    const target = meta?.landingTarget || 'root';
    trace.push(`multiple-landings-resolved:${code}`);
    return { target, path: LANDING_TARGETS[target] || '/no-access.html', source: 'permission', permissionCode: code, trace };
  }

  // 3. Legacy fallback (DEC-007: temporary during transition)
  trace.push('legacy-fallback');
  if (roleCode === 'admin' && authOrUser?.companyId) {
    return { target: 'root', path: '/root/', source: 'legacy-fallback', permissionCode: null, trace };
  }
  if (roleCode === 'sales_agent') {
    return { target: 'agent', path: '/agent/', source: 'legacy-fallback', permissionCode: null, trace };
  }
  if (roleCode === 'sales_supervisor') {
    return { target: 'root', path: '/root/', source: 'legacy-fallback', permissionCode: null, trace };
  }
  if (permissionCodes.includes('procurement.manage')) {
    trace.push('legacy:procurement.manage');
    return { target: 'root', path: '/root/', source: 'legacy-fallback', permissionCode: null, trace };
  }

  return { target: 'no-access', path: '/no-access.html', source: 'none', permissionCode: null, trace };
}

/**
 * Validates that a set of permission codes has exactly one landing permission.
 * Returns { valid: true } or { valid: false, code, message }.
 * @param {string[]} permissionCodes
 * @returns {{ valid: boolean, code?: string, message?: string, landingCodes?: string[] }}
 */
function validateLandingCardinalityForTenantRole(permissionCodes = []) {
  const landingCodes = listLandingPermissionCodes(permissionCodes);

  if (landingCodes.length === 0) {
    return {
      valid: false,
      code: 'landing_required',
      message: 'El rol de empresa requiere exactamente un permiso de acceso principal (landing). Seleccione uno: root.access, warehouse.access o agent.access.',
      landingCodes,
    };
  }

  if (landingCodes.length > 1) {
    return {
      valid: false,
      code: 'landing_conflict',
      message: `El rol de empresa solo puede tener un permiso de acceso principal. Se encontraron ${landingCodes.length} incompatibles: ${landingCodes.join(', ')}.`,
      landingCodes,
    };
  }

  return { valid: true, landingCodes };
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
    // Rule: no platform permissions in tenant roles
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

    // Rule: exactly one landing permission per tenant role
    const landingValidation = validateLandingCardinalityForTenantRole(context.permissionCodes);
    if (!landingValidation.valid) {
      return {
        operation,
        decision: 'deny',
        warnings: Object.freeze([]),
        denial: {
          code: landingValidation.code,
          ruleId: landingValidation.code === 'landing_conflict' ? 'landing-primary-singleton' : 'landing-required-for-tenant-role',
          message: landingValidation.message,
          severity: 'deny',
          status: 'approved',
          affectedPermissions: Object.freeze(landingValidation.landingCodes || []),
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
  LANDING_TARGETS,
  isGlobalRootActor,
  createGovernanceWarning,
  getGovernedOperation,
  getPermissionMetadata,
  listPlatformScopedPermissionCodes,
  permissionRequiresJustification,
  listJustificationRequiredPermissionCodes,
  isLandingPermission,
  listLandingPermissionCodes,
  getAllLandingPermissionCodes,
  resolveLanding,
  validateLandingCardinalityForTenantRole,
  evaluateGovernanceOperation,
};
