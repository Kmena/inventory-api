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
  /** @type {{ id: 'asc' }} */
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
  /** @type {{ id: 'asc' }} */
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

function findUserByIdForCompany(id, companyId) {
  return prisma.user.findFirst({
    where: { id, companyId },
    include: userRelationsInclude(),
  });
}

function updateCompanyUserFields(id, companyId, data) {
  // companyId is included in the WHERE clause for defense-in-depth (P5-002).
  // The service already verifies company ownership via findUserByIdForCompany before
  // calling this function, but adding it here prevents hypothetical bypass paths.
  return prisma.user.update({
    where: { id, companyId },
    data,
    include: userRelationsInclude(),
  });
}

function assignCompanyUserRole(id, companyId, roleId) {
  // companyId included for defense-in-depth (P5-002). Same rationale as above.
  return prisma.user.update({
    where: { id, companyId },
    data: { roleId },
    include: userRelationsInclude(),
  });
}

function updateUserPasswordHash(id, passwordHash) {
  return prisma.user.update({
    where: { id },
    data: { passwordHash },
    select: { id: true, username: true },
  });
}

function findActiveUsersByRoleId(roleId, companyId = null) {
  return prisma.user.findMany({
    where: {
      roleId,
      status: 'ACTIVE',
      ...(companyId ? { companyId } : {}),
    },
    select: {
      id: true,
    },
    orderBy: {
      id: 'asc',
    },
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
  findUserByIdForCompany,
  updateCompanyUserFields,
  assignCompanyUserRole,
  updateUserPasswordHash,
  findActiveUsersByRoleId,
};
