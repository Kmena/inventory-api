const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

process.env.NODE_ENV = 'test';

const app = require('../src/app');
const authService = require('../src/services/auth.service');
const geocodingRoutes = require('../src/routes/geocoding.routes');
const taxpayerRoutes = require('../src/routes/taxpayer.routes');
const {
  LOGIN_THROTTLE_MAX_FAILURES,
  createLoginThrottle,
  resetLoginThrottleStateForTests,
} = require('../src/middlewares/login-throttle');
const {
  GEOCODING_THROTTLE_MAX_REQUESTS,
  TAXPAYER_THROTTLE_MAX_REQUESTS,
  createRequestThrottle,
  resetRequestThrottleStateForTests,
} = require('../src/middlewares/request-throttle');
const { parseTrustProxy } = require('../src/config');
const { resolveClientIdentity } = require('../src/lib/request-identity');
const { InMemoryThrottleStore } = require('../src/lib/throttle-store');

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
    });
}

async function withHttpServer(run) {
  const server = http.createServer(app);

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    return await run(baseUrl);
  } finally {
    resetLoginThrottleStateForTests();
    resetRequestThrottleStateForTests();
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

async function postLogin(baseUrl, body) {
  return fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function getRouteMiddleware(router, pathName, method, index) {
  const layer = router.stack.find((entry) => entry.route && entry.route.path === pathName && entry.route.methods[method]);
  assert.ok(layer, `${method.toUpperCase()} ${pathName} route should exist`);
  assert.ok(layer.route.stack[index], `${method.toUpperCase()} ${pathName} route should expose middleware index ${index}`);
  return layer.route.stack[index].handle;
}

async function runThrottleMiddleware(middleware, reqOverrides = {}) {
  const req = {
    ip: '127.0.0.1',
    headers: {},
    auth: {
      sub: '11',
      username: 'alice',
    },
    ...reqOverrides,
  };
  const responseHeaders = {};
  const res = {
    setHeader(name, value) {
      responseHeaders[name.toLowerCase()] = value;
    },
  };

  let nextError = undefined;
  middleware(req, res, (error) => {
    nextError = error;
  });

  return {
    nextError,
    responseHeaders,
  };
}

test('POST /api/auth/login throttles repeated failed attempts with 429 and Retry-After', async () => {
  resetLoginThrottleStateForTests();
  let loginCalls = 0;

  await withModuleStubs(
    [[authService, {
      login: async () => {
        loginCalls += 1;
        const error = new Error('Usuario o contraseña inválidos');
        error.statusCode = 401;
        error.code = 'unauthorized';
        throw error;
      },
    }]],
    () => withHttpServer(async (baseUrl) => {
      for (let attempt = 0; attempt < LOGIN_THROTTLE_MAX_FAILURES; attempt += 1) {
        const response = await postLogin(baseUrl, { username: 'alice', password: 'wrong-password' });
        assert.equal(response.status, 401);
      }

      const throttledResponse = await postLogin(baseUrl, { username: 'alice', password: 'wrong-password' });
      const throttledBody = await throttledResponse.json();

      assert.equal(throttledResponse.status, 429);
      assert.equal(throttledBody.error, 'too_many_requests');
      assert.match(throttledBody.message, /demasiados intentos/i);
      assert.ok(Number(throttledResponse.headers.get('retry-after')) >= 1);
      assert.equal(loginCalls, LOGIN_THROTTLE_MAX_FAILURES);
    }),
  );
});

test('successful login clears accumulated throttle failures for the same username and IP', async () => {
  resetLoginThrottleStateForTests();
  let loginCalls = 0;

  await withModuleStubs(
    [[authService, {
      login: async () => {
        loginCalls += 1;

        if (loginCalls <= 4 || loginCalls === 6) {
          const error = new Error('Usuario o contraseña inválidos');
          error.statusCode = 401;
          error.code = 'unauthorized';
          throw error;
        }

        return {
          token: 'token-ok',
          user: {
            id: 1n,
            username: 'alice',
            permissions: [],
          },
        };
      },
    }]],
    () => withHttpServer(async (baseUrl) => {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const response = await postLogin(baseUrl, { username: 'alice', password: 'wrong-password' });
        assert.equal(response.status, 401);
      }

      const successResponse = await postLogin(baseUrl, { username: 'alice', password: 'correct-password' });
      assert.equal(successResponse.status, 200);

      const failureAfterSuccess = await postLogin(baseUrl, { username: 'alice', password: 'wrong-password' });
      assert.equal(failureAfterSuccess.status, 401);
      assert.equal(loginCalls, 6);
    }),
  );
});

test('GET /api/geocoding/search applies a route-specific authenticated throttle beyond login baseline', async () => {
  resetRequestThrottleStateForTests();
  const throttleMiddleware = getRouteMiddleware(geocodingRoutes, '/search', 'get', 1);

  for (let attempt = 0; attempt < GEOCODING_THROTTLE_MAX_REQUESTS; attempt += 1) {
    const { nextError } = await runThrottleMiddleware(throttleMiddleware);
    assert.equal(nextError, undefined);
  }

  const throttledResult = await runThrottleMiddleware(throttleMiddleware);
  assert.equal(throttledResult.nextError?.statusCode, 429);
  assert.equal(throttledResult.nextError?.code, 'too_many_requests');
  assert.match(throttledResult.nextError?.message || '', /geocodificación|geocodificacion/i);
  assert.ok(Number(throttledResult.responseHeaders['retry-after']) >= 1);
});

test('GET /api/taxpayers/lookup applies a stricter route-specific authenticated throttle', async () => {
  resetRequestThrottleStateForTests();
  const throttleMiddleware = getRouteMiddleware(taxpayerRoutes, '/lookup', 'get', 1);

  for (let attempt = 0; attempt < TAXPAYER_THROTTLE_MAX_REQUESTS; attempt += 1) {
    const { nextError } = await runThrottleMiddleware(throttleMiddleware, {
      auth: {
        sub: '22',
        username: 'sales-demo',
      },
    });
    assert.equal(nextError, undefined);
  }

  const throttledResult = await runThrottleMiddleware(throttleMiddleware, {
    auth: {
      sub: '22',
      username: 'sales-demo',
    },
  });
  assert.equal(throttledResult.nextError?.statusCode, 429);
  assert.equal(throttledResult.nextError?.code, 'too_many_requests');
  assert.match(throttledResult.nextError?.message || '', /tributarias|tributarias/i);
  assert.ok(Number(throttledResult.responseHeaders['retry-after']) >= 1);
});

test('route-specific lookup throttles are actor-scoped and do not leak between users', async () => {
  resetRequestThrottleStateForTests();
  const throttleMiddleware = getRouteMiddleware(geocodingRoutes, '/search', 'get', 1);

  for (let attempt = 0; attempt < GEOCODING_THROTTLE_MAX_REQUESTS; attempt += 1) {
    const { nextError } = await runThrottleMiddleware(throttleMiddleware, {
      auth: {
        sub: '101',
        username: 'actor-a',
      },
    });
    assert.equal(nextError, undefined);
  }

  const actorAResult = await runThrottleMiddleware(throttleMiddleware, {
    auth: {
      sub: '101',
      username: 'actor-a',
    },
  });
  assert.equal(actorAResult.nextError?.statusCode, 429);

  const actorBResult = await runThrottleMiddleware(throttleMiddleware, {
    auth: {
      sub: '202',
      username: 'actor-b',
    },
  });
  assert.equal(actorBResult.nextError, undefined);
});

test('app no longer relies on a single global 25mb parser baseline', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');

  assert.doesNotMatch(appSource, /express\.json\(\{ limit: '25mb' \}\)/);
  assert.doesNotMatch(appSource, /express\.urlencoded\(\{ extended: true, limit: '25mb' \}\)/);
  assert.match(appSource, /smallPayloadParsers/);
  assert.match(appSource, /mediumPayloadParsers/);
  assert.doesNotMatch(appSource, /app\.use\('\/api\/clients', \.\.\.highPayloadParsers/);
  assert.doesNotMatch(appSource, /app\.use\('\/api\/products', \.\.\.highPayloadParsers/);
  assert.doesNotMatch(appSource, /app\.use\('\/api\/payments', \.\.\.highPayloadParsers/);
});

test('trust proxy policy stays explicit and environment-configurable', () => {
  assert.equal(parseTrustProxy(undefined), false);
  assert.equal(parseTrustProxy('false'), false);
  assert.equal(parseTrustProxy('true'), true);
  assert.equal(parseTrustProxy('2'), 2);
  assert.deepEqual(parseTrustProxy('loopback, linklocal'), ['loopback', 'linklocal']);
  assert.equal(parseTrustProxy('loopback'), 'loopback');
});

test('client identity resolution prefers Express ip and falls back to forwarded headers only when needed', () => {
  assert.deepEqual(
    resolveClientIdentity({
      ip: '10.0.0.5',
      headers: {
        'x-forwarded-for': '203.0.113.10, 198.51.100.20',
      },
      socket: {
        remoteAddress: '127.0.0.1',
      },
    }),
    {
      clientIp: '10.0.0.5',
      source: 'express',
    },
  );

  assert.deepEqual(
    resolveClientIdentity({
      headers: {
        'x-forwarded-for': '203.0.113.10, 198.51.100.20',
      },
      socket: {
        remoteAddress: '127.0.0.1',
      },
    }),
    {
      clientIp: '203.0.113.10',
      source: 'x-forwarded-for',
    },
  );
});

test('login and lookup throttles can run against an injected throttle store adapter', async () => {
  const sharedStore = new InMemoryThrottleStore();
  const { enforceLoginThrottle, registerLoginThrottleResult } = createLoginThrottle({ store: sharedStore });
  const lookupThrottle = createRequestThrottle({
    scope: 'geocoding.lookup.shared-store-test',
    maxRequests: 1,
    windowMs: 60_000,
    message: 'Throttle test',
    store: sharedStore,
  });

  const throttledLoginRequest = {
    ip: '198.51.100.77',
    headers: {},
    body: {
      username: 'alice',
    },
  };

  for (let attempt = 0; attempt < LOGIN_THROTTLE_MAX_FAILURES; attempt += 1) {
    registerLoginThrottleResult(throttledLoginRequest, {
      successful: false,
      errorCode: 'unauthorized',
    });
  }

  const loginResult = await runThrottleMiddleware(enforceLoginThrottle, {
    ip: '198.51.100.77',
    headers: {},
    body: {
      username: 'alice',
    },
    auth: undefined,
  });
  assert.equal(loginResult.nextError?.statusCode, 429);

  const firstLookupResult = await runThrottleMiddleware(lookupThrottle, {
    ip: '198.51.100.88',
    auth: {
      sub: 'store-1',
      username: 'shared-store-user',
    },
  });
  assert.equal(firstLookupResult.nextError, undefined);

  const secondLookupResult = await runThrottleMiddleware(lookupThrottle, {
    ip: '198.51.100.88',
    auth: {
      sub: 'store-1',
      username: 'shared-store-user',
    },
  });
  assert.equal(secondLookupResult.nextError?.statusCode, 429);
});
