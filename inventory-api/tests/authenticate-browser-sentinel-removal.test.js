const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';

const authenticate = require('../src/middlewares/authenticate');
const audit = require('../src/lib/audit');
const browserSessionService = require('../src/services/browser-session.service');
const userRepository = require('../src/repositories/user.repository');

async function withStubs(run) {
  const originalAudit = audit.recordAuditEventSafelyIfAvailable;
  const originalGetBrowserSession = browserSessionService.getBrowserSession;
  const originalFindAuthenticatedUserById = userRepository.findAuthenticatedUserById;

  let browserSessionLookups = 0;
  let userLookups = 0;

  audit.recordAuditEventSafelyIfAvailable = async () => {};
  browserSessionService.getBrowserSession = async () => {
    browserSessionLookups += 1;
    return { sessionId: 'session-demo', userId: 7n, expiresAt: new Date(Date.now() + 60_000) };
  };
  userRepository.findAuthenticatedUserById = async () => {
    userLookups += 1;
    return null;
  };

  try {
    await run({ getBrowserSessionCalls: () => browserSessionLookups, getUserLookups: () => userLookups });
  } finally {
    audit.recordAuditEventSafelyIfAvailable = originalAudit;
    browserSessionService.getBrowserSession = originalGetBrowserSession;
    userRepository.findAuthenticatedUserById = originalFindAuthenticatedUserById;
  }
}

test('authenticate rejects the retired browser compatibility sentinel instead of reviving cookie-session auth through the bearer branch', async () => {
  await withStubs(async ({ getBrowserSessionCalls, getUserLookups }) => {
    const req = {
      method: 'GET',
      headers: {
        authorization: 'Bearer __inventory_browser_session__',
        cookie: 'inventory_browser_session=session-demo',
      },
      protocol: 'http',
      get(headerName) {
        if (String(headerName).toLowerCase() === 'host') {
          return '127.0.0.1';
        }
        return undefined;
      },
    };

    const error = await new Promise((resolve) => {
      authenticate(req, null, (nextError) => resolve(nextError || null));
    });

    assert.equal(error?.statusCode, 401);
    assert.equal(error?.code, 'unauthorized');
    assert.equal(req.auth, undefined);
    assert.equal(getBrowserSessionCalls(), 0);
    assert.equal(getUserLookups(), 0);
  });
});
