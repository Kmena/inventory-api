const { createHttpError } = require('../lib/errors');
const { buildPaginatedResponse } = require('../lib/pagination');
const roleRepository = require('../repositories/role.repository');
const userRepository = require('../repositories/user.repository');
const audit = require('../lib/audit');
const browserSessionService = require('./browser-session.service');
const {
  evaluateGovernanceOperation,
  getPermissionMetadata,
  isLandingPermission,
  resolveLanding,
} = require('../security/permission-governance.service');

function assertCompanyAdmin(auth) {
  if (!auth.companyId) {
    throw createHttpError(403, 'El administrador debe pertenecer a una empresa', 'forbidden');
  }
}

function serializeRole(role) {
  const allPermissions = role.rolePermissions
    ?.filter((item) => item.isEnabled && item.permission?.isActive)
    .map((item) => {
      const meta = getPermissionMetadata(item.permission.code);
      return {
        ...item.permission,
        displayLabel: meta?.uiLabel || item.permission.code,
      };
    }) || [];

  const landingPermission = allPermissions.find((p) => isLandingPermission(p.code)) || null;
  const operationalPermissions = allPermissions.filter((p) => !isLandingPermission(p.code));

  const permissionCodes = allPermissions.map((p) => p.code);
  const roleCode = role.code || null;
  const companyId = role.companyId ? role.companyId.toString() : null;
  const landing = resolveLanding(permissionCodes, { role: roleCode, companyId });

  return {
    id: role.id,
    code: role.code,
    name: role.name,
    companyId: role.companyId,
    isActive: role.isActive,
    permissions: allPermissions,
    landingPermission: landingPermission ? { code: landingPermission.code, displayLabel: landingPermission.displayLabel } : null,
    operationalPermissions,
    landing,
  };
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'rol';
}

function enrichPermissionWithMetadata(permission) {
  const metadata = getPermissionMetadata(permission.code);
  return {
    id: permission.id,
    code: permission.code,
    module: permission.module,
    action: permission.action,
    description: permission.description,
    isActive: permission.isActive,
    displayLabel: metadata?.uiLabel || permission.code,
    businessDescription: metadata?.notes || permission.description || '',
    moduleCategory: metadata?.category || permission.module || 'general',
    scope: metadata?.scope || 'tenant',
    sensitivity: metadata?.sensitivity || 'operational',
    metadataStatus: metadata ? 'complete' : 'missing',
    permissionKind: /** @type {{ permissionKind?: string } | null | undefined} */ (metadata)?.permissionKind || 'functional',
    landingTarget: /** @type {{ landingTarget?: string } | null | undefined} */ (metadata)?.landingTarget || null,
    exclusiveGroup: /** @type {{ exclusiveGroup?: string } | null | undefined} */ (metadata)?.exclusiveGroup || null,
  };
}

async function listPermissions(auth) {
  assertCompanyAdmin(auth);
  const permissions = await roleRepository.findActivePermissions();
  const enriched = permissions.map(enrichPermissionWithMetadata);
  return enriched.filter((p) => p.scope !== 'platform');
}

async function listAssignableRoles(auth, pagination = null) {
  assertCompanyAdmin(auth);
  const roles = await roleRepository.findAssignableRoles(BigInt(auth.companyId), pagination);
  if (!pagination) {
    const roleRows = /** @type {Array<any>} */ (roles);
    return roleRows.map(serializeRole);
  }
  const paginatedRoles = /** @type {{ items: Array<any>, totalItems: number }} */ (roles);
  return buildPaginatedResponse(paginatedRoles.items.map(serializeRole), pagination, paginatedRoles.totalItems);
}

async function recordCompanyRoleGovernanceDenialAudit(governanceDecision, auth, requestedPermissionCodes, req) {
  if (governanceDecision.decision !== 'deny') {
    return;
  }

  await audit.recordAuditEventSafelyIfAvailable({
    req,
    action: 'roles.company.create.governance_denied',
    resourceType: 'role',
    outcome: 'REJECTED',
    reasonCode: governanceDecision.denial.code,
    metadata: {
      governanceDecision: governanceDecision.decision,
      denialCode: governanceDecision.denial.code,
      ruleId: governanceDecision.denial.ruleId,
      affectedPermissions: governanceDecision.denial.affectedPermissions || [],
      requestedPermissionCodes,
      companyId: auth.companyId,
    },
  });
}

async function assertCompanyRoleCreationAllowed(governanceDecision, auth, requestedPermissionCodes, req) {
  if (governanceDecision.decision === 'deny') {
    await recordCompanyRoleGovernanceDenialAudit(governanceDecision, auth, requestedPermissionCodes, req);
    throw createHttpError(403, governanceDecision.denial.message, governanceDecision.denial.code);
  }
}

async function createCompanyRole(payload, auth, req = null) {
  assertCompanyAdmin(auth);

  const companyId = BigInt(auth.companyId);
  const uniquePermissionCodes = [...new Set(payload.permissionCodes)];
  const permissions = await roleRepository.findActivePermissions();
  const activePermissionCodes = new Set(permissions.map((permission) => permission.code));
  const invalidPermission = uniquePermissionCodes.find((code) => !activePermissionCodes.has(code));
  if (invalidPermission) {
    throw createHttpError(400, `Permiso no disponible: ${invalidPermission}`, 'validation_error');
  }

  const governanceDecision = evaluateGovernanceOperation('role.company.create', {
    auth,
    permissionCodes: uniquePermissionCodes,
  });
  await assertCompanyRoleCreationAllowed(governanceDecision, auth, uniquePermissionCodes, req);

  const code = `company_${auth.companyId}_${slugify(payload.name)}_${Date.now()}`;
  const role = await roleRepository.createCompanyRole({
    companyId,
    code,
    name: payload.name,
    permissionCodes: uniquePermissionCodes,
  });

  const serializedRole = serializeRole(role);
  await audit.recordAuditEventIfAvailable({
    req,
    action: 'roles.company.create',
    resourceType: 'role',
    resourceId: serializedRole.id,
    outcome: 'SUCCESS',
    afterState: {
      id: serializedRole.id,
      code: serializedRole.code,
      name: serializedRole.name,
      companyId: serializedRole.companyId,
      permissionsCount: serializedRole.permissions.length,
    },
    metadata: {
      governanceDecision: governanceDecision.decision,
      governanceWarnings: governanceDecision.warnings,
    },
  });
  return serializedRole;
}

const SELF_LOCKOUT_PROTECTED_PERMISSIONS = ['settings.manage', 'users.manage'];

function assertNotGlobalRole(role) {
  if (!role.companyId) {
    throw createHttpError(403, 'No se pueden editar roles globales desde este panel', 'forbidden');
  }
}

function assertRoleBelongsToCompany(role, companyId) {
  if (role.companyId.toString() !== companyId.toString()) {
    throw createHttpError(403, 'No tiene acceso para editar este rol', 'forbidden');
  }
}

function assertNoSelfLockout(auth, role, newPermissionCodes) {
  if (!auth.roleId || role.id.toString() !== auth.roleId.toString()) {
    return;
  }

  const missingProtected = SELF_LOCKOUT_PROTECTED_PERMISSIONS.filter(
    (code) => !newPermissionCodes.includes(code),
  );

  if (missingProtected.length > 0) {
    throw createHttpError(
      400,
      `No puedes quitarte los permisos administrativos minimos de tu propio rol: ${missingProtected.join(', ')}`,
      'self_lockout_prevented',
    );
  }
}

async function invalidateAffectedBrowserSessionsForRole(role, auth, req = null) {
  const affectedUsers = await userRepository.findActiveUsersByRoleId(role.id, BigInt(auth.companyId));
  if (!affectedUsers.length) {
    return 0;
  }

  return browserSessionService.invalidateBrowserSessionsForUsers(
    affectedUsers.map((user) => user.id),
    {
      req,
      reasonCode: 'role_permission_change',
      metadata: {
        roleId: role.id.toString(),
        companyId: auth.companyId,
      },
    },
  );
}

async function updateCompanyRole(roleId, payload, auth, req = null) {
  assertCompanyAdmin(auth);

  const companyId = BigInt(auth.companyId);
  const requestedRoleId = BigInt(roleId);

  let role = await roleRepository.findCompanyOwnedRoleById(requestedRoleId, companyId);
  if (!role) {
    const unscopedRole = await roleRepository.findRoleById(requestedRoleId);
    if (!unscopedRole || !unscopedRole.isActive) {
      throw createHttpError(404, 'Rol no encontrado', 'not_found');
    }

    assertNotGlobalRole(unscopedRole);
    assertRoleBelongsToCompany(unscopedRole, companyId);
    role = unscopedRole;
  }

  const uniquePermissionCodes = [...new Set(payload.permissionCodes)];
  const permissions = await roleRepository.findActivePermissions();
  const activePermissionCodes = new Set(permissions.map((permission) => permission.code));
  const invalidPermission = uniquePermissionCodes.find((code) => !activePermissionCodes.has(code));
  if (invalidPermission) {
    throw createHttpError(400, `Permiso no disponible: ${invalidPermission}`, 'validation_error');
  }

  const governanceDecision = evaluateGovernanceOperation('role.company.update', {
    auth,
    permissionCodes: uniquePermissionCodes,
  });

  if (governanceDecision.decision === 'deny') {
    await audit.recordAuditEventSafelyIfAvailable({
      req,
      action: 'roles.company.update.governance_denied',
      resourceType: 'role',
      resourceId: role.id,
      outcome: 'REJECTED',
      reasonCode: governanceDecision.denial.code,
      metadata: {
        governanceDecision: governanceDecision.decision,
        denialCode: governanceDecision.denial.code,
        ruleId: governanceDecision.denial.ruleId,
        affectedPermissions: governanceDecision.denial.affectedPermissions || [],
        requestedPermissionCodes: uniquePermissionCodes,
        companyId: auth.companyId,
      },
    });
    throw createHttpError(403, governanceDecision.denial.message, governanceDecision.denial.code);
  }

  assertNoSelfLockout(auth, role, uniquePermissionCodes);

  const beforePermissions = (role.rolePermissions || [])
    .filter((item) => item.isEnabled && item.permission?.isActive)
    .map((item) => item.permission.code);

  const updatedRole = await roleRepository.updateCompanyRolePermissions({
    roleId: role.id,
    name: payload.name,
    permissionCodes: uniquePermissionCodes,
  });

  const invalidatedSessionCount = await invalidateAffectedBrowserSessionsForRole(role, auth, req);

  const serializedRole = serializeRole(updatedRole);
  await audit.recordAuditEventIfAvailable({
    req,
    action: 'roles.company.update',
    resourceType: 'role',
    resourceId: serializedRole.id,
    outcome: 'SUCCESS',
    beforeState: {
      name: role.name,
      permissionCodes: beforePermissions,
      permissionsCount: beforePermissions.length,
    },
    afterState: {
      name: serializedRole.name,
      permissionCodes: serializedRole.permissions.map((p) => p.code),
      permissionsCount: serializedRole.permissions.length,
    },
    metadata: {
      governanceDecision: governanceDecision.decision,
      governanceWarnings: governanceDecision.warnings,
      sessionInvalidation: {
        reasonCode: 'role_permission_change',
        affectedRoleId: role.id.toString(),
        invalidatedSessionCount,
      },
    },
  });
  return serializedRole;
}

module.exports = {
  listPermissions,
  listAssignableRoles,
  createCompanyRole,
  updateCompanyRole,
};
