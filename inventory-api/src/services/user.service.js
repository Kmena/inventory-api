const bcrypt = require('bcrypt');

const { bcryptRounds } = require('../config');
const userRepository = require('../repositories/user.repository');
const roleRepository = require('../repositories/role.repository');
const { createHttpError } = require('../lib/errors');
const { buildPaginatedResponse } = require('../lib/pagination');

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

async function registerUser(payload) {
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

  return sanitizeUser(user);
}

async function registerCompanyUser(payload, auth) {
  assertCompanyAdmin(auth);

  const existing = await userRepository.findUserByUsername(payload.username);
  if (existing) {
    throw createHttpError(409, 'El username ya existe', 'conflict');
  }

  const role = await roleRepository.findRoleById(payload.roleId);
  if (!role || role.isActive === false) {
    throw createHttpError(400, 'Rol no disponible', 'validation_error');
  }
  if (role.code === 'root') {
    throw createHttpError(403, 'No se pueden crear usuarios root desde esta pantalla', 'forbidden');
  }
  if (role.companyId && role.companyId.toString() !== auth.companyId) {
    throw createHttpError(403, 'El rol no pertenece a esta empresa', 'forbidden');
  }

  const passwordHash = await bcrypt.hash(payload.password, bcryptRounds);
  const { password: _password, roleId, ...rest } = payload;

  const user = await userRepository.createUser({
    ...rest,
    companyId: BigInt(auth.companyId),
    roleId,
    passwordHash,
    status: 'ACTIVE',
  });

  return sanitizeUser(user);
}

module.exports = {
  listUsers,
  listCompanyUsers,
  registerUser,
  registerCompanyUser,
};
