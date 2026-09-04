const test = require('node:test');
const assert = require('node:assert/strict');

const productionPlanningService = require('../src/services/production-planning.service');

function buildRecipeVersion(overrides = {}) {
  return {
    id: 21n,
    recipeId: 50n,
    versionNumber: 3,
    status: 'APPROVED',
    effectiveFrom: null,
    effectiveTo: null,
    expectedYield: 100,
    expectedWaste: 2,
    yieldTolerancePercent: 1,
    wasteTolerancePercent: 1,
    instructions: 'Mezclar y envasar',
    notes: 'Snapshot aprobada',
    approvedAt: new Date('2026-08-13T09:00:00.000Z'),
    recipe: {
      id: 50n,
      code: 'REC-50',
      name: 'Formula shampoo',
      recipeType: 'FINISHED_GOOD',
      isActive: true,
    },
    stages: [
      {
        id: 101n,
        stageOrder: 0,
        name: 'Pesaje',
        expectedParameters: [
          {
            name: 'Temperatura',
            unit: 'C',
            expectedValue: 45,
            minTolerance: -2,
            maxTolerance: 3,
            ignoredLegacyField: 'should-not-leak',
          },
        ],
        parameterTolerances: [],
        stageInputs: [
          {
            id: 1n,
            productId: 31n,
            name: 'Base liquida',
            quantity: 1.25,
            unit: 'KG',
            product: { id: 31n, code: 'RM-31', name: 'Base liquida', unit: 'KG', isActive: true },
          },
          {
            id: 2n,
            productId: null,
            name: 'Observacion operativa',
            quantity: null,
            unit: null,
            product: null,
          },
        ],
      },
      {
        id: 102n,
        stageOrder: 1,
        name: 'Mezcla',
        expectedParameters: [
          {
            name: 'pH',
            unit: null,
            expectedValue: 7,
            minTolerance: -0.5,
            maxTolerance: 0.5,
            extra: 'legacy-field',
          },
        ],
        parameterTolerances: [{ name: 'legacyTolerance', value: 1 }],
        stageInputs: [
          {
            id: 3n,
            productId: 31n,
            name: 'Base liquida',
            quantity: 0.75,
            unit: 'KG',
            product: { id: 31n, code: 'RM-31', name: 'Base liquida', unit: 'KG', isActive: true },
          },
          {
            id: 4n,
            productId: 32n,
            name: 'Fragancia',
            quantity: 0.1,
            unit: 'L',
            product: { id: 32n, code: 'RM-32', name: 'Fragancia', unit: 'L', isActive: true },
          },
        ],
      },
    ],
    ...overrides,
  };
}

test('buildMaterialRequirements aggregates stage inputs by product and scales by order quantity', () => {
  const requirements = productionPlanningService.buildMaterialRequirements(buildRecipeVersion(), 10);

  assert.deepEqual(requirements, [
    { productId: 31n, requiredQuantity: 20, unit: 'KG' },
    { productId: 32n, requiredQuantity: 1, unit: 'L' },
  ]);
});

test('buildMaterialRequirements ignores descriptive stage inputs without productId', () => {
  const requirements = productionPlanningService.buildMaterialRequirements(buildRecipeVersion(), 1);

  assert.equal(requirements.length, 2);
  assert.equal(requirements.some((requirement) => requirement.productId === null), false);
});

test('assertStockAvailability returns availability rows when stock is sufficient', async () => {
  const tx = {
    warehouseStock: {
      findMany: async () => ([
        { productId: 31n, quantity: 30, reservedQuantity: 5 },
        { productId: 32n, quantity: 4, reservedQuantity: 1 },
      ]),
    },
  };

  const availability = await productionPlanningService.assertStockAvailability(
    tx,
    { companyId: 7n },
    [
      { productId: 31n, requiredQuantity: 20, unit: 'KG' },
      { productId: 32n, requiredQuantity: 1, unit: 'L' },
    ],
    5n,
    null,
  );

  assert.deepEqual(availability, [
    { productId: 31n, requiredQuantity: 20, availableQuantity: 25, missingQuantity: 0, unit: 'KG' },
    { productId: 32n, requiredQuantity: 1, availableQuantity: 3, missingQuantity: 0, unit: 'L' },
  ]);
});

test('assertStockAvailability throws 409 insufficient_stock with missing detail when stock is insufficient and no override exists', async () => {
  const tx = {
    warehouseStock: {
      findMany: async () => ([
        { productId: 31n, quantity: 10, reservedQuantity: 2 },
      ]),
    },
  };

  await assert.rejects(
    () => productionPlanningService.assertStockAvailability(
      tx,
      { companyId: 7n },
      [
        { productId: 31n, requiredQuantity: 20, unit: 'KG' },
        { productId: 32n, requiredQuantity: 1, unit: 'L' },
      ],
      5n,
      null,
    ),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, 'conflict');
      assert.equal(error.subCode, 'insufficient_stock');
      assert.deepEqual(error.missing, [
        { productId: 31n, requiredQuantity: 20, availableQuantity: 8, missingQuantity: 12, unit: 'KG' },
        { productId: 32n, requiredQuantity: 1, availableQuantity: 0, missingQuantity: 1, unit: 'L' },
      ]);
      return true;
    },
  );
});

test('assertStockAvailability respects override and returns missing rows instead of throwing', async () => {
  const tx = {
    warehouseStock: {
      findMany: async () => ([]),
    },
  };

  const availability = await productionPlanningService.assertStockAvailability(
    tx,
    { companyId: 7n },
    [
      { productId: 31n, requiredQuantity: 2.5, unit: 'KG' },
    ],
    5n,
    { justification: 'Aprobado por piloto', violationCodes: ['insufficient_stock'] },
  );

  assert.deepEqual(availability, [
    { productId: 31n, requiredQuantity: 2.5, availableQuantity: 0, missingQuantity: 2.5, unit: 'KG' },
  ]);
});

test('buildRecipeVersionSnapshot normalizes expectedParameters to the formal QA schema and omits empty parameterTolerances', () => {
  const snapshot = productionPlanningService.buildRecipeVersionSnapshot(buildRecipeVersion(), null);

  assert.deepEqual(snapshot.recipeVersion.stages[0].expectedParameters, [
    {
      name: 'Temperatura',
      unit: 'C',
      expectedValue: 45,
      minTolerance: -2,
      maxTolerance: 3,
    },
  ]);
  assert.equal('parameterTolerances' in snapshot.recipeVersion.stages[0], false);
  assert.deepEqual(snapshot.recipeVersion.stages[1].expectedParameters, [
    {
      name: 'pH',
      unit: null,
      expectedValue: 7,
      minTolerance: -0.5,
      maxTolerance: 0.5,
    },
  ]);
  assert.deepEqual(snapshot.recipeVersion.stages[1].parameterTolerances, [{ name: 'legacyTolerance', value: 1 }]);
  assert.equal('ignoredLegacyField' in snapshot.recipeVersion.stages[0].expectedParameters[0], false);
  assert.equal('extra' in snapshot.recipeVersion.stages[1].expectedParameters[0], false);
});

test('buildEnrichedSnapshot preserves the base recipe snapshot and appends materialRequirements', () => {
  const requirements = [
    { productId: 31n, requiredQuantity: 20, availableQuantity: 25, missingQuantity: 0, unit: 'KG' },
  ];

  const snapshot = productionPlanningService.buildEnrichedSnapshot(
    buildRecipeVersion(),
    requirements,
    { justification: 'Piloto', violationCodes: ['insufficient_stock'] },
  );

  assert.equal(snapshot.recipeVersion.versionNumber, 3);
  assert.deepEqual(snapshot.recipeVersion.materialRequirements, [
    { productId: '31', requiredQuantity: 20, availableQuantity: 25, missingQuantity: 0, unit: 'KG' },
  ]);
  assert.equal(snapshot.override.permissionCode, 'production.override');
});

// ── TASK-004 (recipe-input-per-unit-basis): resolveInputScalingQuantity ──

const { resolveInputScalingQuantity } = productionPlanningService.__private__;

test('resolveInputScalingQuantity: null + PER_OUTPUT_KG uses plannedOutputKg (TASK-004)', () => {
  assert.equal(resolveInputScalingQuantity(null, 'PER_OUTPUT_KG', 100, 10), 100);
});

test('resolveInputScalingQuantity: null + PER_FINISHED_UNIT uses plannedUnits (TASK-004)', () => {
  assert.equal(resolveInputScalingQuantity(null, 'PER_FINISHED_UNIT', 100, 10), 10);
});

test('resolveInputScalingQuantity: PER_FINISHED_UNIT override on PER_OUTPUT_KG version uses plannedUnits (TASK-004)', () => {
  assert.equal(resolveInputScalingQuantity('PER_FINISHED_UNIT', 'PER_OUTPUT_KG', 100, 10), 10);
});

test('resolveInputScalingQuantity: PER_OUTPUT_KG override on PER_FINISHED_UNIT version uses plannedOutputKg (TASK-004)', () => {
  assert.equal(resolveInputScalingQuantity('PER_OUTPUT_KG', 'PER_FINISHED_UNIT', 100, 10), 100);
});

test('buildRecipeVersionSnapshot includes inputQuantityBasis per stageInput (TASK-004)', () => {
  const version = buildRecipeVersion();
  // Add inputQuantityBasis to the existing stageInput fixture
  version.stages[0].stageInputs[0].inputQuantityBasis = 'PER_FINISHED_UNIT';

  const snapshot = productionPlanningService.buildRecipeVersionSnapshot(version, null);
  assert.equal(
    snapshot.recipeVersion.stages[0].stageInputs[0].inputQuantityBasis,
    'PER_FINISHED_UNIT',
    'snapshot must freeze inputQuantityBasis per stageInput',
  );
});

test('buildRecipeVersionSnapshot exposes null inputQuantityBasis when not set on stageInput (TASK-004)', () => {
  const version = buildRecipeVersion();
  // stageInput has no inputQuantityBasis in the default fixture
  const snapshot = productionPlanningService.buildRecipeVersionSnapshot(version, null);
  assert.equal(
    snapshot.recipeVersion.stages[0].stageInputs[0].inputQuantityBasis,
    null,
    'absent inputQuantityBasis must be null in snapshot',
  );
});

test('buildMaterialRequirements scales PER_FINISHED_UNIT input by plannedUnits in PER_OUTPUT_KG version (TASK-004)', () => {
  // version PER_OUTPUT_KG, plannedOutputKg=5, plannedUnits=10
  // Insumo A: 0.6 KG, inputQuantityBasis=null → 0.6 × 5 = 3
  // Insumo B: 1 UN, inputQuantityBasis='PER_FINISHED_UNIT' → 1 × 10 = 10
  const version = {
    quantityBasis: 'PER_OUTPUT_KG',
    stages: [{
      stageType: 'RECOLLECTION',
      stageInputs: [
        { productId: 1n, name: 'Harina', quantity: 0.6, unit: 'KG', inputQuantityBasis: null },
        { productId: 2n, name: 'Tapa', quantity: 1, unit: 'UN', inputQuantityBasis: 'PER_FINISHED_UNIT' },
      ],
    }],
  };

  const requirements = productionPlanningService.buildMaterialRequirements(version, 5, 10);
  const byId = Object.fromEntries(requirements.map((r) => [String(r.productId), r]));
  assert.equal(byId['1'].requiredQuantity, 3, 'gravimetric input must scale by plannedOutputKg');
  assert.equal(byId['2'].requiredQuantity, 10, 'discrete input must scale by plannedUnits');
});

test('buildMaterialRequirements backward compat: no inputQuantityBasis scales by single quantity param (TASK-004)', () => {
  // Simulates legacy recipe with no inputQuantityBasis — behavior must be identical to before
  const version = {
    quantityBasis: 'PER_OUTPUT_KG',
    stages: [{
      stageType: 'RECOLLECTION',
      stageInputs: [
        { productId: 3n, name: 'Agua', quantity: 0.4, unit: 'KG' },
      ],
    }],
  };

  const requirements = productionPlanningService.buildMaterialRequirements(version, 10);
  assert.equal(requirements[0].requiredQuantity, 4, 'legacy input must scale by quantity param');
});
