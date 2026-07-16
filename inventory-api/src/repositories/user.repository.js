// @ts-nocheck -- Prisma orderBy literals are kept explicit in JS repositories.
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

function findAllUsers(pagination = null) {
  const orderBy = { id: 'asc' };
  const include = userRelationsInclude();
  if (!pagination) {
    return prisma.user.findMany({
      orderBy,
      include,
    });
  }

  return prisma.$transaction([
    prisma.user.count(),
    prisma.user.findMany({
      orderBy,
      include,
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]).then(([totalItems, items]) => ({ totalItems, items }));
}

function findUsersByCompanyId(companyId, pagination = null) {
  const where = { companyId };
  const orderBy = { id: 'asc' };
  const include = userRelationsInclude();
  if (!pagination) {
    return prisma.user.findMany({
      where,
      orderBy,
      include,
    });
  }

  return prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy,
      include,
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]).then(([totalItems, items]) => ({ totalItems, items }));
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
