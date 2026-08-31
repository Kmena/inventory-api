const prisma = require('../lib/prisma');

const productionOrderListOrderBy = /** @type {any} */ ([{ createdAt: 'desc' }, { id: 'desc' }]);

const productionStageExecutionInclude = /** @type {any} */ ({
  consumptions: {
    orderBy: [{ id: 'asc' }],
    include: {
      // product relation not in schema — resolved client-side from materialRequirements
      lot: { select: { id: true, internalLotNumber: true, expirationDate: true } },
    },
  },
  wastes: {
    orderBy: [{ id: 'asc' }],
    include: {
      lot: { select: { id: true, internalLotNumber: true } },
    },
  },
  returns: {
    orderBy: [{ id: 'asc' }],
  },
  // Inspecciones QA embebidas para que el frontend derive WAITING_QA sin una
  // llamada adicional y para que assertStagePrerequisites las valide en-memoria.
  qualityInspections: {
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  },
  // Pérdidas post-rechazo declarativas (no mueven stock).
  losses: {
    orderBy: [{ createdAt: 'asc' }],
  },
  // TASK-002: recolección vinculada a esta ejecución (si existe).
  recolectionStage: true,
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
    include: {
      product: {
        select: { id: true, name: true, unit: true },
      },
    },
  },
  stageExecutions: {
    orderBy: [{ stageOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    include: productionStageExecutionInclude,
  },
  // TASK-002/TASK-006: include recolection stages with entries/reconciliations for UI + validation.
  recolectionStages: {
    orderBy: [{ createdAt: 'asc' }],
    include: {
      recolectionEntries: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: {
          product: { select: { id: true, name: true, unit: true } },
          lot: { select: { id: true, internalLotNumber: true } },
        },
      },
      reconciliations: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
    },
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

// ─────────────────────────────────────────────────────────────────────────────
// TASK-002: Helpers for stage rejection + losses (production-stage-rejection-and-reexecution)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Updates the status of a ProductionStageExecution.
 * @param {bigint} stageExecutionId
 * @param {string} status - 'COMPLETED' | 'QA_REJECTED'
 * @param {import('@prisma/client').PrismaClient} [db]
 */
function updateStageExecutionStatus(stageExecutionId, status, db = prisma) {
  return db.productionStageExecution.update({
    where: { id: stageExecutionId },
    data: { status },
  });
}

/**
 * Marks lossesAcknowledged=true and records the timestamp.
 * @param {bigint} stageExecutionId
 * @param {import('@prisma/client').PrismaClient} [db]
 */
function acknowledgeStageExecutionLosses(stageExecutionId, db = prisma) {
  return db.productionStageExecution.update({
    where: { id: stageExecutionId },
    data: {
      lossesAcknowledged: true,
      lossesAcknowledgedAt: new Date(),
    },
  });
}

/**
 * Persists a ProductionStageLoss record.
 * Note: does NOT generate any stock movement.
 * @param {object} data
 * @param {import('@prisma/client').PrismaClient} [db]
 */
function createStageLoss(data, db = prisma) {
  return db.productionStageLoss.create({ data });
}

/**
 * Returns all losses for all executions of a given stage within an order.
 * Filtered by companyId for multi-tenant safety.
 * @param {bigint} productionOrderId
 * @param {bigint} recipeStageId
 * @param {bigint} companyId
 * @param {import('@prisma/client').PrismaClient} [db]
 */
function findStageLossesByOrderAndStage(productionOrderId, recipeStageId, companyId, db = prisma) {
  return db.productionStageLoss.findMany({
    where: {
      productionOrderId,
      companyId,
      stageExecution: { recipeStageId },
    },
    include: {
      stageExecution: {
        select: {
          id: true,
          status: true,
          startedAt: true,
          endedAt: true,
          createdAt: true,
          recipeStageId: true,
          stageOrder: true,
          stageName: true,
          lossesAcknowledged: true,
          lossesAcknowledgedAt: true,
        },
      },
    },
    orderBy: [{ stageExecution: { createdAt: 'asc' } }, { createdAt: 'asc' }],
  });
}

/**
 * Returns all ProductionConsumption records for a given stage execution.
 * Used by production-stage-loss.service to validate quantity limits.
 * @param {bigint} stageExecutionId
 * @param {import('@prisma/client').PrismaClient} [db]
 */
function findConsumptionsByExecutionId(stageExecutionId, db = prisma) {
  return db.productionConsumption.findMany({
    where: { stageExecutionId },
    orderBy: [{ id: 'asc' }],
  });
}

/**
 * Returns the most recent ProductionStageExecution (by createdAt DESC)
 * for a given order+stage combination that has endedAt set (i.e., completed).
 * Returns null if no execution exists.
 * @param {bigint} productionOrderId
 * @param {bigint} recipeStageId
 * @param {import('@prisma/client').PrismaClient} [db]
 */
function findLatestStageExecutionForOrderStage(productionOrderId, recipeStageId, db = prisma) {
  return db.productionStageExecution.findFirst({
    where: {
      productionOrderId,
      recipeStageId,
      endedAt: { not: null },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: productionStageExecutionInclude,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK-002: ProductionRecolectionStage helpers
// ─────────────────────────────────────────────────────────────────────────────

function createRecolectionStage(data, db = prisma) {
  return db.productionRecolectionStage.create({ data });
}

function findRecolectionStageById(id, companyId, db = prisma) {
  return db.productionRecolectionStage.findFirst({
    where: {
      id,
      companyId,
    },
  });
}

function findRecolectionStageByExecutionId(rejectedExecutionId, db = prisma) {
  return db.productionRecolectionStage.findUnique({
    where: { rejectedExecutionId },
  });
}

function updateRecolectionStage(id, data, db = prisma) {
  return db.productionRecolectionStage.update({
    where: { id },
    data,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK-003: lot-level recolection entry and reconciliation helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates lot-bound recolection entry records for a recolection stage.
 * @param {bigint} recolectionStageId
 * @param {Array<{productId:bigint, lotId:bigint, quantity:number, unit:string|null}>} entries
 * @param {object} [db]
 */
function createRecolectionEntries(recolectionStageId, entries, db = prisma) {
  if (!entries || entries.length === 0) {
    return Promise.resolve([]);
  }

  return db.productionRecolectionEntry.createMany({
    data: entries.map((entry) => ({
      recolectionStageId,
      productId: entry.productId,
      lotId: entry.lotId,
      quantity: entry.quantity,
      unit: entry.unit ?? null,
    })),
  });
}

/**
 * Returns all recolection entries for a recolection stage.
 * @param {bigint} recolectionStageId
 * @param {object} [db]
 */
function findRecolectionEntriesByStageId(recolectionStageId, db = prisma) {
  return db.productionRecolectionEntry.findMany({
    where: { recolectionStageId },
    orderBy: [{ id: 'asc' }],
  });
}

/**
 * Creates terminal reconciliation records for a recolection stage.
 * @param {bigint} recolectionStageId
 * @param {Array<{productId:bigint, lotId:bigint, quantity:number, outcome:string, notes?:string|null}>} records
 * @param {object} [db]
 */
function createRecolectionReconciliations(recolectionStageId, records, db = prisma) {
  if (!records || records.length === 0) {
    return Promise.resolve([]);
  }

  return db.productionRecolectionReconciliation.createMany({
    data: records.map((record) => ({
      recolectionStageId,
      productId: record.productId,
      lotId: record.lotId,
      quantity: record.quantity,
      outcome: record.outcome,
      notes: record.notes ?? null,
      reconciledAt: new Date(),
    })),
  });
}

/**
 * Returns all reconciliation records for a recolection stage.
 * @param {bigint} recolectionStageId
 * @param {object} [db]
 */
function findRecolectionReconciliationsByStageId(recolectionStageId, db = prisma) {
  return db.productionRecolectionReconciliation.findMany({
    where: { recolectionStageId },
    orderBy: [{ id: 'asc' }],
  });
}

/**
 * Marks multiple stageExecutions with the given status in bulk.
 * Used by quality.service to mark executions as INVALIDATED.
 * @param {bigint[]} ids
 * @param {string} status
 * @param {object} [db]
 */
function bulkUpdateStageExecutionStatus(ids, status, db = prisma) {
  if (!ids || ids.length === 0) {
    return Promise.resolve({ count: 0 });
  }
  return db.productionStageExecution.updateMany({
    where: { id: { in: ids } },
    data: { status },
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
  // TASK-002 additions
  updateStageExecutionStatus,
  acknowledgeStageExecutionLosses,
  createStageLoss,
  findStageLossesByOrderAndStage,
  findConsumptionsByExecutionId,
  findLatestStageExecutionForOrderStage,
  // TASK-002: recolection stage helpers
  createRecolectionStage,
  findRecolectionStageById,
  findRecolectionStageByExecutionId,
  updateRecolectionStage,
  bulkUpdateStageExecutionStatus,
  // TASK-003: lot-level recolection entry and reconciliation helpers
  createRecolectionEntries,
  findRecolectionEntriesByStageId,
  createRecolectionReconciliations,
  findRecolectionReconciliationsByStageId,
};
