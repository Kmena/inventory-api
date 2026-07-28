// @ts-nocheck -- Prisma nested orderBy literals require repository-specific typing not introduced in this P0 gate.
const prisma = require('../lib/prisma');

function rolePermissionInclude() {
  return {
    role: {
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    },
  };
}

function routeInclude() {
  return {
    subzones: {
      orderBy: [
        { subregion: { region: { name: 'asc' } } },
        { subregion: { name: 'asc' } },
      ],
      include: {
        subregion: {
          include: {
            region: true,
            stores: {
              where: { isActive: true },
              include: {
                client: true,
                representatives: {
                  where: { isActive: true },
                  orderBy: [{ isPrimaryContact: 'desc' }, { fullName: 'asc' }],
                },
              },
            },
          },
        },
      },
    },
    assignments: {
      where: { isActive: true },
      orderBy: [{ user: { fullName: 'asc' } }, { id: 'asc' }],
      include: {
        user: {
          include: rolePermissionInclude(),
        },
      },
    },
  };
}

function findCompanyUsersWithRoles(companyId) {
  return prisma.user.findMany({
    where: { companyId },
    orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
    include: {
      ...rolePermissionInclude(),
      salesRouteAssignments: {
        where: { isActive: true },
        include: { salesRoute: true },
      },
      salesGoals: true,
    },
  });
}

function findCompanyUserById(userId, companyId) {
  return prisma.user.findFirst({
    where: { id: userId, companyId },
    include: {
      ...rolePermissionInclude(),
      salesRouteAssignments: {
        where: { isActive: true },
        include: { salesRoute: true },
      },
      salesGoals: {
        where: { isActive: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
    },
  });
}

function findCompanyRoutes(companyId) {
  return prisma.salesRoute.findMany({
    where: { companyId },
    orderBy: [{ isActive: 'desc' }, { code: 'asc' }, { id: 'asc' }],
    include: routeInclude(),
  });
}

function findCompanyRouteById(routeId, companyId) {
  return prisma.salesRoute.findFirst({
    where: { id: routeId, companyId },
    include: routeInclude(),
  });
}

function findCompanySubregionsByIds(companyId, subregionIds) {
  return prisma.subregion.findMany({
    where: {
      id: { in: subregionIds },
      region: { companyId },
    },
    include: { region: true },
  });
}

function findCompanyRoutesBySubregionIds(companyId, subregionIds, excludeRouteId = null) {
  if (!subregionIds.length) {
    return Promise.resolve([]);
  }

  return prisma.salesRouteSubzone.findMany({
    where: {
      companyId,
      subregionId: { in: subregionIds },
      ...(excludeRouteId ? { salesRouteId: { not: excludeRouteId } } : {}),
    },
    include: {
      salesRoute: true,
      subregion: {
        include: { region: true },
      },
    },
  });
}

function findStoresBySubregionIds(companyId, subregionIds) {
  if (!subregionIds.length) {
    return Promise.resolve([]);
  }

  return prisma.clientStore.findMany({
    where: {
      isActive: true,
      subregionId: { in: subregionIds },
      client: { companyId },
    },
    orderBy: [{ subregion: { region: { name: 'asc' } } }, { subregion: { name: 'asc' } }, { name: 'asc' }],
    include: {
      client: true,
      subregion: {
        include: {
          region: true,
        },
      },
      representatives: {
        where: { isActive: true },
        orderBy: [{ isPrimaryContact: 'desc' }, { fullName: 'asc' }],
      },
    },
  });
}

function createCompanyRoute(data) {
  return prisma.salesRoute.create({
    data,
    include: routeInclude(),
  });
}

async function updateCompanyRoute(routeId, companyId, data) {
  const result = await prisma.salesRoute.updateMany({
    where: { id: routeId, companyId },
    data,
  });

  if (result.count === 0) {
    return null;
  }

  return prisma.salesRoute.findFirst({
    where: { id: routeId, companyId },
    include: routeInclude(),
  });
}

async function replaceRouteSubzones(companyId, routeId, subregionIds) {
  return prisma.$transaction(async (tx) => {
    await tx.salesRouteSubzone.deleteMany({
      where: { companyId, salesRouteId: routeId },
    });

    if (subregionIds.length) {
      await tx.salesRouteSubzone.createMany({
        data: subregionIds.map((subregionId) => ({
          companyId,
          salesRouteId: routeId,
          subregionId,
        })),
      });
    }

    return tx.salesRoute.findFirst({
      where: { id: routeId, companyId },
      include: routeInclude(),
    });
  });
}

async function removeRouteSubzone(companyId, routeId, subregionId) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.salesRouteSubzone.deleteMany({
      where: { companyId, salesRouteId: routeId, subregionId },
    });

    const route = await tx.salesRoute.findFirst({
      where: { id: routeId, companyId },
      include: routeInclude(),
    });

    return { removedCount: result.count, route };
  });
}

async function replaceRouteAssignments(companyId, routeId, userIds) {
  return prisma.$transaction(async (tx) => {
    await tx.salesRouteAssignment.deleteMany({
      where: { companyId, salesRouteId: routeId },
    });

    if (userIds.length) {
      await tx.salesRouteAssignment.createMany({
        data: userIds.map((userId) => ({
          companyId,
          salesRouteId: routeId,
          userId,
          isActive: true,
        })),
      });
    }

    return tx.salesRoute.findFirst({
      where: { id: routeId, companyId },
      include: routeInclude(),
    });
  });
}

async function replaceCompanyUserGoals(companyId, userId, goals) {
  return prisma.$transaction(async (tx) => {
    await tx.salesGoal.deleteMany({
      where: { companyId, userId },
    });

    if (goals.length) {
      await tx.salesGoal.createMany({
        data: goals.map((goal) => ({
          companyId,
          userId,
          title: goal.title,
          periodLabel: goal.periodLabel,
          targetAmount: goal.targetAmount,
          currentAmount: goal.currentAmount,
          notes: goal.notes,
          isActive: goal.isActive,
        })),
      });
    }

    return prisma.user.findFirst({
      where: { id: userId, companyId },
      include: {
        ...rolePermissionInclude(),
        salesGoals: {
          orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    });
  });
}

module.exports = {
  findCompanyUsersWithRoles,
  findCompanyUserById,
  findCompanyRoutes,
  findCompanyRouteById,
  findCompanySubregionsByIds,
  findCompanyRoutesBySubregionIds,
  findStoresBySubregionIds,
  createCompanyRoute,
  updateCompanyRoute,
  replaceRouteSubzones,
  removeRouteSubzone,
  replaceRouteAssignments,
  replaceCompanyUserGoals,
};


