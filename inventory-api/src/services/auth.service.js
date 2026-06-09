const bcrypt = require('bcrypt');

const userRepository = require('../repositories/user.repository');
const { signAccessToken } = require('../lib/auth');
const { createHttpError } = require('../lib/errors');

function mapPermissions(role) {
  return role?.rolePermissions
    ?.filter((item) => item.isEnabled && item.permission?.isActive)
    .map((item) => item.permission.code) || [];
}

async function login(payload) {
  const user = await userRepository.findUserByUsernameWithRelations(payload.username);
  if (!user) {
    throw createHttpError(401, 'Usuario o contraseña inválidos', 'unauthorized');
  }

  const isValidPassword = await bcrypt.compare(payload.password, user.passwordHash);
  if (!isValidPassword) {
    throw createHttpError(401, 'Usuario o contraseña inválidos', 'unauthorized');
  }

  if (user.status !== 'ACTIVE') {
    throw createHttpError(403, 'Usuario inactivo o bloqueado', 'forbidden');
  }

  if (user.role && user.role.isActive === false) {
    throw createHttpError(403, 'Rol inactivo', 'forbidden');
  }

  if (user.company && user.company.isActive === false) {
    throw createHttpError(403, 'Empresa inactiva', 'forbidden');
  }

  const token = signAccessToken(user);
  const { passwordHash, ...safeUser } = user;
  safeUser.permissions = mapPermissions(user.role);

  return { token, user: safeUser };
}

module.exports = {
  login,
};
