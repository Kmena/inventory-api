const prisma = require('../lib/prisma');

function roleWithPermissionsInclude() {
  return { rolePermissions: { include: { permission: true } } };
}

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
  /** @type {[{ companyId: 'asc' }, { name: 'asc' }]} */
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
    include: roleWithPermissionsInclude(),
  });
}

function findCompanyOwnedRoleById(roleId, companyId) {
  return prisma.role.findFirst({
    where: {
      id: roleId,
      companyId,
      isActive: true,
    },
    include: roleWithPermissionsInclude(),
  });
}

function findAssignableRoleByIdForCompany(roleId, companyId) {
  return prisma.role.findFirst({
    where: {
      id: roleId,
      ...assignableRolesWhere(companyId),
    },
    include: roleWithPermissionsInclude(),
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

async function updateCompanyRolePermissions({ roleId, name, permissionCodes }) {
  return prisma.$transaction(async (tx) => {
    const permissions = await tx.permission.findMany({
      where: { code: { in: permissionCodes }, isActive: true },
    });

    await tx.rolePermission.deleteMany({ where: { roleId } });

    const updateData = {};
    if (name !== undefined && name !== null) {
      updateData.name = name;
    }

    const role = await tx.role.update({
      where: { id: roleId },
      data: {
        ...updateData,
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
  findCompanyOwnedRoleById,
  findAssignableRoleByIdForCompany,
  createCompanyRole,
  updateCompanyRolePermissions,
};
