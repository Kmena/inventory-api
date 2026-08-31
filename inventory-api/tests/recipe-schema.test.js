const test = require('node:test');
const assert = require('node:assert/strict');

const {
  qaParameterSchema,
  recipeQuantityBasisSchema,
  recipeStageTypeSchema,
  recipeStageProcessCodeSchema,
  RECIPE_STAGE_PROCESS_CODES,
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
        stageType: 'PROCESSING',
        processCode: 'MIXING',
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
        stageType: 'PROCESSING',
        processCode: 'PACKING_PREP',
        stageInputs: [],
      },
    ],
  });

  assert.equal(result.success, true);
  assert.equal(result.data.stages.length, 2);
  assert.equal(result.data.stages[0].stageInputs[0].productId, 11n);
  assert.equal(result.data.stages[0].stageInputs[2].name, 'Agua purificada');
  assert.equal(result.data.stages[0].stageType, 'PROCESSING');
  assert.equal(result.data.stages[0].processCode, 'MIXING');
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
      stageType: 'PROCESSING',
      processCode: 'MIXING',
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
        stageType: 'PROCESSING',
        processCode: 'MIXING',
        stageInputs: [{ name: 'Base', quantity: 10 }],
      },
      {
        name: 'Envasado',
        stageType: 'PROCESSING',
        processCode: 'PACKING_PREP',
      },
    ],
  });

  assert.equal(result.success, true);
  assert.equal(result.data.stages.length, 2);
});

// ─── TASK-002: quantityBasis field (production-size-conversion) ───────────────

test('recipeQuantityBasisSchema accepts PER_OUTPUT_KG and PER_FINISHED_UNIT (TASK-002)', () => {
  assert.equal(recipeQuantityBasisSchema.safeParse('PER_OUTPUT_KG').success, true);
  assert.equal(recipeQuantityBasisSchema.safeParse('PER_FINISHED_UNIT').success, true);
  assert.equal(recipeQuantityBasisSchema.safeParse('UNKNOWN').success, false);
});

test('createRecipeVersionSchema accepts quantityBasis PER_OUTPUT_KG and persists it (TASK-002)', () => {
  const result = createRecipeVersionSchema.safeParse({
    quantityBasis: 'PER_OUTPUT_KG',
    stages: [{ name: 'Mezcla', stageType: 'PROCESSING', processCode: 'MIXING', stageInputs: [] }],
  });

  assert.equal(result.success, true);
  assert.equal(result.data.quantityBasis, 'PER_OUTPUT_KG');
});

test('createRecipeVersionSchema accepts quantityBasis PER_FINISHED_UNIT for compatibility (TASK-002)', () => {
  const result = createRecipeVersionSchema.safeParse({
    quantityBasis: 'PER_FINISHED_UNIT',
    stages: [{ name: 'Mezcla', stageType: 'PROCESSING', processCode: 'MIXING', stageInputs: [] }],
  });

  assert.equal(result.success, true);
  assert.equal(result.data.quantityBasis, 'PER_FINISHED_UNIT');
});

test('createRecipeVersionSchema defaults quantityBasis to PER_OUTPUT_KG when omitted (TASK-002)', () => {
  const result = createRecipeVersionSchema.safeParse({
    stages: [{ name: 'Mezcla', stageType: 'PROCESSING', processCode: 'MIXING', stageInputs: [] }],
  });

  assert.equal(result.success, true);
  assert.equal(result.data.quantityBasis, 'PER_OUTPUT_KG');
});

test('createRecipeVersionSchema rejects unknown quantityBasis values (TASK-002)', () => {
  const result = createRecipeVersionSchema.safeParse({
    quantityBasis: 'PER_HOUR',
    stages: [{ name: 'Mezcla', stageType: 'PROCESSING', processCode: 'MIXING', stageInputs: [] }],
  });

  assert.equal(result.success, false);
});

test('updateRecipeVersionSchema propagates quantityBasis in partial update (TASK-002)', () => {
  const result = updateRecipeVersionSchema.safeParse({
    quantityBasis: 'PER_OUTPUT_KG',
    stages: [{ name: 'Mezcla', stageType: 'PROCESSING', processCode: 'MIXING' }],
  });

  assert.equal(result.success, true);
  assert.equal(result.data.quantityBasis, 'PER_OUTPUT_KG');
});

// ─── TASK-001 (qa-rejection-material-reconciliation-amendment): stage typing ──

test('recipeStageTypeSchema accepts RECOLLECTION and PROCESSING (TASK-001)', () => {
  assert.equal(recipeStageTypeSchema.safeParse('RECOLLECTION').success, true);
  assert.equal(recipeStageTypeSchema.safeParse('PROCESSING').success, true);
  assert.equal(recipeStageTypeSchema.safeParse('UNKNOWN').success, false);
});

test('RECIPE_STAGE_PROCESS_CODES includes the approved catalog (TASK-001)', () => {
  const expected = [
    'HEATING', 'COOLING', 'FREEZING', 'DRYING', 'PASTEURIZATION', 'STERILIZATION',
    'MIXING', 'BLENDING', 'DISSOLUTION', 'DILUTION', 'EMULSIFICATION',
    'MILLING', 'GRINDING', 'CUTTING', 'SIEVING', 'FILTERING',
    'FERMENTATION', 'CURING', 'RESTING', 'HYDRATION',
    'FORMING', 'COOKING', 'BAKING',
    'PACKING_PREP', 'LABELING_PREP', 'CAPPING', 'SEALING',
    'OTHER',
  ];

  for (const code of expected) {
    assert.equal(RECIPE_STAGE_PROCESS_CODES.includes(code), true, `Expected ${code} in catalog`);
  }

  assert.equal(recipeStageProcessCodeSchema.safeParse('UNKNOWN_CODE').success, false);
});

test('createRecipeVersionSchema accepts RECOLLECTION stage without processCode (TASK-001)', () => {
  const result = createRecipeVersionSchema.safeParse({
    stages: [{
      name: 'Recoleccion de insumos',
      stageType: 'RECOLLECTION',
      stageInputs: [{ productId: '10', name: 'Glicerina', quantity: 3, unit: 'KG' }],
    }],
  });

  assert.equal(result.success, true);
  assert.equal(result.data.stages[0].stageType, 'RECOLLECTION');
  assert.equal(result.data.stages[0].processCode, null);
});

test('createRecipeVersionSchema rejects PROCESSING stage without processCode (TASK-001)', () => {
  const result = createRecipeVersionSchema.safeParse({
    stages: [{ name: 'Mezcla', stageType: 'PROCESSING' }],
  });

  assert.equal(result.success, false);
  const issue = result.error.issues.find((i) => i.path.includes('processCode'));
  assert.ok(issue, 'Should have processCode issue');
  assert.match(issue.message, /codigo de proceso/i);
});

test('createRecipeVersionSchema rejects PROCESSING stage with invalid processCode (TASK-001)', () => {
  const result = createRecipeVersionSchema.safeParse({
    stages: [{ name: 'Mezcla', stageType: 'PROCESSING', processCode: 'INVALID_CODE' }],
  });

  assert.equal(result.success, false);
});

test('createRecipeVersionSchema accepts OTHER processCode with processLabel (TASK-001)', () => {
  const result = createRecipeVersionSchema.safeParse({
    stages: [{
      name: 'Neutralizacion',
      stageType: 'PROCESSING',
      processCode: 'OTHER',
      processLabel: 'Neutralizacion quimica',
    }],
  });

  assert.equal(result.success, true);
  assert.equal(result.data.stages[0].processCode, 'OTHER');
  assert.equal(result.data.stages[0].processLabel, 'Neutralizacion quimica');
});

test('createRecipeVersionSchema rejects OTHER processCode without processLabel (TASK-001)', () => {
  const result = createRecipeVersionSchema.safeParse({
    stages: [{
      name: 'Neutralizacion',
      stageType: 'PROCESSING',
      processCode: 'OTHER',
    }],
  });

  assert.equal(result.success, false);
  const issue = result.error.issues.find((i) => i.path.includes('processLabel'));
  assert.ok(issue, 'Should have processLabel issue');
  assert.match(issue.message, /processLabel es obligatorio/i);
});

test('createRecipeVersionSchema accepts catalog processCode without processLabel (TASK-001)', () => {
  const result = createRecipeVersionSchema.safeParse({
    stages: [{
      name: 'Sellado',
      stageType: 'PROCESSING',
      processCode: 'SEALING',
    }],
  });

  assert.equal(result.success, true);
  assert.equal(result.data.stages[0].processCode, 'SEALING');
  assert.equal(result.data.stages[0].processLabel, null);
});

test('createRecipeVersionSchema rejects RECOLLECTION stage with processCode (TASK-001)', () => {
  const result = createRecipeVersionSchema.safeParse({
    stages: [{
      name: 'Recoleccion',
      stageType: 'RECOLLECTION',
      processCode: 'MIXING',
    }],
  });

  assert.equal(result.success, false);
  const issue = result.error.issues.find((i) => i.path.includes('processCode'));
  assert.ok(issue, 'Should reject processCode on RECOLLECTION stage');
});

test('createRecipeVersionSchema accepts CAPPING and SEALING as finishing codes (TASK-001)', () => {
  const capping = createRecipeVersionSchema.safeParse({
    stages: [{ name: 'Tapado', stageType: 'PROCESSING', processCode: 'CAPPING' }],
  });
  const sealing = createRecipeVersionSchema.safeParse({
    stages: [{ name: 'Sellado plastico', stageType: 'PROCESSING', processCode: 'SEALING' }],
  });

  assert.equal(capping.success, true);
  assert.equal(sealing.success, true);
});

test('createRecipeVersionSchema defaults stageType to PROCESSING when omitted (TASK-001 backward compat)', () => {
  // Existing API callers that do not send stageType still work if they send processCode
  const result = createRecipeVersionSchema.safeParse({
    stages: [{ name: 'Mezcla', processCode: 'MIXING' }],
  });

  assert.equal(result.success, true);
  assert.equal(result.data.stages[0].stageType, 'PROCESSING');
});
