const bcrypt = require('bcrypt');

const userRepository = require('../repositories/user.repository');
const { signAccessToken } = require('../lib/auth');
const { createHttpError } = require('../lib/errors');

async function login(payload) {
  const user = await userRepository.findUserByUsernameWithRelations(payload.username);
  if (!user) {
    throw createHttpError(401, 'Usuario o contraseña inválidos', 'unauthorized');
  }

  const isValidPassword = await bcrypt.compare(payload.password, user.passwordHash);
  if (!isValidPassword) {
    throw createHttpError(401, 'Usuario o contraseña inválidos', 'unauthorized');
  }

  const token = signAccessToken(user);
  const { passwordHash, ...safeUser } = user;

  return { token, user: safeUser };
}

module.exports = {
  login,
};
