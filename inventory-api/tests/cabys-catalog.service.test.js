const test = require('node:test');
const assert = require('node:assert/strict');

const cabys = require('../src/services/cabys-catalog.service');

function okJson(payload) {
  return async (url, options) => ({
    ok: true,
    url,
    options,
    json: async () => payload,
  });
}

test('CABYS text search calls Hacienda q search with server-controlled top and encoded query', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return okJson({ cabys: [{ codigo: '3532303009900', descripcion: 'Capilar', impuesto: 13, uri: 'secret' }] })(url, options);
  };

  const result = await cabys.fetchHaciendaCabys(' cuidado capilar ', { fetchImpl });

  assert.equal(calls.length, 1);
  const url = new URL(calls[0].url);
  assert.equal(url.origin + url.pathname, 'https://api.hacienda.go.cr/fe/cabys');
  assert.equal(url.searchParams.get('q'), 'cuidado capilar');
  assert.equal(url.searchParams.get('top'), '10');
  assert.equal(url.searchParams.has('url'), false);
  assert.deepEqual(result.items, [{ code: '3532303009900', description: 'Capilar', taxRate: 13, categories: [] }]);
  assert.equal(Object.hasOwn(result.items[0], 'uri'), false);
});

test('CABYS exact 13 digit query calls Hacienda codigo lookup', async () => {
  const calls = [];
  const result = await cabys.fetchHaciendaCabys('3350000019900', {
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return okJson([{ codigo: '3350000019900', descripcion: 'Vaselina n.c.p.', impuesto: 13 }])(url, options);
    },
  });

  const url = new URL(calls[0].url);
  assert.equal(url.searchParams.get('codigo'), '3350000019900');
  assert.equal(url.searchParams.has('q'), false);
  assert.equal(result.mode, 'exact');
  assert.equal(result.items[0].code, '3350000019900');
});

test('CABYS short text and unsafe control characters are rejected without Hacienda call', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; };

  await assert.rejects(() => cabys.fetchHaciendaCabys('ca', { fetchImpl }), /3 caracteres/);
  await assert.rejects(() => cabys.fetchHaciendaCabys('capi\nlar', { fetchImpl }), /caracteres inválidos/);
  assert.equal(calls, 0);
});

test('CABYS 12 and 14 digit numeric input are not exact lookups', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push(url);
    return okJson({ cabys: [] })(url, options);
  };

  await cabys.fetchHaciendaCabys('123456789012', { fetchImpl });
  await cabys.fetchHaciendaCabys('12345678901234', { fetchImpl });

  assert.equal(new URL(calls[0]).searchParams.has('codigo'), false);
  assert.equal(new URL(calls[1]).searchParams.has('codigo'), false);
  assert.equal(new URL(calls[0]).searchParams.get('q'), '123456789012');
});

test('CABYS arbitrary URL-like query cannot alter trusted Hacienda base URL', async () => {
  let calledUrl = '';
  await cabys.fetchHaciendaCabys('https://localhost/file', {
    fetchImpl: async (url, options) => {
      calledUrl = url;
      return okJson({ cabys: [] })(url, options);
    },
  });

  const url = new URL(calledUrl);
  assert.equal(url.origin + url.pathname, 'https://api.hacienda.go.cr/fe/cabys');
  assert.equal(url.searchParams.get('q'), 'https://localhost/file');
});

test('CABYS timeout, 5xx, and malformed upstream responses are sanitized', async () => {
  await assert.rejects(
    () => cabys.fetchHaciendaCabys('capilar', { fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({ raw: 'boom' }) }) }),
    (error) => error.message === 'No fue posible consultar el catálogo CAByS en este momento.'
  );

  await assert.rejects(
    () => cabys.fetchHaciendaCabys('capilar', { fetchImpl: okJson({ nope: [] }) }),
    (error) => error.message === 'No fue posible consultar el catálogo CAByS en este momento.'
  );

  await assert.rejects(
    () => cabys.fetchHaciendaCabys('capilar', {
      timeoutMs: 1,
      fetchImpl: (_url, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(Object.assign(new Error('secret timeout'), { name: 'AbortError' })));
      }),
    }),
    (error) => error.message === 'No fue posible consultar el catálogo CAByS en este momento.'
  );
});

test('CABYS normalization preserves code as string, description, taxRate, categories and hides uri', () => {
  const text = cabys.normalizeHaciendaCabysResponse({ cabys: [{
    codigo: '0000000000001',
    descripcion: 'Demo',
    impuesto: '13',
    categorias: [{ codigo: 'A', descripcion: 'Categoria' }],
    uri: 'https://example.invalid',
  }] });
  const exact = cabys.normalizeHaciendaCabysResponse([{ codigo: '3532303009900', descripcion: 'Capilar', impuesto: 13 }]);

  assert.equal(text.items[0].code, '0000000000001');
  assert.equal(typeof text.items[0].code, 'string');
  assert.equal(text.items[0].description, 'Demo');
  assert.equal(text.items[0].taxRate, 13);
  assert.deepEqual(text.items[0].categories, [{ codigo: 'A', descripcion: 'Categoria' }]);
  assert.equal(Object.hasOwn(text.items[0], 'uri'), false);
  assert.equal(exact.items[0].code, '3532303009900');
});
