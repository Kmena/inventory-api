'use strict';

/**
 * RFR-TASK-201 tests — taxpayer.service.js activities[] normalization
 *
 * Verifies that normalizeTaxpayer() (called via lookupTaxpayer()) now returns
 * a full activities[] array in addition to the backward-compat scalar fields.
 *
 * Spec: specs/inventori-receiver-fiscal-readiness/ RFR-TASK-201
 * Activity code rule: code is preserved as returned — pickFirst trims whitespace only.
 *   "9609.0" must not be transformed by numeric-only logic.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const taxpayerService = require('../src/services/taxpayer.service');

// ─── Helper ───────────────────────────────────────────────────────────────────

async function withFetchStub(implementation, run) {
  const originalFetch = global.fetch;
  global.fetch = implementation;
  try {
    return await run();
  } finally {
    global.fetch = originalFetch;
  }
}

function makeOkResponse(body) {
  return { ok: true, status: 200, async json() { return body; } };
}

async function lookupWith(contribuyente) {
  return withFetchStub(
    async () => makeOkResponse({ contribuyente }),
    () => taxpayerService.lookupTaxpayer({ identification: '3101000001', documentType: 'JURIDICA' }),
  );
}

// ─── Single activity ──────────────────────────────────────────────────────────

test('activities[]: one activity returns array of length 1', async () => {
  const result = await lookupWith({
    nombre: 'Demo S.A.',
    actividades: [{ codigo: '6201', descripcion: 'Desarrollo de software' }],
  });

  assert.strictEqual(result.activities.length, 1);
  assert.strictEqual(result.activities[0].code, '6201');
  assert.strictEqual(result.activities[0].description, 'Desarrollo de software');
});

test('activities[]: backward-compat economicActivityCode still = first activity code', async () => {
  const result = await lookupWith({
    nombre: 'Demo S.A.',
    actividades: [
      { codigo: '6201', descripcion: 'Desarrollo de software' },
      { codigo: '4711', descripcion: 'Comercio al por menor' },
    ],
  });

  assert.strictEqual(result.economicActivityCode, '6201');
  assert.strictEqual(result.economicActivityName, 'Desarrollo de software');
});

// ─── Multiple activities ──────────────────────────────────────────────────────

test('activities[]: two activities → all returned, order preserved', async () => {
  const result = await lookupWith({
    nombre: 'Multi S.A.',
    actividades: [
      { codigo: '6201', descripcion: 'Desarrollo de software' },
      { codigo: '4711', descripcion: 'Comercio al por menor' },
    ],
  });

  assert.strictEqual(result.activities.length, 2);
  assert.strictEqual(result.activities[0].code, '6201');
  assert.strictEqual(result.activities[1].code, '4711');
});

test('activities[]: three activities → all returned, none dropped', async () => {
  const result = await lookupWith({
    nombre: 'Triple S.A.',
    actividades: [
      { codigo: '6201', descripcion: 'Software' },
      { codigo: '4711', descripcion: 'Comercio' },
      { codigo: '5610', descripcion: 'Restaurantes' },
    ],
  });

  assert.strictEqual(result.activities.length, 3);
  assert.deepStrictEqual(result.activities.map((a) => a.code), ['6201', '4711', '5610']);
});

// ─── Activity code rule: preserved as returned ────────────────────────────────

test('activities[]: code preserved exactly as returned — "9609.0" not transformed', async () => {
  const result = await lookupWith({
    nombre: 'Other S.A.',
    actividades: [{ codigo: '9609.0', descripcion: 'Otras actividades' }],
  });

  assert.strictEqual(result.activities[0].code, '9609.0',
    '"9609.0" must be preserved as-is — decimal point not removed, not zero-padded');
  assert.strictEqual(result.economicActivityCode, '9609.0');
});

test('activities[]: leading/trailing whitespace in code is trimmed (safe normalization)', async () => {
  const result = await lookupWith({
    nombre: 'Trim S.A.',
    actividades: [{ codigo: '  6201  ', descripcion: 'Software' }],
  });

  assert.strictEqual(result.activities[0].code, '6201');
});

// ─── haciendaStatus and haciendaType ─────────────────────────────────────────

test('activities[]: haciendaStatus (estado) mapped when present', async () => {
  const result = await lookupWith({
    nombre: 'Status S.A.',
    actividades: [{ codigo: '6201', descripcion: 'Software', estado: 'A' }],
  });

  assert.strictEqual(result.activities[0].haciendaStatus, 'A');
});

test('activities[]: haciendaType (tipo) mapped when present', async () => {
  const result = await lookupWith({
    nombre: 'Type S.A.',
    actividades: [{ codigo: '6201', descripcion: 'Software', tipo: 'P' }],
  });

  assert.strictEqual(result.activities[0].haciendaType, 'P');
});

test('activities[]: haciendaStatus null when estado absent', async () => {
  const result = await lookupWith({
    nombre: 'NoStatus S.A.',
    actividades: [{ codigo: '6201', descripcion: 'Software' }],
  });

  assert.strictEqual(result.activities[0].haciendaStatus, null);
});

test('activities[]: haciendaType null when tipo absent', async () => {
  const result = await lookupWith({
    nombre: 'NoType S.A.',
    actividades: [{ codigo: '6201', descripcion: 'Software' }],
  });

  assert.strictEqual(result.activities[0].haciendaType, null);
});

test('activities[]: both estado and tipo present', async () => {
  const result = await lookupWith({
    nombre: 'Both S.A.',
    actividades: [{ codigo: '6201', descripcion: 'Software', estado: 'A', tipo: 'P' }],
  });

  assert.strictEqual(result.activities[0].haciendaStatus, 'A');
  assert.strictEqual(result.activities[0].haciendaType, 'P');
});

test('activities[]: multiple activities with mixed estado/tipo', async () => {
  const result = await lookupWith({
    nombre: 'Mixed S.A.',
    actividades: [
      { codigo: '6201', descripcion: 'Software', estado: 'A', tipo: 'P' },
      { codigo: '4711', descripcion: 'Comercio', estado: 'I', tipo: 'S' },
    ],
  });

  assert.strictEqual(result.activities[0].haciendaStatus, 'A');
  assert.strictEqual(result.activities[0].haciendaType, 'P');
  assert.strictEqual(result.activities[1].haciendaStatus, 'I');
  assert.strictEqual(result.activities[1].haciendaType, 'S');
});

// ─── English-key aliases (act?.status, act?.type) ────────────────────────────

test('activities[]: falls back to English key aliases (status, type)', async () => {
  const result = await lookupWith({
    nombre: 'English S.A.',
    actividades: [{ code: '6201', description: 'Software', status: 'A', type: 'S' }],
  });

  assert.strictEqual(result.activities[0].code, '6201');
  assert.strictEqual(result.activities[0].haciendaStatus, 'A');
  assert.strictEqual(result.activities[0].haciendaType, 'S');
});

// ─── Empty actividades[] ──────────────────────────────────────────────────────

test('activities[]: empty actividades array → activities: []', async () => {
  const result = await lookupWith({
    nombre: 'No Activities S.A.',
    actividades: [],
  });

  assert.deepStrictEqual(result.activities, []);
  assert.strictEqual(result.economicActivityCode, null);
  assert.strictEqual(result.economicActivityName, null);
});

test('activities[]: missing actividades key → activities: []', async () => {
  const result = await lookupWith({ nombre: 'No Key S.A.' });

  assert.deepStrictEqual(result.activities, []);
});

// ─── Activities with missing/null codes are filtered out ─────────────────────

test('activities[]: activity with null code is filtered out', async () => {
  const result = await lookupWith({
    nombre: 'Filter S.A.',
    actividades: [
      { codigo: '6201', descripcion: 'Software' },
      { descripcion: 'No code here' },     // no codigo, no code → filtered
      { codigo: '', descripcion: 'Empty' }, // empty string → filtered
    ],
  });

  assert.strictEqual(result.activities.length, 1);
  assert.strictEqual(result.activities[0].code, '6201');
});

// ─── data.actividades fallback ────────────────────────────────────────────────

test('activities[]: reads from data.actividades when contribuyente has none', async () => {
  const result = await withFetchStub(
    async () => makeOkResponse({
      nombre: 'Fallback S.A.',
      actividades: [{ codigo: '6201', descripcion: 'Software' }],
    }),
    () => taxpayerService.lookupTaxpayer({ identification: '3101000001', documentType: 'JURIDICA' }),
  );

  assert.strictEqual(result.activities.length, 1);
  assert.strictEqual(result.activities[0].code, '6201');
});

// ─── Backward compat: existing scalar tests still hold ───────────────────────

test('activities[]: backward-compat — economicActivityCode from first activity', async () => {
  const result = await lookupWith({
    nombre: 'BackCompat S.A.',
    actividades: [{ codigo: '9999', descripcion: 'First act' }],
  });

  assert.strictEqual(result.economicActivityCode, '9999');
  assert.strictEqual(result.economicActivityName, 'First act');
});

test('activities[]: backward-compat — name, email, phone unchanged by activities extension', async () => {
  const result = await lookupWith({
    nombre: 'Full S.A.',
    correo: 'test@example.com',
    telefono: '2222-3333',
    actividades: [{ codigo: '6201', descripcion: 'SW' }],
  });

  assert.strictEqual(result.name, 'Full S.A.');
  assert.strictEqual(result.email, 'test@example.com');
  assert.strictEqual(result.phone, '2222-3333');
  assert.strictEqual(result.activities.length, 1);
});
