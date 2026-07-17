const test = require('node:test');
const assert = require('node:assert/strict');

const {
  REDACTED_VALUE,
  buildAuditEvent,
  isSensitiveKey,
  sanitizeAuditValue,
} = require('../src/lib/audit');

test('isSensitiveKey detects credential-like keys consistently', () => {
  assert.equal(isSensitiveKey('password'), true);
  assert.equal(isSensitiveKey('passwordHash'), true);
  assert.equal(isSensitiveKey('accessToken'), true);
  assert.equal(isSensitiveKey('userAgent'), false);
});

test('sanitizeAuditValue redacts secrets recursively and preserves serializable values', () => {
  const sanitized = sanitizeAuditValue({
    password: 'secret',
    nested: {
      accessToken: 'token-value',
      profile: {
        username: 'alice',
      },
    },
    auditDate: new Date('2026-07-17T12:30:00.000Z'),
    companyId: BigInt(10),
  });

  assert.deepEqual(sanitized, {
    password: REDACTED_VALUE,
    nested: {
      accessToken: REDACTED_VALUE,
      profile: {
        username: 'alice',
      },
    },
    auditDate: '2026-07-17T12:30:00.000Z',
    companyId: '10',
  });
});

test('buildAuditEvent composes the minimum request and actor context safely', () => {
  const event = buildAuditEvent({
    req: {
      method: 'POST',
      originalUrl: '/api/auth/login',
      baseUrl: '/api/auth',
      route: { path: '/login' },
      auth: {
        sub: '12',
        username: 'security-admin',
        role: 'admin',
        companyId: '34',
      },
      requestContext: {
        requestId: 'req-123',
        method: 'POST',
        path: '/api/auth/login',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      },
    },
    action: 'auth.login',
    resourceType: 'session',
    resourceId: 77,
    outcome: 'SUCCESS',
    metadata: {
      password: 'plain-secret',
      clientVersion: 'web',
    },
  });

  assert.deepEqual(event, {
    requestId: 'req-123',
    occurredAt: event.occurredAt,
    actorUserId: '12',
    actorUsername: 'security-admin',
    actorRoleCode: 'admin',
    companyId: '34',
    action: 'auth.login',
    resourceType: 'session',
    resourceId: '77',
    outcome: 'SUCCESS',
    reasonCode: null,
    httpMethod: 'POST',
    routePattern: '/api/auth/login',
    path: '/api/auth/login',
    ip: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    beforeState: null,
    afterState: null,
    metadata: {
      password: REDACTED_VALUE,
      clientVersion: 'web',
    },
  });

  assert.ok(event.occurredAt instanceof Date);
});
