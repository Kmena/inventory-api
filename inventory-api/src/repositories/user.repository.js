const prisma = require('../lib/prisma');

function userRelationsInclude() {
  return {
    company: true,
    role: {
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    },
  };
}

function findAllUsers() {
  return prisma.user.findMany({
    orderBy: { id: 'asc' },
    include: userRelationsInclude(),
  });
}

function findUsersByCompanyId(companyId) {
  return prisma.user.findMany({
    where: { companyId },
    orderBy: { id: 'asc' },
    include: userRelationsInclude(),
  });
}

function findUserByUsername(username) {
  return prisma.user.findUnique({ where: { username } });
}

function findRoleByCode(code) {
  return prisma.role.findUnique({ where: { code } });
}

function findUserByUsernameWithRelations(username) {
  return prisma.user.findUnique({
    where: { username },
    include: userRelationsInclude(),
  });
}

function findAuthenticatedUserById(id) {
  return prisma.user.findUnique({
    where: { id },
    include: userRelationsInclude(),
  });
}

function createUser(data) {
  return prisma.user.create({
    data,
    include: userRelationsInclude(),
  });
}

module.exports = {
  findAllUsers,
  findUsersByCompanyId,
  findUserByUsername,
  findRoleByCode,
  findUserByUsernameWithRelations,
  findAuthenticatedUserById,
  createUser,
};
