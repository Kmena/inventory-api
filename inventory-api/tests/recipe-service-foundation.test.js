const test = require('node:test');
const assert = require('node:assert/strict');

const productRepository = require('../src/repositories/product.repository');
const recipeRepository = require('../src/repositories/recipe.repository');
const recipeService = require('../src/services/recipe.service');

function withModuleStubs(moduleStubs, run) {
  const originals = [];

  for (const [moduleRef, stubs] of moduleStubs) {
    for (const [key, value] of Object.entries(stubs)) {
      originals.push([moduleRef, key, moduleRef[key]]);
      moduleRef[key] = value;
    }
  }

  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [moduleRef, key, value] of originals) {
        moduleRef[key] = value;
      }
    });
}

const auth = {
  companyId: '7',
  sub: '15',
  permissions: ['recipes.manage', 'recipes.approve'],
};

test('createRecipeVersion rejects stage-input product references outside the authenticated company', async () => {
  await withModuleStubs([
    [recipeRepository, {
      findRecipeById: async (recipeId, companyId) => ({ id: recipeId, companyId, versions: [] }),
    }],
    [productRepository, {
      findProductsByIds: async () => [{ id: 11n }],
    }],
  ], async () => {
    await assert.rejects(
      () => recipeService.createRecipeVersion(33n, {
        stages: [{
          name: 'Preparacion',
          stageInputs: [
            { productId: 11n, name: 'Base', quantity: 5, unit: 'KG' },
            { productId: 99n, name: 'Desconocido', quantity: 1, unit: 'KG' },
          ],
        }],
      }, auth),
      (error) => {
        assert.equal(error?.statusCode, 400);
        assert.equal(error?.code, 'validation_error');
        assert.match(error?.message || '', /deben pertenecer a la empresa autenticada/i);
        return true;
      },
    );
  });
});

test('createRecipeVersion creates the next draft version with stages and derives ingredients from stage inputs', async () => {
  const observed = {
    createPayload: null,
  };

  const createdVersion = {
    id: 91n,
    companyId: 7n,
    recipeId: 33n,
    versionNumber: 3,
    status: 'DRAFT',
    effectiveFrom: null,
    effectiveTo: null,
    expectedYield: 100,
    expectedWaste: 2,
    yieldTolerancePercent: 1.5,
    wasteTolerancePercent: 3,
    instructions: 'Mezclar de forma homogénea',
    notes: 'Borrador operativo',
    approvedAt: null,
    createdAt: new Date('2026-08-12T10:00:00.000Z'),
    updatedAt: new Date('2026-08-12T10:00:00.000Z'),
    createdByUser: { id: 15n, fullName: 'Admin', username: 'admin' },
    approvedByUser: null,
    stages: [{
      id: 2n,
      stageOrder: 0,
      name: 'Preparacion',
      instructions: 'Tamizar',
      responsibleRoleCode: 'production_operator',
      expectedParameters: [],
      parameterTolerances: [],
      requiredEvidence: [],
      qaMandatory: true,
      stageInputs: [{
        id: 3n,
        productId: 11n,
        name: 'Base',
        quantity: 25,
        unit: 'KG',
        sortOrder: 0,
        notes: null,
        product: { id: 11n, code: 'MAT-11', name: 'Base', unit: 'KG', isActive: true },
      }],
    }],
    recipe: { id: 33n, name: 'Shampoo base' },
  };

  const result = await withModuleStubs([
    [recipeRepository, {
      findRecipeById: async (recipeId, companyId) => ({ id: recipeId, companyId, versions: [] }),
      findLatestRecipeVersion: async () => ({ id: 90n, versionNumber: 2 }),
      createRecipeVersion: async (payload) => {
        observed.createPayload = payload;
        return createdVersion;
      },
    }],
    [productRepository, {
      findProductsByIds: async () => [{ id: 11n }],
    }],
  ], () => recipeService.createRecipeVersion(33n, {
    expectedYield: 100,
    expectedWaste: 2,
    yieldTolerancePercent: 1.5,
    wasteTolerancePercent: 3,
    instructions: 'Mezclar de forma homogénea',
    notes: 'Borrador operativo',
    stages: [{
      name: 'Preparacion',
      instructions: 'Tamizar',
      responsibleRoleCode: 'production_operator',
      qaMandatory: true,
      stageInputs: [{ productId: 11n, name: 'Base', quantity: 25, unit: 'KG' }],
    }],
  }, auth));

  assert.equal(observed.createPayload.recipeId, 33n);
  assert.equal(observed.createPayload.companyId, 7n);
  assert.equal(observed.createPayload.versionNumber, 3);
  assert.equal(observed.createPayload.createdByUserId, 15n);
  assert.equal(observed.createPayload.stages.create[0].stageInputs.create[0].name, 'Base');
  assert.equal(result.versionNumber, 3);
  assert.equal(result.status, 'DRAFT');
  assert.equal(result.stages[0].qaMandatory, true);
  // Ingredients are now derived from stage inputs
  assert.equal(result.ingredients.length, 1);
  assert.equal(result.ingredients[0].productId, 11n);
  assert.equal(result.ingredients[0].quantity, 25);
});

test('approveRecipeVersion records approval metadata and marks the version immutable', async () => {
  const observed = {
    updatePayload: null,
  };

  const approvedVersion = {
    id: 91n,
    companyId: 7n,
    recipeId: 33n,
    versionNumber: 3,
    status: 'APPROVED',
    effectiveFrom: new Date('2026-08-15T00:00:00.000Z'),
    effectiveTo: null,
    expectedYield: 100,
    expectedWaste: 2,
    yieldTolerancePercent: 1.5,
    wasteTolerancePercent: 3,
    instructions: 'Mezclar de forma homogénea',
    notes: 'Aprobada',
    approvedAt: new Date('2026-08-12T12:00:00.000Z'),
    createdAt: new Date('2026-08-12T10:00:00.000Z'),
    updatedAt: new Date('2026-08-12T12:00:00.000Z'),
    createdByUser: { id: 15n, fullName: 'Admin', username: 'admin' },
    approvedByUser: { id: 15n, fullName: 'Admin', username: 'admin' },
    stages: [],
    recipe: { id: 33n, name: 'Shampoo base' },
  };

  const result = await withModuleStubs([
    [recipeRepository, {
      findRecipeVersionById: async () => ({ id: 91n, companyId: 7n, status: 'DRAFT' }),
      updateRecipeVersion: async (_id, _companyId, payload) => {
        observed.updatePayload = payload;
        return approvedVersion;
      },
    }],
  ], () => recipeService.approveRecipeVersion(91n, {
    effectiveFrom: new Date('2026-08-15T00:00:00.000Z'),
  }, auth));

  assert.equal(observed.updatePayload.status, 'APPROVED');
  assert.equal(observed.updatePayload.approvedByUserId, 15n);
  assert.ok(observed.updatePayload.approvedAt instanceof Date);
  assert.equal(result.status, 'APPROVED');
  assert.equal(result.approvedByUser.username, 'admin');
});

test('updateRecipeVersion rejects in-place mutation of an approved version', async () => {
  await withModuleStubs([
    [recipeRepository, {
      findRecipeVersionById: async () => ({ id: 91n, companyId: 7n, status: 'APPROVED' }),
    }],
  ], async () => {
    await assert.rejects(
      () => recipeService.updateRecipeVersion(91n, { notes: 'No permitido' }, auth),
      (error) => {
        assert.equal(error?.statusCode, 409);
        assert.equal(error?.code, 'conflict');
        assert.match(error?.message || '', /inmutables/i);
        return true;
      },
    );
  });
});

test('aggregateIngredientsFromStages merges quantities by product across stages', () => {
  const stages = [
    {
      stageInputs: [
        { productId: 11n, quantity: 10, product: { id: 11n, code: 'A', name: 'Base', unit: 'KG', isActive: true } },
        { productId: 12n, quantity: 5, product: { id: 12n, code: 'B', name: 'Fragancia', unit: 'KG', isActive: true } },
        { name: 'Temperatura', quantity: null, productId: null },
      ],
    },
    {
      stageInputs: [
        { productId: 11n, quantity: 15, product: { id: 11n, code: 'A', name: 'Base', unit: 'KG', isActive: true } },
      ],
    },
  ];

  const result = recipeService.aggregateIngredientsFromStages(stages);

  assert.equal(result.length, 2);
  const base = result.find((i) => String(i.productId) === '11');
  const fragrance = result.find((i) => String(i.productId) === '12');
  assert.equal(base.quantity, 25);
  assert.equal(fragrance.quantity, 5);
});
