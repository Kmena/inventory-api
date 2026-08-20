const prisma = require('../lib/prisma');

const productionOrderListOrderBy = /** @type {any} */ ([{ createdAt: 'desc' }, { id: 'desc' }]);

const productionStageExecutionInclude = /** @type {any} */ ({
  consumptions: {
    orderBy: [{ id: 'asc' }],
  },
  wastes: {
    orderBy: [{ id: 'asc' }],
  },
  returns: {
    orderBy: [{ id: 'asc' }],
  },
});

const productionOrderMaterialRequirementOrderBy = /** @type {any} */ ([{ id: 'asc' }]);

const productionOrderInclude = /** @type {any} */ ({
  product: {
    select: {
      id: true,
      code: true,
      name: true,
      unit: true,
      sourcingMethod: true,
      requiresLot: true,
      requiresExpiration: true,
      recipeId: true,
      isActive: true,
    },
  },
  recipe: {
    select: {
      id: true,
      code: true,
      name: true,
      recipeType: true,
      isActive: true,
    },
  },
  recipeVersion: {
    select: {
      id: true,
      recipeId: true,
      versionNumber: true,
      status: true,
      approvedAt: true,
      updatedAt: true,
    },
  },
  originWarehouse: {
    select: {
      id: true,
      code: true,
      name: true,
      warehouseType: true,
      isActive: true,
    },
  },
  destinationWarehouse: {
    select: {
      id: true,
      code: true,
      name: true,
      warehouseType: true,
      isActive: true,
    },
  },
  responsibleUser: {
    select: {
      id: true,
      fullName: true,
      username: true,
      status: true,
    },
  },
  items: {
    orderBy: [{ id: 'asc' }],
  },
  materialRequirements: {
    orderBy: productionOrderMaterialRequirementOrderBy,
  },
  stageExecutions: {
    orderBy: [{ stageOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    include: productionStageExecutionInclude,
  },
});

function findProductionOrders(companyId, pagination = null) {
  const where = { companyId };

  if (!pagination) {
    return prisma.productionOrder.findMany({
      where,
      orderBy: productionOrderListOrderBy,
      include: productionOrderInclude,
    });
  }

  return prisma.$transaction([
    prisma.productionOrder.count({ where }),
    prisma.productionOrder.findMany({
      where,
      orderBy: productionOrderListOrderBy,
      skip: pagination.skip,
      take: pagination.take,
      include: productionOrderInclude,
    }),
  ]).then(([totalItems, items]) => ({ totalItems, items }));
}

function findProductionOrderById(id, companyId, db = prisma) {
  return db.productionOrder.findFirst({
    where: { id, companyId },
    include: productionOrderInclude,
  });
}

function createProductionOrder(data, db = prisma) {
  return db.productionOrder.create({
    data,
    include: productionOrderInclude,
  });
}

async function updateProductionOrder(id, companyId, data, db = prisma) {
  const result = await db.productionOrder.updateMany({
    where: { id, companyId },
    data,
  });

  if (result.count === 0) {
    return null;
  }

  return findProductionOrderById(id, companyId, db);
}

function createMaterialRequirements(orderId, rows, db = prisma) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return Promise.resolve({ count: 0 });
  }

  return db.productionOrderMaterialRequirement.createMany({
    data: rows.map((row) => ({
      ...row,
      productionOrderId: row.productionOrderId ?? orderId,
    })),
  });
}

function findMaterialRequirementsByOrderId(productionOrderId, db = prisma) {
  return db.productionOrderMaterialRequirement.findMany({
    where: { productionOrderId },
    orderBy: productionOrderMaterialRequirementOrderBy,
    include: {
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
          requiresLot: true,
          requiresExpiration: true,
        },
      },
    },
  });
}

function findMaterialRequirementsByOrderIdForCompany(productionOrderId, companyId, db = prisma) {
  return db.productionOrderMaterialRequirement.findMany({
    where: {
      productionOrderId,
      productionOrder: { companyId },
    },
    orderBy: productionOrderMaterialRequirementOrderBy,
    include: {
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
          requiresLot: true,
          requiresExpiration: true,
        },
      },
    },
  });
}

function createProductionStageExecution(data, db = prisma) {
  return db.productionStageExecution.create({
    data,
    include: productionStageExecutionInclude,
  });
}

function createProductionConsumption(data, db = prisma) {
  return db.productionConsumption.create({ data });
}

function createProductionWaste(data, db = prisma) {
  return db.productionWaste.create({ data });
}

function createProductionReturn(data, db = prisma) {
  return db.productionReturn.create({ data });
}

function findProductionStageExecutionById(id, db = prisma) {
  return db.productionStageExecution.findUnique({
    where: { id },
    include: productionStageExecutionInclude,
  });
}

function findLatestProductionStageExecutionForOrderStage(productionOrderId, recipeStageId, db = prisma) {
  return db.productionStageExecution.findFirst({
    where: {
      productionOrderId,
      recipeStageId,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: productionStageExecutionInclude,
  });
}

async function syncProductionItemConsumedQuantity(productionOrderId, db = prisma) {
  const aggregateResult = await db.productionConsumption.groupBy({
    by: ['productionOrderId'],
    _sum: { quantity: true },
    where: { productionOrderId },
  });

  const totalConsumed = aggregateResult.length > 0
    ? (aggregateResult[0]._sum.quantity ?? 0)
    : 0;

  const result = await db.productionItem.updateMany({
    where: { productionOrderId },
    data: { consumedQuantity: totalConsumed },
  });

  return {
    productionOrderId,
    totalConsumed,
    updatedItemCount: result.count,
  };
}

async function getProductionItemAggregateState(productionOrderId, db = prisma) {
  const [items, consumptionAggregate] = await Promise.all([
    db.productionItem.findMany({
      where: { productionOrderId },
      select: { id: true, productionOrderId: true, productId: true, consumedQuantity: true },
    }),
    db.productionConsumption.groupBy({
      by: ['productionOrderId'],
      _sum: { quantity: true },
      where: { productionOrderId },
    }),
  ]);

  const authoritativeTotal = consumptionAggregate.length > 0
    ? Number(consumptionAggregate[0]._sum.quantity ?? 0)
    : 0;

  const itemAggregateTotal = items.reduce((sum, item) => sum + Number(item.consumedQuantity ?? 0), 0);

  return {
    productionOrderId,
    items,
    authoritativeTotal,
    itemAggregateTotal,
    isSynchronized: Math.abs(authoritativeTotal - itemAggregateTotal) < 0.001,
  };
}

function findActiveCompanyUserById(userId, companyId, db = prisma) {
  return db.user.findFirst({
    where: {
      id: userId,
      companyId,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      fullName: true,
      username: true,
      status: true,
    },
  });
}

module.exports = {
  findProductionOrders,
  findProductionOrderById,
  createProductionOrder,
  updateProductionOrder,
  createMaterialRequirements,
  findMaterialRequirementsByOrderId,
  findMaterialRequirementsByOrderIdForCompany,
  createProductionStageExecution,
  createProductionConsumption,
  createProductionWaste,
  createProductionReturn,
  findProductionStageExecutionById,
  findLatestProductionStageExecutionForOrderStage,
  syncProductionItemConsumedQuantity,
  getProductionItemAggregateState,
  findActiveCompanyUserById,
};
