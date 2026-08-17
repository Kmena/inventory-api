const test = require('node:test');
const assert = require('node:assert/strict');

const {
  LOGIN_THROTTLE_MAX_FAILURES,
  createLoginThrottle,
} = require('../src/middlewares/login-throttle');
const {
  GEOCODING_THROTTLE_MAX_REQUESTS,
  TAXPAYER_THROTTLE_MAX_REQUESTS,
  RFQ_PUBLIC_READ_THROTTLE_MAX_REQUESTS,
  RFQ_PUBLIC_SUBMIT_THROTTLE_MAX_REQUESTS,
  createRequestThrottle,
} = require('../src/middlewares/request-throttle');
const { InMemoryThrottleStore } = require('../src/lib/throttle-store');

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
  await middleware(req, res, (error) => {
    nextError = error;
  });

  return {
    nextError,
    responseHeaders,
  };
}

test('request throttles enforce route-specific limits with an isolated injected store', async () => {
  const geocodingThrottle = createRequestThrottle({
    scope: 'geocoding.lookup.behavior',
    maxRequests: GEOCODING_THROTTLE_MAX_REQUESTS,
    windowMs: 60_000,
    message: 'Demasiadas consultas de geocodificación en poco tiempo. Intente de nuevo más tarde.',
    store: new InMemoryThrottleStore(),
  });

  for (let attempt = 0; attempt < GEOCODING_THROTTLE_MAX_REQUESTS; attempt += 1) {
    const { nextError } = await runThrottleMiddleware(geocodingThrottle);
    assert.equal(nextError, undefined);
  }

  const throttledResult = await runThrottleMiddleware(geocodingThrottle);
  assert.equal(throttledResult.nextError?.statusCode, 429);
  assert.equal(throttledResult.nextError?.code, 'too_many_requests');
  assert.ok(Number(throttledResult.responseHeaders['retry-after']) >= 1);
});

test('taxpayer throttles keep a stricter authenticated limit with an isolated injected store', async () => {
  const taxpayerThrottle = createRequestThrottle({
    scope: 'taxpayer.lookup.behavior',
    maxRequests: TAXPAYER_THROTTLE_MAX_REQUESTS,
    windowMs: 60_000,
    message: 'Demasiadas consultas tributarias en poco tiempo. Intente de nuevo más tarde.',
    store: new InMemoryThrottleStore(),
  });

  for (let attempt = 0; attempt < TAXPAYER_THROTTLE_MAX_REQUESTS; attempt += 1) {
    const { nextError } = await runThrottleMiddleware(taxpayerThrottle, {
      auth: {
        sub: '22',
        username: 'sales-demo',
      },
    });
    assert.equal(nextError, undefined);
  }

  const throttledResult = await runThrottleMiddleware(taxpayerThrottle, {
    auth: {
      sub: '22',
      username: 'sales-demo',
    },
  });
  assert.equal(throttledResult.nextError?.statusCode, 429);
  assert.equal(throttledResult.nextError?.code, 'too_many_requests');
  assert.ok(Number(throttledResult.responseHeaders['retry-after']) >= 1);
});

test('request throttles remain actor-scoped with an isolated injected store', async () => {
  const throttle = createRequestThrottle({
    scope: 'geocoding.lookup.actor-scope.behavior',
    maxRequests: GEOCODING_THROTTLE_MAX_REQUESTS,
    windowMs: 60_000,
    message: 'Demasiadas consultas de geocodificación en poco tiempo. Intente de nuevo más tarde.',
    store: new InMemoryThrottleStore(),
  });

  for (let attempt = 0; attempt < GEOCODING_THROTTLE_MAX_REQUESTS; attempt += 1) {
    const { nextError } = await runThrottleMiddleware(throttle, {
      auth: {
        sub: '101',
        username: 'actor-a',
      },
    });
    assert.equal(nextError, undefined);
  }

  const actorAResult = await runThrottleMiddleware(throttle, {
    auth: {
      sub: '101',
      username: 'actor-a',
    },
  });
  assert.equal(actorAResult.nextError?.statusCode, 429);

  const actorBResult = await runThrottleMiddleware(throttle, {
    auth: {
      sub: '202',
      username: 'actor-b',
    },
  });
  assert.equal(actorBResult.nextError, undefined);
});

test('RFQ public read throttles at 30 requests per minute and returns Retry-After', async () => {
  const readThrottle = createRequestThrottle({
    scope: 'rfq.public.read.behavior',
    maxRequests: RFQ_PUBLIC_READ_THROTTLE_MAX_REQUESTS,
    windowMs: 60_000,
    message: 'Demasiadas solicitudes públicas de cotización en poco tiempo. Intente de nuevo más tarde.',
    store: new InMemoryThrottleStore(),
  });

  for (let attempt = 0; attempt < RFQ_PUBLIC_READ_THROTTLE_MAX_REQUESTS; attempt += 1) {
    const { nextError } = await runThrottleMiddleware(readThrottle, {
      auth: undefined,
      ip: '203.0.113.10',
    });
    assert.equal(nextError, undefined);
  }

  const throttledResult = await runThrottleMiddleware(readThrottle, {
    auth: undefined,
    ip: '203.0.113.10',
  });
  assert.equal(throttledResult.nextError?.statusCode, 429);
  assert.equal(throttledResult.nextError?.code, 'too_many_requests');
  assert.ok(Number(throttledResult.responseHeaders['retry-after']) >= 1);
});

test('RFQ public submit throttles at 10 requests per minute and returns Retry-After', async () => {
  const submitThrottle = createRequestThrottle({
    scope: 'rfq.public.submit.behavior',
    maxRequests: RFQ_PUBLIC_SUBMIT_THROTTLE_MAX_REQUESTS,
    windowMs: 60_000,
    message: 'Demasiados envíos de cotización en poco tiempo. Intente de nuevo más tarde.',
    store: new InMemoryThrottleStore(),
  });

  for (let attempt = 0; attempt < RFQ_PUBLIC_SUBMIT_THROTTLE_MAX_REQUESTS; attempt += 1) {
    const { nextError } = await runThrottleMiddleware(submitThrottle, {
      auth: undefined,
      ip: '203.0.113.11',
    });
    assert.equal(nextError, undefined);
  }

  const throttledResult = await runThrottleMiddleware(submitThrottle, {
    auth: undefined,
    ip: '203.0.113.11',
  });
  assert.equal(throttledResult.nextError?.statusCode, 429);
  assert.equal(throttledResult.nextError?.code, 'too_many_requests');
  assert.ok(Number(throttledResult.responseHeaders['retry-after']) >= 1);
});

test('login and lookup throttles work against the same injected throttle store adapter', async () => {
  const sharedStore = new InMemoryThrottleStore();
  const { enforceLoginThrottle, registerLoginThrottleResult } = createLoginThrottle({ store: sharedStore });
  const lookupThrottle = createRequestThrottle({
    scope: 'geocoding.lookup.shared-store-behavior',
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
    await registerLoginThrottleResult(throttledLoginRequest, {
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
