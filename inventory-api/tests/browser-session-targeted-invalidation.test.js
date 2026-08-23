const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';

const audit = require('../src/lib/audit');
const browserSessionService = require('../src/services/browser-session.service');

async function withAuditStub(run) {
  const originalAudit = audit.recordAuditEventSafelyIfAvailable;
  audit.recordAuditEventSafelyIfAvailable = async () => {};

  try {
    await browserSessionService.resetBrowserSessionStateForTests();
    await run();
  } finally {
    audit.recordAuditEventSafelyIfAvailable = originalAudit;
    await browserSessionService.resetBrowserSessionStateForTests();
  }
}

test('browser session service invalidates only the targeted user sessions in memory mode', async () => {
  await withAuditStub(async () => {
    const userOneSessionA = await browserSessionService.createBrowserSession(101n);
    const userOneSessionB = await browserSessionService.createBrowserSession(101n);
    const userTwoSession = await browserSessionService.createBrowserSession(202n);

    const invalidatedCount = await browserSessionService.invalidateBrowserSessionsForUser(101n);

    assert.equal(invalidatedCount, 2);
    assert.equal(await browserSessionService.getBrowserSession(userOneSessionA.sessionId), null);
    assert.equal(await browserSessionService.getBrowserSession(userOneSessionB.sessionId), null);
    assert.deepEqual(await browserSessionService.getBrowserSession(userTwoSession.sessionId), {
      sessionId: userTwoSession.sessionId,
      userId: '202',
      expiresAt: userTwoSession.expiresAt,
    });
  });
});

test('browser session service batch invalidation deduplicates affected users and ignores empty values', async () => {
  await withAuditStub(async () => {
    const userOneSession = await browserSessionService.createBrowserSession(301n);
    const userTwoSession = await browserSessionService.createBrowserSession(302n);
    const unaffectedSession = await browserSessionService.createBrowserSession(303n);

    const invalidatedCount = await browserSessionService.invalidateBrowserSessionsForUsers([
      301n,
      '302',
      301n,
      null,
      undefined,
      '',
    ]);

    assert.equal(invalidatedCount, 2);
    assert.equal(await browserSessionService.getBrowserSession(userOneSession.sessionId), null);
    assert.equal(await browserSessionService.getBrowserSession(userTwoSession.sessionId), null);
    assert.deepEqual(await browserSessionService.getBrowserSession(unaffectedSession.sessionId), {
      sessionId: unaffectedSession.sessionId,
      userId: '303',
      expiresAt: unaffectedSession.expiresAt,
    });
  });
});
