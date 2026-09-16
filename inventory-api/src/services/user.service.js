const bcrypt = require('bcrypt');

const { bcryptRounds } = require('../config');
const userRepository = require('../repositories/user.repository');
const roleRepository = require('../repositories/role.repository');
const { createHttpError } = require('../lib/errors');
const { buildPaginatedResponse } = require('../lib/pagination');
const audit = require('../lib/audit');
const browserSessionService = require('./browser-session.service');

function sanitizeUser(user) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

async function listUsers(pagination = null) {
  const users = await userRepository.findAllUsers(pagination);
  if (!pagination) {
    const userRows = /** @type {Array<any>} */ (users);
    return userRows.map(sanitizeUser);
  }
  const paginatedUsers = /** @type {{ items: Array<any>, totalItems: number }} */ (users);
  return buildPaginatedResponse(paginatedUsers.items.map(sanitizeUser), pagination, paginatedUsers.totalItems);
}

function assertCompanyAdmin(auth) {
  if (!auth.companyId) {
    throw createHttpError(403, 'El actor debe pertenecer a una empresa', 'forbidden');
  }
}

function getEffectivePermissionCodesFromRole(role) {
  return (role?.rolePermissions || [])
    .filter((rolePermission) => rolePermission?.isEnabled !== false && rolePermission?.permission?.isActive !== false)
    .map((rolePermission) => rolePermission.permission.code);
}

function actorHasPermission(auth, permissionCode) {
  return (auth?.permissions || []).includes(permissionCode);
}

// Permissions that require the actor to possess them before assigning a role that contains them.
// Mirrors the self-lockout protected set from role.service.js (DEC-006, DEC-008):
// an actor cannot delegate governance authority they do not themselves hold.
const DELEGATION_SENSITIVE_PERMISSIONS = Object.freeze([
  'roles.manage',
  'settings.manage',
  'users.manage',
]);

async function resolveAssignableRoleForCompany(requestedRoleId, auth, options = {}) {
  const companyId = BigInt(auth.companyId);
  let role = await roleRepository.findAssignableRoleByIdForCompany(requestedRoleId, companyId);
  if (!role) {
    const unscopedRole = await roleRepository.findRoleById(requestedRoleId);
    if (!unscopedRole || unscopedRole.isActive === false) {
      throw createHttpError(400, 'Rol no disponible', 'validation_error');
    }
    if (unscopedRole.code === 'root') {
      const rootRoleMessage = options.rootRoleMessage || 'No se pueden asignar roles root desde esta pantalla';
      throw createHttpError(403, rootRoleMessage, 'forbidden');
    }
    if (unscopedRole.companyId && unscopedRole.companyId.toString() !== auth.companyId) {
      throw createHttpError(403, 'El rol no pertenece a esta empresa', 'forbidden');
    }
    role = unscopedRole;
  }

  // Delegation governance: actor cannot assign governance authority they do not possess.
  // Check every delegation-sensitive permission the target role contains against the actor.
  const rolePermissionCodes = getEffectivePermissionCodesFromRole(role);
  const missingDelegation = DELEGATION_SENSITIVE_PERMISSIONS.filter(
    (p) => rolePermissionCodes.includes(p) && !actorHasPermission(auth, p),
  );
  if (missingDelegation.length > 0) {
    throw createHttpError(
      403,
      `No se puede asignar un rol con permisos administrativos que el actor no posee: ${missingDelegation.join(', ')}`,
      'forbidden',
    );
  }

  return role;
}

async function listCompanyUsers(auth, pagination = null) {
  assertCompanyAdmin(auth);
  const users = await userRepository.findUsersByCompanyId(BigInt(auth.companyId), pagination);
  if (!pagination) {
    const userRows = /** @type {Array<any>} */ (users);
    return userRows.map(sanitizeUser);
  }
  const paginatedUsers = /** @type {{ items: Array<any>, totalItems: number }} */ (users);
  return buildPaginatedResponse(paginatedUsers.items.map(sanitizeUser), pagination, paginatedUsers.totalItems);
}

async function registerUser(payload, req = null) {
  const existing = await userRepository.findUserByUsername(payload.username);
  if (existing) {
    throw createHttpError(409, 'El username ya existe', 'conflict');
  }

  const passwordHash = await bcrypt.hash(payload.password, bcryptRounds);
  const { password: _password, ...rest } = payload;

  const user = await userRepository.createUser({
    ...rest,
    passwordHash,
  });

  const safeUser = sanitizeUser(user);
  await audit.recordAuditEventIfAvailable({
    req,
    action: 'users.create',
    resourceType: 'user',
    resourceId: safeUser.id,
    outcome: 'SUCCESS',
    afterState: {
      id: safeUser.id,
      username: safeUser.username,
      companyId: safeUser.companyId,
      roleId: safeUser.roleId,
      status: safeUser.status,
    },
  });

  return safeUser;
}

async function registerCompanyUser(payload, auth, req = null) {
  assertCompanyAdmin(auth);

  const existing = await userRepository.findUserByUsername(payload.username);
  if (existing) {
    throw createHttpError(409, 'El username ya existe', 'conflict');
  }

  const companyId = BigInt(auth.companyId);
  const requestedRoleId = BigInt(payload.roleId);

  await resolveAssignableRoleForCompany(requestedRoleId, auth, {
    rootRoleMessage: 'No se pueden crear usuarios root desde esta pantalla',
  });

  const passwordHash = await bcrypt.hash(payload.password, bcryptRounds);
  const { password: _password, roleId, ...rest } = payload;

  const user = await userRepository.createUser({
    ...rest,
    companyId,
    roleId,
    passwordHash,
    status: 'ACTIVE',
  });

  const safeUser = sanitizeUser(user);
  await audit.recordAuditEventIfAvailable({
    req,
    action: 'users.company.create',
    resourceType: 'user',
    resourceId: safeUser.id,
    outcome: 'SUCCESS',
    afterState: {
      id: safeUser.id,
      username: safeUser.username,
      companyId: safeUser.companyId,
      roleId: safeUser.roleId,
      status: safeUser.status,
    },
  });

  return safeUser;
}

async function updateCompanyUser(userId, payload, auth, req = null) {
  assertCompanyAdmin(auth);
  const companyId = BigInt(auth.companyId);
  const targetUserId = BigInt(userId);
  const existingUser = await userRepository.findUserByIdForCompany(targetUserId, companyId);
  if (!existingUser) {
    throw createHttpError(404, 'Usuario no encontrado', 'not_found');
  }

  const allowedFields = ['fullName', 'email', 'phone'];
  const data = Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => allowedFields.includes(key) && value !== undefined),
  );

  const updatedUser = await userRepository.updateCompanyUserFields(targetUserId, companyId, data);
  const safeUser = sanitizeUser(updatedUser);
  await audit.recordAuditEventIfAvailable({
    req,
    action: 'users.company.update',
    resourceType: 'user',
    resourceId: safeUser.id,
    outcome: 'SUCCESS',
    beforeState: { id: existingUser.id, fullName: existingUser.fullName, email: existingUser.email, phone: existingUser.phone },
    afterState: { id: safeUser.id, fullName: safeUser.fullName, email: safeUser.email, phone: safeUser.phone },
  });

  return safeUser;
}

async function assignCompanyUserRole(userId, payload, auth, req = null) {
  assertCompanyAdmin(auth);
  const companyId = BigInt(auth.companyId);
  const targetUserId = BigInt(userId);
  const existingUser = await userRepository.findUserByIdForCompany(targetUserId, companyId);
  if (!existingUser) {
    throw createHttpError(404, 'Usuario no encontrado', 'not_found');
  }

  const actorUserId = auth.sub || auth.userId || auth.id;
  if (actorUserId && actorUserId.toString() === targetUserId.toString()) {
    throw createHttpError(403, 'No puedes cambiar tu propio rol desde esta operación', 'forbidden');
  }

  const requestedRoleId = BigInt(payload.roleId);
  await resolveAssignableRoleForCompany(requestedRoleId, auth);
  const updatedUser = await userRepository.assignCompanyUserRole(targetUserId, companyId, requestedRoleId);
  const safeUser = sanitizeUser(updatedUser);
  await browserSessionService.invalidateBrowserSessionsForUser(targetUserId, {
    reason: 'user_role_changed',
    requestId: req?.requestContext?.requestId,
  });

  await audit.recordAuditEventIfAvailable({
    req,
    action: 'users.company.assign-role',
    resourceType: 'user',
    resourceId: safeUser.id,
    outcome: 'SUCCESS',
    beforeState: { id: existingUser.id, roleId: existingUser.roleId },
    afterState: { id: safeUser.id, roleId: safeUser.roleId },
  });

  return safeUser;
}

module.exports = {
  listUsers,
  listCompanyUsers,
  registerUser,
  registerCompanyUser,
  updateCompanyUser,
  assignCompanyUserRole,
};
