const prisma = require('../lib/prisma');

function findAllUsers() {
  return prisma.user.findMany({
    orderBy: { id: 'asc' },
    include: { company: true, role: { include: { rolePermissions: { include: { permission: true } } } } },
  });
}

function findUsersByCompanyId(companyId) {
  return prisma.user.findMany({
    where: { companyId },
    orderBy: { id: 'asc' },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
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
    include: { company: true, role: { include: { rolePermissions: { include: { permission: true } } } } },
  });
}

function createUser(data) {
  return prisma.user.create({
    data,
    include: { company: true, role: { include: { rolePermissions: { include: { permission: true } } } } },
  });
}

module.exports = {
  findAllUsers,
  findUsersByCompanyId,
  findUserByUsername,
  findRoleByCode,
  findUserByUsernameWithRelations,
  createUser,
};
