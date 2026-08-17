const prisma = require('../lib/prisma');

function createQualityInspection(data, db = prisma) {
  return db.qualityInspection.create({ data });
}

function findQualityInspectionsForOrder(productionOrderId, db = prisma) {
  return db.qualityInspection.findMany({
    where: { productionOrderId },
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
