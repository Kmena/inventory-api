const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.BROWSER_SESSION_STORE_MODE = 'memory';

const browserSessionService = require('../src/services/browser-session.service');

function withPatchedNow(fakeNow, run) {
  const originalDateNow = Date.now;
  Date.now = () => fakeNow;
  return Promise.resolve()
    .then(run)
    .finally(async () => {
      Date.now = originalDateNow;
      await browserSessionService.resetBrowserSessionStateForTests();
    });
}

test('browser session service creates opaque sessions with user mapping and expiry metadata', async () => {
  await withPatchedNow(1_700_000_000_000, () => {
    return browserSessionService.createBrowserSession(7n).then((session) => {

    assert.match(session.sessionId, /^[a-f0-9]{64}$/);
    assert.equal(session.expiresAt, 1_700_000_000_000 + browserSessionService.sessionTtlMs);

      return browserSessionService.getBrowserSession(session.sessionId).then((storedSession) => {
        assert.deepEqual(storedSession, {
          sessionId: session.sessionId,
          userId: '7',
          expiresAt: session.expiresAt,
        });
      });
    });
  });
});

test('browser session service rejects expired sessions and eagerly removes them from the current store', async () => {
  await withPatchedNow(2_000, () => {
    return browserSessionService.createBrowserSession(9n).then((session) => withPatchedNow(session.expiresAt + 1, async () => {
      assert.equal(await browserSessionService.getBrowserSession(session.sessionId), null);
      assert.equal(await browserSessionService.getBrowserSession(session.sessionId), null);
    }));
  });
});

test('browser session service invalidates sessions explicitly and ignores unknown session ids', async () => {
  await withPatchedNow(3_000, () => {
    return browserSessionService.createBrowserSession(11n).then(async (session) => {
      assert.equal(await browserSessionService.invalidateBrowserSession(session.sessionId), true);
      assert.equal(await browserSessionService.getBrowserSession(session.sessionId), null);
      assert.equal(await browserSessionService.invalidateBrowserSession('missing-session-id'), false);
    });
  });
});
