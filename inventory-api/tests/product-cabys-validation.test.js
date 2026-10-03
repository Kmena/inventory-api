const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { updateProductSchema } = require('../src/schemas/product.schema');

function parseCabys(value) {
  return updateProductSchema.safeParse({ cabysCode: value });
}

test('Product cabysCode accepts valid 13 digit string and legacy null/empty semantics', () => {
  assert.equal(parseCabys('3532303009900').success, true);
  assert.equal(parseCabys('0000000000001').data?.cabysCode, '0000000000001');
  assert.equal(parseCabys(null).success, true);
  assert.equal(parseCabys('').success, true);
});

test('Product cabysCode rejects letters, spaces, 12 digits, 14 digits and numeric Number input', () => {
  assert.equal(parseCabys('353230300990A').success, false);
  assert.equal(parseCabys('3532303009900 ').success, false);
  assert.equal(parseCabys('353230300990').success, false);
  assert.equal(parseCabys('35323030099000').success, false);
  assert.equal(parseCabys(3532303009900).success, false);
});

test('Product CABYS frontend contract uses Inventori endpoint, debounce, stale response guard and no browser persistent cache', () => {
  const rootPath = path.join(__dirname, '..', 'src', 'public', 'root');
  const apiSource = fs.readFileSync(path.join(rootPath, 'products-api.js'), 'utf8');
  const viewSource = fs.readFileSync(path.join(rootPath, 'views', 'products-admin.js'), 'utf8');

  assert.match(apiSource, /\/api\/cabys\/search/);
  assert.doesNotMatch(apiSource + viewSource, /api\.hacienda\.go\.cr/);
  assert.match(viewSource, /setTimeout\(\(\) => runCabysSearch\(query, requestId\), 400\)/);
  assert.match(viewSource, /requestId !== cabysSearchRequestId/);
  assert.match(viewSource, /data-cabys-index/);
  assert.match(viewSource, /selectedCabys = null/);
  assert.match(viewSource, /Selecciona un resultado oficial CAByS antes de guardar/);
  assert.doesNotMatch(apiSource + viewSource, /localStorage|sessionStorage|indexedDB|IndexedDB/);
});
