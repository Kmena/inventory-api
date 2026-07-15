const prisma = require('../lib/prisma');

function routeAssignmentInclude() {
  return {
    salesRoute: {
      include: {
        subzones: {
          include: {
            subregion: {
              include: {
                region: true,
              },
            },
          },
        },
      },
    },
  };
}

function findAgentUser(userId, companyId) {
  return prisma.user.findFirst({
    where: { id: userId, companyId },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      },
      salesGoals: {
        where: { isActive: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
      salesRouteAssignments: {
        where: { isActive: true },
        orderBy: [{ salesRoute: { code: 'asc' } }, { id: 'asc' }],
        include: routeAssignmentInclude(),
      },
    },
  });
}

function findVisibleStoresForAgent(companyId, salesRouteIds) {
  if (!salesRouteIds.length) {
    return Promise.resolve([]);
  }

  return prisma.clientStore.findMany({
    where: {
      isActive: true,
      client: { companyId },
      subregion: {
        salesRoutes: {
          some: {
            salesRouteId: { in: salesRouteIds },
          },
        },
      },
    },
    orderBy: [{ subregion: { region: { name: 'asc' } } }, { subregion: { name: 'asc' } }, { name: 'asc' }],
    include: {
      client: {
        include: {
          legalEntity: true,
        },
      },
      legalEntity: true,
      subregion: {
        include: {
          region: true,
          salesRoutes: {
            where: { salesRouteId: { in: salesRouteIds } },
            include: {
              salesRoute: true,
            },
          },
        },
      },
      representatives: {
        where: { isActive: true },
        orderBy: [{ isPrimaryContact: 'desc' }, { fullName: 'asc' }],
      },
      orders: {
        where: { companyId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          invoices: {
            include: {
              payments: true,
            },
          },
          items: {
            include: {
              product: true,
            },
          },
        },
      },
      routeVisitLogs: {
        orderBy: [{ visitedAt: 'desc' }, { id: 'desc' }],
        include: {
          salesRoute: true,
          user: true,
        },
      },
    },
  });
}

function findStoreByIdForAgent(companyId, salesRouteIds, storeId) {
  return prisma.clientStore.findFirst({
    where: {
      id: storeId,
      isActive: true,
      client: { companyId },
      subregion: {
        salesRoutes: {
          some: {
            salesRouteId: { in: salesRouteIds },
          },
        },
      },
    },
    include: {
      client: {
        include: {
          legalEntity: true,
          contacts: true,
        },
      },
      legalEntity: true,
      subregion: {
        include: {
          region: true,
          salesRoutes: {
            where: { salesRouteId: { in: salesRouteIds } },
            include: {
              salesRoute: true,
            },
          },
        },
      },
      representatives: {
        where: { isActive: true },
        orderBy: [{ isPrimaryContact: 'desc' }, { fullName: 'asc' }],
      },
      orders: {
        where: { companyId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          invoices: {
            include: {
              payments: true,
            },
          },
          items: {
            include: {
              product: true,
            },
          },
          warehouse: true,
        },
      },
      routeVisitLogs: {
        orderBy: [{ visitedAt: 'desc' }, { id: 'desc' }],
        include: {
          salesRoute: true,
          user: true,
        },
      },
    },
  });
}

function createRouteVisitLog(data) {
  return prisma.routeVisitLog.create({
    data,
    include: {
      salesRoute: true,
      subregion: {
        include: { region: true },
      },
      client: true,
      clientStore: true,
      user: true,
    },
  });
}

function findAgentVisits(companyId, userId, take = 100) {
  return prisma.routeVisitLog.findMany({
    where: { companyId, userId },
    orderBy: [{ visitedAt: 'desc' }, { id: 'desc' }],
    take,
    include: {
      salesRoute: true,
      subregion: {
        include: { region: true },
      },
      client: true,
      clientStore: true,
    },
  });
}

function findOtherStoreProductSuggestions(companyId, clientId, storeId) {
  return prisma.orderItem.findMany({
    where: {
      product: {
        companyId,
        isActive: true,
        inCatalog: true,
      },
      order: {
        companyId,
        clientId,
        clientStoreId: { not: storeId },
      },
    },
    orderBy: [{ order: { createdAt: 'desc' } }, { id: 'desc' }],
    include: {
      product: true,
      order: {
        include: {
          clientStore: true,
        },
      },
    },
  });
}

function findSellableProducts(companyId) {
  return prisma.product.findMany({
    where: {
      companyId,
      isActive: true,
      inCatalog: true,
    },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    include: {
      category: true,
      subcategory: true,
      prices: {
        where: { isActive: true },
        orderBy: [{ validFrom: 'desc' }, { id: 'desc' }],
      },
    },
  });
}

function findSellableProductAvailabilityRows(companyId) {
  return prisma.warehouseLotStock.findMany({
    where: {
      quantity: { gt: 0 },
      warehouse: {
        companyId,
        isActive: true,
        isVirtual: false,
        isSellableSource: true,
      },
      product: {
        companyId,
        isActive: true,
        inCatalog: true,
      },
    },
    orderBy: [{ product: { name: 'asc' } }, { productId: 'asc' }, { warehouseId: 'asc' }, { lotId: 'asc' }],
    include: {
      lot: true,
      product: {
        include: {
          category: true,
          subcategory: true,
          prices: {
            where: { isActive: true },
            orderBy: [{ validFrom: 'desc' }, { id: 'desc' }],
          },
        },
      },
    },
  });
}

function findSellableWarehouses(companyId) {
  return prisma.warehouse.findMany({
    where: {
      companyId,
      isActive: true,
      isVirtual: false,
      isSellableSource: true,
    },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });
}

module.exports = {
  findAgentUser,
  findVisibleStoresForAgent,
  findStoreByIdForAgent,
  createRouteVisitLog,
  findAgentVisits,
  findOtherStoreProductSuggestions,
  findSellableProducts,
  findSellableProductAvailabilityRows,
  findSellableWarehouses,
};


