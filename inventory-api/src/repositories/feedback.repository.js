const prisma = require('../lib/prisma');

function createFeedback(data) {
  return prisma.feedback.create({ data });
}

function findAllFeedback(filter = {}) {
  const where = {};
  if (typeof filter.resolved === 'boolean') {
    where.resolved = filter.resolved;
  }
  return prisma.feedback.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

function findFeedbackById(id) {
  return prisma.feedback.findUnique({ where: { id } });
}

function resolveFeedback(id) {
  return prisma.feedback.update({
    where: { id },
    data: { resolved: true, resolvedAt: new Date() },
  });
}

module.exports = { createFeedback, findAllFeedback, findFeedbackById, resolveFeedback };
