const prisma = require('../lib/prisma');

function findAllUsers() {
  return prisma.user.findMany({
    orderBy: { id: 'asc' },
    include: { company: true, role: true },
  });
}

function findUserByUsername(username) {
  return prisma.user.findUnique({ where: { username } });
}

function findUserByUsernameWithRelations(username) {
  return prisma.user.findUnique({
    where: { username },
    include: { company: true, role: true },
  });
}

function createUser(data) {
  return prisma.user.create({ data, include: { company: true, role: true } });
}

module.exports = {
  findAllUsers,
  findUserByUsername,
  findUserByUsernameWithRelations,
  createUser,
};
