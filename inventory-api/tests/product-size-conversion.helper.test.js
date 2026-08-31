/**
 * TASK-003 (production-size-conversion): Unit tests for the canonical kg-conversion helper.
 *
 * Covers VOLUME (ML density), MASS (G, KG), LENGTH (M + kg/m), COUNT fallback,
 * and the backward-compatible path for products without an explicit presentationType.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  deriveKgPerUnit,
  derivePlannedOutputKg,
} = require('../src/services/product-size-conversion.helper');

// ─── deriveKgPerUnit ─────────────────────────────────────────────────────────

test('deriveKgPerUnit returns kg/unit for 325 ml product with density (TASK-003)', () => {
  const product = {
    presentationType: 'VOLUME',
    netContent: 325,       // mL
    netContentUnit: 'ML',
    density: 1.02,         // kg/L
  };

  const { kgPerUnit, conversionDetail } = deriveKgPerUnit(product);

  // 325 mL = 0.325 L; 0.325 L × 1.02 kg/L = 0.3315 kg
  assert.ok(Math.abs(kgPerUnit - 0.3315) < 0.0001, `Expected ≈ 0.3315, got ${kgPerUnit}`);
  assert.equal(conversionDetail.method, 'volume_density');
  assert.equal(conversionDetail.netContentUnit, 'ML');
  assert.ok(Math.abs(conversionDetail.contentInLiters - 0.325) < 0.0001);
});

test('deriveKgPerUnit returns kg/unit for 1L product with density (TASK-003)', () => {
  const product = {
    presentationType: 'VOLUME',
    netContent: 1,         // L
    netContentUnit: 'L',
    density: 0.9,          // kg/L
  };

  const { kgPerUnit } = deriveKgPerUnit(product);

  // 1 L × 0.9 kg/L = 0.9 kg
  assert.ok(Math.abs(kgPerUnit - 0.9) < 0.0001, `Expected ≈ 0.9, got ${kgPerUnit}`);
});

test('deriveKgPerUnit returns kg/unit for 500 g mass product (TASK-003)', () => {
  const product = {
    presentationType: 'MASS',
    netContent: 500,       // g
    netContentUnit: 'G',
  };

  const { kgPerUnit, conversionDetail } = deriveKgPerUnit(product);

  // 500 g = 0.5 kg
  assert.ok(Math.abs(kgPerUnit - 0.5) < 0.0001, `Expected 0.5, got ${kgPerUnit}`);
  assert.equal(conversionDetail.method, 'mass_direct');
  assert.equal(conversionDetail.netContentUnit, 'G');
});

test('deriveKgPerUnit returns kg/unit for 1.5 kg product (TASK-003)', () => {
  const product = {
    presentationType: 'MASS',
    netContent: 1.5,       // kg
    netContentUnit: 'KG',
  };

  const { kgPerUnit } = deriveKgPerUnit(product);

  assert.ok(Math.abs(kgPerUnit - 1.5) < 0.0001, `Expected 1.5, got ${kgPerUnit}`);
});

test('deriveKgPerUnit returns kg/unit for 1.5 m linear product with kg/m factor (TASK-003)', () => {
  const product = {
    presentationType: 'LENGTH',
    netContent: 1.5,       // m per unit
    netContentUnit: 'M',
    kgConversionFactor: 0.35, // kg/m
  };

  const { kgPerUnit, conversionDetail } = deriveKgPerUnit(product);

  // 1.5 m × 0.35 kg/m = 0.525 kg
  assert.ok(Math.abs(kgPerUnit - 0.525) < 0.0001, `Expected 0.525, got ${kgPerUnit}`);
  assert.equal(conversionDetail.method, 'length_kg_per_meter');
  assert.equal(conversionDetail.kgPerMeter, 0.35);
});

test('deriveKgPerUnit uses kgConversionFactor for COUNT presentation (TASK-003)', () => {
  const product = {
    presentationType: 'COUNT',
    kgConversionFactor: 0.25, // kg per piece
  };

  const { kgPerUnit, conversionDetail } = deriveKgPerUnit(product);

  assert.ok(Math.abs(kgPerUnit - 0.25) < 0.0001);
  assert.equal(conversionDetail.method, 'count_kg_per_unit');
});

test('deriveKgPerUnit falls back to kgConversionFactor when presentationType is absent (TASK-003)', () => {
  const product = {
    kgConversionFactor: 2.0,
  };

  const { kgPerUnit, conversionDetail } = deriveKgPerUnit(product);

  assert.equal(kgPerUnit, 2.0);
  assert.equal(conversionDetail.method, 'kg_conversion_factor_fallback');
});

test('deriveKgPerUnit defaults to 1 when no presentationType and no kgConversionFactor (TASK-003)', () => {
  const { kgPerUnit } = deriveKgPerUnit({});
  assert.equal(kgPerUnit, 1);
});

// ─── Error cases ─────────────────────────────────────────────────────────────

test('deriveKgPerUnit throws 422 for VOLUME without density (TASK-003)', () => {
  assert.throws(
    () => deriveKgPerUnit({ presentationType: 'VOLUME', netContent: 325, netContentUnit: 'ML' }),
    (err) => {
      assert.equal(err.statusCode, 422);
      assert.match(err.message, /densidad/i);
      return true;
    },
  );
});

test('deriveKgPerUnit throws 422 for VOLUME with wrong unit (TASK-003)', () => {
  assert.throws(
    () => deriveKgPerUnit({ presentationType: 'VOLUME', netContent: 500, netContentUnit: 'G', density: 1 }),
    (err) => {
      assert.equal(err.statusCode, 422);
      assert.match(err.message, /unidad ML o L/i);
      return true;
    },
  );
});

test('deriveKgPerUnit throws 422 for MASS with wrong unit (TASK-003)', () => {
  assert.throws(
    () => deriveKgPerUnit({ presentationType: 'MASS', netContent: 500, netContentUnit: 'ML' }),
    (err) => {
      assert.equal(err.statusCode, 422);
      assert.match(err.message, /unidad G o KG/i);
      return true;
    },
  );
});

test('deriveKgPerUnit throws 422 for LENGTH without kgConversionFactor (TASK-003)', () => {
  assert.throws(
    () => deriveKgPerUnit({ presentationType: 'LENGTH', netContent: 1.5, netContentUnit: 'M' }),
    (err) => {
      assert.equal(err.statusCode, 422);
      assert.match(err.message, /kg\/m/i);
      return true;
    },
  );
});

test('deriveKgPerUnit throws 422 for LENGTH with non-M unit (TASK-003)', () => {
  assert.throws(
    () => deriveKgPerUnit({ presentationType: 'LENGTH', netContent: 1.5, netContentUnit: 'KG', kgConversionFactor: 0.35 }),
    (err) => {
      assert.equal(err.statusCode, 422);
      assert.match(err.message, /unidad M/i);
      return true;
    },
  );
});

test('deriveKgPerUnit throws 422 for VOLUME with zero netContent (TASK-003)', () => {
  assert.throws(
    () => deriveKgPerUnit({ presentationType: 'VOLUME', netContent: 0, netContentUnit: 'ML', density: 1 }),
    (err) => {
      assert.equal(err.statusCode, 422);
      assert.match(err.message, /contenido neto positivo/i);
      return true;
    },
  );
});

// ─── derivePlannedOutputKg ───────────────────────────────────────────────────

test('derivePlannedOutputKg computes total kg for N units of a 325 ml product (TASK-003)', () => {
  const product = {
    presentationType: 'VOLUME',
    netContent: 325,
    netContentUnit: 'ML',
    density: 1.02,
  };

  // 10 units × 0.3315 kg = 3.315 kg
  const { plannedOutputKg, kgPerUnit, conversionDetail } = derivePlannedOutputKg(product, 10);

  assert.ok(Math.abs(kgPerUnit - 0.3315) < 0.0001);
  assert.ok(Math.abs(plannedOutputKg - 3.315) < 0.001, `Expected ≈ 3.315, got ${plannedOutputKg}`);
  assert.equal(conversionDetail.orderQuantity, 10);
  assert.ok(Math.abs(conversionDetail.plannedOutputKg - 3.315) < 0.001);
});

test('derivePlannedOutputKg computes total kg for mass product (TASK-003)', () => {
  // 20 units × 0.5 kg (500 g) = 10 kg
  const { plannedOutputKg } = derivePlannedOutputKg(
    { presentationType: 'MASS', netContent: 500, netContentUnit: 'G' },
    20,
  );

  assert.ok(Math.abs(plannedOutputKg - 10) < 0.001, `Expected 10, got ${plannedOutputKg}`);
});

test('derivePlannedOutputKg computes total kg for linear product (TASK-003)', () => {
  // 5 units × 1.5 m × 0.35 kg/m = 2.625 kg
  const { plannedOutputKg } = derivePlannedOutputKg(
    { presentationType: 'LENGTH', netContent: 1.5, netContentUnit: 'M', kgConversionFactor: 0.35 },
    5,
  );

  assert.ok(Math.abs(plannedOutputKg - 2.625) < 0.001, `Expected 2.625, got ${plannedOutputKg}`);
});

test('derivePlannedOutputKg propagates errors from deriveKgPerUnit (TASK-003)', () => {
  assert.throws(
    () => derivePlannedOutputKg({ presentationType: 'VOLUME', netContent: 325, netContentUnit: 'ML' }, 10),
    (err) => err.statusCode === 422,
  );
});
