const bcrypt = require('bcrypt');

const { bcryptRounds } = require('../config');
const userRepository = require('../repositories/user.repository');
const { createHttpError } = require('../lib/errors');

function sanitizeUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

async function listUsers() {
  const users = await userRepository.findAllUsers();
  return users.map(sanitizeUser);
}

async function registerUser(payload) {
  const existing = await userRepository.findUserByUsername(payload.username);
  if (existing) {
    throw createHttpError(409, 'El username ya existe', 'conflict');
  }

  const passwordHash = await bcrypt.hash(payload.password, bcryptRounds);
  const { password, ...rest } = payload;

  const user = await userRepository.createUser({
    ...rest,
    passwordHash,
  });

  return sanitizeUser(user);
}

module.exports = {
  listUsers,
  registerUser,
};
