const test = require('node:test');
const assert = require('node:assert/strict');

const {
  qaParameterSchema,
  createRecipeSchema,
  createRecipeVersionSchema,
  updateRecipeVersionSchema,
  approveRecipeVersionSchema,
} = require('../src/schemas/recipe.schema');

test('createRecipeSchema accepts the additive recipe master fields', () => {
  const result = createRecipeSchema.safeParse({
    code: 'REC-001',
    name: 'Shampoo base',
    recipeType: 'FINISHED_GOOD',
    isActive: true,
  });

  assert.equal(result.success, true);
  assert.equal(result.data.code, 'REC-001');
  assert.equal(result.data.name, 'Shampoo base');
});

test('qaParameterSchema accepts the approved numeric QA contract', () => {
  const result = qaParameterSchema.safeParse({
    name: 'pH',
    unit: 'pH',
    expectedValue: '7.0',
    minTolerance: '0.5',
    maxTolerance: '0.5',
  });

  assert.equal(result.success, true);
  assert.equal(result.data.expectedValue, 7);
  assert.equal(result.data.minTolerance, 0.5);
  assert.equal(result.data.maxTolerance, 0.5);
});

test('createRecipeVersionSchema accepts stages with product-bearing inputs and formal QA parameters', () => {
  const result = createRecipeVersionSchema.safeParse({
    expectedYield: 100,
    expectedWaste: 3,
    yieldTolerancePercent: 1.5,
    stages: [
      {
        name: 'Preparacion',
        qaMandatory: true,
        expectedParameters: [{
          name: 'pH',
          unit: 'pH',
          expectedValue: 7,
          minTolerance: 0.5,
          maxTolerance: 0.5,
        }],
        parameterTolerances: [{ legacy: true }],
        requiredEvidence: [{ type: 'photo' }],
        stageInputs: [
          { productId: '11', name: 'Base liquida', quantity: 25.5, unit: 'KG' },
          { productId: '12', name: 'Fragancia', quantity: 5, unit: 'KG' },
          { name: 'Agua purificada', quantity: 20, unit: 'KG' },
        ],
      },
      {
        name: 'Envasado',
        stageInputs: [],
      },
    ],
  });

  assert.equal(result.success, true);
  assert.equal(result.data.stages.length, 2);
  assert.equal(result.data.stages[0].stageInputs[0].productId, 11n);
  assert.equal(result.data.stages[0].stageInputs[2].name, 'Agua purificada');
});

test('createRecipeVersionSchema rejects payloads with legacy ingredients or stageOrder fields', () => {
  assert.equal(createRecipeVersionSchema.safeParse({
    ingredients: [{ productId: '11', quantity: 1 }],
    stages: [{ name: 'Preparacion' }],
  }).success, false, 'ingredients field should be rejected by strict mode');

  assert.equal(createRecipeVersionSchema.safeParse({
    stages: [{ stageOrder: 0, name: 'Preparacion' }],
  }).success, false, 'stageOrder field should be rejected by strict mode');
});

test('recipe version schemas reject invalid effective dates', () => {
  assert.equal(createRecipeVersionSchema.safeParse({
    effectiveFrom: '2026-08-12T10:00:00.000Z',
    effectiveTo: '2026-08-11T10:00:00.000Z',
    stages: [{ name: 'Preparacion' }],
  }).success, false);

  assert.equal(approveRecipeVersionSchema.safeParse({
    effectiveFrom: '2026-08-12T10:00:00.000Z',
    effectiveTo: '2026-08-11T10:00:00.000Z',
  }).success, false);
});

test('createRecipeVersionSchema rejects stage inputs with productId and missing unit', () => {
  const result = createRecipeVersionSchema.safeParse({
    stages: [{
      name: 'Preparacion',
      stageInputs: [{ productId: '11', name: 'Base liquida', quantity: 25.5 }],
    }],
  });

  assert.equal(result.success, false);
  assert.match(result.error.issues[0].message, /unidad es obligatoria/i);
});

test('createRecipeVersionSchema allows descriptive stage inputs without productId and without unit', () => {
  const result = createRecipeVersionSchema.safeParse({
    stages: [{
      name: 'Preparacion',
      stageInputs: [{ name: 'Indicacion operativa', quantity: 1 }],
    }],
  });

  assert.equal(result.success, true);
});

test('createRecipeVersionSchema rejects qaMandatory stages without expected parameters', () => {
  const result = createRecipeVersionSchema.safeParse({
    stages: [{
      name: 'Preparacion',
      qaMandatory: true,
      expectedParameters: [],
    }],
  });

  assert.equal(result.success, false);
  assert.match(result.error.issues[0].message, /qa obligatoria requiere al menos un parametro esperado/i);
});

test('createRecipeVersionSchema rejects QA parameters with negative tolerances', () => {
  const result = createRecipeVersionSchema.safeParse({
    stages: [{
      name: 'Preparacion',
      qaMandatory: true,
      expectedParameters: [{
        name: 'pH',
        unit: 'pH',
        expectedValue: 7,
        minTolerance: -0.1,
        maxTolerance: 0.5,
      }],
    }],
  });

  assert.equal(result.success, false);
  assert.match(result.error.issues[0].message, /tolerancia minima no puede ser negativa/i);
});

test('updateRecipeVersionSchema accepts partial stage updates without order fields', () => {
  const result = updateRecipeVersionSchema.safeParse({
    stages: [
      {
        name: 'Mezcla',
        stageInputs: [{ name: 'Base', quantity: 10 }],
      },
      { name: 'Envasado' },
    ],
  });

  assert.equal(result.success, true);
  assert.equal(result.data.stages.length, 2);
});
