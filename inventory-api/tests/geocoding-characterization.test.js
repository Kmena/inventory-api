const test = require('node:test');
const assert = require('node:assert/strict');

const geocodingService = require('../src/services/geocoding.service');
const geocodingRoutes = require('../src/routes/geocoding.routes');

function getRouteLayer(router, path, method) {
  const layer = router.stack.find((entry) => entry.route && entry.route.path === path && entry.route.methods[method]);
  assert.ok(layer, `${method.toUpperCase()} route for ${path} should exist`);
  assert.ok(layer.route.stack.length >= 2, `${method.toUpperCase()} route for ${path} should include guard and handler`);
  return layer;
}

function getRouteGuard(router, path, method) {
  return getRouteLayer(router, path, method).route.stack[0].handle;
}

function getRouteHandler(router, path, method) {
  return getRouteLayer(router, path, method).route.stack.at(-1).handle;
}

async function runGuard(guard, auth) {
  let nextError = 'not-called';
  await guard({ auth, requestContext: { requestId: 'req-geocoding-1' } }, {}, (error) => {
    nextError = error;
  });
  return nextError;
}

async function withFetchStub(implementation, run) {
  const originalFetch = global.fetch;
  global.fetch = implementation;
  try {
    return await run();
  } finally {
    global.fetch = originalFetch;
  }
}

test('geocoding route keeps admin and sales role restrictions', async () => {
  const guard = getRouteGuard(geocodingRoutes, '/search', 'get');

  const deniedError = await runGuard(guard, { role: 'warehouse', companyId: '7' });
  assert.equal(deniedError?.statusCode, 403);
  assert.equal(deniedError?.code, 'forbidden');

  const adminAllowedError = await runGuard(guard, { role: 'admin', companyId: '7' });
  assert.equal(adminAllowedError, undefined);

  const salesAllowedError = await runGuard(guard, { role: 'sales', companyId: '7' });
  assert.equal(salesAllowedError, undefined);
});

test('searchPlaces rejects short queries before calling the remote provider', async () => {
  let fetchCalled = false;

  await withFetchStub(async () => {
    fetchCalled = true;
    throw new Error('fetch should not run');
  }, async () => {
    await assert.rejects(
      () => geocodingService.searchPlaces('ab'),
      (error) => {
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, 'validation_error');
        return true;
      },
    );
  });

  assert.equal(fetchCalled, false);
});

test('searchPlaces normalizes successful provider responses and filters invalid coordinates', async () => {
  let receivedUrl = null;
  let receivedOptions = null;

  const places = await withFetchStub(async (url, options) => {
    receivedUrl = String(url);
    receivedOptions = options;
    return {
      ok: true,
      async json() {
        return [
          { display_name: 'San Jose, Costa Rica', lat: '9.932', lon: '-84.08', type: 'city', category: 'place' },
          { display_name: 'Sin coordenadas', lat: 'not-a-number', lon: '-84.1', type: 'unknown', category: 'place' },
        ];
      },
    };
  }, () => geocodingService.searchPlaces('San Jose'));

  assert.equal(places.length, 1);
  assert.deepEqual(places[0], {
    name: 'San Jose, Costa Rica',
    latitude: 9.932,
    longitude: -84.08,
    type: 'city',
    category: 'place',
  });
  assert.match(receivedUrl, /format=jsonv2/);
  assert.match(receivedUrl, /q=San\+Jose|q=San%20Jose/);
  assert.match(receivedUrl, /countrycodes=cr/);
  assert.equal(receivedOptions?.headers?.Accept, 'application/json');
});

test('searchPlaces maps provider transport failures to controlled geocoding errors', async () => {
  await withFetchStub(async () => {
    throw new Error('socket hang up');
  }, async () => {
    await assert.rejects(
      () => geocodingService.searchPlaces('Cartago'),
      (error) => {
        assert.equal(error.statusCode, 502);
        assert.equal(error.code, 'geocoding_unavailable');
        return true;
      },
    );
  });
});

test('searchPlaces maps non-ok provider responses to controlled geocoding errors', async () => {
  await withFetchStub(async () => ({ ok: false, status: 500, async json() { return {}; } }), async () => {
    await assert.rejects(
      () => geocodingService.searchPlaces('Heredia'),
      (error) => {
        assert.equal(error.statusCode, 502);
        assert.equal(error.code, 'geocoding_error');
        return true;
      },
    );
  });
});

test('searchPlaces maps malformed provider success payloads to controlled geocoding errors', async (t) => {
  await t.test('invalid JSON body becomes geocoding_error', async () => {
    await withFetchStub(async () => ({ ok: true, async json() { throw new Error('invalid json'); } }), async () => {
      await assert.rejects(
        () => geocodingService.searchPlaces('Alajuela'),
        (error) => {
          assert.equal(error.statusCode, 502);
          assert.equal(error.code, 'geocoding_error');
          return true;
        },
      );
    });
  });

  await t.test('non-array success body becomes geocoding_error', async () => {
    await withFetchStub(async () => ({ ok: true, async json() { return { items: [] }; } }), async () => {
      await assert.rejects(
        () => geocodingService.searchPlaces('Liberia'),
        (error) => {
          assert.equal(error.statusCode, 502);
          assert.equal(error.code, 'geocoding_error');
          return true;
        },
      );
    });
  });
});

test('geocoding route handler returns normalized places from the service flow', async () => {
  const handler = getRouteHandler(geocodingRoutes, '/search', 'get');
  let payload = null;

  await withFetchStub(async () => ({
    ok: true,
    async json() {
      return [{ display_name: 'Cartago, Costa Rica', lat: '9.8644', lon: '-83.9194', type: 'city', category: 'place' }];
    },
  }), async () => {
    await handler(
      { query: { q: 'Cartago' } },
      { json(data) { payload = data; return data; } },
      (error) => { throw error; },
    );
  });

  assert.deepEqual(payload, [{
    name: 'Cartago, Costa Rica',
    latitude: 9.8644,
    longitude: -83.9194,
    type: 'city',
    category: 'place',
  }]);
});
