const bcrypt = require('bcrypt');

const { bcryptRounds } = require('../config');
const userRepository = require('../repositories/user.repository');
const roleRepository = require('../repositories/role.repository');
const { createHttpError } = require('../lib/errors');
const { buildPaginatedResponse } = require('../lib/pagination');
const audit = require('../lib/audit');

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
    throw createHttpError(403, 'El administrador debe pertenecer a una empresa', 'forbidden');
  }
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

  let role = await roleRepository.findAssignableRoleByIdForCompany(requestedRoleId, companyId);
  if (!role) {
    const unscopedRole = await roleRepository.findRoleById(requestedRoleId);
    if (!unscopedRole || unscopedRole.isActive === false) {
      throw createHttpError(400, 'Rol no disponible', 'validation_error');
    }
    if (unscopedRole.code === 'root') {
      throw createHttpError(403, 'No se pueden crear usuarios root desde esta pantalla', 'forbidden');
    }
    if (unscopedRole.companyId && unscopedRole.companyId.toString() !== auth.companyId) {
      throw createHttpError(403, 'El rol no pertenece a esta empresa', 'forbidden');
    }
    role = unscopedRole;
  }

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

module.exports = {
  listUsers,
  listCompanyUsers,
  registerUser,
  registerCompanyUser,
};
