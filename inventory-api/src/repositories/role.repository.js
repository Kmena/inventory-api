// @ts-nocheck -- Prisma orderBy literals are kept explicit in JS repositories.
const prisma = require('../lib/prisma');

function findActivePermissions() {
  return prisma.permission.findMany({
    where: { isActive: true },
    orderBy: [{ module: 'asc' }, { action: 'asc' }, { code: 'asc' }],
  });
}

function assignableRolesWhere(companyId) {
  return {
    isActive: true,
    code: { not: 'root' },
    OR: [{ companyId: null }, { companyId }],
  };
}

function findAssignableRoles(companyId, pagination = null) {
  const where = assignableRolesWhere(companyId);
  const orderBy = [{ companyId: 'asc' }, { name: 'asc' }];
  const include = { rolePermissions: { include: { permission: true } } };
  if (!pagination) {
    return prisma.role.findMany({
      where,
      orderBy,
      include,
    });
  }

  return prisma.$transaction([
    prisma.role.count({ where }),
    prisma.role.findMany({
      where,
      orderBy,
      include,
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]).then(([totalItems, items]) => ({ totalItems, items }));
}

function findRoleById(roleId) {
  return prisma.role.findUnique({
    where: { id: roleId },
    include: { rolePermissions: { include: { permission: true } } },
  });
}

async function createCompanyRole({ companyId, code, name, permissionCodes }) {
  return prisma.$transaction(async (tx) => {
    const permissions = await tx.permission.findMany({
      where: { code: { in: permissionCodes }, isActive: true },
    });

    const role = await tx.role.create({
      data: {
        companyId,
        code,
        name,
        isActive: true,
        rolePermissions: {
          create: permissions.map((permission) => ({
            permissionId: permission.id,
            isEnabled: true,
          })),
        },
      },
      include: { rolePermissions: { include: { permission: true } } },
    });

    return role;
  });
}

module.exports = {
  findActivePermissions,
  findAssignableRoles,
  findRoleById,
  createCompanyRole,
};
