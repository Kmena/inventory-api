const { createHttpError } = require('../lib/errors');
const { buildPaginatedResponse } = require('../lib/pagination');
const roleRepository = require('../repositories/role.repository');
const audit = require('../lib/audit');
const { evaluateGovernanceOperation } = require('../security/permission-governance.service');

function assertCompanyAdmin(auth) {
  if (!auth.companyId) {
    throw createHttpError(403, 'El administrador debe pertenecer a una empresa', 'forbidden');
  }
}

function serializeRole(role) {
  return {
    id: role.id,
    code: role.code,
    name: role.name,
    companyId: role.companyId,
    isActive: role.isActive,
    permissions: role.rolePermissions
      ?.filter((item) => item.isEnabled && item.permission?.isActive)
      .map((item) => item.permission) || [],
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

async function listPermissions(auth) {
  assertCompanyAdmin(auth);
  return roleRepository.findActivePermissions();
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

module.exports = {
  listPermissions,
  listAssignableRoles,
  createCompanyRole,
};
