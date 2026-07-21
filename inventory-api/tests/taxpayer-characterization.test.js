const test = require('node:test');
const assert = require('node:assert/strict');

const taxpayerService = require('../src/services/taxpayer.service');
const taxpayerRoutes = require('../src/routes/taxpayer.routes');

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
  await guard({ auth, requestContext: { requestId: 'req-taxpayer-1' } }, {}, (error) => {
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

test('taxpayer lookup route keeps admin and sales role restrictions', async () => {
  const guard = getRouteGuard(taxpayerRoutes, '/lookup', 'get');

  const deniedError = await runGuard(guard, { role: 'warehouse', companyId: '7' });
  assert.equal(deniedError?.statusCode, 403);
  assert.equal(deniedError?.code, 'forbidden');

  const adminAllowedError = await runGuard(guard, { role: 'admin', companyId: '7' });
  assert.equal(adminAllowedError, undefined);

  const salesAllowedError = await runGuard(guard, { role: 'sales', companyId: '7' });
  assert.equal(salesAllowedError, undefined);
});

test('lookupTaxpayer rejects invalid identification before calling Hacienda', async () => {
  let fetchCalled = false;

  await withFetchStub(async () => {
    fetchCalled = true;
    throw new Error('fetch should not run');
  }, async () => {
    await assert.rejects(
      () => taxpayerService.lookupTaxpayer({ identification: '---', documentType: 'CEDULA' }),
      (error) => {
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, 'validation_error');
        return true;
      },
    );
  });

  assert.equal(fetchCalled, false);
});

test('lookupTaxpayer normalizes successful Hacienda responses', async (t) => {
  await t.test('canonical contribuyente payload is normalized', async () => {
    let receivedUrl = null;
    let receivedOptions = null;

    const taxpayer = await withFetchStub(async (url, options) => {
      receivedUrl = String(url);
      receivedOptions = options;
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            contribuyente: {
              nombre: 'Comercial Demo S.A.',
              correo: 'demo@example.com',
              telefono: '2222-3333',
              direccion: 'San Jose',
              actividades: [{ codigo: '6201', descripcion: 'Desarrollo de software' }],
            },
          };
        },
      };
    }, () => taxpayerService.lookupTaxpayer({ identification: '1-234-567890', documentType: 'JURIDICA' }));

    assert.match(receivedUrl, /1234567890/);
    assert.equal(receivedOptions?.headers?.Accept, 'application/json');
    assert.equal(taxpayer.identification, '1234567890');
    assert.equal(taxpayer.documentType, 'JURIDICA');
    assert.equal(taxpayer.name, 'Comercial Demo S.A.');
    assert.equal(taxpayer.economicActivityCode, '6201');
    assert.equal(taxpayer.economicActivityName, 'Desarrollo de software');
  });

  await t.test('alternate persona payload is normalized too', async () => {
    const taxpayer = await withFetchStub(async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          persona: {
            nombreCompleto: 'Maria Demo',
            email: 'maria@example.com',
            phone: '8888-9999',
            address: 'Cartago',
            actividades: [{ code: '4711', description: 'Comercio al por menor' }],
          },
        };
      },
    }), () => taxpayerService.lookupTaxpayer({ identification: '1-01-000111', documentType: 'CEDULA' }));

    assert.equal(taxpayer.identification, '101000111');
    assert.equal(taxpayer.name, 'Maria Demo');
    assert.equal(taxpayer.email, 'maria@example.com');
    assert.equal(taxpayer.economicActivityCode, '4711');
    assert.equal(taxpayer.economicActivityName, 'Comercio al por menor');
  });
});

test('lookupTaxpayer maps Hacienda 404 and malformed success payloads to controlled errors', async (t) => {
  await t.test('404 from Hacienda becomes not_found', async () => {
    await withFetchStub(async () => ({ ok: false, status: 404, async json() { return {}; } }), async () => {
      await assert.rejects(
        () => taxpayerService.lookupTaxpayer({ identification: '101110111', documentType: 'CEDULA' }),
        (error) => {
          assert.equal(error.statusCode, 404);
          assert.equal(error.code, 'not_found');
          return true;
        },
      );
    });
  });

  await t.test('200 without recognizable taxpayer name becomes not_found', async () => {
    await withFetchStub(async () => ({ ok: true, status: 200, async json() { return { contribuyente: { telefono: '2222-3333' } }; } }), async () => {
      await assert.rejects(
        () => taxpayerService.lookupTaxpayer({ identification: '101110111', documentType: 'CEDULA' }),
        (error) => {
          assert.equal(error.statusCode, 404);
          assert.equal(error.code, 'not_found');
          return true;
        },
      );
    });
  });
});

test('lookupTaxpayer maps transport and remote failures to controlled Hacienda errors', async (t) => {
  await t.test('network failure becomes hacienda_unavailable', async () => {
    await withFetchStub(async () => {
      throw new Error('timeout');
    }, async () => {
      await assert.rejects(
        () => taxpayerService.lookupTaxpayer({ identification: '101110111', documentType: 'CEDULA' }),
        (error) => {
          assert.equal(error.statusCode, 502);
          assert.equal(error.code, 'hacienda_unavailable');
          return true;
        },
      );
    });
  });

  await t.test('non-404 remote failure becomes hacienda_error', async () => {
    await withFetchStub(async () => ({ ok: false, status: 500, async json() { return {}; } }), async () => {
      await assert.rejects(
        () => taxpayerService.lookupTaxpayer({ identification: '101110111', documentType: 'CEDULA' }),
        (error) => {
          assert.equal(error.statusCode, 502);
          assert.equal(error.code, 'hacienda_error');
          return true;
        },
      );
    });
  });

  await t.test('invalid JSON response becomes hacienda_error', async () => {
    await withFetchStub(async () => ({ ok: true, status: 200, async json() { throw new Error('bad json'); } }), async () => {
      await assert.rejects(
        () => taxpayerService.lookupTaxpayer({ identification: '101110111', documentType: 'CEDULA' }),
        (error) => {
          assert.equal(error.statusCode, 502);
          assert.equal(error.code, 'hacienda_error');
          return true;
        },
      );
    });
  });
});

test('taxpayer route handler returns normalized taxpayer from the service flow', async () => {
  const handler = getRouteHandler(taxpayerRoutes, '/lookup', 'get');
  let payload = null;

  await withFetchStub(async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        contribuyente: {
          nombre: 'Servicios Demo S.R.L.',
          correo: 'servicios@example.com',
        },
      };
    },
  }), async () => {
    await handler(
      { query: { identification: '3-101-999999', documentType: 'JURIDICA' } },
      { json(data) { payload = data; return data; } },
      (error) => { throw error; },
    );
  });

  assert.equal(payload.identification, '3101999999');
  assert.equal(payload.documentType, 'JURIDICA');
  assert.equal(payload.name, 'Servicios Demo S.R.L.');
});
