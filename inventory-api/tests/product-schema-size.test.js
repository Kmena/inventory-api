/**
 * TASK-002 (production-size-conversion): Validates that the product schema
 * enforces presentation-type rules for VOLUME, MASS, LENGTH and COUNT, and
 * that UPDATE allows partial payloads without breaking existing products.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { createProductSchema, updateProductSchema } = require('../src/schemas/product.schema');

/** Minimal valid product payload without presentation fields (backward compat). */
const BASE_PRODUCT = { name: 'Producto Base', initialLots: [] };

// ─── Backward compatibility ───────────────────────────────────────────────────

test('createProductSchema accepts product without presentationType (backward compatibility) (TASK-002)', () => {
  const result = createProductSchema.safeParse(BASE_PRODUCT);
  assert.equal(result.success, true);
});

// ─── VOLUME presentation ─────────────────────────────────────────────────────

test('createProductSchema accepts VOLUME presentation with ML unit and density (TASK-002)', () => {
  const result = createProductSchema.safeParse({
    ...BASE_PRODUCT,
    presentationType: 'VOLUME',
    netContent: 325,
    netContentUnit: 'ML',
    density: 1.02,
    densityUnit: 'kg/L',
  });

  assert.equal(result.success, true);
  assert.equal(result.data.presentationType, 'VOLUME');
  assert.equal(result.data.netContentUnit, 'ML');
});

test('createProductSchema accepts VOLUME presentation with L unit and density (TASK-002)', () => {
  const result = createProductSchema.safeParse({
    ...BASE_PRODUCT,
    presentationType: 'VOLUME',
    netContent: 1,
    netContentUnit: 'L',
    density: 1.0,
  });

  assert.equal(result.success, true);
});

test('createProductSchema rejects VOLUME presentation without density (TASK-002)', () => {
  const result = createProductSchema.safeParse({
    ...BASE_PRODUCT,
    presentationType: 'VOLUME',
    netContent: 325,
    netContentUnit: 'ML',
  });

  assert.equal(result.success, false);
  const paths = result.error.issues.map((i) => i.path.join('.'));
  assert.ok(paths.includes('density'), 'Expected density issue');
});

test('createProductSchema rejects VOLUME presentation with mass unit (TASK-002)', () => {
  const result = createProductSchema.safeParse({
    ...BASE_PRODUCT,
    presentationType: 'VOLUME',
    netContent: 500,
    netContentUnit: 'G',
    density: 1.0,
  });

  assert.equal(result.success, false);
  const paths = result.error.issues.map((i) => i.path.join('.'));
  assert.ok(paths.includes('netContentUnit'), 'Expected netContentUnit issue for wrong unit on VOLUME');
});

test('createProductSchema rejects VOLUME presentation with zero netContent (TASK-002)', () => {
  const result = createProductSchema.safeParse({
    ...BASE_PRODUCT,
    presentationType: 'VOLUME',
    netContent: 0,
    netContentUnit: 'ML',
    density: 1.02,
  });

  assert.equal(result.success, false);
  const paths = result.error.issues.map((i) => i.path.join('.'));
  assert.ok(paths.includes('netContent'), 'Expected netContent issue');
});

// ─── MASS presentation ───────────────────────────────────────────────────────

test('createProductSchema accepts MASS presentation with G unit (TASK-002)', () => {
  const result = createProductSchema.safeParse({
    ...BASE_PRODUCT,
    presentationType: 'MASS',
    netContent: 500,
    netContentUnit: 'G',
  });

  assert.equal(result.success, true);
  assert.equal(result.data.presentationType, 'MASS');
});

test('createProductSchema accepts MASS presentation with KG unit (TASK-002)', () => {
  const result = createProductSchema.safeParse({
    ...BASE_PRODUCT,
    presentationType: 'MASS',
    netContent: 1,
    netContentUnit: 'KG',
  });

  assert.equal(result.success, true);
});

test('createProductSchema rejects MASS presentation with volumetric unit (TASK-002)', () => {
  const result = createProductSchema.safeParse({
    ...BASE_PRODUCT,
    presentationType: 'MASS',
    netContent: 500,
    netContentUnit: 'ML',
  });

  assert.equal(result.success, false);
  const paths = result.error.issues.map((i) => i.path.join('.'));
  assert.ok(paths.includes('netContentUnit'), 'Expected netContentUnit issue');
});

test('createProductSchema rejects MASS presentation with M unit (TASK-002)', () => {
  const result = createProductSchema.safeParse({
    ...BASE_PRODUCT,
    presentationType: 'MASS',
    netContent: 500,
    netContentUnit: 'M',
  });

  assert.equal(result.success, false);
});

// ─── LENGTH presentation ─────────────────────────────────────────────────────

test('createProductSchema accepts LENGTH presentation with M unit and kgConversionFactor (TASK-002)', () => {
  const result = createProductSchema.safeParse({
    ...BASE_PRODUCT,
    presentationType: 'LENGTH',
    netContent: 1.5,
    netContentUnit: 'M',
    kgConversionFactor: 0.35,
  });

  assert.equal(result.success, true);
  assert.equal(result.data.presentationType, 'LENGTH');
  assert.equal(result.data.netContentUnit, 'M');
});

test('createProductSchema rejects LENGTH presentation without kgConversionFactor (TASK-002)', () => {
  const result = createProductSchema.safeParse({
    ...BASE_PRODUCT,
    presentationType: 'LENGTH',
    netContent: 1.5,
    netContentUnit: 'M',
  });

  assert.equal(result.success, false);
  const paths = result.error.issues.map((i) => i.path.join('.'));
  assert.ok(paths.includes('kgConversionFactor'), 'Expected kgConversionFactor issue');
});

test('createProductSchema rejects LENGTH presentation with non-M unit (TASK-002)', () => {
  const result = createProductSchema.safeParse({
    ...BASE_PRODUCT,
    presentationType: 'LENGTH',
    netContent: 1.5,
    netContentUnit: 'KG',
    kgConversionFactor: 0.35,
  });

  assert.equal(result.success, false);
  const paths = result.error.issues.map((i) => i.path.join('.'));
  assert.ok(paths.includes('netContentUnit'), 'Expected netContentUnit issue');
});

// ─── COUNT presentation ──────────────────────────────────────────────────────

test('createProductSchema accepts COUNT presentation without additional size fields (TASK-002)', () => {
  const result = createProductSchema.safeParse({
    ...BASE_PRODUCT,
    presentationType: 'COUNT',
  });

  assert.equal(result.success, true);
  assert.equal(result.data.presentationType, 'COUNT');
});

// ─── Update schema (soft / partial validation) ───────────────────────────────

test('updateProductSchema accepts partial update setting only presentationType (TASK-002)', () => {
  // Soft validation: density may already be in the DB — not required in update payload.
  const result = updateProductSchema.safeParse({ presentationType: 'VOLUME' });
  assert.equal(result.success, true);
});

test('updateProductSchema rejects update that sets VOLUME with wrong unit in same payload (TASK-002)', () => {
  const result = updateProductSchema.safeParse({
    presentationType: 'VOLUME',
    netContentUnit: 'G',
  });

  assert.equal(result.success, false);
  const paths = result.error.issues.map((i) => i.path.join('.'));
  assert.ok(paths.includes('netContentUnit'), 'Expected netContentUnit issue');
});

test('updateProductSchema rejects update that explicitly sets density to 0 for VOLUME in same payload (TASK-002)', () => {
  const result = updateProductSchema.safeParse({
    presentationType: 'VOLUME',
    netContentUnit: 'ML',
    density: 0,
  });

  assert.equal(result.success, false);
  const paths = result.error.issues.map((i) => i.path.join('.'));
  assert.ok(paths.includes('density'), 'Expected density issue');
});

test('updateProductSchema accepts update that sets VOLUME with correct unit and density in same payload (TASK-002)', () => {
  const result = updateProductSchema.safeParse({
    presentationType: 'VOLUME',
    netContentUnit: 'ML',
    netContent: 325,
    density: 1.02,
  });

  assert.equal(result.success, true);
});
