const prisma = require('../lib/prisma');

function normalizeBigInt(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return typeof value === 'bigint' ? value : BigInt(value);
}

function toCreateInput(event) {
  return {
    requestId: event.requestId,
    occurredAt: event.occurredAt || new Date(),
    actorUserId: normalizeBigInt(event.actorUserId),
    actorUsername: event.actorUsername || null,
    actorRoleCode: event.actorRoleCode || null,
    companyId: normalizeBigInt(event.companyId),
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId || null,
    outcome: event.outcome,
    reasonCode: event.reasonCode || null,
    httpMethod: event.httpMethod || null,
    routePattern: event.routePattern || null,
    path: event.path || null,
    ip: event.ip || null,
    userAgent: event.userAgent || null,
    beforeState: event.beforeState ?? null,
    afterState: event.afterState ?? null,
    metadata: event.metadata ?? null,
  };
}

async function createAuditEvent(event, prismaClient = prisma) {
  return /** @type {any} */ (prismaClient).auditEvent.create({
    data: toCreateInput(event),
  });
}

module.exports = {
  createAuditEvent,
  toCreateInput,
};
