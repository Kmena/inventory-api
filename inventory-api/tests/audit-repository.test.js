const test = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');

const { recordAuditEvent } = require('../src/lib/audit');

const auditDatabaseUrl = process.env.P2_AUDIT_DATABASE_URL;

function uniqueValue(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

test('recordAuditEvent persists a minimal audit event and redacts sensitive metadata', { skip: !auditDatabaseUrl }, async () => {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: auditDatabaseUrl,
      },
    },
  });

  let companyId = null;
  let userId = null;
  let auditEventId = null;

  try {
    const company = await prisma.company.create({
      data: {
        name: uniqueValue('Audit Company'),
      },
    });
    companyId = company.id;

    const user = await prisma.user.create({
      data: {
        companyId,
        fullName: 'Audit Actor',
        username: uniqueValue('audit_actor'),
        passwordHash: 'not-a-real-password',
        status: 'ACTIVE',
      },
    });
    userId = user.id;

    const createdEvent = await recordAuditEvent(
      {
        req: {
          method: 'POST',
          originalUrl: '/api/auth/login',
          baseUrl: '/api/auth',
          route: { path: '/login' },
          auth: {
            sub: userId.toString(),
            username: user.username,
            role: 'admin',
            companyId: companyId.toString(),
          },
          requestContext: {
            requestId: uniqueValue('req'),
            method: 'POST',
            path: '/api/auth/login',
            ip: '127.0.0.1',
            userAgent: 'integration-test-agent',
            actor: {
              userId: userId.toString(),
              username: user.username,
              roleCode: 'admin',
              companyId: companyId.toString(),
            },
          },
        },
        action: 'auth.login',
        resourceType: 'session',
        outcome: 'SUCCESS',
        metadata: {
          password: 'super-secret',
          source: 'integration-test',
        },
      },
      { prismaClient: prisma },
    );

    auditEventId = createdEvent.id;

    const persistedEvent = await prisma.auditEvent.findUnique({
      where: { id: auditEventId },
    });

    assert.ok(persistedEvent);
    assert.equal(persistedEvent.requestId.startsWith('req_'), true);
    assert.equal(persistedEvent.actorUserId?.toString(), userId.toString());
    assert.equal(persistedEvent.companyId?.toString(), companyId.toString());
    assert.equal(persistedEvent.action, 'auth.login');
    assert.equal(persistedEvent.resourceType, 'session');
    assert.equal(persistedEvent.outcome, 'SUCCESS');
    assert.deepEqual(persistedEvent.metadata, {
      password: '[REDACTED]',
      source: 'integration-test',
    });
  } finally {
    if (auditEventId !== null) {
      await prisma.auditEvent.delete({ where: { id: auditEventId } });
    }
    if (userId !== null) {
      await prisma.user.delete({ where: { id: userId } });
    }
    if (companyId !== null) {
      await prisma.company.delete({ where: { id: companyId } });
    }
    await prisma.$disconnect();
  }
});
