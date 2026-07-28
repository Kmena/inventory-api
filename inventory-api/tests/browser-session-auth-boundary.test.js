const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.NODE_ENV = 'test';

const app = require('../src/app');
const authService = require('../src/services/auth.service');
const userRepository = require('../src/repositories/user.repository');
const browserSessionService = require('../src/services/browser-session.service');
const {
  BROWSER_SESSION_COOKIE_NAME,
  BROWSER_SESSION_STATE_COOKIE_NAME,
  buildBrowserStateCookieValue,
} = require('../src/lib/browser-session');

function withModuleStubs(stubsByModule, run) {
  const originals = [];

  for (const [moduleRef, stubs] of stubsByModule) {
    for (const [key, value] of Object.entries(stubs)) {
      originals.push([moduleRef, key, moduleRef[key]]);
      moduleRef[key] = value;
    }
  }

  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [moduleRef, key, value] of originals) {
        moduleRef[key] = value;
      }
      return browserSessionService.resetBrowserSessionStateForTests();
    });
}

async function withHttpServer(run) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    return await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function findCookie(setCookieHeaders, cookieName) {
  return (setCookieHeaders || []).find((header) => header.startsWith(`${cookieName}=`)) || null;
}

function buildCookieHeader(cookieValues) {
  return cookieValues.join('; ');
}

test('browser login issues HttpOnly browser-session cookie and omits bearer token from the response body', async () => {
  const mockUser = {
    id: '7',
    username: 'admin-demo',
    fullName: 'Admin Demo',
    companyId: 'cmp-7',
    role: { code: 'admin' },
    permissions: ['users.manage'],
  };

  await withModuleStubs(
    [[authService, {
      login: async (_payload, _req, options = {}) => {
        assert.equal(options.issueBrowserSession, true);
        return {
          user: mockUser,
          browserSession: {
            sessionId: 'session-browser-demo',
            expiresAt: Date.now() + 60_000,
          },
        };
      },
    }]],
    () => withHttpServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-inventory-browser-session': 'cookie',
        },
        body: JSON.stringify({ username: 'admin-demo', password: 'secret-demo' }),
      });

      const body = await response.json();
      const setCookieHeaders = response.headers.getSetCookie();

      assert.equal(response.status, 200);
      assert.equal(body.token, undefined);
      assert.equal(body.user.username, 'admin-demo');
      assert.match(findCookie(setCookieHeaders, BROWSER_SESSION_COOKIE_NAME), /HttpOnly/);
      assert.match(findCookie(setCookieHeaders, BROWSER_SESSION_COOKIE_NAME), /SameSite=Lax/);
      assert.ok(findCookie(setCookieHeaders, BROWSER_SESSION_STATE_COOKIE_NAME));
    }),
  );
});

test('cookie-authenticated GET /api/auth/me returns the browser auth context and refreshes state cookies', async () => {
  const browserSession = await browserSessionService.createBrowserSession(7n);
  const mockUser = {
    id: 7n,
    username: 'admin-demo',
    fullName: 'Admin Demo',
    companyId: 9n,
    status: 'ACTIVE',
    role: {
      code: 'admin',
      isActive: true,
      rolePermissions: [
        {
          isEnabled: true,
          permission: {
            isActive: true,
            code: 'users.manage',
          },
        },
      ],
    },
    company: {
      isActive: true,
    },
  };

  await withModuleStubs(
    [[userRepository, {
      findAuthenticatedUserById: async (userId) => {
        assert.equal(userId.toString(), '7');
        return mockUser;
      },
    }]],
    () => withHttpServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/auth/me`, {
        headers: {
          cookie: buildCookieHeader([
            `${BROWSER_SESSION_COOKIE_NAME}=${browserSession.sessionId}`,
            `${BROWSER_SESSION_STATE_COOKIE_NAME}=${buildBrowserStateCookieValue({
              id: '7',
              username: 'admin-demo',
              fullName: 'Admin Demo',
              companyId: '9',
              role: { code: 'admin' },
              permissions: ['users.manage'],
            })}`,
          ]),
        },
      });

      const body = await response.json();
      const setCookieHeaders = response.headers.getSetCookie();

      assert.equal(response.status, 200);
      assert.equal(body.username, 'admin-demo');
      assert.equal(body.companyId, '9');
      assert.deepEqual(body.permissions, ['users.manage']);
      assert.ok(findCookie(setCookieHeaders, BROWSER_SESSION_COOKIE_NAME));
      assert.ok(findCookie(setCookieHeaders, BROWSER_SESSION_STATE_COOKIE_NAME));
    }),
  );
});

test('cookie-authenticated logout invalidates the browser session server-side and clears both browser cookies', async () => {
  const browserSession = await browserSessionService.createBrowserSession(7n);
  const mockUser = {
    id: 7n,
    username: 'admin-demo',
    fullName: 'Admin Demo',
    companyId: 9n,
    status: 'ACTIVE',
    role: {
      code: 'admin',
      isActive: true,
      rolePermissions: [],
    },
    company: {
      isActive: true,
    },
  };

  await withModuleStubs(
    [[userRepository, {
      findAuthenticatedUserById: async () => mockUser,
    }]],
    () => withHttpServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          origin: baseUrl,
          cookie: buildCookieHeader([
            `${BROWSER_SESSION_COOKIE_NAME}=${browserSession.sessionId}`,
            `${BROWSER_SESSION_STATE_COOKIE_NAME}=${buildBrowserStateCookieValue({
              id: '7',
              username: 'admin-demo',
              fullName: 'Admin Demo',
              companyId: '9',
              role: { code: 'admin' },
              permissions: [],
            })}`,
          ]),
        },
      });

      const setCookieHeaders = response.headers.getSetCookie();

      assert.equal(response.status, 204);
      assert.equal(await browserSessionService.getBrowserSession(browserSession.sessionId), null);
      assert.match(findCookie(setCookieHeaders, BROWSER_SESSION_COOKIE_NAME), /Max-Age=0/);
      assert.match(findCookie(setCookieHeaders, BROWSER_SESSION_STATE_COOKIE_NAME), /Max-Age=0/);
    }),
  );
});

test('proxy-terminated HTTPS-capable browser login marks both cookies as Secure', async () => {
  const mockUser = {
    id: '7',
    username: 'admin-demo',
    fullName: 'Admin Demo',
    companyId: 'cmp-7',
    role: { code: 'admin' },
    permissions: ['users.manage'],
  };

  await withModuleStubs(
    [[authService, {
      login: async () => ({
        user: mockUser,
        browserSession: {
          sessionId: 'session-browser-secure',
          expiresAt: Date.now() + 60_000,
        },
      }),
    }]],
    () => withHttpServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-inventory-browser-session': 'cookie',
          'x-forwarded-proto': 'https',
        },
        body: JSON.stringify({ username: 'admin-demo', password: 'secret-demo' }),
      });

      const setCookieHeaders = response.headers.getSetCookie();

      assert.equal(response.status, 200);
      assert.match(findCookie(setCookieHeaders, BROWSER_SESSION_COOKIE_NAME), /Secure/);
      assert.match(findCookie(setCookieHeaders, BROWSER_SESSION_STATE_COOKIE_NAME), /Secure/);
    }),
  );
});
