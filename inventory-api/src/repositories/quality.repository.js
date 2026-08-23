const prisma = require('../lib/prisma');

function createQualityInspection(data, db = prisma) {
  return db.qualityInspection.create({ data });
}

/**
 * Returns all quality inspections for a production order, scoped to the given company.
 * The companyId filter is enforced via the productionOrder relation to prevent
 * cross-tenant data leakage (TASK-007 multi-tenant hardening).
 *
 * @param {bigint} productionOrderId
 * @param {bigint} companyId - Used to confirm the order belongs to this company.
 * @param {import('@prisma/client').PrismaClient} [db]
 */
function findQualityInspectionsForOrder(productionOrderId, companyId, db = prisma) {
  return db.qualityInspection.findMany({
    where: {
      productionOrderId,
      // Multi-tenant guard: verify the order belongs to the authenticated company.
      productionOrder: { companyId },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}

function findQualityInspectionsForStageExecution(stageExecutionId, db = prisma) {
  return db.qualityInspection.findMany({
    where: { stageExecutionId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}

function findApprovedInspectionForStageExecution(stageExecutionId, db = prisma) {
  return db.qualityInspection.findFirst({
    where: {
      stageExecutionId,
      result: { in: ['APPROVED', 'CONDITIONALLY_ACCEPTED'] },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}

module.exports = {
  createQualityInspection,
  findQualityInspectionsForOrder,
  findQualityInspectionsForStageExecution,
  findApprovedInspectionForStageExecution,
};
